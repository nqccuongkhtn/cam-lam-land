import Link from 'next/link';

const FEATURES = [
  { icon: '🏠', title: 'Nhà đất bán', desc: 'Mua bán đất nền, nhà riêng, căn hộ, biệt thự tại Cam Lâm — minh bạch pháp lý.' },
  { icon: '🔑', title: 'Nhà đất cho thuê', desc: 'Cho thuê nhà, mặt bằng kinh doanh, phòng trọ khu Cam Đức, Bãi Dài.' },
  { icon: '🗺️', title: 'Dự án & Quy hoạch', desc: 'Tra cứu quy hoạch sử dụng đất, dự án nổi bật, bản đồ nét đến z18.' },
  { icon: '🤝', title: 'Ký gửi & Tư vấn', desc: 'Ký gửi bán nhà đất, tư vấn đầu tư & pháp lý bất động sản miễn phí.' },
];

const LINKCOLS: { title: string; links: [string, string][] }[] = [
  { title: 'Nhà đất bán', links: [
    ['Bán đất nền', '/listings?propertyType=land'],
    ['Bán nhà riêng', '/listings?propertyType=house'],
    ['Bán biệt thự', '/listings?propertyType=villa'],
    ['Bán căn hộ', '/listings?propertyType=apartment'],
    ['Bán đất nông nghiệp', '/listings?propertyType=farm'],
    ['Xem thêm', '/listings'],
  ] },
  { title: 'Nhà đất cho thuê', links: [
    ['Cho thuê nhà nguyên căn', '/listings?q=cho thuê'],
    ['Cho thuê mặt bằng', '/listings?q=mặt bằng'],
    ['Cho thuê phòng trọ', '/listings?q=phòng trọ'],
    ['Cho thuê căn hộ', '/listings?q=căn hộ'],
    ['Xem thêm', '/listings'],
  ] },
  { title: 'Nhà đất theo khu vực', links: [
    ['Nhà đất Cam Đức', '/listings?ward=Cam Đức'],
    ['Bãi Dài, Cam Hải Đông', '/listings?ward=Cam Hải Đông'],
    ['Nhà đất Cam Thành Bắc', '/listings?ward=Cam Thành Bắc'],
    ['Nhà đất Suối Tân', '/listings?ward=Suối Tân'],
    ['Nhà đất Cam Hiệp Bắc', '/listings?ward=Cam Hiệp Bắc'],
    ['Xem thêm', '/listings'],
  ] },
  { title: 'Tiện ích & Dịch vụ', links: [
    ['Bản đồ quy hoạch', '/map'],
    ['Tra cứu QR thửa đất', '/qr'],
    ['Tin tức BĐS Cam Lâm', '/tin-tuc'],
    ['Đăng tin miễn phí', '/sales/post'],
    ['Dịch vụ quảng cáo', '/dichvu'],
  ] },
];

const STATS = [
  { n: '2,000+', l: 'Bất động sản', d: 'M3 21h18M5 21V7l6-4 6 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01' },
  { n: '5,000+', l: 'Khách hàng', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { n: '50+', l: 'Dự án quy hoạch', d: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { n: '8', l: 'Xã / Khu vực', d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
];

export default function SiteFooter() {
  return (
    <footer>
      {/* A. Dải tính năng nổi bật */}
      <div className="bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-10 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col items-center text-center sm:flex-row sm:text-left gap-3">
              <span className="w-12 h-12 shrink-0 grid place-items-center rounded-2xl bg-red-50 text-2xl">{f.icon}</span>
              <span>
                <span className="block font-bold text-[#0A2540]">{f.title}</span>
                <span className="block text-xs text-slate-500 mt-1 leading-snug">{f.desc}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* B. Cột liên kết theo loại / khu vực */}
      <div className="bg-white border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
          {LINKCOLS.map((col) => (
            <div key={col.title}>
              <h4 className="font-bold text-[#0A2540] text-sm mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}><Link href={href} className="text-[13px] text-slate-500 hover:text-red-600">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* C. Footer chính (nền tối) */}
      <div className="bg-[#0A2540] text-slate-300">
        <div className="border-b border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-9 grid grid-cols-2 lg:grid-cols-4 gap-y-7 gap-x-6">
            {STATS.map((s) => (
              <div key={s.l} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl grid place-items-center bg-white/[0.06] border border-[#C8A14B]/40 text-[#C8A14B] shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d={s.d} /></svg>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-extrabold text-white leading-none">{s.n}</div>
                  <div className="text-slate-400 text-xs mt-1">{s.l}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="sm:col-span-2">
            <p className="font-extrabold text-xl text-white">Cam Lâm <span className="text-[#C8A14B]">Land</span></p>
            <p className="text-sm mt-3 text-slate-400 max-w-sm">Nền tảng bất động sản &amp; bản đồ quy hoạch huyện Cam Lâm, Khánh Hòa — minh bạch, chính xác, hiện đại.</p>
            <a href="tel:0988888888" className="inline-flex items-center gap-1.5 text-lg font-extrabold text-[#C8A14B] hover:text-[#FFD56A] mt-4">📞 0988 888 888</a>
            <div className="flex gap-2 mt-4">
              <a href="#" aria-label="Facebook" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 font-bold">f</a>
              <a href="https://zalo.me/0988888888" target="_blank" rel="noreferrer" aria-label="Zalo" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-bold">Zalo</a>
              <a href="tel:0988888888" aria-label="Gọi điện" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20">☎</a>
            </div>
          </div>
          <div>
            <p className="font-semibold text-white mb-3">Hướng dẫn</p>
            <ul className="text-sm space-y-2 text-slate-400">
              <li><Link href="/listings" className="hover:text-[#C8A14B]">Nhà đất bán &amp; cho thuê</Link></li>
              <li><Link href="/map" className="hover:text-[#C8A14B]">Bản đồ quy hoạch</Link></li>
              <li><Link href="/qr" className="hover:text-[#C8A14B]">Tra cứu QR</Link></li>
              <li><Link href="/tin-tuc" className="hover:text-[#C8A14B]">Tin tức</Link></li>
              <li><Link href="/dichvu" className="hover:text-[#C8A14B]">Dịch vụ &amp; Bảng giá</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-3">Hỗ trợ</p>
            <ul className="text-sm space-y-2 text-slate-400">
              <li><Link href="/sales/post" className="hover:text-[#C8A14B]">Đăng tin miễn phí</Link></li>
              <li><Link href="/sales/post" className="hover:text-[#C8A14B]">Ký gửi nhà đất</Link></li>
              <li><Link href="/" className="hover:text-[#C8A14B]">Tư vấn đầu tư &amp; pháp lý</Link></li>
              <li><Link href="/dichvu" className="hover:text-[#C8A14B]">Quảng cáo trên bản đồ</Link></li>
              <li><Link href="/dichvu" className="hover:text-[#C8A14B]">Đẩy tin VIP</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-400 leading-relaxed">
            <b className="text-slate-200">CAM LÂM LAND</b> — Nền tảng bất động sản &amp; quy hoạch huyện Cam Lâm, tỉnh Khánh Hòa. Phát triển bởi Nguyễn Quốc Cường. Địa chỉ: Cam Lâm, Khánh Hòa · Hotline: 0988 888 888.
          </div>
        </div>
        <div className="border-t border-white/10 text-center text-xs text-slate-500 py-4">© 2026 Cam Lâm Land · Phát triển bởi Nguyễn Quốc Cường</div>
      </div>
    </footer>
  );
}
