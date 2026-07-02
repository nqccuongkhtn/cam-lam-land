import { Router } from 'express';
import { cached, cachePut, cacheDrop } from '../lib/cache.ts';
import { query } from '../lib/db.ts';
import { adminRequired, type AuthedRequest } from '../middleware/auth.ts';

export const partnersRouter = Router();

// GET /api/partners — danh sách doanh nghiệp tiêu biểu (công khai)
partnersRouter.get('/', async (_req, res, next) => {
  try {
    const hit = cached<any>('partners:list');
    if (hit) { res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300'); return res.json(hit); }
    const rows = await query(`SELECT id, name, logo_url AS "logoUrl" FROM featured_partners ORDER BY sort, id`);
    const payload = { partners: rows };
    cachePut('partners:list', payload, 60000);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(payload);
  } catch (e) { next(e); }
});

// POST /api/partners — thêm doanh nghiệp (CHỈ admin)
partnersRouter.post('/', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const logoUrl = req.body?.logoUrl ? String(req.body.logoUrl).trim().slice(0, 500) : null;
    if (!name) return res.status(400).json({ error: 'Thiếu tên doanh nghiệp' });
    const [row] = await query(
      `INSERT INTO featured_partners (name, logo_url, sort)
       VALUES ($1, $2, COALESCE((SELECT MAX(sort) + 1 FROM featured_partners), 1))
       RETURNING id, name, logo_url AS "logoUrl"`, [name, logoUrl]);
    cacheDrop('partners:');
    res.json({ ok: true, partner: row });
  } catch (e) { next(e); }
});

// DELETE /api/partners/:id — xoá doanh nghiệp (CHỈ admin)
partnersRouter.delete('/:id', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await query(`DELETE FROM featured_partners WHERE id = $1 RETURNING id`, [id]);
    cacheDrop('partners:');
    res.json({ deleted: r[0]?.id ?? null });
  } catch (e) { next(e); }
});
