import fs from 'node:fs';
import path from 'node:path';
import { query } from './db.ts';
import { importGeoJSON } from './importer.ts';

const DEMO_DIR = process.env.DEMO_DIR ?? '/data/cam-lam';

/** On first boot, load the bundled Cam Lâm demo layers (idempotent by slug). */
export async function seedDemoData(): Promise<void> {
  const manifestPath = path.join(DEMO_DIR, 'seed-manifest.json');
  if (!fs.existsSync(manifestPath)) { console.log('[worker][seed] no manifest, skipping'); return; }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as any[];

  for (const entry of manifest) {
    const existing = await query('SELECT id FROM gis_layers WHERE slug=$1', [entry.slug]);
    if (existing.length) { console.log(`[worker][seed] ${entry.slug} already present`); continue; }
    const file = path.join(DEMO_DIR, entry.file);
    if (!fs.existsSync(file)) { console.warn(`[worker][seed] missing ${file}`); continue; }
    const { count } = await importGeoJSON(file, {
      name: entry.name, slug: entry.slug, layerType: entry.layer_type,
      sourceFormat: 'geojson', sourceFile: entry.file, style: entry.style ?? {},
    });
    console.log(`[worker][seed] imported ${entry.slug}: ${count} features`);
  }
}
