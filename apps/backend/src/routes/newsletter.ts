import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';

export const newsletterRouter = Router();

// Đăng ký nhận tin qua email — CÔNG KHAI. Chống trùng bằng UNIQUE(email); trùng thì coi như thành công.
newsletterRouter.post('/', async (req, res) => {
  try {
    const email = String((req.body as any)?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return res.status(400).json({ error: 'Email không hợp lệ.' });
    await query(`INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [email]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Lỗi' }); }
});

// Danh sách email đã đăng ký — CHỈ admin.
newsletterRouter.get('/', adminRequired, async (_req, res) => {
  try {
    const rows = await query(`SELECT id, email, to_char(created_at,'YYYY-MM-DD HH24:MI') AS "createdAt" FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 2000`);
    res.json({ subscribers: rows });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Lỗi' }); }
});
