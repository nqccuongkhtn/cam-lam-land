import type { Metadata } from 'next';

// Trang này là 'use client' nên không tự khai tiêu đề được → khai ở đây. Thiếu thì trang THỪA HƯỞNG
// canonical '/' của layout gốc = báo Google "đây là bản sao trang chủ" → Google bỏ qua (lỗi phát hiện 30/9/2026).
export const metadata: Metadata = {
  title: 'Tin tức bất động sản Cam Lâm, Khánh Hòa',
  description: 'Tin thị trường nhà đất, quy hoạch, hạ tầng và dự án tại Cam Lâm – Khánh Hòa: đô thị sân bay Cam Ranh, Bãi Dài, cao tốc, sáp nhập xã. Cập nhật hằng ngày.',
  alternates: { canonical: '/tin-tuc' },
  openGraph: { title: 'Tin tức bất động sản Cam Lâm, Khánh Hòa | Cam Lâm Land', description: 'Tin thị trường nhà đất, quy hoạch, hạ tầng và dự án tại Cam Lâm – Khánh Hòa: đô thị sân bay Cam Ranh, Bãi Dài, cao tốc, sáp nhập xã. Cập nhật hằng ngày.', url: '/tin-tuc' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
