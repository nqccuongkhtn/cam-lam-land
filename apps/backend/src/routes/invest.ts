import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';

export const investRouter = Router();

// POST /api/invest — khách đăng ký quan tâm góp vốn CamInvest (CÔNG KHAI, không cần đăng nhập)
investRouter.post('/', async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const name = String(b.name ?? '').trim();
    const phone = String(b.phone ?? '').trim();
    if (!name || !phone) return res.status(400).json({ error: 'Vui lòng nhập họ tên và số điện thoại' });
    const [row] = await query(
      `INSERT INTO invest_leads (name, phone, amount, tenure, note)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [name, phone, b.amount ? String(b.amount).slice(0, 60) : null, b.tenure ? String(b.tenure).slice(0, 30) : null, b.note ? String(b.note).slice(0, 1000) : null]);
    res.status(201).json({ id: row.id, ok: true });
  } catch (e) { next(e); }
});

// GET /api/invest — admin xem danh sách đăng ký góp vốn
investRouter.get('/', adminRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, name, phone, amount, tenure, note, status, created_at AS "createdAt"
         FROM invest_leads ORDER BY created_at DESC`);
    res.json({ count: rows.length, items: rows });
  } catch (e) { next(e); }
});

// PATCH /api/invest/:id — admin đổi trạng thái (new/contacted/done)
investRouter.patch('/:id', adminRequired, async (req, res, next) => {
  try {
    const [row] = await query('UPDATE invest_leads SET status=COALESCE($2,status) WHERE id=$1 RETURNING id',
      [Number(req.params.id), req.body?.status ?? null]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/invest/:id (admin)
investRouter.delete('/:id', adminRequired, async (req, res, next) => {
  try {
    const r = await query('DELETE FROM invest_leads WHERE id=$1 RETURNING id', [Number(req.params.id)]);
    if (!r.length) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ deleted: r[0].id });
  } catch (e) { next(e); }
});
