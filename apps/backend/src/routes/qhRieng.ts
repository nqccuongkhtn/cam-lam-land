// ═══════════════════════════════════════════════════════════════════════════════
// LỚP QUY HOẠCH RIÊNG (14/10/2026 — ban đầu CHỈ QUẢN TRỊ VIÊN XEM; từ 15/10/2026 tối GÓI THÀNH VIÊN cũng xem được, trừ lớp "chiAdmin")
// ═══════════════════════════════════════════════════════════════════════════════
// Lớp đầu tiên: Quy hoạch chi tiết 1/500 CHÍNH THỨC xã Cam Lâm — 6 đồ án, QĐ 2043–2048/QĐ-UBND ngày 25/9/2026 (thay bản
// dự thảo lấy ý kiến đã gỡ). Chủ dự án dặn: "chỉ tài khoản admin được xem tất cả, còn lại không cho xem".
// CHẶN Ở MÁY CHỦ, không chỉ ẩn trên giao diện (ẩn ở giao diện thì mở trình duyệt ra vẫn tải được):
//  · ô ảnh + văn bản KHÔNG nằm ở /tiles/ công khai (nginx phục vụ thẳng, ai cũng tải được) mà ở thư mục riêng QH_RIENG_DIR
//    (volume qh_rieng, chỉ backend đọc — docker-compose.yml);
//  · GET /api/qh-rieng/ve (BẮT BUỘC admin) cấp VÉ ký HMAC gắn tài khoản, hạn 24 giờ, kèm danh sách lớp. Người khác gọi
//    được 401/403, nên mã trang cũng không biết có lớp nào (danh sách không ghi cứng trong mã giao diện);
//    riêng lớp có mục `congKhai` thì TÊN được hiện cho mọi người qua GET /gioi-thieu (15/10/2026) — bấm vào là hộp "liên hệ admin";
//  · ô ảnh do bản đồ tự tải — không gửi kèm thẻ đăng nhập được — nên vé đi trong địa chỉ ô (?v=…), máy chủ kiểm TỪNG Ô;
//  · trả 'Cache-Control: private' + nginx có luật riêng location /api/qh-rieng/ { proxy_cache off } → không lưu đệm
//    chung ở nginx, Cloudflare không giữ (không phát nhầm cho người khác).
// Thư mục riêng:  <QH_RIENG_DIR>/danh-sach.json            — danh sách lớp (tên, khung, mức phóng, căn cứ)
//                 <QH_RIENG_DIR>/tiles/<thư mục lớp>/z/x/y.webp
//                 <QH_RIENG_DIR>/tai-lieu/<tên>.pdf         — bản quét quyết định phê duyệt
import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../lib/env.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { laAdmin, coGoiChung } from '../lib/auth.ts';

export const qhRiengRouter = Router();

const GOC = process.env.QH_RIENG_DIR || path.resolve(process.cwd(), 'du-lieu-rieng', 'qh-rieng');
const VE_GIO = 24;
// MỨC XEM THỬ CHUNG của 8 lớp quy hoạch Cam Lâm bị khoá (vé 'f'): ô tới mức này — = mức ô xa nhất của QĐ205 (10) + 3 (chủ dự án 15/10/2026:
// "lấy mức của 205 là mức phóng chung cho tài khoản free" → "+ thêm 2 z" → "gần hơn 1 z thôi"). PHẢI khớp Z_XEM_THU ở app/map/page.tsx.
const Z_XEM_THU = 13;
const KHOA = crypto.createHash('sha256').update('qh-rieng|' + env.jwtSecret).digest();
const bam = (s: string) => crypto.createHmac('sha256', KHOA).update(s).digest('base64url').slice(0, 22);

function danhSach(): { lop: any[] } {
  try { return JSON.parse(fs.readFileSync(path.join(GOC, 'danh-sach.json'), 'utf8')); }
  catch { return { lop: [] }; }
}
// PHẠM VI VÉ (15/10/2026): 'a' = admin — mọi lớp riêng; 'c' = khách có GÓI CHỨC NĂNG CHUNG còn hạn (lib/auth.ts coGoiChung) — ảnh QĐ205 +
// phân khu (/t/), tệp ô đất (/tep/), lớp riêng trừ lớp "chiAdmin" (/o/, /tai-lieu/); 'f' = tài khoản THƯỜNG đã đăng nhập — CHỈ ảnh QĐ205 /
// phân khu tới mức Z_XEM_THU (xem thử). Vé cũ 3 phần (trước 15/10) là vé admin → 'a'. Trả về phạm vi của vé hợp lệ, hoặc null (vé giả / hết hạn).
function veHopLe(ve: unknown): 'a' | 'c' | 'f' | null {
  const p = String(ve || '').split('.');
  if ((p.length !== 3 && p.length !== 4) || !/^\d+$/.test(p[0]) || !/^\d+$/.test(p[1])) return null;
  const pham = p.length === 4 ? p[2] : 'a';
  if (pham !== 'a' && pham !== 'c' && pham !== 'f') return null;
  const than = p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}` : `${p[0]}.${p[1]}`;
  const a = Buffer.from(bam(than)), b = Buffer.from(p[p.length - 1]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;   // chữ ký sai → vé giả
  return Number(p[1]) > Date.now() ? pham : null;                            // hết hạn
}

// GET /api/qh-rieng/ve — vé xem (PHẢI đăng nhập). ADMIN → 'a' + mọi lớp riêng; GÓI THÀNH VIÊN → 'c' + lớp riêng trừ lớp chiAdmin (vé không sống
// quá ngày hết hạn gói); tài khoản THƯỜNG → 'f' = vé XEM THỬ (không lớp riêng nào, ảnh QĐ205 / phân khu tới mức Z_XEM_THU). Chưa đăng nhập
// → 401 → không có vé → không tải được ô nào của 8 lớp khoá (chủ dự án 15/10/2026: "chưa đăng nhập vẫn xem được tạo lỗ hổng").
qhRiengRouter.get('/ve', authRequired, (req: AuthedRequest, res) => {
  res.set('Cache-Control', 'private, no-store');
  const pham: 'a' | 'c' | 'f' = laAdmin(req.user as any) ? 'a' : coGoiChung(req.user as any) ? 'c' : 'f';
  const hetHan = Math.min(Date.now() + VE_GIO * 3600 * 1000, pham === 'c' ? Number(req.user!.gc) || 0 : Infinity);
  const than = `${req.user!.id}.${hetHan}.${pham}`;
  // (15/10/2026 tối) gói thành viên xem được cả lớp riêng (QH chi tiết 1/500) — chủ dự án: "đăng ký thành viên để xem chứ liên hệ admin
  // cái gì". Lớp nào sau này muốn CHỈ admin thì thêm "chiAdmin": true vào mục đó trong danh-sach.json.
  res.json({ ve: `${than}.${bam(than)}`, hetHan, pham, xemThu: pham === 'f' ? Z_XEM_THU : null,
    lop: pham === 'f' ? [] : (danhSach().lop || []).filter((l: any) => pham === 'a' || !l?.chiAdmin) });
});

// GET /api/qh-rieng/gioi-thieu — CÔNG KHAI, ai cũng gọi được (15/10/2026). Chủ dự án: lớp 1/500 "vẫn hiện ra chỗ chọn nhưng chỉ tài
// khoản admin được chọn, còn những tài khoản khác thì hiện popup liên hệ admin". Chỉ trả TÊN + khu vực của lớp nào trong danh-sach.json
// có mục `congKhai` — KHÔNG có thư mục ô, khung, căn cứ, vé → biết tên cũng không tải được ô nào (ô vẫn đòi vé của admin).
// Lớp không có `congKhai` (vd Tây Nha Trang 2.2 chờ xác minh quyết định) vẫn giấu hẳn như cũ.
qhRiengRouter.get('/gioi-thieu', (_req, res) => {
  const lop = (danhSach().lop || []).filter((l: any) => l && l.id && l.congKhai).map((l: any) => ({
    id: String(l.id), vung: String(l.vung || ''),
    ten: String(l.congKhai.ten || ''), tenNgan: String(l.congKhai.tenNgan || ''), tenApp: String(l.congKhai.tenApp || ''),
  }));
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ lop });
});

const TEN_THU_MUC = /^[a-z0-9][a-z0-9-]{0,40}$/;
// GET /api/qh-rieng/o/:thuMuc/:z/:x/:y?v=<vé> — một ô ảnh (webp 512 điểm ảnh)
qhRiengRouter.get('/o/:thuMuc/:z/:x/:y', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const pv = veHopLe(req.query.v);
  if (!pv || pv === 'f') return res.status(403).json({ error: 'Không có quyền xem lớp này.' });   // vé xem thử không mở lớp riêng
  const { thuMuc } = req.params;
  // vé gói thành viên ('c') không lấy được ô của lớp đánh dấu chiAdmin trong danh-sach.json
  if (pv !== 'a' && (danhSach().lop || []).some((l: any) => l?.chiAdmin && l.thuMuc === thuMuc)) return res.status(403).json({ error: 'Không có quyền xem lớp này.' });
  const z = Number(req.params.z), x = Number(req.params.x), y = Number(String(req.params.y).replace(/\.webp$/, ''));
  if (!TEN_THU_MUC.test(thuMuc) || ![z, x, y].every((n) => Number.isInteger(n) && n >= 0) || z > 22) return res.status(400).end();
  const tep = path.join(GOC, 'tiles', thuMuc, String(z), String(x), `${y}.webp`);
  fs.stat(tep, (loi, st) => {
    if (loi || !st.isFile()) return res.status(404).end();   // ngoài vùng quy hoạch: không có ô → bản đồ để trống
    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'private, max-age=86400');      // chỉ máy của chính admin giữ; nginx / Cloudflare không giữ
    fs.createReadStream(tep).on('error', () => res.destroy()).pipe(res);
  });
});

// ── KHOÁ QUY HOẠCH CAM LÂM (15/10/2026, chủ dự án: "ở Cam Lâm chỉ cho 893 là được xem free, còn lại khoá lại") ──────────────
// Ảnh QĐ205 + 7 bản phân khu 1/2000 vẫn nằm ở kho ảnh công khai (volume camlam_tiles — không chép thêm GB nào vào ổ C) nhưng nginx
// đã CHẶN đường /tiles/qd205…, /tiles/qd2076… (trả 404). Máy chủ gắn CHỈ ĐỌC kho đó (QH_TILES_DIR, docker-compose.yml) và phát từng ô
// qua đường dưới đây — phải có vé admin như lớp 1/500. Chỉ phát đúng các bộ ảnh bị khoá (mẫu tên), không phát bộ khác.
const TILES_CONG = process.env.QH_TILES_DIR || path.resolve(process.cwd(), 'du-lieu-rieng', 'tiles-cong');
const BO_KHOA_CAM_LAM = /^(qd205|qd2076|qd2101|qd2222|qd918|qdcuhin|qdtaynam|qdtaybac)[a-z0-9]{0,8}$/;
// XEM THỬ (15/10/2026, chủ dự án: "các quy hoạch còn lại khi chọn vẫn cho hiện …, khi zoom lại gần hơn thì sẽ bị khoá và hiện bảng tính
// năng trả phí"): vé 'f' (tài khoản thường ĐÃ ĐĂNG NHẬP) lấy được ô tới mức Z_XEM_THU (khai ở đầu tệp); gần hơn 403. KHÔNG có vé → 403
// mọi mức (trước 15/10 tối cho cả người chưa đăng nhập — chủ dự án: "chưa đăng nhập vẫn xem được tạo lỗ hổng"). Vé 'a' / 'c' = mọi mức.
// GET /api/qh-rieng/t/:thuMuc/:z/:x/:y?v=<vé> — một ô PNG 256 của bộ ảnh quy hoạch Cam Lâm bị khoá
qhRiengRouter.get('/t/:thuMuc/:z/:x/:y', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const { thuMuc } = req.params;
  const z = Number(req.params.z), x = Number(req.params.x), y = Number(String(req.params.y).replace(/\.png$/, ''));
  if (!BO_KHOA_CAM_LAM.test(thuMuc) || ![z, x, y].every((n) => Number.isInteger(n) && n >= 0) || z > 22) return res.status(400).end();
  const pv = veHopLe(req.query.v);
  if (!pv) return res.status(403).json({ error: 'Vui lòng đăng nhập để xem bản đồ quy hoạch này.' });
  if (pv === 'f' && z > Z_XEM_THU) return res.status(403).json({ error: 'Xem bản đồ quy hoạch này ở mức gần là tính năng trả phí — vui lòng đăng ký thành viên.' });
  const tep = path.join(TILES_CONG, thuMuc, String(z), String(x), `${y}.png`);
  fs.stat(tep, (loi, st) => {
    if (loi || !st.isFile()) return res.status(404).end();
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'private, max-age=86400');      // chỉ máy của chính người xem giữ; nginx / Cloudflare không giữ
    fs.createReadStream(tep).on('error', () => res.destroy()).pipe(res);
  });
});
// GET /api/qh-rieng/tep/:ten?v=<vé> — tệp GeoJSON quy hoạch Cam Lâm bị khoá, gọi KHÔNG KÈM ĐUÔI (vd /tep/qh_vector → tep/qh_vector.geojson:
// ô đất QĐ205 bản cũ dùng cho lớp tô màu tuỳ chọn + sơ đồ dự phòng của phiếu in). Trước nằm ở thư mục công khai của web — nay nginx chặn
// đường cũ, tệp cất ở <QH_RIENG_DIR>/tep/. ⚠️ Không cho đường này đuôi ".geojson": nginx có luật "mọi đường đuôi .geojson → giao diện"
// nên đường có đuôi sẽ không bao giờ tới được máy chủ.
const TEN_TEP_DL = /^[a-z0-9][a-z0-9_-]{0,80}$/;
qhRiengRouter.get('/tep/:ten', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const pv = veHopLe(req.query.v);
  if (!pv || pv === 'f') return res.status(403).json({ error: 'Vui lòng đăng ký thành viên để xem lớp này.' });   // tệp ô đất: không cho vé xem thử
  const ten = String(req.params.ten);
  if (!TEN_TEP_DL.test(ten)) return res.status(400).end();
  const tep = path.join(GOC, 'tep', ten + '.geojson');
  if (!fs.existsSync(tep)) return res.status(404).json({ error: 'Chưa có tệp này trên máy chủ.' });
  res.set('Content-Type', 'application/geo+json');
  res.set('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(tep).on('error', () => res.destroy()).pipe(res);
});

const TEN_TEP = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.pdf$/;
// GET /api/qh-rieng/tai-lieu/:ten?v=<vé> — bản quét quyết định phê duyệt (mở trong trình duyệt)
qhRiengRouter.get('/tai-lieu/:ten', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const pvTl = veHopLe(req.query.v);
  if (!pvTl || pvTl === 'f') return res.status(403).json({ error: 'Không có quyền xem tài liệu này.' });
  const ten = String(req.params.ten);
  if (!TEN_TEP.test(ten)) return res.status(400).end();
  const tep = path.join(GOC, 'tai-lieu', ten);
  if (!fs.existsSync(tep)) return res.status(404).json({ error: 'Chưa có tài liệu này trên máy chủ.' });
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${ten}"`);
  fs.createReadStream(tep).on('error', () => res.destroy()).pipe(res);
});
