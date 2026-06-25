import path from 'node:path';
import { query, waitForDb } from './db.ts';
import { convertToGeoJSON, gdalVersion } from './convert.ts';
import { importGeoJSON, slugify } from './importer.ts';
import { seedDemoData } from './seed.ts';

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 4000);

async function processJob(job: any): Promise<void> {
  const stamp = () => new Date().toISOString();
  const append = (line: string) =>
    query(`UPDATE import_jobs SET log = COALESCE(log,'') || $2, updated_at=now() WHERE id=$1`,
          [job.id, `[${stamp()}] ${line}\n`]);

  await query(`UPDATE import_jobs SET status='processing', updated_at=now() WHERE id=$1`, [job.id]);
  await append(`processing ${job.original_filename} (${job.source_format})`);

  try {
    const { geojsonPath, log } = await convertToGeoJSON(job.file_path, job.source_format);
    await append(log.trim());

    const slug = slugify(job.layer_name);
    const { layerId, count } = await importGeoJSON(geojsonPath, {
      name: job.layer_name, slug, layerType: job.layer_type || 'custom',
      sourceFormat: job.source_format, sourceFile: path.basename(job.file_path), style: {},
    });

    await query(
      `UPDATE import_jobs SET status='done', layer_id=$2, feature_count=$3, updated_at=now() WHERE id=$1`,
      [job.id, layerId, count]);
    await append(`imported ${count} features into layer "${slug}" (id ${layerId})`);
    console.log(`[worker] job ${job.id} done: ${count} features → ${slug}`);
  } catch (err: any) {
    await query(`UPDATE import_jobs SET status='error', updated_at=now() WHERE id=$1`, [job.id]);
    await append(`ERROR: ${err.message}`);
    console.error(`[worker] job ${job.id} failed:`, err.message);
  }
}

async function poll(): Promise<void> {
  const [job] = await query(
    `SELECT * FROM import_jobs WHERE status='pending' ORDER BY created_at ASC LIMIT 1`);
  if (job) await processJob(job);
}

async function main() {
  console.log('[worker] GDAL:', await gdalVersion());
  await waitForDb();
  if ((process.env.SEED_DEMO_DATA ?? 'true') === 'true') {
    try { await seedDemoData(); } catch (e: any) { console.error('[worker][seed] failed:', e.message); }
  }
  console.log(`[worker] polling import queue every ${POLL_MS}ms`);
  // simple, robust loop (no external broker needed)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try { await poll(); } catch (e: any) { console.error('[worker] poll error:', e.message); }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
