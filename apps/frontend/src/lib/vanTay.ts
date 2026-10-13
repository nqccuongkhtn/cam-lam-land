/* ============================================================================
 *  ĐĂNG NHẬP BẰNG VÂN TAY / KHUÔN MẶT — phần chạy trên trình duyệt.
 * ----------------------------------------------------------------------------
 *  Gọi tới /api/passkey của máy chủ. Xem lời giải thích đầy đủ ở
 *  apps/backend/src/routes/passkey.ts.
 *
 *  Nhắc lại chỗ quan trọng nhất: VÂN TAY VÀ KHUÔN MẶT KHÔNG RỜI KHỎI MÁY.
 *  Trình duyệt chỉ nhờ hệ điều hành xác nhận đúng chủ máy, rồi ký một chuỗi
 *  ngẫu nhiên bằng khoá nằm trong chip bảo mật. Web không đọc được vân tay.
 * ========================================================================== */
import {
  startRegistration, startAuthentication, browserSupportsWebAuthn,
  base64URLStringToBuffer, bufferToBase64URLString,
} from '@simplewebauthn/browser';
import { api } from './api';
import { maKhoaCuaMay, nhoMaKhoa, themMaKhoa, boMaKhoa, baoNoiCatKhoa } from './maKhoaMay';

/** Máy này có dùng được vân tay / khuôn mặt không. */
export function mayCoHoTro(): boolean {
  try {
    // Phải là trang https (hoặc localhost) thì trình duyệt mới cho dùng.
    return browserSupportsWebAuthn() && (window.isSecureContext ?? false);
  } catch { return false; }
}

/** Máy này có sẵn vân tay / khuôn mặt đã cài trong hệ điều hành không. */
export async function mayCoVanTay(): Promise<boolean> {
  try {
    if (!mayCoHoTro()) return false;
    const f = (window as any).PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
    return typeof f === 'function' ? await f.call((window as any).PublicKeyCredential) : false;
  } catch { return false; }
}

/* ── VÌ SAO MÁY NÀY CHƯA DÙNG ĐƯỢC ───────────────────────────────────────────
 * Trước đây trang đăng nhập chỉ hỏi "có dùng được không" rồi ẨN LUÔN cái nút nếu
 * không. Hậu quả: chủ dự án mở trang, không thấy gì, tưởng tính năng chưa làm —
 * trong khi thật ra máy bàn chưa cài Windows Hello nên trình duyệt báo không có.
 * Nay trả về LÝ DO để màn hình nói rõ cho người dùng biết phải làm gì.
 */
export type TinhTrangVanTay =
  | { dung: true }
  | { dung: false; ly_do: 'trinh-duyet' | 'khong-https' | 'chua-cai'; loiNhan: string };

export async function kiemTraVanTay(): Promise<TinhTrangVanTay> {
  try {
    // ⚠️ VIẾT NGẮN NHƯ APP. Chủ dự án: "ghi đơn giản như app thôi, đừng dùng
    //    từ ngữ AI". Mỗi câu một ý, không giải thích dài dòng, không liệt kê
    //    điều kiện. Người dùng chỉ cần biết PHẢI LÀM GÌ TIẾP.
    if (!(window as any).PublicKeyCredential)
      return { dung: false, ly_do: 'trinh-duyet',
        loiNhan: 'Trình duyệt này không hỗ trợ. Thử Chrome, Edge hoặc Safari.' };

    if (!window.isSecureContext)
      return { dung: false, ly_do: 'khong-https',
        loiNhan: 'Cần mở web bằng địa chỉ https.' };

    const f = (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
    const co = typeof f === 'function' ? await f.call((window as any).PublicKeyCredential) : false;
    if (!co)
      return { dung: false, ly_do: 'chua-cai',
        // ⚠️ ĐỪNG GỌI TÊN CÔNG NGHỆ. Câu trước ghi "Windows Hello" — chủ dự
        //    án hỏi lại "Windows Hello là cái gì". Người dùng không cần biết
        //    tên hãng đặt; họ chỉ cần biết phải mở Cài đặt của máy và bật
        //    mở khoá bằng khuôn mặt hay vân tay.
        loiNhan: 'Máy này chưa bật mở khoá bằng khuôn mặt hoặc vân tay. Bật trong Cài đặt của máy.' };

    return { dung: true };
  } catch {
    return { dung: false, ly_do: 'trinh-duyet', loiNhan: 'Máy này không dùng được.' };
  }
}

/** Đăng ký vân tay cho máy đang dùng (phải đang đăng nhập bằng mật khẩu trước). */
export async function themVanTay(tenMay?: string): Promise<void> {
  const { khoa, options } = await api<{ khoa: string; options: any }>(
    '/passkey/dang-ky/bat-dau', { method: 'POST', body: '{}' });
  const response = await startRegistration({ optionsJSON: options });
  await api('/passkey/dang-ky/xong', {
    method: 'POST',
    body: JSON.stringify({ khoa, response, tenMay: tenMay || tenMayMacDinh() }),
  });
}

/* ── LẤY SẴN THỬ THÁCH ĐĂNG NHẬP (12/10/2026) ─────────────────────────────────
 * Xin SẴN thử thách lúc mở ô đăng nhập; bấm nút là gọi Face ID NGAY, không chờ mạng. iPhone đời cũ
 * (iOS ≤ 17.3) chỉ cho gọi Face ID nằm ngay trong cú bấm — chờ mạng xong mới gọi là bị từ chối.
 * ⚠️ VIỆC NÀY KHÔNG BỎ ĐƯỢC hộp "Sử dụng Face ID để đăng nhập? — Tiếp tục" như từng ghi ở đây và từng
 *    báo chủ dự án (12/10/2026 — chủ dự án thử lại: hộp vẫn hiện). Hộp đó là của iPhone: Apple BẮT
 *    BUỘC người dùng xác nhận mỗi lần trang web xin đăng nhập bằng mã khoá qua nút bấm, web không tắt
 *    được. Đường KHÔNG có hộp là gợi ý trên bàn phím — xem batGoiYBanPhim bên dưới.
 * Máy chủ giữ thử thách 5 phút và chỉ cho dùng một lần (routes/passkey.ts) nên ở đây chỉ dùng bản lấy
 * chưa quá 4 phút; ô đăng nhập làm mới mỗi 4 phút. Thử thách lấy KHÔNG kèm email: khoá đăng ký kiểu
 * "máy tự nhận ra tài khoản" (residentKey) nên iPhone vẫn tự đưa đúng tài khoản. */
type ThuThach = { khoa: string; options: any; luc: number };
const HAN_THU_THACH_MS = 4 * 60 * 1000;
let thuThachSan: ThuThach | null = null;
let dangXin: Promise<ThuThach | null> | null = null;
const conHan = (t: ThuThach | null): t is ThuThach => !!t && Date.now() - t.luc < HAN_THU_THACH_MS;

/** Xin trước thử thách đăng nhập (gọi khi mở ô đăng nhập). Hỏng thì im lặng — lúc bấm sẽ xin lại. */
export function chuanBiVanTay(lamMoi = false): Promise<ThuThach | null> {
  if (!lamMoi && conHan(thuThachSan)) return Promise.resolve(thuThachSan);
  if (dangXin) return dangXin;
  dangXin = api<{ khoa: string; options: any }>('/passkey/dang-nhap/bat-dau', { method: 'POST', body: '{}' })
    .then((r) => (thuThachSan = { khoa: r.khoa, options: r.options, luc: Date.now() }))
    .catch(() => null)
    .finally(() => { dangXin = null; });
  return dangXin;
}

type KetQuaDangNhap = { token: string; user: any };

/** Đăng nhập bằng NÚT Face ID / vân tay. Trả về token + hồ sơ người dùng.
 *  ⚠️ Có thử thách lấy sẵn thì KHÔNG được chờ gì trước lệnh Face ID (xem trên). */
export async function dangNhapVanTay(email?: string): Promise<KetQuaDangNhap> {
  // Lệnh gợi ý trên bàn phím đang treo thì gỡ trước — mỗi lúc trình duyệt chỉ chạy một lệnh Face ID.
  if (goiY) huyGoiY(goiY);
  dangHoiNut = true;
  try {
    let tt: ThuThach | null = conHan(thuThachSan) ? thuThachSan : null;
    if (!tt) {
      const r = await api<{ khoa: string; options: any }>(
        '/passkey/dang-nhap/bat-dau', {
          method: 'POST', body: JSON.stringify(email ? { email } : {}),
        });
      tt = { khoa: r.khoa, options: r.options, luc: Date.now() };
    }
    /* CHỈ ĐƯA RA KHOÁ CÒN DÙNG ĐƯỢC (12/10/2026). Chủ dự án đổi mật khẩu xong bật lại Face ID → iPhone hiện hai
       khoá cùng email (khoá cũ máy chủ đã xoá nhưng iPhone vẫn giữ). Có danh sách khoá còn dùng được của máy này
       (lib/maKhoaMay.ts) thì gửi kèm → iPhone chỉ hiện đúng khoá đó, khỏi phải chọn. */
    const cho = maKhoaCuaMay();
    const optionsJSON = cho.length && !tt.options?.allowCredentials?.length
      ? { ...tt.options, allowCredentials: cho.map((m) => ({ id: m.id, type: 'public-key', transports: m.tr })) }
      : tt.options;
    const response = await startAuthentication({ optionsJSON });
    if (thuThachSan === tt) thuThachSan = null;      // thử thách chỉ dùng được một lần
    return await xacNhanDangNhap(tt, response);
  } finally {
    dangHoiNut = false;
    // Còn ở ô đăng nhập (huỷ bảng Face ID / lỗi) thì treo lại gợi ý trên bàn phím.
    const p = goiY;
    if (p?.con) setTimeout(() => void chayGoiY(p), 500);
  }
}

/** Gửi chữ ký lên máy chủ. Máy chủ báo khoá đã tắt ('KHOA_DA_TAT' — đổi mật khẩu / đã gỡ) thì bỏ khoá đó khỏi danh
 *  sách của máy, và nhờ máy xoá luôn khoá cũ nếu máy hỗ trợ (iOS 26+, Chrome 132+; máy cũ không có thì bỏ qua). */
async function xacNhanDangNhap(tt: ThuThach, response: any): Promise<KetQuaDangNhap> {
  try {
    const kq = await api<KetQuaDangNhap>('/passkey/dang-nhap/xong', {
      method: 'POST', body: JSON.stringify({ khoa: tt.khoa, response }),
    });
    if (kq?.user?.id != null) themMaKhoa(kq.user.id, response.id);
    return kq;
  } catch (e: any) {
    if (e?.maLoi === 'KHOA_DA_TAT') {
      boMaKhoa(response.id);
      try {
        const P: any = (window as any).PublicKeyCredential;
        if (tt.options?.rpId && typeof P?.signalUnknownCredential === 'function')
          P.signalUnknownCredential({ rpId: tt.options.rpId, credentialId: response.id }).catch(() => {});
      } catch { /* máy chưa hỗ trợ */ }
    }
    throw e;
  }
}

/* ── GỢI Ý TÀI KHOẢN NGAY TRÊN BÀN PHÍM — ĐĂNG NHẬP KHÔNG QUA HỘP "TIẾP TỤC" (12/10/2026) ────────────
 * Chủ dự án muốn bỏ hộp "Sử dụng Face ID để đăng nhập? — Tiếp tục". Apple bắt mọi lần đăng nhập bằng mã khoá
 * phải có một bước người dùng xác nhận: qua NÚT thì là cái hộp đó (web không tắt được), còn qua GỢI Ý TRÊN
 * BÀN PHÍM thì cú chạm vào gợi ý chính là bước xác nhận → chạm vào ô Email, iPhone hiện tài khoản ngay trên
 * bàn phím, chạm vào là quét Face ID luôn, không có hộp.
 * Muốn có gợi ý, trang phải "treo" sẵn một lệnh đăng nhập kiểu gợi ý (mediation 'conditional') và ô Email phải
 * có autocomplete="username webauthn". Lệnh treo dùng thử thách RIÊNG; máy chủ giữ thử thách 5 phút nên 4 phút
 * treo lại một lần. Bấm nút Face ID thì gỡ lệnh treo, nút xong việc (huỷ / lỗi) thì treo lại.
 * Tự gọi navigator.credentials.get chứ không qua startAuthentication của thư viện: hàm đó còn chờ một nhịp
 * trước khi gọi, lỡ đúng lúc người dùng bấm nút thì nó huỷ mất lệnh của nút (bảng Face ID vụt tắt). */
type GoiY = {
  con: boolean; lan: number; ctrl?: AbortController; hen?: ReturnType<typeof setTimeout>;
  xong: (kq: KetQuaDangNhap) => void; loi: (e: any) => void;
};
let goiY: GoiY | null = null;
let dangHoiNut = false;

function huyGoiY(p: GoiY) {
  if (p.hen) clearTimeout(p.hen);
  p.hen = undefined;
  const c = p.ctrl; p.ctrl = undefined;
  try { c?.abort(); } catch { /* đã xong */ }
}

/** Treo gợi ý trên bàn phím cho ô đăng nhập đang mở. Trả về hàm gỡ (gọi khi đóng ô). Máy không hỗ trợ thì không làm gì. */
export function batGoiYBanPhim(xong: (kq: KetQuaDangNhap) => void, loi: (e: any) => void): () => void {
  if (goiY) { goiY.con = false; huyGoiY(goiY); }
  const p: GoiY = { con: true, lan: 0, xong, loi };
  goiY = p;
  void chayGoiY(p);
  return () => { p.con = false; huyGoiY(p); if (goiY === p) goiY = null; };
}

async function chayGoiY(p: GoiY): Promise<void> {
  if (!p.con || dangHoiNut || p.ctrl || goiY !== p) return;
  try {
    const P: any = (window as any).PublicKeyCredential;
    if (typeof P?.isConditionalMediationAvailable !== 'function' || !(await P.isConditionalMediationAvailable())) return;
  } catch { return; }
  if (!document.querySelector("input[autocomplete$='webauthn']")) return;
  let tt: ThuThach;
  try {
    const r = await api<{ khoa: string; options: any }>('/passkey/dang-nhap/bat-dau', { method: 'POST', body: '{}' });
    tt = { khoa: r.khoa, options: r.options, luc: Date.now() };
  } catch { return; }                       // mất mạng: thôi, nút Face ID vẫn dùng được
  // Trong lúc chờ mạng người dùng đã bấm nút / đóng ô → không treo nữa. Từ đây tới lệnh gọi KHÔNG chờ gì.
  if (!p.con || dangHoiNut || p.ctrl || goiY !== p) return;
  const ctrl = new AbortController();
  p.ctrl = ctrl;
  p.hen = setTimeout(() => { if (p.ctrl === ctrl) { huyGoiY(p); void chayGoiY(p); } }, HAN_THU_THACH_MS);
  let response: any;
  try {
    response = await treoGoiY(tt.options, ctrl.signal);
  } catch {
    // Tự mình gỡ (hết 4 phút / bấm nút / đóng ô) thì p.ctrl đã khác → thôi. Còn lại là người dùng tắt bảng Face ID
    // hoặc trình duyệt báo lỗi → treo lại sau 1 giây, tối đa 5 lần mỗi lần mở ô (không thì lỗi lặp là gọi máy chủ liên tục).
    if (p.ctrl === ctrl) { huyGoiY(p); if (p.con && ++p.lan <= 5) setTimeout(() => void chayGoiY(p), 1000); }
    return;
  }
  if (p.ctrl === ctrl) { if (p.hen) clearTimeout(p.hen); p.hen = undefined; p.ctrl = undefined; }
  try {
    const kq = await xacNhanDangNhap(tt, response);
    if (p.con) p.xong(kq);
  } catch (e) {
    if (!p.con) return;
    p.loi(e);
    if (++p.lan <= 5) setTimeout(() => void chayGoiY(p), 1000);
  }
}

/** Lệnh đăng nhập kiểu gợi ý: chờ tới khi người dùng chạm vào tài khoản hiện trên bàn phím / ô gợi ý của trình duyệt. */
async function treoGoiY(options: any, signal: AbortSignal): Promise<any> {
  const cred = (await navigator.credentials.get({
    mediation: 'conditional' as CredentialMediationRequirement,
    signal,
    publicKey: {
      challenge: base64URLStringToBuffer(options.challenge),
      rpId: options.rpId,
      timeout: options.timeout,
      userVerification: options.userVerification,
      allowCredentials: [],                 // kiểu gợi ý phải để trống: máy tự đưa ra các khoá nó có cho tên miền này
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Không nhận được. Thử lại.');
  const r = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    rawId: bufferToBase64URLString(cred.rawId),
    type: cred.type,
    response: {
      authenticatorData: bufferToBase64URLString(r.authenticatorData),
      clientDataJSON: bufferToBase64URLString(r.clientDataJSON),
      signature: bufferToBase64URLString(r.signature),
      userHandle: r.userHandle ? bufferToBase64URLString(r.userHandle) : undefined,
    },
    clientExtensionResults: cred.getClientExtensionResults(),
  };
}

/** Người dùng TỰ TẮT bảng Face ID / vân tay (bấm Huỷ, vuốt bảng xuống).
 *  Chủ dự án (12/10/2026): tự tắt thì thôi, KHÔNG hiện hộp "Chưa dùng được — Đã huỷ" nữa. */
export function laHuy(e: any): boolean {
  const t = String(e?.name || '') + ' ' + String(e?.message || '');
  return /NotAllowedError|AbortError|cancel|abort/i.test(t);
}

export type MayDaDangKy = {
  id: number; cred_id?: string; ten_may: string | null; transports: string | null;
  created_at: string; last_used: string | null;
  noiCat?: string | null;     // nơi cất khoá: iCloud Keychain, Google Password Manager, Windows Hello…
  dongBo?: boolean | null;    // khoá đồng bộ nhiều máy (iCloud / Google) hay chỉ nằm trên một máy
  tuTao?: boolean;            // khoá web tự tạo ngầm sau khi đăng nhập bằng mật khẩu
};
/** Danh sách máy đã bật — tiện cất luôn danh sách khoá còn dùng được của máy này (lib/maKhoaMay.ts) và báo cho nơi cất
 *  khoá biết khoá nào còn hiệu lực (baoNoiCatKhoa — vd vừa bấm Gỡ thì máy này ẩn khoá đó đi). */
export async function dsMayDaDangKy(): Promise<{ ds: MayDaDangKy[] }> {
  const r = await api<{ ds: MayDaDangKy[]; uid?: number; maTk?: string | null; rpId?: string; email?: string | null; ten?: string | null }>('/passkey/danh-sach');
  if (r?.uid != null) nhoMaKhoa(r.uid, r.ds || []);
  baoNoiCatKhoa(r);
  return r;
}

/* ── TỰ TẠO KHOÁ NGẦM ngay sau khi đăng nhập bằng mật khẩu tự điền (13/10/2026 — backend routes/passkey.ts mục 1b) ──
 * Chuẩn WebAuthn bản 3 "conditional create" (Apple: "automatic passkey upgrades", iOS 18+ / macOS 15+; Chrome 136+ với Google
 * Password Manager). Theo hướng dẫn của Apple: HỎI TRƯỚC trình duyệt có hỗ trợ không (getClientCapabilities → conditionalCreate),
 * gọi NGAY sau khi đăng nhập bằng mật khẩu, KHÔNG hiện bảng mời; máy không đủ điều kiện (mật khẩu gõ tay, tab ẩn danh, máy chưa đặt
 * khoá màn hình, đã có khoá…) thì trình duyệt báo lỗi mà không hiện gì → ở đây im lặng, lần đăng nhập sau thử lại.
 * tenDangNhap = đúng chữ trong ô email lúc đăng nhập: trình quản lý mật khẩu chỉ tạo khoá khi tên trùng tên nó vừa điền. */
export async function tuTaoKhoa(tenDangNhap: string): Promise<void> {
  try {
    const P: any = (window as any).PublicKeyCredential;
    if (typeof P?.getClientCapabilities !== 'function') return;
    const kn = await P.getClientCapabilities();
    if (!kn?.conditionalCreate) return;
    if (goiY) { goiY.con = false; huyGoiY(goiY); goiY = null; }   // lệnh gợi ý trên bàn phím còn treo thì gỡ trước
    const { khoa, options } = await api<{ khoa: string; options: any }>('/passkey/tu-dong/bat-dau',
      { method: 'POST', body: JSON.stringify({ tenDangNhap: String(tenDangNhap || '').trim() }) });
    const response = await startRegistration({ optionsJSON: options, useAutoRegister: true });
    await api('/passkey/tu-dong/xong', { method: 'POST', body: JSON.stringify({ khoa, response, tenMay: tenMayMacDinh() }) });
    dsMayDaDangKy().catch(() => {});                               // cất lại danh sách khoá của máy
  } catch { /* không đủ điều kiện → im lặng */ }
}
export const xoaVanTay = (id: number) => api(`/passkey/${id}`, { method: 'DELETE' });

/** Đoán tên máy cho dễ nhận ra về sau: "iPhone · Safari". */
export function tenMayMacDinh(): string {
  const ua = navigator.userAgent;
  const may = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Điện thoại Android'
      : /Mac/.test(ua) ? 'máy Mac' : /Windows/.test(ua) ? 'máy Windows' : 'Máy này';
  const tr = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
  return tr ? `${may} · ${tr}` : may;
}

/** Đổi lỗi kỹ thuật của trình duyệt thành câu người dùng hiểu được. */
export function loiDeHieu(e: any): string {
  // Chọn phải khoá cũ máy chủ đã tắt (đổi mật khẩu / đã gỡ). Khoá đó vừa bị bỏ khỏi danh sách của máy (xacNhanDangNhap):
  // máy còn khoá khác dùng được thì bấm lại là iPhone chỉ đưa ra khoá đó; không còn thì phải vào bằng mật khẩu rồi bật lại.
  if (e?.maLoi === 'KHOA_DA_TAT')
    return maKhoaCuaMay().length
      ? 'Mã khoá này đã cũ. Bấm lại nút Face ID là được.'
      : 'Face ID trên máy này đã tắt. Đăng nhập bằng mật khẩu, rồi bật lại trong Tài khoản.';
  const t = String(e?.name || '') + ' ' + String(e?.message || '');
  if (/NotAllowedError|cancel|abort/i.test(t))
    return 'Đã huỷ. Bấm lại để thử.';
  if (/InvalidStateError/i.test(t))
    return 'Máy này đã đăng ký rồi.';
  if (/NotSupportedError|SecurityError/i.test(t))
    return 'Máy này không dùng được.';
  // ⚠️ PHÂN BIỆT HAI VIỆC KHÁC HẲN NHAU:
  //    · máy chưa có Face ID/vân tay  → bật trong Cài đặt CỦA MÁY;
  //    · máy có rồi nhưng chưa bật cho tài khoản → bật trong TÀI KHOẢN của
  //      web (trang /account). Chủ dự án nhắc: "cài đặt trong cài đặt của
  //      tài khoản chứ nhỉ" — đúng, và trước đây câu báo lỗi không nói ra.
  if (/chưa bật|chưa được đăng ký|404/i.test(t))
    return 'Máy này chưa bật. Vào Tài khoản để bật.';
  return e?.message || 'Không nhận được. Thử lại.';
}
