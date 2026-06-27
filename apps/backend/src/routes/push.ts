import { Router } from 'express';
import { query } from '../lib/db.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';

export const pushRouter = Router();

// Lưu đăng ký nhận thông báo đẩy của trình duyệt
pushRouter.post('/subscribe', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const s = req.body?.subscription ?? req.body ?? {};
    const endpoint = String(s.endpoint ?? '');
    const p256dh = String(s.keys?.p256dh ?? '');
    const auth = String(s.keys?.auth ?? '');
    if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Thiếu thông tin đăng ký' });
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth`,
      [req.user!.id, endpoint, p256dh, auth]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

pushRouter.post('/unsubscribe', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const endpoint = String(req.body?.endpoint ?? '');
    if (endpoint) await query('DELETE FROM push_subscriptions WHERE endpoint=$1', [endpoint]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
