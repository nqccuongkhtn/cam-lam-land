// ============================================================================
// TRANG ĐÍCH CÔNG CỤ /cong-cu/<slug> (13/10/2026) — chủ dự án: "trang đích riêng cho từng công cụ, mỗi trang nhắm một cụm từ khoá"
// (học từ qhviet.com). Phần lớn công cụ phải đăng nhập (layout.tsx bọc CanDangNhap) nên Google chỉ thấy ô mời đăng nhập → mỗi công
// cụ có thêm một trang CÔNG KHAI: giới thiệu, làm được gì, cách dùng, hỏi đáp + nút mở công cụ. Nội dung ở src/data/congCu.json,
// soạn từ chính mã nguồn từng công cụ (không ghi tính năng không có). Thêm công cụ mới → thêm một mục vào file đó là đủ.
// ============================================================================
import ds from '@/data/congCu.json';

export interface CongCu {
  key: string; slug: string; href: string; canDangNhap: boolean; tuKhoa: string[];
  title: string; description: string; h1: string; ten: string; gioiThieu: string;
  tinhNang: string[]; cacBuoc: string[]; hoiDap: { q: string; a: string }[]; luuY?: string;
}
export const CONG_CU = ds as CongCu[];
export const CONG_CU_THEO_SLUG = new Map(CONG_CU.map((c) => [c.slug, c]));

/** Công cụ CHẠY NGAY trên trang (không qua /cong-cu) — vẫn liệt kê ở trang tổng + mục "công cụ khác". */
export const CONG_CU_RIENG = [
  { href: '/chuyen-doi-toa-do-vn2000', ten: 'Chuyển tọa độ VN-2000 ↔ WGS84', moTa: 'Đổi tọa độ sổ đỏ sang Google Maps, tính diện tích — không cần đăng nhập' },
  { href: '/ban-do', ten: 'Bản đồ 65 xã, phường Khánh Hòa', moTa: 'Xã mới gồm những xã cũ nào, số tờ bản đồ mới ↔ cũ' },
];
