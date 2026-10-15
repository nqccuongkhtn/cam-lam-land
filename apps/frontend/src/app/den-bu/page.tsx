import type { Metadata } from 'next';
import DenBuClient from './DenBuClient';

export const metadata: Metadata = {
  title: 'Giá đền bù đất nông nghiệp Cam Lâm 2026 — Tra cứu & tính tiền bồi thường',
  // KHÔNG ghi số hiệu / ngày văn bản trong mô tả gửi Google (15/10/2026 — chủ dự án: "che mà số quyết định các thứ còn như này họ tự kiếm";
  // mô tả này hiện nguyên văn trong kết quả tìm kiếm Google).
  description: 'Tra giá đất bồi thường khi Nhà nước thu hồi đất nông nghiệp tại xã Cam Lâm theo thông báo giá đất cụ thể của Hội đồng thẩm định giá (dự án Khu đô thị mới Cam Lâm): giá từng thôn, từng loại đất, vị trí 1–2; tính nhanh tiền bồi thường và các khoản hỗ trợ theo Luật Đất đai.',
  keywords: ['giá đền bù đất Cam Lâm', 'bồi thường thu hồi đất Cam Lâm', 'giá đất nông nghiệp Cam Lâm 2026', 'Khu đô thị mới Cam Lâm', 'hỗ trợ chuyển đổi nghề'],
  alternates: { canonical: '/den-bu' },
};

export default function Page() {
  return <DenBuClient />;
}
