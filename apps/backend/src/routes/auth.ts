import { Router } from 'express';
import { query } from '../lib/db.ts';
import { hashPassword, verifyPassword, signToken, dsVaiTro } from '../lib/auth.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { sendVerificationEmail, EMAIL_LIVE } from '../lib/mailer.ts';

export const authRouter = Router();

const profile = (u: any) => ({
  id: u.id, email: u.email, role: u.role, roles: dsVaiTro(u),
  fullName: u.full_name ?? null, phone: u.phone ?? null,
  tier: u.tier ?? 'free', status: u.status ?? 'active',
  emailVerified: u.email_verified ?? true, avatar: u.avatar ?? null,
});
const gen6 = () => String(Math.floor(100000 + Math.random() * 900000));
const isEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

async function issueCode(email: string): Promise<string> {
  const code = gen6();
  await query(
    `INSERT INTO email_verifications (email, code, expires_at) VALUES ($1,$2, now() + interval '15 minutes')`,
    [email, code]);
  await sendVerificationEmail(email, code);
  return code;
}

// Khách (user) đăng ký nhanh — không cần xác thực email
authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, fullName, phone } = req.body ?? {};
    if (!email || !password || !phone) return res.status(400).json({ error: 'Cần email, mật khẩu và số điện thoại' });
    if (!isEmail(email)) return res.status(400).json({ error: 'Email không hợp lệ' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự' });
    if ((await query('SELECT id FROM users WHERE email=$1', [email])).length)
      return res.status(409).json({ error: 'Email đã được đăng ký' });
    const hash = await hashPassword(password);
    const [user] = await query(
      `INSERT INTO users (email, password_hash, role, roles, full_name, phone, email_verified)
       VALUES ($1,$2,'user',ARRAY['user']::text[],$3,$4,true) RETURNING *`, [email, hash, fullName ?? null, phone]);
    const token = signToken({ id: user.id, email: user.email, role: user.role, roles: dsVaiTro(user) as any });
    res.status(201).json({ token, user: profile(user) });
  } catch (e) { next(e); }
});

// ⛔ ĐÃ TẮT /verify-email và /resend-code (29/9/2026 — rà soát bảo mật, lỗ hổng NGHIÊM TRỌNG):
//    chưa có dịch vụ gửi email thật (EMAIL_ENABLED trống) nên /resend-code TRẢ LUÔN mã 6 số
//    trong phản hồi (devCode), còn /verify-email nhận đúng mã là CẤP THẺ ĐĂNG NHẬP ⇒ ai biết email
//    admin là đăng nhập thành admin KHÔNG CẦN MẬT KHẨU.
//    Giao diện không dùng hai đường này, và lúc đăng ký đã tự đặt email_verified=true, nên tắt
//    hẳn không mất tính năng nào. Muốn bật lại xác minh email thì: mã PHẢI gửi qua email thật,
//    KHÔNG BAO GIỜ trả mã trong phản hồi, và xác minh xong KHÔNG được cấp thẻ đăng nhập.
authRouter.post('/verify-email', (_req, res) => { res.status(410).json({ error: 'Chức năng xác minh email chưa mở.' }); });
authRouter.post('/resend-code', (_req, res) => { res.status(410).json({ error: 'Chức năng xác minh email chưa mở.' }); });

// Đăng nhập — trả role; chặn tài khoản bị khoá
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const [user] = await query('SELECT * FROM users WHERE email=$1', [email]);
    // Thông báo GỘP để không lộ email nào đã đăng ký (chống dò tài khoản).
    if (!user || !(await verifyPassword(password ?? '', user.password_hash)))
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Tài khoản đã bị khoá' });
    const token = signToken({ id: user.id, email: user.email, role: user.role, roles: dsVaiTro(user) as any });
    res.json({ token, user: profile(user) });
  } catch (e) { next(e); }
});

// Hồ sơ hiện tại (lấy mới từ DB)
authRouter.get('/me', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const [user] = await query('SELECT * FROM users WHERE id=$1', [req.user!.id]);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ user: profile(user) });
  } catch (e) { next(e); }
});

// PATCH /me — đổi thông tin / avatar / mật khẩu
authRouter.patch('/me', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body ?? {};
    if (b.newPassword) {
      if (String(b.newPassword).length < 6) return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 6 ký tự' });
      const [u] = await query('SELECT password_hash FROM users WHERE id=$1', [req.user!.id]);
      if (!u || !(await verifyPassword(b.currentPassword ?? '', u.password_hash)))
        return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
      await query('UPDATE users SET password_hash=$2 WHERE id=$1', [req.user!.id, await hashPassword(b.newPassword)]);
    }
    const [user] = await query(
      `UPDATE users SET full_name=COALESCE($2,full_name), phone=COALESCE($3,phone), avatar=COALESCE($4,avatar)
       WHERE id=$1 RETURNING *`, [req.user!.id, b.fullName ?? null, b.phone ?? null, b.avatar ?? null]);
    res.json({ user: profile(user) });
  } catch (e) { next(e); }
});

// Heartbeat — đánh dấu còn hoạt động (để biết online)
authRouter.post('/ping', authRequired, async (req: AuthedRequest, res, next) => {
  try { await query('UPDATE users SET last_seen_at = now() WHERE id=$1', [req.user!.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});
