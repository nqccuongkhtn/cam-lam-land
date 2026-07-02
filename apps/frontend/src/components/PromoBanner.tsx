'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Banner quảng cáo động: tự xoay qua nhiều slide (đổi màu) như batdongsan. Slide 1 giữ màu đỏ như cũ.
type Slide = { grad: string; dark?: boolean; badge: string; title: string; sub: string; cta: string; href: string; emoji: string };

const SLIDES: Slide[] = [
  { grad: 'from-[#c1121f] via-[#d81f26] to-[#e63946]', badge: 'MIỄN PHÍ ĐĂNG TIN', title: 'Bán nhà đất Cam Lâm nhanh hơn cùng Cam Lâm Land', sub: 'Hiển thị trên bản đồ quy hoạch · Tiếp cận đúng khách · Hỗ trợ pháp lý', cta: 'Đăng tin ngay', href: '/sales/post', emoji: '🚀' },
  { grad: 'from-[#e8c36b] via-[#d9a94e] to-[#c8912f]', dark: true, badge: 'DÀNH CHO DOANH NGHIỆP', title: 'Quảng bá thương hiệu & dự án của bạn tại Cam Lâm', sub: 'Banner trang chủ · Logo trên bản đồ · Đẩy tin nổi bật', cta: 'Xem dịch vụ', href: '/dichvu', emoji: '🏆' },
  { grad: 'from-[#0A2540] via-[#0d2f54] to-[#123a63]', badge: 'BẢN ĐỒ QUY HOẠCH', title: 'Tra cứu quy hoạch & thửa đất Cam Lâm chính xác', sub: 'Nền vệ tinh nét cao · Toạ độ VN-2000 · Đo đạc trực tiếp', cta: 'Mở bản đồ', href: '/map', emoji: '🗺️' },
];

export default function PromoBanner() {
  const [i, setI] = useState(0);
  const hoverRef = useRef(false);
  useEffect(() => {
    const iv = setInterval(() => { if (!hoverRef.current) setI((v) => (v + 1) % SLIDES.length); }, 5000);
    return () => clearInterval(iv);
  }, []);

  const s = SLIDES[i];
  const txt = s.dark ? 'text-[#0A2540]' : 'text-white';
  const btn = s.dark ? 'bg-[#0A2540] text-white hover:bg-[#0d2f54]' : 'bg-white text-[#0A2540] hover:bg-white/90';

  return (
    <section className="mx-auto max-w-7xl px-4 py-6" onMouseEnter={() => { hoverRef.current = true; }} onMouseLeave={() => { hoverRef.current = false; }}>
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${s.grad} ${txt} shadow-md transition-colors duration-500`}>
        <div className="absolute -right-12 -top-16 w-56 h-56 rounded-full bg-white/10" />
        <div className="absolute right-28 top-4 w-24 h-24 rounded-full bg-white/10" />
        <div className="relative flex flex-col sm:flex-row items-center gap-4 px-6 py-5 md:px-10 md:py-7 min-h-[140px]">
          <div className="flex-1 text-center sm:text-left">
            <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide ${s.dark ? 'bg-[#0A2540]/15' : 'bg-white/20'}`}>{s.badge}</span>
            <h3 className="mt-2 text-xl md:text-3xl font-extrabold leading-tight">{s.title}</h3>
            <p className={`mt-2 text-sm ${s.dark ? 'text-[#0A2540]/80' : 'text-white/90'}`}>{s.sub}</p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <div className="hidden md:block text-6xl select-none">{s.emoji}</div>
            <Link href={s.href} className={`font-bold text-sm px-6 py-2.5 rounded-xl whitespace-nowrap text-center shadow ${btn}`}>{s.cta}</Link>
          </div>
        </div>
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
          {SLIDES.map((_, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={`Chuyển slide ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? (s.dark ? 'bg-[#0A2540] w-5' : 'bg-white w-5') : (s.dark ? 'bg-[#0A2540]/40 w-1.5' : 'bg-white/50 w-1.5')}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
