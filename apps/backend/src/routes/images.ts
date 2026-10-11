import { Router } from 'express';
import multer from 'multer';
import { query } from '../lib/db.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
// Nhận diện loại file bằng CHỮ KÝ NHỊ PHÂN (29/9/2026 — rà soát bảo mật), nay dùng chung với tệp chat: xem lib/loaiTep.ts.
import { loaiThat, datLoaiAnToan as datLoai } from '../lib/loaiTep.ts';
import { kyTepHopLe } from '../lib/kyTep.ts';

// Tệp RIÊNG (công văn đính kèm danh sách nóng — lib/kyTep.ts): chỉ mở được bằng link có chữ ký còn hạn, và KHÔNG cho
// nginx / Cloudflare / trình duyệt giữ lại. Không có chữ ký thì trả "không tìm thấy" (không để lộ là tệp có tồn tại).
// Trả true nếu đã trả lời từ chối.
function chanTepRieng(req: any, res: any, id: number, rieng: boolean): boolean {
  if (!rieng) return false;
  if (kyTepHopLe(id, req.query.het, req.query.ky)) { res.set('Cache-Control', 'private, no-store'); return false; }
  res.set('Cache-Control', 'no-store');
  res.status(404).end();
  return true;
}

export const imagesRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 30 } });

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
    const [row] = await query('SELECT mime, thumb, bytes, rieng FROM listing_images WHERE id=$1', [id]);
    if (!row) return res.status(404).end();
    if (chanTepRieng(req, res, id, row.rieng)) return;
    datLoai(res, row.thumb ? (loaiThat(row.thumb) || 'image/webp') : row.mime, 'image/webp');
    if (!row.rieng) res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(row.thumb || row.bytes);
  } catch (e) { next(e); }
});

// GET /api/images/:id(.webp) — phục vụ ảnh gốc từ DB
imagesRouter.get(['/:id.:ext', '/:id'], async (req, res, next) => {
  try {
    const id = soId(req.params.id); if (!id) return res.status(404).end();
    const [row] = await query('SELECT mime, bytes, rieng FROM listing_images WHERE id=$1', [id]);
    if (!row) return res.status(404).end();
    if (chanTepRieng(req, res, id, row.rieng)) return;
    datLoai(res, row.mime, 'image/jpeg');
    if (!row.rieng) res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(row.bytes);
  } catch (e) { next(e); }
});
