import type { Metadata } from 'next';

// Trang này là 'use client' nên không tự khai tiêu đề được → khai ở đây. Thiếu thì trang THỪA HƯỞNG
// canonical '/' của layout gốc = báo Google "đây là bản sao trang chủ" → Google bỏ qua (lỗi phát hiện 30/9/2026).
export const metadata: Metadata = {
  title: 'Mua bán nhà đất Cam Lâm, Khánh Hòa – tin đăng mới nhất',
  description: 'Tin mua bán, cho thuê nhà đất Cam Lâm, Khánh Hòa cập nhật mỗi ngày: đất nền, đất thổ cư, nhà phố, đất ven biển Bãi Dài. Lọc theo xã, giá, diện tích, xem vị trí trên bản đồ quy hoạch.',
  alternates: { canonical: '/listings' },
  openGraph: { title: 'Mua bán nhà đất Cam Lâm, Khánh Hòa – tin đăng mới nhất | Cam Lâm Land', description: 'Tin mua bán, cho thuê nhà đất Cam Lâm, Khánh Hòa cập nhật mỗi ngày: đất nền, đất thổ cư, nhà phố, đất ven biển Bãi Dài. Lọc theo xã, giá, diện tích, xem vị trí trên bản đồ quy hoạch.', url: '/listings' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
