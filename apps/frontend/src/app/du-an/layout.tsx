import type { Metadata } from 'next';

// Trang 'use client' nên khai tiêu đề ở đây. Phải có canonical riêng, không thì thừa hưởng '/' của layout gốc
// = báo Google "đây là bản sao trang chủ" (xem CLAUDE.md mục Tối ưu Google).
export const metadata: Metadata = {
  title: 'Dự án bất động sản Cam Lâm, Khánh Hòa',
  description: 'Danh sách dự án đất nền, nghỉ dưỡng, khu đô thị tại Cam Lâm – Khánh Hòa: Golden Bay, Bãi Dài, khu đô thị mới Cam Lâm… Lọc theo tình trạng mở bán và loại dự án.',
  alternates: { canonical: '/du-an' },
  openGraph: { title: 'Dự án bất động sản Cam Lâm | Cam Lâm Land', url: '/du-an' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
