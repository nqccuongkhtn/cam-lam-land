// BẢNG ĐỔI SỐ TỜ BẢN ĐỒ — 4 PHƯỜNG NHA TRANG (Tây · Nam · Nha Trang · Bắc)
// ─────────────────────────────────────────────────────────────────────────────
// NGUỒN: bảng đối chiếu số tờ do Văn phòng Đăng ký đất đai lập (chủ dự án chụp ảnh
// ngày 3/9/2026 — 2 tấm, mỗi tấm 2 phường). Bảng in theo từng khối: mỗi phường cũ
// một khối, hàng trên = SỐ TỜ MỚI (tô màu), hàng dưới = SỐ TỜ CŨ. Phường "gốc"
// (phường đã truyền lại mã số cho phường mới) để trống hàng dưới = GIỮ NGUYÊN số tờ.
//
// CÁCH KIỂM CHỨNG (đã làm, không phải đọc suông từ ảnh):
//   1. Cộng độ dài các khối phải đúng bằng số tờ cuối cùng của phường mới.
//   2. Trong dữ liệu địa chính đã có sẵn một ít thửa MANG SỐ TỜ MỚI (do đo vẽ lại).
//      Chồng hình chúng lên các tờ cũ bằng PostGIS → ra đúng cặp (tờ mới ↔ tờ cũ).
//      Có 20 điểm mốc như vậy, TẤT CẢ đều khớp bảng. Ví dụ:
//        · Vĩnh Lương tờ 39 ↔ tờ mới 72   (Bắc Nha Trang)
//        · Vĩnh Hòa   tờ 33 ↔ tờ mới 107  (Bắc Nha Trang)
//        · Vĩnh Hải   tờ 59 ↔ tờ mới 277  (Bắc Nha Trang)
//        · Vĩnh Thọ   tờ 6  ↔ tờ mới 284  (Bắc Nha Trang)
//        · Vĩnh Thạnh tờ 27 ↔ tờ mới 69   (Tây Nha Trang)
//        · Ngọc Hiệp  tờ 45 ↔ tờ mới 114  (Tây Nha Trang)
//        · Phương Sài tờ 7  ↔ tờ mới 151  (Tây Nha Trang)
//        · Vĩnh Trung tờ 30 ↔ tờ mới 203  (Tây Nha Trang)
//        · Phước Hải  tờ 45 ↔ tờ mới 94   (Nam Nha Trang)
//        · Vĩnh Trường tờ 27 ↔ tờ mới 209 (Nam Nha Trang)
//        · Phước Đồng tờ 12 ↔ tờ mới 245  (Nam Nha Trang)
//        · Phước Tân  tờ 14 ↔ tờ mới 24   (Nha Trang)
//        · Tân Lập    tờ 11 ↔ tờ mới 37   (Nha Trang)
//        · Lộc Thọ    tờ 9  ↔ tờ mới 88   (Nha Trang)
//        · Phước Hòa  tờ 8  ↔ tờ mới 122  (Nha Trang)
//        · Vĩnh Nguyên tờ 32 ↔ tờ mới 165 (Nha Trang)
//        · Xương Huân tờ 17 ↔ tờ mới 67   (Nha Trang)
//   3. Chỗ nào bảng bỏ trống số tờ cũ thì dữ liệu cũng đúng là KHÔNG CÓ tờ đó.
//
// ⚠️ BA PHƯỜNG CŨ ĐÃ NHẬP TỪ 1/11/2024 (Nghị quyết 1196) nên bảng gọi bằng TÊN ĐỜI 2024:
//   · "Vạn Thạnh" trong bảng = Vạn Thạnh + Xương Huân + Vạn Thắng, đánh lại 1–41 theo
//     thứ tự Vạn Thạnh 1–12 → 1–12, Xương Huân 1–17 → 13–29, Vạn Thắng 1–12 → 30–41.
//     Căn cứ: mốc Xương Huân tờ 17 ↔ tờ mới 67, và 6 chỗ trống trong bảng (13,14,18,19,
//     25,28) đúng bằng 6 tờ Xương Huân không có trong dữ liệu (1,2,6,7,13,16).
//   · "Tân Tiến" trong bảng = Tân Tiến + Phước Tân + Tân Lập → 1–10, 11–26, 27–44.
//     Căn cứ: 6 điểm mốc hình học (Phước Tân 6→16, 10→20, 14→24, 16→26; Tân Lập 2→28, 11→37).
//   · "Phương Sài" trong bảng = Phương Sài + Phương Sơn → 1–15, 16–29.
//     ⚠️ Chỗ DUY NHẤT chưa có mốc hình học để kiểm; suy ra từ độ dài khối (29 = 15 + 14)
//     và số tờ thật của hai phường. Xem ghi chú CHUA_CHAC bên dưới.
import fs from 'node:fs';

const day = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);   // [a..b]

// Mỗi khối: [mã xã cũ, danh sách số tờ CŨ theo thứ tự tăng dần, số tờ MỚI bắt đầu]
const KHOI = {
  // ── PHƯỜNG TÂY NHA TRANG — 219 tờ ──────────────────────────────────────────
  22390: [
    ['22390', day(1, 42), 1],     // Vĩnh Ngọc — phường gốc, GIỮ NGUYÊN số tờ
    ['22393', day(1, 28), 43],    // Vĩnh Thạnh
    ['22336', day(2, 49), 71],    // Ngọc Hiệp (bảng bắt đầu từ tờ 2)
    ['22399', day(1, 26), 119],   // Vĩnh Hiệp
    ['22351', day(1, 15), 145],   // Phương Sài   ┐ hai phường này nhập với nhau từ 2024,
    ['22354', day(1, 14), 160],   // Phương Sơn   ┘ bảng gộp làm một khối 145–173  (CHUA_CHAC)
    ['22396', day(1, 46), 174],   // Vĩnh Trung
  ],
  // ── PHƯỜNG NAM NHA TRANG — 295 tờ ──────────────────────────────────────────
  22402: [
    ['22402', day(1, 49), 1],     // Vĩnh Thái — phường gốc, GIỮ NGUYÊN
    ['22357', day(1, 52), 50],    // Phước Hải
    ['22378', day(1, 81), 102],   // Phước Long
    ['22381', day(1, 51), 183],   // Vĩnh Trường
    // Phước Đồng: bảng in sẵn tờ cũ 60–65 rồi GẠCH BỎ 60,61,62 và ba số mới cuối (296,297,298);
    // ba tờ 63,64,65 dời lên thành 293,294,295. Dữ liệu xác nhận: 60,61,62 KHÔNG có thửa nào,
    // còn 63/64/65 có 311/1.456/169 thửa nên chắc chắn phải có số tờ mới.
    ['22405', [...day(1, 59), 63, 64, 65], 234],
  ],
  // ── PHƯỜNG NHA TRANG — 204 tờ ──────────────────────────────────────────────
  22366: [
    ['22366', day(1, 10), 1],     // Tân Tiến — phường gốc, GIỮ NGUYÊN
    ['22360', day(1, 16), 11],    // Phước Tân  ┐ ba phường này là khối "Tân Tiến" đời 2024
    ['22369', [...day(1, 17), 19], 27], // Tân Lập ┘ (tờ 18 không tồn tại)
    ['22348', day(1, 12), 45],    // Vạn Thạnh  ┐
    // Xương Huân: tờ cũ k → số đời 2024 là k+12; sáu tờ 1,2,6,7,13,16 không tồn tại nên
    // bảng bỏ trống, các tờ còn lại nhận số mới liên tiếp 57–67.
    ['22342', [3, 4, 5, 8, 9, 10, 11, 12, 14, 15, 17], 57],
    ['22345', day(1, 12), 68],    // Vạn Thắng  ┘
    ['22363', day(1, 35), 80],    // Lộc Thọ
    ['22372', day(1, 19), 115],   // Phước Hòa
    ['22375', day(1, 71), 134],   // Vĩnh Nguyên
  ],
  // ── PHƯỜNG BẮC NHA TRANG — 296 tờ ──────────────────────────────────────────
  22333: [
    ['22333', day(1, 36), 1],     // Vĩnh Phước — phường gốc, GIỮ NGUYÊN
    ['22384', day(4, 41), 37],    // Vĩnh Lương (bảng bắt đầu từ tờ 4)
    ['22327', day(1, 76), 75],    // Vĩnh Hòa
    ['22387', day(3, 70), 151],   // Vĩnh Phương (bảng bắt đầu từ tờ 3)
    ['22330', day(1, 61), 219],   // Vĩnh Hải
    ['22339', [...day(2, 11), ...day(13, 19)], 280], // Vĩnh Thọ (bảng bỏ trống tờ 12)
  ],
};

const ra = [];
for (const [xaMoi, khoi] of Object.entries(KHOI)) {
  let cuoi = 0;
  for (const [xaCu, toCu, batDau] of khoi) {
    if (batDau !== cuoi + 1) throw new Error(`Xã ${xaMoi}: khối của ${xaCu} bắt đầu ${batDau} nhưng khối trước kết thúc ${cuoi} — số tờ mới bị hở/chồng.`);
    toCu.forEach((t, i) => ra.push(`${xaMoi},${batDau + i},${xaCu},${t}`));
    cuoi = batDau + toCu.length - 1;
  }
  console.error(`${xaMoi}: ${cuoi} tờ`);
}
fs.writeFileSync(process.argv[2] || 'bang-so-to-nha-trang.csv', ra.join('\n') + '\n');
console.error(`Tổng ${ra.length} dòng → ${process.argv[2] || 'bang-so-to-nha-trang.csv'}`);
