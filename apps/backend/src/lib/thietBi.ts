// ── GIỚI HẠN THIẾT BỊ + SỔ THIẾT BỊ CỦA TỪNG TÀI KHOẢN (10/10/2026) ──
// Chủ dự án: "khoá 1 tài khoản chỉ đăng nhập được 3 thiết bị … muốn reset thiết bị thì phải liên hệ Zalo admin, reset
// 1 lần phí 100k … để tránh 1 người mua tài khoản share cho nhiều người", và "có phần quản lý thiết bị đang đăng nhập
// của tài khoản 1 cách chi tiết nhất … để có thể nói chuyện khi khách chối là chưa đăng nhập đủ 3 thiết bị".
//
// HAI PHẦN, BẬT/TẮT RIÊNG:
//   1. SỔ THIẾT BỊ — LUÔN GHI (kể cả khi chưa bật giới hạn): mỗi máy (mã ngẫu nhiên trình duyệt tự sinh, lưu ở
//      localStorage, gửi kèm mọi yêu cầu qua header X-Thiet-Bi) + loại máy / hệ điều hành / trình duyệt / màn hình /
//      IP / quốc gia, lần đầu – lần hoạt động cuối – lần đăng nhập cuối, số lần đăng nhập. Kèm LẦN ĐĂNG NHẬP CUỐI của tài
//      khoản (cả lần BỊ CHẶN) và 10 TRA CỨU GẦN NHẤT → bằng chứng khi khách chối. Chủ dự án dặn chỉ giữ chừng đó cho nhẹ:
//      mỗi tài khoản chỉ vài chục dòng, không phình theo thời gian.
//   2. GIỚI HẠN — chỉ chạy khi cờ `gioi_han_thiet_bi` bật (trang quản trị). Máy MỚI thứ (giới hạn + 1) bị chặn đăng
//      nhập; thẻ đăng nhập gắn với mã máy nên chép thẻ sang máy khác không dùng được; admin gỡ máy là máy đó bị
//      đăng xuất ngay. Admin / tài khoản quản trị không bị giới hạn.
// Mã máy là số ngẫu nhiên MỖI TRÌNH DUYỆT tự sinh (web không đọc được số máy thật: số sê-ri, MAC, IMEI — trình duyệt chặn).
// ⚠️ GỘP CÙNG MÁY (13/10/2026 — chủ dự án: "tôi chỉ đăng nhập 2 máy mà nhỉ", sổ ghi 3/3; hỏi "kiểm tra dựa vào mã phần cứng
// được không"): cửa sổ ẩn danh, hồ sơ trình duyệt khác, trình duyệt khác, xoá dữ liệu trình duyệt… đều sinh MÃ MỚI → một máy bị
// đếm thành nhiều máy. Nay mã lạ mà PHẦN CỨNG giống hệt một máy đã có (loại máy, hệ điều hành, màn hình, số nhân CPU, RAM,
// cảm ứng, múi giờ, tên card đồ hoạ…) VÀ cùng mạng (cùng IP; IPv6 cùng 64 bit đầu) thì gộp vào máy đó (cột ma_phu), không
// chiếm thêm chỗ. Bắt buộc cùng mạng vì phần cứng của hai máy cùng đời (hai iPhone cùng loại) giống hệt nhau — bỏ điều kiện
// này thì người ở nơi khác dùng máy cùng loại cũng bị gộp, giới hạn 3 máy mất tác dụng. Xem laCungMay.
import type { Request } from 'express';
import { query, pool } from './db.ts';
import { isFlagOn } from './flags.ts';
import { laAdmin, verifyToken } from './auth.ts';

export const CO_GIOI_HAN = 'gioi_han_thiet_bi';
export const TOI_DA_MAC_DINH = Number(process.env.THIET_BI_TOI_DA || 3);
export const ZALO_ADMIN = process.env.ZALO_ADMIN || '0988888888';
export const PHI_RESET = Number(process.env.PHI_RESET_THIET_BI || 100000);

const ipCua = (req: Request) => String(req.headers['cf-connecting-ip'] || req.ip || '').slice(0, 64);
const quocGia = (req: Request) => String(req.headers['cf-ipcountry'] || '').slice(0, 4) || null;

/** Mã máy gửi kèm yêu cầu (chỉ nhận chuỗi 16–64 ký tự chữ/số/gạch). */
export function maThietBi(req: Request): string | null {
  const m = String(req.headers['x-thiet-bi'] || '').trim();
  return /^[A-Za-z0-9_-]{16,64}$/.test(m) ? m : null;
}

/** Đọc chuỗi nhận dạng trình duyệt ra chữ cho người đọc: loại máy, hệ điều hành, trình duyệt. */
export function docUA(ua: string): { loai: string; heDieuHanh: string; trinhDuyet: string; ten: string } {
  const u = ua || '';
  let os = 'Không rõ';
  let m: RegExpMatchArray | null;
  if ((m = u.match(/iPhone OS (\d+)[_.]?(\d+)?/))) os = `iOS ${m[1]}${m[2] ? '.' + m[2] : ''}`;
  else if ((m = u.match(/iPad.*OS (\d+)[_.]?(\d+)?/))) os = `iPadOS ${m[1]}${m[2] ? '.' + m[2] : ''}`;
  else if ((m = u.match(/Android (\d+(\.\d+)?)/))) os = `Android ${m[1]}`;
  else if (/Windows NT 10/.test(u)) os = 'Windows 10/11';
  else if ((m = u.match(/Windows NT (\d+\.\d+)/))) os = `Windows NT ${m[1]}`;
  else if ((m = u.match(/Mac OS X (\d+)[_.](\d+)/))) os = `macOS ${m[1]}.${m[2]}`;
  else if (/CrOS/.test(u)) os = 'ChromeOS';
  else if (/Linux/.test(u)) os = 'Linux';
  let br = 'Không rõ';
  if ((m = u.match(/Zalo[/ ]?([\d.]+)?/i))) br = 'Zalo (trình duyệt trong app)';
  else if ((m = u.match(/FBAN|FBAV|FB_IAB/))) br = 'Facebook (trình duyệt trong app)';
  else if ((m = u.match(/CocCoc\/([\d]+)/i)) || (m = u.match(/coc_coc_browser\/([\d]+)/i))) br = `Cốc Cốc ${m[1]}`;
  else if ((m = u.match(/Edg(?:e|A|iOS)?\/(\d+)/))) br = `Edge ${m[1]}`;
  else if ((m = u.match(/OPR\/(\d+)/))) br = `Opera ${m[1]}`;
  else if ((m = u.match(/SamsungBrowser\/(\d+)/))) br = `Samsung Internet ${m[1]}`;
  else if ((m = u.match(/CriOS\/(\d+)/))) br = `Chrome ${m[1]} (iPhone)`;
  else if ((m = u.match(/FxiOS\/(\d+)/))) br = `Firefox ${m[1]} (iPhone)`;
  else if ((m = u.match(/Firefox\/(\d+)/))) br = `Firefox ${m[1]}`;
  else if ((m = u.match(/Chrome\/(\d+)/))) br = `Chrome ${m[1]}`;
  else if ((m = u.match(/Version\/(\d+(\.\d+)?).*Safari/))) br = `Safari ${m[1]}`;
  const loai = /iPad|Tablet/.test(u) || (/Android/.test(u) && !/Mobile/.test(u)) ? 'Máy tính bảng'
    : /Mobi|iPhone|Android/.test(u) ? 'Điện thoại' : 'Máy tính';
  // Tên máy: iPhone / Samsung SM-xxx … (Android ghi model trong ngoặc trước "Build")
  let may = '';
  if (/iPhone/.test(u)) may = 'iPhone';
  else if (/iPad/.test(u)) may = 'iPad';
  else if ((m = u.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/))) may = m[1].trim() === 'K' ? '' : m[1].trim();
  else if (/Macintosh/.test(u)) may = 'Máy Mac';
  else if (/Windows/.test(u)) may = 'Máy tính Windows';
  return { loai, heDieuHanh: os, trinhDuyet: br, ten: [may || loai, br].filter(Boolean).join(' · ') };
}

/** Thông tin máy trình duyệt tự kê khi đăng nhập (màn hình, múi giờ, ngôn ngữ, tên máy Android…). */
function chiTietTuMay(req: Request): Record<string, unknown> {
  try {
    const raw = String(req.headers['x-thiet-bi-info'] || '');
    if (!raw || raw.length > 2000) return {};
    const o = JSON.parse(decodeURIComponent(raw));
    const giu: Record<string, unknown> = {};
    for (const k of ['manHinh', 'tiLe', 'muiGio', 'ngonNgu', 'nhanCpu', 'ram', 'cham', 'model', 'nenTang', 'banNenTang', 'gpu'])
      if (o[k] != null && String(o[k]).length < 120) giu[k] = o[k];
    return giu;
  } catch { return {}; }
}

/* ── CÙNG MỘT MÁY? (xem chú thích đầu file) ──
 * Thông số PHẦN CỨNG mọi cửa sổ / trình duyệt trên cùng máy đều thấy như nhau. Không so: tỉ lệ điểm ảnh (đổi theo mức phóng to
 * trang), ngôn ngữ (mỗi trình duyệt cài một kiểu). Thông số chỉ một bên có (RAM, tên card đồ hoạ — Safari / Firefox không cho
 * đọc) thì bỏ qua, nhưng màn hình + số nhân CPU + múi giờ thì hai bên PHẢI có đủ, thiếu là không gộp (thà tách nhầm còn hơn
 * gộp nhầm hai máy). */
const PHAN_CUNG = ['manHinh', 'nhanCpu', 'ram', 'cham', 'muiGio', 'nenTang', 'banNenTang', 'model', 'gpu'] as const;
const BAT_BUOC = ['manHinh', 'nhanCpu', 'muiGio'] as const;
/** Mạng của một địa chỉ IP: IPv4 lấy nguyên địa chỉ, IPv6 lấy 64 bit đầu (một nhà mạng cấp cả dải cho một thuê bao). */
function mangCua(ip: string | null | undefined): string {
  const s = String(ip || '').trim().toLowerCase();
  if (!s) return '';
  if (s.includes(':')) {
    const nhom = s.split('::')[0].split(':');                   // dạng rút gọn "a:b::c" — 64 bit đầu luôn nằm ở phần trước "::"
    return nhom.length >= 4 ? nhom.slice(0, 4).join(':') : s;
  }
  return s;
}
type MayCu = { loai: string | null; he_dieu_hanh: string | null; chi_tiet: any; ip_dau?: string | null; ip_cuoi?: string | null; ip_dn_cuoi?: string | null };
export function laCungMay(cu: MayCu, moi: { loai: string; heDieuHanh: string; ct: Record<string, any>; ips: (string | null | undefined)[] }): boolean {
  if (!cu || cu.loai !== moi.loai || cu.he_dieu_hanh !== moi.heDieuHanh) return false;
  const a = cu.chi_tiet || {}, b = moi.ct || {};
  for (const k of BAT_BUOC) if (a[k] == null || b[k] == null || a[k] === '' || b[k] === '') return false;
  for (const k of PHAN_CUNG) if (a[k] != null && b[k] != null && String(a[k]) !== String(b[k])) return false;
  const mangCu = new Set([cu.ip_dau, cu.ip_cuoi, cu.ip_dn_cuoi].map(mangCua).filter(Boolean));
  return moi.ips.map(mangCua).some((m) => m && mangCu.has(m));
}

/** Đăng nhập bằng mã PHỤ (cửa sổ / trình duyệt khác trên máy đã có): ghi thêm mã vào máy đó + số lần, lần cuối, IP. */
async function ghiMaPhu(mayId: number, ma: string, ten: string, ip: string, qg: string | null) {
  await query(
    `UPDATE thiet_bi SET
       ma_phu = CASE WHEN $2 = ANY(ma_phu) THEN ma_phu
                     WHEN cardinality(ma_phu) >= 30 THEN ma_phu[cardinality(ma_phu) - 28:cardinality(ma_phu)] || $2::text
                     ELSE ma_phu || $2::text END,
       chi_tiet = jsonb_set(chi_tiet, '{phu}', coalesce(chi_tiet->'phu', '{}'::jsonb) || jsonb_build_object($2::text, jsonb_build_object(
         'ten', $3::text, 'lanDau', coalesce(chi_tiet #>> ARRAY['phu', $2::text, 'lanDau'], to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
         'lanCuoi', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         'soLan', coalesce((chi_tiet #>> ARRAY['phu', $2::text, 'soLan'])::int, 0) + 1))),
       lan_cuoi = now(), so_lan_dang_nhap = so_lan_dang_nhap + 1, dn_cuoi = now(), ip_cuoi = $4, ip_dn_cuoi = $4,
       quoc_gia = COALESCE($5, quoc_gia)
     WHERE id = $1`, [mayId, ma, ten, ip, qg]);
}

async function gioiHanCua(userId: number): Promise<number> {
  try { const [u] = await query<{ thiet_bi_toi_da: number | null }>('SELECT thiet_bi_toi_da FROM users WHERE id=$1', [userId]); return u?.thiet_bi_toi_da ?? TOI_DA_MAC_DINH; }
  catch { return TOI_DA_MAC_DINH; }
}

export function loiQuaGioiHan(toiDa: number): string {
  return `Tài khoản này đã đăng nhập đủ ${toiDa} thiết bị. Muốn đăng nhập trên thiết bị mới, vui lòng liên hệ Zalo admin `
    + `${ZALO_ADMIN} để reset thiết bị (phí ${PHI_RESET.toLocaleString('vi-VN')}đ/lần).`;
}

/**
 * Gọi NGAY TRƯỚC khi cấp thẻ đăng nhập. Ghi máy vào sổ + ghi nhật ký đăng nhập.
 * Trả { ok:false, loi } nếu đang bật giới hạn mà đây là máy mới vượt số cho phép (lần bị chặn cũng được ghi).
 */
export async function ghiDangNhap(user: { id: number; role?: string; roles?: string[] | null }, req: Request, cach: string)
  : Promise<{ ok: true; ma: string | null } | { ok: false; loi: string }> {
  const ma = maThietBi(req);
  const ua = String(req.headers['user-agent'] || '').slice(0, 500);
  const u = docUA(ua); const ip = ipCua(req), qg = quocGia(req);
  try {
    const batGioiHan = await isFlagOn(CO_GIOI_HAN);
    const khongGioiHan = laAdmin(user as any);
    if (batGioiHan && !ma && !khongGioiHan)   // trình duyệt quá cũ / tắt lưu trữ → không nhận diện được máy thì không cho vào
      return { ok: false, loi: 'Trình duyệt này không lưu được dữ liệu nên không nhận diện được thiết bị. Vui lòng bật lưu dữ liệu trang web (không dùng chế độ ẩn danh) rồi thử lại.' };
    if (!ma) return { ok: true, ma: null };
    const ct = chiTietTuMay(req);
    // Mã đã có trong sổ: là mã CHÍNH của một máy, hoặc mã PHỤ (cửa sổ / trình duyệt khác đã gộp vào máy đó)
    let [co] = await query<{ id: number; ma: string }>(
      'SELECT id, ma FROM thiet_bi WHERE user_id=$1 AND (ma=$2 OR $2 = ANY(ma_phu))', [user.id, ma]);
    if (!co) {
      // Mã lạ mà phần cứng + mạng giống hệt một máy đã có → CÙNG MÁY (cửa sổ ẩn danh, hồ sơ / trình duyệt khác…) → gộp,
      // không tính là máy mới, không bị chặn vì giới hạn (xem laCungMay)
      const ds = await query<any>(`SELECT id, ma, loai, he_dieu_hanh, chi_tiet, ip_dau, ip_cuoi, ip_dn_cuoi FROM thiet_bi
        WHERE user_id=$1 ORDER BY lan_dau`, [user.id]);
      const trung = ds.find((m: any) => laCungMay(m, { loai: u.loai, heDieuHanh: u.heDieuHanh, ct, ips: [ip] }));
      if (trung) co = { id: trung.id, ma: trung.ma };
    }
    if (co && co.ma !== ma) {
      await ghiMaPhu(co.id, ma, u.ten, ip, qg);
      await ghiLanCuoi(user.id, co.id, ma, ip, qg, u.ten, ua, cach, 'ok');
      quenMay(user.id, ma);
      return { ok: true, ma };
    }
    if (!co && batGioiHan && !khongGioiHan) {
      const toiDa = await gioiHanCua(user.id);
      const [{ n }] = await query<{ n: number }>('SELECT count(*)::int n FROM thiet_bi WHERE user_id=$1', [user.id]);
      if (n >= toiDa) {
        await ghiLanCuoi(user.id, null, ma, ip, qg, u.ten, ua, cach, 'bi-chan');
        return { ok: false, loi: loiQuaGioiHan(toiDa) };
      }
    }
    const [tb] = await query<{ id: number }>(
      `INSERT INTO thiet_bi (user_id, ma, ten, loai, he_dieu_hanh, trinh_duyet, ua, chi_tiet, ip_dau, ip_cuoi, quoc_gia, so_lan_dang_nhap)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,1)
       ON CONFLICT (user_id, ma) DO UPDATE SET ten=EXCLUDED.ten, loai=EXCLUDED.loai, he_dieu_hanh=EXCLUDED.he_dieu_hanh,
         trinh_duyet=EXCLUDED.trinh_duyet, ua=EXCLUDED.ua, chi_tiet=thiet_bi.chi_tiet || EXCLUDED.chi_tiet, ip_cuoi=EXCLUDED.ip_cuoi,
         quoc_gia=COALESCE(EXCLUDED.quoc_gia, thiet_bi.quoc_gia), lan_cuoi=now(), so_lan_dang_nhap=thiet_bi.so_lan_dang_nhap+1,
         dn_cuoi=now(), ip_dn_cuoi=EXCLUDED.ip_cuoi
       RETURNING id`, [user.id, ma, u.ten, u.loai, u.heDieuHanh, u.trinhDuyet, ua, JSON.stringify(ct), ip, qg]);
    await query('UPDATE thiet_bi SET dn_cuoi=now(), ip_dn_cuoi=$2 WHERE id=$1 AND dn_cuoi IS NULL', [tb.id, ip]).catch(() => {});   // máy mới tạo
    await ghiLanCuoi(user.id, tb.id, ma, ip, qg, u.ten, null, cach, 'ok');   // chuỗi trình duyệt đã có ở sổ máy → khỏi lưu lại
    quenMay(user.id, ma);
    return { ok: true, ma };
  } catch (e: any) {
    // Sổ thiết bị trục trặc (bảng chưa tạo, DB chậm…) KHÔNG được làm hỏng việc đăng nhập
    console.error('[thiet-bi] ghi đăng nhập lỗi:', e?.message || e);
    return { ok: true, ma };
  }
}

/**
 * GỘP MÁY TRÙNG ĐÃ NẰM SẴN TRONG SỔ (chạy lúc máy chủ khởi động; chạy lại vô hại — gộp xong thì không còn gì để gộp).
 * Dòng máy nào laCungMay với một dòng CÓ TRƯỚC của cùng tài khoản → dồn vào dòng có trước: mã thành mã phụ (kèm tên trình
 * duyệt, lần đầu, lần cuối, số lần — giữ làm bằng chứng ở chi_tiet.phu), cộng số lần đăng nhập, lấy mốc sớm / muộn nhất,
 * chuyển tra cứu + lần đăng nhập cuối sang dòng đó, rồi xoá dòng trùng. Mỗi lần gộp là một giao dịch riêng.
 */
export async function gopMayTrungCu(): Promise<number> {
  const ds = await query<any>(`SELECT id, user_id, ma, ma_phu, ten, loai, he_dieu_hanh, chi_tiet, ip_dau, ip_cuoi, ip_dn_cuoi,
      lan_dau, lan_cuoi, so_lan_dang_nhap, dn_cuoi FROM thiet_bi
    WHERE user_id IN (SELECT user_id FROM thiet_bi GROUP BY user_id HAVING count(*) > 1)
    ORDER BY user_id, lan_dau, id`);
  const theoUser = new Map<number, any[]>();
  for (const r of ds) theoUser.set(r.user_id, [...(theoUser.get(r.user_id) || []), r]);
  let soGop = 0;
  for (const [userId, may] of theoUser) {
    const giu: any[] = [];
    for (const r of may) {
      const chinh = giu.find((p) => laCungMay(p, { loai: r.loai, heDieuHanh: r.he_dieu_hanh, ct: r.chi_tiet,
        ips: [r.ip_dau, r.ip_cuoi, r.ip_dn_cuoi] }));
      if (!chinh) { giu.push(r); continue; }
      const phu = { ...(r.chi_tiet?.phu || {}), [r.ma]: { ten: r.ten, lanDau: r.lan_dau, lanCuoi: r.lan_cuoi, soLan: r.so_lan_dang_nhap } };
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query(`UPDATE thiet_bi SET
            ma_phu = (SELECT array_agg(DISTINCT x) FROM unnest(ma_phu || $2::text[]) x),
            chi_tiet = jsonb_set(chi_tiet, '{phu}', coalesce(chi_tiet->'phu', '{}'::jsonb) || $3::jsonb),
            ip_cuoi = CASE WHEN $5::timestamptz > lan_cuoi THEN $6 ELSE ip_cuoi END,
            lan_dau = least(lan_dau, $4::timestamptz), lan_cuoi = greatest(lan_cuoi, $5::timestamptz),
            so_lan_dang_nhap = so_lan_dang_nhap + $7, dn_cuoi = greatest(dn_cuoi, $8::timestamptz)
          WHERE id = $1`,
          [chinh.id, [r.ma, ...(r.ma_phu || [])], JSON.stringify(phu), r.lan_dau, r.lan_cuoi, r.ip_cuoi, r.so_lan_dang_nhap || 0, r.dn_cuoi]);
        await c.query('UPDATE tra_cuu_gan_day SET thiet_bi_id=$1 WHERE thiet_bi_id=$2', [chinh.id, r.id]);
        await c.query('UPDATE thiet_bi_dang_nhap SET thiet_bi_id=$1 WHERE thiet_bi_id=$2', [chinh.id, r.id]);
        await c.query('DELETE FROM thiet_bi WHERE id=$1', [r.id]);
        await c.query('COMMIT');
        soGop++;
        console.log(`[thiet-bi] gộp máy trùng: tài khoản ${userId} — máy #${r.id} (${r.ten}) vào máy #${chinh.id}: cùng phần cứng, cùng mạng`);
      } catch (e: any) {
        await c.query('ROLLBACK').catch(() => {});
        console.error('[thiet-bi] gộp máy trùng lỗi:', e?.message || e);
      } finally { c.release(); }
    }
  }
  if (soGop) nhoMay.clear();
  return soGop;
}

/** Ghi ĐÈ lần đăng nhập cuối của tài khoản (1 dòng / tài khoản). */
async function ghiLanCuoi(userId: number, tbId: number | null, ma: string, ip: string, qg: string | null, ten: string, ua: string | null, cach: string, kq: string) {
  await query(`INSERT INTO thiet_bi_dang_nhap (user_id, thiet_bi_id, ma, luc, ip, quoc_gia, ten, ua, cach, ket_qua)
               VALUES ($1,$2,$3,now(),$4,$5,$6,$7,$8,$9)
               ON CONFLICT (user_id) DO UPDATE SET thiet_bi_id=EXCLUDED.thiet_bi_id, ma=EXCLUDED.ma, luc=now(), ip=EXCLUDED.ip,
                 quoc_gia=EXCLUDED.quoc_gia, ten=EXCLUDED.ten, ua=EXCLUDED.ua, cach=EXCLUDED.cach, ket_qua=EXCLUDED.ket_qua`,
    [userId, tbId, ma, ip, qg, ten, ua, cach, kq]).catch(() => {});
}

// ── Kiểm mỗi yêu cầu đã đăng nhập (authRequired gọi) ──
// Nhớ tạm 30 giây "máy (user, mã) còn trong sổ không" để khỏi hỏi database mỗi lần. Cập nhật "hoạt động cuối" của máy
// gom 2 phút/lần (không ghi từng yêu cầu).
const nhoMay = new Map<string, { con: boolean; id: number | null; luc: number }>();
function quenMay(userId: number, ma: string | null) { nhoMay.delete(userId + ':' + ma); }
export function quenMayCuaUser(userId: number) { for (const k of [...nhoMay.keys()]) if (k.startsWith(userId + ':')) nhoMay.delete(k); }
const gomGoi = new Map<number, { n: number; ip: string }>();   // thiet_bi.id → máy vừa có hoạt động
setInterval(() => {
  if (!gomGoi.size) return;
  const ds = [...gomGoi.entries()]; gomGoi.clear();
  for (const [id, g] of ds) query('UPDATE thiet_bi SET lan_cuoi=now(), ip_cuoi=$2 WHERE id=$1', [id, g.ip]).catch(() => {});
}, 2 * 60 * 1000).unref?.();

/**
 * Trả null = cho qua; trả chuỗi = lý do từ chối (401). Chỉ TỪ CHỐI khi đang bật giới hạn; tắt thì chỉ ghi sổ.
 * tbThe = mã máy ghi trong thẻ lúc đăng nhập (thẻ cũ cấp trước khi có tính năng thì không có).
 */
export async function kiemMoiYeuCau(payload: { id: number; role?: string; roles?: string[]; tb?: string }, req: Request): Promise<string | null> {
  const ma = maThietBi(req);
  const khoa = String(payload.id) + ':' + (payload.tb || ma);
  let nho = nhoMay.get(khoa);
  if (!nho || Date.now() - nho.luc > 30_000) {
    let id: number | null = null;
    try {
      const m = payload.tb || ma;
      if (m) { const [r] = await query<{ id: number }>('SELECT id FROM thiet_bi WHERE user_id=$1 AND (ma=$2 OR $2 = ANY(ma_phu))', [payload.id, m]); id = r?.id ?? null; }
    } catch { return null; }
    nho = { con: id != null, id, luc: Date.now() }; nhoMay.set(khoa, nho);
    if (nhoMay.size > 5000) nhoMay.clear();
  }
  if (nho.id != null) { const g = gomGoi.get(nho.id) || { n: 0, ip: '' }; g.n++; g.ip = ipCua(req); gomGoi.set(nho.id, g); }
  if (laAdmin(payload as any)) return null;
  if (!(await isFlagOnNho())) return null;
  if (!payload.tb) return 'Phiên đăng nhập cũ — vui lòng đăng nhập lại.';
  if (ma !== payload.tb) return 'Phiên đăng nhập không thuộc thiết bị này — vui lòng đăng nhập lại.';
  if (!nho.con) return 'Thiết bị này đã bị gỡ khỏi tài khoản — vui lòng đăng nhập lại.';
  return null;
}
let coNho = { bat: false, luc: 0 };
async function isFlagOnNho(): Promise<boolean> {
  if (Date.now() - coNho.luc > 30_000) coNho = { bat: await isFlagOn(CO_GIOI_HAN), luc: Date.now() };
  return coNho.bat;
}
export function quenCo() { coNho.luc = 0; }

// ── 10 TRA CỨU GẦN NHẤT của tài khoản ──
// Gắn ở /api (index.ts). Chỉ ghi các lần TRA CỨU thật (không ghi mọi lần gọi máy chủ), xong việc mới ghi (res 'finish'),
// rồi xoá bớt cho mỗi tài khoản chỉ còn đúng 10 dòng mới nhất.
const TRA_CUU: [RegExp, string][] = [
  [/^\/api\/parcels\/at\b/, 'Bấm xem thửa đất trên bản đồ'],
  [/^\/api\/dc\/tim\b/, 'Tìm thửa theo số tờ / số thửa'],
  [/^\/api\/van-ban\/?\?.*\bq=/, 'Tra cứu văn bản'],
  [/^\/api\/qr\b/, 'Tra cứu QR sổ đỏ'],
  [/^\/api\/hotlist\/goc\b/, 'Mở danh sách nóng'],
];
async function moTaTraCuu(duong: string): Promise<string | null> {
  const [d, q = ''] = duong.split('?'); const p = new URLSearchParams(q);
  try {
    if (/\/parcels\/at/.test(d)) {
      const lng = Number(p.get('lng')), lat = Number(p.get('lat'));
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      const [r] = await query<any>(`SELECT d.so_to, d.so_thua, x.ten FROM dia_chinh d LEFT JOIN dia_chinh_xa x ON x.xa_id = d.xa_id
        WHERE ST_Intersects(d.geom, ST_SetSRID(ST_Point($1, $2), 4326)) LIMIT 1`, [lng, lat]);
      return r ? [`Thửa ${r.so_thua}`, `Tờ ${r.so_to}`, r.ten].filter(Boolean).join(' · ') : `toạ độ ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    if (/\/dc\/tim/.test(d)) {
      let xa = '';
      if (p.get('xaId')) { const [x] = await query<any>('SELECT ten FROM dia_chinh_xa WHERE xa_id=$1', [p.get('xaId')]); xa = x?.ten || ''; }
      return [p.get('thua') && `Thửa ${p.get('thua')}`, p.get('to') && `Tờ ${p.get('to')}`, xa].filter(Boolean).join(' · ') || null;
    }
    if (/\/van-ban/.test(d)) return p.get('q') ? `“${String(p.get('q')).slice(0, 80)}”` : null;
  } catch { /* bỏ qua */ }
  return null;
}
export function ghiTraCuu(req: Request, res: any, next: () => void) {
  if (req.method !== 'GET' && req.method !== 'POST') return next();
  const duong = req.originalUrl || req.url;
  const loai = TRA_CUU.find(([re]) => re.test(duong));
  const h = String(req.headers.authorization || '');
  if (!loai || !h.startsWith('Bearer ')) return next();
  res.on('finish', async () => {
    if (res.statusCode >= 400) return;
    const p = verifyToken(h.slice(7)); if (!p) return;
    const userId = Number(p.id); const ma = p.tb || maThietBi(req);
    try {
      const [tb] = ma ? await query<{ id: number }>('SELECT id FROM thiet_bi WHERE user_id=$1 AND (ma=$2 OR $2 = ANY(ma_phu))', [userId, ma]) : [];
      await query('INSERT INTO tra_cuu_gan_day (user_id, thiet_bi_id, ip, viec, mo_ta) VALUES ($1,$2,$3,$4,$5)',
        [userId, tb?.id ?? null, ipCua(req), loai[1], await moTaTraCuu(duong)]);
      await query(`DELETE FROM tra_cuu_gan_day WHERE user_id=$1 AND id NOT IN
        (SELECT id FROM tra_cuu_gan_day WHERE user_id=$1 ORDER BY luc DESC, id DESC LIMIT 10)`, [userId]);
    } catch { /* sổ trục trặc không ảnh hưởng việc tra cứu */ }
  });
  next();
}
