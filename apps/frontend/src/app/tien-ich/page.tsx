'use client';
import HubShell from '@/components/HubShell';
import { TIEN_ICH_TOOLS } from '@/lib/tienIchTools';

// Danh sách công cụ nằm ở lib/tienIchTools (DÙNG CHUNG với sheet Tiện ích ở thanh dưới) → luôn đồng bộ.
export default function TienIchPage() {
  return <HubShell title="🧰 Tiện ích Cam Lâm Land" subtitle="Tất cả công cụ tra cứu nhà đất & quy hoạch trong một nơi" tools={TIEN_ICH_TOOLS} storageKey="tienich" hideMobileMenu />;
}
