import { Router } from 'express';
import { cached, cachePut, cacheDrop } from '../lib/cache.ts';
import { query } from '../lib/db.ts';
import { adminRequired, type AuthedRequest } from '../middleware/auth.ts';

export const projectsRouter = Router();

// GET /api/projects — danh sách dự án nổi bật (công khai)
projectsRouter.get('/', async (_req, res, next) => {
  try {
    const hit = cached<any>('projects:list');
    if (hit) { res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300'); return res.json(hit); }
    const rows = await query(`SELECT id, name, status, scale, location, image_url AS "imageUrl" FROM featured_projects ORDER BY sort, id`);
    const payload = { projects: rows };
    cachePut('projects:list', payload, 60000);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(payload);
  } catch (e) { next(e); }
});

// POST /api/projects — thêm dự án (CHỈ admin)
projectsRouter.post('/', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 120);
    if (!name) return res.status(400).json({ error: 'Thiếu tên dự án' });
    const status = b.status ? String(b.status).trim().slice(0, 40) : null;
    const scale = b.scale ? String(b.scale).trim().slice(0, 60) : null;
    const location = b.location ? String(b.location).trim().slice(0, 120) : null;
    const imageUrl = b.imageUrl ? String(b.imageUrl).trim().slice(0, 500) : null;
    const [row] = await query(
      `INSERT INTO featured_projects (name, status, scale, location, image_url, sort)
       VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT MAX(sort) + 1 FROM featured_projects), 1))
       RETURNING id, name, status, scale, location, image_url AS "imageUrl"`,
      [name, status, scale, location, imageUrl]);
    cacheDrop('projects:');
    res.json({ ok: true, project: row });
  } catch (e) { next(e); }
});

// DELETE /api/projects/:id — xoá dự án (CHỈ admin)
projectsRouter.delete('/:id', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await query(`DELETE FROM featured_projects WHERE id = $1 RETURNING id`, [id]);
    cacheDrop('projects:');
    res.json({ deleted: r[0]?.id ?? null });
  } catch (e) { next(e); }
});
