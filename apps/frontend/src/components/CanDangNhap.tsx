'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';
import QuangCaoDichVu from '@/components/QuangCaoDichVu';

/**
 * LỚP BẢO MẬT 1 CỦA TIỆN ÍCH (chủ dự án 30/9/2026): công cụ nào cũng phải ĐĂNG NHẬP mới dùng được.
 * Lớp 2 (công cụ nội bộ cần được cấp quyền: danh sách nóng, mã xác thực, tra cứu luật) vẫn giữ như cũ
 * trong từng trang + ở máy chủ — cái này chỉ chặn người CHƯA đăng nhập.
 *
 * Bọc trong layout.tsx của từng công cụ → mở thẳng đường dẫn (/pdf, /qr…) hay mở trong khung Tiện ích
 * đều bị chặn như nhau. Chưa đăng nhập thì KHÔNG dựng công cụ chút nào (không tải dữ liệu, không chạy mã).
 */
export default function CanDangNhap({ ten, children }: { ten?: string; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { openLogin } = useLoginGate();
  const daHoi = useRef(false);
  const lyDo = `Đăng nhập để dùng ${ten ? `"${ten}"` : 'tiện ích này'} — miễn phí, chỉ mất vài giây.`;

  // Tự bật cửa sổ đăng nhập MỘT lần (chờ tải xong tài khoản, không thì người đã đăng nhập cũng bị bật lên trong tích tắc).
  useEffect(() => {
    if (loading || user || daHoi.current) return;
    daHoi.current = true;
    openLogin({ reason: lyDo });
  }, [loading, user, openLogin, lyDo]);

  if (user) return <>{children}</>;
  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#0A2540]" />
      </div>
    );
  }
  // h-full + tự cuộn: trong khung /tien-ich chỗ này có chiều cao cố định, thêm khối quảng cáo là phải cuộn được.
  return (
    <div className="h-full overflow-y-auto">
    {/* Ô mời đăng nhập = MẪU 16 chủ dự án chọn 30/9/2026 (trang xem thử 40 mẫu): khối CĂN GIỮA nền xanh nhạt,
        khoá to trong vòng tròn xanh đậm có viền trắng, tiêu đề xanh đậm, 2 nút cạnh nhau (điện thoại xếp dọc).
        Gọn chiều cao để khối "Dịch vụ của chúng tôi" nối ngay bên dưới. */}
    <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
      <div className="flex flex-col items-center gap-2 rounded-lg bg-[#eef3f9] px-4 py-5 text-center">
        <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[#0A2540] text-white shadow-[0_0_0_6px_rgba(255,255,255,.8)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10.5" rx="2.2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
        </div>
        <h1 className="mt-1 text-[17px] font-extrabold leading-snug text-[#0A2540]">{ten || 'Tiện ích'} cần đăng nhập</h1>
        <p className="text-[13px] leading-relaxed text-slate-600">Tài khoản miễn phí — đăng ký chỉ mất 30 giây.</p>
        <div className="mt-1 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button onClick={() => openLogin({ reason: lyDo })}
            className="h-10 rounded-md bg-[#0A2540] px-5 text-[13.5px] font-bold text-white active:scale-[.98]">Đăng nhập</button>
          <Link href="/register" target="_top"
            className="grid h-10 place-items-center rounded-md border-[1.5px] border-[#0A2540] px-5 text-[13.5px] font-bold text-[#0A2540] active:scale-[.98]">Tạo tài khoản</Link>
        </div>
      </div>
    </div>
    {/* Quảng cáo dịch vụ VẪN HIỆN khi chưa đăng nhập (chủ dự án 30/9/2026). */}
    <QuangCaoDichVu />
    </div>
  );
}
