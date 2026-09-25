'use client';
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'pwa_install_dismissed';

/** Banner "Cài đặt ứng dụng" (PWA) — kiểu các web lớn:
 *  - Android/Chrome/Edge: bắt sự kiện beforeinstallprompt -> nút "Cài đặt" gọi hộp thoại native.
 *  - iOS/Safari (không cho cài tự động): hiện hướng dẫn Chia sẻ -> Thêm vào Màn hình chính.
 *  Có nút tắt, nhớ 7 ngày; ẩn khi đã cài (chạy standalone).
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    try {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      if (standalone) return; // đã cài rồi
      const d = localStorage.getItem(DISMISS_KEY);
      if (d && Date.now() - Number(d) < 7 * 86400000) return; // đã tắt trong 7 ngày

      const ua = navigator.userAgent || '';
      const isIos = /iphone|ipad|ipod/i.test(ua);
      const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|android/i.test(ua);
      if (isIos) {
        if (isSafari) { const t = setTimeout(() => { setIos(true); setShow(true); }, 2500); return () => clearTimeout(t); }
        return;
      }
      const onBip = (e: any) => { e.preventDefault(); setDeferred(e); setShow(true); };
      const onInstalled = () => { setShow(false); }; // KHÔNG ghi "đã tắt" khi cài → gỡ app xong quay lại trình duyệt sẽ HIỆN LẠI gợi ý
      window.addEventListener('beforeinstallprompt', onBip);
      window.addEventListener('appinstalled', onInstalled);
      return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('appinstalled', onInstalled); };
    } catch { /* ignore */ }
  }, []);

  async function install() {
    if (!deferred) return;
    try { deferred.prompt(); await deferred.userChoice; } catch { /* ignore */ }
    setDeferred(null); setShow(false);
  }
  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
  }

  if (!show) return null;

  return (
    <div className="cl-install-cta fixed inset-x-0 bottom-0 z-[75] px-3 pointer-events-none" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
      <div className="mx-auto max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 flex items-center gap-3 pointer-events-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="Cam Lâm Land" className="w-12 h-12 rounded-xl shrink-0 border border-slate-200 object-cover" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#0B4045] text-sm leading-tight">Cài Cam Lâm Land vào máy</p>
          {ios ? (
            <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
              Bấm <b className="text-[#0B4045]">Chia sẻ</b>
              <svg viewBox="0 0 24 24" className="inline w-3.5 h-3.5 mx-0.5 -mt-0.5" fill="none" stroke="#0B4045" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M8 7l4-4 4 4" /><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" /></svg>
              ở dưới → chọn <b className="text-[#0B4045]">“Thêm vào MH chính”</b>
            </p>
          ) : (
            <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">Mở nhanh như app, chạy toàn màn hình, không cần trình duyệt.</p>
          )}
        </div>
        {ios ? (
          <button onClick={dismiss} className="shrink-0 text-emerald-600 hover:text-emerald-700 text-sm font-bold px-2">OK</button>
        ) : (
          <button onClick={install} className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-sm shadow-red-600/30">Cài đặt</button>
        )}
        <button onClick={dismiss} aria-label="Đóng" className="shrink-0 w-7 h-7 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100 text-base leading-none">✕</button>
      </div>
    </div>
  );
}
