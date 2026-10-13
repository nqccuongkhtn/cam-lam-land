'use client';
import { useEffect } from 'react';

/* TRANG CÓ THANH DƯỚI ĐÁY RIÊNG (vd Tra cứu luật: Tình huống / Toàn văn / Thẻ ôn / Sơ đồ / Danh mục).
   Web cũng có thanh menu dưới đáy (components/BottomNav.tsx) → mở trong Tiện ích là HAI THANH chồng nhau, ăn ~110px màn hình
   điện thoại; mở thẳng trang thì thanh của web đè kín thanh của trang (chủ dự án khoanh ảnh 13/10/2026). Đã thử đưa thanh của
   trang lên đầu trang → chủ dự án chê "không đẹp", muốn để dưới. Nên: trang nào gọi hook này thì thanh menu của web NHƯỜNG CHỖ
   (trượt xuống ẩn) suốt lúc trang đó mở, đáy màn hình chỉ còn thanh của trang.
   • Mở thẳng trang: ghi dấu lên <html> + báo sự kiện trên chính cửa sổ này (BottomNav đọc dấu lúc mới gắn, nghe sự kiện về sau
     — trang có thể gắn TRƯỚC BottomNav nên không được chỉ dựa vào sự kiện).
   • Mở trong khung Tiện ích (iframe cùng tên miền): báo ra trang mẹ bằng postMessage. HubShell tự xoá dấu mỗi lần đổi công
     cụ / tải lại khung, nên khung có bị gỡ đột ngột (không kịp báo) thì thanh menu web vẫn hiện lại đúng.
   `bat` = trang đang THẬT SỰ vẽ thanh của nó (vd chưa có quyền xem thì không có thanh → không bắt web nhường). */
export const SU_KIEN_THANH_RIENG = 'cl-thanh-duoi-rieng';
export const SU_KIEN_MO_MENU_WEB = 'cl-mo-menu-web';

/** Nút mở menu chính trên thanh riêng của trang — trang Luật dùng Ô ☰ HẸP ở cuối thanh (chủ dự án chọn 13/10/2026; trước đó
 *  hỏi: menu web nhường chỗ rồi thì đi Trang chủ / Nhà đất / Bản đồ / Tiện ích bằng gì?) → gọi thanh menu web TRỒI LÊN TẠM,
 *  đè lên thanh của trang; chạm ra ngoài là trượt xuống lại.
 *  Báo cả cửa sổ này (mở thẳng trang) lẫn trang mẹ (trong khung Tiện ích) — bên nào có thanh menu đang hiện thì bên đó nhận. */
export function moMenuWeb() {
  window.dispatchEvent(new CustomEvent(SU_KIEN_MO_MENU_WEB));
  if (window.parent !== window) {
    try { window.parent.postMessage({ loai: SU_KIEN_MO_MENU_WEB }, window.location.origin); } catch { /* */ }
  }
}

export function useThanhDuoiRieng(bat = true) {
  useEffect(() => {
    if (!bat) return;
    const html = document.documentElement;
    const bao = (on: boolean) => {
      if (on) html.setAttribute('data-thanh-duoi-rieng', ''); else html.removeAttribute('data-thanh-duoi-rieng');
      window.dispatchEvent(new CustomEvent(SU_KIEN_THANH_RIENG, { detail: { on } }));
      if (window.parent !== window) {
        try { window.parent.postMessage({ loai: SU_KIEN_THANH_RIENG, on }, window.location.origin); } catch { /* */ }
      }
    };
    const hien = () => bao(true);
    const roi = () => bao(false);
    hien();
    window.addEventListener('pageshow', hien);   // quay lại trang từ bộ nhớ trình duyệt (nút Back) → nhường lại
    window.addEventListener('pagehide', roi);    // rời trang / khung chuyển trang khác → trả lại thanh menu web
    return () => { window.removeEventListener('pageshow', hien); window.removeEventListener('pagehide', roi); roi(); };
  }, [bat]);
}
