'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import InstallAppButton from './InstallAppButton';
import { api } from '@/lib/api';

const DISCOVER: [string, string][] = [
  ['Giới thiệu Cam Lâm Land', '/gioi-thieu'],
  ['Dịch vụ & Bảng giá', '/dichvu'],
  ['Nhà đất bán & cho thuê', '/listings'],
  ['Nhà đất theo khu vực', '/nha-dat'],
  ['Bản đồ 65 xã, phường Khánh Hòa', '/ban-do'],   // trang địa danh (13/10/2026): xã mới ↔ xã cũ, số tờ mới
  ['Dự án bất động sản', '/du-an'],
  ['Góp vốn đầu tư (CamInvest)', '/dau-tu'],
  ['Tin tức', '/tin-tuc'],
  ['🎮 Game giải trí', '/game'],
];
const TOOLS: [string, string][] = [
  ['🧰 Tiện ích (tất cả công cụ)', '/tien-ich'],
  ['Giới thiệu các công cụ nhà đất', '/cong-cu'],
  ['Bản đồ quy hoạch', '/map'],
  ['Chuyển tọa độ VN2000 ↔ WGS84', '/chuyen-doi-toa-do-vn2000'],
  ['Tra cứu QR thửa đất', '/qr'],
  ['Giá đất khu vực & định giá', '/gia-dat'],
  ['Bảng giá đất Khánh Hòa', '/bang-gia-dat'],
  ['Cẩm nang pháp lý nhà đất', '/cam-nang'],
  ['Văn bản pháp luật nhà đất', '/van-ban'],
];
const RULES: [string, string][] = [
  ['Quy định đăng tin', '/quy-dinh-dang-tin'],
  ['Quy chế hoạt động', '/quy-che-hoat-dong'],
  ['Điều khoản sử dụng', '/dieu-khoan-su-dung'],
  ['Chính sách bảo mật', '/chinh-sach-bao-mat'],
  ['Giải quyết khiếu nại', '/giai-quyet-khieu-nai'],
];

function Newsletter() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const em = email.trim();
    if (!em) { setMsg({ ok: false, text: 'Vui lòng nhập email.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await api('/newsletter', { method: 'POST', body: JSON.stringify({ email: em }) }); // LƯU lead thật (không chỉ alert)
      setEmail(''); setMsg({ ok: true, text: 'Đã đăng ký nhận tin. Cảm ơn bạn!' });
    } catch (er: any) {
      setMsg({ ok: false, text: er?.message || 'Đăng ký chưa thành công, thử lại sau.' });
    } finally { setBusy(false); }
  };
  return (
    <div>
      <form onSubmit={submit} className="flex rounded-lg overflow-hidden bg-white border border-slate-300">
        <input value={email} onChange={(e) => { setEmail(e.target.value); setMsg(null); }} type="email" required placeholder="Nhập email của bạn" className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none" />
        <button type="submit" disabled={busy} className="cl-press bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 text-sm font-semibold shrink-0">{busy ? '…' : 'Gửi'}</button>
      </form>
      {msg && <p className={`mt-1.5 text-[12px] ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}

function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`mb-2 sm:mb-3 font-bold sm:font-semibold text-[#0A2540] ${className}`}>{children}</p>;
}

export default function SiteFooter() {
  return (
    // NỀN SÁNG (mẫu 34, chủ dự án chọn 2/10/2026): xanh rất nhạt #f4f7fc, chữ xám, tiêu đề xanh đậm, kẻ mảnh phía trên.
    // Trước là nền xanh đậm #0A2540 chữ trắng.
    // Điện thoại: <main> chừa sẵn khoảng đáy 48px cho thanh menu dưới (layout.tsx) — khoảng đó mang màu nền trang,
    // khác màu chân trang nên nhìn như HỞ (chủ dự án 2/10/2026). Kéo chân trang phủ xuống đúng bằng khoảng đó.
    <footer className="border-t border-slate-200 bg-[#f4f7fc] text-slate-600 max-md:-mb-[calc(48px+env(safe-area-inset-bottom))] max-md:pb-[calc(48px+env(safe-area-inset-bottom))]">
      {/* Dải số liệu (64 xã · N tin · N dự án · N công cụ) ĐÃ BỎ theo ý chủ dự án 1/10/2026. */}
      {/* 4 cột đều nhau */}
      {/* ĐIỆN THOẠI (chủ dự án 2/10/2026, theo mẫu gửi kèm): lưới 2 cột — khối thương hiệu trải hết ngang ở trên,
          "Khám phá" + "Tra cứu & công cụ" đứng cạnh nhau, "Quy định" + đăng ký nhận tin ở dưới; chữ nhỏ gọn hơn,
          ẩn mã QR + nhãn "Việt Nam" cho đỡ dài. Máy tính giữ 4 cột như cũ. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-4 pt-7 sm:pt-12 pb-6 sm:pb-10 grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-6 sm:gap-y-9 lg:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <p className="font-extrabold text-lg sm:text-xl text-[#0A2540]">Cam Lâm <span className="text-[#C8A14B]">Land</span></p>
          <p className="text-[13px] sm:text-sm mt-1.5 sm:mt-3 text-slate-500">Nền tảng bất động sản &amp; bản đồ quy hoạch khu vực Cam Lâm, Khánh Hòa.</p>
          <a href="tel:0567442996" className="inline-flex items-center gap-1.5 text-base sm:text-lg font-extrabold text-[#a8842f] hover:text-[#0A2540] mt-2 sm:mt-4">📞 0567 442 996</a>
          <p className="text-[13px] sm:text-sm text-slate-500 mt-0.5 sm:mt-1">✉️ lienhe@camlamland.vn</p>
          <div className="flex flex-wrap items-center gap-2.5 mt-3 sm:mt-4">
            <InstallAppButton className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[#0A2540] hover:border-[#C8A14B] [&_b]:!text-[#0A2540]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=https%3A%2F%2Fbatdongsancamlam.dpdns.org" alt="QR mở web Cam Lâm Land" width={56} height={56} className="hidden sm:block w-14 h-14 rounded-lg border border-slate-200 bg-white p-1" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="flex gap-2 mt-3 sm:mt-4">
            <a href="#" aria-label="Facebook" className="w-9 h-9 grid place-items-center rounded-full border border-slate-200 bg-white text-[#0A2540] hover:border-[#C8A14B] font-bold">f</a>
            <a href="https://zalo.me/0567442996" target="_blank" rel="noreferrer" aria-label="Zalo" className="w-9 h-9 grid place-items-center rounded-full border border-slate-200 bg-white text-[#0A2540] hover:border-[#C8A14B] text-[11px] font-bold">Zalo</a>
            <a href="tel:0567442996" aria-label="Gọi điện" className="w-9 h-9 grid place-items-center rounded-full border border-slate-200 bg-white text-[#0A2540] hover:border-[#C8A14B]">☎</a>
          </div>
        </div>

        <div>
          <SectionTitle>Khám phá</SectionTitle>
          <ul className="text-[13px] sm:text-sm space-y-1.5 sm:space-y-2 text-slate-500">
            {DISCOVER.map(([label, href]) => <li key={label}><Link href={href} className="inline-block transition duration-150 hover:translate-x-0.5 hover:text-[#0A2540]">{label}</Link></li>)}
          </ul>
        </div>

        <div>
          <SectionTitle>Tra cứu &amp; công cụ</SectionTitle>
          <ul className="text-[13px] sm:text-sm space-y-1.5 sm:space-y-2 text-slate-500">
            {TOOLS.map(([label, href]) => <li key={label}><Link href={href} className="inline-block transition duration-150 hover:translate-x-0.5 hover:text-[#0A2540]">{label}</Link></li>)}
          </ul>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <SectionTitle>Quy định</SectionTitle>
          <ul className="text-[13px] sm:text-sm space-y-1.5 sm:space-y-2 text-slate-500">
            {RULES.map(([label, href]) => <li key={label}><Link href={href} className="inline-block transition duration-150 hover:translate-x-0.5 hover:text-[#0A2540]">{label}</Link></li>)}
          </ul>
          <SectionTitle className="mt-5 sm:mt-6">Đăng ký nhận tin</SectionTitle>
          <p className="text-xs text-slate-500 mb-2">Nhận tin nhà đất &amp; quy hoạch Cam Lâm mới nhất.</p>
          <Newsletter />
          <div className="mt-5 hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:inline-flex">
            <span className="text-base">🇻🇳</span> Việt Nam
          </div>
        </div>
      </div>

      {/* Khối cuối chân trang CANH GIỮA — trước canh trái nên dồn một góc, lệch với các cột phía trên (chủ dự án chỉ). */}
      <div className="mx-auto max-w-7xl px-4 sm:px-4 pt-4 sm:pt-6 pb-3 sm:pb-4 border-t border-slate-200 text-center text-[11px] sm:text-xs text-slate-500 leading-relaxed">
        <p><b className="text-[#0A2540]">CAM LÂM LAND</b> — Nền tảng bất động sản &amp; quy hoạch khu vực Cam Lâm, tỉnh Khánh Hòa.</p>
        <p className="mt-1">Địa chỉ: Cam Lâm, Khánh Hòa · Hotline: 0567 442 996 · Email: lienhe@camlamland.vn.</p>
      </div>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 text-center text-[11px] sm:text-xs text-slate-500 pb-5 sm:pb-6">© 2018 Cam Lâm Land</div>
    </footer>
  );
}
