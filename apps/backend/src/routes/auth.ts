import { Router } from 'express';
import { ghiDangNhap } from '../lib/thietBi.ts';
import { query, pool } from '../lib/db.ts';
import { ghiSuKien } from './theoDoiTk.ts'; // THEO DÕI TÀI KHOẢN (tạm — dễ gỡ)
import { hashPassword, verifyPassword, signToken, dsVaiTro, canNangCap, BAM_GIA, kiemMatKhauMoi, DAI_TOI_DA, MAT_KHAU_CONG_KHAI, laMangNoiBo } from '../lib/auth.ts';
import { authRequired, quenVaiTro, type AuthedRequest } from '../middleware/auth.ts';
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
    const tb = await ghiDangNhap(user, req, 'dang-ky');   // sổ thiết bị (lib/thietBi.ts) — tài khoản mới chưa có máy nào nên không bị chặn
    const token = signToken({ id: user.id, email: user.email, role: user.role, roles: dsVaiTro(user) as any, tb: tb.ok ? tb.ma || undefined : undefined, pv: Number(user.phien_dang_nhap) || 0 });
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
    // (14/10/2026) Tìm theo email KHÔNG phân biệt hoa/thường, bỏ dấu cách thừa: điện thoại hay tự viết hoa chữ đầu / thêm dấu cách
    // khi tự điền → trước đây báo "sai mật khẩu" dù gõ đúng (tài khoản banhchuoi… vừa được đặt lại mật khẩu vẫn không vào được).
    // Mọi email trong bảng users đều lưu chữ thường, không trùng nhau khi bỏ hoa/thường (kiểm 14/10: 24/24).
    const [user] = await query('SELECT * FROM users WHERE lower(email)=$1', [k]);
    // Email không tồn tại vẫn so với chuỗi băm GIẢ → thời gian trả lời NHƯ NHAU (không đo được email nào đã có).
    const dung = await verifyPassword(password, user?.password_hash || BAM_GIA);
    // Thông báo GỘP để không lộ email nào đã đăng ký (chống dò tài khoản).
    if (!user || !dung) { ghiSai(k); return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' }); }
    saiMk.delete(k);
    // ⛔ 11/10/2026 (rà soát bảo mật): mật khẩu MẶC ĐỊNH ĐÃ CÔNG KHAI (lib/auth.ts) — ai đọc mã nguồn cũng biết.
    //    Chặn dùng từ Internet; ngồi tại máy chủ / mạng nội bộ vẫn vào được để đổi sang mật khẩu riêng.
    if (MAT_KHAU_CONG_KHAI.has(password) && !laMangNoiBo(req.ip)) {
      console.warn(`[BẢO MẬT] Chặn đăng nhập từ Internet bằng mật khẩu mặc định công khai: tài khoản #${user.id} (máy ${req.ip})`);
      return res.status(403).json({ error: 'Tài khoản này đang dùng MẬT KHẨU MẶC ĐỊNH (ai cũng có thể biết) nên bị chặn đăng nhập từ Internet để bảo vệ. Hãy đăng nhập ngay trên máy chủ rồi đổi mật khẩu, hoặc nhờ quản trị viên đặt lại.' });
    }
    // Mật khẩu CŨ băm độ khó thấp → băm lại bằng độ khó mới, GIỮ NGUYÊN mật khẩu (không chờ, lỗi thì thôi).
    // Chỉ ghi khi chuỗi băm vẫn y như lúc đọc (AND password_hash=$3): lỡ mật khẩu vừa được đổi trong lúc đang băm lại
    // thì KHÔNG được ghi đè mật khẩu mới bằng mật khẩu cũ. Đây không phải đổi mật khẩu → không thu hồi phiên / vân tay.
    if (canNangCap(user.password_hash)) {
      hashPassword(password).then((h) => query('UPDATE users SET password_hash=$2 WHERE id=$1 AND password_hash=$3', [user.id, h, user.password_hash])).catch(() => {});
    }
    if (user.status === 'suspended') return res.status(403).json({ error: 'Tài khoản đã bị khoá' });
    // GIỚI HẠN THIẾT BỊ (lib/thietBi.ts): ghi máy vào sổ; đang bật giới hạn mà là máy mới vượt số cho phép → chặn
    const tb = await ghiDangNhap(user, req, 'mat-khau');
    if (!tb.ok) return res.status(403).json({ error: tb.loi, maLoi: 'QUA_THIET_BI' });
    const token = signToken({ id: user.id, email: user.email, role: user.role, roles: dsVaiTro(user) as any, tb: tb.ma || undefined, pv: Number(user.phien_dang_nhap) || 0 });
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

/**
 * ĐỔI MẬT KHẨU = THU HỒI QUYỀN VÀO CŨ (11/10/2026 — chủ dự án: "hôm qua đổi mật khẩu rồi mà đăng nhập bằng Face ID vẫn
 * vào được, lỗi nghiêm trọng"; "cho tôi CHỌN có đăng xuất các thiết bị khác không").
 * Làm TRONG MỘT GIAO DỊCH (hỏng giữa chừng thì không đổi gì cả):
 *   1. ghi mật khẩu mới + lúc đổi (doi_mat_khau_luc);
 *   2. dangXuatMayKhac (mặc định CÓ): tăng "đời phiên" → mọi thẻ đăng nhập cấp trước đó, ở mọi máy, bị từ chối ngay
 *      (middleware/auth.ts) dù chưa hết hạn 7 ngày;
 *   3. LUÔN xoá mọi khoá vân tay / khuôn mặt (passkey) của tài khoản, bất kể ô chọn: khoá trên máy cũ / máy bị mất không
 *      được đăng nhập thay mật khẩu mới. Đăng nhập bằng mật khẩu mới rồi bật lại trong trang Tài khoản là xong.
 * Không động tới sổ thiết bị (thiet_bi) — sổ đó là bằng chứng + chỗ tính phí reset, không phải phiên đăng nhập.
 * Trả về đời phiên mới để cấp lại thẻ cho CHÍNH máy đang đổi (máy này không bị văng ra).
 */
async function doiMatKhau(userId: number, matKhauMoi: string, dangXuatMayKhac: boolean)
  : Promise<{ pv: number; email: string; role: string; roles: string[]; soVanTayDaTat: number }> {
  const bam = await hashPassword(matKhauMoi);               // băm TRƯỚC khi mở giao dịch (tốn ~0,3 giây CPU)
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows: [u] } = await c.query(
      `UPDATE users SET password_hash=$2, doi_mat_khau_luc=now(),
              phien_dang_nhap = phien_dang_nhap + CASE WHEN $3::boolean THEN 1 ELSE 0 END
        WHERE id=$1 RETURNING email, role, roles, phien_dang_nhap`, [userId, bam, dangXuatMayKhac]);
    const { rowCount } = await c.query('DELETE FROM webauthn_credentials WHERE user_id=$1', [userId]);
    await c.query('DELETE FROM webauthn_challenges WHERE user_id=$1', [userId]);
    await c.query('COMMIT');
    return { pv: Number(u?.phien_dang_nhap) || 0, email: u?.email, role: u?.role, roles: dsVaiTro(u), soVanTayDaTat: rowCount || 0 };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
    quenVaiTro(userId);                                     // áp dụng NGAY, không chờ 30 giây nhớ tạm của middleware
  }
}

// PATCH /me — đổi thông tin / avatar / mật khẩu
authRouter.patch('/me', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body ?? {};
    let doiMk: { token: string; soVanTayDaTat: number; daDangXuatMayKhac: boolean } | null = null;
    if (b.newPassword) {
      const loiMk = kiemMatKhauMoi(b.newPassword, req.user!.email); if (loiMk) return res.status(400).json({ error: loiMk });
      const [u] = await query('SELECT password_hash FROM users WHERE id=$1', [req.user!.id]);
      if (!u || !(await verifyPassword(b.currentPassword ?? '', u.password_hash)))
        return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
      // 11/10/2026 (chủ dự án báo lỗi): đặt lại ĐÚNG mật khẩu đang dùng vẫn được "đổi" — vô nghĩa mà còn tắt vân tay /
      // đăng xuất máy khác như thật. So với chuỗi băm đang lưu (không so chữ trần) → trùng thì từ chối.
      if (await verifyPassword(String(b.newPassword), u.password_hash))
        return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu đang dùng.' });
      const dangXuatMayKhac = b.dangXuatMayKhac !== false;   // không gửi (giao diện cũ) = CÓ đăng xuất — mặc định an toàn
      const kq = await doiMatKhau(req.user!.id, String(b.newPassword), dangXuatMayKhac);
      // Thẻ MỚI cho chính máy này (cùng mã thiết bị, mang đời phiên mới) → máy đang đổi mật khẩu vẫn đăng nhập.
      const token = signToken({ id: req.user!.id, email: kq.email || req.user!.email, role: (kq.role || req.user!.role) as any,
        roles: (kq.roles.length ? kq.roles : dsVaiTro(req.user)) as any, tb: req.user!.tb, pv: kq.pv });
      doiMk = { token, soVanTayDaTat: kq.soVanTayDaTat, daDangXuatMayKhac: dangXuatMayKhac };
      ghiSuKien(req.user!.id, 'doi-mat-khau', req as any, dangXuatMayKhac ? 'Đổi mật khẩu + đăng xuất máy khác' : 'Đổi mật khẩu'); // THEO DÕI (tạm)
    }
    // 11/10/2026: giới hạn độ dài (trước đây nhận nguyên chuỗi — tên / SĐT / ảnh đại diện vài MB đi theo mọi tin đăng,
    // tin chat, trang cá nhân). Ảnh đại diện chỉ nhận link ảnh (/api/images/…, http/https) — giá trị lạ thì giữ ảnh cũ.
    const chu = (v: any, n: number) => (v === undefined || v === null ? null : String(v).trim().slice(0, n));
    const anh = typeof b.avatar === 'string' && b.avatar.length <= 1000 && /^(\/api\/images\/|https?:\/\/)/i.test(b.avatar.trim()) ? b.avatar.trim() : null;
    // Nút "Xoá ảnh" ở trang Tài khoản gửi avatar: null — trước đây máy chủ bỏ qua nên xoá mãi không được.
    // Chỉ xoá khi GỬI RÕ null; không gửi trường avatar (vd lúc đổi mật khẩu) thì giữ nguyên ảnh.
    const xoaAnh = Object.prototype.hasOwnProperty.call(b, 'avatar') && b.avatar === null;
    const [user] = await query(
      `UPDATE users SET full_name=COALESCE($2,full_name), phone=COALESCE($3,phone),
              avatar=CASE WHEN $5::boolean THEN NULL ELSE COALESCE($4,avatar) END
       WHERE id=$1 RETURNING *`, [req.user!.id, chu(b.fullName, 120), chu(b.phone, 30), anh, xoaAnh]);
    // Đổi mật khẩu: trả kèm THẺ MỚI (giao diện phải thay thẻ cũ bằng thẻ này) + cho biết đã tắt bao nhiêu khoá vân tay.
    res.json({ user: profile(user), ...(doiMk || {}) });
  } catch (e) { next(e); }
});

// Heartbeat — đánh dấu còn hoạt động (để biết online)
// Mỗi tab gửi 45 giây/lần; mở nhiều tab là ghi đè liên tục cùng một dòng. Chỉ ghi khi lần trước đã cách ≥ 20 giây —
// "đang online" tính trong 2 phút nên không đổi gì với người xem, mà bớt hẳn số lần ghi vào bảng users.
authRouter.post('/ping', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    await query(`UPDATE users SET last_seen_at = now() WHERE id=$1 AND (last_seen_at IS NULL OR last_seen_at < now() - interval '20 seconds')`, [req.user!.id]);
    res.json({ ok: true });
  }
  catch (e) { next(e); }
});
