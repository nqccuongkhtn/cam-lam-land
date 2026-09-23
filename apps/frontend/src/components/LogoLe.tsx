/* ============================================================================
 *  LOGO NGÀY LỄ — có hiệu ứng động
 * ----------------------------------------------------------------------------
 *  Dùng ở hai nơi và PHẢI GIỐNG NHAU:
 *    · thanh menu (components/Nav.tsx) — chỗ khách nhìn thấy;
 *    · trang quản lý lịch (/quan-tri/logo-le) — để xem trước đúng cái sẽ hiện.
 *  Gom vào một thành phần nên sửa hiệu ứng một chỗ là hai nơi cùng đổi.
 *
 *  ⚠️ LOGO NGÀY THƯỜNG KHÔNG BAO GIỜ ĐỘNG. Nó là ngôi nhà — biểu tượng của
 *     web, phải đứng vững. Chỉ logo NGÀY LỄ mới nhún nhảy.
 *
 *  Hiệu ứng (khai trong app/globals.css):
 *    · mọi dịp   — lắc rất nhẹ + ba đốm lấp lánh;
 *    · ngày tưởng niệm (27/7, 19/5, Giỗ Tổ, Vu Lan, rằm tháng Giêng) — KHÔNG
 *      nhún nhảy, chỉ sáng dần lên;
 *    · riêng TẾT — thêm PHÁO BÔNG nhiều màu (xem phần dưới).
 * ========================================================================== */

/** Những dịp trang nghiêm: không nhún nhảy, không lấp lánh. */
const TRANG_NGHIEM = new Set(['tri-an', 'sen', 'gio-to', 'vu-lan', 'nhang']);

/** Dịp nào được bắn pháo bông. */
const CO_PHAO = new Set(['tet', 'tet-duong']);

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
  return (
    <span className="cl-logo-le" data-le={ma} style={{ width: rong, height: cao }}>
      <img src={`/logo-le/${ma}${light ? '' : '-toi'}.webp`}
        alt="" aria-hidden="true" width={rong} height={cao}
        style={{ width: rong, height: cao }}
        className="shrink-0 object-contain" />
      {!TRANG_NGHIEM.has(ma) && (<><i aria-hidden /><i aria-hidden /><i aria-hidden /></>)}
      {CO_PHAO.has(ma) && <PhaoBong />}
    </span>
  );
}
