'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
// TẠO VIDEO BẢN ĐỒ VỆ TINH (dùng tạm — dễ gỡ). Vẽ lô đất + tuyến đường chạy động, bay/zoom camera, chèn chữ & logo,
// quay canvas 1080p (MediaRecorder) → gửi máy chủ đổi MP4. Ảnh vệ tinh: tái dùng lớp Google của web.
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { toast } from '@/lib/toast';
import { MAP } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const NAVY = '#0A2540', GOLD = '#C8A14B';
// Các lớp bản đồ Esri (trực tiếp từ trình duyệt — sạch CORS nên QUAY được). Giới hạn ~z18 để tránh ô "no data".
const ESRI = (svc: string) => [`https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/{z}/{y}/{x}`];
const SAT = ESRI('World_Imagery');
const LABELS = ESRI('Reference/World_Boundaries_and_Places');
const STREET = ESRI('World_Street_Map');
const DARK = ESRI('Canvas/World_Dark_Gray_Base');

type Mode = 'none' | 'parcel' | 'route' | 'marker' | 'radius' | 'distance' | 'edit';

// ── PHASE 2: 1 dự án → 5 kịch bản. Mỗi kịch bản có bộ cài đặt riêng; dùng chung dữ liệu bản đồ + thông tin dự án. ──
const STORAGE_KEY = 'camlam_mapvideo_project_v1';
const BRAND_KEY = 'camlam_brandkit_v1'; // logo + liên hệ dùng chung cho mọi dự án
const SCRIPTS0 = [
  { key: 'vitri', name: '01 · Vị trí', focus: 'Tỉnh/huyện/xã · vị trí dự án · ranh dự án' },
  { key: 'hatang', name: '02 · Hạ tầng', focus: 'Cao tốc · quốc lộ · sân bay · cảng · trung tâm' },
  { key: 'tienich', name: '03 · Tiện ích', focus: 'Trường · bệnh viện · chợ · biển · TTTM' },
  { key: 'dautu', name: '04 · Đầu tư', focus: 'Vị trí · kết nối · hạ tầng · khu phát triển' },
  { key: 'banhang', name: '05 · Bán hàng', focus: 'Sản phẩm · diện tích · giá · ưu điểm · CTA' },
  { key: 'chiduong', name: '06 · Dẫn đường', focus: 'Tổng thể → cận thửa → chạy tuyến tới đích → mở rộng xung quanh' },
];
type Sub = { s: number; e: number; t: string };
type Settings = { title: string; sub: string; layout: Layout; orient: '16:9' | '9:16' | '1:1'; res: '1080' | '720'; duration: number; base: 'sat' | 'street' | 'dark'; parcelFx: 'glow' | 'blink' | 'ants' | 'static'; parcelColor: string; chartOn: boolean; chartTitle: string; chartType: 'bar' | 'line'; chartRaw: string; subs?: Sub[]; camStyle?: string; textAnim?: string; camKeys?: CamKeyframe[]; objects?: Obj[]; scenes?: Scene[] };
const TEXTANIMS: { key: string; name: string }[] = [{ key: 'fade', name: 'Mờ dần' }, { key: 'slideUp', name: 'Trượt lên' }, { key: 'typewriter', name: 'Đánh máy' }, { key: 'none', name: 'Không' }];
const CAMSTYLES: { key: string; name: string }[] = [
  { key: '', name: 'Theo kịch bản' }, { key: 'overview', name: '🖼 Toàn cảnh (giữ tất cả trong khung)' }, { key: 'vitri', name: 'Định vị (xa→gần)' }, { key: 'hatang', name: 'Quét ngang' },
  { key: 'tienich', name: 'Xoay quanh' }, { key: 'dautu', name: 'Đẩy sát điện ảnh' }, { key: 'banhang', name: 'Bám sát nhanh' }, { key: 'chiduong', name: 'Dẫn đường (bám tuyến)' },
  { key: 'orbit360', name: '🎬 Flycam xoay 360°' }, { key: 'spiral', name: '🎬 Xoáy ốc bay vào' }, { key: 'crane', name: '🎬 Cần cẩu nâng (crane)' }, { key: 'lowsweep', name: '🎬 Lướt thấp sát mặt' },
  { key: 'reveal', name: '🎬 Lộ diện (trên→3D)' }, { key: 'cinematic', name: '🎬 Điện ảnh chậm' }, { key: 'energetic', name: '🎬 Sôi động bùng nổ' }, { key: 'boomerang', name: '🎬 Vòng cung boomerang' },
  { key: 'custom', name: '🎯 Keyframe tự đặt' },
];
type CamKeyframe = { t: number; lng: number; lat: number; zoom: number; pitch: number; bearing: number };
type Scene = { id: string; name: string; dur: number }; // phân cảnh theo thời lượng
// Object tự do (chữ/ảnh) đặt trên video: vị trí chuẩn hoá x,y ∈ [0,1] (tâm), co/xoay/mờ/thời gian.
type Obj = { id: string; type: 'text' | 'image' | 'video'; x: number; y: number; scale: number; rot: number; opacity: number; s: number; e: number; text?: string; size?: number; color?: string; weight?: number; bg?: boolean; src?: string; aspect?: number; locked?: boolean; hidden?: boolean };
// Vẽ 1 object lên canvas video theo thời điểm el.
function drawObj(ctx: CanvasRenderingContext2D, W: number, H: number, o: Obj, img: any, el: number) {
  if (o.hidden || el < o.s || el > o.e) return; const k = H / 1080; const cx = o.x * W, cy = o.y * H;
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, o.opacity)); ctx.translate(cx, cy); ctx.rotate((o.rot || 0) * Math.PI / 180);
  if (o.type === 'text') {
    const fs = (o.size || 48) * k * (o.scale || 1); ctx.font = `${o.weight || 700} ${fs}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const t = o.text || ''; if (o.bg) { const w = ctx.measureText(t).width; const padX = fs * 0.4, padY = fs * 0.25, bw = w + padX * 2, bh = fs + padY * 2; ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, -bw / 2, -bh / 2, bw, bh, fs * 0.2); ctx.fill(); }
    ctx.fillStyle = o.color || '#ffffff'; ctx.fillText(t, 0, 0);
  } else if ((o.type === 'image' || o.type === 'video') && img) { const w = 300 * k * (o.scale || 1), h = w / (o.aspect || 1.5); try { ctx.drawImage(img, -w / 2, -h / 2, w, h); } catch { /* video chưa sẵn frame */ } }
  ctx.restore();
}
// Nội suy camera theo keyframe tại thời điểm el (giây).
function camAtTime(keys: CamKeyframe[], el: number): { lng: number; lat: number; zoom: number; pitch: number; bearing: number } {
  const ks = [...keys].sort((a, b) => a.t - b.t); const n = ks.length;
  if (el <= ks[0].t) return ks[0]; if (el >= ks[n - 1].t) return ks[n - 1];
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  for (let i = 0; i < n - 1; i++) { if (el >= ks[i].t && el <= ks[i + 1].t) { const a = ks[i], b = ks[i + 1]; let lt = (el - a.t) / ((b.t - a.t) || 1); lt = lt * lt * (3 - 2 * lt); let db = b.bearing - a.bearing; if (db > 180) db -= 360; if (db < -180) db += 360; return { lng: L(a.lng, b.lng, lt), lat: L(a.lat, b.lat, lt), zoom: L(a.zoom, b.zoom, lt), pitch: L(a.pitch, b.pitch, lt), bearing: a.bearing + db * lt }; } }
  return ks[n - 1];
}
function mkSettings(key: string, name = 'Đất nền Cam Lâm', phone = '0988 888 888'): Settings {
  // Tiêu đề CHỈ là tên dự án — KHÔNG ghép nhãn kịch bản (Vị trí/Dẫn đường…) vào video.
  return { title: name, sub: 'Liên hệ: ' + phone, layout: 'bottomLeft', orient: '16:9', res: '1080', duration: 8, base: 'sat', parcelFx: 'glow', parcelColor: '#C8A14B', chartOn: false, chartTitle: 'Lượt quan tâm theo ngày', chartType: 'bar', chartRaw: 'T2:80, T3:120, T4:150, T5:190, T6:250, T7:300', subs: [], textAnim: 'fade' };
}
// Tự sinh LỜI THOẠI (caption theo thời gian) cho từng kịch bản — để "ghi kịch bản vào video".
function genScript(key: string, p: { name?: string; address?: string; area?: string; price?: string; phone?: string }, dur: number): Sub[] {
  const name = p.name?.trim() || 'Dự án'; const area = p.area?.trim(); const price = p.price?.trim(); const phone = p.phone?.trim() || ''; const addr = p.address?.trim();
  const L: Record<string, string[]> = {
    vitri: [name, addr ? `Vị trí: ${addr}` : 'Vị trí đắc địa, kết nối vùng', 'Ranh giới dự án rõ ràng'],
    hatang: ['Hạ tầng kết nối đồng bộ', 'Gần cao tốc – quốc lộ', 'Liền kề sân bay & tuyến chính'],
    tienich: ['Tiện ích bao quanh', 'Trường học – chợ – bệnh viện', 'Gần biển, tiện an cư'],
    dautu: ['Cơ hội đầu tư hấp dẫn', 'Khu vực phát triển mạnh', price ? `Chỉ từ ${price}` : 'Tiềm năng tăng trưởng'],
    banhang: [name, [area && `DT ${area}m²`, price && `Giá ${price}`].filter(Boolean).join(' – ') || 'Sản phẩm mở bán', phone ? `Liên hệ: ${phone}` : 'Liên hệ ngay'],
    chiduong: ['Từ trung tâm tới dự án', 'Lộ trình thuận tiện', `Điểm đến: ${name}`],
  };
  const lines = (L[key] || [name]).filter(Boolean) as string[];
  const n = lines.length || 1; const seg = Math.max(1, dur) / n;
  return lines.map((t, i) => ({ s: +(i * seg).toFixed(1), e: +Math.min(dur, (i + 1) * seg).toFixed(1), t }));
}
// Nhập phụ đề từ SRT/VTT → mảng {s,e,t}.
function parseSrtVtt(text: string): Sub[] {
  const toSec = (s: string) => { const x = s.trim().replace(',', '.'); const m = x.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/); if (m) return +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]); const m2 = x.match(/(\d+):(\d+(?:\.\d+)?)/); return m2 ? +m2[1] * 60 + parseFloat(m2[2]) : 0; };
  const out: Sub[] = [];
  for (const b of text.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = b.split('\n').filter((l) => l.trim() !== '');
    const tl = lines.find((l) => l.includes('-->')); if (!tl) continue;
    const [a, c] = tl.split('-->'); const s = toSec(a), e = toSec(c);
    const t = lines.slice(lines.indexOf(tl) + 1).join(' ').trim();
    if (t && e > s) out.push({ s: +s.toFixed(1), e: +e.toFixed(1), t });
  }
  return out;
}
type Layout = 'bottomLeft' | 'bottomCenter' | 'topLeft' | 'card';
// PHASE 8: MẪU BĐS 1-chạm — set bố cục + khổ + hiệu ứng + camera + lời thoại thật vào kịch bản đang mở.
type Tpl = { key: string; name: string; layout: Layout; orient: '16:9' | '9:16' | '1:1'; fx: 'glow' | 'blink' | 'ants' | 'static'; color: string; cam: string; chartOn: boolean; lines: string[] };
const TEMPLATES: Tpl[] = [
  { key: 'vitri', name: 'Vị trí', layout: 'bottomLeft', orient: '16:9', fx: 'glow', color: '#C8A14B', cam: 'vitri', chartOn: false, lines: ['Vị trí đắc địa', 'Kết nối trung tâm', 'Ranh dự án rõ ràng'] },
  { key: 'sanbay', name: 'Gần sân bay', layout: 'topLeft', orient: '16:9', fx: 'ants', color: '#ff3b30', cam: 'hatang', chartOn: false, lines: ['Liền kề sân bay', 'Di chuyển thuận tiện', 'Kết nối vùng nhanh'] },
  { key: 'bien', name: 'Gần biển', layout: 'bottomCenter', orient: '9:16', fx: 'glow', color: '#22c55e', cam: 'tienich', chartOn: false, lines: ['Gần biển trong xanh', 'Không khí trong lành', 'An cư – nghỉ dưỡng'] },
  { key: 'hatang', name: 'Hạ tầng', layout: 'topLeft', orient: '16:9', fx: 'ants', color: '#ff3b30', cam: 'hatang', chartOn: false, lines: ['Hạ tầng đồng bộ', 'Cao tốc – quốc lộ', 'Phát triển mạnh'] },
  { key: 'tienich', name: 'Tiện ích', layout: 'bottomCenter', orient: '1:1', fx: 'glow', color: '#22c55e', cam: 'tienich', chartOn: false, lines: ['Tiện ích bao quanh', 'Trường – chợ – bệnh viện', 'Sống tiện nghi'] },
  { key: 'datnen', name: 'Đất nền', layout: 'card', orient: '16:9', fx: 'blink', color: '#C8A14B', cam: 'banhang', chartOn: false, lines: ['Đất nền sổ đỏ', 'Pháp lý rõ ràng', 'Xây dựng tự do'] },
  { key: 'dautu', name: 'Đầu tư', layout: 'card', orient: '16:9', fx: 'glow', color: '#3b82f6', cam: 'dautu', chartOn: true, lines: ['Cơ hội đầu tư', 'Tăng trưởng bền vững', 'Sinh lời hấp dẫn'] },
  { key: 'banhang', name: 'Bán hàng', layout: 'bottomCenter', orient: '9:16', fx: 'blink', color: '#C8A14B', cam: 'banhang', chartOn: false, lines: ['Mở bán giai đoạn mới', 'Ưu đãi hấp dẫn', 'Liên hệ ngay'] },
  { key: 'chiduong', name: 'Dẫn đường', layout: 'bottomLeft', orient: '16:9', fx: 'glow', color: '#f97316', cam: 'chiduong', chartOn: false, lines: ['Từ trung tâm tới dự án', 'Lộ trình thuận tiện', 'Điểm đến dự án'] },
];
const LAYOUTS: { key: Layout; name: string }[] = [
  { key: 'bottomLeft', name: 'Dưới trái' },
  { key: 'bottomCenter', name: 'Giữa dưới' },
  { key: 'topLeft', name: 'Trên trái' },
  { key: 'card', name: 'Khung thẻ' },
];

// ── CHUYỂN ĐỘNG CAMERA RIÊNG CHO TỪNG KỊCH BẢN — để 5 video KHÁC HẲN nhau (không phải cùng 1 cú bay). ──
// Mỗi keyframe: t∈[0,1] · dz = lệch zoom so với khung vừa · pitch (độ nghiêng) · bear (độ xoay so với hướng đầu).
type CamKF = { t: number; dz: number; pitch: number; bear: number };
const CAM: Record<string, CamKF[]> = {
  vitri:   [{ t: 0, dz: -2.6, pitch: 0, bear: 0 },   { t: 0.55, dz: -1.0, pitch: 22, bear: 8 },  { t: 1, dz: 0.3, pitch: 42, bear: 16 }],  // Định vị: bay xa → hạ dần vào lô (giữ tuyến trong khung)
  hatang:  [{ t: 0, dz: -1.0, pitch: 40, bear: -30 },{ t: 0.5, dz: -0.4, pitch: 50, bear: 22 },  { t: 1, dz: 0.0, pitch: 50, bear: 78 }],  // Kết nối: nghiêng vừa, quét ngang khoe tuyến/hạ tầng
  tienich: [{ t: 0, dz: 0.1, pitch: 48, bear: 0 },   { t: 0.5, dz: 0.2, pitch: 48, bear: 170 },  { t: 1, dz: 0.1, pitch: 48, bear: 320 }],// Tiện ích: XOAY QUANH lô khoe xung quanh
  dautu:   [{ t: 0, dz: -2.2, pitch: 32, bear: -20 },{ t: 0.5, dz: -0.6, pitch: 50, bear: 15 },   { t: 1, dz: 0.6, pitch: 54, bear: 45 }], // Đầu tư: điện ảnh, đẩy sát dần (dolly-in)
  banhang: [{ t: 0, dz: 0.3, pitch: 48, bear: -10 }, { t: 0.4, dz: 0.7, pitch: 52, bear: 5 },    { t: 1, dz: 1.0, pitch: 54, bear: 22 }], // Bán hàng: bám sát lô, nhịp nhanh, chốt deal
  // Toàn cảnh: LUÔN giữ trọn lô + tuyến trong khung (dz ≤ 0 = không zoom sát), chỉ nghiêng/xoay nhẹ.
  overview:  [{ t: 0, dz: -0.35, pitch: 0, bear: 0 },  { t: 0.5, dz: -0.2, pitch: 18, bear: 12 },  { t: 1, dz: -0.3, pitch: 22, bear: -6 }],
  // ── KIỂU QUAY ĐIỆN ẢNH CAO CẤP ──
  orbit360:  [{ t: 0, dz: 0.0, pitch: 52, bear: 0 },   { t: 0.5, dz: 0.2, pitch: 56, bear: 180 }, { t: 1, dz: 0.0, pitch: 52, bear: 360 }],   // Flycam xoay trọn 360°
  spiral:    [{ t: 0, dz: -2.0, pitch: 18, bear: 0 },  { t: 0.5, dz: -0.6, pitch: 45, bear: 200 },{ t: 1, dz: 0.5, pitch: 60, bear: 400 }],   // Xoáy ốc: vừa xoay vừa hạ vào lô
  crane:     [{ t: 0, dz: 0.5, pitch: 66, bear: 12 },  { t: 0.5, dz: 0.1, pitch: 42, bear: 0 },   { t: 1, dz: -0.5, pitch: 12, bear: -8 }],   // Cần cẩu nâng: từ sát mặt vươn lên nhìn xuống
  lowsweep:  [{ t: 0, dz: 0.7, pitch: 70, bear: -45 }, { t: 0.5, dz: 0.5, pitch: 68, bear: 0 },   { t: 1, dz: 0.6, pitch: 70, bear: 50 }],    // Lướt thấp sát mặt đất, quét ngang
  reveal:    [{ t: 0, dz: -0.4, pitch: 0, bear: 0 },   { t: 0.4, dz: -0.2, pitch: 8, bear: 4 },   { t: 1, dz: 0.4, pitch: 60, bear: 30 }],    // Lộ diện: từ nhìn thẳng xuống nghiêng dần ra 3D
  cinematic: [{ t: 0, dz: -0.5, pitch: 48, bear: -8 }, { t: 0.5, dz: -0.1, pitch: 54, bear: 6 },  { t: 1, dz: 0.3, pitch: 58, bear: 20 }],    // Điện ảnh chậm: đẩy nhẹ, xoay nhẹ, sang trọng
  energetic: [{ t: 0, dz: -1.0, pitch: 40, bear: -20 },{ t: 0.25, dz: 0.5, pitch: 58, bear: 12 }, { t: 0.5, dz: -0.4, pitch: 44, bear: -12 }, { t: 0.75, dz: 0.6, pitch: 60, bear: 20 }, { t: 1, dz: 0.1, pitch: 50, bear: 0 }], // Sôi động: zoom giật nhịp
  boomerang: [{ t: 0, dz: 0.1, pitch: 50, bear: 0 },   { t: 0.5, dz: 0.3, pitch: 56, bear: 95 },  { t: 1, dz: 0.1, pitch: 50, bear: -12 }],   // Vòng cung: lượn ra rồi vòng lại
};
function camAt(kf: CamKF[], p: number): { dz: number; pitch: number; bear: number } {
  let a = kf[0], b = kf[kf.length - 1];
  for (let i = 0; i < kf.length - 1; i++) { if (p >= kf[i].t && p <= kf[i + 1].t) { a = kf[i]; b = kf[i + 1]; break; } }
  const span = (b.t - a.t) || 1; let lt = (p - a.t) / span; lt = lt * lt * (3 - 2 * lt); // smoothstep cho mượt
  return { dz: a.dz + (b.dz - a.dz) * lt, pitch: a.pitch + (b.pitch - a.pitch) * lt, bear: a.bear + (b.bear - a.bear) * lt };
}
const CAM_PAD: Record<string, number> = { vitri: 200, hatang: 230, tienich: 150, dautu: 190, banhang: 120, overview: 70 };
const KEYSLUG: Record<string, string> = { vitri: 'VI_TRI', hatang: 'HA_TANG', tienich: 'TIEN_ICH', dautu: 'DAU_TU', banhang: 'BAN_HANG', chiduong: 'DAN_DUONG' };
const slugName = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase() || 'VIDEO';

// ── Hình học cho Bán kính & Khoảng cách ──
function circleRing(lng: number, lat: number, rMeters: number, n = 64): [number, number][] {
  const ring: [number, number][] = []; const dLat = rMeters / 111320; const dLng = rMeters / (111320 * Math.cos((lat * Math.PI) / 180) || 1e-6);
  for (let i = 0; i <= n; i++) { const a = (i / n) * 2 * Math.PI; ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]); }
  return ring;
}
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b[1] - a[1]), dLng = toR(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[1])) * Math.cos(toR(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
const fmtDist = (m: number) => (m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' km' : Math.round(m) + ' m');

function MapVideoTool() {
  const { user } = useAuth();
  const isPro = user?.role === 'admin'; // TODO: sau này mở thêm gói trả phí; bản free LUÔN giữ logo web.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const parcel = useRef<[number, number][]>([]);
  const route = useRef<[number, number][]>([]);
  const markers = useRef<{ lng: number; lat: number; label: string }[]>([]); // điểm nhấn (POI) hiện trên bản đồ + video
  const radii = useRef<{ lng: number; lat: number; r: number }[]>([]); // vòng bán kính (r mét)
  const dists = useRef<{ a: [number, number]; b: [number, number] }[]>([]); // đoạn đo khoảng cách
  const distPending = useRef<[number, number] | null>(null); // điểm A đang chờ điểm B
  const dragVert = useRef<{ kind: 'parcel' | 'route'; idx: number; moved: boolean } | null>(null); // đỉnh đang kéo (chế độ sửa)
  const modeRef = useRef<Mode>('none');
  const markerLabelRef = useRef('Tiện ích');
  const radiusRef = useRef(2000);
  const [mode, setMode] = useState<Mode>('none');
  const [ready, setReady] = useState(false);
  const [rec, setRec] = useState(false);
  const [title, setTitle] = useState('Đất nền Cam Lâm');
  const [sub, setSub] = useState('Liên hệ: 0988 888 888');
  const [logo, setLogo] = useState(true);
  const [labels, setLabels] = useState(true);
  const [base, setBase] = useState<'sat' | 'street' | 'dark'>('sat');
  const [parcelFx, setParcelFx] = useState<'glow' | 'blink' | 'ants' | 'static'>('glow');
  const [parcelColor, setParcelColor] = useState('#C8A14B');
  const fxRef = useRef<'glow' | 'blink' | 'ants' | 'static'>('glow');
  const colRef = useRef('#C8A14B');
  const [parcelOpacity, setParcelOpacity] = useState(0.28);
  const opRef = useRef(0.28);
  useEffect(() => { opRef.current = parcelOpacity; }, [parcelOpacity]);
  useEffect(() => { fxRef.current = parcelFx; }, [parcelFx]);
  useEffect(() => { colRef.current = parcelColor; }, [parcelColor]);

  // ── State xuất/khổ/biểu đồ/timeline — KHAI BÁO TRƯỚC các effect PHASE 2 (dep array đọc ngay lúc render) ──
  const [q, setQ] = useState('');
  const [markerLabel, setMarkerLabel] = useState('Tiện ích');
  useEffect(() => { markerLabelRef.current = markerLabel; }, [markerLabel]);
  const [radiusM, setRadiusM] = useState(2000);
  useEffect(() => { radiusRef.current = radiusM; }, [radiusM]);
  const [duration, setDuration] = useState(8);            // thời lượng video (giây)
  const [audio, setAudio] = useState<File | null>(null);  // nhạc nền (tuỳ chọn)
  const [voice, setVoice] = useState<File | null>(null);  // giọng đọc (tải lên hoặc thu mic)
  const [voiceRec, setVoiceRec] = useState(false);
  const voiceMediaRef = useRef<MediaRecorder | null>(null);
  const [layout, setLayout] = useState<Layout>('bottomLeft');
  const [res, setRes] = useState<'1080' | '720'>('1080');
  const [orient, setOrient] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [previewing, setPreviewing] = useState(false);
  const [warming, setWarming] = useState(false); // đang nạp tile (che khung để không thấy camera nhảy)
  // PHASE 3: timeline — mỗi track 1 clip [start, dur] (giây). Điều khiển KHI nào phần tử xuất hiện trong video.
  const [clips, setClips] = useState({ route: [0.5, 5], text: [0, 8], chart: [0, 8], music: [0, 8] });
  const [tracksOn, setTracksOn] = useState<{ route: boolean; text: boolean; chart: boolean; music: boolean }>({ route: true, text: true, chart: true, music: true }); // ẩn/tắt track
  const [tlZoom, setTlZoom] = useState(1); // phóng to timeline
  const [safeArea, setSafeArea] = useState(false); // khung an toàn (guide, không vào video)
  const [playhead, setPlayhead] = useState(0);
  const elapRef = useRef(0); const textVisRef = useRef(true); const chartVisRef = useRef(true);
  const tlRef = useRef<HTMLDivElement | null>(null);
  const stopRef = useRef(false); // dừng "Chạy thử" giữa chừng
  const recRef = useRef(false); // đang QUAY → giảm re-render (không cập nhật playhead) cho mượt + tải tile
  // PHASE 4: Undo/Redo — lịch sử ảnh chụp toàn bộ trạng thái editor (thay đổi hình học báo qua geomVer).
  const [geomVer, setGeomVer] = useState(0);
  const bumpGeom = () => setGeomVer((v) => v + 1);
  const histRef = useRef<{ past: string[]; future: string[]; applying: boolean; last: string }>({ past: [], future: [], applying: false, last: '' });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  useEffect(() => { setClips({ route: [0.5, Math.max(1, +(duration * 0.62).toFixed(1))], text: [0, duration], chart: [0, duration], music: [0, duration] }); setPlayhead(0); }, [duration]);
  const clipEnd = (c: number[]) => c[0] + c[1];
  const [exporting, setExporting] = useState(false);
  const [busyAll, setBusyAll] = useState(false); // đang xuất cả 5 video
  const [pct, setPct] = useState(0);
  const [chartOn, setChartOn] = useState(false);
  const [chartTitle, setChartTitle] = useState('Lượt quan tâm theo ngày');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [chartRaw, setChartRaw] = useState('T2:80, T3:120, T4:150, T5:190, T6:250, T7:300');
  const [subs, setSubs] = useState<Sub[]>([]); // phụ đề theo thời gian (riêng từng kịch bản)
  const [camStyle, setCamStyle] = useState(''); // kiểu camera ghi đè (rỗng = theo kịch bản)
  const [textAnim, setTextAnim] = useState('fade'); // hiệu ứng chữ xuất hiện
  const [camKeys, setCamKeys] = useState<CamKeyframe[]>([]); // keyframe camera tự đặt (khi camStyle='custom')
  const [scenes, setScenes] = useState<Scene[]>([]); // phân cảnh (tổng thời lượng = tổng cảnh)
  const [objects, setObjects] = useState<Obj[]>([]); // object chữ/ảnh tự do trên video (theo kịch bản)
  const [selObj, setSelObj] = useState<string | null>(null); // object đang chọn
  type Asset = { id: string; kind: 'image' | 'video' | 'audio'; name: string; src: string; file?: File; fav?: boolean };
  const [library, setLibrary] = useState<Asset[]>([]); // thư viện media tái dùng (phiên làm việc)
  const [libFilter, setLibFilter] = useState('all'); const [libQuery, setLibQuery] = useState('');
  function registerAsset(a: Omit<Asset, 'id' | 'fav'>) { setLibrary((p) => (p.some((x) => x.src === a.src) ? p : [...p, { id: 'a' + Date.now() + Math.random().toString(36).slice(2, 5), fav: false, ...a }])); }
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null); // menu chuột phải
  const objImgRef = useRef<Record<string, HTMLImageElement>>({}); // ảnh đã nạp theo id object
  const objVidRef = useRef<Record<string, HTMLVideoElement>>({}); // video element theo id object
  const objClip = useRef<Obj | null>(null); // clipboard copy/paste object
  const selObjRef = useRef<string | null>(null); const objectsRef = useRef<Obj[]>([]);
  useEffect(() => { selObjRef.current = selObj; objectsRef.current = objects; });
  const stageRef = useRef<HTMLDivElement | null>(null); // khung sân khấu (để tính kéo object)
  const [boxH, setBoxH] = useState(360); // chiều cao khung xem trước (để căn cỡ chữ object khớp video)
  useEffect(() => { objects.forEach((o) => { if (o.type === 'image' && o.src && !objImgRef.current[o.id]) { const im = new Image(); im.onload = () => { objImgRef.current[o.id] = im; setBoxH((h) => h); }; im.src = o.src; } }); }, [objects]);
  const [qrUrl, setQrUrl] = useState(''); // ảnh QR (dataURL) — dùng cho xem trước + vẽ lên video
  const qrImgRef = useRef<HTMLImageElement | null>(null);
  const [brandLogo, setBrandLogo] = useState(''); // logo tuỳ chỉnh (dataURL) — thay logo chữ
  const brandImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => { if (!brandLogo) { brandImgRef.current = null; return; } const img = new Image(); img.onload = () => { brandImgRef.current = img; }; img.src = brandLogo; }, [brandLogo]);
  useEffect(() => { try { const b = JSON.parse(localStorage.getItem(BRAND_KEY) || 'null'); if (b?.logo) setBrandLogo(b.logo); } catch { /* ignore */ } }, []);
  function saveBrandKit() { try { localStorage.setItem(BRAND_KEY, JSON.stringify({ logo: brandLogo, phone: property.phone, zalo: property.zalo, website: property.website })); toast.success('Đã lưu Brand Kit (dùng cho mọi dự án)'); } catch { toast.error('Không lưu được Brand Kit'); } }

  // PHASE: PHIÊN BẢN (Versions) — lưu/khôi phục các mốc dự án.
  const [versions, setVersions] = useState<{ id: number; name: string; ts: number; data: string }[]>([]);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem('camlam_versions_v1') || '[]'); if (Array.isArray(v)) setVersions(v); } catch { /* ignore */ } }, []);
  function persistVersions(v: { id: number; name: string; ts: number; data: string }[]) { setVersions(v); try { localStorage.setItem('camlam_versions_v1', JSON.stringify(v)); } catch { /* ignore */ } }
  function saveVersion() { const nm = prompt('Tên phiên bản:', 'Phiên bản ' + (versions.length + 1)); if (nm === null) return; persistVersions([...versions, { id: Date.now(), name: nm || ('Phiên bản ' + (versions.length + 1)), ts: Date.now(), data: snapStr() }]); toast.success('Đã lưu phiên bản'); }
  function restoreVersion(ver: { data: string; name: string }) { histRef.current.applying = true; applySnapshot(ver.data); toast.success('Đã khôi phục: ' + ver.name); }
  function deleteVersion(id: number) { persistVersions(versions.filter((x) => x.id !== id)); }
  const chartProgRef = useRef(0);
  const chartPrevRef = useRef<HTMLCanvasElement | null>(null);
  const layoutRef = useRef<Layout>('bottomLeft');
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  // ── PHASE 2: dự án + 5 kịch bản + tự lưu ──
  const [property, setProperty] = useState<{ name: string; address: string; price: string; area: string; phone: string; zalo: string; website: string; qrOn?: boolean; qrData?: string }>({ name: 'Đất nền Cam Lâm', address: '', price: '', area: '', phone: '0988 888 888', zalo: '', website: '' });
  const [scripts, setScripts] = useState<{ key: string; name: string; focus: string; settings: Settings }[]>(() => SCRIPTS0.map((s) => ({ ...s, settings: mkSettings(s.key) })));
  const [activeScript, setActiveScript] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const hydrated = useRef(false);
  const pendingGeom = useRef<{ parcel: [number, number][]; route: [number, number][]; markers?: { lng: number; lat: number; label: string }[]; radii?: { lng: number; lat: number; r: number }[]; dists?: { a: [number, number]; b: [number, number] }[] } | null>(null);

  function settingsNow(): Settings { return { title, sub, layout, orient, res, duration, base, parcelFx, parcelColor, chartOn, chartTitle, chartType, chartRaw, subs, camStyle, textAnim, camKeys, objects, scenes }; }
  function applySettings(s: Settings) { setTitle(s.title); setSub(s.sub); setLayout(s.layout); setOrient(s.orient); setRes(s.res); setDuration(s.duration); setBase(s.base); setParcelFx(s.parcelFx); setParcelColor(s.parcelColor); setChartOn(s.chartOn); setChartTitle(s.chartTitle); setChartType(s.chartType); setChartRaw(s.chartRaw); setSubs(s.subs || []); setCamStyle(s.camStyle || ''); setTextAnim(s.textAnim || 'fade'); setCamKeys(s.camKeys || []); setObjects(s.objects || []); setScenes(s.scenes || []); setSelObj(null); }
  function switchScript(i: number) {
    if (i === activeScript || i < 0 || i >= scripts.length) return;
    const now = settingsNow();
    setScripts((prev) => prev.map((s, idx) => (idx === activeScript ? { ...s, settings: now } : s)));
    applySettings(scripts[i].settings); setActiveScript(i);
  }
  function renameScript(i: number, name: string) { setScripts((prev) => prev.map((s, idx) => (idx === i ? { ...s, name } : s))); }
  // Chốt cài đặt kịch bản ĐANG mở vào mảng (để các thao tác thêm/nhân bản/xoá không mất chỉnh sửa hiện tại).
  function commitActive() { return scripts.map((s, idx) => (idx === activeScript ? { ...s, settings: settingsNow() } : s)); }
  // Áp thông tin (tên + liên hệ) cho TẤT CẢ kịch bản.
  // AI VIẾT KỊCH BẢN — gọi máy chủ (dùng chung khoá AI), điền lời thoại/tiêu đề cho các kịch bản.
  const [aiBusy, setAiBusy] = useState(false);
  async function aiWriteScripts() {
    if (aiBusy) return; setAiBusy(true);
    try {
      const base = commitActive();
      const r: any = await api('/ai/video-script', { method: 'POST', body: JSON.stringify({ property, duration, scripts: base.map((s) => ({ key: s.key, name: s.name, focus: s.focus })) }) });
      const gen = r?.scripts || {};
      const next = base.map((s) => { const g = gen[s.key]; return g ? { ...s, settings: { ...s.settings, title: g.title || s.settings.title, sub: g.sub || s.settings.sub, subs: Array.isArray(g.subs) && g.subs.length ? g.subs : s.settings.subs } } : s; });
      setScripts(next); const cur = next[activeScript]; if (cur) applySettings(cur.settings);
      toast.success('AI đã viết lời thoại cho các kịch bản');
    } catch (e: any) { toast.error(e?.message || 'AI chưa viết được, thử lại sau'); }
    finally { setAiBusy(false); }
  }

  function applyInfoAll() { const base = commitActive(); const name = property.name?.trim() || 'Dự án'; const ph = property.phone?.trim(); setScripts(base.map((s) => ({ ...s, settings: { ...s.settings, title: name, sub: ph ? 'Liên hệ: ' + ph : s.settings.sub } }))); setTitle(name); if (ph) setSub('Liên hệ: ' + ph); toast.success('Đã áp thông tin cho tất cả kịch bản'); }

  // ── SCENES (phân cảnh) ── tổng thời lượng = tổng các cảnh.
  useEffect(() => { if (scenes.length) { const sum = scenes.reduce((a, s) => a + (s.dur || 0), 0); if (sum > 0) setDuration(Math.min(120, Math.max(1, Math.round(sum)))); } }, [scenes]);
  function addScene() { setScenes((p) => [...p, { id: 's' + Date.now(), name: 'Cảnh ' + (p.length + 1), dur: 4 }]); }
  function updateScene(id: string, patch: Partial<Scene>) { setScenes((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s))); }
  function deleteScene(id: string) { setScenes((p) => p.filter((s) => s.id !== id)); }
  function dupScene(id: string) { setScenes((p) => { const i = p.findIndex((s) => s.id === id); if (i < 0) return p; const c = { ...p[i], id: 's' + Date.now(), name: p[i].name + ' (2)' }; return [...p.slice(0, i + 1), c, ...p.slice(i + 1)]; }); }
  function moveScene(id: string, dir: number) { setScenes((p) => { const i = p.findIndex((s) => s.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= p.length) return p; const a = [...p]; const [x] = a.splice(i, 1); a.splice(j, 0, x); return a; }); }
  function makeDefaultScenes() { setScenes([['Tổng quan', 3], ['Dự án', 3], ['Hạ tầng', 3], ['Tiện ích', 3], ['Kêu gọi (CTA)', 3]].map(([n, d], i) => ({ id: 's' + (Date.now() + i), name: n as string, dur: d as number }))); }
  const sceneStart = (i: number) => scenes.slice(0, i).reduce((a, s) => a + (s.dur || 0), 0);

  // ── OBJECT tự do (chữ/ảnh) ──
  function addTextObj() { const id = 'o' + Date.now(); setObjects((p) => [...p, { id, type: 'text', x: 0.5, y: 0.5, scale: 1, rot: 0, opacity: 1, s: 0, e: duration, text: 'Chữ mới', size: 48, color: '#ffffff', weight: 700, bg: true }]); setSelObj(id); }
  function addImageFromSrc(src: string) { const im = new Image(); im.onload = () => { const id = 'o' + Date.now(); objImgRef.current[id] = im; setObjects((p) => [...p, { id, type: 'image', x: 0.5, y: 0.5, scale: 1, rot: 0, opacity: 1, s: 0, e: duration, src, aspect: im.width / im.height }]); setSelObj(id); }; im.src = src; }
  function addVideoFromSrc(src: string) { const id = 'o' + Date.now(); const v = document.createElement('video'); v.src = src; v.muted = true; v.loop = true; (v as any).playsInline = true; v.onloadedmetadata = () => { objVidRef.current[id] = v; setObjects((p) => [...p, { id, type: 'video', x: 0.5, y: 0.5, scale: 1.4, rot: 0, opacity: 1, s: 0, e: duration, src, aspect: (v.videoWidth / v.videoHeight) || 1.78 }]); setSelObj(id); v.play().catch(() => {}); }; }
  function addImageObj(file: File) { const rd = new FileReader(); rd.onload = () => { const src = String(rd.result); registerAsset({ kind: 'image', name: file.name, src }); addImageFromSrc(src); }; rd.readAsDataURL(file); }
  function addVideoObj(file: File) { const src = URL.createObjectURL(file); registerAsset({ kind: 'video', name: file.name, src, file }); addVideoFromSrc(src); }
  function reuseAsset(a: Asset) { if (a.kind === 'image') addImageFromSrc(a.src); else if (a.kind === 'video') addVideoFromSrc(a.src); else if (a.kind === 'audio' && a.file) { setAudio(a.file); toast.success('Đã dùng nhạc: ' + a.name); } }
  function updateObj(id: string, patch: Partial<Obj>) { setObjects((p) => p.map((o) => (o.id === id ? { ...o, ...patch } : o))); }
  function deleteObj(id: string) { setObjects((p) => p.filter((o) => o.id !== id)); setSelObj(null); }
  function duplicateObj(id: string) { const o = objects.find((x) => x.id === id); if (!o) return; const nid = 'o' + Date.now(); if (o.type === 'image' && objImgRef.current[id]) objImgRef.current[nid] = objImgRef.current[id]; setObjects((p) => [...p, { ...o, id: nid, x: Math.min(0.95, o.x + 0.03), y: Math.min(0.95, o.y + 0.03) }]); setSelObj(nid); }
  function moveObjZ(id: string, dir: number) { setObjects((p) => { const i = p.findIndex((o) => o.id === id); if (i < 0) return p; const j = i + dir; if (j < 0 || j >= p.length) return p; const a = [...p]; const [x] = a.splice(i, 1); a.splice(j, 0, x); return a; }); }
  function alignObj(id: string, k: string) { const m: Record<string, Partial<Obj>> = { l: { x: 0.08 }, cx: { x: 0.5 }, r: { x: 0.92 }, t: { y: 0.08 }, cy: { y: 0.5 }, b: { y: 0.92 } }; updateObj(id, m[k] || {}); }
  function cloneMedia(from: string, to: string) { if (objImgRef.current[from]) objImgRef.current[to] = objImgRef.current[from]; if (objVidRef.current[from]) objVidRef.current[to] = objVidRef.current[from]; }
  // Cắt (split) object đang chọn tại playhead → 2 clip.
  function splitObj(id: string) { const o = objects.find((x) => x.id === id); if (!o) return; const p = Math.round(playhead * 10) / 10; if (p <= o.s + 0.1 || p >= o.e - 0.1) { toast.info('Đưa playhead vào GIỮA clip rồi Cắt'); return; } const nid = 'o' + Date.now(); cloneMedia(o.id, nid); setObjects((prev) => prev.flatMap((x) => (x.id === id ? [{ ...x, e: p }, { ...x, id: nid, s: p }] : [x]))); setSelObj(nid); toast.success('Đã cắt clip'); }
  function pasteObj() { const o = objClip.current; if (!o) return; const nid = 'o' + Date.now(); cloneMedia(o.id, nid); setObjects((prev) => [...prev, { ...o, id: nid, x: Math.min(0.95, o.x + 0.04), y: Math.min(0.95, o.y + 0.04) }]); setSelObj(nid); }
  // Kéo/co CLIP object trên timeline.
  function beginObjClipDrag(o: Obj, edge: 'move' | 'l' | 'r', e: React.PointerEvent) { e.preventDefault(); e.stopPropagation(); setSelObj(o.id); if (o.locked) return; const cont = tlRef.current; if (!cont) return; const wpx = cont.getBoundingClientRect().width; const total = Math.max(1, duration); const startX = e.clientX; const os = o.s, oe = o.e, len = oe - os; const snapT = [0, total, Math.round(playhead * 10) / 10]; const snap = (v: number) => { for (const t of snapT) { if (Math.abs(v - t) < total * 0.02 + 0.15) return t; } return v; }; const mv = (ev: PointerEvent) => { const d = ((ev.clientX - startX) / wpx) * total; let s = os, en = oe; if (edge === 'move') { s = Math.min(total - len, Math.max(0, os + d)); s = snap(s); en = s + len; } else if (edge === 'l') { s = Math.min(oe - 0.3, Math.max(0, snap(os + d))); en = oe; } else { en = Math.min(total, Math.max(os + 0.3, snap(oe + d))); s = os; } updateObj(o.id, { s: Math.round(s * 10) / 10, e: Math.round(en * 10) / 10 }); }; const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }
  function beginObjDrag(o: Obj, e: React.PointerEvent) { e.preventDefault(); e.stopPropagation(); setSelObj(o.id); if (o.locked) return; const rc = stageRef.current?.getBoundingClientRect(); if (!rc) return; const mv = (ev: PointerEvent) => { const nx = Math.max(0, Math.min(1, (ev.clientX - rc.left) / rc.width)); const ny = Math.max(0, Math.min(1, (ev.clientY - rc.top) / rc.height)); updateObj(o.id, { x: +nx.toFixed(3), y: +ny.toFixed(3) }); }; const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }

  // ── Quản lý kịch bản: thêm / nhân bản / xoá / đổi thứ tự (giữ nguyên chỉnh sửa đang mở) ──
  function addScript() {
    const now = settingsNow(); const ns = { key: 'kb' + Date.now(), name: 'Kịch bản ' + (scripts.length + 1), focus: 'Tùy chỉnh', settings: now };
    setScripts((prev) => [...prev.map((x, i) => (i === activeScript ? { ...x, settings: now } : x)), ns]);
    setActiveScript(scripts.length); toast.success('Đã thêm kịch bản');
  }
  function duplicateScript(i: number) {
    const now = settingsNow(); const srcSettings = i === activeScript ? now : scripts[i].settings;
    setScripts((prev) => { const cur = prev.map((x, idx) => (idx === activeScript ? { ...x, settings: now } : x)); const copy = { ...cur[i], key: 'kb' + Date.now(), name: cur[i].name + ' (bản sao)', settings: JSON.parse(JSON.stringify(cur[i].settings)) }; return [...cur.slice(0, i + 1), copy, ...cur.slice(i + 1)]; });
    setActiveScript(i + 1); applySettings(srcSettings); toast.success('Đã nhân bản kịch bản');
  }
  function deleteScript(i: number) {
    if (scripts.length <= 1) { toast.info('Cần giữ ít nhất 1 kịch bản'); return; }
    if (typeof window !== 'undefined' && !window.confirm('Xoá kịch bản "' + scripts[i].name + '"?')) return;
    const now = settingsNow(); const saved = scripts.map((x, idx) => (idx === activeScript ? { ...x, settings: now } : x)); const remaining = saved.filter((_, idx) => idx !== i);
    let na = activeScript; if (i < activeScript) na = activeScript - 1; else if (i === activeScript) na = Math.min(activeScript, remaining.length - 1);
    setScripts(remaining); setActiveScript(na); applySettings(remaining[na].settings); toast.success('Đã xoá kịch bản');
  }
  function moveScript(i: number, dir: number) {
    const j = i + dir; if (j < 0 || j >= scripts.length) return;
    const now = settingsNow(); const out = scripts.map((x, idx) => (idx === activeScript ? { ...x, settings: now } : x));
    const t = out[i]; out[i] = out[j]; out[j] = t; setScripts([...out]);
    setActiveScript(activeScript === i ? j : activeScript === j ? i : activeScript);
  }

  // Tạo NHANH 5 kịch bản KHÁC NHAU từ thông tin dự án: khác chữ + bố cục + khổ + hiệu ứng (kết hợp camera riêng → 5 video khác hẳn).
  function autoFillScripts() {
    const name = property.name?.trim() || 'Dự án'; const phone = property.phone?.trim() || '0988 888 888';
    const price = property.price?.trim(); const addr = property.address?.trim();
    const base0 = { res, duration, base, chartTitle, chartType, chartRaw };
    const P: Record<string, Settings> = {
      vitri:   { ...base0, title: `${name} — Vị trí đắc địa`,     sub: addr || 'Vị trí kết nối vùng',              layout: 'bottomLeft',   orient: '16:9', parcelFx: 'glow',  parcelColor: '#C8A14B', chartOn: false },
      hatang:  { ...base0, title: `${name} — Hạ tầng kết nối`,     sub: 'Cao tốc · Quốc lộ · Sân bay',              layout: 'topLeft',      orient: '16:9', parcelFx: 'ants',  parcelColor: '#ff3b30', chartOn: false },
      tienich: { ...base0, title: `${name} — Tiện ích xung quanh`, sub: 'Trường · Chợ · Biển · Bệnh viện',          layout: 'bottomCenter', orient: '1:1',  parcelFx: 'glow',  parcelColor: '#22c55e', chartOn: false },
      dautu:   { ...base0, title: `${name} — Cơ hội đầu tư`,       sub: price ? `Chỉ từ ${price}` : 'Tiềm năng tăng giá', layout: 'card',    orient: '16:9', parcelFx: 'glow',  parcelColor: '#3b82f6', chartOn: true },
      banhang: { ...base0, title: price ? `${name} — Mở bán ${price}` : `${name} — Mở bán`, sub: `Liên hệ: ${phone}`, layout: 'bottomCenter', orient: '9:16', parcelFx: 'blink', parcelColor: '#C8A14B', chartOn: false },
      chiduong:{ ...base0, title: `${name} — Dẫn đường tới dự án`, sub: addr || 'Lộ trình & vị trí', layout: 'bottomLeft', orient: '16:9', parcelFx: 'glow', parcelColor: '#f97316', chartOn: false },
    };
    Object.keys(P).forEach((k) => { (P[k] as any).subs = genScript(k, property, duration); (P[k] as any).title = name; }); // lời thoại vào video; tiêu đề chỉ là tên dự án (không ghép nhãn kịch bản)
    setScripts((prev) => prev.map((s) => (P[s.key] ? { ...s, settings: P[s.key] } : s)));
    const cur = scripts[activeScript]?.key; if (cur && P[cur]) applySettings(P[cur]);
    toast.success('Đã tạo bộ kịch bản (kèm lời thoại) — bấm từng tab để chỉnh thêm');
  }

  // renderRef: cấu hình quay LUÔN mới sau mỗi render → quay đúng từng kịch bản khi xuất cả bộ (đổi kịch bản giữa chừng không bị "state cũ").
  const renderRef = useRef<any>({});
  useEffect(() => { renderRef.current = { title, sub, orient, res, duration, chartOn, chartTitle, chartType, chartRaw, logo, clips, subs, textAnim, tracksOn, camKeys, objects, camKey: camStyle || scripts[activeScript]?.key || 'vitri' }; });
  useEffect(() => { const m = mapRef.current; if (m?.getLayer?.('route-line')) { const v = tracksOn.route ? 'visible' : 'none'; m.setLayoutProperty('route-line', 'visibility', v); m.setLayoutProperty('route-glow', 'visibility', v); } }, [tracksOn.route, ready]);

  // Tạo ảnh QR (nạp thư viện từ CDN 1 lần) mỗi khi bật/đổi nội dung QR.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!property.qrOn || !property.qrData) { qrImgRef.current = null; setQrUrl(''); return; }
      try {
        const mod: any = await import(/* webpackIgnore: true */ 'https://esm.sh/qrcode@1.5.3');
        const QR = mod.default || mod;
        const url: string = await QR.toDataURL(property.qrData, { margin: 1, width: 260, color: { dark: '#0A2540', light: '#ffffff' } });
        if (!alive) return;
        setQrUrl(url); const img = new Image(); img.onload = () => { qrImgRef.current = img; }; img.src = url;
      } catch (e) { console.warn('[qr]', e); }
    })();
    return () => { alive = false; };
  }, [property.qrOn, property.qrData]);

  // Áp MẪU vào kịch bản đang mở: set bố cục/khổ/hiệu ứng/camera + sinh lời thoại theo mẫu.
  function applyTemplate(tpl: Tpl) {
    setLayout(tpl.layout); setOrient(tpl.orient); setParcelFx(tpl.fx); setParcelColor(tpl.color); setChartOn(tpl.chartOn); setCamStyle(tpl.cam);
    setTitle(property.name?.trim() || 'Dự án'); if (property.phone?.trim()) setSub('Liên hệ: ' + property.phone.trim());
    const dur = duration; const n = tpl.lines.length || 1; const seg = Math.max(1, dur) / n;
    setSubs(tpl.lines.map((t, i) => ({ s: +(i * seg).toFixed(1), e: +Math.min(dur, (i + 1) * seg).toFixed(1), t })));
    toast.success('Đã áp mẫu: ' + tpl.name);
  }

  // Nạp dự án đã lưu (nếu có) khi mở trang.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.property) setProperty(p.property);
        if (Array.isArray(p.scripts) && p.scripts.length) {
          let sc = p.scripts;
          SCRIPTS0.forEach((d) => { if (!sc.some((s: any) => s.key === d.key)) sc = [...sc, { ...d, settings: mkSettings(d.key) }]; }); // bổ sung kịch bản mặc định còn thiếu (vd 06 Dẫn đường ở bản cũ)
          setScripts(sc); const a = Math.min(p.activeScript || 0, sc.length - 1); setActiveScript(a); applySettings(sc[a].settings);
        }
        if (p.geom) pendingGeom.current = p.geom;
      }
    } catch { /* ignore */ }
    hydrated.current = true;
  }, []);

  // Khôi phục lô/tuyến đã lưu sau khi bản đồ sẵn sàng.
  useEffect(() => {
    if (!ready || !pendingGeom.current) return;
    const g = pendingGeom.current; pendingGeom.current = null;
    if (g.parcel?.length) { parcel.current = g.parcel; drawParcel(); }
    if (g.route?.length) { route.current = g.route; drawRoute(g.route); }
    if (g.markers?.length) { markers.current = g.markers; drawMarkers(); }
    if (g.radii?.length) { radii.current = g.radii; drawRadii(); }
    if (g.dists?.length) { dists.current = g.dists; drawDists(); }
    const b = bounds(); if (b) setTimeout(() => mapRef.current?.fitBounds(b, { padding: 120, duration: 0 }), 200);
  }, [ready]);

  // Tự lưu (debounce) — không mất khi F5.
  useEffect(() => {
    if (!hydrated.current) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      try {
        const snap = { property, activeScript, scripts: scripts.map((s, i) => (i === activeScript ? { ...s, settings: settingsNow() } : s)), geom: { parcel: parcel.current, route: route.current, markers: markers.current, radii: radii.current, dists: dists.current } };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
        setSaveState('saved');
      } catch { setSaveState('idle'); }
    }, 700);
    return () => clearTimeout(t);
  }, [property, scripts, activeScript, title, sub, layout, orient, res, duration, base, parcelFx, parcelColor, chartOn, chartTitle, chartType, chartRaw, subs, camStyle, textAnim, camKeys, objects, scenes]);

  // ── PHASE 4: History (Undo/Redo) ──
  function snapStr(): string {
    return JSON.stringify({
      property, activeScript, clips,
      scripts: scripts.map((s, i) => (i === activeScript ? { ...s, settings: settingsNow() } : s)),
      geom: { parcel: parcel.current, route: route.current, markers: markers.current, radii: radii.current, dists: dists.current },
    });
  }
  function applySnapshot(raw: string) {
    let s: any; try { s = JSON.parse(raw); } catch { return; }
    if (s.property) setProperty(s.property);
    if (Array.isArray(s.scripts)) setScripts(s.scripts);
    if (typeof s.activeScript === 'number') setActiveScript(s.activeScript);
    const as = s.scripts?.[s.activeScript]?.settings; if (as) applySettings(as);
    if (s.clips) setClips(s.clips);
    parcel.current = s.geom?.parcel || []; route.current = s.geom?.route || []; markers.current = s.geom?.markers || [];
    radii.current = s.geom?.radii || []; dists.current = s.geom?.dists || [];
    drawParcel(); drawRoute(route.current); drawMarkers(); drawRadii(); drawDists(); bumpGeom();
  }
  function undoHistory() {
    const h = histRef.current; if (!h.past.length) return;
    h.future.unshift(snapStr()); const prev = h.past.pop() as string; h.last = prev; h.applying = true;
    applySnapshot(prev); setCanUndo(h.past.length > 0); setCanRedo(true); setSaveState('saved');
  }
  function redoHistory() {
    const h = histRef.current; if (!h.future.length) return;
    h.past.push(snapStr()); const nxt = h.future.shift() as string; h.last = nxt; h.applying = true;
    applySnapshot(nxt); setCanUndo(true); setCanRedo(h.future.length > 0);
  }
  // Chốt "checkpoint" sau khi thao tác lắng xuống (debounce). Bỏ qua lần do chính Undo/Redo gây ra.
  useEffect(() => {
    if (!hydrated.current) return;
    if (histRef.current.applying) { histRef.current.applying = false; histRef.current.last = snapStr(); return; }
    const t = setTimeout(() => {
      const cur = snapStr(); const h = histRef.current;
      if (cur !== h.last) { if (h.last) h.past.push(h.last); if (h.past.length > 80) h.past.shift(); h.future = []; h.last = cur; setCanUndo(h.past.length > 0); setCanRedo(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [property, scripts, activeScript, title, sub, layout, orient, res, duration, base, parcelFx, parcelColor, chartOn, chartTitle, chartType, chartRaw, subs, camStyle, textAnim, camKeys, objects, scenes, clips, geomVer]);
  // Phím tắt editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || el?.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redoHistory(); else undoHistory(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redoHistory(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); toast.success('Dự án tự lưu trên máy bạn'); }
      else if (mod && e.key.toLowerCase() === 'c' && !typing && selObjRef.current) { const o = objectsRef.current.find((x) => x.id === selObjRef.current); if (o) objClip.current = o; }
      else if (mod && e.key.toLowerCase() === 'v' && !typing && objClip.current) { e.preventDefault(); pasteObj(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && selObjRef.current) { e.preventDefault(); deleteObj(selObjRef.current); }
      else if (e.code === 'Space' && !typing) { e.preventDefault(); if (previewing) stopRef.current = true; else preview(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewing]);
  useEffect(() => { if (!isPro) setLogo(true); }, [isPro]); // bản MIỄN PHÍ: luôn giữ logo web (không cho tắt)
  useEffect(() => { const m = mapRef.current; if (m) setTimeout(() => m.resize(), 80); }, [orient]); // đổi khổ → map vẽ lại đúng tỉ lệ

  // Vòng lặp HIỆU ỨNG lô đất — chạy liên tục (xem trước, quay, lúc rảnh) theo hiệu ứng + màu đang chọn.
  useEffect(() => {
    if (!ready) return; let raf = 0; const t0 = performance.now();
    const tick = () => {
      const m = mapRef.current;
      if (m && m.getLayer && m.getLayer('parcel-line') && parcel.current.length >= 3) {
        const t = (performance.now() - t0) / 1000; const fx = fxRef.current; const col = colRef.current; const s = 0.5 + 0.5 * Math.sin(t * 3);
        try {
          m.setPaintProperty('parcel-line', 'line-color', col); m.setPaintProperty('parcel-glow', 'line-color', col); m.setPaintProperty('parcel-fill', 'fill-color', col);
          const op = opRef.current;
          if (fx === 'glow') { m.setPaintProperty('parcel-line', 'line-width', 3 + 2 * s); m.setPaintProperty('parcel-line', 'line-opacity', 1); m.setPaintProperty('parcel-line', 'line-dasharray', [999]); m.setPaintProperty('parcel-glow', 'line-opacity', 0.15 + 0.45 * s); m.setPaintProperty('parcel-fill', 'fill-opacity', op); }
          else if (fx === 'blink') { const on = Math.sin(t * 4.5) > 0; m.setPaintProperty('parcel-line', 'line-width', 4); m.setPaintProperty('parcel-line', 'line-opacity', on ? 1 : 0.12); m.setPaintProperty('parcel-line', 'line-dasharray', [999]); m.setPaintProperty('parcel-glow', 'line-opacity', 0); m.setPaintProperty('parcel-fill', 'fill-opacity', on ? Math.min(1, op * 1.6) : op * 0.3); }
          else if (fx === 'ants') { const step = Math.floor(t * 8) % 4; const pats = [[0, 2, 2], [1, 2, 1], [2, 2, 0], [0.5, 2, 1.5]]; m.setPaintProperty('parcel-line', 'line-width', 3.5); m.setPaintProperty('parcel-line', 'line-opacity', 1); m.setPaintProperty('parcel-line', 'line-dasharray', pats[step]); m.setPaintProperty('parcel-glow', 'line-opacity', 0); m.setPaintProperty('parcel-fill', 'fill-opacity', op * 0.75); }
          else { m.setPaintProperty('parcel-line', 'line-width', 3); m.setPaintProperty('parcel-line', 'line-opacity', 1); m.setPaintProperty('parcel-line', 'line-dasharray', [999]); m.setPaintProperty('parcel-glow', 'line-opacity', 0); m.setPaintProperty('parcel-fill', 'fill-opacity', op); }
        } catch { /* ignore */ }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  // Kích thước video theo KHỔ + độ phân giải.
  function dims() { const r = renderRef.current; const base = r.res === '720' ? 720 : 1080; if (r.orient === '9:16') return { W: base, H: Math.round((base * 16) / 9) }; if (r.orient === '1:1') return { W: base, H: base }; return { W: Math.round((base * 16) / 9), H: base }; }
  // Xem trước biểu đồ (vẽ ở progress đầy) mỗi khi đổi dữ liệu/kiểu.
  useEffect(() => {
    const c = chartPrevRef.current; if (!c) return; const cx = c.getContext('2d'); if (!cx) return;
    cx.clearRect(0, 0, c.width, c.height);
    if (chartOn) drawChart(cx, 0, 0, c.width, c.height, parseChart(chartRaw), 1, chartTitle, chartType);
  }, [chartOn, chartRaw, chartTitle, chartType]);

  useEffect(() => { modeRef.current = mode; if (mapRef.current) mapRef.current.getCanvas().style.cursor = mode === 'none' ? '' : 'crosshair'; drawVerts(); }, [mode]);

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: boxRef.current,
      style: {
        version: 8, glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        sources: {
          sat: { type: 'raster', tiles: SAT, tileSize: 256, maxzoom: 18, attribution: '© Esri' },
          street: { type: 'raster', tiles: STREET, tileSize: 256, maxzoom: 18 },
          dark: { type: 'raster', tiles: DARK, tileSize: 256, maxzoom: 16 },
          lab: { type: 'raster', tiles: LABELS, tileSize: 256, maxzoom: 18 },
        },
        layers: [
          { id: 'sat', type: 'raster', source: 'sat' },
          { id: 'street', type: 'raster', source: 'street', layout: { visibility: 'none' } },
          { id: 'dark', type: 'raster', source: 'dark', layout: { visibility: 'none' } },
          { id: 'lab', type: 'raster', source: 'lab', layout: { visibility: 'visible' } },
        ],
      } as any,
      center: MAP.center, zoom: 15, maxZoom: 18, maxPitch: 70,
      preserveDrawingBuffer: true, // BẮT BUỘC để quay được canvas
      fadeDuration: 0, // tile hiện NGAY khi tải xong (không mờ dần) → đỡ khoảng trắng khi bay
      refreshExpiredTiles: false,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on('load', () => {
      map.addSource('parcel', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'parcel-fill', type: 'fill', source: 'parcel', paint: { 'fill-color': GOLD, 'fill-opacity': 0.28 } });
      map.addLayer({ id: 'parcel-glow', type: 'line', source: 'parcel', paint: { 'line-color': GOLD, 'line-width': 16, 'line-opacity': 0, 'line-blur': 6 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'parcel-line', type: 'line', source: 'parcel', paint: { 'line-color': GOLD, 'line-width': 3 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addSource('route', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'route-glow', type: 'line', source: 'route', paint: { 'line-color': '#ffd36b', 'line-width': 12, 'line-opacity': 0.45, 'line-blur': 4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#ff5a2c', 'line-width': 6 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      // Điểm nhấn (POI) — lớp GL (vẽ TRÊN canvas) nên hiện cả khi xem lẫn khi quay video.
      map.addSource('markers', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'marker-halo', type: 'circle', source: 'markers', paint: { 'circle-radius': 14, 'circle-color': '#ffd36b', 'circle-opacity': 0.35 } });
      map.addLayer({ id: 'marker-dot', type: 'circle', source: 'markers', paint: { 'circle-radius': 6, 'circle-color': '#ff3b30', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
      map.addLayer({ id: 'marker-label', type: 'symbol', source: 'markers', layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 16, 'text-offset': [0, -1.4], 'text-anchor': 'bottom', 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#0A2540', 'text-halo-width': 2.5 } });
      // Bán kính (vòng tròn km) — polygon + viền + nhãn giữa.
      map.addSource('radius', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': '#3b82f6', 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });
      map.addLayer({ id: 'radius-label', type: 'symbol', source: 'radius', layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 15, 'text-allow-overlap': true }, paint: { 'text-color': '#dbeafe', 'text-halo-color': '#0A2540', 'text-halo-width': 2.5 } });
      // Khoảng cách (A→B) — đường + nhãn giữa đoạn.
      map.addSource('dist', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'dist-line', type: 'line', source: 'dist', paint: { 'line-color': '#facc15', 'line-width': 3, 'line-dasharray': [1.5, 1] }, layout: { 'line-cap': 'round' } });
      map.addLayer({ id: 'dist-label', type: 'symbol', source: 'dist', layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 15, 'text-allow-overlap': true }, paint: { 'text-color': '#111827', 'text-halo-color': '#facc15', 'text-halo-width': 3 } });
      // Đỉnh (vertex) để SỬA — chỉ hiện ở chế độ ✎ Sửa đỉnh.
      map.addSource('verts', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'vert-dots', type: 'circle', source: 'verts', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#0A2540', 'circle-stroke-width': 3 } });
      // BẦU TRỜI/CHÂN TRỜI (như các web bản đồ pro): lấp vùng chân trời khi nghiêng cao → không còn khoảng trắng. Vẽ trong canvas nên vào cả video.
      try { if (typeof (map as any).setSky === 'function') (map as any).setSky({ 'sky-color': '#8fb4e0', 'sky-horizon-blend': 0.7, 'horizon-color': '#d6e2ee', 'horizon-fog-blend': 0.6, 'fog-color': '#eef4fa', 'fog-ground-blend': 0.1, 'atmosphere-blend': 0.5 }); } catch (e) { console.warn('[sky]', e); }
      setTimeout(() => map.resize(), 200); // đảm bảo bản đồ lấp đầy khung 16:9
      setReady(true);
    });
    const onResize = () => map.resize(); window.addEventListener('resize', onResize);
    (map as any).__onResize = onResize;
    // QUAN TRỌNG: khung dùng aspect-ratio nên chiều cao có thể = 0 lúc khởi tạo → map không vẽ tile (trắng).
    // ResizeObserver bắt đúng lúc khung có kích thước rồi gọi resize() để nạp ảnh vệ tinh.
    try { const ro = new ResizeObserver(() => { map.resize(); if (boxRef.current) setBoxH(boxRef.current.clientHeight); }); ro.observe(boxRef.current!); (map as any).__ro = ro; } catch { /* ignore */ }
    map.on('error', (ev: any) => console.warn('[map]', ev?.error?.message || ev));
    setTimeout(() => setReady(true), 5000); // phòng khi 'load' không kích hoạt → không để nút Quay kẹt
    map.on('click', (e: any) => {
      const m = modeRef.current; if (m === 'none' || m === 'edit') return; // 'edit' xử lý bằng kéo/thả bên dưới
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (m === 'parcel') { parcel.current = [...parcel.current, pt]; drawParcel(); bumpGeom(); }
      else if (m === 'marker') { markers.current = [...markers.current, { lng: pt[0], lat: pt[1], label: markerLabelRef.current }]; drawMarkers(); bumpGeom(); }
      else if (m === 'radius') { radii.current = [...radii.current, { lng: pt[0], lat: pt[1], r: radiusRef.current }]; drawRadii(); bumpGeom(); }
      else if (m === 'distance') {
        if (!distPending.current) { distPending.current = pt; toast.info('Bấm điểm thứ 2 để đo'); }
        else { dists.current = [...dists.current, { a: distPending.current, b: pt }]; distPending.current = null; drawDists(); bumpGeom(); }
      }
      else { route.current = [...route.current, pt]; drawRoute(route.current); bumpGeom(); }
    });
    // SỬA ĐỈNH: kéo đỉnh để dời, bấm (không kéo) để xoá đỉnh.
    map.on('mousedown', (e: any) => {
      if (modeRef.current !== 'edit') return;
      const f = map.queryRenderedFeatures(e.point, { layers: ['vert-dots'] })[0];
      if (!f) return;
      e.preventDefault(); map.dragPan.disable();
      dragVert.current = { kind: f.properties.kind, idx: f.properties.idx, moved: false };
    });
    map.on('mousemove', (e: any) => {
      const d = dragVert.current; if (!d) return;
      d.moved = true; const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (d.kind === 'parcel') { parcel.current = parcel.current.map((p, i) => (i === d.idx ? pt : p)); drawParcel(); }
      else { route.current = route.current.map((p, i) => (i === d.idx ? pt : p)); drawRoute(route.current); }
      drawVerts();
    });
    map.on('mouseup', () => {
      const d = dragVert.current; if (!d) return; dragVert.current = null; try { map.dragPan.enable(); } catch { /* ignore */ }
      if (!d.moved) { // bấm đỉnh (không kéo) = xoá đỉnh
        if (d.kind === 'parcel') { parcel.current = parcel.current.filter((_, i) => i !== d.idx); drawParcel(); }
        else { route.current = route.current.filter((_, i) => i !== d.idx); drawRoute(route.current); }
      }
      drawVerts(); bumpGeom();
    });
    map.on('mouseenter', 'vert-dots', () => { if (modeRef.current === 'edit') map.getCanvas().style.cursor = 'move'; });
    map.on('mouseleave', 'vert-dots', () => { if (modeRef.current === 'edit') map.getCanvas().style.cursor = 'crosshair'; });
    return () => { try { window.removeEventListener('resize', (map as any).__onResize); } catch { /* ignore */ } map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const m = mapRef.current; if (!m?.getLayer?.('sat')) return;
    (['sat', 'street', 'dark'] as const).forEach((id) => m.setLayoutProperty(id, 'visibility', base === id ? 'visible' : 'none'));
    m.setLayoutProperty('lab', 'visibility', labels && base === 'sat' ? 'visible' : 'none'); // nhãn địa danh chỉ chồng lên vệ tinh
  }, [labels, base]);

  const fc = (features: any[]) => ({ type: 'FeatureCollection' as const, features });
  const lineFeat = (coords: [number, number][]) => (coords.length >= 2 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }] : []);
  function drawParcel() {
    const c = parcel.current; const feats: any[] = [];
    if (c.length >= 3) feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...c, c[0]]] }, properties: {} });
    else if (c.length >= 2) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: {} });
    mapRef.current?.getSource('parcel')?.setData(fc(feats));
  }
  function drawRoute(coords: [number, number][]) { mapRef.current?.getSource('route')?.setData(fc(lineFeat(coords))); }
  function drawMarkers() { mapRef.current?.getSource('markers')?.setData(fc(markers.current.map((mk) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [mk.lng, mk.lat] }, properties: { label: mk.label } })))); }
  function drawRadii() { mapRef.current?.getSource('radius')?.setData(fc(radii.current.map((c) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleRing(c.lng, c.lat, c.r)] }, properties: { label: fmtDist(c.r) } })))); }
  function drawDists() { mapRef.current?.getSource('dist')?.setData(fc(dists.current.map((d) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [d.a, d.b] }, properties: { label: fmtDist(haversine(d.a, d.b)) } })))); }
  function drawVerts() {
    const show = modeRef.current === 'edit';
    const feats = !show ? [] : [
      ...parcel.current.map((p, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { kind: 'parcel', idx: i } })),
      ...route.current.map((p, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { kind: 'route', idx: i } })),
    ];
    mapRef.current?.getSource('verts')?.setData(fc(feats));
  }

  function reset() { parcel.current = []; route.current = []; markers.current = []; radii.current = []; dists.current = []; distPending.current = null; drawParcel(); drawRoute([]); drawMarkers(); drawRadii(); drawDists(); setMode('none'); bumpGeom(); }

  // Nhập KML/GeoJSON → tự khoanh lô (polygon) + vẽ tuyến (line) từ dữ liệu chuẩn, khỏi vẽ tay.
  async function importGeo(file: File) {
    try {
      let text: string;
      if (/\.kmz$/i.test(file.name)) { // KMZ = zip chứa doc.kml → giải nén lấy KML
        const mod: any = await import(/* webpackIgnore: true */ 'https://esm.sh/jszip@3.10.1'); const JSZip = mod.default || mod;
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const kmlName = Object.keys(zip.files).find((n) => /\.kml$/i.test(n));
        if (!kmlName) { toast.error('KMZ không có file KML'); return; }
        text = await zip.files[kmlName].async('string');
      } else { text = await file.text(); }
      const polys: [number, number][][] = [], lines: [number, number][][] = [];
      const isKml = /\.kml$/i.test(file.name) || text.trim().startsWith('<');
      if (isKml) {
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        const parse = (s: string) => s.trim().split(/\s+/).map((p) => { const a = p.split(',').map(Number); return [a[0], a[1]] as [number, number]; }).filter((c) => isFinite(c[0]) && isFinite(c[1]));
        doc.querySelectorAll('Polygon').forEach((pg) => { const c = pg.querySelector('outerBoundaryIs LinearRing coordinates') || pg.querySelector('coordinates'); if (c?.textContent) polys.push(parse(c.textContent)); });
        doc.querySelectorAll('LineString').forEach((ls) => { const c = ls.querySelector('coordinates'); if (c?.textContent) lines.push(parse(c.textContent)); });
      } else {
        const gj = JSON.parse(text);
        const feats = gj.type === 'FeatureCollection' ? gj.features : gj.type === 'Feature' ? [gj] : [{ geometry: gj }];
        for (const f of feats || []) {
          const g = f?.geometry; if (!g) continue;
          if (g.type === 'Polygon') polys.push(g.coordinates[0]);
          else if (g.type === 'MultiPolygon') polys.push(g.coordinates[0][0]);
          else if (g.type === 'LineString') lines.push(g.coordinates);
          else if (g.type === 'MultiLineString') lines.push(g.coordinates[0]);
        }
      }
      if (!polys.length && !lines.length) { toast.error('File không có vùng/đường hợp lệ'); return; }
      if (polys.length) {
        let ring = polys[0].map((c) => [c[0], c[1]] as [number, number]);
        if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring = ring.slice(0, -1);
        parcel.current = ring; drawParcel();
      }
      if (lines.length) { route.current = lines[0].map((c) => [c[0], c[1]] as [number, number]); drawRoute(route.current); }
      const b = bounds(); if (b) mapRef.current?.fitBounds(b, { padding: 120, duration: 800, maxZoom: 18, pitch: 0, bearing: 0 });
      bumpGeom();
      toast.success(`Đã nhập ${polys.length ? polys.length + ' lô ' : ''}${lines.length ? lines.length + ' tuyến' : ''}`.trim());
    } catch (e: any) { toast.error('Không đọc được file: ' + (e?.message || '')); }
  }

  async function search() {
    if (!q.trim()) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ', Khánh Hòa, Việt Nam')}`);
      const j = await r.json();
      if (j?.[0]) mapRef.current?.flyTo({ center: [Number(j[0].lon), Number(j[0].lat)], zoom: 17, duration: 1500 });
      else toast.info('Không tìm thấy địa điểm');
    } catch { toast.error('Lỗi tìm kiếm'); }
  }

  // ── Nội suy tuyến theo tiến độ p∈[0,1] để vẽ "chạy dần" ──
  function routeAt(p: number): [number, number][] {
    const c = route.current; if (c.length < 2) return c;
    const seg: number[] = []; let total = 0;
    for (let i = 1; i < c.length; i++) { const d = Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]); seg.push(d); total += d; }
    const target = total * Math.max(0, Math.min(1, p)); const out: [number, number][] = [c[0]]; let acc = 0;
    for (let i = 1; i < c.length; i++) {
      if (acc + seg[i - 1] >= target) { const t = seg[i - 1] ? (target - acc) / seg[i - 1] : 0; out.push([c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t]); break; }
      acc += seg[i - 1]; out.push(c[i]);
    }
    return out;
  }

  // Vị trí 1 điểm trên tuyến theo tiến độ p (dùng cho camera bám tuyến).
  function routePos(p: number): [number, number] { const seg = routeAt(Math.max(0, Math.min(1, p))); return seg[seg.length - 1] || route.current[0]; }
  // Hướng đi (độ, 0 = Bắc) tại tiến độ p — để xoay camera theo chiều di chuyển.
  function routeHeading(p: number): number {
    const a = routePos(Math.max(0, p - 0.02)), b = routePos(Math.min(1, p + 0.02));
    const lat = ((a[1] + b[1]) / 2) * Math.PI / 180; const dx = (b[0] - a[0]) * Math.cos(lat); const dy = b[1] - a[1];
    return Math.atan2(dx, dy) * 180 / Math.PI;
  }

  function bounds(): any {
    const all = [...parcel.current, ...route.current, ...markers.current.map((mk) => [mk.lng, mk.lat] as [number, number]), ...radii.current.flatMap((c) => [[c.lng + c.r / (111320 * Math.cos((c.lat * Math.PI) / 180) || 1e-6), c.lat], [c.lng - c.r / (111320 * Math.cos((c.lat * Math.PI) / 180) || 1e-6), c.lat], [c.lng, c.lat + c.r / 111320], [c.lng, c.lat - c.r / 111320]] as [number, number][]), ...dists.current.flatMap((d) => [d.a, d.b])]; if (!all.length) return null;
    const b = new maplibregl.LngLatBounds(all[0] as any, all[0] as any); all.forEach((p) => b.extend(p as any)); return b;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Chờ bản đồ tải xong tile (sự kiện 'idle') — có timeout để không kẹt.
  function tilesIdle(map: any, timeout = 1500): Promise<void> {
    return new Promise((res) => { let done = false; const on = () => { if (!done) { done = true; map.off('idle', on); res(); } }; map.on('idle', on); setTimeout(() => { if (!done) { done = true; map.off('idle', on); res(); } }, timeout); });
  }
  // "Làm nóng" tile TRƯỚC khi bay/quay: nạp sẵn tile toàn vùng + dọc tuyến (kịch bản Dẫn đường) để hết khoảng trắng.
  async function warmTiles(map: any) {
    setWarming(true);
    try {
      const b = bounds();
      // 1) Tổng thể (tile nền mức thấp/vừa)
      if (b) { map.fitBounds(b, { padding: 120, duration: 0, pitch: 0, bearing: 0, maxZoom: 18 }); await tilesIdle(map, 1800); }
      // 1b) Nếu có keyframe tự đặt → nạp tile tại các khung đó
      const ck = renderRef.current?.camKeys;
      if (Array.isArray(ck) && ck.length) { for (const k of ck) { try { map.jumpTo({ center: [k.lng, k.lat], zoom: Math.min(18, k.zoom), pitch: Math.min(60, k.pitch), bearing: k.bearing }); } catch { /* ignore */ } await sleep(200); } await tilesIdle(map, 1400); }
      // 2) Cận lô ở ĐÚNG góc nghiêng camera sẽ dùng → nạp tile chi tiết quanh lô (dùng cho hầu hết kịch bản)
      let cc: [number, number] | null = null; let zPar = map.getZoom();
      if (parcel.current.length) { const bp = new maplibregl.LngLatBounds(parcel.current[0] as any, parcel.current[0] as any); parcel.current.forEach((p) => bp.extend(p as any)); const cp: any = map.cameraForBounds(bp, { padding: 90, maxZoom: 18 }); if (cp) { cc = Array.isArray(cp.center) ? cp.center : [cp.center.lng, cp.center.lat]; zPar = Math.min(18, cp.zoom); } }
      else if (route.current.length) { cc = route.current[0]; zPar = Math.min(18, (b && map.cameraForBounds(b, { padding: 120, maxZoom: 18 })?.zoom || zPar) + 1.5); }
      if (cc) { for (const br of [0, 45, 90]) { map.jumpTo({ center: cc, zoom: zPar, pitch: 48, bearing: br }); await sleep(180); } await tilesIdle(map, 1400); }
      // 3) Dọc tuyến (kịch bản Dẫn đường) — nạp DÀY ĐẶC đúng zoom/góc nghiêng camera sẽ bay (che nên quét kỹ được).
      if (route.current.length >= 2) {
        const cam: any = b && map.cameraForBounds(b, { padding: 120, maxZoom: 18 });
        const zAll = cam?.zoom || map.getZoom();
        const zFollow = Math.min(17, Math.max(zAll + 0.2, zPar - 2.2)); // KHỚP với animateDirections
        for (let t = 0; t <= 1.0001; t += 0.05) { map.jumpTo({ center: routePos(t), zoom: zFollow, pitch: 42, bearing: routeHeading(t) }); await sleep(90); }
        await tilesIdle(map, 1600);
      }
      if (b) { map.fitBounds(b, { padding: 120, duration: 0, pitch: 0, bearing: 0, maxZoom: 18 }); await sleep(150); }
    } catch { /* ignore */ }
    setWarming(false);
  }

  // Hoạt ảnh THEO KỊCH BẢN + TIMELINE: mỗi kịch bản có đường bay camera RIÊNG (điều khiển từng khung).
  async function animateCamera(map: any, D: number) {
    const rr = renderRef.current; const cl = rr.clips || clips; const total = Math.max(200, D);
    const key = rr.camKey || 'vitri';
    if (key === 'custom' && (rr.camKeys?.length || 0) >= 2) { await animateKeyframes(map, total, cl, rr); return; }
    if (key === 'chiduong' && route.current.length >= 2) { await animateDirections(map, total, cl, rr); return; }
    const kf = CAM[key] || CAM.vitri;
    const b = bounds(); if (b) map.fitBounds(b, { padding: CAM_PAD[key] ?? 170, duration: 0, maxZoom: 18, pitch: 0, bearing: 0 });
    await sleep(300);
    const zf = map.getZoom(); const bear0 = map.getBearing();
    const apply = (p: number) => { const c = camAt(kf, p); try { map.jumpTo({ zoom: Math.max(3, Math.min(18, zf + c.dz)), pitch: c.pitch, bearing: bear0 + c.bear }); } catch { /* ignore */ } };
    apply(0); // khung mở đầu theo kịch bản
    const t0 = performance.now(); let lastPh = -1;
    await new Promise<void>((res) => {
      const step = () => {
        const elMs = performance.now() - t0; const el = elMs / 1000; elapRef.current = el;
        apply(Math.min(1, elMs / total)); // ← camera đi theo keyframe của kịch bản
        const rp = cl.route[1] > 0 ? Math.min(1, Math.max(0, (el - cl.route[0]) / cl.route[1])) : 1;
        chartProgRef.current = cl.chart[1] > 0 ? Math.min(1, Math.max(0, (el - cl.chart[0]) / cl.chart[1])) : 1;
        textVisRef.current = el >= cl.text[0] && el <= cl.text[0] + cl.text[1];
        chartVisRef.current = rr.chartOn && el >= cl.chart[0] && el <= cl.chart[0] + cl.chart[1];
        drawRoute(routeAt(rp));
        if (!recRef.current) { const ph = Math.round(el * 10) / 10; if (ph !== lastPh) { lastPh = ph; setPlayhead(el); } }
        if (stopRef.current) { res(); return; } // người dùng bấm Dừng
        if (elMs < total) requestAnimationFrame(step); else res();
      };
      step();
    });
  }

  // CAMERA KEYFRAME TỰ ĐẶT: bay mượt qua các khung do người dùng chốt (theo mốc giây).
  async function animateKeyframes(map: any, total: number, cl: any, rr: any) {
    const keys = [...(rr.camKeys || [])].sort((a: CamKeyframe, b: CamKeyframe) => a.t - b.t); if (keys.length < 2) return;
    const c0 = keys[0]; try { map.jumpTo({ center: [c0.lng, c0.lat], zoom: c0.zoom, pitch: c0.pitch, bearing: c0.bearing }); } catch { /* ignore */ }
    await sleep(200);
    const t0 = performance.now(); let lastPh = -1;
    await new Promise<void>((resolve) => {
      const step = () => {
        const elMs = performance.now() - t0; const el = elMs / 1000; elapRef.current = el;
        const c = camAtTime(keys, el);
        try { map.jumpTo({ center: [c.lng, c.lat], zoom: Math.max(1, Math.min(20, c.zoom)), pitch: c.pitch, bearing: c.bearing }); } catch { /* ignore */ }
        const rp = cl.route[1] > 0 ? Math.min(1, Math.max(0, (el - cl.route[0]) / cl.route[1])) : 1;
        chartProgRef.current = cl.chart[1] > 0 ? Math.min(1, Math.max(0, (el - cl.chart[0]) / cl.chart[1])) : 1;
        textVisRef.current = el >= cl.text[0] && el <= cl.text[0] + cl.text[1];
        chartVisRef.current = rr.chartOn && el >= cl.chart[0] && el <= cl.chart[0] + cl.chart[1];
        drawRoute((rr.tracksOn?.route ?? true) ? routeAt(rp) : []);
        if (!recRef.current) { const ph = Math.round(el * 10) / 10; if (ph !== lastPh) { lastPh = ph; setPlayhead(el); } }
        if (stopRef.current) { resolve(); return; }
        if (elMs < total) requestAnimationFrame(step); else resolve();
      };
      step();
    });
  }

  // Chốt khung camera hiện tại thành keyframe tại vị trí playhead.
  function captureKeyframe() { const m = mapRef.current; if (!m) return; const c = m.getCenter(); const kf: CamKeyframe = { t: Math.round(playhead * 10) / 10, lng: +c.lng.toFixed(6), lat: +c.lat.toFixed(6), zoom: +m.getZoom().toFixed(2), pitch: +m.getPitch().toFixed(1), bearing: +m.getBearing().toFixed(1) }; setCamKeys((prev) => [...prev.filter((k) => Math.abs(k.t - kf.t) > 0.05), kf].sort((a, b) => a.t - b.t)); if (camStyle !== 'custom') setCamStyle('custom'); toast.success('Đã chốt khung tại ' + kf.t + 's'); }
  function gotoKeyframe(kf: CamKeyframe) { mapRef.current?.jumpTo({ center: [kf.lng, kf.lat], zoom: kf.zoom, pitch: kf.pitch, bearing: kf.bearing }); setPlayhead(kf.t); }
  // 🔴 GHI HÀNH TRÌNH: khách di chuyển bản đồ tự do → tự ghi keyframe theo thời gian, phát lại y hệt.
  const [recPath, setRecPath] = useState(false);
  const recPathRef = useRef<{ t0: number; samples: CamKeyframe[]; timer: any } | null>(null);
  function toggleRecPath() {
    const m = mapRef.current; if (!m) return;
    if (recPath) {
      const rp = recPathRef.current; recPathRef.current = null; if (rp?.timer) clearInterval(rp.timer); setRecPath(false);
      if (rp && rp.samples.length >= 2) {
        const last = rp.samples[rp.samples.length - 1].t; const dur = Math.min(120, Math.max(3, Math.round(last)));
        setCamKeys(rp.samples.map((s) => ({ ...s, t: +Math.min(dur, s.t).toFixed(1) }))); setCamStyle('custom'); setDuration(dur);
        toast.success('Đã ghi hành trình ' + dur + 's — bấm ▶ Xem trước để chạy lại');
      } else toast.info('Hành trình quá ngắn — thử lại và di chuyển bản đồ lâu hơn');
    } else {
      setMode('none'); setCamStyle('custom'); setCamKeys([]);
      const rp: { t0: number; samples: CamKeyframe[]; timer: any } = { t0: performance.now(), samples: [], timer: null };
      const sample = () => { const c = m.getCenter(); rp.samples.push({ t: +((performance.now() - rp.t0) / 1000).toFixed(1), lng: +c.lng.toFixed(6), lat: +c.lat.toFixed(6), zoom: +m.getZoom().toFixed(2), pitch: +m.getPitch().toFixed(1), bearing: +m.getBearing().toFixed(1) }); if (rp.samples.length > 520) toggleRecPath(); };
      sample(); rp.timer = setInterval(sample, 250); recPathRef.current = rp; setRecPath(true);
      toast.info('Đang ghi… di chuyển bản đồ (kéo · lăn để zoom · GIỮ CHUỘT PHẢI kéo để nghiêng/xoay). Bấm lại để dừng.');
    }
  }

  // KỊCH BẢN "DẪN ĐƯỜNG": tổng thể → zoom cận thửa → mở ra → chạy dọc tuyến tới đích → mở rộng xem xung quanh.
  async function animateDirections(map: any, total: number, cl: any, rr: any) {
    const bAll = bounds();
    const camAll: any = (bAll && map.cameraForBounds(bAll, { padding: 120, maxZoom: 18 })) || { center: map.getCenter(), zoom: map.getZoom() };
    const cc = (c: any): [number, number] => (Array.isArray(c) ? (c as [number, number]) : [c.lng, c.lat]);
    const centerAll = cc(camAll.center); const zAll = camAll.zoom;
    let bParcel = bAll;
    if (parcel.current.length) { const bp = new maplibregl.LngLatBounds(parcel.current[0] as any, parcel.current[0] as any); parcel.current.forEach((p) => bp.extend(p as any)); bParcel = bp; }
    else { const s = route.current[0]; const bp = new maplibregl.LngLatBounds(s as any, s as any); bp.extend([s[0] + 0.0015, s[1] + 0.0015] as any); bp.extend([s[0] - 0.0015, s[1] - 0.0015] as any); bParcel = bp; }
    const camPar: any = map.cameraForBounds(bParcel, { padding: 90, maxZoom: 18 }) || camAll;
    const centerPar = cc(camPar.center); const zPar = Math.min(18, camPar.zoom + 0.2);
    const zFollow = Math.min(17, Math.max(zAll + 0.2, zPar - 2.2));
    const start = route.current[0], dest = route.current[route.current.length - 1];
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const lerpC = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    const ss = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    try { map.jumpTo({ center: centerAll, zoom: zAll, pitch: 0, bearing: 0 }); } catch { /* ignore */ }
    await sleep(250);
    // Mốc thời gian TUYỆT ĐỐI (giây) → mở đầu luôn nhanh, không phụ thuộc video dài/ngắn.
    const T = total / 1000;
    const p1 = Math.min(0.5, T * 0.08);                       // giữ tổng thể (ngắn)
    const p2 = p1 + Math.min(1.4, T * 0.18);                  // zoom tới lô (nhanh)
    const p3 = p2 + Math.min(0.7, T * 0.08);                  // mở ra tí, vào đầu tuyến
    const p4 = Math.max(p3 + 0.5, T - Math.min(1.8, T * 0.20)); // chạy tuyến tới trước đoạn kết
    const t0 = performance.now(); let lastPh = -1;
    await new Promise<void>((resolve) => {
      const step = () => {
        const elMs = performance.now() - t0; const el = elMs / 1000; elapRef.current = el;
        let center: [number, number], zoom: number, pitch: number, bearing: number, rp: number;
        if (el < p1) { center = centerAll; zoom = zAll; pitch = 0; bearing = 0; rp = 0; }                                                                 // tổng thể (ngắn)
        else if (el < p2) { const t = ss((el - p1) / (p2 - p1)); center = lerpC(centerAll, centerPar, t); zoom = lerp(zAll, zPar, t); pitch = lerp(0, 40, t); bearing = lerp(0, -12, t); rp = 0; } // zoom nhanh tới lô
        else if (el < p3) { const t = ss((el - p2) / (p3 - p2)); center = lerpC(centerPar, start, t); zoom = lerp(zPar, zFollow, t); pitch = lerp(40, 42, t); bearing = lerp(-12, routeHeading(0), t); rp = 0; } // mở ra tí, vào đầu tuyến
        else if (el < p4) { const tp = (el - p3) / Math.max(0.001, p4 - p3); center = lerpC(routePos(tp), routePos(Math.min(1, tp + 0.12)), 0.5); zoom = zFollow; pitch = 42; bearing = routeHeading(tp); rp = tp; } // chạy theo tuyến, NHÌN TRƯỚC để thấy đường phía trước
        else { const t = ss((el - p4) / Math.max(0.001, T - p4)); center = lerpC(dest, centerAll, t); zoom = lerp(zFollow, Math.max(3, zAll - 0.3), t); pitch = lerp(42, 8, t); bearing = lerp(routeHeading(1), 0, t); rp = 1; } // mở rộng xem xung quanh
        try { map.jumpTo({ center, zoom: Math.max(3, Math.min(18, zoom)), pitch, bearing }); } catch { /* ignore */ }
        chartProgRef.current = cl.chart[1] > 0 ? Math.min(1, Math.max(0, (el - cl.chart[0]) / cl.chart[1])) : 1;
        textVisRef.current = el >= cl.text[0] && el <= cl.text[0] + cl.text[1];
        chartVisRef.current = rr.chartOn && el >= cl.chart[0] && el <= cl.chart[0] + cl.chart[1];
        drawRoute(routeAt(rp));
        if (!recRef.current) { const ph = Math.round(el * 10) / 10; if (ph !== lastPh) { lastPh = ph; setPlayhead(el); } } // đang quay thì không cập nhật (mượt hơn)
        if (stopRef.current) { resolve(); return; }
        if (elMs < total) requestAnimationFrame(step); else resolve();
      };
      step();
    });
  }

  // Thu GIỌNG ĐỌC từ micro (bấm lần nữa để dừng). Không lên máy chủ.
  async function recVoice() {
    if (voiceRec) { try { voiceMediaRef.current?.stop(); } catch { /* ignore */ } return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = []; mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }); setVoice(new File([blob], 'voice.webm', { type: blob.type })); setVoiceRec(false); toast.success('Đã thu giọng đọc'); };
      voiceMediaRef.current = mr; mr.start(); setVoiceRec(true); toast.info('Đang thu… bấm ■ để dừng');
    } catch { toast.error('Không truy cập được micro'); setVoiceRec(false); }
  }

  // Phóng khung xem trước ra TOÀN MÀN HÌNH (và thu lại). Bọc try/catch vì trình duyệt có thể
  // từ chối (vd: trang nhúng chưa được cấp quyền) — từ chối thì vẫn xem bình thường, không lỗi.
  async function moToanManHinh(): Promise<void> {
    const el: any = stageRef.current; if (!el || typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
      }
    } catch { /* trình duyệt từ chối → bỏ qua, xem ở khung thường */ }
    setTimeout(() => { try { mapRef.current?.resize(); } catch { /* ignore */ } }, 150);
  }
  function thoatToanManHinh(): void {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        (document.exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.());
      }
    } catch { /* ignore */ }
    setTimeout(() => { try { mapRef.current?.resize(); } catch { /* ignore */ } }, 150);
  }

  // XEM TRƯỚC: chạy hoạt ảnh trên bản đồ, KHÔNG quay/xuất.
  // Tự phóng TOÀN MÀN HÌNH khi chạy để xem đúng khung hình như video thật, xong tự thu lại.
  async function preview() {
    const map = mapRef.current; if (!map || rec || previewing) return;
    if (!parcel.current.length && route.current.length < 2) { toast.error('Hãy vẽ lô đất hoặc tuyến đường trước'); return; }
    setMode('none'); setPreviewing(true); stopRef.current = false;
    await moToanManHinh();
    try { toast.info('Đang tải bản đồ…'); await warmTiles(map); await animateCamera(map, Math.max(4, duration) * 1000); }
    finally { setPreviewing(false); stopRef.current = false; thoatToanManHinh(); try { map.easeTo({ pitch: 0, bearing: 0, duration: 500 }); } catch { /* ignore */ } }
  }

  // Người dùng bấm phím Esc để thoát toàn màn hình → dừng luôn việc chạy thử cho khớp.
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement && previewing) stopRef.current = true; };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [previewing]);

  // Kéo PLAYHEAD để tua tới thời điểm bất kỳ (bấm/kéo trên nền timeline).
  function scrubAt(clientX: number) { const cont = tlRef.current; if (!cont) return; const rc = cont.getBoundingClientRect(); const t = Math.max(0, Math.min(1, (clientX - rc.left) / rc.width)) * duration; setPlayhead(Math.round(t * 10) / 10); }
  function scrubStart(e: React.PointerEvent) { if (previewing || rec) return; scrubAt(e.clientX); const mv = (ev: PointerEvent) => scrubAt(ev.clientX); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }

  // Kéo clip trên timeline (dời / co cạnh trái / co cạnh phải).
  function beginDrag(track: 'route' | 'text' | 'chart' | 'music', edge: 'move' | 'l' | 'r', e: React.PointerEvent) {
    e.preventDefault(); const cont = tlRef.current; if (!cont) return;
    const wpx = cont.getBoundingClientRect().width; const total = Math.max(1, duration); const startX = e.clientX;
    const [os, od] = (clips as any)[track];
    // Điểm HÍT (snap): đầu/cuối video · playhead · cạnh các clip khác.
    const targets = [0, total, Math.round(playhead * 10) / 10];
    (['route', 'text', 'chart', 'music'] as const).forEach((tk) => { if (tk !== track) { const c = (clips as any)[tk]; if (c) { targets.push(c[0], c[0] + c[1]); } } });
    const thr = total * 0.02 + 0.15; const snap = (v: number) => { for (const t of targets) { if (Math.abs(v - t) < thr) return t; } return v; };
    const onMove = (ev: PointerEvent) => {
      const dSec = ((ev.clientX - startX) / wpx) * total; let s = os, d = od;
      if (edge === 'move') { s = Math.min(total - od, Math.max(0, os + dSec)); s = snap(s); const en = snap(s + od); if (en !== s + od) s = Math.min(total - od, Math.max(0, en - od)); }
      else if (edge === 'l') { s = Math.min(os + od - 0.5, Math.max(0, snap(os + dSec))); d = od + (os - s); }
      else { d = Math.min(total - os, Math.max(0.5, snap(os + od + dSec) - os)); }
      setClips((c) => ({ ...c, [track]: [Math.round(s * 10) / 10, Math.round(d * 10) / 10] }));
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  }

  async function record(collect = false): Promise<Blob | null> {
    const map = mapRef.current; if (!map) return null;
    if (!parcel.current.length && route.current.length < 2 && !markers.current.length && !radii.current.length && !dists.current.length) { toast.error('Hãy vẽ lô/tuyến hoặc thêm điểm trước'); return null; }
    setMode('none'); setRec(true); recRef.current = true; stopRef.current = false;
    const r = renderRef.current; // chốt cấu hình quay tại thời điểm này
    const { W, H } = dims();
    const bitrate = r.res === '720' ? 5_000_000 : 9_000_000;
    const comp = document.createElement('canvas'); comp.width = W; comp.height = H;
    const ctx = comp.getContext('2d')!;
    const mapCanvas: HTMLCanvasElement = map.getCanvas();
    const cdata = r.chartOn ? parseChart(r.chartRaw) : []; // dữ liệu biểu đồ (chốt lúc bấm quay)
    chartProgRef.current = 0;
    const sc = Math.min(W, H) / 1080; // hệ số co theo cạnh ngắn (đúng cho mọi khổ dọc/vuông/ngang)

    function frame() {
      // Nền trời→đất lấp vùng tile chưa tải (phòng hờ cho cả máy không hỗ trợ setSky).
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#a6c4e2'); bg.addColorStop(0.55, '#cdd8e0'); bg.addColorStop(1, '#aeb6ad'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      try { ctx.drawImage(mapCanvas, 0, 0, W, H); } catch { /* ignore */ }
      // Chữ hiện đúng clip; logo luôn hiện. Biểu đồ hiện đúng clip.
      const useBrand = isPro && !!brandImgRef.current; // bản miễn phí luôn giữ logo web (chữ)
      const to = r.tracksOn || { text: true, chart: true }; const showText = textVisRef.current && to.text;
      const tcl = (r.clips || clips).text; const tap = (r.textAnim === 'none') ? 1 : Math.max(0, Math.min(1, (elapRef.current - tcl[0]) / 0.6)); // tiến độ hiện chữ
      drawOverlay(ctx, W, H, layoutRef.current, showText ? r.title : '', showText ? r.sub : '', r.logo && !useBrand, r.textAnim || 'fade', tap);
      if (r.logo && useBrand) { const im = brandImgRef.current!; const lh = Math.round(84 * sc); const lw = Math.round(lh * ((im.width / im.height) || 3)); const mg = Math.round(40 * sc); ctx.drawImage(im, W - lw - mg, mg, lw, lh); } // logo tuỳ chỉnh (góc trên phải)
      if (cdata.length && chartVisRef.current && to.chart) drawChart(ctx, W - 560 * sc - 40 * sc, 130 * sc, 560 * sc, 300 * sc, cdata, chartProgRef.current, r.chartTitle, r.chartType);
      const el = elapRef.current; const cap = (r.subs || []).find((x: Sub) => el >= x.s && el <= x.e); if (cap?.t) drawSub(ctx, W, H, cap.t);
      if (qrImgRef.current) { const qs = Math.round(180 * sc), m = Math.round(36 * sc), pad = Math.round(10 * sc), x = W - qs - m, y = H - qs - m; ctx.fillStyle = '#fff'; roundRect(ctx, x - pad, y - pad, qs + pad * 2, qs + pad * 2, Math.round(12 * sc)); ctx.fill(); ctx.drawImage(qrImgRef.current, x, y, qs, qs); }
      (r.objects || []).forEach((o: Obj) => drawObj(ctx, W, H, o, objImgRef.current[o.id] || objVidRef.current[o.id], el)); // object chữ/ảnh/video tự do
    }
    let running = true;
    const loop = () => { if (!running) return; frame(); map.triggerRepaint(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);

    // Ưu tiên quay THẲNG MP4 (iPhone/Safari + Chrome mới dùng mã hoá phần cứng) → khỏi cần chuyển đổi. Không hỗ trợ thì WebM.
    const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || '';
    const isMp4 = mime.includes('mp4');
    // Trộn NHẠC/tiếng (từ file nhạc hoặc video) vào NGAY lúc quay → video ra đã có nhạc, không cần ghép sau.
    let tracks: MediaStreamTrack[] = (comp as any).captureStream(30).getVideoTracks();
    let actx: any = null, musicEl: HTMLMediaElement | null = null, voiceEl: HTMLMediaElement | null = null, audioMixed = false;
    if (audio || voice) {
      try {
        actx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        const destNode = actx.createMediaStreamDestination(); await actx.resume?.();
        if (audio) {
          musicEl = document.createElement(audio.type.startsWith('video') ? 'video' : 'audio') as HTMLMediaElement;
          musicEl.src = URL.createObjectURL(audio); (musicEl as any).loop = true; (musicEl as any).playsInline = true;
          const g = actx.createGain(); g.gain.value = voice ? 0.32 : 0.9; // có giọng đọc → hạ nhạc nền
          actx.createMediaElementSource(musicEl).connect(g); g.connect(destNode);
        }
        if (voice) {
          voiceEl = document.createElement('audio') as HTMLMediaElement;
          voiceEl.src = URL.createObjectURL(voice); (voiceEl as any).playsInline = true;
          const g = actx.createGain(); g.gain.value = 1.0;
          actx.createMediaElementSource(voiceEl).connect(g); g.connect(destNode);
        }
        tracks = [...tracks, ...destNode.stream.getAudioTracks()]; audioMixed = true; // đưa vào luồng quay, KHÔNG ra loa
      } catch (err) { console.warn('[mix audio]', err); }
    }
    const stream = new MediaStream(tracks);
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: bitrate } : { videoBitsPerSecond: bitrate });
    const chunks: BlobPart[] = []; mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<Blob>((res) => { mr.onstop = () => res(new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' })); });
    await warmTiles(map); // nạp sẵn tile trước khi bắt đầu ghi → video không bị khoảng trắng
    try { Object.values(objVidRef.current).forEach((v) => { v.currentTime = 0; v.muted = true; v.play().catch(() => {}); }); } catch { /* ignore */ } // video object phát lại từ đầu
    mr.start(100);
    // Nhạc phát đúng CLIP nhạc trên timeline.
    const musT: any[] = [];
    const mus = r.clips?.music || clips.music;
    if (musicEl && (r.tracksOn?.music ?? true)) { musT.push(setTimeout(() => musicEl?.play().catch(() => {}), mus[0] * 1000)); musT.push(setTimeout(() => musicEl?.pause(), (mus[0] + mus[1]) * 1000)); }
    if (voiceEl) { voiceEl.play().catch(() => {}); } // giọng đọc phát từ đầu

    try {
      await animateCamera(map, Math.max(4, r.duration) * 1000); // bay theo keyframe của kịch bản
    } finally {
      running = false; mr.stop(); musT.forEach(clearTimeout);
      try { musicEl?.pause(); voiceEl?.pause(); } catch { /* ignore */ }
      try { map.easeTo({ pitch: 0, bearing: 0, duration: 600 }); } catch { /* ignore */ } // trả về phẳng để vẽ tiếp cho chính xác
    }
    const blob = await done; setRec(false); recRef.current = false;
    try { if (musicEl?.src) URL.revokeObjectURL(musicEl.src); if (voiceEl?.src) URL.revokeObjectURL(voiceEl.src); actx?.close?.(); } catch { /* ignore */ }
    if (collect) return await finishToMp4(blob, isMp4, audioMixed); // xuất cả bộ: trả blob để nén ZIP
    await exportVideo(blob, isMp4, audioMixed); return null;
  }

  // Đưa bản quay về MP4 (nếu cần đổi từ WebM). Trả về blob MP4, hoặc WebM khi máy không đổi được.
  async function finishToMp4(blob: Blob, isMp4: boolean, audioMixed: boolean): Promise<Blob> {
    if (isMp4) return blob;
    setExporting(true); setPct(0);
    try { return await encodeMp4Browser(blob, audioMixed ? null : audio, (p) => setPct(Math.round(p * 100))); }
    catch (e: any) { console.error('[wasm]', e); return blob; }
    finally { setExporting(false); }
  }

  async function exportVideo(blob: Blob, isMp4: boolean, audioMixed: boolean) {
    if (isMp4) { dl(blob, 'video-ban-do.mp4'); toast.success('Đã xuất MP4 — quay thẳng trên máy bạn, không lên máy chủ'); return; }
    toast.info('Đang xuất MP4 ngay trên máy bạn…');
    const out = await finishToMp4(blob, isMp4, audioMixed);
    if (out.type.includes('mp4')) { dl(out, 'video-ban-do.mp4'); toast.success('Đã xuất MP4 — xử lý & lưu tại máy bạn, không lên máy chủ'); }
    else { toast.info('Máy chưa đổi được MP4 — đã lưu bản WebM tại máy bạn (vẫn xem/đăng & cắt ghép được).'); dl(out, 'video-ban-do.webm'); }
  }

  // XUẤT CẢ 5 VIDEO → nén ZIP. Quay TUẦN TỰ từng kịch bản (không nặng cùng lúc), gom lại rồi tải 1 file.
  async function exportAll() {
    const map = mapRef.current; if (!map || rec || exporting || busyAll) return;
    if (!parcel.current.length && route.current.length < 2 && !markers.current.length && !radii.current.length && !dists.current.length) { toast.error('Hãy vẽ lô/tuyến hoặc thêm điểm trước'); return; }
    const savedActive = activeScript; const savedSettings = settingsNow();
    setBusyAll(true); setMode('none');
    const files: { name: string; blob: Blob }[] = [];
    try {
      for (let i = 0; i < scripts.length; i++) {
        setActiveScript(i); applySettings(scripts[i].settings);
        await sleep(750); // đợi đổi khổ + map resize + renderRef cập nhật theo kịch bản
        toast.info(`Đang xuất ${i + 1}/${scripts.length}: ${scripts[i].name}`);
        const blob = await record(true);
        if (blob) files.push({ name: `${String(i + 1).padStart(2, '0')}_${KEYSLUG[scripts[i].key] || slugName(scripts[i].name)}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, blob });
      }
      if (!files.length) { toast.error('Không quay được video nào'); return; }
      toast.info('Đang nén ZIP…');
      const mod: any = await import(/* webpackIgnore: true */ 'https://esm.sh/jszip@3.10.1');
      const JSZip = mod.default || mod; const zip = new JSZip();
      files.forEach((f) => zip.file(f.name, f.blob));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      dl(zipBlob, `${slugName(property.name || 'du-an')}.zip`);
      toast.success(`Đã xuất ${files.length} video (ZIP) — lưu tại máy bạn, không lên máy chủ`);
    } catch (e: any) { console.error('[exportAll]', e); toast.error('Lỗi xuất bộ video: ' + (e?.message || '')); }
    finally { setBusyAll(false); setActiveScript(savedActive); applySettings(savedSettings); }
  }

  // XUẤT RIÊNG 1 kịch bản (tải ngay khi người dùng đang xem tab đó). Chuyển sang kịch bản i rồi quay & tải file của nó.
  async function exportOne(i: number) {
    const map = mapRef.current; if (!map || rec || exporting || busyAll) return;
    if (!parcel.current.length && route.current.length < 2 && !markers.current.length && !radii.current.length && !dists.current.length) { toast.error('Hãy vẽ lô/tuyến hoặc thêm điểm trước'); return; }
    if (i !== activeScript) { switchScript(i); await sleep(650); } else { await sleep(80); } // đợi đổi khổ + renderRef cập nhật
    toast.info(`Đang xuất: ${scripts[i].name}`);
    const blob = await record(true);
    if (blob) { dl(blob, `${String(i + 1).padStart(2, '0')}_${KEYSLUG[scripts[i].key] || slugName(scripts[i].name)}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`); toast.success(`Đã xuất ${scripts[i].name} — lưu tại máy bạn`); }
  }
  function dl(blob: Blob, name: string) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); }

  const btn = (active: boolean) => ({ background: active ? NAVY : '#fff', color: active ? '#fff' : NAVY, border: `1px solid ${active ? NAVY : '#d8cfbc'}` });

  const seg = (active: boolean) => ({ background: active ? GOLD : 'transparent', color: active ? NAVY : '#cbd5e1' });
  const inText = playhead >= clips.text[0] && playhead <= clips.text[0] + clips.text[1]; // chữ có hiện tại vị trí playhead?
  const inChart = playhead >= clips.chart[0] && playhead <= clips.chart[0] + clips.chart[1];
  const so = objects.find((o) => o.id === selObj) || null; // object đang chọn (cho inspector)
  return (
    <div className="cl-video-tool overflow-hidden rounded-2xl shadow-lg" style={{ background: '#0f1e30' }}>
      {/* THANH TRÊN */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ background: '#0b1826' }}>
        <div className="flex items-center gap-2 font-bold text-white">🎬 Tạo video bản đồ <span className="text-[11px] font-normal" style={{ color: saveState === 'saved' ? '#7bd88f' : '#94a3b8' }}>{saveState === 'saving' ? '· Đang lưu…' : saveState === 'saved' ? '· Đã lưu' : ''}</span></div>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: '#2a3f57' }}>
            {(['16:9', '9:16', '1:1'] as const).map((o) => <button key={o} onClick={() => setOrient(o)} className="px-3 py-1.5 text-xs font-bold" style={seg(orient === o)}>{o === '16:9' ? 'Ngang' : o === '9:16' ? 'Dọc' : 'Vuông'}</button>)}
          </div>
          <button onClick={() => record()} disabled={!ready || rec || exporting || previewing || busyAll} className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60" style={{ background: GOLD, color: NAVY }}>{rec ? 'Đang quay…' : exporting ? `Xuất ${pct}%` : '⬇ Xuất video'}</button>
          <button onClick={exportAll} disabled={!ready || rec || exporting || previewing || busyAll} className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60" style={{ background: '#22c55e', color: '#052e16' }} title="Quay tuần tự 5 kịch bản rồi nén ZIP">{busyAll ? '⏳ Đang xuất bộ…' : '📦 Xuất cả bộ (ZIP)'}</button>
        </div>
      </div>

      {/* KỊCH BẢN: 1 dự án → 5 video (dùng chung bản đồ + thông tin, mỗi kịch bản chữ/khổ/nhạc/hiệu ứng riêng) */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2" style={{ background: '#0d2033', borderTop: '1px solid #1b3149' }}>
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">Kịch bản:</span>
        {scripts.map((s, i) => (
          <div key={s.key} className="flex shrink-0 items-center overflow-hidden rounded-lg" style={{ background: i === activeScript ? GOLD : '#16283d' }}>
            <button onClick={() => switchScript(i)} onDoubleClick={() => { const n = prompt('Đổi tên kịch bản:', s.name); if (n) renameScript(i, n); }} className="px-3 py-1.5 text-xs font-semibold" style={{ color: i === activeScript ? NAVY : '#cbd5e1' }} title="Bấm để chuyển · bấm đúp để đổi tên">{s.name}</button>
            <button onClick={() => exportOne(i)} disabled={!ready || rec || exporting || busyAll} className="px-1.5 py-1.5 text-xs disabled:opacity-40" style={{ color: i === activeScript ? NAVY : '#93c5fd' }} title="Xuất riêng video kịch bản này">⬇</button>
          </div>
        ))}
        <div className="ml-1 flex shrink-0 items-center gap-1">
          <button onClick={() => moveScript(activeScript, -1)} className="rounded px-1.5 py-1 text-xs font-bold text-slate-300 hover:text-white" title="Chuyển sang trái">◀</button>
          <button onClick={() => moveScript(activeScript, 1)} className="rounded px-1.5 py-1 text-xs font-bold text-slate-300 hover:text-white" title="Chuyển sang phải">▶</button>
          <button onClick={() => duplicateScript(activeScript)} className="rounded px-1.5 py-1 text-xs font-bold text-slate-300 hover:text-white" title="Nhân bản">⧉</button>
          <button onClick={addScript} className="rounded px-1.5 py-1 text-xs font-bold text-slate-300 hover:text-white" title="Thêm kịch bản">＋</button>
          <button onClick={() => deleteScript(activeScript)} className="rounded px-1.5 py-1 text-xs font-bold text-red-400 hover:text-red-300" title="Xoá kịch bản">🗑</button>
        </div>
        {/* Quản lý kịch bản */}
        <div className="flex shrink-0 items-center gap-1 pl-1">
          <button onClick={addScript} title="Thêm kịch bản" className="rounded-lg px-2 py-1.5 text-xs font-bold" style={{ background: '#16283d', color: '#7bd88f' }}>＋</button>
          <button onClick={() => duplicateScript(activeScript)} title="Nhân bản kịch bản đang mở" className="rounded-lg px-2 py-1.5 text-xs" style={{ background: '#16283d', color: '#cbd5e1' }}>⧉</button>
          <button onClick={() => moveScript(activeScript, -1)} title="Dời trái" className="rounded-lg px-2 py-1.5 text-xs" style={{ background: '#16283d', color: '#cbd5e1' }}>◀</button>
          <button onClick={() => moveScript(activeScript, 1)} title="Dời phải" className="rounded-lg px-2 py-1.5 text-xs" style={{ background: '#16283d', color: '#cbd5e1' }}>▶</button>
          <button onClick={() => deleteScript(activeScript)} title="Xoá kịch bản đang mở" className="rounded-lg px-2 py-1.5 text-xs" style={{ background: '#16283d', color: '#f87171' }}>✕</button>
        </div>
      </div>

      {/* THÂN: sân khấu (trái) + bảng thuộc tính (phải) */}
      <div className="cl-video-body flex flex-col lg:flex-row lg:items-stretch">
        {/* SÂN KHẤU */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Tìm địa điểm (vd: Cam Đức, Cam Lâm)" className="min-w-0 flex-1 rounded-lg border-0 px-3 py-2 text-sm" style={{ background: '#1b3149', color: '#e2e8f0' }} />
            <button onClick={search} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: GOLD, color: NAVY }}>Tìm</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <button onClick={() => setMode(mode === 'parcel' ? 'none' : 'parcel')} className="rounded-lg px-3 py-1.5 font-semibold" style={seg(mode === 'parcel')}>▱ Vẽ lô</button>
            <button onClick={() => setMode(mode === 'route' ? 'none' : 'route')} className="rounded-lg px-3 py-1.5 font-semibold" style={seg(mode === 'route')}>➛ Vẽ tuyến</button>
            <button onClick={() => setMode(mode === 'marker' ? 'none' : 'marker')} className="rounded-lg px-3 py-1.5 font-semibold" style={seg(mode === 'marker')}>📍 Điểm nhấn</button>
            <button onClick={() => setMode(mode === 'radius' ? 'none' : 'radius')} className="rounded-lg px-3 py-1.5 font-semibold" style={seg(mode === 'radius')}>⭕ Bán kính</button>
            <button onClick={() => { setMode(mode === 'distance' ? 'none' : 'distance'); distPending.current = null; }} className="rounded-lg px-3 py-1.5 font-semibold" style={seg(mode === 'distance')}>📏 Khoảng cách</button>
            <button onClick={() => setMode(mode === 'edit' ? 'none' : 'edit')} className="rounded-lg px-3 py-1.5 font-semibold" style={seg(mode === 'edit')}>✎ Sửa đỉnh</button>
            <button onClick={addTextObj} className="rounded-lg px-3 py-1.5 font-semibold" style={seg(false)} title="Thêm chữ tự do">＋ Chữ</button>
            <label className="cursor-pointer rounded-lg px-3 py-1.5 font-semibold" style={seg(false)} title="Thêm ảnh tự do">＋ Ảnh<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addImageObj(f); (e.target as HTMLInputElement).value = ''; }} /></label>
            <label className="cursor-pointer rounded-lg px-3 py-1.5 font-semibold" style={seg(false)} title="Thêm video (chèn vào video bản đồ)">＋ Video<input type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addVideoObj(f); (e.target as HTMLInputElement).value = ''; }} /></label>
            <label className="cursor-pointer rounded-lg px-3 py-1.5 font-semibold" style={seg(false)} title="Nhập KML/GeoJSON">📂 Nhập KML/KMZ<input type="file" accept=".geojson,.json,.kml,.kmz,application/geo+json,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importGeo(f); (e.target as HTMLInputElement).value = ''; }} /></label>
            <button onClick={undoHistory} disabled={!canUndo} className="rounded-lg px-3 py-1.5 font-semibold disabled:opacity-40" style={seg(false)} title="Hoàn tác (Ctrl+Z)">↶ Hoàn tác</button>
            <button onClick={redoHistory} disabled={!canRedo} className="rounded-lg px-3 py-1.5 font-semibold disabled:opacity-40" style={seg(false)} title="Làm lại (Ctrl+Shift+Z)">↷ Làm lại</button>
            <button onClick={reset} className="rounded-lg px-3 py-1.5 font-semibold" style={seg(false)}>↺ Xoá</button>
            <button onClick={() => { const b = bounds(); if (b) mapRef.current?.fitBounds(b, { padding: 60, pitch: 0, bearing: 0, duration: 600, maxZoom: 18 }); else toast.info('Chưa có lô/tuyến để canh khung'); }} className="rounded-lg px-3 py-1.5 font-semibold" style={seg(false)} title="Đưa tất cả lô + tuyến + điểm vào 1 khung">⛶ Vừa khung</button>
            <label className="flex items-center gap-1 text-xs text-slate-300"><input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Nhãn</label>
            <label className="flex items-center gap-1 text-xs text-slate-300" title="Khung an toàn (chỉ hướng dẫn, không vào video)"><input type="checkbox" checked={safeArea} onChange={(e) => setSafeArea(e.target.checked)} /> Khung an toàn</label>
            <label className="flex items-center gap-1 text-xs text-slate-300" title={isPro ? '' : 'Bản miễn phí giữ logo'}><input type="checkbox" checked={logo} disabled={!isPro} onChange={(e) => setLogo(e.target.checked)} /> Logo{!isPro && '🔒'}</label>
            <span className="ml-1 text-xs text-slate-400">Lớp:</span>
            <button onClick={() => setBase('sat')} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={seg(base === 'sat')}>Vệ tinh</button>
            <button onClick={() => setBase('street')} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={seg(base === 'street')}>Đường</button>
            <button onClick={() => setBase('dark')} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={seg(base === 'dark')}>Tối</button>
          </div>
          {mode === 'marker' && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">Nhãn điểm:</span>
              <input value={markerLabel} onChange={(e) => setMarkerLabel(e.target.value)} className="w-32 rounded border-0 px-2 py-1 text-xs" style={{ background: '#1b3149', color: '#e2e8f0' }} />
              {['Trường', 'Chợ', 'Biển', 'Bệnh viện', 'Sân bay', 'UBND', 'Cao tốc'].map((t) => (
                <button key={t} onClick={() => setMarkerLabel(t)} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={seg(markerLabel === t)}>{t}</button>
              ))}
            </div>
          )}
          {mode === 'radius' && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">Bán kính:</span>
              {[500, 1000, 2000, 3000, 5000].map((r) => (
                <button key={r} onClick={() => setRadiusM(r)} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={seg(radiusM === r)}>{fmtDist(r)}</button>
              ))}
              <input type="number" min={100} step={100} value={radiusM} onChange={(e) => setRadiusM(Math.max(100, Number(e.target.value) || 0))} className="w-20 rounded border-0 px-2 py-1 text-xs" style={{ background: '#1b3149', color: '#e2e8f0' }} title="mét" />
              <span className="text-[11px] text-slate-500">m</span>
            </div>
          )}
          {mode !== 'none' && <div className="mt-1 text-xs" style={{ color: GOLD }}>{mode === 'parcel' ? 'Bấm lần lượt các điểm để khoanh lô.' : mode === 'route' ? 'Bấm lần lượt các điểm để vẽ tuyến.' : mode === 'marker' ? 'Bấm để đặt điểm nhấn.' : mode === 'radius' ? 'Bấm 1 điểm làm tâm vòng bán kính.' : mode === 'edit' ? 'Kéo đỉnh (chấm trắng) để dời · bấm đỉnh để xoá.' : 'Bấm điểm A rồi điểm B để đo khoảng cách.'} Bấm lại nút để dừng.</div>}

      {/* Bản đồ — CHIẾM HẾT chiều cao khối (canvas lớn, không để trống); tối thiểu 320px. */}
      <div ref={stageRef} onPointerDown={() => setSelObj(null)} className="cl-video-stage relative mt-3 overflow-hidden rounded-xl border" style={{ borderColor: '#2a3f57', ['--cl-ar' as any]: orient.replace(':', ' / ') }}>
        {/* Lớp bọc absolute lấp đầy khung; ô bản đồ để height:100% TƯỜNG MINH (CSS MapLibre đặt .maplibregl-map{position:relative} nên không dùng absolute cho ô map được). */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div ref={boxRef} style={{ width: '100%', height: '100%', background: 'linear-gradient(#a6c4e2, #cdd8e0 55%, #aeb6ad)' }} />
        </div>
        {!ready && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">Đang tải bản đồ vệ tinh…</div>}
        {warming && <div className="absolute inset-0 z-30 grid place-items-center" style={{ background: 'rgba(11,24,38,.94)' }}><div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><span className="h-3 w-3 animate-ping rounded-full" style={{ background: GOLD }} /> Đang tải bản đồ… chờ chút</div></div>}
        {/* Xem trước chữ/logo theo MẪU BỐ CỤC (khớp video) */}
        {tracksOn.text && inText && (layout === 'bottomLeft' || layout === 'bottomCenter') && (
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 p-4 ${layout === 'bottomCenter' ? 'text-center' : ''}`} style={{ background: 'linear-gradient(0deg, rgba(10,37,64,.78), transparent)' }}>
            {title && <div className="text-lg font-bold text-white sm:text-2xl">{title}</div>}
            {sub && <div className="text-sm font-semibold sm:text-base" style={{ color: GOLD }}>{sub}</div>}
          </div>
        )}
        {tracksOn.text && inText && layout === 'topLeft' && (
          <div className="pointer-events-none absolute inset-x-0 top-0 p-4" style={{ background: 'linear-gradient(180deg, rgba(10,37,64,.78), transparent)' }}>
            {title && <div className="text-lg font-bold text-white sm:text-2xl">{title}</div>}
            {sub && <div className="text-sm font-semibold sm:text-base" style={{ color: GOLD }}>{sub}</div>}
          </div>
        )}
        {tracksOn.text && inText && layout === 'card' && (title || sub) && (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border-l-4 px-3 py-2" style={{ background: 'rgba(10,37,64,.8)', borderColor: GOLD }}>
            {title && <div className="text-base font-bold text-white sm:text-xl">{title}</div>}
            {sub && <div className="text-xs font-semibold sm:text-sm" style={{ color: GOLD }}>{sub}</div>}
          </div>
        )}
        {logo && isPro && brandLogo && <img src={brandLogo} alt="logo" className="pointer-events-none absolute right-3 top-3 h-8 sm:h-10" />}
        {logo && !(isPro && brandLogo) && <div className={`pointer-events-none absolute rounded-md px-2 py-1 text-xs font-extrabold ${layout === 'topLeft' ? 'bottom-3 right-3' : layout === 'bottomCenter' ? 'top-3 left-1/2 -translate-x-1/2' : 'top-3 right-3'}`} style={{ background: 'rgba(10,37,64,.75)', color: GOLD }}>CAM LÂM LAND</div>}
        {(() => { const cap = subs.find((x) => playhead >= x.s && playhead <= x.e); return cap?.t ? <div className="pointer-events-none absolute bottom-24 left-1/2 max-w-[80%] -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-center text-xs font-semibold text-white sm:text-sm">{cap.t}</div> : null; })()}
        {property.qrOn && qrUrl && <img src={qrUrl} alt="QR" className="pointer-events-none absolute bottom-3 right-3 w-14 rounded bg-white p-0.5 sm:w-16" />}
        {safeArea && <div className="pointer-events-none absolute inset-[7%] rounded border-2 border-dashed" style={{ borderColor: 'rgba(255,255,255,.55)' }} />}
        {/* OBJECT tự do (chữ/ảnh) — kéo để dời, bấm để chọn */}
        {objects.map((o) => {
          const vis = playhead >= o.s && playhead <= o.e; const sel = selObj === o.id; const ghost = !!o.hidden; const shown = ghost || vis;
          const ctx = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setSelObj(o.id); setCtxMenu({ id: o.id, x: e.clientX, y: e.clientY }); };
          const base: React.CSSProperties = { position: 'absolute', left: `${o.x * 100}%`, top: `${o.y * 100}%`, transform: `translate(-50%,-50%) rotate(${o.rot}deg)`, opacity: ghost ? 0.22 : (vis ? o.opacity : 0), cursor: o.locked ? 'default' : 'move', touchAction: 'none', outline: sel ? '2px solid #C8A14B' : ghost ? '1px dashed #94a3b8' : 'none', outlineOffset: 2, visibility: shown ? 'visible' : 'hidden' };
          if (o.type === 'video') return <video key={o.id} ref={(el) => { if (el) objVidRef.current[o.id] = el; }} src={o.src} muted loop autoPlay playsInline onPointerDown={(e) => beginObjDrag(o, e)} onContextMenu={ctx} style={{ ...base, width: `${300 * (boxH / 1080) * o.scale}px` }} />;
          if (!shown) return null;
          if (o.type === 'text') return <div key={o.id} onPointerDown={(e) => beginObjDrag(o, e)} onContextMenu={ctx} style={{ ...base, fontSize: `${(o.size || 48) * (boxH / 1080) * o.scale}px`, fontWeight: o.weight || 700, color: o.color || '#fff', background: o.bg ? 'rgba(0,0,0,.55)' : 'transparent', padding: o.bg ? '0.1em 0.3em' : 0, borderRadius: 6, whiteSpace: 'nowrap', lineHeight: 1.2 }}>{o.text}</div>;
          return <img key={o.id} src={o.src} alt="" onPointerDown={(e) => beginObjDrag(o, e)} onContextMenu={ctx} style={{ ...base, width: `${300 * (boxH / 1080) * o.scale}px` }} />;
        })}
        {chartOn && tracksOn.chart && inChart && <canvas ref={chartPrevRef} width={320} height={172} className="pointer-events-none absolute right-3 top-11 w-[40%] max-w-[320px]" />}
        {rec && <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> ĐANG QUAY…</div>}
      </div>

          {/* Điều khiển dưới sân khấu */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={preview} disabled={!ready || rec || exporting || previewing || busyAll} className="rounded-xl border px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ borderColor: GOLD, color: GOLD }}>{previewing ? '▶ Đang xem…' : '▶ Xem trước'}</button>
            <button onClick={() => record()} disabled={!ready || rec || exporting || previewing || busyAll} className="rounded-xl px-6 py-2.5 text-sm font-bold shadow-md disabled:opacity-60" style={{ background: rec || exporting ? '#64748b' : GOLD, color: NAVY }}>{rec ? '⏳ Đang quay…' : exporting ? `⏳ Xuất ${pct}%` : '🎥 Quay & xuất MP4'}</button>
            <span className="text-xs text-slate-400">{orient} · {res}p · {duration}s · xử lý trên máy bạn</span>
          </div>
          {exporting && (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: '#1b3149' }}><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: GOLD }} /></div>
              <div className="mt-1 text-xs text-slate-400">Đang đổi MP4 & ghép nhạc trên máy bạn… {pct}%</div>
            </div>
          )}
        </div>

        {/* BẢNG THUỘC TÍNH */}
        <div className="w-full shrink-0 space-y-3 overflow-y-auto p-3 lg:max-h-full lg:w-[344px]" style={{ background: '#0b1826' }}>
          {/* PROPERTY INSPECTOR — khi chọn 1 object chữ/ảnh */}
          {so && (
            <div className="rounded-xl bg-white p-3" style={{ boxShadow: '0 0 0 2px ' + GOLD }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-bold" style={{ color: NAVY }}>🎛️ {so.type === 'text' ? 'Chữ' : 'Ảnh'}</div>
                <div className="flex items-center gap-1 text-sm">
                  <button onClick={() => moveObjZ(so.id, 1)} title="Lên trên">⬆</button>
                  <button onClick={() => moveObjZ(so.id, -1)} title="Xuống dưới">⬇</button>
                  <button onClick={() => duplicateObj(so.id)} title="Nhân bản">⧉</button>
                  <button onClick={() => deleteObj(so.id)} className="text-red-600" title="Xoá">🗑</button>
                </div>
              </div>
              {so.type === 'text' && (
                <>
                  <input value={so.text || ''} onChange={(e) => updateObj(so.id, { text: e.target.value })} className="w-full rounded-lg border px-2 py-1 text-sm" style={{ borderColor: '#d8cfbc' }} />
                  <div className="mt-2 flex items-center gap-2 text-xs"><span className="w-10 text-slate-500">Cỡ</span><input type="range" min={16} max={180} value={so.size || 48} onChange={(e) => updateObj(so.id, { size: Number(e.target.value) })} className="flex-1" /></div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs"><span className="text-slate-500">Màu</span>{['#ffffff', '#C8A14B', '#ff3b30', '#22c55e', '#3b82f6', '#0A2540'].map((c) => <button key={c} onClick={() => updateObj(so.id, { color: c })} className="h-5 w-5 rounded-full border-2" style={{ background: c, borderColor: so.color === c ? NAVY : '#d8cfbc' }} />)}<label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={!!so.bg} onChange={(e) => updateObj(so.id, { bg: e.target.checked })} /> Nền</label></div>
                  <div className="mt-1 flex gap-1 text-xs">{([['400', 'Thường'], ['700', 'Đậm'], ['800', 'Rất đậm']] as const).map(([w, n]) => <button key={w} onClick={() => updateObj(so.id, { weight: Number(w) })} className="rounded px-2 py-0.5 font-semibold" style={btn(so.weight === Number(w))}>{n}</button>)}</div>
                </>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs"><span className="w-12 text-slate-500">Kích cỡ</span><input type="range" min={0.2} max={4} step={0.05} value={so.scale} onChange={(e) => updateObj(so.id, { scale: Number(e.target.value) })} className="flex-1" /></div>
              <div className="mt-1 flex items-center gap-2 text-xs"><span className="w-12 text-slate-500">Xoay</span><input type="range" min={-180} max={180} value={so.rot} onChange={(e) => updateObj(so.id, { rot: Number(e.target.value) })} className="flex-1" /></div>
              <div className="mt-1 flex items-center gap-2 text-xs"><span className="w-12 text-slate-500">Độ mờ</span><input type="range" min={0} max={1} step={0.05} value={so.opacity} onChange={(e) => updateObj(so.id, { opacity: Number(e.target.value) })} className="flex-1" /></div>
              <div className="mt-1 flex items-center gap-1 text-xs"><span className="w-12 text-slate-500">Hiện</span><input type="number" min={0} max={duration} step={0.5} value={so.s} onChange={(e) => updateObj(so.id, { s: Number(e.target.value) })} className="w-14 rounded border px-1 py-0.5" style={{ borderColor: '#d8cfbc' }} /> → <input type="number" min={0} max={duration} step={0.5} value={so.e} onChange={(e) => updateObj(so.id, { e: Number(e.target.value) })} className="w-14 rounded border px-1 py-0.5" style={{ borderColor: '#d8cfbc' }} /> s</div>
              <div className="mt-2 flex items-center gap-1 text-xs">
                <span className="w-12 text-slate-500">Căn</span>
                {([['l', '⇤'], ['cx', '↔'], ['r', '⇥'], ['t', '⤒'], ['cy', '↕'], ['b', '⤓']] as const).map(([k, ic]) => <button key={k} onClick={() => alignObj(so.id, k)} className="rounded border px-1.5 py-0.5" style={{ borderColor: '#d8cfbc', color: NAVY }} title="Căn">{ic}</button>)}
                <button onClick={() => updateObj(so.id, { locked: !so.locked })} className="ml-auto rounded px-1.5 py-0.5" title="Khoá/mở">{so.locked ? '🔒' : '🔓'}</button>
                <button onClick={() => updateObj(so.id, { hidden: !so.hidden })} className="rounded px-1.5 py-0.5" title="Ẩn/hiện">{so.hidden ? '🚫' : '👁'}</button>
              </div>
            </div>
          )}

          {/* Thông tin dự án (nhập 1 lần — dùng cho cả 5 kịch bản) */}
          <div className="rounded-xl bg-white p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: NAVY }}>🏡 Thông tin dự án</div>
            <div className="grid grid-cols-2 gap-2">
              <input value={property.name} onChange={(e) => setProperty({ ...property, name: e.target.value })} placeholder="Tên dự án" className="col-span-2 rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: '#d8cfbc' }} />
              <input value={property.price} onChange={(e) => setProperty({ ...property, price: e.target.value })} placeholder="Giá (vd 1,2 tỷ)" className="rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: '#d8cfbc' }} />
              <input value={property.area} onChange={(e) => setProperty({ ...property, area: e.target.value })} placeholder="Diện tích (m²)" className="rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: '#d8cfbc' }} />
              <input value={property.phone} onChange={(e) => setProperty({ ...property, phone: e.target.value })} placeholder="SĐT" className="rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: '#d8cfbc' }} />
              <input value={property.zalo} onChange={(e) => setProperty({ ...property, zalo: e.target.value })} placeholder="Zalo" className="rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: '#d8cfbc' }} />
              <input value={property.address} onChange={(e) => setProperty({ ...property, address: e.target.value })} placeholder="Địa chỉ" className="col-span-2 rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: '#d8cfbc' }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={autoFillScripts} className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: GOLD, color: NAVY }}>✨ Tạo bộ kịch bản khác nhau</button>
              <button onClick={aiWriteScripts} disabled={aiBusy} className="rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60" style={{ background: '#7c3aed', color: '#fff' }} title="AI viết lời thoại cho các kịch bản (dùng dữ liệu bạn nhập)">{aiBusy ? '⏳ AI đang viết…' : '🤖 AI viết kịch bản'}</button>
              <button onClick={() => { setSub('Liên hệ: ' + property.phone); setTitle(property.name); toast.success('Đã áp thông tin vào kịch bản này'); }} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={btn(false)}>Chỉ kịch bản này</button>
              <button onClick={applyInfoAll} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={btn(false)}>Áp cho TẤT CẢ</button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>
              <input type="checkbox" checked={!!property.qrOn} onChange={(e) => { const on = e.target.checked; const d = property.qrData || property.website || (property.zalo ? 'https://zalo.me/' + property.zalo.replace(/\D/g, '') : '') || property.phone || ''; setProperty({ ...property, qrOn: on, qrData: d }); }} /> 🔳 Mã QR liên hệ (hiện góc video)
            </label>
            {property.qrOn && (
              <div className="mt-2 flex items-start gap-2">
                <input value={property.qrData || ''} onChange={(e) => setProperty({ ...property, qrData: e.target.value })} placeholder="Website / https://zalo.me/... / SĐT" className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: '#d8cfbc' }} />
                {qrUrl && <img src={qrUrl} alt="QR" className="h-12 w-12 rounded border" style={{ borderColor: '#d8cfbc' }} />}
              </div>
            )}
          </div>

          {/* Chữ + bố cục */}
          <div className="rounded-xl bg-white p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: NAVY }}>✏️ Chữ trên video (kịch bản: {scripts[activeScript]?.name})</div>
            <label className="text-xs font-semibold text-slate-500">Tiêu đề</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 mb-2 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#d8cfbc' }} />
            <label className="text-xs font-semibold text-slate-500">Dòng phụ (giá / liên hệ)</label>
            <input value={sub} onChange={(e) => setSub(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#d8cfbc' }} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LAYOUTS.map((l) => <button key={l.key} onClick={() => setLayout(l.key)} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(layout === l.key)}>{l.name}</button>)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">🎥 Camera:</span>
              <select value={camStyle} onChange={(e) => setCamStyle(e.target.value)} className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs" style={{ borderColor: '#d8cfbc' }}>
                {CAMSTYLES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">✨ Chữ hiện:</span>
              <select value={textAnim} onChange={(e) => setTextAnim(e.target.value)} className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs" style={{ borderColor: '#d8cfbc' }}>
                {TEXTANIMS.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </div>
            {camStyle === 'custom' && (
              <div className="mt-2 rounded-lg border p-2" style={{ borderColor: '#d8cfbc' }}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: NAVY }}>🎯 Đường bay tự đặt</span>
                  <div className="flex gap-1">
                    <button onClick={toggleRecPath} className="rounded px-2 py-1 text-xs font-bold text-white" style={{ background: recPath ? '#ef4444' : '#7c3aed' }} title="Ghi lại chuyển động bản đồ của bạn thành đường bay">{recPath ? '■ Dừng ghi' : '🔴 Ghi hành trình'}</button>
                    <button onClick={captureKeyframe} className="rounded px-2 py-1 text-xs font-bold" style={{ background: GOLD, color: NAVY }} title="Chỉnh bản đồ rồi chốt 1 khung tại mốc giây">＋ Chốt {playhead.toFixed(1)}s</button>
                  </div>
                </div>
                {camKeys.length < 2 && <div className="text-[11px] text-slate-400">Kéo playhead tới mốc → chỉnh bản đồ → “Chốt”. Cần ≥ 2 khung để bay.</div>}
                <div className="space-y-1">
                  {camKeys.map((k, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-12 font-mono">{k.t.toFixed(1)}s</span>
                      <span className="min-w-0 flex-1 truncate text-slate-500">z{k.zoom.toFixed(1)} · {Math.round(k.pitch)}° · {Math.round(k.bearing)}°</span>
                      <button onClick={() => gotoKeyframe(k)} className="font-semibold" style={{ color: NAVY }}>đi tới</button>
                      <button onClick={() => setCamKeys(camKeys.filter((_, j) => j !== i))} className="font-bold text-red-600">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Brand Kit (logo + liên hệ dùng chung) — CHỈ bản trả phí */}
          <div className="rounded-xl bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: NAVY }}>🏷️ Brand Kit (logo){!isPro && ' 🔒'}</div>
              {isPro && <button onClick={saveBrandKit} className="rounded-lg px-2 py-1 text-xs font-semibold" style={btn(false)}>Lưu</button>}
            </div>
            {isPro ? (
              <>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)}>Tải logo<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { const rd = new FileReader(); rd.onload = () => setBrandLogo(String(rd.result)); rd.readAsDataURL(f); } (e.target as HTMLInputElement).value = ''; }} /></label>
                  {brandLogo && <img src={brandLogo} alt="logo" className="h-8 rounded border" style={{ borderColor: '#d8cfbc' }} />}
                  {brandLogo && <button onClick={() => setBrandLogo('')} className="text-xs font-semibold underline" style={{ color: '#9b2d2d' }}>bỏ</button>}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Logo thay dòng chữ mặc định, hiện góc trên phải video. “Lưu” để dùng cho mọi dự án.</div>
              </>
            ) : (
              <div className="text-[11px] text-slate-400">Logo riêng là tính năng trả phí. Bản miễn phí giữ logo <b>CAM LÂM LAND</b>.</div>
            )}
          </div>

          {/* Phiên bản (Versions) */}
          <div className="rounded-xl bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: NAVY }}>🗂️ Phiên bản</div>
              <button onClick={saveVersion} className="rounded-lg px-2 py-1 text-xs font-semibold" style={btn(false)}>Lưu mốc</button>
            </div>
            {versions.length === 0 && <div className="text-[11px] text-slate-400">Chưa có. Bấm “Lưu mốc” để chụp trạng thái, khôi phục lại sau.</div>}
            <div className="space-y-1">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate" title={new Date(v.ts).toLocaleString()}>{v.name}</span>
                  <button onClick={() => restoreVersion(v)} className="font-semibold" style={{ color: NAVY }}>Khôi phục</button>
                  <button onClick={() => deleteVersion(v.id)} className="font-bold text-red-600" title="Xoá">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Thư viện media (tái dùng ảnh/video/nhạc đã tải) */}
          <div className="rounded-xl bg-white p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: NAVY }}>📚 Thư viện media</div>
            <div className="mb-1 flex flex-wrap gap-1">
              {(['all', 'image', 'video', 'audio', 'fav'] as const).map((f) => <button key={f} onClick={() => setLibFilter(f)} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={btn(libFilter === f)}>{f === 'all' ? 'Tất cả' : f === 'image' ? 'Ảnh' : f === 'video' ? 'Video' : f === 'audio' ? 'Nhạc' : '⭐'}</button>)}
            </div>
            <input value={libQuery} onChange={(e) => setLibQuery(e.target.value)} placeholder="Tìm tên…" className="mb-1 w-full rounded border px-2 py-1 text-xs" style={{ borderColor: '#d8cfbc' }} />
            {library.length === 0 && <div className="text-[11px] text-slate-400">Tải ảnh/video/nhạc là tự lưu vào đây để tái dùng cho kịch bản khác.</div>}
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {library.filter((a) => (libFilter === 'all' || (libFilter === 'fav' ? a.fav : a.kind === libFilter)) && a.name.toLowerCase().includes(libQuery.toLowerCase())).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-xs">
                  <span>{a.kind === 'image' ? '🖼' : a.kind === 'video' ? '🎬' : '🎵'}</span>
                  <span className="min-w-0 flex-1 truncate" title={a.name}>{a.name}</span>
                  <button onClick={() => setLibrary((p) => p.map((x) => (x.id === a.id ? { ...x, fav: !x.fav } : x)))} title="Yêu thích">{a.fav ? '⭐' : '☆'}</button>
                  <button onClick={() => reuseAsset(a)} className="font-semibold" style={{ color: NAVY }}>dùng</button>
                </div>
              ))}
            </div>
          </div>

          {/* Mẫu BĐS 1-chạm */}
          <div className="rounded-xl bg-white p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: NAVY }}>🎬 Mẫu nhanh (áp vào kịch bản đang mở)</div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => <button key={t.key} onClick={() => applyTemplate(t)} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)}>{t.name}</button>)}
            </div>
          </div>

          {/* Hiệu ứng lô đất */}
          <div className="rounded-xl bg-white p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: NAVY }}>✨ Hiệu ứng lô đất</div>
            <div className="flex flex-wrap gap-1.5">
              {([['glow', 'Phát sáng'], ['blink', 'Chớp nháy'], ['ants', 'Viền chạy'], ['static', 'Tĩnh']] as const).map(([k, n]) => (
                <button key={k} onClick={() => setParcelFx(k)} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(parcelFx === k)}>{n}</button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Màu viền:</span>
              {['#C8A14B', '#ff3b30', '#22c55e', '#3b82f6', '#ffffff'].map((c) => (
                <button key={c} onClick={() => setParcelColor(c)} className="h-6 w-6 rounded-full border-2" style={{ background: c, borderColor: parcelColor === c ? NAVY : '#d8cfbc' }} aria-label={c} />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Độ đậm nền:</span>
              <input type="range" min={0} max={0.8} step={0.02} value={parcelOpacity} onChange={(e) => setParcelOpacity(Number(e.target.value))} className="flex-1" style={{ accentColor: NAVY }} />
              <span className="w-8 text-right text-xs text-slate-500">{Math.round(parcelOpacity * 100)}%</span>
            </div>
          </div>

          {/* Biểu đồ */}
          <div className="rounded-xl bg-white p-3">
            <label className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}><input type="checkbox" checked={chartOn} onChange={(e) => setChartOn(e.target.checked)} /> 📊 Biểu đồ động</label>
            {chartOn && (
              <div className="mt-2 space-y-2">
                <input value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} placeholder="Tiêu đề biểu đồ" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#d8cfbc' }} />
                <div className="flex items-center gap-2 text-xs text-slate-500">Kiểu:
                  <button onClick={() => setChartType('bar')} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(chartType === 'bar')}>Cột</button>
                  <button onClick={() => setChartType('line')} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(chartType === 'line')}>Đường</button>
                </div>
                <input value={chartRaw} onChange={(e) => setChartRaw(e.target.value)} placeholder="T2:80, T3:120, T4:150" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#d8cfbc' }} />
              </div>
            )}
          </div>

          {/* Phụ đề (caption theo thời gian) */}
          <div className="rounded-xl bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: NAVY }}>💬 Lời thoại / phụ đề</div>
              <div className="flex gap-1.5">
                <button onClick={() => setSubs(genScript(scripts[activeScript]?.key || 'vitri', property, duration))} className="rounded-lg px-2 py-1 text-xs font-bold" style={{ background: GOLD, color: NAVY }} title="Tự viết lời thoại theo kịch bản này">✍️ Tự viết</button>
                <label className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold" style={btn(false)} title="Nhập SRT/VTT">📥 SRT<input type="file" accept=".srt,.vtt,text/vtt" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const s = parseSrtVtt(await f.text()); if (s.length) { setSubs(s); toast.success('Đã nhập ' + s.length + ' phụ đề'); } else toast.error('File SRT/VTT không hợp lệ'); } (e.target as HTMLInputElement).value = ''; }} /></label>
                <button onClick={() => { const last = subs[subs.length - 1]; const s0 = last ? last.e : 0; setSubs([...subs, { s: s0, e: Math.min(duration, s0 + 2), t: '' }]); }} className="rounded-lg px-2 py-1 text-xs font-semibold" style={btn(false)}>+ Dòng</button>
              </div>
            </div>
            {subs.length === 0 && <div className="text-xs text-slate-400">Chưa có phụ đề. Bấm “+ Dòng” để thêm caption hiện đúng khoảng giây.</div>}
            <div className="space-y-1.5">
              {subs.map((c, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input type="number" min={0} max={duration} step={0.5} value={c.s} onChange={(e) => { const v = Number(e.target.value) || 0; setSubs(subs.map((x, j) => (j === i ? { ...x, s: v } : x))); }} className="w-12 rounded border px-1 py-1 text-xs" style={{ borderColor: '#d8cfbc' }} title="giây bắt đầu" />
                  <input type="number" min={0} max={duration} step={0.5} value={c.e} onChange={(e) => { const v = Number(e.target.value) || 0; setSubs(subs.map((x, j) => (j === i ? { ...x, e: v } : x))); }} className="w-12 rounded border px-1 py-1 text-xs" style={{ borderColor: '#d8cfbc' }} title="giây kết thúc" />
                  <input value={c.t} onChange={(e) => { const v = e.target.value; setSubs(subs.map((x, j) => (j === i ? { ...x, t: v } : x))); }} placeholder="Nội dung caption" className="min-w-0 flex-1 rounded border px-2 py-1 text-xs" style={{ borderColor: '#d8cfbc' }} />
                  <button onClick={() => setSubs(subs.filter((_, j) => j !== i))} className="px-1 text-sm font-bold text-red-600" title="Xoá dòng">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Phân cảnh (Scenes) */}
          <div className="rounded-xl bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: NAVY }}>🎬 Phân cảnh</div>
              <div className="flex gap-1">
                <button onClick={makeDefaultScenes} className="rounded px-2 py-1 text-xs font-semibold" style={btn(false)}>Mẫu 5 cảnh</button>
                <button onClick={addScene} className="rounded px-2 py-1 text-xs font-bold" style={{ background: GOLD, color: NAVY }}>＋</button>
              </div>
            </div>
            {scenes.length === 0 && <div className="text-[11px] text-slate-400">Chưa có cảnh. Thêm cảnh để chia video; tổng thời lượng = tổng các cảnh.</div>}
            <div className="space-y-1">
              {scenes.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1 text-xs">
                  <span className="w-3 text-slate-400">{i + 1}</span>
                  <input value={s.name} onChange={(e) => updateScene(s.id, { name: e.target.value })} className="min-w-0 flex-1 rounded border px-1.5 py-1" style={{ borderColor: '#d8cfbc' }} />
                  <input type="number" min={1} max={60} value={s.dur} onChange={(e) => updateScene(s.id, { dur: Math.max(1, Number(e.target.value) || 1) })} className="w-11 rounded border px-1 py-1" style={{ borderColor: '#d8cfbc' }} title="giây" />
                  <button onClick={() => moveScene(s.id, -1)} title="Lên">⬆</button>
                  <button onClick={() => moveScene(s.id, 1)} title="Xuống">⬇</button>
                  <button onClick={() => dupScene(s.id)} title="Nhân bản">⧉</button>
                  <button onClick={() => deleteScene(s.id)} className="text-red-600" title="Xoá">×</button>
                </div>
              ))}
            </div>
            {scenes.length > 0 && <div className="mt-1 text-[11px] text-slate-400">Tổng {scenes.reduce((a, s) => a + (s.dur || 0), 0)}s → thời lượng video. Bấm cảnh trên timeline để nhảy tới.</div>}
          </div>

          {/* Thời lượng + độ phân giải + nhạc */}
          <div className="rounded-xl bg-white p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: NAVY }}>⚙️ Cài đặt xuất</div>
            <label className="text-xs font-semibold text-slate-500">Thời lượng: <b style={{ color: NAVY }}>{duration}s</b> {scenes.length > 0 ? '(theo phân cảnh)' : '(tối đa 120s)'}</label>
            <input type="range" min={5} max={120} step={1} value={duration} disabled={scenes.length > 0} onChange={(e) => setDuration(Number(e.target.value))} className="mt-1 w-full disabled:opacity-40" style={{ accentColor: NAVY }} />
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Chất lượng:</span>
              <button onClick={() => setRes('1080')} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(res === '1080')}>1080p</button>
              <button onClick={() => setRes('720')} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(res === '720')}>720p</button>
            </div>
            <label className="mt-3 block text-xs font-semibold text-slate-500">Nhạc nền (file nhạc hoặc trích tiếng từ video)</label>
            <input type="file" accept="audio/*,video/*" onChange={(e) => { const f = e.target.files?.[0] || null; setAudio(f); if (f) registerAsset({ kind: 'audio', name: f.name, src: 'aud:' + f.name + f.size, file: f }); }} className="mt-1 w-full text-xs" />
            {audio && <div className="mt-1 flex items-center gap-2 truncate text-xs text-slate-400">🎵 {audio.name} <button onClick={() => setAudio(null)} className="font-semibold underline" style={{ color: '#9b2d2d' }}>bỏ</button></div>}
            <label className="mt-3 block text-xs font-semibold text-slate-500">Giọng đọc (tải lên hoặc thu mic)</label>
            <div className="mt-1 flex items-center gap-2">
              <input type="file" accept="audio/*" onChange={(e) => setVoice(e.target.files?.[0] || null)} className="min-w-0 flex-1 text-xs" />
              <button onClick={recVoice} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-white" style={{ background: voiceRec ? '#ef4444' : NAVY }}>{voiceRec ? '■ Dừng' : '● Thu âm'}</button>
            </div>
            {voice && <div className="mt-1 flex items-center gap-2 truncate text-xs text-slate-400">🎤 {voice.name} <button onClick={() => setVoice(null)} className="font-semibold underline" style={{ color: '#9b2d2d' }}>bỏ</button></div>}
          </div>
        </div>
      </div>

      {/* TIMELINE — kéo clip để dời, kéo cạnh để co giãn; điều khiển KHI phần tử hiện trong video */}
      <div className="shrink-0 px-4 py-3" style={{ background: '#0b1826', borderTop: '1px solid #1b3149' }}>
        <div className="mb-2 flex items-center gap-3">
          <button onClick={() => { if (previewing) { stopRef.current = true; } else { preview(); } }} disabled={!ready || rec || exporting || busyAll} className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: previewing ? '#64748b' : GOLD, color: NAVY }}>{previewing ? '⏸ Dừng' : '▶ Chạy thử'}</button>
          <button onClick={() => (selObj ? splitObj(selObj) : toast.info('Chọn 1 object rồi Cắt'))} disabled={!selObj} className="rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40" style={{ background: '#1b3149', color: '#e2e8f0' }} title="Cắt clip object tại playhead (phím S không dùng — bấm nút)">✂ Cắt</button>
          <span className="font-mono text-xs text-slate-300">{playhead.toFixed(1)}s / {duration}s</span>
          <span className="text-[11px] text-slate-500">Kéo nền để tua · kéo clip để dời/co giãn</span>
          <div className="ml-auto flex items-center gap-1 text-xs">
            <button onClick={() => setTlZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} className="rounded px-2 py-0.5 font-bold text-slate-300">－</button>
            <span className="text-slate-400">{tlZoom}×</span>
            <button onClick={() => setTlZoom((z) => Math.min(6, +(z + 0.5).toFixed(1)))} className="rounded px-2 py-0.5 font-bold text-slate-300">＋</button>
          </div>
        </div>
        <div className="overflow-x-auto">
        <div ref={tlRef} onPointerDown={scrubStart} className="relative select-none" style={{ width: `${tlZoom * 100}%` }}>
          {scenes.length > 0 && (
            <div className="relative mb-1 h-5">
              {scenes.map((s, i) => { const st = sceneStart(i); const w = (s.dur / Math.max(1, duration)) * 100; return <button key={s.id} onPointerDown={(e) => { e.stopPropagation(); setPlayhead(+st.toFixed(1)); }} className="absolute inset-y-0 overflow-hidden whitespace-nowrap rounded px-1 text-left text-[9px] font-semibold text-white" style={{ left: `${(st / Math.max(1, duration)) * 100}%`, width: `${w}%`, background: i % 2 ? '#3b4b63' : '#2c3a4f', borderRight: '1px solid #0b1826' }} title={s.name}>{s.name}</button>; })}
            </div>
          )}
          {([['camera', 'Camera', '#475569'], ['route', 'Tuyến', '#ff5a2c'], ['text', 'Chữ', '#C8A14B'], ['chart', 'Biểu đồ', '#22c55e'], ['music', 'Nhạc', '#3b82f6']] as const).map(([tk, label, color]) => (
            <div key={tk} className="relative mb-1 h-7 rounded" style={{ background: '#0d2033' }}>
              <span className="pointer-events-none absolute left-2 top-1.5 z-10 text-[10px] font-semibold text-slate-400">{label}</span>
              {tk !== 'camera' && <button onClick={() => setTracksOn((t) => ({ ...t, [tk]: !(t as any)[tk] }))} className="absolute right-1 top-1 z-20 text-[11px]" title={(tracksOn as any)[tk] ? (tk === 'music' ? 'Tắt tiếng' : 'Ẩn') : 'Bật'}>{(tracksOn as any)[tk] ? (tk === 'music' ? '🔊' : '👁') : (tk === 'music' ? '🔇' : '🚫')}</button>}
              {tk === 'camera' ? (
                <div className="absolute inset-y-1 rounded" style={{ left: '0%', width: '100%', background: color, opacity: 0.5 }} />
              ) : (
                <div className="absolute inset-y-1 flex items-center justify-between rounded" style={{ left: `${((clips as any)[tk][0] / Math.max(1, duration)) * 100}%`, width: `${((clips as any)[tk][1] / Math.max(1, duration)) * 100}%`, background: color, opacity: (tracksOn as any)[tk] ? 1 : 0.3, cursor: 'grab', touchAction: 'none' }} onPointerDown={(e) => { e.stopPropagation(); beginDrag(tk as any, 'move', e); }}>
                  <div className="h-full w-2 shrink-0 rounded-l" style={{ cursor: 'ew-resize', background: 'rgba(0,0,0,.25)' }} onPointerDown={(e) => { e.stopPropagation(); beginDrag(tk as any, 'l', e); }} />
                  <div className="h-full w-2 shrink-0 rounded-r" style={{ cursor: 'ew-resize', background: 'rgba(0,0,0,.25)' }} onPointerDown={(e) => { e.stopPropagation(); beginDrag(tk as any, 'r', e); }} />
                </div>
              )}
            </div>
          ))}
          {objects.length > 0 && <div className="mb-1 mt-1 text-[10px] font-semibold text-slate-500">ĐỐI TƯỢNG (kéo/co · chọn rồi ✂ Cắt · Ctrl+C/V · Delete)</div>}
          {objects.map((o) => {
            const col = o.type === 'text' ? '#C8A14B' : o.type === 'image' ? '#8b5cf6' : '#06b6d4'; const sel = selObj === o.id; const total = Math.max(1, duration);
            return (
              <div key={o.id} className="relative mb-1 h-6 rounded" style={{ background: '#0d2033' }}>
                <span className="pointer-events-none absolute left-2 top-1 z-10 text-[10px] text-slate-400">{o.type === 'text' ? 'T ' + (o.text || '').slice(0, 12) : o.type === 'image' ? '🖼 Ảnh' : '🎬 Video'}</span>
                <div className="absolute inset-y-0.5 flex items-center justify-between rounded" style={{ left: `${(o.s / total) * 100}%`, width: `${((o.e - o.s) / total) * 100}%`, background: col, opacity: o.hidden ? 0.35 : 1, outline: sel ? '2px solid #fff' : 'none', cursor: 'grab', touchAction: 'none' }} onPointerDown={(e) => beginObjClipDrag(o, 'move', e)}>
                  <div className="h-full w-2 shrink-0 rounded-l" style={{ cursor: 'ew-resize', background: 'rgba(0,0,0,.25)' }} onPointerDown={(e) => { e.stopPropagation(); beginObjClipDrag(o, 'l', e); }} />
                  <div className="h-full w-2 shrink-0 rounded-r" style={{ cursor: 'ew-resize', background: 'rgba(0,0,0,.25)' }} onPointerDown={(e) => { e.stopPropagation(); beginObjClipDrag(o, 'r', e); }} />
                </div>
              </div>
            );
          })}
          <div className="pointer-events-none absolute top-0 z-20 w-[2px] bg-red-500" style={{ left: `${(playhead / Math.max(1, duration)) * 100}%`, height: '100%' }} />
        </div>
        </div>
      </div>

      {/* CONTEXT MENU chuột phải cho object */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
          <div className="fixed z-50 min-w-[150px] rounded-lg border bg-white py-1 text-sm shadow-xl" style={{ left: Math.min(ctxMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 170), top: ctxMenu.y, borderColor: '#e2e8f0' }}>
            {(() => { const o = objects.find((x) => x.id === ctxMenu.id); if (!o) return null; const close = () => setCtxMenu(null); const items: [string, () => void][] = [['⧉ Nhân bản', () => duplicateObj(o.id)], ['⬆ Đưa lên trên', () => moveObjZ(o.id, 1)], ['⬇ Đưa xuống dưới', () => moveObjZ(o.id, -1)], [o.locked ? '🔓 Mở khoá' : '🔒 Khoá', () => updateObj(o.id, { locked: !o.locked })], [o.hidden ? '👁 Hiện' : '🚫 Ẩn', () => updateObj(o.id, { hidden: !o.hidden })], ['🗑 Xoá', () => deleteObj(o.id)]]; return items.map(([label, fn], i) => <button key={i} onClick={() => { fn(); close(); }} className="block w-full px-3 py-1.5 text-left hover:bg-slate-100" style={{ color: label.includes('Xoá') ? '#dc2626' : NAVY }}>{label}</button>); })()}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LỚP CHẶN QUYỀN — chỉ ADMIN và tài khoản ĐÃ MUA GÓI TẠO VIDEO mới vào được.
//  Đặt bọc ngoài (không phải bên trong công cụ) để khi chưa có quyền thì công cụ
//  KHÔNG chạy chút nào: không dựng bản đồ, không tải ảnh vệ tinh → nhẹ máy khách.
// ═══════════════════════════════════════════════════════════════════════════════
const GOLD_G = '#C8A14B', NAVY_G = '#0A2540';

function Khoa({ ly_do }: { ly_do: 'chua-dang-nhap' | 'chua-mua' }) {
  const chuaDangNhap = ly_do === 'chua-dang-nhap';
  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-10">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="px-6 py-7 text-center" style={{ background: NAVY_G }}>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-3xl" style={{ background: 'rgba(200,161,75,.16)' }}>🎬</div>
          <h1 className="mt-4 text-xl font-extrabold text-white">Tạo video bản đồ</h1>
          <p className="mt-1 text-sm" style={{ color: GOLD_G }}>Tính năng dành riêng cho tài khoản trả phí</p>
        </div>
        <div className="px-6 py-6">
          <p className="text-[15px] leading-relaxed text-slate-700">
            {chuaDangNhap
              ? 'Bạn hãy đăng nhập để hệ thống kiểm tra gói dịch vụ của tài khoản mình nhé.'
              : 'Tài khoản của bạn hiện chưa có gói Tạo video bản đồ. Nâng cấp để biến mỗi mảnh đất thành một đoạn phim giới thiệu chuyên nghiệp — đăng Facebook, TikTok, Zalo đều hút khách hơn hẳn ảnh tĩnh.'}
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
            {['Khoanh lô, vẽ tuyến đường, bay camera trên ảnh vệ tinh',
              '6 kịch bản dựng sẵn: Vị trí · Hạ tầng · Tiện ích · Đầu tư · Bán hàng · Dẫn đường',
              'Chèn chữ, logo, nhạc nền · xuất MP4 1080p',
              'Xuất cả bộ 6 video một lần thành file ZIP'].map((t) => (
              <li key={t} className="flex items-start gap-2.5"><span className="mt-0.5 shrink-0 text-emerald-500">✓</span>{t}</li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            {chuaDangNhap ? (
              <a href="/login" className="flex-1 rounded-xl py-3 text-center font-bold text-white transition hover:opacity-90" style={{ background: NAVY_G }}>Đăng nhập</a>
            ) : (
              <a href="/dichvu" className="flex-1 rounded-xl py-3 text-center font-bold text-white transition hover:opacity-90" style={{ background: NAVY_G }}>Xem bảng giá &amp; nâng cấp</a>
            )}
            <a href="tel:0988888888" className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-100">Gọi tư vấn 0988 888 888</a>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">Đã thanh toán mà chưa vào được? Gọi admin để kích hoạt ngay trong ít phút.</p>
        </div>
      </div>
    </div>
  );
}

export default function MapVideoPage() {
  const { user, loading } = useAuth();
  const [conHan, setConHan] = useState<boolean | null>(null); // null = đang hỏi máy chủ

  useEffect(() => {
    if (loading) return;
    if (!user) { setConHan(false); return; }
    if (user.role === 'admin') { setConHan(true); return; }   // admin luôn dùng được
    let huy = false;
    api<{ current: { videoExpiresAt?: string | null } | null }>('/payments/my')
      .then((r) => { if (huy) return; const h = r?.current?.videoExpiresAt; setConHan(!!h && new Date(h).getTime() > Date.now()); })
      .catch(() => { if (!huy) setConHan(false); });
    return () => { huy = true; };
  }, [user, loading]);

  if (loading || conHan === null) {
    return <div className="grid min-h-[70vh] place-items-center text-sm text-slate-400">Đang kiểm tra tài khoản…</div>;
  }
  if (!user) return <Khoa ly_do="chua-dang-nhap" />;
  if (!conHan) return <Khoa ly_do="chua-mua" />;
  return <MapVideoTool />;
}


// ── ffmpeg.wasm: đổi WebM→MP4 (+ ghép nhạc) NGAY TRONG TRÌNH DUYỆT. Nạp 1 lần, lõi single-thread (không cần cấu hình đặc biệt). ──
let _ff: any = null;
let _prog: ((p: number) => void) | null = null;
async function getFF(): Promise<any> {
  if (_ff) return _ff;
  const ffMod: any = await import(/* webpackIgnore: true */ 'https://esm.sh/@ffmpeg/ffmpeg@0.12.10');
  const util: any = await import(/* webpackIgnore: true */ 'https://esm.sh/@ffmpeg/util@0.12.1');
  const ff = new ffMod.FFmpeg();
  ff.on('progress', (e: any) => { if (_prog) _prog(Math.max(0, Math.min(1, e?.progress || 0))); });
  const core = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ff.load({ coreURL: await util.toBlobURL(`${core}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await util.toBlobURL(`${core}/ffmpeg-core.wasm`, 'application/wasm') });
  _ff = { ff, util }; return _ff;
}
async function encodeMp4Browser(webm: Blob, audio: File | null, onProgress?: (p: number) => void): Promise<Blob> {
  const { ff, util } = await getFF();
  _prog = onProgress || null;
  await ff.writeFile('in.webm', await util.fetchFile(webm));
  let args: string[];
  if (audio) {
    await ff.writeFile('aud', await util.fetchFile(audio)); // nhận cả file NHẠC hoặc VIDEO (ffmpeg tự trích luồng tiếng)
    args = ['-i', 'in.webm', '-stream_loop', '-1', '-i', 'aud', '-map', '0:v:0', '-map', '1:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', 'out.mp4'];
  } else {
    // Không đưa nhạc riêng: nếu WebM đã có tiếng (trộn lúc quay) thì tự chuyển sang AAC; không có tiếng cũng không sao.
    args = ['-i', 'in.webm', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', 'out.mp4'];
  }
  await ff.exec(args);
  const data = await ff.readFile('out.mp4');
  try { await ff.deleteFile('in.webm'); await ff.deleteFile('out.mp4'); if (audio) await ff.deleteFile('aud'); } catch { /* ignore */ }
  _prog = null;
  return new Blob([(data as any).buffer ?? data], { type: 'video/mp4' });
}

// Phân tích chuỗi "Nhãn:giá trị, ..." → mảng dữ liệu biểu đồ.
function parseChart(raw: string): { label: string; value: number }[] {
  return (raw || '').split(',').map((s) => { const i = s.indexOf(':'); return { label: (i >= 0 ? s.slice(0, i) : s).trim(), value: Number((i >= 0 ? s.slice(i + 1) : '').trim()) || 0 }; }).filter((d) => d.label);
}
// Vẽ biểu đồ (cột/đường) chạy dần theo progress lên canvas — dùng cho cả video và ô xem trước.
function drawChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, data: { label: string; value: number }[], progress: number, title: string, type: 'bar' | 'line') {
  if (!data.length) return; const GOLD = '#C8A14B'; const s = h / 300; const f = (n: number) => Math.round(n * s);
  ctx.save();
  ctx.fillStyle = 'rgba(10,37,64,0.72)'; roundRect(ctx, x, y, w, h, f(14)); ctx.fill();
  ctx.fillStyle = GOLD; ctx.fillRect(x, y + f(14), f(6), h - f(28));
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `700 ${f(26)}px Arial, sans-serif`; ctx.fillText(title, x + f(22), y + f(40));
  const left = x + f(28), right = x + w - f(24), top = y + f(60), bottom = y + h - f(34);
  const maxV = Math.max(...data.map((d) => d.value), 1), n = data.length;
  const lab = (t: string, cx: number) => { ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.font = `${f(15)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(t, cx, bottom + f(20)); };
  if (type === 'bar') {
    const gap = (right - left) / n, bw = gap * 0.6;
    data.forEach((d, i) => { const bh = (bottom - top) * (d.value / maxV) * progress; const bx = left + i * gap + (gap - bw) / 2; ctx.fillStyle = GOLD; roundRect(ctx, bx, bottom - bh, bw, bh, f(4)); ctx.fill(); lab(d.label, bx + bw / 2); });
  } else {
    const pts = data.map((d, i) => [left + (right - left) * (i / (n - 1 || 1)), bottom - (bottom - top) * (d.value / maxV)] as [number, number]);
    const shown = Math.max(2, Math.floor(pts.length * progress) + 1);
    ctx.strokeStyle = GOLD; ctx.lineWidth = f(3); ctx.lineJoin = 'round'; ctx.beginPath();
    pts.slice(0, shown).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    data.forEach((d, i) => lab(d.label, pts[i][0]));
  }
  ctx.restore();
}

// Vẽ phụ đề (caption) giữa-dưới, có nền mờ để dễ đọc trên mọi nền.
function drawSub(ctx: CanvasRenderingContext2D, W: number, H: number, text: string) {
  if (!text) return; const k = Math.min(W, H) / 1080; const px = (n: number) => Math.round(n * k);
  ctx.save(); ctx.font = `600 ${px(40)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width; const padX = px(28), padY = px(14);
  const bw = Math.min(W - px(80), tw + padX * 2), bh = px(40) + padY * 2; const cx = W / 2, cy = H - px(300);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, px(10)); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(text, cx, cy); ctx.restore();
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Vẽ chữ + logo lên video theo MẪU BỐ CỤC chọn. Mọi kích thước nhân hệ số k=H/1080 để 720p vẫn cân đối.
function drawOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, layout: Layout, title: string, sub: string, logo: boolean, anim = 'fade', ap = 1) {
  const GOLD = '#C8A14B', NAVY = 'rgba(10,37,64,'; const k = Math.min(W, H) / 1080;
  const px = (n: number) => Math.round(n * k);
  const grad = (y0: number, y1: number, a: number) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, NAVY + '0)'); g.addColorStop(1, NAVY + a + ')'); return g; };
  const drawLogo = (x: number, y: number) => {
    if (!logo) return; ctx.textAlign = 'left'; ctx.font = `800 ${px(40)}px Arial, sans-serif`; const t = 'CAM LÂM LAND'; const w = ctx.measureText(t).width;
    ctx.fillStyle = NAVY + '0.75)'; roundRect(ctx, x, y, w + px(48), px(68), px(12)); ctx.fill(); ctx.fillStyle = GOLD; ctx.fillText(t, x + px(24), y + px(48));
  };
  const logoW = () => { ctx.font = `800 ${px(40)}px Arial, sans-serif`; return ctx.measureText('CAM LÂM LAND').width; };
  ctx.textBaseline = 'alphabetic';
  if (!title && !sub) { if (logo) drawLogo(W - logoW() - px(96), px(48)); ctx.textAlign = 'left'; return; } // chữ đang ẩn (ngoài clip) → chỉ logo
  // HIỆU ỨNG CHỮ XUẤT HIỆN
  const _ap = anim === 'none' ? 1 : Math.max(0, Math.min(1, ap));
  if (anim === 'typewriter' && title) title = title.slice(0, Math.max(1, Math.ceil(_ap * title.length)));
  ctx.save(); if (anim !== 'none') { ctx.globalAlpha = _ap; if (anim === 'slideUp') ctx.translate(0, (1 - _ap) * px(36)); }
  if (layout === 'bottomCenter') {
    ctx.fillStyle = grad(H - px(340), H, 0.82); ctx.fillRect(0, H - px(340), W, px(340));
    ctx.textAlign = 'center';
    if (title) { ctx.fillStyle = '#fff'; ctx.font = `700 ${px(70)}px Arial, sans-serif`; ctx.fillText(title, W / 2, H - px(120)); }
    if (sub) { ctx.fillStyle = GOLD; ctx.font = `600 ${px(42)}px Arial, sans-serif`; ctx.fillText(sub, W / 2, H - px(60)); }
    drawLogo(W / 2 - (logoW() + px(48)) / 2, px(48));
  } else if (layout === 'topLeft') {
    const g = ctx.createLinearGradient(0, 0, 0, px(300)); g.addColorStop(0, NAVY + '0.82)'); g.addColorStop(1, NAVY + '0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, px(300));
    ctx.textAlign = 'left';
    if (title) { ctx.fillStyle = '#fff'; ctx.font = `700 ${px(64)}px Arial, sans-serif`; ctx.fillText(title, px(70), px(110)); }
    if (sub) { ctx.fillStyle = GOLD; ctx.font = `600 ${px(40)}px Arial, sans-serif`; ctx.fillText(sub, px(70), px(168)); }
    drawLogo(W - logoW() - px(96), H - px(116));
  } else if (layout === 'card') {
    ctx.textAlign = 'left'; ctx.font = `700 ${px(60)}px Arial, sans-serif`; const tw = title ? ctx.measureText(title).width : 0; ctx.font = `600 ${px(40)}px Arial, sans-serif`; const sw = sub ? ctx.measureText(sub).width : 0;
    const cardW = Math.max(tw, sw) + px(80), cardH = (title ? px(78) : 0) + (sub ? px(56) : 0) + px(40); const cx = px(64), cy = H - cardH - px(64);
    ctx.fillStyle = NAVY + '0.78)'; roundRect(ctx, cx, cy, cardW, cardH, px(18)); ctx.fill(); ctx.fillStyle = GOLD; ctx.fillRect(cx, cy + px(18), px(8), cardH - px(36));
    let yy = cy + px(30);
    if (title) { yy += px(60); ctx.fillStyle = '#fff'; ctx.font = `700 ${px(60)}px Arial, sans-serif`; ctx.fillText(title, cx + px(30), yy); }
    if (sub) { yy += px(54); ctx.fillStyle = GOLD; ctx.font = `600 ${px(40)}px Arial, sans-serif`; ctx.fillText(sub, cx + px(30), yy); }
    drawLogo(W - logoW() - px(96), px(48));
  } else { // bottomLeft (mặc định)
    ctx.fillStyle = grad(H - px(320), H, 0.82); ctx.fillRect(0, H - px(320), W, px(320));
    ctx.textAlign = 'left';
    if (title) { ctx.fillStyle = '#fff'; ctx.font = `700 ${px(64)}px Arial, sans-serif`; ctx.fillText(title, px(70), H - px(130)); }
    if (sub) { ctx.fillStyle = GOLD; ctx.font = `600 ${px(40)}px Arial, sans-serif`; ctx.fillText(sub, px(70), H - px(70)); }
    drawLogo(W - logoW() - px(96), px(48));
  }
  ctx.restore();
  ctx.textAlign = 'left';
}
