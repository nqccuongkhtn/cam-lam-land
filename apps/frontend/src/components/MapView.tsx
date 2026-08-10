'use client';
import { useEffect, useRef } from 'react';
import maplibregl, { Map as MlMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css'; // CSS đi kèm CHUNK bản đồ (chỉ tải ở trang có map) — bỏ link unpkg toàn cục cho nhẹ mọi trang khác
import { Protocol as PMTilesProtocol } from 'pmtiles';
import { MAP } from '@/lib/config';

// Đăng ký giao thức pmtiles cho MapLibre (đọc 1 file .pmtiles qua HTTP range request) — chỉ đăng ký 1 lần.
if (typeof window !== 'undefined' && !(maplibregl as any).__pmtiles) {
  try { (maplibregl as any).addProtocol('pmtiles', new PMTilesProtocol().tile); (maplibregl as any).__pmtiles = true; } catch {}
}

export interface GeoLayer { id: string; type: 'fill' | 'line' | 'circle' | 'symbol'; data: GeoJSON.FeatureCollection; visible: boolean; paint: Record<string, any>; layout?: Record<string, any>; beforeId?: string; minzoom?: number; }
export interface MarkerSpec { lng: number; lat: number; color?: string; popupHtml?: string; label?: string; tier?: string; dot?: boolean; onClick?: () => void; chip?: string; }
export interface ImageOverlay { id: string; url: string; coordinates: [[number, number], [number, number], [number, number], [number, number]]; opacity: number; visible: boolean; pmtiles?: string; fillMaxzoom?: number; tiles?: string[]; minzoom?: number; maxzoom?: number; }
export type BaseMap = 'street' | 'satellite' | 'terrain';
export type MeasureMode = 'off' | 'distance' | 'area';
export interface MeasureResult { mode: MeasureMode; points: number; distance: number; area: number; }

interface Props {
  center?: [number, number]; zoom?: number; className?: string;
  layers?: GeoLayer[]; markers?: MarkerSpec[]; overlays?: ImageOverlay[];
  baseMap?: BaseMap; labels?: boolean; measureMode?: MeasureMode;
  focusPoint?: { lng: number; lat: number; label?: string } | null;
  flyToPoint?: { lng: number; lat: number } | null; // bay tới + zoom cận + dời tâm lên (điểm nằm giữa vùng trống, không bị bảng che)
  highlight?: GeoJSON.Feature | null;
  initialBounds?: [[number, number], [number, number]]; // tự khớp khung vùng quy hoạch khi mở
  adMarkers?: { id: number; lng: number; lat: number; name: string; phone: string; image?: string | null; style?: string }[];
  adOpacity?: number; // độ mờ logo quảng cáo (đi theo thanh độ mờ lớp phủ)
  fitTo?: [[number, number], [number, number]] | null; // zoom khít vào vùng (vd: thửa vừa vẽ)
  onMapClick?: (lng: number, lat: number) => void;
  onMeasure?: (r: MeasureResult) => void;
  onViewport?: (v: { west: number; south: number; east: number; north: number; zoom: number }) => void;
  textLabels?: { lng: number; lat: number; text: string; minzoom?: number }[]; // nhãn chữ vẽ bằng HTML (không cần glyph/font server)
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
// ==== Kích thước thửa (độ dài từng cạnh + diện tích) — hiển thị kiểu Guland ====
function edgeMeters(a: number[], b: number[]): number {
  const R = 6378137, toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR, dLng = (b[0] - a[0]) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function ringAreaM2(ring: number[][]): number {
  const R = 6378137, toR = Math.PI / 180;
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length * toR;
  const xy = ring.map((p) => [p[0] * toR * R * Math.cos(lat0), p[1] * toR * R]);
  let a = 0;
  for (let i = 0; i < xy.length - 1; i++) a += xy[i][0] * xy[i + 1][1] - xy[i + 1][0] * xy[i][1];
  return Math.abs(a) / 2;
}
function parcelDims(hl: any): any[] {
  if (!hl || !hl.geometry) return [];
  const g = hl.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const out: any[] = [];
  for (const poly of polys) {
    const ring = poly[0]; if (!ring || ring.length < 3) continue;
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], b = ring[i + 1];
      const d = edgeMeters(a, b);
      if (d < 0.3) continue;
      const latR = (a[1] + b[1]) / 2 * Math.PI / 180;
      const rot = Math.atan2((b[0] - a[0]) * Math.cos(latR), b[1] - a[1]) * 180 / Math.PI - 90; // xoay chữ dọc cạnh
      out.push({ type: 'Feature', properties: { len: d < 10 ? d.toFixed(1) + 'm' : Math.round(d) + 'm', rot }, geometry: { type: 'Point', coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] } });
    }
    const n = ring.length - 1;
    const cx = ring.slice(0, n).reduce((s: number, p: number[]) => s + p[0], 0) / n;
    const cy = ring.slice(0, n).reduce((s: number, p: number[]) => s + p[1], 0) / n;
    const area = ringAreaM2(ring);
    out.push({ type: 'Feature', properties: { area: (area >= 1000 ? Math.round(area).toLocaleString('vi') : area.toFixed(1)) + ' m²' }, geometry: { type: 'Point', coordinates: [cx, cy] } });
  }
  return out;
}

export default function MapView({ center, zoom, className, layers = [], markers = [], overlays = [], baseMap = 'street', labels = true, measureMode = 'off', focusPoint = null, flyToPoint = null, highlight = null, initialBounds, adMarkers = [], adOpacity = 1, fitTo = null, onMapClick, onMeasure, onViewport, textLabels = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const focusMarker = useRef<Marker | null>(null);
  const adRefs = useRef<Marker[]>([]);
  const labelRefs = useRef<Marker[]>([]);
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
      map.addLayer({ id: 'highlight-line', type: 'line', source: 'highlight', paint: { 'line-color': '#7c3aed', 'line-width': 2.5 } });
      // Kích thước thửa kiểu Guland: độ dài từng cạnh (dọc cạnh) + diện tích ở giữa
      map.addSource('highlight-dims', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'hl-edge', type: 'symbol', source: 'highlight-dims', filter: ['has', 'len'], layout: { 'text-field': ['get', 'len'], 'text-size': 11, 'text-font': ['Noto Sans Regular'], 'text-rotate': ['get', 'rot'], 'text-rotation-alignment': 'map', 'text-keep-upright': true, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#7c3aed', 'text-halo-width': 2 } });
      map.addLayer({ id: 'hl-area', type: 'symbol', source: 'highlight-dims', filter: ['has', 'area'], layout: { 'text-field': ['get', 'area'], 'text-size': 13, 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#0A2540', 'text-halo-color': '#ffffff', 'text-halo-width': 2.5 } });
      syncBase(); syncOverlays(); syncLayers(); tryInitialFit();
    });
    map.on('click', (e) => {
      const tgt = e.originalEvent?.target as HTMLElement | null;
      if (tgt && tgt.closest && tgt.closest('.maplibregl-marker')) return; // bấm trúng marker (pin giá, quảng cáo, điểm lưu) → chỉ mở popup của nó, KHÔNG xử lý như click bản đồ
      if (measureModeRef.current !== 'off') addMeasurePoint(e.lngLat.lng, e.lngLat.lat);
      else if (onMapClick) onMapClick(e.lngLat.lng, e.lngLat.lat);
    });
    map.getCanvas().style.cursor = '';
    mapRef.current = map;
    const wmZoom = () => { if (wmRef.current) wmRef.current.style.display = map.getZoom() < WM_MIN_ZOOM ? 'none' : ''; };
    map.on('zoom', wmZoom); map.on('load', wmZoom);
    // Zoom SÁT (>=16, hợp với điện thoại) → thêm class để tin thường tự hiện giá như VIP.
    const zoomClass = () => map.getContainer().classList.toggle('cl-zoomed', map.getZoom() >= 16);
    map.on('zoom', zoomClass); map.on('load', zoomClass);
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
          map.addLayer({ id: fillId, type: 'raster', source: fillSrc, paint: { 'raster-opacity': ov.opacity } });
          if (map.getLayer('measure-fill')) map.moveLayer(fillId, 'measure-fill');
        }
        // Lớp CHI TIẾT: mức zoom cao (nét viền) chồng lên trên. Dùng dạng url (đã chạy tốt).
        if (!map.getSource(srcId)) {
          map.addSource(srcId, { type: 'raster', url: ov.pmtiles, tileSize: 256, minzoom: ov.minzoom ?? 10, maxzoom: ov.maxzoom ?? 18 } as any);
          map.addLayer({ id: ov.id, type: 'raster', source: srcId, paint: { 'raster-opacity': ov.opacity, 'raster-resampling': 'nearest' } });
          if (map.getLayer('measure-fill')) map.moveLayer(ov.id, 'measure-fill');
        }
        for (const id of [fillId, ov.id]) {
          map.setPaintProperty(id, 'raster-opacity', ov.opacity);
          map.setLayoutProperty(id, 'visibility', ov.visible ? 'visible' : 'none');
        }
      } else {
        if (!map.getSource(srcId)) {
          if (ov.tiles && ov.tiles.length) map.addSource(srcId, { type: 'raster', tiles: ov.tiles, tileSize: 256, minzoom: ov.minzoom ?? 0, maxzoom: ov.maxzoom ?? 22 } as any);
          else map.addSource(srcId, { type: 'image', url: ov.url, coordinates: ov.coordinates as any });
          map.addLayer({ id: ov.id, type: 'raster', source: srcId, paint: { 'raster-opacity': ov.opacity, 'raster-resampling': 'nearest' } });
          // Ép ảnh raster QH xuống DƯỚI mọi lớp vector (ngay trên nền) để KHÔNG che ranh thửa/nhãn.
          if (map.getLayer('measure-fill')) map.moveLayer(ov.id, 'measure-fill');
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
      if (!map.getLayer(l.id)) map.addLayer({ id: l.id, type: l.type, source: srcId, paint: l.paint, layout: l.layout || {}, ...(l.minzoom != null ? { minzoom: l.minzoom } : {}) } as any, (l.beforeId && map.getLayer(l.beforeId)) ? l.beforeId : undefined);
      else for (const [k, v] of Object.entries(l.paint)) map.setPaintProperty(l.id, k as any, v);
      map.setLayoutProperty(l.id, 'visibility', l.visible ? 'visible' : 'none');
    }
  }
  useEffect(() => { syncLayers(); /* eslint-disable-next-line */ }, [layers]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const TIER_TXT: Record<string, string> = { diamond: 'Kim Cương', gold: 'VIP Vàng', silver: 'VIP Bạc' };
    // Tạo 1 marker DOM theo loại (tin đăng / pin giá / chip / ghim mặc định)
    const makeMarker = (m: MarkerSpec, pill = true) => {
      let mk: maplibregl.Marker;
      if (m.tier !== undefined) {
        const vip = !!m.tier && m.tier !== 'normal';
        // pill=true → bung pill (giá + hạng); pill=false → chỉ CHẤM (chưa tới zoom).
        const el = document.createElement('div'); el.className = 'cl-mk ' + (pill ? 'cl-mk-vip' : 'cl-mk-normal');
        const dot = document.createElement('b'); dot.className = 'cl-mk-dot'; el.appendChild(dot);
        const pl = document.createElement('span'); pl.className = 'cl-mk-pill';
        const pr = document.createElement('span'); pr.textContent = m.label || ''; pl.appendChild(pr);
        if (pill && vip) { const tag = document.createElement('b'); tag.className = 'cl-vip-tag cl-vip-' + m.tier; tag.textContent = TIER_TXT[m.tier] || 'VIP'; pl.appendChild(tag); }
        el.appendChild(pl);
        mk = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([m.lng, m.lat]);
      } else if (m.label) {
        const el = document.createElement('div'); el.className = 'cl-price-pin'; el.textContent = m.label;
        mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([m.lng, m.lat]);
      } else if (m.chip !== undefined) {
        const el = document.createElement('div'); el.className = 'cl-chip'; el.textContent = m.chip;
        mk = new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, 8] }).setLngLat([m.lng, m.lat]);
      } else {
        mk = new maplibregl.Marker({ color: m.color ?? '#e53935' }).setLngLat([m.lng, m.lat]);
      }
      if (m.popupHtml) mk.setPopup(new maplibregl.Popup({ offset: 18, closeButton: true, closeOnClick: false }).setHTML(m.popupHtml));
      if (m.onClick) mk.getElement().addEventListener('click', (ev) => { ev.stopPropagation(); m.onClick!(); });
      mk.addTo(map); return mk;
    };
    // Ngưỡng zoom để BUNG PILL (giá + hạng). Dưới ngưỡng → chỉ CHẤM (tin vẫn hiện). Vàng/Bạc hiện sớm hơn.
    const PILL_MINZ: Record<string, number> = { diamond: 0, gold: 11, silver: 12.5, normal: 14 };
    const render = () => {
      markerRefs.current.forEach((mk) => mk.remove());
      const z = map.getZoom() || 0;
      // MỌI tin luôn hiện: đủ zoom → bung pill; chưa đủ → chấm nhỏ. Marker khác (ghim, chip) luôn nguyên.
      markerRefs.current = markers.map((m) => makeMarker(m, m.tier === undefined ? true : z >= (PILL_MINZ[m.tier] ?? 14)));
    };
    render();
    map.on('moveend', render);
    return () => { map.off('moveend', render); markerRefs.current.forEach((mk) => mk.remove()); markerRefs.current = []; };
  }, [markers]);

  // Nhãn chữ HTML (vd tên thôn): vẽ bằng DOM nên KHÔNG phụ thuộc glyph/font server (openmaptiles).
  // Khi mạng chặn font server, chữ symbol của MapLibre không hiện — nhãn HTML này vẫn hiện bình thường.
  useEffect(() => {
    const map = mapRef.current; if (!map || !readyRef.current) return;
    const build = () => {
      labelRefs.current.forEach((m) => m.remove()); labelRefs.current = [];
      if (!textLabels.length) return;
      const z = map.getZoom() || 0;
      for (const t of textLabels) {
        if (z < (t.minzoom ?? 10.5)) continue;
        const el = document.createElement('div');
        el.style.cssText = "font:700 12px/1.1 system-ui,'Segoe UI',Arial,sans-serif;color:#4a148c;white-space:nowrap;pointer-events:none;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff,0 0 2px #fff;";
        el.textContent = t.text;
        labelRefs.current.push(new maplibregl.Marker({ element: el, anchor: 'left' }).setLngLat([t.lng, t.lat]).addTo(map));
      }
    };
    build();
    map.on('moveend', build);
    return () => { map.off('moveend', build); labelRefs.current.forEach((m) => m.remove()); labelRefs.current = []; };
  }, [textLabels]);

  // Logo quảng cáo tròn (avatar/ảnh + tên & SĐT ngoài vòng, chữ Cam Lâm Land bên trong)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    adRefs.current.forEach((m) => m.remove());
    const esc = (x: any) => String(x ?? '').replace(/[<>&"]/g, (c) => (({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' } as any)[c]));
    const adSize = typeof window !== 'undefined' && window.innerWidth < 768 ? 58 : 96; // huy hiệu NHỎ hơn trên điện thoại → đỡ che bản đồ & thanh điều khiển
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
        el.innerHTML = `<svg width="${adSize}" height="${adSize}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><clipPath id="c${uid}"><circle cx="50" cy="50" r="28"/></clipPath><path id="t${uid}" d="M 11 50 A 39 39 0 0 1 89 50"/><path id="b${uid}" d="M 4 50 A 46 46 0 0 0 96 50"/></defs><circle cx="50" cy="50" r="49" fill="#0A2540"/><circle cx="50" cy="50" r="47.5" fill="none" stroke="#C8A14B" stroke-width="1"/>${center}<circle cx="50" cy="50" r="29" fill="none" stroke="#C8A14B" stroke-width="1.4"/><text font-family="Inter,sans-serif" font-size="11" font-weight="800" fill="#ffffff"><textPath xlink:href="#t${uid}" startOffset="50%" text-anchor="middle" textLength="96" lengthAdjust="spacingAndGlyphs">${nm}</textPath></text><text font-family="Inter,sans-serif" font-size="11" font-weight="800" fill="#ffffff"><textPath xlink:href="#b${uid}" startOffset="50%" text-anchor="middle" textLength="96" lengthAdjust="spacingAndGlyphs">${tel}</textPath></text><text x="7.5" y="50" text-anchor="middle" dominant-baseline="central" font-size="8" fill="#C8A14B">★</text><text x="92.5" y="50" text-anchor="middle" dominant-baseline="central" font-size="8" fill="#C8A14B">★</text></svg>`;
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

  // Click 1 điểm → bay tới, zoom cận, dời tâm LÊN để pin nằm giữa vùng trống phía trên (không bị bảng thông tin thửa che).
  useEffect(() => {
    const map = mapRef.current; if (!map || !flyToPoint) return;
    map.easeTo({ center: [flyToPoint.lng, flyToPoint.lat], zoom: Math.max(map.getZoom(), 17), offset: [0, -150], duration: 600 });
  }, [flyToPoint]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !fitTo) return;
    map.fitBounds(fitTo as any, { padding: 60, animate: true, maxZoom: 19, duration: 800 });
  }, [fitTo]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !readyRef.current) return;
    const src = map.getSource('highlight') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData((highlight ? { type: 'FeatureCollection', features: [highlight] } : { type: 'FeatureCollection', features: [] }) as any);
    const dsrc = map.getSource('highlight-dims') as maplibregl.GeoJSONSource | undefined;
    if (dsrc) dsrc.setData({ type: 'FeatureCollection', features: parcelDims(highlight) } as any);
    ['highlight-fill', 'highlight-line', 'hl-edge', 'hl-area'].forEach((id) => { if (map.getLayer(id)) map.moveLayer(id); });
  }, [highlight]);

  return <div ref={containerRef} className={className ?? 'h-full w-full'} />;
}
