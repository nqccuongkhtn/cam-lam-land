// ── CẮT HÌNH CHÍNH XÁC cho phần tính quy hoạch (10/10/2026) ──
// Trước đây diện tích từng loại đất = (số điểm mẫu rơi vào loại đó / tổng điểm) × diện tích thửa, lưới 44×44 điểm.
// Sai số ±0,2–0,4 m²/thửa: chủ dự án thử thửa 70 tờ 25 Cam Đức thấy QĐ893 ra 395,1 trong khi cắt hình chính xác
// là 395,28. Giờ phần nằm TRONG Ô ĐẤT được cắt hình chính xác (thư viện polygon-clipping, MIT); điểm mẫu chỉ còn dùng
// để CHIA phần khe hở / ô trùm thành các loại (đường hay không), và để QUYẾT ĐỊNH như cũ.
import pc from 'polygon-clipping';

export type MP = number[][][][];   // MultiPolygon: [đa giác][vòng][điểm][x,y] — vòng đầu là vòng ngoài, sau là lỗ

/** Diện tích (m²) của MultiPolygon toạ độ độ, quy ra mét bằng hệ số kx, ky tại vĩ độ thửa. */
export function dienTichMP(mp: MP, kx: number, ky: number): number {
  let s = 0;
  for (const poly of mp) for (let i = 0; i < poly.length; i++) {
    const r = poly[i]; let a = 0;
    for (let j = 0, k = r.length - 1; j < r.length; k = j++) a += r[k][0] * r[j][1] - r[j][0] * r[k][1];
    s += (i === 0 ? 1 : -1) * Math.abs(a) / 2;
  }
  return Math.max(0, s) * kx * ky;
}

/** Điểm (x,y) có nằm trong MultiPolygon không (luật chẵn–lẻ trên mọi vòng). */
export function trongMP(x: number, y: number, mp: MP): boolean {
  let ins = false;
  for (const poly of mp) for (const r of poly) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
  }
  return ins;
}

/** Lấy tối đa N×N điểm lưới đều NẰM TRONG MultiPolygon (để chia phần khe hở / ô trùm thành các loại). */
export function diemTrongMP(mp: MP, N = 24): number[][] {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const poly of mp) for (const [x, y] of poly[0]) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  const ra: number[][] = [];
  for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
    const x = minx + (maxx - minx) * (ix + 0.5) / N, y = miny + (maxy - miny) * (iy + 0.5) / N;
    if (trongMP(x, y, mp)) ra.push([x, y]);
  }
  // Mảnh quá mảnh để lưới trúng: lấy điểm giữa của các đoạn nối đỉnh liên tiếp gần nhau (vẫn nằm trong mảnh)
  if (!ra.length) for (const poly of mp) { const r = poly[0]; for (let i = 0; i + 2 < r.length && ra.length < 8; i++) { const x = (r[i][0] + r[i + 1][0] + r[i + 2][0]) / 3, y = (r[i][1] + r[i + 1][1] + r[i + 2][1]) / 3; if (trongMP(x, y, mp)) ra.push([x, y]); } }
  return ra;
}

/**
 * Cắt thửa theo DANH SÁCH Ô ĐÃ XẾP THEO ƯU TIÊN (ô đứng trước thắng): phần thửa còn lại ∩ ô 1 → của ô 1, bỏ đi; ∩ ô 2 …
 * Đúng y luật chọn ô của KhoO.chuaK (bậc cao thắng, cùng bậc ô nhỏ thắng) nhưng tính chính xác thay vì từng điểm.
 * Trả về các mảnh theo ô + phần còn lại (khe hở, không thuộc ô nào).
 */
/** Xén một vòng theo khung chữ nhật (Sutherland–Hodgman). Phần nằm TRONG khung giữ y nguyên → giao với thửa (nằm gọn
 *  trong khung) không đổi; chỉ bớt đỉnh ở xa. Ô QĐ893 có ô 9.683 đỉnh làm phép cắt chạy ~8 giây rồi lỗi (thửa 487988). */
function xenKhung(r: number[][], x0: number, y0: number, x1: number, y1: number): number[][] {
  let out = r;
  const canh: [(p: number[]) => boolean, (a: number[], b: number[]) => number[]][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]],
  ];
  for (const [trong, cat] of canh) {
    const vao = out; out = [];
    for (let i = 0; i < vao.length; i++) {
      const cur = vao[i], prev = vao[(i + vao.length - 1) % vao.length];
      const ci = trong(cur), pi = trong(prev);
      if (ci) { if (!pi) out.push(cat(prev, cur)); out.push(cur); } else if (pi) out.push(cat(prev, cur));
    }
    if (!out.length) return out;
  }
  return out;
}

// LÀM TRÒN TOẠ ĐỘ tới 1e-9 độ (~0,1 mm) trước mọi phép cắt (10/10/2026). Thư viện polygon-clipping có lỗi đã biết: gặp đỉnh gần
// trùng nhau tới mức sai số dấu phẩy động thì lặp vô tận tới hết bộ nhớ — thửa 693 tờ 15 Cam Đức (id 151481) với ô 503 làm chết
// tiến trình tính sẵn, và nếu khách bấm vào thửa đó thì kéo sập cả máy chủ web. So 3.000 thửa: phần cắt hình không đổi.
const TRON = 1e9;
const tron = (r: number[][]) => r.map(([x, y]) => [Math.round(x * TRON) / TRON, Math.round(y * TRON) / TRON]);
const tronMP = (mp: MP): MP => mp.map((poly) => poly.map(tron));

export function catTheoUuTien(ring: number[][], zones: { k: number; ring: number[][] }[]): { manh: { k: number; mp: MP }[]; con: MP; thua: MP } {
  // Chuẩn hoá hình thửa trước (thửa TỰ CẮT CHÉO — vd phiếu 3354 — thì công thức diện tích thường ra số sai, kéo hệ số
  // quy đổi lên gấp 7 lần). Diện tích thửa phải đo trên CHÍNH hình đã chuẩn hoá này cho cùng hệ với các mảnh cắt.
  const thua = tronMP(pc.union([tron(ring)] as any) as MP);
  let con: MP = thua;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const e = Math.max(x1 - x0, y1 - y0) * 0.01 + 1e-7; x0 -= e; y0 -= e; x1 += e; y1 += e;   // nới khung chút cho mép thửa không trùng mép xén
  const manh: { k: number; mp: MP }[] = [];
  for (const z of zones) {
    if (!con.length) break;
    const xr = xenKhung(z.ring, x0, y0, x1, y1);
    if (xr.length < 3) continue;
    const zg: MP = [[tron(xr)]];
    const g = pc.intersection(con as any, zg as any) as MP;
    if (g.length) { manh.push({ k: z.k, mp: g }); con = tronMP(pc.difference(con as any, zg as any) as MP); }
  }
  return { manh, con, thua };
}
