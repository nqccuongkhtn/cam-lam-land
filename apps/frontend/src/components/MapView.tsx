'use client';
import { useEffect, useRef } from 'react';
import maplibregl, { Map as MlMap, Marker } from 'maplibre-gl';
import { MAP } from '@/lib/config';

export interface GeoLayer { id: string; type: 'fill' | 'line' | 'circle'; data: GeoJSON.FeatureCollection; visible: boolean; paint: Record<string, any>; }
export interface MarkerSpec { lng: number; lat: number; color?: string; popupHtml?: string; onClick?: () => void; }
export interface ImageOverlay { id: string; url: string; coordinates: [[number, number], [number, number], [number, number], [number, number]]; opacity: number; visible: boolean; }
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
  adMarkers?: { id: number; lng: number; lat: number; name: string; phone: string; image?: string | null }[];
  adOpacity?: number; // độ mờ logo quảng cáo (đi theo thanh độ mờ lớp phủ)
  onMapClick?: (lng: number, lat: number) => void;
  onMeasure?: (r: MeasureResult) => void;
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

export default function MapView({ center, zoom, className, layers = [], markers = [], overlays = [], baseMap = 'street', labels = true, measureMode = 'off', focusPoint = null, highlight = null, initialBounds, adMarkers = [], adOpacity = 1, onMapClick, onMeasure }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const focusMarker = useRef<Marker | null>(null);
  const adRefs = useRef<Marker[]>([]);
  const adOpacityRef = useRef(adOpacity); adOpacityRef.current = adOpacity;
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
      if (!map.getSource(srcId)) {
        map.addSource(srcId, { type: 'image', url: ov.url, coordinates: ov.coordinates as any });
        map.addLayer({ id: ov.id, type: 'raster', source: srcId, paint: { 'raster-opacity': ov.opacity } });
      } else map.setPaintProperty(ov.id, 'raster-opacity', ov.opacity);
      map.setLayoutProperty(ov.id, 'visibility', ov.visible ? 'visible' : 'none');
    }
  }
  useEffect(() => { syncOverlays(); /* eslint-disable-next-line */ }, [overlays]);

  function syncLayers() {
    const map = mapRef.current; if (!map || !readyRef.current) return;
    for (const l of layers) {
      const srcId = `src-${l.id}`;
      const src = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(l.data as any); else map.addSource(srcId, { type: 'geojson', data: l.data as any });
      if (!map.getLayer(l.id)) map.addLayer({ id: l.id, type: l.type, source: srcId, paint: l.paint } as any);
      else for (const [k, v] of Object.entries(l.paint)) map.setPaintProperty(l.id, k as any, v);
      map.setLayoutProperty(l.id, 'visibility', l.visible ? 'visible' : 'none');
    }
  }
  useEffect(() => { syncLayers(); /* eslint-disable-next-line */ }, [layers]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = markers.map((m) => {
      const mk = new maplibregl.Marker({ color: m.color ?? '#e53935' }).setLngLat([m.lng, m.lat]);
      if (m.popupHtml) mk.setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(m.popupHtml));
      if (m.onClick) mk.getElement().addEventListener('click', m.onClick);
      mk.addTo(map); return mk;
    });
  }, [markers]);

  // Logo quảng cáo tròn (avatar/ảnh + tên & SĐT ngoài vòng, chữ Cam Lâm Land bên trong)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    adRefs.current.forEach((m) => m.remove());
    const esc = (x: any) => String(x ?? '').replace(/[<>&"]/g, (c) => (({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' } as any)[c]));
    adRefs.current = adMarkers.map((a) => {
      const el = document.createElement('div'); el.className = 'cl-ad'; el.style.opacity = String(adOpacityRef.current);
      const ring = document.createElement('div'); ring.className = 'cl-ad-ring';
      if (a.image) { const im = document.createElement('img'); im.src = a.image; im.alt = ''; ring.appendChild(im); }
      else { const ph = document.createElement('div'); ph.className = 'cl-ad-ph'; ph.textContent = (a.name || 'CL').charAt(0).toUpperCase(); ring.appendChild(ph); }
      const brand = document.createElement('span'); brand.className = 'cl-ad-brand'; brand.textContent = 'Cam Lâm Land'; ring.appendChild(brand);
      el.appendChild(ring);
      const label = document.createElement('div'); label.className = 'cl-ad-label';
      const nm = document.createElement('span'); nm.className = 'cl-ad-name'; nm.textContent = a.name || '';
      const tel = document.createElement('span'); tel.className = 'cl-ad-phone'; tel.textContent = a.phone || '';
      label.appendChild(nm); label.appendChild(tel); el.appendChild(label);
      const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([a.lng, a.lat]);
      mk.setPopup(new maplibregl.Popup({ offset: 28 }).setHTML(
        `<div style="text-align:center;min-width:130px"><div style="font-weight:800;color:#0A2540">${esc(a.name)}</div>` +
        `<a href="tel:${esc(a.phone)}" style="color:#dc2626;font-weight:700">📞 ${esc(a.phone)}</a>` +
        `<div style="color:#C8A14B;font-weight:700;font-size:11px;margin-top:2px">⭐ Cam Lâm Land</div></div>`));
      mk.addTo(map); return mk;
    });
  }, [adMarkers]);

  useEffect(() => {
    adRefs.current.forEach((m) => { try { (m.getElement() as HTMLElement).style.opacity = String(adOpacity); } catch {} });
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
    const map = mapRef.current; if (!map || !readyRef.current) return;
    const src = map.getSource('highlight') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData((highlight ? { type: 'FeatureCollection', features: [highlight] } : { type: 'FeatureCollection', features: [] }) as any);
    ['highlight-fill', 'highlight-line'].forEach((id) => { if (map.getLayer(id)) map.moveLayer(id); });
  }, [highlight]);

  return <div ref={containerRef} className={className ?? 'h-full w-full'} />;
}
