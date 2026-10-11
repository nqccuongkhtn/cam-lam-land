// ── NHẬN DIỆN LOẠI TỆP BẰNG CHỮ KÝ NHỊ PHÂN (dùng chung cho kho ảnh /api/images và tệp chat) ──
// ⚠️ KHÔNG tin `mimetype` trình duyệt gửi lên: kẻ xấu tự khai được. Khai "image/svg+xml" rồi gửi một tệp SVG chứa
//    mã <script> → máy chủ trả lại đúng loại đó trên CÙNG TÊN MIỀN của web → ai mở tệp là mã chạy, lấy được thẻ
//    đăng nhập (kể cả của admin). Nên đọc vài byte đầu của tệp (mỗi định dạng có "chữ ký" cố định) và CHỈ nhận
//    đúng 5 loại dưới đây — đủ cho ảnh tin đăng, ảnh giấy tờ chụp bằng điện thoại và công văn PDF.
// (Tách ra từ routes/images.ts ngày 11/10/2026 để tệp gửi trong chat cũng được kiểm y hệt.)

/** Loại THẬT của tệp theo vài byte đầu; null = không phải 1 trong 5 loại được nhận. */
export function loaiThat(b: Buffer | undefined | null): string | null {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';                                   // FF D8 FF
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';                   // .PNG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';                   // GIF8
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';   // RIFF....WEBP
  if (b.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf';                                       // %PDF-
  return null;
}

export const LOAI_DUOC_PHEP = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);

/**
 * Đặt tiêu đề loại tệp AN TOÀN khi trả tệp người dùng tải lên: trình duyệt KHÔNG được tự đoán loại khác (nosniff);
 * loại lạ còn sót trong database từ trước (vd SVG) thì trả dạng TẢI VỀ chứ không hiển thị trên tên miền của web.
 */
export function datLoaiAnToan(res: any, mime: string | null | undefined, macDinh: string): void {
  const m = mime || macDinh;
  res.set('X-Content-Type-Options', 'nosniff');
  if (LOAI_DUOC_PHEP.has(m)) { res.set('Content-Type', m); return; }
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', 'attachment');
}
