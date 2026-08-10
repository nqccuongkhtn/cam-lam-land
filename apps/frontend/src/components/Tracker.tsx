'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

// ID khách ẩn danh (không chứa thông tin cá nhân) để đếm "đang xem" / khách duy nhất.
function getVid(): string {
  try {
    let v = localStorage.getItem('camlam_vid');
    if (!v) {
      v = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem('camlam_vid', v);
    }
    return v;
  } catch { return 'anon'; }
}

// ID phiên: lưu trong sessionStorage → tự xoá khi đóng hẳn web/tab. Mở lại = phiên mới = +1 lượt.
function getSess(): string {
  try {
    let s = sessionStorage.getItem('camlam_sess');
    if (!s) {
      s = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
      sessionStorage.setItem('camlam_sess', s);
    }
    return s;
  } catch { return getVid(); }
}

/** Ghi nhận 1 lượt xem mỗi khi khách đổi trang (trừ trang /admin). */
export default function Tracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    const t = setTimeout(() => {
      api('/track', { method: 'POST', body: JSON.stringify({ path: pathname, vid: getVid(), sess: getSess(), ref: document.referrer || '' }) }).catch(() => {});
    }, 400); // chờ chút để tránh đếm khi chuyển trang nhanh
    return () => clearTimeout(t);
  }, [pathname]);
  return null;
}
