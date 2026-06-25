import fs from 'node:fs';
import path from 'node:path';
import { pool, query } from './db.ts';

const DB_INIT_DIR = process.env.DB_INIT_DIR ?? path.resolve(process.cwd(), 'db-init');
const SEED_DIR = process.env.SEED_DIR ?? path.resolve(process.cwd(), 'seed-data');

async function runSqlFile(file: string): Promise<boolean> {
  const p = path.join(DB_INIT_DIR, file);
  if (!fs.existsSync(p)) { console.log(`[bootstrap] skip ${file} (not found at ${p})`); return false; }
  await pool.query(fs.readFileSync(p, 'utf-8'));
  console.log(`[bootstrap] ran ${file}`);
  return true;
}

/** Load the bundled Cam Lâm demo GIS layers from GeoJSON (no GDAL needed). */
async function seedLayers(): Promise<void> {
  const manifestPath = path.join(SEED_DIR, 'seed-manifest.json');
  if (!fs.existsSync(manifestPath)) { console.log('[bootstrap] no seed manifest, skipping layers'); return; }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as any[];
  for (const e of manifest) {
    const exists = await query('SELECT id FROM gis_layers WHERE slug=$1', [e.slug]);
    if (exists.length) { console.log(`[bootstrap] layer ${e.slug} already present`); continue; }
    const file = path.join(SEED_DIR, e.file);
    if (!fs.existsSync(file)) { console.warn(`[bootstrap] missing ${e.file}`); continue; }
    const fc = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const features: any[] = fc.type === 'FeatureCollection' ? fc.features : [fc];
    const types = new Set(features.map((f) => f.geometry?.type).filter(Boolean));
    const geometryType = types.size === 1 ? [...types][0] : 'Mixed';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [layer] } = await client.query(
        `INSERT INTO gis_layers (name, slug, layer_type, geometry_type, source_format, source_file, style, status, feature_count)
         VALUES ($1,$2,$3,$4,'geojson',$5,$6,'processing',0)
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [e.name, e.slug, e.layer_type, geometryType, e.file, JSON.stringify(e.style ?? {})]);
      const layerId = layer.id;
      await client.query('DELETE FROM gis_features WHERE layer_id=$1', [layerId]);
      let count = 0;
      for (const f of features) {
        if (!f.geometry) continue;
        await client.query(
          `INSERT INTO gis_features (layer_id, properties, geom)
           VALUES ($1,$2, ST_SetSRID(ST_GeomFromGeoJSON($3),4326))`,
          [layerId, JSON.stringify(f.properties ?? {}), JSON.stringify(f.geometry)]);
        count++;
      }
      await client.query(`UPDATE gis_layers SET feature_count=$2, status='ready' WHERE id=$1`, [layerId, count]);
      await client.query('COMMIT');
      console.log(`[bootstrap] seeded layer ${e.slug}: ${count} features`);
    } catch (err) { await client.query('ROLLBACK'); console.error(`[bootstrap] layer ${e.slug} failed:`, err); }
    finally { client.release(); }
  }
}

/** One-time, idempotent DB init for managed Postgres (Render) where there is no init-script hook. */
export async function bootstrap(): Promise<void> {
  console.log('[bootstrap] initializing database…');
  await runSqlFile('01_extensions.sql');
  await runSqlFile('02_schema.sql');
  const [{ count }] = await query<{ count: number }>('SELECT count(*)::int AS count FROM listings');
  if (Number(count) === 0) {
    if (await runSqlFile('03_seed.sql')) console.log('[bootstrap] seeded demo listings');
  } else {
    console.log(`[bootstrap] listings already present (${count})`);
  }
  await seedLayers();
  console.log('[bootstrap] done');
}
