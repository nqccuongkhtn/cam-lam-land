'use client';
import { useEffect, useRef } from 'react';
import maplibregl, { Map as MlMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css'; // CSS đi kèm CHUNK bản đồ (chỉ tải ở trang có map) — bỏ link unpkg toàn cục cho nhẹ mọi trang khác
import { Protocol as PMTilesProtocol } from 'pmtiles';
import { MAP } from '@/lib/config';
import { themLopBienDao } from '@/lib/bienDao';
import { batTaiTruoc, soOAnhNenGiu } from '@/lib/tilePrefetch';

// Đăng ký giao thức pmtiles cho MapLibre (đọc 1 file .pmtiles qua HTTP range request) — chỉ đăng ký 1 lần.
if (typeof window !== 'undefined' && !(maplibregl as any).__pmtiles) {
  try { (maplibregl as any).addProtocol('pmtiles', new PMTilesProtocol().tile); (maplibregl as any).__pmtiles = true; } catch {}
}

export interface GeoLayer { id: string; type: 'fill' | 'line' | 'circle' | 'symbol'; data: GeoJSON.FeatureCollection; visible: boolean; paint: Record<string, any>; layout?: Record<string, any>; beforeId?: string; minzoom?: number; }
export interface MarkerSpec { lng: number; lat: number; color?: string; popupHtml?: string; label?: string; tier?: string; dot?: boolean; onClick?: () => void; chip?: string; }
export interface ImageOverlay { id: string; url: string; coordinates: [[number, number], [number, number], [number, number], [number, number]]; opacity: number; visible: boolean; pmtiles?: string; fillMaxzoom?: number; tiles?: string[]; minzoom?: number; maxzoom?: number; }
// Một PHƯƠNG ÁN đi được vẽ lên bản đồ. chon=true là tuyến người dùng đang chọn (xanh đậm),
// còn lại vẽ xám mờ — bấm vào là đổi sang tuyến đó, y như Google Maps.
export interface TuyenVe { id: number; hinh: GeoJSON.LineString; nhan: string; chon: boolean }
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
  // BẢN ĐỒ ĐỊA CHÍNH — dạng Ô VECTOR (vector tile), LUÔN BẬT, không có nút tắt.
  // Truyền vào địa chỉ ô kèm "vé xem"; vé hết hạn thì chỉ cần truyền địa chỉ mới,
  // bản đồ tự đổi chứ không phải dựng lại lớp (nên không bị chớp màn hình).
  diaChinhTiles?: string[] | null;
  routes?: TuyenVe[];                 // các phương án đường đi (chỉ đường)
  onPickRoute?: (id: number) => void; // bấm vào tuyến xám → chọn tuyến đó
}

// Google tiles — best detail/zoom for Vietnam. lyrs: m=đường, y=vệ tinh+nhãn, p=địa hình
// Dùng ĐỦ 4 máy chủ mt0..mt3: trình duyệt chỉ cho ~6 kết nối cùng lúc TỚI MỖI TÊN MIỀN,
// chia ra 4 tên miền là tải song song gấp mấy lần → ảnh về nhanh hơn hẳn, đỡ trắng.
const gg = (l: string) => [0, 1, 2, 3].map((i) => `https://mt${i}.google.com/vt/lyrs=${l}&x={x}&y={y}&z={z}`);
const BASES: Record<BaseMap, { tiles: string[] }> = {
  street: { tiles: gg('m') },
  satellite: { tiles: gg('s') },
  terrain: { tiles: gg('p') },
};
// Lớp nhãn & đường trong suốt (chồng lên vệ tinh) — kiểu Google Hybrid
const LABELS = gg('h');
const rasterSrc = (tiles: string[]) => ({ type: 'raster' as const, tiles, tileSize: 256, maxzoom: 21, attribution: '© Google' });
// LỚP LÓT chống "bản đồ trắng": cùng ảnh nền nhưng CHỈ tải tới mức zoom 13.
// Cả huyện Cam Lâm ở mức 13 chỉ vài chục ô ảnh → tải một nhoáng là xong và nằm luôn trong bộ nhớ đệm.
// Khi phóng to, MapLibre kéo giãn mấy ô này ra làm nền: người xem thấy ảnh HƠI MỜ thay vì Ô TRẮNG,
// tới khi ảnh nét về thì đè lên. Đây đúng là cách Google Earth/Google Maps vẫn làm.
const LOT_MAXZOOM = 13;
const rasterLot = (tiles: string[]) => ({ type: 'raster' as const, tiles, tileSize: 256, maxzoom: LOT_MAXZOOM });
// Lót TẦNG 2 (mức 16): ảnh mức 16 kéo giãn ra chỉ hơi mềm, mắt gần như không nhận ra; còn lót mức 13
// giãn tới 32 lần thì mờ tịt, lộ rõ từng ô vuông. Có đủ hai tầng thì lúc nào cũng có ảnh "đỡ" ở mức
// gần nhất, ảnh nét về lúc nào là thay lúc đó.
const rasterLot2 = (tiles: string[]) => ({ type: 'raster' as const, tiles, tileSize: 256, maxzoom: 16 });
const BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  // Phông chữ tự chứa trong web (xem apps/frontend/public/fonts) — máy chủ openmaptiles trả file hỏng.
  glyphs: '/fonts/{fontstack}/{range}.pbf',
  sources: {
    'lot-street': rasterLot(BASES.street.tiles),
    'lot-satellite': rasterLot(BASES.satellite.tiles),
    'lot-terrain': rasterLot(BASES.terrain.tiles),
    'lot2-street': rasterLot2(BASES.street.tiles),
    'lot2-satellite': rasterLot2(BASES.satellite.tiles),
    'lot2-terrain': rasterLot2(BASES.terrain.tiles),
    'base-street': rasterSrc(BASES.street.tiles),
    'base-satellite': rasterSrc(BASES.satellite.tiles),
    'base-terrain': rasterSrc(BASES.terrain.tiles),
    'base-labels': rasterSrc(LABELS),
  },
  layers: [
    // Nền màu: chỗ nào chưa có ảnh thì ra màu xám nhạt như Google, KHÔNG còn màu trắng chói.
    { id: 'nen-mau', type: 'background', paint: { 'background-color': '#dfe3e8' } },
    // Lớp lót mờ (zoom thấp) nằm ngay dưới ảnh nét — luôn có sẵn nên không bao giờ để lộ ô trắng.
    { id: 'lot-street', type: 'raster', source: 'lot-street', paint: { 'raster-fade-duration': 0 } },
    { id: 'lot-satellite', type: 'raster', source: 'lot-satellite', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
    { id: 'lot-terrain', type: 'raster', source: 'lot-terrain', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
    { id: 'lot2-street', type: 'raster', source: 'lot2-street', paint: { 'raster-fade-duration': 0 } },
    { id: 'lot2-satellite', type: 'raster', source: 'lot2-satellite', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
    { id: 'lot2-terrain', type: 'raster', source: 'lot2-terrain', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
    // 'raster-fade-duration': 0 → ảnh tải xong hiện NGAY, không mờ dần 0,3 giây (đã có lớp lót đỡ bên dưới).
    { id: 'base-street', type: 'raster', source: 'base-street', paint: { 'raster-fade-duration': 0 } },
    { id: 'base-satellite', type: 'raster', source: 'base-satellite', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
    { id: 'base-terrain', type: 'raster', source: 'base-terrain', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
    { id: 'base-labels', type: 'raster', source: 'base-labels', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
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

// ── THỬA ĐANG CHỌN: VIỀN NEON CHẠY QUANH, CÓ CHẤM TRÒN DẪN ĐẦU ────────────────
// MỘT MÀU DUY NHẤT (xanh neon). Không pha màu thứ hai — pha vào là thành đường đứt
// quãng hai màu, mất hẳn cảm giác "đường neon đang chạy".
// Xanh neon SÁNG hơn tông cũ (#00e5ff) — nổi rõ hơn hẳn trên ảnh vệ tinh tối màu
// (cây cối, mái nhà) mà vẫn không lẫn với ranh thửa xanh dương và tuyến đường cam/vàng.
const MAU_NEON = '#4df3ff';
const MAU_CHAM = '#ffffff';   // chấm tròn dẫn đầu để TRẮNG cho bật hẳn lên

// Lấy ranh NGOÀI của thửa + độ dài dồn từng đoạn, để chấm tròn chạy ĐỀU quanh viền
// (không có bảng độ dài này thì chấm sẽ chạy nhanh ở cạnh ngắn, chậm ở cạnh dài).
function doVien(hl: any): { diem: number[][]; dai: number[]; tong: number } | null {
  const g = hl?.geometry;
  const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
  let ring: number[][] | null = null;
  for (const poly of polys) { const r = poly?.[0]; if (r && r.length > (ring?.length || 0)) ring = r; }
  if (!ring || ring.length < 3) return null;
  const co = Math.cos((ring[0][1] * Math.PI) / 180);   // bù độ hẹp kinh tuyến theo vĩ độ
  const dai: number[] = [0];
  for (let i = 1; i < ring.length; i++) {
    const dx = (ring[i][0] - ring[i - 1][0]) * co, dy = ring[i][1] - ring[i - 1][1];
    dai.push(dai[i - 1] + Math.hypot(dx, dy));
  }
  const tong = dai[dai.length - 1];
  return tong > 0 ? { diem: ring, dai, tong } : null;
}

/** Toạ độ của điểm nằm ở tỉ lệ `t` (0→1) tính theo chu vi thửa. */
function diemTaiTiLe(v: { diem: number[][]; dai: number[]; tong: number }, t: number): number[] {
  const moc = v.tong * (t - Math.floor(t));
  let i = 1;
  while (i < v.dai.length - 1 && v.dai[i] < moc) i++;
  const d0 = v.dai[i - 1], d1 = v.dai[i];
  const k = d1 > d0 ? (moc - d0) / (d1 - d0) : 0;
  const a = v.diem[i - 1], b = v.diem[i];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
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
      const chu = d < 10 ? d.toFixed(1) + 'm' : Math.round(d) + 'm';
      // Mức phóng TỐI THIỂU để cạnh này được ghi số đo: chỉ ghi khi trên màn hình cạnh dài
      // hơn chính con chữ. Thửa ranh cong có hàng trăm cạnh ngắn 1–2m — nếu ghi hết thì ở
      // mức phóng xa cả đường ranh bị chữ phủ trắng, không đọc được gì (xem hàm locCanhTheoZoom).
      const rongChuPx = chu.length * 6.2 + 10;
      const minz = Math.log2(rongChuPx * 156543.03392 * Math.cos(latR) / d);
      out.push({ type: 'Feature', properties: { len: chu, rot, minz: Math.round(minz * 100) / 100 }, geometry: { type: 'Point', coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] } });
    }
    const n = ring.length - 1;
    const cx = ring.slice(0, n).reduce((s: number, p: number[]) => s + p[0], 0) / n;
    const cy = ring.slice(0, n).reduce((s: number, p: number[]) => s + p[1], 0) / n;
    // Diện tích ghi giữa thửa: ưu tiên con số CHÍNH THỨC do máy chủ đo (cùng nguồn với bảng
    // "Thông tin thửa") để hai chỗ không lệch nhau. Máy chủ đo trên mặt cầu Trái Đất, còn công thức
    // tính tại chỗ dưới đây chỉ là phép gần đúng nên lệch được vài mét vuông — chỉ dùng khi
    // không có số của máy chủ (vd thửa người dùng tự vẽ từ bảng toạ độ).
    const soMayChu = Number(hl.properties?.dienTichChinhThuc);
    const area = (polys.length === 1 && Number.isFinite(soMayChu) && soMayChu > 0) ? soMayChu : ringAreaM2(ring);
    out.push({ type: 'Feature', properties: { area: (area >= 1000 ? Math.round(area).toLocaleString('vi') : area.toFixed(1)) + ' m²' }, geometry: { type: 'Point', coordinates: [cx, cy] } });
  }
  return out;
}

export default function MapView({ center, zoom, className, layers = [], markers = [], overlays = [], baseMap = 'street', labels = true, measureMode = 'off', focusPoint = null, flyToPoint = null, highlight = null, initialBounds, adMarkers = [], adOpacity = 1, fitTo = null, onMapClick, onMeasure, onViewport, textLabels = [], routes = [], onPickRoute, diaChinhTiles = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const focusMarker = useRef<Marker | null>(null);
  const adRefs = useRef<Marker[]>([]);
  const labelRefs = useRef<Marker[]>([]);
  const adOpacityRef = useRef(adOpacity); adOpacityRef.current = adOpacity;
  const wmRef = useRef<HTMLDivElement | null>(null);
  const onViewportRef = useRef(onViewport); onViewportRef.current = onViewport;
  const onPickRouteRef = useRef(onPickRoute); onPickRouteRef.current = onPickRoute;
  const routeLabelRefs = useRef<Marker[]>([]);
  const readyRef = useRef(false);
  const measureModeRef = useRef<MeasureMode>(measureMode);
  const measurePts = useRef<{ lng: number; lat: number }[]>([]);
  // Giữ địa chỉ ô địa chính trong ref: nếu vé xem về TRƯỚC khi bản đồ nạp xong thì
  // lúc nạp xong vẫn đọc được giá trị mới nhất (đọc thẳng biến sẽ dính giá trị cũ).
  const dcTilesRef = useRef(diaChinhTiles); dcTilesRef.current = diaChinhTiles;
  const initialBoundsRef = useRef(initialBounds);
  initialBoundsRef.current = initialBounds;
  const didFitRef = useRef(false);
  const zCanhRef = useRef(-1); // mức phóng lần cuối đã lọc nhãn độ dài cạnh

  // ── VIỀN CHẠY QUANH THỬA ĐANG CHỌN (kiểu tuyến đang dẫn đường) ─────────────
  // Một vạch trắng chạy vòng quanh viền xanh, y như tuyến đường trên app chỉ đường.
  // Cách làm: cứ mỗi nhịp lại đổi kiểu nét đứt của lớp viền trắng, mỗi bước dịch nét đi một
  // chút — mắt nhìn thành vệt sáng chạy. Chỉ chạy khi ĐANG chọn thửa; bỏ chọn, rời trang hay
  // thu nhỏ trình duyệt là dừng ngay, không để nó quay vô ích làm nóng máy tốn pin điện thoại.
  const NHIP_CHAY = 50;      // ms mỗi bước (20 hình/giây) — đủ mượt mà không tốn pin
  const MOT_VONG = 4000;     // ms để chấm tròn chạy hết một vòng quanh thửa
  const chayRef = useRef<number | null>(null);
  const vienRef = useRef<ReturnType<typeof doVien>>(null);   // ranh thửa + độ dài dồn
  function batVienChay() {
    if (chayRef.current != null) return;                 // đang chạy rồi thì thôi
    let t = 0;   // vị trí chấm tròn trên chu vi, 0 → 1
    chayRef.current = window.setInterval(() => {
      const map = mapRef.current;
      if (!map || !map.getLayer('highlight-dau')) return;
      if (typeof document !== 'undefined' && document.hidden) return;   // trang bị ẩn → nghỉ
      try {
        // Chấm tròn bò dọc theo ranh thửa, hết một vòng là quay lại từ đầu.
        const v = vienRef.current;
        const src = map.getSource('highlight-dau') as maplibregl.GeoJSONSource | undefined;
        if (v && src) {
          t = (t + NHIP_CHAY / MOT_VONG) % 1;
          src.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: diemTaiTiLe(v, t) } } as any);
        }
      } catch { /* bản đồ đang dựng lại */ }
    }, NHIP_CHAY);
  }
  function tatVienChay() {
    if (chayRef.current == null) return;
    window.clearInterval(chayRef.current);
    chayRef.current = null;
    const src = mapRef.current?.getSource('highlight-dau') as maplibregl.GeoJSONSource | undefined;
    try { src?.setData({ type: 'FeatureCollection', features: [] } as any); } catch { /* */ }
  }

  // ── PHÂN BIỆT "LƯỚT BẢN ĐỒ" VỚI "BẤM CHỌN THỬA" ─────────────────────────────
  // Với CHUỘT thì thư viện bản đồ tự lo: kéo quá 3 điểm ảnh là nó bỏ qua cú bấm.
  // Nhưng với NGÓN TAY thì hỏng: lướt xong nhả tay ra, trình duyệt còn bắn thêm một bộ
  // "chuột giả" (mousedown + mouseup + click) NGAY TẠI CHỖ NHẢ TAY. Thư viện chỉ so chỗ
  // bấm chuột với chỗ nhả chuột — hai chỗ này trùng nhau — nên nó tưởng người dùng vừa
  // bấm đứng yên → mở luôn bảng thông tin thửa. Đây chính là lỗi "kéo lướt mà dính chọn thửa".
  // Cách chặn: nhớ chỗ ĐẶT NGÓN TAY lúc bắt đầu, tới lúc có cú bấm thì so với chỗ đó.
  // Cú "chuột giả" sinh ra từ chạm phải bị bỏ qua, nếu không nó ghi đè mất chỗ đặt tay.
  const NGUONG_CHUOT = 5, NGUONG_CHAM = 12; // điểm ảnh
  const CHO_CHUOT_GIA = 800;                // ms — trong khoảng này mọi sự kiện chuột đều là giả
  const CHO_SAU_KEO = 350;                  // ms — vừa kéo xong thì cú bấm ngay sau đó là của cú kéo
  const diemDat = useRef<{ x: number; y: number; cham: boolean } | null>(null);
  const lucChamCuoi = useRef(0);
  const lucKeoCuoi = useRef(0);
  const daKeo = useRef(false);
  // CHỈ ĐỌC, không xoá dấu vết — vì một cú bấm có thể chạy qua nhiều chỗ xử lý (bấm nền bản đồ,
  // bấm trúng tuyến đường…), xoá ở chỗ đầu thì chỗ sau lại tưởng là bấm thật. Dấu vết được
  // đặt lại ở lần đặt tay kế tiếp.
  function laKeoChuKhongPhaiBam(e: any): boolean {
    if (daKeo.current) return true;
    // Bản đồ vừa bị NGƯỜI DÙNG làm xê dịch xong (kéo, chụm ngón, lăn chuột) → cú bấm ngay sau đó
    // là cái đuôi của động tác kéo chứ không phải chọn thửa. Đây là lớp chặn ăn chắc nhất vì nó
    // nhìn vào việc bản đồ CÓ THẬT SỰ CHẠY hay không, không phụ thuộc chỗ đặt chuột được ghi lại
    // hay không (bấm trúng ghim giá, chữ mờ… là thư viện không ghi được chỗ đặt chuột).
    if (Date.now() - lucKeoCuoi.current < CHO_SAU_KEO) return true;
    const map = mapRef.current;
    if (map && (map.isMoving() || map.isZooming())) return true;   // đang trôi theo đà, bấm để dừng lại
    const d = diemDat.current;
    if (!d || !e?.point) return false;
    return Math.hypot(e.point.x - d.x, e.point.y - d.y) > (d.cham ? NGUONG_CHAM : NGUONG_CHUOT);
  }

  // Khớp khung đúng vùng quy hoạch ngay khi mở (chỉ chạy 1 lần, khi container đã có kích thước thật).
  function tryInitialFit() {
    const map = mapRef.current, c = containerRef.current, b = initialBoundsRef.current;
    if (!map || !readyRef.current || didFitRef.current || !b || !c) return;
    if (c.clientWidth < 50 || c.clientHeight < 50) return;
    map.fitBounds(b as any, { padding: 28, animate: false, maxZoom: 16 });
    didFitRef.current = true;
  }

  // Chỉ ghi số đo những cạnh ĐỦ DÀI trên màn hình: cạnh nào ngắn hơn con chữ thì giấu đi.
  // Thửa có ranh cong (hàng trăm đỉnh, mỗi cạnh 1–2m) nếu ghi hết sẽ phủ trắng cả đường ranh
  // khi nhìn xa; càng phóng to thì càng nhiều cạnh đủ chỗ để hiện số.
  function locCanhTheoZoom(batBuoc = false) {
    const map = mapRef.current;
    if (!map || !map.getLayer('hl-edge')) return;
    // Làm tròn 1/4 mức phóng: kéo zoom là sự kiện bắn liên tục, đặt lại bộ lọc mỗi khung hình
    // sẽ giật; đổi 1/4 mức mới đặt lại một lần là mắt không nhận ra khác biệt.
    const z = Math.round(map.getZoom() * 4) / 4;
    if (!batBuoc && z === zCanhRef.current) return;
    zCanhRef.current = z;
    map.setFilter('hl-edge', ['all', ['has', 'len'], ['<=', ['get', 'minz'], z]] as any);
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Mấy tuỳ chọn dưới đây là phần LỚN nhất giúp bản đồ hết trắng:
    //  · fadeDuration 0  → ảnh tải xong hiện NGAY, không mờ dần 0,3 giây như mặc định;
    //  · maxTileCacheSize → nhớ nhiều ô ảnh trong máy, kéo qua kéo lại vùng cũ là có ngay, khỏi tải lại;
    //  · refreshExpiredTiles false → không đi tải lại ảnh "hết hạn" (Google ghi hạn rất ngắn) nên không nhấp nháy.
    const map = new maplibregl.Map({
      container: containerRef.current, style: BASE_STYLE, center: center ?? MAP.center, zoom: zoom ?? MAP.zoom, maxZoom: 22,
      fadeDuration: 0, maxTileCacheSize: soOAnhNenGiu(0.4), refreshExpiredTiles: false,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    // Định vị GPS: đưa bản đồ về vị trí người dùng, có chấm xanh + theo dõi khi di chuyển.
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserHeading: true, showAccuracyCircle: true } as any), 'top-right');
    map.on('load', () => {
      readyRef.current = true;
      map.addSource('measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'measure-fill', type: 'fill', source: 'measure', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.2 } });
      map.addLayer({ id: 'measure-line', type: 'line', source: 'measure', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#ea580c', 'line-width': 2.5, 'line-dasharray': [2, 1] } });
      map.addLayer({ id: 'measure-pts', type: 'circle', source: 'measure', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 4, 'circle-color': '#ea580c', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
      map.addSource('highlight', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      // ── THỬA ĐANG CHỌN: viền xanh dương mảnh, KHÔNG tô nền ─────────────────
      // Làm theo đúng kiểu app tham chiếu: để trống ruột thửa thì nhìn rõ hiện trạng đất bên
      // trong (nhà, cây, đường đi) — trước đây tô vàng đục 35% che mất, ảnh vệ tinh gần như
      // không đọc được. Dấu hiệu nhận biết thửa nằm ở viền xanh + số đo cạnh là đủ rõ.
      map.addLayer({ id: 'highlight-fill', type: 'fill', source: 'highlight', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#00a2ff', 'fill-opacity': 0 } });
      // BA LỚP, CÙNG MỘT MÀU NEON — KHÔNG nét đứt, KHÔNG màu thứ hai:
      //  1. quầng sáng toả ra (nhoè) → cảm giác đèn neon
      //  2. đường viền LIỀN MẠCH, đây chính là "tuyến"
      //  3. chấm tròn chạy trên tuyến
      map.addLayer({ id: 'highlight-quang', type: 'line', source: 'highlight', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': MAU_NEON, 'line-width': 11, 'line-opacity': 0.4, 'line-blur': 6 } });
      map.addLayer({ id: 'highlight-line', type: 'line', source: 'highlight', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': MAU_NEON, 'line-width': 3.2 } });
      map.addSource('highlight-dau', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      // Chấm tròn dẫn đầu: quầng neon toả ra + lõi TRẮNG đặc ở giữa cho nổi bật.
      map.addLayer({ id: 'highlight-dau-quang', type: 'circle', source: 'highlight-dau', paint: { 'circle-radius': 11, 'circle-color': MAU_NEON, 'circle-opacity': 0.45, 'circle-blur': 1 } });
      map.addLayer({ id: 'highlight-dau', type: 'circle', source: 'highlight-dau', paint: { 'circle-radius': 5, 'circle-color': MAU_CHAM, 'circle-stroke-width': 1.6, 'circle-stroke-color': MAU_NEON } });
      // Kích thước thửa kiểu Guland: độ dài từng cạnh (dọc cạnh) + diện tích ở giữa
      map.addSource('highlight-dims', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      // 'text-allow-overlap' để MẶC ĐỊNH (false) → chữ nào chồng lên chữ khác thì tự giấu bớt.
      // Trước đây bật cho hiện hết nên thửa nhiều đỉnh bị chữ đè lên nhau thành một vệt trắng.
      map.addLayer({ id: 'hl-edge', type: 'symbol', source: 'highlight-dims', filter: ['all', ['has', 'len'], ['<=', ['get', 'minz'], map.getZoom()]], layout: { 'text-field': ['get', 'len'], 'text-size': 12.5, 'text-font': ['Noto Sans Regular'], 'text-rotate': ['get', 'rot'], 'text-rotation-alignment': 'map', 'text-keep-upright': true, 'text-padding': 3 }, paint: { 'text-color': '#0A2540', 'text-halo-color': '#ffffff', 'text-halo-width': 2.6, 'text-halo-blur': 0.2 } });
      map.addLayer({ id: 'hl-area', type: 'symbol', source: 'highlight-dims', filter: ['has', 'area'], layout: { 'text-field': ['get', 'area'], 'text-size': 14.5, 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#0A2540', 'text-halo-color': '#ffffff', 'text-halo-width': 3, 'text-halo-blur': 0.2 } });
      // HOÀNG SA · TRƯỜNG SA — chồng lên trên cùng, luôn bật. Ảnh nền của nhà cung cấp nước ngoài
      // hay bỏ trống hai quần đảo này; lớp đây vẽ đè lên nên ảnh chụp màn hình bản đồ không bị bắt bẻ.
      themLopBienDao(map);
      syncBase(); syncOverlays(); syncLayers(); syncDiaChinh(); syncRoutes(); tryInitialFit();
      map.on('zoom', locCanhTheoZoom);
    });
    // Ghi lại chỗ ĐẶT tay/chuột để lát nữa so với chỗ nhả ra (xem laKeoChuKhongPhaiBam).
    map.on('touchstart', (e: any) => {
      lucChamCuoi.current = Date.now();
      diemDat.current = e?.point ? { x: e.point.x, y: e.point.y, cham: true } : null;
      daKeo.current = false;
    });
    map.on('touchend', () => { lucChamCuoi.current = Date.now(); });
    map.on('mousedown', (e: any) => {
      // Vừa chạm xong → đây là "chuột giả" do trình duyệt bịa ra, KHÔNG được ghi đè chỗ đặt ngón tay.
      if (Date.now() - lucChamCuoi.current < CHO_CHUOT_GIA) return;
      diemDat.current = e?.point ? { x: e.point.x, y: e.point.y, cham: false } : null;
      daKeo.current = false;
    });
    // Xoay bằng tay thì chắc chắn không phải chọn thửa.
    map.on('rotatestart', () => { daKeo.current = true; });
    // Bản đồ xê dịch DO NGƯỜI DÙNG (có `originalEvent`) → ghi lại thời điểm. Chuyển động do máy
    // tự chạy (bay tới thửa, khớp khung) không có `originalEvent` nên không tính.
    map.on('move', (e: any) => { if (e?.originalEvent) lucKeoCuoi.current = Date.now(); });
    map.on('zoomstart', (e: any) => { if (e?.originalEvent) daKeo.current = true; });
    map.on('click', (e) => {
      const tgt = e.originalEvent?.target as HTMLElement | null;
      if (tgt && tgt.closest && tgt.closest('.maplibregl-marker')) return; // bấm trúng marker (pin giá, quảng cáo, điểm lưu) → chỉ mở popup của nó, KHÔNG xử lý như click bản đồ
      if (laKeoChuKhongPhaiBam(e)) return;                                // đang lướt bản đồ chứ không chọn thửa
      if (measureModeRef.current !== 'off') addMeasurePoint(e.lngLat.lng, e.lngLat.lat);
      else if (onMapClick) onMapClick(e.lngLat.lng, e.lngLat.lat);
    });
    map.getCanvas().style.cursor = '';
    // Bật bộ TẢI TRƯỚC ô ảnh (đoán hướng kéo + vành đai quanh màn hình) — xem lib/tilePrefetch.ts
    const tatTaiTruoc = batTaiTruoc(map);
    mapRef.current = map;
    // Tay cầm để soi bản đồ khi cần kiểm tra sự cố (gõ __banDo trong Console của trình duyệt).
    // Chỉ đọc trạng thái, không ảnh hưởng gì tới người dùng.
    (window as any).__banDo = map;
    map.on('error', (e: any) => console.error('[bản đồ] lỗi:', e?.error?.message || e?.error || e));
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
    return () => { ro?.disconnect(); tatTaiTruoc(); tatVienChay(); map.remove(); mapRef.current = null; readyRef.current = false; didFitRef.current = false; };
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
    (['street', 'satellite', 'terrain'] as BaseMap[]).forEach((b) => {
      map.setLayoutProperty(`base-${b}`, 'visibility', b === baseMap ? 'visible' : 'none');
      for (const lot of [`lot-${b}`, `lot2-${b}`])   // hai tầng lót đi theo nền đang chọn
        if (map.getLayer(lot)) map.setLayoutProperty(lot, 'visibility', b === baseMap ? 'visible' : 'none');
    });
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
    themLopBienDao(map);   // thêm lớp phủ xong thì đẩy Hoàng Sa · Trường Sa lên trên cùng lại
  }
  useEffect(() => { syncOverlays(); /* eslint-disable-next-line */ }, [overlays]);

  // ==== CHỈ ĐƯỜNG: vẽ nhiều phương án, bấm để chọn (giống Google Maps) ====
  // Mỗi tuyến vẽ 2 nét chồng nhau: nét TRẮNG to bên dưới làm viền cho nổi trên ảnh vệ tinh,
  // nét màu nhỏ hơn nằm trên. Tuyến đang chọn màu xanh Google (#1a73e8), tuyến khác màu xám (#9aa0a6).
  function syncRoutes() {
    const map = mapRef.current; if (!map || !readyRef.current) return;
    if (!routes.length && !map.getSource('tuyen')) return;   // trang không dùng chỉ đường thì bỏ qua hẳn
    const fc: any = {
      type: 'FeatureCollection',
      features: (routes || []).map((r) => ({ type: 'Feature', properties: { id: r.id, chon: r.chon ? 1 : 0 }, geometry: r.hinh })),
    };
    const src = map.getSource('tuyen') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(fc);
    else {
      map.addSource('tuyen', { type: 'geojson', data: fc });
      const net = (id: string, chon: number, mau: string, rong: number) => ({
        id, type: 'line' as const, source: 'tuyen', filter: ['==', ['get', 'chon'], chon] as any,
        layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
        paint: { 'line-color': mau, 'line-width': rong, ...(chon ? {} : { 'line-opacity': 0.85 }) },
      });
      // Thứ tự thêm = thứ tự vẽ: tuyến phụ nằm dưới, tuyến đang chọn nằm trên cùng.
      map.addLayer(net('tuyen-phu-vien', 0, '#ffffff', 9) as any);
      map.addLayer(net('tuyen-phu', 0, '#9aa0a6', 5.5) as any);
      map.addLayer(net('tuyen-vien', 1, '#ffffff', 13) as any);
      map.addLayer(net('tuyen-chinh', 1, '#1a73e8', 8) as any);
      // Bấm vào tuyến xám → chọn tuyến đó. Vùng bấm là nét trắng to nên ngón tay dễ trúng.
      const bam = (e: any) => {
        const f = e.features && e.features[0]; if (!f) return;
        if (laKeoChuKhongPhaiBam(e)) return;   // đang kéo bản đồ, không phải chọn tuyến
        e.originalEvent?.stopPropagation?.();
        onPickRouteRef.current?.(Number(f.properties?.id));
      };
      for (const id of ['tuyen-phu-vien', 'tuyen-phu']) {
        map.on('click', id, bam);
        map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
      }
    }
    for (const id of ['tuyen-phu-vien', 'tuyen-phu', 'tuyen-vien', 'tuyen-chinh']) if (map.getLayer(id)) map.moveLayer(id);
    themLopBienDao(map);
    try { map.triggerRepaint(); } catch { /* ignore */ }   // vẽ lại NGAY, không đợi tới lúc người dùng chạm vào bản đồ

    // Nhãn "12 phút" đặt giữa mỗi tuyến — bấm nhãn cũng chọn được tuyến (dễ bấm hơn nét đường trên điện thoại).
    routeLabelRefs.current.forEach((m) => m.remove()); routeLabelRefs.current = [];
    for (const r of routes || []) {
      const c = (r.hinh?.coordinates || []) as [number, number][];
      if (c.length < 2 || !r.nhan) continue;
      let tong = 0; const kc = (a: number[], b: number[]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let i = 1; i < c.length; i++) tong += kc(c[i - 1], c[i]);
      let di = 0, giua = c[Math.floor(c.length / 2)];
      for (let i = 1; i < c.length; i++) { di += kc(c[i - 1], c[i]); if (di >= tong / 2) { giua = c[i]; break; } }
      const el = document.createElement('div');
      el.style.cssText = `font:700 12px/1 system-ui,'Segoe UI',Arial,sans-serif;padding:5px 9px;border-radius:999px;white-space:nowrap;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.35);border:1px solid rgba(0,0,0,.08);${r.chon ? 'background:#1a73e8;color:#fff;' : 'background:#fff;color:#3c4043;'}`;
      el.textContent = r.nhan;
      el.addEventListener('click', (ev) => { ev.stopPropagation(); onPickRouteRef.current?.(r.id); });
      routeLabelRefs.current.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(giua).addTo(map));
    }
  }
  useEffect(() => { syncRoutes(); /* eslint-disable-next-line */ }, [routes]);
  useEffect(() => () => { routeLabelRefs.current.forEach((m) => m.remove()); routeLabelRefs.current = []; }, []);

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
    themLopBienDao(map);   // lớp GIS mới thêm cũng không được che tên hai quần đảo
  }
  useEffect(() => { syncLayers(); /* eslint-disable-next-line */ }, [layers]);

  // ══ BẢN ĐỒ ĐỊA CHÍNH — Ô VECTOR, LUÔN BẬT ══════════════════════════════════
  // Máy chủ chỉ phát ô ở mức phóng 16; gần hơn thì trình duyệt tự phóng to ô đó lên
  // (đó là lý do đặt maxzoom 16) — vừa nét, vừa không phải giữ nhiều mức ô trên máy chủ.
  // Thửa chỉ hiện từ mức 16 trở đi, xa hơn thì ẩn cho bản đồ thoáng.
  const DC_MIN_ZOOM = 16;
  function syncDiaChinh() {
    const map = mapRef.current; if (!map || !readyRef.current) return;
    const tiles = dcTilesRef.current;
    const src = map.getSource('src-dia-chinh') as any;
    if (!tiles || !tiles.length) {
      // Chưa có vé xem → chỉ ẩn đi, KHÔNG gỡ lớp (gỡ rồi dựng lại gây chớp bản đồ).
      for (const id of ['dc-fill', 'dc-line', 'dc-nhan']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      return;
    }
    if (src) {
      // Vé mới → chỉ thay địa chỉ ô, giữ nguyên lớp và những ô đã tải.
      if (typeof src.setTiles === 'function') src.setTiles(tiles);
      for (const id of ['dc-fill', 'dc-line', 'dc-nhan']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
      return;
    }
    map.addSource('src-dia-chinh', { type: 'vector', tiles, minzoom: 16, maxzoom: 16 } as any);
    // Nền thửa: xanh rất nhạt, đậm dần khi phóng to.
    map.addLayer({
      id: 'dc-fill', type: 'fill', source: 'src-dia-chinh', 'source-layer': 'dc', minzoom: DC_MIN_ZOOM,
      paint: { 'fill-color': '#1e88e5', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 16, 0.08, 18, 0.16] as any },
    } as any);
    // Viền thửa
    map.addLayer({
      id: 'dc-line', type: 'line', source: 'src-dia-chinh', 'source-layer': 'dc', minzoom: DC_MIN_ZOOM,
      paint: { 'line-color': '#1565c0', 'line-width': ['interpolate', ['linear'], ['zoom'], 16, 1.1, 18, 2.2, 20, 3] as any, 'line-opacity': 1 },
    } as any);
    // Số thửa — chỉ hiện khi đã phóng khá gần cho đỡ rối.
    map.addLayer({
      id: 'dc-nhan', type: 'symbol', source: 'src-dia-chinh', 'source-layer': 'dc', minzoom: 17,
      layout: { 'text-field': ['get', 's'], 'text-size': ['interpolate', ['linear'], ['zoom'], 17, 10, 20, 13] as any,
                'text-font': ['Noto Sans Regular'], 'text-allow-overlap': false },
      paint: { 'text-color': '#0d47a1', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.2 },
    } as any);
    themLopBienDao(map);   // hai quần đảo luôn nằm trên cùng
  }
  useEffect(() => { syncDiaChinh(); /* eslint-disable-next-line */ }, [diaChinhTiles]);

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
    // Dựng lại ghim là việc NẶNG (xoá rồi tạo lại từng thẻ HTML). Vị trí ghim thì bản đồ tự lo,
    // nên chỉ cần dựng lại khi mức zoom vừa vượt qua một ngưỡng "bung pill" — kéo bản đồ qua lại
    // không còn phải dựng lại gì cả, nhờ vậy hết giật ở chỗ có nhiều tin.
    const chuKy = () => { const z = map.getZoom() || 0; return Object.values(PILL_MINZ).map((n) => (z >= n ? 1 : 0)).join(''); };
    let kyTruoc = chuKy();
    render();
    const khiKeoXong = () => { const k = chuKy(); if (k === kyTruoc) return; kyTruoc = k; render(); };
    map.on('moveend', khiKeoXong);
    return () => { map.off('moveend', khiKeoXong); markerRefs.current.forEach((mk) => mk.remove()); markerRefs.current = []; };
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
    // Nhãn chỉ ẩn/hiện theo MỨC ZOOM, mà bản đồ tự giữ đúng vị trí cho chúng → chỉ dựng lại khi
    // zoom nhích qua nửa mức. Kéo ngang dọc thì không đụng gì, đỡ giật.
    let zTruoc = Math.round((map.getZoom() || 0) * 2);
    const khiKeoXong = () => { const z = Math.round((map.getZoom() || 0) * 2); if (z === zTruoc) return; zTruoc = z; build(); };
    map.on('moveend', khiKeoXong);
    return () => { map.off('moveend', khiKeoXong); labelRefs.current.forEach((m) => m.remove()); labelRefs.current = []; };
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
    locCanhTheoZoom(true);
    ['highlight-fill', 'highlight-quang', 'highlight-line', 'highlight-dau-quang', 'highlight-dau', 'hl-edge', 'hl-area']
      .forEach((id) => { if (map.getLayer(id)) map.moveLayer(id); });
    // Có thửa đang chọn thì cho vệt sáng + chấm tròn chạy quanh viền; bỏ chọn thì dừng hẳn cho đỡ tốn pin.
    vienRef.current = highlight ? doVien(highlight) : null;
    if (highlight && vienRef.current) batVienChay(); else tatVienChay();
  }, [highlight]);

  return <div ref={containerRef} className={className ?? 'h-full w-full'} />;
}
