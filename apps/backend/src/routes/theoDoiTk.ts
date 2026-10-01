// ════════════════════════════════════════════════════════════════════════════════════════════
//  THEO DÕI HOẠT ĐỘNG TÀI KHOẢN — TẠM THỜI, DỄ GỠ (chủ dự án 1/10/2026)
//  "Lập cho admin bản báo cáo tài khoản Nguyễn Sinh và Minh Nguyệt dùng những gì vào thời gian nào…
//   chỉ admin mới xem được, sau này sẽ xoá chức năng này."
//
//  Cách làm: ghi lại MỖI LẦN tài khoản nằm trong danh sách theo dõi gọi máy chủ (mở công cụ, tra cứu,
//  xem thửa, tải file…) + mỗi lần đăng nhập + mỗi TRANG đã mở (trình duyệt tự báo về, xem
//  components/TheoDoiTrang.tsx — chủ dự án tự duyệt bật 1/10/2026).
//  Tài khoản KHÔNG nằm trong danh sách thì không ghi gì cả.
//
//  GỠ BỎ: xoá file này + 2 dòng gắn trong index.ts (ghiHoatDong, theoDoiRouter) + 1 dòng ở routes/auth.ts
//  (ghiSuKien đăng nhập) + components/TheoDoiTrang.tsx (+ 2 dòng trong DeferredWidgets.tsx) + trang
//  app/quan-tri/theo-doi-tai-khoan + 1 mục trong app/quan-tri/page.tsx. Bảng dữ liệu xoá bằng:
//    DROP TABLE theo_doi_hoat_dong, theo_doi_tai_khoan;
//  (Bảng tạo ngay trong file này thay vì migrate.ts để gỡ một chỗ là sạch.)
// ════════════════════════════════════════════════════════════════════════════════════════════
import { Router, type Response, type NextFunction } from 'express';
import { query } from '../lib/db.ts';
import { verifyToken } from '../lib/auth.ts';
import { adminRequired, type AuthedRequest } from '../middleware/auth.ts';

export const theoDoiRouter = Router();

// Hai tài khoản chủ dự án yêu cầu (tìm theo EMAIL, không ghi cứng mã số).
// + tài khoản admin của chủ dự án để TỰ THỬ báo cáo (1/10/2026) — thử xong muốn bỏ thì xoá email ở đây
//   VÀ chạy: DELETE FROM theo_doi_tai_khoan WHERE user_id = (SELECT id FROM users WHERE email='cuonganh365@gmail.com');
const EMAIL_THEO_DOI = ['banhchuoi8833@gmail.com', 'nguyenthiminhnguyet737@gmail.com', 'cuonganh365@gmail.com'];

let dangTheoDoi = new Set<number>();          // mã các tài khoản đang theo dõi — nhớ trong RAM cho nhanh
async function napDanhSach() {
  try {
    const r = await query<{ user_id: number }>('SELECT user_id FROM theo_doi_tai_khoan');
    dangTheoDoi = new Set(r.map((x) => Number(x.user_id)));
  } catch { /* bảng chưa có thì thôi */ }
}

/** Tạo bảng + đưa 2 tài khoản vào danh sách. Chạy lại nhiều lần vẫn an toàn. */
export async function khoiTaoTheoDoi() {
  await query(`CREATE TABLE IF NOT EXISTS theo_doi_tai_khoan (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      them_luc TIMESTAMPTZ NOT NULL DEFAULT now())`).catch((e) => console.error('[theo-doi] tạo bảng', e.message));
  await query(`CREATE TABLE IF NOT EXISTS theo_doi_hoat_dong (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      luc TIMESTAMPTZ NOT NULL DEFAULT now(),
      loai TEXT NOT NULL,              -- 'goi' (gọi máy chủ) · 'trang' (mở trang) · 'dang-nhap'
      phuong_thuc TEXT,
      duong_dan TEXT,
      ma_tra_ve INTEGER,
      ip TEXT,
      thiet_bi TEXT)`).catch((e) => console.error('[theo-doi] tạo bảng', e.message));
  await query('CREATE INDEX IF NOT EXISTS theo_doi_hoat_dong_user_luc ON theo_doi_hoat_dong (user_id, luc DESC)').catch(() => {});
  await query(`INSERT INTO theo_doi_tai_khoan (user_id)
               SELECT id FROM users WHERE lower(email) = ANY($1::text[]) ON CONFLICT DO NOTHING`, [EMAIL_THEO_DOI]).catch(() => {});
  await napDanhSach();
  console.log(`[theo-doi] đang theo dõi ${dangTheoDoi.size} tài khoản`);
  setInterval(napDanhSach, 5 * 60_000).unref();
}

// Địa chỉ máy thật: nginx đã ghi đè CF-Connecting-IP bằng địa chỉ thật (xem nginx.conf), không giả được.
const ipCua = (req: AuthedRequest) => String(req.headers['cf-connecting-ip'] || req.ip || '').slice(0, 64);
function thietBiCua(ua: string): string {
  const u = ua || '';
  const may = /iPhone/i.test(u) ? 'iPhone' : /iPad/i.test(u) ? 'iPad' : /Android/i.test(u) ? (/Mobile/i.test(u) ? 'Điện thoại Android' : 'Máy tính bảng Android')
    : /Windows/i.test(u) ? 'Máy tính Windows' : /Macintosh/i.test(u) ? 'Máy Mac' : /Linux/i.test(u) ? 'Máy Linux' : 'Không rõ';
  const tdd = /Zalo/i.test(u) ? 'Zalo' : /FBAN|FBAV/i.test(u) ? 'Facebook' : /Edg\//.test(u) ? 'Edge' : /CocCoc/i.test(u) ? 'Cốc Cốc'
    : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /Firefox\//.test(u) ? 'Firefox' : '';
  return tdd ? `${may} · ${tdd}` : may;
}

function ghi(userId: number, loai: string, req: AuthedRequest, phuongThuc: string | null, duongDan: string, ma: number | null) {
  query(`INSERT INTO theo_doi_hoat_dong (user_id, loai, phuong_thuc, duong_dan, ma_tra_ve, ip, thiet_bi)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, loai, phuongThuc, duongDan.slice(0, 400), ma, ipCua(req), thietBiCua(String(req.headers['user-agent'] || ''))])
    .catch(() => {});                                       // ghi hỏng thì bỏ qua — không bao giờ làm hỏng việc chính
}

/** Ghi sự kiện riêng (vd đăng nhập thành công) — gọi từ routes/auth.ts. */
export function ghiSuKien(userId: number, loai: string, req: AuthedRequest, ghiChu = '') {
  if (dangTheoDoi.has(Number(userId))) ghi(Number(userId), loai, req, null, ghiChu, null);
}

// Mấy đường gọi liên tục, không nói lên việc người dùng làm gì → bỏ, cho báo cáo khỏi rác.
const BO_QUA = [/^\/api\/dc\/\d+\//, /^\/api\/tiles\//, /^\/api\/images\//, /^\/api\/(ping|health)\b/, /^\/api\/auth\/me\b/,
  /^\/api\/flags\b/, /^\/api\/config\b/, /^\/api\/logo-le\b/, /^\/api\/push\b/, /^\/api\/theo-doi\//];

/** Gắn vào /api: chỉ tốn 1 lần kiểm chữ ký thẻ; tài khoản không bị theo dõi thì đi qua ngay. */
export function ghiHoatDong(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!dangTheoDoi.size) return next();
  const h = req.headers.authorization ?? '';
  if (!h.startsWith('Bearer ')) return next();
  const p = verifyToken(h.slice(7));
  if (!p || !dangTheoDoi.has(Number(p.id))) return next();
  const duong = req.originalUrl || req.url;
  if (BO_QUA.some((re) => re.test(duong))) return next();
  res.on('finish', () => ghi(Number(p.id), 'goi', req, req.method, duong, res.statusCode));
  next();
}

// Trình duyệt báo "vừa mở trang X" (components/TheoDoiTrang.tsx) — chủ dự án tự duyệt bật 1/10/2026.
// CHỈ ghi nếu là tài khoản đang theo dõi; người khác gửi lên bị bỏ qua, không lưu gì.
theoDoiRouter.post('/trang', (req: AuthedRequest, res) => {
  const h = req.headers.authorization ?? '';
  const p = h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
  const trang = String((req.body as any)?.p || '').slice(0, 300);
  if (p && dangTheoDoi.has(Number(p.id)) && trang.startsWith('/')) ghi(Number(p.id), 'trang', req, null, trang, null);
  res.status(204).end();
});

// Những thứ ĐÃ CÓ SẴN trong dữ liệu từ trước (trước khi bật ghi chi tiết): đếm + lần gần nhất.
const DU_LIEU_CU: [string, string, string, string][] = [
  // [bảng, cột người dùng, cột thời gian, tên dễ hiểu]
  ['listings', 'created_by', 'created_at', 'Tin đăng đã tạo'],
  ['listing_leads', 'user_id', 'created_at', 'Lần bấm "Hiện số" người đăng tin'],
  ['saved_places', 'user_id', 'created_at', 'Điểm / thửa đã lưu trên bản đồ'],
  ['customers', 'user_id', 'created_at', 'Khách hàng trong CRM'],
  ['crm_activities', 'user_id', 'created_at', 'Hoạt động CRM'],
  ['customer_needs', 'user_id', 'created_at', 'Nhu cầu khách (CRM)'],
  ['property_interests', 'user_id', 'created_at', 'Quan tâm bất động sản (CRM)'],
  ['notary_appointments', 'user_id', 'created_at', 'Lịch hẹn công chứng'],
  ['chat_messages', 'user_id', 'created_at', 'Tin nhắn chat đã gửi'],
  ['chat_files', 'user_id', 'created_at', 'Tệp gửi qua chat'],
  ['danhmuc_jobs', 'user_id', 'created_at', 'Lần lập danh mục hồ sơ'],
  ['hot_sheets', 'created_by', 'created_at', 'Bảng danh sách nóng đã tạo'],
  ['payments', 'user_id', 'created_at', 'Đơn thanh toán'],
  ['import_jobs', 'created_by', 'created_at', 'Lần tải bản đồ lên'],
];

// Dịch toạ độ / mã xã trong lần tra cứu ra chữ người đọc hiểu (chủ dự án: "tìm kiếm thửa tờ nào trên map"):
//  · /api/parcels/at?lng=&lat= (bấm vào bản đồ) → dò thửa địa chính tại điểm đó → "Thửa X · Tờ Y · xã Z"
//  · /api/dc/tim?xaId=…            (ô tra số tờ/thửa) → tên xã đã chọn
// Kết quả gắn vào trường `moTa` của từng dòng. Dò tối đa 300 điểm khác nhau mỗi lần xem báo cáo cho nhẹ máy.
async function giaiNghia(hd: any[]) {
  const tenXa = new Map<string, string>();
  try {
    const xs = await query<{ xa_id: string; ten: string }>('SELECT xa_id, ten FROM dia_chinh_xa');
    xs.forEach((x) => tenXa.set(String(x.xa_id), x.ten));
  } catch { /* không có bảng thì thôi */ }
  const daDo = new Map<string, string>();
  let soLanDo = 0;
  for (const h of hd) {
    const [duong, q = ''] = String(h.duong || '').split('?');
    const p = new URLSearchParams(q);
    if (/^\/api\/dc\/tim/.test(duong)) {
      const xa = p.get('xaId') ? tenXa.get(String(p.get('xaId'))) : '';
      const phan = [p.get('thua') && `Thửa ${p.get('thua')}`, p.get('to') && `Tờ ${p.get('to')}`, xa].filter(Boolean);
      if (phan.length) h.moTa = phan.join(' · ');
    } else if (/^\/api\/parcels\/at/.test(duong)) {
      const lng = Number(p.get('lng')), lat = Number(p.get('lat'));
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      const k = `${lng.toFixed(6)},${lat.toFixed(6)}`;
      if (!daDo.has(k) && soLanDo < 300) {
        soLanDo++;
        const r = await query<any>(`SELECT d.so_to, d.so_thua, x.ten FROM dia_chinh d LEFT JOIN dia_chinh_xa x ON x.xa_id = d.xa_id
                                     WHERE ST_Intersects(d.geom, ST_SetSRID(ST_Point($1, $2), 4326)) LIMIT 1`, [lng, lat]).catch(() => []);
        daDo.set(k, r[0] ? [`Thửa ${r[0].so_thua}`, `Tờ ${r[0].so_to}`, r[0].ten].filter(Boolean).join(' · ') : `chỗ không có thửa (toạ độ ${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      }
      if (daDo.has(k)) h.moTa = daDo.get(k);
    }
  }
}

theoDoiRouter.get('/bao-cao', adminRequired, async (req, res, next) => {
  try {
    const gioiHan = Math.min(Math.max(Number(req.query.n) || 1500, 100), 5000);
    const tk = await query<any>(`SELECT u.id, u.email, u.full_name AS "ten", u.phone, u.role, u.roles, u.status,
                                        u.created_at AS "taoLuc", u.last_seen_at AS "lanCuoi", t.them_luc AS "batDauTheoDoi"
                                   FROM theo_doi_tai_khoan t JOIN users u ON u.id = t.user_id ORDER BY u.id`);
    const ketQua = [];
    for (const u of tk) {
      const cu: { ten: string; so: number; ganNhat: string | null }[] = [];
      for (const [bang, cot, thoiGian, ten] of DU_LIEU_CU) {
        const r = await query<any>(`SELECT count(*)::int AS so, max(${thoiGian}) AS "ganNhat" FROM ${bang} WHERE ${cot} = $1`, [u.id]).catch(() => null);
        if (r && r[0]?.so > 0) cu.push({ ten, so: r[0].so, ganNhat: r[0].ganNhat });
      }
      const hd = await query<any>(`SELECT luc, loai, phuong_thuc AS "pt", duong_dan AS "duong", ma_tra_ve AS "ma", ip, thiet_bi AS "thietBi"
                                     FROM theo_doi_hoat_dong WHERE user_id = $1 ORDER BY luc DESC LIMIT $2`, [u.id, gioiHan]);
      const [tong] = await query<any>(`SELECT count(*)::int AS so, min(luc) AS "tu" FROM theo_doi_hoat_dong WHERE user_id = $1`, [u.id]);
      await giaiNghia(hd);
      ketQua.push({ ...u, duLieuCu: cu, hoatDong: hd, tongHoatDong: tong?.so || 0, ghiTu: tong?.tu || null });
    }
    res.set('Cache-Control', 'private, no-store');
    res.json({ taiKhoan: ketQua });
  } catch (e) { next(e); }
});
