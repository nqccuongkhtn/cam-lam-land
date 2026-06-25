import pg from 'pg';
import { env } from './env.ts';

// Keep NUMERIC columns (price/area) as JS numbers instead of strings.
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

export const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, max: 10 }   // Render managed Postgres
    : { ...env.pg, max: 10 },                                   // local docker-compose
);

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

/** Wait for PostGIS to accept connections (containers start in parallel). */
export async function waitForDb(retries = 30, delayMs = 2000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[db] connected to PostGIS');
      return;
    } catch (err) {
      console.log(`[db] not ready (attempt ${i}/${retries})…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('[db] could not connect to PostGIS');
}
