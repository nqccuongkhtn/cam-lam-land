'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';

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
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-2xl">🔒</div>
        <h1 className="text-[16px] font-bold text-[#0A2540]">{ten || 'Tiện ích'} cần đăng nhập</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">Các công cụ tiện ích chỉ dành cho thành viên. Đăng nhập hoặc tạo tài khoản miễn phí để tiếp tục.</p>
        <button onClick={() => openLogin({ reason: lyDo })}
          className="mt-4 h-11 w-full rounded-lg bg-[#0A2540] text-[14px] font-bold text-white active:scale-[.98]">Đăng nhập</button>
      </div>
    </div>
  );
}
