import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';

export const trafficRouter = Router();

// Đếm "lượt xem" = số PHIÊN (sess): 1 thiết bị mở web = 1 lượt (dù xem nhiều trang),
// đóng hẳn web mở lại mới +1. "Đang xem" = số thiết bị (vid) hoạt động trong 5 phút.
const VISIT = `count(DISTINCT COALESCE(sess, id::text))::int`;

// POST /api/track — ghi nhận 1 lượt xem trang (công khai, web tự gọi khi đổi trang)
trafficRouter.post('/track', async (req, res, next) => {
  try {
    const b = req.body ?? {};
    let path = typeof b.path === 'string' ? b.path.slice(0, 300) : '/';
    const vid = typeof b.vid === 'string' ? b.vid.slice(0, 64) : null;
    const sess = typeof b.sess === 'string' ? b.sess.slice(0, 64) : null;
    let ref = typeof b.ref === 'string' ? b.ref.slice(0, 300) : null;
    if (path.startsWith('/admin') || path.startsWith('/api')) return res.json({ ok: true });
    if (ref && (ref.includes('localhost') || ref.includes('batdongsancamlam') || ref.includes('onrender.com'))) ref = null;
    await query('INSERT INTO site_visits (path, vid, sess, ref) VALUES ($1,$2,$3,$4)', [path, vid, sess, ref]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/traffic/live — tóm tắt nhanh (công khai: cho tray + widget)
trafficRouter.get('/traffic/live', async (_req, res, next) => {
  try {
    const [row] = await query(`
      SELECT
        (SELECT count(DISTINCT vid)::int FROM site_visits WHERE created_at > now() - interval '5 minutes') AS online,
        (SELECT ${VISIT} FROM site_visits WHERE created_at::date = now()::date) AS today,
        (SELECT ${VISIT} FROM site_visits WHERE created_at > now() - interval '7 days') AS week
    `);
    res.set('Cache-Control', 'no-store');
    res.json({ online: row?.online ?? 0, today: row?.today ?? 0, week: row?.week ?? 0 });
  } catch (e) { next(e); }
});

// GET /api/traffic/detail — chi tiết (chỉ admin)
trafficRouter.get('/traffic/detail', adminRequired, async (_req, res, next) => {
  try {
    const [tot] = await query(`
      SELECT
        (SELECT ${VISIT} FROM site_visits) AS total,
        (SELECT ${VISIT} FROM site_visits WHERE created_at::date = now()::date) AS today,
        (SELECT ${VISIT} FROM site_visits WHERE created_at::date = (now() - interval '1 day')::date) AS yesterday,
        (SELECT ${VISIT} FROM site_visits WHERE created_at > now() - interval '7 days') AS week,
        (SELECT ${VISIT} FROM site_visits WHERE created_at > now() - interval '30 days') AS month,
        (SELECT count(DISTINCT vid)::int FROM site_visits WHERE created_at > now() - interval '5 minutes') AS online,
        (SELECT count(DISTINCT vid)::int FROM site_visits WHERE created_at > now() - interval '30 days') AS uniques
    `);
    const daily = await query(`
      SELECT to_char(gs::date, 'YYYY-MM-DD') AS day, COALESCE(t.c, 0)::int AS count
      FROM generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') AS gs
      LEFT JOIN (
        SELECT created_at::date AS d, count(DISTINCT COALESCE(sess, id::text)) AS c
        FROM site_visits WHERE created_at >= (now() - interval '29 days')::date
        GROUP BY created_at::date
      ) t ON t.d = gs::date
      ORDER BY gs
    `);
    const topPages = await query(`
      SELECT path, count(*)::int AS count FROM site_visits
      WHERE created_at > now() - interval '30 days' AND path IS NOT NULL
      GROUP BY path ORDER BY count DESC LIMIT 12
    `);
    const topRefs = await query(`
      SELECT ref, ${VISIT} AS count FROM site_visits
      WHERE created_at > now() - interval '30 days' AND ref IS NOT NULL AND ref <> ''
      GROUP BY ref ORDER BY count DESC LIMIT 10
    `);
    res.json({ ...tot, daily, topPages, topRefs });
  } catch (e) { next(e); }
});
