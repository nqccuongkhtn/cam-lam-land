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

// Tách chuỗi tìm kiếm thành các token đã chuẩn hoá (bỏ token rỗng), giới hạn số token.
export function vnTokens(s: string, max = 6): string[] {
  return vnNoAccent(String(s || '').trim())
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max);
}
