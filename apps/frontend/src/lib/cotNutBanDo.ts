'use client';
/* ============================================================================
 *  CỘT NÚT PHỤ BÊN PHẢI BẢN ĐỒ (nút đổi nền tròn + thanh độ mờ) — TỰ NỐI NGAY DƯỚI
 *  CỤM NÚT CỦA MAPLIBRE (+ / − / định vị)
 * ----------------------------------------------------------------------------
 *  Dùng chung cho trang Bản đồ (app/map) và bản đồ trang Nhà đất (app/listings).
 *
 *  ⚠️ VÌ SAO KHÔNG ĐẶT SỐ CỨNG (đã hỏng 3 lần):
 *   · cụm nút maplibre đổi chiều cao theo máy: nút 29px trên máy tính, 42px trên máy cảm ứng;
 *   · nút ĐỊNH VỊ bị thư viện tự ẩn khi trình duyệt không cho lấy vị trí (trang không phải https…),
 *     nên cụm nút lúc có lúc không có nút đó → cao thấp khác nhau cả chục điểm ảnh;
 *   · có trang có nút "?" đẩy cụm nút xuống, có trang không.
 *   Số cứng 121px, rồi biến --cot-nut-day, đều lệch ở một trường hợp nào đó → cột bị hở một khúc
 *   hoặc đè lên nút định vị (chủ dự án chụp màn hình báo 14/9, 17/9, 28/9/2026).
 *  Nay: ĐO THẲNG đáy cụm nút thật, đo lại mỗi khi cụm nút đổi kích thước.
 *  Trả về null khi chưa đo được → nơi dùng giữ vị trí dự phòng (biến --cot-nut-day).
 *
 *  Trang Nhà đất chỉ dựng bản đồ khi khách bấm "Bản đồ" (có khi rất lâu sau khi mở trang),
 *  và tắt/bật lại là dựng bản đồ MỚI → cứ ~0,7 giây dò xem cột/cụm nút có đổi không, đổi thì
 *  gắn lại bộ đo. Việc dò chỉ là vài phép so sánh, không tốn gì.
 * ========================================================================== */
import { useEffect, useState, type RefObject } from 'react';

const KHE = 10; // cách cụm nút maplibre 10px — đúng khoảng cách giữa các nhóm nút của chính maplibre

export function useDayCotNutBanDo(ref: RefObject<HTMLElement>): number | null {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    let dangTheo: HTMLElement | null = null; // cụm nút maplibre đang được đo
    const doVaGan = () => {
      const el = ref.current;
      const goc = (el?.offsetParent as HTMLElement | null) || el?.parentElement || null;
      const cum = (goc?.querySelector('.maplibregl-ctrl-top-right') as HTMLElement | null) || null;
      if (cum === dangTheo) return;            // không đổi gì → thôi
      ro?.disconnect(); ro = null; dangTheo = cum;
      if (!el || !goc || !cum) { setTop(null); return; }
      const tinh = () => {
        // Bỏ qua nhóm nút đang ẨN hoặc RỖNG (nhóm định vị còn cái vỏ cao ~1px khi nút bị thư viện ẩn).
        const nhom = (Array.from(cum.children) as HTMLElement[]).filter((c) => c.getBoundingClientRect().height > 4);
        if (!nhom.length) return;
        const day = Math.max(...nhom.map((c) => c.getBoundingClientRect().bottom));
        setTop(Math.round(day - goc.getBoundingClientRect().top + KHE));
      };
      tinh();
      ro = new ResizeObserver(tinh);
      ro.observe(cum);
      Array.from(cum.children).forEach((c) => ro!.observe(c));
    };
    doVaGan();
    const hen = setInterval(doVaGan, 700);
    return () => { clearInterval(hen); ro?.disconnect(); };
  }, [ref]);
  return top;
}
