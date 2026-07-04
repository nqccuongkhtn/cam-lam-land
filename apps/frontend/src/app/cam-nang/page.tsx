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

      <p className="text-[12px] text-slate-400 mt-6">Nội dung mang tính tham khảo, hướng dẫn chung; quy định pháp luật có thể thay đổi. Vui lòng đối chiếu quy định hiện hành hoặc hỏi cơ quan chức năng trước khi thực hiện.</p>
    </div>
  );
}
