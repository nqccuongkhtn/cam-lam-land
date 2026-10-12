// CHỈ ĐƯỜNG NHIỀU TUYẾN — phần gọi máy chủ + mấy hàm hiển thị cho đẹp.
// Máy chủ trả về tối đa 3 phương án đi (giống Google Maps), đã dịch sẵn lời dẫn sang tiếng Việt.
import { api } from './api';
import { xinViTri } from './viTri';

export type PhuongTien = 'car' | 'motorbike' | 'bike' | 'foot';

export interface Chang {
  loiDan: string;        // "Rẽ sang phải vào Quốc lộ 1A"
  duong: string;         // tên đường (có thể rỗng ở đường nhỏ chưa đặt tên)
  khoangCach: number;    // mét
  thoiGian: number;      // giây
  diem: [number, number] | null; // nơi phải rẽ (lng, lat)
}
export interface Tuyen {
  id: number;
  nhan: string;          // "Nhanh nhất" / "Ngắn nhất" / "Tuyến khác"
  tomTat: string;        // "Quốc lộ 1A và Nguyễn Tất Thành"
  khoangCach: number;    // mét
  thoiGian: number;      // giây
  hinh: GeoJSON.LineString;
  chang: Chang[];
}
export interface KetQuaChiDuong { mode: string; nguon: string; tuyen: Tuyen[] }

const PT_NHAN: Record<PhuongTien, string> = { car: 'Ô tô', motorbike: 'Xe máy', bike: 'Xe đạp', foot: 'Đi bộ' };
export const tenPhuongTien = (p: PhuongTien) => PT_NHAN[p] || 'Ô tô';

/** Hỏi máy chủ các phương án đi từ A tới B. Trả về danh sách tuyến (nhanh nhất đứng đầu). */
export async function timDuong(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  mode: PhuongTien = 'car',
  qua: { lng: number; lat: number }[] = [],
): Promise<KetQuaChiDuong> {
  const q = new URLSearchParams({ from: `${from.lng},${from.lat}`, to: `${to.lng},${to.lat}`, mode });
  if (qua.length) q.set('qua', qua.map((p) => `${p.lng},${p.lat}`).join(';'));
  return api<KetQuaChiDuong>(`/chi-duong?${q.toString()}`);
}

/** 4520 giây → "1 giờ 15 phút"; 90 giây → "2 phút" (làm tròn lên cho khỏi hụt). */
export function docThoiGian(giay: number): string {
  const phut = Math.max(1, Math.round(giay / 60));
  if (phut < 60) return `${phut} phút`;
  const gio = Math.floor(phut / 60), du = phut % 60;
  return du ? `${gio} giờ ${du} phút` : `${gio} giờ`;
}

/** 850 → "850 m"; 12345 → "12,3 km". */
export function docKhoangCach(met: number): string {
  if (met < 1000) return `${Math.round(met)} m`;
  const km = met / 1000;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

/** Giờ tới nơi ước tính: "tới lúc 15:42" — Google có dòng này, người dùng rất thích. */
export function gioToiNoi(giay: number): string {
  const t = new Date(Date.now() + giay * 1000);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** Khung bao quanh 1 tuyến để bản đồ zoom vừa khít. */
export function khungTuyen(t: Tuyen): [[number, number], [number, number]] {
  let w = 180, s = 90, e = -180, n = -90;
  for (const [lng, lat] of t.hinh.coordinates as [number, number][]) {
    if (lng < w) w = lng; if (lng > e) e = lng;
    if (lat < s) s = lat; if (lat > n) n = lat;
  }
  return [[w, s], [e, n]];
}

/** Điểm giữa tuyến (theo độ dài) — dùng đặt nhãn "15 phút" trên tuyến như Google. */
export function diemGiua(t: Tuyen): [number, number] {
  const c = t.hinh.coordinates as [number, number][];
  if (!c.length) return [0, 0];
  let tong = 0;
  const d = (a: number[], b: number[]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let i = 1; i < c.length; i++) tong += d(c[i - 1], c[i]);
  let di = 0;
  for (let i = 1; i < c.length; i++) {
    di += d(c[i - 1], c[i]);
    if (di >= tong / 2) return c[i];
  }
  return c[Math.floor(c.length / 2)];
}

/** Xin vị trí hiện tại của người dùng (dùng cho "Vị trí của tôi").
 *  Đi qua lib/viTri.ts: vừa lấy trong 10 phút thì dùng lại, không để iPhone hỏi thêm lần nữa. */
export function viTriCuaToi(): Promise<{ lng: number; lat: number }> {
  return xinViTri();
}
