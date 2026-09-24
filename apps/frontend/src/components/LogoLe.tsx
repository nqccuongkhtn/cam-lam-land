/* ============================================================================
 *  LOGO NGÀY LỄ — có hiệu ứng động
 * ----------------------------------------------------------------------------
 *  Dùng ở hai nơi và PHẢI GIỐNG NHAU:
 *    · thanh menu (components/Nav.tsx) — chỗ khách nhìn thấy;
 *    · trang quản lý lịch (/quan-tri/logo-le) — để xem trước đúng cái sẽ hiện.
 *  Gom vào một thành phần nên sửa hiệu ứng một chỗ là hai nơi cùng đổi.
 *
 *  ⚠️ Ô VUÔNG LOGO KHÔNG BAO GIỜ ĐỘNG — kể cả trong logo ngày lễ. Nó là
 *     biểu tượng của web, phải đứng vững (chủ dự án dặn đi dặn lại).
 *     Vì thế mỗi dịp lễ có HAI TẤM ẢNH chồng lên nhau:
 *         /logo-le/<mã>-nen.webp   ô vuông logo   → ĐỨNG YÊN
 *         /logo-le/<mã>-tt.webp    phần trang trí → mới được động
 *     Trước đây chỗ này dùng MỘT tấm ghép sẵn (<mã>.webp) rồi cho cả tấm lắc
 *     — tức là ô vuông logo lắc theo. Đúng cái chủ dự án cấm.
 *     (Tấm ghép sẵn vẫn giữ, dùng cho ảnh xem trước và chỗ nào cần một tệp.)
 *
 *  Hiệu ứng (khai trong app/globals.css) — CHỈ ÁP CHO LỚP TRANG TRÍ:
 *    · mọi dịp   — lắc rất nhẹ + ba đốm lấp lánh;
 *    · dịp có cờ — VẪY CỜ qua lại quanh chân cột cờ;
 *    · Giáng sinh— thêm ông già Noel cưỡi xe tuần lộc chạy ngang 2 phút/lần;
 *    · ngày tưởng niệm (27/7, 19/5, Giỗ Tổ, Vu Lan, rằm tháng Giêng) — KHÔNG
 *      nhún nhảy, chỉ sáng dần lên;
 *    · riêng TẾT — thêm PHÁO BÔNG nhiều màu (xem phần dưới).
 * ========================================================================== */

/** Những dịp trang nghiêm: không nhún nhảy, không lấp lánh. */
const TRANG_NGHIEM = new Set(['tri-an', 'sen', 'gio-to', 'vu-lan', 'nhang']);

/** Dịp nào được bắn pháo bông. */
const CO_PHAO = new Set(['tet', 'tet-duong']);

/** Dịp có lá cờ trong phần trang trí → cho cờ vẫy qua lại.
 *  ⚠️ Danh sách này phải khớp với DIP trong scripts/dung-logo-ngay-le.py:
 *     thêm cờ vào dịp nào thì thêm mã dịp đó vào đây, không thì cờ đứng im. */
const CO_VAY = new Set(['quoc-khanh', '30-4', 'dang', 'dien-bien', 'quan-doi', 'lao-dong']);

/* ── PHÁO BÔNG ───────────────────────────────────────────────────────────────
   Làm bằng THẺ + CSS chứ không dùng canvas: canvas phải chạy vòng lặp vẽ liên
   tục, mà logo thì nằm trên mọi trang — tốn pin điện thoại vô ích. Thẻ + CSS
   thì trình duyệt tự lo, chạy trên card đồ hoạ, gần như không tốn gì.

   Mỗi quả pháo = 12 đốm bay toả đều ra rồi rơi xuống và tắt dần. Ba quả nổ
   lệch nhau và lệch cả chỗ, nên nhìn như pháo bông thật chứ không phải một
   hình lặp đi lặp lại. */
const MAU_PHAO = ['#FFD24A', '#FF5B5B', '#4ADEFF', '#FF8AD8', '#8AFF9E', '#FFF1A8'];
const QUA_PHAO = [
  { x: '14%', y: '-38%', tre: '0s', xa: 26 },
  { x: '86%', y: '-22%', tre: '2.4s', xa: 21 },
  { x: '50%', y: '-52%', tre: '4.8s', xa: 30 },
];
const SO_DOM = 12;

function PhaoBong() {
  return (
    <span className="cl-phao" aria-hidden>
      {QUA_PHAO.map((q, qi) => (
        <span key={qi} className="cl-phao-qua" style={{ left: q.x, top: q.y, animationDelay: q.tre }}>
          {Array.from({ length: SO_DOM }, (_, i) => {
            const g = (i * 360) / SO_DOM;
            return (
              <i key={i} style={{
                ['--dx' as any]: `${(Math.cos((g * Math.PI) / 180) * q.xa).toFixed(1)}px`,
                ['--dy' as any]: `${(Math.sin((g * Math.PI) / 180) * q.xa).toFixed(1)}px`,
                background: MAU_PHAO[(i + qi * 2) % MAU_PHAO.length],
                animationDelay: q.tre,
              }} />
            );
          })}
        </span>
      ))}
    </span>
  );
}

export default function LogoLe({
  ma, light, cao = 32,
}: {
  /** Mã bản logo lễ, ví dụ 'tet'. */
  ma: string;
  /** true = đang đặt trên nền TỐI → dùng bản nét sáng. */
  light: boolean;
  cao?: number;
}) {
  const rong = Math.round(cao * 1.51);
  const duoi = light ? '' : '-toi';          // nền tối dùng bản nét sáng
  const o = { width: rong, height: cao };
  return (
    <span className={`cl-logo-le${CO_VAY.has(ma) ? ' co-vay' : ''}`}
      data-le={ma} style={o}>
      {/* Lớp 1 — Ô VUÔNG LOGO. Không hiệu ứng nào được chạm vào lớp này. */}
      <img className="cl-le-nen" src={`/logo-le/${ma}-nen${duoi}.webp`}
        alt="" aria-hidden="true" width={rong} height={cao} style={o} />
      {/* Lớp 2 — TRANG TRÍ của dịp lễ. Mọi hiệu ứng động nằm ở đây. */}
      <img className="cl-le-tt" src={`/logo-le/${ma}-tt${duoi}.webp`}
        alt="" aria-hidden="true" width={rong} height={cao} style={o} />
      {/* Giáng sinh: ông già Noel cưỡi xe tuần lộc chạy ngang qua, 2 phút một
          lần, hiện ra một chỗ rồi biến mất ở chỗ khác như chui qua cửa không
          gian (chủ dự án mô tả đúng như vậy). */}
      {ma === 'noel' && <b className="cl-noel-xe" aria-hidden />}
      {!TRANG_NGHIEM.has(ma) && (<><i aria-hidden /><i aria-hidden /><i aria-hidden /></>)}
      {CO_PHAO.has(ma) && <PhaoBong />}
    </span>
  );
}
