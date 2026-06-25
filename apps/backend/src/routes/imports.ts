import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { query } from '../lib/db.ts';
import { env } from '../lib/env.ts';
import { adminRequired, type AuthedRequest } from '../middleware/auth.ts';

export const importsRouter = Router();

fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^\w.\-]/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

const FORMATS: Record<string, string> = { '.dgn': 'dgn', '.shp': 'shp', '.zip': 'shp', '.geojson': 'geojson', '.json': 'geojson' };

// POST /api/imports/upload  (admin) — upload a .dgn/.shp/.zip/.geojson and queue conversion
importsRouter.post('/upload', adminRequired, upload.single('file'), async (req: AuthedRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file field is required' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const format = FORMATS[ext];
    if (!format) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `Unsupported format ${ext}. Use .dgn, .shp, .zip or .geojson` });
    }
    const layerName = (req.body?.name as string) || path.parse(req.file.originalname).name;
    const layerType = (req.body?.layerType as string) || 'custom';
    const [job] = await query(`
      INSERT INTO import_jobs (original_filename, file_path, source_format, layer_name, layer_type, created_by, status)
      VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
      [req.file.originalname, req.file.path, format, layerName, layerType, req.user!.id]);
    res.status(202).json({ message: 'Upload queued for processing', job });
  } catch (e) { next(e); }
});

// GET /api/imports  (admin) — processing log / status
importsRouter.get('/', adminRequired, async (_req, res, next) => {
  try {
    const jobs = await query(`
      SELECT id, layer_id AS "layerId", original_filename AS "originalFilename",
             source_format AS "sourceFormat", layer_name AS "layerName", layer_type AS "layerType",
             status, log, feature_count AS "featureCount",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM import_jobs ORDER BY created_at DESC LIMIT 100`);
    res.json({ jobs });
  } catch (e) { next(e); }
});

// DELETE /api/imports/:id  (admin) — remove a job AND its imported layer (+ features via cascade)
importsRouter.delete('/:id', adminRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [job] = await query('SELECT layer_id FROM import_jobs WHERE id=$1', [id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.layer_id) await query('DELETE FROM gis_layers WHERE id=$1', [job.layer_id]);
    await query('DELETE FROM import_jobs WHERE id=$1', [id]);
    res.json({ deleted: id });
  } catch (e) { next(e); }
});

export { importsRouter as default };
