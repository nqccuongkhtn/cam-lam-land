'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import type { GeoLayer, ImageOverlay, BaseMap, MeasureMode, MeasureResult } from '@/components/MapView';
import { GisLayer, formatVnd } from '@/lib/types';
import { vn2000ToWgs84, wgs84ToVn2000 } from '@/lib/vn2000';
import { getToken } from '@/lib/token';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="h-full w-full grid place-items-center bg-slate-100 text-slate-400 text-sm animate-pulse">Đang tải bản đồ…</div> });

const DEFAULT_COLORS: Record<string, string> = {
  parcel: '#1e88e5', zoning: '#fb8c00', admin: '#7e57c2', road: '#455a64', custom: '#16a34a',
};
const RASTER_OVERLAYS = [
  { id: 'qh-qd205', name: 'Ảnh quy hoạch QĐ205', url: '/overlays/QD205.png',
    coordinates: [[108.9401268, 12.217594], [109.2563886, 12.217594], [109.2563886, 11.9257021], [108.9401268, 11.9257021]] as [[number, number], [number, number], [number, number], [number, number]] },
];
const QH_BOUNDS: [[number, number], [number, number]] = [[108.9401268, 11.9257021], [109.2563886, 12.217594]];

interface ParcelInfo {
  found: boolean; point: { lng: number; lat: number };
  parcel: { properties: Record<string, any> } | null;
  zoning: Record<string, any> | null;
  listings: { id: number; title: string; price: number }[];
}
const fmtLen = (m: number) => (m >= 1000 ? (m / 1000).toFixed(3) + ' km' : m.toFixed(1) + ' m');
const fmtArea = (m2: number) => (m2 >= 10000 ? (m2 / 10000).toFixed(4) + ' ha (' + m2.toFixed(0) + ' m²)' : m2.toFixed(1) + ' m²');
// Tách toạ độ từ link Google Maps (…/@lat,lng…, !3dlat!4dlng, q=lat,lng, hoặc "lat,lng").
function parseGmap(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  let m = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/); if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/); if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/(?:[?&](?:q|query|ll|sll|destination)=|loc:)(-?\d+(?:\.\d+)?)[,+\s]+(-?\d+(?:\.\d+)?)/i); if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/); if (m) return { lat: +m[1], lng: +m[2] };
  return null;
}

export default function MapPage() {
  const [layers, setLayers] = useState<GisLayer[]>([]);
  const [data, setData] = useState<Record<string, GeoJSON.FeatureCollection>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [info, setInfo] = useState<ParcelInfo | null>(null);
  const [clickVN, setClickVN] = useState<{ x: number; y: number; lng: number; lat: number } | null>(null);
  const [opacity, setOpacity] = useState(0.85);
  const [canDelete, setCanDelete] = useState(false);
  const [ovOn, setOvOn] = useState<Record<string, boolean>>({ 'qh-qd205': true });
  const [baseMap, setBaseMap] = useState<BaseMap>('street');
  const [labels, setLabels] = useState(true);
  const [measure, setMeasure] = useState<MeasureMode>('off');
  const [mResult, setMResult] = useState<MeasureResult | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ lng: number; lat: number; label?: string } | null>(null);
  const [highlight, setHighlight] = useState<any>(null);
  const [searchMode, setSearchMode] = useState<'parcel' | 'vn2000' | 'latlng' | 'gmap'>('parcel');
  const [c1, setC1] = useState(''); const [c2, setC2] = useState('');
  const [c3, setC3] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [ads, setAds] = useState<any[]>([]);
  const [tool, setTool] = useState<'none' | 'search' | 'base' | 'measure'>('none'); // bảng công cụ trên mobile

  const load = useCallback(() => {
    api<{ layers: GisLayer[] }>('/layers').then(async ({ layers }) => {
      setLayers(layers);
      setVisible((prev) => Object.fromEntries(layers.map((l) => [l.slug, prev[l.slug] ?? false])));
      const entries = await Promise.all(layers.map(async (l) => {
        try { return [l.slug, await api<GeoJSON.FeatureCollection>(`/layers/${l.slug}/features`)] as const; }
        catch { return [l.slug, { type: 'FeatureCollection', features: [] }] as const; }
      }));
      setData(Object.fromEntries(entries));
    }).catch(() => {});
  }, []);
  useEffect(() => { load(); setCanDelete(!!getToken()); api<any>('/map-ads/active').then((r) => setAds(r.ads || [])).catch(() => {}); }, [load]);

  const overlays: ImageOverlay[] = useMemo(
    () => RASTER_OVERLAYS.map((o) => ({ id: o.id, url: o.url, coordinates: o.coordinates, opacity, visible: ovOn[o.id] ?? true })), [opacity, ovOn]);

  const geoLayers: GeoLayer[] = useMemo(() => {
    const out: GeoLayer[] = [];
    for (const l of layers) {
      const fc = data[l.slug]; if (!fc) continue;
      const base = (l.style?.color as string) || DEFAULT_COLORS[l.layerType] || '#16a34a';
      const colorExpr: any = ['coalesce', ['get', 'color'], base];
      const gtype = (l.geometryType || '').toLowerCase();
      const vis = visible[l.slug] ?? false;
      if (gtype.includes('line')) out.push({ id: `${l.slug}-line`, type: 'line', data: fc, visible: vis, paint: { 'line-color': colorExpr, 'line-width': (l.style?.weight as number) ?? 2.5 } });
      else if (gtype.includes('point')) out.push({ id: `${l.slug}-pt`, type: 'circle', data: fc, visible: vis, paint: { 'circle-color': colorExpr, 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } });
      else {
        out.push({ id: `${l.slug}-fill`, type: 'fill', data: fc, visible: vis, paint: { 'fill-color': colorExpr, 'fill-opacity': opacity } });
        out.push({ id: `${l.slug}-line`, type: 'line', data: fc, visible: vis, paint: { 'line-color': colorExpr, 'line-width': (l.style?.weight as number) ?? 0.7 } });
      }
    }
    return out;
  }, [layers, data, visible, opacity]);

  async function onMapClick(lng: number, lat: number) {
    const vn = wgs84ToVn2000(lng, lat);
    setClickVN({ x: vn.x, y: vn.y, lng, lat });
    try { setInfo(await api<ParcelInfo>(`/parcels/at?lng=${lng}&lat=${lat}`)); } catch { setInfo(null); }
  }
  async function doSearch() {
    if (searchMode === 'parcel') {
      const params = new URLSearchParams();
      if (c1.trim()) params.set('soto', c1.trim());
      if (c2.trim()) params.set('sothua', c2.trim());
      if (c3.trim()) params.set('xa', c3.trim());
      if (!params.toString()) return alert('Nhập số tờ và/hoặc số thửa.');
      try {
        const r = await api<{ count: number; parcels: any[] }>(`/parcels/search?${params.toString()}`);
        if (!r.count) return alert('Không tìm thấy thửa. Cần đã nạp bản đồ địa chính có số tờ/số thửa.');
        const p = r.parcels[0];
        setHighlight({ type: 'Feature', properties: p.properties, geometry: p.geometry });
        setFocusPoint({ lng: p.lng, lat: p.lat, label: `Tờ ${c1} - Thửa ${c2}${c3 ? ' - ' + c3 : ''}` });
        setClickVN(null);
        setInfo({ found: true, point: { lng: p.lng, lat: p.lat }, parcel: { properties: { ...p.properties, 'Diện tích (m²)': p.area_m2 } }, zoning: null, listings: [] });
        setPanelOpen(false); setTool('none');
      } catch (e: any) { alert('Lỗi tra cứu: ' + e.message); }
      return;
    }
    if (searchMode === 'gmap') {
      const g = parseGmap(c1.trim());
      if (!g) return alert('Không đọc được toạ độ từ link. Hãy dán link Google Maps có dạng …/@12.34,109.12,… hoặc copy toạ độ. (Link rút gọn goo.gl cần mở ra để lấy link đầy đủ.)');
      setFocusPoint({ lng: g.lng, lat: g.lat, label: `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}` });
      setTool('none'); return;
    }
    let lng: number, lat: number;
    if (searchMode === 'vn2000') {
      const x = parseFloat(c1), y = parseFloat(c2);
      if (Number.isNaN(x) || Number.isNaN(y)) return alert('Nhập X (Đông), Y (Bắc) hệ VN-2000.');
      const w = vn2000ToWgs84(x, y); lng = w.lng; lat = w.lat;
    } else {
      lat = parseFloat(c1); lng = parseFloat(c2);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return alert('Nhập Vĩ độ (lat), Kinh độ (lng).');
    }
    setFocusPoint({ lng, lat, label: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
    setTool('none');
  }
  async function deleteLayer(slug: string, name: string) {
    if (!window.confirm(`Xoá lớp "${name}"?`)) return;
    try { await api(`/layers/${slug}`, { method: 'DELETE' }); setData((d) => { const n = { ...d }; delete n[slug]; return n; }); load(); }
    catch (e: any) { alert(/Admin|401|403/i.test(String(e.message)) ? 'Cần đăng nhập Quản trị để xoá.' : 'Lỗi: ' + e.message); }
  }
  const mBtn = (m: MeasureMode, label: string) => (
    <button onClick={() => { setMeasure(measure === m ? 'off' : m); setMResult(null); }}
      className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap ${measure === m ? 'bg-orange-600 text-white border-orange-600' : 'bg-white border-slate-300 text-slate-700'}`}>{label}</button>
  );

  // ---- Nhóm điều khiển dùng chung cho desktop (inline) và mobile (bảng mở rộng) ----
  const baseMapCtrl = (full = false) => (
    <div className={`flex rounded-lg border border-slate-300 overflow-hidden ${full ? 'w-full' : ''}`}>
      {([['street', 'Đường'], ['satellite', 'Vệ tinh'], ['terrain', 'Địa hình']] as [BaseMap, string][]).map(([b, l]) => (
        <button key={b} onClick={() => setBaseMap(b)} className={`${full ? 'flex-1' : ''} px-3 py-1.5 text-xs font-semibold ${baseMap === b ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{l}</button>
      ))}
    </div>
  );
  const labelsCtrl = () => (
    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer whitespace-nowrap">
      <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} className="accent-emerald-600 w-4 h-4" />Nhãn & đường
    </label>
  );
  const searchCtrl = (full = false) => (
    <div className={`flex items-center gap-1.5 ${full ? 'flex-wrap' : ''}`}>
      <select value={searchMode} onChange={(e) => setSearchMode(e.target.value as any)} className={`border rounded-lg px-2 py-1.5 text-xs bg-white ${full ? 'w-full' : ''}`}>
        <option value="parcel">Số tờ / thửa</option>
        <option value="vn2000">Toạ độ VN-2000</option>
        <option value="latlng">Lat / Lng (WGS-84)</option>
        <option value="gmap">Link Google Maps</option>
      </select>
      {searchMode === 'gmap' ? (
        <input value={c1} onChange={(e) => setC1(e.target.value)} placeholder="Dán link Google Maps (…/@12.34,109.12…)" className={`border rounded-lg px-2.5 py-1.5 text-xs ${full ? 'w-full' : 'w-56'}`} />
      ) : (
        <>
          <input value={c1} onChange={(e) => setC1(e.target.value)} placeholder={searchMode === 'vn2000' ? 'X (Đông)' : searchMode === 'parcel' ? 'Số tờ' : 'Vĩ độ'} className={`border rounded-lg px-2.5 py-1.5 text-xs ${full ? 'flex-1 min-w-[90px]' : 'w-24'}`} />
          <input value={c2} onChange={(e) => setC2(e.target.value)} placeholder={searchMode === 'vn2000' ? 'Y (Bắc)' : searchMode === 'parcel' ? 'Số thửa' : 'Kinh độ'} className={`border rounded-lg px-2.5 py-1.5 text-xs ${full ? 'flex-1 min-w-[90px]' : 'w-24'}`} />
          {searchMode === 'parcel' && <input value={c3} onChange={(e) => setC3(e.target.value)} placeholder="Xã (vd: Cam Lâm)" className={`border rounded-lg px-2.5 py-1.5 text-xs ${full ? 'flex-1 min-w-[120px]' : 'w-32'}`} />}
        </>
      )}
      <button onClick={doSearch} className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${full ? 'w-full mt-1' : ''}`}>Tra cứu</button>
    </div>
  );
  const measureCtrl = () => (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-slate-400">Đo:</span>
      {mBtn('distance', '📏 Dài')}{mBtn('area', '⬛ Diện tích')}
      {measure !== 'off' && <button onClick={() => { setMeasure('off'); setMResult(null); }} className="px-2 py-1 rounded text-xs border border-slate-300 whitespace-nowrap">Xong</button>}
      {mResult && mResult.points > 0 && (
        <span className="text-xs font-bold text-orange-700 ml-1 whitespace-nowrap">{mResult.mode === 'distance' ? `Dài: ${fmtLen(mResult.distance)}` : `S: ${fmtArea(mResult.area)}`}</span>
      )}
      {measure !== 'off' && <span className="text-[11px] text-slate-400 w-full">Nhấp lần lượt các điểm trên bản đồ…</span>}
    </div>
  );
  const tabBtn = (key: string, icon: string, label: string, active: boolean, dot = false) => (
    <button onClick={key === 'layers' ? () => { setPanelOpen(true); setTool('none'); } : () => setTool(tool === key ? 'none' : (key as any))}
      className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${active ? 'bg-slate-100 text-[#0A2540]' : 'text-slate-600 hover:bg-slate-50'}`}>
      <span className="text-base leading-none">{icon}</span>{label}
      {dot && <span className="absolute top-1.5 right-[calc(50%-14px)] w-1.5 h-1.5 rounded-full bg-orange-500" />}
    </button>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      {/* Toolbar tra cứu quy hoạch — dính cố định; desktop đầy đủ, mobile gọn theo nhóm */}
      <div className="bg-white border-b border-slate-200 shrink-0 z-20">
        {/* MÁY TÍNH (lg+): một hàng đầy đủ, tự xuống dòng khi hẹp */}
        <div className="hidden lg:flex items-center gap-x-4 gap-y-2 px-3 py-2 flex-wrap">
          {baseMapCtrl()}
          {labelsCtrl()}
          <span className="h-5 w-px bg-slate-200" />
          {searchCtrl()}
          <span className="h-5 w-px bg-slate-200" />
          {measureCtrl()}
        </div>

        {/* ĐIỆN THOẠI / iPad dọc (<lg): 4 nút gọn, bấm để mở từng nhóm */}
        <div className="lg:hidden grid grid-cols-4 divide-x divide-slate-200">
          {tabBtn('layers', '☰', 'Lớp', false)}
          {tabBtn('search', '🔍', 'Tra cứu', tool === 'search')}
          {tabBtn('base', '🗺️', 'Bản đồ', tool === 'base', baseMap !== 'street')}
          {tabBtn('measure', '📏', 'Đo', tool === 'measure', measure !== 'off')}
        </div>
        {tool !== 'none' && (
          <div className="lg:hidden border-t border-slate-100 bg-slate-50 px-3 py-3">
            {tool === 'search' && (<><p className="text-[11px] font-semibold text-slate-500 mb-1.5">Tra cứu theo toạ độ / số thửa</p>{searchCtrl(true)}</>)}
            {tool === 'base' && (<div className="space-y-2.5"><p className="text-[11px] font-semibold text-slate-500">Bản đồ nền</p>{baseMapCtrl(true)}{labelsCtrl()}</div>)}
            {tool === 'measure' && (<><p className="text-[11px] font-semibold text-slate-500 mb-1.5">Đo khoảng cách / diện tích</p>{measureCtrl()}</>)}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 relative">
        {panelOpen && <div className="lg:hidden absolute inset-0 bg-black/30 z-20" onClick={() => setPanelOpen(false)} />}

        <aside className={`${panelOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200 absolute lg:static inset-y-0 left-0 z-30 w-72 max-w-[82%] shrink-0 bg-white border-r border-slate-200 overflow-y-auto scroll-soft p-4 shadow-xl lg:shadow-none`}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold">Lớp bản đồ GIS</h2>
            <button onClick={() => setPanelOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
          </div>
          <p className="text-xs text-slate-500 mb-3">Cam Lâm, Khánh Hòa · EPSG:4326</p>
          <div className="mb-3 pb-3 border-b">
            <div className="flex justify-between text-xs text-slate-500 mb-1"><span>Độ mờ lớp phủ</span><span>{Math.round(opacity * 100)}%</span></div>
            <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="w-full accent-emerald-600" />
          </div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Ảnh quy hoạch (overlay)</p>
          {RASTER_OVERLAYS.map((o) => (
            <label key={o.id} className="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
              <input type="checkbox" checked={ovOn[o.id] ?? true} onChange={(e) => setOvOn((v) => ({ ...v, [o.id]: e.target.checked }))} />
              <span className="inline-block w-3 h-3 rounded-sm shrink-0 bg-amber-500" /><span className="flex-1">🛰️ {o.name}</span>
            </label>
          ))}
          <p className="text-xs font-semibold text-slate-500 mt-3 mb-1 pt-2 border-t">Lớp vector (bật/tắt)</p>
          {layers.length === 0 && <p className="text-sm text-slate-500">Đang tải…</p>}
          {layers.map((l) => (
            <div key={l.slug} className="flex items-center gap-2 py-1.5 text-sm">
              <input type="checkbox" checked={visible[l.slug] ?? false} onChange={(e) => setVisible((v) => ({ ...v, [l.slug]: e.target.checked }))} />
              <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: (l.style?.color as string) || DEFAULT_COLORS[l.layerType] }} />
              <span className="flex-1 truncate" title={l.name}>{l.name}</span>
              <span className="text-xs text-slate-400">{l.featureCount}</span>
              {canDelete && <button onClick={() => deleteLayer(l.slug, l.name)} title="Xoá lớp" className="text-slate-300 hover:text-red-600">🗑</button>}
            </div>
          ))}
          <p className="text-xs text-slate-400 mt-4">💡 Nhấp vào bản đồ để xem toạ độ + tra cứu thửa/quy hoạch.</p>
        </aside>

        <div className="relative flex-1">
          <MapView layers={geoLayers} overlays={overlays} baseMap={baseMap} labels={labels} measureMode={measure}
            focusPoint={focusPoint} highlight={highlight} onMapClick={onMapClick} onMeasure={setMResult} initialBounds={QH_BOUNDS} adMarkers={ads} />
          {/* Thanh ĐỘ MỜ lớp phủ dạng DỌC nổi trên bản đồ — chỉ hiện trên điện thoại/iPad (bảng trái bị ẩn) */}
          {(ovOn['qh-qd205'] ?? true) && (
            <div className="lg:hidden absolute top-1/2 right-2 -translate-y-1/2 z-10 flex flex-col items-center gap-1 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-lg px-2 py-3">
              <span className="text-[10px] font-bold text-slate-500">Đậm</span>
              <div className="relative h-36 w-7">
                <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                  className="absolute left-1/2 top-1/2 w-36 -translate-x-1/2 -translate-y-1/2 -rotate-90 accent-emerald-600 cursor-pointer" aria-label="Độ mờ lớp phủ" />
              </div>
              <span className="text-[10px] font-bold text-slate-500">Mờ</span>
              <span className="text-[11px] text-[#0A2540] font-extrabold mt-0.5">{Math.round(opacity * 100)}%</span>
            </div>
          )}
          {info && (
            <div className="absolute top-3 right-3 left-3 sm:left-auto sm:w-80 max-h-[80%] overflow-y-auto bg-white rounded-xl shadow-xl border p-4 text-sm z-10">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">Thông tin tại điểm</h3>
                <button onClick={() => setInfo(null)} className="text-slate-400 hover:text-slate-700">✕</button>
              </div>
              {clickVN && (
                <div className="mb-2 text-xs bg-slate-50 rounded p-2">
                  <div>VN-2000: <b>X={clickVN.x.toFixed(2)}</b>, <b>Y={clickVN.y.toFixed(2)}</b></div>
                  <div>WGS84: {clickVN.lat.toFixed(6)}, {clickVN.lng.toFixed(6)}</div>
                </div>
              )}
              {!info.found && <p className="text-slate-500">Không có dữ liệu thửa/quy hoạch tại vị trí này.</p>}
              {info.parcel && <Section title="Thửa đất">{Object.entries(info.parcel.properties).map(([k, v]) => <Row key={k} k={k} v={String(v)} />)}</Section>}
              {info.zoning && <Section title="Quy hoạch">{Object.entries(info.zoning).map(([k, v]) => <Row key={k} k={k} v={String(v)} />)}</Section>}
              <Section title={`Tin rao liên quan (${info.listings.length})`}>
                {info.listings.length === 0 && <p className="text-slate-500">Chưa có tin nào.</p>}
                {info.listings.map((x) => <a key={x.id} href={`/listings/${x.id}`} className="block text-emerald-700 hover:underline">• {x.title} — {formatVnd(x.price)}</a>)}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-3"><p className="font-semibold text-slate-700 border-b pb-1 mb-1">{title}</p>{children}</div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2 py-0.5"><span className="text-slate-500">{k}</span><span className="text-right font-medium">{v}</span></div>;
}
