'use client';
import { useEffect, useRef } from 'react';
import maplibregl, { Map as MlMap, Marker } from 'maplibre-gl';
import { Protocol as PMTilesProtocol } from 'pmtiles';
import { MAP } from '@/lib/config';

// Đăng ký giao thức pmtiles cho MapLibre (đọc 1 file .pmtiles qua HTTP range request) — chỉ đăng ký 1 lần.
if (typeof window !== 'undefined' && !(maplibregl as any).__pmtiles) {
  try { (maplibregl as any).addProtocol('pmtiles', new PMTilesProtocol().tile); (maplibregl as any).__pmtiles = true; } catch {}
}

export interface GeoLayer { id: string; type: 'fill' | 'line' | 'circle' | 'symbol'; data: GeoJSON.FeatureCollection; visible: boolean; paint: Record<string, any>; layout?: Record<string, any>; beforeId?: string; }
export interface MarkerSpec { lng: number; lat: number; color?: string; popupHtml?: string; label?: string; onClick?: () => void; }
export interface ImageOverlay { id: string; url: string; coordinates: [[number, number], [number, number], [number, number], [number, number]]; opacity: number; visible: boolean; pmtiles?: string; fillMaxzoom?: number; tiles?: string[]; minzoom?: number; maxzoom?: number; }
export type BaseMap = 'street' | 'satellite' | 'terrain';
export type MeasureMode = 'off' | 'distance' | 'area';
export interface MeasureResult { mode: MeasureMode; points: number; distance: number; area: number; }

interface Props {
  center?: [number, number]; zoom?: number; className?: string;
  layers?: GeoLayer[]; markers?: MarkerSpec[]; overlays?: ImageOverlay[];
  baseMap?: BaseMap; labels?: boolean; measureMode?: MeasureMode;
  focusPoint?: { lng: number; lat: number; label?: string } | null;
  highlight?: GeoJSON.Feature | null;
  initialBounds?: [[number, number], [number, number]]; // tự khớp khung vùng quy hoạch khi mở
  adMarkers?: { id: number; lng: number; lat: number; name: string; phone: string; image?: string | null; style?: string }[];
  adOpacity?: number; // độ mờ logo quảng cáo (đi theo thanh độ mờ lớp phủ)
  fitTo?: [[number, number], [number, number]] | null; // zoom khít vào vùng (vd: thửa vừa vẽ)
  onMapClick?: (lng: number, lat: number) => void;
  onMeasure?: (r: MeasureResult) => void;
  onViewport?: (v: { west: number; south: number; east: number; north: number; zoom: number }) => void;
}

// Google tiles — best detail/zoom for Vietnam. lyrs: m=đường, y=vệ tinh+nhãn, p=địa hình
const BASES: Record<BaseMap, { tiles: string[] }> = {
  street: { tiles: ['https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'] },
  satellite: { tiles: ['https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'] },
  terrain: { tiles: ['https://mt0.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'] },
};
// Lớp nhãn & đường trong suốt (chồng lên vệ tinh) — kiểu Google Hybrid
const LABELS = ['https://mt0.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', 'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}'];
const rasterSrc = (tiles: string[]) => ({ type: 'raster' as const, tiles, tileSize: 256, maxzoom: 21, attribution: '© Google' });
const BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    'base-street': rasterSrc(BASES.street.tiles),
    'base-satellite': rasterSrc(BASES.satellite.tiles),
    'base-terrain': rasterSrc(BASES.terrain.tiles),
    'base-labels': rasterSrc(LABELS),
  },
  layers: [
    { id: 'base-street', type: 'raster', source: 'base-street' },
    { id: 'base-satellite', type: 'raster', source: 'base-satellite', layout: { visibility: 'none' } },
    { id: 'base-terrain', type: 'raster', source: 'base-terrain', layout: { visibility: 'none' } },
    { id: 'base-labels', type: 'raster', source: 'base-labels', layout: { visibility: 'none' } },
  ],
};

const d2r = Math.PI / 180, R = 6378137;
function haversine(a: { lng: number; lat: number }, b: { lng: number; lat: number }) {
  const dLat = (b.lat - a.lat) * d2r, dLng = (b.lng - a.lng) * d2r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * d2r) * Math.cos(b.lat * d2r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function polyArea(pts: { lng: number; lat: number }[]) {
  if (pts.length < 3) return 0;
  const lat0 = (pts.reduce((s, p) => s + p.lat, 0) / pts.length) * d2r;
  const xy = pts.map((p) => [R * p.lng * d2r * Math.cos(lat0), R * p.lat * d2r]);
  let s = 0;
  for (let i = 0; i < xy.length; i++) { const j = (i + 1) % xy.length; s += xy[i][0] * xy[j][1] - xy[j][0] * xy[i][1]; }
  return Math.abs(s) / 2;
}

const WM_MIN_ZOOM = 14; // chữ mờ chỉ hiện khi zoom gần
const WM_OPACITY = 0.55; // rõ hơn một chút cho dễ đọc
export default function MapView({ center, zoom, className, layers = [], markers = [], overlays = [], baseMap = 'street', labels = true, measureMode = 'off', focusPoint = null, highlight = null, initialBounds, adMarkers = [], adOpacity = 1, fitTo = null, onMapClick, onMeasure, onViewport }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const focusMarker = useRef<Marker | null>(null);
  const adRefs = useRef<Marker[]>([]);
  const adOpacityRef = useRef(adOpacity); adOpacityRef.current = adOpacity;
  const wmRef = useRef<HTMLDivElement | null>(null);
  const onViewportRef = useRef(onViewport); onViewportRef.current = onViewport;
  const readyRef = useRef(false);
  const measureModeRef = useRef<MeasureMode>(measureMode);
  const measurePts = useRef<{ lng: number; lat: number }[]>([]);
  const initialBoundsRef = useRef(initialBounds);
  initialBoundsRef.current = initialBounds;
  const didFitRef = useRef(false);

  // Khớp khung đúng vùng quy hoạch ngay khi mở (chỉ chạy 1 lần, khi container đã có kích thước thật).
  function tryInitialFit() {
    const map = mapRef.current, c = containerRef.current, b = initialBoundsRef.current;
    if (!map || !readyRef.current || didFitRef.current || !b || !c) return;
    if (c.clientWidth < 50 || c.clientHeight < 50) return;
    map.fitBounds(b as any, { padding: 28, animate: false, maxZoom: 16 });
    didFitRef.current = true;
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: containerRef.current, style: BASE_STYLE, center: center ?? MAP.center, zoom: zoom ?? MAP.zoom, maxZoom: 22 });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    // Định vị GPS: đưa bản đồ về vị trí người dùng, có chấm xanh + theo dõi khi di chuyển.
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserHeading: true, showAccuracyCircle: true }), 'top-right');
    map.on('load', () => {
      readyRef.current = true;
      map.addSource('measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'measure-fill', type: 'fill', source: 'measure', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.2 } });
      map.addLayer({ id: 'measure-line', type: 'line', source: 'measure', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#ea580c', 'line-width': 2.5, 'line-dasharray': [2, 1] } });
      map.addLayer({ id: 'measure-pts', type: 'circle', source: 'measure', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 4, 'circle-color': '#ea580c', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
      map.addSource('highlight', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'highlight-fill', type: 'fill', source: 'highlight', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#fde047', 'fill-opacity': 0.35 } });
      map.addLayer({ id: 'highlight-line', type: 'line', source: 'highlight', paint: { 'line-color': '#ca8a04', 'line-width': 3 } });
      syncBase(); syncOverlays(); syncLayers(); tryInitialFit();
    });
    map.on('click', (e) => {
      if (measureModeRef.current !== 'off') addMeasurePoint(e.lngLat.lng, e.lngLat.lat);
      else if (onMapClick) onMapClick(e.lngLat.lng, e.lngLat.lat);
    });
    map.getCanvas().style.cursor = '';
    mapRef.current = map;
    const wmZoom = () => { if (wmRef.current) wmRef.current.style.display = map.getZoom() < WM_MIN_ZOOM ? 'none' : ''; };
    map.on('zoom', wmZoom); map.on('load', wmZoom);
    const fireView = () => { const fn = onViewportRef.current; if (!fn) return; const b = map.getBounds(); fn({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(), zoom: map.getZoom() }); };
    map.on('moveend', fireView); map.on('load', fireView);
    // Tự resize + khớp khung khi container đổi kích thước (vd: chuyển tab Danh sách↔Bản đồ trên mobile).
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => { if (mapRef.current) { mapRef.current.resize(); tryInitialFit(); } });
      ro.observe(containerRef.current);
    }
    return () => { ro?.disconnect(); map.remove(); mapRef.current = null; readyRef.current = false; didFitRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderMeasure() {
    const map = mapRef.current; if (!map || !readyRef.current) return;
    const pts = measurePts.current;
    const feats: any[] = pts.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] } }));
    if (pts.length >= 2 && measureModeRef.current === 'distance')
      feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) } });
    if (pts.length >= 3 && measureModeRef.current === 'area')
      feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...pts.map((p) => [p.lng, p.lat]), [pts[0].lng, pts[0].lat]]] } });
    (map.getSource('measure') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: feats });
    ['measure-fill', 'measure-line', 'measure-pts'].forEach((id) => { if (map.getLayer(id)) map.moveLayer(id); });
  }
  function addMeasurePoint(lng: number, lat: number) {
    measurePts.current.push({ lng, lat });
    renderMeasure();
    const pts = measurePts.current;
    let distance = 0; for (let i = 1; i < pts.length; i++) distance += haversine(pts[i - 1], pts[i]);
    const area = measureModeRef.current === 'area' ? polyArea(pts) : 0;
    onMeasure?.({ mode: measureModeRef.current, points: pts.length, distance, area });
  }
  useEffect(() => {
    measureModeRef.current = measureMode;
    measurePts.current = [];
    renderMeasure();
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = measureMode === 'off' ? '' : 'crosshair';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureMode]);

  function syncBase() {
    const map = mapRef.current; if (!map || !readyRef.current) return;
    (['street', 'satellite', 'terrain'] as BaseMap[]).forEach((b) =>
      map.setLayoutProperty(`base-${b}`, 'visibility', b === baseMap ? 'visible' : 'none'));
    if (map.getLayer('base-labels')) map.setLayoutProperty('base-labels', 'visibility', labels && baseMap !== 'street' ? 'visible' : 'none');
  }
  useEffect(() => { syncBase(); /* eslint-disable-next-line */ }, [baseMap, labels]);

  function syncOverlays() {
    const map = mapRef.current; if (!map || !readyRef.current) return;
    for (const ov of overlays) {
      const srcId = `ovsrc-${ov.id}`;
      if (ov.pmtiles) {
        // Đọc pmtiles theo dạng tile-template để tự đặt maxzoom riêng cho từng lớp.
        const tpl = [`${ov.pmtiles}/{z}/{x}/{y}`];
        const fillId = `${ov.id}-fill`, fillSrc = `${srcId}-fill`;
        // Lớp NỀN: mức zoom thấp (đủ màu, không thủng ruột) — chỉ bật khi zoom sâu để lấp lỗ trống ở z17-18.
        if (!map.getSource(fillSrc)) {
          map.addSource(fillSrc, { type: 'raster', tiles: tpl, tileSize: 256, minzoom: ov.minzoom ?? 10, maxzoom: ov.fillMaxzoom ?? 14 } as any);
          map.addLayer({ id: fillId, type: 'raster', source: fillSrc, minzoom: 16, paint: { 'raster-opacity': ov.opacity } });
        }
        // Lớp CHI TIẾT: mức zoom cao (nét viền) chồng lên trên. Dùng dạng url (đã chạy tốt).
        if (!map.getSource(srcId)) {
          map.addSource(srcId, { type: 'raster', url: ov.pmtiles, tileSize: 256, minzoom: ov.minzoom ?? 10, maxzoom: ov.maxzoom ?? 18 } as any);
          map.addLayer({ id: ov.id, type: 'raster', source: srcId, paint: { 'raster-opacity': ov.opacity, 'raster-resampling': 'nearest' } });
        }
        for (const id of [fillId, ov.id]) {
          map.setPaintProperty(id, 'raster-opacity', ov.opacity);
          map.setLayoutProperty(id, 'visibility', ov.visible ? 'visible' : 'none');
        }
      } else {
        if (!map.getSource(srcId)) {
          if (ov.tiles && ov.tiles.length) map.addSource(srcId, { type: 'raster', tiles: ov.tiles, tileSize: 256, minzoom: ov.minzoom ?? 0, maxzoom: ov.maxzoom ?? 22 } as any);
          else map.addSource(srcId, { type: 'image', url: ov.url, coordinates: ov.coordinates as any });
          map.addLayer({ id: ov.id, type: 'raster', source: srcId, paint: { 'raster-opacity': ov.opacity } });
        } else map.setPaintProperty(ov.id, 'raster-opacity', ov.opacity);
        map.setLayoutProperty(ov.id, 'visibility', ov.visible ? 'visible' : 'none');
      }
    }
  }
  useEffect(() => { syncOverlays(); /* eslint-disable-next-line */ }, [overlays]);

  function syncLayers() {
    const map = mapRef.current; if (!map || !readyRef.current) return;
    for (const l of layers) {
      const srcId = `src-${l.id}`;
      const src = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(l.data as any); else map.addSource(srcId, { type: 'geojson', data: l.data as any });
      if (!map.getLayer(l.id)) map.addLayer({ id: l.id, type: l.type, source: srcId, paint: l.paint, layout: l.layout || {} } as any);
      else for (const [k, v] of Object.entries(l.paint)) map.setPaintProperty(l.id, k as any, v);
      map.setLayoutProperty(l.id, 'visibility', l.visible ? 'visible' : 'none');
    }
  }
  useEffect(() => { syncLayers(); /* eslint-disable-next-line */ }, [layers]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = markers.map((m) => {
      let mk: maplibregl.Marker;
      if (m.label) {
        const el = document.createElement('div'); el.className = 'cl-price-pin'; el.textContent = m.label;
        mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([m.lng, m.lat]);
      } else {
        mk = new maplibregl.Marker({ color: m.color ?? '#e53935' }).setLngLat([m.lng, m.lat]);
      }
      if (m.popupHtml) mk.setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(m.popupHtml));
      if (m.onClick) mk.getElement().addEventListener('click', m.onClick);
      mk.addTo(map); return mk;
    });
  }, [markers]);

  // Logo quảng cáo tròn (avatar/ảnh + tên & SĐT ngoài vòng, chữ Cam Lâm Land bên trong)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    adRefs.current.forEach((m) => m.remove());
    const esc = (x: any) => String(x ?? '').replace(/[<>&"]/g, (c) => (({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' } as any)[c]));
    adRefs.current = adMarkers.filter((a) => a.style !== 'text').map((a) => {
      const el = document.createElement('div'); el.className = 'cl-ad'; el.style.opacity = String(adOpacityRef.current);
      const nm = esc(String(a.name || '').slice(0, 28)), tel = esc(String(a.phone || ''));
      if (a.style === 'text') {
        el.style.filter = '';
        el.innerHTML = `<div style="text-align:center;white-space:nowrap;font-family:'Roboto','Inter',system-ui,sans-serif;line-height:1.18;pointer-events:none;"><div style="font-size:16px;font-weight:700;letter-spacing:.3px;color:rgba(255,255,255,.96);-webkit-text-stroke:0.6px rgba(0,0,0,.55);text-shadow:0 1px 2px rgba(0,0,0,.6);">${nm}</div><div style="font-size:14px;font-weight:600;letter-spacing:.5px;color:rgba(255,255,255,.96);-webkit-text-stroke:0.5px rgba(0,0,0,.5);text-shadow:0 1px 2px rgba(0,0,0,.55);">${tel}</div></div>`;
      } else {
        el.style.filter = 'drop-shadow(0 2px 5px rgba(0,0,0,.4))';
        const uid = 'ad' + a.id + Math.random().toString(36).slice(2, 6);
        const center = a.image
          ? `<image xlink:href="${esc(a.image)}" x="18" y="18" width="64" height="64" clip-path="url(#c${uid})" preserveAspectRatio="xMidYMid slice"/>`
          : `<text x="50" y="51" text-anchor="middle" dominant-baseline="middle" font-size="26" font-weight="800" fill="#C8A14B" font-family="Inter,sans-serif">${esc(String(a.name || 'C').charAt(0)).toUpperCase()}</text>`;
        el.innerHTML = `<svg width="96" height="96" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><clipPath id="c${uid}"><circle cx="50" cy="50" r="28"/></clipPath><path id="t${uid}" d="M 11 50 A 39 39 0 0 1 89 50"/><path id="b${uid}" d="M 4 50 A 46 46 0 0 0 96 50"/></defs><circle cx="50" cy="50" r="49" fill="#0A2540"/><circle cx="50" cy="50" r="47.5" fill="none" stroke="#C8A14B" stroke-width="1"/>${center}<circle cx="50" cy="50" r="29" fill="none" stroke="#C8A14B" stroke-width="1.4"/><text font-family="Inter,sans-serif" font-size="11" font-weight="800" fill="#ffffff"><textPath xlink:href="#t${uid}" startOffset="50%" text-anchor="middle" textLength="96" lengthAdjust="spacingAndGlyphs">${nm}</textPath></text><text font-family="Inter,sans-serif" font-size="11" font-weight="800" fill="#ffffff"><textPath xlink:href="#b${uid}" startOffset="50%" text-anchor="middle" textLength="96" lengthAdjust="spacingAndGlyphs">${tel}</textPath></text><text x="7.5" y="50" text-anchor="middle" dominant-baseline="central" font-size="8" fill="#C8A14B">★</text><text x="92.5" y="50" text-anchor="middle" dominant-baseline="central" font-size="8" fill="#C8A14B">★</text></svg>`;
      }
      const mk = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([a.lng, a.lat]);
      mk.setPopup(new maplibregl.Popup({ offset: 28 }).setHTML(
        `<div style="text-align:center;min-width:130px"><div style="font-weight:800;color:#0A2540">${esc(a.name)}</div>` +
        `<a href="tel:${esc(a.phone)}" style="color:#dc2626;font-weight:700">📞 ${esc(a.phone)}</a>` +
        `<div style="color:#C8A14B;font-weight:700;font-size:11px;margin-top:2px">⭐ Cam Lâm Land</div></div>`));
      mk.addTo(map); return mk;
    });
  }, [adMarkers]);

  // Lớp "chữ mờ" lặp kín toàn bản đồ (quảng cáo kiểu text) — như watermark chống sao chép
  useEffect(() => {
    const cont = containerRef.current; if (!cont) return;
    const esc2 = (x: any) => String(x ?? '').replace(/[<>&]/g, (c) => (({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as any)[c]));
    const tAds = (adMarkers || []).filter((a) => a.style === 'text');
    const seenK = new Set<string>();
    const uniq = tAds.filter((a) => { const k = a.name + '|' + a.phone; if (seenK.has(k)) return false; seenK.add(k); return true; });
    if (!uniq.length) { if (wmRef.current) { wmRef.current.remove(); wmRef.current = null; } return; }
    const band = 194, tileW = 570; // thưa hơn ~0.6× mật độ cũ (440×150)
    const cols = uniq.length >= 2 ? uniq : [uniq[0], uniq[0]];
    const tileH = band * cols.length;
    const ts = "text-anchor='middle' dominant-baseline='middle' font-family='Roboto,Arial,sans-serif' font-size='13' font-weight='600' letter-spacing='0.4' fill='rgba(255,255,255,0.98)' filter='url(#wmsh)'";
    const rows = cols.map((a, i) => {
      const y = i * band + band / 2; const label = `${esc2(a.name)} · ${esc2(a.phone)}`;
      return i % 2 === 0
        ? `<text x='${tileW / 2}' y='${y}' ${ts}>${label}</text>`
        : `<text x='0' y='${y}' ${ts}>${label}</text><text x='${tileW}' y='${y}' ${ts}>${label}</text>`;
    }).join('');
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tileW}' height='${tileH}'><defs><filter id='wmsh' x='-40%' y='-80%' width='180%' height='260%'><feDropShadow dx='0' dy='0.4' stdDeviation='1.1' flood-color='#000' flood-opacity='0.85'/></filter></defs>${rows}</svg>`;
    let el = wmRef.current;
    if (!el) {
      el = document.createElement('div'); el.setAttribute('aria-hidden', 'true');
      el.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:2;';
      const layer = document.createElement('div');
      layer.style.cssText = 'position:absolute;top:-30%;left:-30%;width:160%;height:160%;background-repeat:repeat;background-position:center;transform:rotate(-30deg);transform-origin:center center;';
      el.appendChild(layer);
      if (getComputedStyle(cont).position === 'static') cont.style.position = 'relative';
      cont.appendChild(el); wmRef.current = el;
    }
    (el.firstChild as HTMLDivElement).style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    el.style.opacity = String(adOpacityRef.current * WM_OPACITY);
    const mp = mapRef.current;
    el.style.display = (mp && mp.getZoom() < WM_MIN_ZOOM) ? 'none' : '';
  }, [adMarkers]);

  useEffect(() => {
    adRefs.current.forEach((m) => { try { (m.getElement() as HTMLElement).style.opacity = String(adOpacity); } catch {} });
    if (wmRef.current) wmRef.current.style.opacity = String(adOpacity * WM_OPACITY);
  }, [adOpacity]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !focusPoint) return;
    focusMarker.current?.remove();
    focusMarker.current = new maplibregl.Marker({ color: '#2563eb' }).setLngLat([focusPoint.lng, focusPoint.lat])
      .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(focusPoint.label ?? 'Vị trí tra cứu')).addTo(map);
    focusMarker.current.togglePopup();
    map.flyTo({ center: [focusPoint.lng, focusPoint.lat], zoom: Math.max(map.getZoom(), 16) });
  }, [focusPoint]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !fitTo) return;
    map.fitBounds(fitTo as any, { padding: 60, animate: true, maxZoom: 19, duration: 800 });
  }, [fitTo]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !readyRef.current) return;
    const src = map.getSource('highlight') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData((highlight ? { type: 'FeatureCollection', features: [highlight] } : { type: 'FeatureCollection', features: [] }) as any);
    ['highlight-fill', 'highlight-line'].forEach((id) => { if (map.getLayer(id)) map.moveLayer(id); });
  }, [highlight]);

  return <div ref={containerRef} className={className ?? 'h-full w-full'} />;
}
