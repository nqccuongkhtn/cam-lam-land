'use client';
// Kéo-để-tải-lại kiểu app: ở đỉnh trang, kéo xuống > ngưỡng rồi thả → gọi onRefresh.
// (body đã có overscroll-behavior:none nên không đụng pull-to-refresh mặc định của trình duyệt.)
import { useEffect, useState } from 'react';

export function usePullToRefresh(onRefresh: () => void, enabled = true) {
  const [pull, setPull] = useState(0);          // px đã kéo (đã giảm tốc)
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const TH = 68; let startY = 0; let pulling = false;
    const onStart = (e: TouchEvent) => { pulling = window.scrollY <= 0 && !refreshing; startY = e.touches[0].clientY; };
    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && window.scrollY <= 0) setPull(Math.min(dy * 0.5, 90));
      else { pulling = false; setPull(0); }
    };
    const onEnd = () => {
      if (!pulling) return; pulling = false;
      setPull((p) => {
        if (p >= TH) { setRefreshing(true); try { onRefresh(); } catch { /* */ } setTimeout(() => setRefreshing(false), 700); }
        return 0;
      });
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd); };
  }, [enabled, refreshing, onRefresh]);
  return { pull, refreshing };
}
