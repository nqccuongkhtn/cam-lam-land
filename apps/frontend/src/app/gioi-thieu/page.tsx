import Link from 'next/link';

export const metadata = { title: 'Giới thiệu | Cam Lâm Land' };

const FEATURES = [
  { p: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10', t: 'Chợ nhà đất Cam Lâm', d: 'Mua bán, cho thuê đất nền, nhà riêng, căn hộ, biệt thự — đăng tin miễn phí, thông tin minh bạch.' },
  { p: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15', t: 'Bản đồ quy hoạch', d: 'Tra cứu quy hoạch sử dụng đất trên nền vệ tinh độ nét cao đến z18, theo số tờ/số thửa/xã, toạ độ VN-2000.' },
  { p: 'M3 7V5a2 2 0 0 1 2-2h2 M17 3h2a2 2 0 0 1 2 2v2 M21 17v2a2 2 0 0 1-2 2h-2 M7 21H5a2 2 0 0 1-2-2v-2 M7 12h10', t: 'Tra cứu QR thửa đất', d: 'Quét mã QR để tra cứu nhanh thông tin và ranh giới thửa đất.' },
  { p: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75', t: 'Tư vấn & Ký gửi', d: 'Tư vấn đầu tư và pháp lý bất động sản; nhận ký gửi mua bán, cho thuê nhà đất.' },
];

const MILESTONES: [string, string][] = [
  ['Khởi nguồn', 'Bắt đầu từ một doanh nghiệp môi giới bất động sản hoạt động trực tiếp tại Cam Lâm — tích luỹ kinh nghiệm thực tế, am hiểu từng con đường, từng thửa đất và nhu cầu của người dân địa phương.'],
  ['2025', 'Từ trăn trở với thông tin quy hoạch thiếu minh bạch, đội ngũ bắt tay thu thập và số hoá dữ liệu quy hoạch Cam Lâm.'],
  ['Đầu 2026', 'Hoàn thiện bản đồ quy hoạch trên nền vệ tinh độ nét cao, tra cứu theo số tờ/số thửa/xã và toạ độ VN-2000.'],
  ['Tháng 8/2026', 'Chính thức ra mắt nền tảng Cam Lâm Land: chợ nhà đất trực tuyến, đăng tin miễn phí và tra cứu quy hoạch ngay trên bản đồ.'],
  ['Sau ra mắt', 'Tiếp tục bổ sung tra cứu QR thửa đất, tư vấn đầu tư & pháp lý, tin tức thị trường; không ngừng hoàn thiện và mở rộng.'],
];

export default function Page() {
  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-xs text-slate-400 mb-3"><Link href="/" className="hover:text-[#0A2540]">Trang chủ</Link> › <span className="text-slate-600">Giới thiệu</span></div>
        <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#0A2540]">Giới thiệu Cam Lâm <span className="text-[#C8A14B]">Land</span></h1>
          <p className="text-slate-600 mt-4 leading-relaxed">Cam Lâm Land là nền tảng bất động sản kết hợp bản đồ quy hoạch. Chúng tôi giúp người dân và nhà đầu tư tìm mua, bán, cho thuê nhà đất; đồng thời tra cứu quy hoạch một cách minh bạch, chính xác và cập nhật.</p>

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            {FEATURES.map((f) => (
              <div key={f.t} className="flex gap-3.5 rounded-xl border border-slate-200 p-4 transition hover:border-[#C8A14B]/50 hover:shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-[#0A2540] grid place-items-center shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px] text-[#C8A14B]"><path d={f.p} /></svg>
                </div>
                <div>
                  <p className="font-bold text-[#0A2540]">{f.t}</p>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{f.d}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-bold text-[#0A2540] mt-8 mb-2">Câu chuyện của chúng tôi</h2>
          <div className="space-y-3 text-[15px] text-slate-700 leading-relaxed">
            <p>Cam Lâm Land khởi nguồn từ một doanh nghiệp bất động sản hoạt động nhiều năm ngay tại Cam Lâm. Từ những ngày đầu môi giới, dẫn khách đi xem đất, làm hồ sơ pháp lý trực tiếp, chúng tôi thuộc lòng từng con đường, từng thửa đất — và cả những trăn trở của người dân, nhà đầu tư nơi đây.</p>
            <p>Khi Cam Lâm &quot;nóng&quot; lên nhờ định hướng đô thị sân bay và hạ tầng ven biển, chúng tôi chứng kiến ngày càng nhiều giao dịch gặp rủi ro chỉ vì thông tin quy hoạch tản mát, bản đồ cũ, tin đồn lan nhanh hơn dữ liệu chính thống. Không ít người mua đất chỉ dựa vào lời nói hay bản vẽ tay — và trả giá bằng những đồng vốn dành dụm cả đời.</p>
            <p>Từ chính kinh nghiệm thực tế ấy, chúng tôi quyết định số hoá mọi thứ: đưa dữ liệu quy hoạch lên bản đồ trực tuyến đến từng thửa đất, minh bạch hoá tin đăng và mang sự tư vấn tận tâm &quot;ngoài đời&quot; lên nền tảng số. Cam Lâm Land ra đời để bất kỳ ai — dù ở Cam Lâm hay từ xa — đều tra cứu được quy hoạch chính xác, xem tin đăng rõ ràng và quyết định với sự an tâm. Với chúng tôi, giá trị lớn nhất không phải số lượng tin đăng, mà là sự minh bạch và niềm tin.</p>
          </div>

          <h2 className="text-lg font-bold text-[#0A2540] mt-8 mb-5">Chặng đường hình thành</h2>
          <ol className="relative ml-1 space-y-6">
            <span aria-hidden className="absolute left-[6px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#C8A14B] via-[#C8A14B]/50 to-[#C8A14B]/10" />
            {MILESTONES.map(([year, text]) => (
              <li key={year} className="relative pl-8">
                <span aria-hidden className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-[#C8A14B] ring-4 ring-white" />
                <span className="inline-block bg-[#0A2540] text-white text-xs font-bold rounded-md px-2.5 py-1 mb-1.5">{year}</span>
                <p className="text-[15px] text-slate-600 leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-2xl bg-gradient-to-br from-[#0A2540] to-[#0d2f54] p-6">
            <p className="text-[#FFD56A] text-xs font-bold uppercase tracking-wider">Sứ mệnh</p>
            <p className="text-[15px] md:text-base leading-relaxed mt-2 text-slate-100">Minh bạch hoá thông tin bất động sản và quy hoạch tại Cam Lâm — để mỗi quyết định mua bán, đầu tư đều an toàn, rõ ràng và dễ dàng hơn.</p>
          </div>

          <h2 className="text-lg font-bold text-[#0A2540] mt-6 mb-2">Liên hệ</h2>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 space-y-1">
            <p>📞 Hotline: <a href="tel:0988888888" className="font-bold text-[#0A2540]">0988 888 888</a></p>
            <p>✉️ Email: lienhe@camlamland.vn</p>
            <p>📍 Địa chỉ: Cam Lâm, Khánh Hòa</p>
            <p className="text-slate-500">Phát triển bởi Nguyễn Quốc Cường</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/listings" className="bg-[#0A2540] hover:bg-[#0d2f54] text-white font-semibold px-5 py-2.5 rounded-xl text-sm">Xem nhà đất</Link>
            <Link href="/map" className="border border-slate-300 text-[#0A2540] font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-slate-50">Bản đồ quy hoạch</Link>
          </div>
        </article>
        <div className="mt-6 text-center"><Link href="/" className="inline-block text-red-600 font-semibold text-sm hover:underline">← Về trang chủ</Link></div>
      </div>
    </div>
  );
}
