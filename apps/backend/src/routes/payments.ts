import { Router } from 'express';
import { query } from '../lib/db.ts';
import { authRequired, adminRequired, type AuthedRequest } from '../middleware/auth.ts';
import { PACKAGES, findPkg, BANK } from '../lib/packages.ts';

export const paymentsRouter = Router();

// Kích hoạt gói cho khách (gọi khi webhook báo đã trả tiền HOẶC admin xác nhận tay)
async function activate(order: any): Promise<void> {
  const pkg = findPkg(order.package_id); if (!pkg) return;
  if (pkg.kind === 'post') {
    await query(`UPDATE users SET post_quota=$2, post_expires_at = now() + ($3::int) * interval '1 day', tier='paid' WHERE id=$1`,
      [order.user_id, pkg.posts, pkg.days]);
  } else {
    await query(`UPDATE users SET pkg_id=$2, pkg_tier=$3, boost_quota=$4, boost_used=0, boost_expires_at = now() + ($5::int) * interval '1 day', tier='paid' WHERE id=$1`,
      [order.user_id, pkg.id, pkg.tier, pkg.boosts, pkg.days]);
  }
  await query(`UPDATE payments SET status='paid', paid_at=now() WHERE id=$1 AND status<>'paid'`, [order.id]);
}

paymentsRouter.get('/packages', (_req, res) => res.json({ packages: PACKAGES, bank: BANK }));

// Tạo đơn — trả về nội dung chuyển khoản
paymentsRouter.post('/order', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const pkg = findPkg(String(req.body?.packageId)); if (!pkg) return res.status(400).json({ error: 'Gói không hợp lệ' });
    const [o] = await query(`INSERT INTO payments (user_id, package_id, amount, status) VALUES ($1,$2,$3,'pending') RETURNING id`, [req.user!.id, pkg.id, pkg.price]);
    const note = `CLL${o.id}`;
    await query(`UPDATE payments SET note=$2 WHERE id=$1`, [o.id, note]);
    res.status(201).json({ orderId: o.id, amount: pkg.price, note, package: pkg, bank: BANK });
  } catch (e) { next(e); }
});

// Trạng thái gói + đơn của tôi
paymentsRouter.get('/my', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const [u] = await query(`SELECT pkg_tier AS "pkgTier", boost_quota AS "boostQuota", boost_used AS "boostUsed", boost_expires_at AS "boostExpiresAt", post_quota AS "postQuota", post_expires_at AS "postExpiresAt" FROM users WHERE id=$1`, [req.user!.id]);
    const orders = await query(`SELECT id, package_id AS "packageId", amount, status, note, created_at AS "createdAt" FROM payments WHERE user_id=$1 ORDER BY id DESC LIMIT 20`, [req.user!.id]);
    res.json({ current: u ?? null, orders });
  } catch (e) { next(e); }
});

// Webhook tự động (SePay/Casso…) — bắt buộc header x-webhook-key = PAYMENT_WEBHOOK_KEY
paymentsRouter.post('/webhook', async (req, res, next) => {
  try {
    const key = process.env.PAYMENT_WEBHOOK_KEY;
    if (!key || req.headers['x-webhook-key'] !== key) return res.status(401).json({ error: 'unauthorized' });
    const content = String(req.body?.content ?? req.body?.description ?? req.body?.addInfo ?? '');
    const amount = Number(req.body?.transferAmount ?? req.body?.amount ?? 0);
    const m = /CLL(\d+)/i.exec(content);
    if (!m) return res.json({ ok: true, matched: false });
    const [o] = await query(`SELECT * FROM payments WHERE id=$1`, [Number(m[1])]);
    if (!o || o.status === 'paid') return res.json({ ok: true });
    if (amount && Number(o.amount) > amount) return res.json({ ok: true, note: 'chuyển thiếu' });
    await activate(o);
    res.json({ ok: true, activated: true });
  } catch (e) { next(e); }
});

// Admin: danh sách đơn + xác nhận tay
paymentsRouter.get('/', adminRequired, async (_req, res, next) => {
  try {
    const rows = await query(`SELECT p.id, p.user_id AS "userId", COALESCE(u.full_name,u.email) AS "userName", u.email,
      p.package_id AS "packageId", p.amount, p.status, p.note, p.created_at AS "createdAt", p.paid_at AS "paidAt"
      FROM payments p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 200`);
    res.json({ payments: rows });
  } catch (e) { next(e); }
});
paymentsRouter.post('/:id/confirm', adminRequired, async (req, res, next) => {
  try {
    const [o] = await query(`SELECT * FROM payments WHERE id=$1`, [Number(req.params.id)]);
    if (!o) return res.status(404).json({ error: 'Không tìm thấy đơn' });
    await activate(o);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
