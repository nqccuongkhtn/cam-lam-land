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

// moc=false: không gắn mốc #dich-vu-phap-ly (khi trang có HAI bản của khối này, tránh trùng mốc).
// gon=true: bản THU NHỎ dưới ô "… cần đăng nhập" của Tiện ích (chủ dự án 30/9/2026: "hơi to, phải kéo xuống") —
// lưới ảnh hẹp lại (máy tính 3 thẻ trong khung ~896px thay vì cả bề rộng), tiêu đề nhỏ, bỏ đoạn giới thiệu.
// nho12: lưới 6 thẻ còn 88% bề rộng, căn giữa (chủ dự án 30/9/2026 "nhỏ lại 12%" — dưới ô đăng nhập Tiện ích).
export default function ServicesSection({ className = '', moc = true, gon = false, nho12 = false }: { className?: string; moc?: boolean; gon?: boolean; nho12?: boolean }) {
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
    <section id={moc ? 'dich-vu-phap-ly' : undefined} className={`scroll-mt-24 rounded-2xl border border-slate-200 bg-white ${gon ? 'p-3 sm:p-4' : 'p-4 sm:p-6'} ${className}`}>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(duLieuCoCauTruc) }} />

      <div className="text-center">
        <h2 className={`${gon ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'} font-extrabold uppercase tracking-tight text-[#0A2540]`}>Dịch vụ của chúng tôi</h2>
        <p className="mt-1 text-[13px] sm:text-sm font-bold text-[#C8A14B]">Nhanh chóng · Chính xác · Uy tín · Trách nhiệm</p>
        <p className={`mx-auto mt-2 max-w-2xl text-[13px] sm:text-sm text-slate-500 ${gon ? 'hidden' : ''}`}>Cam Lâm Land hỗ trợ trọn gói thủ tục pháp lý và hồ sơ đất đai tại Cam Lâm – Khánh Hòa, giúp bạn giao dịch an toàn, nhanh gọn, đúng luật.</p>
      </div>

      {/* ĐIỆN THOẠI: thẻ dịch vụ là DẢI VUỐT NGANG, mỗi thẻ ~82% bề ngang (chủ dự án 2/10/2026: lưới 2 cột
          làm chữ in trong ảnh quá nhỏ, không đọc được). Máy tính / máy tính bảng giữ lưới như cũ. */}
      <div className={gon ? 'mx-auto mt-3 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3' : `-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 ${nho12 ? 'sm:mx-auto sm:w-[88%]' : ''}`}>
        {SERVICES.map(([f, ten, mo]) => (
          <div key={f} className={`group overflow-hidden rounded-2xl ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:ring-slate-200 ${gon ? '' : 'w-[82%] shrink-0 snap-center sm:w-auto'}`}>
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
      {!gon && <p className="mt-1 text-center text-[11.5px] text-slate-400 sm:hidden">Vuốt ngang để xem thêm dịch vụ →</p>}
    </section>
  );
}
