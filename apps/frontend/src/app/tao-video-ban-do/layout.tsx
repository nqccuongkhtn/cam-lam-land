import CanDangNhap from '@/components/CanDangNhap';
import type { Metadata } from 'next';

// SEO (13/10/2026): trang công cụ chỉ hiện ô đăng nhập với Google → KHÔNG cho xếp hạng (noindex), tiêu đề + đường dẫn chuẩn của
// riêng nó (thiếu thì thừa hưởng canonical '/' của layout gốc = Google coi là bản sao trang chủ). Trang giới thiệu công khai để
// Google xếp hạng là /cong-cu/tao-video-ban-do-ve-tinh (lib/congCu.ts).
export const metadata: Metadata = { title: 'Tạo video bản đồ', alternates: { canonical: '/tao-video-ban-do' }, robots: { index: false, follow: true } };

// Tiện ích — lớp bảo mật 1: phải đăng nhập mới dùng (xem components/CanDangNhap.tsx).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CanDangNhap ten="Tạo video bản đồ">{children}</CanDangNhap>;
}
