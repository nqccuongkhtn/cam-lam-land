'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth, laAdmin, coVaiTro } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';
import { useHideOnScroll } from '@/lib/hideOnScroll';
import { apiBase } from '@/lib/api';

/* ── LOGO NGÀY LỄ ───────────────────────────────────────────────────────────
   Ngày thường dùng logo gốc; tới dịp lễ (Tết, Quốc khánh, Trung thu, Noel…)
   thì đổi sang bản có trang trí. Lịch do quản trị viên đặt ở
   /quan-tri/logo-le, máy chủ trả về mã bản logo của HÔM NAY.

   ⚠️ GỌI BẰNG fetch TRẦN, KHÔNG kèm thẻ đăng nhập. Có thẻ đăng nhập là nginx
      bỏ qua bộ nhớ đệm (luật chung của dự án: dữ liệu riêng tư không bao giờ
      được cache) → mỗi lần mở trang lại hỏi thẳng máy chủ, phí một vòng gọi
      cho một thứ cả ngày mới đổi một lần. Không thẻ thì nginx giữ 10 phút.
   ⚠️ Hỏng thì im lặng dùng logo thường — logo là thứ không được phép làm
      vỡ thanh menu. */
function useLogoLe(): string | null {
  const [ma, setMa] = useState<string | null>(null);
  useEffect(() => {
    let huy = false;
    fetch(`${apiBase}/logo-le/hom-nay`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!huy && j?.ma) setMa(String(j.ma)); })
      .catch(() => {});
    return () => { huy = true; };
  }, []);
  return ma;
}

const links = [
  { href: '/', label: 'Trang chủ' },
  { href: '/listings', label: 'Nhà đất bán' },
  { href: '/listings?deal=rent', label: 'Cho thuê' },
  { href: '/map', label: 'Bản đồ quy hoạch' },
  { href: '/tien-ich', label: 'Tiện ích' },
];

// Icon mảnh 1 nét (KHÔNG phải emoji) cho từng dòng menu mobile → mỗi hàng có neo trái đồng đều, nhìn cân đối.
function MIco({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" className="w-[19px] h-[19px] shrink-0" aria-hidden="true">{children}</svg>;
}
function NavIco({ href }: { href: string }) {
  const map: Record<string, ReactNode> = {
    '/': <><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9.4V20h12V9.4" /></>,
    '/listings': <><path d="M4 20V7.6l8-3.6 8 3.6V20" /><path d="M9.5 20v-5.5h5V20" /></>,
    '/listings?deal=rent': <><circle cx="9" cy="9" r="3.4" /><path d="M11.4 11.4 19 19M16 19l2-2M18.6 16.4 20 15" /></>,
    '/map': <><path d="M9 4.5 4 6.5v13l5-2 6 2 5-2v-13l-5 2-6-2Z" /><path d="M9 4.5v13M15 6.5v13" /></>,
    '/tien-ich': <><rect x="4" y="4" width="7" height="7" rx="1.6" /><rect x="13" y="4" width="7" height="7" rx="1.6" /><rect x="4" y="13" width="7" height="7" rx="1.6" /><rect x="13" y="13" width="7" height="7" rx="1.6" /></>,
  };
  return <MIco>{map[href]}</MIco>;
}

function Logo({ light }: { light: boolean }) {
  const le = useLogoLe();
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      {/* ĐÚNG LOGO CHỦ DỰ ÁN GỬI, lấy thẳng từ tệp gốc: cắt riêng phần biểu
          tượng (ngôi nhà + chữ lồng CL + mặt trời + sóng), bỏ hai dòng chữ
          "CAM LÂM / NHÀ ĐẤT" ở dưới vì đã có tên thương hiệu viết chữ bên cạnh.

          ⚠️ BỎ HẲN CÁI KHUNG VUÔNG. Logo này có tới bốn chi tiết; nhét vào
             khung 36px thì hình vẽ chỉ còn ~30px, chi tiết dính vào nhau —
             chủ dự án nhận xét "nhìn rối", "thô". Bỏ khung thì logo được dùng
             gần trọn chiều cao thanh menu, các nét tách bạch hẳn ra.
          ⚠️ CAO 32px, ĐỪNG TỰ Ý ĐỔI. Đã đi một vòng dài: 36px CÓ KHUNG → chủ
             dự án bảo "rối", "thô"; bỏ khung phóng lên 44px → "cho logo nhỏ
             lại"; 38px → "nhỏ hơn nữa"; 32px là mức đang dùng, nhỏ hơn chữ
             "Cam Lâm Land" bên cạnh nên chữ mới là thứ đập vào mắt trước.
             Nét ngôi nhà đã được làm dày (xem scripts/dung-logo.py) nên thu
             tới cỡ này vẫn đọc rõ từng nét. Đổi chiều cao thì phải đổi CẢ bề
             ngang cho đúng tỉ lệ 1,51 — để lệch là logo bị bóp méo.
          ⚠️ HAI TỆP MÀU, đổi theo trạng thái thanh menu: nền tối (trong suốt
             trên banner) dùng bản NÉT TRẮNG, nền trắng (khi cuộn xuống) dùng
             bản NÉT NAVY đúng màu gốc. Một bản màu thì kiểu gì cũng có một
             trạng thái bị chìm. Dựng hai tệp bằng scripts/dung-logo.py. */}
      {/* Ngày lễ thì bọc thêm một lớp để chạy hiệu ứng động (xem khối
          "LOGO NGÀY LỄ" trong app/globals.css). Ngày thường không bọc gì cả,
          để thanh menu nhẹ đúng như cũ. Ba thẻ <i> là ba đốm lấp lánh. */}
      {le ? (
        <span className="cl-logo-le" data-le={le}>
          <img src={`/logo-le/${le}${light ? '' : '-toi'}.webp`}
            alt="" aria-hidden="true" width={48} height={32}
            className="h-8 w-12 shrink-0 object-contain" />
          <i aria-hidden /><i aria-hidden /><i aria-hidden />
        </span>
      ) : (
        <img
          src={light ? '/logo-cam-lam.webp' : '/logo-cam-lam-toi.webp'}
          alt="" aria-hidden="true" width={48} height={32}
          className="h-8 w-12 shrink-0 object-contain" />
      )}
      <span className="leading-tight">
        <span className={`font-extrabold block text-lg tracking-tight ${light ? 'text-white' : 'text-[#0A2540]'}`}>Cam Lâm <span className="text-[#C8A14B]">Land</span></span>
        <span className={`hidden lg:block whitespace-nowrap text-[10px] font-medium tracking-wide ${light ? 'text-white/75' : 'text-slate-400'}`}>Nhà đất &amp; quy hoạch</span>
      </span>
    </Link>
  );
}

export default function Nav() {
  const path = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { openLogin } = useLoginGate();
  // cuộn xuống ẩn Nav, cuộn lên hiện lại (đồng bộ thanh tìm kiếm).
  // TRANG BẢN ĐỒ thì KHÔNG BAO GIỜ ẩn: trang đó gói trong một khung hình như app, vuốt là để kéo bản đồ
  // (trên iPhone cú vuốt vẫn làm trang nhích → thanh "Cam Lâm Land" bị ẩn, chủ dự án báo 14/9/2026).
  const anKhiCuon = useHideOnScroll(20);
  const hidden = anKhiCuon && !path.startsWith('/map');
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
  useEffect(() => { setOpen(false); setAcct(false); }, [path, searchParams]);
  // Phím Esc luôn đóng menu/dropdown (phòng khi không có nút đóng trong tầm mắt).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setAcct(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Hub Tiện ích (mobile): menu trên ẩn → hub choán lên (padding-top về 0).
  useEffect(() => {
    document.documentElement.style.setProperty('--cl-hub-pt', hidden ? '0px' : 'calc(3.5rem + env(safe-area-inset-top))');
    // Thanh tìm kiếm tự đặt vị trí theo CHIỀU CAO MENU (biến này), KHÔNG dùng transform:
    // iOS Safari không áp transform ổn định cho position:sticky đã composite → thanh không trượt → lộ dải 56px của menu.
    document.documentElement.style.setProperty('--cl-nav-h', (hidden && !open && !isHome) ? '0px' : '3.5rem');
  }, [hidden, open, isHome]);
  // Cho phép nơi khác (thanh tìm kiếm thu gọn khi cuộn) mở menu này qua sự kiện.
  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener('open-nav-menu', openMenu);
    return () => window.removeEventListener('open-nav-menu', openMenu);
  }, []);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcct(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const solid = !isHome || scrolled || open || acct;
  const isRent = searchParams.get('deal') === 'rent';
  const active = (href: string) => {
    if (href === '/') return path === '/';
    if (href === '/listings') return path === '/listings' && !isRent;          // Nhà đất bán
    if (href === '/listings?deal=rent') return path === '/listings' && isRent;  // Cho thuê
    return path.startsWith(href);
  };
  const name = user?.fullName || user?.email?.split('@')[0] || '';
  const roleLabel = laAdmin(user) ? 'Quản trị viên' : 'Thành viên';
  function doLogout() { logout(); setAcct(false); setOpen(false); router.push('/'); }

  const txt = solid ? 'text-[#0A2540]' : 'text-white';
  const mItem = 'block w-full text-left px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg';

  return (
    <>
      {/* Nền che dải status bar (tai thỏ iPhone) — CHỈ trang trong (header thu gọn khi cuộn); TRANG CHỦ giữ nguyên như cũ */}
      {!isHome && <div aria-hidden className="md:hidden fixed top-0 inset-x-0 z-[55] bg-white" style={{ height: 'env(safe-area-inset-top)' }} />}
      {/* Lớp nền khi menu mobile mở: bấm ra ngoài để ĐÓNG (menu nằm trong header z-50 nên luôn ở trên lớp nền z-40) */}
      {open && <div aria-hidden onClick={() => setOpen(false)} className="md:hidden fixed inset-0 z-40 bg-black/40" />}
      {/* Thu gọn header khi cuộn: CHỈ áp dụng trang trong; TRANG CHỦ giữ hiệu ứng cũ (đứng yên, chỉ đổi nền) */}
      <header className={`${isHome || open ? 'fixed' : 'sticky'} top-0 inset-x-0 z-50 pt-[env(safe-area-inset-top)] transition-[background-color,border-color,box-shadow,transform] ${isHome ? 'duration-300' : hidden && !open ? 'duration-[240ms]' : 'duration-0'} ease-[cubic-bezier(0.22,1,0.36,1)] ${hidden && !open && !isHome ? '-translate-y-full' : 'translate-y-0'} ${solid ? 'bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm' : 'bg-gradient-to-b from-black/45 via-black/20 to-transparent'}`}>
      <div className="mx-auto max-w-7xl h-14 px-4 flex items-center justify-between gap-3">
        <Logo light={!solid} />
        <nav className="hidden md:flex shrink-0 items-center gap-0.5 lg:gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`whitespace-nowrap rounded-md px-2 lg:px-3 py-2 text-[13px] lg:text-sm font-semibold transition ${solid ? (active(l.href) ? 'text-[#0A2540]' : 'text-slate-500 hover:text-[#0A2540]') : (active(l.href) ? 'text-white' : 'text-white/85 hover:text-white')}`}>{l.label}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <a href="tel:0988888888" className={`hidden xl:flex items-center gap-1.5 text-sm font-bold ${txt}`}>📞 0988 888 888</a>
          <button onClick={() => window.dispatchEvent(new CustomEvent('cl-open-chat', { detail: { tab: 'advisory' } }))} aria-label="Nhắn tin" title="Nhắn tin / Tư vấn" className={`sm:hidden grid place-items-center w-10 h-10 rounded-lg border transition ${solid ? 'border-slate-200 text-[#0A2540] hover:bg-slate-50' : 'border-white/40 text-white hover:bg-white/10'}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" /></svg>
          </button>
          {user ? (
            <>
              {!path.startsWith('/sales') && (
                <Link href="/sales/post" className="hidden sm:flex items-center bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm shadow-red-600/30">＋ Đăng tin</Link>
              )}
              <div className="relative hidden md:block" ref={acctRef}>
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
                    {(laAdmin(user) || coVaiTro(user, 'gis') || coVaiTro(user, 'vanban')) && <Link href="/quan-tri" className={`${mItem} font-bold text-[#0A2540]`}>🛠️ Trang quản lý</Link>}
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={doLogout} className={`${mItem} text-red-600`}>Đăng xuất</button>
                  </div>
                )}
              </div>
            </>
          ) : loading ? (
            <div className={`w-8 h-8 rounded-full animate-pulse ${solid ? 'bg-slate-200' : 'bg-white/25'}`} />
          ) : (
            <button onClick={() => openLogin()} className="cl-press bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm shadow-red-600/30">Đăng nhập</button>
          )}
          {(user || open) && <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Đóng menu' : 'Menu'} className={`md:hidden grid place-items-center w-10 h-10 rounded-lg border ${solid ? 'border-slate-200 text-[#0A2540]' : 'border-white/50 text-white'}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}</svg>
          </button>}
        </div>
      </div>

      {open && (
        <nav className="md:hidden flex max-h-[calc(100dvh-7rem)] flex-col overflow-y-auto overscroll-contain border-t border-slate-100 bg-white px-3 py-2 shadow-lg cl-menu-in">
          {/* Điều hướng chính (mobile) — gồm cả "Cho thuê" mà thanh dưới không có */}
          <div className="pb-1">
            <p className="px-2 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Điều hướng</p>
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => { setOpen(false); if (l.href === '/tien-ich') window.dispatchEvent(new CustomEvent('cl-open-tools')); }} className="flex items-center gap-3 py-2.5 px-2 rounded-lg text-sm font-semibold text-[#0A2540] hover:bg-slate-50"><span className="text-slate-400"><NavIco href={l.href} /></span>{l.label}</Link>
            ))}
          </div>
          {user && (
            <div className="pt-1 mt-1.5 border-t border-slate-100">
              <p className="px-2 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Tài khoản</p>
              <Link href="/account" onClick={() => setOpen(false)} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-50">
                {user.avatar ? <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" /> : <span className="w-9 h-9 rounded-full bg-[#0A2540] text-[#C8A14B] grid place-items-center text-sm font-bold shrink-0">{(name || 'U').charAt(0).toUpperCase()}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-[#0A2540] text-sm truncate">{name}</span>
                  <span className="block text-[11px] text-slate-400 truncate">{roleLabel} · Xem tài khoản</span>
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-slate-300"><path d="m9 6 6 6-6 6" /></svg>
              </Link>
              <Link href="/sales" onClick={() => setOpen(false)} className="flex items-center gap-3 py-2.5 px-2 rounded-lg text-sm font-semibold text-[#0A2540] hover:bg-slate-50"><span className="text-slate-400"><MIco><rect x="4.5" y="3.5" width="15" height="17" rx="2" /><path d="M8 8.5h8M8 12h8M8 15.5h5" /></MIco></span>Tin của tôi</Link>
            </div>
          )}
          {user && (laAdmin(user) || coVaiTro(user, 'gis') || coVaiTro(user, 'vanban')) && (
            <div className="mt-1.5 pt-2 border-t border-slate-100">
              <p className="px-2 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Quản lý</p>
              <Link href="/quan-tri" onClick={() => setOpen(false)} className="flex items-center gap-3 py-2.5 px-2 rounded-lg text-sm font-bold text-[#0A2540] hover:bg-slate-50"><span className="text-slate-400"><MIco><path d="M12 3.5 5 6v5c0 4.2 3 7.6 7 9.5 4-1.9 7-5.3 7-9.5V6l-7-2.5Z" /><path d="m9.3 11.8 1.9 1.9 3.4-3.8" /></MIco></span>Trang quản lý</Link>
            </div>
          )}
          <div className="mt-1.5 pt-2 border-t border-slate-100">
            <a href="tel:0988888888" className="flex items-center gap-3 py-2.5 px-2 rounded-lg text-sm font-bold text-[#0A2540] hover:bg-slate-50"><span className="text-[#C8A14B]"><MIco><path d="M6.6 4.5h2.9l1.2 4-1.8 1.4a11 11 0 0 0 5.2 5.2l1.4-1.8 4 1.2v2.9a1.5 1.5 0 0 1-1.6 1.5C10.6 19.6 4.4 13.4 3.6 6.1A1.5 1.5 0 0 1 5.1 4.5h1.5Z" /></MIco></span>Hotline 0988 888 888</a>
            <button onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('cl-open-chat', { detail: { tab: 'advisory' } })); }} className="w-full text-left flex items-center gap-3 py-2.5 px-2 rounded-lg text-sm font-semibold text-[#0A2540] hover:bg-slate-50"><span className="text-[#C8A14B]"><MIco><path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.4A8 8 0 1 1 20 11.5Z" /></MIco></span>Chat với chúng tôi</button>
            {user ? (
              <button onClick={doLogout} className="w-full text-left flex items-center gap-3 py-2.5 px-2 mt-1.5 pt-3 border-t border-slate-100 rounded-lg text-sm font-semibold text-red-600 hover:bg-slate-50"><MIco><path d="M14.5 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5h8" /><path d="M18.5 12H9.5m9 0-3.2-3.2m3.2 3.2-3.2 3.2" /></MIco>Đăng xuất</button>
            ) : loading ? null : (
              <>
                <button onClick={() => { setOpen(false); openLogin(); }} className="w-full text-left flex items-center gap-3 py-2.5 px-2 rounded-lg text-sm font-semibold text-[#0A2540] hover:bg-slate-50"><span className="text-slate-400"><MIco><path d="M14.5 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4" /><path d="M10 12h9m-9 0 3.2-3.2M10 12l3.2 3.2" /></MIco></span>Đăng nhập</button>
                <Link href="/register" onClick={() => setOpen(false)} className="flex items-center gap-3 py-2.5 px-2 rounded-lg text-sm font-semibold text-[#C8A14B] hover:bg-slate-50"><span className="text-[#C8A14B]"><MIco><circle cx="9" cy="8" r="3.5" /><path d="M3.5 20c0-3.3 2.4-5.5 5.5-5.5c1 0 2 .25 2.8.7" /><path d="M17.5 14v5M15 16.5h5" /></MIco></span>Đăng ký</Link>
              </>
            )}
          </div>
        </nav>
      )}
      </header>
    </>
  );
}
