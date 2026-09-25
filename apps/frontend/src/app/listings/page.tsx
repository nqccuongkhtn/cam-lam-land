'use client';
import { useEffect, useMemo, useRef, useState, Suspense, Fragment } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, thumbUrl, uploadImages } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';
import { useHideOnScroll } from '@/lib/hideOnScroll';
import Link from 'next/link';
import { Listing, PropertyType, PROPERTY_LABELS, priceLabel, SALE_PROPERTY_TYPES, RENT_PROPERTY_TYPES, type DealType } from '@/lib/types';
import { listMyPlaces, addPlace, removePlace, type SavedPlace } from '@/lib/savedPlaces';
import { listCustomers, listInterests, addInterest, removeInterest, type Customer, type Interest } from '@/lib/crm';
import ListingRow from '@/components/ListingRow';
import SiteFooter from '@/components/SiteFooter';
import { Skeleton, EmptyState, Button, Card } from '@/components/ui';
import type { BaseMap, ImageOverlay } from '@/components/MapView';
import { wgs84ToVn2000 } from '@/lib/vn2000';
import BottomSheet from '@/components/BottomSheet';
import { usePullToRefresh } from '@/lib/usePullToRefresh';
import LogoAnh from '@/components/LogoAnh';
import LogoLe from '@/components/LogoLe';
import { useLogoLe } from '@/lib/logoLe';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="h-full w-full grid place-items-center bg-slate-100 text-slate-400 text-sm animate-pulse">Đang tải bản đồ…</div> });
// Khoảng giá theo tỷ (bán) — cho thuê dùng phần lẻ của tỷ để load() giữ nguyên hệ số ×1e9 (3 triệu = 0.003 tỷ).
const SALE_PRICE_RANGES: [string, string, string][] = [['Tất cả mức giá', '', ''], ['Dưới 1 tỷ', '', '1'], ['1 - 3 tỷ', '1', '3'], ['3 - 5 tỷ', '3', '5'], ['5 - 10 tỷ', '5', '10'], ['10 - 20 tỷ', '10', '20'], ['Trên 20 tỷ', '20', '']];
const RENT_PRICE_RANGES: [string, string, string][] = [['Tất cả mức giá', '', ''], ['Dưới 3 triệu', '', '0.003'], ['3 - 5 triệu', '0.003', '0.005'], ['5 - 10 triệu', '0.005', '0.01'], ['10 - 20 triệu', '0.01', '0.02'], ['20 - 50 triệu', '0.02', '0.05'], ['Trên 50 triệu', '0.05', '']];
const AREA_RANGES: [string, number, number][] = [['Tất cả diện tích', 0, 0], ['Dưới 50 m²', 0, 50], ['50 - 80 m²', 50, 80], ['80 - 100 m²', 80, 100], ['100 - 150 m²', 100, 150], ['150 - 300 m²', 150, 300], ['Trên 300 m²', 300, 0]];
const BASE_THUMBS: [BaseMap, string, string][] = [['street', 'Mặc định', 'm'], ['satellite', 'Vệ tinh', 's'], ['terrain', 'Địa hình', 'p']];
const lyrOf = (b: BaseMap) => (b === 'satellite' ? 's' : b === 'terrain' ? 'p' : 'm');

const QH = {
  id: 'qh-qd205', url: '/overlays/QD205.png',
  // Bộ tile render từ DGN (QD205) → z10-18, ĐẦY ĐỦ mọi zone.
  // minzoom = ĐÚNG mức thấp nhất đã cắt (z12) — khai 10 là đi đòi ô không tồn tại, nhận 404.
  tiles: ['/tiles/qd205v11/{z}/{x}/{y}.png?v=2'], minzoom: 12, maxzoom: 18,   // ?v=2: xem ghi chú ở app/map/page.tsx
  coordinates: [[108.9401268, 12.217594], [109.2563886, 12.217594], [109.2563886, 11.9257021], [108.9401268, 11.9257021]] as [[number, number], [number, number], [number, number], [number, number]],
};
const QH_BOUNDS: [[number, number], [number, number]] = [[108.9401268, 11.9257021], [109.2563886, 12.217594]];
// Màu gim theo trạng thái chốt deal — quản lý deal trực quan trên bản đồ.
const dealColor = (s?: string | null) => s === 'Đã chốt' ? '#16a34a' : s === 'Thương lượng' ? '#ea580c' : s === 'Đang tư vấn' ? '#0891b2' : s === 'Không thành' ? '#9ca3af' : '#7c3aed';
interface ParcelInfo { found: boolean; parcel: { properties: Record<string, any> } | null; zoning: Record<string, any> | null; }

// Khối "Tin xác thực" lồng vào giữa feed — giống cách batdongsan chèn tin đã kiểm chứng.
function VerifiedPromo({ count, onView }: { count: number; onView: () => void }) {
  const items = ['Có sổ đỏ / hợp đồng mua bán', 'Đúng địa chỉ, hình ảnh & đặc điểm', 'Trong khoảng giá thị trường'];
  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full bg-emerald-600 text-white grid place-items-center shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20 6 9 17l-5-5" /></svg></span>
        <div>
          <p className="font-extrabold text-[#0B4045] leading-tight">Tin xác thực bởi Cam Lâm Land</p>
          <p className="text-[12px] text-slate-500">Đội ngũ Cam Lâm Land đã kiểm chứng thực tế</p>
        </div>
      </div>
      <div className="mt-2.5 grid gap-1.5 text-[13px] text-slate-600">
        {items.map((s, i) => (<div key={i} className="flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0"><path d="M20 6 9 17l-5-5" /></svg>{s}</div>))}
      </div>
      {count > 0 && <button onClick={onView} className="mt-3 inline-flex items-center gap-1 bg-white border border-emerald-300 text-emerald-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-emerald-100 transition">Xem {count} tin xác thực →</button>}
    </div>
  );
}

// Nhóm bộ lọc trong bottom-sheet (nhãn nhỏ + hàng chip).
function Fgrp({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
// Chip chọn trong bottom-sheet (sáng lên khi đang chọn).
function Fchip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`cl-press rounded-full border px-3.5 py-2 text-sm font-semibold transition ${on ? 'border-[#0B4045] bg-[#0B4045] text-white' : 'border-slate-200 text-slate-600 active:bg-slate-50'}`}>{children}</button>
  );
}

// Desktop? (>=768px) — web dùng PHÂN TRANG số; mobile dùng "Xem thêm".
function useIsDesktop(): boolean {
  const [d, setD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setD(mq.matches); on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return d;
}

// Phân trang số kiểu batdongsan: ‹ 1 2 3 … N ›
function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const items: (number | '…')[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= page - 1 && i <= page + 1)) items.push(i);
    else if (items[items.length - 1] !== '…') items.push('…');
  }
  const nav = 'w-9 h-9 grid place-items-center rounded-lg font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="mt-6 flex items-center justify-center gap-1.5 flex-wrap">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={`${nav} bg-white border border-slate-200 text-slate-600 hover:border-[#0B4045]`} aria-label="Trang trước">‹</button>
      {items.map((n, i) => n === '…'
        ? <span key={`e${i}`} className="px-1.5 text-slate-400">…</span>
        : <button key={n} onClick={() => onPage(n)} className={`${nav} ${n === page ? 'bg-[#0B4045] text-white' : 'bg-white border border-slate-200 text-slate-700 hover:border-[#0B4045]'}`}>{n}</button>)}
      <button disabled={page >= total} onClick={() => onPage(page + 1)} className={`${nav} bg-white border border-slate-200 text-slate-600 hover:border-[#0B4045]`} aria-label="Trang sau">›</button>
    </div>
  );
}

function ListingsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [type, setType] = useState<PropertyType | ''>('');
  const [min, setMin] = useState(''); const [max, setMax] = useState(''); const [q, setQ] = useState('');
  const [areaRange, setAreaRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });
  const [verified, setVerified] = useState(false);
  const [visible, setVisible] = useState(8); // MOBILE: hiện dần, bấm "Xem thêm" tải thêm
  const [page, setPage] = useState(1);        // WEB: phân trang số
  const isDesktop = useIsDesktop();
  const PER_PAGE = 15;
  const [loading, setLoading] = useState(false);
  const [mapView, setMapView] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false); // ô tìm kiếm toàn màn hình (mobile)
  const [filterOpen, setFilterOpen] = useState(false); // bộ lọc bottom-sheet (mobile)
  const [mapMounted, setMapMounted] = useState(false); // đã mở bản đồ ít nhất 1 lần → GIỮ mount để chuyển tab KHÔNG load lại
  useEffect(() => { if (mapView) setMapMounted(true); }, [mapView]);
  // GIỮ vị trí cuộn danh sách khi chuyển tab: lưu scroll khi MỞ bản đồ, khôi phục khi QUAY LẠI danh sách (không về đầu)
  const listScrollY = useRef(0);
  const goMapView = (v: boolean) => { if (v && !mapView) listScrollY.current = window.scrollY; setMapView(v); };
  useEffect(() => {
    if (mapView || listScrollY.current <= 0) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, listScrollY.current)));
    return () => cancelAnimationFrame(id);
  }, [mapView]);
  const [showFilters, setShowFilters] = useState(false); // ở chế độ bản đồ: ẩn hàng lọc, bấm ⚙ Lọc mới mở — chừa chỗ cho bản đồ
  const [layerOpen, setLayerOpen] = useState(false);
  const [baseMap, setBaseMap] = useState<BaseMap>('satellite');
  const [qhOn, setQhOn] = useState(true);
  const [opacity, setOpacity] = useState(0.7);
  const [labels, setLabels] = useState(true);
  const [info, setInfo] = useState<{ x: number; y: number; lng: number; lat: number; parcel: any; zoning: any } | null>(null);
  const [showSave, setShowSave] = useState(false); // chỉ hiện form lưu tin khi người dùng bấm "Lưu tin này"
  const [flyPoint, setFlyPoint] = useState<{ lng: number; lat: number } | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(true); // bottom sheet lưu tin: kéo lên/thu gọn (đồng bộ với /map)
  const [ads, setAds] = useState<any[]>([]);
  const [sort, setSort] = useState('default');
  const [inited, setInited] = useState(false); // đã đọc bộ lọc từ URL xong → mới cho ghi URL (tránh ghi đè lúc mount)
  const { user } = useAuth();
  const { openLogin } = useLoginGate();
  const hidden = useHideOnScroll(20); // đồng bộ với Nav: cuộn xuống → thanh tìm kiếm trượt lên bám đỉnh
  const logoLe = useLogoLe();        // hôm nay có logo ngày lễ không (dùng cho logo nhỏ khi cuộn)
  const filterRef = useRef<HTMLDivElement>(null); // hàng lọc cuộn ngang — để "nhích" gợi ý
  const endRef = useRef<HTMLDivElement>(null);    // mốc cuối danh sách → ẩn pill khi chạm footer
  const [nearEnd, setNearEnd] = useState(false);  // đã cuộn gần cuối (footer) → ẩn pill nổi
  const [mine, setMine] = useState(false);
  const [drafts, setDrafts] = useState<SavedPlace[]>([]); // sản phẩm đã lưu trên bản đồ — CHƯA đăng tin
  const [mapLayer, setMapLayer] = useState<'all' | 'mine' | 'saved'>('all'); // 1 lúc chỉ hiện 1: tin đăng tổng / giỏ của tôi / điểm lưu (ẩn giá)
  const [pParcel, setPParcel] = useState(''); const [pSheet, setPSheet] = useState(''); const [pWard, setPWard] = useState(''); // địa chính
  const [pFeat, setPFeat] = useState(''); // đặc điểm & lưu ý
  const [pOwner, setPOwner] = useState(''); const [pPhone, setPPhone] = useState('');
  const [pPrice, setPPrice] = useState(''); const [pArea, setPArea] = useState(''); const [pComm, setPComm] = useState('');
  const [interests, setInterests] = useState<Interest[]>([]); const [showAddInt, setShowAddInt] = useState(false); // khách quan tâm 1 tin
  const [custList, setCustList] = useState<Customer[]>([]);
  const [iCustId, setICustId] = useState(''); const [iName, setIName] = useState(''); const [iPhone, setIPhone] = useState('');
  const [iInterest, setIInterest] = useState(''); const [iDeal, setIDeal] = useState('');
  const [pImages, setPImages] = useState<string[]>([]); const [pUp, setPUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selPlace, setSelPlace] = useState<SavedPlace | null>(null); // tin lưu đang mở bảng thông tin
  const pinClickRef = useRef(0);                                     // chặn onMapClick khi vừa bấm gim tin lưu
  const [deal, setDeal] = useState<DealType>('sale');
  const TYPES = ['', ...(deal === 'rent' ? RENT_PROPERTY_TYPES : SALE_PROPERTY_TYPES)] as (PropertyType | '')[];
  const PRICE_RANGES = deal === 'rent' ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;

  function load(over?: { type?: string; min?: string; max?: string; q?: string; mine?: boolean; deal?: string }) {
    setLoading(true);
    if (over?.mine ?? mine) {
      const dl = over?.deal ?? deal;
      api<{ listings: Listing[] }>(`/listings/mine?deal=${dl}`).then((d) => setListings(d.listings || [])).catch(() => setListings([])).finally(() => setLoading(false));
      return;
    }
    const p = new URLSearchParams();
    const t = over?.type ?? type, mn = over?.min ?? min, mx = over?.max ?? max, kw = over?.q ?? q, dl = over?.deal ?? deal;
    if (t) p.set('propertyType', t);
    if (mn) p.set('minPrice', String(Number(mn) * 1e9));
    if (mx) p.set('maxPrice', String(Number(mx) * 1e9));
    if (kw) p.set('q', kw);
    p.set('deal', dl);
    p.set('limit', '200'); // lấy nhiều tin hơn để "Xem thêm" hiển thị dần cho hết
    api<{ listings: Listing[] }>(`/listings?${p.toString()}`).then((d) => setListings(d.listings || [])).catch(() => setListings([])).finally(() => setLoading(false));
  }
  function switchDeal(d: DealType) { if (d === deal) return; setDeal(d); setType(''); setMin(''); setMax(''); setMine(false); load({ deal: d, type: '', min: '', max: '', mine: false }); }
  const loadDrafts = () => { if (user) listMyPlaces().then(setDrafts).catch(() => setDrafts([])); else setDrafts([]); };
  function showMine(v: boolean) { setMine(v); load({ mine: v }); if (v) loadDrafts(); }
  async function del(id: number) {
    if (!confirm('Xoá tin này khỏi giỏ hàng?')) return;
    try { await api(`/listings/${id}`, { method: 'DELETE' }); load({ mine: true }); } catch (e: any) { alert(e.message); }
  }
  // "Đăng tin này": mang sản phẩm đã lưu sang form đăng tin (đổ sẵn tên/giá/diện tích/ảnh/vị trí).
  function publishDraft(d: SavedPlace) {
    try { sessionStorage.setItem('camlam_draft', JSON.stringify({ id: d.id, note: d.features || d.note, price: d.price, area: d.area, images: d.images, lng: d.lng, lat: d.lat, x: d.x, y: d.y })); } catch { /* ignore */ }
    router.push('/sales/post');
  }
  async function delDraft(id: number) {
    if (!confirm('Xoá sản phẩm đã lưu này?')) return;
    try { await removePlace(id); loadDrafts(); } catch (e: any) { alert(e.message); }
  }
  // Đọc lại bộ lọc từ URL MỖI KHI query đổi (vd bấm "Cho thuê" trên menu khi đang ở /listings).
  useEffect(() => {
    const sp = searchParams;
    const t = (sp.get('propertyType') as PropertyType) || '';
    const mn = sp.get('minPrice') ? String(Number(sp.get('minPrice')) / 1e9) : '';
    const mx = sp.get('maxPrice') ? String(Number(sp.get('maxPrice')) / 1e9) : '';
    const kw = sp.get('q') || sp.get('ward') || '';
    const dl = (sp.get('deal') === 'rent' ? 'rent' : 'sale') as DealType;
    const so = sp.get('sort') || 'default';
    setType(t); setMin(mn); setMax(mx); setQ(kw); setDeal(dl); setSort(so); setInited(true);
    load({ type: t, min: mn, max: mx, q: kw, deal: dl });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  // GHI bộ lọc + sắp xếp vào URL (replaceState → F5/chia sẻ link phục hồi đúng; KHÔNG đụng nút Back, không gây tải lại).
  useEffect(() => {
    if (!inited || typeof window === 'undefined') return;
    const sp = new URLSearchParams();
    if (type) sp.set('propertyType', type);
    if (min) sp.set('minPrice', String(Math.round(Number(min) * 1e9)));
    if (max) sp.set('maxPrice', String(Math.round(Number(max) * 1e9)));
    if (q) sp.set('q', q);
    if (deal === 'rent') sp.set('deal', 'rent');
    if (sort !== 'default') sp.set('sort', sort);
    const qs = sp.toString();
    window.history.replaceState(null, '', qs ? `/listings?${qs}` : '/listings');
  }, [inited, type, min, max, q, deal, sort]);
  useEffect(() => { api<any>('/map-ads/active').then((r) => setAds(r.ads || [])).catch(() => {}); }, []);
  // Tải điểm đã lưu của chính mình khi đăng nhập — để hiện thành gim trên bản đồ (cả bán & thuê).
  useEffect(() => { loadDrafts(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const markers = useMemo(() => listings.map((l) => ({
    lng: l.lng, lat: l.lat,
    tier: l.tier || 'normal',              // MapView: VIP → pill giá; tin thường → chấm (rê chuột/zoom cận hiện giá)
    label: priceLabel(l.price, l.deal),
    popupHtml: `<a href="/listings/${l.id}" style="font-weight:700;color:#0B4045">${l.title}</a><br/><b style="color:#dc2626">${priceLabel(l.price, l.deal)}</b>`,
  })), [listings]);
  // Gim tin lưu (teardrop tím kiểu Google Maps). Bấm gim → mở BẢNG THÔNG TIN React riêng (selPlace).
  const placeMarkers = useMemo(() => drafts.map((p) => ({
    lng: p.lng, lat: p.lat, color: dealColor(p.dealStatus),
    onClick: () => { pinClickRef.current = Date.now(); setInfo(null); setSelPlace(p); },
  })), [drafts]);
  // Gim XANH tại điểm vừa click — hiện liền để biết đang chấm ở đâu (dời khi click chỗ khác; điểm đã lưu vẫn giữ).
  const clickMarker = useMemo(() => {
    if (!info) return [];
    const pin = { lng: info.lng, lat: info.lat, color: '#2563eb' };
    // Chưa mở form → hiện thêm chip nhỏ "Lưu tin này" ngay dưới ghim; bấm chip mới mở bảng.
    return showSave ? [pin] : [pin, { lng: info.lng, lat: info.lat, chip: '💾 Lưu tin này', onClick: () => setShowSave(true) }];
  }, [info, showSave]);
  const allMarkers = useMemo(() => [...(mapLayer === 'saved' ? placeMarkers : markers), ...clickMarker], [mapLayer, markers, placeMarkers, clickMarker]);
  const overlays: ImageOverlay[] = useMemo(() => [{ ...QH, opacity, visible: qhOn }], [opacity, qhOn]);
  const shown = useMemo(() => {
    let a = [...listings];
    if (sort === 'price-asc') a.sort((x, y) => x.price - y.price);
    else if (sort === 'price-desc') a.sort((x, y) => y.price - x.price);
    else if (sort === 'newest') a.sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt));
    if (areaRange.min || areaRange.max) a = a.filter((l) => { const ar = l.area ?? 0; return (!areaRange.min || ar >= areaRange.min) && (!areaRange.max || ar <= areaRange.max); });
    if (verified) a = a.filter((l) => !!(l as any).verified);
    return a;
  }, [listings, sort, areaRange, verified]);
  const verifiedCount = useMemo(() => listings.filter((l) => !!(l as any).verified).length, [listings]);
  // Đổi bộ lọc / dữ liệu → xem lại từ đầu.
  useEffect(() => { setVisible(8); setPage(1); }, [listings, sort, areaRange, verified, deal, mine]);
  const totalPages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const feed = isDesktop ? shown.slice((page - 1) * PER_PAGE, page * PER_PAGE) : shown.slice(0, visible);
  // "Nhích" hàng lọc một cái khi tải/đổi tab để người dùng biết CÒN mục khi kéo ngang.
  useEffect(() => {
    const el = filterRef.current; if (!el || el.scrollWidth <= el.clientWidth + 16) return;
    const t1 = setTimeout(() => el.scrollTo({ left: 44, behavior: 'smooth' }), 650);
    const t2 = setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 1150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [deal, mapView]);
  // Ẩn pill "Danh sách/Bản đồ" khi cuộn TỚI CUỐI (chạm footer) — pill chỉ nổi TRONG khung danh sách, không đè footer.
  useEffect(() => {
    if (mapView) { setNearEnd(false); return; }
    let raf = 0;
    // Ẩn pill khi mốc cuối danh sách chạm/vượt đáy màn hình (kể cả khi đã cuộn qua vào footer) — không còn lòi ra footer.
    const check = () => { raf = 0; const el = endRef.current; if (el) setNearEnd(el.getBoundingClientRect().top <= window.innerHeight - 90); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, [mapView, feed.length]);

  const activeFilters = (type ? 1 : 0) + (min || max ? 1 : 0) + (areaRange.min || areaRange.max ? 1 : 0) + (verified ? 1 : 0);
  const { pull, refreshing } = usePullToRefresh(() => { showMine(mine); }, !mapView); // kéo xuống ở đỉnh → tải lại
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (searchOpen) { const t = setTimeout(() => searchInputRef.current?.focus(), 280); return () => clearTimeout(t); } }, [searchOpen]); // mở overlay xong mới focus (sau khi trượt lên)
  const title = `${deal === 'rent' ? 'Cho thuê' : 'Mua bán'} ${type ? (PROPERTY_LABELS[type] as string).toLowerCase() : 'nhà đất'} tại Cam Lâm, Khánh Hòa`;

  async function onMapClick(lng: number, lat: number) {
    if (Date.now() - pinClickRef.current < 350) return; // vừa bấm gim tin lưu → không mở bảng quy hoạch
    setSelPlace(null); setShowSave(false); // click mới → thu gọn, chỉ hiện điểm + nút "Lưu tin này"
    const vn = wgs84ToVn2000(lng, lat);
    let parcel: any = null, zoning: any = null;
    try { const r = await api<ParcelInfo>(`/parcels/at?lng=${lng}&lat=${lat}`); parcel = r.parcel; zoning = r.zoning; } catch { /* ignore */ }
    setInfo({ x: vn.x, y: vn.y, lng, lat, parcel, zoning });
    // Chấm điểm là BAY TỚI + phóng cận như cũ (chủ dự án 15/9/2026: "sửa zoom lại như cũ"). Lỗi "mất danh sách và
    // bản đồ" hôm trước là do nút Danh sách / Bản đồ bị ẩn khi có điểm — đã sửa ở chỗ nút, không liên quan việc phóng.
    setFlyPoint({ lng, lat });
    setSheetExpanded(true); // mỗi lần chọn điểm mới: mở sẵn để điền
  }
  // Lưu điểm đang xem (từ popup) thành gim cá nhân — hiện ngay trên bản đồ bán & thuê.
  async function saveHere() {
    if (!info || !user) return;
    const miss: string[] = [];
    if (!pParcel.trim()) miss.push('Thửa'); if (!pSheet.trim()) miss.push('Tờ'); if (!pWard.trim()) miss.push('Xã');
    if (!pFeat.trim()) miss.push('Đặc điểm'); if (!pPrice.trim()) miss.push('Giá'); if (!pArea.trim()) miss.push('Diện tích');
    if (!pOwner.trim()) miss.push('Tên chủ'); if (!pPhone.trim()) miss.push('SĐT chủ');
    if (miss.length) { alert('Vui lòng nhập đầy đủ: ' + miss.join(', ') + '.\n(Chỉ "Hoa hồng" không bắt buộc)'); return; }
    setSaving(true);
    try {
      await addPlace({ lng: info.lng, lat: info.lat, x: info.x, y: info.y,
        parcel: pParcel.trim() || undefined, sheet: pSheet.trim() || undefined, ward: pWard.trim() || undefined,
        features: pFeat.trim() || undefined, owner: pOwner.trim() || undefined, phone: pPhone.trim() || undefined,
        commission: pComm.trim() || undefined, price: pPrice.trim() || undefined, area: pArea.trim() || undefined, images: pImages });
      setPParcel(''); setPSheet(''); setPWard(''); setPFeat(''); setPOwner(''); setPPhone(''); setPComm(''); setPPrice(''); setPArea('');
      setPImages([]); setMapLayer('saved'); setInfo(null); loadDrafts();
    } catch (e: any) { alert('Lỗi lưu: ' + (e?.message || e)); } finally { setSaving(false); }
  }
  async function onPlaceFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); e.target.value = '';
    if (!files.length) return;
    const room = Math.max(0, 5 - pImages.length);
    if (room <= 0) { alert('Tối đa 5 ảnh.'); return; }
    setPUp(true);
    try { const up = await uploadImages(files.slice(0, room)); setPImages((p) => [...p, ...up.map((u) => u.url)].slice(0, 5)); }
    catch (err: any) { alert('Lỗi tải ảnh: ' + (err?.message || err)); } finally { setPUp(false); }
  }
  // Khách quan tâm 1 tin (1 tin → nhiều khách): tải khi mở bảng thông tin.
  useEffect(() => {
    setShowAddInt(false);
    if (!selPlace) { setInterests([]); return; }
    listInterests(selPlace.id).then(setInterests).catch(() => setInterests([]));
  }, [selPlace]);
  const openAddInt = () => { setShowAddInt(true); if (!custList.length) listCustomers().then(setCustList).catch(() => {}); };
  async function saveInterest() {
    if (!selPlace) return;
    try {
      const payload: any = { placeId: selPlace.id, interest: iInterest || undefined, dealStatus: iDeal || undefined };
      if (iCustId) payload.customerId = Number(iCustId);
      else { if (!iName.trim() && !iPhone.trim()) { alert('Chọn khách có sẵn hoặc nhập tên/SĐT khách mới.'); return; } payload.name = iName.trim() || undefined; payload.phone = iPhone.trim() || undefined; }
      const it = await addInterest(payload);
      setInterests((a) => [it, ...a]);
      setShowAddInt(false); setICustId(''); setIName(''); setIPhone(''); setIInterest(''); setIDeal('');
    } catch (e: any) { alert('Lỗi: ' + (e?.message || e)); }
  }
  async function delInterest(id: number) {
    try { await removeInterest(id); setInterests((a) => a.filter((x) => x.id !== id)); } catch (e: any) { alert(e.message); }
  }

  const chip = 'appearance-none bg-white border border-slate-300 rounded-full pl-3 sm:pl-3.5 pr-7 sm:pr-8 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:border-[#0B4045] cursor-pointer bg-[length:14px] bg-no-repeat';
  const chevron = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: 'right 10px center' };
  const inpc = 'border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#7c3aed]'; // ô nhập tin lưu

  const mapPanel = (
    <div className="relative h-full w-full">
      <MapView markers={allMarkers} overlays={overlays} baseMap={baseMap} labels={labels} onMapClick={onMapClick} flyToPoint={flyPoint} initialBounds={QH_BOUNDS} adMarkers={ads} adOpacity={qhOn ? opacity : 1} className="absolute inset-0 h-full w-full" />
      {/* TAB quản lý marker — bỏ nút "Tin đăng" (mặc định đã là tin đăng); chỉ hiện cho người đăng nhập */}
      {user && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 rounded-full border border-slate-200 shadow-lg bg-white/95 backdrop-blur p-1 text-[11px] sm:text-xs font-bold whitespace-nowrap">
          <button onClick={() => { if (mapLayer === 'mine') { setMapLayer('all'); if (mine) showMine(false); } else { setMapLayer('mine'); showMine(true); } }} className={`px-3 py-1.5 rounded-full transition ${mapLayer === 'mine' ? 'bg-[#0B4045] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>Giỏ của tôi</button>
          <button onClick={() => { if (mapLayer === 'saved') { setMapLayer('all'); if (mine) showMine(false); } else { setMapLayer('saved'); loadDrafts(); } }} className={`px-3 py-1.5 rounded-full transition ${mapLayer === 'saved' ? 'bg-[#7c3aed] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>📌 Tin lưu{drafts.length ? ` (${drafts.length})` : ''}</button>
        </div>
      )}
      <div className="absolute top-3 md:top-16 left-3 z-20">
        {layerOpen ? (
          <div className="w-[250px] bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-extrabold text-[#0B4045]">Lớp bản đồ</span>
              <button onClick={() => setLayerOpen(false)} className="text-slate-400 hover:text-slate-700 w-6 h-6 grid place-items-center rounded-lg hover:bg-slate-100 text-sm leading-none">✕</button>
            </div>
            <label className="flex items-center gap-2.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={qhOn} onChange={(e) => setQhOn(e.target.checked)} className="accent-red-600 w-4 h-4" /> Lớp quy hoạch
            </label>
            <label className="flex items-center gap-2.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer border-t border-slate-100">
              <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} className="accent-red-600 w-4 h-4" /> Nhãn & đường
            </label>
            <div className="hidden md:block border-t border-slate-100 pt-2 mt-1">{/* điện thoại đổi nền bằng nút tròn bên phải, giống trang Bản đồ */}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nền bản đồ</span>
              <div className="flex gap-1.5 mt-1.5">
                {BASE_THUMBS.map(([b, label, lyr]) => (
                  <button key={b} onClick={() => setBaseMap(b)} className="text-center flex-1">
                    <span className={`block h-11 rounded-lg overflow-hidden border-2 ${baseMap === b ? 'border-red-600' : 'border-slate-200'}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`https://mt1.google.com/vt/lyrs=${lyr}&x=3289&y=1909&z=12`} alt={label} loading="lazy" className="w-full h-full object-cover" /></span>
                    <span className={`block text-[10px] mt-0.5 font-semibold ${baseMap === b ? 'text-red-600' : 'text-slate-600'}`}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setLayerOpen(true)} title="Lớp bản đồ" className="flex items-center gap-2 bg-white/95 backdrop-blur rounded-full border border-slate-200 shadow-lg pl-2.5 pr-3 py-2 hover:bg-slate-50">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0B4045" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
            <span className="text-xs font-bold text-slate-700 hidden sm:inline">Lớp bản đồ</span>
            {qhOn && <span className="w-1.5 h-1.5 rounded-full bg-red-600" />}
          </button>
        )}
      </div>
      {/* NÚT LỌC NỔI TRÊN BẢN ĐỒ — chỉ mobile; đặt bên TRÁI, dưới nút Lớp (tránh chen zoom/định vị/độ mờ bên phải) */}
      <div className={`md:hidden absolute top-16 left-3 z-20 ${layerOpen ? 'hidden' : ''}`}>
        {showFilters ? (
          <div className="w-[240px] max-w-[calc(100vw-1.5rem)] bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-[#0B4045]">⚙ Lọc tin{activeFilters > 0 ? ` (${activeFilters})` : ''}</span>
              <button onClick={() => setShowFilters(false)} className="text-slate-400 hover:text-slate-700 w-6 h-6 grid place-items-center rounded-lg hover:bg-slate-100 text-sm leading-none">✕</button>
            </div>
            <div className="flex flex-col gap-2">
              <select value={type} onChange={(e) => { setType(e.target.value as PropertyType); load({ type: e.target.value }); }} className={`${chip} w-full`} style={chevron}>{TYPES.map((t) => <option key={t} value={t}>{t ? PROPERTY_LABELS[t as PropertyType] : 'Loại hình'}</option>)}</select>
              <select value={`${min}|${max}`} onChange={(e) => { const [mn, mx] = e.target.value.split('|'); setMin(mn); setMax(mx); load({ min: mn, max: mx }); }} className={`${chip} w-full`} style={chevron}>{PRICE_RANGES.map(([label, mn, mx]) => <option key={label} value={`${mn}|${mx}`}>{label}</option>)}</select>
              <select value={`${areaRange.min}|${areaRange.max}`} onChange={(e) => { const [mn, mx] = e.target.value.split('|').map(Number); setAreaRange({ min: mn, max: mx }); }} className={`${chip} w-full`} style={chevron}>{AREA_RANGES.map(([label, mn, mx]) => <option key={label} value={`${mn}|${mx}`}>{label}</option>)}</select>
              <button onClick={() => setVerified((v) => !v)} className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold border ${verified ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-600'}`}>✓ Tin xác thực</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowFilters(true)} title="Lọc tin" className="flex items-center gap-2 bg-white/95 backdrop-blur rounded-full border border-slate-200 shadow-lg pl-2.5 pr-3 py-2 hover:bg-slate-50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B4045" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            <span className="text-xs font-bold text-slate-700">Lọc</span>
            {activeFilters > 0 && <span className="bg-red-600 text-white rounded-full min-w-[18px] h-[18px] px-1 grid place-items-center text-[10px] font-extrabold">{activeFilters}</span>}
          </button>
        )}
      </div>
      {/* ĐIỆN THOẠI: cột nút bên phải GIỐNG HỆT trang Bản đồ (chủ dự án 15/9/2026 "đồng bộ với bên map") —
          nút tròn ảnh thu nhỏ của nền sẽ chuyển sang (bấm là đổi Vệ tinh ↔ Đường) + thanh độ mờ đỏ mảnh 123px.
          Toạ độ right 10 / top 121 = ngay dưới cụm +/− và nút định vị của MapView, xem ghi chú trong app/map/page.tsx. */}
      <div className="md:hidden absolute right-[10px] top-[121px] z-10 flex w-[31px] flex-col items-center gap-2.5">
        <button onClick={() => setBaseMap(baseMap === 'satellite' ? 'street' : 'satellite')}
          aria-label={baseMap === 'satellite' ? 'Chuyển sang bản đồ đường' : 'Chuyển sang ảnh vệ tinh'}
          className="cl-press h-[31px] w-[31px] overflow-hidden rounded-full border-2 border-white bg-slate-200 bg-cover bg-center shadow-[0_1px_5px_rgba(0,0,0,.35)]"
          style={{ backgroundImage: `url(https://mt0.google.com/vt/lyrs=${baseMap === 'satellite' ? 'm' : 's'}&x=3289&y=1910&z=12)` }} />
        {qhOn && (
          <div className="relative h-[123px] w-7">
            <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} aria-label="Độ đậm lớp quy hoạch"
              style={{ background: `linear-gradient(to right, #dc2626 ${Math.round(opacity * 100)}%, rgba(255,255,255,.85) ${Math.round(opacity * 100)}%)` }}
              className="absolute left-1/2 top-1/2 h-1 w-[123px] -translate-x-1/2 -translate-y-1/2 -rotate-90 cursor-pointer appearance-none rounded-full shadow-[0_0_2px_rgba(0,0,0,.5)]
                [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent
                [&::-webkit-slider-thumb]:-mt-[8px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#dc2626] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
                [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#dc2626] [&::-moz-range-thumb]:bg-white" />
          </div>
        )}
      </div>
      {qhOn && (
        <div className="hidden md:flex absolute top-1/2 right-3 -translate-y-1/2 z-10 flex-col items-center gap-1.5 bg-white/95 backdrop-blur rounded-full border border-slate-200 shadow-lg px-1.5 py-3">
          <span className="text-[9px] font-bold text-slate-400">Đậm</span>
          <div className="relative h-28 w-5">
            <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="absolute left-1/2 top-1/2 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-90 accent-red-600 cursor-pointer" aria-label="Độ đậm lớp quy hoạch" />
          </div>
          <span className="text-[9px] font-bold text-slate-400">Mờ</span>
          <span className="text-[10px] font-extrabold text-[#0B4045]">{Math.round(opacity * 100)}%</span>
        </div>
      )}
      {info && showSave && (
        <div className={`absolute left-2 right-2 bottom-[60px] ${sheetExpanded ? 'max-h-[86%]' : 'max-h-[64%]'} sm:top-auto sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-3 sm:w-[340px] sm:max-w-[92%] sm:max-h-[74vh] overflow-y-auto z-10 bg-white rounded-2xl border border-slate-200 shadow-xl text-xs`}>
          <div className="sticky top-0 z-10 bg-white rounded-t-2xl border-b border-slate-100 px-3.5 pt-2 pb-2">
            <button onClick={() => setSheetExpanded((v) => !v)} className="sm:hidden w-full flex flex-col items-center pb-1" aria-label={sheetExpanded ? 'Thu gọn' : 'Kéo lên'}>
              <span className="w-10 h-1.5 rounded-full bg-slate-300" />
              <span className="text-[10px] font-bold text-slate-400 mt-0.5">{sheetExpanded ? '▼ Thu gọn' : '▲ Kéo lên điền đầy đủ'}</span>
            </button>
            <div className="flex items-center justify-between">
              <b className="text-[#0B4045] text-sm">📍 Điểm đã chọn</b>
              <button onClick={() => setInfo(null)} className="text-slate-400 hover:text-slate-700 text-base leading-none">✕</button>
            </div>
          </div>
          <div className="p-3.5 pt-2.5">
          <div className="grid grid-cols-2 gap-1.5 text-slate-600">
            <div className="bg-slate-50 rounded-lg px-2 py-1.5"><div className="text-[10px] text-slate-400">X (Đông)</div><b>{info.x.toFixed(2)}</b></div>
            <div className="bg-slate-50 rounded-lg px-2 py-1.5"><div className="text-[10px] text-slate-400">Y (Bắc)</div><b>{info.y.toFixed(2)}</b></div>
          </div>
          {info.parcel ? (
            <div className="mt-2 border-t border-slate-100 pt-2">
              {Object.entries(info.parcel.properties || {}).slice(0, 6).map(([k, v]) => (<div key={k} className="flex justify-between gap-2"><span className="text-slate-400">{k}</span><b className="text-slate-700 text-right">{String(v)}</b></div>))}
            </div>
          ) : (<div className="mt-2 border-t border-slate-100 pt-2 text-slate-400">Chưa có dữ liệu thửa địa chính tại điểm này.</div>)}
          {user ? (
            <div className="mt-2.5 border-t border-slate-100 pt-2.5">
              {!showSave ? (
                <button onClick={() => setShowSave(true)} className="w-full flex items-center justify-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold py-2 rounded-lg text-xs">📌 Lưu tin này</button>
              ) : (<>
              <p className="text-[11px] font-bold text-[#7c3aed]">📌 Lưu điểm riêng để quản lý</p>
              <p className="text-[10px] text-slate-400 mb-1.5">Chỉ mình bạn thấy — người khác không xem được.</p>
              <div className="flex gap-1.5 mb-1.5">
                <input value={pParcel} onChange={(e) => setPParcel(e.target.value)} placeholder="Thửa *" className={`w-1/3 ${inpc}`} />
                <input value={pSheet} onChange={(e) => setPSheet(e.target.value)} placeholder="Tờ *" className={`w-1/3 ${inpc}`} />
                <input value={pWard} onChange={(e) => setPWard(e.target.value)} placeholder="Xã *" className={`w-1/3 ${inpc}`} />
              </div>
              <input value={pFeat} onChange={(e) => setPFeat(e.target.value)} placeholder="Đặc điểm & lưu ý * (hướng, MT, sổ đỏ, đường, dính QH…)" className={`w-full ${inpc} mb-1.5`} />
              <div className="flex gap-1.5 mb-1.5">
                <input value={pPrice} onChange={(e) => setPPrice(e.target.value)} placeholder="Giá *" className={`w-1/2 ${inpc}`} />
                <input value={pArea} onChange={(e) => setPArea(e.target.value)} placeholder="Diện tích m² *" inputMode="decimal" className={`w-1/2 ${inpc}`} />
              </div>
              <div className="flex gap-1.5 mb-1.5">
                <input value={pOwner} onChange={(e) => setPOwner(e.target.value)} placeholder="Tên chủ *" className={`w-1/2 ${inpc}`} />
                <input value={pPhone} onChange={(e) => setPPhone(e.target.value)} placeholder="SĐT chủ *" inputMode="tel" className={`w-1/2 ${inpc}`} />
              </div>
              <input value={pComm} onChange={(e) => setPComm(e.target.value)} placeholder="Hoa hồng (VD: 1%)" className={`w-full ${inpc} mb-1.5`} />
              <p className="text-[10px] text-slate-400 mb-1.5">Khách quan tâm thêm sau bằng nút ＋ khi bấm vào tin đã lưu.</p>
              <div className="flex items-center gap-1 flex-wrap mb-1.5">
                {pImages.map((u) => (
                  <div key={u} className="relative w-9 h-9 rounded overflow-hidden border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setPImages((arr) => arr.filter((x) => x !== u))} className="absolute top-0 right-0 bg-black/60 text-white text-[9px] w-3.5 h-3.5 grid place-items-center">✕</button>
                  </div>
                ))}
                {pImages.length < 5 && (
                  <label className="w-9 h-9 rounded border border-dashed border-slate-300 grid place-items-center text-slate-400 cursor-pointer hover:border-[#7c3aed]">
                    {pUp ? '…' : '📷＋'}
                    <input type="file" accept="image/*" multiple onChange={onPlaceFiles} className="hidden" />
                  </label>
                )}
                <span className="text-[10px] text-slate-400">Ảnh {pImages.length}/5</span>
              </div>
              <button onClick={saveHere} disabled={saving || pUp} className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-60 text-white font-bold py-1.5 rounded-lg text-xs">{saving ? 'Đang lưu…' : '📌 Lưu điểm'}</button>
              </>)}
            </div>
          ) : (
            <button onClick={() => openLogin({ reason: 'Đăng nhập để lưu điểm/tin trên bản đồ.' })} className="mt-2.5 w-full block text-center bg-[#0B4045] hover:bg-[#0e5157] text-white font-bold py-2 rounded-lg text-xs">🔒 Đăng nhập để lưu tin</button>
          )}
          <Link href="/map" className="mt-2.5 inline-block text-[#0B4045] font-semibold hover:text-red-600">Mở công cụ bản đồ đầy đủ →</Link>
          </div>
        </div>
      )}
      {selPlace && (
        <div className="absolute bottom-[60px] sm:bottom-3 left-1/2 -translate-x-1/2 w-[344px] max-w-[93%] z-20 bg-white rounded-2xl border-2 border-[#7c3aed]/40 shadow-xl p-3.5 text-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <b className="text-sm" style={{ color: dealColor(selPlace.dealStatus) }}>📌 Tin lưu</b>
              {selPlace.dealStatus ? <span className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: dealColor(selPlace.dealStatus) }}>{selPlace.dealStatus}</span> : null}
            </div>
            <button onClick={() => setSelPlace(null)} className="text-slate-400 hover:text-slate-700 text-base leading-none">✕</button>
          </div>
          {selPlace.images && selPlace.images.length > 0 && (
            <div className="flex gap-1 mb-2 overflow-x-auto">
              {selPlace.images.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={thumbUrl(u)} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-slate-200" />
              ))}
            </div>
          )}
          <p className="font-bold text-[#0B4045] text-sm">{selPlace.features || (selPlace.parcel ? `Thửa ${selPlace.parcel}${selPlace.sheet ? ', Tờ ' + selPlace.sheet : ''}` : (selPlace.note || 'Tin lưu'))}</p>
          <div className="mt-1.5 space-y-1 text-slate-600">
            {(selPlace.parcel || selPlace.sheet || selPlace.ward) ? <div>🗺 {[selPlace.parcel && `Thửa ${selPlace.parcel}`, selPlace.sheet && `Tờ ${selPlace.sheet}`, selPlace.ward].filter(Boolean).join(' · ')}</div> : null}
            {(selPlace.price || selPlace.area) ? <div>{selPlace.price ? <>💰 <b className="text-red-600">{selPlace.price}</b></> : null}{selPlace.area ? <span className="text-slate-500"> · {selPlace.area} m²</span> : null}</div> : null}
            {(selPlace.owner || selPlace.phone) ? <div>👤 Chủ: <b>{selPlace.owner || '—'}</b>{selPlace.phone ? <> · <a href={`tel:${selPlace.phone}`} className="text-[#7c3aed] font-bold">{selPlace.phone}</a></> : null}</div> : null}
            {selPlace.commission ? <div>🤝 Hoa hồng: <b>{selPlace.commission}</b></div> : null}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-extrabold text-emerald-600">KHÁCH QUAN TÂM ({interests.length})</span>
              <button onClick={openAddInt} className="text-[#7c3aed] font-bold">＋ Thêm khách</button>
            </div>
            {interests.map((it) => (
              <div key={it.id} className="flex items-center gap-1 py-0.5">
                <span className="flex-1 truncate">🧑 <b>{it.custName || 'Khách'}</b>{it.custPhone ? <> · <a href={`tel:${it.custPhone}`} className="text-emerald-600 font-semibold">{it.custPhone}</a></> : null}</span>
                {it.interest ? <span className={`text-[9px] font-bold px-1 rounded ${it.interest === 'Cao' ? 'bg-red-100 text-red-600' : it.interest === 'Vừa' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{it.interest}</span> : null}
                {it.dealStatus ? <span className="text-[9px] font-bold px-1 rounded text-white" style={{ backgroundColor: dealColor(it.dealStatus) }}>{it.dealStatus}</span> : null}
                <button onClick={() => delInterest(it.id)} className="text-red-400 hover:text-red-600">✕</button>
              </div>
            ))}
            {interests.length === 0 && !showAddInt ? <p className="text-slate-400 text-[11px]">Chưa có khách quan tâm — bấm ＋ Thêm khách.</p> : null}
            {showAddInt && (
              <div className="mt-1 bg-slate-50 rounded-lg p-2 space-y-1">
                <select value={iCustId} onChange={(e) => setICustId(e.target.value)} className={`w-full ${inpc} bg-white`}>
                  <option value="">— Khách mới —</option>
                  {custList.map((c) => <option key={c.id} value={c.id}>{c.name || 'Khách'}{c.phone ? ' · ' + c.phone : ''}</option>)}
                </select>
                {!iCustId && (
                  <div className="flex gap-1">
                    <input value={iName} onChange={(e) => setIName(e.target.value)} placeholder="Tên khách" className={`w-1/2 ${inpc}`} />
                    <input value={iPhone} onChange={(e) => setIPhone(e.target.value)} placeholder="SĐT khách" inputMode="tel" className={`w-1/2 ${inpc}`} />
                  </div>
                )}
                <div className="flex gap-1">
                  <select value={iInterest} onChange={(e) => setIInterest(e.target.value)} className={`w-1/2 ${inpc} bg-white`}><option value="">Mức QT…</option><option>Cao</option><option>Vừa</option><option>Thấp</option></select>
                  <select value={iDeal} onChange={(e) => setIDeal(e.target.value)} className={`w-1/2 ${inpc} bg-white`}><option value="">Trạng thái…</option><option>Mới</option><option>Đang tư vấn</option><option>Thương lượng</option><option>Đã chốt</option><option>Không thành</option></select>
                </div>
                <div className="flex gap-1">
                  <button onClick={saveInterest} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 rounded">Lưu khách</button>
                  <button onClick={() => setShowAddInt(false)} className="px-3 bg-white border border-slate-200 rounded">Huỷ</button>
                </div>
              </div>
            )}
          </div>
          <div className="mt-1.5 text-slate-400">📍 {selPlace.lat.toFixed(5)}, {selPlace.lng.toFixed(5)}</div>
          <div className="flex gap-1.5 mt-2.5">
            <button onClick={() => publishDraft(selPlace)} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold py-1.5 rounded-lg">＋ Đăng tin này</button>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${selPlace.lat},${selPlace.lng}`} target="_blank" rel="noreferrer" className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded-lg">🧭 Chỉ đường</a>
            <button onClick={async () => { const id = selPlace.id; setSelPlace(null); await delDraft(id); }} className="bg-white border border-red-200 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50">🗑</button>
          </div>
        </div>
      )}
    </div>
  );

  const listHeader = (
    <>
      {/* HÀNG 1: bán/thuê (trái) + sắp xếp (phải) — gộp chung 1 dòng cho gọn */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="inline-flex rounded-full bg-slate-100 p-1 shrink-0">
          <button onClick={() => switchDeal('sale')} className={`px-3 sm:px-4 py-1.5 rounded-full text-sm font-bold transition ${deal === 'sale' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:text-[#0B4045]'}`}><span className="sm:hidden">Bán</span><span className="hidden sm:inline">Nhà đất bán</span></button>
          <button onClick={() => switchDeal('rent')} className={`px-3 sm:px-4 py-1.5 rounded-full text-sm font-bold transition ${deal === 'rent' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-[#0B4045]'}`}>Cho thuê</button>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-500 shrink-0 min-w-0">
          <span className="hidden sm:inline">Sắp xếp</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white font-semibold text-[#0B4045] outline-none cursor-pointer max-w-full">
            <option value="default">Mặc định</option><option value="newest">Mới nhất</option><option value="price-asc">Giá thấp→cao</option><option value="price-desc">Giá cao→thấp</option>
          </select>
        </label>
      </div>
      {/* Breadcrumb: ẩn trên điện thoại cho đỡ rối, hiện lại từ màn lớn */}
      <div className="hidden sm:block text-xs text-slate-400 mb-1"><Link href="/" className="hover:text-[#0B4045]">{deal === 'rent' ? 'Cho thuê' : 'Bán'}</Link> › <span className="hover:text-[#0B4045]">Khánh Hòa</span> › <span className="text-slate-600">Cam Lâm</span></div>
      {user ? (
        <div className="flex rounded-xl border border-slate-200 overflow-hidden w-fit mb-1">
          <button onClick={() => showMine(false)} className={`px-3.5 py-1.5 text-sm font-bold ${!mine ? 'bg-[#0B4045] text-white' : 'text-slate-600'}`}>Tất cả</button>
          <button onClick={() => showMine(true)} className={`px-3.5 py-1.5 text-sm font-bold ${mine ? 'bg-[#0B4045] text-white' : 'text-slate-600'}`}>🧺 Giỏ của tôi</button>
        </div>
      ) : null}
      <h1 className="text-xl md:text-2xl font-extrabold text-[#0B4045]">{mine ? 'Giỏ hàng của bạn' : title}</h1>
      <p className="text-sm text-slate-500 mt-0.5">{loading ? 'Đang tìm…' : <>Hiện có <b className="text-[#0B4045]">{shown.length}</b> bất động sản.</>}</p>
      {/* ĐÃ BỎ hàng chip "Giá đất & định giá · Cẩm nang pháp lý · CRM khách hàng":
          ba mục này đã có trong trang Tiện ích rồi, để đây là trùng. Đừng thêm lại. */}
    </>
  );

  // Skeleton KHỚP hình dạng thẻ thật → giảm layout-shift (CLS): mobile ảnh bìa 16:9 trên, desktop ảnh trái.
  const skeleton = (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="md:hidden">
            <Skeleton className="aspect-[16/9] w-full" rounded="rounded-none" />
            <div className="space-y-2.5 p-2.5"><Skeleton h={16} w="80%" /><Skeleton h={20} w="55%" /><Skeleton h={12} w="62%" /></div>
          </div>
          <div className="hidden gap-3 md:flex">
            <Skeleton className="h-32 w-48 shrink-0" rounded="rounded-none" />
            <div className="flex-1 space-y-2.5 py-3 pr-3"><Skeleton h={16} w="75%" /><Skeleton h={20} w="50%" /><Skeleton h={12} w="66%" /></div>
          </div>
        </div>
      ))}
    </div>
  );
  const listItems = loading ? skeleton : mapLayer === 'saved' ? (
    drafts.length === 0 ? (
      <Card pad="none" className="border-dashed">
        <EmptyState
          icon={<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="2.5" /></svg>}
          title="Chưa có tin lưu nào"
          description="Bấm một điểm trên bản đồ để lưu tin vào đây."
        />
      </Card>
    ) : (
      <div>
        <div className="flex items-baseline gap-2 mb-1"><span className="text-sm font-extrabold text-[#7c3aed]">📌 Tin lưu ({drafts.length})</span><span className="text-[11px] text-slate-400">tất cả tin bạn đã lưu trên bản đồ</span></div>
        <p className="text-[11px] text-slate-400 mb-2">Đây là bảng riêng (khác Giỏ của tôi). Bấm <b className="text-[#7c3aed]">Đăng tin này</b> để đưa lên “Giỏ của tôi” (đăng công khai).</p>
        <div className="flex flex-col gap-2.5">
          {drafts.map((d) => (
            <div key={'d' + d.id} className="flex gap-3 bg-white rounded-xl border border-dashed border-[#7c3aed]/50 overflow-hidden">
              <div className="w-28 sm:w-32 shrink-0 self-stretch min-h-[7rem] bg-slate-100 relative">
                {d.images && d.images[0]
                  ? <img src={thumbUrl(d.images[0])} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  : <div className="absolute inset-0 grid place-items-center text-3xl text-slate-300">📌</div>}
                <span className="absolute top-1.5 left-1.5 z-10 bg-[#7c3aed] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">TIN LƯU</span>
              </div>
              <div className="flex-1 min-w-0 py-2 pr-2 flex flex-col">
                <p className="font-bold text-[#0B4045] text-sm line-clamp-1">{d.features || (d.parcel ? `Thửa ${d.parcel}${d.sheet ? ', Tờ ' + d.sheet : ''}` : (d.note || 'Tin lưu'))}{d.dealStatus ? <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white align-middle" style={{ backgroundColor: dealColor(d.dealStatus) }}>{d.dealStatus}</span> : null}</p>
                <p className="text-sm mt-0.5">{d.price ? <span className="text-red-600 font-extrabold">{d.price}</span> : <span className="text-slate-400">Chưa có giá</span>}{d.area ? <span className="text-slate-500 font-medium"> · {d.area} m²</span> : null}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">📍 {d.lat.toFixed(5)}, {d.lng.toFixed(5)}</p>
                <div className="flex gap-1.5 mt-auto pt-1.5">
                  <button onClick={() => publishDraft(d)} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold py-1.5 rounded-lg">＋ Đăng tin này</button>
                  <button onClick={() => delDraft(d.id)} className="bg-white border border-red-200 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  ) : mine ? (
    shown.length === 0 ? (
      <Card pad="none" className="border-dashed">
        <EmptyState
          icon={<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></svg>}
          title="Bạn chưa đăng tin nào"
          description="Đăng tin đầu tiên để bắt đầu bán hoặc cho thuê."
          action={<Button variant="navy" size="sm" onClick={() => router.push('/sales/post')}>Đăng tin đầu tiên</Button>}
        />
      </Card>
    ) : (
      <div>
        {(
          <div>
            <div className="flex items-baseline gap-2 mb-2"><span className="text-sm font-extrabold text-emerald-700">✅ Giỏ của tôi — đã đăng ({shown.length})</span><span className="text-[11px] text-slate-400">đang hiển thị cho khách</span></div>
            <div className="flex flex-col gap-3">
              {shown.map((l) => {
                const vip = !!l.tier && l.tier !== 'normal';
                return (
                  <div key={l.id} className={`flex flex-col gap-1.5 ${vip ? 'rounded-2xl p-1.5 ring-2 ring-[#C8A14B]/60 bg-gradient-to-br from-[#C8A14B]/10 to-transparent' : ''}`}>
                    <div className="relative">
                      <ListingRow l={l} />
                      <span className="absolute top-2 left-2 z-[5] bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">✓ Đã đăng</span>
                      {vip && <span className="absolute top-2 right-2 z-[5] bg-[#C8A14B] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">★ VIP</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <Link href={`/sales/edit/${l.id}`} className="flex-1 text-center bg-white border border-slate-200 text-[#0B4045] text-xs font-bold py-1.5 rounded-lg hover:border-[#C8A14B]">✏️ Sửa</Link>
                      <Link href={`/sales/leads/${l.id}`} className="flex-1 text-center bg-white border border-slate-200 text-[#0B4045] text-xs font-bold py-1.5 rounded-lg hover:border-[#C8A14B]">👁 Khách</Link>
                      <button onClick={() => del(l.id)} className="flex-1 bg-white border border-red-200 text-red-600 text-xs font-bold py-1.5 rounded-lg hover:bg-red-50">🗑 Xoá</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    )
  ) : shown.length === 0 ? (
    <Card pad="none" className="border-dashed">
      <EmptyState
        icon={<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>}
        title="Không có kết quả phù hợp"
        description="Thử nới rộng bộ lọc hoặc đổi khu vực tìm kiếm."
        action={<Button variant="navy" size="sm" onClick={() => { setType(''); setMin(''); setMax(''); setAreaRange({ min: 0, max: 0 }); setVerified(false); setQ(''); load({ type: '', min: '', max: '', q: '' }); }}>Xoá bộ lọc</Button>}
      />
    </Card>
  ) : (
    <>
      <div className="flex flex-col gap-3">
        {feed.map((l, i) => (
          <Fragment key={l.id}>
            <ListingRow l={l} />
            {!verified && i === 3 && verifiedCount > 0 && <VerifiedPromo count={verifiedCount} onView={() => setVerified(true)} />}
          </Fragment>
        ))}
      </div>
      {isDesktop ? (
        totalPages > 1 ? <Pagination page={page} total={totalPages} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /> : null
      ) : shown.length > visible ? (
        <div className="mt-4 text-center"><button onClick={() => setVisible((v) => v + 8)} className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-7 py-2.5 rounded-full shadow-sm shadow-red-600/30 transition">Xem thêm tin đăng</button></div>
      ) : shown.length > 8 ? (
        <p className="mt-3 text-center text-sm text-slate-400">Đã hiện tất cả {shown.length} tin.</p>
      ) : null}
    </>
  );

  const sidebar = (
    // Cột lọc chạy theo trang, dừng lại trước chân trang. Xem lời giải thích đầy đủ
    // ở trang chi tiết tin (ListingDetailClient.tsx).
    <aside className="shrink-0 space-y-4 lg:w-80">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-bold text-[#0B4045]">Mặt bằng giá khu vực</p><p className="text-xs text-slate-400">Cam Lâm · 12 tháng qua</p></div>
          <svg viewBox="0 0 90 36" className="w-24 h-9 text-emerald-500"><path d="M0 28 L15 24 L30 26 L45 16 L60 18 L75 8 L90 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <button onClick={() => goMapView(true)} className="mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700">📈 Xem vị trí trên bản đồ →</button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="font-bold text-[#0B4045] mb-1.5">Lọc theo khoảng giá</p>
        <div className="flex flex-col">
          {PRICE_RANGES.map(([label, mn, mx]) => (
            <button key={label} onClick={() => { setMin(mn); setMax(mx); load({ min: mn, max: mx }); }} className={`text-left py-1.5 text-sm border-b border-slate-50 last:border-0 ${min === mn && max === mx ? 'text-red-600 font-bold' : 'text-slate-600 hover:text-[#0B4045]'}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="font-bold text-[#0B4045] mb-1.5">Lọc theo diện tích</p>
        <div className="flex flex-col">
          {AREA_RANGES.map(([label, mn, mx]) => (
            <button key={label} onClick={() => setAreaRange({ min: mn, max: mx })} className={`text-left py-1.5 text-sm border-b border-slate-50 last:border-0 ${areaRange.min === mn && areaRange.max === mx ? 'text-red-600 font-bold' : 'text-slate-600 hover:text-[#0B4045]'}`}>{label}</button>
          ))}
        </div>
      </div>
    </aside>
  );

  return (
    <div className={`bg-slate-50 ${mapView ? 'flex flex-col h-[calc(100dvh-56px-env(safe-area-inset-top))] overflow-hidden mb-[calc(-48px-env(safe-area-inset-bottom))] md:mb-0 md:block md:h-auto md:min-h-[calc(100dvh-56px)] md:overflow-visible' : 'min-h-[calc(100dvh-56px)]'}`}>
      {/* THANH TÌM KIẾM + CHIP LỌC */}
      <div className={`bg-white border-b border-slate-200 z-20 ${mapView ? 'shrink-0 md:sticky md:top-14' : 'cl-listbar'}`}>
        {/* Thanh này cao 109px, cộng thanh đầu trang 57px là 166px chắn trước nội dung.
            Các trang rao bán lớn để khoảng 100-110px cho cả hai. Bớt khoảng đệm. */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 space-y-1.5">
          <div className="flex items-center gap-2">
            {/* Khi cuộn xuống (Nav ẩn) → hiện LOGO NHỎ bên trái để vẫn nhận diện & về trang chủ */}
            {/* ⚠️ LOGO NHỎ NÀY PHẢI GIỐNG HỆT LOGO Ở THANH MENU CHÍNH.
                Bản trước nhét logo 18px vào một ô vuông navy 36px, lại dùng
                LogoAnh (logo trơn) nên cuộn xuống là logo BÉ HẲN LẠI, MỌC
                THÊM MỘT CÁI VIỀN, và MẤT SẠCH TRANG TRÍ NGÀY LỄ — chủ dự án
                chụp ảnh báo đúng ba chỗ đó.
                Nay: cùng 34px, không bọc ô vuông, và ngày lễ thì dùng LogoLe
                y như thanh menu. Thanh tìm kiếm nền TRẮNG nên light={false}
                (bản nét navy). */}
            {hidden && !mapView && (
              <Link href="/" aria-label="Trang chủ" className="md:hidden shrink-0">
                {logoLe
                  ? <LogoLe ma={logoLe} light={false} cao={34} />
                  : <img src="/logo-cam-lam-toi.webp" alt="" aria-hidden="true"
                      width={34} height={34} className="h-[34px] w-[34px] object-contain" />}
              </Link>
            )}
            <label className="flex items-center gap-2 flex-1 min-w-0 bg-slate-50 rounded-full border border-slate-200 px-4 focus-within:border-[#0B4045]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 text-slate-400 shrink-0"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && showMine(false)} onFocus={(e) => { if (window.innerWidth < 768) { e.currentTarget.blur(); setSearchOpen(true); } }} className="py-2 w-full outline-none text-sm bg-transparent" placeholder="Khu vực, từ khoá, dự án…" />
            </label>
            {/* MOBILE: nút Bộ lọc GỌN ngay trong hàng tìm kiếm (mở bottom-sheet) — 1 hàng cho gọn */}
            {!mapView && (
              <button onClick={() => setFilterOpen(true)} aria-label="Bộ lọc" className="cl-press md:hidden relative shrink-0 w-10 h-10 grid place-items-center rounded-full border border-slate-200 text-[#0B4045]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5"><path d="M3 5h18M6 12h12M10 19h4" /></svg>
                {activeFilters > 0 && <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 grid place-items-center rounded-full bg-red-600 text-white text-[10px] font-extrabold leading-none">{activeFilters}</span>}
              </button>
            )}
            <button onClick={() => showMine(false)} className={`bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-full text-sm whitespace-nowrap ${hidden && !mapView ? 'hidden md:block' : ''}`}>Tìm kiếm</button>
            <button onClick={() => goMapView(!mapView)} aria-label={mapView ? 'Đóng bản đồ' : 'Xem bản đồ'} className={`hidden md:flex items-center gap-1.5 font-bold px-3 sm:px-4 py-2.5 rounded-full text-sm whitespace-nowrap shrink-0 ${mapView ? 'bg-[#0B4045] text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 20l-5.5 2.5V6L9 3.5m0 16.5 6 -2.5M9 20V3.5m6 14 5.5 2.5V6L15 3.5m0 14V3.5m0 0L9 6" /></svg>
              <span className="hidden sm:inline">{mapView ? 'Đóng bản đồ' : 'Xem bản đồ'}</span>
            </button>
            {/* Khi cuộn xuống (Nav ẩn) → nút ☰ mở menu ngay tại đây */}
            {hidden && !mapView && <button onClick={() => window.dispatchEvent(new Event('open-nav-menu'))} aria-label="Menu" className="md:hidden shrink-0 w-9 h-9 grid place-items-center rounded-lg border border-slate-200 text-[#0B4045]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5"><path d="M3 6h18M3 12h18M3 18h18" /></svg></button>}
          </div>
          {/* Hàng chip lọc — CHỈ desktop (mobile đã gộp nút Bộ lọc vào hàng tìm kiếm ở trên) */}
          <div ref={filterRef} className="hidden md:flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-[#0B4045] text-white rounded-full px-3.5 py-2 text-sm font-semibold shrink-0">⚙ Lọc{activeFilters > 0 && <span className="bg-white text-[#0B4045] rounded-full w-5 h-5 grid place-items-center text-xs font-extrabold">{activeFilters}</span>}</span>
            <button onClick={() => setVerified((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold shrink-0 border ${verified ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-600'}`}>✓ Tin xác thực</button>
            <select value={type} onChange={(e) => { setType(e.target.value as PropertyType); load({ type: e.target.value }); }} className={`${chip} shrink-0`} style={chevron}>{TYPES.map((t) => <option key={t} value={t}>{t ? PROPERTY_LABELS[t as PropertyType] : 'Loại hình'}</option>)}</select>
            <select value={`${min}|${max}`} onChange={(e) => { const [mn, mx] = e.target.value.split('|'); setMin(mn); setMax(mx); load({ min: mn, max: mx }); }} className={`${chip} shrink-0`} style={chevron}>{PRICE_RANGES.map(([label, mn, mx]) => <option key={label} value={`${mn}|${mx}`}>{label}</option>)}</select>
            <select value={`${areaRange.min}|${areaRange.max}`} onChange={(e) => { const [mn, mx] = e.target.value.split('|').map(Number); setAreaRange({ min: mn, max: mx }); }} className={`${chip} shrink-0`} style={chevron}>{AREA_RANGES.map(([label, mn, mx]) => <option key={label} value={`${mn}|${mx}`}>{label}</option>)}</select>
          </div>
        </div>
      </div>

      {/* BẢN ĐỒ: mount sau lần mở đầu, chỉ ẩn/hiện bằng CSS → chuyển tab KHÔNG load lại (maplibre tự resize khi hiện lại) */}
      <div className={mapView ? 'lg:flex flex-1 min-h-0 md:flex-none md:h-[calc(100dvh-140px)]' : 'hidden'}>
        <div className="hidden lg:block h-full overflow-y-auto scroll-soft px-3 sm:px-4 py-4 w-full lg:w-[40%] lg:max-w-[560px]">{mapView && <>{listHeader}{listItems}</>}</div>
        <div className="block h-full flex-1 lg:border-l border-slate-200 relative">{mapMounted && mapPanel}</div>
      </div>
      {/* DANH SÁCH */}
      {!mapView && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-5 pb-24 md:py-5 lg:flex lg:gap-6 lg:items-start">
          <div className="flex-1 min-w-0">{listHeader}{listItems}<div ref={endRef} aria-hidden className="h-px" /></div>
          {/* Lớp dính phải đặt Ở ĐÂY chứ không phải trên <aside> bên trong.
              <aside> nằm lọt trong thẻ bọc này; thẻ bọc mới là ô của hàng flex, mà ô
              cao đúng bằng nội dung thì bên trong không còn chỗ nào để trượt — đặt
              sticky vào trong là vô tác dụng, cột vẫn cuộn mất như thường.
              Chặn chiều cao bằng màn hình + cho tự cuộn, để cột dài vẫn xem hết được.
              Không đè chân trang: cột chỉ trượt trong phạm vi hàng, hàng kết thúc
              trước chân trang.
              CON SỐ 173px LẤY TỪ ĐÂU: trang này có HAI thanh dính chồng nhau —
              thanh đầu trang cao 57px, thanh lọc ("Lọc / Tin xác thực / Loại hình…")
              dính tiếp từ 56 tới 154px. Đo thật trên máy chứ không ước. Lúc đầu để
              80px nên cột chui xuống dưới thanh lọc, đỉnh cột bị che mất.
              ĐỔI CHIỀU CAO THANH LỌC THÌ PHẢI SỬA LẠI HAI CON SỐ Ở ĐÂY. */}
          <div className="mt-0 hidden self-start lg:sticky lg:top-[162px] lg:block lg:max-h-[calc(100dvh-174px)] lg:overflow-y-auto lg:pr-1 cl-cot-ben">{sidebar}</div>
        </div>
      )}

      {/* TAB NỔI Danh sách / Bản đồ — CHỈ mobile (thay nút "Xem bản đồ" cũ). Ẩn khi đang mở BẢNG lưu tin để không đè.
          Mới chấm một điểm (chỉ có ghim + chip "Lưu tin này") thì VẪN hiện — chủ dự án báo mất nút 15/9/2026. */}
      {!(info && showSave) && !selPlace && !nearEnd && (
        <div className={`md:hidden fixed left-1/2 z-30 w-max max-w-[92vw] cl-fab-pill transition-opacity duration-200 ${hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="cl-glow rounded-full">
            <div className="relative z-[1] flex items-center gap-0.5 rounded-full bg-[#0B4045] shadow-xl p-1">
              <button onClick={() => goMapView(false)} className={`flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-extrabold rounded-full transition ${!mapView ? 'bg-[#C8A14B] text-[#0B4045] shadow' : 'text-white/85'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-3.5 h-3.5"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                Danh sách
              </button>
              <button onClick={() => goMapView(true)} className={`flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-extrabold rounded-full transition ${mapView ? 'bg-[#C8A14B] text-[#0B4045] shadow' : 'text-white/85'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9 20l-5.5 2.5V6L9 3.5m0 16.5 6 -2.5M9 20V3.5m6 14 5.5 2.5V6L15 3.5m0 14V3.5m0 0L9 6" /></svg>
                Bản đồ
              </button>
            </div>
          </div>
        </div>
      )}
      {/* KÉO-ĐỂ-TẢI-LẠI (mobile): vòng xoay hiện dần khi kéo ở đỉnh, xoay tròn khi đang tải */}
      {!mapView && (
        <div className="md:hidden fixed left-1/2 -translate-x-1/2 z-[60] pointer-events-none" style={{ top: refreshing ? 84 : 14 + pull * 0.7, opacity: refreshing || pull > 4 ? 1 : 0, transition: refreshing ? 'top .25s ease, opacity .2s' : 'opacity .15s' }}>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-lg ring-1 ring-slate-200">
            <svg className={`h-5 w-5 text-[#0B4045] ${refreshing ? 'animate-spin' : ''}`} style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.36" /><path d="M21 3.5V9h-5.5" /></svg>
          </div>
        </div>
      )}

      {/* TÌM KIẾM TOÀN MÀN HÌNH (mobile) — trượt lên như app, có gợi ý khu vực */}
      <div className={`fixed inset-0 z-[70] md:hidden bg-white flex flex-col transition-transform duration-300 ease-out ${searchOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`} style={{ paddingTop: 'env(safe-area-inset-top)' }} aria-hidden={!searchOpen}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
          <button onClick={() => setSearchOpen(false)} aria-label="Đóng" className="cl-press grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
          <label className="flex flex-1 min-w-0 items-center gap-2 rounded-full bg-slate-100 px-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 shrink-0 text-slate-400"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input ref={searchInputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setSearchOpen(false); showMine(false); } }} className="w-full bg-transparent py-2.5 text-base outline-none" placeholder="Khu vực, từ khoá, dự án…" />
            {q && <button onClick={() => { setQ(''); searchInputRef.current?.focus(); }} aria-label="Xoá" className="shrink-0 text-slate-400"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg></button>}
          </label>
          <button onClick={() => { setSearchOpen(false); showMine(false); }} className="cl-press shrink-0 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white">Tìm</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Khu vực phổ biến</p>
          <div className="flex flex-wrap gap-2">
            {['Bãi Dài', 'Cam Hải Đông', 'Cam Đức', 'Cam Thành Bắc', 'Cam Hải Tây', 'Cam Hòa', 'Suối Tân', 'Cam Hiệp'].map((a) => (
              <button key={a} onClick={() => { setQ(a); setMine(false); setSearchOpen(false); load({ q: a, mine: false }); }} className="cl-press inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm text-slate-600 active:bg-slate-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-400"><path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.2" /></svg>
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BỘ LỌC (mobile) — bottom-sheet với chip chọn nhanh */}
      <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Bộ lọc"
        footer={
          <div className="flex gap-2">
            <button onClick={() => { setType(''); setMin(''); setMax(''); setAreaRange({ min: 0, max: 0 }); setVerified(false); load({ type: '', min: '', max: '' }); }} className="cl-press flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-600">Xoá lọc</button>
            <button onClick={() => setFilterOpen(false)} className="cl-press flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white">Xem kết quả</button>
          </div>
        }>
        <Fgrp label="Loại hình">
          {TYPES.map((t) => <Fchip key={t || 'all'} on={type === t} onClick={() => { setType(t); load({ type: t }); }}>{t ? PROPERTY_LABELS[t as PropertyType] : 'Tất cả'}</Fchip>)}
        </Fgrp>
        <Fgrp label="Mức giá">
          {PRICE_RANGES.map(([label, mn, mx]) => <Fchip key={label} on={min === mn && max === mx} onClick={() => { setMin(mn); setMax(mx); load({ min: mn, max: mx }); }}>{label}</Fchip>)}
        </Fgrp>
        <Fgrp label="Diện tích">
          {AREA_RANGES.map(([label, mn, mx]) => <Fchip key={label} on={areaRange.min === mn && areaRange.max === mx} onClick={() => setAreaRange({ min: mn, max: mx })}>{label}</Fchip>)}
        </Fgrp>
        <button onClick={() => setVerified((v) => !v)} className={`cl-press flex w-full items-center justify-between rounded-xl border px-4 py-3 transition ${verified ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          <span className={`flex items-center gap-2 text-sm font-bold ${verified ? 'text-emerald-700' : 'text-slate-600'}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20 6 9 17l-5-5" /></svg>
            Chỉ tin đã xác thực
          </span>
          <span className={`relative h-6 w-10 rounded-full transition ${verified ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${verified ? 'left-[1.125rem]' : 'left-0.5'}`} /></span>
        </button>
      </BottomSheet>

      {!mapView && <SiteFooter />}
    </div>
  );
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-slate-400">Đang tải…</div>}>
      <ListingsInner />
    </Suspense>
  );
}
