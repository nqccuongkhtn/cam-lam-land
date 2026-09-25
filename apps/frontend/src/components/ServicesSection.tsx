'use client';
/* ============================================================================
 *  KHỐI "DỊCH VỤ CỦA CHÚNG TÔI" — dùng chung cho các trang tiện ích (đặt cuối trang).
 * ----------------------------------------------------------------------------
 *  GIỮ NGUYÊN 6 TẤM ẢNH ở public/dichvu/ — chủ dự án đã duyệt thiết kế này.
 *
 *  VẤN ĐỀ: chữ nằm TRONG ảnh nên Google không đọc được, máy đọc màn hình cũng
 *  không đọc được. Mục này coi như vô hình với máy tìm kiếm.
 *
 *  CÁCH XỬ LÝ: dưới mỗi ảnh thêm một khối chữ THẬT, chép ĐÚNG NGUYÊN VĂN chữ in
 *  trong ảnh, rồi ẩn đi bằng lớp `sr-only` của Tailwind.
 *    · Người dùng: KHÔNG thấy gì khác, giao diện y như cũ.
 *    · Google và máy đọc màn hình: đọc được đầy đủ nội dung.
 *
 *  ⚠️ VÌ SAO LÀM VẬY KHÔNG BỊ GOOGLE PHẠT:
 *  Google phạt kiểu giấu chữ để LỪA — tức chữ ẩn KHÁC với thứ người dùng thấy.
 *  Ở đây chữ ẩn là bản chép y hệt chữ đang hiện trong ảnh, đúng mục đích mà
 *  `sr-only` sinh ra: nói cho máy biết trong ảnh viết gì. Đây là cách làm chuẩn.
 *  → SAU NÀY SỬA CHỮ TRONG ẢNH thì PHẢI sửa lại chữ dưới đây cho khớp.
 *    Để lệch nhau mới đúng là giấu chữ, lúc đó mới bị phạt thật.
 *
 *  ⚠️ `sr-only` KHÁC `display:none`. display:none thì Google bỏ qua luôn, coi như
 *  không có. Đừng đổi sang `hidden` hay `display:none`.
 * ========================================================================== */

/** [tên file ảnh, tiêu đề in trong ảnh, đoạn mô tả in trong ảnh] */
const SERVICES: [string, string, string][] = [
  ['tra-cuu-quy-hoach', 'Tra cứu quy hoạch',
    'Tra cứu quy hoạch, kế hoạch sử dụng đất, chỉ giới xây dựng và thông tin pháp lý thửa đất…'],
  ['cap-gcn', 'Cấp Giấy chứng nhận (Sổ đỏ)',
    'Cấp lần đầu, cấp đổi, cấp lại, đính chính, cấp sau tách thửa, hợp thửa…'],
  ['dang-ky-bien-dong', 'Đăng ký biến động',
    'Chuyển nhượng, sang tên, tặng cho, thừa kế, góp vốn bằng quyền sử dụng đất, đăng ký hoặc xóa thế chấp, thay đổi thông tin người sử dụng đất, tài sản gắn liền với đất, diện tích, mục đích sử dụng đất, thời hạn sử dụng đất, đăng ký biến động sau tách thửa, hợp thửa và các trường hợp khác…'],
  ['tach-hop-thua', 'Tách thửa – Hợp thửa – Đo đạc',
    'Tách thửa, hợp thửa, trích đo địa chính, đo vẽ hiện trạng, cắm mốc ranh giới, xác định mốc giới, chỉnh lý bản đồ địa chính, lập bản vẽ phục vụ cấp phép xây dựng và các dịch vụ đo đạc khác…'],
  ['chuyen-muc-dich', 'Chuyển mục đích sử dụng đất',
    'Chuyển đất lên thổ cư và các trường hợp chuyển mục đích sử dụng đất khác…'],
  ['tu-van-phap-ly', 'Tư vấn pháp lý đất đai',
    'Tư vấn pháp luật đất đai, mua bán nhà đất, rà soát hồ sơ, giải quyết tranh chấp, khiếu nại, tố cáo, hòa giải, đại diện thực hiện thủ tục hành chính và các vấn đề pháp lý khác…'],
];

export default function ServicesSection({ className = '' }: { className?: string }) {
  /* Khai báo có cấu trúc: nói cho máy tìm kiếm biết đây là DANH SÁCH DỊCH VỤ,
     chứ không phải mấy tấm ảnh rời. Nhờ vậy Google có thể hiện thẳng tên dịch vụ
     trong kết quả tìm kiếm. */
  const duLieuCoCauTruc = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Dịch vụ pháp lý và hồ sơ đất đai tại Cam Lâm, Khánh Hòa',
    itemListElement: SERVICES.map(([, ten, mo], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Service',
        name: ten,
        description: mo.replace(/…$/, ''),
        areaServed: { '@type': 'Place', name: 'Cam Lâm, Khánh Hòa, Việt Nam' },
        provider: { '@type': 'Organization', name: 'Cam Lâm Land' },
      },
    })),
  };

  return (
    <section id="dich-vu-phap-ly" className={`scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 ${className}`}>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(duLieuCoCauTruc) }} />

      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[#0A2540]">Dịch vụ của chúng tôi</h2>
        <p className="mt-1 text-[13px] sm:text-sm font-bold text-[#C8A14B]">Nhanh chóng · Chính xác · Uy tín · Trách nhiệm</p>
        <p className="mx-auto mt-2 max-w-2xl text-[13px] sm:text-sm text-slate-500">Cam Lâm Land hỗ trợ trọn gói thủ tục pháp lý và hồ sơ đất đai tại Cam Lâm – Khánh Hòa, giúp bạn giao dịch an toàn, nhanh gọn, đúng luật.</p>
      </div>

      <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
        {SERVICES.map(([f, ten, mo]) => (
          <div key={f} className="group overflow-hidden rounded-2xl ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/dichvu/${f}.png`} alt={ten} loading="lazy"
              className="block h-auto w-full transition-transform duration-500 group-hover:scale-[1.05]" />

            {/* Chữ thật ẩn BÊN DƯỚI ảnh — chép đúng nguyên văn chữ in trong ảnh.
                Người dùng không thấy, Google và máy đọc màn hình đọc được. */}
            <div className="sr-only">
              <h3>{ten}</h3>
              <p>{mo}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
