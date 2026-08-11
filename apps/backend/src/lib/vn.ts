// ĐÂY LÀ NƠI DUY NHẤT định nghĩa quy tắc bỏ dấu tiếng Việt của hệ thống.
// Hàm SQL vn_unaccent() bên migrate.ts được SINH TỰ ĐỘNG từ file này (xem vnTranslateTable
// ở dưới) nên hai bên KHÔNG THỂ lệch nhau nữa — sửa ở đây là SQL tự đổi theo.
// Quy tắc:
//  - lower()
//  - NFD tách dấu + xoá ký tự tổ hợp (U+0300–U+036F) => bỏ mọi dấu thanh/mũ/móc
//  - đ -> d
export function vnNoAccent(s: string): string {
  return (s == null ? '' : String(s))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/**
 * Sinh BẢNG ĐỔI CHỮ cho hàm translate() của Postgres, lấy thẳng từ vnNoAccent() ở trên.
 * Nhờ vậy hàm SQL và hàm JS luôn cho ra CÙNG một kết quả, không phải chép tay 2 nơi.
 *
 * Cách hoạt động: duyệt mọi chữ cái Latin có dấu, hỏi vnNoAccent() xem nó thành chữ gì.
 *  - Chữ liền dấu (vd 'ấ', 'Đ') → xếp cặp vào bảng đổi.
 *  - Dấu rời (U+0300–U+036F, gặp khi chữ được gõ kiểu TÁCH DẤU — hay có trong dữ liệu
 *    xuất từ CAD/QGIS/máy Mac) → xếp ở CUỐI chuỗi nguồn và KHÔNG có chữ tương ứng.
 *    Postgres quy định: phần dư của chuỗi nguồn sẽ bị XOÁ → giống hệt bước xoá dấu bên JS.
 * Cũng gồm cả CHỮ HOA có dấu, nên vẫn đúng kể cả khi lower() của Postgres
 * không xử lý được chữ ngoài bảng chữ cái tiếng Anh (tuỳ locale của database).
 */
export function vnTranslateTable(): { from: string; to: string } {
  let from = '', to = '';
  for (const [lo, hi] of [[0x00c0, 0x024f], [0x1e00, 0x1eff]]) {
    for (let cp = lo; cp <= hi; cp++) {
      const ch = String.fromCodePoint(cp);
      const folded = vnNoAccent(ch);
      if (folded === ch || folded.length !== 1) continue; // vốn đã không dấu, hoặc không đổi được 1-đổi-1
      from += ch; to += folded;
    }
  }
  for (let cp = 0x0300; cp <= 0x036f; cp++) from += String.fromCodePoint(cp); // dấu rời → bị xoá
  return { from, to };
}

// SĐT Việt Nam hợp lệ: 9–11 chữ số, bắt đầu bằng 0 (hoặc 84). Chặn lead rác kiểu "abc" / "123".
export function isValidPhone(s: string): boolean {
  const d = String(s || '').replace(/\D/g, '');
  return /^(0\d{8,10}|84\d{8,10})$/.test(d);
}

// Tách chuỗi tìm kiếm thành các token đã chuẩn hoá (bỏ token rỗng), giới hạn số token.
export function vnTokens(s: string, max = 6): string[] {
  return vnNoAccent(String(s || '').trim())
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max);
}
