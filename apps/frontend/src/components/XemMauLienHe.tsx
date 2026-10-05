'use client';
/* XEM THỬ MẪU khung "người đăng tin" ở trang xem một tin, ngay trên web thật (TẠM — DỄ GỠ, xem đầu lib/mauLienHe.ts).
   Có ?xemmau=N trên đường dẫn → thay khung bằng mẫu N + hiện thanh nổi để chuyển mẫu.
   Không có → trả nguyên khung cũ (children), web không đổi gì. */
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DS_MAU, CSS_MAU, htmlMau, moTaMau, type DuLieuLienHe } from '@/lib/mauLienHe';

interface Props { children: ReactNode; d: DuLieuLienHe; onHien: () => void; onLuu: () => void }

function Trong({ children, d, onHien, onLuu }: Props) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const so = Number(sp.get('xemmau'));
  const [go, setGo] = useState('');
  useEffect(() => { setGo(so ? String(so) : ''); }, [so]);
  if (!so || so < 1 || so > DS_MAU.length) return <>{children}</>;
  // Đổi số mẫu = đổi đường dẫn (giữ vị trí cuộn) → gửi link cho người khác xem đúng mẫu đó được.
  const den = (n: number) => router.replace(`${path}?xemmau=${((n - 1 + DS_MAU.length) % DS_MAU.length) + 1}`, { scroll: false });
  return (
    <>
      <style>{CSS_MAU}</style>
      {/* Nút "Hiện số" / "Lưu tin" trong mẫu vẫn chạy thật: bắt cú bấm theo data-act */}
      <div className="mlh" onClick={(e) => {
        const a = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
        if (a === 'hien') onHien(); else if (a === 'luu') onLuu();
      }} dangerouslySetInnerHTML={{ __html: htmlMau(so, d) }} />
      {/* Thanh chuyển mẫu nổi ở góc dưới bên trái, luôn thấy khi lướt trang */}
      <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-3 z-[70] flex max-w-[calc(100vw-24px)] items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 p-1.5 text-[#0A2540] shadow-xl backdrop-blur md:bottom-4">
        <button type="button" onClick={() => den(so - 1)} aria-label="Mẫu trước" className="grid h-8 w-8 place-items-center rounded border border-slate-200 text-lg hover:bg-slate-50">‹</button>
        <form onSubmit={(e) => { e.preventDefault(); const n = Number(go); if (n >= 1 && n <= DS_MAU.length) den(n); }} className="flex items-center gap-1">
          <span className="text-xs font-semibold">Mẫu</span>
          <input value={go} onChange={(e) => setGo(e.target.value.replace(/\D/g, ''))} inputMode="numeric" aria-label="Số mẫu" className="h-8 w-11 rounded border border-slate-300 text-center text-sm font-bold outline-none focus:border-[#0A2540]" />
          <span className="text-xs text-slate-400">/{DS_MAU.length}</span>
        </form>
        <button type="button" onClick={() => den(so + 1)} aria-label="Mẫu sau" className="grid h-8 w-8 place-items-center rounded border border-slate-200 text-lg hover:bg-slate-50">›</button>
        <span className="hidden max-w-[300px] truncate px-1 text-[11px] text-slate-500 lg:block" title={moTaMau(so)}>{moTaMau(so)}</span>
        <button type="button" onClick={() => router.replace(path, { scroll: false })} className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Tắt</button>
      </div>
    </>
  );
}

export default function XemMauLienHe(p: Props) {
  return <Suspense fallback={p.children}><Trong {...p} /></Suspense>;
}
