'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Quy tắc chung: mở trang mới hay tải lại đều đưa về ĐẦU TRANG.
export default function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
