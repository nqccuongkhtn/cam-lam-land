'use client';
import { useEffect } from 'react';

/**
 * Màn hình chờ (splash) khi MỞ APP đã cài (standalone).
 * Điểm mấu chốt: markup được render sẵn trong HTML đầu tiên, và việc HIỆN/ẨN do CSS
 * quyết định (@media display-mode: standalone) — nên splash phủ ngay từ khung hình ĐẦU TIÊN,
 * KHÔNG chờ JS chạy (tránh lỗi "thấy trang chủ trước rồi splash mới hiện").
 * JS ở đây chỉ lo việc TỰ TẮT (mờ dần rồi ẩn) sau ~1,5s.
 */
export default function AppSplash() {
  useEffect(() => {
    const el = document.getElementById('app-splash');
    if (!el) return;
    // Nếu không ở chế độ đã cài, CSS đã ẩn sẵn — không cần làm gì.
    const t1 = setTimeout(() => el.classList.add('is-hide'), 800);  // bắt đầu mờ dần (0,8s)
    const t2 = setTimeout(() => { el.style.display = 'none'; }, 1350); // ẩn hẳn sau khi mờ (0,8s + 0,55s fade)
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div id="app-splash" aria-hidden>
      <div className="cl-splash-card">
        <div className="cl-splash-tile">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#C8A14B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.3V20h14V9.3" />
            <circle cx="12" cy="13.6" r="1.5" fill="#C8A14B" stroke="none" />
          </svg>
        </div>
        <div className="cl-splash-brand">Cam Lâm Land</div>
        <div className="cl-splash-sub">Nhà đất &amp; Bản đồ quy hoạch Cam Lâm, Khánh Hòa</div>
      </div>
      <div className="cl-splash-dots">
        <span className="cl-splash-dot" />
        <span className="cl-splash-dot" style={{ animationDelay: '.16s' }} />
        <span className="cl-splash-dot" style={{ animationDelay: '.32s' }} />
      </div>
    </div>
  );
}
