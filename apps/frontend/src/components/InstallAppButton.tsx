'use client';
import { useEffect, useState } from 'react';

/** Nút "Cài ứng dụng" (PWA) dùng lại cơ chế của web:
 *  - Android/Chrome/Edge: bắt beforeinstallprompt -> bấm gọi hộp thoại cài native.
 *  - iOS/Safari: không cho cài tự động -> hiện hướng dẫn Chia sẻ -> Thêm vào MH chính.
 *  - Đã cài (standalone) -> báo đã cài.
 */
export default function InstallAppButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    try {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      if (standalone) { setInstalled(true); return; }
    } catch { /* ignore */ }
    const onBip = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  async function onClick() {
    if (installed) { alert('Ứng dụng Cam Lâm Land đã được cài trên thiết bị của bạn.'); return; }
    if (deferred) {
      try { deferred.prompt(); await deferred.userChoice; } catch { /* ignore */ }
      setDeferred(null);
      return;
    }
    const ua = navigator.userAgent || '';
    if (/iphone|ipad|ipod/i.test(ua)) {
      alert('Cài trên iPhone/iPad:\n1) Bấm nút Chia sẻ ⬆️ ở thanh Safari\n2) Chọn "Thêm vào MH chính"\n→ Cam Lâm Land sẽ hiện như một app.');
    } else {
      alert('Cài ứng dụng:\nMở trang bằng Chrome trên điện thoại → menu ⋮ → "Cài đặt ứng dụng" (hoặc "Thêm vào MH chính") để thêm Cam Lâm Land vào máy.');
    }
  }

  if (installed) return null; // ĐÃ CÀI PWA (chạy standalone) → KHÔNG hiện gợi ý cài nữa

  return (
    <button type="button" onClick={onClick} aria-label="Cài ứng dụng Cam Lâm Land" className={`cl-install-cta ${className || ''}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 shrink-0"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M12 7v7M9 11.5l3 3 3-3" /></svg>
      <span className="text-[11px] leading-tight text-left">Cài ứng dụng<br /><b className="text-white text-xs">Cam Lâm Land</b></span>
    </button>
  );
}
