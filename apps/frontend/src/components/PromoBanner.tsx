'use client';
import Link from 'next/link';

// Banner quảng cáo trang chủ (kiểu batdongsan). Hiện đang là self-promo dịch vụ Cam Lâm Land,
// có thể thay bằng banner quảng cáo trả phí sau này.
export default function PromoBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#c1121f] via-[#d81f26] to-[#e63946] text-white shadow-md">
        <div className="absolute -right-12 -top-16 w-56 h-56 rounded-full bg-white/10" />
        <div className="absolute right-28 top-4 w-24 h-24 rounded-full bg-white/10" />
        <div className="relative flex flex-col sm:flex-row items-center gap-4 px-6 py-5 md:px-10 md:py-6">
          <div className="flex-1 text-center sm:text-left">
            <span className="inline-block bg-white/20 backdrop-blur text-white text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide">MIỄN PHÍ ĐĂNG TIN</span>
            <h3 className="mt-2 text-xl md:text-3xl font-extrabold leading-tight">Bán nhà đất Cam Lâm nhanh hơn cùng Cam Lâm Land</h3>
            <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-x-5 gap-y-1 text-sm text-white/90">
              <span>✓ Hiển thị trên bản đồ quy hoạch</span>
              <span>✓ Tiếp cận đúng khách Cam Lâm</span>
              <span>✓ Hỗ trợ pháp lý &amp; định giá</span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <div className="hidden md:block text-6xl select-none">🚀</div>
            <div className="flex flex-col gap-2">
              <Link href="/sales/post" className="bg-white text-[#d81f26] font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-white/90 whitespace-nowrap text-center shadow">Đăng tin ngay</Link>
              <Link href="/dichvu" className="border border-white/70 text-white font-semibold text-xs px-6 py-2 rounded-xl hover:bg-white/10 whitespace-nowrap text-center">Quảng cáo thương hiệu</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
