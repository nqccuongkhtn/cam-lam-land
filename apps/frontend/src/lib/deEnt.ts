// Làm sạch chữ văn bản (số hiệu, trích yếu, cơ quan) lấy từ nguồn nhà nước trước khi hiện ra:
// bỏ chuỗi ảnh nhúng "data:...", lột thẻ HTML, giải mã chữ HTML (&#253; → ý, &#xFD; → ý, &aacute; → á),
// gộp khoảng trắng thừa. Dùng chung cho trang chủ (khối "Văn bản mới nhất") và trang /van-ban.
// Giải mã lặp tối đa 3 lượt vì có nguồn mã hoá HAI LẦN ("&amp;#253;").
// Chữ trả về được React hiện dạng CHỮ THƯỜNG (tự chặn mã độc) nên giải mã ở đây không có rủi ro.
import { decodeEntities } from './htmlEntities';

export function deEnt(s?: string | null): string {
  let t = String(s || '')
    .replace(/data:[^\s"'<>]+/gi, ' ')                 // xoá chuỗi data:image;base64,... (mã QR nhúng)
    .replace(/<[^>]*>/g, ' ').replace(/[<>]/g, ' ');   // lột thẻ HTML + ký tự lẻ
  for (let i = 0; i < 3 && t.includes('&'); i++) {
    const truoc = t;
    t = decodeEntities(t);
    if (t === truoc) break;
  }
  return t.normalize('NFC').replace(/\s+/g, ' ').trim();   // NFC: gộp chữ "tách dấu" về chữ liền dấu
}
