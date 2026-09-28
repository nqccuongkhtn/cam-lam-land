'use client';
/* ============================================================================
 *  BẢNG "LỌC NÂNG CAO" (ĐIỆN THOẠI) — PHẦN GIAO DIỆN DÙNG CHUNG
 * ----------------------------------------------------------------------------
 *  Dùng ở TRANG CHỦ (app/page.tsx) và TRANG NHÀ ĐẤT (app/listings/page.tsx) — chủ dự án
 *  muốn hai nơi GIỐNG HỆT NHAU (28/9/2026). Sửa giao diện bảng lọc thì sửa Ở ĐÂY.
 *
 *  Bố cục chuẩn (làm lại lần 3, 28/9/2026 — hai bản trước chủ dự án chê lộn xộn):
 *    đầu bảng  [×]  Bộ lọc  [Đặt lại]
 *    thân      mỗi mục = tiêu đề + MỘT kiểu điều khiển phù hợp nhất, cách đều nhau:
 *              Nhu cầu → 3 nút liền · Loại hình → lưới 3 cột đều ô ·
 *              Khu vực → ô sổ xuống · Khoảng giá, Diện tích → thanh kéo 2 đầu + 2 ô nhập
 *    chân      một nút đỏ "Xem N tin"
 *  ⚠️ KHÔNG có mục "Sắp xếp": thứ tự tin do THUẬT TOÁN ĐẨY TIN quyết định (VIP → tin được đẩy →
 *     tin thường, xem routes/listings.ts). Cho khách tự sắp là phá cơ chế bán gói đẩy tin.
 *  Giá cất theo TỶ ('' = không giới hạn). Diện tích cất theo m² (0 = không giới hạn).
 * ========================================================================== */
import { useEffect, useState, type ReactNode } from 'react';

// Thanh kéo: đầu phải = TRẦN, kéo chạm trần nghĩa là "không giới hạn".
export const TRAN_GIA = { sale: { tran: 20, buoc: 0.1, dv: 'tỷ' }, rent: { tran: 50, buoc: 0.5, dv: 'triệu' } };
export const TRAN_DT = { tran: 2000, buoc: 10, dv: 'm²' };
const soDep = (v: number) => (+v.toFixed(2)).toLocaleString('vi-VN');

// Chữ tóm tắt bên phải tiêu đề mục: "1 – 2,5 tỷ", "Từ 100 m²"; '' khi không lọc.
export function tomTat(lo: number, hi: number, tran: number, dv: string) {
  const coLo = lo > 0, coHi = hi < tran;
  if (!coLo && !coHi) return '';
  if (coLo && coHi) return `${soDep(lo)} – ${soDep(hi)} ${dv}`;
  return coLo ? `Từ ${soDep(lo)} ${dv}` : `Đến ${soDep(hi)} ${dv}`;
}

/* Khung bảng trồi lên từ đáy: nền mờ + đầu bảng [×] Bộ lọc [Đặt lại] + thân cuộn + chân cố định.
   Mở ra thì khoá cuộn trang phía sau (không thì vuốt trong bảng lại cuộn cả trang). */
export function KhungBangLoc({ mo, dong, datLai, coLoc, chan, children }: {
  mo: boolean; dong: () => void; datLai: () => void; coLoc: boolean; chan: ReactNode; children: ReactNode;
}) {
  useEffect(() => {
    if (!mo) return;
    const cu = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = cu; };
  }, [mo]);
  if (!mo) return null;
  return (
    <div className="md:hidden fixed inset-0 z-[70]" role="dialog" aria-label="Bộ lọc">
      <div className="absolute inset-0 bg-[#0A2540]/40 cl-sheet-fade" onClick={dong} aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-2xl bg-white shadow-2xl cl-sheet-up">
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-slate-300" />
        <div className="grid shrink-0 grid-cols-[64px_1fr_64px] items-center border-b border-slate-100 px-2 py-1.5">
          <button type="button" onClick={dong} aria-label="Đóng" className="grid h-10 w-10 place-items-center rounded-full text-slate-500 active:bg-slate-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <span className="text-center text-[15px] font-bold text-[#0A2540]">Bộ lọc</span>
          <button type="button" onClick={datLai} disabled={!coLoc}
            className="h-10 justify-self-end px-2 text-[13px] font-semibold text-red-600 disabled:text-slate-300">Đặt lại</button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4">{children}</div>
        <div className="shrink-0 border-t border-slate-100 px-4 pt-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>{chan}</div>
      </div>
    </div>
  );
}

// Nút đỏ ở chân bảng: "Xem N tin" / "Không có tin phù hợp".
export function NutXemKetQua({ onClick, so, chuMacDinh = 'Xem kết quả', donVi = 'tin' }: { onClick: () => void; so: number | null; chuMacDinh?: string; donVi?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={so === 0}
      className="cl-press h-11 w-full rounded-lg bg-red-600 text-sm font-bold text-white active:bg-red-700 disabled:bg-slate-200 disabled:text-slate-500">
      {so === 0 ? `Không có ${donVi} phù hợp` : so == null ? chuMacDinh : `Xem ${so >= 500 ? '500+' : so.toLocaleString('vi-VN')} ${donVi}`}
    </button>
  );
}

export function MucLoc({ ten, tomTat, children }: { ten: string; tomTat?: string; children: ReactNode }) {
  return (
    <section className="border-b border-slate-100 py-4 last:border-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#0A2540]">{ten}</h3>
        {tomTat ? <span className="truncate text-[13px] font-medium text-red-600">{tomTat}</span> : null}
      </div>
      {children}
    </section>
  );
}

// Nhóm nút liền (kiểu công tắc nhiều nấc): Mua bán | Cho thuê | Dự án.
export function NutLien<K extends string>({ ds, chon, doi }: { ds: readonly (readonly [K, string])[]; chon: K; doi: (k: K) => void }) {
  return (
    <div className="grid gap-1 rounded-lg bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${ds.length}, minmax(0, 1fr))` }}>
      {ds.map(([k, ten]) => (
        <button key={k} type="button" onClick={() => doi(k)}
          className={`h-9 rounded-md text-[13px] transition-colors ${chon === k ? 'bg-white font-semibold text-[#0A2540] shadow-sm' : 'font-medium text-slate-500'}`}>{ten}</button>
      ))}
    </div>
  );
}

// Một ô trong lưới chọn 3 cột (loại hình, loại dự án, trạng thái…).
export function OLuoi({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`min-h-10 rounded-lg border px-1 py-1 text-[12.5px] leading-tight transition-colors ${on ? 'border-red-500 bg-red-50 font-semibold text-red-600' : 'border-slate-200 text-slate-600 active:bg-slate-50'}`}>
      {children}
    </button>
  );
}

// Ô nhập số có đơn vị. Giữ chữ đang gõ riêng (gõ "1," chưa xong không bị nhảy mất dấu phẩy),
// rời ô mới chốt số. Để trống = không giới hạn.
function ONhapSo({ nhan, gt, dv, goiY, doi }: { nhan: string; gt: number | null; dv: string; goiY: string; doi: (v: number | null) => void }) {
  const [chu, setChu] = useState(gt == null ? '' : String(+gt.toFixed(2)).replace('.', ','));
  const [dangGo, setDangGo] = useState(false);
  useEffect(() => { if (!dangGo) setChu(gt == null ? '' : String(+gt.toFixed(2)).replace('.', ',')); }, [gt, dangGo]);
  return (
    <label className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-red-400">
      <span className="text-[12px] text-slate-400">{nhan}</span>
      <input inputMode="decimal" value={chu} placeholder={goiY}
        onFocus={() => setDangGo(true)} onBlur={() => setDangGo(false)}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, ''); setChu(t);
          const n = parseFloat(t.replace(',', '.'));
          doi(t === '' || isNaN(n) ? null : n);
        }}
        className="min-w-0 flex-1 bg-transparent text-right text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-300" />
      <span className="text-[12px] text-slate-400">{dv}</span>
    </label>
  );
}

// Thanh kéo HAI ĐẦU + hai ô nhập. lo = 0 và hi = tran nghĩa là không giới hạn đầu đó.
export function KhoangKeo({ lo, hi, tran, buoc, dv, doi }: { lo: number; hi: number; tran: number; buoc: number; dv: string; doi: (lo: number, hi: number) => void }) {
  const pLo = Math.min(lo, tran) / tran * 100, pHi = Math.min(hi, tran) / tran * 100;
  return (
    <div>
      <div className="cl-keo mx-1.5">
        <div className="cl-keo-ray" />
        <div className="cl-keo-day" style={{ left: `${pLo}%`, right: `${100 - pHi}%` }} />
        <input type="range" aria-label={`Từ (${dv})`} min={0} max={tran} step={buoc} value={Math.min(lo, tran)}
          onChange={(e) => doi(Math.min(Number(e.target.value), hi - buoc), hi)} />
        <input type="range" aria-label={`Đến (${dv})`} min={0} max={tran} step={buoc} value={Math.min(hi, tran)}
          onChange={(e) => doi(lo, Math.max(Number(e.target.value), lo + buoc))} />
      </div>
      <div className="mt-1 mb-3 flex justify-between px-0.5 text-[11px] text-slate-400"><span>0</span><span>{soDep(tran)}+ {dv}</span></div>
      <div className="flex items-center gap-2">
        <ONhapSo nhan="Từ" gt={lo > 0 ? lo : null} dv={dv} goiY="0" doi={(v) => doi(v ?? 0, hi)} />
        <span className="text-slate-300">–</span>
        <ONhapSo nhan="Đến" gt={hi < tran ? hi : null} dv={dv} goiY="Tối đa" doi={(v) => doi(lo, v ?? tran)} />
      </div>
    </div>
  );
}
