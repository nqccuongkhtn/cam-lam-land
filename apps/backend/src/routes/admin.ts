import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';

export const adminRouter = Router();
adminRouter.use(adminRequired);

// Báo cáo / thống kê
adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [users] = await query(`SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE role='sales')::int AS sales,
      count(*) FILTER (WHERE role='user')::int  AS users,
      count(*) FILTER (WHERE role='admin')::int AS admins,
      count(*) FILTER (WHERE tier='paid')::int  AS paid
      FROM users`);
    const [listings] = await query(`SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE status='active')::int AS active,
      count(*) FILTER (WHERE status='pending')::int AS pending,
      count(*) FILTER (WHERE status='hidden')::int AS hidden,
      count(*) FILTER (WHERE boosted)::int AS boosted,
      COALESCE(sum(price),0)::float8 AS "totalValue"
      FROM listings`);
    const byType = await query(`SELECT property_type AS type, count(*)::int AS n FROM listings GROUP BY property_type ORDER BY n DESC`);
    const byWard = await query(`SELECT COALESCE(ward,'(khác)') AS ward, count(*)::int AS n FROM listings GROUP BY ward ORDER BY n DESC LIMIT 8`);
    const [images] = await query(`SELECT count(*)::int AS total, COALESCE(sum(size),0)::bigint AS bytes FROM listing_images`);
    res.json({ users, listings, byType, byWard, images });
  } catch (e) { next(e); }
});

// Người dùng
adminRouter.get('/users', async (_req, res, next) => {
  try {
    const rows = await query(`SELECT id, email, role, full_name AS "fullName", phone, tier, status,
      email_verified AS "emailVerified", created_at AS "createdAt" FROM users ORDER BY created_at DESC LIMIT 500`);
    res.json({ users: rows });
  } catch (e) { next(e); }
});
adminRouter.patch('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id); const b = req.body ?? {};
    const [row] = await query(
      `UPDATE users SET role=COALESCE($2,role), tier=COALESCE($3,tier), status=COALESCE($4,status)
       WHERE id=$1 RETURNING id, email, role, tier, status`, [id, b.role ?? null, b.tier ?? null, b.status ?? null]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json({ user: row });
  } catch (e) { next(e); }
});

// Quản lý tin (mọi trạng thái)
adminRouter.get('/listings', async (_req, res, next) => {
  try {
    const rows = await query(`SELECT id, title, price, property_type AS "propertyType", ward, status, boosted,
      created_by AS "createdBy", created_at AS "createdAt", images FROM listings ORDER BY boosted DESC, created_at DESC LIMIT 500`);
    res.json({ listings: rows });
  } catch (e) { next(e); }
});
adminRouter.patch('/listings/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id); const b = req.body ?? {};
    const [row] = await query(
      `UPDATE listings SET status=COALESCE($2,status), boosted=COALESCE($3,boosted)
       WHERE id=$1 RETURNING id, status, boosted`, [id, b.status ?? null, b.boosted ?? null]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy tin' });
    res.json({ listing: row });
  } catch (e) { next(e); }
});
