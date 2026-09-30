import CanDangNhap from '@/components/CanDangNhap';

// Tiện ích — lớp bảo mật 1: phải đăng nhập mới dùng (xem components/CanDangNhap.tsx).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CanDangNhap ten="Hợp đồng đặt cọc">{children}</CanDangNhap>;
}
