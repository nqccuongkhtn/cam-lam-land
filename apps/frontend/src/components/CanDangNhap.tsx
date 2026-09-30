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
    {/* Ô mời đăng nhập = MẪU 32 chủ dự án chọn 30/9/2026 (thay mẫu 16): thẻ nền trắng VIỀN ĐỎ 2px, ruy băng
        "MIỄN PHÍ" xanh đậm chéo ở góc phải, ô khoá đỏ · tiêu đề "Mở khoá …" · nút đỏ trên một hàng.
        Điện thoại: xếp dọc căn giữa, nút rộng hết ô. */}
    <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
      <div className="relative overflow-hidden rounded-lg border-2 border-[#d42a2a] bg-white px-4 pb-3.5 pt-4">
        <span className="absolute -right-[30px] top-2.5 rotate-[35deg] bg-[#0A2540] px-[34px] py-[3px] text-[10px] font-extrabold tracking-[.08em] text-white">MIỄN PHÍ</span>
        <div className="flex flex-col items-stretch gap-2.5 pt-1.5 text-center sm:flex-row sm:items-center sm:gap-3.5 sm:pr-10 sm:pt-0 sm:text-left">
          <div className="mx-auto grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-[#d42a2a] text-white sm:mx-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10.5" rx="2.2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-extrabold leading-snug text-[#d42a2a]">Mở khoá {ten || 'tiện ích'}</h1>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">Đăng nhập để dùng toàn bộ tiện ích. Chưa có tài khoản thì đăng ký miễn phí trước, rồi đăng nhập.</p>
          </div>
          <button onClick={() => openLogin({ reason: lyDo })}
            className="h-[38px] shrink-0 rounded-md bg-[#d42a2a] px-[18px] text-[13px] font-bold text-white active:scale-[.98]">Đăng nhập</button>
        </div>
      </div>
    </div>
    {/* Quảng cáo dịch vụ VẪN HIỆN khi chưa đăng nhập (chủ dự án 30/9/2026). */}
    <QuangCaoDichVu />
    </div>
  );
}
