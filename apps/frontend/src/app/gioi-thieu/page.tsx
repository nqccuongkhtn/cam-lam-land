import Link from 'next/link';

export const metadata = { title: 'Giới thiệu | Cam Lâm Land' };

const FEATURES = [
  { icon: '🏠', t: 'Chợ nhà đất Cam Lâm', d: 'Mua bán, cho thuê đất nền, nhà riêng, căn hộ, biệt thự — đăng tin miễn phí, thông tin minh bạch.' },
  { icon: '🗺️', t: 'Bản đồ quy hoạch', d: 'Tra cứu quy hoạch sử dụng đất trên nền vệ tinh độ nét cao đến z18, theo số tờ/số thửa/xã, toạ độ VN-2000.' },
  { icon: '🔎', t: 'Tra cứu QR thửa đất', d: 'Quét mã QR để tra cứu nhanh thông tin và ranh giới thửa đất.' },
  { icon: '🤝', t: 'Tư vấn & Ký gửi', d: 'Tư vấn đầu tư và pháp lý bất động sản; nhận ký gửi mua bán, cho thuê nhà đất.' },
];

const MILESTONES: [string, string][] = [
  ['Đầu 2025', 'Khởi nguồn từ trăn trở về thông tin quy hoạch thiếu minh bạch; khảo sát nhu cầu và bắt đầu thu thập, số hoá dữ liệu quy hoạch Cam Lâm.'],
  ['Giữa 2025', 'Hoàn thiện bản đồ quy hoạch trên nền vệ tinh độ nét cao, tra cứu theo số tờ/số thửa/xã và toạ độ VN-2000.'],
  ['Cuối 2025', 'Ra mắt chợ nhà đất: đăng tin miễn phí, tìm kiếm và hiển thị tin đăng trực tiếp trên bản đồ.'],
  ['2026', 'Bổ sung tra cứu QR thửa đất, tư vấn đầu tư & pháp lý và tin tức thị trường; không ngừng hoàn thiện và mở rộng.'],
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
              <div key={f.t} className="flex gap-3 rounded-xl border border-slate-200 p-4">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <p className="font-bold text-[#0A2540]">{f.t}</p>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{f.d}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-bold text-[#0A2540] mt-8 mb-2">Câu chuyện của chúng tôi</h2>
          <div className="space-y-3 text-[15px] text-slate-700 leading-relaxed">
            <p>Cam Lâm những năm gần đây trở thành một trong những điểm nóng bất động sản của cả nước — nơi hội tụ định hướng đô thị sân bay, hạ tầng ven biển và làn sóng đầu tư đổ về. Nhưng đằng sau sự sôi động ấy là một thực tế: thông tin quy hoạch tản mát, bản đồ cũ, tin đồn lan nhanh hơn dữ liệu chính thống. Không ít người mua đất chỉ dựa vào lời nói, bản vẽ tay hay những tấm ảnh mập mờ — và trả giá bằng rủi ro pháp lý, bằng những đồng vốn dành dụm cả đời.</p>
            <p>Là những người gắn bó với mảnh đất Cam Lâm, chúng tôi hiểu rõ nỗi lo đó. Cam Lâm Land ra đời từ một mong muốn giản dị: để bất kỳ ai — từ người dân bán mảnh vườn của gia đình đến nhà đầu tư ở xa — đều có thể tra cứu quy hoạch chính xác, xem tin đăng minh bạch và ra quyết định với sự an tâm. Chúng tôi đưa công nghệ bản đồ GIS và dữ liệu quy hoạch số hoá đến từng thửa đất, kết hợp với một sàn nhà đất thân thiện, để biến thông tin phức tạp thành thứ ai cũng dùng được.</p>
            <p>Với chúng tôi, mỗi thửa đất đều gắn với một câu chuyện và một dự định của ai đó. Vì vậy, giá trị lớn nhất mà Cam Lâm Land theo đuổi không phải là số lượng tin đăng, mà là sự minh bạch và niềm tin — để mỗi giao dịch tại Cam Lâm đều an toàn, rõ ràng và công bằng hơn.</p>
          </div>

          <h2 className="text-lg font-bold text-[#0A2540] mt-8 mb-3">Chặng đường hình thành</h2>
          <div className="space-y-4">
            {MILESTONES.map(([year, text]) => (
              <div key={year} className="flex gap-4">
                <div className="shrink-0 w-24"><span className="inline-block bg-[#0A2540] text-white font-bold text-xs sm:text-sm rounded-lg px-2.5 py-1.5 whitespace-nowrap">{year}</span></div>
                <p className="text-[15px] text-slate-700 leading-relaxed border-l-2 border-[#C8A14B]/40 pl-4">{text}</p>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-bold text-[#0A2540] mt-8 mb-2">Sứ mệnh</h2>
          <p className="text-[15px] text-slate-700 leading-relaxed">Minh bạch hoá thông tin bất động sản và quy hoạch tại Cam Lâm, giúp mỗi quyết định mua bán, đầu tư trở nên an toàn và dễ dàng hơn.</p>

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
