// Phân loại DỰ ÁN cho bộ lọc tab "Dự án" (trang chủ, điện thoại).
//
// ⚠️ Bảng featured_projects KHÔNG có cột loại dự án / nhóm trạng thái — chỉ có chữ tự do
//    (status, scale, name) do admin gõ. Nên ở đây SUY RA từ chữ. Admin thêm dự án mới
//    mà ghi chữ lạ thì dự án đó rơi vào "Khác" chứ không mất.
//    Lọc theo giá / diện tích cho dự án là KHÔNG làm được: dữ liệu dự án không có hai thứ đó.
export type DuAnGoiY = { id: number; name: string; status?: string | null; scale?: string | null; location?: string | null; imageUrl?: string | null };
// Bỏ dấu để so chữ: "Đất nền" → "dat nen". Tách dấu (NFD) rồi xoá → chữ gõ liền dấu hay tách dấu đều khớp.
const khongDau = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

// Loại dự án: một dự án có thể thuộc nhiều loại (vd "đất nền nghỉ dưỡng").
export const LOAI_DU_AN: { key: string; ten: string; khop: RegExp }[] = [
  { key: 'dat-nen', ten: 'Đất nền', khop: /dat nen|nen \d|so nen/ },
  { key: 'nghi-duong', ten: 'Nghỉ dưỡng', khop: /nghi duong|resort|biet thu|phong huong bien|khach san/ },
  { key: 'do-thi', ten: 'Khu đô thị', khop: /do thi|khu dan cu|trung tam huyen/ },
];
export const loaiCua = (p: DuAnGoiY) => {
  const chu = khongDau(`${p.name} ${p.scale || ''}`);
  return LOAI_DU_AN.filter((l) => l.khop.test(chu)).map((l) => l.key);
};

// Trạng thái gom về 3 nhóm dễ hiểu cho người mua (chữ gốc vẫn hiện nguyên trên thẻ dự án).
export const TRANG_THAI_DU_AN: { key: string; ten: string; khop: RegExp }[] = [
  { key: 'mo-ban', ten: 'Đang mở bán', khop: /mo ban/ },
  { key: 'hoat-dong', ten: 'Đang hoạt động', khop: /hoat dong|da trien khai|ban giao/ },
  { key: 'chuan-bi', ten: 'Đang chuẩn bị', khop: /boi thuong|tai dinh cu|quy hoach|cap nhat|sap/ },
];
export const trangThaiCua = (p: DuAnGoiY) => {
  const chu = khongDau(p.status || '');
  if (/sap/.test(chu)) return 'chuan-bi'; // "Sắp mở bán" chứa chữ "mở bán" nhưng CHƯA bán
  return TRANG_THAI_DU_AN.find((t) => t.khop.test(chu))?.key || '';
};
