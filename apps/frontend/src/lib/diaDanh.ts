// ============================================================================
// TRANG ĐỊA DANH /ban-do (13/10/2026) — dữ liệu + câu chữ dùng chung.
// Chủ dự án: "SEO theo địa danh học từ qhviet.com" — mỗi xã/phường MỚI, mỗi xã CŨ, mỗi huyện CŨ một trang, nối HAI CHIỀU
// cũ ↔ mới để người tìm theo tên trước sáp nhập ("xã Cam Hải Đông huyện Cam Lâm") lẫn sau sáp nhập ("xã Cam Lâm Khánh Hòa")
// đều vào đúng chỗ. qhviet giấu tên xã cũ trong khối chữ ẩn + mọi trang cùng một nội dung (Google coi là trang rác) — ở đây mỗi
// trang có nội dung riêng THẬT: xã cũ nào nhập vào đâu (Nghị quyết 1667), bảng đánh số lại tờ bản đồ, nút mở bản đồ đúng xã.
// Dữ liệu SINH TỰ ĐỘNG: node scripts/dia-chinh/dung-dia-danh.mjs → src/data/diaDanh.json (không có số thửa — thông tin nội bộ).
// ============================================================================
import data from '@/data/diaDanh.json';

export type Phan = 'toan-bo' | 'mot-phan';
export interface DongSoTo { toMoiTu: number; toMoiDen: number; toCuTu: number; toCuDen: number; soTo: number }
export interface HuyenCu { id: number; slug: string; loai: string; ten: string; tinhCu: string; xaCu: string[]; xaMoi: string[] }
export interface XaMoi {
  id: string; slug: string; loai: string; ten: string; donViGoc: string; huyenGoc: number; huyenCu: number[]; coQh: boolean; coBanDo: boolean;
  tam: number[] | null; bbox: number[] | null; nguyenVan: string; gomCungTen: { ten: string; phan: Phan } | null;
  gom: { xa: string; phan: Phan }[]; soTo: (DongSoTo & { xaCu: string; tenXaCu: string; giuSo: boolean })[];
}
export interface XaCu {
  id: string; slug: string; loai: string; ten: string; huyenId: number; laGoc: boolean; coQh: boolean; coBanDo: boolean;
  maBanDo: string; tam: number[] | null; vao: { id: string; phan: Phan; qua?: string }[]; soTo: (DongSoTo & { xaMoi: string })[];
}

export const DD = data as unknown as { canCu: string; duNq: boolean; huyenCu: HuyenCu[]; xaMoi: XaMoi[]; xaCu: XaCu[] };
export const HUYEN_THEO_ID = new Map(DD.huyenCu.map((h) => [h.id, h]));
export const XA_MOI_THEO_ID = new Map(DD.xaMoi.map((x) => [x.id, x]));
export const XA_CU_THEO_SLUG = new Map(DD.xaCu.map((x) => [x.slug, x]));

export type Trang = { kieu: 'moi'; x: XaMoi } | { kieu: 'cu'; x: XaCu } | { kieu: 'huyen'; x: HuyenCu };
const THEO_SLUG = new Map<string, Trang>([
  ...DD.xaMoi.map((x) => [x.slug, { kieu: 'moi', x }] as [string, Trang]),
  ...DD.xaCu.map((x) => [x.slug, { kieu: 'cu', x }] as [string, Trang]),
  ...DD.huyenCu.map((x) => [x.slug, { kieu: 'huyen', x }] as [string, Trang]),
]);
export const timTrang = (slug: string): Trang | null => THEO_SLUG.get(slug) || null;
export const TAT_CA_SLUG = [...THEO_SLUG.keys()];

// ── chữ ────────────────────────────────────────────────────────────────────
export const hoaDau = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** "Xã Cam Lâm" — tên đơn vị MỚI (đứng đầu câu hay giữa câu đều viết hoa, như văn bản). */
export const tenMoi = (x: XaMoi) => `${hoaDau(x.loai)} ${x.ten}`;
/** "xã Cam Hải Đông" — tên đơn vị CŨ (giữa câu viết thường chữ loại, như danh mục của Sở). */
export const tenCu = (x: XaCu) => `${x.loai} ${x.ten}`;
export const tenHuyen = (h: HuyenCu) => `${h.loai} ${h.ten}`;
/** "A, B và C" */
export function noiDs(ds: string[]): string {
  if (ds.length <= 1) return ds[0] || '';
  return `${ds.slice(0, -1).join(', ')} và ${ds[ds.length - 1]}`;
}
export const khoangTo = (tu: number, den: number) => (tu === den ? `tờ ${tu}` : `tờ ${tu}–${den}`);
export const urlBanDo = (ma: string) => `/map?xa=${encodeURIComponent(ma)}`;

export const xaCuCua = (m: XaMoi) => m.gom.map((g) => ({ x: XA_CU_THEO_SLUG.get(g.xa)!, phan: g.phan })).filter((g) => g.x);
export const huyenCuaXaCu = (c: XaCu) => HUYEN_THEO_ID.get(c.huyenId) || null;
export const xaMoiCuaHuyen = (h: HuyenCu) => h.xaMoi.map((id) => XA_MOI_THEO_ID.get(id)!).filter(Boolean);
export const xaCuCuaHuyen = (h: HuyenCu) => h.xaCu.map((s) => XA_CU_THEO_SLUG.get(s)!).filter(Boolean);

/** Các xã MỚI có chung huyện cũ — làm mục "cùng khu vực" (liên kết hiện rõ, không giấu như qhviet). */
export function xaMoiCungKhuVuc(m: XaMoi): XaMoi[] {
  const ids = new Set<string>();
  for (const hid of m.huyenCu) for (const id of HUYEN_THEO_ID.get(hid)?.xaMoi || []) if (id !== m.id) ids.add(id);
  return [...ids].map((id) => XA_MOI_THEO_ID.get(id)!).filter(Boolean).sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
}

/** Huyện cũ (để nhóm 65 xã mới ở trang tổng): huyện của ĐƠN VỊ GỐC — xã mới kế thừa mã của đơn vị gốc. */
export const huyenGocCua = (m: XaMoi): HuyenCu | null => HUYEN_THEO_ID.get(m.huyenGoc) || null;

export const QH_CAN_CU = 'Quy hoạch chung đô thị mới Cam Lâm đến năm 2045 (Quyết định 205/QĐ-TTg ngày 28/02/2024 của Thủ tướng Chính phủ), '
  + 'Điều chỉnh quy hoạch sử dụng đất đến năm 2030 huyện Cam Lâm (Quyết định 893/QĐ-UBND của UBND tỉnh Khánh Hòa) '
  + 'và các quy hoạch phân khu tỷ lệ 1/2000 của đô thị mới Cam Lâm ở những nơi đã có';
