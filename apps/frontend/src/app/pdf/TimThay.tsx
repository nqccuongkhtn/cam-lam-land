'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// TÌM CHỮ + TÌM & THAY THẾ trong công cụ Sửa PDF (chủ dự án 6/10/2026: "tìm chữ trong văn bản để sửa nhanh hơn mắt thường,
// và tìm & thay thế để thay tự động").
// · Gõ KHÔNG dấu ("hoa nghia") → khớp cả chữ có dấu ("Hòa Nghĩa"); gõ CÓ dấu → chỉ khớp đúng dấu đó. Không phân biệt hoa/thường.
// · Tìm trên chữ HIỆN TẠI của từng dòng: dòng đã sửa thì tìm trong chữ mới, chưa sửa thì tìm trong chữ gốc.
// · Thay = đổi đúng chỗ đang chọn (tô cam); Thay tất cả = đổi mọi chỗ khớp ở mọi trang.
//   Mỗi dòng bị thay đi qua đúng đường "bấm vào chữ rồi gõ" → ô che chữ cũ, phông, cỡ, màu, độ giãn y như sửa tay.
import { useEffect, useRef } from 'react';

const DAU = /[̀-ͯ]/g;
/** Bỏ dấu TỪNG CHỮ một (giữ nguyên số chữ → vị trí khớp trên chuỗi bỏ dấu = vị trí trên chuỗi gốc). */
const boDauTungChu = (s: string) => Array.from(s).map((c) => (c.normalize('NFD').replace(DAU, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')[0] || c)).join('').toLowerCase();
const coDau = (s: string) => s.normalize('NFD') !== s || /[đĐ]/.test(s);

export type Khop = { pgId: string; ii: number; start: number; len: number; chu: string };

/** Tìm mọi chỗ khớp. chuHienTai(pgId, ii) trả chữ hiện tại của dòng (đã sửa hoặc gốc). */
export function timKhop(pages: { id: string }[], itemsCache: Record<string, any[]>, chuHienTai: (pgId: string, ii: number, goc: string) => string, tu: string): Khop[] {
  const q = tu.normalize('NFC'); if (!q.trim()) return [];
  const giuDau = coDau(q);
  const chuan = (s: string) => (giuDau ? s.toLowerCase() : boDauTungChu(s));
  const qq = chuan(q); const ra: Khop[] = [];
  for (const pg of pages) {
    (itemsCache[pg.id] || []).forEach((it: any, ii: number) => {
      const chu = chuHienTai(pg.id, ii, String(it.str || '')).normalize('NFC');
      const cc = chuan(chu); if (cc.length !== chu.length) return;
      for (let i = cc.indexOf(qq); i >= 0; i = cc.indexOf(qq, i + Math.max(1, qq.length))) ra.push({ pgId: pg.id, ii, start: i, len: q.length, chu });
    });
  }
  return ra;
}

export function ThanhTimThay({ tu, setTu, thay, setThay, khop, chiSo, setChiSo, onThay, onThayHet, onDong }: {
  tu: string; setTu: (s: string) => void; thay: string; setThay: (s: string) => void; khop: Khop[]; chiSo: number; setChiSo: (n: number) => void;
  onThay: () => void; onThayHet: () => void; onDong: () => void;
}) {
  const oTim = useRef<HTMLInputElement>(null);
  useEffect(() => { oTim.current?.focus(); oTim.current?.select(); }, []);
  const n = khop.length;
  const di = (b: number) => { if (n) setChiSo(((chiSo + b) % n + n) % n); };
  const o = 'h-8 rounded-md border border-slate-300 px-2.5 text-sm outline-none focus:border-[#0A2540]';
  const nut = 'h-8 rounded-md px-3 text-sm font-semibold disabled:opacity-40';
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b bg-slate-50 px-3 py-1.5">
      <div className="relative">
        <input ref={oTim} value={tu} onChange={(e) => { setTu(e.target.value); setChiSo(0); }} onKeyDown={(e) => { if (e.key === 'Enter') di(e.shiftKey ? -1 : 1); if (e.key === 'Escape') onDong(); }}
          placeholder="Tìm chữ trong văn bản…" className={`${o} w-56 pr-16`} aria-label="Tìm chữ" />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs tabular-nums text-slate-500">{tu.trim() ? (n ? `${chiSo + 1}/${n}` : '0 chỗ') : ''}</span>
      </div>
      <button type="button" onClick={() => di(-1)} disabled={!n} title="Chỗ trước (Shift+Enter)" className={`${nut} border border-slate-300 bg-white px-2`}>‹</button>
      <button type="button" onClick={() => di(1)} disabled={!n} title="Chỗ sau (Enter)" className={`${nut} border border-slate-300 bg-white px-2`}>›</button>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      <input value={thay} onChange={(e) => setThay(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onThay(); if (e.key === 'Escape') onDong(); }}
        placeholder="Thay bằng…" className={`${o} w-48`} aria-label="Thay bằng" />
      <button type="button" onClick={onThay} disabled={!n} className={`${nut} border border-slate-300 bg-white text-[#0A2540] hover:bg-slate-100`}>Thay</button>
      <button type="button" onClick={onThayHet} disabled={!n} className={`${nut} bg-[#0A2540] text-white hover:bg-[#13365c]`}>Thay tất cả{n ? ` (${n})` : ''}</button>
      <span className="ml-1 hidden text-xs text-slate-500 lg:inline">Gõ không dấu vẫn tìm được chữ có dấu</span>
      <button type="button" onClick={onDong} aria-label="Đóng tìm kiếm" className="ml-auto grid h-8 w-8 place-items-center rounded-md text-lg text-slate-500 hover:bg-slate-200">✕</button>
    </div>
  );
}
