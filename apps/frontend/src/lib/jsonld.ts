// Nhúng dữ liệu JSON-LD (dữ liệu cho Google hiểu trang) vào thẻ <script> cho AN TOÀN.
//
// VÌ SAO CẦN HÀM NÀY: JSON.stringify giữ nguyên chuỗi "</script>" nếu nó nằm trong dữ liệu.
// Mà tiêu đề/mô tả tin đăng là do NGƯỜI DÙNG tự gõ. Chỉ cần một người đăng tin đặt tiêu đề kiểu
//     Bán đất </script><script>...mã độc...</script>
// là trình duyệt của MỌI khách xem tin đó sẽ chạy mã của kẻ xấu (đánh cắp phiên đăng nhập,
// chuyển hướng sang trang lừa đảo…). Đây là lỗi kinh điển tên "stored XSS".
//
// Cách chặn: đổi các ký tự nguy hiểm thành dạng \u… — trình duyệt đọc JSON vẫn ra ĐÚNG chữ cũ,
// nhưng không còn ký tự nào đóng được thẻ script nữa.
export function ldJson(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')       // chặn </script> và <!--
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')  // hai ký tự xuống dòng lạ này làm hỏng cú pháp JS
    .replace(/\u2029/g, '\\u2029');
}
