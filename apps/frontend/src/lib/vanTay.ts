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
import { startRegistration, startAuthentication, browserSupportsWebAuthn }
  from '@simplewebauthn/browser';
import { api } from './api';

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
 * Chủ dự án chụp màn hình: bấm nút Face ID thì iPhone hiện thêm hộp "Sử dụng Face ID để đăng nhập?
 * — Tiếp tục", phải bấm thêm một lần nữa. Nguyên nhân: trước đây bấm nút xong web còn đi XIN MÁY CHỦ
 * thử thách rồi mới gọi Face ID — Safari thấy lệnh Face ID không nằm ngay trong cú bấm (đã chờ mạng)
 * nên chèn hộp hỏi lại cho chắc. Nay xin SẴN thử thách lúc mở ô đăng nhập; bấm nút là gọi Face ID
 * NGAY, không chờ gì → vào thẳng Face ID. Máy chủ giữ thử thách 5 phút và chỉ cho dùng một lần
 * (routes/passkey.ts) nên ở đây chỉ dùng bản lấy chưa quá 4 phút; ô đăng nhập làm mới mỗi 4 phút.
 * Thử thách lấy KHÔNG kèm email: khoá đăng ký kiểu "máy tự nhận ra tài khoản" (residentKey) nên
 * iPhone vẫn tự đưa đúng tài khoản. */
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

/** Đăng nhập bằng vân tay. Trả về token + hồ sơ người dùng.
 *  ⚠️ Có thử thách lấy sẵn thì KHÔNG được chờ gì trước lệnh Face ID (xem trên). */
export async function dangNhapVanTay(email?: string): Promise<{ token: string; user: any }> {
  let tt: ThuThach | null = conHan(thuThachSan) ? thuThachSan : null;
  if (!tt) {
    const r = await api<{ khoa: string; options: any }>(
      '/passkey/dang-nhap/bat-dau', {
        method: 'POST', body: JSON.stringify(email ? { email } : {}),
      });
    tt = { khoa: r.khoa, options: r.options, luc: Date.now() };
  }
  const response = await startAuthentication({ optionsJSON: tt.options });
  if (thuThachSan === tt) thuThachSan = null;      // thử thách chỉ dùng được một lần
  return api<{ token: string; user: any }>('/passkey/dang-nhap/xong', {
    method: 'POST', body: JSON.stringify({ khoa: tt.khoa, response }),
  });
}

/** Người dùng TỰ TẮT bảng Face ID / vân tay (bấm Huỷ, vuốt bảng xuống).
 *  Chủ dự án (12/10/2026): tự tắt thì thôi, KHÔNG hiện hộp "Chưa dùng được — Đã huỷ" nữa. */
export function laHuy(e: any): boolean {
  const t = String(e?.name || '') + ' ' + String(e?.message || '');
  return /NotAllowedError|AbortError|cancel|abort/i.test(t);
}

export type MayDaDangKy = {
  id: number; ten_may: string | null; transports: string | null;
  created_at: string; last_used: string | null;
};
export const dsMayDaDangKy = () => api<{ ds: MayDaDangKy[] }>('/passkey/danh-sach');
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
