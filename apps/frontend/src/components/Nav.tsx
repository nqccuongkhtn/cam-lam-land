'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';

const links = [
  { href: '/', label: 'Trang chủ' },
  { href: '/listings', label: 'Nhà đất bán' },
  { href: '/listings?deal=rent', label: 'Cho thuê' },
  { href: '/map', label: 'Bản đồ quy hoạch' },
  { href: '/qr', label: 'Tra cứu QR' },
  { href: '/dau-tu', label: 'Đầu tư' },
];

function Logo({ light }: { light: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      <svg viewBox="0 0 44 44" className="w-9 h-9 shrink-0" aria-hidden="true">
        <defs><linearGradient id="clNavy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#123459" /><stop offset="1" stopColor="#081B30" /></linearGradient></defs>
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
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const isHome = path === '/';
  const [open, setOpen] = useState(false);
  const [acct, setAcct] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const acctRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { setOpen(false); setAcct(false); }, [path]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcct(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const solid = !isHome || scrolled || open || acct;
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const name = user?.fullName || user?.email?.split('@')[0] || '';
  const roleLabel = user?.role === 'admin' ? 'Quản trị viên' : 'Thành viên';
  function doLogout() { logout(); setAcct(false); setOpen(false); router.push('/'); }

  const txt = solid ? 'text-[#0A2540]' : 'text-white';
  const mItem = 'block w-full text-left px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg';

  return (
    <header className={`${isHome ? 'fixed' : 'sticky'} top-0 inset-x-0 z-50 transition-colors duration-300 ${solid ? 'bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm' : 'bg-gradient-to-b from-black/45 via-black/20 to-transparent'}`}>
      <div className="mx-auto max-w-7xl h-14 px-4 flex items-center justify-between gap-3">
        <Logo light={!solid} />
        <nav className="hidden md:flex gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`px-3 py-2 rounded-md text-sm font-semibold transition ${solid ? (active(l.href) ? 'text-[#0A2540]' : 'text-slate-500 hover:text-[#0A2540]') : (active(l.href) ? 'text-white' : 'text-white/85 hover:text-white')}`}>{l.label}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <a href="tel:0988888888" className={`hidden xl:flex items-center gap-1.5 text-sm font-bold ${txt}`}>📞 0988 888 888</a>
          {user ? (
            <>
              {!path.startsWith('/sales') && (
                <Link href="/sales/post" className="hidden sm:flex items-center bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm shadow-red-600/30">＋ Đăng tin</Link>
              )}
              <div className="relative" ref={acctRef}>
                <button onClick={() => setAcct((v) => !v)} className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 border ${solid ? 'border-slate-200 hover:bg-slate-50' : 'border-white/30 hover:bg-white/10'}`}>
                  {user.avatar ? <img src={user.avatar} alt="" className="w-7 h-7 rounded-full object-cover" /> : <span className="w-7 h-7 rounded-full bg-[#0A2540] text-[#C8A14B] grid place-items-center text-xs font-bold">{(name || 'U').charAt(0).toUpperCase()}</span>}
                  <span className={`hidden lg:block text-sm font-semibold max-w-[90px] truncate ${txt}`}>{name}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={`w-4 h-4 ${solid ? 'text-slate-400' : 'text-white/80'}`}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {acct && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="font-bold text-[#0A2540] text-sm truncate">{name}</p>
                      <p className="text-xs text-slate-400 truncate">{roleLabel} · {user.email}</p>
                    </div>
                    <Link href="/sales/post" className={`${mItem} sm:hidden text-[#C8A14B]`}>＋ Đăng tin mới</Link>
                    <Link href="/account" className={mItem}>Tài khoản của tôi</Link>
                    <Link href="/sales" className={mItem}>Tin của tôi</Link>
                    {(user.role === 'admin' || user.role === 'gis') && <Link href="/admin" className={mItem}>{user.role === 'admin' ? 'Quản trị' : 'Tải bản đồ GIS'}</Link>}
                    {user.role === 'admin' && <Link href="/map-ads" className={mItem}>Quảng cáo bản đồ</Link>}
                    {user.role === 'admin' && <Link href="/consignments" className={mItem}>Khách gửi bán</Link>}
                    {user.role === 'admin' && <Link href="/invest-leads" className={mItem}>Đăng ký góp vốn</Link>}
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={doLogout} className={`${mItem} text-red-600`}>Đăng xuất</button>
                  </div>
                )}
              </div>
            </>
          ) : loading ? (
            <div className={`w-8 h-8 rounded-full animate-pulse ${solid ? 'bg-slate-200' : 'bg-white/25'}`} />
          ) : (
            <>
              <Link href="/login" className={`hidden sm:block text-sm font-bold ${solid ? 'text-[#0A2540] hover:text-[#C8A14B]' : 'text-white hover:text-[#FFD56A]'}`}>Đăng nhập</Link>
              <Link href="/register" className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm shadow-red-600/30">Đăng ký</Link>
            </>
          )}
          <button onClick={() => setOpen((o) => !o)} aria-label="Menu" className={`md:hidden grid place-items-center w-9 h-9 rounded-lg border ${solid ? 'border-slate-200 text-[#0A2540]' : 'border-white/50 text-white'}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}</svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t border-slate-100 bg-white px-3 py-2 flex flex-col shadow-lg">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={`py-2.5 px-2 rounded-lg text-sm font-semibold ${active(l.href) ? 'text-[#0A2540] bg-slate-50' : 'text-slate-600 hover:bg-slate-50'}`}>{l.label}</Link>
          ))}
          {user && (<>
            <Link href="/account" onClick={() => setOpen(false)} className="py-2.5 px-2 rounded-lg text-sm font-semibold text-[#0A2540] hover:bg-slate-50">Tài khoản của tôi</Link>
            <Link href="/sales/post" onClick={() => setOpen(false)} className="py-2.5 px-2 rounded-lg text-sm font-bold text-[#C8A14B] hover:bg-slate-50">＋ Đăng tin mới</Link>
            <Link href="/sales" onClick={() => setOpen(false)} className="py-2.5 px-2 rounded-lg text-sm font-semibold text-[#0A2540] hover:bg-slate-50">Tin của tôi</Link>
          </>)}
          {(user?.role === 'admin' || user?.role === 'gis') && <Link href="/admin" onClick={() => setOpen(false)} className="py-2.5 px-2 rounded-lg text-sm font-semibold text-[#0A2540] hover:bg-slate-50">{user?.role === 'admin' ? 'Quản trị' : 'Tải bản đồ GIS'}</Link>}
          {user?.role === 'admin' && <Link href="/map-ads" onClick={() => setOpen(false)} className="py-2.5 px-2 rounded-lg text-sm font-semibold text-[#0A2540] hover:bg-slate-50">Quảng cáo bản đồ</Link>}
          {user?.role === 'admin' && <Link href="/consignments" onClick={() => setOpen(false)} className="py-2.5 px-2 rounded-lg text-sm font-semibold text-[#0A2540] hover:bg-slate-50">Khách gửi bán</Link>}
          {user?.role === 'admin' && <Link href="/invest-leads" onClick={() => setOpen(false)} className="py-2.5 px-2 rounded-lg text-sm font-semibold text-[#0A2540] hover:bg-slate-50">Đăng ký góp vốn</Link>}
          <a href="tel:0988888888" className="py-2.5 px-2 text-sm font-bold text-[#0A2540]">📞 Hotline 0988 888 888</a>
          <div className="border-t border-slate-100 mt-1 pt-2">
            {user ? (
              <button onClick={doLogout} className="w-full text-left py-2.5 px-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-slate-50">Đăng xuất ({name})</button>
            ) : loading ? null : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="block py-2.5 px-2 rounded-lg text-sm font-semibold text-[#0A2540] hover:bg-slate-50">Đăng nhập</Link>
                <Link href="/register" onClick={() => setOpen(false)} className="block py-2.5 px-2 rounded-lg text-sm font-semibold text-[#C8A14B] hover:bg-slate-50">Đăng ký</Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
