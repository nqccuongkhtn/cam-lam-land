'use client';
import ServicesSection from '@/components/ServicesSection';
import LegalConsultCTA from '@/components/LegalConsultCTA';

/**
 * Khối QUẢNG CÁO dịch vụ (6 thẻ "Dịch vụ của chúng tôi" + ô để lại SĐT "Nhận tư vấn") hiện cho khách
 * CHƯA ĐĂNG NHẬP ngay dưới ô mời đăng nhập của Tiện ích (chủ dự án 30/9/2026: khoá công cụ nhưng
 * quảng cáo vẫn phải hiện — đây là chỗ kéo khách). Người đã đăng nhập thấy khối này ở cuối chính trang đó.
 * `moc` = gắn mốc #dich-vu-phap-ly (trang chủ có liên kết cuộn tới đây).
 */
export default function QuangCaoDichVu({ moc = true }: { moc?: boolean }) {
  return (
    <div className="mx-auto max-w-7xl px-3 pb-6 sm:px-6 sm:pb-8">
      <ServicesSection className="mt-2" moc={moc} gon />
      <LegalConsultCTA topic="Dịch vụ pháp lý (khách chưa đăng nhập ở Tiện ích)" className="mt-4" />
    </div>
  );
}
