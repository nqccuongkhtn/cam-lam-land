import type { Metadata } from 'next';

// Trang này là 'use client' nên không tự khai tiêu đề được → khai ở đây. Thiếu thì trang THỪA HƯỞNG
// canonical '/' của layout gốc = báo Google "đây là bản sao trang chủ" → Google bỏ qua (lỗi phát hiện 30/9/2026).
export const metadata: Metadata = {
  title: 'Dịch vụ đăng tin & quảng cáo nhà đất Cam Lâm',
  description: 'Bảng giá gói đăng tin, đẩy tin VIP và các dịch vụ hỗ trợ mua bán nhà đất tại Cam Lâm Land.',
  alternates: { canonical: '/dichvu' },
  openGraph: { title: 'Dịch vụ đăng tin & quảng cáo nhà đất Cam Lâm | Cam Lâm Land', description: 'Bảng giá gói đăng tin, đẩy tin VIP và các dịch vụ hỗ trợ mua bán nhà đất tại Cam Lâm Land.', url: '/dichvu' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
