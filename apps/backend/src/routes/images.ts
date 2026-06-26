import { Router } from 'express';
import multer from 'multer';
import { query } from '../lib/db.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';

export const imagesRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 15 } });

// POST /api/images — tải ảnh lên (môi giới/admin). Trả [{id,url}]
imagesRouter.post('/', authRequired, upload.array('files', 15), async (req: AuthedRequest, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) return res.status(400).json({ error: 'Không có ảnh nào' });
    const images: { id: number; url: string }[] = [];
    for (const f of files) {
      if (!String(f.mimetype).startsWith('image/')) continue;
      const [row] = await query(
        `INSERT INTO listing_images (owner_id, mime, bytes, size) VALUES ($1,$2,$3,$4) RETURNING id`,
        [req.user!.id, f.mimetype, f.buffer, f.size]);
      images.push({ id: row.id, url: `/api/images/${row.id}` });
    }
    res.status(201).json({ images });
  } catch (e) { next(e); }
});

// GET /api/images/:id — phục vụ ảnh từ DB
imagesRouter.get('/:id', async (req, res, next) => {
  try {
    const [row] = await query('SELECT mime, bytes FROM listing_images WHERE id=$1', [Number(req.params.id)]);
    if (!row) return res.status(404).end();
    res.set('Content-Type', row.mime || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(row.bytes);
  } catch (e) { next(e); }
});
