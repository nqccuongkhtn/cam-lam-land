'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';

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
  const { user } = useAuth();
  const { openLogin } = useLoginGate();
  const mo = !!user;
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
    </div>
  );
}

