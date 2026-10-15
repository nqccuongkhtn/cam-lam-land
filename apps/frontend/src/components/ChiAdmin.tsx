'use client';
import { useAuth, laAdmin, coVaiTro } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';

/**
 * TIỆN ÍCH TẠM CHỈ ADMIN MỞ (15/10/2026, chủ dự án: "tính năng giá đền bù hiện chỉ cho tài khoản admin mở dùng nhé!").
 * Bọc trong layout.tsx của tiện ích (như CanDangNhap). Không phải admin thì KHÔNG dựng tiện ích (không tải dữ liệu, không chạy mã),
 * chỉ hiện khung khoá "liên hệ admin" — chữ KHÔNG nói tiện ích dành cho tài khoản nào (chủ dự án: "liên hệ admin chứ đừng nói tài
 * khoản nào được xem"). Chưa đăng nhập thì có thêm nút Đăng nhập. Mở lại cho mọi người: đổi layout.tsx về như cũ.
 * ⚠️ Chặn ở GIAO DIỆN: mã + dữ liệu tĩnh của trang vẫn là tệp công khai — dữ liệu thật sự cần giấu phải để sau API có kiểm quyền.
 * TÍNH NĂNG TRẢ PHÍ (15/10/2026): `vaiTro` = vai trò được dùng ngoài admin (vd 'tracuuvb', 'denbu' — admin tích cho khách đã trả phí ở trang
 * quản trị); `traPhi` = khung khoá ghi "tính năng trả phí — liên hệ admin để đăng ký".
 */
export default function ChiAdmin({ ten, vaiTro = [], traPhi = false, children }: { ten: string; vaiTro?: string[]; traPhi?: boolean; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { openLogin } = useLoginGate();
  if (laAdmin(user as any) || (vaiTro.length > 0 && coVaiTro(user as any, ...vaiTro))) return <>{children}</>;
  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#0A2540]" />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[15px] font-bold text-[#0A2540]">🔒 Tiện ích {ten}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{traPhi ? 'Đây là tính năng trả phí — vui lòng liên hệ admin Cam Lâm Land để đăng ký dùng.' : 'Vui lòng liên hệ admin Cam Lâm Land để được dùng tiện ích này.'}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href="tel:0567442996" className="rounded bg-[#0A2540] py-2 text-center text-[13px] font-semibold text-white">📞 0567 442 996</a>
          <a href="https://zalo.me/0567442996" target="_blank" rel="noreferrer" className="rounded border border-[#0068FF] py-2 text-center text-[13px] font-semibold text-[#0068FF]">Zalo admin</a>
          <button type="button" onClick={() => { try { window.dispatchEvent(new CustomEvent('cl-open-chat', { detail: { tab: 'support' } })); } catch { /* bỏ qua */ } }}
            className="col-span-2 rounded border border-slate-300 py-2 text-[13px] font-semibold text-[#0A2540]">💬 Nhắn tin cho admin</button>
          {!user && (
            <button type="button" onClick={() => openLogin({ reason: `Đăng nhập để dùng tiện ích ${ten}.` })}
              className="col-span-2 rounded py-2 text-[13px] font-semibold text-slate-500 active:bg-slate-100">Đăng nhập</button>
          )}
        </div>
      </div>
    </div>
  );
}
