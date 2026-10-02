'use client';
import { useEffect } from 'react';
import Link from 'next/link';

// Error boundary cấp route (Next App Router): khi 1 component NÉM lỗi lúc render/hydrate,
// hiện fallback PHỤC HỒI ĐƯỢC (nút Thử lại gọi reset) thay vì phủ full màn hình bảo trì
// không lối thoát — tránh cảm giác "treo/trắng trang" khi chỉ là lỗi render thoáng qua.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[cl-error]', error);
    // Lỗi "THIẾU FILE MÃ" (2/10/2026): máy còn giữ bản trang CŨ trong bộ nhớ đệm, trong khi web vừa được dựng lại
    // nên file mã cũ không còn → tải lại MỘT lần là lấy được bản mới. Nhớ trong sessionStorage để không lặp mãi.
    const thieuFile = /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Failed to fetch/i.test(`${error?.name} ${error?.message}`);
    if (!thieuFile) return;
    try {
      const k = 'cl-tai-lai-thieu-file';
      const lan = Number(sessionStorage.getItem(k) || 0);
      if (Date.now() - lan > 60_000) { sessionStorage.setItem(k, String(Date.now())); window.location.reload(); }
    } catch { window.location.reload(); }
  }, [error]);
  return (
    <div className="min-h-[60vh] grid place-items-center px-4 py-16 text-center">
      <div className="max-w-md">
        <div className="text-5xl mb-2">⚠️</div>
        <h1 className="text-xl font-bold text-[#0A2540]">Có lỗi khi hiển thị trang</h1>
        <p className="mt-2 text-slate-500">Trang gặp trục trặc khi tải. Bạn thử tải lại — nếu vẫn lỗi, quay về trang chủ giúp mình nhé.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <button onClick={() => reset()} className="bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-5 py-2.5 rounded-xl">↻ Thử lại</button>
          <Link href="/" className="bg-white border border-slate-200 hover:bg-slate-50 text-[#0A2540] font-bold px-5 py-2.5 rounded-xl">Về trang chủ</Link>
        </div>
        <p className="mt-4 text-[11px] text-slate-400">Nếu cần hỗ trợ: 0988 888 888</p>
      </div>
    </div>
  );
}
