import type { Metadata } from 'next';
import GiaDatClient from './GiaDatClient';

export const metadata: Metadata = {
  title: 'Giá đất Cam Lâm, Khánh Hòa — Tham khảo & định giá nhanh',
  description: 'Bảng giá đất tham khảo theo khu vực (xã) tại Cam Lâm, Khánh Hòa tính từ tin rao thực tế, kèm công cụ định giá nhanh theo diện tích.',
  keywords: ['giá đất Cam Lâm', 'giá nhà đất Khánh Hòa', 'định giá đất Cam Lâm', 'giá đất Bãi Dài', 'giá đất Cam Đức', 'giá đất Cam Hải Đông'],
  alternates: { canonical: '/gia-dat' },
};

export default function GiaDatPage() {
  return <GiaDatClient />;
}
