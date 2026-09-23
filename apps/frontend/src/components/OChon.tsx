'use client';
/* ============================================================================
 *  Ô CHỌN SỔ XUỐNG — thay cho thẻ <select> của trình duyệt
 * ----------------------------------------------------------------------------
 *  VÌ SAO PHẢI TỰ LÀM: thẻ <select> của trình duyệt vẽ bảng sổ xuống theo kiểu
 *  của HỆ ĐIỀU HÀNH, không chỉnh được — trên Windows nó ra một khung xám vuông
 *  thành, dòng đang chọn tô xanh chói, nhìn lạc hẳn với giao diện. Chủ dự án
 *  nhận xét "loại hình sổ xuống chưa được đẹp" là chỗ này.
 *
 *  LÀM CHO ĐIỆN THOẠI (90% người dùng):
 *   · mỗi dòng cao tối thiểu 44px — ngón tay bấm không trượt;
 *   · bảng sổ xuống rộng bằng ô, có thanh cuộn riêng, không tràn ra ngoài màn;
 *   · chạm ra ngoài là đóng.
 *
 *  Vẫn dùng được bằng bàn phím: Tab tới, Enter/Space mở, mũi tên lên/xuống
 *  chọn, Enter chốt, Esc đóng.
 * ========================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react';

export type MucChon = { gt: string; ten: string };

export default function OChon({
  giaTri, doiGiaTri, dsChon, nhan, icon, lop = '',
}: {
  giaTri: string;
  doiGiaTri: (v: string) => void;
  dsChon: MucChon[];
  nhan: string;              // chữ hiện khi chưa chọn gì
  icon?: React.ReactNode;
  lop?: string;
}) {
  const [mo, setMo] = useState(false);
  const [soi, setSoi] = useState(-1);       // dòng đang rê tới bằng bàn phím
  const boc = useRef<HTMLDivElement | null>(null);

  const dang = dsChon.find((m) => m.gt === giaTri);

  /* Chạm/bấm ra ngoài thì đóng */
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: Event) => {
      if (boc.current && !boc.current.contains(e.target as Node)) setMo(false);
    };
    document.addEventListener('mousedown', ngoai);
    document.addEventListener('touchstart', ngoai, { passive: true });
    return () => {
      document.removeEventListener('mousedown', ngoai);
      document.removeEventListener('touchstart', ngoai);
    };
  }, [mo]);

  const chon = useCallback((v: string) => { doiGiaTri(v); setMo(false); }, [doiGiaTri]);

  const banPhim = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setMo(false); return; }
    if (!mo && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault(); setMo(true); setSoi(dsChon.findIndex((m) => m.gt === giaTri)); return;
    }
    if (!mo) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSoi((i) => Math.min(i + 1, dsChon.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSoi((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && soi >= 0) { e.preventDefault(); chon(dsChon[soi].gt); }
  };

  return (
    <div ref={boc} className={`relative ${lop}`}>
      <button type="button" onClick={() => setMo((v) => !v)} onKeyDown={banPhim}
        aria-haspopup="listbox" aria-expanded={mo}
        className="flex h-full w-full items-center gap-2 rounded-xl border border-white/20 bg-white px-3 py-2.5 text-left">
        {icon}
        <span className={`flex-1 truncate text-sm ${dang ? 'text-slate-800' : 'text-slate-500'}`}>
          {dang ? dang.ten : nhan}
        </span>
        <svg viewBox="0 0 24 24" aria-hidden
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${mo ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {mo && (
        <div role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/15">
          <button type="button" onClick={() => chon('')}
            className={`flex min-h-[44px] w-full items-center px-3 text-left text-sm ${!giaTri ? 'bg-[#0A2540]/5 font-semibold text-[#0A2540]' : 'text-slate-600 hover:bg-slate-50'}`}>
            {nhan}
          </button>
          {dsChon.map((m, i) => (
            <button key={m.gt} type="button" role="option" aria-selected={m.gt === giaTri}
              onClick={() => chon(m.gt)} onMouseEnter={() => setSoi(i)}
              className={`flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm ${
                m.gt === giaTri ? 'bg-[#0A2540]/5 font-semibold text-[#0A2540]'
                  : soi === i ? 'bg-slate-50 text-slate-700' : 'text-slate-700 hover:bg-slate-50'}`}>
              <span className="flex-1">{m.ten}</span>
              {m.gt === giaTri && (
                <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 text-[#C8A14B]">
                  <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
