// KHO HỒ SƠ (dùng tạm — dễ gỡ): nơi cất các file danh mục Excel/PDF đã lập, chia theo thư mục
// (mặc định có sẵn thư mục "Phòng Kinh tế"). Gỡ ra = xoá 1 dòng app.use trong index.ts + file này.
//
// File cất THẲNG trong database (cột BYTEA) giống hệt cách làm với ảnh tin đăng — sao lưu database
// là sao lưu luôn cả kho, khỏi phải nhớ thêm thư mục nào trên ổ đĩa.
//
// HAI CÁCH TẢI LÊN:
//  1. Người dùng bấm nút trên web  → cần đăng nhập, tài khoản admin hoặc vai trò 'danhmuc'.
//  2. Máy tự tải lên (script chạy nền) → gửi kèm header  X-Kho-Token: <KHO_TOKEN trong .env>.
//     Nhờ cách 2 mà cái script canh thư mục trên máy có thể tự đẩy file lên, không cần đăng nhập.
import { Router } from 'express';
import multer from 'multer';
import { timingSafeEqual } from 'node:crypto';
import { query } from '../lib/db.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { coVaiTro, laAdmin } from '../lib/auth.ts';
import { vnNoAccent } from '../lib/vn.ts';

export const khoHoSoRouter = Router();

// 30MB mỗi file, 60 file một lượt — file danh mục Excel chỉ vài chục KB nên rất thoải mái.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 60 } });

// Chỉ nhận mấy loại file hồ sơ thật sự — chặn luôn file chạy được (.exe, .bat…) cho an toàn.
const DUOI_CHO_PHEP = /\.(xlsx|xls|csv|pdf|docx|doc|jpg|jpeg|png|webp|zip)$/i;

// ── Số thứ tự lấy từ ĐẦU TÊN FILE ──
// "0490 nguyễn thị thanh vân thửa 263.xlsx" → 490. Đây chính là số bạn tự đánh khi đặt tên file,
// và cũng là thứ tự sắp xếp mặc định của cả kho.
function soDauTen(ten: string): number | null {
  const m = String(ten).trim().match(/^(\d{1,6})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

// Tên file do trình duyệt gửi lên hay bị lệch bảng mã (tiếng Việt thành ký tự lạ) — dựng lại cho đúng.
function suaTen(ten: string): string {
  let s = String(ten || 'khong-ten');
  try { const lai = Buffer.from(s, 'latin1').toString('utf8'); if (!/�/.test(lai)) s = lai; } catch { /* giữ nguyên */ }
  return s.replace(/[\\/\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) || 'khong-ten';
}

function chuanSlug(s: any): string {
  return vnNoAccent(String(s || '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// Chìa khoá của máy tự tải lên: gửi ở header X-Kho-Token, hoặc ?token= trên URL nếu công cụ gửi
// không đặt được header. Đặt trên URL thì chìa khoá lọt vào nhật ký máy chủ — chỉ dùng khi bí.
function dungChiaKhoa(req: AuthedRequest): boolean {
  const token = String(process.env.KHO_TOKEN || '').trim();
  if (!token) return false;                                  // chưa đặt KHO_TOKEN trong .env thì tắt hẳn đường này
  const gui = String(req.headers['x-kho-token'] || (req.query as any)?.token || '').trim();
  // So kiểu "thời gian không đổi" (11/10/2026): so bằng === thì sai càng muộn trả lời càng chậm một chút → đo được để dò dần chìa khoá.
  const a = Buffer.from(gui), b = Buffer.from(token);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

// Vào được kho danh mục hồ sơ: quản trị và vai trò 'danhmuc'.
// KHÔNG gộp chung với 'vanban' — quản lý văn bản pháp luật và kho danh mục hồ sơ là HAI VIỆC RIÊNG,
// hai người khác nhau làm. Ai cần cả hai thì cấp cả hai vai trò (một tài khoản giữ được nhiều vai trò).
const VAI_TRO_VAO_KHO = ['admin', 'danhmuc'];
// Một người có thể giữ nhiều vai trò → phải xét CẢ DANH SÁCH vai trò, không xét mỗi vai trò chính.
const duocVaoKho = (req: AuthedRequest) => coVaiTro(req.user, ...VAI_TRO_VAO_KHO);

// Cho phép đi tiếp nếu: (a) có chìa khoá đúng, hoặc (b) đã đăng nhập với vai trò được vào kho.
function choPhepGhi(req: AuthedRequest, res: any, next: any) {
  if (dungChiaKhoa(req)) return next();                      // máy tự tải lên
  return authRequired(req, res, () => {
    if (!duocVaoKho(req)) return res.status(403).json({ error: 'Bạn chưa được cấp quyền thay đổi kho danh mục hồ sơ (tải lên, sửa, xoá)' });
    next();
  });
}

// Được xem ĐẦY ĐỦ (tên thật, mở xem, tải về) hay không.
function xemDayDu(req: AuthedRequest) {
  return dungChiaKhoa(req) || duocVaoKho(req);
}

// Xem ĐẦY ĐỦ: mở nội dung file, tải file về. Chỉ vai trò được cấp.
function choPhepXem(req: AuthedRequest, res: any, next: any) {
  if (dungChiaKhoa(req)) return next();
  return authRequired(req, res, () => {
    if (!duocVaoKho(req)) return res.status(403).json({ error: 'Bạn chưa được cấp quyền xem nội dung file trong kho danh mục hồ sơ' });
    next();
  });
}

// Xem HẠN CHẾ: ai đăng nhập cũng lướt được danh sách cho biết kho có gì,
// nhưng tên file bị che bớt và không mở/tải/xoá được gì cả.
function choPhepLuot(req: AuthedRequest, res: any, next: any) {
  if (dungChiaKhoa(req)) return next();
  return authRequired(req, res, next);
}

// Che tên file với người chưa được cấp quyền: CHỈ giữ lại số thứ tự ở đầu và đuôi file,
// phần còn lại thay hết bằng chấm.
// Vì sao không giữ 1/3 đầu như kiểu che thông thường: tên file ở đây đặt theo mẫu
// "0325 đoàn duy tân thửa 316 tờ 233…" — 1/3 đầu rơi đúng vào TÊN NGƯỜI DÂN, che kiểu đó
// thành ra vẫn lộ. Số thứ tự thì không phải thông tin riêng tư (cột STT vốn đã hiện rồi).
// CHE Ở MÁY CHỦ chứ không phải chỉ làm mờ trên màn hình — có mở phần xem dữ liệu của trình
// duyệt cũng không đọc được gì thêm.
function cheTen(ten: string) {
  const i = ten.lastIndexOf('.');
  const duoi = i > 0 ? ten.slice(i) : '';
  const goc = i > 0 ? ten.slice(0, i) : ten;
  const so = (goc.match(/^\s*\d+/) || [''])[0].trim();      // số thứ tự đầu tên, ví dụ "0325"
  const con = goc.slice(so.length);
  const soCham = Math.min(24, Math.max(8, Math.ceil((con.length * 2) / 3)));
  return (so ? so + ' ' : '') + '•'.repeat(soCham) + duoi;
}

// GET /api/kho-ho-so/thu-muc — danh sách thư mục + đếm số file trong mỗi thư mục.
khoHoSoRouter.get('/thu-muc', choPhepLuot, async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT t.slug, t.ten, t.icon, t.thu_tu,
             COALESCE(c.n, 0)::int AS so_file,
             COALESCE(c.bytes, 0)::bigint AS tong_bytes
        FROM kho_thu_muc t
        LEFT JOIN (SELECT thu_muc, COUNT(*) n, SUM(co_bytes) bytes FROM kho_files GROUP BY thu_muc) c
               ON c.thu_muc = t.slug
       ORDER BY t.thu_tu, t.ten`);
    res.json({ thuMuc: rows });
  } catch (e) { next(e); }
});

// POST /api/kho-ho-so/thu-muc — tạo thư mục mới.
khoHoSoRouter.post('/thu-muc', choPhepGhi, async (req, res, next) => {
  try {
    const ten = String((req.body as any)?.ten || '').trim();
    if (!ten) return res.status(400).json({ error: 'Chưa nhập tên thư mục' });
    const slug = chuanSlug(ten);
    if (!slug) return res.status(400).json({ error: 'Tên thư mục không hợp lệ' });
    const icon = String((req.body as any)?.icon || '📁').slice(0, 8);
    await query(`INSERT INTO kho_thu_muc (slug, ten, icon) VALUES ($1,$2,$3) ON CONFLICT (slug) DO UPDATE SET ten=EXCLUDED.ten, icon=EXCLUDED.icon`, [slug, ten.slice(0, 80), icon]);
    res.status(201).json({ slug, ten, icon });
  } catch (e) { next(e); }
});

// DELETE /api/kho-ho-so/thu-muc/:slug — xoá thư mục RỖNG (còn file thì không cho xoá, tránh mất nhầm).
// Admin thêm ?ca=1 thì xoá luôn cả file bên trong.
khoHoSoRouter.delete('/thu-muc/:slug', choPhepGhi, async (req: AuthedRequest, res, next) => {
  try {
    const slug = chuanSlug(req.params.slug);
    if (slug === 'phong-kinh-te') return res.status(400).json({ error: 'Thư mục Phòng Kinh tế là thư mục gốc, không xoá được' });
    const [c] = await query<{ n: string }>('SELECT COUNT(*) n FROM kho_files WHERE thu_muc=$1', [slug]);
    const soFile = Number(c?.n || 0);
    // Thư mục còn file thì bình thường KHÔNG cho xoá (tránh mất dữ liệu do lỡ tay).
    // Riêng ADMIN được phép xoá cả thư mục lẫn file bên trong khi thêm ?ca=1 — dùng khi tải nhầm cả
    // một mớ, phải dọn nhanh chứ ngồi xoá từng file thì cực.
    if (soFile > 0) {
      if (!laAdmin(req.user) || String(req.query.ca || '') !== '1')
        return res.status(400).json({ error: 'Thư mục còn ' + soFile + ' file — xoá hết file rồi mới xoá được thư mục' });
      await query('DELETE FROM kho_files WHERE thu_muc=$1', [slug]);
    }
    await query('DELETE FROM kho_thu_muc WHERE slug=$1', [slug]);
    res.json({ ok: true, daXoaFile: soFile });
  } catch (e) { next(e); }
});

// GET /api/kho-ho-so?thu_muc=&q=&sort= — danh sách file (KHÔNG kèm nội dung file, chỉ thông tin).
// sort: stt (mặc định, theo số đầu tên file) · stt_giam · ten · moi (mới tải lên trước)
khoHoSoRouter.get('/', choPhepLuot, async (req, res, next) => {
  try {
    const dayDu = xemDayDu(req);
    const thuMuc = chuanSlug(req.query.thu_muc || 'phong-kinh-te') || 'phong-kinh-te';
    // Người chỉ được lướt thì KHÔNG cho tìm theo chữ — nếu không họ gõ thử tên người để dò ra
    // ai có hồ sơ trong kho, che tên cũng thành vô nghĩa. Vẫn cho tìm theo số thứ tự.
    const qGoc = String(req.query.q || '').trim();
    const q = dayDu ? qGoc : (/^\d+$/.test(qGoc) ? qGoc : '');
    const sort = String(req.query.sort || 'stt');
    // Sắp xếp: file CÓ số thứ tự lên trước và xếp theo số; file chưa đánh số dồn xuống cuối theo tên.
    const thuTu = sort === 'stt_giam' ? 'so_tt DESC NULLS LAST, ten DESC'
      : sort === 'ten' ? 'ten ASC'
      : sort === 'moi' ? 'created_at DESC'
      : 'so_tt ASC NULLS LAST, ten ASC';
    const dk: string[] = ['thu_muc = $1'];
    const bien: any[] = [thuMuc];
    if (q) {
      // Tìm không dấu: gõ "thanh van" vẫn ra "thanh vân". Gõ số "490" thì tìm cả theo số thứ tự.
      bien.push('%' + vnNoAccent(q).toLowerCase() + '%');
      const soTim = Number(q.replace(/\D/g, ''));
      if (/^\d+$/.test(q.trim()) && Number.isFinite(soTim)) { bien.push(soTim); dk.push(`(ten_khong_dau LIKE $${bien.length - 1} OR so_tt = $${bien.length})`); }
      else dk.push(`ten_khong_dau LIKE $${bien.length}`);
    }
    const rows = await query<any>(`
      SELECT id, thu_muc, so_tt, ten, mime, co_bytes, ghi_chu, created_at
        FROM kho_files WHERE ${dk.join(' AND ')} ORDER BY ${thuTu} LIMIT 2000`, bien);
    // Chưa được cấp quyền: che 2/3 tên và bỏ luôn ghi chú (ghi chú cũng có thể lộ thông tin).
    const files = dayDu ? rows : rows.map((r) => ({ ...r, ten: cheTen(String(r.ten)), ghi_chu: null }));
    res.json({ files, dayDu });
  } catch (e) { next(e); }
});

// ── TẢI FILE LÊN ── dùng chung cho cả 3 đường vào:
//   · web bấm nút        → POST /api/kho-ho-so
//   · máy tự tải lên     → POST /api/danh-muc/upload   (đường mà Claude / script gửi file vào)
// Nhận file ở BẤT KỲ tên trường nào (files, file, upload…) cho dễ ghép với mọi công cụ gửi.
// Tải lại file TRÙNG TÊN thì ĐÈ lên bản cũ (coi như cập nhật), không đẻ ra bản thứ hai.
async function xuLyTaiLen(req: AuthedRequest, res: any, next: any) {
  try {
    const raw = req.files as any;
    const files: Express.Multer.File[] = Array.isArray(raw) ? raw : raw ? Object.values(raw).flat() as any : [];
    if (!files.length) return res.status(400).json({ error: 'Không có file nào được gửi lên' });
    // Thư mục nhận file: lấy theo body, hoặc header X-Kho-Thu-Muc, hoặc ?thu_muc= trên URL.
    const thuMuc = chuanSlug((req.body as any)?.thu_muc || req.headers['x-kho-thu-muc'] || req.query?.thu_muc || 'phong-kinh-te') || 'phong-kinh-te';
    // Thư mục chưa có thì tạo luôn — script tự tải lên khỏi phải vào web bấm tạo trước.
    await query(`INSERT INTO kho_thu_muc (slug, ten) VALUES ($1,$2) ON CONFLICT (slug) DO NOTHING`, [thuMuc, thuMuc]).catch(() => {});
    const xong: any[] = [];
    const boQua: { ten: string; vi_sao: string }[] = [];
    for (const f of files) {
      const ten = suaTen(f.originalname);
      if (!DUOI_CHO_PHEP.test(ten)) { boQua.push({ ten, vi_sao: 'Loại file không nhận (chỉ nhận Excel, PDF, Word, ảnh, ZIP)' }); continue; }
      const [row] = await query<{ id: string }>(`
        INSERT INTO kho_files (thu_muc, so_tt, ten, ten_khong_dau, mime, co_bytes, du_lieu, nguoi_tai)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (thu_muc, ten) DO UPDATE
          SET so_tt = EXCLUDED.so_tt, mime = EXCLUDED.mime, co_bytes = EXCLUDED.co_bytes,
              du_lieu = EXCLUDED.du_lieu, ten_khong_dau = EXCLUDED.ten_khong_dau, created_at = now()
        RETURNING id`,
        [thuMuc, soDauTen(ten), ten, vnNoAccent(ten).toLowerCase(), f.mimetype || 'application/octet-stream', f.size, f.buffer, req.user?.id ?? null]);
      xong.push({ id: Number(row.id), ten, so_tt: soDauTen(ten), co_bytes: f.size });
    }
    res.status(201).json({ ok: true, daTai: xong.length, files: xong, boQua });
  } catch (e) { next(e); }
}

khoHoSoRouter.post('/', choPhepGhi, upload.any(), xuLyTaiLen);
khoHoSoRouter.post('/upload', choPhepGhi, upload.any(), xuLyTaiLen);

// ĐƯỜNG RIÊNG CHO MÁY TỰ TẢI LÊN: POST /api/danh-muc/upload
// Gắn ở index.ts TRƯỚC bộ hạn chế số lần của /api/danh-muc — vì bộ đó chỉ cho 20 lần/10 phút
// (hợp cho việc chạy AI lập danh mục, nhưng đẩy vài chục file lên kho thì tắc ngay).
export const khoUploadRouter = Router();
khoUploadRouter.post('/upload', choPhepGhi, upload.any(), xuLyTaiLen);
// Gọi thử xem đã thông chưa mà không cần gửi file: GET /api/danh-muc/upload
khoUploadRouter.get('/upload', choPhepGhi, (_req, res) => res.json({ ok: true, san_sang: true, huong_dan: 'Gửi POST kèm file ở trường "files" (nhiều file cũng được), thêm header X-Kho-Token' }));

// GET /api/kho-ho-so/:id/tai — tải MỘT file về máy (nút ⬇ ở từng dòng).
khoHoSoRouter.get('/:id/tai', choPhepXem, async (req, res, next) => {
  try {
    const [row] = await query<{ ten: string; mime: string; du_lieu: Buffer }>('SELECT ten, mime, du_lieu FROM kho_files WHERE id=$1', [Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy file' });
    // filename* để trình duyệt giữ đúng tên tiếng Việt có dấu khi lưu về máy.
    const anToan = row.ten.replace(/["\r\n]/g, '');
    res.set('Content-Type', row.mime || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(anToan)}"; filename*=UTF-8''${encodeURIComponent(anToan)}`);
    res.set('Cache-Control', 'private, no-store');
    res.send(row.du_lieu);
  } catch (e) { next(e); }
});

// PATCH /api/kho-ho-so/:id — đổi tên / ghi chú / chuyển sang thư mục khác.
khoHoSoRouter.patch('/:id', choPhepGhi, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = (req.body as any) || {};
    const dat: string[] = []; const bien: any[] = [];
    if (typeof b.ten === 'string' && b.ten.trim()) {
      const ten = suaTen(b.ten);
      bien.push(ten); dat.push(`ten = $${bien.length}`);
      bien.push(vnNoAccent(ten).toLowerCase()); dat.push(`ten_khong_dau = $${bien.length}`);
      bien.push(soDauTen(ten)); dat.push(`so_tt = $${bien.length}`);
    }
    if (typeof b.ghi_chu === 'string') { bien.push(b.ghi_chu.slice(0, 500)); dat.push(`ghi_chu = $${bien.length}`); }
    if (typeof b.thu_muc === 'string' && chuanSlug(b.thu_muc)) { bien.push(chuanSlug(b.thu_muc)); dat.push(`thu_muc = $${bien.length}`); }
    if (!dat.length) return res.status(400).json({ error: 'Không có gì để sửa' });
    bien.push(id);
    await query(`UPDATE kho_files SET ${dat.join(', ')} WHERE id = $${bien.length}`, bien);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/kho-ho-so/:id — xoá 1 file. Xoá NHIỀU: gửi POST /xoa-nhieu với { ids: [...] }.
khoHoSoRouter.delete('/:id', choPhepGhi, async (req, res, next) => {
  try { await query('DELETE FROM kho_files WHERE id=$1', [Number(req.params.id)]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

khoHoSoRouter.post('/xoa-nhieu', choPhepGhi, async (req, res, next) => {
  try {
    const ids = (Array.isArray((req.body as any)?.ids) ? (req.body as any).ids : []).map(Number).filter(Number.isFinite).slice(0, 500);
    if (!ids.length) return res.status(400).json({ error: 'Chưa chọn file nào' });
    await query('DELETE FROM kho_files WHERE id = ANY($1::bigint[])', [ids]);
    res.json({ ok: true, daXoa: ids.length });
  } catch (e) { next(e); }
});
