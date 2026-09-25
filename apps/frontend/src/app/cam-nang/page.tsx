import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDES } from './guides';
import GuideList from './GuideList';
import ShareRow from '@/components/ShareRow';
import LegalConsultCTA from '@/components/LegalConsultCTA';
import ServicesSection from '@/components/ServicesSection';
import LogoAnh from '@/components/LogoAnh';

export const metadata: Metadata = {
  title: 'Cẩm nang pháp lý nhà đất Cam Lâm, Khánh Hòa',
  description: 'Hướng dẫn thủ tục sang tên sổ đỏ, thuế phí mua bán nhà đất, kiểm tra sổ đỏ thật – giả và kiểm tra quy hoạch tại Cam Lâm, Khánh Hòa. Cập nhật, dễ hiểu.',
  keywords: ['sang tên sổ đỏ', 'thuế mua bán nhà đất', 'kiểm tra sổ đỏ thật giả', 'kiểm tra quy hoạch đất', 'thủ tục nhà đất Cam Lâm', 'pháp lý nhà đất Khánh Hòa'],
  alternates: { canonical: '/cam-nang' },
  openGraph: { type: 'website', url: '/cam-nang', title: 'Cẩm nang pháp lý nhà đất Cam Lâm, Khánh Hòa', description: 'Hướng dẫn thủ tục sang tên sổ đỏ, thuế phí mua bán nhà đất, kiểm tra sổ đỏ thật – giả và kiểm tra quy hoạch tại Cam Lâm, Khánh Hòa.', images: ['/icons/icon-512.png'] },
  twitter: { card: 'summary_large_image', title: 'Cẩm nang pháp lý nhà đất Cam Lâm', description: 'Thủ tục, thuế phí & kinh nghiệm pháp lý nhà đất Cam Lâm, Khánh Hòa.', images: ['/icons/icon-512.png'] },
};

export default function CamNangPage() {
  return (
    <>
    <div className="mx-auto max-w-4xl px-3 py-5 sm:px-4 sm:py-8">
      {/* Tiêu đề gọn + nhận diện thương hiệu (dễ nhớ, không rối) */}
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#0B4045] shrink-0">
          <LogoAnh cao={24} nenToi />
        </span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B4045] leading-tight">Cẩm nang pháp lý nhà đất</h1>
          <p className="text-[13px] font-semibold text-[#C8A14B]">Cam Lâm Land · Pháp lý minh bạch — Giao dịch an tâm</p>
        </div>
      </div>
      <p className="text-slate-600 mt-2.5 text-sm sm:text-base max-w-2xl">Hướng dẫn thủ tục, thuế phí và kinh nghiệm pháp lý khi mua bán, chuyển nhượng nhà đất — biên soạn cho khu vực Cam Lâm, Khánh Hòa. Cập nhật theo pháp luật hiện hành, tư vấn miễn phí và bảo mật thông tin.</p>
      <ShareRow title="Cẩm nang pháp lý nhà đất Cam Lâm" className="mt-3 mb-4 sm:mt-4 sm:mb-6" />

      {/* Danh sách bài hướng dẫn — nạp trước, bấm "Xem thêm" hiện +4 */}
      <GuideList items={GUIDES.map((g) => ({ slug: g.slug, title: g.title, desc: g.desc }))} />

    </div>
    <div className="mx-auto max-w-7xl px-3 sm:px-6 pb-6 sm:pb-8">
      {/* Dịch vụ của chúng tôi (mốc cuộn từ trang chủ) — component dùng chung cho các trang tiện ích */}
      <ServicesSection className="mt-6 sm:mt-8" />

      {/* Ô để lại SĐT */}
      <LegalConsultCTA topic="Dịch vụ pháp lý (từ trang Cẩm nang)" className="mt-4" />

      <p className="text-[12px] text-slate-400 mt-6">Nội dung mang tính tham khảo, hướng dẫn chung; quy định pháp luật có thể thay đổi. Vui lòng đối chiếu quy định hiện hành hoặc hỏi cơ quan chức năng trước khi thực hiện.</p>
    </div>
    </>
  );
}
