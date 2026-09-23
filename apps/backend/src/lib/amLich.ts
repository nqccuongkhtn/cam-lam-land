// ĐỔI NGÀY DƯƠNG ↔ NGÀY ÂM (âm lịch Việt Nam)
// ============================================
// Dùng cho lịch đổi logo theo ngày lễ: Tết Nguyên đán, Giỗ Tổ Hùng Vương (10/3
// âm), Tết Trung thu (15/8 âm) đều tính theo âm lịch nên mỗi năm rơi vào một
// ngày dương khác nhau.
//
// ⚠️ VÌ SAO PHẢI TÍNH CHỨ KHÔNG CHÉP BẢNG:
//    Cách nhanh là chép sẵn "Tết 2026 là 17/2, 2027 là 6/2…". Nhưng chép tay
//    thì (a) sai một ngày là logo Tết hiện lệch mà không ai biết, (b) hết bảng
//    (vài năm nữa) là web âm thầm quay về logo thường đúng dịp Tết.
//    Tính bằng thuật toán thì đúng mãi mãi, không phải bảo trì.
//
// ⚠️ MÚI GIỜ LÀ THỨ QUYẾT ĐỊNH. Âm lịch Việt Nam tính theo giờ Hà Nội (+7),
//    âm lịch Trung Quốc tính theo +8 — hai bên LỆCH NHAU ĐÚNG MỘT NGÀY ở một
//    số năm (điểm sóc rơi vào khoảng nửa đêm). Luôn truyền MUI_GIO = 7.
//
// Thuật toán là bản chuẩn của Hồ Ngọc Đức (dựa trên thuật toán của Edward M.
// Reingold & Nachum Dershowitz), đã được dùng rộng rãi cho lịch Việt Nam.

export const MUI_GIO = 7;

const PI = Math.PI;

/** Đổi ngày dương lịch → số ngày Julius (đếm liên tục từ năm 4713 TCN). */
export function jdTuNgay(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y
    + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

/** Đổi ngược: số ngày Julius → [ngày, tháng, năm] dương lịch. */
export function ngayTuJd(jd: number): [number, number, number] {
  let a: number, b: number, c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = b * 100 + d - 4800 + Math.floor(m / 10);
  return [day, month, year];
}

/** Thời điểm trăng mới (điểm sóc) lần thứ k tính từ 1/1/1900, theo ngày Julius. */
function trangMoi(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat: number;
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  return Jd1 + C1 - deltat;
}

/** Ngày (số nguyên, giờ Việt Nam) chứa điểm sóc lần thứ k. */
function ngayTrangMoi(k: number, muiGio: number): number {
  return Math.floor(trangMoi(k) + 0.5 + muiGio / 24);
}

/** Kinh độ mặt trời (đơn vị: 1/30 vòng — tức mỗi bước là một trung khí). */
function kinhDoMatTroi(jdn: number, muiGio: number): number {
  const T = (jdn - 2451545.5 - muiGio / 24) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - PI * 2 * Math.floor(L / (PI * 2));
  return Math.floor((L / PI) * 6);
}

/** Ngày bắt đầu tháng 11 âm lịch của năm dương yy. */
function thangMot11(yy: number, muiGio: number): number {
  const off = jdTuNgay(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = ngayTrangMoi(k, muiGio);
  const sunLong = kinhDoMatTroi(nm, muiGio);
  if (sunLong >= 9) nm = ngayTrangMoi(k - 1, muiGio);
  return nm;
}

/** Vị trí tháng nhuận trong năm âm lịch bắt đầu từ tháng 11 ở ngày a11. */
function thangNhuan(a11: number, muiGio: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = kinhDoMatTroi(ngayTrangMoi(k + i, muiGio), muiGio);
  do {
    last = arc;
    i += 1;
    arc = kinhDoMatTroi(ngayTrangMoi(k + i, muiGio), muiGio);
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Ngày dương → [ngày âm, tháng âm, năm âm, có phải tháng nhuận (0/1)]. */
export function duongSangAm(dd: number, mm: number, yy: number,
                            muiGio = MUI_GIO): [number, number, number, number] {
  const dayNumber = jdTuNgay(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = ngayTrangMoi(k + 1, muiGio);
  if (monthStart > dayNumber) monthStart = ngayTrangMoi(k, muiGio);
  let a11 = thangMot11(yy, muiGio);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = thangMot11(yy - 1, muiGio);
  } else {
    lunarYear = yy + 1;
    b11 = thangMot11(yy + 1, muiGio);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = thangNhuan(a11, muiGio);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) lunarLeap = 1;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return [lunarDay, lunarMonth, lunarYear, lunarLeap];
}

/** Ngày âm → [ngày, tháng, năm] dương lịch. */
export function amSangDuong(lunarD: number, lunarM: number, lunarY: number,
                            lunarLeap = 0, muiGio = MUI_GIO): [number, number, number] {
  let a11: number;
  let b11: number;
  if (lunarM < 11) {
    a11 = thangMot11(lunarY - 1, muiGio);
    b11 = thangMot11(lunarY, muiGio);
  } else {
    a11 = thangMot11(lunarY, muiGio);
    b11 = thangMot11(lunarY + 1, muiGio);
  }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarM - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = thangNhuan(a11, muiGio);
    let leapM = leapOff - 2;
    if (leapM < 0) leapM += 12;
    if (lunarLeap !== 0 && lunarM !== leapM) return [0, 0, 0];   // không có tháng nhuận đó
    if (lunarLeap !== 0 || off >= leapOff) off += 1;
  }
  const monthStart = ngayTrangMoi(k + off, muiGio);
  return ngayTuJd(monthStart + lunarD - 1);
}

/** Ngày dương (chuỗi YYYY-MM-DD) của một ngày ÂM trong một năm dương.
 *  Ví dụ ngayAmTrongNam(15, 8, 2026) → rằm Trung thu năm 2026.
 *  Trả về null nếu năm đó không có ngày âm ấy (tháng thiếu).                 */
export function ngayAmTrongNam(ngayAm: number, thangAm: number, namDuong: number): string | null {
  // Năm âm lịch gần như trùng năm dương với mọi tháng 1–12 (trừ mấy ngày đầu
  // tháng Giêng có thể rơi sang năm dương sau) → thử đúng năm âm = năm dương.
  const [d, m, y] = amSangDuong(ngayAm, thangAm, namDuong);
  if (!d) return null;
  if (y !== namDuong) return null;      // rơi sang năm khác thì năm này không có
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
