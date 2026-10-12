'use client';
/* ============================================================================
 *  XIN VỊ TRÍ CỦA NGƯỜI DÙNG — MỘT CHỖ DÙNG CHUNG CHO CẢ WEB
 * ----------------------------------------------------------------------------
 *  Chủ dự án (12/10/2026, ảnh chụp iPhone): hộp "…muốn sử dụng vị trí của bạn — Từ chối / Cho phép"
 *  hiện đi hiện lại — "hỏi 1 lần thôi". Hộp đó do IPHONE hiện mỗi lần web xin vị trí, web không tắt
 *  được; nhưng web có thể KHÔNG XIN khi chưa cần:
 *    · nhớ vị trí vừa lấy 10 phút (lưu trong máy) — chỗ khác cần vị trí (chỉ đường, gửi vị trí trong
 *      chat…) dùng lại luôn, không xin thêm lần nữa;
 *    · người dùng đã bấm "Từ chối" thì web KHÔNG TỰ xin lại — chỉ xin khi chính họ bấm nút "Vị trí
 *      của tôi".
 *  Nút định vị trên bản đồ (MapView) cũng ghi vào đây mỗi khi lấy được vị trí / bị từ chối.
 *  Mọi đọc/ghi bộ nhớ máy đều bọc try — trình duyệt chặn bộ nhớ thì vẫn chạy, chỉ là không nhớ.
 * ========================================================================== */
import { toast } from './toast';

export type ViTri = { lng: number; lat: number; luc: number };

const KHOA_VI_TRI = 'cl-vi-tri-cuoi';
const KHOA_QUYEN = 'cl-vi-tri-quyen';          // 'cho' | 'tu-choi'
const KHOA_DA_NHAC = 'cl-vi-tri-da-nhac';      // đã hiện lời nhắc cách để iPhone khỏi hỏi lại
const NHO_MS = 10 * 60 * 1000;
let viTriCuoi: ViTri | null = null;

/* Chủ dự án muốn "lần đầu hỏi chỉ dùng lần này hay luôn luôn dùng như các ứng dụng khác". Hộp có lựa chọn
   "luôn luôn" là của riêng ỨNG DỤNG cài từ App Store; với TRANG WEB, iPhone chỉ cho "Từ chối / Cho phép" và web
   không tự đặt được "luôn cho phép". Việc web làm được: lần ĐẦU người dùng cho phép trên iPhone thì chỉ MỘT LẦN
   cách tự đặt iPhone luôn cho phép (giữ 12 giây cho kịp đọc), sau đó không nhắc nữa. */
function nhacCachKhoiHoiLai(): void {
  try {
    if (!/iPhone|iPad|iPod/.test(navigator.userAgent) || localStorage.getItem(KHOA_DA_NHAC)) return;
    localStorage.setItem(KHOA_DA_NHAC, '1');
  } catch { return; }
  toast.info('Muốn iPhone khỏi hỏi lại mỗi lần: vào Cài đặt → Ứng dụng → Safari → Vị trí → chọn Cho phép.', 'Đã bật vị trí', 12000);
}

/** Ghi lại vị trí vừa lấy được (và coi như người dùng đã cho phép). */
export function nhoViTri(lng: number, lat: number): void {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
  viTriCuoi = { lng, lat, luc: Date.now() };
  let lanDauChoPhep = false;
  try {
    lanDauChoPhep = localStorage.getItem(KHOA_QUYEN) !== 'cho';
    localStorage.setItem(KHOA_VI_TRI, JSON.stringify(viTriCuoi));
    localStorage.setItem(KHOA_QUYEN, 'cho');
  } catch { /* bỏ qua */ }
  if (lanDauChoPhep) nhacCachKhoiHoiLai();
}

/** Ghi lại là người dùng đã bấm "Từ chối". */
export function ghiTuChoiViTri(): void {
  try { localStorage.setItem(KHOA_QUYEN, 'tu-choi'); } catch { /* bỏ qua */ }
}

/** Người dùng đã từng bấm "Từ chối" (và chưa cho phép lại lần nào). */
export function daTuChoiViTri(): boolean {
  try { return localStorage.getItem(KHOA_QUYEN) === 'tu-choi'; } catch { return false; }
}

/** Vị trí lấy trong 10 phút gần đây (không có thì null). */
export function viTriGanDay(): ViTri | null {
  let v = viTriCuoi;
  if (!v) {
    try {
      const j = JSON.parse(localStorage.getItem(KHOA_VI_TRI) || 'null');
      if (j && Number.isFinite(j.lng) && Number.isFinite(j.lat) && Number.isFinite(j.luc)) v = viTriCuoi = j;
    } catch { /* bỏ qua */ }
  }
  return v && Date.now() - v.luc < NHO_MS ? v : null;
}

/** Lấy vị trí hiện tại. Có vị trí vừa lấy (< 10 phút) thì dùng luôn — KHÔNG để iPhone hỏi thêm lần nữa. */
export function xinViTri(): Promise<{ lng: number; lat: number }> {
  const v = viTriGanDay();
  if (v) return Promise.resolve({ lng: v.lng, lat: v.lat });
  return new Promise((ok, loi) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return loi(new Error('Máy không hỗ trợ định vị'));
    navigator.geolocation.getCurrentPosition(
      (p) => { nhoViTri(p.coords.longitude, p.coords.latitude); ok({ lng: p.coords.longitude, lat: p.coords.latitude }); },
      (e) => {
        if (e && e.code === 1) { ghiTuChoiViTri(); loi(new Error('Chưa cho phép lấy vị trí. Hãy bật định vị cho trang web này.')); }
        else loi(new Error('Không lấy được vị trí. Thử lại sau.'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}
