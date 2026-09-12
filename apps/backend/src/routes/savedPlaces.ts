import { Router } from 'express';
import { laAdmin } from '../lib/auth.ts';
import { query } from '../lib/db.ts';
import { authRequired, adminRequired, type AuthedRequest } from '../middleware/auth.ts';

export const savedPlacesRouter = Router();

// [cột DB, key JSON] — mini-CRM tin lưu (địa chính + đặc điểm + chủ + khách quan tâm + chốt deal)
const FIELDS: [string, string][] = [
  ['note', 'note'], ['price', 'price'], ['area', 'area'],
  ['owner_phone', 'phone'], ['owner_name', 'owner'], ['commission', 'commission'],
  ['parcel_no', 'parcel'], ['sheet_no', 'sheet'], ['ward', 'ward'], ['features', 'features'],
  ['cust_name', 'custName'], ['cust_phone', 'custPhone'], ['interest', 'interest'],
  ['cust_note', 'custNote'], ['deal_status', 'dealStatus'],
];
const selCols = FIELDS.map(([c, k]) => (c === k ? c : `${c} AS "${k}"`)).join(', ');
const SEL = `id, lng, lat, x_vn AS x, y_vn AS y, ${selCols}, images, created_at AS "createdAt"`;
// Giới hạn độ dài chuỗi trước khi lưu (chống dữ liệu quá khổ). null giữ nguyên null.
const clip = (v: any, n = 1000) => (v === undefined || v === null ? null : String(v).slice(0, n));

// GET /api/saved-places — tin lưu CỦA CHÍNH MÌNH
savedPlacesRouter.get('/', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const rows = await query(`SELECT ${SEL} FROM saved_places WHERE user_id=$1 ORDER BY id DESC`, [req.user!.id]);
    res.json({ places: rows });
  } catch (e) { next(e); }
});

// GET /api/saved-places/all — ADMIN: tất cả tin lưu + tên/SĐT sales (quản lý kho + lead).
savedPlacesRouter.get('/all', adminRequired, async (_req, res, next) => {
  try {
    const spCols = FIELDS.map(([c, k]) => (c === k ? `sp.${c}` : `sp.${c} AS "${k}"`)).join(', ');
    const rows = await query(
      `SELECT sp.id, sp.lng, sp.lat, sp.x_vn AS x, sp.y_vn AS y, ${spCols}, sp.images, sp.created_at AS "createdAt",
              sp.user_id AS "userId", COALESCE(NULLIF(u.full_name,''), split_part(u.email,'@',1), 'Người dùng') AS "ownerName",
              u.phone AS "ownerPhone", u.role AS "ownerRole"
         FROM saved_places sp LEFT JOIN users u ON u.id = sp.user_id
        ORDER BY sp.id DESC LIMIT 2000`);
    res.json({ places: rows });
  } catch (e) { next(e); }
});

// POST /api/saved-places — lưu 1 tin
savedPlacesRouter.post('/', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const b: any = req.body ?? {};
    if (b.lng == null || b.lat == null) return res.status(400).json({ error: 'Thiếu vị trí trên bản đồ' });
    const imgs = (Array.isArray(b.images) ? b.images : []).slice(0, 5);
    const cols = ['user_id', 'lng', 'lat', 'x_vn', 'y_vn', ...FIELDS.map(([c]) => c), 'images'];
    const vals = [req.user!.id, b.lng, b.lat, b.x ?? null, b.y ?? null, ...FIELDS.map(([, k]) => clip(b[k])), imgs];
    const ph = vals.map((_, i) => '$' + (i + 1)).join(',');
    const [row] = await query(`INSERT INTO saved_places (${cols.join(',')}) VALUES (${ph}) RETURNING ${SEL}`, vals);
    res.status(201).json({ place: row });
  } catch (e) { next(e); }
});

async function ownerOrAdmin(req: AuthedRequest, id: number): Promise<boolean> {
  const [r] = await query('SELECT user_id FROM saved_places WHERE id=$1', [id]);
  return !!r && (r.user_id === req.user!.id || laAdmin(req.user));
}

// PATCH /api/saved-places/:id — sửa (chủ hoặc admin)
savedPlacesRouter.patch('/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id); const b: any = req.body ?? {};
    if (!(await ownerOrAdmin(req, id))) return res.status(403).json({ error: 'Không có quyền' });
    const sets = FIELDS.map(([c], i) => `${c}=COALESCE($${i + 2},${c})`);
    sets.push(`images=COALESCE($${FIELDS.length + 2},images)`);
    const vals = [id, ...FIELDS.map(([, k]) => clip(b[k])), Array.isArray(b.images) ? b.images.slice(0, 5) : null];
    const [row] = await query(`UPDATE saved_places SET ${sets.join(', ')} WHERE id=$1 RETURNING ${SEL}`, vals);
    res.json({ place: row });
  } catch (e) { next(e); }
});

// DELETE /api/saved-places/:id — xoá (chủ hoặc admin)
savedPlacesRouter.delete('/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!(await ownerOrAdmin(req, id))) return res.status(403).json({ error: 'Không có quyền' });
    await query('DELETE FROM saved_places WHERE id=$1', [id]);
    res.json({ deleted: id });
  } catch (e) { next(e); }
});
