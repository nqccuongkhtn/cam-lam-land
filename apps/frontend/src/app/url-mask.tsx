'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Luôn giữ thanh địa chỉ ở URL gốc "/" (nội dung trang vẫn đổi bình thường). */
export default function UrlMask() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname !== '/' || window.location.search) {
      window.history.replaceState(null, '', '/');
    }
  }, [pathname]);
  return null;
}
