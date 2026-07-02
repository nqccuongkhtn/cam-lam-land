'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';

const FEATURES = [
  { icon: '🏠', title: 'Nhà đất bán', desc: 'Mua bán đất nền, nhà riêng, căn hộ, biệt thự tại Cam Lâm — minh bạch pháp lý.' },
  { icon: '🔑', title: 'Nhà đất cho thuê', desc: 'Cho thuê nhà, mặt bằng kinh doanh, phòng trọ khu Cam Đức, Bãi Dài.' },
  { icon: '🗺️', title: 'Dự án & Quy hoạch', desc: 'Tra cứu quy hoạch sử dụng đất, dự án nổi bật, bản đồ nét đến z18.' },
  { icon: '🤝', title: 'Ký gửi & Tư vấn', desc: 'Ký gửi bán nhà đất, tư vấn đầu tư & pháp lý bất động sản miễn phí.' },
];

const PARTNERS = ['Sàn giao dịch BĐS', 'Chủ đầu tư dự án', 'Ngân hàng hỗ trợ vay', 'Văn phòng công chứng', 'Đo đạc – Bản đồ GIS', 'Nhà thầu xây dựng'];

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
  { title: 'Dự án nổi bật', links: [
    ['Đô thị sân bay Cam Lâm', '/map'],
    ['Khu du lịch Bãi Dài', '/map'],
    ['Khu đô thị Cam Đức', '/map'],
    ['Bản đồ quy hoạch', '/map'],
    ['Xem thêm', '/map'],
  ] },
  { title: 'Nhà đất bán theo khu vực', links: [
    ['Nhà đất Cam Đức', '/listings?ward=Cam Đức'],
    ['Bãi Dài, Cam Hải Đông', '/listings?ward=Cam Hải Đông'],
    ['Nhà đất Cam Thành Bắc', '/listings?ward=Cam Thành Bắc'],
    ['Nhà đất Suối Tân', '/listings?ward=Suối Tân'],
    ['Nhà đất Cam Hiệp Bắc', '/listings?ward=Cam Hiệp Bắc'],
    ['Xem thêm', '/listings'],
  ] },
  { title: 'Nhà đất cho thuê theo khu vực', links: [
    ['Cho thuê Cam Đức', '/listings?ward=Cam Đức&q=cho thuê'],
    ['Cho thuê Bãi Dài', '/listings?ward=Cam Hải Đông&q=cho thuê'],
    ['Cho thuê Cam Thành Bắc', '/listings?ward=Cam Thành Bắc&q=cho thuê'],
    ['Cho thuê Suối Tân', '/listings?ward=Suối Tân&q=cho thuê'],
    ['Xem thêm', '/listings?q=cho thuê'],
  ] },
  { title: 'Nhà đất Khánh Hòa', links: [
    ['Nhà đất Nha Trang', '/listings?q=Nha Trang'],
    ['Nhà đất Cam Ranh', '/listings?q=Cam Ranh'],
    ['Nhà đất Diên Khánh', '/listings?q=Diên Khánh'],
    ['Nhà đất Vạn Ninh', '/listings?q=Vạn Ninh'],
    ['Xem tất cả', '/listings'],
  ] },
];

const HELP: [string, string][] = [
  ['Giới thiệu Cam Lâm Land', '/dichvu'],
  ['Dịch vụ & Bảng giá', '/dichvu'],
  ['Nhà đất bán & cho thuê', '/listings'],
  ['Bản đồ quy hoạch', '/map'],
  ['Tra cứu QR thửa đất', '/qr'],
  ['Tin tức', '/tin-tuc'],
];
const RULES: [string, string][] = [
  ['Quy định đăng tin', '#'],
  ['Quy chế hoạt động', '#'],
  ['Điều khoản sử dụng', '#'],
  ['Chính sách bảo mật', '#'],
  ['Giải quyết khiếu nại', '#'],
];

const STATS = [
  { n: '2,000+', l: 'Bất động sản', d: 'M3 21h18M5 21V7l6-4 6 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01' },
  { n: '5,000+', l: 'Khách hàng', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { n: '50+', l: 'Dự án quy hoạch', d: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { n: '8', l: 'Xã / Khu vực', d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
];

function Newsletter() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setDone(true); setEmail('');
    setTimeout(() => setDone(false), 4000);
  };
  return (
    <form onSubmit={submit} className="flex rounded-lg overflow-hidden bg-white/10 border border-white/15">
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Nhập email của bạn" className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-400 outline-none" />
      <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 text-sm font-semibold">Gửi</button>
    </form>
  );
}

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

      {/* B. Đối tác + giới thiệu (SEO) */}
      <div className="bg-white border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 opacity-70">
            {PARTNERS.map((p) => (
              <span key={p} className="text-slate-400 text-xs font-semibold tracking-wide uppercase">{p}</span>
            ))}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mt-6 text-center max-w-4xl mx-auto">
            <b className="text-slate-500">Cam Lâm Land</b> là nền tảng bất động sản &amp; bản đồ quy hoạch dành cho huyện Cam Lâm, tỉnh Khánh Hòa. Người dùng có thể tìm mua, bán, cho thuê nhà đất, đất nền, căn hộ, biệt thự; tra cứu quy hoạch sử dụng đất theo số tờ/số thửa/xã trên nền vệ tinh độ nét cao đến z18; đo đạc trực tiếp trên bản đồ và tra cứu bằng mã QR. Chúng tôi cung cấp thông tin minh bạch, chính xác, cập nhật liên tục để hỗ trợ nhà đầu tư và người dân ra quyết định.
          </p>
        </div>
      </div>

      {/* C. 6 cột liên kết */}
      <div className="bg-white border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-8">
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

      {/* D. Footer chính (nền tối) */}
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

        <div className="mx-auto max-w-7xl px-4 py-12 grid gap-8 md:grid-cols-12">
          {/* Thương hiệu + liên hệ + app + QR + mạng xã hội */}
          <div className="md:col-span-4">
            <p className="font-extrabold text-xl text-white">Cam Lâm <span className="text-[#C8A14B]">Land</span></p>
            <p className="text-sm mt-3 text-slate-400 max-w-sm">Nền tảng bất động sản &amp; bản đồ quy hoạch huyện Cam Lâm, Khánh Hòa.</p>
            <a href="tel:0988888888" className="inline-flex items-center gap-1.5 text-lg font-extrabold text-[#C8A14B] hover:text-[#FFD56A] mt-4">📞 0988 888 888</a>
            <p className="text-sm text-slate-400 mt-1">✉️ lienhe@camlamland.vn</p>
            <div className="flex items-center gap-3 mt-4">
              <a href="#" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2">
                <span className="text-lg">▶</span><span className="text-[11px] leading-tight">Tải trên<br /><b className="text-white text-xs">Google Play</b></span>
              </a>
              <a href="#" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2">
                <span className="text-lg"></span><span className="text-[11px] leading-tight">Tải trên<br /><b className="text-white text-xs">App Store</b></span>
              </a>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=https%3A%2F%2Fcamlamland.onrender.com" alt="QR mở web Cam Lâm Land" width={56} height={56} className="w-14 h-14 rounded-lg bg-white p-1" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <div className="flex gap-2 mt-4">
              <a href="#" aria-label="Facebook" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 font-bold">f</a>
              <a href="https://zalo.me/0988888888" target="_blank" rel="noreferrer" aria-label="Zalo" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-bold">Zalo</a>
              <a href="tel:0988888888" aria-label="Gọi điện" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20">☎</a>
            </div>
          </div>

          {/* Hướng dẫn */}
          <div className="md:col-span-2">
            <p className="font-semibold text-white mb-3">Hướng dẫn</p>
            <ul className="text-sm space-y-2 text-slate-400">
              {HELP.map(([label, href]) => <li key={label}><Link href={href} className="hover:text-[#C8A14B]">{label}</Link></li>)}
            </ul>
          </div>

          {/* Quy định */}
          <div className="md:col-span-3">
            <p className="font-semibold text-white mb-3">Quy định</p>
            <ul className="text-sm space-y-2 text-slate-400">
              {RULES.map(([label, href]) => <li key={label}><a href={href} className="hover:text-[#C8A14B]">{label}</a></li>)}
            </ul>
          </div>

          {/* Đăng ký nhận tin + Quốc gia */}
          <div className="md:col-span-3">
            <p className="font-semibold text-white mb-3">Đăng ký nhận tin</p>
            <p className="text-xs text-slate-400 mb-2">Nhận tin nhà đất &amp; quy hoạch Cam Lâm mới nhất.</p>
            <Newsletter />
            <p className="font-semibold text-white mt-6 mb-2">Quốc gia &amp; Ngôn ngữ</p>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm">
              <span className="text-base">🇻🇳</span> Việt Nam
            </div>
          </div>
        </div>

        {/* Thông tin công ty */}
        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-400 leading-relaxed">
            <b className="text-slate-200">CAM LÂM LAND</b> — Nền tảng bất động sản &amp; quy hoạch huyện Cam Lâm, tỉnh Khánh Hòa. Phát triển bởi Nguyễn Quốc Cường. Địa chỉ: Cam Lâm, Khánh Hòa · Hotline: 0988 888 888 · Email: lienhe@camlamland.vn.
          </div>
        </div>
        <div className="border-t border-white/10 text-center text-xs text-slate-500 py-4">© 2026 Cam Lâm Land · Phát triển bởi Nguyễn Quốc Cường</div>
      </div>
    </footer>
  );
}
