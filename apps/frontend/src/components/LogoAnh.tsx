/* ============================================================================
 *  LOGO CAM LÂM LAND — MỘT CHỖ DUY NHẤT
 * ----------------------------------------------------------------------------
 *  ⚠️ MỌI CHỖ CẦN HIỆN LOGO ĐỀU DÙNG THÀNH PHẦN NÀY, đừng vẽ lại bằng SVG.
 *
 *  VÌ SAO: trước đây logo được vẽ tay bằng SVG ở chín chỗ khác nhau (màn hình
 *  chờ, ô đăng nhập, thẻ tin, cẩm nang, phiếu trích lục, hợp đồng…) — mà lại
 *  là HAI kiểu ngôi nhà khác nhau, vẽ ở hai hệ toạ độ khác nhau, chạy song
 *  song. Đổi logo của web là phải đi sửa đủ chín chỗ, sót một chỗ là web có
 *  hai logo cùng lúc mà rất khó phát hiện.
 *
 *  Nay tất cả trỏ về đúng hai tệp ảnh:
 *      /logo-cam-lam.webp        nét sáng — đặt trên nền TỐI (navy, ảnh chụp)
 *      /logo-cam-lam-toi.webp    nét navy — đặt trên nền SÁNG (trắng, xám nhạt)
 *  Hai tệp đó do scripts/dung-logo.py dựng ra từ ảnh logo gốc, và
 *  scripts/dong-bo-logo.py dựng luôn icon ứng dụng + màn hình chờ + logo ngày
 *  lễ từ cùng tấm ảnh ấy. Đổi logo = chạy một lệnh, cả web theo.
 *
 *  Cách dùng:
 *      <LogoAnh cao={32} />                 trên nền sáng (mặc định)
 *      <LogoAnh cao={32} nenToi />          trên nền tối
 *      <LogoAnh cao={24} lop="opacity-90" />
 *
 *  Tỉ lệ ngang/dọc của logo là 1,51 — thành phần tự tính bề ngang theo chiều
 *  cao, nên không bao giờ bị bóp méo.
 * ========================================================================== */

/** Tỉ lệ ngang/dọc của tệp logo (435×288). Đổi logo khác tỉ lệ thì sửa ở đây. */
export const TI_LE_LOGO = 1.51;

export default function LogoAnh({
  cao = 32, nenToi = false, lop = '',
}: {
  /** Chiều cao mong muốn, tính bằng điểm ảnh. */
  cao?: number;
  /** true = đang đặt trên nền TỐI → dùng bản nét sáng. */
  nenToi?: boolean;
  lop?: string;
}) {
  const rong = Math.round(cao * TI_LE_LOGO);
  return (
    <img
      src={nenToi ? '/logo-cam-lam.webp' : '/logo-cam-lam-toi.webp'}
      alt="" aria-hidden="true"
      width={rong} height={cao}
      style={{ width: rong, height: cao }}
      className={`shrink-0 object-contain ${lop}`}
    />
  );
}
