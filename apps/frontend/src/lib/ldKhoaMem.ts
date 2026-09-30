// Dữ liệu cấu trúc báo cho Google: phần trong `.cl-noi-dung-khoa` là nội dung CẦN ĐĂNG NHẬP (không phải che giấu).
// Dùng kèm components/KhoaMem.tsx. Để ở file riêng (không 'use client') để layout phía máy chủ đọc được.
export const ldKhoaMem = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  isAccessibleForFree: false,
  hasPart: { '@type': 'WebPageElement', isAccessibleForFree: false, cssSelector: '.cl-noi-dung-khoa' },
};
