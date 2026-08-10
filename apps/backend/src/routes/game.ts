import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';

export const gameRouter = Router();

// Che bớt SĐT khi công khai bảng xếp hạng (098***21)
function maskPhone(p: string): string {
  const s = String(p || '').replace(/\s+/g, '');
  if (s.length < 6) return s;
  return s.slice(0, 3) + '***' + s.slice(-2);
}

// POST /api/game/score — CÔNG KHAI. Lưu điểm + tạo khách trong CRM (nguồn "Mini-game") cho môi giới gọi.
gameRouter.post('/score', async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const name = String(b.name ?? '').trim().slice(0, 80);
    const phone = String(b.phone ?? '').trim().slice(0, 20);
    let score = Math.floor(Number(b.score));
    if (!isFinite(score) || score < 0) score = 0;
    if (score > 100000) score = 100000;
    if (!name || !phone) return res.status(400).json({ error: 'Vui lòng nhập họ tên và số điện thoại' });
    if (!/^[0-9+\s.\-()]{6,20}$/.test(phone)) return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });

    await query('INSERT INTO game_scores (name, phone, score) VALUES ($1,$2,$3)', [name, phone, score]);

    // Tạo khách trong CRM (gán cho admin) nếu SĐT chưa có — để môi giới gọi tư vấn/định giá.
    await query(
      `INSERT INTO customers (user_id, name, phone, source, note)
       SELECT u.id, $1, $2, 'Mini-game', $3
         FROM users u
        WHERE u.role = 'admin'
          AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.phone = $2)
        ORDER BY u.id LIMIT 1`,
      [name, phone, 'Khách chơi mini-game Cam Lâm Land — quan tâm định giá đất / tư vấn.']
    ).catch(() => {});

    // Hạng tuần của người này (theo điểm cao nhất trong tuần, tính theo SĐT).
    const rankRows = await query(
      `SELECT (
         SELECT COUNT(*) FROM (
           SELECT MAX(score) AS best FROM game_scores
            WHERE created_at >= date_trunc('week', now()) GROUP BY phone
         ) t
         WHERE t.best > (SELECT COALESCE(MAX(score),0) FROM game_scores
                          WHERE phone = $1 AND created_at >= date_trunc('week', now()))
       ) + 1 AS rank`,
      [phone]
    ).catch(() => [] as any[]);
    const rank = rankRows && rankRows[0] ? Number(rankRows[0].rank) : null;

    res.status(201).json({ ok: true, rank });
  } catch (e) { next(e); }
});

// GET /api/game/leaderboard — Top 10 tuần này (điểm cao nhất mỗi SĐT). CÔNG KHAI, che bớt SĐT.
gameRouter.get('/leaderboard', async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT name, phone, score FROM (
         SELECT DISTINCT ON (phone) name, phone, score
           FROM game_scores
          WHERE created_at >= date_trunc('week', now())
          ORDER BY phone, score DESC, created_at DESC
       ) t
       ORDER BY score DESC, name LIMIT 10`);
    const items = rows.map((r: any, i: number) => ({ rank: i + 1, name: r.name, phone: maskPhone(r.phone), score: Number(r.score) }));
    res.json({ items });
  } catch (e) { next(e); }
});

// GET /api/game/leads — admin xem toàn bộ lead từ game (SĐT đầy đủ, gộp theo người).
gameRouter.get('/leads', adminRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT name, phone, MAX(score) AS "bestScore", COUNT(*)::int AS plays,
              MAX(created_at) AS "lastAt", MIN(created_at) AS "firstAt"
         FROM game_scores GROUP BY phone, name ORDER BY MAX(created_at) DESC LIMIT 1000`);
    res.json({ count: rows.length, items: rows });
  } catch (e) { next(e); }
});
