'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, ocrImage } from '@/lib/api';
import type { GeoLayer, ImageOverlay, BaseMap, MeasureMode, MeasureResult } from '@/components/MapView';
import { GisLayer, formatVnd } from '@/lib/types';
import { vn2000ToWgs84, wgs84ToVn2000 } from '@/lib/vn2000';
import { getToken } from '@/lib/token';
import { useAuth } from '@/lib/auth';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="h-full w-full grid place-items-center bg-slate-100 text-slate-400 text-sm animate-pulse">Đang tải bản đồ…</div> });

const DEFAULT_COLORS: Record<string, string> = {
  parcel: '#1e88e5', zoning: '#fb8c00', admin: '#7e57c2', road: '#455a64', custom: '#16a34a',
};
const RASTER_OVERLAYS = [
  { id: 'qh-qd205', name: 'Ảnh quy hoạch QĐ205', url: '/overlays/QD205.png',
    pmtiles: 'pmtiles:///qhtiles', minzoom: 10, maxzoom: 18, fillMaxzoom: 14,
    coordinates: [[108.9401268, 12.217594], [109.2563886, 12.217594], [109.2563886, 11.9257021], [108.9401268, 11.9257021]] as [[number, number], [number, number], [number, number], [number, number]] },
];
const QH_BOUNDS: [[number, number], [number, number]] = [[108.9401268, 11.9257021], [109.2563886, 12.217594]];
const PARCEL_MIN_ZOOM = 14; // thửa đất chỉ tải khi đủ gần
const ZONING_MIN_ZOOM = 14; // lớp quy hoạch (vector) chỉ tải khi zoom gần — ở xa dùng ẢNH quy hoạch cho nhẹ

interface ParcelInfo {
  found: boolean; point: { lng: number; lat: number };
  parcel: { properties: Record<string, any>; soTo?: string | null; soThua?: string | null; xa?: string | null; areaM2?: number } | null;
  zoning: Record<string, any> | null;
  overlaps?: { layer: string; type: string; areaM2: number }[];
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
const openDir = (lat: number, lng: number) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank', 'noopener');
function parseNum(tok: string): number {
  let t = tok.replace(/,/g, '.');
  const parts = t.split('.');
  if (parts.length > 2) t = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  return parseFloat(t);
}
// Đọc bảng toạ độ VN-2000 (mỗi dòng 1 điểm), tự nhận biết Y(Đông ~5-6 chữ số) và X(Bắc >900k).
function parseVnTable(text: string): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (const line of text.split(/[\n;]/)) {
    const big = (line.match(/-?[\d.,]+/g) || []).map(parseNum).filter((n) => Number.isFinite(n) && n > 90000);
    if (big.length >= 2) {
      const a2 = big[big.length - 2], b2 = big[big.length - 1];
      const E = a2 > 900000 ? b2 : a2, N = a2 > 900000 ? a2 : b2;
      if (E > 90000 && E < 900000 && N > 900000) pts.push({ x: E, y: N });
    }
  }
  return pts;
}
function polyAreaM2(pts: { x: number; y: number }[]): number {
  let s = 0; for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; s += pts[i].x * pts[j].y - pts[j].x * pts[i].y; } return Math.abs(s) / 2;
}
function perimeterM(pts: { x: number; y: number }[]): number {
  let p = 0; for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; p += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y); } return p;
}
let _tess: any = null;
function loadTesseract(): Promise<any> {
  if ((window as any).Tesseract) return Promise.resolve((window as any).Tesseract);
  if (_tess) return _tess;
  _tess = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    sc.onload = () => resolve((window as any).Tesseract);
    sc.onerror = () => reject(new Error('Không tải được bộ đọc ảnh (OCR).'));
    document.body.appendChild(sc);
  });
  return _tess;
}
let _worker: any = null;
async function getWorker(T: any): Promise<any> {
  if (_worker) return _worker;
  const w = await T.createWorker('eng');
  await w.setParameters({ tessedit_char_whitelist: '0123456789.,-: ', tessedit_pageseg_mode: '6' });
  _worker = w; return w;
}
async function runRecognize(src: HTMLCanvasElement | HTMLImageElement): Promise<string> {
  const T = await loadTesseract();
  try { const w = await getWorker(T); const out = await w.recognize(src); return String(out?.data?.text || ''); }
  catch { const out = await T.recognize(src, 'eng'); return String(out?.data?.text || ''); } // dự phòng API cũ
}
function preprocess(src: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const w0 = (src as HTMLImageElement).naturalWidth || (src as HTMLCanvasElement).width;
  const h0 = (src as HTMLImageElement).naturalHeight || (src as HTMLCanvasElement).height;
  const scl = Math.max(1, Math.min(3, 2200 / Math.max(w0, h0)));
  const w = Math.max(1, Math.round(w0 * scl)), h = Math.max(1, Math.round(h0 * scl));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true } as any)!;
  (ctx as any).imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h), d = im.data, n = w * h;
  const g = new Float64Array(n);
  for (let p = 0; p < n; p++) { const k = p * 4; g[p] = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; }
  const integ = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let rs = 0; for (let x = 0; x < w; x++) { rs += g[y * w + x]; integ[(y + 1) * (w + 1) + (x + 1)] = integ[y * (w + 1) + (x + 1)] + rs; } }
  const half = Math.max(8, Math.floor(w / 28)), th = 0.15;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x1 = Math.max(0, x - half), x2 = Math.min(w - 1, x + half), y1 = Math.max(0, y - half), y2 = Math.min(h - 1, y + half);
    const cnt = (x2 - x1 + 1) * (y2 - y1 + 1);
    const sum = integ[(y2 + 1) * (w + 1) + (x2 + 1)] - integ[y1 * (w + 1) + (x2 + 1)] - integ[(y2 + 1) * (w + 1) + x1] + integ[y1 * (w + 1) + x1];
    const v = (g[y * w + x] * cnt <= sum * (1 - th)) ? 0 : 255;
    const k = (y * w + x) * 4; d[k] = d[k + 1] = d[k + 2] = v;
  }
  ctx.putImageData(im, 0, 0);
  return cv;
}
function normalizeDigits(t: string): string {
  return t.replace(/[OoQ]/g, '0').replace(/[Il|]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8').replace(/[Zz]/g, '2').replace(/g/g, '9');
}
function toBlob(src: HTMLImageElement | HTMLCanvasElement): Promise<Blob> {
  const w0 = src instanceof HTMLCanvasElement ? src.width : ((src as HTMLImageElement).naturalWidth || 1);
  const h0 = src instanceof HTMLCanvasElement ? src.height : ((src as HTMLImageElement).naturalHeight || 1);
  const sc = Math.min(3, 2400 / Math.max(w0, h0));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w0 * sc)); cv.height = Math.max(1, Math.round(h0 * sc));
  cv.getContext('2d')!.drawImage(src, 0, 0, cv.width, cv.height);
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png'));
}
async function ocrToPoints(img: HTMLImageElement | HTMLCanvasElement): Promise<{ pts: { x: number; y: number }[]; msg: string }> {
  let status = '';
  let best: { x: number; y: number }[] = [];
  const keep = (pts: { x: number; y: number }[]) => { if (pts.length > best.length) best = pts; };
  const pre = preprocess(img); // nhị phân hoá + phóng to + tương phản — dễ đọc hơn NHIỀU so với ảnh màu thô
  // 1) Server OCR — GỬI ẢNH ĐÃ NHỊ PHÂN HOÁ (trước đây gửi ảnh màu thô nên đọc sai)
  try {
    keep(parseBigPairs(await ocrImage(await toBlob(pre))));
    if (best.length < 3) keep(parseBigPairs(await ocrImage(await toBlob(img))));
  } catch (e: any) {
    status = '⛔ SERVER OCR CHƯA CHẠY:\n' + String(e?.message || e) + '\n\n→ Backend camlam-api cần cài Tesseract. Đang tạm dùng OCR trình duyệt.';
  }
  // 2) OCR trình duyệt (whitelist chỉ số) — bổ sung khi server thiếu/không chạy
  if (best.length < 3) {
    try { keep(parseBigPairs(await runRecognize(pre))); } catch {}
    if (best.length < 3) { try { keep(parseBigPairs(await runRecognize(img))); } catch {} }
  }
  if (best.length >= 3) return { pts: best, msg: '' };
  return { pts: best, msg: status || ('Chỉ đọc được ' + best.length + ' điểm — chưa đủ.\nHãy chụp GẦN, THẲNG, đủ sáng, chỉ lấy phần bảng số; hoặc nhập tay ở tab "Nhập bảng".') };
}
function showOcrResult(r: { pts: { x: number; y: number }[]; msg: string }, apply: (pts: { x: number; y: number }[]) => void) {
  if (r.pts.length) { apply(r.pts); return; }
  alert('Chưa tách được toạ độ.\n\n' + r.msg);
}
// VN-2000 Khánh Hòa: Đông (E) ~6 chữ số nguyên [380k–720k]; Bắc (N) ~7 chữ số (thường bắt đầu bằng 1) [1.20M–1.48M].
const E_MIN = 380000, E_MAX = 720000, N_MIN = 1200000, N_MAX = 1480000;
// Dựng lại 1 số toạ độ từ CHUỖI CHỈ CÒN SỐ theo SỐ CHỮ SỐ phần nguyên → tự đặt lại dấu thập phân (bất kể OCR có bắt được dấu chấm/phẩy hay không) + kiểm tra biên vùng để loại số rác.
function reconstructCoord(run: string): { v: number; kind: 'E' | 'N' } | null {
  const s = String(run).replace(/\D/g, '');
  if (s.length < 6) return null;
  if (s.length >= 7) { const n = parseFloat(s.slice(0, 7) + (s.length > 7 ? '.' + s.slice(7) : '')); if (n >= N_MIN && n <= N_MAX) return { v: n, kind: 'N' }; }
  const e = parseFloat(s.slice(0, 6) + (s.length > 6 ? '.' + s.slice(6) : ''));
  if (e >= E_MIN && e <= E_MAX) return { v: e, kind: 'E' };
  return null;
}
// Đọc bảng toạ độ: ưu tiên THEO DÒNG (mỗi dòng 1 điểm = 1 Đông + 1 Bắc, bỏ STT/nhiễu); nếu mất cấu trúc dòng thì ghép phẳng cặp E–N.
function parseBigPairs(text: string): { x: number; y: number }[] {
  const t = normalizeDigits(text);
  const RUN = /\d[\d.,]*\d|\d/g;
  const byLine: { x: number; y: number }[] = [];
  for (const line of t.split(/[\n\r;]+/)) {
    let E: number | null = null, N: number | null = null;
    for (const run of (line.match(RUN) || [])) { const r = reconstructCoord(run); if (!r) continue; if (r.kind === 'E' && E == null) E = r.v; else if (r.kind === 'N' && N == null) N = r.v; }
    if (E != null && N != null) byLine.push({ x: N, y: E }); // x=Bắc, y=Đông (đúng sổ)
  }
  if (byLine.length >= 3) return byLine;
  const items: { v: number; kind: 'E' | 'N' }[] = [];
  for (const run of (t.match(RUN) || [])) { const r = reconstructCoord(run); if (r) items.push(r); }
  const flat: { x: number; y: number }[] = [];
  for (let i = 0; i < items.length - 1; i++) { const a = items[i], b = items[i + 1]; if (a.kind === b.kind) continue; const E = a.kind === 'E' ? a.v : b.v, N = a.kind === 'N' ? a.v : b.v; flat.push({ x: N, y: E }); i++; }
  return flat.length > byLine.length ? flat : byLine;
}

// Điểm có nằm trong vòng đa giác không (ray casting) — để click ra loại đất QH vector ngay ở trình duyệt.
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

export default function MapPage() {
  const { user } = useAuth();
  const [layers, setLayers] = useState<GisLayer[]>([]);
  const [data, setData] = useState<Record<string, GeoJSON.FeatureCollection>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [zoomNow, setZoomNow] = useState(0);
  const layersRef = useRef<GisLayer[]>([]); layersRef.current = layers;
  const visibleRef = useRef<Record<string, boolean>>({}); visibleRef.current = visible;
  const viewRef = useRef<{ west: number; south: number; east: number; north: number; zoom: number } | null>(null);
  const featTimer = useRef<any>(null);
  const [info, setInfo] = useState<ParcelInfo | null>(null);
  const [clickVN, setClickVN] = useState<{ x: number; y: number; lng: number; lat: number } | null>(null);
  const [opacity, setOpacity] = useState(1);
  const [canDelete, setCanDelete] = useState(false);
  const [ovOn, setOvOn] = useState<Record<string, boolean>>({ 'qh-qd205': true });
  const [baseMap, setBaseMap] = useState<BaseMap>('satellite');
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
  const [qhVector, setQhVector] = useState<GeoJSON.FeatureCollection | null>(null);
  const qhVectorRef = useRef<GeoJSON.FeatureCollection | null>(null); qhVectorRef.current = qhVector;
  const [qhvHit, setQhvHit] = useState<{ lo: string; hz: string }[]>([]);
  const [fitTo, setFitTo] = useState<[[number, number], [number, number]] | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawTab, setDrawTab] = useState<'table' | 'import'>('table');
  const [rows, setRows] = useState<{ x: string; y: string }[]>([{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }]);
  const [camOpen, setCamOpen] = useState(false);
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const [ocrBusy, setOcrBusy] = useState('');
  const [ocrOk, setOcrOk] = useState(0);
  const [drawResult, setDrawResult] = useState<{ n: number; area: number; perim: number; lat: number; lng: number } | null>(null);
  const [tool, setTool] = useState<'none' | 'search' | 'base' | 'measure'>('none'); // bảng công cụ trên mobile

  const refreshFeatures = useCallback((v: { west: number; south: number; east: number; north: number; zoom: number }) => {
    const bbox = `${v.west},${v.south},${v.east},${v.north}`;
    for (const l of layersRef.current) {
      const vis = visibleRef.current[l.slug] ?? (l.layerType === 'parcel');
      if (!vis) continue;
      const minZ = l.layerType === 'parcel' ? PARCEL_MIN_ZOOM : (l.layerType === 'zoning' ? ZONING_MIN_ZOOM : 0);
      if (minZ && v.zoom < minZ) { setData((d) => ({ ...d, [l.slug]: { type: 'FeatureCollection', features: [] } })); continue; }
      api<GeoJSON.FeatureCollection>(`/layers/${l.slug}/features?bbox=${bbox}&z=${Math.round(v.zoom)}`).then((fc) => setData((d) => ({ ...d, [l.slug]: fc }))).catch(() => {});
    }
  }, []);
  const onViewport = useCallback((v: { west: number; south: number; east: number; north: number; zoom: number }) => {
    viewRef.current = v; setZoomNow(v.zoom);
    clearTimeout(featTimer.current); featTimer.current = setTimeout(() => refreshFeatures(v), 350);
  }, [refreshFeatures]);
  const load = useCallback(() => {
    api<{ layers: GisLayer[] }>('/layers').then(({ layers }) => {
      setLayers(layers);
      setVisible((prev) => Object.fromEntries(layers.map((l) => [l.slug, prev[l.slug] ?? (l.layerType === 'parcel')])));
      if (viewRef.current) refreshFeatures(viewRef.current);
    }).catch(() => {});
  }, [refreshFeatures]);
  useEffect(() => { load(); api<any>('/map-ads/active').then((r) => setAds(r.ads || [])).catch(() => {}); }, [load]);
  useEffect(() => { fetch('/qh_vector.geojson').then((r) => r.json()).then(setQhVector).catch(() => {}); }, []);
  useEffect(() => { if (viewRef.current) refreshFeatures(viewRef.current); }, [visible, refreshFeatures]);
  useEffect(() => { setCanDelete(user?.role === 'admin' || user?.role === 'gis'); }, [user]);
  useEffect(() => { if (!camOpen) return; const v = camVideoRef.current, st = camStreamRef.current; if (!v || !st) return; v.srcObject = st; v.setAttribute('playsinline', 'true'); v.play().catch(() => {}); }, [camOpen]);
  // Giải phóng camera khi rời trang (tránh giữ camera chạy ngầm trên điện thoại).
  useEffect(() => () => { camStreamRef.current?.getTracks().forEach((t) => t.stop()); camStreamRef.current = null; }, []);

  const overlays: ImageOverlay[] = useMemo(
    () => RASTER_OVERLAYS.map((o) => ({ id: o.id, url: o.url, coordinates: o.coordinates, opacity, visible: ovOn[o.id] ?? true, pmtiles: (o as any).pmtiles, fillMaxzoom: (o as any).fillMaxzoom, tiles: (o as any).tiles, minzoom: (o as any).minzoom, maxzoom: (o as any).maxzoom })), [opacity, ovOn]);

  const geoLayers: GeoLayer[] = useMemo(() => {
    const out: GeoLayer[] = [];
    for (const l of layers) {
      const fc = data[l.slug]; if (!fc) continue;
      const base = (l.style?.color as string) || DEFAULT_COLORS[l.layerType] || '#16a34a';
      const colorExpr: any = ['coalesce', ['get', 'color'], base];
      const gtype = (l.geometryType || '').toLowerCase();
      const vis = visible[l.slug] ?? (l.layerType === 'parcel');
      if (gtype.includes('line')) out.push({ id: `${l.slug}-line`, type: 'line', data: fc, visible: vis, paint: { 'line-color': colorExpr, 'line-width': (l.style?.weight as number) ?? 2.5 } });
      else if (gtype.includes('point')) out.push({ id: `${l.slug}-pt`, type: 'circle', data: fc, visible: vis, paint: { 'circle-color': colorExpr, 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } });
      else if (l.layerType === 'parcel') {
        out.push({ id: `${l.slug}-line`, type: 'line', data: fc, visible: vis, paint: { 'line-color': colorExpr, 'line-width': (l.style?.weight as number) ?? 0.9 } });
        out.push({ id: `${l.slug}-label`, type: 'symbol', data: fc, visible: vis, paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }, layout: { 'text-field': ['coalesce', ['get', 'SoThua'], ['get', 'so_thua'], ['get', 'SOTHUA'], ['get', 'sothua'], ['get', 'thua'], ['get', 'THUA'], ['get', 'SHThua'], ['get', 'ThuaDat'], ''], 'text-size': 11, 'text-font': ['Noto Sans Regular'], 'symbol-placement': 'point', 'text-allow-overlap': false } });
      }
      else {
        // Lớp quy hoạch CHỈ VẼ VIỀN (không tô nền) -> rất nhẹ, hết lag. Màu nền do ảnh quy hoạch gốc (overlay) lo.
        // Click vào thửa vẫn ra diện tích dính từng loại QH vì việc đó server tính (không phụ thuộc lớp này có vẽ hay không).
        out.push({ id: `${l.slug}-line`, type: 'line', data: fc, visible: vis, paint: { 'line-color': colorExpr, 'line-width': (l.style?.weight as number) ?? 0.8, 'line-opacity': 0.85 } });
      }
    }
    return out;
  }, [layers, data, visible, opacity]);

  async function onMapClick(lng: number, lat: number) {
    const vn = wgs84ToVn2000(lng, lat);
    setClickVN({ x: vn.y, y: vn.x, lng, lat }); // sổ: X=Bắc(Northing), Y=Đông(Easting)
    // Loại đất quy hoạch (vector) tại điểm — tính ngay ở trình duyệt, không cần server.
    const gv = qhVectorRef.current;
    if (gv) {
      const hits: { lo: string; hz: string; area: number }[] = [];
      for (const ft of gv.features as any[]) {
        const ring = ft.geometry?.coordinates?.[0]; if (!ring) continue;
        if (pointInRing(lng, lat, ring)) {
          let sArea = 0; for (let i = 0; i < ring.length - 1; i++) sArea += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
          hits.push({ lo: ft.properties.lo, hz: ft.properties.hz, area: Math.abs(sArea) });
        }
      }
      hits.sort((x, y) => x.area - y.area); // vùng nhỏ (cụ thể) hiện trước
      const seen = new Set<string>(); const uniq: { lo: string; hz: string }[] = [];
      for (const h of hits) { const k = h.lo + h.hz; if (!seen.has(k)) { seen.add(k); uniq.push({ lo: h.lo, hz: h.hz }); } }
      setQhvHit(uniq.slice(0, 4));
    } else setQhvHit([]);
    try { setInfo(await api<ParcelInfo>(`/parcels/at?lng=${lng}&lat=${lat}`)); }
    catch { setInfo({ found: false, point: { lng, lat }, parcel: null, zoning: null, listings: [] }); }
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
      const a = parseFloat(c1), b = parseFloat(c2);
      if (Number.isNaN(a) || Number.isNaN(b)) return alert('Nhập X (Bắc), Y (Đông) hệ VN-2000.');
      const E = a < 900000 ? a : b, N = a < 900000 ? b : a; // sổ: X=Bắc(>900k), Y=Đông(<900k) — tự nhận, không lo nhầm X/Y
      const w = vn2000ToWgs84(E, N); lng = w.lng; lat = w.lat;
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
  function pointsFromRows(): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    for (const r of rows) {
      const a = parseNum(r.x), b = parseNum(r.y);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const E = a < 900000 ? a : b, N = a < 900000 ? b : a;
      if (E > 90000 && E < 900000 && N > 900000) pts.push({ x: E, y: N });
    }
    return pts;
  }
  function applyParsed(parsed: { x: number; y: number }[]) {
    if (!parsed.length) return alert('Chưa nhận được toạ độ từ ảnh. Hãy chụp GẦN, THẲNG, đủ sáng — chỉ lấy phần bảng số. Hoặc nhập tay ở tab "Nhập bảng".');
    setRows(parsed.map((p) => ({ x: String(p.x), y: String(p.y) })));
    setOcrOk(parsed.length);
    setDrawTab('table');
  }
  function loadImage(f: File): Promise<HTMLImageElement> {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(f); });
  }
  async function onCoordFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setOcrBusy('Đang đọc…');
    try {
      if (f.type.startsWith('image/')) {
        const img = await loadImage(f);
        setOcrBusy('Đang nhận dạng chữ trong ảnh…');
        showOcrResult(await ocrToPoints(img), applyParsed);
      } else { applyParsed(parseBigPairs(await f.text())); }
    } catch (er: any) { alert('Không đọc được tệp: ' + (er?.message || er)); }
    finally { setOcrBusy(''); }
  }
  async function startCam() {
    try { const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } } }); try { await st.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any }); } catch {} camStreamRef.current = st; setCamOpen(true); }
    catch (e: any) { alert('Không mở được camera: ' + (e?.message || e)); }
  }
  function stopCam() { camStreamRef.current?.getTracks().forEach((t) => t.stop()); camStreamRef.current = null; setCamOpen(false); }
  async function capture() {
    const v = camVideoRef.current; if (!v || !v.videoWidth) return;
    const vw = v.videoWidth, vh = v.videoHeight, cw = Math.round(vw * 0.92), ch = Math.round(vh * 0.66);
    const cap = document.createElement('canvas'); cap.width = cw; cap.height = ch;
    cap.getContext('2d')!.drawImage(v, Math.round((vw - cw) / 2), Math.round((vh - ch) / 2), cw, ch, 0, 0, cw, ch);
    stopCam(); setOcrBusy('Đang nhận dạng chữ trong ảnh…');
    try { showOcrResult(await ocrToPoints(cap), applyParsed); }
    catch (e: any) { alert('Không đọc được: ' + (e?.message || e)); }
    finally { setOcrBusy(''); }
  }
  function drawParcel() {
    const pts = pointsFromRows();
    if (pts.length < 3) return alert('Cần ít nhất 3 điểm hợp lệ (X Đông ~5-6 chữ số, Y Bắc ~7 chữ số).');
    const ll = pts.map((p) => { const w = vn2000ToWgs84(p.x, p.y); return [w.lng, w.lat]; });
    const ring = [...ll, ll[0]];
    setHighlight({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } } as any);
    const lngs = ll.map((c) => c[0]), lats = ll.map((c) => c[1]);
    setFitTo([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]);
    setDrawResult({ n: pts.length, area: polyAreaM2(pts), perim: perimeterM(pts), lat: ll[0][1], lng: ll[0][0] });
    setClickVN(null); setInfo(null); setFocusPoint(null); setDrawOpen(false);
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
          <input value={c1} onChange={(e) => setC1(e.target.value)} placeholder={searchMode === 'vn2000' ? 'X (Bắc)' : searchMode === 'parcel' ? 'Số tờ' : 'Vĩ độ'} className={`border rounded-lg px-2.5 py-1.5 text-xs ${full ? 'flex-1 min-w-[90px]' : 'w-24'}`} />
          <input value={c2} onChange={(e) => setC2(e.target.value)} placeholder={searchMode === 'vn2000' ? 'Y (Đông)' : searchMode === 'parcel' ? 'Số thửa' : 'Kinh độ'} className={`border rounded-lg px-2.5 py-1.5 text-xs ${full ? 'flex-1 min-w-[90px]' : 'w-24'}`} />
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
            <h2 className="font-bold">Lớp bản đồ</h2>
            <button onClick={() => setPanelOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
          </div>
          <p className="text-xs text-slate-500 mb-3">Cam Lâm, Khánh Hòa · EPSG:4326</p>
          <button onClick={() => setDrawOpen(true)} className="w-full mb-3 flex items-center justify-center gap-2 bg-[#0A2540] hover:bg-[#0d2f54] text-white text-sm font-bold py-2.5 rounded-lg">✏️ Vẽ thửa từ toạ độ</button>
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
              <input type="checkbox" checked={visible[l.slug] ?? (l.layerType === 'parcel')} onChange={(e) => setVisible((v) => ({ ...v, [l.slug]: e.target.checked }))} />
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
            focusPoint={focusPoint} highlight={highlight} onMapClick={onMapClick} onMeasure={setMResult} onViewport={onViewport} initialBounds={QH_BOUNDS} adMarkers={ads} adOpacity={1} fitTo={fitTo} />
          {zoomNow > 0 && zoomNow < ZONING_MIN_ZOOM && layers.some((l) => (l.layerType === 'parcel') && (visible[l.slug] ?? true)) && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-[#0A2540]/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow">🔍 Đang dùng ảnh quy hoạch · phóng to để hiện ranh + click thửa</div>
          )}
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
          {focusPoint && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white rounded-full shadow-lg border border-slate-200 pl-4 pr-2 py-1.5 max-w-[92%]">
              <span className="text-sm font-semibold text-[#0A2540] truncate max-w-[42vw]">📍 {focusPoint.label || 'Vị trí tìm kiếm'}</span>
              <button onClick={() => openDir(focusPoint.lat, focusPoint.lng)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full px-3.5 py-1.5 whitespace-nowrap">🧭 Chỉ đường</button>
              <button onClick={() => setFocusPoint(null)} className="text-slate-400 hover:text-slate-700 w-7 h-7 grid place-items-center shrink-0">✕</button>
            </div>
          )}
          {drawResult && (
            <div className="absolute top-3 left-3 z-10 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-sm max-w-[250px]">
              <div className="flex justify-between items-center mb-1">
                <b className="text-[#0A2540]">📐 Thửa đất đã vẽ</b>
                <button onClick={() => { setDrawResult(null); setHighlight(null); }} className="text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <p className="text-slate-600">Số điểm: <b>{drawResult.n}</b></p>
              <p className="text-slate-600">Diện tích: <b className="text-emerald-700">{fmtArea(drawResult.area)}</b></p>
              <p className="text-slate-600">Chu vi: <b>{fmtLen(drawResult.perim)}</b></p>
              <button onClick={() => openDir(drawResult.lat, drawResult.lng)} className="mt-2 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg py-2">🧭 Chỉ đường tới thửa</button>
            </div>
          )}
          {drawOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setDrawOpen(false)} />
              <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto scroll-soft">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                  <h3 className="font-extrabold text-[#0A2540] text-lg">Vẽ ranh thửa từ toạ độ VN-2000</h3>
                  <button onClick={() => setDrawOpen(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
                </div>
                <div className="flex border-b border-slate-100 px-3">
                  {([['table', '⌗ Nhập bảng'], ['import', '📷 Chụp / Ảnh']] as [typeof drawTab, string][]).map(([k, lb]) => (
                    <button key={k} onClick={() => { setDrawTab(k); setOcrOk(0); }} className={`px-3 py-2.5 text-sm font-semibold border-b-2 ${drawTab === k ? 'border-red-600 text-[#0A2540]' : 'border-transparent text-slate-500'}`}>{lb}</button>
                  ))}
                </div>
                <div className="p-5 space-y-3">
                  {drawTab === 'table' && (
                    <div className="space-y-2">
                      {ocrOk > 0 && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg px-3 py-2">✅ Đã nhận {ocrOk} điểm từ ảnh. Kiểm tra lại số rồi bấm “Vẽ & zoom tới thửa”.</div>}
                      <div className="grid grid-cols-[26px_1fr_1fr_26px] gap-2 text-xs font-semibold text-slate-500 px-1"><span>#</span><span>X (Bắc)</span><span>Y (Đông)</span><span /></div>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto scroll-soft pr-1">
                        {rows.map((r, i2) => (
                          <div key={i2} className="grid grid-cols-[26px_1fr_1fr_26px] gap-2 items-center">
                            <span className="text-xs text-slate-400 text-center">{i2 + 1}</span>
                            <input value={r.x} onChange={(e) => setRows((rs) => rs.map((v, j2) => (j2 === i2 ? { ...v, x: e.target.value } : v)))} inputMode="decimal" className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" placeholder="596100.0" />
                            <input value={r.y} onChange={(e) => setRows((rs) => rs.map((v, j2) => (j2 === i2 ? { ...v, y: e.target.value } : v)))} inputMode="decimal" className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" placeholder="1334050.0" />
                            <button onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j2) => j2 !== i2) : rs))} className="text-slate-300 hover:text-red-600 text-center">✕</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setRows((rs) => [...rs, { x: '', y: '' }])} className="text-sm font-semibold text-[#0A2540]">+ Thêm điểm</button>
                        <button onClick={() => setRows([{ x: '596100.0', y: '1334050.0' }, { x: '596150.0', y: '1334035.0' }, { x: '596138.0', y: '1333985.0' }, { x: '596088.0', y: '1334000.0' }])} className="text-xs text-slate-400 underline">Điền ví dụ</button>
                      </div>
                    </div>
                  )}
                  {drawTab === 'import' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={startCam} className="flex flex-col items-center justify-center gap-1 border-2 border-[#0A2540] rounded-xl py-6 text-sm font-bold text-[#0A2540] hover:bg-slate-50"><span className="text-2xl">📷</span>Chụp bằng camera</button>
                        <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-300 rounded-xl py-6 cursor-pointer hover:border-[#C8A14B] text-sm font-bold text-slate-600 text-center">
                          <input type="file" accept="image/*,.txt,.csv" onChange={onCoordFile} className="hidden" /><span className="text-2xl">🖼️</span>Tải ảnh / tệp
                        </label>
                      </div>
                      {ocrBusy && <p className="text-sm text-[#0A2540] font-semibold text-center">{ocrBusy}</p>}
                      <p className="text-[11px] text-slate-400">Chụp/chọn ảnh bảng toạ độ rõ nét (hoặc tệp .txt/.csv). Hệ thống tự tách số → đưa vào tab &quot;Nhập bảng&quot; để bạn kiểm tra trước khi vẽ.</p>
                    </div>
                  )}
                </div>
                <div className="px-5 pb-5 pt-1 flex items-center gap-2 sticky bottom-0 bg-white">
                  <button onClick={drawParcel} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl">Vẽ & zoom tới thửa ({pointsFromRows().length} điểm)</button>
                  <button onClick={() => setRows([{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }])} className="px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-600">Xoá</button>
                </div>
              </div>
            </div>
          )}
          {camOpen && (
            <div className="fixed inset-0 z-[70] bg-black h-[100dvh] overflow-hidden">
              <video ref={camVideoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-emerald-400 rounded-lg" style={{ width: '92%', height: '66%', boxShadow: '0 0 0 100vmax rgba(0,0,0,0.5)' }} />
              </div>
              <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pb-4 text-white bg-gradient-to-b from-black/70 to-transparent" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
                <span className="font-semibold text-lg drop-shadow">Chụp bảng toạ độ</span>
                <button onClick={stopCam} aria-label="Đóng" className="w-10 h-10 rounded-full bg-white/15 backdrop-blur grid place-items-center text-2xl leading-none">✕</button>
              </div>
              <div className="absolute bottom-0 inset-x-0 px-6 pt-10 text-center bg-gradient-to-t from-black/80 via-black/40 to-transparent" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
                <p className="text-white/90 text-sm mb-3 drop-shadow">Đưa bảng toạ độ vừa khít trong khung — chụp thẳng, rõ nét.</p>
                <button onClick={capture} className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-10 py-3.5 rounded-full text-lg shadow-lg shadow-red-900/40 active:scale-95 transition">📷 Chụp</button>
              </div>
              {ocrBusy && <div className="absolute inset-0 bg-black/70 grid place-items-center text-white font-semibold text-center px-6">{ocrBusy}</div>}
            </div>
          )}
          {info && (
            <div className="absolute top-3 right-3 left-3 sm:left-auto sm:w-80 max-h-[80%] overflow-y-auto bg-white rounded-xl shadow-xl border p-4 text-sm z-10">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">Thông tin tại điểm</h3>
                <button onClick={() => setInfo(null)} className="text-slate-400 hover:text-slate-700">✕</button>
              </div>
              {info.point && (
                <button onClick={() => openDir(info.point!.lat, info.point!.lng)} className="mb-3 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg py-2">🧭 Chỉ đường tới đây</button>
              )}
              {clickVN && (
                <div className="mb-2 text-xs bg-slate-50 rounded p-2">
                  <div>VN-2000: <b>X={clickVN.x.toFixed(2)}</b>, <b>Y={clickVN.y.toFixed(2)}</b></div>
                  <div>WGS84: {clickVN.lat.toFixed(6)}, {clickVN.lng.toFixed(6)}</div>
                </div>
              )}
              {qhvHit.length > 0 && (
                <Section title="Quy hoạch sử dụng đất">
                  {qhvHit.map((h, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="text-slate-700">{h.lo}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 whitespace-nowrap">{h.hz === 'HT' ? 'Hiện trạng' : h.hz === '2045' ? 'QH 2045' : h.hz === '2030' ? 'QH 2030' : 'Quy hoạch'}</span>
                    </div>
                  ))}
                </Section>
              )}
              {!info.found && <p className="text-slate-500">Không có dữ liệu thửa/quy hoạch tại vị trí này.</p>}
              {info.parcel && (
                <Section title="Thửa đất">
                  {info.parcel.soTo && <Row k="Số tờ" v={String(info.parcel.soTo)} />}
                  {info.parcel.soThua && <Row k="Số thửa" v={String(info.parcel.soThua)} />}
                  {info.parcel.xa && <Row k="Xã/Phường" v={String(info.parcel.xa)} />}
                  {info.parcel.areaM2 != null && <Row k="Diện tích" v={fmtArea(info.parcel.areaM2)} />}
                </Section>
              )}
              {info.overlaps && info.overlaps.length > 0 && (
                <Section title="Quy hoạch chồng lấn">
                  {info.overlaps.map((o, i) => <Row key={i} k={`${o.type}${o.layer ? ' · ' + o.layer : ''}`} v={fmtArea(o.areaM2)} />)}
                </Section>
              )}
              {(!info.overlaps || info.overlaps.length === 0) && info.zoning && <Section title="Quy hoạch">{Object.entries(info.zoning).map(([k, v]) => <Row key={k} k={k} v={String(v)} />)}</Section>}
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
