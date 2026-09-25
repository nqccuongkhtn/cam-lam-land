'use client';
import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    /* Bản mới: service worker báo 'ban-moi' khi trang vừa hiện là bản cũ đã lưu mà
       mạng đã có bản mới → tải lại MỘT lần (chặn lặp bằng sessionStorage). */
    const nghe = (ev: MessageEvent) => {
      if (ev.data?.loai !== 'ban-moi') return;
      try { if (sessionStorage.getItem('cl-da-tai-lai')) return; sessionStorage.setItem('cl-da-tai-lai', '1'); } catch {}
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('message', nghe);
    try { setTimeout(() => sessionStorage.removeItem('cl-da-tai-lai'), 15000); } catch {}
    // updateViaCache 'none': luôn hỏi mạng xem sw.js có đổi không (đừng để trình duyệt giữ bản cũ)
    const reg = () => navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((r) => { document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update().catch(() => {}); }); })
      .catch(() => {});
    if (document.readyState === 'complete') reg();
    else { window.addEventListener('load', reg, { once: true }); }
    return () => navigator.serviceWorker.removeEventListener('message', nghe);
  }, []);
  return null;
}
