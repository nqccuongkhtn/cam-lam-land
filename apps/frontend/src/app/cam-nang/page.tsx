import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDES } from './guides';

export const metadata: Metadata = {
  title: 'Cẩm nang pháp lý nhà đất Cam Lâm, Khánh Hòa',
  description: 'Hướng dẫn thủ tục sang tên sổ đỏ, thuế phí mua bán nhà đất, kiểm tra sổ đỏ thật – giả và kiểm tra quy hoạch tại Cam Lâm, Khánh Hòa. Cập nhật, dễ hiểu.',
  keywords: ['sang tên sổ đỏ', 'thuế mua bán nhà đất', 'kiểm tra sổ đỏ thật giả', 'kiểm tra quy hoạch đất', 'thủ tục nhà đất Cam Lâm', 'pháp lý nhà đất Khánh Hòa'],
  alternates: { canonical: '/cam-nang' },
};

export default function CamNangPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-extrabold text-[#0A2540]">Cẩm nang pháp lý nhà đất</h1>
      <p className="text-slate-600 mt-2 mb-6 max-w-2xl">Hướng dẫn thủ tục, thuế phí và kinh nghiệm pháp lý khi mua bán, chuyển nhượng nhà đất — biên soạn cho khu vực Cam Lâm, Khánh Hòa.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        {GUIDES.map((g) => (
          <Link key={g.slug} href={`/cam-nang/${g.slug}`} className="block bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#C8A14B] hover:shadow-sm transition">
            <h2 className="font-bold text-[#0A2540] text-lg leading-snug">{g.title}</h2>
            <p className="text-sm text-slate-500 mt-2">{g.desc}</p>
            <span className="inline-block mt-3 text-sm font-semibold text-[#C8A14B]">Đọc tiếp →</span>
          </Link>
        ))}
      </div>

      {/* Dịch vụ pháp lý */}
      <section className="mt-8 bg-gradient-to-br from-[#0A2540] to-[#0d3a6b] text-white rounded-2xl p-6">
        <h2 className="text-xl font-extrabold">Dịch vụ pháp lý nhà đất</h2>
        <p className="text-white/85 text-sm mt-2 max-w-2xl">Cam Lâm Land hỗ trợ trọn gói thủ tục pháp lý nhà đất tại Cam Lâm – Khánh Hòa, giúp bạn giao dịch an toàn, nhanh gọn, đúng luật.</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm">
          {['Sang tên, chuyển nhượng Sổ đỏ', 'Tách thửa – hợp thửa đất', 'Kiểm tra pháp lý & quy hoạch thửa đất', 'Tư vấn thuế, phí, lệ phí trước bạ', 'Soạn & rà soát hợp đồng mua bán, đặt cọc', 'Hỗ trợ hồ sơ thừa kế, tặng cho, cấp đổi sổ'].map((s, i) => (
            <div key={i} className="flex gap-2"><span className="text-[#FFD56A] shrink-0">✓</span><span>{s}</span></div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="tel:0988888888" className="inline-flex items-center gap-2 bg-[#C8A14B] hover:bg-[#b8923f] text-[#0A2540] font-extrabold px-5 py-2.5 rounded-xl text-sm">📞 Gọi tư vấn: 0988 888 888</a>
          <a href="https://zalo.me/0988888888" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-bold px-5 py-2.5 rounded-xl text-sm">💬 Nhắn Zalo</a>
        </div>
        <p className="text-white/60 text-xs mt-3">Tư vấn miễn phí ban đầu · Bảo mật thông tin khách hàng.</p>
      </section>

      <p className="text-[12px] text-slate-400 mt-6">Nội dung mang tính tham khảo, hướng dẫn chung; quy định pháp luật có thể thay đổi. Vui lòng đối chiếu quy định hiện hành hoặc hỏi cơ quan chức năng trước khi thực hiện.</p>
    </div>
  );
}
