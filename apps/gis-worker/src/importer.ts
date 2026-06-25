import fs from 'node:fs';
import { query, pool } from './db.ts';

interface LayerMeta {
  name: string; slug: string; layerType: string;
  sourceFormat: string; sourceFile: string; style?: Record<string, unknown>;
}

/** Read a 4326 GeoJSON file and load its features into PostGIS under a new layer. */
export async function importGeoJSON(geojsonPath: string, meta: LayerMeta): Promise<{ layerId: number; count: number }> {
  const fc = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
  const features: any[] = fc.type === 'FeatureCollection' ? fc.features : [fc];
  const geomTypes = new Set(features.map((f) => f.geometry?.type).filter(Boolean));
  const geometryType = geomTypes.size === 1 ? [...geomTypes][0] : 'Mixed';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // upsert the layer by slug (re-import replaces previous features)
    const { rows: [layer] } = await client.query(
      `INSERT INTO gis_layers (name, slug, layer_type, geometry_type, source_format, source_file, style, status, feature_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'processing',0)
       ON CONFLICT (slug) DO UPDATE SET
         name=EXCLUDED.name, layer_type=EXCLUDED.layer_type, geometry_type=EXCLUDED.geometry_type,
         source_format=EXCLUDED.source_format, source_file=EXCLUDED.source_file,
         style=EXCLUDED.style, status='processing'
       RETURNING id`,
      [meta.name, meta.slug, meta.layerType, geometryType, meta.sourceFormat, meta.sourceFile,
       JSON.stringify(meta.style ?? {})]);
    const layerId = layer.id;

    await client.query('DELETE FROM gis_features WHERE layer_id=$1', [layerId]);

    let count = 0;
    for (const f of features) {
      if (!f.geometry) continue;
      await client.query(
        `INSERT INTO gis_features (layer_id, properties, geom)
         VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))`,
        [layerId, JSON.stringify(f.properties ?? {}), JSON.stringify(f.geometry)]);
      count++;
    }
    await client.query(`UPDATE gis_layers SET feature_count=$2, status='ready' WHERE id=$1`, [layerId, count]);
    await client.query('COMMIT');
    return { layerId, count };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export function slugify(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `layer-${Date.now()}`;
}
