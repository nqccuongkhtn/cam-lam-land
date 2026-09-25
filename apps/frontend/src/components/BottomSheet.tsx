'use client';
// Bottom-sheet kiểu app: trượt lên từ đáy, có nền mờ, tay nắm kéo, tiêu đề & vùng cuộn. CHỈ mobile.
import { useEffect } from 'react';

export default function BottomSheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-[70] md:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open} role="dialog" aria-modal="true">
      <div onClick={onClose} className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="grid shrink-0 place-items-center pb-1 pt-2"><span className="h-1.5 w-10 rounded-full bg-slate-300" /></div>
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 pb-2">
            <b className="text-[15px] text-[#0B4045]">{title}</b>
            <button onClick={onClose} aria-label="Đóng" className="cl-press grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-4 py-3">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
