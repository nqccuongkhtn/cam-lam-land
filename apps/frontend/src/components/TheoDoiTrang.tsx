'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

/**
 * THEO DÕI TÀI KHOẢN — TẠM THỜI, DỄ GỠ (1/10/2026, chủ dự án tự duyệt bật; xem apps/backend/src/routes/theoDoiTk.ts).
 * Đã đăng nhập thì báo về máy chủ "vừa mở trang nào". Máy chủ CHỈ GHI nếu tài khoản nằm trong danh sách
 * theo dõi; người khác gửi lên bị bỏ qua. Trang nhúng trong khung Tiện ích (?embed=1) không báo, vì khung
 * ngoài (/tien-ich?tab=…) đã báo rồi. Gỡ: xoá file này + dòng <TheoDoiTrang /> trong DeferredWidgets.tsx.
 */
export default function TheoDoiTrang() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { user } = useAuth();
  const q = search?.toString() || '';
  useEffect(() => {
    if (!user || /(^|&)embed=1(&|$)/.test(q)) return;
    const t = setTimeout(() => {
      api('/theo-doi/trang', { method: 'POST', body: JSON.stringify({ p: pathname + (q ? `?${q}` : '') }) }).catch(() => {});
    }, 800); // chờ ổn định: bấm qua lại liên tục chỉ ghi trang dừng lại
    return () => clearTimeout(t);
  }, [pathname, q, user]);
  return null;
}
