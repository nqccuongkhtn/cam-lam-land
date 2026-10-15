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
import { signToken, dsVaiTro, verifyPassword } from '../lib/auth.ts';
import { isFlagOn } from '../lib/flags.ts';
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

/** Cất thử thách vào database, trả về khoá phiên để trình duyệt gửi lại.
 *  loai 'tu-dong' = thử thách cho khoá TỰ TẠO ngầm (xem mục 1b) — chỉ loại này được nới kiểm tra cờ "có mặt / đã xác minh". */
async function catThuThach(challenge: string, userId: number | null, loai: 'dang-ky' | 'dang-nhap' | 'tu-dong' = 'dang-ky'): Promise<string> {
  const khoa = crypto.randomBytes(24).toString('base64url');
  await query(
    `INSERT INTO webauthn_challenges (khoa, challenge, user_id, expires_at, loai)
     VALUES ($1,$2,$3, now() + interval '5 minutes', $4)`, [khoa, challenge, userId, loai]);
  // dọn thử thách quá hạn, khỏi phình bảng
  query(`DELETE FROM webauthn_challenges WHERE expires_at < now()`).catch(() => {});
  return khoa;
}

/** Lấy thử thách ra và XOÁ NGAY — dùng một lần, không cho phát lại. */
async function layThuThach(khoa: string): Promise<{ challenge: string; user_id: number | null; loai: string | null } | null> {
  const [r] = await query(
    `DELETE FROM webauthn_challenges WHERE khoa=$1 AND expires_at > now()
     RETURNING challenge, user_id, loai`, [String(khoa || '')]);
  return r ?? null;
}

/* ── NƠI CẤT KHOÁ (mã AAGUID của chuẩn WebAuthn → tên dễ hiểu) ──
 * Lấy từ danh sách cộng đồng passkeydeveloper/passkey-authenticator-aaguids (13/10/2026). iCloud Keychain của Apple cố ý báo
 * mã toàn số 0 (giữ riêng tư) — gặp mã 0 mà khoá đồng bộ thì gần như chắc là iCloud. */
const NOI_CAT: Record<string, string> = {
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome trên Mac',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud Keychain',
  'd3452668-01fd-4c12-926c-83a4204853aa': 'Microsoft Password Manager',
  '771b48fd-d3d4-4f74-9232-fc157ab0507a': 'Edge trên Mac',
  '53414d53-554e-4700-0000-000000000000': 'Samsung Pass',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  '531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
  'b84e4048-15dc-4dd0-8640-f4f60813c8af': 'NordPass',
  '0ea242b4-43c4-4a1b-8b17-dd6d0b6baec6': 'Keeper',
  '50726f74-6f6e-5061-7373-50726f746f6e': 'Proton Pass',
};
export function tenNoiCat(aaguid: string | null | undefined, dongBo: boolean | null | undefined): string | null {
  const a = String(aaguid || '').toLowerCase();
  if (NOI_CAT[a]) return NOI_CAT[a];
  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(a) && dongBo) return 'iCloud Keychain';
  return null;
}

/** Ghi khoá vừa bật vào database (dùng chung cho bật tay và tự tạo), kèm nơi cất + cờ đồng bộ, rồi gắn khoá vào MÁY trong sổ
 *  thiết bị. Trả mã dòng, hoặc null khi mã khoá trùng với khoá của tài khoản KHÁC. */
async function ghiKhoaMoi(req: AuthedRequest, info: any, tenMay: string, tuTao: boolean): Promise<number | null> {
  const me = req.user!;
  const { credential } = info;
  // ⚠️ 11/10/2026 (rà soát bảo mật): trùng mã khoá thì CHỈ cập nhật khi khoá đó là của CHÍNH người này.
  //    Trước đây ai cũng ghi đè được bộ đếm của khoá người khác (mã khoá lộ qua /dang-nhap/bat-dau kèm email)
  //    → chủ thật không đăng nhập bằng vân tay được nữa ("Chữ ký không hợp lệ").
  const ghi = await query(
    `INSERT INTO webauthn_credentials (user_id, cred_id, public_key, counter, transports, ten_may, aaguid, dong_bo, da_sao_luu, tu_tao)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (cred_id) DO UPDATE SET counter = EXCLUDED.counter, last_used = now()
       WHERE webauthn_credentials.user_id = EXCLUDED.user_id
     RETURNING id`,
    [me.id, credential.id, Buffer.from(credential.publicKey), credential.counter ?? 0,
     (credential.transports || []).join(',') || null, String(tenMay || '').slice(0, 60) || 'Máy này',
     info.aaguid || null, info.credentialDeviceType === 'multiDevice', !!info.credentialBackedUp, tuTao]);
  if (!ghi.length) return null;
  // Ghi khoá này thuộc MÁY nào trong sổ thiết bị: sau này tab ẩn danh / trình duyệt khác trên cùng máy đăng nhập bằng khoá
  // này là nhận ra đúng máy, đổi mạng cũng vậy (lib/thietBi.ts bacCungMay, bậc "cùng khoá").
  const maMay = maThietBi(req);
  if (maMay) query(`UPDATE webauthn_credentials SET thiet_bi_ids = ARRAY(SELECT id FROM thiet_bi WHERE user_id=$2 AND (ma=$3 OR $3 = ANY(ma_phu)))
                    WHERE id=$1`, [ghi[0].id, me.id, maMay]).catch(() => {});
  return ghi[0].id;
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
  goiChungDen: u.goi_chung_het_han ?? null,   // hạn GÓI CHỨC NĂNG CHUNG — giống routes/auth.ts profile
});

/* ══ 1. ĐĂNG KÝ vân tay cho máy này (phải đang đăng nhập) ══════════════════ */
/* ⛔ BẬT FACE ID / VÂN TAY PHẢI XÁC NHẬN LẠI (13/10/2026 — rà soát rủi ro). Trước đây ai ĐANG đăng nhập là bật được ngay: kẻ lấy
 * được phiên đăng nhập (không cần biết mật khẩu) gắn được khoá của máy hắn → vào được tới khi chủ đổi mật khẩu. Nay phải: vừa đăng
 * nhập TỪ CHÍNH MÁY NÀY trong 10 phút, hoặc gõ lại MẬT KHẨU (sai 5 lần / 15 phút là tạm khoá việc này). */
const saiMk = new Map<number, { n: number; tu: number }>();
async function daXacNhan(req: AuthedRequest): Promise<{ ok: true } | { ok: false; ma: number; loi: string }> {
  const me = req.user!;
  const maMay = maThietBi(req);
  if (maMay) {
    const [vua] = await query(`SELECT 1 FROM thiet_bi_dang_nhap WHERE user_id=$1 AND ma=$2 AND ket_qua='ok'
      AND luc > now() - interval '10 minutes'`, [me.id, maMay]);
    if (vua) return { ok: true };
  }
  const mk = String(req.body?.matKhau || '');
  if (!mk) return { ok: false, ma: 403, loi: 'Nhập mật khẩu tài khoản để xác nhận.' };
  const s = saiMk.get(Number(me.id));
  if (s && s.n >= 5 && Date.now() - s.tu < 15 * 60 * 1000) return { ok: false, ma: 429, loi: 'Sai mật khẩu nhiều lần. Thử lại sau 15 phút.' };
  const [u] = await query('SELECT password_hash FROM users WHERE id=$1', [me.id]);
  if (!u || !(await verifyPassword(mk, u.password_hash))) {
    const c = s && Date.now() - s.tu < 15 * 60 * 1000 ? s : { n: 0, tu: Date.now() };
    saiMk.set(Number(me.id), { n: c.n + 1, tu: c.tu });
    return { ok: false, ma: 403, loi: 'Mật khẩu không đúng.' };
  }
  saiMk.delete(Number(me.id));
  return { ok: true };
}

passkeyRouter.post('/dang-ky/bat-dau', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!;
    const xn = await daXacNhan(req);
    if (!xn.ok) return res.status(xn.ma).json({ error: xn.loi, maLoi: 'CAN_XAC_NHAN' });
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
        residentKey: 'required',            // khoá kiểu "máy tự nhận ra tài khoản" (passkey) — chuẩn WebAuthn bản 3
        userVerification: 'required',       // BẮT BUỘC hỏi vân tay/khuôn mặt, không chỉ chạm
        authenticatorAttachment: 'platform', // dùng chính máy này, không phải khoá USB rời
      },
    });
    const khoa = await catThuThach(opts.challenge, Number(me.id), 'dang-ky');
    res.json({ khoa, options: opts });
  } catch (e) { next(e); }
});

passkeyRouter.post('/dang-ky/xong', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!;
    const { khoa, response, tenMay } = req.body ?? {};
    const tt = await layThuThach(khoa);
    if (!tt || Number(tt.user_id) !== Number(me.id) || (tt.loai && tt.loai !== 'dang-ky'))
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
    const id = await ghiKhoaMoi(req, kq.registrationInfo, String(tenMay || ''), false);
    if (!id) return res.status(409).json({ error: 'Khoá này đang gắn với tài khoản khác.' });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

/* ══ 1b. TỰ TẠO KHOÁ NGẦM ngay sau khi đăng nhập bằng mật khẩu tự điền (13/10/2026) ════════════════════════
 * Chuẩn WebAuthn bản 3 "conditional create" (Apple gọi là "automatic passkey upgrades", có từ iOS 18 / macOS 15; Chrome 136+
 * với Google Password Manager). Khách vừa đăng nhập bằng MẬT KHẨU mà trình quản lý mật khẩu của máy TỰ ĐIỀN → trình duyệt
 * tạo luôn khoá đăng nhập cho đúng tài khoản đó, không hiện bảng hỏi; máy chỉ báo "đã lưu mã khoá". Điều kiện máy tự xét:
 * máy có khoá màn hình, KHÔNG phải tab ẩn danh, trình quản lý mật khẩu vừa điền mật khẩu của CÙNG tên đăng nhập. Không đủ
 * điều kiện thì trình duyệt báo lỗi mà không hiện gì — phía web im lặng, lần đăng nhập sau thử lại.
 * Vì không có bước quét mặt lúc tạo, khoá loại này KHÔNG có cờ "có mặt" / "đã xác minh" → máy chủ nới kiểm tra RIÊNG cho nó,
 * và chặn chặt bù lại: chỉ cấp thử thách khi lần đăng nhập gần nhất của tài khoản là bằng MẬT KHẨU, thành công, TỪ CHÍNH MÁY
 * NÀY, trong 5 phút; mỗi máy mỗi lần đăng nhập chỉ xin một lần; thử thách đánh dấu 'tu-dong' và chỉ nộp được ở /tu-dong/xong.
 * Lúc dùng khoá đăng nhập vẫn bắt quét mặt / mật mã máy như mọi khoá khác (/dang-nhap/xong đòi "đã xác minh").
 * Kẻ biết mật khẩu vốn đã tự bật Face ID cho máy hắn được (mục 1) → cách này không mở thêm lối vào nào. */
const daXinTuTao = new Map<string, number>();     // "người:máy" → lúc đăng nhập đã xin; mỗi lần đăng nhập chỉ một lần
passkeyRouter.post('/tu-dong/bat-dau', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!;
    if (await isFlagOn('tat_tu_tao_khoa')) return res.status(409).json({ error: 'Tự tạo khoá đang tắt.' });   // công tắc ở trang quản trị
    const maMay = maThietBi(req);
    if (!maMay) return res.status(409).json({ error: 'Không nhận diện được máy.' });
    const [dn] = await query<any>(`SELECT luc FROM thiet_bi_dang_nhap WHERE user_id=$1 AND ma=$2 AND cach='mat-khau' AND ket_qua='ok'
      AND luc > now() - interval '5 minutes'`, [me.id, maMay]);
    if (!dn) return res.status(409).json({ error: 'Chỉ tự tạo ngay sau khi đăng nhập bằng mật khẩu.' });
    const khoaNho = me.id + ':' + maMay, luc = new Date(dn.luc).getTime();
    if (daXinTuTao.get(khoaNho) === luc) return res.status(409).json({ error: 'Đã thử cho lần đăng nhập này.' });
    daXinTuTao.set(khoaNho, luc);
    if (daXinTuTao.size > 5000) daXinTuTao.clear();
    // Tên trên khoá phải TRÙNG tên trình quản lý mật khẩu vừa điền (Apple / Google so khớp) — nhận đúng chữ người dùng gõ / máy
    // điền nếu nó chính là email tài khoản (khác hoa / thường), không thì dùng email tài khoản.
    const go = String(req.body?.tenDangNhap || '').trim();
    const ten = go && go.toLowerCase() === String(me.email || '').toLowerCase() ? go : me.email;
    const da = await query('SELECT cred_id, transports FROM webauthn_credentials WHERE user_id=$1', [me.id]);
    const opts = await generateRegistrationOptions({
      rpName: RP_TEN, rpID: RP_ID,
      userID: await maTaiKhoan(Number(me.id)),   // cố định → khoá tự tạo THAY khoá cũ cùng tài khoản trên máy, không thành hai
      userName: ten, userDisplayName: ten,
      attestationType: 'none',
      excludeCredentials: da.map((c: any) => ({ id: c.cred_id, transports: c.transports ? String(c.transports).split(',') as any : undefined })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred', authenticatorAttachment: 'platform' },
    });
    const khoa = await catThuThach(opts.challenge, Number(me.id), 'tu-dong');
    res.json({ khoa, options: opts });
  } catch (e) { next(e); }
});

passkeyRouter.post('/tu-dong/xong', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!;
    const { khoa, response, tenMay } = req.body ?? {};
    const tt = await layThuThach(khoa);
    if (!tt || tt.loai !== 'tu-dong' || Number(tt.user_id) !== Number(me.id))
      return res.status(400).json({ error: 'Hết hạn.' });
    const kq = await verifyRegistrationResponse({
      response,
      expectedChallenge: tt.challenge,
      expectedOrigin: gocCuaRequest(req),
      expectedRPID: RP_ID,
      requireUserPresence: false,          // khoá tự tạo không có cờ "có mặt" / "đã xác minh" (xem chú thích mục 1b)
      requireUserVerification: false,
    });
    if (!kq.verified || !kq.registrationInfo) return res.status(400).json({ error: 'Không nhận được.' });
    const id = await ghiKhoaMoi(req, kq.registrationInfo, String(tenMay || 'Máy này').slice(0, 48) + ' · tự tạo', true);
    if (!id) return res.status(409).json({ error: 'Khoá này đang gắn với tài khoản khác.' });
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
    const khoa = await catThuThach(opts.challenge, null, 'dang-nhap');
    res.json({ khoa, options: opts });
  } catch (e) { next(e); }
});

passkeyRouter.post('/dang-nhap/xong', async (req, res, next) => {
  try {
    const { khoa, response } = req.body ?? {};
    const tt = await layThuThach(khoa);
    if (!tt || (tt.loai && tt.loai !== 'dang-nhap')) return res.status(400).json({ error: 'Hết hạn. Bấm lại.' });

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
    // Cập nhật cờ "đang được sao lưu" (BS) — có thể đổi theo thời gian; cờ "đồng bộ được" (BE) thì cố định từ lúc tạo.
    await query('UPDATE webauthn_credentials SET counter=$1, last_used=now(), da_sao_luu=$3 WHERE id=$2',
                [moi, c.cred_row_id, !!kq.authenticationInfo.credentialBackedUp]);
    // Chưa có mã tài khoản cố định (người bật từ trước 12/10/2026) → nhận mã của chính khoá vừa dùng, để lần bật lại
    // sau này trên máy đó THAY khoá này chứ không cất thêm khoá thứ hai (xem maTaiKhoan). Chỉ ghi vào tài khoản của khoá.
    const maKhoa = String(response?.response?.userHandle || '');
    if (/^[A-Za-z0-9_-]{8,128}$/.test(maKhoa))
      query('UPDATE users SET passkey_uid=$2 WHERE id=$1 AND passkey_uid IS NULL', [c.user_id, maKhoa]).catch(() => {});

    const tb = await ghiDangNhap({ id: c.user_id, role: c.role, roles: dsVaiTro(c) }, req, 'van-tay',   // sổ + giới hạn thiết bị
      { mayKhoa: (c.thiet_bi_ids || []).map(Number),          // khoá này từng dùng trên máy nào → nhận ra cùng máy dù khác mạng
        // khoá ĐỒNG BỘ (iCloud / Google: nằm được trên nhiều máy, chia sẻ được cho người khác) là dấu hiệu YẾU hơn khoá chỉ trên
        // một máy (Windows Hello). Chưa biết (khoá cũ chưa ghi cờ) thì coi như đồng bộ cho chắc. Xem lib/thietBi.ts bacCungMay.
        khoaDongBo: c.dong_bo !== false });
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
    // maTk + rpId: để trình duyệt báo cho nơi cất khoá biết khoá nào CÒN hiệu lực (WebAuthn Signal API — ẩn khoá máy chủ đã xoá,
    // vd sau đổi mật khẩu) và tên tài khoản mới nhất. noiCat / dongBo / tuTao: hiện ở trang Tài khoản.
    const ds = (await query<any>(
      `SELECT id, cred_id, ten_may, transports, created_at, last_used, aaguid, dong_bo, tu_tao
       FROM webauthn_credentials WHERE user_id=$1 ORDER BY id DESC`, [req.user!.id]))
      .map(({ aaguid, dong_bo, tu_tao, ...c }: any) => ({ ...c, noiCat: tenNoiCat(aaguid, dong_bo), dongBo: dong_bo, tuTao: !!tu_tao }));
    const [u] = await query<any>('SELECT passkey_uid, email, full_name FROM users WHERE id=$1', [req.user!.id]);
    res.json({ ds, uid: req.user!.id, maTk: u?.passkey_uid || null, rpId: RP_ID, email: u?.email || null, ten: u?.full_name || null });
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
