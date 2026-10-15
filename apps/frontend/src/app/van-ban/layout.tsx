import CanDangNhap from '@/components/CanDangNhap';

// Tiện ích — lớp bảo mật 1: phải đăng nhập mới dùng (xem components/CanDangNhap.tsx).
// TRA CỨU VĂN BẢN LÀ TÍNH NĂNG TRẢ PHÍ (15/10/2026): tài khoản thường vẫn vào xem DANH SÁCH, nhưng số ký hiệu + ngày bị che (máy chủ che
// sẵn — routes/vanBan.ts cheVb) và làm mờ; bấm xem văn bản → hộp "tính năng trả phí" (HopTraPhi). Có quyền: admin · 'vanban' · GÓI CHỨC NĂNG CHUNG.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <CanDangNhap ten="Tra cứu văn bản">{children}</CanDangNhap>;
}
