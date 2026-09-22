/* ============================================================================
 *  BANNER ĐỘNG Ở ĐẦU TRANG CHỦ — DỮ LIỆU CÁC SLIDE
 * ----------------------------------------------------------------------------
 *  GIAI ĐOẠN 1: dữ liệu để tạm ở file này. Sang giai đoạn 2 sẽ chuyển vào
 *  database + trang quản trị, lúc đó file này chỉ còn là bản dự phòng khi
 *  database chưa có banner nào.
 *
 *  SỬA NỘI DUNG BANNER: sửa thẳng trong mảng BANNERS bên dưới rồi dựng lại web.
 *
 *  MẸO TÔ MÀU CHỮ: trong `tieuDe`, bọc phần muốn tô vàng bằng hai ngoặc vuông.
 *      'Tìm ngôi nhà mơ ước [[của bạn]]'   →   "của bạn" hiện màu vàng.
 * ========================================================================== */

export interface Slide {
  /** Khoá riêng, không trùng nhau. */
  ma: string;
  /** Ảnh nền — đặt trong apps/frontend/public. */
  anh: string;
  /** Ảnh riêng cho điện thoại (không bắt buộc). Để trống thì dùng chung ảnh trên. */
  anhDienThoai?: string;
  /** Chữ mô tả ảnh cho người khiếm thị và cho máy tìm kiếm. */
  moTaAnh: string;
  /** Tiêu điểm của ảnh khi bị cắt, kiểu CSS object-position. Mặc định '50% 50%'. */
  tieuDiem?: string;

  /** Dòng nhỏ phía trên tiêu đề. */
  dongNhan?: string;
  /** Tiêu đề. Dùng [[...]] để tô vàng một đoạn. */
  tieuDe: string;
  /** Câu mô tả dưới tiêu đề. */
  moTa?: string;
  /** Nút bấm. Bỏ trống cả hai thì slide không có nút. */
  nutChu?: string;
  nutLink?: string;

  /** Slide này dừng bao lâu rồi chuyển (giây). Mặc định 7. */
  giay?: number;
  /**
   * Độ đậm lớp phủ tối, 0–80. 0 = không phủ (ảnh sáng nguyên bản, chữ khó đọc),
   * 50 = mức chuẩn đã đo cho chữ trắng đọc rõ trên ảnh biển nắng.
   * Ảnh càng sáng thì để càng cao.
   */
  doPhu?: number;
}

/* ── Ba slide mặc định ─────────────────────────────────────────────────────
 * Ảnh lấy từ public/hero/ — ba khung cắt từ ảnh chụp thật Bãi Dài Cam Lâm.
 */
export const BANNERS: Slide[] = [
  {
    ma: 'gioi-thieu',
    anh: '/hero/hero-1.webp',
    moTaAnh: 'Toàn cảnh biệt thự ven biển, bãi cát trắng và mặt biển Bãi Dài, Cam Lâm',
    dongNhan: '★ Nền tảng bất động sản & quy hoạch Cam Lâm',
    tieuDe: 'Tìm ngôi nhà mơ ước [[của bạn]]',
    moTa: 'Khám phá hàng ngàn bất động sản và tra cứu quy hoạch chính xác trên toàn khu vực.',
    // Slide đầu cố ý KHÔNG có nút: người dùng vừa vào trang, việc cần làm ngay là
    // ô tìm kiếm ngay bên dưới, thêm nút nữa chỉ làm rối.
    giay: 7,
    doPhu: 50,
  },
  {
    ma: 'ban-do-quy-hoach',
    anh: '/hero/hero-3.webp',
    moTaAnh: 'Khu resort ven biển và tuyến đường ven biển Cam Lâm nhìn từ trên cao',
    dongNhan: 'Tra cứu quy hoạch',
    tieuDe: 'Bản đồ quy hoạch [[Cam Lâm]]',
    moTa: 'Xem quy hoạch từng thửa, đo diện tích, tra số tờ số thửa ngay trên bản đồ vệ tinh.',
    nutChu: 'Xem bản đồ',
    nutLink: '/map',
    giay: 8,
    doPhu: 52,
  },
  {
    ma: 'ky-gui',
    anh: '/hero/hero-2.webp',
    moTaAnh: 'Bãi cát dài và sóng vỗ bờ ở Bãi Dài, Cam Lâm',
    dongNhan: 'Miễn phí',
    tieuDe: 'Có nhà đất cần bán hay [[ký gửi]]?',
    moTa: 'Đăng tin lên sàn Cam Lâm Land, tiếp cận khách mua trong khu vực ngay hôm nay.',
    nutChu: 'Gửi bán miễn phí',
    nutLink: '/sales/post',
    giay: 7,
    doPhu: 50,
  },
];

/* ── Tách [[...]] trong tiêu đề thành các mẩu để tô màu ──────────────────── */
export function tachTieuDe(s: string): { chu: string; toMau: boolean }[] {
  const ra: { chu: string; toMau: boolean }[] = [];
  const re = /\[\[(.+?)\]\]/g;
  let i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > i) ra.push({ chu: s.slice(i, m.index), toMau: false });
    ra.push({ chu: m[1], toMau: true });
    i = m.index + m[0].length;
  }
  if (i < s.length) ra.push({ chu: s.slice(i), toMau: false });
  return ra.length ? ra : [{ chu: s, toMau: false }];
}

/* ── Lớp phủ tối cho chữ đọc được ───────────────────────────────────────────
 * ⚠️ BẪY ĐÃ VẤP — ĐỌC TRƯỚC KHI SỬA:
 * Trước đây lớp phủ viết bằng class Tailwind `from-slate-900/82 via-slate-900/48
 * to-slate-900/12`. Nhìn code tưởng có, nhưng NGOÀI WEB KHÔNG CÓ GÌ — Tailwind chỉ
 * sinh ra các mức mờ nằm trong bảng có sẵn (/40 /50 /75 /80…), số tự bịa thì nó
 * LẶNG LẼ BỎ QUA, không báo lỗi. Chữ trắng nằm trần trên ảnh biển nắng suốt nhiều
 * lần dựng lại. Đo được: độ tương phản chỉ 2,1–4,6 (mức đọc tối thiểu là 4,5).
 * → Nay TÍNH RA MÀU rồi ghi thẳng bằng style. Đừng quay lại dùng class.
 *
 * Số gốc dưới đây ứng với doPhu = 50, đã đo trên cả ba ảnh: tương phản 8,9–12,3.
 */
const TOI = '8,20,36';
const pha = (a: number, he: number) => `rgba(${TOI},${Math.max(0, Math.min(0.92, a * he)).toFixed(3)})`;

export function lopPhu(doPhu = 50) {
  const he = Math.max(0, Math.min(80, doPhu)) / 50; // doPhu 50 = hệ số 1

  return {
    /** Phủ đều rất nhẹ — dịu bớt mấy mảng nắng gắt. */
    nen: pha(0.20, he),

    /** Máy tính: đậm bên TRÁI nơi đặt chữ, nhạt dần sang phải để còn thấy biển. */
    ngang:
      `linear-gradient(to right, ${pha(0.74, he)} 0%, ${pha(0.62, he)} 30%, ` +
      `${pha(0.34, he)} 62%, ${pha(0.06, he)} 100%)`,

    /* Điện thoại KHÔNG dùng được kiểu trái→phải: màn chỉ rộng ~430px nên chữ chạy
       gần hết bề ngang, đuôi câu rơi vào chỗ phủ nhạt (~10%) → nằm trên cát trắng,
       đọc không ra. Khổ nhỏ phủ TỪ TRÊN XUỐNG và đều tay hơn. */
    doc:
      `linear-gradient(to bottom, ${pha(0.62, he)} 0%, ${pha(0.56, he)} 55%, ${pha(0.42, he)} 100%)`,

    /** Đầu trang — cho thanh menu và logo không chìm vào mấy toà nhà trắng. */
    tren: `linear-gradient(to bottom, ${pha(0.45, he)}, rgba(${TOI},0))`,

    /** Đáy — cho hàng chip loại hình tách khỏi nền cát sáng. */
    duoi: `linear-gradient(to top, ${pha(0.50, he)}, rgba(${TOI},0))`,
  };
}
