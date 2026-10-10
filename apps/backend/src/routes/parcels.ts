import { Router } from 'express';
import { query } from '../lib/db.ts';
import { cached, cachePut } from '../lib/cache.ts';
import { vnNoAccent } from '../lib/vn.ts';
import { verifyToken, coVaiTro } from '../lib/auth.ts';
import { computeQhAreas, computeQhTheoBan, outerRing, qhReady, ngoaiVungQh, chuanToaDoDiaChinh } from '../lib/qhCompute.ts';
import { qhCoLuu, tinhQh } from '../lib/qhLuu.ts';


// Mã mục đích sử dụng KHÔNG mở tra cứu thửa — đây là hạ tầng công cộng do Nhà nước quản lý,
// không phải đất giao dịch. Giá trị là cụm từ hiện thẳng cho người dùng đọc.
// Thêm/bớt loại nào thì sửa ĐÚNG MỘT CHỖ này (routes/diaChinh.ts đọc lại đúng bảng này).
export const CHAN_TRA_CUU: Record<string, string> = {
  DGT: 'phần đường giao thông',
  SON: 'phần sông, suối, kênh rạch',
  DTL: 'phần công trình thuỷ lợi',
};
export const parcelsRouter = Router();

// candidate JSONB property keys used by Vietnamese cadastral data
const KEYS_TO = ['so_to', 'SoTo', 'SOTO', 'soto', 'to', 'TO', 'ToBanDo', 'SoToBanDo', 'SHBanDo', 'MaToBanDo'];
const KEYS_THUA = ['so_thua', 'SoThua', 'SOTHUA', 'sothua', 'thua', 'THUA', 'ThuaDat', 'SHThua', 'MaThua'];
const KEYS_XA = ['xa', 'Xa', 'XA', 'TenXa', 'ten_xa', 'Phuong', 'MaXa'];
const KEYS_HUYEN = ['huyen', 'Huyen', 'HUYEN', 'TenHuyen', 'quan', 'Quan'];
const KEYS_CAP = ['Cap', 'cap', 'CAP', 'CapHC', 'cap_hc']; // '2' = chính quyền 2 cấp (xã mới) · '3' = 3 cấp (huyện–xã cũ)
const coalKeys = (keys: string[]) => `COALESCE(${keys.map((k) => `NULLIF(f.properties->>'${k}','')`).join(',')})`;

// Số tờ/số thửa: chấp nhận khoảng trắng thừa, số 0 đứng đầu ("05" = "5"), hoa/thường.
function numKeyClause(keys: string[], val: string, params: any[]): string {
  const raw = String(val).trim().toLowerCase();
  const parts: string[] = [];
  params.push(raw); const pRaw = `$${params.length}`;
  for (const k of keys) parts.push(`lower(btrim(f.properties->>'${k}')) = ${pRaw}`);
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits) {
    params.push(digits.replace(/^0+/, '')); const pD = `$${params.length}`;
    for (const k of keys) parts.push(`regexp_replace(regexp_replace(f.properties->>'${k}','[^0-9]','','g'),'^0+','') = ${pD}`);
  }
  return '(' + parts.join(' OR ') + ')';
}
// Xã: tìm KHÔNG DẤU, khớp một phần ("cam lam" khớp "Xã Cam Lâm").
function textKeyClause(keys: string[], val: string, params: any[]): string {
  params.push('%' + vnNoAccent(String(val).trim()) + '%');
  const p = `$${params.length}`;
  return '(' + keys.map((k) => `vn_unaccent(f.properties->>'${k}') LIKE ${p}`).join(' OR ') + ')';
}
// Cấp hành chính: khớp đúng '2' hoặc '3'.
function capClause(val: string, params: any[]): string {
  params.push(String(val).trim()); const p = `$${params.length}`;
  return '(' + KEYS_CAP.map((k) => `f.properties->>'${k}' = ${p}`).join(' OR ') + ')';
}

// GET /api/parcels/search?soto=&sothua=&xa=  — find cadastral parcels by sheet/parcel no.
parcelsRouter.get('/search', async (req, res, next) => {
  try {
    const { soto, sothua, xa, cap } = req.query as Record<string, string>;
    if (!soto && !sothua) return res.status(400).json({ error: 'Cần ít nhất số thửa hoặc số tờ' });
    const params: any[] = [];
    const where: string[] = [`l.layer_type IN ('parcel','custom')`];
    if (soto) where.push(numKeyClause(KEYS_TO, soto, params));
    if (sothua) where.push(numKeyClause(KEYS_THUA, sothua, params));
    if (xa && xa.trim()) where.push(textKeyClause(KEYS_XA, xa, params));
    if (cap && cap.trim()) where.push(capClause(cap, params));
    const rows = await query(`
      SELECT f.id, f.properties,
             ST_AsGeoJSON(f.geom)::json AS geometry,
             ST_X(ST_PointOnSurface(ST_CollectionExtract(ST_MakeValid(f.geom),3))) AS lng,
             ST_Y(ST_PointOnSurface(ST_CollectionExtract(ST_MakeValid(f.geom),3))) AS lat,
             ROUND(ST_Area(f.geom::geography)::numeric, 1) AS area_m2,
             l.name AS layer_name
      FROM gis_features f JOIN gis_layers l ON l.id = f.layer_id
      WHERE ${where.join(' AND ')}
      LIMIT 50`, params);
    res.json({ count: rows.length, parcels: rows });
  } catch (e) { next(e); }
});

// GET /api/parcels/at?lng=&lat=  — parcel + zoning + linked listings at a clicked point
parcelsRouter.get('/at', async (req, res, next) => {
  try {
    const lng = Number(req.query.lng), lat = Number(req.query.lat);
    if (Number.isNaN(lng) || Number.isNaN(lat)) return res.status(400).json({ error: 'lng and lat required' });
    const pt = `ST_SetSRID(ST_MakePoint($1,$2),4326)`;
    const coal = (keys: string[]) => `COALESCE(${keys.map((k) => `NULLIF(f.properties->>'${k}','')`).join(',')})`;
    // ── TÌM THỬA TẠI ĐIỂM BẤM ──
    // Ưu tiên BẢNG ĐỊA CHÍNH TOÀN TỈNH (dia_chinh, 733 nghìn thửa) vì có chỉ mục riêng nên rất nhanh.
    // Không thấy mới lùi về các lớp cũ nạp qua trang quản trị (gis_features).
    let parcel: any = null;
    let tuBangMoi = false;
    // Lấy CẢ HAI tên: tên xã ghi trong dữ liệu gốc (có thể là đơn vị CŨ) và tên đơn vị
    // HIỆN HÀNH sau sáp nhập 1/7/2025 — hai cái này khác nhau ở 83/147 xã, trước đây web
    // lấy nhầm tên cũ rồi ghi là "Khu vực mới" nên hiện sai.
    const [dc] = await query(`
      SELECT d.id, d.so_to AS "soTo", d.so_thua AS "soThua", d.mdsd, d.dien_tich,
             x.ten AS "xa", x.cap, x.huyen, x.ten_goc AS "tenGoc",
             xm.ten AS "xaMoi", xm.xa_id AS "xaMoiId",
             tt.to_moi AS "soToMoi",   -- số tờ theo bản đồ MỚI (nếu xã đó đã có bảng tra)
             tt.ten_xa_cu AS "tenXaCuThat",  -- xã cũ THẬT theo bảng giấy (khác tên gốc của file)
             tt.to_cu_that AS "soToCuThat",  -- số tờ cũ THẬT theo bảng giấy
             xm.so_xa_gop AS "soXaGop", -- xã mới này gộp từ mấy xã cũ (1 = không thể trùng số tờ)
             ST_AsGeoJSON(d.geom)::json AS geometry,
             ROUND(ST_Area(d.geom::geography)::numeric, 1) AS "areaM2"
      FROM dia_chinh d
      LEFT JOIN dia_chinh_xa x  ON x.xa_id  = d.xa_id
      LEFT JOIN dia_chinh_xa xm ON xm.xa_id = d.xa_moi_id
      -- Đổi số tờ CŨ (đang lưu trong dữ liệu) sang số tờ MỚI của xã sau sáp nhập.
      -- Khớp cả xa_moi_id vì một tờ cũ bị ranh xã mới cắt qua thì nằm ở hai xã mới với hai số khác nhau.
      LEFT JOIN dia_chinh_to tt ON tt.xa_cu_id = d.xa_id AND tt.to_cu = d.to_num AND tt.xa_moi_id = d.xa_moi_id
      WHERE ST_Intersects(d.geom, ${pt}) LIMIT 1`, [lng, lat]).catch(() => [] as any[]);
    // ── ĐẤT HẠ TẦNG CÔNG CỘNG: TẠM THỜI KHÔNG CHO TRA RA THỬA ──
    // Sổ địa chính cấp số tờ/số thửa cho cả đường sá, sông suối, kênh mương y như thửa đất của
    // dân — thường gom cả mạng đường (hoặc cả con suối) của một xã thành MỘT thửa khổng lồ:
    // riêng Cam Đức có thửa đường 13.920 m² và thửa suối 398.950 m². Trả về như thửa bình thường
    // thì người xem tưởng đó là lô đất mênh mông đang rao bán.
    // Chỉ chặn thửa THUẦN một loại; thửa vừa đất ở vừa có phần đường (vd 'ODT+DGT') vẫn tra bình
    // thường vì đó là đất của dân.
    const laDuong = dc ? CHAN_TRA_CUU[String(dc.mdsd || '').trim().toUpperCase()] : null;
    if (laDuong) {
      return res.json({ found: false, khongTraCuu: laDuong, point: { lng, lat },
                        parcel: null, zoning: null, listings: [] });
    }
    if (dc) {
      tuBangMoi = true;
      const laCu = Number(dc.cap) === 3;
      // File mang tên xã MỚI thật ra chứa đất của xã cũ đã bị "nuốt mã" (vd file "Xã Cam Hiệp"
      // chứa đất xã Cam Tân cũ). Danh mục của Sở có sẵn tên gốc đó → hiện cho đúng.
      // Ưu tiên tên xã cũ THẬT lấy từ bảng tra số tờ. Vì sao cần: ở Ninh Hoà và Vạn Ninh, cả mấy
      // xã cũ dùng chung MỘT file mang tên xã gốc — lấy tên gốc của file thì thửa vốn là đất
      // Đại Lãnh cũ lại bị ghi thành "xã Vạn Thọ". Bảng tra biết đúng từng tờ thuộc xã cũ nào.
      const tenTruoc = dc.tenXaCuThat || (laCu ? dc.xa : (dc.tenGoc || null));
      // Số tờ CŨ để hiện kèm: cũng lấy theo bảng giấy nếu có, không thì là số đang lưu trong dữ liệu.
      const soToCu = dc.soToCuThat != null ? String(dc.soToCuThat) : (dc.soTo == null ? null : String(dc.soTo));
      // Dựng lại khối "properties" y như dữ liệu cũ để phần giao diện không phải sửa gì.
      parcel = { ...dc, layer_name: dc.xaMoi || dc.xa || 'Bản đồ địa chính',
        soToMoi: dc.soToMoi == null ? null : String(dc.soToMoi),   // null = xã này chưa có bảng tra số tờ
        // Chỉ xã GỘP TỪ NHIỀU XÃ CŨ mới phải đánh lại số tờ. Xã chỉ gồm 1 xã cũ thì số tờ giữ nguyên,
        // không cần bảng tra và cũng không nên nhắc gì cho khỏi nhiễu.
        canBangTraSoTo: Number(dc.soXaGop) > 1 && dc.soToMoi == null,
        xaCu: tenTruoc,                   // tên đơn vị CŨ của mảnh đất này
        soToCu,                           // số tờ CŨ tương ứng (để hiện "tờ cũ …")
        huyenCu: laCu ? dc.huyen : null,  // huyện/TP cũ
        properties: { to: dc.soTo, thua: dc.soThua, xa: dc.xaMoi || dc.xa, xaCu: tenTruoc,
                      mucDichSuDung: dc.mdsd || '',
                      dienTich_m2: dc.dien_tich == null ? null : Number(dc.dien_tich),
                      nhan: `Thửa ${dc.soThua}, tờ ${dc.soTo}` } };   // thửa trước, tờ sau
      parcel.xa = dc.xaMoi || dc.xa;      // "xa" giờ LUÔN là đơn vị hiện hành
    } else {
      [parcel] = await query(`
        SELECT f.id, f.properties, ST_AsGeoJSON(f.geom)::json AS geometry, l.name AS layer_name,
               ROUND(ST_Area(f.geom::geography)::numeric, 1) AS "areaM2",
               ${coal(KEYS_TO)} AS "soTo", ${coal(KEYS_THUA)} AS "soThua", ${coal(KEYS_XA)} AS "xa"
        FROM gis_features f JOIN gis_layers l ON l.id=f.layer_id
        WHERE l.layer_type IN ('parcel','custom') AND ST_Contains(f.geom, ${pt})
          AND (${coal(KEYS_TO)} IS NOT NULL OR ${coal(KEYS_THUA)} IS NOT NULL)
        ORDER BY (l.layer_type='parcel') DESC LIMIT 1`, [lng, lat]);
    }
    // Mặt nạ "vùng đã có QH" (nội thị) — KHÔNG phải loại đất; dùng để suy ra Đất giao thông
    // (đường = phần thửa trống nằm giữa các ô đất, giống app tham chiếu).
    const MASK = `(f.properties->>'bg'='true' OR f.properties->>'loai'='Đất nội thị (chưa phân loại)' OR f.properties->>'lo'='Noi thi')`;
    const BLOCK = `(COALESCE(f.properties->>'bg','')<>'true' AND COALESCE(f.properties->>'loai','')<>'Đất nội thị (chưa phân loại)' AND COALESCE(f.properties->>'lo','')<>'Noi thi')`;
    const TYPE = `COALESCE(NULLIF(f.properties->>'loai',''), NULLIF(f.properties->>'lo',''), NULLIF(f.properties->>'KyHieu',''),
                  NULLIF(f.properties->>'MaLoaiDat',''), NULLIF(f.properties->>'TenLoaiDat',''), NULLIF(f.properties->>'LoaiDat',''),
                  NULLIF(f.properties->>'MDSDD',''), NULLIF(f.properties->>'QHSDD',''), NULLIF(f.properties->>'Loai',''),
                  NULLIF(f.properties->>'layer',''), NULLIF(f.properties->>'Layer',''), '—')`;
    // QH tại điểm click: ưu tiên Ô ĐẤT thật (bỏ mặt nạ nội thị)
    const [zoning] = await query(`
      SELECT f.properties, l.name AS layer_name
      FROM gis_features f JOIN gis_layers l ON l.id=f.layer_id
      WHERE l.layer_type='zoning' AND ${BLOCK} AND ST_Contains(ST_MakeValid(f.geom), ${pt}) LIMIT 1`, [lng, lat]);
    // Diện tích giao (thửa ∩ vùng QH): tự sửa hình lỗi, union, chỉ lấy phần polygon, đo trên geography (m²)
    const IA = `ST_Area(ST_CollectionExtract(ST_Union(ST_Intersection(ST_MakeValid(f.geom), p.geom)),3)::geography)`;
    // Chồng lấn quy hoạch: thửa đè lên những ô đất nào, mỗi loại bao nhiêu m²
    let overlaps: any[] = [];
    // Bảng chứa hình thửa: thửa lấy từ bản đồ địa chính mới thì nằm ở dia_chinh, còn lại ở gis_features.
    // (Trước đây mấy câu tính quy hoạch dự phòng bên dưới luôn đọc gis_features — với thửa địa chính
    //  thì đó là NHẦM BẢNG, mã số trùng nhau là lấy phải hình của thửa khác.)
    const bangThua = tuBangMoi ? 'dia_chinh' : 'gis_features';
    // Thửa nằm ngoài vùng đã có dữ liệu quy hoạch (hiện chỉ có huyện Cam Lâm cũ)?
    // Thửa của bản đồ địa chính toàn tỉnh (dia_chinh) bị TRƯỢT 0,53 m đông / 0,14 m bắc so với toạ độ VN-2000 chính thức
    // (đơn vị cung cấp đổi toạ độ bằng bộ tham số khác) → dịch về đúng chỗ rồi mới chồng lên quy hoạch. Xem chuanToaDoDiaChinh.
    const ringGoc = outerRing((parcel as any)?.geometry) || [];
    const ringThua = tuBangMoi ? chuanToaDoDiaChinh(ringGoc) : ringGoc;
    const ngoaiQh = !!parcel && ngoaiVungQh(ringThua);
    // Kết quả tính quy hoạch: thửa địa chính dùng bản ĐÃ LƯU SẴN nếu còn đúng phiên bản (lib/qhLuu.ts), không thì tính + lưu.
    const dtThua = Number((parcel as any)?.areaM2) || 0;
    const kqQh = parcel && qhReady() ? (tuBangMoi ? await qhCoLuu(Number(parcel.id), ringThua, dtThua) : tinhQh(ringThua, dtThua)) : null;
    if (parcel && !ngoaiQh) {
      // ƯU TIÊN: diện tích QH theo ĐƯỜNG THẬT (QĐ205 cố định) — chạy TƯƠI theo hình thửa hiện tại.
      // Nhờ vậy đổi/nạp bản đồ địa chính mới vẫn đúng, KHÔNG cần tính sẵn lại. Thiếu dữ liệu đường → rơi về cách cũ.
      const _pre = kqQh ? kqQh.pre : null;
      if (_pre && _pre.length) {
        overlaps = _pre.map((o) => ({ layer: 'Quy hoạch', type: o.type, hz: o.hz, areaM2: o.areaM2 }));
      } else {
      overlaps = await query(`
        WITH p AS (SELECT ST_MakeValid(geom) AS geom FROM ${bangThua} WHERE id=$1)
        SELECT ${TYPE} AS type, NULLIF(f.properties->>'hz','') AS hz,
               ROUND(${IA}::numeric, 1) AS "areaM2"
        FROM gis_features f JOIN gis_layers l ON l.id=f.layer_id, p
        WHERE l.layer_type='zoning' AND ${BLOCK} AND ST_Intersects(f.geom, p.geom)
        GROUP BY type, hz
        HAVING ${IA} > 0.5
        ORDER BY "areaM2" DESC`, [parcel.id]);
      // Đất giao thông = (thửa ∩ mặt nạ nội thị) − (thửa ∩ các ô đất)
      const [gt] = await query(`
        WITH p AS (SELECT ST_MakeValid(geom) AS geom FROM ${bangThua} WHERE id=$1),
        m AS (SELECT COALESCE(${IA},0) a
              FROM gis_features f JOIN gis_layers l ON l.id=f.layer_id, p
              WHERE l.layer_type='zoning' AND ${MASK} AND ST_Intersects(f.geom,p.geom)),
        b AS (SELECT COALESCE(${IA},0) a
              FROM gis_features f JOIN gis_layers l ON l.id=f.layer_id, p
              WHERE l.layer_type='zoning' AND ${BLOCK} AND ST_Intersects(f.geom,p.geom))
        SELECT GREATEST(0,(SELECT a FROM m)-(SELECT a FROM b)) AS gt`, [parcel.id]);
      const gtArea = Math.round((Number(gt?.gt) || 0) * 10) / 10;
      // Nếu dữ liệu vector CHUẨN (từ DGN) ĐÃ CÓ ô "Đất giao thông/đường" thật → dùng trực tiếp, KHÔNG bịa leftover.
      const hasRealRoad = overlaps.some((o) => /giao thông|giao thong|\bđường\b|\bduong\b/i.test(String(o.type || '')));
      if (!hasRealRoad && gtArea > 2) {
        // FALLBACK cho dữ liệu CŨ (chưa có ô giao thông): "giao thông" = phần thửa trống chưa được ô đất phủ.
        // Nếu phần trống chiếm >65% mà chỉ có 1 ô đất → ô đất số hoá HỞ → gộp vào ô đất; ngược lại giữ Đất giao thông.
        const blockArea = overlaps.reduce((s, o) => s + (Number(o.areaM2) || 0), 0);
        overlaps.sort((a, b) => (Number(b.areaM2) || 0) - (Number(a.areaM2) || 0));
        if (overlaps.length === 1 && blockArea > 0 && gtArea > 0.65 * (blockArea + gtArea)) {
          overlaps[0].areaM2 = Math.round((Number(overlaps[0].areaM2 || 0) + gtArea) * 10) / 10;
        } else {
          overlaps.push({ layer: 'Quy hoạch', type: 'Đất giao thông', hz: null, areaM2: gtArea });
        }
      }
      overlaps.sort((a, b) => (Number(b.areaM2) || 0) - (Number(a.areaM2) || 0));
      }
    }
    // Thửa liền kề (tiếp giáp ranh) → ghi số hiệu quanh sơ đồ trích lục.
    let neighbors: any[] = [];
    if (parcel && tuBangMoi) {
      // Thửa liền kề trong bảng địa chính mới — chỉ tìm quanh thửa đang xem nên rất nhanh.
      neighbors = await query(`
        SELECT d.so_thua AS "so",
               ST_X(ST_PointOnSurface(d.geom)) AS lng, ST_Y(ST_PointOnSurface(d.geom)) AS lat
        FROM dia_chinh d, (SELECT geom FROM dia_chinh WHERE id=$1) p
        WHERE d.id <> $1 AND d.so_thua IS NOT NULL
          AND d.geom && p.geom AND ST_Touches(d.geom, p.geom)
        LIMIT 16`, [parcel.id]).catch(() => [] as any[]);
    } else if (parcel) {
      neighbors = await query(`
        SELECT ${coal(KEYS_THUA)} AS "so",
               ST_X(ST_PointOnSurface(ST_CollectionExtract(ST_MakeValid(f.geom),3))) AS lng,
               ST_Y(ST_PointOnSurface(ST_CollectionExtract(ST_MakeValid(f.geom),3))) AS lat
        FROM gis_features f JOIN gis_layers l ON l.id=f.layer_id,
             (SELECT ST_MakeValid(geom) AS geom FROM gis_features WHERE id=$1) p
        WHERE l.layer_type IN ('parcel','custom') AND f.id<>$1
          AND ${coal(KEYS_THUA)} IS NOT NULL AND f.geom && p.geom
          AND ST_Touches(ST_MakeValid(f.geom), p.geom)
        LIMIT 16`, [parcel.id]);
    }
    // Điểm rơi vào khoảng trống (đường) mà không trúng ô đất → dòng QH hiện "Đất giao thông"
    let zoningOut: any = zoning?.properties ?? null;
    if (!zoningOut && overlaps.some((o) => o.type === 'Đất giao thông')) zoningOut = { loai: 'Đất giao thông' };
    // Chỉnh nhãn loại đất cho đúng chuẩn (sửa tên trích sai). Thêm cặp mới ở đây khi cần.
    const RENAME_LOAI: Record<string, string> = { 'Làng xóm hiện trạng': 'Làng xóm đô thị hóa' };
    for (const o of overlaps) if (o.type && RENAME_LOAI[o.type]) o.type = RENAME_LOAI[o.type];
    if (zoningOut?.loai && RENAME_LOAI[zoningOut.loai]) zoningOut = { ...zoningOut, loai: RENAME_LOAI[zoningOut.loai] };
    const linked = parcel
      ? await query(`SELECT id,title,price,property_type AS "propertyType", ST_X(geom) lng, ST_Y(geom) lat
          FROM listings WHERE status<>'hidden' AND ST_Contains((SELECT geom FROM ${bangThua} WHERE id=$1), geom)`, [parcel.id])
      : await query(`SELECT id,title,price,property_type AS "propertyType", ST_X(geom) lng, ST_Y(geom) lat
          FROM listings WHERE status<>'hidden' AND ST_DWithin(geom::geography, ${pt}::geography, 300)`, [lng, lat]);
    if (!parcel && !zoningOut && overlaps.length === 0 && linked.length === 0)
      return res.json({ found: false, point: { lng, lat }, parcel: null, zoning: null, overlaps: [], listings: [] });
    // qhNgoaiVung = thửa nằm NGOÀI vùng đã có dữ liệu quy hoạch (hiện chỉ có huyện Cam Lâm cũ).
    // Giao diện dựa vào cờ này để nói thẳng "chưa có dữ liệu", thay vì im lặng để người xem
    // tưởng thửa không dính quy hoạch gì.
    // Một thửa hay bị NHIỀU bản quy hoạch phủ chồng (QĐ205 trùm cả huyện, bên trong còn QĐ893 và
    // các bản phân khu 1/2000). Liệt kê RIÊNG từng bản, mỗi bản ghi rõ loại đất + diện tích, để
    // người xem tự đối chiếu — không bản nào bị giấu đi.
    const qhCacBan = parcel ? (kqQh ? kqQh.cacBan : computeQhTheoBan(ringThua, dtThua)) : [];
    res.json({ found: true, point: { lng, lat }, parcel: parcel ?? null, zoning: zoningOut, overlaps, neighbors, listings: linked,
               qhCacBan,
               qhNgoaiVung: ngoaiQh && overlaps.length === 0 && qhCacBan.length === 0 });
  } catch (e) { next(e); }
});

// GET /api/parcels/dia-ban — danh sách xã có trong dữ liệu thửa (cho ô chọn xã theo cấp)
// TRƯỚC ĐÂY: gom nhóm thẳng trên bảng gis_features → phải quét TOÀN BỘ bảng mỗi lần ai đó mở
// trang bản đồ. Với 733 nghìn thửa thì đó là truy vấn nặng nhất hệ thống, mở bản đồ sẽ đứng hình.
// GIỜ: đọc bảng danh mục dia_chinh_xa (147 dòng, đã tính sẵn) → gần như tức thì.
parcelsRouter.get('/dia-ban', async (req, res, next) => {
  try {
    // Số thửa của từng xã là thông tin nội bộ → chỉ quản trị viên mới nhận được con số.
    const h = String(req.headers.authorization || '');
    const nguoi = h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
    const quanLy = coVaiTro(nguoi as any, 'admin', 'gis');
    const KEY = quanLy ? 'parcels:dia-ban:admin' : 'parcels:dia-ban';
    const san = cached<any>(KEY);
    if (san) return res.json(san);
    const rows = await query(`
      SELECT cap::text AS cap, huyen, ten AS xa, so_thua AS "count", xa_id AS "xaId"
      FROM dia_chinh_xa WHERE so_thua > 0 ORDER BY cap, huyen, ten`).catch(() => [] as any[]);
    const out = { list: rows.map((r: any) => quanLy ? r : { cap: r.cap, huyen: r.huyen, xa: r.xa, xaId: r.xaId }) };
    cachePut(KEY, out, 10 * 60 * 1000);
    if (quanLy) res.setHeader('Cache-Control', 'private, no-store');
    res.json(out);
  } catch (e) { next(e); }
});
