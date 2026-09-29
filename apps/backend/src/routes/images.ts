import { Router } from 'express';
import multer from 'multer';
import { query } from '../lib/db.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';

export const imagesRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 30 } });

/* ── NHẬN DIỆN LOẠI FILE BẰNG CHỮ KÝ NHỊ PHÂN (29/9/2026 — rà soát bảo mật) ──────────────────
   ⚠️ KHÔNG tin `mimetype` trình duyệt gửi lên: kẻ xấu tự khai được. Trước đây nhận mọi thứ bắt đầu
      bằng "image/" → tải được ẢNH SVG CHỨA MÃ <script>, rồi /api/images/:id trả lại đúng loại đó
      trên CÙNG TÊN MIỀN → ai mở link là mã chạy, lấy được thẻ đăng nhập.
   Nay đọc vài byte đầu của file (mỗi định dạng có "chữ ký" cố định) và CHỈ nhận 5 loại dưới đây. */
function loaiThat(b: Buffer | undefined | null): string | null {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';                                   // FF D8 FF
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';                   // .PNG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';                   // GIF8
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';   // RIFF....WEBP
  if (b.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf';                                       // %PDF-
  return null;
}
const LOAI_DUOC_PHEP = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);

// Tiêu đề bảo mật khi trả file: trình duyệt KHÔNG được tự đoán loại khác (nosniff); loại lạ còn sót
// trong DB từ trước (vd SVG) thì trả dạng TẢI VỀ chứ không hiển thị trên tên miền của web.
function datLoai(res: any, mime: string | null | undefined, macDinh: string) {
  const m = mime || macDinh;
  res.set('X-Content-Type-Options', 'nosniff');
  if (LOAI_DUOC_PHEP.has(m)) { res.set('Content-Type', m); return; }
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', 'attachment');
}

// POST /api/images — tải ảnh lên (môi giới/admin). Nhận "files" (ảnh to) + "thumbs" (ảnh nhỏ, tuỳ chọn). Trả [{id,url}]
imagesRouter.post('/', authRequired, upload.fields([{ name: 'files', maxCount: 15 }, { name: 'thumbs', maxCount: 15 }]), async (req: AuthedRequest, res, next) => {
  try {
    const fmap = (req.files as Record<string, Express.Multer.File[]>) ?? {};
    const files = fmap.files ?? (Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : []);
    const thumbs = fmap.thumbs ?? [];
    if (!files.length) return res.status(400).json({ error: 'Không có ảnh nào' });
    const images: { id: number; url: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      // Nhận ẢNH (jpeg/png/gif/webp) + PDF (đính kèm công văn danh sách nóng) — theo CHỮ KÝ NHỊ PHÂN thật.
      const mime = loaiThat(f.buffer);
      if (!mime) continue;
      const t = thumbs[i];
      const thumb = t && loaiThat(t.buffer)?.startsWith('image/') ? t.buffer : null;
      const [row] = await query(
        `INSERT INTO listing_images (owner_id, mime, bytes, size, thumb) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [req.user!.id, mime, f.buffer, f.size, thumb]);
      images.push({ id: row.id, url: `/api/images/${row.id}` });
    }
    if (!images.length) return res.status(400).json({ error: 'Chỉ nhận ảnh JPG, PNG, WebP, GIF hoặc file PDF.' });
    res.status(201).json({ images });
  } catch (e) { next(e); }
});

const soId = (v: string) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 2 ** 31 ? n : null; };

// Đuôi .webp/.jpg trong URL (vd /api/images/12/thumb.webp) KHÔNG đổi ảnh — chỉ để Cloudflare
// nhận diện là file tĩnh và CACHE ở biên (gần người dùng) => điện thoại tải ảnh nhanh hơn nhiều.
// GET /api/images/:id/thumb(.webp) — ảnh THU NHỎ cho thẻ tin (nhẹ). Ảnh cũ chưa có thumb thì trả ảnh gốc.
imagesRouter.get(['/:id/thumb.:ext', '/:id/thumb'], async (req, res, next) => {
  try {
    const id = soId(req.params.id); if (!id) return res.status(404).end();
    const [row] = await query('SELECT mime, thumb, bytes FROM listing_images WHERE id=$1', [id]);
    if (!row) return res.status(404).end();
    datLoai(res, row.thumb ? (loaiThat(row.thumb) || 'image/webp') : row.mime, 'image/webp');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(row.thumb || row.bytes);
  } catch (e) { next(e); }
});

// GET /api/images/:id(.webp) — phục vụ ảnh gốc từ DB
imagesRouter.get(['/:id.:ext', '/:id'], async (req, res, next) => {
  try {
    const id = soId(req.params.id); if (!id) return res.status(404).end();
    const [row] = await query('SELECT mime, bytes FROM listing_images WHERE id=$1', [id]);
    if (!row) return res.status(404).end();
    datLoai(res, row.mime, 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(row.bytes);
  } catch (e) { next(e); }
});
