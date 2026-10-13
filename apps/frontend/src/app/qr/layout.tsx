import CanDangNhap from '@/components/CanDangNhap';
import type { Metadata } from 'next';

// SEO (13/10/2026): trang công cụ chỉ hiện ô đăng nhập với Google → KHÔNG cho xếp hạng (noindex), tiêu đề + đường dẫn chuẩn của
// riêng nó (thiếu thì thừa hưởng canonical '/' của layout gốc = Google coi là bản sao trang chủ). Trang giới thiệu công khai để
// Google xếp hạng là /cong-cu/tra-cuu-qr-so-do (lib/congCu.ts).
export const metadata: Metadata = { title: 'Tra cứu QR sổ đỏ', alternates: { canonical: '/qr' }, robots: { index: false, follow: true } };

// Tiện ích — lớp bảo mật 1: phải đăng nhập mới dùng (xem components/CanDangNhap.tsx).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CanDangNhap ten="Tra cứu QR sổ đỏ">{children}</CanDangNhap>;
}
