// MÃ HOÁ CHUỖI BÍ MẬT TRƯỚC KHI LƯU VÀO DATABASE (AES-256-GCM).
// Dùng cho những thứ tuyệt đối không được để lộ dạng đọc được: khoá API của khách,
// mã bí mật Google Authenticator… Ai mở database ra xem cũng chỉ thấy chuỗi vô nghĩa.
//
// KHOÁ mở/khoá lấy từ biến môi trường `KEY_SECRET` (không có thì lùi về `JWT_SECRET`).
// ⚠️ ĐỔI hai biến này = MỌI thứ đã mã hoá trước đó KHÔNG giải ra được nữa. Trên máy chủ
// thật phải đặt cố định trong `.env`, đừng để trống.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const KHOA = createHash('sha256').update(String(process.env.KEY_SECRET || process.env.JWT_SECRET || 'camlam-danhmuc')).digest();

/** Mã hoá chuỗi → chuỗi base64 (đã gồm sẵn số ngẫu nhiên và dấu kiểm tra). */
export function maHoa(chuoi: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', KHOA, iv);
  const enc = Buffer.concat([c.update(chuoi, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

/** Giải mã. Sai khoá / dữ liệu hỏng → trả chuỗi rỗng chứ KHÔNG ném lỗi làm đổ cả trang. */
export function giaiMa(b64: string): string {
  try {
    const raw = Buffer.from(b64, 'base64');
    const d = createDecipheriv('aes-256-gcm', KHOA, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch { return ''; }
}

/**
 * Đọc chuỗi bí mật có thể đang ở 1 trong 2 dạng: ĐÃ MÃ HOÁ (bản mới) hoặc CHỮ TRẦN (bản lưu từ trước khi có mã hoá —
 * nhận ra nhờ tiền tố cố định, vd khoá Anthropic luôn bắt đầu bằng "sk-"). Nhờ vậy đổi sang lưu mã hoá không làm hỏng
 * khoá đang dùng. Giải mã hỏng (đổi KEY_SECRET/JWT_SECRET) → chuỗi rỗng = coi như chưa đặt khoá.
 */
export function moBiMat(s: unknown, tienToChuTran: string): string {
  const v = String(s ?? '');
  if (!v) return '';
  return v.startsWith(tienToChuTran) ? v : giaiMa(v);
}
