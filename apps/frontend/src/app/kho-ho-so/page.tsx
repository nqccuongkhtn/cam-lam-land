'use client';
// KHO DANH MỤC HỒ SƠ đã dọn vào trang "Lập danh mục hồ sơ" — nằm ở tab thứ hai.
// Giữ lại đường /kho-ho-so cho các đường dẫn cũ và tài liệu hướng dẫn đã phát ra.
// Chuyển hướng bằng trình duyệt (không dùng redirect() phía máy chủ) vì trang này được
// dựng sẵn rồi đem đi cache — qua nginx thì phần chỉ dẫn đích đến bị cắt mất, bấm vào đứng im.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KhoHoSoChuyenHuong() {
  const router = useRouter();
  useEffect(() => { router.replace('/lap-danh-muc?tab=kho'); }, [router]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="text-sm text-slate-500">Kho danh mục hồ sơ đã chuyển vào trang <b>Lập danh mục hồ sơ</b>. Đang đưa bạn sang…</p>
      <a href="/lap-danh-muc?tab=kho" className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: '#0B4045' }}>Bấm vào đây nếu chờ lâu</a>
    </main>
  );
}
