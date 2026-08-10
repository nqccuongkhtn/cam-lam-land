// Chuẩn hoá tiếng Việt để tìm kiếm không dấu, không phân biệt hoa/thường.
// Phải KHỚP CHÍNH XÁC với hàm SQL vn_unaccent() trong migrate.ts.
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
