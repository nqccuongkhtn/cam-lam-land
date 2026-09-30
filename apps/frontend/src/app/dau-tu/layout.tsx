import type { Metadata } from 'next';

// Trang này là 'use client' nên không tự khai tiêu đề được → khai ở đây. Thiếu thì trang THỪA HƯỞNG
// canonical '/' của layout gốc = báo Google "đây là bản sao trang chủ" → Google bỏ qua (lỗi phát hiện 30/9/2026).
export const metadata: Metadata = {
  title: 'Đầu tư bất động sản Cam Lâm – cơ hội và dự án',
  description: 'Cơ hội đầu tư bất động sản Cam Lâm, Khánh Hòa: đô thị mới Cam Lâm, sân bay Cam Ranh, Bãi Dài, dự án nghỉ dưỡng; phân tích tiềm năng và kết nối nhà đầu tư.',
  alternates: { canonical: '/dau-tu' },
  openGraph: { title: 'Đầu tư bất động sản Cam Lâm – cơ hội và dự án | Cam Lâm Land', description: 'Cơ hội đầu tư bất động sản Cam Lâm, Khánh Hòa: đô thị mới Cam Lâm, sân bay Cam Ranh, Bãi Dài, dự án nghỉ dưỡng; phân tích tiềm năng và kết nối nhà đầu tư.', url: '/dau-tu' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
