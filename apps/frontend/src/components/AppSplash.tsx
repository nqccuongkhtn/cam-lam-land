'use client';
import { useEffect } from 'react';
import { HinhThuaDat } from './LogoMark';

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
          <svg width="60" height="60" viewBox="0 0 44 44" aria-hidden="true">
            <HinhThuaDat day={2.6} />
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
