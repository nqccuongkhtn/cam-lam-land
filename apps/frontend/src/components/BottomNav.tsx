'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { toolIconSvg } from '@/lib/toolIcons';
import { TIEN_ICH_TOOLS } from '@/lib/tienIchTools';
import { runToolAction, locTheoQuyen } from '@/components/HubShell';

type Name = 'home' | 'find' | 'post' | 'map' | 'me' | 'tools';

// Icon kiểu Facebook: nét mảnh khi bình thường, TÔ ĐẶC khi đang ở tab đó.
function Ico({ name, on }: { name: Name; on: boolean }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24' } as const;
  const ln = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.85, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'home') return on
    ? <svg {...p} fill="currentColor"><path d="M11.3 3.2 3.9 9.7c-.25.2-.4.5-.4.83V20a1 1 0 0 0 1 1h4.3v-5.3a1 1 0 0 1 1-1h4.4a1 1 0 0 1 1 1V21H19a1 1 0 0 0 1-1v-9.47c0-.32-.15-.62-.4-.83L12.7 3.2a1 1 0 0 0-1.4 0Z" /></svg>
    : <svg {...p} {...ln}><path d="M4 10.2 12 3.5l8 6.7" /><path d="M6 9.3V20h12V9.3" /><path d="M10 20.5v-5.5h4v5.5" /></svg>;
  if (name === 'find') return on
    ? <svg {...p} fill="currentColor"><path d="M4.5 21a1 1 0 0 1-1-1V5.5A1.5 1.5 0 0 1 5 4h6.5A1.5 1.5 0 0 1 13 5.5V9h5.5A1.5 1.5 0 0 1 20 10.5V20a1 1 0 0 1-1 1H4.5Z" /></svg>
    : <svg {...p} {...ln}><path d="M4 20.5V5.5A1.5 1.5 0 0 1 5.5 4h6A1.5 1.5 0 0 1 13 5.5V9h5.5A1.5 1.5 0 0 1 20 10.5v10" /><path d="M3 20.5h18" /><path d="M7 8h2.4M7 12h2.4M7 16h2.4M16 13h1.4M16 16.5h1.4" /></svg>;
  if (name === 'post') return on
    ? <svg {...p} fill="none"><rect x="3" y="3" width="18" height="18" rx="5.5" fill="currentColor" /><path d="M12 8.2v7.6M8.2 12h7.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></svg>
    : <svg {...p} {...ln}><rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5.2" /><path d="M12 8.4v7.2M8.4 12h7.2" /></svg>;
  if (name === 'map') return on
    ? <svg {...p} fill="currentColor"><path d="M12 2.5a6.9 6.9 0 0 0-6.9 6.9c0 4.95 6.14 11.3 6.4 11.57a.68.68 0 0 0 .99 0c.26-.27 6.4-6.62 6.4-11.57A6.9 6.9 0 0 0 12 2.5Z" /><circle cx="12" cy="9.4" r="2.5" fill="#fff" /></svg>
    : <svg {...p} {...ln}><path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.4" /></svg>;
  if (name === 'tools') return on
    ? <svg {...p} fill="currentColor"><rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2.2" /><rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2.2" /><rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2.2" /><rect x="13.3" y="13.3" width="7.2" height="7.2" rx="2.2" /></svg>
    : <svg {...p} {...ln}><rect x="4" y="4" width="6.4" height="6.4" rx="1.9" /><rect x="13.6" y="4" width="6.4" height="6.4" rx="1.9" /><rect x="4" y="13.6" width="6.4" height="6.4" rx="1.9" /><rect x="13.6" y="13.6" width="6.4" height="6.4" rx="1.9" /></svg>;
  return on
    ? <svg {...p} fill="currentColor"><circle cx="12" cy="7.8" r="4.3" /><path d="M4 20.2c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5a.8.8 0 0 1-.8.8H4.8a.8.8 0 0 1-.8-.8Z" /></svg>
    : <svg {...p} {...ln}><circle cx="12" cy="8" r="4" /><path d="M4.6 20.4c0-3.6 3.3-5.6 7.4-5.6s7.4 2 7.4 5.6" /></svg>;
}

export default function BottomNav() {
  const path = usePathname() || '/';
  const { user } = useAuth();
  const [hidden, setHidden] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false); // sheet lưới Tiện ích (bấm tab Tiện ích)
  const lastY = useRef(0);
  const ticking = useRef(false);

  // Cuộn XUỐNG → ẩn thanh (đọc thoải mái); cuộn LÊN → hiện lại; gần đỉnh trang luôn hiện. Như Facebook.
  useEffect(() => {
    lastY.current = window.scrollY;
    // Trang BẢN ĐỒ: thanh dưới luôn hiện (trang gói trong một khung hình, không cuộn).
    if (path.startsWith('/map')) { setHidden(false); return; }
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY.current;
        if (y < 56) setHidden(false);
        else if (dy > 6) setHidden(true);
        else if (dy < -6) setHidden(false);
        lastY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [path]);

  // Ẩn ở form đăng/sửa tin (khỏi che nút lưu) và trang quản trị.
  const navShown = !(path.startsWith('/sales/post') || path.startsWith('/sales/edit') || path.startsWith('/admin'));
  // Báo cho pill "Danh sách/Bản đồ" + bong bóng chat biết thanh dưới đang hiện/ẩn để tự canh vị trí (mượt).
  useEffect(() => {
    const show = navShown && !hidden;
    document.documentElement.style.setProperty('--cl-fab-shift', show ? '-56px' : '0px');
    document.documentElement.style.setProperty('--cl-hub-pb', show ? 'calc(3.375rem + env(safe-area-inset-bottom))' : '0px'); // chừa chỗ cho thanh dưới trong hub (mobile)
  }, [hidden, navShown]);
  // Hub Tiện ích: cuộn trong iframe → nhận tín hiệu ẩn/hiện thanh dưới.
  useEffect(() => {
    const onEmbed = (e: Event) => setHidden(!!(e as CustomEvent<{ hidden?: boolean }>).detail?.hidden);
    window.addEventListener('cl-embed-scroll', onEmbed as EventListener);
    return () => window.removeEventListener('cl-embed-scroll', onEmbed as EventListener);
  }, []);
  // Cho phép MENU ĐIỀU HƯỚNG (drawer) mở sheet Tiện ích qua sự kiện 'cl-open-tools' — kể cả khi vừa nhảy sang /tien-ich.
  const wantTools = useRef(false);
  useEffect(() => {
    const onOpen = () => { wantTools.current = true; setToolsOpen(true); };
    window.addEventListener('cl-open-tools', onOpen);
    return () => window.removeEventListener('cl-open-tools', onOpen);
  }, []);
  useEffect(() => { if (wantTools.current) { wantTools.current = false; setToolsOpen(true); } else setToolsOpen(false); }, [path]); // đổi trang → đóng sheet (trừ khi vừa yêu cầu mở lúc điều hướng)
  if (!navShown) return null;

  const tabs: { href?: string; name: Name; on: boolean; label: string; sheet?: boolean }[] = [
    { href: '/', name: 'home', on: path === '/', label: 'Trang chủ' },
    { href: '/listings', name: 'find', on: path.startsWith('/listings'), label: 'Nhà đất' },
    { href: user ? '/sales/post' : '/login', name: 'post', on: path.startsWith('/sales'), label: 'Đăng tin' },
    { href: '/map', name: 'map', on: path.startsWith('/map'), label: 'Bản đồ' },
    { name: 'tools', on: toolsOpen || path.startsWith('/tien-ich'), label: 'Tiện ích', sheet: true },
  ];

  return (
    <>
      {/* SHEET Tiện ích — bấm tab "Tiện ích" ở thanh dưới thì trồi lên (giống lưới trong trang Tiện ích) */}
      {toolsOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-label="Tiện ích">
          <div className="absolute inset-0 bg-[#0A2540]/30 cl-sheet-fade" onClick={() => setToolsOpen(false)} aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-slate-200 bg-white px-3 pt-2 shadow-2xl cl-sheet-up" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-300" />
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-[13px] font-bold text-[#0A2540]">🧰 Tiện ích</span>
              <button type="button" onClick={() => setToolsOpen(false)} aria-label="Đóng" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 active:bg-slate-100"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {/* Công cụ nội bộ chỉ hiện với tài khoản được cấp quyền — lọc y như trang Tiện ích. */}
              {locTheoQuyen(TIEN_ICH_TOOLS, user).map((t) => {
                const cls = 'flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 active:bg-slate-50';
                const inner = (<><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0A2540] text-[#C8A14B]" dangerouslySetInnerHTML={{ __html: toolIconSvg(t.key, 22) }} /><span className="line-clamp-2 text-center text-[10px] leading-[1.15] text-slate-600">{t.name}</span></>);
                return t.action
                  ? <button key={t.key} type="button" onClick={() => { runToolAction(t); setToolsOpen(false); }} className={cls}>{inner}</button>
                  : <Link key={t.key} href={`/tien-ich?tab=${t.key}`} onClick={() => { window.dispatchEvent(new CustomEvent('cl-hub-tab', { detail: { key: t.key } })); setToolsOpen(false); }} className={cls}>{inner}</Link>;
              })}
            </div>
          </div>
        </div>
      )}
      {/* Thanh dưới: nền trắng mờ + bóng nhẹ thay cho đường kẻ cứng; tab đang chọn có "viên thuốc" màu nhạt ôm icon
          (thay cho vạch đỏ trên đầu trước đây — nhìn thô). Nút "Đăng tin" nổi lên giữa thành nút tròn đỏ cho dễ thấy.
          Chiều cao GIỮ 54px — biến --cl-hub-pb ở trên đang tính theo đúng số này. */}
      <nav className={`md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-xl shadow-[0_-1px_0_rgba(15,23,42,0.06),0_-6px_20px_rgba(15,23,42,0.06)] transition-transform duration-200 ease-out ${hidden ? 'translate-y-full' : 'translate-y-0'}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <ul className="flex items-stretch h-[54px] max-w-lg mx-auto px-1">
          {tabs.map((t) => {
            const noi = t.name === 'post'; // nút giữa nổi lên
            const cls = `relative h-full w-full flex flex-col items-center justify-center gap-[3px] transition-colors active:opacity-70 ${t.on ? 'text-red-600' : 'text-slate-500'}`;
            const inner = noi
              ? (<>
                  <span aria-hidden className="-mt-3 grid h-10 w-10 place-items-center rounded-full bg-gradient-to-b from-red-500 to-red-600 text-white ring-[3px] ring-white shadow-[0_4px_10px_-3px_rgba(220,38,38,0.5)] transition-transform active:scale-90">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5.5v13M5.5 12h13" /></svg>
                  </span>
                  <span className={`text-[10.5px] leading-none ${t.on ? 'font-bold' : 'font-medium'}`}>{t.label}</span>
                </>)
              : (<>
                  <span aria-hidden className={`grid h-7 w-12 place-items-center rounded-full transition-colors duration-200 ${t.on ? 'bg-red-50' : ''}`}><Ico name={t.name} on={t.on} /></span>
                  <span className={`text-[10.5px] leading-none ${t.on ? 'font-bold' : 'font-medium'}`}>{t.label}</span>
                </>);
            return (
              <li key={t.label} className="flex-1">
                {t.sheet
                  ? <button type="button" onClick={() => setToolsOpen((o) => !o)} aria-label={t.label} aria-expanded={toolsOpen} className={cls}>{inner}</button>
                  : <Link href={t.href!} aria-label={t.label} aria-current={t.on ? 'page' : undefined} className={cls}>{inner}</Link>}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
