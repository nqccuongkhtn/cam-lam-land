'use client';
import { choBanDoYen } from './settle';

/**
 * ══ ĐI CHỢ TRƯỚC CẢ ĐƯỜNG BAY, RỒI MỚI CHO MÁY QUAY LĂN BÁNH ══
 *
 * Nguyên tắc của mọi phần mềm dựng phim: lúc đang quay thì TUYỆT ĐỐI không chờ mạng.
 * Muốn vậy phải biết trước camera sẽ đi qua những đâu — mà cái đó thì biết được, vì đường bay
 * đã tính sẵn thành bảng trước khi chạy.
 *
 * Cách làm: chia đường bay thành một loạt mốc, ghé camera qua từng mốc, chờ bản đồ tải xong
 * chỗ đó rồi đi tiếp. Ảnh nào ghé qua cũng nằm lại trong máy — kể cả ảnh độ cao dùng để dựng núi,
 * vì chúng cũng đi qua đúng đường tải đó. Xong vòng này thì lúc quay thật gần như không phải chờ.
 *
 * Vì sao chỉ chừng 60 mốc: mỗi mốc phủ cả một khung hình rộng, nên các mốc chồng lấn nhau rất
 * nhiều. Lấy dày hơn chỉ tốn thời gian mà không thêm được bao nhiêu ảnh mới.
 */
export async function nayAnhDocDuongBay(
  map: any,
  datCamera: (giay: number) => void,
  thoiLuong: number,
  bao?: (phanTram: number, chu: string) => void,
  dungLai?: () => boolean,
): Promise<void> {
  const soMoc = Math.min(60, Math.max(8, Math.round(thoiLuong * 2)));
  for (let i = 0; i <= soMoc; i++) {
    if (dungLai?.()) return;                 // người dùng bấm Dừng thì bỏ ngang
    try { datCamera((i / soMoc) * thoiLuong); } catch { /* mốc nào hỏng thì bỏ qua mốc đó */ }
    await choBanDoYen(map, 800);
    const pt = Math.round((i / soMoc) * 100);
    bao?.(pt, `Đang tải sẵn bản đồ cả đường bay… ${pt}%`);
  }
}
