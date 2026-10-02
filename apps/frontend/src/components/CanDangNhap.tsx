'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';
import Link from 'next/link';
import QuangCaoDichVu from '@/components/QuangCaoDichVu';

/**
 * LỚP BẢO MẬT 1 CỦA TIỆN ÍCH (chủ dự án 30/9/2026): công cụ nào cũng phải ĐĂNG NHẬP mới dùng được.
 * Lớp 2 (công cụ nội bộ cần được cấp quyền: danh sách nóng, mã xác thực, tra cứu luật) vẫn giữ như cũ
 * trong từng trang + ở máy chủ — cái này chỉ chặn người CHƯA đăng nhập.
 *
 * Bọc trong layout.tsx của từng công cụ → mở thẳng đường dẫn (/pdf, /qr…) hay mở trong khung Tiện ích
 * đều bị chặn như nhau. Chưa đăng nhập thì KHÔNG dựng công cụ chút nào (không tải dữ liệu, không chạy mã).
 */
// trongKhung: đang nằm trong khung /tien-ich (HubShell) → tự CUỘN BÊN TRONG khung, không đẩy cả trang cuộn theo
// (lỗi 30/9/2026: quảng cáo dài hơn khung làm cả trang trôi, ô đăng nhập mất khỏi màn hình, đáy hở khoảng xám).
export default function CanDangNhap({ ten, trongKhung = false, children }: { ten?: string; trongKhung?: boolean; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { openLogin } = useLoginGate();
  const daHoi = useRef(false);
  const lyDo = `Đăng nhập để dùng ${ten ? `tiện ích ${ten}` : 'tiện ích này'} — miễn phí, chỉ mất vài giây.`;

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
    <div className={trongKhung ? 'absolute inset-0 overflow-y-auto overscroll-contain' : ''}>
    {/* Ô mời đăng nhập = MẪU 32 chủ dự án chọn 30/9/2026 (thay mẫu 16): thẻ nền trắng VIỀN ĐỎ 2px, ô khoá đỏ
        (ruy băng "MIỄN PHÍ" ở góc đã bỏ theo ý chủ dự án 30/9/2026) · "… cần đăng nhập" · nút đỏ trên một hàng.
        DÍNH TRÊN ĐẦU khi kéo (sticky) để lúc nào cũng thấy — chủ dự án 30/9/2026. Vì dính nên điện thoại
        cũng để MỘT HÀNG NGANG gọn (xếp dọc cao ~190px sẽ che mất gần 1/3 màn hình). */}
    <div className="sticky top-0 z-30 mx-auto max-w-7xl bg-white/95 px-3 pb-2 pt-3 backdrop-blur sm:px-6 sm:pt-4">
      {/* Hiệu ứng CHỚP NHẸ thu hút ánh nhìn (chủ dự án 30/9/2026): viền đỏ toả sáng nhẹ theo nhịp (cl-chop-vien)
          + vệt sáng lướt qua nút Đăng nhập (cl-shine, dùng chung với quảng cáo tin tức). Tắt khi máy bật "giảm chuyển động". */}
      {/* ĐIỆN THOẠI = MẪU 4 chủ dự án chọn 2/10/2026 (ô D): dải báo nhẹ nền hồng, KHÔNG có nút đỏ trong ô (trùng
          với nút Đăng nhập trên menu, đứng sát nhau nhìn rối). Chữ "Đăng nhập" trong câu vẫn bấm được. */}
      <div className="cl-chop-vien rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 sm:hidden">
        <p className="text-[13px] font-extrabold leading-snug text-[#d42a2a]">🔒 {ten ? `Tiện ích ${ten}` : 'Tiện ích này'} cần đăng nhập</p>
        <p className="mt-1 text-[12px] leading-snug text-slate-600">
          Đã có tài khoản thì bấm <button type="button" onClick={() => openLogin({ reason: lyDo })} className="font-bold text-[#0A2540] underline underline-offset-2">Đăng nhập</button> ở trên.
          {' '}Chưa có? <Link href="/register" className="font-bold text-[#d42a2a] underline underline-offset-2">Đăng ký miễn phí</Link>
        </p>
      </div>
      {/* MÁY TÍNH: giữ thẻ viền đỏ có nút Đăng nhập (hai nút ở xa nhau nên không rối); bấm vào đâu trong ô cũng mở đăng nhập. */}
      <div role="button" tabIndex={0} aria-label={`Đăng nhập để dùng ${ten ? `tiện ích ${ten}` : 'tiện ích này'}`}
        onClick={() => openLogin({ reason: lyDo })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLogin({ reason: lyDo }); } }}
        className="cl-chop-vien relative hidden cursor-pointer overflow-hidden rounded-lg border-2 border-[#d42a2a] bg-white px-4 py-3.5 sm:block">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-[#d42a2a] text-white sm:h-11 sm:w-11 sm:rounded-[10px]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10.5" rx="2.2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[13.5px] font-extrabold leading-snug text-[#d42a2a] sm:text-[15px]">{ten ? `Tiện ích ${ten}` : 'Tiện ích này'} cần đăng nhập</h1>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-600 sm:text-[12.5px]">Tài khoản miễn phí — đăng ký chỉ mất 30 giây.</p>
          </div>
          {/* Máy tính: nút đỏ (chỉ để nhìn — bấm vào đâu trong ô cũng mở đăng nhập). */}
          <span className="relative hidden h-[38px] shrink-0 items-center overflow-hidden rounded-md bg-[#d42a2a] px-[18px] text-[13px] font-bold text-white sm:inline-flex">
            <span aria-hidden className="cl-shine pointer-events-none absolute bottom-0 top-0 w-1/3 bg-white/45 blur-[3px]" />
            <span className="relative">Đăng nhập</span>
          </span>
        </div>
      </div>
    </div>
    {/* Quảng cáo dịch vụ VẪN HIỆN khi chưa đăng nhập (chủ dự án 30/9/2026). */}
    <QuangCaoDichVu />
    </div>
  );
}
