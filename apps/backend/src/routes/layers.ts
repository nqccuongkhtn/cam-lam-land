import { Router } from 'express';
import { query } from '../lib/db.ts';
import { gisRequired } from '../middleware/auth.ts';
import { verifyToken, coVaiTro } from '../lib/auth.ts';

export const layersRouter = Router();

const LAYER_SELECT = `
  SELECT id, name, slug, layer_type AS "layerType", geometry_type AS "geometryType",
         source_format AS "sourceFormat", feature_count AS "featureCount",
         status, visible, style, created_at AS "createdAt"
  FROM gis_layers`;

// GET /api/layers — danh sách lớp bản đồ hiện ra ở bảng "Lớp bản đồ"
// LỚP ĐỊA CHÍNH (layer_type='parcel') KHÔNG hiện ở đây nữa: bản đồ thửa đất giờ LUÔN BẬT,
// phục vụ qua đường riêng /api/dc (ô vector, có khoá chống cào), người dùng không tắt được
// và cũng không nhìn thấy có bao nhiêu lớp / bao nhiêu thửa. Người quản lý GIS vẫn thấy đủ
// để còn quản lý, xoá lớp cũ.
layersRouter.get('/', async (req: any, res, next) => {
  try {
    // Đọc nhanh thẻ đăng nhập để biết có phải người quản lý bản đồ không (không cần hỏi database).
    const h = String(req.headers.authorization || '');
    const nguoi = h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
    const quanLy = coVaiTro(nguoi as any, 'admin', 'gis');
    const loc = quanLy ? '' : ` WHERE layer_type <> 'parcel'`;
    res.json({ layers: await query(`${LAYER_SELECT}${loc} ORDER BY layer_type, name`) });
  } catch (e) { next(e); }
});

// GET /api/layers/:slug/features?bbox=w,s,e,n — features as a GeoJSON FeatureCollection
layersRouter.get('/:slug/features', async (req, res, next) => {
  try {
    const [layer] = await query('SELECT id FROM gis_layers WHERE slug=$1', [req.params.slug]);
    if (!layer) return res.status(404).json({ error: 'Layer not found' });

    // ── CHỐNG CÀO: BẮT BUỘC phải kèm khung nhìn (bbox), và khung không được quá rộng ──
    // Trước đây gọi không kèm bbox là lấy được tới 20.000 đối tượng một lượt → chạy vòng lặp
    // vài chục lần là ôm trọn cả lớp. Giờ phải nêu rõ đang xem vùng nào, và vùng đó phải nhỏ.
    if (!req.query.bbox) return res.status(400).json({ error: 'Thiếu khung nhìn (bbox).' });
    const [w, s, e, n] = String(req.query.bbox).split(',').map(Number);
    if (![w, s, e, n].every((v) => Number.isFinite(v))) return res.status(400).json({ error: 'Khung nhìn không hợp lệ.' });
    const rong = Math.abs(e - w), cao = Math.abs(n - s);
    if (rong > 0.6 || cao > 0.6) return res.status(400).json({ error: 'Khung nhìn quá rộng — hãy phóng to bản đồ.' });
    const params: any[] = [layer.id, w, s, e, n];
    const bboxClause = ` AND geom && ST_MakeEnvelope($2,$3,$4,$5,4326)`;
    const lim = Math.min(4000, Math.max(1, Number(req.query.limit) || 4000));
    // Đơn giản hoá hình học theo mức zoom để tải/vẽ nhanh. HÌNH GỐC vẫn nằm trong DB nên
    // tính diện tích (parcels/at) vẫn chính xác — đây chỉ là hình để HIỂN THỊ.
    // tol ≈ nửa pixel ở mức zoom hiện tại (đơn vị độ). Zoom càng lớn → tol càng nhỏ → càng chi tiết.
    const z = Math.min(22, Math.max(0, Math.floor(Number(req.query.z) || 0)));
    const tol = z > 0 ? 180 / (256 * Math.pow(2, z)) : 0;
    // Toạ độ làm tròn 6 số thập phân (~0.1m) là quá đủ để vẽ; zoom cao (>=17) thì giữ gần như nguyên bản.
    const geomSel = z >= 17 || tol <= 0
      ? `ST_AsGeoJSON(geom, 6)::json`
      : `ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, ${tol}), 6)::json`;
    const rows = await query(`
      SELECT json_build_object(
        'type','Feature','id',id,
        'geometry', ${geomSel},
        'properties', properties
      ) AS feature
      FROM gis_features WHERE layer_id=$1${bboxClause} LIMIT ${lim}`, params);
    res.set('Cache-Control', 'public, max-age=120');
    res.json({ type: 'FeatureCollection', features: rows.map((r: any) => r.feature) });
  } catch (e) { next(e); }
});

// DELETE /api/layers/:slug  (admin) — remove a layer and all its features (ON DELETE CASCADE)
layersRouter.delete('/:slug', gisRequired, async (req, res, next) => {
  try {
    const rows = await query('DELETE FROM gis_layers WHERE slug=$1 RETURNING id, name', [req.params.slug]);
    if (!rows.length) return res.status(404).json({ error: 'Layer not found' });
    res.json({ deleted: rows[0].name });
  } catch (e) { next(e); }
});

export { LAYER_SELECT };
