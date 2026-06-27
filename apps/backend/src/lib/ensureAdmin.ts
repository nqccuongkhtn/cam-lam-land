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
  await ensureUser('dat@camlam.vn', 'dat12345', 'gis', 'Nguyễn Tiến Đạt', '0900000002');

  // Quảng cáo bản đồ mẫu (để hiển thị ngay trên bản đồ)
  const ad = await query('SELECT id FROM map_ads LIMIT 1');
  if (!ad.length) {
    await query(
      `INSERT INTO map_ads (advertiser_name, advertiser_phone, image_url, wards, points, package, expires_at, status)
       VALUES ($1,$2,$3,$4::text[],$5::jsonb,$6, now() + interval '6 months', 'active')`,
      ['Nguyễn Quốc Cường', '0988888888', null,
       ['Cam Đức', 'Cam Hải Đông', 'Cam Hải Tây'],
       JSON.stringify([{ lng: 109.152, lat: 12.072 }, { lng: 109.205, lat: 12.090 }, { lng: 109.108, lat: 12.045 }]),
       'Mẫu 6 tháng']);
    console.log('[seed] map_ads mẫu');
  }

  // Xoá tin nhắn nhóm cộng đồng cũ (chạy đúng 1 lần)
  const flag = await query("SELECT 1 FROM app_flags WHERE key='community_reset_v1'");
  if (!flag.length) {
    await query("DELETE FROM chat_messages WHERE room='community'");
    await query("INSERT INTO app_flags (key) VALUES ('community_reset_v1') ON CONFLICT DO NOTHING");
    console.log('[chat] đã xoá tin nhắn cộng đồng cũ (một lần)');
  }
}