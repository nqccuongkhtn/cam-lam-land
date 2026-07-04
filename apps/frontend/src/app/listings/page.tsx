'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { Listing, PropertyType, PROPERTY_LABELS, priceLabel, SALE_PROPERTY_TYPES, RENT_PROPERTY_TYPES, type DealType } from '@/lib/types';
import ListingRow from '@/components/ListingRow';
import SiteFooter from '@/components/SiteFooter';
import type { BaseMap, ImageOverlay } from '@/components/MapView';
import { wgs84ToVn2000 } from '@/lib/vn2000';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="h-full w-full grid place-items-center bg-slate-100 text-slate-400 text-sm animate-pulse">Đang tải bản đồ…</div> });
// Khoảng giá theo tỷ (bán) — cho thuê dùng phần lẻ của tỷ để load() giữ nguyên hệ số ×1e9 (3 triệu = 0.003 tỷ).
const SALE_PRICE_RANGES: [string, string, string][] = [['Tất cả mức giá', '', ''], ['Dưới 1 tỷ', '', '1'], ['1 - 3 tỷ', '1', '3'], ['3 - 5 tỷ', '3', '5'], ['5 - 10 tỷ', '5', '10'], ['10 - 20 tỷ', '10', '20'], ['Trên 20 tỷ', '20', '']];
const RENT_PRICE_RANGES: [string, string, string][] = [['Tất cả mức giá', '', ''], ['Dưới 3 triệu', '', '0.003'], ['3 - 5 triệu', '0.003', '0.005'], ['5 - 10 triệu', '0.005', '0.01'], ['10 - 20 triệu', '0.01', '0.02'], ['20 - 50 triệu', '0.02', '0.05'], ['Trên 50 triệu', '0.05', '']];
const AREA_RANGES: [string, number, number][] = [['Tất cả diện tích', 0, 0], ['Dưới 50 m²', 0, 50], ['50 - 80 m²', 50, 80], ['80 - 100 m²', 80, 100], ['100 - 150 m²', 100, 150], ['150 - 300 m²', 150, 300], ['Trên 300 m²', 300, 0]];
const BASE_THUMBS: [BaseMap, string, string][] = [['street', 'Mặc định', 'm'], ['satellite', 'Vệ tinh', 's'], ['terrain', 'Địa hình', 'p']];
const lyrOf = (b: BaseMap) => (b === 'satellite' ? 's' : b === 'terrain' ? 'p' : 'm');

const QH = {
  id: 'qh-qd205', url: '/overlays/QD205.png',
  pmtiles: 'pmtiles:///qhtiles', minzoom: 10, maxzoom: 18, fillMaxzoom: 14,
  coordinates: [[108.9401268, 12.217594], [109.2563886, 12.217594], [109.2563886, 11.9257021], [108.9401268, 11.9257021]] as [[number, number], [number, number], [number, number], [number, number]],
};
const QH_BOUNDS: [[number, number], [number, number]] = [[108.9401268, 11.9257021], [109.2563886, 12.217594]];
interface ParcelInfo { found: boolean; parcel: { properties: Record<string, any> } | null; zoning: Record<string, any> | null; }

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [type, setType] = useState<PropertyType | ''>('');
  const [min, setMin] = useState(''); const [max, setMax] = useState(''); const [q, setQ] = useState('');
  const [areaRange, setAreaRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapView, setMapView] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);
  const [baseMap, setBaseMap] = useState<BaseMap>('satellite');
  const [qhOn, setQhOn] = useState(true);
  const [opacity, setOpacity] = useState(0.7);
  const [labels, setLabels] = useState(true);
  const [info, setInfo] = useState<{ x: number; y: number; lng: number; lat: number; parcel: any; zoning: any } | null>(null);
  const [ads, setAds] = useState<any[]>([]);
  const [sort, setSort] = useState('default');
  const { user } = useAuth();
  const [mine, setMine] = useState(false);
  const [deal, setDeal] = useState<DealType>('sale');
  const TYPES = ['', ...(deal === 'rent' ? RENT_PROPERTY_TYPES : SALE_PROPERTY_TYPES)] as (PropertyType | '')[];
  const PRICE_RANGES = deal === 'rent' ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;

  function load(over?: { type?: string; min?: string; max?: string; q?: string; mine?: boolean; deal?: string }) {
    setLoading(true);
    if (over?.mine ?? mine) {
      api<{ listings: Listing[] }>('/listings/mine').then((d) => setListings(d.listings || [])).catch(() => setListings([])).finally(() => setLoading(false));
      return;
    }
    const p = new URLSearchParams();
    const t = over?.type ?? type, mn = over?.min ?? min, mx = over?.max ?? max, kw = over?.q ?? q, dl = over?.deal ?? deal;
    if (t) p.set('propertyType', t);
    if (mn) p.set('minPrice', String(Number(mn) * 1e9));
    if (mx) p.set('maxPrice', String(Number(mx) * 1e9));
    if (kw) p.set('q', kw);
    p.set('deal', dl);
    api<{ listings: Listing[] }>(`/listings?${p.toString()}`).then((d) => setListings(d.listings || [])).catch(() => setListings([])).finally(() => setLoading(false));
  }
  function switchDeal(d: DealType) { if (d === deal) return; setDeal(d); setType(''); setMin(''); setMax(''); setMine(false); load({ deal: d, type: '', min: '', max: '', mine: false }); }
  function showMine(v: boolean) { setMine(v); load({ mine: v }); }
  async function del(id: number) {
    if (!confirm('Xoá tin này khỏi giỏ hàng?')) return;
    try { await api(`/listings/${id}`, { method: 'DELETE' }); load({ mine: true }); } catch (e: any) { alert(e.message); }
  }
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = (sp.get('propertyType') as PropertyType) || '';
    const mx = sp.get('maxPrice') ? String(Number(sp.get('maxPrice')) / 1e9) : '';
    const kw = sp.get('q') || sp.get('ward') || '';
    const dl = (sp.get('deal') === 'rent' ? 'rent' : 'sale') as DealType;
    setType(t); setMax(mx); setQ(kw); setDeal(dl); load({ type: t, max: mx, q: kw, deal: dl });
    api<any>('/map-ads/active').then((r) => setAds(r.ads || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markers = useMemo(() => listings.map((l) => ({ lng: l.lng, lat: l.lat, label: priceLabel(l.price, l.deal), popupHtml: `<a href="/listings/${l.id}" style="font-weight:700;color:#0A2540">${l.title}</a><br/><b style="color:#dc2626">${priceLabel(l.price, l.deal)}</b>` })), [listings]);
  const overlays: ImageOverlay[] = useMemo(() => [{ ...QH, opacity, visible: qhOn }], [opacity, qhOn]);
  const shown = useMemo(() => {
    let a = [...listings];
    if (sort === 'price-asc') a.sort((x, y) => x.price - y.price);
    else if (sort === 'price-desc') a.sort((x, y) => y.price - x.price);
    else if (sort === 'newest') a.sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt));
    if (areaRange.min || areaRange.max) a = a.filter((l) => { const ar = l.area ?? 0; return (!areaRange.min || ar >= areaRange.min) && (!areaRange.max || ar <= areaRange.max); });
    if (verified) a = a.filter((l) => (l.images?.length ?? 0) > 0);
    return a;
  }, [listings, sort, areaRange, verified]);

  const activeFilters = (type ? 1 : 0) + (min || max ? 1 : 0) + (areaRange.min || areaRange.max ? 1 : 0) + (verified ? 1 : 0);
  const title = `${deal === 'rent' ? 'Cho thuê' : 'Mua bán'} ${type ? (PROPERTY_LABELS[type] as string).toLowerCase() : 'nhà đất'} tại Cam Lâm, Khánh Hòa`;

  async function onMapClick(lng: number, lat: number) {
    const vn = wgs84ToVn2000(lng, lat);
    let parcel: any = null, zoning: any = null;
    try { const r = await api<ParcelInfo>(`/parcels/at?lng=${lng}&lat=${lat}`); parcel = r.parcel; zoning = r.zoning; } catch { /* ignore */ }
    setInfo({ x: vn.x, y: vn.y, lng, lat, parcel, zoning });
  }

  const chip = 'appearance-none bg-white border border-slate-300 rounded-full pl-3 sm:pl-3.5 pr-7 sm:pr-8 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:border-[#0A2540] cursor-pointer bg-[length:14px] bg-no-repeat';
  const chevron = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: 'right 10px center' };

  const mapPanel = (
    <div className="relative h-full w-full">
      <MapView markers={markers} overlays={overlays} baseMap={baseMap} labels={labels} onMapClick={onMapClick} initialBounds={QH_BOUNDS} adMarkers={ads} adOpacity={qhOn ? opacity : 1} className="absolute inset-0 h-full w-full" />
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <label className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 shadow px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-700 cursor-pointer w-fit">
          <input type="checkbox" checked={qhOn} onChange={(e) => setQhOn(e.target.checked)} className="accent-red-600" /> Lớp quy hoạch
        </label>
        <label className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 shadow px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-700 cursor-pointer w-fit">
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} className="accent-red-600" /> Nhãn & đường
        </label>
        <div>
          {layerOpen ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-2">
              <div className="flex items-center justify-between mb-1 px-0.5"><span className="text-[10px] font-bold text-slate-500">Loại bản đồ</span><button onClick={() => setLayerOpen(false)} className="text-slate-400 hover:text-slate-700 text-xs leading-none">✕</button></div>
              <div className="flex gap-1.5">
                {BASE_THUMBS.map(([b, label, lyr]) => (
                  <button key={b} onClick={() => { setBaseMap(b); setLayerOpen(false); }} className="text-center w-14">
                    <span className={`block w-14 h-12 rounded-lg overflow-hidden border-2 ${baseMap === b ? 'border-red-600' : 'border-slate-200'}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`https://mt1.google.com/vt/lyrs=${lyr}&x=3289&y=1909&z=12`} alt={label} loading="lazy" className="w-full h-full object-cover" /></span>
                    <span className={`block text-[10px] mt-0.5 font-semibold ${baseMap === b ? 'text-red-600' : 'text-slate-600'}`}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button onClick={() => setLayerOpen(true)} title="Đổi lớp bản đồ" className="flex items-center gap-1.5 bg-white rounded-lg border border-slate-200 shadow px-2 py-1.5 hover:bg-slate-50 w-fit">
              <span className="block w-7 h-7 rounded-md overflow-hidden border border-slate-200">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`https://mt1.google.com/vt/lyrs=${lyrOf(baseMap)}&x=3289&y=1909&z=12`} alt="" className="w-full h-full object-cover" /></span>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-700">Lớp bản đồ</span>
            </button>
          )}
        </div>
      </div>
      {qhOn && (
        <div className="absolute top-1/2 right-3 -translate-y-1/2 z-10 flex flex-col items-center gap-1 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-lg px-2 py-3">
          <span className="text-[10px] font-bold text-slate-500">Đậm</span>
          <div className="relative h-36 w-7">
            <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="absolute left-1/2 top-1/2 w-36 -translate-x-1/2 -translate-y-1/2 -rotate-90 accent-red-600 cursor-pointer" aria-label="Độ mờ lớp quy hoạch" />
          </div>
          <span className="text-[10px] font-bold text-slate-500">Mờ</span>
          <span className="text-[11px] text-[#0A2540] font-extrabold mt-0.5">{Math.round(opacity * 100)}%</span>
        </div>
      )}
      {info && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[340px] max-w-[92%] z-10 bg-white rounded-2xl border border-slate-200 shadow-xl p-3.5 text-xs">
          <div className="flex items-center justify-between mb-2">
            <b className="text-[#0A2540] text-sm">📍 Kiểm tra quy hoạch</b>
            <button onClick={() => setInfo(null)} className="text-slate-400 hover:text-slate-700 text-base leading-none">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-slate-600">
            <div className="bg-slate-50 rounded-lg px-2 py-1.5"><div className="text-[10px] text-slate-400">X (Đông)</div><b>{info.x.toFixed(2)}</b></div>
            <div className="bg-slate-50 rounded-lg px-2 py-1.5"><div className="text-[10px] text-slate-400">Y (Bắc)</div><b>{info.y.toFixed(2)}</b></div>
          </div>
          {info.parcel ? (
            <div className="mt-2 border-t border-slate-100 pt-2">
              {Object.entries(info.parcel.properties || {}).slice(0, 6).map(([k, v]) => (<div key={k} className="flex justify-between gap-2"><span className="text-slate-400">{k}</span><b className="text-slate-700 text-right">{String(v)}</b></div>))}
            </div>
          ) : (<div className="mt-2 border-t border-slate-100 pt-2 text-slate-400">Chưa có dữ liệu thửa địa chính tại điểm này.</div>)}
          <a href="/map" className="mt-2.5 inline-block text-[#0A2540] font-semibold hover:text-red-600">Mở công cụ bản đồ đầy đủ →</a>
        </div>
      )}

    </div>
  );

  const listHeader = (
    <>
      <div className="inline-flex rounded-full bg-slate-100 p-1 mb-2">
        <button onClick={() => switchDeal('sale')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${deal === 'sale' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:text-[#0A2540]'}`}>Nhà đất bán</button>
        <button onClick={() => switchDeal('rent')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${deal === 'rent' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-[#0A2540]'}`}>Nhà đất cho thuê</button>
      </div>
      <div className="text-xs text-slate-400 mb-1"><Link href="/" className="hover:text-[#0A2540]">{deal === 'rent' ? 'Cho thuê' : 'Bán'}</Link> › <span className="hover:text-[#0A2540]">Khánh Hòa</span> › <span className="text-slate-600">Cam Lâm</span></div>
      {user ? (
        <div className="flex rounded-xl border border-slate-200 overflow-hidden w-fit mb-1">
          <button onClick={() => showMine(false)} className={`px-3.5 py-1.5 text-sm font-bold ${!mine ? 'bg-[#0A2540] text-white' : 'text-slate-600'}`}>Tất cả</button>
          <button onClick={() => showMine(true)} className={`px-3.5 py-1.5 text-sm font-bold ${mine ? 'bg-[#0A2540] text-white' : 'text-slate-600'}`}>🧺 Giỏ của tôi</button>
        </div>
      ) : null}
      <h1 className="text-xl md:text-2xl font-extrabold text-[#0A2540]">{mine ? 'Giỏ hàng của bạn' : title}</h1>
      <p className="text-sm text-slate-500 mt-0.5">{loading ? 'Đang tìm…' : <>Hiện có <b className="text-[#0A2540]">{shown.length}</b> bất động sản.</>}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        <Link href="/gia-dat" className="inline-flex items-center gap-1.5 bg-[#C8A14B]/10 text-[#0A2540] font-bold text-sm px-3 py-1.5 rounded-full hover:bg-[#C8A14B]/20">💰 Giá đất &amp; định giá nhanh</Link>
        <Link href="/cam-nang" className="inline-flex items-center gap-1.5 bg-[#0A2540]/[0.06] text-[#0A2540] font-bold text-sm px-3 py-1.5 rounded-full hover:bg-[#0A2540]/10">📚 Cẩm nang pháp lý nhà đất</Link>
      </div>
      <div className="flex items-center justify-between mt-3 mb-3">
        <label className="hidden sm:flex items-center gap-2 text-sm text-slate-500"><span className="w-7 h-7 grid place-items-center rounded-full bg-amber-100 text-amber-600">🔔</span> Nhận tin mới</label>
        <label className="flex items-center gap-1.5 text-sm text-slate-500 ml-auto">
          <span className="hidden sm:inline">Sắp xếp</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white font-semibold text-[#0A2540] outline-none cursor-pointer">
            <option value="default">Mặc định</option><option value="newest">Mới nhất</option><option value="price-asc">Giá thấp → cao</option><option value="price-desc">Giá cao → thấp</option>
          </select>
        </label>
      </div>
    </>
  );

  const listItems = loading ? (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="w-48 h-32 skeleton shrink-0" />
          <div className="flex-1 py-3 pr-3 space-y-2.5"><div className="h-4 w-3/4 skeleton rounded" /><div className="h-5 w-1/2 skeleton rounded" /><div className="h-3 w-2/3 skeleton rounded" /></div>
        </div>
      ))}
    </div>
  ) : shown.length === 0 ? (
    <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500 text-sm">{mine ? <>Giỏ hàng của bạn đang trống. <Link href="/sales/post" className="text-[#0A2540] font-bold">Đăng tin đầu tiên →</Link></> : 'Không có kết quả phù hợp.'}</div>
  ) : (
    <div className="flex flex-col gap-3">
      {shown.map((l) => mine ? (
        <div key={l.id} className="flex flex-col gap-1.5">
          <ListingRow l={l} />
          <div className="flex gap-1.5">
            <Link href={`/sales/edit/${l.id}`} className="flex-1 text-center bg-white border border-slate-200 text-[#0A2540] text-xs font-bold py-1.5 rounded-lg hover:border-[#C8A14B]">✏️ Sửa</Link>
            <Link href={`/sales/leads/${l.id}`} className="flex-1 text-center bg-white border border-slate-200 text-[#0A2540] text-xs font-bold py-1.5 rounded-lg hover:border-[#C8A14B]">👁 Khách</Link>
            <button onClick={() => del(l.id)} className="flex-1 bg-white border border-red-200 text-red-600 text-xs font-bold py-1.5 rounded-lg hover:bg-red-50">🗑 Xoá</button>
          </div>
        </div>
      ) : <ListingRow key={l.id} l={l} />)}
    </div>
  );

  const sidebar = (
    <aside className="lg:w-80 shrink-0 space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-bold text-[#0A2540]">Mặt bằng giá khu vực</p><p className="text-xs text-slate-400">Cam Lâm · 12 tháng qua</p></div>
          <svg viewBox="0 0 90 36" className="w-24 h-9 text-emerald-500"><path d="M0 28 L15 24 L30 26 L45 16 L60 18 L75 8 L90 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <button onClick={() => setMapView(true)} className="mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700">📈 Xem vị trí trên bản đồ →</button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="font-bold text-[#0A2540] mb-1.5">Lọc theo khoảng giá</p>
        <div className="flex flex-col">
          {PRICE_RANGES.map(([label, mn, mx]) => (
            <button key={label} onClick={() => { setMin(mn); setMax(mx); load({ min: mn, max: mx }); }} className={`text-left py-1.5 text-sm border-b border-slate-50 last:border-0 ${min === mn && max === mx ? 'text-red-600 font-bold' : 'text-slate-600 hover:text-[#0A2540]'}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="font-bold text-[#0A2540] mb-1.5">Lọc theo diện tích</p>
        <div className="flex flex-col">
          {AREA_RANGES.map(([label, mn, mx]) => (
            <button key={label} onClick={() => setAreaRange({ min: mn, max: mx })} className={`text-left py-1.5 text-sm border-b border-slate-50 last:border-0 ${areaRange.min === mn && areaRange.max === mx ? 'text-red-600 font-bold' : 'text-slate-600 hover:text-[#0A2540]'}`}>{label}</button>
          ))}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      {/* THANH TÌM KIẾM + CHIP LỌC */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 flex-1 min-w-0 bg-slate-50 rounded-full border border-slate-200 px-4 focus-within:border-[#0A2540]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 text-slate-400 shrink-0"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && showMine(false)} className="py-2.5 w-full outline-none text-sm bg-transparent" placeholder="Khu vực, từ khoá, dự án…" />
            </label>
            <button onClick={() => showMine(false)} className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-full text-sm whitespace-nowrap">Tìm kiếm</button>
            <button onClick={() => setMapView((v) => !v)} className={`hidden md:flex items-center gap-1.5 font-bold px-4 py-2.5 rounded-full text-sm whitespace-nowrap ${mapView ? 'bg-[#0A2540] text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 20l-5.5 2.5V6L9 3.5m0 16.5 6 -2.5M9 20V3.5m6 14 5.5 2.5V6L15 3.5m0 14V3.5m0 0L9 6" /></svg>
              {mapView ? 'Đóng bản đồ' : 'Xem bản đồ'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-[#0A2540] text-white rounded-full px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold shrink-0">⚙ Lọc{activeFilters > 0 && <span className="bg-white text-[#0A2540] rounded-full w-5 h-5 grid place-items-center text-xs font-extrabold">{activeFilters}</span>}</span>
            <select value={type} onChange={(e) => { setType(e.target.value as PropertyType); load({ type: e.target.value }); }} className={`${chip} shrink-0`} style={chevron}>{TYPES.map((t) => <option key={t} value={t}>{t ? PROPERTY_LABELS[t as PropertyType] : 'Loại hình'}</option>)}</select>
            <select value={`${min}|${max}`} onChange={(e) => { const [mn, mx] = e.target.value.split('|'); setMin(mn); setMax(mx); load({ min: mn, max: mx }); }} className={`${chip} shrink-0`} style={chevron}>{PRICE_RANGES.map(([label, mn, mx]) => <option key={label} value={`${mn}|${mx}`}>{label}</option>)}</select>
            <select value={`${areaRange.min}|${areaRange.max}`} onChange={(e) => { const [mn, mx] = e.target.value.split('|').map(Number); setAreaRange({ min: mn, max: mx }); }} className={`${chip} shrink-0`} style={chevron}>{AREA_RANGES.map(([label, mn, mx]) => <option key={label} value={`${mn}|${mx}`}>{label}</option>)}</select>
            <button onClick={() => setVerified((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold shrink-0 border ${verified ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-600'}`}>✓ Tin có ảnh</button>
          </div>
        </div>
      </div>

      {mapView ? (
        <div className="lg:flex h-[calc(100vh-150px)]">
          <div className="h-full overflow-y-auto scroll-soft px-3 sm:px-4 py-4 w-full lg:w-[40%] lg:max-w-[560px]">{listHeader}{listItems}</div>
          <div className="hidden lg:block h-full flex-1 border-l border-slate-200 relative">{mapPanel}</div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5 lg:flex lg:gap-6 lg:items-start">
          <div className="flex-1 min-w-0">{listHeader}{listItems}</div>
          <div className="hidden lg:block mt-0">{sidebar}</div>
        </div>
      )}
      {!mapView && <SiteFooter />}
    </div>
  );
}
