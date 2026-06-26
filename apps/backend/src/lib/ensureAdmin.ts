import { query } from './db.ts';
import { hashPassword } from './auth.ts';
import { env } from './env.ts';

async function ensureUser(email: string, password: string, role: string, fullName: string, phone: string, tier = 'free') {
  const ex = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (ex.length) return;
  const hash = await hashPassword(password);
  await query(
    `INSERT INTO users (email, password_hash, role, full_name, phone, email_verified, status, tier)
     VALUES ($1,$2,$3,$4,$5,true,'active',$6)`, [email, hash, role, fullName, phone, tier]);
  console.log(`[auth] seed ${role}: ${email}`);
}

/** Tạo sẵn tài khoản admin + 1 tài khoản demo cho người dùng test. */
export async function ensureAdmin(): Promise<void> {
  await ensureUser(env.adminEmail, env.adminPassword, 'admin', 'Quản trị viên', '0988888888', 'paid');
  await ensureUser('khach@camlam.vn', 'khach12345', 'user', 'Nguyễn Văn Khách', '0900000001');
}
