import type { Metadata } from 'next';
import GiaDatClient from './GiaDatClient';
import ServicesSection from '@/components/ServicesSection';
import LegalConsultCTA from '@/components/LegalConsultCTA';

export const metadata: Metadata = {
  title: 'Giá đất Cam Lâm, Khánh Hòa — Tham khảo & định giá nhanh',
  description: 'Bảng giá đất tham khảo theo khu vực (xã) tại Cam Lâm, Khánh Hòa tính từ tin rao thực tế, kèm công cụ định giá nhanh theo diện tích.',
  keywords: ['giá đất Cam Lâm', 'giá nhà đất Khánh Hòa', 'định giá đất Cam Lâm', 'giá đất Bãi Dài', 'giá đất Cam Đức', 'giá đất Cam Hải Đông'],
  alternates: { canonical: '/gia-dat' },
};

export default function GiaDatPage() {
  return (
    <>
      <GiaDatClient />
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pb-6 sm:pb-8">
        <ServicesSection className="mt-6 sm:mt-8" />
        <LegalConsultCTA topic="Dịch vụ pháp lý (từ Giá đất)" className="mt-4" />
      </div>
    </>
  );
}
