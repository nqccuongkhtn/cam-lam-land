import Link from 'next/link';

export const metadata = { title: 'Giới thiệu | Cam Lâm Land' };

const FEATURES = [
  { icon: '🏠', t: 'Chợ nhà đất Cam Lâm', d: 'Mua bán, cho thuê đất nền, nhà riêng, căn hộ, biệt thự — đăng tin miễn phí, thông tin minh bạch.' },
  { icon: '🗺️', t: 'Bản đồ quy hoạch', d: 'Tra cứu quy hoạch sử dụng đất trên nền vệ tinh độ nét cao đến z18, theo số tờ/số thửa/xã, toạ độ VN-2000.' },
  { icon: '🔎', t: 'Tra cứu QR thửa đất', d: 'Quét mã QR để tra cứu nhanh thông tin và ranh giới thửa đất.' },
  { icon: '🤝', t: 'Tư vấn & Ký gửi', d: 'Tư vấn đầu tư và pháp lý bất động sản; nhận ký gửi mua bán, cho thuê nhà đất.' },
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
