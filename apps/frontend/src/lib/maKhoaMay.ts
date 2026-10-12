/* ============================================================================
 *  NHỚ CÁC KHOÁ FACE ID / VÂN TAY CÒN DÙNG ĐƯỢC CỦA MÁY NÀY (12/10/2026)
 * ----------------------------------------------------------------------------
 *  Chủ dự án chụp màn hình: đổi mật khẩu xong bật lại Face ID thì iPhone hiện HAI khoá cùng một email, bắt
 *  chọn — chọn nhầm khoá cũ là báo lỗi. Đổi mật khẩu thì máy chủ xoá khoá (đúng ý chủ dự án, chống người lạ
 *  còn vào được), nhưng iPhone KHÔNG biết chuyện đó nên vẫn giữ khoá cũ và cứ đưa ra cho chọn.
 *  Web phải tự nói cho iPhone biết khoá nào còn dùng được: lúc bấm nút Face ID gửi kèm danh sách khoá còn
 *  dùng được (allowCredentials) → iPhone chỉ hiện đúng các khoá đó, khoá cũ không hiện nữa.
 *  Lúc bấm đăng nhập thì chưa biết là ai, nên danh sách lấy từ máy chủ những lúc ĐANG đăng nhập
 *  (/passkey/danh-sach) rồi cất ở máy này. Chỉ là MÃ SỐ của khoá — không có gì bí mật, không thay được mật khẩu.
 *  Chưa có danh sách (máy mới, lỡ xoá dữ liệu trình duyệt) thì đăng nhập như cũ: iPhone đưa ra mọi khoá nó có.
 * ========================================================================== */
import { api } from './api';

type Ma = { id: string; tr?: string[] };
type Kho = Record<string, { ds: Ma[]; luc: number }>;   // mã người dùng → khoá còn dùng được + lúc hỏi máy chủ
const KHOA = 'cl-ma-khoa-may';
const HOI_LAI_MS = 6 * 3600 * 1000;                       // đang đăng nhập thì 6 giờ hỏi lại máy chủ một lần

function doc(): Kho {
  try {
    const k = JSON.parse(localStorage.getItem(KHOA) || '{}');
    return k && typeof k === 'object' && !Array.isArray(k) ? k : {};
  } catch { return {}; }
}
function ghi(k: Kho) { try { localStorage.setItem(KHOA, JSON.stringify(k)); } catch { /* chế độ riêng tư: bỏ qua */ } }

/** Cất danh sách khoá máy chủ còn nhận của một tài khoản (thay hẳn danh sách cũ của tài khoản đó). */
export function nhoMaKhoa(uid: number | string, ds: { cred_id?: string; transports?: string | null }[]) {
  const k = doc();
  k[String(uid)] = {
    ds: ds.filter((c) => c.cred_id).map((c) => ({
      id: String(c.cred_id),
      ...(c.transports ? { tr: String(c.transports).split(',').filter(Boolean) } : {}),
    })),
    luc: Date.now(),
  };
  ghi(k);
}

/** Thêm một khoá vừa đăng nhập được (chắc chắn đang nằm trên máy này). */
export function themMaKhoa(uid: number | string, id: string) {
  if (!id) return;
  const k = doc();
  const u = k[String(uid)] || { ds: [], luc: 0 };
  if (!u.ds.some((m) => m.id === id)) u.ds.unshift({ id });
  k[String(uid)] = u;
  ghi(k);
}

/** Bỏ một khoá máy chủ báo đã tắt. */
export function boMaKhoa(id: string) {
  const k = doc();
  for (const u of Object.values(k)) u.ds = (u.ds || []).filter((m) => m.id !== id);
  ghi(k);
}

/** Mọi khoá còn dùng được (gộp các tài khoản từng đăng nhập trên máy này), rỗng = chưa biết. */
export function maKhoaCuaMay(): Ma[] {
  const thay = new Set<string>();
  const ra: Ma[] = [];
  for (const u of Object.values(doc())) for (const m of u?.ds || []) if (m?.id && !thay.has(m.id)) { thay.add(m.id); ra.push(m); }
  return ra;
}

/** Hỏi máy chủ danh sách khoá của người đang đăng nhập rồi cất lại. Lỗi thì im lặng (không ảnh hưởng gì khác). */
export async function dongBoMaKhoa(uid: number | string, epBuoc = false): Promise<void> {
  try {
    if (typeof window === 'undefined' || !(window as any).PublicKeyCredential) return;
    const u = doc()[String(uid)];
    if (!epBuoc && u && Date.now() - u.luc < HOI_LAI_MS) return;
    const r = await api<{ ds: { cred_id?: string; transports?: string | null }[]; uid?: number }>('/passkey/danh-sach');
    nhoMaKhoa(r.uid ?? uid, r.ds || []);
  } catch { /* chưa đăng nhập / mất mạng: lần sau hỏi lại */ }
}
