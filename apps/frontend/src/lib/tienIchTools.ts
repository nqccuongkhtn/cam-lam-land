import type { HubTool } from '@/components/HubShell';

// Danh sách công cụ Tiện ích — DÙNG CHUNG cho trang /tien-ich (hub) và sheet ở thanh dưới
// → mọi nơi luôn ĐẦY ĐỦ & đồng bộ (thêm/bớt công cụ chỉ sửa 1 chỗ này).
// crm cần đăng nhập; tra-cuu (danh sách nóng) & pdf đặt cuối.
export const TIEN_ICH_TOOLS: HubTool[] = [
  // Ô đặc biệt: KHÔNG mở trang, mà mở khung CHAT cộng đồng (action) — xử lý ở runToolAction.
  { key: 'cong-dong', name: 'Cộng đồng', desc: 'Chat cộng đồng đầu tư Cam Lâm', icon: '💬', path: '', action: 'chat:community' },
  { key: 'cam-nang', name: 'Cẩm nang pháp lý', desc: 'Thủ tục & kinh nghiệm mua bán nhà đất', icon: '📘', path: '/cam-nang' },
  { key: 'van-ban', name: 'Tra cứu văn bản', desc: 'Văn bản, nghị quyết, quy định nhà đất', icon: '📑', path: '/van-ban' },
  { key: 'bang-gia-dat', name: 'Bảng giá đất', desc: 'Bảng giá đất Khánh Hòa 2026 (NQ 15/2025)', icon: '🏷️', path: '/bang-gia-dat' },
  { key: 'gia-dat', name: 'Giá đất & định giá nhanh', desc: 'Giá tham khảo theo khu vực + tính theo m²', icon: '💰', path: '/gia-dat' },
  { key: 'den-bu', name: 'Giá đền bù & tính bồi thường', desc: 'Đất nông nghiệp bị thu hồi — giá từng thôn, tính tiền', icon: '💵', path: '/den-bu' },
  { key: 'qr', name: 'Tra cứu QR sổ đỏ', desc: 'Quét mã QR trên giấy tờ thửa đất', icon: '🔎', path: '/qr' },
  { key: 'tra-so-ban-do', name: 'Tra cứu số tờ bản đồ', desc: 'Số tờ bản đồ cũ ↔ mới sau sáp nhập', icon: '🔄', path: '/tra-so-ban-do' },
  { key: 'hop-dong-dat-coc', name: 'Hợp đồng đặt cọc', desc: 'Soạn & in hợp đồng đặt cọc nhà đất', icon: '📝', path: '/hop-dong-dat-coc' },
  { key: 'crm', name: 'CRM khách hàng', desc: 'Quản lý khách hàng & giao dịch', icon: '👥', path: '/sales/crm', login: true },
  { key: 'tra-cuu', name: 'Tra cứu danh sách nóng', desc: 'Thửa đất ngăn chặn / hồ sơ nóng (nội bộ)', icon: '🔥', path: '/tra-cuu', vaiTro: ['admin', 'hotlist'] }, // chỉ tài khoản được cấp quyền mới THẤY ô này
  // Kho danh mục hồ sơ KHÔNG còn ô riêng — nó nằm ngay trong trang này ở tab thứ hai.
  { key: 'lap-danh-muc', name: 'Lập danh mục hồ sơ', desc: 'Scan PDF → danh mục lưu trữ Excel tự động + kho danh mục', icon: '🗂️', path: '/lap-danh-muc' },
  { key: 'tao-video-ban-do', name: 'Tạo video bản đồ', desc: 'Khoanh lô, vẽ tuyến, bay vệ tinh → xuất MP4', icon: '🎬', path: '/tao-video-ban-do' },
  { key: 'pdf', name: 'Chỉnh sửa PDF', desc: 'Sửa chữ, ghép/tách, chuyển đổi, OCR, ký PDF', icon: '📄', path: '/pdf' },
  // CÔNG CỤ NỘI BỘ: chỉ tài khoản được cấp quyền mới THẤY ô này (xem locTheoQuyen trong HubShell).
  { key: 'ma-xac-thuc', name: 'Mã xác thực 2 lớp', desc: 'Mã Google Authenticator của tài khoản dùng chung (nội bộ)', icon: '🔐', path: '/ma-xac-thuc', vaiTro: ['admin', 'xacthuc'] },
  { key: 'tra-cuu-luat', name: 'Tra cứu & học Luật Đất đai', desc: 'Toàn văn luật + nghị định, tra theo chủ đề, ghim điều để học (nội bộ)', icon: '⚖️', path: '/tra-cuu-luat', vaiTro: ['admin'] },
];
