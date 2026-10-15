// ═══════════════════════════════════════════════════════════════════════════════
// LỚP QUY HOẠCH CHỈ QUẢN TRỊ VIÊN XEM (14/10/2026)
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
const KHOA = crypto.createHash('sha256').update('qh-rieng|' + env.jwtSecret).digest();
const bam = (s: string) => crypto.createHmac('sha256', KHOA).update(s).digest('base64url').slice(0, 22);

function danhSach(): { lop: any[] } {
  try { return JSON.parse(fs.readFileSync(path.join(GOC, 'danh-sach.json'), 'utf8')); }
  catch { return { lop: [] }; }
}
// PHẠM VI VÉ (15/10/2026): 'a' = admin — mọi lớp riêng (cả 1/500); 'c' = khách có GÓI CHỨC NĂNG CHUNG còn hạn (lib/auth.ts coGoiChung) —
// ảnh QĐ205 + phân khu (/t/) và tệp ô đất (/tep/), KHÔNG có 1/500 (/o/, /tai-lieu/). Vé cũ 3 phần (trước 15/10) là vé admin → 'a'.
// Trả về phạm vi của vé hợp lệ, hoặc null (vé giả / hết hạn).
function veHopLe(ve: unknown): 'a' | 'c' | null {
  const p = String(ve || '').split('.');
  if ((p.length !== 3 && p.length !== 4) || !/^\d+$/.test(p[0]) || !/^\d+$/.test(p[1])) return null;
  const pham = p.length === 4 ? p[2] : 'a';
  if (pham !== 'a' && pham !== 'c') return null;
  const than = p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}` : `${p[0]}.${p[1]}`;
  const a = Buffer.from(bam(than)), b = Buffer.from(p[p.length - 1]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;   // chữ ký sai → vé giả
  return Number(p[1]) > Date.now() ? pham : null;                            // hết hạn
}

// GET /api/qh-rieng/ve — vé xem + danh sách lớp riêng. ADMIN (phạm vi 'a', kèm danh sách lớp riêng) hoặc khách trả phí bản đồ Cam Lâm
// (gói chức năng chung — phạm vi 'c', danh sách lớp riêng RỖNG vì không mở 1/500; vé KHÔNG sống quá ngày hết hạn gói). Người khác 403.
qhRiengRouter.get('/ve', authRequired, (req: AuthedRequest, res) => {
  res.set('Cache-Control', 'private, no-store');
  const pham = laAdmin(req.user as any) ? 'a' : coGoiChung(req.user as any) ? 'c' : null;
  if (!pham) return res.status(403).json({ error: 'Vui lòng liên hệ admin để xem lớp này.' });
  const hetHan = Math.min(Date.now() + VE_GIO * 3600 * 1000, pham === 'c' ? Number(req.user!.gc) || 0 : Infinity);
  const than = `${req.user!.id}.${hetHan}.${pham}`;
  res.json({ ve: `${than}.${bam(than)}`, hetHan, lop: pham === 'a' ? (danhSach().lop || []) : [] });
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
  if (veHopLe(req.query.v) !== 'a') return res.status(403).json({ error: 'Không có quyền xem lớp này.' });
  const { thuMuc } = req.params;
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
// XEM Ở MỨC NHÌN XA KHÔNG CẦN VÉ (15/10/2026, chủ dự án: "các quy hoạch còn lại khi chọn vẫn cho hiện …, khi zoom lại gần hơn thì sẽ bị
// khoá và hiện bảng tính năng trả phí" — "cho hiện ở z nhỏ nhất của bản đồ đó có"). Người không có vé chỉ lấy được ô ở MỨC PHÓNG XA
// NHẤT mà bộ ảnh đó có (thư mục số nhỏ nhất: QĐ205 = 10, 7 bản phân khu = 8 — đo 15/10/2026); gần hơn vẫn đòi vé (403). Giao diện
// (app/map/page.tsx) lấy đúng mức đó làm mức xem thử, phóng gần hơn là ẩn lớp + hộp "tính năng trả phí".
const zXaNhatNho = new Map<string, number>();
function zXaNhat(thuMuc: string): number {
  const co = zXaNhatNho.get(thuMuc);
  if (co !== undefined) return co;
  let z = -1;   // không đọc được thư mục → không cho xem thử mức nào
  try {
    const ds = fs.readdirSync(path.join(TILES_CONG, thuMuc)).filter((t) => /^\d{1,2}$/.test(t)).map(Number);
    if (ds.length) z = Math.min(...ds);
  } catch { /* chưa có bộ ảnh */ }
  if (z >= 0) zXaNhatNho.set(thuMuc, z);
  return z;
}
// GET /api/qh-rieng/t/:thuMuc/:z/:x/:y?v=<vé> — một ô PNG 256 của bộ ảnh quy hoạch Cam Lâm bị khoá
qhRiengRouter.get('/t/:thuMuc/:z/:x/:y', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const { thuMuc } = req.params;
  const z = Number(req.params.z), x = Number(req.params.x), y = Number(String(req.params.y).replace(/\.png$/, ''));
  if (!BO_KHOA_CAM_LAM.test(thuMuc) || ![z, x, y].every((n) => Number.isInteger(n) && n >= 0) || z > 22) return res.status(400).end();
  const coVe = !!veHopLe(req.query.v);
  if (!coVe && z !== zXaNhat(thuMuc)) return res.status(403).json({ error: 'Phóng gần bản đồ quy hoạch này là tính năng trả phí — vui lòng liên hệ admin.' });
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
  if (!veHopLe(req.query.v)) return res.status(403).json({ error: 'Vui lòng liên hệ admin để xem lớp này.' });
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
  if (veHopLe(req.query.v) !== 'a') return res.status(403).json({ error: 'Không có quyền xem tài liệu này.' });
  const ten = String(req.params.ten);
  if (!TEN_TEP.test(ten)) return res.status(400).end();
  const tep = path.join(GOC, 'tai-lieu', ten);
  if (!fs.existsSync(tep)) return res.status(404).json({ error: 'Chưa có tài liệu này trên máy chủ.' });
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${ten}"`);
  fs.createReadStream(tep).on('error', () => res.destroy()).pipe(res);
});
