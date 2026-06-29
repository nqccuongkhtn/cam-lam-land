export interface Pkg { id: string; name: string; kind: 'post' | 'boost'; tier?: 'normal' | 'silver' | 'gold' | 'diamond'; boosts?: number; posts?: number; days: number; price: number; perks: string[]; popular?: boolean; }

export const PACKAGES: Pkg[] = [
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
];
export const TIER_RANK: Record<string, number> = { normal: 0, silver: 1, gold: 2, diamond: 3 };
export const findPkg = (id: string): Pkg | undefined => PACKAGES.find((p) => p.id === id);
export const BANK = { bankId: process.env.BANK_ID || 'BIDV', account: process.env.BANK_ACCOUNT || '8855951682', name: process.env.BANK_NAME || 'NGUYEN QUOC CUONG', demo: process.env.BANK_DEMO === 'true' };
