import { Router } from 'express';
import { query } from '../lib/db.ts';
import { cached, cachePut } from '../lib/cache.ts';
import { vnNoAccent } from '../lib/vn.ts';
import { verifyToken, coVaiTro, coGoiChung } from '../lib/auth.ts';
import { computeQhAreas, computeQhTheoBan, outerRing, qhReady, ngoaiVungQh, chuanToaDoDiaChinh, manhQh205 } from '../lib/qhCompute.ts';
import { sqlDienTichPhang, sqlHeSoPhang } from '../lib/dienTichPhang.ts';
import { qhCoLuu, tinhQhHinh, dtPhangVong } from '../lib/qhLuu.ts';
import { qhTuPdf, qhTuPdfHinh } from '../lib/qhPdf.ts';
import { qh500TrenThua, qh500TrenHinh } from '../lib/qh500.ts';
import { nguoiDungTuYeuCau } from '../middleware/auth.ts';

// ── AI ĐƯỢC XEM ĐỦ QUY HOẠCH CAM LÂM (15/10/2026) — MỘT CHỖ DUY NHẤT để đổi (vd sau này mở cho gói trả phí / vai trò riêng) ──
// Chủ dự án: "ở Cam Lâm chỉ cho 893 là được xem free, còn lại khoá lại". Bị khoá: QĐ205 (quy hoạch chung 2045), 7 bản phân khu 1/2000,
// 1/500 (lib/qh500.ts). Ảnh bản đồ các bản này: routes/qhRieng.ts (vé admin) + nginx chặn đường /tiles/ cũ.
// (15/10/2026) + khách có GÓI CHỨC NĂNG CHUNG còn hạn (lib/auth.ts coGoiChung — gồm cả admin): mở hết TRỪ 1/500 (1/500 vẫn chỉ admin — qh500).
export const xemDuQhCamLam = (nd: any) => coGoiChung(nd);
const PK_CAM_LAM = new Set(['2076', '2101', '2222', '918', 'cuhin', 'taynam', 'taybac']);   // mã 7 bản phân khu trong qhCacBan (qhCompute.ts)
import { isFlagOn } from '../lib/flags.ts';


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
             ROUND(${sqlDienTichPhang('f.geom')}::numeric, 1) AS area_m2,   -- mặt phẳng VN-2000 như sổ (lib/dienTichPhang.ts)
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
             ROUND(${sqlDienTichPhang('d.geom')}::numeric, 1) AS "areaM2"   -- mặt phẳng VN-2000 như sổ / MicroStation (lib/dienTichPhang.ts)
      FROM dia_chinh d
      LEFT JOIN dia_chinh_xa x  ON x.xa_id  = d.xa_id
      LEFT JOIN dia_chinh_xa xm ON xm.xa_id = d.xa_moi_id
      -- Đổi số tờ CŨ (đang lưu trong dữ liệu) sang số tờ MỚI của xã sau sáp nhập.
      -- Khớp cả xa_moi_id vì một tờ cũ bị ranh xã mới cắt qua thì nằm ở hai xã mới với hai số khác nhau.
      LEFT JOIN dia_chinh_to tt ON tt.xa_cu_id = d.xa_id AND tt.to_cu = d.to_num AND tt.xa_moi_id = d.xa_moi_id
      WHERE ST_Intersects(d.geom, ${pt})
      -- (15/10/2026) Thửa CHỒNG NHAU: mẫu 7.560 thửa → 7,3 % điểm giữa thửa nằm trong ≥ 2 thửa (437/555 khác cỡ — thường là thửa to "bao"
      -- thửa nhỏ: bản ghi cũ chưa tách, vd Thửa 187 · Tờ 24 1.319 m² bao Thửa 324 · Tờ 24 236 m²; 118/555 gần trùng khít — cùng hình, hai
      -- số khác nhau, vd Thửa 23 · Tờ 50 và Thửa 23 · Tờ 500). Trước "LIMIT 1" không sắp xếp → bấm vào thửa nhỏ có lúc ra thửa to, hoặc ra
      -- thửa đường / suối rồi báo "không tra cứu". Nay: thửa KHÔNG phải đường / sông / thuỷ lợi trước, rồi thửa NHỎ nhất chứa điểm bấm
      -- (cụ thể nhất); các thửa gần trùng khít với thửa nhỏ nhất (lệch ≤ 2 %) thì ưu tiên bản ghi CÓ ghi loại đất; còn hoà thì theo mã.
      ORDER BY (upper(trim(coalesce(d.mdsd, ''))) IN (${Object.keys(CHAN_TRA_CUU).map((k) => `'${k}'`).join(',')})),
               ST_Area(d.geom) > 1.02 * min(ST_Area(d.geom)) OVER (PARTITION BY upper(trim(coalesce(d.mdsd, ''))) IN (${Object.keys(CHAN_TRA_CUU).map((k) => `'${k}'`).join(',')})),
               coalesce(trim(d.mdsd), '') = '',
               ST_Area(d.geom), d.id
      LIMIT 1`, [lng, lat]).catch(() => [] as any[]);
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
               ROUND(${sqlDienTichPhang('f.geom')}::numeric, 1) AS "areaM2",
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
    // Diện tích giao (thửa ∩ vùng QH): tự sửa hình lỗi, union, chỉ lấy phần polygon, đo trên geography (m²) rồi đổi ra MẶT PHẲNG
    // VN-2000 (nhân hệ số k² tại thửa — lib/dienTichPhang.ts) cho cùng thước đo với diện tích thửa
    const IA = `(ST_Area(ST_CollectionExtract(ST_Union(ST_Intersection(ST_MakeValid(f.geom), p.geom)),3)::geography) * max(${sqlHeSoPhang('p.geom')}))`;   // max(): p chỉ 1 dòng, bọc hàm gộp để dùng được cạnh ST_Union (GROUP BY)
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
    // Tính trên CẢ HÌNH thửa (mọi mảnh, trừ lỗ thủng — qhLuu.tinhQhHinh), không chỉ vòng ngoài lớn nhất.
    const kqQh = parcel && qhReady() ? (tuBangMoi ? await qhCoLuu(Number(parcel.id), (parcel as any).geometry, dtThua, chuanToaDoDiaChinh)
      : tinhQhHinh((parcel as any).geometry, dtThua)) : null;
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
    // Chỉnh nhãn loại đất cho đúng chuẩn (bảng RENAME_LOAI ở cuối tệp, dùng chung với thửa khách tự vẽ).
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
    const qhCacBanCL = parcel ? (kqQh ? kqQh.cacBan : computeQhTheoBan(ringThua, dtThua)) : [];
    // (14/10/2026) Thửa NGOÀI Cam Lâm (không bản CAD nào phủ): tra QHSDĐ 2030 của huyện/thị đó, BÓC TỪ BẢN ĐỒ PDF của Sở
    // (lib/qhPdf.ts, chỉ thửa địa chính toàn tỉnh). Mục có nguon:'pdf' — giao diện ghi "tham khảo" và KHÔNG cho in phiếu.
    // CÔNG TẮC: cờ 'qh_pdf_bat' trong app_flags (mặc định KHÔNG có = TẮT) — bật sau khi chủ dự án duyệt ảnh thử:
    //   INSERT INTO app_flags(key) VALUES ('qh_pdf_bat') ON CONFLICT DO NOTHING;   ·  tắt: DELETE FROM app_flags WHERE key='qh_pdf_bat';
    // (máy chủ THỬ để chụp ảnh duyệt đặt biến môi trường QH_PDF_THU=1)
    // (14/10/2026 khuya) Thửa SÁT RANH Cam Lâm mà bản CAD chỉ chạm một mẩu (Thửa 109 · Tờ 43 xã Suối Hiệp: QĐ893 phủ 76 m², 1.534 m² "ngoài
    // phạm vi") trước bị bỏ hẳn quy hoạch PDF của huyện mình → người xem chỉ thấy mẩu QĐ893. Nay bản CAD phủ DƯỚI một nửa thửa thì vẫn tra
    // thêm bản PDF (mỗi mục ghi rõ nguồn; phần ngoài bản nào thì bản đó tự ghi "ngoài phạm vi" / "chưa xác định").
    // (15/10/2026) Phần quy hoạch cũ tính sẵn (overlaps — QĐ205) cũng vậy: thửa Nha Trang / Diên Khánh… sát ranh Cam Lâm chỉ bị QĐ205 chạm một
    // mẩu (Thửa 65 · Tờ 65 Phường Nam Nha Trang 222 ha: 0,8 ha "rừng sản xuất", còn lại "ngoài phạm vi") từng bị CHẶN hẳn QHSDĐ của chính
    // huyện mình. Nay phủ DƯỚI một nửa thửa thì vẫn tra bản PDF.   (cách đo: phuCuaBan / phuCuaPre ở cuối tệp)
    const qhPdf = parcel && tuBangMoi && canTraPdf(overlaps, qhCacBanCL)
      && (process.env.QH_PDF_THU === '1' || await isFlagOn('qh_pdf_bat'))
      ? await qhTuPdf(Number(parcel.id), dtThua) : [];
    // (15/10/2026) QH CHI TIẾT 1/500 (lib/qh500.ts): loại đất + diện tích CHỈ gửi cho ADMIN (kiểm thẻ đầy đủ). Người khác: thửa nằm trong
    // ranh 1/500 thì chỉ có dấu khoá (giao diện hiện "liên hệ admin"). Trả số liệu thì đánh dấu riêng tư — không cho nginx / Cloudflare
    // giữ lại phát cho người khác (nginx vốn đã bỏ qua đệm khi yêu cầu có thẻ đăng nhập).
    // TRA THỬA Ở CAM LÂM VẪN MIỄN PHÍ (chủ dự án 15/10/2026: "ở 893 cứ cho tra cứu tới thửa như bình thường, chỉ khoá không cho làm mờ bản
    // đồ quy hoạch"): người chưa có gói chung vẫn nhận thửa + QĐ893; QĐ205 / phân khu chỉ còn dấu khoá (khoaQhCamLam bên dưới).
    const nd = await nguoiDungTuYeuCau(req).catch(() => null);
    const xemDu = xemDuQhCamLam(nd);
    let qh500: any = null;
    if (parcel && tuBangMoi) {
      qh500 = await qh500TrenThua(Number(parcel.id), dtThua, xemDu).catch(() => null);   // 1/500: admin + gói thành viên (15/10/2026 tối)
    }
    const qhCacBan = [...qhCacBanCL, ...qhPdf, ...(qh500 ? [qh500] : [])];
    // (10/10/2026) thêm: có thửa mà KHÔNG bản nào phủ (vd thửa Phước Đồng sát ranh QĐ205, nay phần ngoài ranh không còn bị
    // ghi đường giả) → cũng là "chưa có dữ liệu", kẻo trang hiện khung quy hoạch trống. Tính trên dữ liệu ĐỦ (trước khi khoá bớt).
    const qhNgoaiVung = (ngoaiQh || !!parcel) && overlaps.length === 0 && qhCacBan.length === 0;
    const kh = khoaQhCamLam(xemDu, overlaps, zoningOut, qhCacBan);
    if (kh.rieng) res.set('Cache-Control', 'private, no-store');
    res.json({ found: true, point: { lng, lat }, parcel: parcel ?? null, zoning: kh.zoning, overlaps: kh.overlaps, neighbors, listings: linked,
               qhCacBan: kh.qhCacBan, qhNgoaiVung });
  } catch (e) { next(e); }
});

// ── KHOÁ QUY HOẠCH CAM LÂM (15/10/2026, chủ dự án: "ở Cam Lâm chỉ cho 893 là được xem free, còn lại khoá lại, sửa cả phần thông tin
// kiểm tra quy hoạch"). Người không được xem đủ: KHÔNG gửi QĐ205 (overlaps + loại đất tại điểm bấm) và 7 bản phân khu 1/2000 — chỉ gửi
// DẤU KHOÁ cho bản nào có phủ thửa (giao diện hiện trang "🔒 … Liên hệ admin để xem"). QĐ893 + QHSDĐ 2030 các huyện (PDF) gửi đủ.
// `rieng` = có số liệu riêng (QĐ205 / phân khu / 1/500) → nơi gọi đánh dấu riêng tư: nginx / Cloudflare không giữ lại phát cho người khác.
// Dùng chung cho thửa địa chính (/at) và thửa khách tự vẽ (/qh-tu-ve) — đổi luật khoá thì chỉ sửa ở đây.
function khoaQhCamLam(xemDu: boolean, overlaps: any[], zoning: any, qhCacBan: any[]) {
  if (xemDu) return { overlaps, zoning, qhCacBan, rieng: overlaps.length > 0 || qhCacBan.some((b: any) => PK_CAM_LAM.has(String(b?.ma)) || (b?.ma === 'ct500' && !b?.khoa)) };
  const co205 = overlaps.length > 0;
  const coPk = qhCacBan.some((b: any) => PK_CAM_LAM.has(String(b?.ma)));
  const cacBan = qhCacBan.filter((b: any) => !PK_CAM_LAM.has(String(b?.ma)));
  if (coPk) cacBan.push({ ma: 'pk', ten: 'Quy hoạch phân khu 1/2000', nguon: 'khoa', khoa: true, areas: [] });
  if (co205) cacBan.unshift({ ma: '205', ten: 'Quy hoạch chung 2045 (QĐ205)', nguon: 'khoa', khoa: true, areas: [] });
  return { overlaps: [] as any[], zoning: null, qhCacBan: cacBan, rieng: false };
}

// (14/10/2026 khuya) Thửa SÁT RANH Cam Lâm mà bản CAD chỉ phủ một mẩu vẫn tra thêm QHSDĐ PDF của huyện mình: chỉ tra khi CẢ phần QĐ205
// (overlaps) LẪN các bản CAD khác phủ DƯỚI một nửa thửa (hoặc không có). Dùng chung cho /at và /qh-tu-ve.
const NGOAI_PHAM_VI = 'Nằm ngoài phạm vi bản quy hoạch này';
function phuCuaBan(qhCacBanCL: any[]): number {
  return Math.max(0, ...qhCacBanCL.map((b: any) => {
    const ds = (b?.areas || []) as { type: string; areaM2: number }[];
    const tong = ds.reduce((s, a) => s + (Number(a.areaM2) || 0), 0);
    const ngoai = ds.filter((a) => a.type === NGOAI_PHAM_VI).reduce((s, a) => s + (Number(a.areaM2) || 0), 0);
    return tong > 0 ? (tong - ngoai) / tong : 0;
  }));
}
function phuCuaPre(overlaps: any[]): number {
  const ngoaiPre = overlaps.filter((o) => o.type === NGOAI_PHAM_VI).reduce((s, o) => s + (Number(o.areaM2) || 0), 0);
  const tongPre = overlaps.reduce((s, o) => s + (Number(o.areaM2) || 0), 0);
  return tongPre > 0 ? (tongPre - ngoaiPre) / tongPre : 0;
}
const canTraPdf = (overlaps: any[], qhCacBanCL: any[]) =>
  (overlaps.length === 0 || phuCuaPre(overlaps) < 0.5) && (qhCacBanCL.length === 0 || phuCuaBan(qhCacBanCL) < 0.5);
// Chỉnh nhãn loại đất cho đúng chuẩn (sửa tên trích sai). Thêm cặp mới ở đây khi cần.
const RENAME_LOAI: Record<string, string> = { 'Làng xóm hiện trạng': 'Làng xóm đô thị hóa' };

// ── POST /api/parcels/qh-tu-ve — KIỂM TRA QUY HOẠCH CHO THỬA KHÁCH TỰ VẼ (15/10/2026) ──────────────────────────────────────────────
// Chủ dự án: "nếu người dùng vẽ thửa từ toạ độ thì vẫn kiểm tra quy hoạch được, phần thửa tờ thông tin ghi thửa giả định do khách hàng
// tự vẽ". Thân yêu cầu: { geometry: GeoJSON Polygon WGS84 } — giao diện đổi THẲNG từ toạ độ VN-2000 khách nhập (lib/vn2000.ts).
// Tính Y HỆT thửa địa chính (/at): cùng hàm, cùng luật khoá Cam Lâm (khoaQhCamLam), cùng cách chọn bản PDF theo huyện cũ. Chỉ khác:
//  · KHÔNG dịch hình — toạ độ VN-2000 khách nhập đã đúng chỗ (chỉ lớp địa chính mới bị trượt 0,53 m, xem chuanToaDoDiaChinh);
//  · diện tích = diện tích PHẲNG VN-2000 của chính hình đó (như sổ — dtPhangVong), không có số tờ / số thửa / thửa liền kề / tin rao;
//  · không lưu kết quả (qh_luu chỉ dành cho thửa địa chính có mã).
// Thửa vẽ to tính lâu (chủ yếu phần cắt hình QĐ205 + phân khu) → giới hạn diện tích + hạn mức riêng (index.ts).
const THUA_VE_TOI_DA_M2 = 500_000;    // 50 ha — sổ đỏ hiếm khi lớn hơn; to hơn thì tính chậm mà không còn là "một thửa"
parcelsRouter.post('/qh-tu-ve', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    const g = req.body?.geometry;
    if (!g || g.type !== 'Polygon' || !Array.isArray(g.coordinates) || g.coordinates.length !== 1 || !Array.isArray(g.coordinates[0]))
      return res.status(400).json({ error: 'Hình thửa không hợp lệ — vui lòng vẽ lại từ bảng toạ độ.' });
    const ring: number[][] = g.coordinates[0].map((p: any) => [Number(p?.[0]), Number(p?.[1])]);
    if (!ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x > 106.5 && x < 110 && y > 10.5 && y < 13.5))
      return res.status(400).json({ error: 'Toạ độ nằm ngoài vùng Khánh Hòa — kiểm tra lại số X, Y.' });
    const dau = ring[0], cuoi = ring[ring.length - 1];
    if (dau[0] !== cuoi[0] || dau[1] !== cuoi[1]) ring.push([dau[0], dau[1]]);
    if (ring.length < 4 || ring.length > 1001) return res.status(400).json({ error: 'Thửa cần từ 3 đến 1.000 điểm toạ độ.' });
    const geom = { type: 'Polygon', coordinates: [ring] };
    const gj = JSON.stringify(geom);
    const [kt] = await query<any>(`
      SELECT ST_IsValid(g) AS hop, ST_X(ST_PointOnSurface(ST_MakeValid(g))) AS lng, ST_Y(ST_PointOnSurface(ST_MakeValid(g))) AS lat
      FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS g) t`, [gj]);
    if (!kt?.hop) return res.status(400).json({ error: 'Các điểm toạ độ tạo thành hình TỰ CẮT NHAU (cạnh thửa vắt chéo) — kiểm tra lại thứ tự các điểm theo sổ.' });
    const dt = Math.round(dtPhangVong(ring) * 10) / 10;   // làm tròn 0,1 m² như diện tích thửa địa chính (/at)
    if (!(dt >= 1)) return res.status(400).json({ error: 'Diện tích thửa quá nhỏ — kiểm tra lại các điểm toạ độ.' });
    if (dt > THUA_VE_TOI_DA_M2) return res.status(400).json({ error: `Thửa vẽ quá lớn (${(dt / 10000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ha) — chỉ kiểm tra được thửa đến ${THUA_VE_TOI_DA_M2 / 10000} ha.` });
    const lng = Number(kt.lng), lat = Number(kt.lat);
    // Xã của thửa: thửa địa chính tại (hoặc gần nhất, trong ~300 m) điểm giữa hình — để ghi "Khu vực" + chọn bản PDF của đúng huyện cũ.
    const [xa] = await query<any>(`
      SELECT d.xa_id AS "xaId", x.ten AS "xa", x.cap, x.huyen, x.ten_goc AS "tenGoc", xm.ten AS "xaMoi"
      FROM dia_chinh d
      LEFT JOIN dia_chinh_xa x  ON x.xa_id  = d.xa_id
      LEFT JOIN dia_chinh_xa xm ON xm.xa_id = d.xa_moi_id
      WHERE ST_DWithin(d.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326), 0.003)
      ORDER BY d.geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1`, [lng, lat]).catch(() => [] as any[]);
    const nd = await nguoiDungTuYeuCau(req).catch(() => null);
    const xemDu = xemDuQhCamLam(nd);
    const ngoaiQh = ngoaiVungQh(ring);
    const kqQh = qhReady() ? tinhQhHinh(geom, dt) : null;
    const overlaps: any[] = !ngoaiQh && kqQh?.pre?.length
      ? kqQh.pre.map((o) => ({ layer: 'Quy hoạch', type: RENAME_LOAI[o.type] || o.type, hz: o.hz, areaM2: o.areaM2 })) : [];
    const qhCacBanCL = kqQh ? kqQh.cacBan : computeQhTheoBan(ring, dt);
    const qhPdf = canTraPdf(overlaps, qhCacBanCL) && (process.env.QH_PDF_THU === '1' || await isFlagOn('qh_pdf_bat'))
      ? await qhTuPdfHinh(gj, xa?.xaId ? String(xa.xaId) : null, dt) : [];
    const qh500 = await qh500TrenHinh(gj, dt, xemDu).catch(() => null);   // 1/500: admin + gói thành viên
    const qhCacBan = [...qhCacBanCL, ...qhPdf, ...(qh500 ? [qh500] : [])];
    const qhNgoaiVung = overlaps.length === 0 && qhCacBan.length === 0;
    const kh = khoaQhCamLam(xemDu, overlaps, null, qhCacBan);
    const laCu = Number(xa?.cap) === 3;
    const xaHienHanh = xa ? (xa.xaMoi || xa.xa || null) : null;
    const parcel = {
      id: null, giaDinh: true, soTo: null, soThua: null, areaM2: dt, geometry: geom,
      xa: xaHienHanh, xaCu: xa ? (laCu ? xa.xa : (xa.tenGoc || null)) : null, huyenCu: laCu ? xa.huyen : null,
      layer_name: 'Thửa giả định do khách hàng tự vẽ',
      properties: { nhan: 'Thửa giả định do khách hàng tự vẽ', xa: xaHienHanh, dienTich_m2: dt },
    };
    res.json({ found: true, point: { lng, lat }, parcel, zoning: kh.zoning, overlaps: kh.overlaps, neighbors: [], listings: [],
               qhCacBan: kh.qhCacBan, qhNgoaiVung });
  } catch (e) { next(e); }
});

// POST /api/parcels/qh-manh-hinh — như GET /:id/qh-manh nhưng cho THỬA KHÁCH TỰ VẼ (chưa có mã thửa): thân { ring: [[lng,lat]…] } đúng
// toạ độ khách nhập (không dịch). Cùng khoá: chỉ người được xem đủ quy hoạch Cam Lâm (phiếu in cũng chỉ mở cho họ).
parcelsRouter.post('/qh-manh-hinh', async (req, res, next) => {
  try {
    if (!xemDuQhCamLam(await nguoiDungTuYeuCau(req).catch(() => null))) return res.status(403).json({ error: 'Vui lòng liên hệ admin để xem.' });
    res.set('Cache-Control', 'private, no-store');
    const r = req.body?.ring;
    if (!Array.isArray(r) || r.length < 4 || r.length > 1001) return res.status(400).json({ error: 'Hình thửa không hợp lệ.' });
    const ring: number[][] = r.map((p: any) => [Number(p?.[0]), Number(p?.[1])]);
    if (!ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x > 106.5 && x < 110 && y > 10.5 && y < 13.5))
      return res.status(400).json({ error: 'Hình thửa không hợp lệ.' });
    res.json({ manh: qhReady() ? manhQh205(ring, 25, 150, false) : [] });
  } catch (e) { next(e); }
});

// GET /api/parcels/:id/qh-manh — Ô ĐẤT QĐ205 quanh một thửa địa chính, để vẽ SƠ ĐỒ trên phiếu in (12/10/2026). Trước phiếu vẽ từ file cũ
// public/qh_vector.geojson (tháng 7) nên hình có thể khác con số máy chủ tính. Giao diện chỉ gọi khi bấm in phiếu; chung hạn mức /api/parcels.
parcelsRouter.get('/:id(\\d+)/qh-manh', async (req, res, next) => {
  try {
    // (15/10/2026) Ô đất QĐ205 = quy hoạch Cam Lâm bị KHOÁ → chỉ người được xem đủ (phiếu in cũng chỉ mở cho họ).
    if (!xemDuQhCamLam(await nguoiDungTuYeuCau(req).catch(() => null))) return res.status(403).json({ error: 'Vui lòng liên hệ admin để xem.' });
    res.set('Cache-Control', 'private, no-store');
    if (!qhReady()) return res.json({ manh: [] });
    const [p] = await query<any>('SELECT ST_AsGeoJSON(geom)::json g FROM dia_chinh WHERE id=$1', [Number(req.params.id)]);
    if (!p) return res.status(404).json({ error: 'Không có thửa này' });
    const ring = chuanToaDoDiaChinh(outerRing(p.g) || []);
    res.json({ manh: manhQh205(ring, 25, 150, true) });
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
