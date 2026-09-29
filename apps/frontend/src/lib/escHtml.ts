// Lọc ký tự nguy hiểm trước khi chèn CHỮ DO NGƯỜI DÙNG GÕ (tiêu đề tin, tên…) vào một đoạn HTML.
// ⚠️ Bắt buộc dùng ở mọi chỗ ghép chữ người dùng vào `popupHtml` của MapView (MapLibre gọi
//    setHTML = chèn thẳng vào innerHTML). Thiếu nó thì một tin có tiêu đề kiểu
//    `<img src=x onerror=…>` sẽ chạy mã trên máy người xem và lấy được thẻ đăng nhập
//    (rà soát bảo mật 29/9/2026 bắt ở trang /listings và trang chi tiết tin).
export const escHtml = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
