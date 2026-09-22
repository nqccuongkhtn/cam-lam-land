'use client';
/* ============================================================================
 *  KHỐI "DỊCH VỤ CỦA CHÚNG TÔI" — dùng chung, đặt cuối các trang tiện ích.
 * ----------------------------------------------------------------------------
 *  ⚠️ ĐÃ BỎ 6 TẤM ẢNH Ở public/dichvu/. Lý do (đừng quay lại cách cũ):
 *    · Mỗi tấm là một thẻ do AI vẽ sẵn, mỗi thẻ một màu một lối vẽ → chắp vá.
 *    · Chữ bị NUNG THẲNG VÀO ẢNH: không bôi chọn được, không tìm được, máy tìm
 *      kiếm không đọc ra, người khiếm thị nghe không được, mờ trên màn nét cao,
 *      và muốn sửa một chữ thì phải vẽ lại cả tấm ảnh.
 *    · Sáu tấm nặng hơn 1 MB cho một mục chỉ có 6 dòng chữ.
 *
 *  NAY: chữ là CHỮ THẬT trong HTML (bôi chọn được, tìm được, máy tìm kiếm đọc
 *  được, sửa chỉ việc gõ lại), còn biểu tượng là ẢNH CHỤP THẬT cắt vuông, để ở
 *  public/dichvu-icon/. Cả sáu tấm xử lý cùng một kiểu (cùng cỡ, cùng mức màu,
 *  cùng độ tương phản) nên nhìn ra ngay là MỘT BỘ, không chắp vá như ảnh AI cũ.
 *  Tổng dung lượng 96 KB — nhẹ hơn bộ cũ hơn 11 lần.
 *
 *  ⚠️ ĐÃ THỬ vẽ biểu tượng bằng NÉT (SVG một màu) và chủ dự án không ưng: muốn
 *     biểu tượng CÓ MÀU, nhìn như ảnh thật. Nên đừng quay lại kiểu vẽ nét.
 * ========================================================================== */
type DichVu = { anh: string; ten: string; mo: string };

/* Mô tả viết bằng ĐÚNG TỪ NGỮ CỦA LUẬT ĐẤT ĐAI, không dùng tiếng lóng thị trường
   ("sang tên", "làm sổ") — cả trang web thống nhất một lối gọi. */
const DICH_VU: DichVu[] = [
  { anh: 'tra-cuu-quy-hoach', ten: 'Tra cứu quy hoạch',
    mo: 'Tra quy hoạch, kế hoạch sử dụng đất, chỉ giới xây dựng và thông tin pháp lý của từng thửa.' },
  { anh: 'cap-gcn', ten: 'Cấp Giấy chứng nhận',
    mo: 'Cấp lần đầu, cấp đổi, cấp lại, đính chính; cấp sau tách thửa, hợp thửa.' },
  { anh: 'dang-ky-bien-dong', ten: 'Đăng ký biến động',
    mo: 'Chuyển nhượng, tặng cho, thừa kế, góp vốn; thay đổi thông tin người sử dụng đất, thế chấp.' },
  { anh: 'tach-hop-thua', ten: 'Tách thửa · Hợp thửa · Đo đạc',
    mo: 'Đo vẽ hiện trạng, trích đo địa chính, cắm mốc ranh giới, xác định mốc giới.' },
  { anh: 'chuyen-muc-dich', ten: 'Chuyển mục đích sử dụng đất',
    mo: 'Chuyển đất nông nghiệp lên đất ở và các trường hợp chuyển mục đích khác.' },
  { anh: 'tu-van-phap-ly', ten: 'Tư vấn pháp lý đất đai',
    mo: 'Rà soát hồ sơ, giải quyết tranh chấp, khiếu nại, tố cáo; hoà giải và đại diện thủ tục.' },
];

export default function ServicesSection({ className = '' }: { className?: string }) {
  return (
    <section id="dich-vu-phap-ly" className={`scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 ${className}`}>
      <div className="text-center">
        <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#0A2540] sm:text-2xl">Dịch vụ của chúng tôi</h2>
        <p className="mt-1 text-[13px] font-bold text-[#C8A14B] sm:text-sm">Nhanh chóng · Chính xác · Uy tín · Trách nhiệm</p>
        <p className="mx-auto mt-2 max-w-2xl text-[13px] text-slate-500 sm:text-sm">
          Cam Lâm Land hỗ trợ trọn gói thủ tục pháp lý và hồ sơ đất đai tại Cam Lâm – Khánh Hòa,
          giúp bạn giao dịch an toàn, nhanh gọn, đúng luật.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {DICH_VU.map(({ anh, ten, mo }) => (
          <div key={ten}
            className="group flex gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-[#C8A14B]/50 hover:shadow-lg sm:flex-col sm:gap-2.5 sm:p-4">
            {/* Biểu tượng = ảnh chụp thật, cắt vuông. Cùng cỡ, cùng bo góc, cùng
                mức màu cho cả 6 mục nên nhìn ra ngay là một bộ. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/dichvu-icon/${anh}.webp`} alt="" aria-hidden="true"
              loading="lazy" decoding="async"
              className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 transition-transform duration-300 group-hover:scale-105 sm:h-16 sm:w-16" />
            <div className="min-w-0">
              <h3 className="font-bold leading-snug text-[#0A2540]">{ten}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{mo}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
