import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';
import { isValidPhone } from '../lib/vn.ts';

export const consignmentsRouter = Router();

// POST /api/consignments — khách gửi bán (CÔNG KHAI, không cần đăng nhập)
consignmentsRouter.post('/', async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const name = String(b.name ?? '').trim().slice(0, 80);
    const phone = String(b.phone ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Vui lòng nhập họ tên' });
    if (!isValidPhone(phone)) return res.status(400).json({ error: 'Số điện thoại không hợp lệ (cần 9–11 chữ số).' });
    // Form CÔNG KHAI (không cần đăng nhập) → giới hạn độ dài từng ô (trước đây nhận nguyên khối tới 5 MB mỗi lần gửi).
    const chu = (v: any, n: number) => (v ? String(v).slice(0, n) : null);
    const dt = Number(b.area);
    const [row] = await query(
      `INSERT INTO consignments (name, phone, property_type, ward, address, area, price_expect, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [name, phone.slice(0, 20), chu(b.propertyType, 40), chu(b.ward, 120), chu(b.address, 300),
       b.area && Number.isFinite(dt) && dt >= 0 && dt < 1e9 ? dt : null, chu(b.priceExpect, 120), chu(b.description, 3000)]);
    res.status(201).json({ id: row.id, ok: true });
  } catch (e) { next(e); }
});

// GET /api/consignments — admin xem danh sách khách gửi bán
consignmentsRouter.get('/', adminRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, name, phone, property_type AS "propertyType", ward, address, area,
              price_expect AS "priceExpect", description, status, created_at AS "createdAt"
         FROM consignments ORDER BY created_at DESC LIMIT 2000`);
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
