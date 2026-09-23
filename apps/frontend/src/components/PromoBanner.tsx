'use client';
/* ============================================================================
 *  BANNER QUẢNG CÁO HTML5 ĐỘNG (khối giữa trang chủ)
 * ----------------------------------------------------------------------------
 *  Trước đây khối này chỉ đổi màu nền và đổi chữ, minh hoạ bằng emoji. Nay làm
 *  thành banner quảng cáo động thật: nền trôi, vệt sáng quét, chữ hiện lần
 *  lượt, nút loé sáng, hình vẽ vector cử động.
 *
 *  VÌ SAO BỎ EMOJI: mỗi máy vẽ emoji một kiểu (Windows, Android, iPhone khác
 *  hẳn nhau), lại không cử động được. Hình vẽ vector thì máy nào cũng như nhau,
 *  nét ở mọi cỡ màn hình và cho chạy hiệu ứng được.
 *
 *  GIỮ CHO NHẸ MÁY — ba chỗ tự tắt, đừng bỏ:
 *   · banner bị cuộn ra khỏi màn hình  → gỡ lớp `chay`, mọi hiệu ứng dừng;
 *   · người dùng đổi sang tab khác     → dừng;
 *   · rê chuột vào banner              → ngưng tự đổi slide, cho người ta đọc.
 * ========================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import './promo.css';

type Slide = {
  nen: string;        // dải màu nền
  chuToi?: boolean;   // nền sáng thì chữ phải tối
  nhan: string;
  tieuDe: string;
  mo: string;
  nut: string;
  duong: string;
  hinh: 'tenlua' | 'cup' | 'bando';
};

const SLIDES: Slide[] = [
  {
    nen: 'linear-gradient(120deg,#c1121f 0%,#d81f26 45%,#e63946 100%)',
    nhan: 'MIỄN PHÍ ĐĂNG TIN',
    tieuDe: 'Bán nhà đất Cam Lâm nhanh hơn cùng Cam Lâm Land',
    mo: 'Hiển thị trên bản đồ quy hoạch · Tiếp cận đúng khách · Hỗ trợ pháp lý',
    nut: 'Đăng tin ngay', duong: '/sales/post', hinh: 'tenlua',
  },
  {
    nen: 'linear-gradient(120deg,#d6a445 0%,#c8912f 45%,#b07d22 100%)',
    chuToi: true,
    nhan: 'DÀNH CHO DOANH NGHIỆP',
    tieuDe: 'Quảng bá thương hiệu & dự án của bạn tại Cam Lâm',
    mo: 'Banner trang chủ · Logo trên bản đồ · Đẩy tin nổi bật',
    nut: 'Xem dịch vụ', duong: '/dichvu', hinh: 'cup',
  },
  {
    nen: 'linear-gradient(120deg,#0A2540 0%,#0d2f54 45%,#123a63 100%)',
    nhan: 'BẢN ĐỒ QUY HOẠCH',
    tieuDe: 'Tra cứu quy hoạch & thửa đất Cam Lâm chính xác',
    mo: 'Nền vệ tinh nét cao · Toạ độ VN-2000 · Đo đạc trực tiếp',
    nut: 'Mở bản đồ', duong: '/map', hinh: 'bando',
  },
];

/* ── Ba hình vẽ vector, mỗi hình có một chi tiết cử động riêng ─────────────── */
function Hinh({ loai, toi }: { loai: Slide['hinh']; toi?: boolean }) {
  const net = toi ? '#0A2540' : '#fff';
  const nhat = toi ? 'rgba(10,37,64,.28)' : 'rgba(255,255,255,.28)';
  if (loai === 'tenlua') {
    return (
      <svg viewBox="0 0 96 96" className="cl-qc-hinh h-20 w-20 md:h-24 md:w-24" aria-hidden="true">
        <circle cx="48" cy="48" r="44" fill={nhat} />
        <g className="cl-qc-bay">
          <path d="M48 20c9 8 13 18 13 29l-7 8H42l-7-8c0-11 4-21 13-29Z" fill={net} />
          <circle cx="48" cy="44" r="5.5" fill={toi ? '#d6a445' : '#c1121f'} />
          <path d="M35 49 26 62l11-3Zm26 0 9 13-11-3Z" fill={net} opacity=".85" />
          <path d="M44 65h8l-4 11Z" fill={toi ? '#0A2540' : '#ffd166'} />
        </g>
      </svg>
    );
  }
  if (loai === 'cup') {
    return (
      <svg viewBox="0 0 96 96" className="cl-qc-hinh h-20 w-20 md:h-24 md:w-24" aria-hidden="true">
        <circle cx="48" cy="48" r="44" fill={nhat} />
        <g className="cl-qc-lac">
          <path d="M34 22h28v14a14 14 0 0 1-28 0V22Z" fill={net} />
          <path d="M34 26h-7a9 9 0 0 0 9 9m26-9h7a9 9 0 0 1-9 9" stroke={net} strokeWidth="3.4" fill="none" />
          <path d="M44 50h8v10h-8z" fill={net} />
          <rect x="36" y="60" width="24" height="6" rx="3" fill={net} />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 96 96" className="cl-qc-hinh h-20 w-20 md:h-24 md:w-24" aria-hidden="true">
      <circle cx="48" cy="48" r="44" fill={nhat} />
      <path d="M22 32l17-7 18 7 17-7v39l-17 7-18-7-17 7V32Z" fill={net} opacity=".9" />
      <path d="M39 25v39m18-32v39" stroke={toi ? '#d6a445' : '#0A2540'} strokeWidth="2.2" opacity=".55" />
      <g className="cl-qc-nhun">
        <path d="M48 36a8 8 0 0 0-8 8c0 6 8 14 8 14s8-8 8-14a8 8 0 0 0-8-8Z" fill={toi ? '#c1121f' : '#e63946'} />
        <circle cx="48" cy="44" r="3" fill="#fff" />
      </g>
    </svg>
  );
}

export default function PromoBanner() {
  const [i, setI] = useState(0);
  const [chay, setChay] = useState(false);     // có đang cho hiệu ứng chạy không
  const dungRe = useRef(false);                // chuột đang rê vào banner
  const boc = useRef<HTMLDivElement | null>(null);

  /* Tự đổi slide, nhưng ngưng khi chuột đang rê vào hoặc hiệu ứng đang tắt */
  useEffect(() => {
    const id = setInterval(() => {
      if (!dungRe.current && !document.hidden) setI((v) => (v + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  /* Chỉ chạy hiệu ứng khi banner ĐANG NẰM TRONG MÀN HÌNH và tab đang mở.
     Cuộn qua rồi thì tắt — đỡ tốn pin, nhất là trên điện thoại. */
  useEffect(() => {
    const el = boc.current;
    if (!el) return;
    let thay = false;
    const tinh = () => setChay(thay && !document.hidden);
    const io = new IntersectionObserver((e) => { thay = e[0]?.isIntersecting ?? false; tinh(); }, { threshold: 0.25 });
    io.observe(el);
    document.addEventListener('visibilitychange', tinh);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', tinh); };
  }, []);

  const s = SLIDES[i];
  const mauChu = s.chuToi ? 'text-[#0A2540]' : 'text-white';
  const mauNut = s.chuToi ? 'bg-[#0A2540] text-white' : 'bg-white text-[#0A2540]';
  const doi = useCallback((k: number) => setI(k), []);

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div
        ref={boc}
        className={`cl-qc shadow-md ${chay ? 'chay' : ''} ${mauChu}`}
        onMouseEnter={() => { dungRe.current = true; }}
        onMouseLeave={() => { dungRe.current = false; }}
      >
        <div className="cl-qc-nen" style={{ backgroundImage: s.nen }} />
        <div className="cl-qc-tron" style={{ right: '-56px', top: '-64px', width: '224px', height: '224px', ['--lau' as string]: '9s' }} />
        <div className="cl-qc-tron" style={{ right: '112px', top: '16px', width: '96px', height: '96px', ['--lau' as string]: '7s' }} />
        <div className="cl-qc-quet" />

        {/* key={i} để mỗi lần đổi slide là chạy lại hiệu ứng từ đầu */}
        <div key={i} className="cl-qc-vao relative z-[3] flex min-h-[140px] flex-col items-center gap-4 px-6 py-5 sm:flex-row md:px-10 md:py-7">
          <div className="cl-qc-chu flex-1 text-center sm:text-left">
            <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${s.chuToi ? 'bg-[#0A2540]/15' : 'bg-white/20'}`}>{s.nhan}</span>
            <h3 className="mt-2 text-xl font-extrabold leading-tight md:text-3xl">{s.tieuDe}</h3>
            <p className={`mt-2 text-sm ${s.chuToi ? 'font-medium' : 'text-white/90'}`}>{s.mo}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden md:block"><Hinh loai={s.hinh} toi={s.chuToi} /></div>
            <Link href={s.duong}
              className={`cl-qc-nut whitespace-nowrap rounded-xl px-6 py-2.5 text-center text-sm font-bold shadow ${mauNut}`}>
              {s.nut}
            </Link>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-2.5 z-[4] flex justify-center gap-1.5">
          {SLIDES.map((_, k) => (
            <button key={k} onClick={() => doi(k)} aria-label={`Xem quảng cáo ${k + 1}`} aria-current={k === i}
              className={`h-1.5 rounded-full transition-all ${k === i
                ? (s.chuToi ? 'w-5 bg-[#0A2540]' : 'w-5 bg-white')
                : (s.chuToi ? 'w-1.5 bg-[#0A2540]/40' : 'w-1.5 bg-white/50')}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
