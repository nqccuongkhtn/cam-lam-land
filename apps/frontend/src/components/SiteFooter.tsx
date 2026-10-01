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
  ['Góp vốn đầu tư (CamInvest)', '/dau-tu'],
  ['Tin tức', '/tin-tuc'],
  ['🎮 Game giải trí', '/game'],
];
const TOOLS: [string, string][] = [
  ['🧰 Tiện ích (tất cả công cụ)', '/tien-ich'],
  ['Bản đồ quy hoạch', '/map'],
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
      <form onSubmit={submit} className="flex rounded-lg overflow-hidden bg-white/10 border border-white/15">
        <input value={email} onChange={(e) => { setEmail(e.target.value); setMsg(null); }} type="email" required placeholder="Nhập email của bạn" className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-400 outline-none" />
        <button type="submit" disabled={busy} className="cl-press bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 text-sm font-semibold shrink-0">{busy ? '…' : 'Gửi'}</button>
      </form>
      {msg && <p className={`mt-1.5 text-[12px] ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
    </div>
  );
}

function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`mb-3 font-semibold text-white ${className}`}>{children}</p>;
}

export default function SiteFooter() {
  return (
    <footer className="bg-[#0A2540] text-slate-300">
      {/* Dải số liệu (64 xã · N tin · N dự án · N công cụ) ĐÃ BỎ theo ý chủ dự án 1/10/2026. */}
      {/* 4 cột đều nhau */}
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-8 sm:pt-12 pb-8 sm:pb-10 grid gap-x-6 sm:gap-x-8 gap-y-8 sm:gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-extrabold text-xl text-white">Cam Lâm <span className="text-[#C8A14B]">Land</span></p>
          <p className="text-sm mt-3 text-slate-400">Nền tảng bất động sản &amp; bản đồ quy hoạch khu vực Cam Lâm, Khánh Hòa.</p>
          <a href="tel:0988888888" className="inline-flex items-center gap-1.5 text-lg font-extrabold text-[#C8A14B] hover:text-[#FFD56A] mt-4">📞 0988 888 888</a>
          <p className="text-sm text-slate-400 mt-1">✉️ lienhe@camlamland.vn</p>
          <div className="flex flex-wrap items-center gap-2.5 mt-4">
            <InstallAppButton className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=https%3A%2F%2Fbatdongsancamlam.dpdns.org" alt="QR mở web Cam Lâm Land" width={56} height={56} className="w-14 h-14 rounded-lg bg-white p-1" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="flex gap-2 mt-4">
            <a href="#" aria-label="Facebook" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 font-bold">f</a>
            <a href="https://zalo.me/0988888888" target="_blank" rel="noreferrer" aria-label="Zalo" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-bold">Zalo</a>
            <a href="tel:0988888888" aria-label="Gọi điện" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20">☎</a>
          </div>
        </div>

        <div>
          <SectionTitle>Khám phá</SectionTitle>
          <ul className="text-sm space-y-2 text-slate-400">
            {DISCOVER.map(([label, href]) => <li key={label}><Link href={href} className="inline-block transition duration-150 hover:translate-x-0.5 hover:text-[#C8A14B]">{label}</Link></li>)}
          </ul>
        </div>

        <div>
          <SectionTitle>Tra cứu &amp; công cụ</SectionTitle>
          <ul className="text-sm space-y-2 text-slate-400">
            {TOOLS.map(([label, href]) => <li key={label}><Link href={href} className="inline-block transition duration-150 hover:translate-x-0.5 hover:text-[#C8A14B]">{label}</Link></li>)}
          </ul>
        </div>

        <div>
          <SectionTitle>Quy định</SectionTitle>
          <ul className="text-sm space-y-2 text-slate-400">
            {RULES.map(([label, href]) => <li key={label}><Link href={href} className="inline-block transition duration-150 hover:translate-x-0.5 hover:text-[#C8A14B]">{label}</Link></li>)}
          </ul>
          <SectionTitle className="mt-6">Đăng ký nhận tin</SectionTitle>
          <p className="text-xs text-slate-400 mb-2">Nhận tin nhà đất &amp; quy hoạch Cam Lâm mới nhất.</p>
          <Newsletter />
          <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm">
            <span className="text-base">🇻🇳</span> Việt Nam
          </div>
        </div>
      </div>

      {/* Khối cuối chân trang CANH GIỮA — trước canh trái nên dồn một góc, lệch với các cột phía trên (chủ dự án chỉ). */}
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-6 pb-4 border-t border-white/10 text-center text-xs text-slate-400 leading-relaxed">
        <p><b className="text-slate-200">CAM LÂM LAND</b> — Nền tảng bất động sản &amp; quy hoạch khu vực Cam Lâm, tỉnh Khánh Hòa.</p>
        <p className="mt-1">Địa chỉ: Cam Lâm, Khánh Hòa · Hotline: 0988 888 888 · Email: lienhe@camlamland.vn.</p>
      </div>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 text-center text-xs text-slate-500 pb-6">© 2018 Cam Lâm Land</div>
    </footer>
  );
}
