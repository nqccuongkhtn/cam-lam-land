import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import shp from 'shpjs';
import { query, pool } from '../lib/db.ts';
import { env } from '../lib/env.ts';
import { vn2000ToWgs84 } from '../lib/vn2000.ts';
import { gisRequired, type AuthedRequest } from '../middleware/auth.ts';

export const importsRouter = Router();
fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^\w.\-]/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

const FORMATS: Record<string, string> = { '.geojson': 'geojson', '.json': 'geojson', '.zip': 'shp', '.shp': 'shp', '.dgn': 'dgn' };

function firstCoord(c: any): number[] | null {
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) && typeof c[0] === 'number' ? c : null;
}
function reprojCoords(c: any): any {
  if (typeof c[0] === 'number') { const w = vn2000ToWgs84(c[0], c[1]); return [w.lng, w.lat]; }
  return c.map(reprojCoords);
}
function slugify(s: string): string {
  return (s || 'layer').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'layer';
}

// Nạp danh sách feature vào DB (tự quy đổi VN-2000 mét -> WGS84 nếu phát hiện toạ độ mét)
async function ingestFeatures(features: any[], name: string, layerType: string, sourceFormat: string) {
  features = (features || []).filter((f) => f && f.geometry && f.geometry.coordinates);
  if (!features.length) throw new Error('Không tìm thấy đối tượng có hình học.');
  let sample: number[] | null = null;
  for (const f of features) { sample = firstCoord(f.geometry.coordinates); if (sample) break; }
  const reprojected = !!sample && (Math.abs(sample[0]) > 200 || Math.abs(sample[1]) > 200);
  const types = new Set(features.map((f) => f.geometry?.type).filter(Boolean));
  const geometryType = types.size === 1 ? [...types][0] : 'Mixed';
  const slug = `${slugify(name)}-${Date.now().toString(36)}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [layer] } = await client.query(
      `INSERT INTO gis_layers (name, slug, layer_type, geometry_type, source_format, source_file, style, status, feature_count)
       VALUES ($1,$2,$3,$4,$5,$6,'{}','processing',0) RETURNING id`,
      [name, slug, layerType, geometryType, sourceFormat, slug]);
    const layerId = layer.id; let count = 0;
    for (const f of features) {
      const g = f.geometry;
      if (reprojected) g.coordinates = reprojCoords(g.coordinates);
      await client.query(
        `INSERT INTO gis_features (layer_id, properties, geom)
         VALUES ($1,$2, ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($3),4326)))`,
        [layerId, JSON.stringify(f.properties ?? {}), JSON.stringify(g)]);
      count++;
    }
    await client.query(`UPDATE gis_layers SET feature_count=$2, status='ready' WHERE id=$1`, [layerId, count]);
    await client.query('COMMIT');
    return { layerId, count, reprojected };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
function readGeoJsonFeatures(filePath: string): any[] {
  const fc = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return fc?.type === 'FeatureCollection' ? (fc.features || []) : (fc?.type === 'Feature' ? [fc] : []);
}

// POST /api/imports/upload (gis) — nạp .geojson hoặc Shapefile nén .zip
importsRouter.post('/upload', gisRequired, upload.single('file'), async (req: AuthedRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu file' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const format = FORMATS[ext];
    if (!format) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: `Định dạng ${ext} chưa hỗ trợ. Dùng .geojson hoặc Shapefile nén .zip` }); }
    const layerName = (req.body?.name as string) || path.parse(req.file.originalname).name;
    const layerType = (req.body?.layerType as string) || 'custom';
    const [job] = await query(`
      INSERT INTO import_jobs (original_filename, file_path, source_format, layer_name, layer_type, created_by, status)
      VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
      [req.file.originalname, req.file.path, format, layerName, layerType, req.user!.id]);

    if (format === 'geojson' || format === 'shp') {
      try {
        let features: any[];
        if (format === 'geojson') features = readGeoJsonFeatures(req.file.path);
        else {
          const gj: any = await shp(fs.readFileSync(req.file.path));
          const fcs = Array.isArray(gj) ? gj : [gj];
          features = fcs.flatMap((x: any) => x?.features || []);
        }
        const r = await ingestFeatures(features, layerName, layerType, format);
        await query(`UPDATE import_jobs SET layer_id=$2, status='done', feature_count=$3, log=$4, updated_at=now() WHERE id=$1`,
          [job.id, r.layerId, r.count, `Đã nạp ${r.count} đối tượng${r.reprojected ? ' (tự quy đổi VN-2000→WGS84)' : ''}`]);
        try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(201).json({ message: `Đã nạp ${r.count} đối tượng.`, layerId: r.layerId, featureCount: r.count, reprojected: r.reprojected });
      } catch (e: any) {
        const msg = String(e?.message || e).slice(0, 400);
        await query(`UPDATE import_jobs SET status='error', log=$2, updated_at=now() WHERE id=$1`, [job.id, msg]);
        return res.status(400).json({ error: 'Lỗi nạp dữ liệu: ' + msg });
      }
    }
    await query(`UPDATE import_jobs SET status='error', log=$2, updated_at=now() WHERE id=$1`,
      [job.id, 'DGN chưa hỗ trợ trực tiếp — hãy xuất sang Shapefile (.zip) hoặc GeoJSON.']);
    return res.status(400).json({ error: 'DGN chưa hỗ trợ trực tiếp. Hãy xuất sang Shapefile (nén .zip) hoặc GeoJSON rồi tải lại.' });
  } catch (e) { next(e); }
});

// GET /api/imports (gis)
importsRouter.get('/', gisRequired, async (_req, res, next) => {
  try {
    const jobs = await query(`
      SELECT id, layer_id AS "layerId", original_filename AS "originalFilename",
             source_format AS "sourceFormat", layer_name AS "layerName", layer_type AS "layerType",
             status, log, feature_count AS "featureCount", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM import_jobs ORDER BY created_at DESC LIMIT 100`);
    res.json({ jobs });
  } catch (e) { next(e); }
});

// DELETE /api/imports/:id (gis)
importsRouter.delete('/:id', gisRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [job] = await query('SELECT layer_id FROM import_jobs WHERE id=$1', [id]);
    if (!job) return res.status(404).json({ error: 'Không tìm thấy job' });
    if (job.layer_id) await query('DELETE FROM gis_layers WHERE id=$1', [job.layer_id]);
    await query('DELETE FROM import_jobs WHERE id=$1', [id]);
    res.json({ deleted: id });
  } catch (e) { next(e); }
});

export { importsRouter as default };
