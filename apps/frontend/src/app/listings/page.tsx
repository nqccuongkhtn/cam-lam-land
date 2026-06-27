'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { Listing, PropertyType, PROPERTY_LABELS } from '@/lib/types';
import ListingCard from '@/components/ListingCard';
import type { BaseMap, ImageOverlay } from '@/components/MapView';
import { wgs84ToVn2000 } from '@/lib/vn2000';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="h-full w-full grid place-items-center bg-slate-100 text-slate-400 text-sm animate-pulse">Đang tải bản đồ…</div> });
const TYPES: (PropertyType | '')[] = ['', 'land', 'house', 'apartment', 'villa', 'commercial', 'farm'];

// Lớp ảnh quy hoạch (trùng với trang Bản đồ)
const QH = {
  id: 'qh-qd205', url: '/overlays/QD205.png',
  coordinates: [[108.9401268, 12.217594], [109.2563886, 12.217594], [109.2563886, 11.9257021], [108.9401268, 11.9257021]] as [[number, number], [number, number], [number, number], [number, number]],
};
const QH_BOUNDS: [[number, number], [number, number]] = [[108.9401268, 11.9257021], [109.2563886, 12.217594]];
interface ParcelInfo { found: boolean; parcel: { properties: Record<string, any> } | null; zoning: Record<string, any> | null; }

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [type, setType] = useState<PropertyType | ''>('');
  const [min, setMin] = useState(''); const [max, setMax] = useState(''); const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list'); // chỉ áp dụng cho < lg
  const [baseMap, setBaseMap] = useState<BaseMap>('satellite');
  const [qhOn, setQhOn] = useState(true);
  const [opacity, setOpacity] = useState(0.7);
  const [labels, setLabels] = useState(true);
  const [info, setInfo] = useState<{ x: number; y: number; lng: number; lat: number; parcel: any; zoning: any } | null>(null);
  const [ads, setAds] = useState<any[]>([]);
  const [sort, setSort] = useState('default');

  function load(over?: { type?: string; min?: string; max?: string; q?: string }) {
    setLoading(true);
    const p = new URLSearchParams();
    const t = over?.type ?? type, mn = over?.min ?? min, mx = over?.max ?? max, kw = over?.q ?? q;
    if (t) p.set('propertyType', t);
    if (mn) p.set('minPrice', String(Number(mn) * 1e9));
    if (mx) p.set('maxPrice', String(Number(mx) * 1e9));
    if (kw) p.set('q', kw);
    api<{ listings: Listing[] }>(`/listings?${p.toString()}`).then((d) => setListings(d.listings || [])).catch(() => setListings([])).finally(() => setLoading(false));
  }
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = (sp.get('propertyType') as PropertyType) || '';
    const mx = sp.get('maxPrice') ? String(Number(sp.get('maxPrice')) / 1e9) : '';
    const kw = sp.get('q') || '';
    setType(t); setMax(mx); setQ(kw); load({ type: t, max: mx, q: kw });
    api<any>('/map-ads/active').then((r) => setAds(r.ads || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markers = useMemo(() => listings.map((l) => ({ lng: l.lng, lat: l.lat, popupHtml: `<a href="/listings/${l.id}"><b>${l.title}</b></a>` })), [listings]);
  const overlays: ImageOverlay[] = useMemo(() => [{ ...QH, opacity, visible: qhOn }], [opacity, qhOn]);
  const sorted = useMemo(() => {
    const a = [...listings];
    if (sort === 'price-asc') a.sort((x, y) => x.price - y.price);
    else if (sort === 'price-desc') a.sort((x, y) => y.price - x.price);
    else if (sort === 'newest') a.sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt));
    return a;
  }, [listings, sort]);

  async function onMapClick(lng: number, lat: number) {
    const vn = wgs84ToVn2000(lng, lat);
    let parcel: any = null, zoning: any = null;
    try { const r = await api<ParcelInfo>(`/parcels/at?lng=${lng}&lat=${lat}`); parcel = r.parcel; zoning = r.zoning; } catch { /* ignore */ }
    setInfo({ x: vn.x, y: vn.y, lng, lat, parcel, zoning });
  }

  const mapPanel = (
    <div className="relative h-full w-full">
      <MapView markers={markers} overlays={overlays} baseMap={baseMap} labels={labels} onMapClick={onMapClick} initialBounds={QH_BOUNDS} adMarkers={ads} adOpacity={qhOn ? opacity : 1} className="absolute inset-0 h-full w-full" />

      {/* Bộ chọn nền + bật lớp quy hoạch */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-[60%]">
        <div className="flex rounded-lg overflow-hidden border border-slate-300 shadow bg-white text-[11px] sm:text-xs font-semibold">
          {([['street', 'Đường'], ['satellite', 'Vệ tinh'], ['terrain', 'Địa hình']] as [BaseMap, string][]).map(([b, l]) => (
            <button key={b} onClick={() => setBaseMap(b)} className={`px-2.5 py-1.5 ${baseMap === b ? 'bg-[#0A2540] text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{l}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 shadow px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-700 cursor-pointer w-fit">
          <input type="checkbox" checked={qhOn} onChange={(e) => setQhOn(e.target.checked)} className="accent-red-600" />
          Lớp quy hoạch
        </label>
        <label className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 shadow px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-700 cursor-pointer w-fit">
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} className="accent-red-600" />
          Nhãn & đường
        </label>
      </div>

      {/* Thanh kéo DỌC chỉnh mờ/đậm lớp quy hoạch */}
      {qhOn && (
        <div className="absolute top-1/2 right-3 -translate-y-1/2 z-10 flex flex-col items-center gap-1 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-lg px-2 py-3">
          <span className="text-[10px] font-bold text-slate-500">Đậm</span>
          <div className="relative h-36 w-7">
            <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="absolute left-1/2 top-1/2 w-36 -translate-x-1/2 -translate-y-1/2 -rotate-90 accent-red-600 cursor-pointer" aria-label="Độ mờ lớp quy hoạch" />
          </div>
          <span className="text-[10px] font-bold text-slate-500">Mờ</span>
          <span className="text-[11px] text-[#0A2540] font-extrabold mt-0.5">{Math.round(opacity * 100)}%</span>
        </div>
      )}

      {/* Kết quả kiểm tra quy hoạch khi bấm vào bản đồ */}
      {info && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 z-10 bg-white rounded-2xl border border-slate-200 shadow-xl p-3.5 text-xs">
          <div className="flex items-center justify-between mb-2">
            <b className="text-[#0A2540] text-sm">📍 Kiểm tra quy hoạch</b>
            <button onClick={() => setInfo(null)} className="text-slate-400 hover:text-slate-700 text-base leading-none">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-slate-600">
            <div className="bg-slate-50 rounded-lg px-2 py-1.5"><div className="text-[10px] text-slate-400">X (Đông)</div><b>{info.x.toFixed(2)}</b></div>
            <div className="bg-slate-50 rounded-lg px-2 py-1.5"><div className="text-[10px] text-slate-400">Y (Bắc)</div><b>{info.y.toFixed(2)}</b></div>
          </div>
          <div className="text-slate-400 mt-1.5">VN-2000 · Lat/Lng: {info.lat.toFixed(6)}, {info.lng.toFixed(6)}</div>
          {info.parcel ? (
            <div className="mt-2 border-t border-slate-100 pt-2">
              {Object.entries(info.parcel.properties || {}).slice(0, 6).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><span className="text-slate-400">{k}</span><b className="text-slate-700 text-right">{String(v)}</b></div>
              ))}
            </div>
          ) : (
            <div className="mt-2 border-t border-slate-100 pt-2 text-slate-400">Chưa có dữ liệu thửa địa chính tại điểm này. Đối chiếu trực tiếp với lớp ảnh quy hoạch ở trên.</div>
          )}
          <a href="/map" className="mt-2.5 inline-block text-[#0A2540] font-semibold hover:text-red-600">Mở công cụ bản đồ đầy đủ →</a>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-slate-50">
      {/* Thanh lọc */}
      <div className="bg-white border-b border-slate-200 shrink-0 z-20">
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 bg-slate-50/80 border border-slate-200 rounded-2xl p-2 shadow-sm">
              <label className="flex items-center gap-2 flex-1 min-w-[170px] bg-white rounded-xl border border-slate-200 px-3 transition focus-within:border-[#0A2540] focus-within:ring-2 focus-within:ring-[#0A2540]/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 text-slate-400 shrink-0"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} className="py-2.5 w-full outline-none text-sm bg-transparent" placeholder="Khu vực, từ khoá, dự án…" />
              </label>
              <label className="flex items-center gap-2 min-w-[148px] bg-white rounded-xl border border-slate-200 px-3 transition focus-within:border-[#0A2540]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400 shrink-0"><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>
                <select value={type} onChange={(e) => setType(e.target.value as PropertyType)} className="py-2.5 w-full outline-none text-sm bg-transparent text-slate-700 cursor-pointer">
                  {TYPES.map((t) => <option key={t} value={t}>{t ? PROPERTY_LABELS[t as PropertyType] : 'Loại hình'}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5 bg-white rounded-xl border border-slate-200 px-3 transition focus-within:border-[#0A2540]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400 shrink-0"><path d="M20.6 13.4 12 22l-9-9V3h8z" /><circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" /></svg>
                <input value={min} onChange={(e) => setMin(e.target.value)} type="number" min="0" className="py-2.5 w-12 outline-none text-sm bg-transparent" placeholder="Từ" />
                <span className="text-slate-300">–</span>
                <input value={max} onChange={(e) => setMax(e.target.value)} type="number" min="0" className="py-2.5 w-12 outline-none text-sm bg-transparent" placeholder="Đến" />
                <span className="text-xs text-slate-400 font-semibold shrink-0">tỷ</span>
              </label>
              <button onClick={() => load()} className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-red-600/30 whitespace-nowrap grow sm:grow-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" className="w-4 h-4"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                Tìm kiếm
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-2 px-1">{loading ? 'Đang tìm…' : <>Tìm thấy <b className="text-[#0A2540]">{listings.length}</b> bất động sản tại Cam Lâm</>}</p>
          </div>
        {/* Toggle Danh sách / Bản đồ — chỉ hiện trên điện thoại & iPad dọc */}
        <div className="lg:hidden flex border-t border-slate-100">
          {([['list', '🏠 Danh sách'], ['map', '🗺️ Bản đồ & quy hoạch']] as [typeof view, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-2.5 text-sm font-semibold ${view === v ? 'text-[#0A2540] border-b-2 border-red-600' : 'text-slate-500'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Thân: danh sách (cuộn) | bản đồ (full chiều cao) */}
      <div className="flex-1 min-h-0 lg:flex">
        <div className={`${view === 'map' ? 'hidden' : ''} lg:block h-full overflow-y-auto scroll-soft px-3 sm:px-4 py-4 w-full lg:w-[58%]`}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-base sm:text-lg font-extrabold text-[#0A2540]">Bất động sản nổi bật</h2>
            <label className="flex items-center gap-1.5 text-sm text-slate-500 shrink-0">
              <span className="hidden sm:inline">Sắp xếp</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white font-semibold text-[#0A2540] outline-none cursor-pointer">
                <option value="default">Nổi bật</option>
                <option value="newest">Mới nhất</option>
                <option value="price-asc">Giá thấp → cao</option>
                <option value="price-desc">Giá cao → thấp</option>
              </select>
            </label>
          </div>
          {loading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="h-52 skeleton" />
                  <div className="p-4 space-y-2.5">
                    <div className="h-4 w-3/4 skeleton rounded" />
                    <div className="h-5 w-1/2 skeleton rounded" />
                    <div className="h-3 w-2/3 skeleton rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500 text-sm">
              Không có kết quả. Nếu chưa có tin, chạy <code className="bg-slate-100 px-1 rounded">them_tin_demo.bat</code> để thêm tin mẫu.
            </div>
          ) : (
            <div className="grid gap-4 content-start grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3">
              {sorted.map((l) => <ListingCard key={l.id} l={l} />)}
            </div>
          )}
        </div>
        <div className={`${view === 'list' ? 'hidden' : ''} lg:block h-full w-full lg:w-[42%] lg:border-l border-slate-200 relative`}>
          {mapPanel}
        </div>
      </div>
    </div>
  );
}
