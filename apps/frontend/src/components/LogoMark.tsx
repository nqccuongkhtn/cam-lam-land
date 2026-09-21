/* ============================================================================
 *  DẤU HIỆU THƯƠNG HIỆU CAM LÂM LAND — một nguồn duy nhất cho mọi chỗ.
 * ----------------------------------------------------------------------------
 *  VÌ SAO VẼ LẠI:
 *  Dấu cũ là một ngôi nhà nét mảnh trong khung bo tròn — mẫu này có hàng vạn, nhìn
 *  là biết lấy từ bộ biểu tượng có sẵn, không nói được nghề của mình.
 *
 *  Ý MỚI lấy từ đúng thứ công việc này làm: MỘT THỬA ĐẤT TRÊN BẢN ĐỒ ĐỊA CHÍNH.
 *    • Hình bốn cạnh KHÔNG ĐỀU — thửa đất thật không bao giờ vuông vức.
 *    • Ba mốc giới ở góc — dấu hiệu riêng của bản đồ địa chính, không lẫn đi đâu.
 *    • Một nét mảnh cắt chéo — đường tách thửa.
 *  Bỏ nét sóng "mặt nước Đầm Thuỷ Triều" đã thử lúc đầu: thu xuống cỡ biểu tượng thì
 *  nó rời hẳn khỏi hình thửa, thành một vệt lạ nằm lơ lửng.
 *
 *  VẼ BẰNG SVG CHỨ KHÔNG PHẢI CANVAS: logo cần sắc nét ở mọi cỡ, từ 16px trên
 *  thanh địa chỉ tới bảng hiệu in khổ lớn. SVG là hình vẽ theo toạ độ nên phóng
 *  bao nhiêu cũng sắc; canvas là ảnh chấm điểm, phóng lên là vỡ, lại không đọc
 *  được bằng trình đọc màn hình và không tô được màu bằng CSS.
 * ========================================================================== */
import Link from 'next/link';

/** Chỉ riêng hình thửa đất — dùng khi đã có nền sẵn (ghim bản đồ, con dấu, giấy tờ). */
export function HinhThuaDat({ mau = '#C8A14B', day = 2.4, nhat = 0.5 }:
  { mau?: string; day?: number; nhat?: number }) {
  return (
    <g fill="none" stroke={mau} strokeLinecap="round" strokeLinejoin="round">
      {/* Thửa đất — bốn cạnh không đều, đúng như thửa ngoài thực địa */}
      <path d="M11.2 17.2 L29.8 12.2 L33.2 27 L14.8 32.4 Z" strokeWidth={day} />
      {/* Đường tách thửa — cắt CHÉO và LỆCH TÂM.
          Lúc đầu vẽ nét này thẳng đứng ở chính giữa, thu nhỏ xuống cỡ biểu tượng thì
          cả hình đọc thành CÁI KHUNG ẢNH có gáy sách ở giữa, không ra thửa đất. */}
      <path d="M26.6 13.4 L18.2 31.4" strokeWidth={day * 0.5} strokeOpacity={nhat} />
      {/* Ba mốc giới ở góc — dấu hiệu riêng của bản đồ địa chính */}
      <circle cx="11.2" cy="17.2" r={day * 0.66} fill={mau} stroke="none" />
      <circle cx="29.8" cy="12.2" r={day * 0.66} fill={mau} stroke="none" />
      <circle cx="33.2" cy="27" r={day * 0.66} fill={mau} stroke="none" />
    </g>
  );
}

/** Dấu hiệu đầy đủ: nền chữ nhật bo tròn màu navy + hình thửa đất. */
export function LogoMark({ size = 36, id = 'cl' }: { size?: number; id?: string }) {
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} className="shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-nen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#123459" /><stop offset="1" stopColor="#081B30" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="12" fill={`url(#${id}-nen)`} />
      <rect x="1.2" y="1.2" width="41.6" height="41.6" rx="10.8" fill="none"
        stroke="#C8A14B" strokeOpacity="0.4" strokeWidth="1.1" />
      <HinhThuaDat />
    </svg>
  );
}

/** Dấu hiệu + tên thương hiệu, bấm vào về trang chủ. */
export function LogoDayDu({ light }: { light: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <LogoMark size={36} id="cl-nav" />
      <span className="leading-tight">
        <span className={`block text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-[#0A2540]'}`}>
          Cam Lâm <span className="text-[#C8A14B]">Land</span>
        </span>
        <span className={`hidden whitespace-nowrap text-[10px] font-medium tracking-wide lg:block ${light ? 'text-white/75' : 'text-slate-400'}`}>
          Phát triển bởi Nguyễn Quốc Cường
        </span>
      </span>
    </Link>
  );
}
