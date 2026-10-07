import type { Metadata } from 'next';
import Link from 'next/link';
import ShareRow from '@/components/ShareRow';
import LegalConsultCTA from '@/components/LegalConsultCTA';
import VanBanBrowser from './VanBanBrowser';
import ServicesSection from '@/components/ServicesSection';
import CongTtdt from './CongTtdt';

export const metadata: Metadata = {
  title: 'Tra cứu văn bản pháp luật nhà đất Cam Lâm, Khánh Hòa',
  description: 'Tra cứu văn bản nhà đất Cam Lâm theo chủ đề: quy hoạch, thông tin bồi thường, khu tái định cư, nhà ở xã hội. Liên kết trực tiếp tới cổng thông tin điện tử tỉnh Khánh Hòa và các xã, phường.',
  keywords: ['tra cứu văn bản Cam Lâm', 'văn bản pháp luật đất đai', 'Luật Đất đai 2024', 'bảng giá đất Khánh Hòa', 'quy hoạch Cam Lâm 2045', 'quyết định UBND huyện Cam Lâm'],
  alternates: { canonical: '/van-ban' },
  openGraph: { type: 'website', url: '/van-ban', title: 'Tra cứu văn bản pháp luật nhà đất Cam Lâm', description: 'Văn bản Cam Lâm + pháp luật đất đai – nhà ở – BĐS. Tìm kiếm & lọc theo loại, năm, cấp ban hành.', images: ['/icons/icon-512.png'] },
  twitter: { card: 'summary_large_image', title: 'Tra cứu văn bản nhà đất Cam Lâm', description: 'Văn bản Cam Lâm + pháp luật đất đai – nhà ở – BĐS, tìm kiếm nhanh.', images: ['/icons/icon-512.png'] },
};

export default function VanBanPage() {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-5 sm:py-8">
      {/* MẪU 34 (chủ dự án chọn 7/10/2026): tiêu đề GỌN MỘT HÀNG — tiêu đề bên trái, nút chia sẻ bên phải, gạch dưới */}
      {/* Điện thoại (kiểu Đ1, chốt 7/10/2026): 4 nút chia sẻ CỠ NHỎ cùng hàng tiêu đề; dòng chữ nhỏ ĐƯỢC XUỐNG DÒNG,
          không cắt "…" (chủ dự án: "pháp luật nhà ... là sao" — phải hiện đủ chữ "đất"). */}
      <div className="mb-4 flex items-start justify-between gap-2 border-b border-slate-200 pb-3 sm:items-end sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-[21px] font-extrabold leading-tight text-[#0A2540] sm:text-2xl">Tra cứu văn bản</h1>
          <p className="mt-0.5 text-[12px] text-slate-500 sm:text-[13px]">Văn bản Cam Lâm &amp; pháp luật nhà đất<span className="hidden sm:inline"> · cập nhật hằng ngày</span></p>
        </div>
        <ShareRow title="Tra cứu văn bản nhà đất Cam Lâm theo chủ đề" khongNhan gon className="shrink-0 pt-0.5 sm:pt-0" />
      </div>

      <VanBanBrowser />

      {/* Cổng thông tin điện tử Khánh Hòa */}
      <section className="mt-8 sm:mt-10">
        <h2 className="text-lg sm:text-xl font-extrabold text-[#0A2540]">Cổng thông tin điện tử Khánh Hòa</h2>
        <p className="text-sm text-slate-500 mt-1 mb-3 sm:mb-4">Tra cứu văn bản, quy hoạch, dự án và thủ tục trực tiếp tại các cổng chính thống của tỉnh, sở ngành và xã/phường.</p>
        {/* MẪU 34 chủ dự án chọn (6/10/2026): ô tìm nhanh + lưới tất cả cổng, gõ là lọc — xem CongTtdt.tsx */}
        <CongTtdt />
      </section>

      <ServicesSection className="mt-6 sm:mt-8" />

      <LegalConsultCTA topic="Tư vấn văn bản pháp lý nhà đất" className="mt-4" />

      <p className="text-[12px] text-slate-400 mt-6">Danh mục mang tính tham khảo, tổng hợp từ Cổng thông tin điện tử xã Cam Lâm và nguồn tra cứu công khai; số hiệu và hiệu lực có thể được sửa đổi, bổ sung. Vui lòng đối chiếu bản gốc trên cổng thông tin cơ quan ban hành trước khi thực hiện.</p>
    </div>
  );
}
