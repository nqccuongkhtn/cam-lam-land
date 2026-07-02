'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';

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
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmail('');
    alert('Cảm ơn bạn đã đăng ký nhận tin từ Cam Lâm Land!');
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
    <footer className="bg-[#0A2540] text-slate-300 border-t border-slate-200">
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
        <div className="md:col-span-4">
          <p className="font-extrabold text-xl text-white">Cam Lâm <span className="text-[#C8A14B]">Land</span></p>
          <p className="text-sm mt-3 text-slate-400 max-w-sm">Nền tảng bất động sản &amp; bản đồ quy hoạch huyện Cam Lâm, Khánh Hòa.</p>
          <a href="tel:0988888888" className="inline-flex items-center gap-1.5 text-lg font-extrabold text-[#C8A14B] hover:text-[#FFD56A] mt-4">📞 0988 888 888</a>
          <p className="text-sm text-slate-400 mt-1">✉️ lienhe@camlamland.vn</p>
          <div className="flex items-center gap-3 mt-4">
            <a href="#" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2">
              <span className="text-lg">▶</span><span className="text-[11px] leading-tight">Tải trên<br /><b className="text-white text-xs">Google Play</b></span>
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

        <div className="md:col-span-2">
          <p className="font-semibold text-white mb-3">Hướng dẫn</p>
          <ul className="text-sm space-y-2 text-slate-400">
            {HELP.map(([label, href]) => <li key={label}><Link href={href} className="hover:text-[#C8A14B]">{label}</Link></li>)}
          </ul>
        </div>

        <div className="md:col-span-3">
          <p className="font-semibold text-white mb-3">Quy định</p>
          <ul className="text-sm space-y-2 text-slate-400">
            {RULES.map(([label, href]) => <li key={label}><a href={href} className="hover:text-[#C8A14B]">{label}</a></li>)}
          </ul>
        </div>

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

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-400 leading-relaxed">
          <b className="text-slate-200">CAM LÂM LAND</b> — Nền tảng bất động sản &amp; quy hoạch huyện Cam Lâm, tỉnh Khánh Hòa. Phát triển bởi Nguyễn Quốc Cường. Địa chỉ: Cam Lâm, Khánh Hòa · Hotline: 0988 888 888 · Email: lienhe@camlamland.vn.
        </div>
      </div>
      <div className="border-t border-white/10 text-center text-xs text-slate-500 py-4">© 2026 Cam Lâm Land · Phát triển bởi Nguyễn Quốc Cường</div>
    </footer>
  );
}
