'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toolIconSvg as iconSvg } from '@/lib/toolIcons';
import { useAuth, coVaiTro } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';

// `vaiTro`: chỉ những tài khoản mang một trong các vai trò này mới THẤY công cụ.
// Bỏ trống = ai cũng thấy. (Khác với `login` — cái đó chỉ nhắc phải đăng nhập.)
export type HubTool = { key: string; name: string; desc: string; icon: string; path: string; login?: boolean; vaiTro?: string[]; children?: HubTool[]; action?: string };

/** Lọc bỏ những công cụ mà tài khoản này không có quyền thấy. */
export function locTheoQuyen(ds: HubTool[], user: any): HubTool[] {
  return ds
    .filter((t) => !t.vaiTro?.length || coVaiTro(user, ...t.vaiTro))
    .map((t) => (t.children?.length ? { ...t, children: locTheoQuyen(t.children, user) } : t));
}

const withEmbed = (p: string) => p + (p.includes('?') ? '&' : '?') + 'embed=1';

// Công cụ có "action" (vd mở chat) thay vì mở trang trong iframe. Trả true nếu đã xử lý (chặn điều hướng).
export function runToolAction(t: HubTool): boolean {
  if (typeof window !== 'undefined' && t.action && t.action.startsWith('chat:')) {
    window.dispatchEvent(new CustomEvent('cl-open-chat', { detail: { tab: t.action.split(':')[1] || 'community' } }));
    return true;
  }
  return false;
}

// Khung "admin dashboard" dùng chung: 1 sidebar; item MẸ có submenu -> bấm là sổ xuống (accordion). Nội dung nhúng qua iframe.
export default function HubShell({ tools: tatCa, storageKey = 'hub', hideMobileMenu = false }: { title?: string; subtitle?: string; tools: HubTool[]; storageKey?: string; hideMobileMenu?: boolean }) {
  // Công cụ nội bộ (vd tra mã xác thực) chỉ hiện với tài khoản được cấp quyền.
  const { user, loading: dangTaiTk } = useAuth();
  const tools = useMemo(() => locTheoQuyen(tatCa, user), [tatCa, user]);
  const leaves = useMemo(() => tools.flatMap((t) => (t.children?.length ? t.children : [t])), [tools]);
  const parentOf = useMemo(() => { const m: Record<string, string> = {}; tools.forEach((t) => t.children?.forEach((c) => { m[c.key] = t.key; })); return m; }, [tools]);
  const [tab, setTab] = useState<string>(leaves.find((l) => !l.action)?.key || leaves[0]?.key || '');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [reloadN, setReloadN] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  // Tab ghi trong đường link lúc MỞ TRANG. Phải nhớ lại: công cụ nội bộ (vd ?tab=ma-xac-thuc) chỉ có trong danh
  // sách SAU KHI tải xong tài khoản. Trước đây đọc link ngay lúc mở → chưa thấy công cụ → rơi về tab đầu
  // (Cẩm nang) rồi GHI ĐÈ luôn đường link (chủ dự án báo 15/9/2026). Giờ danh sách đổi là thử mở lại tab này.
  const tabTuLink = useRef<string | null>(null);
  // Công cụ link yêu cầu mà tài khoản hiện tại KHÔNG được thấy (chưa đăng nhập / sai tài khoản) → báo rõ.
  const [biChan, setBiChan] = useState<HubTool | null>(null);
  const tatCaLa = useMemo(() => tatCa.flatMap((t) => (t.children?.length ? t.children : [t])), [tatCa]);
  useEffect(() => {
    try {
      tabTuLink.current = new URLSearchParams(window.location.search).get('tab');
      setCollapsed(localStorage.getItem(storageKey + '_collapsed') === '1');
    } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = tabTuLink.current;
    if (t && leaves.some((x) => x.key === t && !x.action)) { setTab(t); setBiChan(null); tabTuLink.current = null; return; }
    if (t) setBiChan(tatCaLa.find((x) => x.key === t) || null);
    // Tab đang mở BIẾN MẤT khỏi danh sách (vd lúc đầu còn nhớ phiên đăng nhập cũ nên thấy "Mã xác thực", máy chủ
    // báo phiên hết hạn → mất quyền) → về công cụ đầu tiên. Không làm thì khung nội dung rơi vào ô "Cộng đồng"
    // (ô mở chat, không có trang) và nạp LẠI CHÍNH TRANG TIỆN ÍCH vào trong nó — hub lồng hub (chủ dự án chụp 15/9/2026).
    setTab((cu) => (leaves.some((x) => x.key === cu && !x.action) ? cu : (leaves.find((x) => !x.action)?.key || cu)));
  }, [leaves, tatCaLa]);
  // Chọn công cụ từ SHEET Tiện ích ở thanh dưới khi ĐANG ở hub (trang không remount) → nghe sự kiện đổi tab.
  useEffect(() => {
    const onTab = (e: Event) => { const k = (e as CustomEvent<{ key?: string }>).detail?.key; if (k && leaves.some((x) => x.key === k && !x.action)) setTab(k); };
    window.addEventListener('cl-hub-tab', onTab as EventListener);
    return () => window.removeEventListener('cl-hub-tab', onTab as EventListener);
  }, [leaves]);
  const didMount = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    setMobileMenu(false);   // "đang tải" bật ở effect theo cur.key bên dưới — chỉ khi khung nhúng THẬT SỰ nạp trang khác
    if (didMount.current) { const p = parentOf[tab]; if (p) setExpanded((e) => (e[p] ? e : { ...e, [p]: true })); } // lần đầu: đóng sẵn submenu; chỉ mở khi người dùng điều hướng sau đó
    didMount.current = true;
    try { const u = new URL(window.location.href); u.searchParams.set('tab', tab); window.history.replaceState(null, '', u.toString()); } catch { /* */ }
  }, [tab, parentOf]);

  // Theo dõi URL THỰC của iframe (kể cả khi bấm link BÊN TRONG trang nhúng):
  //  • Nhảy sang công cụ khác  → tự chọn đúng item ở sidebar.
  //  • Trang không phải công cụ → ép ?embed=1 để KHÔNG hiện lại thanh nav/khung (tránh lồng hub vào trong).
  useEffect(() => {
    const curLeaf = leaves.find((l) => l.key === tab);
    const curPath = curLeaf ? curLeaf.path.split('?')[0] : '';
    const check = () => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      let path = '', search = '', hash = '';
      try { path = win.location.pathname; search = win.location.search; hash = win.location.hash; } catch { return; } // khác domain → bỏ qua
      if (!path || path === curPath) return; // vẫn ở trang hiện tại → không đụng (tránh reload thừa)
      const leaf = leaves.find((l) => l.path.split('?')[0] === path);
      if (leaf) { setTab(leaf.key); return; } // link nhảy sang công cụ khác → đồng bộ sidebar + nạp lại ở chế độ nhúng
      if (!/[?&]embed=1/.test(search)) { try { win.location.replace(path + (search ? search + '&' : '?') + 'embed=1' + hash); } catch { /* */ } }
    };
    const id = setInterval(check, 1500); // nới từ 500ms → 1500ms: giảm tải khi ở hub mà vẫn đồng bộ tab kịp thời
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, leaves]);

  const toggle = () => setCollapsed((c) => { const n = !c; try { localStorage.setItem(storageKey + '_collapsed', n ? '1' : '0'); } catch { /* */ } return n; });
  // Dự phòng: KHÔNG BAO GIỜ lấy ô có action (vd "Cộng đồng") làm trang hiển thị — nó không có đường dẫn,
  // khung nhúng sẽ nạp lại chính trang hub vào trong.
  const cur = useMemo(() => leaves.find((x) => x.key === tab && !x.action) || leaves.find((x) => !x.action) || leaves[0], [tab, leaves]);
  const { openLogin } = useLoginGate();
  // Bật "Đang mở…" ĐÚNG lúc khung nhúng đổi trang. Trước bật theo `tab`: tab đổi mà trang hiển thị không đổi (vd tab
  // công cụ nội bộ bị lùi về Cẩm nang đang mở sẵn) → khung không nạp lại → không có onLoad → kẹt "Đang mở" mãi.
  useEffect(() => { if (cur?.key) setLoading(true); }, [cur?.key]);
  // Link mở công cụ nội bộ mà CHƯA đăng nhập → bật luôn CỬA SỔ ĐĂNG NHẬP (chủ dự án 15/9/2026, thay dòng báo vàng).
  // Đăng nhập xong: danh sách công cụ đổi → effect ở trên tự mở đúng mục. Tắt cửa sổ: ở lại Cẩm nang (tab đầu).
  // Chờ tải xong tài khoản mới hỏi, không thì người CÓ quyền cũng bị bật cửa sổ trong tích tắc lúc mở trang.
  const daHoiDangNhap = useRef(false);
  useEffect(() => {
    if (!biChan || user || dangTaiTk || daHoiDangNhap.current) return;
    daHoiDangNhap.current = true;
    openLogin({ reason: `Mục "${biChan.name}" chỉ dành cho tài khoản được cấp quyền. Đăng nhập để mở.` });
  }, [biChan, user, dangTaiTk, openLogin]);
  // Ẩn/hiện menu TRÊN + DƯỚI theo cuộn BÊN TRONG iframe (mobile) — như trang chủ/tin đăng.
  const onFrameLoad = () => {
    setLoading(false);
    if (typeof window !== 'undefined' && window.innerWidth < 768) { window.dispatchEvent(new CustomEvent('cl-embed-scroll', { detail: { hidden: false } })); } // trang mới → hiện lại thanh nav
    const win = iframeRef.current?.contentWindow as (Window & { __clBridge?: boolean }) | null;
    if (!win || win.__clBridge) return;
    win.__clBridge = true;
    let last = 0;
    win.addEventListener('scroll', () => {
      if (window.innerWidth >= 768) return;                 // chỉ mobile
      const y = win.scrollY || 0;
      let h: boolean;
      if (y < 40) h = false; else if (y > last + 4) h = true; else if (y < last - 4) h = false; else return;
      last = y;
      window.dispatchEvent(new CustomEvent('cl-embed-scroll', { detail: { hidden: h } }));
    }, { passive: true });
  };
  if (!cur) return null;

  return (
    <div className="cl-hub flex flex-col bg-slate-100 h-[calc(100svh-104px)] md:h-[calc(100dvh-56px)]">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar (desktop) */}
        <nav className={`hidden md:flex md:flex-col shrink-0 bg-white border-r border-slate-200 overflow-y-auto py-2 transition-[width] duration-200 ${collapsed ? 'w-[58px]' : 'w-64'}`}>
          {collapsed ? (
            <button onClick={toggle} title="Mở rộng danh sách" className="mx-auto mb-1.5 grid place-items-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200 text-base leading-none">»</button>
          ) : (
            <div className="flex items-center justify-between pl-4 pr-2 pt-1 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Công cụ</span>
              <button onClick={toggle} title="Thu gọn danh sách" className="grid place-items-center w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200 text-sm leading-none">«</button>
            </div>
          )}
          {tools.map((t) => {
            const kids = t.children?.length ? t.children : null;
            const childActive = kids ? kids.some((c) => c.key === tab) : false;
            const on = !kids && t.key === tab;
            const isExp = !!expanded[t.key];
            return (
              <div key={t.key}>
                <button
                  onClick={() => { if (runToolAction(t)) return; if (kids) { if (collapsed) { toggle(); setExpanded((e) => ({ ...e, [t.key]: true })); } else setExpanded((e) => ({ ...e, [t.key]: !e[t.key] })); } else setTab(t.key); }}
                  className={`group relative w-full text-left flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 border-l-[3px] transition ${on || childActive ? 'border-[#C8A14B] bg-[#C8A14B]/10' : 'border-transparent hover:bg-slate-50'}`}>
                  <span className={`grid place-items-center w-9 h-9 rounded-[11px] shrink-0 transition-all ${on || childActive ? 'bg-[#C8A14B] text-[#0A2540] shadow-sm shadow-[#C8A14B]/40' : 'bg-[#0A2540] text-[#C8A14B] group-hover:bg-[#0d3a6b]'}`} dangerouslySetInnerHTML={{ __html: iconSvg(t.key) }} />
                  {!collapsed && (
                    <span className="min-w-0 flex-1">
                      <span className={`block font-bold text-[13.5px] leading-tight ${on || childActive ? 'text-[#0A2540]' : 'text-slate-700'}`}>{t.name}{t.login && <span className="ml-1 text-[10px] font-semibold text-slate-400">🔒</span>}</span>
                      <span className="block text-[11px] text-slate-400 leading-snug mt-0.5">{t.desc}</span>
                    </span>
                  )}
                  {!collapsed && kids && <svg viewBox="0 0 24 24" className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${isExp ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9l6 6 6-6" /></svg>}
                  {collapsed && <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0A2540] px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">{t.name}</span>}
                </button>
                {/* Submenu sổ xuống ngay trong sidebar */}
                {!collapsed && kids && isExp && (
                  <div className="ml-[30px] mb-1 border-l border-slate-200">
                    {kids.map((c) => {
                      const cOn = c.key === tab;
                      return (
                        <button key={c.key} onClick={() => setTab(c.key)}
                          className={`w-full text-left flex items-center gap-2 pl-3 pr-3 py-2 border-l-2 -ml-px transition ${cOn ? 'border-[#C8A14B] text-[#0A2540] font-semibold bg-[#C8A14B]/10' : 'border-transparent text-slate-500 hover:text-[#0A2540] hover:bg-slate-50'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cOn ? 'bg-[#C8A14B]' : 'bg-slate-300'}`} />
                          <span className="text-[13px] leading-tight">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Thanh MENU cho MOBILE (sidebar ẩn ở mobile) — ẩn nếu hideMobileMenu (trang Tiện ích đã có sheet đầy đủ ở thanh dưới) */}
          {!hideMobileMenu && (
          <div className="md:hidden relative shrink-0 bg-white border-b border-slate-200">
            <div className="flex items-center gap-2 px-3 py-2">
              <button onClick={() => setMobileMenu((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left active:bg-slate-50">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#0A2540] text-[#C8A14B]" dangerouslySetInnerHTML={{ __html: iconSvg(cur.key, 16) }} />
                <b className="min-w-0 flex-1 truncate text-[13px] text-[#0A2540]">{cur.name}</b>
                <svg viewBox="0 0 24 24" className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${mobileMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <button onClick={() => { setLoading(true); setReloadN((n) => n + 1); }} title="Tải lại" aria-label="Tải lại" className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 active:bg-slate-50">↻</button>
            </div>
            {mobileMenu && (
              <>
                <div className="fixed inset-0 z-[59] bg-black/20" onClick={() => setMobileMenu(false)} />
                <div className="absolute inset-x-2 top-full z-[60] -mt-0.5 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl">
                  {tools.map((t) => {
                    const kids = t.children?.length ? t.children : null;
                    if (!kids) {
                      const on = t.key === tab;
                      return (
                        <button key={t.key} onClick={() => { setMobileMenu(false); if (runToolAction(t)) return; setTab(t.key); }} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${on ? 'bg-[#C8A14B]/15' : 'hover:bg-slate-50'}`}>
                          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on ? 'bg-[#C8A14B] text-[#0A2540]' : 'bg-[#0A2540] text-[#C8A14B]'}`} dangerouslySetInnerHTML={{ __html: iconSvg(t.key, 16) }} />
                          <span className="min-w-0 flex-1"><b className={`block truncate text-[13px] ${on ? 'text-[#0A2540]' : 'text-slate-700'}`}>{t.name}{t.login && <span className="ml-1 text-[10px] text-slate-400">🔒</span>}</b><span className="block truncate text-[11px] text-slate-400">{t.desc}</span></span>
                        </button>
                      );
                    }
                    return (
                      <div key={t.key} className="mt-1 first:mt-0">
                        <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"><span className="[&_svg]:h-3.5 [&_svg]:w-3.5" dangerouslySetInnerHTML={{ __html: iconSvg(t.key, 13) }} />{t.name}</p>
                        {kids.map((c) => { const on = c.key === tab; return (
                          <button key={c.key} onClick={() => { setTab(c.key); setMobileMenu(false); }} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 pl-3.5 text-left ${on ? 'bg-[#C8A14B]/15 font-semibold text-[#0A2540]' : 'text-slate-600 hover:bg-slate-50'}`}>
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? 'bg-[#C8A14B]' : 'bg-slate-300'}`} />
                            <span className="truncate text-[13px]">{c.name}</span>
                          </button>
                        ); })}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          )}
          <div className="hidden md:flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-b border-slate-200 text-[12px]">
            <span className="flex items-center gap-1.5 text-slate-500 truncate"><span className="text-[#0A2540] shrink-0" dangerouslySetInnerHTML={{ __html: iconSvg(cur.key, 15) }} /> <b className="text-[#0A2540]">{cur.name}</b><span className="hidden sm:inline text-slate-400"> — {cur.desc}</span></span>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => { setLoading(true); setReloadN((n) => n + 1); }} className="font-semibold text-slate-500 hover:text-[#0A2540] px-2 py-1 rounded-lg hover:bg-slate-100">↻ Tải lại</button>
              <a href={cur.path} target="_blank" rel="noreferrer" className="font-bold text-[#C8A14B] hover:underline whitespace-nowrap px-1">Mở toàn trang ↗</a>
            </div>
          </div>
          {/* Đã đăng nhập mà tài khoản KHÔNG có quyền: cửa sổ đăng nhập không giúp gì → báo một dòng ngắn. */}
          {biChan && user && (
            <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              <span>🔒 Tài khoản đang đăng nhập chưa được cấp quyền mở <b>{biChan.name}</b>.</span>
              <button onClick={() => setBiChan(null)} aria-label="Đóng" className="ml-auto text-amber-700">✕</button>
            </div>
          )}
          <div className="relative flex-1 min-h-0 bg-white">
            {loading && (
              <div className="absolute inset-0 grid place-items-center bg-white z-10 pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <div className="w-8 h-8 border-[3px] border-slate-200 border-t-[#0A2540] rounded-full animate-spin" />
                  <span className="text-sm">Đang mở {cur.name}…</span>
                </div>
              </div>
            )}
            <iframe ref={iframeRef} key={`${cur.key}-${reloadN}`} src={withEmbed(cur.path)} title={cur.name} onLoad={onFrameLoad} allow="fullscreen"
              className="w-full h-full block" style={{ border: 0 }} />

          </div>
        </div>
      </div>
    </div>
  );
}
