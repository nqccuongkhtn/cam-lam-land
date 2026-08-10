'use client';
// Khối "Dịch vụ của chúng tôi" — DÙNG CHUNG cho các trang tiện ích (đặt cuối trang).
// Gọn theo hướng chốt deal: chỉ 2 kênh liên hệ mạnh nhất (Gọi + Zalo); chat đã có bong bóng nổi toàn app.
const SERVICES: [string, string][] = [
  ['tra-cuu-quy-hoach', 'Tra cứu quy hoạch'],
  ['cap-gcn', 'Cấp giấy chứng nhận (Sổ đỏ)'],
  ['dang-ky-bien-dong', 'Đăng ký biến động'],
  ['tach-hop-thua', 'Tách thửa – Hợp thửa – Đo đạc'],
  ['chuyen-muc-dich', 'Chuyển mục đích sử dụng đất'],
  ['tu-van-phap-ly', 'Tư vấn pháp lý đất đai'],
];

export default function ServicesSection({ className = '' }: { className?: string }) {
  return (
    <section id="dich-vu-phap-ly" className={`scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 ${className}`}>
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[#0A2540]">Dịch vụ của chúng tôi</h2>
        <p className="mt-1 text-[13px] sm:text-sm font-bold text-[#C8A14B]">Nhanh chóng · Chính xác · Uy tín · Trách nhiệm</p>
        <p className="mx-auto mt-2 max-w-2xl text-[13px] sm:text-sm text-slate-500">Cam Lâm Land hỗ trợ trọn gói thủ tục pháp lý và hồ sơ đất đai tại Cam Lâm – Khánh Hòa, giúp bạn giao dịch an toàn, nhanh gọn, đúng luật.</p>
      </div>
      <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
        {SERVICES.map(([f, alt]) => (
          <div key={f} className="group overflow-hidden rounded-2xl ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:ring-slate-200">
            <img src={`/dichvu/${f}.png`} alt={alt} loading="lazy" className="block h-auto w-full transition-transform duration-500 group-hover:scale-[1.05]" />
          </div>
        ))}
      </div>
    </section>
  );
}
