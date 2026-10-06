import type { Metadata } from 'next';
import Link from 'next/link';
import ShareRow from '@/components/ShareRow';
import LegalConsultCTA from '@/components/LegalConsultCTA';
import VanBanBrowser from './VanBanBrowser';
import ServicesSection from '@/components/ServicesSection';
import { PORTALS } from './data';

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
      {/* Tiêu đề + nhận diện thương hiệu (đồng bộ trang Cẩm nang) */}
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-11 h-11 rounded-2xl bg-[#0A2540] shrink-0">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#C8A14B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M9 9h1M9 13h6M9 17h6" /></svg>
        </span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0A2540] leading-tight">Tra cứu văn bản</h1>
          <p className="text-[13px] font-semibold text-[#C8A14B]">Cam Lâm Land · Văn bản Cam Lâm &amp; pháp luật nhà đất</p>
        </div>
      </div>
      <ShareRow title="Tra cứu văn bản nhà đất Cam Lâm theo chủ đề" className="mt-3 mb-5" />

      <VanBanBrowser />

      {/* Cổng thông tin điện tử Khánh Hòa */}
      <section className="mt-8 sm:mt-10">
        <h2 className="text-lg sm:text-xl font-extrabold text-[#0A2540]">Cổng thông tin điện tử Khánh Hòa</h2>
        <p className="text-sm text-slate-500 mt-1 mb-3 sm:mb-4">Tra cứu văn bản, quy hoạch, dự án và thủ tục trực tiếp tại các cổng chính thống của tỉnh, sở ngành và xã/phường.</p>
        {/* MẪU 34 chủ dự án chọn (6/10/2026, sau 2 lượt chê "lộn xộn" + xem 50 mẫu): MỘT khung trắng, 4 CỘT theo nhóm,
            mỗi liên kết có ô vuông biểu tượng toà nhà nhỏ phía trước → liên kết xếp dọc thẳng hàng, không còn dòng lẻ.
            Điện thoại: các nhóm xếp chồng, liên kết trong nhóm chia 2 cột. */}
        <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-3.5 sm:p-5 lg:grid-cols-4 lg:gap-6">
          {PORTALS.map((g) => (
            <div key={g.nhom} className="min-w-0">
              <p className="mb-2 text-[13.5px] font-bold text-[#0A2540] lg:mb-3">{g.nhom}</p>
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 lg:grid-cols-1">
                {g.items.map(([name, url]) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="group flex min-w-0 items-center gap-2 text-[13px] text-slate-700 transition hover:text-red-600 sm:text-sm">
                    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-slate-100 transition group-hover:bg-red-50 sm:h-[26px] sm:w-[26px]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-slate-500 group-hover:text-red-600 sm:h-3.5 sm:w-3.5" aria-hidden><path d="M3 21h18M5 21V10m14 11V10M3 10l9-6 9 6M9 21v-6h6v6" /></svg>
                    </span>
                    <span className="min-w-0 leading-snug">{name}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <ServicesSection className="mt-6 sm:mt-8" />

      <LegalConsultCTA topic="Tư vấn văn bản pháp lý nhà đất" className="mt-4" />

      <p className="text-[12px] text-slate-400 mt-6">Danh mục mang tính tham khảo, tổng hợp từ Cổng thông tin điện tử xã Cam Lâm và nguồn tra cứu công khai; số hiệu và hiệu lực có thể được sửa đổi, bổ sung. Vui lòng đối chiếu bản gốc trên cổng thông tin cơ quan ban hành trước khi thực hiện.</p>
    </div>
  );
}
