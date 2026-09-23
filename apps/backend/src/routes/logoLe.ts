// LỊCH ĐỔI LOGO THEO NGÀY LỄ (dùng tạm — dễ gỡ)
// ==============================================
// Ngày thường web dùng logo gốc. Đến dịp lễ thì logo tự đổi sang bản có trang
// trí của dịp đó (cành mai Tết, cờ Tổ quốc 2/9, mũ Noel…). Các bản logo lễ nằm
// ở apps/frontend/public/logo-le/<mã>.webp (nền tối) và <mã>-toi.webp (nền sáng),
// dựng bằng scripts/dung-logo-ngay-le.py.
//
// Ở đây chỉ lo phần LỊCH: dịp nào chạy từ ngày nào đến ngày nào. Quản trị viên
// thêm/sửa/xoá trong trang /quan-tri/logo-le (giao diện kiểu lịch tháng).
//
// BA KIỂU LẶP — vì ngày lễ Việt Nam có hai loại lịch:
//   · 'duong' — ngày dương cố định, lặp hàng năm. Vd Quốc khánh 2/9.
//   · 'am'    — ngày âm lịch, lặp hàng năm, mỗi năm rơi vào một ngày dương
//               khác nhau. Vd mùng 1 Tết, Giỗ Tổ 10/3 âm, Trung thu 15/8 âm.
//               Đổi ngày bằng lib/amLich.ts (tính chứ không chép bảng).
//   · 'ngay'  — một khoảng ngày cụ thể, KHÔNG lặp. Dùng cho dịp riêng của
//               công ty: kỷ niệm thành lập, đợt khuyến mãi…
//
// `truoc` / `sau` = hiện logo trước/sau ngày chính mấy ngày. Tết thường để
// trước 7 sau 7; Quốc khánh để trước 1 sau 1.
//
// ⚠️ TRÙNG NGÀY thì lấy dịp có `uu_tien` LỚN HƠN. Vd 30/4 và 1/5 sát nhau,
//    hoặc Tết dương lịch 1/1 có năm đụng Tết Nguyên đán.
import { Router } from 'express';
import { cached, cachePut, cacheDrop } from '../lib/cache.ts';
import { query } from '../lib/db.ts';
import { adminRequired, type AuthedRequest } from '../middleware/auth.ts';
import { ngayAmTrongNam } from '../lib/amLich.ts';

export const logoLeRouter = Router();

// Danh sách bản logo lễ đang CÓ TỆP trong apps/frontend/public/logo-le/.
// ⚠️ Khai ở đây chứ không quét thư mục: backend và frontend là hai container
//    khác nhau, backend không nhìn thấy thư mục public của frontend.
//    Thêm bản logo mới thì thêm một dòng vào đây.
export const BAN_LOGO: { ma: string; ten: string }[] = [
  { ma: 'tet', ten: 'Tết Nguyên đán — cành mai vàng' },
  { ma: 'tet-duong', ten: 'Tết Dương lịch — pháo hoa' },
  { ma: 'gio-to', ten: 'Giỗ Tổ Hùng Vương — tượng Vua Hùng' },
  { ma: '30-4', ten: '30/4 Thống nhất — chim bồ câu' },
  { ma: 'quoc-khanh', ten: 'Quốc khánh 2/9 — cờ Tổ quốc' },
  { ma: 'trung-thu', ten: 'Trung thu — lồng đèn' },
  { ma: 'noel', ten: 'Giáng sinh — mũ ông già Noel' },
  { ma: 'phu-nu', ten: 'Quốc tế Phụ nữ 8/3 — hoa mimosa' },
  { ma: 'tri-an', ten: 'Tri ân 27/7 — ngọn nến' },
  { ma: 'nha-giao', ten: 'Nhà giáo 20/11 — mũ tốt nghiệp và sách' },
  { ma: 'quan-doi', ten: 'Quân đội 22/12 — quân hiệu' },
  { ma: 'gia-dinh', ten: 'Ngày Gia đình — trái tim' },
  { ma: 'thieu-nhi', ten: 'Thiếu nhi 1/6 — bóng bay' },
  { ma: 'doanh-nhan', ten: 'Doanh nhân 13/10 — cái bắt tay' },
  { ma: 'ong-tao', ten: 'Ông Công ông Táo — cá chép' },
  { ma: 'lao-dong', ten: 'Quốc tế Lao động 1/5 — bánh răng' },
  { ma: 'dang', ten: 'Thành lập Đảng 3/2 — cờ Đảng' },
  { ma: 'dien-bien', ten: 'Điện Biên Phủ 7/5 — cắm cờ trên nóc hầm' },
  { ma: 'sen', ten: 'Sinh nhật Bác 19/5 — nhà tranh Làng Sen' },
  { ma: 'vu-lan', ten: 'Lễ Vu Lan — đèn hoa đăng' },
  { ma: 'nhang', ten: 'Tết Nguyên tiêu — bát chè trôi nước' },
  { ma: 'hoa-cuc', ten: 'Phụ nữ Việt Nam 20/10 — nón lá và hoa hồng' },
  { ma: 'doan-ngo', ten: 'Tết Đoan Ngọ — bánh ú tro' },
];

type Dip = {
  id: number; ma: string; ten: string; kieu: string;
  thang: number | null; ngay: number | null;
  tu: string | null; den: string | null;
  truoc: number; sau: number; uuTien: number; bat: boolean;
};

const CHON = `id, ma, ten, kieu,
  thang, ngay,
  to_char(tu, 'YYYY-MM-DD') AS tu, to_char(den, 'YYYY-MM-DD') AS den,
  truoc, sau, uu_tien AS "uuTien", bat`;

const hnay = (d = new Date()) => {
  // Giờ Việt Nam, không phụ thuộc múi giờ của máy chủ.
  const t = new Date(d.getTime() + 7 * 3600_000);
  return t.toISOString().slice(0, 10);
};

const themNgay = (ngay: string, n: number) => {
  const t = new Date(ngay + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/** Khoảng ngày mà một dịp CHIẾM trong năm dương `nam`. Trả null nếu không có. */
function khoang(d: Dip, nam: number): [string, string] | null {
  let chinh: string | null = null;
  if (d.kieu === 'ngay') {
    if (!d.tu) return null;
    return [themNgay(d.tu, -d.truoc), themNgay(d.den || d.tu, d.sau)];
  }
  if (!d.thang || !d.ngay) return null;
  if (d.kieu === 'am') {
    chinh = ngayAmTrongNam(d.ngay, d.thang, nam);
  } else {
    const t = new Date(Date.UTC(nam, d.thang - 1, d.ngay));
    // ngày 30/2 chẳng hạn thì JS tự nhảy sang tháng sau → bỏ qua
    if (t.getUTCMonth() !== d.thang - 1) return null;
    chinh = t.toISOString().slice(0, 10);
  }
  if (!chinh) return null;
  return [themNgay(chinh, -d.truoc), themNgay(chinh, d.sau)];
}

/** Dịp nào đang áp dụng cho một ngày? Trùng thì ưu tiên cao hơn thắng. */
function dipCuaNgay(ds: Dip[], ngay: string): Dip | null {
  const nam = Number(ngay.slice(0, 4));
  let tot: Dip | null = null;
  for (const d of ds) {
    if (!d.bat) continue;
    // xét cả năm trước và năm sau: khoảng của dịp có thể vắt qua giao thừa
    for (const n of [nam - 1, nam, nam + 1]) {
      const k = khoang(d, n);
      if (!k) continue;
      if (ngay < k[0] || ngay > k[1]) continue;
      if (!tot || d.uuTien > tot.uuTien || (d.uuTien === tot.uuTien && d.id < tot.id)) tot = d;
      break;
    }
  }
  return tot;
}

async function docDs(): Promise<Dip[]> {
  const hit = cached<Dip[]>('logole:ds');
  if (hit) return hit;
  const rows = await query(`SELECT ${CHON} FROM logo_le ORDER BY uu_tien DESC, id`) as Dip[];
  cachePut('logole:ds', rows, 60_000);
  return rows;
}

// ── GET /api/logo-le/hom-nay — CÔNG KHAI, thanh menu gọi mỗi lần mở web ─────
// Trả { ma: null } nghĩa là hôm nay dùng logo thường.
logoLeRouter.get('/hom-nay', async (req, res, next) => {
  try {
    const ngay = String((req.query as any)?.ngay || '').match(/^\d{4}-\d{2}-\d{2}$/)
      ? String((req.query as any).ngay) : hnay();
    const d = dipCuaNgay(await docDs(), ngay);
    // Cache 10 phút: đổi lịch xong thì chậm nhất 10 phút là cả web theo.
    res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    res.json({ ngay, ma: d?.ma ?? null, ten: d?.ten ?? null });
  } catch (e) { next(e); }
});

// ── GET /api/logo-le/lich?thang=YYYY-MM — lưới lịch một tháng (admin) ───────
logoLeRouter.get('/lich', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const th = String((req.query as any)?.thang || '');
    if (!/^\d{4}-\d{2}$/.test(th)) return res.status(400).json({ error: 'Thiếu tháng dạng YYYY-MM' });
    const ds = await docDs();
    const [y, m] = th.split('-').map(Number);
    const soNgay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const ngays: { ngay: string; ma: string | null; ten: string | null; id: number | null }[] = [];
    for (let i = 1; i <= soNgay; i++) {
      const ngay = `${th}-${String(i).padStart(2, '0')}`;
      const d = dipCuaNgay(ds, ngay);
      ngays.push({ ngay, ma: d?.ma ?? null, ten: d?.ten ?? null, id: d?.id ?? null });
    }
    res.set('Cache-Control', 'private, no-store');
    res.json({ thang: th, ngays, dips: ds, banLogo: BAN_LOGO });
  } catch (e) { next(e); }
});

// ── GET /api/logo-le — danh sách dịp (admin) ───────────────────────────────
logoLeRouter.get('/', adminRequired, async (_req: AuthedRequest, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    res.json({ dips: await docDs(), banLogo: BAN_LOGO });
  } catch (e) { next(e); }
});

function docThan(b: any) {
  const kieu = ['duong', 'am', 'ngay'].includes(String(b?.kieu)) ? String(b.kieu) : 'duong';
  const so = (v: any, min: number, max: number, mac = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : mac;
  };
  const ngayHopLe = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
  return {
    ma: String(b?.ma || '').trim().slice(0, 40),
    ten: String(b?.ten || '').trim().slice(0, 120),
    kieu,
    thang: kieu === 'ngay' ? null : so(b?.thang, 1, 12, 1),
    ngay: kieu === 'ngay' ? null : so(b?.ngay, 1, 31, 1),
    tu: kieu === 'ngay' ? ngayHopLe(b?.tu) : null,
    den: kieu === 'ngay' ? ngayHopLe(b?.den) || ngayHopLe(b?.tu) : null,
    truoc: so(b?.truoc, 0, 60, 0),
    sau: so(b?.sau, 0, 60, 0),
    uuTien: so(b?.uuTien, 0, 999, 0),
    bat: b?.bat !== false,
  };
}

// ── POST /api/logo-le — thêm dịp (admin) ───────────────────────────────────
logoLeRouter.post('/', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const v = docThan(req.body);
    if (!v.ma) return res.status(400).json({ error: 'Chưa chọn bản logo' });
    if (!v.ten) return res.status(400).json({ error: 'Chưa đặt tên dịp' });
    if (v.kieu === 'ngay' && !v.tu) return res.status(400).json({ error: 'Chưa chọn ngày bắt đầu' });
    const [row] = await query(
      `INSERT INTO logo_le (ma, ten, kieu, thang, ngay, tu, den, truoc, sau, uu_tien, bat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${CHON}`,
      [v.ma, v.ten, v.kieu, v.thang, v.ngay, v.tu, v.den, v.truoc, v.sau, v.uuTien, v.bat]);
    cacheDrop('logole:');
    res.json({ ok: true, dip: row });
  } catch (e) { next(e); }
});

// ── PUT /api/logo-le/:id — sửa dịp (admin) ─────────────────────────────────
logoLeRouter.put('/:id', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const v = docThan(req.body);
    if (!v.ma || !v.ten) return res.status(400).json({ error: 'Thiếu bản logo hoặc tên dịp' });
    const [row] = await query(
      `UPDATE logo_le SET ma=$2, ten=$3, kieu=$4, thang=$5, ngay=$6, tu=$7, den=$8,
              truoc=$9, sau=$10, uu_tien=$11, bat=$12
        WHERE id=$1 RETURNING ${CHON}`,
      [id, v.ma, v.ten, v.kieu, v.thang, v.ngay, v.tu, v.den, v.truoc, v.sau, v.uuTien, v.bat]);
    if (!row) return res.status(404).json({ error: 'Không thấy dịp này' });
    cacheDrop('logole:');
    res.json({ ok: true, dip: row });
  } catch (e) { next(e); }
});

// ── DELETE /api/logo-le/:id — xoá dịp (admin) ──────────────────────────────
logoLeRouter.delete('/:id', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const r = await query(`DELETE FROM logo_le WHERE id = $1 RETURNING id`, [Number(req.params.id)]);
    cacheDrop('logole:');
    res.json({ deleted: r[0]?.id ?? null });
  } catch (e) { next(e); }
});
