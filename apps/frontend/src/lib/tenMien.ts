// TÊN MIỀN CỦA WEB — MỘT CHỖ DUY NHẤT (6/10/2026).
// · TEN_MIEN_HIEN_THI: chữ in lên ảnh / PDF / banner / hợp đồng / video (thứ người khác nhìn thấy và chia sẻ đi)
//   → đã là tên miền MỚI batdongsancamlam.vn theo yêu cầu chủ dự án.
// · SITE: địa chỉ CHẠY THẬT dùng cho link chia sẻ, sơ đồ trang gửi Google (sitemap/robots), thẻ canonical.
//   Ngày 6/10/2026 batdongsancamlam.vn CHƯA trỏ về máy chủ (trả 404) → vẫn để tên miền cũ.
//   KHI .vn CHẠY: đặt NEXT_PUBLIC_SITE_URL=https://batdongsancamlam.vn trong .env (hoặc sửa dòng dưới) rồi dựng lại frontend.
//   Nhớ đổi kèm ở máy chủ: WEBAUTHN_RP_ID / WEBAUTHN_ORIGINS / CORS_ORIGINS (.env), nginx/nginx.conf (trang bảo trì),
//   TAI-LEN-KHO.ps1, TAO-TAI-KHOAN.bat, mã QR ở components/SiteFooter.tsx.
export const TEN_MIEN_HIEN_THI = 'batdongsancamlam.vn';
export const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://batdongsancamlam.dpdns.org';
