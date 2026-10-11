// ── DIỆN TÍCH TRÊN MẶT PHẲNG VN-2000 — đo như sổ đỏ và MicroStation (11/10/2026) ──
// Sổ đỏ, bản đồ địa chính, bản vẽ quy hoạch, MicroStation đều đo diện tích trên MẶT PHẲNG CHIẾU VN-2000 (Khánh Hoà: kinh tuyến trục
// 108°15', múi 3°, k0 = 0,9999). Còn ST_Area(geography) của PostGIS đo trên MẶT ELIPXOIT — lệch đúng hệ số k² (k = tỉ lệ chiếu ở
// chỗ thửa, lớn dần khi xa kinh tuyến trục): Cam Lâm (~100 km) diện tích phẳng lớn hơn 0,0044 %, Vạn Ninh (~125 km) +0,02 %,
// Khánh Sơn (~60 km) −0,005 %.
// Ví dụ thửa 1297 tờ 15 Cam Đức: sổ / nhãn bản vẽ 3.788,5 — mặt phẳng 3.788,50 — elipxoit 3.788,33 (web từng ghi 3.788,3).
// Đo 21.000 thửa ngẫu nhiên: số thửa có diện tích trùng khít số sổ (làm tròn 0,1 m²) tăng từ 31–74 % lên 61–88 % tuỳ vùng.
// Công thức tỉ lệ chiếu chuẩn của phép chiếu TM (UTM): k = k0·(1 + (1 + e'²·cos²φ)·A²/2), A = (λ − λ0)·cos φ (radian);
// số hạng bậc 4 < 1e-8 nên bỏ. Lấy tại tâm thửa (thửa vài ha thì k đổi < 1e-8 trong thửa).
// ⚠️ Mọi chỗ lấy diện tích thửa để TÍNH quy hoạch phải dùng CÙNG biểu thức này (routes/parcels.ts, scripts/tinhSanQh.ts) —
// diện tích là một phần "dấu" của kết quả lưu sẵn (qhLuu.dauThua), lệch nhau là không dùng được bản lưu.

const KINH_TUYEN_TRUC = 108.25;   // 108°15' — VN-2000 Khánh Hoà (Ninh Thuận cũ cũng 108°15')
const K0 = 0.9999;
const E2P = 0.00673949674;        // e'² của elipxoit WGS-84 (VN-2000 dùng elipxoit WGS-84)

/** Biểu thức SQL: hệ số k² (diện tích phẳng VN-2000 / diện tích elipxoit) tại tâm của hình `cot` (EPSG:4326). */
export function sqlHeSoPhang(cot: string): string {
  const lat = `radians(ST_Y(ST_Centroid(${cot})))`;
  const A = `(radians(ST_X(ST_Centroid(${cot})) - ${KINH_TUYEN_TRUC}) * cos(${lat}))`;
  return `power(${K0} * (1 + (1 + ${E2P} * power(cos(${lat}), 2)) * power(${A}, 2) / 2), 2)`;
}

/** Biểu thức SQL: diện tích (m²) của hình `cot` (EPSG:4326) trên mặt phẳng VN-2000 — như sổ đỏ / MicroStation. */
export function sqlDienTichPhang(cot: string): string {
  return `(ST_Area(${cot}::geography) * ${sqlHeSoPhang(cot)})`;
}
