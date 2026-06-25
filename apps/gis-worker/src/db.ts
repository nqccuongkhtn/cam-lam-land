import pg from 'pg';
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
export const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER ?? 'camlam',
  password: process.env.POSTGRES_PASSWORD ?? 'camlam_secret_change_me',
  database: process.env.POSTGRES_DB ?? 'camlam_gis',
  max: 5,
});
export const query = async <T = any>(t: string, p: any[] = []): Promise<T[]> => (await pool.query(t, p)).rows as T[];
export async function waitForDb(retries = 30, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try { await pool.query('SELECT 1'); console.log('[worker][db] connected'); return; }
    catch { console.log(`[worker][db] waiting (${i}/${retries})`); await new Promise(r => setTimeout(r, delayMs)); }
  }
  throw new Error('[worker][db] could not connect');
}
