import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';

export const layersRouter = Router();

const LAYER_SELECT = `
  SELECT id, name, slug, layer_type AS "layerType", geometry_type AS "geometryType",
         source_format AS "sourceFormat", feature_count AS "featureCount",
         status, visible, style, created_at AS "createdAt"
  FROM gis_layers`;

// GET /api/layers — list every available map layer
layersRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ layers: await query(`${LAYER_SELECT} ORDER BY layer_type, name`) });
  } catch (e) { next(e); }
});

// GET /api/layers/:slug/features?bbox=w,s,e,n — features as a GeoJSON FeatureCollection
layersRouter.get('/:slug/features', async (req, res, next) => {
  try {
    const [layer] = await query('SELECT id FROM gis_layers WHERE slug=$1', [req.params.slug]);
    if (!layer) return res.status(404).json({ error: 'Layer not found' });

    const params: any[] = [layer.id];
    let bboxClause = '';
    if (req.query.bbox) {
      const [w, s, e, n] = String(req.query.bbox).split(',').map(Number);
      params.push(w, s, e, n);
      bboxClause = ` AND geom && ST_MakeEnvelope($2,$3,$4,$5,4326)`;
    }
    const rows = await query(`
      SELECT json_build_object(
        'type','Feature','id',id,
        'geometry', ST_AsGeoJSON(geom)::json,
        'properties', properties
      ) AS feature
      FROM gis_features WHERE layer_id=$1${bboxClause}`, params);
    res.json({ type: 'FeatureCollection', features: rows.map((r: any) => r.feature) });
  } catch (e) { next(e); }
});

// DELETE /api/layers/:slug  (admin) — remove a layer and all its features (ON DELETE CASCADE)
layersRouter.delete('/:slug', adminRequired, async (req, res, next) => {
  try {
    const rows = await query('DELETE FROM gis_layers WHERE slug=$1 RETURNING id, name', [req.params.slug]);
    if (!rows.length) return res.status(404).json({ error: 'Layer not found' });
    res.json({ deleted: rows[0].name });
  } catch (e) { next(e); }
});

export { LAYER_SELECT };
