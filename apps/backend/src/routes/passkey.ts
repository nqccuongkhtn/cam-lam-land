/* ============================================================================
 *  ĐĂNG NHẬP BẰNG VÂN TAY / KHUÔN MẶT  (passkey — chuẩn WebAuthn)
 * ----------------------------------------------------------------------------
 *  CÁCH NÓ CHẠY, nói cho dễ hiểu:
 *   1. Người dùng bấm "Thêm vân tay cho máy này". Máy chủ gửi về một THỬ THÁCH —
 *      một chuỗi ngẫu nhiên dùng đúng một lần.
 *   2. Điện thoại hỏi vân tay / khuôn mặt. Đúng rồi thì nó tự sinh một CẶP KHOÁ
 *      nằm trong chip bảo mật của máy, ký thử thách bằng khoá riêng, rồi gửi lên
 *      đây KHOÁ CÔNG KHAI kèm chữ ký.
 *   3. Máy chủ chỉ lưu khoá công khai. Lần sau đăng nhập cũng vậy: gửi thử thách,
 *      điện thoại hỏi vân tay rồi ký, máy chủ lấy khoá công khai ra kiểm chữ ký.
 *
 *  ĐIỀU QUAN TRỌNG NHẤT: VÂN TAY VÀ KHUÔN MẶT KHÔNG BAO GIỜ RỜI KHỎI MÁY, cũng
 *  không gửi lên máy chủ. Máy chủ không hề biết mặt mũi hay vân tay ai ra sao.
 *  Dù có bị lấy sạch database cũng không ai đăng nhập thay được — khoá riêng nằm
 *  trong chip của điện thoại, không xuất ra được.
 *
 *  PHẦN KIỂM CHỮ KÝ DÙNG THƯ VIỆN @simplewebauthn/server, KHÔNG TỰ VIẾT.
 *  Đây là mã bảo mật: tự viết phép kiểm chữ ký và bóc CBOR thì rất dễ sai một chỗ
 *  nhỏ mà thành lỗ hổng, trong khi thư viện này là bản được dùng rộng rãi nhất.
 *
 *  CẦN CHẠY TRÊN HTTPS. Trình duyệt chỉ cho dùng vân tay ở trang https:// hoặc
 *  http://localhost. Web thật đã chạy https qua Cloudflare Tunnel nên không sao.
 * ========================================================================== */
import { Router } from 'express';
import { ghiDangNhap, maThietBi } from '../lib/thietBi.ts';
import crypto from 'node:crypto';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { query } from '../lib/db.ts';
import { signToken, dsVaiTro } from '../lib/auth.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';

export const passkeyRouter = Router();

/* ── Tên miền được phép ──────────────────────────────────────────────────────
 * WebAuthn buộc khoá phải gắn với ĐÚNG MỘT tên miền (rpID) — đây chính là thứ
 * chặn trang giả mạo: khoá tạo cho batdongsancamlam.dpdns.org thì trang khác
 * không xin chữ ký được, kể cả khi người dùng bị lừa bấm vào.
 * Khai trong .env:  WEBAUTHN_RP_ID=batdongsancamlam.dpdns.org
 *                   WEBAUTHN_ORIGINS=https://batdongsancamlam.dpdns.org
 */
const RP_ID = (process.env.WEBAUTHN_RP_ID || '').trim() || 'localhost';
const RP_TEN = 'Cam Lâm Land';
const ORIGINS = (process.env.WEBAUTHN_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
if (!ORIGINS.length) ORIGINS.push('http://localhost', 'http://127.0.0.1');

/** Lấy đúng tên miền của request để so — cho phép cả localhost lẫn tên miền thật.
 *  ⚠️ 11/10/2026 (rà soát bảo mật): trước đây nhận THÊM BẤT KỲ địa chỉ https nào trình duyệt khai trong Origin,
 *  tức bỏ mất phép so tên miền. Nay chỉ nhận thêm khi đó đúng là tên miền đã đăng ký (RP_ID) hoặc tên miền con của nó. */
function gocCuaRequest(req: any): string[] {
  const o = String(req.get('origin') || '').trim();
  if (!o || ORIGINS.includes(o) || !/^https:\/\//.test(o)) return ORIGINS;
  let host = '';
  try { host = new URL(o).hostname.toLowerCase(); } catch { return ORIGINS; }
  const rp = RP_ID.toLowerCase();
  return host === rp || host.endsWith('.' + rp) ? [...ORIGINS, o] : ORIGINS;
}

/** Cất thử thách vào database, trả về khoá phiên để trình duyệt gửi lại. */
async function catThuThach(challenge: string, userId: number | null): Promise<string> {
  const khoa = crypto.randomBytes(24).toString('base64url');
  await query(
    `INSERT INTO webauthn_challenges (khoa, challenge, user_id, expires_at)
     VALUES ($1,$2,$3, now() + interval '5 minutes')`, [khoa, challenge, userId]);
  // dọn thử thách quá hạn, khỏi phình bảng
  query(`DELETE FROM webauthn_challenges WHERE expires_at < now()`).catch(() => {});
  return khoa;
}

/** Lấy thử thách ra và XOÁ NGAY — dùng một lần, không cho phát lại. */
async function layThuThach(khoa: string): Promise<{ challenge: string; user_id: number | null } | null> {
  const [r] = await query(
    `DELETE FROM webauthn_challenges WHERE khoa=$1 AND expires_at > now()
     RETURNING challenge, user_id`, [String(khoa || '')]);
  return r ?? null;
}

/* ── MÃ TÀI KHOẢN GẮN VÀO KHOÁ — CỐ ĐỊNH CHO MỖI NGƯỜI (12/10/2026) ─────────────────────────────────────────
 * Chủ dự án chụp màn hình: đổi mật khẩu xong bật lại Face ID thì iPhone hiện HAI khoá cùng một email, bắt chọn —
 * chọn nhầm khoá cũ (đã tắt khi đổi mật khẩu) là báo lỗi. Nguyên nhân: trước đây không đưa mã tài khoản nên mỗi
 * lần bật, thư viện tự sinh một mã NGẪU NHIÊN MỚI. iPhone (và mọi nơi cất khoá) nhận diện tài khoản bằng mã này:
 * TRÙNG mã thì THAY khoá cũ, KHÁC mã thì CẤT THÊM một khoá. Nay mỗi người một mã cố định (users.passkey_uid)
 * → bật lại trên cùng một máy là thay hẳn khoá cũ, máy chỉ còn một.
 * Người đã bật từ trước (mã ngẫu nhiên, máy chủ không lưu): lần đăng nhập Face ID kế tiếp NHẬN LUÔN mã của khoá
 * vừa dùng làm mã cố định (xem /dang-nhap/xong) → lần bật lại sau đó vẫn thay đúng khoá đang nằm trên máy. */
async function maTaiKhoan(userId: number): Promise<Uint8Array<ArrayBuffer>> {
  const [u] = await query('SELECT passkey_uid FROM users WHERE id=$1', [userId]);
  let ma: string = u?.passkey_uid || '';
  if (!ma) {
    const [r] = await query(
      `UPDATE users SET passkey_uid = COALESCE(passkey_uid, $2) WHERE id=$1 RETURNING passkey_uid`,
      [userId, crypto.randomBytes(32).toString('base64url')]);
    ma = r?.passkey_uid;
  }
  return new Uint8Array(Buffer.from(ma, 'base64url'));
}

const hoSo = (u: any) => ({
  id: u.id, email: u.email, role: u.role, roles: dsVaiTro(u),
  fullName: u.full_name ?? null, phone: u.phone ?? null,
  tier: u.tier ?? 'free', status: u.status ?? 'active',
  emailVerified: u.email_verified ?? true, avatar: u.avatar ?? null,
});

/* ══ 1. ĐĂNG KÝ vân tay cho máy này (phải đang đăng nhập) ══════════════════ */
passkeyRouter.post('/dang-ky/bat-dau', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!;
    const da = await query('SELECT cred_id, transports FROM webauthn_credentials WHERE user_id=$1', [me.id]);
    const opts = await generateRegistrationOptions({
      rpName: RP_TEN,
      rpID: RP_ID,
      userID: await maTaiKhoan(Number(me.id)),   // CỐ ĐỊNH — bật lại là thay khoá cũ trên máy (xem maTaiKhoan)
      userName: me.email,
      userDisplayName: me.email,
      attestationType: 'none',              // không cần biết hãng máy, đỡ lộ thông tin
      // Không cho đăng ký trùng một máy hai lần
      excludeCredentials: da.map((c: any) => ({
        id: c.cred_id,
        transports: c.transports ? String(c.transports).split(',') as any : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',       // BẮT BUỘC hỏi vân tay/khuôn mặt, không chỉ chạm
        authenticatorAttachment: 'platform', // dùng chính máy này, không phải khoá USB rời
      },
    });
    const khoa = await catThuThach(opts.challenge, Number(me.id));
    res.json({ khoa, options: opts });
  } catch (e) { next(e); }
});

passkeyRouter.post('/dang-ky/xong', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!;
    const { khoa, response, tenMay } = req.body ?? {};
    const tt = await layThuThach(khoa);
    if (!tt || Number(tt.user_id) !== Number(me.id))
      return res.status(400).json({ error: 'Hết hạn. Bấm lại.' });

    const kq = await verifyRegistrationResponse({
      response,
      expectedChallenge: tt.challenge,
      expectedOrigin: gocCuaRequest(req),
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
    if (!kq.verified || !kq.registrationInfo)
      return res.status(400).json({ error: 'Không nhận được. Thử lại.' });

    const { credential } = kq.registrationInfo;
    // ⚠️ 11/10/2026 (rà soát bảo mật): trùng mã khoá thì CHỈ cập nhật khi khoá đó là của CHÍNH người này.
    //    Trước đây ai cũng ghi đè được bộ đếm của khoá người khác (mã khoá lộ qua /dang-nhap/bat-dau kèm email)
    //    → chủ thật không đăng nhập bằng vân tay được nữa ("Chữ ký không hợp lệ").
    const ghi = await query(
      `INSERT INTO webauthn_credentials (user_id, cred_id, public_key, counter, transports, ten_may)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (cred_id) DO UPDATE SET counter = EXCLUDED.counter, last_used = now()
         WHERE webauthn_credentials.user_id = EXCLUDED.user_id
       RETURNING id`,
      [me.id, credential.id, Buffer.from(credential.publicKey), credential.counter ?? 0,
       (credential.transports || []).join(',') || null,
       String(tenMay || '').slice(0, 60) || 'Máy này']);
    if (!ghi.length) return res.status(409).json({ error: 'Khoá này đang gắn với tài khoản khác.' });
    // Ghi khoá này thuộc MÁY nào trong sổ thiết bị: sau này tab ẩn danh / trình duyệt khác trên cùng máy đăng nhập bằng khoá
    // này là nhận ra đúng máy, đổi mạng cũng vậy (lib/thietBi.ts bacCungMay, bậc "cùng khoá").
    const maMay = maThietBi(req);
    if (maMay) query(`UPDATE webauthn_credentials SET thiet_bi_ids = ARRAY(SELECT id FROM thiet_bi WHERE user_id=$2 AND (ma=$3 OR $3 = ANY(ma_phu)))
                      WHERE id=$1`, [ghi[0].id, me.id, maMay]).catch(() => {});
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

/* ══ 2. ĐĂNG NHẬP bằng vân tay ═════════════════════════════════════════════ */
passkeyRouter.post('/dang-nhap/bat-dau', async (req, res, next) => {
  try {
    // Không cần biết trước là ai: để máy tự đưa ra khoá nó đang giữ cho tên miền này.
    // Có gửi email thì giới hạn danh sách khoá cho nhanh.
    const email = String(req.body?.email || '').trim().toLowerCase();
    let cho: any[] = [];
    if (email) {
      cho = await query(
        `SELECT c.cred_id, c.transports FROM webauthn_credentials c
         JOIN users u ON u.id = c.user_id WHERE lower(u.email) = $1`, [email]);
    }
    const opts = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
      allowCredentials: cho.map((c: any) => ({
        id: c.cred_id,
        transports: c.transports ? String(c.transports).split(',') as any : undefined,
      })),
    });
    const khoa = await catThuThach(opts.challenge, null);
    res.json({ khoa, options: opts });
  } catch (e) { next(e); }
});

passkeyRouter.post('/dang-nhap/xong', async (req, res, next) => {
  try {
    const { khoa, response } = req.body ?? {};
    const tt = await layThuThach(khoa);
    if (!tt) return res.status(400).json({ error: 'Hết hạn. Bấm lại.' });

    const credId = String(response?.id || '');
    const [c] = await query(
      `SELECT c.*, u.* , c.id AS cred_row_id, c.created_at AS cred_tao_luc FROM webauthn_credentials c
       JOIN users u ON u.id = c.user_id WHERE c.cred_id = $1`, [credId]);
    // ⚠️ Câu này phải chỉ rõ CHỖ BẬT. Máy có Face ID rồi vẫn chưa đăng nhập
    //    được nếu chưa bật cho tài khoản — mà chỗ bật nằm trong Tài khoản
    //    của web, không phải Cài đặt của máy. Chủ dự án nhắc đúng chỗ này.
    // maLoi 'KHOA_DA_TAT' = khoá máy chủ không còn nhận (đổi mật khẩu / bấm Gỡ) mà máy vẫn giữ: trình duyệt bỏ khoá đó
    // khỏi danh sách đưa ra lần sau, và nhờ máy xoá luôn nếu máy hỗ trợ (lib/vanTay.ts xacNhanDangNhap).
    if (!c) return res.status(404).json({ error: 'Máy này chưa bật. Vào Tài khoản để bật.', maLoi: 'KHOA_DA_TAT' });
    if (c.status && c.status !== 'active')
      return res.status(403).json({ error: 'Tài khoản đang bị khoá' });
    // ⛔ 11/10/2026 (chủ dự án báo lỗi: "đổi mật khẩu rồi mà Face ID vẫn vào được"): đổi mật khẩu đã XOÁ hết khoá vân tay
    //    (routes/auth.ts). Đây là chốt chặn thứ hai — khoá nào bật TRƯỚC lần đổi mật khẩu gần nhất (vd sót lại do đặt lại
    //    mật khẩu bằng cách khác) thì không cho đăng nhập.
    if (c.doi_mat_khau_luc && c.cred_tao_luc && new Date(c.cred_tao_luc).getTime() <= new Date(c.doi_mat_khau_luc).getTime())
      return res.status(403).json({ error: 'Mật khẩu tài khoản đã được đổi nên vân tay / khuôn mặt trên máy này đã tắt. Hãy đăng nhập bằng mật khẩu mới rồi bật lại trong Tài khoản.', maLoi: 'KHOA_DA_TAT' });

    const kq = await verifyAuthenticationResponse({
      response,
      expectedChallenge: tt.challenge,
      expectedOrigin: gocCuaRequest(req),
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: c.cred_id,
        publicKey: new Uint8Array(c.public_key),
        counter: Number(c.counter || 0),
        transports: c.transports ? String(c.transports).split(',') as any : undefined,
      },
    });
    if (!kq.verified) return res.status(401).json({ error: 'Không nhận được. Thử lại.' });

    // Bộ đếm phải TĂNG. Không tăng nghĩa là có người phát lại chữ ký cũ → chặn.
    const moi = Number(kq.authenticationInfo.newCounter || 0);
    if (moi > 0 && moi <= Number(c.counter || 0))
      return res.status(401).json({ error: 'Chữ ký không hợp lệ' });
    await query('UPDATE webauthn_credentials SET counter=$1, last_used=now() WHERE id=$2',
                [moi, c.cred_row_id]);
    // Chưa có mã tài khoản cố định (người bật từ trước 12/10/2026) → nhận mã của chính khoá vừa dùng, để lần bật lại
    // sau này trên máy đó THAY khoá này chứ không cất thêm khoá thứ hai (xem maTaiKhoan). Chỉ ghi vào tài khoản của khoá.
    const maKhoa = String(response?.response?.userHandle || '');
    if (/^[A-Za-z0-9_-]{8,128}$/.test(maKhoa))
      query('UPDATE users SET passkey_uid=$2 WHERE id=$1 AND passkey_uid IS NULL', [c.user_id, maKhoa]).catch(() => {});

    const tb = await ghiDangNhap({ id: c.user_id, role: c.role, roles: dsVaiTro(c) }, req, 'van-tay',   // sổ + giới hạn thiết bị
      { mayKhoa: (c.thiet_bi_ids || []).map(Number) });       // khoá này từng dùng trên máy nào → nhận ra cùng máy dù khác mạng
    if (!tb.ok) return res.status(403).json({ error: tb.loi, maLoi: 'QUA_THIET_BI' });
    if (tb.mayId) query(`UPDATE webauthn_credentials SET thiet_bi_ids = CASE WHEN $2 = ANY(thiet_bi_ids) THEN thiet_bi_ids
                           ELSE (thiet_bi_ids || $2)[greatest(1, cardinality(thiet_bi_ids) - 8):] END WHERE id=$1`,
                        [c.cred_row_id, tb.mayId]).catch(() => {});
    const token = signToken({ id: c.user_id, email: c.email, role: c.role, roles: dsVaiTro(c) as any, tb: tb.ma || undefined, pv: Number(c.phien_dang_nhap) || 0 });
    res.json({ token, user: hoSo({ ...c, id: c.user_id }) });
  } catch (e) { next(e); }
});

/* ══ 3. Quản lý các máy đã đăng ký ═════════════════════════════════════════ */
passkeyRouter.get('/danh-sach', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    // cred_id + uid: trình duyệt cất lại danh sách khoá CÒN DÙNG ĐƯỢC để lúc đăng nhập chỉ đưa đúng các khoá đó cho
    // iPhone chọn — khoá cũ đã tắt không hiện ra nữa (frontend lib/maKhoaMay.ts). Mã khoá không phải thứ bí mật.
    const ds = await query(
      `SELECT id, cred_id, ten_may, transports, created_at, last_used
       FROM webauthn_credentials WHERE user_id=$1 ORDER BY id DESC`, [req.user!.id]);
    res.json({ ds, uid: req.user!.id });
  } catch (e) { next(e); }
});

passkeyRouter.delete('/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const r = await query('DELETE FROM webauthn_credentials WHERE id=$1 AND user_id=$2 RETURNING id',
                          [req.params.id, req.user!.id]);
    if (!r.length) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Cho trình duyệt biết máy chủ đã bật tính năng này chưa (và đang gắn tên miền nào). */
passkeyRouter.get('/trang-thai', (_req, res) => res.json({ bat: true, rpId: RP_ID }));
