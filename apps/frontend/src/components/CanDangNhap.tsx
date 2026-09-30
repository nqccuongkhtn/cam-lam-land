'use client';
import { useEffect, useRef } from 'react';
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
    {/* Ô mời đăng nhập GỌN một dải ngang ở trên (chủ dự án 30/9/2026: ô cao 60% màn hình đẩy quảng cáo
        "tuột xuống quá"). Máy tính: biểu tượng · chữ · nút trên một hàng; điện thoại: xếp dọc. */}
    <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm sm:flex-row sm:gap-4 sm:p-5 sm:text-left">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-xl">🔒</div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-bold text-[#0A2540]">{ten || 'Tiện ích'} cần đăng nhập</h1>
          <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">Các công cụ tiện ích chỉ dành cho thành viên. Đăng nhập hoặc tạo tài khoản miễn phí để tiếp tục.</p>
        </div>
        <button onClick={() => openLogin({ reason: lyDo })}
          className="h-10 w-full shrink-0 rounded-lg bg-[#0A2540] px-6 text-[14px] font-bold text-white active:scale-[.98] sm:w-auto">Đăng nhập</button>
      </div>
    </div>
    {/* Quảng cáo dịch vụ VẪN HIỆN khi chưa đăng nhập (chủ dự án 30/9/2026). */}
    <QuangCaoDichVu />
    </div>
  );
}
