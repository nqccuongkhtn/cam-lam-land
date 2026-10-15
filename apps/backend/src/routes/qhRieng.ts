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
import { adminRequired, type AuthedRequest } from '../middleware/auth.ts';

export const qhRiengRouter = Router();

const GOC = process.env.QH_RIENG_DIR || path.resolve(process.cwd(), 'du-lieu-rieng', 'qh-rieng');
const VE_GIO = 24;
const KHOA = crypto.createHash('sha256').update('qh-rieng|' + env.jwtSecret).digest();
const bam = (s: string) => crypto.createHmac('sha256', KHOA).update(s).digest('base64url').slice(0, 22);

function danhSach(): { lop: any[] } {
  try { return JSON.parse(fs.readFileSync(path.join(GOC, 'danh-sach.json'), 'utf8')); }
  catch { return { lop: [] }; }
}
function veHopLe(ve: unknown): boolean {
  const p = String(ve || '').split('.');
  if (p.length !== 3 || !/^\d+$/.test(p[0]) || !/^\d+$/.test(p[1])) return false;
  const a = Buffer.from(bam(`${p[0]}.${p[1]}`)), b = Buffer.from(p[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;   // chữ ký sai → vé giả
  return Number(p[1]) > Date.now();                                          // hết hạn
}

// GET /api/qh-rieng/ve — vé xem + danh sách lớp riêng. CHỈ ADMIN.
qhRiengRouter.get('/ve', adminRequired, (req: AuthedRequest, res) => {
  const hetHan = Date.now() + VE_GIO * 3600 * 1000;
  const than = `${req.user!.id}.${hetHan}`;
  res.set('Cache-Control', 'private, no-store');
  res.json({ ve: `${than}.${bam(than)}`, hetHan, lop: danhSach().lop || [] });
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
  if (!veHopLe(req.query.v)) return res.status(403).json({ error: 'Không có quyền xem lớp này.' });
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

const TEN_TEP = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.pdf$/;
// GET /api/qh-rieng/tai-lieu/:ten?v=<vé> — bản quét quyết định phê duyệt (mở trong trình duyệt)
qhRiengRouter.get('/tai-lieu/:ten', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!veHopLe(req.query.v)) return res.status(403).json({ error: 'Không có quyền xem tài liệu này.' });
  const ten = String(req.params.ten);
  if (!TEN_TEP.test(ten)) return res.status(400).end();
  const tep = path.join(GOC, 'tai-lieu', ten);
  if (!fs.existsSync(tep)) return res.status(404).json({ error: 'Chưa có tài liệu này trên máy chủ.' });
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${ten}"`);
  fs.createReadStream(tep).on('error', () => res.destroy()).pipe(res);
});
