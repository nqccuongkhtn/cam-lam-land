import { query } from './db.ts';
import { hashPassword } from './auth.ts';
import { env } from './env.ts';

/** Idempotently create the seed admin account from env vars. */
export async function ensureAdmin(): Promise<void> {
  const existing = await query('SELECT id FROM users WHERE email = $1', [env.adminEmail]);
  if (existing.length) return;
  const hash = await hashPassword(env.adminPassword);
  await query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')`,
    [env.adminEmail, hash],
  );
  console.log(`[auth] seed admin created: ${env.adminEmail}`);
}
