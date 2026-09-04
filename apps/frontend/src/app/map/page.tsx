'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ocrImage, uploadImages, thumbUrl } from '@/lib/api';
import type { GeoLayer, ImageOverlay, BaseMap, MeasureMode, MeasureResult, TuyenVe } from '@/components/MapView';
import { GisLayer, formatVnd } from '@/lib/types';
import { vn2000ToWgs84, wgs84ToVn2000 } from '@/lib/vn2000';
import { openPhieuQh, phieuQhHtml } from '@/lib/phieuQh';
import { getToken } from '@/lib/token';
import { API_BASE } from '@/lib/config';
import { useAuth, laAdmin, coVaiTro } from '@/lib/auth';
import { listMyPlaces, listAllPlaces, addPlace, removePlace, type SavedPlace } from '@/lib/savedPlaces';
import { listCustomers, listInterests, addInterest, removeInterest, type Customer, type Interest } from '@/lib/crm';
import { Skeleton } from '@/components/ui';
import type { Diem } from '@/components/ChiDuongPanel';

// Bỏ dấu tiếng Việt để gõ tìm không cần dấu: gõ "cam lam" vẫn ra "Cam Lâm".
const boDauVn = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Ô CHỌN CÓ GÕ TÌM — nhìn như ô sổ xuống bình thường, nhưng bấm vào là gõ tìm được ngay
// (gõ không dấu cũng ra). Dùng cho ô chọn huyện/TP cũ và ô chọn xã/phường.
// Đặt NGOÀI trang chính: nếu để bên trong, mỗi lần trang vẽ lại thì ô này bị dựng lại từ đầu
// và con trỏ đang gõ sẽ nhảy ra ngoài.
function OChonCoGo({ nhan, dsMuc, giaTri, khiChon, className }: {
  nhan: string;
  dsMuc: { id: string; ten: string; phu?: string }[];
  giaTri: string;
  khiChon: (id: string) => void;
  className?: string;
}) {
  const [go, setGo] = useState('');
  const [daGo, setDaGo] = useState(false);   // đã bắt đầu gõ hay chưa (chưa gõ thì sổ ĐỦ danh sách)
  const [mo, setMo] = useState(false);
  const boc = useRef<HTMLDivElement>(null);
  const dongDangChon = useRef<HTMLButtonElement>(null);

  const dong = () => { setMo(false); setGo(''); setDaGo(false); };
  useEffect(() => {
    const bamRaNgoai = (e: MouseEvent) => { if (boc.current && !boc.current.contains(e.target as Node)) dong(); };
    document.addEventListener('mousedown', bamRaNgoai);
    return () => document.removeEventListener('mousedown', bamRaNgoai);
  }, []);
  // Mở ra là cuộn thẳng tới xã đang chọn, khỏi phải lăn chuột tìm giữa cả trăm dòng.
  useEffect(() => { if (mo && dongDangChon.current) dongDangChon.current.scrollIntoView({ block: 'center' }); }, [mo]);

  const dangChon = dsMuc.find((m) => m.id === giaTri)?.ten || '';
  // HAI CÁCH DÙNG: (1) bấm vào rồi lăn chọn trong danh sách đầy đủ — ô vẫn hiện xã đang chọn;
  //                (2) gõ tên để lọc nhanh — gõ chữ đầu tiên là danh sách rút gọn lại ngay.
  const q = daGo ? boDauVn(go.trim()) : '';
  const loc = q ? dsMuc.filter((m) => boDauVn(m.ten).includes(q) || (m.phu ? boDauVn(m.phu).includes(q) : false)) : dsMuc;
  const oNhap = useRef<HTMLInputElement>(null);
  // Chọn xong thì nhả con trỏ ra khỏi ô, nếu không lần bấm sau sẽ không mở lại được danh sách
  // (vì ô vẫn đang được chọn nên trình duyệt không báo "vừa bấm vào ô" nữa).
  const chon = (id: string) => { khiChon(id); dong(); oNhap.current?.blur(); };

  return (
    <div ref={boc} className={`relative ${className || ''}`}>
      {/* Có CẢ onFocus lẫn onClick: bấm lần đầu thì onFocus lo, còn khi con trỏ đã sẵn trong ô
          (vừa chọn xong) thì trình duyệt không báo "vừa bấm vào ô" nữa nên phải nhờ onClick. */}
      <input
        ref={oNhap}
        value={daGo ? go : dangChon}
        placeholder={nhan}
        onFocus={(e) => { setMo(true); setDaGo(false); e.currentTarget.select(); }}
        onClick={(e) => { setMo(true); setDaGo(false); e.currentTarget.select(); }}
        onChange={(e) => { setGo(e.target.value); setDaGo(true); setMo(true); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && loc.length) { e.preventDefault(); chon(loc[0].id); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') dong();
        }}
        className={`border rounded-lg pl-2.5 pr-6 py-1.5 text-xs w-full bg-white truncate ${giaTri ? 'border-[#0A2540] font-semibold text-[#0A2540]' : 'border-slate-300'}`} />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[9px]">▼</span>
      {mo && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto scroll-soft">
          {giaTri && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chon('')}
              className="w-full text-left px-2.5 py-1.5 text-[11px] text-slate-400 hover:bg-slate-50 border-b border-slate-100 sticky top-0 bg-white">— Bỏ chọn —</button>
          )}
          {loc.length === 0 && <div className="px-2.5 py-2 text-[11px] text-slate-400">Không tìm thấy</div>}
          {loc.map((m) => (
            <button key={m.id} type="button" ref={m.id === giaTri ? dongDangChon : undefined}
              onMouseDown={(e) => e.preventDefault()} onClick={() => chon(m.id)}
              className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 border-b last:border-b-0 border-slate-100 ${m.id === giaTri ? 'bg-amber-50' : ''}`}>
              <span className={`block text-xs truncate ${m.id === giaTri ? 'font-bold text-[#0A2540]' : 'font-medium text-slate-800'}`}>
                {m.id === giaTri ? '✓ ' : ''}{m.ten}
              </span>
              {m.phu && <span className="block text-[10px] text-slate-400 truncate">{m.phu}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="grid h-full w-full place-items-center bg-slate-100 text-slate-400"><div className="flex flex-col items-center gap-3"><svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg><span className="text-sm">Đang tải bản đồ…</span></div></div> });

const ChiDuongPanel = dynamic(() => import('@/components/ChiDuongPanel'), { ssr: false });

const DEFAULT_COLORS: Record<string, string> = {
  parcel: '#1e88e5', zoning: '#fb8c00', admin: '#7e57c2', road: '#455a64', custom: '#16a34a',
};
const RASTER_OVERLAYS = [
  { id: 'qh-qd205', name: 'Ảnh quy hoạch QĐ205', url: '/overlays/QD205.png',
    // Dùng TILE PNG RỜI (đuôi .png) → Cloudflare tự cache ở biên, mở quy hoạch cực nhanh trên điện thoại.
    // (Trước dùng pmtiles 147MB range-request động, không cache được, self-host còn phải tải runtime.)
    // Bộ tile render từ DGN (QD205) → z10-18, ĐẦY ĐỦ mọi zone.
    tiles: ['/tiles/qd205v11/{z}/{x}/{y}.png'], minzoom: 10, maxzoom: 18,
    coordinates: [[108.9401268, 12.217594], [109.2563886, 12.217594], [109.2563886, 11.9257021], [108.9401268, 11.9257021]] as [[number, number], [number, number], [number, number], [number, number]] },
];
const QH_BOUNDS: [[number, number], [number, number]] = [[108.9401268, 11.9257021], [109.2563886, 12.217594]];
const PARCEL_MIN_ZOOM = 14; // TẢI TRƯỚC dữ liệu thửa từ z14 (sẵn sàng, không lag khi zoom tới)
const PARCEL_SHOW_ZOOM = 16; // chỉ HIỂN THỊ ranh thửa khi zoom ≥ z16
const ZONING_MIN_ZOOM = 14; // lớp quy hoạch (vector) chỉ tải khi zoom gần — ở xa dùng ẢNH quy hoạch cho nhẹ

// (Đã BỎ hai danh sách xã ghi cứng ở đây.) Trước kia ô "Chọn xã" chỉ có 4 xã mới + 14 xã cũ
// của riêng huyện Cam Lâm, gõ tay trong mã nguồn. Nay dữ liệu địa chính phủ cả 147 xã/phường
// toàn tỉnh nên danh sách lấy THẲNG TỪ DATABASE qua /api/dc/danh-muc — thêm bớt xã không phải sửa code.

interface ParcelInfo {
  found: boolean; point: { lng: number; lat: number };
  parcel: { properties: Record<string, any>; soTo?: string | null; soThua?: string | null; xa?: string | null; areaM2?: number } | null;
  zoning: Record<string, any> | null;
  overlaps?: { layer: string; type: string; hz?: string; areaM2: number }[];
  // true = thửa nằm NGOÀI vùng đã có dữ liệu quy hoạch (hiện mới có huyện Cam Lâm cũ).
  // Phải nói thẳng cho người xem biết là "chưa có dữ liệu", đừng để trống.
  qhNgoaiVung?: boolean;
  listings: { id: number; title: string; price: number }[];
}
const fmtLen = (m: number) => (m >= 1000 ? (m / 1000).toFixed(3) + ' km' : m.toFixed(1) + ' m');
const fmtArea = (m2: number) => (m2 >= 10000 ? (m2 / 10000).toFixed(4) + ' ha (' + m2.toFixed(0) + ' m²)' : m2.toFixed(1) + ' m²');
// Lấy trường đầu tiên có giá trị trong properties (dữ liệu địa chính đặt tên khoá không thống nhất).
const pickProp = (p: Record<string, any> | undefined, keys: string[]) => { for (const k of keys) { const v = p?.[k]; if (v != null && String(v).trim() && String(v).trim() !== '0') return String(v).trim(); } return ''; };
// Màu badge loại đất theo ký hiệu (ODT/đất ở → hồng, lúa → vàng, cây/rừng → xanh…).
const landColor = (code: string) => { const c = (code || '').toUpperCase(); if (/^(ODT|OTC|ONT|TMD|SKC|TSC)/.test(c)) return 'bg-pink-100 text-pink-700'; if (/^(LUC|LUK|BHK|NHK|LUA)/.test(c)) return 'bg-amber-100 text-amber-700'; if (/^(CLN|RSX|RPH|RDD|LNP|NTS|COC|BCS)/.test(c)) return 'bg-emerald-100 text-emerald-700'; return 'bg-slate-100 text-slate-600'; };
// Tách toạ độ từ link Google Maps (…/@lat,lng…, !3dlat!4dlng, q=lat,lng, hoặc "lat,lng").
function parseGmap(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  let m = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/); if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/); if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/(?:[?&](?:q|query|ll|sll|destination)=|loc:)(-?\d+(?:\.\d+)?)[,+\s]+(-?\d+(?:\.\d+)?)/i); if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/); if (m) return { lat: +m[1], lng: +m[2] };
  return null;
}
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
  const ctx = cv.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
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
// Ảnh GỐC nén JPEG (<1MB) — cho engine mạnh (máy nội bộ / OCR.space / Gemini) đọc ảnh tự nhiên, ít nhầm số hơn ảnh nhị phân hoá.
function toJpeg(src: HTMLImageElement | HTMLCanvasElement, maxDim = 2200, q = 0.9): Promise<Blob> {
  const w0 = src instanceof HTMLCanvasElement ? src.width : ((src as HTMLImageElement).naturalWidth || 1);
  const h0 = src instanceof HTMLCanvasElement ? src.height : ((src as HTMLImageElement).naturalHeight || 1);
  const sc = Math.min(1, maxDim / Math.max(w0, h0));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w0 * sc)); cv.height = Math.max(1, Math.round(h0 * sc));
  cv.getContext('2d')!.drawImage(src, 0, 0, cv.width, cv.height);
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', q));
}
// Ảnh ĐÃ LÀM SẠCH cho AI đọc dễ nhất: xám hoá → LÀM PHẲNG NỀN (khử bóng/ánh sáng lệch + nền hoa văn bảo an của sổ đỏ) → tăng tương phản → LÀM NÉT (unsharp) → phóng to.
// Giữ ảnh XÁM (không nhị phân) nên Gemini/OCR.space vẫn đọc tự nhiên nhưng rõ hơn hẳn ảnh gốc. Kỹ thuật: chia cho trung bình cục bộ (illumination correction) + gamma + unsharp 3x3.
function enhanceForAI(src: HTMLImageElement | HTMLCanvasElement, maxDim = 2200, q = 0.92): Promise<Blob> {
  const w0 = (src as HTMLImageElement).naturalWidth || (src as HTMLCanvasElement).width;
  const h0 = (src as HTMLImageElement).naturalHeight || (src as HTMLCanvasElement).height;
  const scl = Math.max(1, Math.min(2, maxDim / Math.max(w0, h0)));
  const w = Math.max(1, Math.round(w0 * scl)), h = Math.max(1, Math.round(h0 * scl));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
  (ctx as any).imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h), d = im.data, n = w * h;
  // 1) Xám hoá.
  const g = new Float64Array(n);
  for (let p = 0; p < n; p++) { const k = p * 4; g[p] = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; }
  // 2) Làm phẳng nền: nền = trung bình cục bộ cửa sổ LỚN (ảnh tích phân) → CHIA → nền về gần trắng đều, khử bóng & làm mờ hoa văn bảo an; chữ giữ đậm.
  const integ = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let rs = 0; for (let x = 0; x < w; x++) { rs += g[y * w + x]; integ[(y + 1) * (w + 1) + (x + 1)] = integ[y * (w + 1) + (x + 1)] + rs; } }
  const half = Math.max(12, Math.floor(w / 12));
  const wm = new Float64Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x1 = Math.max(0, x - half), x2 = Math.min(w - 1, x + half), y1 = Math.max(0, y - half), y2 = Math.min(h - 1, y + half);
    const cnt = (x2 - x1 + 1) * (y2 - y1 + 1);
    const sum = integ[(y2 + 1) * (w + 1) + (x2 + 1)] - integ[y1 * (w + 1) + (x2 + 1)] - integ[(y2 + 1) * (w + 1) + x1] + integ[y1 * (w + 1) + x1];
    const bg = Math.max(1, sum / cnt);
    let v = (g[y * w + x] / bg) * 250; if (v > 255) v = 255;   // chia cho nền → trắng đều
    wm[y * w + x] = v;
  }
  // 3) Làm nét (unsharp 3x3) + gamma nhẹ cho chữ đậm hơn; xuất ảnh xám.
  const amt = 0.6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const blur = (wm[x > 0 ? i - 1 : i] + wm[x < w - 1 ? i + 1 : i] + wm[y > 0 ? i - w : i] + wm[y < h - 1 ? i + w : i]) * 0.25;
    let v = wm[i] + amt * (wm[i] - blur);                        // unsharp
    v = 255 * Math.pow(Math.min(1, Math.max(0, v / 255)), 1.25); // gamma → chữ đậm
    if (v < 0) v = 0; else if (v > 255) v = 255;
    const k = i * 4; d[k] = d[k + 1] = d[k + 2] = v;
  }
  ctx.putImageData(im, 0, 0);
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', q));
}
function engineLabel(e: string): string { return e === 'paste' ? 'dán tay' : 'AI Cam Lâm Land'; }
async function ocrToPoints(img: HTMLImageElement | HTMLCanvasElement): Promise<{ pts: { x: number; y: number }[]; msg: string; engine: string; raw: string }> {
  let status = '', engine = '', raw = '', firstText = '', firstEngine = '';
  let best: { x: number; y: number }[] = [];
  const keep = (pts: { x: number; y: number }[], eng: string, text: string) => { if (pts.length > best.length) { best = pts; engine = eng; raw = text; } };
  let pre: HTMLCanvasElement | null = null;
  const getPre = () => (pre ||= preprocess(img)); // chỉ nhị phân hoá khi cần (tiết kiệm CPU đường thành công)
  try {
    // Lần 1: ảnh ĐÃ LÀM SẠCH (xám + phẳng nền + tăng tương phản + làm nét) — engine mạnh (máy nội bộ/OCR.space/Gemini) đọc RÕ NHẤT, ít nhầm số.
    let r = await ocrImage(await enhanceForAI(img));
    firstText = r.text; firstEngine = r.engine;
    keep(parseBigPairs(r.text), r.engine, r.text);
    // Lần 2: chưa đủ → ảnh nhị phân hoá (đỡ cho Tesseract khi không có engine mạnh).
    if (best.length < 3) { r = await ocrImage(await toBlob(getPre())); keep(parseBigPairs(r.text), r.engine, r.text); }
    // Lần 3: vẫn thiếu → ảnh GỐC tự nhiên (phòng khi ảnh vốn đã sạch, tránh xử lý quá tay).
    if (best.length < 3) { r = await ocrImage(await toJpeg(img)); keep(parseBigPairs(r.text), r.engine, r.text); }
  } catch (e: any) {
    const m = String(e?.message || e);
    status = /unauthor|forbidden|401|403/i.test(m)
      ? '🔒 Vui lòng ĐĂNG NHẬP để dùng tính năng đọc ảnh bảng toạ độ (chỉ tài khoản đã đăng nhập).'
      : '⛔ SERVER OCR CHƯA CHẠY:\n' + m + '\n\n→ Backend camlam-api cần cài Tesseract. Đang tạm dùng OCR trình duyệt.';
  }
  // OCR trình duyệt (whitelist chỉ số) — bổ sung khi server thiếu/không chạy
  if (best.length < 3) {
    try { const t = await runRecognize(getPre()); if (!firstText) { firstText = t; firstEngine = 'browser'; } keep(parseBigPairs(t), 'browser', t); } catch {}
    if (best.length < 3) { try { const t = await runRecognize(img); keep(parseBigPairs(t), 'browser', t); } catch {} }
  }
  if (!best.length && firstText) { raw = firstText; engine = firstEngine; }
  if (best.length >= 3) return { pts: best, msg: '', engine, raw };
  return { pts: best, msg: status || ('Chỉ đọc được ' + best.length + ' điểm — chưa đủ.\nHãy chụp GẦN, THẲNG, đủ sáng, chỉ lấy phần bảng số; hoặc nhập tay ở tab "Nhập bảng".'), engine, raw };
}
function showOcrResult(r: { pts: { x: number; y: number }[]; msg: string; engine?: string; raw?: string }, apply: (pts: { x: number; y: number }[], engine?: string) => void) {
  if (r.pts.length) { apply(r.pts, r.engine); return; }
  const eng = r.engine ? '\n\nĐọc bằng: ' + engineLabel(r.engine) : '';
  const rawShow = r.raw ? '\n\nChữ đọc được:\n' + r.raw.replace(/\s*\n\s*/g, '\n').trim().slice(0, 300) : '';
  alert('Chưa tách được toạ độ.' + eng + '\n\n' + r.msg + rawShow);
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
  const [showSave, setShowSave] = useState(false); // chỉ hiện form lưu sản phẩm khi bấm "Lưu tin này"
  const [clickVN, setClickVN] = useState<{ x: number; y: number; lng: number; lat: number } | null>(null);
  const [flyPoint, setFlyPoint] = useState<{ lng: number; lat: number } | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false); // bottom sheet: thu gọn (bản đồ to) ↔ kéo lên xem đầy đủ (kiểu Guland)
  const [parcelMore, setParcelMore] = useState(false); // panel thửa: thu gọn (chỉ tờ/thửa/DT/khu vực) ↔ Xem thêm (quy hoạch, toạ độ)
  const [opacity, setOpacity] = useState(1);
  const [canDelete, setCanDelete] = useState(false);
  // Ảnh PNG QĐ205 là lớp CHÍNH (đúng màu/ký hiệu gốc) — bật mặc định, hiển thị TRÊN lớp vector.
  const [ovOn, setOvOn] = useState<Record<string, boolean>>({ 'qh-qd205': true });
  const [qhFillOn, setQhFillOn] = useState(false);        // TẮT mặc định — giống Guland: hiển thị bằng ẢNH raster. Bật tay nếu muốn lấp chỗ trống.
  // 'all' = gộp cả 3 kịch bản (phủ kín nhất). Từng kịch bản riêng lẻ chỉ phủ một phần.
  const [qhScenario, setQhScenario] = useState<'all' | 'HT' | '2030' | '2045'>('all');
  const [baseMap, setBaseMap] = useState<BaseMap>('satellite');
  const [labels, setLabels] = useState(true);
  const [ranhXa, setRanhXa] = useState<GeoJSON.FeatureCollection | null>(null);
  const [ranhOn, setRanhOn] = useState(false); // tắt mặc định — ranh xã chờ dữ liệu chuẩn (làm sau)
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [adminAll, setAdminAll] = useState(false);
  const router = useRouter();
  const [pName, setPName] = useState(''); const [pPrice, setPPrice] = useState(''); const [pArea, setPArea] = useState('');
  const [pPhone, setPPhone] = useState(''); const [pComm, setPComm] = useState('');
  const [pOwner, setPOwner] = useState(''); const [pCust, setPCust] = useState('');
  const [pParcel, setPParcel] = useState(''); const [pSheet, setPSheet] = useState(''); const [pWard, setPWard] = useState('');
  const [pFeat, setPFeat] = useState(''); const [pCustName, setPCustName] = useState(''); const [pCustPhone, setPCustPhone] = useState('');
  const [pInterest, setPInterest] = useState(''); const [pDeal, setPDeal] = useState('');
  const dealColor = (s?: string | null) => s === 'Đã chốt' ? '#16a34a' : s === 'Thương lượng' ? '#ea580c' : s === 'Đang tư vấn' ? '#0891b2' : s === 'Không thành' ? '#9ca3af' : '#7c3aed';
  // Bảng đầy đủ khi bấm gim tin lưu (như giỏ hàng) + khách quan tâm
  const [selPlace, setSelPlace] = useState<SavedPlace | null>(null);
  const pinClickRef = useRef(0);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [showAddInt, setShowAddInt] = useState(false);
  const [custList, setCustList] = useState<Customer[]>([]);
  const [iCustId, setICustId] = useState(''); const [iName, setIName] = useState(''); const [iPhone, setIPhone] = useState('');
  const [iInterest, setIInterest] = useState(''); const [iDeal, setIDeal] = useState('');
  const [pImages, setPImages] = useState<string[]>([]); const [pUp, setPUp] = useState(false);
  const [measure, setMeasure] = useState<MeasureMode>('off');
  const [mResult, setMResult] = useState<MeasureResult | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ lng: number; lat: number; label?: string } | null>(null);
  const [highlight, setHighlight] = useState<any>(null);
  const [searchMode, setSearchMode] = useState<'parcel' | 'vn2000' | 'latlng' | 'gmap'>('parcel');
  const [c1, setC1] = useState(''); const [c2, setC2] = useState('');
  const [c3, setC3] = useState(''); // = XÃ đang chọn (dropdown)
  const [cap, setCap] = useState<'2' | '3'>('3'); // cấp hành chính, mặc định 3 cấp (Cam Đức hiện tại)

  // ══ BẢN ĐỒ ĐỊA CHÍNH TOÀN TỈNH ═══════════════════════════════════════════════
  // Lớp này LUÔN BẬT, không có nút tắt và không hiện trong bảng "Lớp bản đồ".
  // Muốn xem được phải có "vé" ngắn hạn xin từ máy chủ; vé gắn với máy người xem và
  // tự động xin lại trước khi hết hạn, người dùng không phải làm gì.
  const [ve, setVe] = useState<string>('');
  useEffect(() => {
    let con = true; let hen: any;
    const xinVe = () => {
      api<{ ve: string; songThem: number }>('/dc/ve')
        .then((r) => {
          if (!con) return;
          setVe(r.ve || '');
          // Xin vé mới khi còn khoảng 1/5 thời gian — không bao giờ để đứt quãng giữa chừng.
          hen = setTimeout(xinVe, Math.max(60, (r.songThem || 2700) * 0.8) * 1000);
        })
        .catch(() => { if (con) hen = setTimeout(xinVe, 30000); });   // hỏng mạng thì thử lại sau 30 giây
    };
    xinVe();
    return () => { con = false; clearTimeout(hen); };
  }, []);
  // Địa chỉ ô bản đồ PHẢI ghi ĐẦY ĐỦ (có http://tên-miền), không được ghi tắt kiểu "/api/dc/...".
  // Lý do: bản đồ nạp ô ở một luồng chạy nền riêng; luồng đó không biết trang web đang ở đâu
  // nên đường dẫn ghi tắt sẽ hỏng và KHÔNG ô nào tải được (ranh thửa mất sạch, không báo lỗi gì).
  const dcTiles = useMemo(() => {
    if (!ve) return null;
    const goc = typeof window !== 'undefined' ? window.location.origin : '';
    const duong = API_BASE.startsWith('http') ? API_BASE : goc + API_BASE;
    return [`${duong}/dc/{z}/{x}/{y}.mvt?v=${encodeURIComponent(ve)}`];
  }, [ve]);

  // Danh mục xã/phường lấy THẲNG TỪ DỮ LIỆU (không ghi cứng trong code nữa) — 147 xã toàn tỉnh,
  // chia hai nhóm: 2 cấp (đơn vị mới sau sáp nhập) và 3 cấp (đơn vị cũ).
  // soThua có thể KHÔNG có: máy chủ chỉ gửi số thửa cho tài khoản quản trị.
  type XaDc = { xaId: string; ten: string; tenKd: string; huyen: string; soThua?: number; coBangTo?: boolean; bbox: number[]; tam: number[] };
  const [dsXa, setDsXa] = useState<{ cap2: XaDc[]; cap3: XaDc[] }>({ cap2: [], cap3: [] });
  useEffect(() => { api<{ cap2: XaDc[]; cap3: XaDc[] }>('/dc/danh-muc').then(setDsXa).catch(() => {}); }, []);

  const [huyenChon, setHuyenChon] = useState('');   // huyện/TP cũ đang chọn
  // Danh sách thửa tìm được. Từ khi tra theo XÃ MỚI, một số tờ/số thửa rất hay trùng nhau
  // giữa các xã cũ nay cùng thuộc một xã mới → phải cho người dùng chọn, không thể tự lấy cái đầu.
  type ThuaTim = { id: string; soTo: string; soThua: string; tenXa: string; tenXaCu: string | null;
                   huyenCu: string | null; dienTich: number | null; lng: number; lat: number; hinh: any };
  const [ketQuaTim, setKetQuaTim] = useState<ThuaTim[]>([]);
  // Danh sách xã của cấp đang chọn (2 cấp = đơn vị mới, 3 cấp = đơn vị cũ)
  const dsXaCap = useMemo(() => (cap === '2' ? dsXa.cap2 : dsXa.cap3), [dsXa, cap]);
  // Danh sách huyện/TP cũ (hoặc khu vực với nhóm 2 cấp), kèm số xã trong đó
  const dsHuyen = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of dsXaCap) m.set(x.huyen, (m.get(x.huyen) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [dsXaCap]);
  // Chọn huyện nào thì ô xã chỉ sổ ra xã của huyện đó
  const xaTheoHuyen = useMemo(
    () => (huyenChon ? dsXaCap.filter((x) => x.huyen === huyenChon) : dsXaCap),
    [dsXaCap, huyenChon],
  );
  // Đổi huyện/xã là DỌN SẠCH mọi thứ của địa bàn cũ: bảng "Thông tin thửa" đang mở, ranh thửa
  // đang tô sáng, ô số tờ/số thửa vừa gõ, ghim vị trí cũ... Nếu không dọn, người dùng chọn xã khác
  // mà vẫn thấy thửa của xã trước — rất dễ nhìn nhầm thành thửa của xã mới chọn.
  const donKetQuaCu = useCallback(() => {
    setInfo(null); setHighlight(null); setFocusPoint(null); setClickVN(null);
    setSelPlace(null); setParcelMore(false); setSheetExpanded(false);
    setC1(''); setC2(''); setKetQuaTim([]);   // xoá số tờ / số thửa + danh sách kết quả của lần tra trước
    setMResult(null);
  }, []);

  // Chọn xã (từ ô gõ tên hoặc từ danh sách sổ xuống) → bản đồ bay thẳng tới xã đó.
  const bayToiXa = useCallback((x: XaDc | null) => {
    if (!x || !x.bbox || x.bbox.length !== 4 || !Number.isFinite(x.bbox[0])) return;
    setFitTo([[x.bbox[0], x.bbox[1]], [x.bbox[2], x.bbox[3]]]);
    setPanelOpen(false);
  }, []);

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
  const [camFlash, setCamFlash] = useState(false);
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const [ocrBusy, setOcrBusy] = useState('');
  const [ocrPct, setOcrPct] = useState(0);
  const ocrTimer = useRef<any>(null);
  const [ocrOk, setOcrOk] = useState(0);
  const [ocrEngine, setOcrEngine] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [drawResult, setDrawResult] = useState<{ n: number; area: number; perim: number; lat: number; lng: number } | null>(null);
  const [tool, setTool] = useState<'none' | 'search' | 'base' | 'measure'>('none'); // bảng công cụ trên mobile
  // ==== CHỈ ĐƯỜNG NHIỀU TUYẾN ====
  const [dirDen, setDirDen] = useState<Diem | null>(null);     // điểm đến (bấm nút 🧭 là có) — có nó thì bảng chỉ đường mở
  const [dirDi, setDirDi] = useState<Diem | null>(null);       // điểm đi (mặc định lấy vị trí hiện tại)
  const [dirTuyen, setDirTuyen] = useState<TuyenVe[]>([]);     // các phương án đường đi để vẽ lên bản đồ
  const [dirChon, setDirChon] = useState<number | null>(null); // tuyến vừa bấm chọn NGAY TRÊN bản đồ
  const [dirNhat, setDirNhat] = useState<'di' | 'den' | null>(null); // đang chờ người dùng bấm lên bản đồ để nhặt điểm
  const dirNhatRef = useRef<'di' | 'den' | null>(null); dirNhatRef.current = dirNhat;
  // Mở bảng chỉ đường tới một chỗ. Thay cho kiểu cũ là nhảy thẳng sang Google Maps.
  const moChiDuong = useCallback((lat: number, lng: number, ten?: string) => {
    setDirDen({ lat, lng, ten }); setDirChon(null); setTool('none'); setSheetExpanded(false);
  }, []);

  const refreshFeatures = useCallback((v: { west: number; south: number; east: number; north: number; zoom: number }) => {
    const bbox = `${v.west},${v.south},${v.east},${v.north}`;
    for (const l of layersRef.current) {
      const vis = visibleRef.current[l.slug] ?? false;
      if (!vis) continue;
      const minZ = (l.layerType === 'parcel' || l.layerType === 'custom') ? PARCEL_MIN_ZOOM : (l.layerType === 'zoning' ? ZONING_MIN_ZOOM : 0);
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
      setVisible((prev) => Object.fromEntries(layers.map((l) => [l.slug, prev[l.slug] ?? false])));
      if (viewRef.current) refreshFeatures(viewRef.current);
    }).catch(() => {});
  }, [refreshFeatures]);
  useEffect(() => { load(); api<any>('/map-ads/active').then((r) => setAds(r.ads || [])).catch(() => {}); }, [load]);
  // qh_vector (2.1MB) chủ yếu để TRA loại đất khi bấm (giống "dữ liệu ô đất" của Meey Map);
  // phần HIỂN THỊ do ảnh raster lo (giống Guland) → nạp TRỄ lúc rảnh cho nhẹ.
  useEffect(() => {
    const go = () => fetch('/qh_vector.geojson').then((r) => r.json()).then(setQhVector).catch(() => {});
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: any) => number);
    const id = ric ? ric(go, { timeout: 4000 }) : window.setTimeout(go, 1800);
    return () => { const cic = (window as any).cancelIdleCallback; if (ric && cic) cic(id); else clearTimeout(id); };
  }, []);
  useEffect(() => { if (viewRef.current) refreshFeatures(viewRef.current); }, [visible, refreshFeatures]);
  useEffect(() => { setCanDelete(laAdmin(user) || coVaiTro(user, 'gis')); }, [user]);
  // Chỉ tải ranh xã (384KB) KHI người dùng bật lớp — mặc định tắt nên không tốn dữ liệu trên điện thoại.
  useEffect(() => { if (!ranhOn || ranhXa) return; fetch('/ranh-xa.geojson').then((r) => (r.ok ? r.json() : null)).then(setRanhXa).catch(() => {}); }, [ranhOn, ranhXa]);
  const loadPlaces = useCallback(async () => {
    if (!user) { setPlaces([]); return; }
    try { setPlaces((adminAll && laAdmin(user)) ? await listAllPlaces() : await listMyPlaces()); } catch { setPlaces([]); }
  }, [user, adminAll]);
  useEffect(() => { loadPlaces(); }, [loadPlaces]);
  // "Đăng tin này": mang sản phẩm đã lưu sang form đăng tin (đổ sẵn tên/giá/diện tích/ảnh/vị trí).
  function publishPlace(p: SavedPlace) {
    try { sessionStorage.setItem('camlam_draft', JSON.stringify({ id: p.id, note: p.note, price: p.price, area: p.area, images: p.images, lng: p.lng, lat: p.lat, x: p.x, y: p.y })); } catch { /* ignore */ }
    router.push('/sales/post');
  }
  async function savePlace() {
    if (!clickVN) return;
    const miss: string[] = [];
    if (!pName.trim()) miss.push('Tên/mô tả'); if (!pParcel.trim()) miss.push('Thửa'); if (!pSheet.trim()) miss.push('Tờ'); if (!pWard.trim()) miss.push('Xã');
    if (!pFeat.trim()) miss.push('Đặc điểm'); if (!pPrice.trim()) miss.push('Giá'); if (!pArea.trim()) miss.push('Diện tích');
    if (!pOwner.trim()) miss.push('Tên chủ'); if (!pPhone.trim()) miss.push('SĐT chủ');
    if (miss.length) { alert('Vui lòng nhập đầy đủ: ' + miss.join(', ') + '.\n(Chỉ "Hoa hồng" không bắt buộc)'); return; }
    try {
      await addPlace({ lng: clickVN.lng, lat: clickVN.lat, x: clickVN.x, y: clickVN.y, note: pName.trim(),
        parcel: pParcel.trim() || undefined, sheet: pSheet.trim() || undefined, ward: pWard.trim() || undefined, features: pFeat.trim() || undefined,
        price: pPrice.trim() || undefined, area: pArea.trim() || undefined, owner: pOwner.trim() || undefined, phone: pPhone.trim() || undefined,
        commission: pComm.trim() || undefined, images: pImages });
      setPName(''); setPPrice(''); setPArea(''); setPOwner(''); setPPhone(''); setPComm(''); setPParcel(''); setPSheet(''); setPWard(''); setPFeat(''); setPImages([]); loadPlaces();
    } catch (e: any) { alert('Lỗi lưu: ' + (e?.message || e)); }
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
  useEffect(() => { if (!camOpen) return; const v = camVideoRef.current, st = camStreamRef.current; if (!v || !st) return; v.srcObject = st; v.setAttribute('playsinline', 'true'); v.play().catch(() => {}); }, [camOpen]);
  // Giải phóng camera khi rời trang (tránh giữ camera chạy ngầm trên điện thoại).
  useEffect(() => () => { camStreamRef.current?.getTracks().forEach((t) => t.stop()); camStreamRef.current = null; if (ocrTimer.current) clearInterval(ocrTimer.current); }, []);

  const overlays: ImageOverlay[] = useMemo(
    () => RASTER_OVERLAYS.map((o) => ({ id: o.id, url: o.url, coordinates: o.coordinates, opacity, visible: ovOn[o.id] ?? true, pmtiles: (o as any).pmtiles, fillMaxzoom: (o as any).fillMaxzoom, tiles: (o as any).tiles, minzoom: (o as any).minzoom, maxzoom: (o as any).maxzoom })), [opacity, ovOn]);

  // Lớp TÔ MÀU quy hoạch từ qh_vector: lọc theo kịch bản (hz), tô theo màu sẵn (thuộc tính c).
  // Sắp xếp thửa DIỆN TÍCH LỚN vẽ trước → thửa nhỏ (cụ thể) nằm trên, không bị che.
  const qhFillFC = useMemo(() => {
    const all = (qhVector?.features as any[]) || [];
    const fs = qhScenario === 'all' ? all : all.filter((f) => String(f?.properties?.hz) === qhScenario);
    const ringArea = (f: any) => {
      const g = f.geometry; if (!g) return 0;
      const ring = g.type === 'Polygon' ? g.coordinates?.[0] : g.coordinates?.[0]?.[0];
      if (!ring || ring.length < 4) return 0;
      let s = 0; for (let i = 0; i < ring.length - 1; i++) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      return Math.abs(s);
    };
    const sorted = [...fs].sort((a, b) => ringArea(b) - ringArea(a));
    return { type: 'FeatureCollection', features: sorted } as GeoJSON.FeatureCollection;
  }, [qhVector, qhScenario]);

  // Chú giải: các loại đất đang hiện + màu (gộp trùng), sắp theo số thửa nhiều → ít.
  const qhLegend = useMemo(() => {
    const cnt = new Map<string, { c: string; n: number }>();
    for (const f of qhFillFC.features as any[]) {
      const lo = f.properties?.lo, c = f.properties?.c;
      if (!lo || !c) continue;
      const e = cnt.get(lo); if (e) e.n++; else cnt.set(lo, { c, n: 1 });
    }
    return [...cnt.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [qhFillFC]);

  const geoLayers: GeoLayer[] = useMemo(() => {
    const out: GeoLayer[] = [];
    // Lớp quy hoạch tô màu (nằm DƯỚI cùng các lớp vector khác) — phủ kín, hết "thủng".
    if (qhFillFC.features.length) {
      // beforeId 'qh-qd205' → lớp vector nằm DƯỚI ảnh PNG: ảnh PNG hiển thị nguyên bản bên trên,
      // vector chỉ lộ ra ở chỗ ảnh trong suốt (lấp "thủng").
      out.push({ id: 'qh-fill', type: 'fill', data: qhFillFC, visible: qhFillOn, beforeId: 'qh-qd205', paint: { 'fill-color': ['coalesce', ['get', 'c'], '#9ca3af'] as any, 'fill-opacity': opacity } });
      out.push({ id: 'qh-fill-line', type: 'line', data: qhFillFC, visible: qhFillOn, beforeId: 'qh-qd205', paint: { 'line-color': 'rgba(23,37,64,0.30)', 'line-width': 0.4 } });
    }
    for (const l of layers) {
      const fc = data[l.slug]; if (!fc) continue;
      const base = (l.style?.color as string) || DEFAULT_COLORS[l.layerType] || '#16a34a';
      const colorExpr: any = ['coalesce', ['get', 'color'], base];
      const gtype = (l.geometryType || '').toLowerCase();
      const vis = visible[l.slug] ?? false;
      if (gtype.includes('line')) out.push({ id: `${l.slug}-line`, type: 'line', data: fc, visible: vis, paint: { 'line-color': colorExpr, 'line-width': (l.style?.weight as number) ?? 2.5 } });
      else if (gtype.includes('point')) out.push({ id: `${l.slug}-pt`, type: 'circle', data: fc, visible: vis, paint: { 'circle-color': colorExpr, 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } });
      else if (l.layerType === 'parcel' || l.layerType === 'custom') {
        // Ranh thửa: nền XANH nhạt + viền XANH ĐẬM. Thửa DÍNH (GhepChuaTach=true, thiếu ranh chia) tô ĐỎ nổi bật để dễ tìm chỗ cần kẻ ranh.
        const dinh = ['==', ['get', 'GhepChuaTach'], true];
        // 'zoom' PHẢI ở top-level của interpolate; case nằm trong từng mốc (không được bọc interpolate-zoom trong case).
        out.push({ id: `${l.slug}-fill`, type: 'fill', data: fc, visible: vis, minzoom: PARCEL_SHOW_ZOOM, paint: { 'fill-color': ['case', dinh, '#ff5252', '#1e88e5'] as any, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, ['case', dinh, 0.5, 0.06], 16, ['case', dinh, 0.5, 0.13], 18, ['case', dinh, 0.5, 0.18]] as any } });
        out.push({ id: `${l.slug}-line`, type: 'line', data: fc, visible: vis, minzoom: PARCEL_SHOW_ZOOM, paint: { 'line-color': ['case', dinh, '#c62828', '#1565c0'] as any, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, ['case', dinh, 2.6, 1], 16, ['case', dinh, 2.6, 1.7], 18, ['case', dinh, 2.6, 2.6]] as any, 'line-opacity': 1 } });
        out.push({ id: `${l.slug}-label`, type: 'symbol', data: fc, visible: vis, minzoom: PARCEL_SHOW_ZOOM, paint: { 'text-color': '#1e3a8a', 'text-halo-color': 'rgba(255,255,255,0.7)', 'text-halo-width': 1 }, layout: { 'text-field': ['coalesce', ['get', 'SoThua'], ['get', 'so_thua'], ['get', 'SOTHUA'], ['get', 'sothua'], ['get', 'thua'], ['get', 'THUA'], ['get', 'SHThua'], ['get', 'ThuaDat'], ''], 'text-size': ['interpolate', ['linear'], ['zoom'], 15, 9, 18, 12] as any, 'text-font': ['Noto Sans Regular'], 'symbol-placement': 'point', 'text-allow-overlap': false } });
      }
      else {
        // Lớp quy hoạch / ranh giới CHỈ VẼ VIỀN (không tô nền) -> rất nhẹ, hết lag.
        // Ranh giới hành chính (admin, vd ranh thôn): đường ĐẬM RÕ ở mọi mức zoom; ranh xã đậm hơn ranh thôn.
        const adminW: any = ['interpolate', ['linear'], ['zoom'], 10, ['case', ['==', ['get', 'loai'], 'ranh_xa'], 2.6, 1.8], 14, ['case', ['==', ['get', 'loai'], 'ranh_xa'], 4.2, 3], 17, ['case', ['==', ['get', 'loai'], 'ranh_xa'], 5.5, 4]];
        out.push({ id: `${l.slug}-line`, type: 'line', data: fc, visible: vis, paint: { 'line-color': colorExpr, 'line-width': (l.style?.weight as number) ?? (l.layerType === 'admin' ? adminW : 0.8), 'line-opacity': 0.95 } });
      }
      // Nhãn tên (vd tên thôn) KHÔNG vẽ bằng symbol nữa (symbol cần glyph từ font server, hay bị chặn/mất chữ).
      // Thay vào đó truyền xuống MapView qua prop textLabels để vẽ bằng marker HTML — luôn hiện, không cần font server.
    }
    if (ranhXa && ranhXa.features?.length) {
      const f6 = ranhXa.features.filter((x: any) => x?.properties?.color === 6);
      const fc = (f6.length ? { type: 'FeatureCollection', features: f6 } : ranhXa) as GeoJSON.FeatureCollection;
      out.push({ id: 'ranh-xa', type: 'line', data: fc, visible: ranhOn, paint: { 'line-color': '#C8A14B', 'line-width': 2.2, 'line-opacity': 0.95, 'line-dasharray': [3, 1.5] } });
    }
    return out;
  }, [layers, data, visible, opacity, ranhXa, ranhOn, qhFillFC, qhFillOn]);

  // Nhãn tên (vd tên thôn) vẽ bằng marker HTML trong MapView — KHÔNG cần glyph/font server (hay bị chặn → mất chữ).
  // Gom điểm có trường tên (ten/name…) của các lớp đang bật (trừ parcel dùng nhãn số thửa riêng).
  const textLabels = useMemo(() => {
    const arr: { lng: number; lat: number; text: string }[] = [];
    for (const l of layers) {
      if (l.layerType === 'parcel') continue;
      if (!(visible[l.slug] ?? false)) continue;
      const fc: any = data[l.slug]; if (!fc?.features) continue;
      for (const f of fc.features) {
        if (f?.geometry?.type !== 'Point') continue;
        const p: any = f.properties || {};
        const nm = p.ten || p.name || p.ten_thon || p.NAME || p.label || '';
        if (!nm) continue;
        const c = f.geometry.coordinates as number[];
        arr.push({ lng: c[0], lat: c[1], text: String(nm) });
      }
    }
    return arr;
  }, [layers, data, visible]);

  // Bấm gim tin lưu → mở BẢNG ĐẦY ĐỦ (selPlace) như giỏ hàng, thay cho popup nhỏ.
  const placeMarkers = useMemo(() => places.map((p) => ({
    lng: p.lng, lat: p.lat, color: dealColor(p.dealStatus),
    onClick: () => { pinClickRef.current = Date.now(); setInfo(null); setSelPlace(p); },
  })), [places]);
  // Ghim XANH tại điểm vừa bấm (điểm đang chọn) — như /listings.
  const allMarkers = useMemo(() => clickVN ? [...placeMarkers, { lng: clickVN.lng, lat: clickVN.lat, color: '#2563eb' }] : placeMarkers, [placeMarkers, clickVN]);
  useEffect(() => {
    setShowAddInt(false);
    if (!selPlace) { setInterests([]); return; }
    listInterests(selPlace.id).then(setInterests).catch(() => setInterests([]));
  }, [selPlace]);
  const openAddInt = () => { setShowAddInt(true); if (!custList.length) listCustomers().then(setCustList).catch(() => { }); };
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
  async function delIntMap(id: number) {
    try { await removeInterest(id); setInterests((a) => a.filter((x) => x.id !== id)); } catch (e: any) { alert(e.message); }
  }

  async function onMapClick(lng: number, lat: number) {
    // Đang chờ nhặt điểm đi/điểm đến cho phần chỉ đường → lấy điểm rồi thôi, không mở bảng quy hoạch.
    if (dirNhatRef.current) {
      const d: Diem = { lng, lat, ten: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
      if (dirNhatRef.current === 'di') setDirDi(d); else setDirDen(d);
      setDirNhat(null); return;
    }
    if (Date.now() - pinClickRef.current < 350) return; // vừa bấm gim tin lưu → không mở bảng quy hoạch
    setSelPlace(null); setShowSave(false); // click mới → thu gọn, chỉ hiện điểm + nút "Lưu tin này"
    const vn = wgs84ToVn2000(lng, lat);
    setClickVN({ x: vn.y, y: vn.x, lng, lat }); // sổ: X=Bắc(Northing), Y=Đông(Easting)
    setFlyPoint({ lng, lat }); // bay tới + zoom cận, pin nằm giữa vùng trống phía trên bảng
    setSheetExpanded(false); // mỗi lần click: thu gọn bảng để thấy bản đồ, muốn xem đầy đủ thì kéo lên
    // Loại đất quy hoạch (vector) tại điểm — tính ngay ở trình duyệt, không cần server.
    const gv = qhVectorRef.current;
    if (gv) {
      const hits: { lo: string; hz: string; area: number }[] = [];
      let inMask = false; // điểm nằm trong mặt nạ "nội thị" (vùng đã có QH)
      for (const ft of gv.features as any[]) {
        const ring = ft.geometry?.coordinates?.[0]; if (!ring) continue;
        if (pointInRing(lng, lat, ring)) {
          const pr = ft.properties || {};
          if (pr.bg === true || pr.lo === 'Noi thi' || pr.lo === 'Đất nội thị (chưa phân loại)') { inMask = true; continue; } // bỏ mặt nạ, không phải loại đất
          let sArea = 0; for (let i = 0; i < ring.length - 1; i++) sArea += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
          hits.push({ lo: pr.lo, hz: pr.hz, area: Math.abs(sArea) });
        }
      }
      hits.sort((x, y) => x.area - y.area); // vùng nhỏ (cụ thể) hiện trước
      const seen = new Set<string>(); const uniq: { lo: string; hz: string }[] = [];
      for (const h of hits) { const k = h.lo + h.hz; if (!seen.has(k)) { seen.add(k); uniq.push({ lo: h.lo, hz: h.hz }); } }
      if (uniq.length === 0 && inMask) uniq.push({ lo: 'Đất giao thông', hz: '' }); // trống giữa các ô đất = đường
      setQhvHit(uniq.slice(0, 4));
    } else setQhvHit([]);
    try {
      const r = await api<ParcelInfo>(`/parcels/at?lng=${lng}&lat=${lat}`);
      const pg = (r.parcel as any)?.geometry; // click TRÚNG thửa → highlight + hiện cạnh/diện tích (kiểu Guland)
      // Diện tích QH giờ do BACKEND tính theo ĐƯỜNG THẬT (robust khi đổi địa chính) → dùng thẳng r.overlaps.
      // Fallback: nếu backend chưa cập nhật (overlaps rỗng) thì tạm overlay vector phía client.
      if ((!(r as any).overlaps || !(r as any).overlaps.length) && pg) {
        const ring = pg.type === 'Polygon' ? (pg.coordinates?.[0] || [])
          : pg.type === 'MultiPolygon' ? ((pg.coordinates || []).reduce((a: number[][], poly: any) => ((poly?.[0]?.length || 0) > (a?.length || 0) ? poly[0] : a), [] as number[][])) : [];
        const areas = qhAreasFromVector(ring as number[][]);
        if (areas.length) (r as any).overlaps = areas;
      }
      setInfo(r); setParcelMore(false); // mỗi lần click thửa mới → thu gọn lại
      // Kèm luôn diện tích CHÍNH THỨC do máy chủ đo, để con số ghi trên bản đồ khớp y hệt
      // con số trong bảng "Thông tin thửa" (trước đây bản đồ tự tính lấy nên lệch vài mét vuông).
      setHighlight(pg ? {
        type: 'Feature',
        properties: { ...((r.parcel as any).properties || {}), dienTichChinhThuc: (r.parcel as any).areaM2 ?? null },
        geometry: pg,
      } : null);
    }
    catch { setInfo({ found: false, point: { lng, lat }, parcel: null, zoning: null, listings: [] }); setHighlight(null); }
  }

  // Gom các ô quy hoạch (vector) cắt qua thửa → TÔ MÀU đúng loại đất lên sơ đồ phiếu (như bản đồ QH).
  // scen = kịch bản QH đang áp (HT/2030/2045); chỉ lấy ô đúng kịch bản để sơ đồ khớp thông tin.
  function qhPiecesFor(geometry: any, scen?: string): { lo: string; hz?: string; c?: string; ring: number[][] }[] {
    const gv = qhVectorRef.current as any; if (!gv?.features || !geometry) return [];
    let pr: number[][] = [];
    if (geometry.type === 'Polygon') pr = geometry.coordinates?.[0] || [];
    else if (geometry.type === 'MultiPolygon') { let bA = -1; for (const poly of geometry.coordinates || []) { const r = poly?.[0] || []; if (r.length > bA) { bA = r.length; pr = r; } } }
    if (pr.length < 3) return [];
    const xs = pr.map((c) => c[0]), ys = pr.map((c) => c[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const out: { lo: string; hz?: string; c?: string; ring: number[][] }[] = [];
    for (const ft of gv.features as any[]) {
      const ring = ft.geometry?.coordinates?.[0]; if (!ring || ring.length < 3) continue;
      const pp = ft.properties || {};
      if (pp.bg === true || pp.lo === 'Noi thi' || pp.lo === 'Đất nội thị (chưa phân loại)') continue; // bỏ mặt nạ nội thị
      if (scen && scen !== 'all' && String(pp.hz || '') !== scen) continue; // chỉ đúng kịch bản đang áp
      const rxs = ring.map((c: number[]) => c[0]), rys = ring.map((c: number[]) => c[1]);
      if (Math.max(...rxs) < minx || Math.min(...rxs) > maxx || Math.max(...rys) < miny || Math.min(...rys) > maxy) continue; // bbox không giao
      out.push({ lo: String(pp.lo || pp.loai || ''), hz: pp.hz ? String(pp.hz) : undefined, c: pp.c ? String(pp.c) : undefined, ring });
      if (out.length >= 120) break;
    }
    return out;
  }

  // Gom feature LỚP ĐƯỜNG THẬT (layerType='road', nét mảnh) gần thửa → vẽ đúng con đường lên sơ đồ trích lục.
  function roadFeatsFor(geometry: any): { t: string; c: any }[] {
    if (!geometry) return [];
    let pr: number[][] = [];
    if (geometry.type === 'Polygon') pr = geometry.coordinates?.[0] || [];
    else if (geometry.type === 'MultiPolygon') { let bA = -1; for (const poly of geometry.coordinates || []) { const r = poly?.[0] || []; if (r.length > bA) { bA = r.length; pr = r; } } }
    if (pr.length < 3) return [];
    const xs = pr.map((c) => c[0]), ys = pr.map((c) => c[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const ex = (maxx - minx) * 0.7 || 1e-3, ey = (maxy - miny) * 0.7 || 1e-3;   // mở rộng bbox để lấy đường giáp cạnh
    const bx0 = minx - ex, bx1 = maxx + ex, by0 = miny - ey, by1 = maxy + ey;
    const flat = (g: any): number[][] => { const a: number[][] = []; const rec = (v: any) => { if (typeof v?.[0] === 'number') a.push(v as number[]); else if (Array.isArray(v)) v.forEach(rec); }; rec(g?.coordinates); return a; };
    const out: { t: string; c: any }[] = [];
    for (const l of layersRef.current) {
      if (l.layerType !== 'road') continue;
      const fc: any = data[l.slug]; if (!fc?.features) continue;
      for (const ft of fc.features as any[]) {
        const g = ft.geometry; if (!g) continue;
        const cs = flat(g); if (!cs.length) continue;
        const fxs = cs.map((c) => c[0]), fys = cs.map((c) => c[1]);
        if (Math.max(...fxs) < bx0 || Math.min(...fxs) > bx1 || Math.max(...fys) < by0 || Math.min(...fys) > by1) continue; // bbox không giao
        out.push({ t: String(g.type), c: g.coordinates });
        if (out.length >= 40) break;
      }
    }
    return out;
  }

  // ĐO DIỆN TÍCH QH theo LỚP VECTOR qh_vector (overlay điểm-trong-đa-giác) — phủ KÍN, hết "giao thông ảo".
  // Ảnh QĐ205 chỉ là NÉT HATCH (đa số pixel trong suốt) nên không đếm pixel được; qh_vector mới là dữ liệu thật,
  // đã kiểm chứng phủ 100% (vd thửa 556/326 = 100% đất hỗn hợp). Ưu tiên polygon LOẠI ĐẤT thật (QH > hiện trạng)
  // đè lên nền "nội thị/khác"; trong cùng bậc chọn polygon NHỎ nhất (cụ thể nhất); chuẩn hoá tổng = diện tích thửa.
  function qhAreasFromVector(ring: number[][]): { type: string; hz?: string; areaM2: number }[] {
    try {
      const gv = qhVectorRef.current as any;
      const feats = gv?.features || [];
      if (!feats.length || ring.length < 3) return [];
      const BG = new Set(['Noi thi', 'Đất nội thị (chưa phân loại)', 'Khác', '', '?']);
      const lngs = ring.map((c) => c[0]), lats = ring.map((c) => c[1]);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs), minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const ringArea = (r: number[][]) => { let a = 0; for (let i = 0; i < r.length; i++) { const p1 = r[i], p2 = r[(i + 1) % r.length]; a += p1[0] * p2[1] - p2[0] * p1[1]; } return Math.abs(a) / 2; };
      const pip = (x: number, y: number, r: number[][]) => { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
      type Cand = { minx: number; miny: number; maxx: number; maxy: number; r: number[][]; lo: string; ar: number; tier: number };
      const cand: Cand[] = [];
      for (const ft of feats) {
        const gm = ft.geometry; if (!gm) continue; const pr = ft.properties || {};
        const lo = String(pr.lo || pr.loai || '?');
        const isBg = pr.bg === true || BG.has(lo);
        const plan = pr.hz === '2045' || pr.hz === '2030' || pr.hz === 'QH';
        const tier = isBg ? 0 : (plan ? 2 : 1);
        const polys = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
        for (const poly of polys) {
          const r = (poly?.[0] || []) as number[][]; if (r.length < 3) continue;
          let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
          for (const c of r) { if (c[0] < mnx) mnx = c[0]; if (c[0] > mxx) mxx = c[0]; if (c[1] < mny) mny = c[1]; if (c[1] > mxy) mxy = c[1]; }
          if (mxx < minLng || mnx > maxLng || mxy < minLat || mny > maxLat) continue;
          cand.push({ minx: mnx, miny: mny, maxx: mxx, maxy: mxy, r, lo, ar: ringArea(r), tier });
        }
      }
      if (!cand.length) return [];
      const R = 6378137, rad = Math.PI / 180;
      let ga = 0; for (let i = 0; i < ring.length; i++) { const p1 = ring[i], p2 = ring[(i + 1) % ring.length]; ga += (p2[0] - p1[0]) * rad * (2 + Math.sin(p1[1] * rad) + Math.sin(p2[1] * rad)); }
      const parcelA = Math.abs(ga * R * R / 2); if (parcelA < 1) return [];
      const N = 96; const cnt: Record<string, number> = {}; let inside = 0;
      for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
        const x = minLng + (maxLng - minLng) * (ix + 0.5) / N, y = minLat + (maxLat - minLat) * (iy + 0.5) / N;
        if (!pip(x, y, ring)) continue; inside++;
        let bestLo: string | null = null, bestTier = -1, bestAr = Infinity;
        for (const c of cand) {
          if (c.tier < bestTier) continue;
          if (x < c.minx || x > c.maxx || y < c.miny || y > c.maxy) continue;
          if (!pip(x, y, c.r)) continue;
          if (c.tier > bestTier || c.ar < bestAr) { bestTier = c.tier; bestAr = c.ar; bestLo = c.lo; }
        }
        // NỀN/mask "nội thị" (tier 0) = khoảng trống giữa các ô đất = ĐẤT GIAO THÔNG (giống qhviet/Meey).
        if (bestLo) { const lbl = bestTier === 0 ? 'Đất giao thông' : bestLo; cnt[lbl] = (cnt[lbl] || 0) + 1; }
      }
      if (inside < 20) return [];
      const denom = Object.values(cnt).reduce((s, n) => s + n, 0); if (denom < 1) return [];
      const out = Object.entries(cnt).map(([lo, n]) => ({ type: lo, hz: '2045', areaM2: Math.round((parcelA * n / denom) * 10) / 10 }));
      return out.filter((x) => x.areaM2 > 0.5).sort((a, b) => b.areaM2 - a.areaM2);
    } catch { return []; }
  }

  // Mở từ mã QR trên phiếu (/map?lng=&lat=&to=&thua=) → tự bay tới + tra cứu đúng thửa.
  const didDeepLink = useRef(false);
  useEffect(() => {
    if (didDeepLink.current) return; didDeepLink.current = true;
    try {
      const sp = new URLSearchParams(window.location.search);
      const lng = parseFloat(sp.get('lng') || ''), lat = parseFloat(sp.get('lat') || '');
      if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
        setFocusPoint({ lng, lat, label: `Tờ ${sp.get('to') || '?'} · Thửa ${sp.get('thua') || '?'}` });
        setTimeout(() => { onMapClick(lng, lat).catch(() => {}); }, 700);
      }
    } catch { /* bỏ qua */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mở một thửa trong danh sách tìm được: tô sáng, bay tới, nạp đầy đủ thông tin.
  const moThuaTim = useCallback(async (p: any) => {
    const props = { to: p.soTo, thua: p.soThua, xa: p.tenXa, xaCu: p.tenXaCu,
                    dienTich_m2: p.dienTich, mucDichSuDung: p.mdsd, nhan: `Tờ ${p.soTo}, thửa ${p.soThua}` };
    if (p.hinh) setHighlight({ type: 'Feature', properties: props, geometry: p.hinh });
    setFocusPoint({ lng: p.lng, lat: p.lat, label: `Tờ ${p.soTo} · Thửa ${p.soThua}${p.tenXa ? ' · ' + p.tenXa : ''}` });
    setPanelOpen(false); setTool('none');
    // Nạp ĐẦY ĐỦ thông tin thửa (quy hoạch, chồng lấn, toạ độ, tin BĐS…) giống bấm trực tiếp trên bản đồ.
    await onMapClick(p.lng, p.lat);
    if (p.hinh) setHighlight({ type: 'Feature', properties: props, geometry: p.hinh }); // giữ đúng ranh thửa đã tìm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSearch() {
    if (searchMode === 'parcel') {
      // Tra trên bảng địa chính toàn tỉnh (/dc/tim) — có chỉ mục theo số tờ/số thửa nên rất nhanh.
      const params = new URLSearchParams();
      if (c1.trim()) params.set('to', c1.trim());
      if (c2.trim()) params.set('thua', c2.trim());
      if (c3.trim()) params.set('xaId', c3.trim());   // c3 giờ là MÃ XÃ, không phải tên (10 cặp xã trùng tên)
      if (!c3.trim() && cap) params.set('cap', cap);   // chưa chọn xã thì lọc theo cấp cho gọn kết quả
      if (!c1.trim() && !c2.trim()) return alert('Nhập số tờ và/hoặc số thửa.');
      try {
        const r = await api<{ soLuong: number; thuaDat: ThuaTim[] }>(`/dc/tim?${params.toString()}`);
        if (!r.soLuong) { setKetQuaTim([]); return alert('Không tìm thấy thửa nào khớp. Thử bỏ bớt điều kiện, hoặc chọn đúng xã/phường.'); }
        setKetQuaTim(r.soLuong > 1 ? r.thuaDat : []);   // nhiều kết quả → hiện bảng cho chọn
        await moThuaTim(r.thuaDat[0]);                  // vẫn mở sẵn thửa đầu tiên
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
  function applyParsed(parsed: { x: number; y: number }[], engine?: string) {
    if (!parsed.length) return alert('Chưa nhận được toạ độ từ ảnh. Hãy chụp GẦN, THẲNG, đủ sáng — chỉ lấy phần bảng số. Hoặc nhập tay ở tab "Nhập bảng".');
    setRows(parsed.map((p) => ({ x: String(p.x), y: String(p.y) })));
    setOcrOk(parsed.length);
    setOcrEngine(engine || '');
    setDrawTab('table');
  }
  function applyPaste() {
    const pts = parseBigPairs(pasteText);
    if (!pts.length) return alert('Không tìm thấy cặp toạ độ hợp lệ.\nMỗi dòng cần 1 số Bắc (~1,2–1,48 triệu) và 1 số Đông (~380–720 nghìn). Ví dụ:\n1  1335000.50  567890.12');
    setRows(pts.map((p) => ({ x: String(p.x), y: String(p.y) })));
    setOcrOk(pts.length);
    setOcrEngine('paste');
    setPasteText('');
  }
  function loadImage(f: File): Promise<HTMLImageElement> {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(f); });
  }
  async function onCoordFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    if (f.type.startsWith('image/') && !requireLogin()) return;
    setOcrBusy('Đang đọc…'); startProgress();
    try {
      if (f.type.startsWith('image/')) {
        const img = await loadImage(f);
        setOcrBusy('Đang tải & đọc ảnh…');
        showOcrResult(await ocrToPoints(img), applyParsed);
      } else { applyParsed(parseBigPairs(await f.text())); }
    } catch (er: any) { alert('Không đọc được tệp: ' + (er?.message || er)); }
    finally { endProgress(); }
  }
  // Vẽ ranh bằng CHỤP/ẢNH toạ độ cần đăng nhập (dùng API OCR). Chưa đăng nhập → nhắc đăng nhập đơn giản.
  function requireLogin(): boolean {
    if (user) return true;
    if (confirm('🔒 Tính năng vẽ ranh bằng chụp/ảnh toạ độ cần đăng nhập.\n\nĐăng nhập ngay?')) window.location.href = '/login?next=/map';
    return false;
  }
  async function startCam() {
    if (!requireLogin()) return;
    try { const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } } }); try { await st.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any }); } catch {} camStreamRef.current = st; setCamOpen(true); }
    catch (e: any) { alert('Không mở được camera: ' + (e?.message || e)); }
  }
  function stopCam() { camStreamRef.current?.getTracks().forEach((t) => t.stop()); camStreamRef.current = null; setCamOpen(false); }
  function startProgress() {
    if (ocrTimer.current) clearInterval(ocrTimer.current);
    setOcrPct(0);
    let p = 0;
    ocrTimer.current = setInterval(() => { p += Math.max(0.7, (92 - p) * 0.06); if (p > 92) p = 92; setOcrPct(Math.round(p)); }, 180);
  }
  function endProgress() {
    if (ocrTimer.current) { clearInterval(ocrTimer.current); ocrTimer.current = null; }
    setOcrPct(100);
    setTimeout(() => { setOcrBusy(''); setOcrPct(0); }, 350);
  }
  async function capture() {
    const v = camVideoRef.current; if (!v || !v.videoWidth) return;
    const vw = v.videoWidth, vh = v.videoHeight, cw = Math.round(vw * 0.96), ch = Math.round(vh * 0.86);
    const cap = document.createElement('canvas'); cap.width = cw; cap.height = ch;
    cap.getContext('2d')!.drawImage(v, Math.round((vw - cw) / 2), Math.round((vh - ch) / 2), cw, ch, 0, 0, cw, ch);
    // Phản hồi "đã chụp": rung nhẹ + nháy trắng màn hình (như camera iPhone), rồi mới chuyển sang đọc.
    try { navigator.vibrate?.(35); } catch {}
    setCamFlash(true); setTimeout(() => setCamFlash(false), 110);
    await new Promise((r) => setTimeout(r, 180));
    stopCam(); setOcrBusy('Đang tải & đọc ảnh…'); startProgress();
    try { showOcrResult(await ocrToPoints(cap), applyParsed); }
    catch (e: any) { alert('Không đọc được: ' + (e?.message || e)); }
    finally { endProgress(); }
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
    <div className={`flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 ${full ? 'w-full' : ''}`}>
      {([['street', 'Đường'], ['satellite', 'Vệ tinh'], ['terrain', 'Địa hình']] as [BaseMap, string][]).map(([b, l]) => (
        <button key={b} onClick={() => setBaseMap(b)} className={`${full ? 'flex-1' : ''} px-3 py-1 rounded-md text-xs font-semibold transition ${baseMap === b ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
      ))}
    </div>
  );
  const labelsCtrl = () => (
    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer whitespace-nowrap">
      <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} className="accent-emerald-600 w-4 h-4" />Nhãn & đường
    </label>
  );
  // Nhãn ô số tờ: chỉ dám ghi "(mới)" khi xã đang chọn ĐÃ CÓ bảng tra số tờ,
  // vì xã chưa có bảng thì số nhập vào vẫn được hiểu là số tờ cũ.
  const nhanOSoTo = (cap === '2' && dsXaCap.find((x) => x.xaId === c3)?.coBangTo) ? 'Số tờ (mới)' : 'Số tờ';
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
          {searchMode === 'parcel' && (
            <select value={cap} onChange={(e) => { setCap(e.target.value as any); setC3(''); setHuyenChon(''); donKetQuaCu(); }} className={`border rounded-lg px-2 py-1.5 text-xs bg-white ${full ? 'flex-1 min-w-[84px]' : 'w-[96px]'}`} title="Cấp hành chính">
              <option value="3">3 cấp (huyện–xã)</option>
              <option value="2">2 cấp (xã mới)</option>
            </select>
          )}
          {/* ── THỨ TỰ: chọn ĐỊA GIỚI HÀNH CHÍNH TRƯỚC (huyện → xã), rồi mới tới số tờ/số thửa.
              Vì số tờ, số thửa chỉ có nghĩa khi đã biết đang hỏi ở xã nào. ── */}
          {searchMode === 'parcel' && (
            <>
              {/* ── CHỌN HUYỆN/TP CŨ ── bấm vào là GÕ TÌM được luôn, gõ không dấu cũng ra.
                  Nhóm 3 cấp sổ ra huyện/thị xã/TP cũ; nhóm 2 cấp sổ ra khu vực. ── */}
              <OChonCoGo
                nhan={cap === '3' ? '— Chọn huyện/TP cũ —' : '— Chọn khu vực —'}
                giaTri={huyenChon}
                dsMuc={dsHuyen.map(([h, n]) => ({ id: h, ten: h, phu: `${n} xã/phường` }))}
                khiChon={(h) => { setHuyenChon(h); setC3(''); donKetQuaCu(); }}
                className={full ? 'flex-1 min-w-[150px]' : 'w-44'} />

              {/* ── RỒI CHỌN XÃ/PHƯỜNG ── chọn huyện rồi thì chỉ sổ ra xã của huyện đó;
                  chưa chọn huyện thì sổ ra hết, gõ tên là lọc ngay. Chọn xong bản đồ bay tới.
                  Dòng phụ ghi tên huyện để phân biệt 10 cặp xã TRÙNG TÊN. Số thửa CHỈ hiện với
                  tài khoản quản trị — máy chủ không gửi con số đó cho người dùng thường. ── */}
              <OChonCoGo
                nhan={huyenChon ? `— Chọn xã/phường (${xaTheoHuyen.length}) —` : '— Gõ hoặc chọn xã/phường —'}
                giaTri={c3}
                dsMuc={xaTheoHuyen.map((x) => ({
                  id: x.xaId,
                  ten: x.ten,
                  phu: x.soThua ? `${x.huyen} · ${x.soThua.toLocaleString('vi-VN')} thửa` : x.huyen,
                }))}
                khiChon={(ma) => {
                  donKetQuaCu();                                    // xoá kết quả của xã trước
                  setC3(ma);
                  const x = dsXaCap.find((y) => y.xaId === ma) || null;
                  if (x) { setHuyenChon(x.huyen); bayToiXa(x); }   // bay thẳng tới xã đó
                }}
                className={full ? 'flex-1 min-w-[160px]' : 'w-48'} />
            </>
          )}
          {/* Tra theo THỬA thì gõ SỐ THỬA trước rồi mới tới SỐ TỜ — đúng thói quen đọc sổ.
              Các kiểu tra khác (toạ độ VN-2000, kinh/vĩ độ) vẫn giữ thứ tự cũ.
              Ô số tờ luôn là c1, ô số thửa luôn là c2 — chỉ đổi chỗ HIỂN THỊ, không đổi ruột. */}
          {searchMode === 'parcel' ? (
            <>
              <input value={c2} onChange={(e) => setC2(e.target.value)} placeholder="Số thửa" className={`border rounded-lg px-2.5 py-1.5 text-xs ${full ? 'flex-1 min-w-[80px]' : 'w-24'}`} />
              <input value={c1} onChange={(e) => setC1(e.target.value)} placeholder={nhanOSoTo} className={`border rounded-lg px-2.5 py-1.5 text-xs ${full ? 'flex-1 min-w-[80px]' : 'w-24'}`} />
            </>
          ) : (
            <>
              <input value={c1} onChange={(e) => setC1(e.target.value)} placeholder={searchMode === 'vn2000' ? 'X (Bắc)' : 'Vĩ độ'} className={`border rounded-lg px-2.5 py-1.5 text-xs ${full ? 'flex-1 min-w-[80px]' : 'w-24'}`} />
              <input value={c2} onChange={(e) => setC2(e.target.value)} placeholder={searchMode === 'vn2000' ? 'Y (Đông)' : 'Kinh độ'} className={`border rounded-lg px-2.5 py-1.5 text-xs ${full ? 'flex-1 min-w-[80px]' : 'w-24'}`} />
            </>
          )}
        </>
      )}
      <button onClick={doSearch} className={`cl-press bg-[#0A2540] hover:bg-[#0d2f54] text-white px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${full ? 'w-full mt-1' : ''}`}>Tra cứu</button>
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
  const tabBtn = (key: string, label: string, active: boolean, dot = false) => (
    <button onClick={
      key === 'layers' ? () => { setPanelOpen(true); setTool('none'); }
        : key === 'measure' ? () => { const open = tool !== 'measure'; setTool(open ? 'measure' : 'none'); setMeasure(open ? 'distance' : 'off'); setMResult(null); }
          : () => setTool(tool === key ? 'none' : (key as any))}
      className={`relative flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold transition active:scale-[.96] ${active ? 'bg-slate-100 text-[#0A2540]' : 'text-slate-600 hover:bg-slate-50'}`}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{key === 'search' ? <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></> : <path d={key === 'layers' ? 'M12 2 2 7l10 5 10-5-10-5z M2 12l10 5 10-5 M2 17l10 5 10-5' : key === 'base' ? 'M9 20l-5.5 2.5V6L9 3.5m0 16.5 6-2.5M9 20V3.5m6 14 5.5 2.5V6L15 3.5m0 14V3.5m0 0L9 6' : 'M4 8h16v8H4z M8 8v3M12 8v4M16 8v3'} />}</svg>{label}
      {dot && <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-orange-500" />}
    </button>
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] overflow-hidden mb-[calc(-48px-env(safe-area-inset-bottom))] md:mb-0">
      {/* Toolbar tra cứu quy hoạch — dính cố định; desktop đầy đủ, mobile gọn theo nhóm */}
      <div className="bg-white border-b border-slate-200 shrink-0 z-20">
        {/* MÁY TÍNH (lg+): một hàng đầy đủ, tự xuống dòng khi hẹp */}
        <div className="hidden lg:flex items-center gap-x-3 gap-y-2 px-4 py-2.5 flex-wrap">
          {baseMapCtrl()}
          {labelsCtrl()}
          <span className="h-5 w-px bg-slate-200" />
          {searchCtrl()}
          <span className="h-5 w-px bg-slate-200" />
          {measureCtrl()}
        </div>

        {/* ĐIỆN THOẠI / iPad dọc (<lg): 4 nút gọn, bấm để mở từng nhóm */}
        <div className="lg:hidden grid grid-cols-4 divide-x divide-slate-200">
          {tabBtn('layers', 'Lớp', false)}
          {tabBtn('search', 'Tra cứu', tool === 'search')}
          {tabBtn('base', 'Bản đồ', tool === 'base', baseMap !== 'street')}
          {tabBtn('measure', 'Đo', tool === 'measure', measure !== 'off')}
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
          <button onClick={() => setDrawOpen(true)} className="cl-press w-full mb-3 flex items-center justify-center gap-2 bg-[#0A2540] hover:bg-[#0d2f54] text-white text-sm font-bold py-2.5 rounded-lg">✏️ Vẽ thửa từ toạ độ</button>
          <div className="pt-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Ảnh quy hoạch</p>
            {RASTER_OVERLAYS.map((o) => (
              <label key={o.id} className="flex items-center gap-2.5 py-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={ovOn[o.id] ?? true} onChange={(e) => setOvOn((v) => ({ ...v, [o.id]: e.target.checked }))} className="accent-emerald-600 w-4 h-4" />
                <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0 bg-amber-500" /><span className="min-w-0 flex-1 truncate text-slate-700" title={o.name}>🛰️ {o.name}</span>
              </label>
            ))}
            <div className="mt-1 pl-[26px]">
              <div className="flex justify-between text-[11px] text-slate-400 mb-1"><span>Độ mờ</span><span className="font-semibold text-slate-500">{Math.round(opacity * 100)}%</span></div>
              <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="w-full accent-emerald-600" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-3 mb-1.5 pt-3 border-t">Lớp dữ liệu</p>
          {ranhXa && (
            <label className="flex items-center gap-2.5 py-1.5 text-sm cursor-pointer">
              <input type="checkbox" checked={ranhOn} onChange={(e) => setRanhOn(e.target.checked)} className="accent-emerald-600 w-4 h-4" />
              <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0 bg-[#C8A14B]" /><span className="flex-1 text-slate-700">🗺️ Ranh giới xã</span>
            </label>
          )}
          {layers.length === 0 && (
            <div className="space-y-2 py-1" aria-hidden>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-4 shrink-0" rounded="rounded" />
                  <Skeleton className="h-2.5 w-2.5 shrink-0" rounded="rounded-sm" />
                  <Skeleton h={12} className="flex-1" />
                </div>
              ))}
            </div>
          )}
          {layers.map((l) => (
            <div key={l.slug} className="flex items-center gap-2.5 py-1.5 text-sm">
              <input type="checkbox" checked={visible[l.slug] ?? false} onChange={(e) => setVisible((v) => ({ ...v, [l.slug]: e.target.checked }))} className="accent-emerald-600 w-4 h-4" />
              <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: (l.style?.color as string) || DEFAULT_COLORS[l.layerType] }} />
              <span className="flex-1 truncate text-slate-700" title={l.name}>{l.name}</span>
              <span className="text-xs text-slate-400">{l.featureCount}</span>
              {canDelete && <button onClick={() => deleteLayer(l.slug, l.name)} title="Xoá lớp" className="text-slate-300 hover:text-red-600">🗑</button>}
            </div>
          ))}
          {user && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">📌 {adminAll ? 'Tất cả đã lưu' : 'Sản phẩm của tôi'} ({places.length})</p>
                {laAdmin(user) && (
                  <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer"><input type="checkbox" checked={adminAll} onChange={(e) => setAdminAll(e.target.checked)} className="accent-[#7c3aed]" /> Xem tất cả</label>
                )}
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto scroll-soft">
                {places.length === 0 && <p className="text-[11px] text-slate-400">Chưa có. Bấm vào bản đồ rồi &quot;Lưu sản phẩm&quot;.</p>}
                {places.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 text-xs bg-slate-50 rounded px-2 py-1">
                    <button onClick={() => { setFocusPoint({ lng: p.lng, lat: p.lat }); setFitTo([[p.lng - 0.004, p.lat - 0.004], [p.lng + 0.004, p.lat + 0.004]]); }} className="flex-1 min-w-0 text-left hover:text-[#7c3aed]" title={p.note || ''}>
                      <span className="block truncate font-medium">{p.note || `X=${(p.x ?? 0).toFixed(0)}`}{p.price ? ` · ${p.price}` : ''}</span>
                      {adminAll && p.ownerName && <span className="block text-[10px] text-[#7c3aed] truncate">👤 {p.ownerName}{p.ownerPhone ? ' · ' + p.ownerPhone : ''}</span>}
                    </button>
                    {!adminAll && <button onClick={() => publishPlace(p)} title="Đăng tin này" className="shrink-0 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[10px] font-bold px-2 py-0.5 rounded">＋ Đăng</button>}
                    <button onClick={async () => { await removePlace(p.id).catch(() => {}); loadPlaces(); }} aria-label="Xoá" className="text-slate-300 hover:text-red-600 shrink-0">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-4">💡 Nhấp vào bản đồ để xem toạ độ + lưu sản phẩm + tra cứu thửa/quy hoạch.</p>
        </aside>

        <div className="relative flex-1">
          <MapView layers={geoLayers} overlays={overlays} markers={allMarkers} baseMap={baseMap} labels={labels} measureMode={measure}
            focusPoint={focusPoint} flyToPoint={flyPoint} highlight={highlight} onMapClick={onMapClick} onMeasure={setMResult} onViewport={onViewport} initialBounds={QH_BOUNDS} adMarkers={ads} adOpacity={1} fitTo={fitTo} textLabels={textLabels}
            routes={dirTuyen} onPickRoute={setDirChon} diaChinhTiles={dcTiles} />
          {/* ── DANH SÁCH THỬA TÌM ĐƯỢC ── hiện khi có nhiều thửa cùng số tờ/số thửa.
              Rất hay gặp khi tra theo XÃ MỚI, vì một xã mới gộp nhiều xã cũ mà mỗi xã cũ
              lại có bộ số tờ/số thửa riêng — trùng số là chuyện bình thường. ── */}
          {ketQuaTim.length > 1 && (
            <div className="absolute top-2 left-2 z-20 w-64 max-w-[calc(100%-1rem)] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[#0A2540] text-white">
                <span className="text-xs font-bold">Tìm thấy {ketQuaTim.length} thửa trùng số</span>
                <button onClick={() => setKetQuaTim([])} aria-label="Đóng" className="text-white/70 hover:text-white text-base leading-none">✕</button>
              </div>
              <div className="max-h-56 overflow-y-auto scroll-soft">
                {ketQuaTim.map((t) => (
                  <button key={t.id} onClick={() => moThuaTim(t)}
                    className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b last:border-b-0 border-slate-100">
                    <span className="block text-xs font-bold text-[#0A2540]">Tờ {t.soTo} · Thửa {t.soThua}
                      {t.dienTich != null && <span className="font-normal text-slate-500"> · {t.dienTich.toFixed(1)} m²</span>}
                    </span>
                    <span className="block text-[10px] text-slate-400 truncate">
                      {t.tenXaCu ? `${t.tenXaCu}${t.huyenCu ? ' · ' + t.huyenCu : ''}` : t.tenXa}
                    </span>
                  </button>
                ))}
              </div>
              <p className="px-3 py-1.5 text-[10px] text-slate-400 bg-slate-50">Bấm để xem từng thửa</p>
            </div>
          )}
          {zoomNow > 0 && zoomNow < PARCEL_SHOW_ZOOM && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-[#0A2540]/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow">🔍 Phóng to để hiện thửa đất</div>
          )}
          {/* BẢNG ĐẦY ĐỦ khi bấm gim tin lưu — như giỏ hàng */}
          {selPlace && (
            <div className="absolute bottom-[60px] sm:bottom-3 left-1/2 -translate-x-1/2 w-[360px] max-w-[94%] max-h-[64%] sm:max-h-[72%] overflow-y-auto z-20 bg-white rounded-2xl border-2 border-[#7c3aed]/40 shadow-2xl p-3.5 text-xs">
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
              <p className="font-bold text-[#0A2540] text-sm">{selPlace.features || selPlace.note || (selPlace.parcel ? `Thửa ${selPlace.parcel}` : 'Tin lưu')}</p>
              <div className="mt-1.5 space-y-1 text-slate-600">
                {(selPlace.parcel || selPlace.sheet || selPlace.ward) ? <div>🗺 {[selPlace.parcel && `Thửa ${selPlace.parcel}`, selPlace.sheet && `Tờ ${selPlace.sheet}`, selPlace.ward].filter(Boolean).join(' · ')}</div> : null}
                {(selPlace.price || selPlace.area) ? <div>{selPlace.price ? <>💰 <b className="text-red-600">{selPlace.price}</b></> : null}{selPlace.area ? <span className="text-slate-500"> · {selPlace.area} m²</span> : null}</div> : null}
                {(selPlace.owner || selPlace.phone) ? <div>👤 Chủ: <b>{selPlace.owner || '—'}</b>{selPlace.phone ? <> · <a href={`tel:${selPlace.phone}`} className="text-[#7c3aed] font-bold">{selPlace.phone}</a></> : null}</div> : null}
                {selPlace.commission ? <div>🤝 Hoa hồng: <b>{selPlace.commission}</b></div> : null}
                <div className="text-slate-400">📍 {selPlace.lat.toFixed(5)}, {selPlace.lng.toFixed(5)}</div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-extrabold text-emerald-600">KHÁCH QUAN TÂM ({interests.length})</span>
                  <button onClick={openAddInt} className="text-[#7c3aed] font-bold">＋ Thêm khách</button>
                </div>
                {interests.map((it) => (
                  <div key={it.id} className="flex items-center gap-1 py-0.5">
                    <span className="flex-1 truncate">🧑 <b>{it.custName || 'Khách'}</b>{it.custPhone ? <> · <a href={`tel:${it.custPhone}`} className="text-emerald-600 font-semibold">{it.custPhone}</a></> : null}</span>
                    {it.interest ? <span className="text-[9px] font-bold px-1 rounded bg-amber-100 text-amber-600">{it.interest}</span> : null}
                    {it.dealStatus ? <span className="text-[9px] font-bold px-1 rounded text-white" style={{ backgroundColor: dealColor(it.dealStatus) }}>{it.dealStatus}</span> : null}
                    <button onClick={() => delIntMap(it.id)} className="text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
                {interests.length === 0 && !showAddInt ? <p className="text-slate-400 text-[11px]">Chưa có khách quan tâm — bấm ＋ Thêm khách.</p> : null}
                {showAddInt && (
                  <div className="mt-1 bg-slate-50 rounded-lg p-2 space-y-1">
                    <select value={iCustId} onChange={(e) => setICustId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none">
                      <option value="">— Khách mới —</option>
                      {custList.map((c) => <option key={c.id} value={c.id}>{c.name || 'Khách'}{c.phone ? ' · ' + c.phone : ''}</option>)}
                    </select>
                    {!iCustId && (
                      <div className="flex gap-1">
                        <input value={iName} onChange={(e) => setIName(e.target.value)} placeholder="Tên khách" className="w-1/2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
                        <input value={iPhone} onChange={(e) => setIPhone(e.target.value)} placeholder="SĐT khách" inputMode="tel" className="w-1/2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
                      </div>
                    )}
                    <div className="flex gap-1">
                      <select value={iInterest} onChange={(e) => setIInterest(e.target.value)} className="w-1/2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none"><option value="">Mức QT…</option><option>Cao</option><option>Vừa</option><option>Thấp</option></select>
                      <select value={iDeal} onChange={(e) => setIDeal(e.target.value)} className="w-1/2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none"><option value="">Trạng thái…</option><option>Mới</option><option>Đang tư vấn</option><option>Thương lượng</option><option>Đã chốt</option><option>Không thành</option></select>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={saveInterest} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 rounded">Lưu khách</button>
                      <button onClick={() => setShowAddInt(false)} className="px-3 bg-white border border-slate-200 rounded">Huỷ</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 mt-2.5">
                <button onClick={() => publishPlace(selPlace)} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold py-1.5 rounded-lg">＋ Đăng tin này</button>
                <button onClick={() => moChiDuong(selPlace.lat, selPlace.lng, selPlace.note || 'Sản phẩm đã lưu')} className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded-lg">🧭 Chỉ đường</button>
                <button onClick={async () => { const id = selPlace.id; setSelPlace(null); await removePlace(id).catch(() => { }); loadPlaces(); }} className="bg-white border border-red-200 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50">🗑</button>
              </div>
            </div>
          )}
          {/* Thanh ĐỘ MỜ lớp phủ dạng DỌC nổi trên bản đồ — chỉ hiện trên điện thoại/iPad (bảng trái bị ẩn) */}
          {(qhFillOn || ovOn['qh-qd205']) && (
            <div className="lg:hidden absolute top-1/2 right-2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5 bg-white/95 backdrop-blur rounded-full border border-slate-200 shadow-lg px-1.5 py-3">
              <span className="text-[9px] font-bold text-slate-400">Đậm</span>
              <div className="relative h-28 w-5">
                <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="absolute left-1/2 top-1/2 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-90 accent-red-600 cursor-pointer" aria-label="Độ đậm lớp quy hoạch" />
              </div>
              <span className="text-[9px] font-bold text-slate-400">Mờ</span>
              <span className="text-[10px] font-extrabold text-[#0A2540]">{Math.round(opacity * 100)}%</span>
            </div>
          )}
          {/* ==== BẢNG CHỈ ĐƯỜNG: nhiều phương án, bấm chọn 1 tuyến (giống Google Maps) ==== */}
          {dirDen && (
            <div className="pointer-events-none absolute z-20 left-2 right-2 bottom-[70px] sm:bottom-auto sm:top-3 sm:left-3 sm:right-auto sm:w-[380px]">
              <ChiDuongPanel
                diemDi={dirDi} diemDen={dirDen}
                onDoiDiemDi={setDirDi} onDoiDiemDen={setDirDen}
                onChonTrenBanDo={(v) => setDirNhat(v)}
                onTuyen={setDirTuyen}
                onFit={(b) => setFitTo(b)}
                onDong={() => { setDirDen(null); setDirTuyen([]); setDirNhat(null); }}
                chonNgoai={dirChon}
                tamBanDo={viewRef.current ? { lng: (viewRef.current.west + viewRef.current.east) / 2, lat: (viewRef.current.south + viewRef.current.north) / 2 } : null}
              />
            </div>
          )}
          {dirNhat && (
            <div className="absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#0A2540] px-4 py-2 text-sm font-bold text-white shadow-lg">
              Bấm lên bản đồ để chọn {dirNhat === 'di' ? 'điểm đi' : 'điểm đến'}
              <button onClick={() => setDirNhat(null)} className="ml-3 text-white/70 hover:text-white">✕</button>
            </div>
          )}
          {focusPoint && (
            <div className="absolute bottom-[60px] sm:bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white rounded-full shadow-lg border border-slate-200 pl-4 pr-2 py-1.5 max-w-[92%]">
              <span className="text-sm font-semibold text-[#0A2540] truncate max-w-[42vw]">📍 {focusPoint.label || 'Vị trí tìm kiếm'}</span>
              <button onClick={() => moChiDuong(focusPoint.lat, focusPoint.lng, focusPoint.label || 'Vị trí tìm kiếm')} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full px-3.5 py-1.5 whitespace-nowrap">🧭 Chỉ đường</button>
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
              <button onClick={() => moChiDuong(drawResult.lat, drawResult.lng, 'Thửa đã vẽ')} className="mt-2 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg py-2">🧭 Chỉ đường tới thửa</button>
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
                      <div className="rounded-lg border border-[#C8A14B]/40 bg-[#C8A14B]/[0.06] p-2.5">
                        <p className="text-xs font-bold text-[#0A2540] mb-1.5">📋 Dán nhanh toạ độ (chính xác 100%, không cần chụp)</p>
                        <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={3} placeholder={'Dán từ Excel/Word/Zalo, mỗi dòng 1 điểm:\n1  1335000.50  567890.12\n2  1335010.20  567900.35'} className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono outline-none focus:border-[#0A2540]" />
                        <button onClick={applyPaste} className="mt-1.5 w-full bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold py-2 rounded-lg text-sm">Tách số vào bảng ↓</button>
                      </div>
                      {ocrOk > 0 && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg px-3 py-2">✅ Đã nhận {ocrOk} điểm{ocrEngine ? ' · nguồn: ' + engineLabel(ocrEngine) : ''}{ocrEngine && ocrEngine !== 'paste' ? ' đang trong giai đoạn thử nghiệm' : ''}. Vui lòng kiểm tra lại số rồi bấm “Vẽ & zoom tới thửa”.</div>}
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
                      {ocrBusy && (
                        <div className="pt-1">
                          <div className="flex items-center justify-between text-sm text-[#0A2540] font-semibold mb-1"><span>{ocrBusy}</span><span>{ocrPct}%</span></div>
                          <div className="h-2 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-[#0A2540] rounded-full transition-all duration-200 ease-out" style={{ width: ocrPct + '%' }} /></div>
                        </div>
                      )}
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
                <div className="border-2 border-emerald-400 rounded-lg" style={{ width: '96%', height: '86%', boxShadow: '0 0 0 100vmax rgba(0,0,0,0.5)' }} />
              </div>
              <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pb-4 text-white bg-gradient-to-b from-black/70 to-transparent" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
                <span className="font-semibold text-lg drop-shadow">Chụp bảng toạ độ</span>
                <button onClick={stopCam} aria-label="Đóng" className="w-10 h-10 rounded-full bg-white/15 backdrop-blur grid place-items-center text-2xl leading-none">✕</button>
              </div>
              <div className="absolute bottom-0 inset-x-0 px-6 pt-10 text-center bg-gradient-to-t from-black/80 via-black/40 to-transparent" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
                <p className="text-white/90 text-sm mb-4 drop-shadow">Đưa bảng toạ độ vừa khít trong khung — chụp thẳng, rõ nét.</p>
                <button onClick={capture} aria-label="Chụp" className="group relative mx-auto block w-[76px] h-[76px] rounded-full active:scale-90 transition-transform duration-150">
                  <span className="absolute inset-0 rounded-full border-[3px] border-white/95 shadow-lg" />
                  <span className="absolute inset-[5px] rounded-full bg-white transition-all duration-150 group-active:inset-[10px] group-active:bg-white/70" />
                </button>
              </div>
              <div className={`absolute inset-0 z-[75] bg-white pointer-events-none transition-opacity ${camFlash ? 'opacity-80 duration-0' : 'opacity-0 duration-300'}`} />
              {ocrBusy && <div className="absolute inset-0 z-[76] bg-black/70 grid place-items-center text-white font-semibold px-6"><div className="w-64 max-w-[80%]"><div className="flex items-center justify-between text-sm mb-2"><span>{ocrBusy}</span><span>{ocrPct}%</span></div><div className="h-2 rounded-full bg-white/25 overflow-hidden"><div className="h-full bg-white rounded-full transition-all duration-200 ease-out" style={{ width: ocrPct + '%' }} /></div></div></div>}
            </div>
          )}
          {info && (
            <div className={`absolute left-2 right-2 bottom-[calc(58px+env(safe-area-inset-bottom))] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-3 sm:w-96 sm:max-w-[calc(100%-1.5rem)] ${sheetExpanded ? 'max-h-[80%]' : 'max-h-[58%]'} sm:max-h-[72%] overflow-y-auto z-20 bg-white rounded-2xl shadow-2xl border border-slate-200 transition-[max-height] duration-300`}>
              <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 rounded-t-2xl">
                <button onClick={() => setSheetExpanded((v) => !v)} className="sm:hidden w-full flex flex-col items-center pt-2 pb-0.5" aria-label={sheetExpanded ? 'Thu gọn' : 'Kéo lên xem đầy đủ'}>
                  <span className="w-10 h-1.5 rounded-full bg-slate-300" />
                  <span className="text-[10px] font-bold text-slate-400 mt-1">{sheetExpanded ? '▼ Thu gọn' : '▲ Kéo lên xem đầy đủ'}</span>
                </button>
                <div className="flex justify-between items-center px-4 py-2.5">
                  <h3 className="font-extrabold text-[#0A2540] text-base">Thông tin thửa</h3>
                  <button onClick={() => setInfo(null)} className="text-slate-400 hover:text-slate-700 w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100 text-lg leading-none">✕</button>
                </div>
              </div>
              <div className="px-4 py-3 text-sm">
                {info.parcel ? (() => {
                  const props = info.parcel.properties || {};
                  const owner = pickProp(props, ['TenChu', 'ten_chu', 'ChuSuDung', 'ChuSDD', 'TenChuSuDung', 'chusdd', 'HoTen', 'ho_ten', 'NguoiSDD', 'TEN_CHU']);
                  // "Khu vực mới" = đơn vị hành chính HIỆN HÀNH (sau sáp nhập 1/7/2025).
                  // "Khu vực cũ"  = tên xã/phường + huyện TRƯỚC sáp nhập, chỉ hiện khi thửa nằm ở xã cũ.
                  // Máy chủ tra bảng sáp nhập rồi trả về sẵn, không suy đoán ở đây.
                  const cuTen = (info.parcel as any).xaCu as string | null;
                  const cuHuyen = (info.parcel as any).huyenCu as string | null;
                  const khuCu = pickProp(props, ['KhuVucCu', 'khu_vuc_cu', 'DiaChiCu', 'TenTT', 'ten_tt'])
                    || (cuTen ? (cuHuyen ? `${cuTen} · ${cuHuyen}` : cuTen) : '');
                  const khuMoi = pickProp(props, ['KhuVucMoi', 'khu_vuc_moi', 'DiaChiMoi']) || info.parcel.xa || '';
                  // Số tờ trong DỮ LIỆU luôn là số tờ CŨ. Số tờ MỚI chỉ có khi xã đó đã có bảng tra.
                  // Số tờ CŨ: ưu tiên con số máy chủ lấy từ bảng tra (đúng theo giấy tờ), vì ở
                  // Ninh Hoà / Vạn Ninh số đang lưu trong dữ liệu chính là số tờ MỚI rồi.
                  const toCu = ((info.parcel as any).soToCu as string | null) || info.parcel.soTo || '';
                  const toMoi = ((info.parcel as any).soToMoi as string | null) || '';
                  // Chỉ nhắc "chưa có bảng tra" ở xã GỘP TỪ NHIỀU XÃ CŨ. Xã chỉ gồm 1 xã cũ thì
                  // số tờ vốn không đổi, nhắc vào chỉ tổ rối.
                  const thieuBangTra = !!(info.parcel as any).canBangTraSoTo;
                  // Đang xem theo lớp 3 CẤP (xã cũ) hay 2 CẤP (xã mới)? Dữ liệu chưa phủ kín nên ở
                  // chế độ 3 cấp thì TÊN XÃ CŨ mới là danh tính chính — phải cho lên trước.
                  const xemXaCu = cap === '3';
                  const soToChinh = xemXaCu ? toCu : (toMoi || toCu);
                  const nhanSoTo = !toMoi ? 'Số tờ' : (xemXaCu ? 'Số tờ (cũ)' : 'Số tờ (mới)');
                  const code = pickProp(props, ['KyHieu', 'MaLoaiDat', 'MDSD', 'MDSDD', 'LoaiDat', 'ky_hieu', 'ma_loai_dat']);
                  const name = pickProp(props, ['TenLoaiDat', 'TenMDSD', 'ten_loai_dat', 'MoTa', 'GhiChu']);
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div><div className="text-[11px] text-slate-400">{nhanSoTo}</div><div className="font-bold text-[#0A2540]">{soToChinh || '—'}</div></div>
                        <div><div className="text-[11px] text-slate-400">Số thửa</div><div className="font-bold text-[#0A2540]">{info.parcel.soThua || '—'}</div></div>
                        <div><div className="text-[11px] text-slate-400">Diện tích</div><div className="font-bold text-[#0A2540]">{info.parcel.areaM2 != null ? info.parcel.areaM2.toFixed(1) + ' m²' : '—'}</div></div>
                      </div>
                      {/* ── XEM THEO LỚP 3 CẤP: tên xã CŨ lên trước, khu vực mới + số tờ mới ghi ở dưới ── */}
                      {xemXaCu ? (
                        <>
                          {khuCu
                            ? <div className="text-slate-600 mt-1"><b className="text-[#0A2540]">{khuCu}</b></div>
                            : (khuMoi && <div className="text-slate-600 mt-1"><b className="text-[#0A2540]">{khuMoi}</b></div>)}
                          {khuMoi && khuCu && (
                            <div className="text-slate-500 text-[11px] mt-0.5">
                              <span className="text-slate-400">Khu vực mới: </span>{khuMoi}
                              {toMoi && toMoi !== toCu && <> · <span className="text-slate-400">tờ mới </span><b className="text-[#0A2540]">{toMoi}</b></>}
                            </div>
                          )}
                          {thieuBangTra && <div className="text-slate-400 text-[10px] mt-0.5">Xã mới chưa có bảng tra số tờ</div>}
                        </>
                      ) : (
                        /* ── XEM THEO LỚP 2 CẤP: tên xã MỚI lên trước, tên cũ + số tờ cũ ghi ở dưới ── */
                        <>
                          {khuMoi && <div className="text-slate-600 mt-1"><b className="text-[#0A2540]">{khuMoi}</b></div>}
                          {(khuCu || toMoi) && (
                            <div className="text-slate-500 text-[11px] mt-0.5">
                              <span className="text-slate-400">Trước sáp nhập: </span>{khuCu || '—'}
                              {/* Xã nào sáp nhập mà số tờ GIỮ NGUYÊN (vd Vạn Ninh, Ninh Hoà) thì tờ mới
                                  trùng tờ cũ — ghi lại lần nữa chỉ tổ rối, nên bỏ. */}
                              {toMoi && toCu && toMoi !== toCu && <> · <span className="text-slate-400">tờ cũ </span><b className="text-[#0A2540]">{toCu}</b></>}
                            </div>
                          )}
                          {thieuBangTra && <div className="text-slate-400 text-[10px] mt-0.5">Xã này chưa có bảng tra số tờ mới — số đang hiện là số tờ cũ</div>}
                        </>
                      )}
                      <button onClick={() => setParcelMore((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#7c3aed] hover:text-[#6d28d9]">{parcelMore ? '▴ Thu gọn' : '▾ Xem thêm (quy hoạch, toạ độ…)'}</button>
                      {parcelMore && (
                        <div className="mt-1">
                          {owner && <div className="text-slate-600 mt-1"><span className="text-slate-400">Tên chủ: </span><b className="text-[#0A2540]">{owner}</b></div>}
                          {(code || name) && (
                            <div className="mt-2.5 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                              {info.parcel.areaM2 != null && <b className="text-[#0A2540] shrink-0">{info.parcel.areaM2.toFixed(0)} m²</b>}
                              {code && <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${landColor(code)}`}>{code}</span>}
                              {name && <span className="text-slate-600 truncate">{name}</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })() : (
                  <p className="text-slate-500">Không có dữ liệu thửa tại điểm này{clickVN ? ` · ${clickVN.lat.toFixed(6)}, ${clickVN.lng.toFixed(6)}` : ''}.</p>
                )}

                {info.parcel && info.overlaps && info.overlaps.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Quy hoạch chung 2045</p>
                    {info.overlaps.map((o, i) => <div key={i} className="flex justify-between items-center gap-2 py-0.5"><span className="text-slate-600">{o.type}</span><span className="font-medium shrink-0">{fmtArea(o.areaM2)}</span></div>)}
                  </div>
                )}

                {/* Ngoài huyện Cam Lâm cũ thì CHƯA có dữ liệu quy hoạch. Nói thẳng ra, vì trước đây
                    máy chủ đoán bừa mọi thửa ngoài vùng thành "Đất giao thông" phủ kín cả thửa. */}
                {info.parcel && info.qhNgoaiVung && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Quy hoạch</p>
                    <p className="text-slate-500 leading-relaxed">
                      Khu vực này <b>chưa có dữ liệu quy hoạch</b> trong hệ thống.
                      Hiện mới có <b>Quy hoạch chung đô thị mới Cam Lâm đến 2045</b> (QĐ 205/QĐ-TTg) cho huyện Cam Lâm cũ.
                    </p>
                  </div>
                )}

                {/* Phiếu trích lục ghi rõ "Quy hoạch chung đô thị mới Cam Lâm 2045" nên chỉ cho xuất
                    khi thửa nằm trong vùng có dữ liệu — ngoài vùng mà in ra là phiếu sai. */}
                {info.parcel && !info.qhNgoaiVung && (
                  <button
                    onClick={() => {
                      const g = (highlight as any)?.geometry || (info.parcel as any)?.geometry;
                      const mapScen = qhScenario === 'all' ? '2045' : qhScenario;
                      // Ranh WGS84 của thửa (để đo diện tích theo ảnh QĐ205).
                      const ring: number[][] = g?.type === 'Polygon' ? (g.coordinates?.[0] || [])
                        : g?.type === 'MultiPolygon' ? ((g.coordinates || []).reduce((a: number[][], poly: any) => ((poly?.[0]?.length || 0) > (a?.length || 0) ? poly[0] : a), [] as number[][])) : [];
                      // MỞ cửa sổ TRƯỚC (tránh chặn pop-up) → tính diện tích theo ẢNH QH (bất đồng bộ) → ghi phiếu.
                      const win = window.open('', '_blank');
                      if (!win) { alert('Trình duyệt đang chặn cửa sổ. Hãy cho phép pop-up rồi thử lại.'); return; }
                      try { win.document.write('<!doctype html><meta charset="utf-8"><body style="font:14px sans-serif;color:#334155;padding:24px">Đang tạo phiếu kiểm tra quy hoạch…</body>'); } catch { /* */ }
                      const finish = (overlaps: any[]) => {
                        const hzA: Record<string, number> = {};
                        for (const x of (overlaps || []) as any[]) if (x?.hz) hzA[String(x.hz)] = (hzA[String(x.hz)] || 0) + (Number(x.areaM2) || 0);
                        const pieceHz = Object.keys(hzA).sort((a, b) => hzA[b] - hzA[a])[0] || mapScen;
                        const html = phieuQhHtml({ parcel: info.parcel as any, geometry: g, overlaps, qhPieces: qhPiecesFor(g, pieceHz), roadFeats: roadFeatsFor(g), neighbors: (info as any).neighbors || [], point: info.point, user: user as any, scenario: mapScen, roadHz: pieceHz });
                        try { win.document.open(); win.document.write(html); win.document.close(); win.focus(); } catch { /* */ }
                      };
                      const areas = (info.overlaps && info.overlaps.length) ? info.overlaps : qhAreasFromVector(ring); finish(areas.length ? areas : []);
                    }}
                    className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold bg-[#0A2540] hover:bg-[#0d3a6b] text-white">
                    🖨 Xuất phiếu kiểm tra quy hoạch
                  </button>
                )}

                {(!info.parcel || parcelMore) && clickVN && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <div className="text-[11px] text-slate-400">VN-2000: <b className="text-slate-600">X={clickVN.x.toFixed(2)}</b> · <b className="text-slate-600">Y={clickVN.y.toFixed(2)}</b></div>
                    {user && showSave && (
                      <div className="mt-2 space-y-1">
                        <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Tên / mô tả sản phẩm *" className="w-full text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        <div className="flex gap-1">
                          <input value={pParcel} onChange={(e) => setPParcel(e.target.value)} placeholder="Thửa *" className="w-1/3 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                          <input value={pSheet} onChange={(e) => setPSheet(e.target.value)} placeholder="Tờ *" className="w-1/3 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                          <input value={pWard} onChange={(e) => setPWard(e.target.value)} placeholder="Xã *" className="w-1/3 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        </div>
                        <input value={pFeat} onChange={(e) => setPFeat(e.target.value)} placeholder="Đặc điểm & lưu ý *" className="w-full text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        <div className="flex gap-1">
                          <input value={pPrice} onChange={(e) => setPPrice(e.target.value)} placeholder="Giá * (vd 2 tỷ)" className="flex-1 min-w-0 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                          <input value={pArea} onChange={(e) => setPArea(e.target.value)} placeholder="DT m² *" className="w-16 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        </div>
                        <div className="flex gap-1">
                          <input value={pOwner} onChange={(e) => setPOwner(e.target.value)} placeholder="Tên chủ *" className="flex-1 min-w-0 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                          <input value={pPhone} onChange={(e) => setPPhone(e.target.value)} placeholder="SĐT chủ *" inputMode="tel" className="flex-1 min-w-0 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        </div>
                        <input value={pComm} onChange={(e) => setPComm(e.target.value)} placeholder="Hoa hồng (vd 1%)" className="w-full text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        <div className="flex items-center gap-1 flex-wrap">
                          {pImages.map((u) => (
                            <div key={u} className="relative w-9 h-9 rounded overflow-hidden border border-slate-200">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={u} alt="" className="w-full h-full object-cover" />
                              <button onClick={() => setPImages((p) => p.filter((x) => x !== u))} className="absolute top-0 right-0 bg-black/60 text-white text-[9px] w-3.5 h-3.5 grid place-items-center">✕</button>
                            </div>
                          ))}
                          {pImages.length < 5 && (
                            <label className="w-9 h-9 rounded border border-dashed border-slate-300 grid place-items-center text-slate-400 cursor-pointer hover:border-[#7c3aed]">
                              {pUp ? '…' : '＋'}
                              <input type="file" accept="image/*" multiple onChange={onPlaceFiles} className="hidden" />
                            </label>
                          )}
                          <span className="text-[10px] text-slate-400">Ảnh {pImages.length}/5</span>
                        </div>
                        <button onClick={savePlace} disabled={pUp} className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-60 text-white font-bold py-1.5 rounded text-xs">💾 Lưu sản phẩm này</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {user ? (
                    <button onClick={() => setShowSave((v) => { const nv = !v; if (nv) { setSheetExpanded(true); setParcelMore(true); } return nv; })} className={`flex items-center justify-center gap-1 rounded-lg py-2.5 text-xs font-bold transition ${showSave ? 'bg-[#7c3aed] text-white' : 'bg-[#7c3aed]/10 text-[#7c3aed] hover:bg-[#7c3aed]/20'}`}>📌 Lưu điểm</button>
                  ) : (
                    <Link href="/login" className="flex items-center justify-center gap-1 rounded-lg py-2.5 text-xs font-bold bg-[#7c3aed]/10 text-[#7c3aed]">🔒 Lưu điểm</Link>
                  )}
                  <button onClick={() => { const t = `Tờ ${info.parcel?.soTo || '?'}, Thửa ${info.parcel?.soThua || '?'} — ${info.parcel?.xa || 'Cam Lâm'}${info.point ? ` (${info.point.lat.toFixed(6)},${info.point.lng.toFixed(6)})` : ''}`; navigator.clipboard?.writeText(t).then(() => alert('Đã sao chép mã chia sẻ:\n' + t)).catch(() => alert(t)); }} className="flex items-center justify-center gap-1 rounded-lg py-2.5 text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">🔗 Chia sẻ</button>
                  {info.point && <button onClick={() => moChiDuong(info.point!.lat, info.point!.lng, 'Thửa đang xem')} className="flex items-center justify-center gap-1 rounded-lg py-2.5 text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">🧭 Chỉ đường</button>}
                </div>
              </div>
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
