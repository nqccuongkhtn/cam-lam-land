'use client';
/* ============================================================================
 *  Ô CHỌN SỔ XUỐNG — thay cho thẻ <select> của trình duyệt
 * ----------------------------------------------------------------------------
 *  VÌ SAO PHẢI TỰ LÀM: thẻ <select> của trình duyệt vẽ bảng sổ xuống theo kiểu
 *  của HỆ ĐIỀU HÀNH, không chỉnh được — trên Windows nó ra một khung xám vuông
 *  thành, dòng đang chọn tô xanh chói, nhìn lạc hẳn với giao diện.
 *
 *  ⚠️ BẢNG CHỌN ĐƯỢC VẼ RA NGOÀI, GẮN THẲNG VÀO <body> — đây là chỗ đã sửa hai
 *     lần mới xong, đừng đưa nó trở lại nằm trong ô:
 *       · lần 1 — bảng nằm trong ô, sổ xuống: ô tìm kiếm nằm ở ĐÁY banner mà
 *         banner cắt cụt mọi thứ tràn ra ngoài, nên bảng bị cắt gần hết, chỉ
 *         còn một dải xám trống;
 *       · lần 2 — vẫn nằm trong ô nhưng sổ NGƯỢC LÊN: hết bị cắt, nhưng lại
 *         trùm lên chính cái banner và hàng thẻ phía trên, che mất nội dung.
 *     Vẽ ra ngoài <body> (position: fixed) thì không dính khung cắt nào của
 *     banner nữa, sổ xuống dưới bình thường như mọi trang web khác. Chỉ khi
 *     màn hình thật sự hết chỗ bên dưới mới lật lên.
 *
 *  LÀM CHO ĐIỆN THOẠI (90% người dùng):
 *   · mỗi dòng cao tối thiểu 44px — ngón tay bấm không trượt;
 *   · bảng rộng bằng ô, có thanh cuộn riêng;
 *   · chạm ra ngoài là đóng; cuộn trang thì bảng bám theo ô.
 *
 *  Vẫn dùng được bằng bàn phím: Tab tới, Enter/Space mở, mũi tên lên/xuống
 *  chọn, Enter chốt, Esc đóng.
 * ========================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type MucChon = { gt: string; ten: string };

const CAO_TOI_DA = 264;   // chiều cao tối đa của bảng chọn (px)

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
  const [cho, setCho] = useState<{ left: number; top: number; width: number } | null>(null);
  const boc = useRef<HTMLDivElement | null>(null);
  const bang = useRef<HTMLDivElement | null>(null);

  /* Tính chỗ đặt bảng chọn theo vị trí THẬT của ô trên màn hình. */
  const doCho = useCallback(() => {
    const el = boc.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const duoi = window.innerHeight - r.bottom;
    const cao = Math.min(CAO_TOI_DA, dsChon.length * 44 + 52);
    // Đủ chỗ dưới thì sổ xuống; không thì lật lên trên ô.
    const top = duoi >= cao + 8 ? r.bottom + 6 : Math.max(8, r.top - cao - 6);
    setCho({ left: r.left, top, width: r.width });
  }, [dsChon.length]);

  const dang = dsChon.find((m) => m.gt === giaTri);

  /* Chạm/bấm ra ngoài thì đóng. Phải tính CẢ bảng chọn là "bên trong", vì nó
     nằm ngoài ô (gắn vào body) — không thì bấm vào một dòng là bảng đóng trước
     khi kịp nhận cú bấm. */
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: Event) => {
      const t = e.target as Node;
      if (boc.current?.contains(t) || bang.current?.contains(t)) return;
      setMo(false);
    };
    const theo = () => doCho();
    document.addEventListener('mousedown', ngoai);
    document.addEventListener('touchstart', ngoai, { passive: true });
    window.addEventListener('scroll', theo, true);
    window.addEventListener('resize', theo);
    return () => {
      document.removeEventListener('mousedown', ngoai);
      document.removeEventListener('touchstart', ngoai);
      window.removeEventListener('scroll', theo, true);
      window.removeEventListener('resize', theo);
    };
  }, [mo, doCho]);

  const chon = useCallback((v: string) => { doiGiaTri(v); setMo(false); }, [doiGiaTri]);
  const bat = useCallback(() => { doCho(); setMo((v) => !v); }, [doCho]);

  const banPhim = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setMo(false); return; }
    if (!mo && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault(); doCho(); setMo(true); setSoi(dsChon.findIndex((m) => m.gt === giaTri)); return;
    }
    if (!mo) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSoi((i) => Math.min(i + 1, dsChon.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSoi((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && soi >= 0) { e.preventDefault(); chon(dsChon[soi].gt); }
  };

  const dong = (
    <div ref={bang} role="listbox"
      style={{ position: 'fixed', left: cho?.left, top: cho?.top, width: cho?.width, maxHeight: CAO_TOI_DA }}
      className="z-[100] overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/20">
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
  );

  return (
    <div ref={boc} className={`relative ${lop}`}>
      <button type="button" onClick={bat} onKeyDown={banPhim}
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

      {mo && cho && typeof document !== 'undefined' && createPortal(dong, document.body)}
    </div>
  );
}
