'use client';
/* ============================================================================
 *  XEM THỬ 100 MẪU "CỤM CUỐI TRANG CHỦ" (6/10/2026, TẠM — DỄ GỠ)
 *  Phạm vi chủ dự án chốt: TỪ DẢI QUẢNG BÁ TRỞ XUỐNG = Dải quảng bá + Hỗ trợ tiện ích + Doanh nghiệp tiêu biểu.
 *  (Chân trang SiteFooter giữ nguyên.) Mở trang chủ kèm ?maucum=N (1–100). Không có tham số → web y như cũ.
 *
 *  Mỗi mẫu = MỘT TÔNG CHUNG cho cả cụm (4 kiểu khung nền) + 1 trong 25 bố cục dải quảng bá (MauPromo.tsx)
 *  + 1 trong 10 kiểu "Hỗ trợ tiện ích" + 1 trong 5 kiểu "Doanh nghiệp tiêu biểu". Cả cụm dùng chung màu chữ,
 *  màu thẻ, kiểu tiêu đề mục → nhìn liền một khối chứ không phải ba mảnh ghép.
 *  Doanh nghiệp: mọi kiểu đều KHÔNG LẶP logo (bản cũ lặp Cam Lâm Land / Vingroup 3 lần → nhìn như hàng giả).
 *  Ô công cụ trong bản xem thử chỉ dẫn sang /tien-ich; chọn xong mới nối lại hộp tính toán như bản thật.
 * ========================================================================== */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { BO_CUC, TONG, DS, type Tk } from './MauPromo';

type Nen = { ten: string; ngoai: CSSProperties; fg: string; mu: string; the: string; ln: string; nhan: string; tongBn: number };
// 4 kiểu khung nền cho CẢ CỤM (tongBn = tông dải quảng bá đi kèm cho hợp)
const NEN: Nen[] = [
  { ten: 'Nền trang như hiện tại', ngoai: {}, fg: '#0A2540', mu: '#64748b', the: '#fff', ln: '#e2e8f0', nhan: '#c8102e', tongBn: 0 },
  { ten: 'Cả cụm trên một dải TRẮNG có viền trên/dưới', ngoai: { background: '#fff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }, fg: '#0A2540', mu: '#64748b', the: '#f6f8fb', ln: '#e8edf3', nhan: '#c8102e', tongBn: 1 },
  { ten: 'Cả cụm trên một dải XANH ĐẬM (màu logo)', ngoai: { background: '#0A2540' }, fg: '#fff', mu: 'rgba(255,255,255,.62)', the: 'rgba(255,255,255,.06)', ln: 'rgba(255,255,255,.12)', nhan: '#E3C67A', tongBn: 2 },
  { ten: 'Cả cụm trên một dải KEM ấm', ngoai: { background: '#f7f3ea' }, fg: '#0A2540', mu: '#6b6457', the: '#fff', ln: '#e9e1d0', nhan: '#a8791f', tongBn: 3 },
];

// Tông cho dải quảng bá khi nằm trên dải xanh đậm: thẻ sáng hơn nền một chút để còn thấy khung
const tkTrenNen = (n: Nen, base: (s: typeof DS[number]) => Tk) => (s: typeof DS[number]): Tk => {
  const t = base(s);
  if (n.tongBn === 2) return { ...t, bg: '#0f2f50', vien: '1px solid rgba(255,255,255,.1)' };
  if (n.tongBn === 1) return { ...t, bg: '#f3f5f8' };
  return t;
};

const TOOLS = [
  { k: 'age', icon: '☯️', t: 'Xem tuổi xây nhà', d: 'Kim Lâu · Hoang Ốc · Tam Tai', mau: '#f3eefe' },
  { k: 'cost', icon: '🏗️', t: 'Chi phí làm nhà', d: 'Ước tính theo m² & số tầng', mau: '#fef3e6' },
  { k: 'loan', icon: '🧮', t: 'Tính vay mua nhà', d: 'Số cần vay & trả góp/tháng', mau: '#e9f6f1' },
  { k: 'fs', icon: '🧭', t: 'Tư vấn phong thủy', d: 'Hướng nhà hợp tuổi', mau: '#eaf2fd' },
];
const Mui = ({ c }: { c: string }) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const TieuDe = ({ n, nho, to, phai }: { n: Nen; nho: string; to: string; phai?: ReactNode }) => (
  <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
    <div><p className="text-[10.5px] font-extrabold uppercase tracking-[.12em] sm:text-[11px]" style={{ color: n.nhan }}>{nho}</p><h2 className="text-xl font-extrabold md:text-2xl" style={{ color: n.fg }}>{to}</h2></div>{phai}
  </div>
);
const vienThe = (n: Nen): CSSProperties => ({ background: n.the, border: `1px solid ${n.ln}`, color: n.fg });
const toi = (n: Nen) => n.fg === '#fff';

// ── 10 kiểu "Hỗ trợ tiện ích" ──
const TIEN_ICH: { ten: string; ve: (n: Nen) => ReactNode }[] = [
  { ten: '4 ô viền, biểu tượng tròn giữa (như hiện tại, gọn hơn)', ve: (n) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{TOOLS.map((t) => (
      <Link key={t.k} href="/tien-ich" className="flex flex-col items-center rounded-lg px-3 py-5 text-center transition hover:-translate-y-0.5" style={vienThe(n)}>
        <span className="grid h-14 w-14 place-items-center rounded-full text-2xl" style={{ background: toi(n) ? 'rgba(255,255,255,.08)' : '#f8fafc' }}>{t.icon}</span>
        <span className="mt-2.5 text-sm font-bold">{t.t}</span><span className="mt-0.5 text-[11.5px]" style={{ color: n.mu }}>{t.d}</span></Link>))}</div>) },
  { ten: '4 ô ngang: biểu tượng vuông trái · chữ phải', ve: (n) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{TOOLS.map((t) => (
      <Link key={t.k} href="/tien-ich" className="flex items-center gap-3 rounded-lg p-3.5 transition hover:-translate-y-0.5" style={vienThe(n)}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-xl" style={{ background: toi(n) ? 'rgba(255,255,255,.08)' : t.mau }}>{t.icon}</span>
        <span className="min-w-0"><span className="block text-[14px] font-bold">{t.t}</span><span className="block truncate text-[12px]" style={{ color: n.mu }}>{t.d}</span></span></Link>))}</div>) },
  { ten: 'Một khung chia 4 cột bằng vạch dọc (không viền từng ô)', ve: (n) => (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg sm:grid-cols-4" style={vienThe(n)}>{TOOLS.map((t, k) => (
      <Link key={t.k} href="/tien-ich" className="flex flex-col items-center px-3 py-5 text-center transition hover:brightness-95" style={{ borderLeft: k % 4 ? `1px solid ${n.ln}` : undefined, borderTop: k > 1 ? `1px solid ${n.ln}` : undefined }}>
        <span className="text-[28px] leading-none">{t.icon}</span><span className="mt-2 text-sm font-bold">{t.t}</span><span className="mt-0.5 text-[11.5px]" style={{ color: n.mu }}>{t.d}</span></Link>))}</div>) },
  { ten: 'Danh sách 2 cột có mũi tên (gọn như menu)', ve: (n) => (
    <div className="grid overflow-hidden rounded-lg sm:grid-cols-2" style={vienThe(n)}>{TOOLS.map((t, k) => (
      <Link key={t.k} href="/tien-ich" className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: k ? `1px solid ${n.ln}` : undefined }}>
        <span className="text-xl">{t.icon}</span><span className="min-w-0 flex-1"><span className="block text-[14.5px] font-bold">{t.t}</span><span className="block text-[12px]" style={{ color: n.mu }}>{t.d}</span></span><Mui c={n.mu} /></Link>))}</div>) },
  { ten: '4 ô nền màu nhạt khác nhau, không viền', ve: (n) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{TOOLS.map((t) => (
      <Link key={t.k} href="/tien-ich" className="rounded-lg p-4 transition hover:-translate-y-0.5" style={{ background: toi(n) ? 'rgba(255,255,255,.07)' : t.mau, color: n.fg }}>
        <span className="text-[26px] leading-none">{t.icon}</span><span className="mt-3 block text-[15px] font-bold">{t.t}</span><span className="mt-0.5 block text-[12px]" style={{ color: n.mu }}>{t.d}</span></Link>))}</div>) },
  { ten: 'Tối giản: biểu tượng to, không khung, chữ dưới', ve: (n) => (
    <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">{TOOLS.map((t) => (
      <Link key={t.k} href="/tien-ich" className="group flex flex-col items-center text-center">
        <span className="text-[38px] leading-none transition group-hover:-translate-y-0.5">{t.icon}</span><span className="mt-2 text-[14.5px] font-bold" style={{ color: n.fg }}>{t.t}</span><span className="mt-0.5 text-[12px]" style={{ color: n.mu }}>{t.d}</span></Link>))}</div>) },
  { ten: 'Thẻ có mô tả + chữ "Dùng ngay →"', ve: (n) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{TOOLS.map((t) => (
      <Link key={t.k} href="/tien-ich" className="flex flex-col rounded-lg p-4 transition hover:-translate-y-0.5" style={vienThe(n)}>
        <span className="text-2xl">{t.icon}</span><span className="mt-2 text-[15px] font-bold">{t.t}</span><span className="mt-0.5 flex-1 text-[12.5px]" style={{ color: n.mu }}>{t.d} — miễn phí, có kết quả ngay.</span>
        <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: n.nhan }}>Dùng ngay <Mui c={n.nhan} /></span></Link>))}</div>) },
  { ten: 'Một hàng nút bo tròn gọn (ít chỗ nhất)', ve: (n) => (
    <div className="flex flex-wrap gap-2.5">{TOOLS.map((t) => (
      <Link key={t.k} href="/tien-ich" className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-bold transition hover:-translate-y-0.5" style={vienThe(n)}><span className="text-lg">{t.icon}</span>{t.t}</Link>))}
      <Link href="/tien-ich" className="inline-flex items-center gap-1 px-2 py-2.5 text-[13.5px] font-bold" style={{ color: n.nhan }}>Tất cả công cụ <Mui c={n.nhan} /></Link></div>) },
  { ten: 'Lời giới thiệu bên trái · lưới 2×2 bên phải', ve: (n) => (
    <div className="grid gap-5 lg:grid-cols-[1fr_2fr] lg:items-center">
      <div><p className="text-[15px] leading-relaxed" style={{ color: n.mu }}>Tính nhanh trước khi xuống tiền: tuổi xây nhà, chi phí làm nhà, khoản vay và hướng nhà hợp tuổi.</p>
        <Link href="/tien-ich" className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-bold" style={{ color: n.nhan }}>Xem tất cả công cụ <Mui c={n.nhan} /></Link></div>
      <div className="grid grid-cols-2 gap-3">{TOOLS.map((t) => (
        <Link key={t.k} href="/tien-ich" className="flex items-center gap-3 rounded-lg p-3.5" style={vienThe(n)}><span className="text-2xl">{t.icon}</span><span className="text-[14px] font-bold leading-snug">{t.t}</span></Link>))}</div>
    </div>) },
  { ten: '4 thẻ đánh số 01–04', ve: (n) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{TOOLS.map((t, k) => (
      <Link key={t.k} href="/tien-ich" className="relative overflow-hidden rounded-lg p-4" style={vienThe(n)}>
        <span className="absolute right-3 top-2 text-[30px] font-extrabold leading-none" style={{ color: toi(n) ? 'rgba(255,255,255,.1)' : '#e8edf3' }}>0{k + 1}</span>
        <span className="text-2xl">{t.icon}</span><span className="mt-2 block text-[14.5px] font-bold">{t.t}</span><span className="mt-0.5 block text-[12px]" style={{ color: n.mu }}>{t.d}</span></Link>))}</div>) },
];

// ── Doanh nghiệp: logo hoặc chữ thay logo (KHÔNG LẶP) ──
type Dn = { id: number; name: string; logoUrl?: string | null };
const ChuLogo = ({ p, n, co = 20 }: { p: Dn; n: Nen; co?: number }) => {
  if (p.logoUrl) return /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.logoUrl} alt={p.name} className="max-h-10 max-w-[150px] object-contain" style={{ filter: toi(n) ? 'brightness(0) invert(1)' : 'grayscale(1)', opacity: .8 }} />;
  const ten = p.name.trim().toLowerCase();
  if (ten === 'cam lâm land') return <span className="whitespace-nowrap font-extrabold tracking-tight" style={{ fontSize: co, color: n.fg }}>Cam Lâm <span style={{ color: '#C8A14B' }}>Land</span></span>;
  if (ten === 'vingroup') return <span className="whitespace-nowrap font-serif font-bold tracking-tight" style={{ fontSize: co, color: toi(n) ? '#fff' : '#475569' }}>Vin<span style={{ color: toi(n) ? '#f2a3ab' : '#b01e2e' }}>group</span></span>;
  return <span className="font-bold" style={{ fontSize: co - 3, color: n.mu }}>{p.name}</span>;
};
const DOANH_NGHIEP: { ten: string; ve: (n: Nen, ds: Dn[]) => ReactNode }[] = [
  { ten: 'Dải logo mờ không khung, căn giữa', ve: (n, ds) => (
    <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 py-2" style={{ opacity: .85 }}>{ds.map((p) => <ChuLogo key={p.id} p={p} n={n} />)}</div>) },
  { ten: 'Lưới ô có khung + ô "Trở thành đối tác"', ve: (n, ds) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{ds.map((p) => <div key={p.id} className="grid h-20 place-items-center rounded-lg px-3" style={vienThe(n)}><ChuLogo p={p} n={n} /></div>)}
      <Link href="/dichvu" className="grid h-20 place-items-center rounded-lg border-2 border-dashed px-3 text-center text-[13px] font-bold" style={{ borderColor: n.ln, color: n.mu }}>+ Trở thành đối tác</Link></div>) },
  { ten: 'Một dòng: "Đồng hành cùng chúng tôi" + logo nhỏ', ve: (n, ds) => (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg px-5 py-4" style={vienThe(n)}>
      <span className="text-[13px] font-semibold" style={{ color: n.mu }}>Đồng hành cùng Cam Lâm Land:</span>{ds.map((p) => <ChuLogo key={p.id} p={p} n={n} co={17} />)}</div>) },
  { ten: 'Khung logo + nút "Liên hệ hợp tác" bên phải', ve: (n, ds) => (
    <div className="flex flex-col gap-4 rounded-lg p-5 sm:flex-row sm:items-center" style={vienThe(n)}>
      <div className="flex flex-1 flex-wrap items-center gap-x-10 gap-y-3">{ds.map((p) => <ChuLogo key={p.id} p={p} n={n} />)}</div>
      <Link href="/dichvu" className="inline-flex shrink-0 items-center gap-1.5 rounded px-4 py-2 text-[13.5px] font-bold" style={{ background: toi(n) ? '#C8A14B' : '#0A2540', color: toi(n) ? '#0A2540' : '#fff' }}>Liên hệ hợp tác <Mui c={toi(n) ? '#0A2540' : '#fff'} /></Link></div>) },
  { ten: 'Căn giữa: logo to + một câu giới thiệu', ve: (n, ds) => (
    <div className="text-center"><div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-4">{ds.map((p) => <ChuLogo key={p.id} p={p} n={n} co={24} />)}</div>
      <p className="mx-auto mt-4 max-w-xl text-[13.5px]" style={{ color: n.mu }}>Các chủ đầu tư, đơn vị phát triển dự án đang đồng hành cùng Cam Lâm Land. <Link href="/dichvu" className="font-bold underline" style={{ color: n.nhan }}>Hợp tác với chúng tôi</Link></p></div>) },
];

export const SO_MAU_CUM = 100;

export default function MauCum({ so }: { so: number }) {
  const m = so - 1;
  const n = NEN[Math.floor(m / 25)];
  const bc = BO_CUC[m % 25];
  const ti = TIEN_ICH[(m + Math.floor(m / 25) * 3) % TIEN_ICH.length];
  const dn = DOANH_NGHIEP[(m + Math.floor(m / 25)) % DOANH_NGHIEP.length];
  const [i, setI] = useState(0);
  const [dung, setDung] = useState(false);
  const [ds, setDs] = useState<Dn[]>([]);
  const [go, setGo] = useState(String(so));
  useEffect(() => { setGo(String(so)); }, [so]);
  useEffect(() => { if (dung) return; const t = setInterval(() => setI((k) => (k + 1) % DS.length), 6000); return () => clearInterval(t); }, [dung, i]);
  useEffect(() => {
    fetch('/api/partners').then((r) => r.json()).then((d) => {
      const a: Dn[] = Array.isArray(d?.partners) ? d.partners : [];
      const thay = new Set<string>(); const duy = a.filter((p) => { const k = p.name.trim().toLowerCase(); if (thay.has(k)) return false; thay.add(k); return true; });
      setDs(duy.length ? duy : [{ id: -1, name: 'Cam Lâm Land' }, { id: -2, name: 'Vingroup' }]);
    }).catch(() => setDs([{ id: -1, name: 'Cam Lâm Land' }, { id: -2, name: 'Vingroup' }]));
  }, []);
  const den = (k: number) => { const x = ((k - 1 + SO_MAU_CUM) % SO_MAU_CUM) + 1; location.href = `/?maucum=${x}#mau-cum`; };
  return (
    <div id="mau-cum" className="scroll-mt-20">
      <div style={n.ngoai}>
        <div className="mx-auto max-w-7xl space-y-10 px-3 py-8 sm:px-4 sm:py-12" onMouseEnter={() => setDung(true)} onMouseLeave={() => setDung(false)}>
          {bc.ve({ i, set: setI, tk: tkTrenNen(n, TONG[n.tongBn].tk) })}
          <section><TieuDe n={n} nho="Công cụ" to="Hỗ trợ tiện ích" />{ti.ve(n)}</section>
          <section><TieuDe n={n} nho="Đối tác" to="Doanh nghiệp tiêu biểu" />{dn.ve(n, ds)}</section>
        </div>
      </div>
      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-[60] mx-auto mt-3 max-w-7xl px-3 md:bottom-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50/95 px-3 py-2 text-[12px] text-amber-900 shadow-lg ring-1 ring-amber-200 backdrop-blur">
          <button type="button" onClick={() => den(so - 1)} className="grid h-7 w-7 place-items-center rounded bg-white ring-1 ring-amber-200">‹</button>
          <form onSubmit={(e) => { e.preventDefault(); const x = Number(go); if (x >= 1 && x <= SO_MAU_CUM) den(x); }} className="flex items-center gap-1">
            <b>Mẫu</b><input value={go} onChange={(e) => setGo(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="h-7 w-11 rounded border border-amber-300 bg-white text-center font-bold outline-none" /><span>/{SO_MAU_CUM}</span>
          </form>
          <button type="button" onClick={() => den(so + 1)} className="grid h-7 w-7 place-items-center rounded bg-white ring-1 ring-amber-200">›</button>
          <span className="min-w-0 flex-1 leading-snug"><b>Nền:</b> {n.ten} · <b>Quảng bá:</b> {bc.ten} · <b>Tiện ích:</b> {ti.ten} · <b>Đối tác:</b> {dn.ten}</span>
        </div>
      </div>
    </div>
  );
}
