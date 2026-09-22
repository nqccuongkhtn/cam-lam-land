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

/* ── SỐ PHIÊN BẢN ẢNH ─────────────────────────────────────────────────────
 * ⚠️ ĐỔI ẢNH MÀ GIỮ NGUYÊN TÊN FILE thì trình duyệt VẪN HIỆN ẢNH CŨ — đã vấp
 * ba lần, mỗi lần mất công dựng lại web rồi ngồi soi mới ra. Nguyên nhân:
 * trình duyệt (và cả bộ đệm của nginx) nhớ theo ĐƯỜNG DẪN, đường dẫn không đổi
 * thì nó không thèm tải lại.
 *
 * => MỖI LẦN THAY ẢNH TRONG public/hero/ THÌ TĂNG SỐ NÀY LÊN 1.
 *    Đường dẫn đổi theo nên trình duyệt buộc phải tải ảnh mới.
 * (Nhớ xoá thêm đệm nginx nếu cần: docker exec camlam_nginx sh -c 'rm -rf /var/cache/nginx/*')
 */
export const PHIEN_BAN_ANH = 9;
const v = (duong: string) => `${duong}?v=${PHIEN_BAN_ANH}`;

/* ── Ba slide mặc định ─────────────────────────────────────────────────────
 * NGUỒN ẢNH:
 *   · hero-3: ĐÃ THỬ dùng ảnh thật Cam Lâm (bd-05.jpg) cắt khung toàn cảnh.
 *     Góc nhìn thì đúng ý, nhưng dải biệt thự ở đó dày đặc và khung không thấy
 *     được mặt biển. Nay đổi sang ảnh vịnh biển nhìn từ xa: resort nép bên rừng
 *     cây, bãi cát trắng và MẶT NƯỚC chiếm hẳn một dải ở dưới.
 *     ⚠️ Ảnh này KHÔNG chụp ở Cam Lâm. Ảnh Cam Lâm thật vẫn ở public/bai-dai/.
 *   · hero-1 và hero-2 lấy từ Unsplash (dùng miễn phí, kể cả thương mại),
 *     KHÔNG phải chụp ở Cam Lâm.
 *
 * CÁCH CHỌN ẢNH CHO ĐÚNG — đừng chọn bằng cảm tính, đã sai mấy lần:
 * banner có lớp phủ tối ĐẬM BÊN TRÁI (chỗ đặt chữ). Ảnh nào nửa trái vốn đã
 * tối thì cộng thêm lớp phủ là thành MẢNG ĐEN, nhìn như banner hỏng. Đã vấp:
 * một ảnh nước biển sâu có nửa trái đo được rgb(20,59,65) → sau khi phủ còn
 * gần như đen sì. Ảnh nửa trái nên ở mức trung bình trở lên, và nửa phải phải
 * có màu (xanh biển, cây, mái nhà) chứ đừng xám xịt.
 */
export const BANNERS: Slide[] = [
  {
    ma: 'gioi-thieu',
    anh: v('/hero/hero-1.webp'),
    moTaAnh: 'Biển xanh ngọc, bãi cát trắng và hàng dừa bên khu nghỉ dưỡng ven biển',
    dongNhan: '★ Nền tảng bất động sản & quy hoạch Cam Lâm',
    tieuDe: 'Tìm ngôi nhà mơ ước [[của bạn]]',
    moTa: 'Khám phá hàng ngàn bất động sản và tra cứu quy hoạch chính xác trên toàn khu vực.',
    // Slide đầu cố ý KHÔNG có nút: người dùng vừa vào trang, việc cần làm ngay là
    // ô tìm kiếm ngay bên dưới, thêm nút nữa chỉ làm rối.
    giay: 7,
    // doPhu: số đo được, là mức phủ NHẸ NHẤT mà chữ trắng vẫn đạt tương phản 7
    // (mức tốt nhất theo chuẩn). Phủ nhẹ hơn nữa thì ảnh đẹp hơn nhưng chữ khó đọc.
    doPhu: 50,
  },
  {
    ma: 'ban-do-quy-hoach',
    anh: v('/hero/hero-2.webp'),
    moTaAnh: 'Nhìn từ trên cao thấy rõ tuyến đường, lô đất và nhà cửa ven biển',
    dongNhan: 'Tra cứu quy hoạch',
    tieuDe: 'Bản đồ quy hoạch [[Cam Lâm]]',
    moTa: 'Xem quy hoạch từng thửa, đo diện tích, tra số tờ số thửa ngay trên bản đồ vệ tinh.',
    nutChu: 'Xem bản đồ',
    nutLink: '/map',
    giay: 8,
    doPhu: 54,
  },
  {
    ma: 'ky-gui',
    anh: v('/hero/hero-3.webp'),
    moTaAnh: 'Vịnh biển nhìn từ xa: khu nghỉ dưỡng nép bên rừng cây, bãi cát trắng và mặt nước xanh ngọc',
    dongNhan: 'Miễn phí',
    tieuDe: 'Có nhà đất cần bán hay [[ký gửi]]?',
    moTa: 'Đăng tin lên sàn Cam Lâm Land, tiếp cận khách mua trong khu vực ngay hôm nay.',
    nutChu: 'Gửi bán miễn phí',
    nutLink: '/sales/post',
    giay: 7,
    doPhu: 44,
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

/* ── Tách tiêu đề thành TỪNG TỪ để chạy hiệu ứng lần lượt ──────────────────
 * Banner động kiểu quảng cáo HTML5 hay cho chữ hiện ra từng từ một chứ không
 * bật cả câu cùng lúc — mắt người bám theo được, nhìn "có nghề" hơn hẳn.
 * Vẫn giữ dấu [[...]] để biết từ nào tô vàng.
 */
export function tachTu(s: string): { chu: string; toMau: boolean }[] {
  const ra: { chu: string; toMau: boolean }[] = [];
  for (const manh of tachTieuDe(s)) {
    for (const tu of manh.chu.split(/(\s+)/)) {
      if (!tu) continue;
      if (/^\s+$/.test(tu)) { ra.push({ chu: tu, toMau: manh.toMau }); continue; }
      ra.push({ chu: tu, toMau: manh.toMau });
    }
  }
  return ra;
}

/* ── LÀM SAO ĐỂ ẢNH VẪN SÁNG NHƯ GỐC MÀ CHỮ VẪN DỄ ĐỌC ─────────────────────
 * Cách cũ: phủ tối cả nửa trái tấm ảnh. Chữ đọc tốt nhưng ẢNH BỊ TỐI ĐI HẲN,
 * mất hết cái đẹp của ảnh gốc — đúng như chủ dự án nhận xét.
 *
 * Cách mới, gồm ba lớp, giữ ảnh gần như nguyên bản:
 *   1. Phủ đều CỰC NHẸ (8%) — chỉ để dịu mấy mảng nắng chói, mắt gần như không thấy.
 *   2. MỘT VẦNG TỐI HÌNH BẦU DỤC đặt đúng sau khối chữ, đậm ở giữa rồi tan dần ra
 *      hết. Chỗ có chữ thì tối đủ để đọc, cách đó vài trăm điểm ảnh là ảnh sáng
 *      nguyên bản. Đây là chỗ khác hẳn cách cũ: tối CÓ CHỦ ĐÍCH, không tối cả mảng.
 *   3. Chữ có viền tối bao quanh (text-shadow nhiều lớp, khai trong globals.css).
 *      Viền này bám sát nét chữ nên đọc rõ ngay cả khi lọt vào chỗ nền sáng, mà
 *      không làm tối thêm một điểm ảnh nào của ảnh.
 *
 * KẾT QUẢ ĐO ĐƯỢC (dò tham số trên cả ba ảnh, chọn bộ giữ ảnh sáng nhất mà chữ
 * vẫn đạt chuẩn): độ tương phản chữ 7,11–8,82 (mức tốt nhất cần 7) trong khi
 * NỬA PHẢI TẤM ẢNH GIỮ ĐƯỢC 90% ĐỘ SÁNG GỐC. Cách phủ tối cả mảng lúc đầu chỉ
 * giữ được 73%. Muốn chỉnh thì sửa con số 64% (chỗ dải phủ tan hết): kéo lên thì
 * chữ dễ đọc hơn nhưng ảnh tối đi, kéo xuống thì ngược lại.
 *
 * ⚠️ BẪY ĐÃ VẤP — ĐỌC TRƯỚC KHI SỬA:
 * Trước đây lớp phủ viết bằng class Tailwind `from-slate-900/82 via-slate-900/48
 * to-slate-900/12`. Nhìn code tưởng có, nhưng NGOÀI WEB KHÔNG CÓ GÌ — Tailwind chỉ
 * sinh ra các mức mờ nằm trong bảng có sẵn (/40 /50 /75 /80…), số tự bịa thì nó
 * LẶNG LẼ BỎ QUA, không báo lỗi. Chữ trắng nằm trần trên ảnh biển nắng suốt nhiều
 * lần dựng lại, đo được độ tương phản chỉ 2,1.
 * → Nay TÍNH RA MÀU rồi ghi thẳng bằng style. Đừng quay lại dùng class.
 */
const TOI = '8,20,36';
const pha = (a: number, he: number) => `rgba(${TOI},${Math.max(0, Math.min(0.92, a * he)).toFixed(3)})`;

export function lopPhu(doPhu = 50) {
  const he = Math.max(0, Math.min(80, doPhu)) / 50; // doPhu 50 = hệ số 1

  return {
    /** Phủ đều cực nhẹ — chỉ dịu mấy mảng nắng chói, không làm tối ảnh. */
    nen: pha(0.04, he),

    /** Máy tính: vầng tối bầu dục đặt sau khối chữ (khối chữ nằm ở nửa trái). */
    ngang:
      `linear-gradient(to right, ${pha(0.80, he)} 0%, ${pha(0.56, he)} 26%, ` +
      `rgba(${TOI},0) 64%)`,

    /* Điện thoại: màn hẹp, chữ chạy gần hết bề ngang nên vầng bầu dục không đủ.
       Dùng dải từ trên xuống nhưng CHỈ PHỦ PHẦN TRÊN (nơi có chữ), xuống tới 66%
       là tan hết — nửa dưới tấm ảnh giữ nguyên độ sáng gốc. */
    doc:
      `linear-gradient(to bottom, ${pha(0.62, he)} 0%, ${pha(0.48, he)} 38%, ` +
      `${pha(0.12, he)} 66%, rgba(${TOI},0) 100%)`,

    /** Đầu trang — cho thanh menu và logo không chìm vào nền sáng. */
    tren: `linear-gradient(to bottom, ${pha(0.40, he)}, rgba(${TOI},0))`,

    /** Đáy — cho hàng chip loại hình tách khỏi nền. */
    duoi: `linear-gradient(to top, ${pha(0.42, he)}, rgba(${TOI},0))`,
  };
}
