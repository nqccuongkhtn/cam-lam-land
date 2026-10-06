'use client';
/* ============================================================================
 *  XEM THỬ 100 MẪU DẢI QUẢNG BÁ TRANG CHỦ (6/10/2026, TẠM — DỄ GỠ)
 *  Mở trang chủ kèm ?maubn=N (1–100). Không có tham số thì web y như cũ (components/PromoBanner.tsx).
 *  100 mẫu = 25 BỐ CỤC × 4 TÔNG MÀU. Bốn tông đều lấy từ chính trang chủ để mẫu nào cũng "hợp nhà":
 *    1. Trắng viền mảnh (giống thẻ tin đăng)  2. Xám nhạt (giống nền trang)
 *    3. Xanh đậm của logo + nút vàng         4. Nền nhạt theo màu từng nội dung (đỏ / vàng / xanh)
 *  Chọn xong: dựng mẫu đó thành PromoBanner thật, xoá file này + chỗ gọi trong PromoBanner.tsx.
 * ========================================================================== */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';

type ND = { k: string; nhan: string; tieuDe: string; mo: string; ich: string[]; nut: string; link: string; anh: string; mau: string; nhat: string };
const DS: ND[] = [
  { k: 'qh', nhan: 'Bản đồ quy hoạch', tieuDe: 'Tra cứu quy hoạch & thửa đất Cam Lâm chính xác', mo: 'Nền vệ tinh nét cao, toạ độ VN-2000, đo đạc trực tiếp trên bản đồ.', ich: ['Nền vệ tinh nét cao', 'Toạ độ VN-2000', 'Đo đạc trực tiếp'], nut: 'Mở bản đồ', link: '/map', anh: '/quyhoach-camlam.jpg', mau: '#0A2540', nhat: '#eef3f9' },
  { k: 'dt', nhan: 'Miễn phí đăng tin', tieuDe: 'Bán nhà đất Cam Lâm nhanh hơn', mo: 'Tin hiện ngay trên bản đồ quy hoạch, đến đúng người đang tìm mua ở Cam Lâm.', ich: ['Hiện trên bản đồ', 'Đúng khách khu vực', 'Hỗ trợ pháp lý'], nut: 'Đăng tin ngay', link: '/sales/post', anh: '/tin-mau/nha-01.webp', mau: '#c8102e', nhat: '#fdf1f2' },
  { k: 'dn', nhan: 'Dành cho doanh nghiệp', tieuDe: 'Quảng bá thương hiệu & dự án tại Cam Lâm', mo: 'Banner trang chủ, logo trên bản đồ, đẩy tin nổi bật cho dự án của bạn.', ich: ['Banner trang chủ', 'Logo trên bản đồ', 'Đẩy tin nổi bật'], nut: 'Xem dịch vụ', link: '/dichvu', anh: '/bai-dai/bd-02.webp', mau: '#a8791f', nhat: '#fbf5e8' },
];

type Tk = { bg: string; fg: string; mu: string; ln: string; the: string; nut: string; nutC: string; nhan: string; vien: string };
const TONG: { ten: string; tk: (s: ND) => Tk }[] = [
  { ten: 'Trắng viền mảnh', tk: (s) => ({ bg: '#fff', fg: '#0A2540', mu: '#64748b', ln: '#e2e8f0', the: '#fff', nut: s.k === 'qh' ? '#0A2540' : s.mau, nutC: '#fff', nhan: s.mau === '#0A2540' ? '#2563eb' : s.mau, vien: '1px solid #e2e8f0' }) },
  { ten: 'Xám nhạt', tk: (s) => ({ bg: '#f3f5f8', fg: '#0A2540', mu: '#64748b', ln: '#e2e8f0', the: '#fff', nut: '#0A2540', nutC: '#fff', nhan: s.mau === '#0A2540' ? '#2563eb' : s.mau, vien: '1px solid transparent' }) },
  { ten: 'Xanh đậm + vàng', tk: () => ({ bg: '#0A2540', fg: '#fff', mu: 'rgba(255,255,255,.66)', ln: 'rgba(255,255,255,.14)', the: 'rgba(255,255,255,.06)', nut: '#C8A14B', nutC: '#0A2540', nhan: '#E3C67A', vien: '1px solid #0A2540' }) },
  { ten: 'Nền nhạt theo màu nội dung', tk: (s) => ({ bg: s.nhat, fg: '#0A2540', mu: '#5b6475', ln: 'rgba(10,37,64,.08)', the: '#fff', nut: s.mau, nutC: '#fff', nhan: s.mau === '#0A2540' ? '#2563eb' : s.mau, vien: '1px solid transparent' }) },
];

// ── Biểu tượng nét mảnh cho từng nội dung ──
const Ico = ({ k, c, n = 22 }: { k: string; c: string; n?: number }) => (
  <svg viewBox="0 0 24 24" width={n} height={n} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {k === 'qh' ? <><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" /><path d="M9 4v13.5M15 6.5V20" /></>
      : k === 'dt' ? <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M12 12v5M9.5 14.5h5" /></>
        : <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" /></>}
  </svg>
);
const Mui = ({ c = 'currentColor' }: { c?: string }) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const Anh = ({ s, cls = '', st }: { s: ND; cls?: string; st?: CSSProperties }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={s.anh} alt="" loading="lazy" className={`h-full w-full object-cover ${cls}`} style={st} />
);
const Nut = ({ s, t, cls = '' }: { s: ND; t: Tk; cls?: string }) => (
  <Link href={s.link} className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-4 py-2 text-[13.5px] font-bold transition hover:brightness-110 ${cls}`} style={{ background: t.nut, color: t.nutC }}>{s.nut} <Mui /></Link>
);
const NutVien = ({ s, t, cls = '' }: { s: ND; t: Tk; cls?: string }) => (
  <Link href={s.link} className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border px-4 py-2 text-[13.5px] font-bold ${cls}`} style={{ borderColor: t.fg === '#fff' ? 'rgba(255,255,255,.4)' : '#cbd5e1', color: t.fg }}>{s.nut} <Mui /></Link>
);
const Nhan = ({ s, t, cls = '' }: { s: ND; t: Tk; cls?: string }) => <p className={`text-[11px] font-bold uppercase tracking-[.12em] ${cls}`} style={{ color: t.nhan }}>{s.nhan}</p>;
const Cham = ({ i, set, t }: { i: number; set: (k: number) => void; t: Tk }) => (
  <div className="flex gap-1.5">{DS.map((_, k) => <button key={k} type="button" aria-label={`Nội dung ${k + 1}`} onClick={() => set(k)} className="h-1.5 rounded-full transition-all" style={{ width: k === i ? 18 : 6, background: k === i ? t.fg : t.fg === '#fff' ? 'rgba(255,255,255,.35)' : '#cbd5e1' }} />)}</div>
);

type Ctx = { i: number; set: (k: number) => void; tk: (s: ND) => Tk };
type BoCuc = { ten: string; ve: (c: Ctx) => ReactNode };
const khung = (t: Tk, cls = '', them: CSSProperties = {}) => ({ className: `overflow-hidden rounded-lg ${cls}`, style: { background: t.bg, color: t.fg, border: t.vien, ...them } as CSSProperties });

const BO_CUC: BoCuc[] = [
  { ten: 'Dải gọn: biểu tượng trái · chữ · nút phải, tự đổi nội dung', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:px-7')}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: t.the, border: `1px solid ${t.ln}` }}><Ico k={s.k} c={t.nhan} /></span>
      <div key={i} className="cl-fadeup min-w-0 flex-1"><Nhan s={s} t={t} /><p className="mt-0.5 text-lg font-extrabold leading-snug md:text-xl">{s.tieuDe}</p><p className="mt-0.5 text-sm" style={{ color: t.mu }}>{s.mo}</p></div>
      <div className="flex items-center gap-4"><Cham i={i} set={set} t={t} /><Nut s={s} t={t} /></div>
    </div>); } },
  { ten: 'Ảnh trái 40% · chữ phải', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'grid sm:grid-cols-[2fr_3fr]')}>
      <div key={'a' + i} className="cl-fadeup aspect-[16/9] sm:aspect-auto sm:min-h-[180px]"><Anh s={s} /></div>
      <div className="flex flex-col justify-center p-5 sm:p-7"><Nhan s={s} t={t} /><p key={i} className="cl-fadeup mt-1 text-xl font-extrabold leading-snug md:text-2xl">{s.tieuDe}</p><p className="mt-1.5 text-sm" style={{ color: t.mu }}>{s.mo}</p>
        <div className="mt-4 flex items-center justify-between gap-3"><Nut s={s} t={t} /><Cham i={i} set={set} t={t} /></div></div>
    </div>); } },
  { ten: 'Chữ trái · ảnh phải tan dần vào nền', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'relative min-h-[190px]')}>
      <div key={'a' + i} className="cl-fadeup absolute inset-y-0 right-0 hidden w-[55%] sm:block" style={{ WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 45%)', maskImage: 'linear-gradient(90deg,transparent,#000 45%)' }}><Anh s={s} /></div>
      <div className="relative max-w-xl p-5 sm:p-8"><Nhan s={s} t={t} /><p key={i} className="cl-fadeup mt-1 text-xl font-extrabold leading-snug md:text-[28px]">{s.tieuDe}</p><p className="mt-2 text-sm" style={{ color: t.mu }}>{s.mo}</p>
        <div className="mt-5 flex items-center gap-4"><Nut s={s} t={t} /><Cham i={i} set={set} t={t} /></div></div>
    </div>); } },
  { ten: 'Ba thẻ chữ cạnh nhau (hiện cả 3, không tự đổi)', ve: ({ tk }) => (
    <div className="grid gap-3 md:grid-cols-3">{DS.map((s) => { const t = tk(s); return (
      <Link key={s.k} href={s.link} {...khung(t, 'group flex flex-col p-5 transition hover:-translate-y-0.5')}>
        <Ico k={s.k} c={t.nhan} n={26} /><Nhan s={s} t={t} cls="mt-3" /><p className="mt-1 text-[17px] font-extrabold leading-snug">{s.tieuDe}</p><p className="mt-1 flex-1 text-[13px]" style={{ color: t.mu }}>{s.mo}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-bold" style={{ color: t.fg === '#fff' ? '#E3C67A' : t.nut }}>{s.nut} <Mui /></span>
      </Link>); })}</div>) },
  { ten: 'Ba thẻ ảnh trên · chữ dưới (hiện cả 3)', ve: ({ tk }) => (
    <div className="grid gap-3 sm:grid-cols-3">{DS.map((s) => { const t = tk(s); return (
      <Link key={s.k} href={s.link} {...khung(t, 'group block')}>
        <div className="aspect-[16/9] overflow-hidden"><Anh s={s} cls="transition duration-500 group-hover:scale-105" /></div>
        <div className="p-4"><Nhan s={s} t={t} /><p className="mt-0.5 text-[16px] font-extrabold leading-snug">{s.tieuDe}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: t.fg === '#fff' ? '#E3C67A' : t.nut }}>{s.nut} <Mui /></span></div>
      </Link>); })}</div>) },
  { ten: 'Ba tab trên đầu · nội dung bên dưới', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t)}>
      <div className="flex border-b" style={{ borderColor: t.ln }}>{DS.map((x, k) => (
        <button key={x.k} type="button" onClick={() => set(k)} className="flex flex-1 items-center justify-center gap-2 px-2 py-3 text-[13px] font-bold transition" style={{ color: k === i ? t.fg : t.mu, boxShadow: k === i ? `inset 0 -2px 0 ${t.fg === '#fff' ? '#E3C67A' : t.nut}` : 'none' }}>
          <Ico k={x.k} c={k === i ? t.nhan : t.mu} n={18} /><span className="truncate">{x.nhan}</span></button>))}</div>
      <div key={i} className="cl-fadeup flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:px-7"><div className="flex-1"><p className="text-xl font-extrabold leading-snug">{s.tieuDe}</p><p className="mt-1 text-sm" style={{ color: t.mu }}>{s.mo}</p></div><Nut s={s} t={t} /></div>
    </div>); } },
  { ten: 'Bento: một ô lớn có ảnh + hai ô nhỏ bên phải', ve: ({ tk }) => { const [a, b, c] = DS; const ta = tk(a); return (
    <div className="grid gap-3 md:grid-cols-[1.6fr_1fr]">
      <Link href={a.link} {...khung(ta, 'group relative block min-h-[220px]')}>
        <div className="absolute inset-0"><Anh s={a} cls="transition duration-700 group-hover:scale-105" /></div>
        <div className="absolute inset-x-3 bottom-3 rounded-md p-4" style={{ background: ta.fg === '#fff' ? 'rgba(10,37,64,.92)' : 'rgba(255,255,255,.95)' }}><Nhan s={a} t={ta} /><p className="mt-0.5 text-lg font-extrabold leading-snug">{a.tieuDe}</p><span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: ta.fg === '#fff' ? '#E3C67A' : ta.nut }}>{a.nut} <Mui /></span></div>
      </Link>
      <div className="grid gap-3">{[b, c].map((s) => { const t = tk(s); return (
        <Link key={s.k} href={s.link} {...khung(t, 'group flex items-center gap-4 p-4')}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: t.the, border: `1px solid ${t.ln}` }}><Ico k={s.k} c={t.nhan} /></span>
          <div className="min-w-0 flex-1"><Nhan s={s} t={t} /><p className="text-[15px] font-extrabold leading-snug">{s.tieuDe}</p></div><Mui c={t.mu} /></Link>); })}</div>
    </div>); } },
  { ten: 'Một dòng mỏng kiểu thông báo (cao ~56px)', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'flex items-center gap-3 px-4 py-3 sm:px-5')}>
      <Ico k={s.k} c={t.nhan} n={20} />
      <p key={i} className="cl-fadeup min-w-0 flex-1 truncate text-[14.5px]"><b>{s.nhan}:</b> <span style={{ color: t.mu }}>{s.tieuDe}</span></p>
      <div className="hidden sm:block"><Cham i={i} set={set} t={t} /></div>
      <Link href={s.link} className="inline-flex shrink-0 items-center gap-1 text-[13.5px] font-bold" style={{ color: t.fg === '#fff' ? '#E3C67A' : t.nut }}>{s.nut} <Mui /></Link>
    </div>); } },
  { ten: 'Hai cột: tiêu đề to trái · 3 lợi ích có dấu ✓ + nút phải', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'grid gap-5 p-5 sm:p-7 md:grid-cols-2 md:items-center')}>
      <div key={i} className="cl-fadeup"><Nhan s={s} t={t} /><p className="mt-1 text-2xl font-extrabold leading-tight md:text-[30px]">{s.tieuDe}</p><div className="mt-4"><Cham i={i} set={set} t={t} /></div></div>
      <div><ul className="space-y-2">{s.ich.map((x) => <li key={x} className="flex items-center gap-2.5 text-[15px]"><span className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold" style={{ background: t.nut, color: t.nutC }}>✓</span>{x}</li>)}</ul><Nut s={s} t={t} cls="mt-5" /></div>
    </div>); } },
  { ten: 'Danh sách 3 dòng dạng đường dẫn (gọn như mục lục)', ve: ({ tk }) => { const t0 = tk(DS[0]); return (
    <div {...khung(t0, 'divide-y')} >{DS.map((s) => { const t = tk(s); return (
      <Link key={s.k} href={s.link} className="group flex items-center gap-4 px-5 py-4 transition hover:brightness-[.98]" style={{ borderColor: t0.ln }}>
        <Ico k={s.k} c={t.nhan} /><div className="min-w-0 flex-1"><p className="text-[15.5px] font-extrabold leading-snug">{s.tieuDe}</p><p className="truncate text-[13px]" style={{ color: t0.mu }}>{s.mo}</p></div>
        <span className="hidden items-center gap-1 text-[13px] font-bold sm:inline-flex" style={{ color: t0.fg === '#fff' ? '#E3C67A' : t.nut }}>{s.nut} <Mui /></span></Link>); })}</div>); } },
  { ten: 'Ảnh rộng · khung chữ trắng nổi bên trái', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div className="relative overflow-hidden rounded-lg" style={{ minHeight: 240 }}>
      <div key={'a' + i} className="cl-fadeup absolute inset-0"><Anh s={s} /></div>
      <div className="relative m-4 max-w-md rounded-md p-5 shadow-sm sm:m-6" style={{ background: t.bg === '#f3f5f8' ? '#fff' : t.bg, color: t.fg, border: t.vien }}>
        <Nhan s={s} t={t} /><p key={i} className="cl-fadeup mt-1 text-xl font-extrabold leading-snug">{s.tieuDe}</p><p className="mt-1 text-sm" style={{ color: t.mu }}>{s.mo}</p>
        <div className="mt-4 flex items-center justify-between gap-3"><Nut s={s} t={t} /><Cham i={i} set={set} t={t} /></div></div>
    </div>); } },
  { ten: 'Chia đôi 50/50: nửa màu · nửa ảnh', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'grid md:grid-cols-2')}>
      <div className="flex flex-col justify-center p-6 md:p-9"><Nhan s={s} t={t} /><p key={i} className="cl-fadeup mt-1.5 text-2xl font-extrabold leading-tight">{s.tieuDe}</p><p className="mt-2 text-sm" style={{ color: t.mu }}>{s.mo}</p><div className="mt-5 flex items-center gap-4"><Nut s={s} t={t} /><Cham i={i} set={set} t={t} /></div></div>
      <div key={'a' + i} className="cl-fadeup aspect-[16/9] md:aspect-auto"><Anh s={s} /></div>
    </div>); } },
  { ten: 'Ba cột đánh số lớn 01 · 02 · 03', ve: ({ tk }) => { const t0 = tk(DS[0]); return (
    <div {...khung(t0, 'grid md:grid-cols-3')}>{DS.map((s, k) => { const t = tk(s); return (
      <Link key={s.k} href={s.link} className="group block p-5 md:p-6" style={{ borderLeft: k ? `1px solid ${t0.ln}` : undefined }}>
        <p className="text-[34px] font-extrabold leading-none" style={{ color: t0.fg === '#fff' ? 'rgba(227,198,122,.55)' : '#d6dde8' }}>0{k + 1}</p>
        <p className="mt-2 text-[16px] font-extrabold leading-snug">{s.tieuDe}</p><p className="mt-1 text-[13px]" style={{ color: t0.mu }}>{s.mo}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: t0.fg === '#fff' ? '#E3C67A' : t.nut }}>{s.nut} <Mui /></span></Link>); })}</div>); } },
  { ten: 'Ba thẻ có vạch màu bên trái', ve: ({ tk }) => (
    <div className="grid gap-3 md:grid-cols-3">{DS.map((s) => { const t = tk(s); return (
      <Link key={s.k} href={s.link} {...khung(t, 'block p-5', { borderLeft: `4px solid ${t.fg === '#fff' ? '#E3C67A' : t.nut}` })}>
        <Nhan s={s} t={t} /><p className="mt-1 text-[16px] font-extrabold leading-snug">{s.tieuDe}</p><p className="mt-1 text-[13px]" style={{ color: t.mu }}>{s.ich.join(' · ')}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: t.fg === '#fff' ? '#E3C67A' : t.nut }}>{s.nut} <Mui /></span></Link>); })}</div>) },
  { ten: 'Căn giữa: tiêu đề lớn · 2 nút (kiểu lời mời cuối trang)', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'px-5 py-8 text-center sm:py-10')}>
      <div className="flex justify-center"><Ico k={s.k} c={t.nhan} n={30} /></div><Nhan s={s} t={t} cls="mt-3" />
      <p key={i} className="cl-fadeup mx-auto mt-1 max-w-2xl text-2xl font-extrabold leading-tight md:text-[30px]">{s.tieuDe}</p><p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: t.mu }}>{s.mo}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3"><Nut s={s} t={t} /><NutVien s={DS[(i + 1) % 3]} t={t} /></div>
      <div className="mt-5 flex justify-center"><Cham i={i} set={set} t={t} /></div>
    </div>); } },
  { ten: 'Thẻ to có mũi tên trái / phải', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); const nutTron = 'grid h-9 w-9 shrink-0 place-items-center rounded-full border transition hover:brightness-95'; return (
    <div {...khung(t, 'flex items-center gap-3 p-4 sm:gap-5 sm:p-5')}>
      <button type="button" onClick={() => set((i + 2) % 3)} className={nutTron} style={{ borderColor: t.ln, background: t.the }} aria-label="Trước"><span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}><Mui c={t.fg} /></span></button>
      <div key={i} className="cl-fadeup flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
        <div className="aspect-[16/10] w-full shrink-0 overflow-hidden rounded sm:w-44"><Anh s={s} /></div>
        <div className="min-w-0 flex-1"><Nhan s={s} t={t} /><p className="text-lg font-extrabold leading-snug">{s.tieuDe}</p><p className="mt-0.5 text-[13px]" style={{ color: t.mu }}>{s.mo}</p></div><Nut s={s} t={t} />
      </div>
      <button type="button" onClick={() => set((i + 1) % 3)} className={nutTron} style={{ borderColor: t.ln, background: t.the }} aria-label="Sau"><Mui c={t.fg} /></button>
    </div>); } },
  { ten: 'Ảnh tròn lớn bên phải · chữ trái', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'flex items-center gap-6 p-6 sm:px-9')}>
      <div className="min-w-0 flex-1"><Nhan s={s} t={t} /><p key={i} className="cl-fadeup mt-1 text-xl font-extrabold leading-snug md:text-[26px]">{s.tieuDe}</p><p className="mt-1.5 text-sm" style={{ color: t.mu }}>{s.mo}</p><div className="mt-4 flex items-center gap-4"><Nut s={s} t={t} /><Cham i={i} set={set} t={t} /></div></div>
      <div key={'a' + i} className="cl-fadeup hidden h-40 w-40 shrink-0 overflow-hidden rounded-full sm:block" style={{ boxShadow: `0 0 0 6px ${t.the === '#fff' ? '#fff' : t.ln}` }}><Anh s={s} /></div>
    </div>); } },
  { ten: 'Thanh tiến trình chạy dưới đáy (biết lúc nào đổi)', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'relative')}>
      <div key={i} className="cl-fadeup flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:px-7 sm:py-6"><Ico k={s.k} c={t.nhan} n={28} /><div className="flex-1"><Nhan s={s} t={t} /><p className="text-xl font-extrabold leading-snug">{s.tieuDe}</p><p className="mt-0.5 text-sm" style={{ color: t.mu }}>{s.mo}</p></div><Nut s={s} t={t} /></div>
      <div className="grid grid-cols-3 gap-1 px-5 pb-3 sm:px-7">{DS.map((x, k) => (
        <button key={x.k} type="button" onClick={() => set(k)} className="text-left"><span className="block h-[3px] overflow-hidden rounded" style={{ background: t.ln }}><span className="block h-full" style={{ width: k < i ? '100%' : k === i ? '100%' : '0%', background: t.fg === '#fff' ? '#E3C67A' : t.nut, transition: k === i ? 'width 6s linear' : 'none' }} /></span><span className="mt-1 block truncate text-[11px]" style={{ color: k === i ? t.fg : t.mu }}>{x.nhan}</span></button>))}</div>
    </div>); } },
  { ten: 'Ba ô kiểu ứng dụng: biểu tượng to trên · chữ dưới', ve: ({ tk }) => (
    <div className="grid grid-cols-3 gap-3">{DS.map((s) => { const t = tk(s); return (
      <Link key={s.k} href={s.link} {...khung(t, 'flex flex-col items-center p-4 text-center transition hover:-translate-y-0.5 sm:p-5')}>
        <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: t.fg === '#fff' ? 'rgba(255,255,255,.08)' : s.nhat }}><Ico k={s.k} c={t.nhan} n={28} /></span>
        <p className="mt-3 text-[13.5px] font-extrabold leading-snug sm:text-[15px]">{s.nhan}</p><p className="mt-0.5 hidden text-[12.5px] sm:block" style={{ color: t.mu }}>{s.tieuDe}</p></Link>); })}</div>) },
  { ten: '"Bạn là ai?" — ba cột theo người dùng', ve: ({ tk }) => { const t0 = tk(DS[0]); const ai = ['Người mua · nhà đầu tư', 'Người bán · môi giới', 'Chủ đầu tư · doanh nghiệp']; return (
    <div {...khung(t0, 'p-5 sm:p-6')}>
      <p className="text-[13px] font-bold uppercase tracking-[.12em]" style={{ color: t0.mu }}>Cam Lâm Land giúp gì cho bạn?</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">{DS.map((s, k) => { const t = tk(s); return (
        <Link key={s.k} href={s.link} className="group block rounded-md p-4 transition" style={{ background: t0.the, border: `1px solid ${t0.ln}` }}>
          <p className="text-[12px] font-semibold" style={{ color: t.nhan }}>{ai[k]}</p><p className="mt-0.5 text-[15.5px] font-extrabold leading-snug">{s.tieuDe}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: t0.fg === '#fff' ? '#E3C67A' : t.nut }}>{s.nut} <Mui /></span></Link>); })}</div>
    </div>); } },
  { ten: 'Thanh chọn kiểu nút gạt + nội dung', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'p-5 sm:p-6')}>
      <div className="inline-flex rounded-full p-1" style={{ background: t.fg === '#fff' ? 'rgba(255,255,255,.08)' : '#e9edf3' }}>{DS.map((x, k) => (
        <button key={x.k} type="button" onClick={() => set(k)} className="rounded-full px-3 py-1.5 text-[12.5px] font-bold transition" style={{ background: k === i ? (t.fg === '#fff' ? '#fff' : '#fff') : 'transparent', color: k === i ? '#0A2540' : t.mu, boxShadow: k === i ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>{x.nhan}</button>))}</div>
      <div key={i} className="cl-fadeup mt-4 flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="text-xl font-extrabold leading-snug md:text-2xl">{s.tieuDe}</p><p className="mt-1 text-sm" style={{ color: t.mu }}>{s.mo}</p></div><Nut s={s} t={t} /></div>
    </div>); } },
  { ten: 'Ảnh nền mờ · khung kính ở giữa', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); const toi = t.fg === '#fff'; return (
    <div className="relative overflow-hidden rounded-lg" style={{ minHeight: 230 }}>
      <div key={'a' + i} className="absolute inset-0 scale-110"><Anh s={s} st={{ filter: 'blur(14px) saturate(1.1)' }} /></div>
      <div className="absolute inset-0" style={{ background: toi ? 'rgba(10,37,64,.55)' : 'rgba(255,255,255,.35)' }} />
      <div className="relative mx-auto my-6 max-w-2xl rounded-lg p-6 text-center" style={{ background: toi ? 'rgba(10,37,64,.55)' : 'rgba(255,255,255,.78)', color: t.fg, backdropFilter: 'blur(6px)', border: `1px solid ${toi ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.9)'}` }}>
        <Nhan s={s} t={t} /><p key={i} className="cl-fadeup mt-1 text-xl font-extrabold leading-snug md:text-2xl">{s.tieuDe}</p><p className="mt-1.5 text-sm" style={{ color: t.mu }}>{s.mo}</p>
        <div className="mt-4 flex items-center justify-center gap-4"><Nut s={s} t={t} /><Cham i={i} set={set} t={t} /></div></div>
    </div>); } },
  { ten: 'Tiêu đề mục + 3 nút viền nhanh (gọn nhất)', ve: ({ tk }) => { const t0 = tk(DS[0]); return (
    <div {...khung(t0, 'flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:px-7')}>
      <div className="flex-1"><p className="text-lg font-extrabold leading-snug">Bắt đầu với Cam Lâm Land</p><p className="text-[13px]" style={{ color: t0.mu }}>Tra quy hoạch, đăng tin bán, hay quảng bá dự án — chọn việc bạn cần.</p></div>
      <div className="flex flex-wrap gap-2">{DS.map((s) => { const t = tk(s); return <Link key={s.k} href={s.link} className="inline-flex items-center gap-2 rounded border px-3.5 py-2 text-[13px] font-bold transition hover:brightness-95" style={{ borderColor: t0.fg === '#fff' ? 'rgba(255,255,255,.3)' : '#cbd5e1', background: t0.the, color: t0.fg }}><Ico k={s.k} c={t.nhan} n={17} />{s.nut}</Link>; })}</div>
    </div>); } },
  { ten: 'Nội dung chính trái · danh sách nội dung khác bên phải để bấm', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'grid md:grid-cols-[1.7fr_1fr]')}>
      <div key={i} className="cl-fadeup flex gap-5 p-5 sm:p-6"><div className="hidden aspect-square w-32 shrink-0 overflow-hidden rounded sm:block"><Anh s={s} /></div><div className="min-w-0"><Nhan s={s} t={t} /><p className="mt-1 text-xl font-extrabold leading-snug">{s.tieuDe}</p><p className="mt-1 text-sm" style={{ color: t.mu }}>{s.mo}</p><Nut s={s} t={t} cls="mt-4" /></div></div>
      <div className="border-t md:border-l md:border-t-0" style={{ borderColor: t.ln }}>{DS.map((x, k) => (
        <button key={x.k} type="button" onClick={() => set(k)} className="flex w-full items-center gap-3 border-b px-5 py-3.5 text-left last:border-b-0" style={{ borderColor: t.ln, background: k === i ? t.the : 'transparent' }}>
          <Ico k={x.k} c={k === i ? t.nhan : t.mu} n={18} /><span className="min-w-0 flex-1 truncate text-[13.5px] font-bold" style={{ color: k === i ? t.fg : t.mu }}>{x.nhan}</span>{k === i && <Mui c={t.mu} />}</button>))}</div>
    </div>); } },
  { ten: 'Hình minh hoạ nét to mờ ở góc · chữ lớn', ve: ({ i, set, tk }) => { const s = DS[i], t = tk(s); return (
    <div {...khung(t, 'relative p-6 sm:p-8')}>
      <div className="pointer-events-none absolute -right-6 -top-6 opacity-[.09]"><Ico k={s.k} c={t.fg} n={220} /></div>
      <div key={i} className="cl-fadeup relative max-w-2xl"><Nhan s={s} t={t} /><p className="mt-1 text-2xl font-extrabold leading-tight md:text-[30px]">{s.tieuDe}</p><p className="mt-2 text-sm" style={{ color: t.mu }}>{s.mo}</p></div>
      <div className="relative mt-5 flex items-center gap-4"><Nut s={s} t={t} /><Cham i={i} set={set} t={t} /></div>
    </div>); } },
];

export const SO_MAU_BN = BO_CUC.length * TONG.length; // 100

export default function MauPromo({ so }: { so: number }) {
  const [i, setI] = useState(0);
  const [dung, setDung] = useState(false);
  const [go, setGo] = useState(String(so));
  useEffect(() => { setGo(String(so)); }, [so]);
  useEffect(() => { if (dung) return; const t = setInterval(() => setI((k) => (k + 1) % DS.length), 6000); return () => clearInterval(t); }, [dung, i]);
  const bc = BO_CUC[Math.floor((so - 1) / TONG.length)];
  const tg = TONG[(so - 1) % TONG.length];
  const den = (n: number) => { const m = ((n - 1 + SO_MAU_BN) % SO_MAU_BN) + 1; location.href = `/?maubn=${m}#mau-bn`; };
  return (
    <section id="mau-bn" className="mx-auto max-w-7xl scroll-mt-24 px-3 py-6 sm:px-4" onMouseEnter={() => setDung(true)} onMouseLeave={() => setDung(false)}>
      {bc.ve({ i, set: setI, tk: tg.tk })}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ring-1 ring-amber-200">
        <button type="button" onClick={() => den(so - 1)} className="grid h-7 w-7 place-items-center rounded bg-white ring-1 ring-amber-200">‹</button>
        <form onSubmit={(e) => { e.preventDefault(); const n = Number(go); if (n >= 1 && n <= SO_MAU_BN) den(n); }} className="flex items-center gap-1">
          <b>Mẫu</b><input value={go} onChange={(e) => setGo(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="h-7 w-11 rounded border border-amber-300 bg-white text-center font-bold outline-none" /><span>/{SO_MAU_BN}</span>
        </form>
        <button type="button" onClick={() => den(so + 1)} className="grid h-7 w-7 place-items-center rounded bg-white ring-1 ring-amber-200">›</button>
        <span className="min-w-0 flex-1"><b>Bố cục {Math.floor((so - 1) / TONG.length) + 1}:</b> {bc.ten} · <b>Tông:</b> {tg.ten}</span>
      </div>
    </section>
  );
}
