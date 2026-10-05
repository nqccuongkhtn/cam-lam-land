'use client';
import { CanhGaAd, useBoQc } from '@/components/newsAds';

/**
 * Quảng cáo "2 CÁNH GÀ" ở trang xem một tin đăng — Y KIỂU TRANG TIN TỨC (kiểu báo): mỗi bên 2 thẻ xếp chồng,
 * chữ "QUẢNG CÁO" xám phía trên, khung mảnh, ảnh ngang 4:3. Chỉ hiện ở màn hình rộng ≥1536px.
 * Dùng chung kho quảng cáo với trang chủ + trang Tin tức (admin nhập ở /admin → Quảng cáo); kho trống → 6 quảng cáo mẫu.
 * Việc CHỈ HIỆN Ở TIN THƯỜNG (tin VIP / tin đẩy không có quảng cáo) vẫn quyết định ở app/listings/[id]/page.tsx.
 */
export default function SideAds() {
  const ds = useBoQc();
  // Khung trang tin đăng rộng 1152px (max-w-6xl); hiện ngay, không chờ cuộn (trang này không có dải quảng cáo trên đầu)
  return <CanhGaAd ds={ds} rong={1152} hienSau={0} batDau={0} />;
}
