'use client';
/* ============================================================================
 *  MÀN HÌNH TÌM KIẾM TOÀN MÀN HÌNH — trang chủ, CHỈ ĐIỆN THOẠI
 * ----------------------------------------------------------------------------
 *  Bấm vào ô tìm kiếm ở trang chủ là trượt lên màn hình này (kiểu app nhà đất).
 *  Vì sao không gõ thẳng trong ô dưới banner: banner cắt cụt mọi thứ tràn ra
 *  ngoài nên không sổ gợi ý xuống được, và bàn phím điện thoại bật lên sẽ che
 *  mất nửa màn hình — gợi ý nằm dưới ô là bị bàn phím đè.
 *
 *  Có gì:
 *   · Chưa gõ   → "Tìm gần đây" (nhớ 6 lần, lưu trên máy người xem) + "Khu vực" + "Dự án".
 *   · Đang gõ   → dòng đầu "Tìm «…» trong tin đăng", rồi khu vực + dự án KHỚP chữ gõ.
 *                 Gõ KHÔNG DẤU vẫn ra ("cam duc" ra "Cam Đức").
 *   · Chọn khu vực → tìm theo xã; chọn dự án → xem tin đăng của dự án (giống bấm thẻ dự án).
 *  Cha (app/page.tsx) quyết định đi tới đâu qua `onTim` — để bộ lọc đang bật được giữ nguyên.
 * ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react';

export type DuAnGoiY = { id: number; name: string; status?: string | null; scale?: string | null; location?: string | null; imageUrl?: string | null };
export type KhuVucGoiY = { name: string; ward: string; sub: string };

// Bỏ dấu để so chữ: "Cam Đức" → "cam duc". Tách dấu (NFD) rồi xoá dấu → chữ gõ liền dấu hay tách dấu đều khớp.
export const khongDau = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

const KHOA_GAN_DAY = 'cl_tim_gan_day';
function docGanDay(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KHOA_GAN_DAY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 6) : []; } catch { return []; }
}
function ghiGanDay(ds: string[]) { try { localStorage.setItem(KHOA_GAN_DAY, JSON.stringify(ds.slice(0, 6))); } catch { /* chế độ ẩn danh — bỏ qua */ } }
export function nhoTimKiem(chu: string) {
  const c = chu.trim(); if (!c) return;
  ghiGanDay([c, ...docGanDay().filter((x) => khongDau(x) !== khongDau(c))]);
}

type Deal = 'sale' | 'rent' | 'project';

export default function TimKiemToanManHinh({ mo, dong, q, setQ, deal, setDeal, khuVuc, duAn, onTim, onDuAn, goiY }: {
  mo: boolean; dong: () => void;
  q: string; setQ: (v: string) => void;
  deal: Deal; setDeal: (d: Deal) => void;
  khuVuc: KhuVucGoiY[]; duAn: DuAnGoiY[];
  onTim: (chu: string, xa?: string) => void;   // tìm tin đăng (chữ gõ, hoặc theo xã)
  onDuAn: (p: DuAnGoiY) => void;                // chọn một dự án
  goiY: string;                                 // chữ mờ trong ô
}) {
  const oNhap = useRef<HTMLInputElement>(null);
  const [ganDay, setGanDay] = useState<string[]>([]);

  // Mở ra: nạp "tìm gần đây", khoá cuộn trang sau, đưa con trỏ vào ô (bàn phím bật lên luôn).
  useEffect(() => {
    if (!mo) return;
    setGanDay(docGanDay());
    const cu = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const t = setTimeout(() => oNhap.current?.focus(), 60);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') dong(); };
    window.addEventListener('keydown', esc);
    return () => { clearTimeout(t); document.body.style.overflow = cu; window.removeEventListener('keydown', esc); };
  }, [mo, dong]);

  const k = khongDau(q);
  const kvKhop = useMemo(() => (k ? khuVuc.filter((a) => khongDau(a.name + ' ' + a.sub).includes(k)) : khuVuc).slice(0, k ? 6 : 14), [k, khuVuc]);
  const daKhop = useMemo(() => (k ? duAn.filter((p) => khongDau(`${p.name} ${p.scale || ''} ${p.location || ''}`).includes(k)) : duAn).slice(0, 6), [k, duAn]);

  const tim = (chu: string, xa?: string) => { nhoTimKiem(xa || chu); onTim(chu, xa); };
  if (!mo) return null;

  const IconGhim = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.3" /></svg>;
  const tieuDe = (chu: string, phai?: React.ReactNode) => (
    <div className="mb-1 mt-5 flex items-center justify-between first:mt-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{chu}</p>{phai}
    </div>
  );

  return (
    <div className="md:hidden fixed inset-0 z-[75] flex flex-col bg-white cl-sheet-up" role="dialog" aria-label="Tìm kiếm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* ĐẦU: nút lùi + ô gõ. Nút "Tìm" chỉ hiện khi đã gõ chữ. */}
      <div className="flex items-center gap-2 px-3 pt-2">
        <button type="button" onClick={dong} aria-label="Quay lại" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 active:bg-slate-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M15 18 9 12l6-6" /></svg>
        </button>
        <form className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3" onSubmit={(e) => { e.preventDefault(); tim(q); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 shrink-0 text-slate-400"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
          <input ref={oNhap} value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" placeholder={goiY}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
          {q && <button type="button" onClick={() => { setQ(''); oNhap.current?.focus(); }} aria-label="Xoá chữ" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-300 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="h-3 w-3"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>}
        </form>
      </div>
      {/* Nhu cầu — đổi ngay tại đây, gợi ý bên dưới đổi theo */}
      <div className="flex gap-5 border-b border-slate-100 px-4">
        {([['sale', 'Nhà đất bán'], ['rent', 'Cho thuê'], ['project', 'Dự án']] as const).map(([kk, ten]) => (
          <button key={kk} type="button" onClick={() => setDeal(kk)}
            className={`relative py-2.5 text-[13px] ${deal === kk ? 'font-semibold text-[#0A2540]' : 'text-slate-500'}`}>
            {ten}{deal === kk && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-red-600" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {/* Đang gõ: dòng tìm thẳng chữ vừa gõ */}
        {q.trim() && (
          <button type="button" onClick={() => tim(q)} className="mt-2 flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left active:bg-slate-50">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-red-50 text-red-600"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-4 w-4"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg></span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">Tìm “<b className="text-[#0A2540]">{q.trim()}</b>” {deal === 'project' ? 'trong dự án' : 'trong tin đăng'}</span>
          </button>
        )}

        {/* Chưa gõ: tìm gần đây */}
        {!q.trim() && ganDay.length > 0 && (<>
          {tieuDe('Tìm gần đây', <button type="button" onClick={() => { ghiGanDay([]); setGanDay([]); }} className="text-[12px] font-medium text-slate-400">Xoá hết</button>)}
          {ganDay.map((c) => (
            <div key={c} className="flex items-center">
              <button type="button" onClick={() => { setQ(c); tim(c); }} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-slate-400"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                <span className="truncate text-sm text-slate-700">{c}</span>
              </button>
              <button type="button" aria-label={`Bỏ “${c}”`} onClick={() => { const ds = ganDay.filter((x) => x !== c); ghiGanDay(ds); setGanDay(ds); }} className="grid h-8 w-8 place-items-center text-slate-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </>)}

        {/* Dự án — ưu tiên đưa lên trên khi đang ở tab Dự án */}
        {deal === 'project' && daKhop.length > 0 && <DsDuAn tieuDe={tieuDe} ds={daKhop} onDuAn={(p) => { nhoTimKiem(p.name); onDuAn(p); }} />}

        {kvKhop.length > 0 && (<>
          {tieuDe(q.trim() ? 'Khu vực' : 'Khu vực Cam Lâm')}
          {q.trim() ? kvKhop.map((a) => (
            <button key={a.ward} type="button" onClick={() => tim('', a.ward)} className="flex w-full items-center gap-3 py-2.5 text-left active:bg-slate-50">
              <span className="text-slate-400">{IconGhim}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm text-slate-800">{a.name}</span><span className="block truncate text-[12px] text-slate-400">{a.sub}</span></span>
            </button>
          )) : (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {kvKhop.map((a) => (
                <button key={a.ward} type="button" onClick={() => tim('', a.ward)} className="rounded-full border border-slate-200 px-3 py-1.5 text-[13px] text-slate-600 active:bg-slate-50">{a.name}</button>
              ))}
            </div>
          )}
        </>)}

        {deal !== 'project' && daKhop.length > 0 && <DsDuAn tieuDe={tieuDe} ds={daKhop} onDuAn={(p) => { nhoTimKiem(p.name); onDuAn(p); }} />}

        {q.trim() && !kvKhop.length && !daKhop.length && (
          <p className="mt-6 text-center text-[13px] text-slate-400">Không có khu vực hay dự án nào tên như vậy — bấm dòng trên để tìm trong tin đăng.</p>
        )}
      </div>
    </div>
  );
}

function DsDuAn({ tieuDe, ds, onDuAn }: { tieuDe: (c: string) => React.ReactNode; ds: DuAnGoiY[]; onDuAn: (p: DuAnGoiY) => void }) {
  return (<>
    {tieuDe('Dự án')}
    {ds.map((p) => (
      <button key={p.id} type="button" onClick={() => onDuAn(p)} className="flex w-full items-center gap-3 py-2 text-left active:bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md bg-slate-100 object-cover" />
          : <span className="h-10 w-10 shrink-0 rounded-md bg-slate-100" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-slate-800">{p.name}</span>
          <span className="block truncate text-[12px] text-slate-400">{[p.status, p.location].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
    ))}
  </>);
}
