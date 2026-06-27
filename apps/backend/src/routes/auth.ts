import { Router } from 'express';
import { query } from '../lib/db.ts';
import { hashPassword, verifyPassword, signToken } from '../lib/auth.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { sendVerificationEmail, EMAIL_LIVE } from '../lib/mailer.ts';

export const authRouter = Router();

const profile = (u: any) => ({
  id: u.id, email: u.email, role: u.role,
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
      `INSERT INTO users (email, password_hash, role, full_name, phone, email_verified)
       VALUES ($1,$2,'user',$3,$4,true) RETURNING *`, [email, hash, fullName ?? null, phone]);
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user: profile(user) });
  } catch (e) { next(e); }
});

// Xác thực email bằng mã 6 số → tự đăng nhập
authRouter.post('/verify-email', async (req, res, next) => {
  try {
    const { email, code } = req.body ?? {};
    if (!email || !code) return res.status(400).json({ error: 'Thiếu email hoặc mã' });
    const [v] = await query(
      `SELECT * FROM email_verifications WHERE email=$1 AND code=$2 AND used=false AND expires_at > now()
       ORDER BY id DESC LIMIT 1`, [email, String(code).trim()]);
    if (!v) return res.status(400).json({ error: 'Mã không đúng hoặc đã hết hạn' });
    await query('UPDATE email_verifications SET used=true WHERE id=$1', [v.id]);
    const [user] = await query('UPDATE users SET email_verified=true WHERE email=$1 RETURNING *', [email]);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({ token, user: profile(user) });
  } catch (e) { next(e); }
});

// Gửi lại mã
authRouter.post('/resend-code', async (req, res, next) => {
  try {
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ error: 'Thiếu email' });
    const [u] = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (!u) return res.status(404).json({ error: 'Email chưa đăng ký' });
    const code = await issueCode(email);
    res.json({ message: 'Đã gửi lại mã', email, ...(EMAIL_LIVE ? {} : { devCode: code }) });
  } catch (e) { next(e); }
});

// Đăng nhập — trả role; chặn tài khoản bị khoá
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const [user] = await query('SELECT * FROM users WHERE email=$1', [email]);
    if (!user) return res.status(401).json({ error: 'Email chưa được đăng ký' });
    if (!(await verifyPassword(password ?? '', user.password_hash)))
      return res.status(401).json({ error: 'Mật khẩu không đúng' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Tài khoản đã bị khoá' });
    const token = signToken({ id: user.id, email: user.email, role: user.role });
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
