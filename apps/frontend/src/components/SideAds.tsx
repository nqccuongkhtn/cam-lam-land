'use client';
import { CotDocAd, useBoQc } from '@/components/newsAds';

/**
 * Quảng cáo "2 CÁNH GÀ" ở trang xem một tin đăng — 2 cột dọc hai bên, chỉ hiện trên màn hình RỘNG ≥1700px
 * (đủ chỗ ngoài khung nội dung max-w-7xl).
 * 5/10/2026: bỏ nội dung viết cứng (Gói VIP / Dịch vụ pháp lý), chuyển sang DÙNG CHUNG kho quảng cáo
 * với trang chủ + trang Tin tức (admin nhập ở /admin → Quảng cáo). Kho trống thì hiện 6 quảng cáo mẫu.
 * Hai cột bắt đầu ở hai quảng cáo khác nhau nên không bao giờ trùng nhau.
 * Việc CHỈ HIỆN Ở TIN THƯỜNG (tin VIP / tin đẩy không có quảng cáo) vẫn quyết định ở app/listings/[id]/page.tsx.
 */
export default function SideAds() {
  const ds = useBoQc();
  return (
    <>
      <aside className="hidden min-[1700px]:block fixed left-4 top-24 z-10 w-44"><CotDocAd ds={ds} batDau={0} /></aside>
      <aside className="hidden min-[1700px]:block fixed right-4 top-24 z-10 w-44"><CotDocAd ds={ds} batDau={Math.max(1, Math.floor(ds.length / 2))} /></aside>
    </>
  );
}
