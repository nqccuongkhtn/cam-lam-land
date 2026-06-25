'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const links = [
  { href: '/', label: 'Trang chủ' },
  { href: '/listings', label: 'Nhà đất' },
  { href: '/map', label: 'Bản đồ quy hoạch' },
  { href: '/qr', label: 'Tra cứu QR' },
  { href: '/admin', label: 'Quản trị' },
];

function Logo({ light }: { light: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      <svg viewBox="0 0 44 44" className="w-9 h-9 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="clNavy" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#123459" />
            <stop offset="1" stopColor="#081B30" />
          </linearGradient>
        </defs>
        <rect width="44" height="44" rx="12" fill="url(#clNavy)" />
        <rect x="1.2" y="1.2" width="41.6" height="41.6" rx="10.8" fill="none" stroke="#C8A14B" strokeOpacity="0.45" strokeWidth="1.2" />
        <path d="M11 21.5 L22 12 L33 21.5" fill="none" stroke="#C8A14B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.2 20 V31.4 H29.8 V20" fill="none" stroke="#C8A14B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22" cy="25.6" r="2.5" fill="#C8A14B" />
      </svg>
      <span className="leading-tight">
        <span className={`font-extrabold block text-lg tracking-tight ${light ? 'text-white' : 'text-[#0A2540]'}`}>Cam Lâm <span className="text-[#C8A14B]">Land</span></span>
        <span className={`hidden sm:block text-[10px] font-medium tracking-wide ${light ? 'text-white/75' : 'text-slate-400'}`}>Phát triển bởi Nguyễn Quốc Cường</span>
      </span>
    </Link>
  );
}

export default function Nav() {
  const path = usePathname();
  const isHome = path === '/';
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { setOpen(false); }, [path]);

  const solid = !isHome || scrolled || open;
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <header className={`${isHome ? 'fixed' : 'sticky'} top-0 inset-x-0 z-50 transition-colors duration-300 ${solid ? 'bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm' : 'bg-gradient-to-b from-black/45 via-black/20 to-transparent'}`}>
      <div className="mx-auto max-w-7xl h-14 px-4 flex items-center justify-between gap-4">
        <Logo light={!solid} />
        <nav className="hidden md:flex gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`px-3 py-2 rounded-md text-sm font-semibold transition ${
                solid
                  ? active(l.href) ? 'text-[#0A2540]' : 'text-slate-500 hover:text-[#0A2540]'
                  : active(l.href) ? 'text-white' : 'text-white/85 hover:text-white'
              }`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/map" className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm shadow-red-600/30">Mở bản đồ</Link>
          <button onClick={() => setOpen((o) => !o)} aria-label="Menu"
            className={`md:hidden grid place-items-center w-9 h-9 rounded-lg border ${solid ? 'border-slate-200 text-[#0A2540]' : 'border-white/50 text-white'}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="md:hidden border-t border-slate-100 bg-white px-3 py-2 flex flex-col shadow-lg">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={`py-2.5 px-2 rounded-lg text-sm font-semibold ${active(l.href) ? 'text-[#0A2540] bg-slate-50' : 'text-slate-600 hover:bg-slate-50'}`}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
