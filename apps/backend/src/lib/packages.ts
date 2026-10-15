export interface Pkg { id: string; name: string; kind: 'post' | 'boost' | 'video' | 'chung'; tier?: 'normal' | 'silver' | 'gold' | 'diamond'; boosts?: number; posts?: number; days: number; price: number; perks: string[]; popular?: boolean; }

// Giá & thời hạn gói TẠO VIDEO BẢN ĐỒ — xem ghi chú ở cuối danh sách PACKAGES bên dưới.
export const VIDEO_PRICE = Number(process.env.VIDEO_PKG_PRICE || 0);  // 0 = chưa đặt giá
export const VIDEO_DAYS = Number(process.env.VIDEO_PKG_DAYS || 30);
// Quyền lợi GÓI CHỨC NĂNG CHUNG (gói thành viên) — dùng chung cho 4 mức thời hạn ở đầu danh sách PACKAGES bên dưới.
const QUYEN_GOI_CHUNG = ['Tra cứu toàn bộ kho văn bản: số ký hiệu, ngày ban hành, mở đọc tệp', 'Tính giá đền bù, bồi thường (đủ số liệu, máy tính)', 'Bản đồ quy hoạch Cam Lâm đầy đủ: QĐ205, phân khu 1/2000, xem gần, quy hoạch từng thửa'];

export const PACKAGES: Pkg[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  //  GÓI CHỨC NĂNG CHUNG (15/10/2026) — mở MỌI tính năng trả phí chung (lib/auth.ts coGoiChung)
  // ═══════════════════════════════════════════════════════════════════════════
  //  Chủ dự án: "trả phí chia ra là các chức năng chung, còn trả phí mua gói số tin đăng, đẩy tin hay quảng cáo bản đồ là chức năng
  //  riêng". Gói này = tra cứu văn bản + tính giá đền bù + bản đồ quy hoạch Cam Lâm đầy đủ (trừ 1/500). Các gói bên dưới (đăng tin,
  //  đẩy tin, video) và quảng cáo bản đồ (thẻ "Quảng cáo" ở trang quản trị) là chức năng RIÊNG, mua riêng.
  //  ►►► BẢNG GIÁ "ĐĂNG KÝ THÀNH VIÊN" (chủ dự án 15/10/2026, gửi mẫu 4 gói: "bỏ gói 1 tháng thay bằng 3 tháng giá 299, thay số 50 thành 68
  //      hết"): 3 tháng 299K · 6 tháng 568K · 1 năm 1068K · 2 năm 1968K. Sửa giá / thời hạn ở 4 dòng dưới là xong (trang dịch vụ, hộp
  //      "tính năng trả phí", khung quản trị đều đọc từ đây). Mua gói còn hạn thì CỘNG DỒN ngày (payments.ts activate).
  { id: 'tv3t', name: 'Gói 3 tháng', kind: 'chung', days: 90, price: 299000, perks: [...QUYEN_GOI_CHUNG, 'Hiệu lực 3 tháng'] },
  { id: 'tv6t', name: 'Gói 6 tháng', kind: 'chung', days: 180, price: 568000, perks: [...QUYEN_GOI_CHUNG, 'Hiệu lực 6 tháng'] },
  { id: 'tv1n', name: 'Gói 1 năm', kind: 'chung', days: 365, price: 1068000, popular: true, perks: [...QUYEN_GOI_CHUNG, 'Hiệu lực 1 năm'] },
  { id: 'tv2n', name: 'Gói 2 năm', kind: 'chung', days: 730, price: 1968000, perks: [...QUYEN_GOI_CHUNG, 'Hiệu lực 2 năm'] },
  // ===== GÓI ĐĂNG TIN (30 ngày) — miễn phí 3 tin/tháng =====
  { id: 'post20', name: 'Đăng 20 tin', kind: 'post', posts: 20, days: 30, price: 119000,
    perks: ['Đăng tối đa 20 tin/tháng', 'Tin hiển thị bình thường', 'Hiệu lực 30 ngày'] },
  { id: 'post50', name: 'Đăng 50 tin', kind: 'post', posts: 50, days: 30, price: 239000,
    perks: ['Đăng tối đa 50 tin/tháng', 'Phù hợp môi giới', 'Hiệu lực 30 ngày'] },
  { id: 'post100', name: 'Đăng 100 tin', kind: 'post', posts: 100, days: 30, price: 449000, popular: true,
    perks: ['Đăng tối đa 100 tin/tháng', 'Môi giới đăng nhiều', 'Hiệu lực 30 ngày'] },
  { id: 'post300', name: 'Đăng 300 tin', kind: 'post', posts: 300, days: 30, price: 1299000,
    perks: ['Đăng tối đa 300 tin/tháng', 'Cho môi giới chuyên', 'Hiệu lực 30 ngày'] },
  { id: 'post1000', name: 'Đăng 1000 tin', kind: 'post', posts: 1000, days: 30, price: 3999000,
    perks: ['Đăng tối đa 1000 tin/tháng', 'Cho sàn / đại lý lớn', 'Hiệu lực 30 ngày'] },
  // ===== GÓI ĐẨY TIN (20 ngày, đều 20 lượt — khác nhau ở HẠNG hiển thị) =====
  { id: 'boostnormal', name: 'Đẩy Thường', kind: 'boost', tier: 'normal', boosts: 20, days: 20, price: 499000,
    perks: ['20 lượt đẩy lên đầu', 'Tin hiển thị thường (không VIP)', 'Hiệu lực 20 ngày'] },
  { id: 'silver', name: 'VIP Bạc', kind: 'boost', tier: 'silver', boosts: 20, days: 20, price: 2999000,
    perks: ['Tin hiển thị hạng VIP Bạc', '20 lượt đẩy tin', 'Tự nổi lại mỗi 24 giờ', 'Hiệu lực 20 ngày'] },
  { id: 'gold', name: 'VIP Vàng', kind: 'boost', tier: 'gold', boosts: 20, days: 20, price: 4999000, popular: true,
    perks: ['Tin hiển thị hạng VIP Vàng', '20 lượt đẩy tin', 'Tự nổi lại mỗi 12 giờ', 'Ưu tiên trên hạng Bạc', 'Hiệu lực 20 ngày'] },
  { id: 'diamond', name: 'VIP Kim Cương', kind: 'boost', tier: 'diamond', boosts: 20, days: 20, price: 9999000,
    perks: ['Tin hiển thị hạng VIP Kim Cương', '20 lượt đẩy tin', 'Tự nổi lại mỗi 6 giờ', 'Luôn nằm trên cùng', 'Tiêu đề nổi bật màu đỏ', 'Hiệu lực 20 ngày'] },

  // ═══════════════════════════════════════════════════════════════════════════
  //  GÓI TẠO VIDEO BẢN ĐỒ  —  bán RIÊNG, không dính gì tới gói đăng tin / đẩy tin
  // ═══════════════════════════════════════════════════════════════════════════
  //  ►►► CHỖ ĐẶT GIÁ: sửa 2 số ở ngay dưới (VIDEO_PRICE và VIDEO_DAYS) là xong.
  //      Hoặc đổi trong file .env mà KHÔNG cần sửa code:
  //          VIDEO_PKG_PRICE=499000     (giá bán, đơn vị đồng)
  //          VIDEO_PKG_DAYS=30          (dùng được bao nhiêu ngày)
  //  Để giá = 0 nghĩa là CHƯA ĐẶT GIÁ: trang dịch vụ sẽ hiện "Liên hệ" và
  //  không cho bấm mua; admin vẫn cấp quyền tay được cho từng tài khoản.
  { id: 'video', name: 'Tạo video bản đồ', kind: 'video', days: VIDEO_DAYS, price: VIDEO_PRICE,
    perks: ['Tạo video bản đồ không giới hạn', 'Đủ 6 kịch bản dựng sẵn', 'Xuất MP4 1080p · xuất cả bộ ZIP', 'AI viết kịch bản', `Hiệu lực ${VIDEO_DAYS} ngày`] },
];
export const TIER_RANK: Record<string, number> = { normal: 0, silver: 1, gold: 2, diamond: 3 };
export const findPkg = (id: string): Pkg | undefined => PACKAGES.find((p) => p.id === id);
export const BANK = { bankId: process.env.BANK_ID || 'BIDV', account: process.env.BANK_ACCOUNT || '8855951682', name: process.env.BANK_NAME || 'NGUYEN QUOC CUONG', demo: process.env.BANK_DEMO === 'true' };
