import type { Metadata } from 'next';
import DenBuClient from './DenBuClient';

export const metadata: Metadata = {
  title: 'Giá đền bù đất nông nghiệp Cam Lâm 2026 — Tra cứu & tính tiền bồi thường',
  description: 'Tra giá đất bồi thường khi Nhà nước thu hồi đất nông nghiệp tại xã Cam Lâm theo Thông báo 306/TB-HĐTĐ ngày 07/5/2026 (dự án Khu đô thị mới Cam Lâm): giá từng thôn, từng loại đất, vị trí 1–2; tính nhanh tiền bồi thường và các khoản hỗ trợ theo Luật Đất đai 2024.',
  keywords: ['giá đền bù đất Cam Lâm', 'bồi thường thu hồi đất Cam Lâm', 'giá đất nông nghiệp Cam Lâm 2026', 'Khu đô thị mới Cam Lâm', 'hỗ trợ chuyển đổi nghề'],
  alternates: { canonical: '/den-bu' },
};

export default function Page() {
  return <DenBuClient />;
}
