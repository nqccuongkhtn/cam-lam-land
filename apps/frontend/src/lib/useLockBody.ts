'use client';
import { useEffect } from 'react';

// Khoá cuộn nền khi popup/modal ĐANG MỞ (mount = khoá, unmount = mở lại).
// Nền phủ inset-0 của modal đã chặn CLICK xuyên xuống; hook này chặn CUỘN nền
// → lớp dưới hoàn toàn không thao tác được khi có lớp phủ bên trên.
// An toàn khi lồng nhiều modal: mỗi lớp nhớ giá trị trước đó rồi khôi phục theo thứ tự.
// active=false → không khoá (dùng cho popup luôn mounted, chỉ khoá khi đang mở, vd khung chat: useLockBody(open)).
export function useLockBody(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}
