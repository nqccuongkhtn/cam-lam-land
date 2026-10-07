import { Router } from 'express';
import { query } from '../lib/db.ts';
import { ghiSuKien } from './theoDoiTk.ts'; // THEO DÕI TÀI KHOẢN (tạm — dễ gỡ)
import { hashPassword, verifyPassword, signToken, dsVaiTro, canNangCap, BAM_GIA, kiemMatKhauMoi, DAI_TOI_DA } from '../lib/auth.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { sendVerificationEmail, EMAIL_LIVE } from '../lib/mailer.ts';
import { laNguoiThat, TURNSTILE_SITE_KEY, turnstileBat } from '../lib/turnstile.ts';

const LOI_NGUOI_THAT = 'Không xác nhận được bạn là người thật. Vui lòng tải lại trang rồi thử lại.';

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

// Khoá CÔNG KHAI của Cloudflare Turnstile cho giao diện (rỗng = chưa bật kiểm tra người thật) — lib/turnstile.ts
authRouter.get('/turnstile', (_req, res) => { res.set('Cache-Control', 'public, max-age=300'); res.json({ siteKey: turnstileBat() ? TURNSTILE_SITE_KEY : '' }); });

// Khách (user) đăng ký nhanh — không cần xác thực email
authRouter.post('/register', async (req, res, next) => {
  try {
    if (!(await laNguoiThat(req.body?.cfToken, req))) return res.status(403).json({ error: LOI_NGUOI_THAT });   // chặn đăng ký tự động hàng loạt
    const { email, password, fullName, phone } = req.body ?? {};
    if (!email || !password || !phone) return res.status(400).json({ error: 'Cần email, mật khẩu và số điện thoại' });
    if (!isEmail(email)) return res.status(400).json({ error: 'Email không hợp lệ' });
    const loiMk = kiemMatKhauMoi(password, email); if (loiMk) return res.status(400).json({ error: loiMk });
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
// ── KHOÁ TẠM THEO TÀI KHOẢN (29/9/2026) ──
// Giới hạn theo máy (IP) không chặn được kiểu dò mật khẩu RẢI từ nhiều máy vào MỘT tài khoản. Nay sai
// SAI_TOI_DA lần trong 15 phút thì tài khoản đó tạm khoá 15 phút (đăng nhập đúng cũng phải chờ).
// Giữ trong bộ nhớ (khởi động lại là xoá) — đủ cho mục đích chặn dò, không cần bảng mới.
const SAI_TOI_DA = 8, CUA_SO = 15 * 60 * 1000;
const saiMk = new Map<string, { lan: number; tu: number }>();
function dangBiKhoa(k: string): number {
  const r = saiMk.get(k); if (!r) return 0;
  if (Date.now() - r.tu > CUA_SO) { saiMk.delete(k); return 0; }
  return r.lan >= SAI_TOI_DA ? Math.ceil((r.tu + CUA_SO - Date.now()) / 60000) : 0;
}
function ghiSai(k: string) {
  const r = saiMk.get(k);
  if (!r || Date.now() - r.tu > CUA_SO) saiMk.set(k, { lan: 1, tu: Date.now() }); else r.lan++;
  if (saiMk.size > 50000) saiMk.clear();   // chặn phình bộ nhớ nếu bị spam email ngẫu nhiên
}

authRouter.post('/login', async (req, res, next) => {
  try {
    if (!(await laNguoiThat(req.body?.cfToken, req))) return res.status(403).json({ error: LOI_NGUOI_THAT });   // chặn đăng nhập bằng phần mềm tự động
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || password.length > DAI_TOI_DA)
      return res.status(400).json({ error: 'Email hoặc mật khẩu không hợp lệ' });
    const k = email.trim().toLowerCase();
    const conPhut = dangBiKhoa(k);
    if (conPhut) return res.status(429).json({ error: `Sai mật khẩu quá nhiều lần. Tài khoản tạm khoá, thử lại sau ${conPhut} phút.` });
    const [user] = await query('SELECT * FROM users WHERE email=$1', [email]);
    // Email không tồn tại vẫn so với chuỗi băm GIẢ → thời gian trả lời NHƯ NHAU (không đo được email nào đã có).
    const dung = await verifyPassword(password, user?.password_hash || BAM_GIA);
    // Thông báo GỘP để không lộ email nào đã đăng ký (chống dò tài khoản).
    if (!user || !dung) { ghiSai(k); return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' }); }
    saiMk.delete(k);
    // Mật khẩu CŨ băm độ khó thấp → băm lại bằng độ khó mới, GIỮ NGUYÊN mật khẩu (không chờ, lỗi thì thôi).
    if (canNangCap(user.password_hash)) {
      hashPassword(password).then((h) => query('UPDATE users SET password_hash=$2 WHERE id=$1', [user.id, h])).catch(() => {});
    }
    if (user.status === 'suspended') return res.status(403).json({ error: 'Tài khoản đã bị khoá' });
    const token = signToken({ id: user.id, email: user.email, role: user.role, roles: dsVaiTro(user) as any });
    ghiSuKien(user.id, 'dang-nhap', req as any, 'Đăng nhập bằng mật khẩu'); // THEO DÕI TÀI KHOẢN (tạm — dễ gỡ)
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
      const loiMk = kiemMatKhauMoi(b.newPassword, req.user!.email); if (loiMk) return res.status(400).json({ error: loiMk });
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
