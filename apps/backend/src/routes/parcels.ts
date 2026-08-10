import { Router } from 'express';
import { query } from '../lib/db.ts';
import { vnNoAccent } from '../lib/vn.ts';
import { computeQhAreas, outerRing, qhReady } from '../lib/qhCompute.ts';

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
    if (!soto && !sothua) return res.status(400).json({ error: 'Cần ít nhất số tờ hoặc số thửa' });
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
    const [parcel] = await query(`
      SELECT f.id, f.properties, ST_AsGeoJSON(f.geom)::json AS geometry, l.name AS layer_name,
             ROUND(ST_Area(f.geom::geography)::numeric, 1) AS "areaM2",
             ${coal(KEYS_TO)} AS "soTo", ${coal(KEYS_THUA)} AS "soThua", ${coal(KEYS_XA)} AS "xa"
      FROM gis_features f JOIN gis_layers l ON l.id=f.layer_id
      WHERE l.layer_type IN ('parcel','custom') AND ST_Contains(f.geom, ${pt})
        AND (${coal(KEYS_TO)} IS NOT NULL OR ${coal(KEYS_THUA)} IS NOT NULL)
      ORDER BY (l.layer_type='parcel') DESC LIMIT 1`, [lng, lat]);
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
    if (parcel) {
      // ƯU TIÊN: diện tích QH theo ĐƯỜNG THẬT (QĐ205 cố định) — chạy TƯƠI theo hình thửa hiện tại.
      // Nhờ vậy đổi/nạp bản đồ địa chính mới vẫn đúng, KHÔNG cần tính sẵn lại. Thiếu dữ liệu đường → rơi về cách cũ.
      const _pre = qhReady() ? computeQhAreas(outerRing((parcel as any).geometry) || [], Number((parcel as any).areaM2) || 0) : null;
      if (_pre && _pre.length) {
        overlaps = _pre.map((o) => ({ layer: 'Quy hoạch', type: o.type, hz: o.hz, areaM2: o.areaM2 }));
      } else {
      overlaps = await query(`
        WITH p AS (SELECT ST_MakeValid(geom) AS geom FROM gis_features WHERE id=$1)
        SELECT ${TYPE} AS type, NULLIF(f.properties->>'hz','') AS hz,
               ROUND(${IA}::numeric, 1) AS "areaM2"
        FROM gis_features f JOIN gis_layers l ON l.id=f.layer_id, p
        WHERE l.layer_type='zoning' AND ${BLOCK} AND ST_Intersects(f.geom, p.geom)
        GROUP BY type, hz
        HAVING ${IA} > 0.5
        ORDER BY "areaM2" DESC`, [parcel.id]);
      // Đất giao thông = (thửa ∩ mặt nạ nội thị) − (thửa ∩ các ô đất)
      const [gt] = await query(`
        WITH p AS (SELECT ST_MakeValid(geom) AS geom FROM gis_features WHERE id=$1),
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
    if (parcel) {
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
          FROM listings WHERE status<>'hidden' AND ST_Contains((SELECT geom FROM gis_features WHERE id=$1), geom)`, [parcel.id])
      : await query(`SELECT id,title,price,property_type AS "propertyType", ST_X(geom) lng, ST_Y(geom) lat
          FROM listings WHERE status<>'hidden' AND ST_DWithin(geom::geography, ${pt}::geography, 300)`, [lng, lat]);
    if (!parcel && !zoningOut && overlaps.length === 0 && linked.length === 0)
      return res.json({ found: false, point: { lng, lat }, parcel: null, zoning: null, overlaps: [], listings: [] });
    res.json({ found: true, point: { lng, lat }, parcel: parcel ?? null, zoning: zoningOut, overlaps, neighbors, listings: linked });
  } catch (e) { next(e); }
});

// GET /api/parcels/dia-ban — danh sách {cap, huyen, xa} có trong dữ liệu thửa (cho ô chọn xã theo cấp)
parcelsRouter.get('/dia-ban', async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT ${coalKeys(KEYS_CAP)} AS cap, ${coalKeys(KEYS_HUYEN)} AS huyen, ${coalKeys(KEYS_XA)} AS xa,
             COUNT(*)::int AS "count"
      FROM gis_features f JOIN gis_layers l ON l.id=f.layer_id
      WHERE l.layer_type IN ('parcel','custom') AND ${coalKeys(KEYS_XA)} IS NOT NULL
      GROUP BY cap, huyen, xa
      ORDER BY cap NULLS LAST, huyen NULLS LAST, xa`);
    res.json({ list: rows });
  } catch (e) { next(e); }
});
