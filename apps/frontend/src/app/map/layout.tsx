import type { Metadata } from 'next';

// Trang này là 'use client' nên không tự khai tiêu đề được → khai ở đây. Thiếu thì trang THỪA HƯỞNG
// canonical '/' của layout gốc = báo Google "đây là bản sao trang chủ" → Google bỏ qua (lỗi phát hiện 30/9/2026).
export const metadata: Metadata = {
  title: 'Bản đồ quy hoạch Cam Lâm – tra cứu thửa đất, số tờ số thửa',
  description: 'Bản đồ quy hoạch Cam Lâm, Khánh Hòa: tra cứu thửa đất theo số tờ, số thửa, xem loại đất quy hoạch và diện tích từng loại, ranh thửa địa chính toàn tỉnh.',
  alternates: { canonical: '/map' },
  openGraph: { title: 'Bản đồ quy hoạch Cam Lâm – tra cứu thửa đất, số tờ số thửa | Cam Lâm Land', description: 'Bản đồ quy hoạch Cam Lâm, Khánh Hòa: tra cứu thửa đất theo số tờ, số thửa, xem loại đất quy hoạch và diện tích từng loại, ranh thửa địa chính toàn tỉnh.', url: '/map' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
