import { redirect } from 'next/navigation';

// Tính năng "AI đọc thông tin sổ" đã gỡ — chuyển hướng về trang Tra cứu QR.
export default function Page() {
  redirect('/qr');
}
