'use client';
/* ============================================================================
 *  XEM THỬ 100 MẪU "CỤM CUỐI TRANG CHỦ" (6/10/2026, TẠM — DỄ GỠ)
 *  Phạm vi chủ dự án chốt: TỪ DẢI QUẢNG BÁ TRỞ XUỐNG = Dải quảng bá + Hỗ trợ tiện ích + Doanh nghiệp tiêu biểu.
 *  (Chân trang SiteFooter giữ nguyên.) Mở trang chủ kèm ?maucum=N (1–100). Không có tham số → web y như cũ.
 *
 *  DẢI QUẢNG BÁ và DOANH NGHIỆP TIÊU BIỂU GIỮ NGUYÊN (chủ dự án không cho đổi). Mỗi mẫu = MỘT TÔNG CHUNG (4 kiểu khung nền)
 *  + 1 trong 10 kiểu "Hỗ trợ tiện ích" → 40 mẫu. Cả cụm dùng chung màu chữ,
 *  màu thẻ, kiểu tiêu đề mục → nhìn liền một khối chứ không phải ba mảnh ghép.
 *  Ô công cụ trong bản xem thử chỉ dẫn sang /tien-ich; chọn xong mới nối lại hộp tính toán như bản thật.
 * ========================================================================== */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import PromoBanner from './PromoBanner';
import FeaturedPartners from './FeaturedPartners';

type Nen = { ten: string; ngoai: CSSProperties; fg: string; mu: string; the: string; ln: string; nhan: string; tongBn: number }; // tongBn: không còn dùng
// 4 kiểu khung nền cho CẢ CỤM (tongBn = tông dải quảng bá đi kèm cho hợp)
const NEN: Nen[] = [
  { ten: 'Nền trang như hiện tại', ngoai: {}, fg: '#0A2540', mu: '#64748b', the: '#fff', ln: '#e2e8f0', nhan: '#c8102e', tongBn: 0 },
  { ten: 'Cả cụm trên một dải TRẮNG có viền trên/dưới', ngoai: { background: '#fff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }, fg: '#0A2540', mu: '#64748b', the: '#f6f8fb', ln: '#e8edf3', nhan: '#c8102e', tongBn: 1 },
  { ten: 'Cả cụm trên một dải XANH ĐẬM (màu logo)', ngoai: { background: '#0A2540' }, fg: '#fff', mu: 'rgba(255,255,255,.62)', the: 'rgba(255,255,255,.06)', ln: 'rgba(255,255,255,.12)', nhan: '#E3C67A', tongBn: 2 },
  { ten: 'Cả cụm trên một dải KEM ấm', ngoai: { background: '#f7f3ea' }, fg: '#0A2540', mu: '#6b6457', the: '#fff', ln: '#e9e1d0', nhan: '#a8791f', tongBn: 3 },
];


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

export const SO_MAU_CUM = 40; // 4 nền × 10 kiểu tiện ích — doanh nghiệp giữ nguyên nên không còn đủ 100 mẫu khác nhau

export default function MauCum({ so }: { so: number }) {
  const m = so - 1;
  // Mẫu 1–10 nền 1, 11–20 nền 2, 21–30 nền 3, 31–40 nền 4; trong mỗi nhóm là đủ 10 kiểu tiện ích
  const n = NEN[Math.floor(m / 10)];
  const ti = TIEN_ICH[m % 10];
  const [go, setGo] = useState(String(so));
  useEffect(() => { setGo(String(so)); }, [so]);
  const den = (k: number) => { const x = ((k - 1 + SO_MAU_CUM) % SO_MAU_CUM) + 1; location.href = `/?maucum=${x}#mau-cum`; };
  return (
    <div id="mau-cum" className="scroll-mt-20">
      <div style={n.ngoai}>
        {/* Dải quảng bá GIỮ NGUYÊN thiết kế hiện tại (chủ dự án 6/10/2026: "không đổi phong cách thiết kế banner") */}
        <div className="pt-2 sm:pt-4"><PromoBanner /></div>
        <div className="mx-auto max-w-7xl space-y-10 px-3 pb-8 pt-4 sm:px-4 sm:pb-12">
          <section><TieuDe n={n} nho="Công cụ" to="Hỗ trợ tiện ích" />{ti.ve(n)}</section>
        </div>
      </div>
      {/* Doanh nghiệp tiêu biểu GIỮ NGUYÊN (dải logo dài, tự trượt) — chủ dự án 6/10/2026. Đặt ngoài dải nền
          vì tiêu đề của nó chữ xanh đậm, nằm trên nền xanh đậm sẽ chìm mất. */}
      <FeaturedPartners />
      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-[60] mx-auto mt-3 max-w-7xl px-3 md:bottom-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50/95 px-3 py-2 text-[12px] text-amber-900 shadow-lg ring-1 ring-amber-200 backdrop-blur">
          <button type="button" onClick={() => den(so - 1)} className="grid h-7 w-7 place-items-center rounded bg-white ring-1 ring-amber-200">‹</button>
          <form onSubmit={(e) => { e.preventDefault(); const x = Number(go); if (x >= 1 && x <= SO_MAU_CUM) den(x); }} className="flex items-center gap-1">
            <b>Mẫu</b><input value={go} onChange={(e) => setGo(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="h-7 w-11 rounded border border-amber-300 bg-white text-center font-bold outline-none" /><span>/{SO_MAU_CUM}</span>
          </form>
          <button type="button" onClick={() => den(so + 1)} className="grid h-7 w-7 place-items-center rounded bg-white ring-1 ring-amber-200">›</button>
          <span className="min-w-0 flex-1 leading-snug"><b>Nền:</b> {n.ten} · <b>Tiện ích:</b> {ti.ten}</span>
        </div>
      </div>
    </div>
  );
}
