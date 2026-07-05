import { Router } from 'express';
import { query } from '../lib/db.ts';
import { authRequired, adminRequired, type AuthedRequest } from '../middleware/auth.ts';

export const savedPlacesRouter = Router();

const SEL = `id, lng, lat, x_vn AS x, y_vn AS y, note, price, area, images, created_at AS "createdAt"`;

// GET /api/saved-places — điểm/sản phẩm đã lưu CỦA CHÍNH MÌNH
savedPlacesRouter.get('/', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const rows = await query(`SELECT ${SEL} FROM saved_places WHERE user_id=$1 ORDER BY id DESC`, [req.user!.id]);
    res.json({ places: rows });
  } catch (e) { next(e); }
});

// GET /api/saved-places/all — ADMIN: tất cả điểm đã lưu + tên/SĐT người lưu (quản lý kho sales + danh sách lead khách).
savedPlacesRouter.get('/all', adminRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT sp.id, sp.lng, sp.lat, sp.x_vn AS x, sp.y_vn AS y, sp.note, sp.price, sp.area, sp.created_at AS "createdAt",
              sp.user_id AS "userId", COALESCE(NULLIF(u.full_name,''), split_part(u.email,'@',1), 'Người dùng') AS "ownerName",
              u.phone AS "ownerPhone", u.role AS "ownerRole"
         FROM saved_places sp LEFT JOIN users u ON u.id = sp.user_id
        ORDER BY sp.id DESC LIMIT 2000`);
    res.json({ places: rows });
  } catch (e) { next(e); }
});

// POST /api/saved-places — lưu 1 điểm/sản phẩm
savedPlacesRouter.post('/', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body ?? {};
    if (b.lng == null || b.lat == null) return res.status(400).json({ error: 'Thiếu vị trí trên bản đồ' });
    const imgs = (Array.isArray(b.images) ? b.images : []).slice(0, 5);
    const [row] = await query(
      `INSERT INTO saved_places (user_id, lng, lat, x_vn, y_vn, note, price, area, images)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${SEL}`,
      [req.user!.id, b.lng, b.lat, b.x ?? null, b.y ?? null, b.note ?? null, b.price ?? null, b.area ?? null, imgs]);
    res.status(201).json({ place: row });
  } catch (e) { next(e); }
});

async function ownerOrAdmin(req: AuthedRequest, id: number): Promise<boolean> {
  const [r] = await query('SELECT user_id FROM saved_places WHERE id=$1', [id]);
  return !!r && (r.user_id === req.user!.id || req.user!.role === 'admin');
}

// PATCH /api/saved-places/:id — sửa (chủ hoặc admin)
savedPlacesRouter.patch('/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id); const b = req.body ?? {};
    if (!(await ownerOrAdmin(req, id))) return res.status(403).json({ error: 'Không có quyền' });
    const imgs = Array.isArray(b.images) ? b.images.slice(0, 5) : null;
    const [row] = await query(
      `UPDATE saved_places SET note=COALESCE($2,note), price=COALESCE($3,price), area=COALESCE($4,area), images=COALESCE($5,images) WHERE id=$1 RETURNING ${SEL}`,
      [id, b.note ?? null, b.price ?? null, b.area ?? null, imgs]);
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
