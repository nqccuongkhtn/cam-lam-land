'use client';
import { useEffect, useState } from 'react';

/**
 * Ẩn/hiện thanh đầu trang theo HƯỚNG CUỘN (kiểu app): cuộn XUỐNG → ẩn, cuộn LÊN → hiện.
 * Gần đỉnh trang (< threshold) luôn hiện. Trả về true = nên ẩn.
 * Dùng chung cho Nav và thanh tìm kiếm/lọc để chúng trượt ĐỒNG BỘ, mượt.
 */
export function useHideOnScroll(threshold = 20): boolean {
  const [hidden, setHidden] = useState(false);
  // CHỈ ẩn trên mobile. Desktop (md+) luôn GIỮ NGUYÊN nav + thanh tìm kiếm khi cuộn.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  useEffect(() => {
    let last = typeof window !== 'undefined' ? window.scrollY : 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        // last CHỈ cập nhật khi đổi trạng thái → cuộn CHẬM vẫn tích luỹ đủ ngưỡng ở CẢ hai chiều (không cần trượt nhanh).
        if (y < threshold) { setHidden(false); last = y; }        // gần đỉnh → luôn hiện
        else if (y > last + 3) { setHidden(true); last = y; }      // cuộn xuống (dù chậm) → ẩn
        else if (y < last - 3) { setHidden(false); last = y; }     // cuộn lên → hiện
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  // Ẩn/hiện theo cuộn BÊN TRONG iframe của hub Tiện ích (trang cha không cuộn) — nghe tín hiệu từ HubShell.
  useEffect(() => {
    const onEmbed = (e: Event) => setHidden(!!(e as CustomEvent<{ hidden?: boolean }>).detail?.hidden);
    window.addEventListener('cl-embed-scroll', onEmbed as EventListener);
    return () => window.removeEventListener('cl-embed-scroll', onEmbed as EventListener);
  }, []);
  return hidden && isMobile; // desktop → luôn false (không ẩn)
}
