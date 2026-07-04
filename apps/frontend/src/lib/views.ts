// LUOT XEM HIEN THI = luot xem THAT (khach click) + phan "moi" tich luy dan.
//
// Cai tien: tin MOI dang KHONG nhay so ngay. Phan moi tich luy DAN theo tuoi tin
// (bang 0 luc vua dang, tang nhanh vai tuan dau roi cham lai va bao hoa) - giong
// cach mot tin that hut view. Toan bo phan moi lai GIAM ve 0 trong NAM DAU cua web.
//
// Cong thuc:
//   grow(tuoiTin) = 1 - exp(-tuoiTin / tau)   // 0 luc moi, tien dan toi 1 (tau ~ 16-34 ngay/tin)
//   yearFade      = 1 - (nay - ngayMoWeb)/1nam // kep trong 0..1; het nam dau = 0
//   moi           = tong(tin) * hangVIP * grow * yearFade
//   HIEN THI      = luotThat + moi
//
// Tin vua dang: moi ~ 0, chi hien luot xem THAT. Khach cang click, so that cang
// cong them len tren phan moi. DB luon giu so that; day chi la lop hien thi.
// Doi ngay mo web ben duoi hoac dat NEXT_PUBLIC_SITE_LAUNCH = 'YYYY-MM-DD'.
const DAY = 86_400_000;
const YEAR = 365 * DAY;
const SITE_LAUNCH = new Date(process.env.NEXT_PUBLIC_SITE_LAUNCH || '2026-07-01T00:00:00+07:00').getTime();

function hash(n: number): number { return Math.imul((n | 0) ^ 0x9e3779b9, 2654435761) >>> 0; }

/** Phan "moi" cong them cho 1 tin: tich luy dan theo tuoi tin, ve 0 sau nam dau. */
export function fakeBoost(l: { id: number; createdAt?: string; tier?: string }, now = Date.now()): number {
  const yearFade = Math.max(0, Math.min(1, 1 - (now - SITE_LAUNCH) / YEAR));
  if (yearFade <= 0) return 0;
  const ageDays = l.createdAt ? Math.max(0, (now - new Date(l.createdAt).getTime()) / DAY) : 30;
  const tierMult = l.tier === 'diamond' ? 2.4 : l.tier === 'gold' ? 1.8 : l.tier === 'silver' ? 1.3 : 1;
  const total = (60 + (hash(l.id) % 140)) * tierMult; // tong moi toi da cua tin (~60-200 x hang)
  const tau = 16 + (hash(l.id >> 3) % 18);            // hang so thoi gian 16-34 ngay (moi tin khac)
  const grow = 1 - Math.exp(-ageDays / tau);         // 0 luc moi, tien dan toi 1
  return Math.round(total * grow * yearFade);
}

/** Luot xem de HIEN THI = luot xem that + moi. (Ket hop lop ghi nho o card qua viewedReal.) */
export function displayViews(l: { id: number; views?: number; createdAt?: string; tier?: string }, now = Date.now()): number {
  return (l.views || 0) + fakeBoost(l, now);
}

// ── Lop "ghi nho luot xem" phia client ──────────────────────────────────────
// Trang chi tiet tang +1 o DB, nhung trang danh sach da nap tu truoc nen con so cu.
// Ta ghi so luot THAT moi nhat vao localStorage; moi card doc lai de hien nhat quan
// ngay tren MOI trang (danh sach, trang chu, trang moi gioi...) ma khong can tai lai.
const VKEY = 'camlam_viewed_v1';
function readOverlay(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(VKEY) || '{}'); } catch { return {}; }
}
/** Ghi nho so luot xem THAT moi nhat cua 1 tin (goi o trang chi tiet sau khi tai xong). */
export function rememberViews(id: number, realViews: number): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const o = readOverlay();
    if ((o[id] || 0) < realViews) {
      o[id] = realViews;
      localStorage.setItem(VKEY, JSON.stringify(o));
      window.dispatchEvent(new Event('views-change'));
    }
  } catch { /* ignore */ }
}
/** So luot xem THAT da ghi nho cho 1 tin (0 neu chua co). */
export function viewedReal(id: number): number {
  return readOverlay()[id] || 0;
}
