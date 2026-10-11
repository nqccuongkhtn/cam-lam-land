import pg from 'pg';
import { env } from './env.ts';

// Keep NUMERIC columns (price/area) as JS numbers instead of strings.
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

const poolBase = {
  max: Number(process.env.PG_POOL_MAX ?? 12),
  idleTimeoutMillis: 30000,
  statement_timeout: 20000,        // chặn truy vấn treo
  // ── BA CHỐT AN TOÀN THÊM (11/10/2026 — rà soát) ──
  // 1) Mọi kết nối đều bận (vd nhiều người cùng bấm thửa lớn) thì yêu cầu mới CHỜ tối đa 15 giây rồi báo lỗi, thay vì
  //    chờ VÔ HẠN — trước đây database trục trặc là mọi yêu cầu treo cứng tới khi nginx cắt (5 phút), web đứng hình.
  connectionTimeoutMillis: Number(process.env.PG_CHO_KET_NOI_MS ?? 15000),
  // 2) Kết nối nào mở giao dịch (BEGIN) rồi bỏ quên quá 60 giây thì Postgres tự đóng — không để nó giữ khoá bảng mãi.
  idle_in_transaction_session_timeout: 60000,
  // 3) Ghi tên để nhìn bảng pg_stat_activity là biết kết nối nào của máy chủ web.
  application_name: 'camlam-backend',
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
