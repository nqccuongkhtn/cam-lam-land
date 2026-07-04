import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Bảng giá đất Khánh Hòa (Cam Lâm) — Cách tra cứu chính thức',
  description: 'Bảng giá đất Nhà nước tỉnh Khánh Hòa áp dụng cho khu vực Cam Lâm: bảng giá đất là gì, dùng để làm gì và cách tra cứu chính thức, so với giá thị trường.',
  keywords: ['bảng giá đất Khánh Hòa', 'bảng giá đất Cam Lâm', 'giá đất nhà nước Khánh Hòa', 'khung giá đất', 'quyết định bảng giá đất'],
  alternates: { canonical: '/bang-gia-dat' },
};

export default function BangGiaDatPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-extrabold text-[#0A2540]">Bảng giá đất Khánh Hòa (khu vực Cam Lâm)</h1>
      <p className="text-slate-600 mt-3 leading-relaxed">Bảng giá đất là bảng giá do <b>UBND tỉnh Khánh Hòa ban hành</b>, dùng làm căn cứ tính thuế, lệ phí, tiền sử dụng đất, bồi thường khi thu hồi… Đây là <b>giá Nhà nước</b>, thường thấp hơn giá giao dịch thực tế trên thị trường.</p>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-[#0A2540] mb-2">Bảng giá đất dùng để làm gì?</h2>
        <ul className="space-y-1.5 text-slate-600">
          {['Tính tiền sử dụng đất, tiền thuê đất', 'Tính thuế, lệ phí liên quan đến đất đai', 'Tính tiền bồi thường khi Nhà nước thu hồi đất', 'Tính lệ phí trước bạ, một số nghĩa vụ tài chính khác'].map((t, i) => (
            <li key={i} className="flex gap-2"><span className="text-[#C8A14B] font-bold shrink-0">•</span><span>{t}</span></li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-[#0A2540] mb-2">Cách tra cứu bảng giá đất chính thức</h2>
        <ul className="space-y-1.5 text-slate-600">
          <li className="flex gap-2"><span className="text-[#C8A14B] font-bold shrink-0">1.</span><span>Xem <b>Quyết định ban hành bảng giá đất</b> của UBND tỉnh Khánh Hòa (đăng trên Cổng thông tin điện tử tỉnh và Sở Nông nghiệp &amp; Môi trường).</span></li>
          <li className="flex gap-2"><span className="text-[#C8A14B] font-bold shrink-0">2.</span><span>Tra theo <b>tên đường/khu vực</b> và <b>loại đất</b> (ở, thương mại dịch vụ, nông nghiệp…) trong bảng giá.</span></li>
          <li className="flex gap-2"><span className="text-[#C8A14B] font-bold shrink-0">3.</span><span>Hoặc hỏi trực tiếp tại <b>Văn phòng Đăng ký đất đai / Phòng TN&amp;MT</b> nơi có đất để được cung cấp chính xác.</span></li>
        </ul>
        <p className="text-[13px] text-slate-500 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">Bảng giá đất được điều chỉnh theo từng thời kỳ (đặc biệt theo Luật Đất đai 2024). Cam Lâm Land đang cập nhật bảng chi tiết theo khu vực; trong thời gian này vui lòng đối chiếu Quyết định hiện hành của tỉnh để có số liệu chính xác.</p>
      </section>

      <section className="mt-6 bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-lg font-bold text-[#0A2540] mb-1">Giá Nhà nước ≠ giá thị trường</h2>
        <p className="text-slate-600 text-sm">Bảng giá đất Nhà nước dùng cho nghĩa vụ tài chính, thường thấp hơn giá mua bán thực tế. Muốn biết <b>mặt bằng giá rao bán thực tế</b> theo từng xã ở Cam Lâm và ước lượng nhanh giá trị thửa đất, dùng công cụ dưới đây:</p>
        <Link href="/gia-dat" className="inline-block mt-3 bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-5 py-2.5 rounded-xl text-sm">💰 Xem giá đất khu vực &amp; định giá nhanh →</Link>
      </section>
    </div>
  );
}
