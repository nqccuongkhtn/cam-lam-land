import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';

export const consignmentsRouter = Router();

// POST /api/consignments — khách gửi bán (CÔNG KHAI, không cần đăng nhập)
consignmentsRouter.post('/', async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const name = String(b.name ?? '').trim();
    const phone = String(b.phone ?? '').trim();
    if (!name || !phone) return res.status(400).json({ error: 'Vui lòng nhập họ tên và số điện thoại' });
    const [row] = await query(
      `INSERT INTO consignments (name, phone, property_type, ward, address, area, price_expect, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [name, phone, b.propertyType || null, b.ward || null, b.address || null,
       b.area ? Number(b.area) : null, b.priceExpect || null, b.description || null]);
    res.status(201).json({ id: row.id, ok: true });
  } catch (e) { next(e); }
});

// GET /api/consignments — admin xem danh sách khách gửi bán
consignmentsRouter.get('/', adminRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, name, phone, property_type AS "propertyType", ward, address, area,
              price_expect AS "priceExpect", description, status, created_at AS "createdAt"
         FROM consignments ORDER BY created_at DESC`);
    res.json({ count: rows.length, items: rows });
  } catch (e) { next(e); }
});

// PATCH /api/consignments/:id — admin đổi trạng thái (new/contacted/done)
consignmentsRouter.patch('/:id', adminRequired, async (req, res, next) => {
  try {
    const [row] = await query('UPDATE consignments SET status=COALESCE($2,status) WHERE id=$1 RETURNING id',
      [Number(req.params.id), req.body?.status ?? null]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/consignments/:id (admin)
consignmentsRouter.delete('/:id', adminRequired, async (req, res, next) => {
  try {
    const r = await query('DELETE FROM consignments WHERE id=$1 RETURNING id', [Number(req.params.id)]);
    if (!r.length) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ deleted: r[0].id });
  } catch (e) { next(e); }
});
