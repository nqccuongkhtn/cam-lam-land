import pg from 'pg';
import { env } from './env.ts';

// Keep NUMERIC columns (price/area) as JS numbers instead of strings.
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

const poolBase = {
  max: Number(process.env.PG_POOL_MAX ?? 12),
  idleTimeoutMillis: 30000,
  statement_timeout: 20000,        // chặn truy vấn treo
  keepAlive: true,
};
export const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ...poolBase }   // Render managed Postgres
    : { ...env.pg, ...poolBase },                                   // local docker-compose
);

// QUAN TRỌNG: Postgres (nhất là gói free Render) hay ngắt kết nối rảnh. Nếu KHÔNG bắt lỗi
// này thì client rảnh phát 'error' → thành uncaughtException → RỚT cả server. Bắt để pool tự
// bỏ kết nối hỏng và chạy tiếp (không sập).
pool.on('error', (err: any) => console.error('[pg pool error] kết nối rảnh lỗi, pool tự phục hồi:', err?.message || err));

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
