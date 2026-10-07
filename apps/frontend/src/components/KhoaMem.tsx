'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';
import QuangCaoDichVu from '@/components/QuangCaoDichVu';

/**
 * "KHOÁ MỀM" cho trang BÀI ĐỌC của Tiện ích (cẩm nang, bảng giá đất, giá đất, đền bù) — 30/9/2026.
 * Chủ dự án muốn: vẫn khoá với người chưa đăng nhập, nhưng Google vẫn tìm thấy để kéo khách.
 *
 * Cách làm (Google cho phép, gọi là "nội dung trả phí / cần đăng ký" — báo chí dùng y hệt):
 *   · Toàn bộ bài VẪN nằm trong trang → Google đọc và xếp hạng được.
 *   · Người chưa đăng nhập chỉ thấy PHẦN ĐẦU, phía dưới mờ dần + ô "Đăng nhập miễn phí để xem tiếp".
 *   · Khai với Google bằng dữ liệu cấu trúc isAccessibleForFree=false trỏ vào lớp `.cl-noi-dung-khoa`
 *     (lib/ldKhoaMem.ts). KHÔNG có khai báo này, Google có thể coi là "che giấu nội dung" và phạt.
 * Người đã đăng nhập xem đầy đủ như thường. Ô mời đăng nhập cũng là chỗ thu thập khách (bán hàng).
 */
export default function KhoaMem({ ten, caoXem = 1100, children }: { ten: string; caoXem?: number; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { openLogin } = useLoginGate();
  const mo = !!user;
  const quangCaoRef = useRef<HTMLDivElement>(null);

  /* MỞ THẲNG PHẦN "DỊCH VỤ PHÁP LÝ" (chủ dự án 7/10/2026): bấm "Dịch vụ pháp lý" ở trang chủ phải có cảm giác MỞ HẲN
     MỘT TRANG DỊCH VỤ — không được thấy trang cẩm nang hiện ra rồi trôi xuống. Thực chất vẫn là /cam-nang:
     · liên kết dùng ?toi=dich-vu-phap-ly (vẫn nhận cả #dich-vu-phap-ly kiểu cũ);
     · ẨN cả trang ngay trước lần vẽ đầu (useLayoutEffect), chờ biết đăng nhập hay chưa + khối dịch vụ có mặt,
       NHẢY THẲNG tới đó (behavior 'instant' — thắng cả CSS scroll-behavior:smooth) rồi mới hiện trang;
     · ảnh phía trên tải xong làm trang dài ra → giữ khối dịch vụ đứng yên ở đầu màn hình thêm ~2 giây,
       trừ khi khách tự lướt (lướt lên mới thấy nội dung cẩm nang).
     Đã đăng nhập → khối dịch vụ trong bài (#dich-vu-phap-ly). Chưa đăng nhập → khối đó nằm trong phần bị khoá,
     nên tới bản quảng cáo dịch vụ hiện rõ bên dưới. */
  const muonToi = () => typeof window !== 'undefined'
    && (window.location.hash === '#dich-vu-phap-ly' || new URLSearchParams(window.location.search).get('toi') === 'dich-vu-phap-ly');
  useLayoutEffect(() => { if (muonToi()) document.documentElement.style.visibility = 'hidden'; }, []);
  useEffect(() => {
    if (!muonToi() || loading) return;
    const html = document.documentElement;
    const tim = (): HTMLElement | null => (mo ? document.getElementById('dich-vu-phap-ly') : quangCaoRef.current);
    const nhay = (el: HTMLElement) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'instant' as ScrollBehavior });
    let lan = 0, giu: ResizeObserver | null = null, khachLuot = false;
    const thoiGiu = () => { khachLuot = true; };
    const t = setInterval(() => {
      const el = tim();
      if (!el && ++lan < 60) return;                       // chờ tối đa ~3 giây cho khối dịch vụ có mặt
      clearInterval(t);
      if (el) {
        nhay(el);
        giu = new ResizeObserver(() => { if (!khachLuot) nhay(el); });
        giu.observe(document.body);
        ['wheel', 'touchstart', 'keydown'].forEach((s) => window.addEventListener(s, thoiGiu, { once: true, passive: true }));
        setTimeout(() => giu?.disconnect(), 2000);
      }
      html.style.visibility = '';
    }, 50);
    return () => { clearInterval(t); giu?.disconnect(); html.style.visibility = ''; };
  }, [mo, loading]);
  return (
    <div className="relative">
      <div className="cl-noi-dung-khoa relative" style={mo ? undefined : { maxHeight: caoXem, overflow: 'hidden' }}>
        {children}
        {!mo && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-white/0 via-white/80 to-white" />}
      </div>
      {!mo && (
        <div className="relative z-10 mx-auto -mt-6 mb-10 w-full max-w-md px-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-md">
            <div className="text-[15px] font-bold text-[#0A2540]">Đăng nhập miễn phí để xem tiếp {ten}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">Thành viên Cam Lâm Land được xem đầy đủ cẩm nang, bảng giá, công cụ tính và nhận tin nhà đất mới mỗi ngày.</p>
            <button onClick={() => openLogin({ reason: `Đăng nhập để xem đầy đủ ${ten}.` })}
              className="mt-3 h-11 w-full rounded-lg bg-[#0A2540] text-[14px] font-bold text-white active:scale-[.98]">Đăng nhập</button>
            <Link href="/register" className="mt-2 block text-[13px] font-semibold text-[#C8A14B]">Chưa có tài khoản? Đăng ký 30 giây</Link>
          </div>
        </div>
      )}
      {/* Khối quảng cáo cuối bài bị cắt cùng phần khoá → hiện một bản ở đây cho khách chưa đăng nhập
          (chủ dự án 30/9/2026). Bản trong bài vẫn giữ mốc #dich-vu-phap-ly nên bản này không gắn mốc. */}
      {!mo && <div ref={quangCaoRef} className="scroll-mt-24"><QuangCaoDichVu moc={false} /></div>}
    </div>
  );
}

