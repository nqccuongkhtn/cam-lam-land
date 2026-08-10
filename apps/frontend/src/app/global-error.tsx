'use client';
// Lỗi nghiêm trọng ở layout gốc -> thay toàn trang bằng trang bảo trì + game offline.
export default function GlobalError() {
  return (
    <html lang="vi">
      <body style={{ margin: 0, background: '#000' }}>
        <iframe src="/offline.html" title="Đang bảo trì" style={{ border: 0, width: '100vw', height: '100dvh', display: 'block' }} />
      </body>
    </html>
  );
}
