import { query } from './db.ts';
import { hashPassword, verifyPassword, MAT_KHAU_CONG_KHAI } from './auth.ts';
import { env } from './env.ts';

// Tài khoản MẪU cài sẵn từ bản đầu — mật khẩu ghi thẳng ở đây nên ai đọc mã nguồn cũng biết.
const TAI_KHOAN_MAU: { email: string; mk: string; role: string; ten: string; sdt: string }[] = [
  { email: 'khach@camlam.vn', mk: 'khach12345', role: 'user', ten: 'Nguyễn Văn Khách', sdt: '0900000001' },
  { email: 'dat@camlam.vn', mk: 'dat12345', role: 'gis', ten: 'Nguyễn Tiến Đạt', sdt: '0900000002' },
];

/**
 * 11/10/2026 (rà soát bảo mật): mỗi lần khởi động, soát xem tài khoản nào tạo tự động lúc cài đặt VẪN dùng
 * mật khẩu mặc định công khai → in CẢNH BÁO thật to ra log. (Đăng nhập bằng các mật khẩu đó từ Internet đã bị
 * chặn ở routes/auth.ts; việc còn lại là chủ web ĐỔI mật khẩu — chạy TAO-TAI-KHOAN.bat, nhập đúng email cũ +
 * mật khẩu mới là xong.) Chỉ ĐỌC, không sửa gì trong database.
 */
async function soatMatKhauMacDinh(): Promise<void> {
  const ds = [{ email: env.adminEmail, mk: env.adminPassword }, ...TAI_KHOAN_MAU];
  for (const t of ds) {
    if (!MAT_KHAU_CONG_KHAI.has(t.mk)) continue;
    const [u] = await query('SELECT id, password_hash, status FROM users WHERE email=$1', [t.email]).catch(() => [] as any[]);
    if (!u || u.status === 'suspended' || !u.password_hash) continue;
    if (await verifyPassword(t.mk, u.password_hash).catch(() => false))
      console.warn(`[BẢO MẬT] *** Tài khoản ${t.email} (#${u.id}) VẪN DÙNG MẬT KHẨU MẶC ĐỊNH CÔNG KHAI — hãy đổi ngay (TAO-TAI-KHOAN.bat). Đăng nhập bằng mật khẩu này từ Internet đang bị chặn.`);
  }
  if (MAT_KHAU_CONG_KHAI.has(env.adminPassword))
    console.warn('[BẢO MẬT] *** ADMIN_PASSWORD trong .env đang là mật khẩu mặc định công khai — hãy đổi sang mật khẩu riêng.');
}

async function ensureUser(email: string, password: string, role: string, fullName: string, phone: string, tier = 'free') {
  const ex = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (ex.length) return;
  const hash = await hashPassword(password);
  await query(
    `INSERT INTO users (email, password_hash, role, roles, full_name, phone, email_verified, status, tier)
     VALUES ($1,$2,$3,ARRAY[$3]::text[],$4,$5,true,'active',$6)`, [email, hash, role, fullName, phone, tier]);
  console.log(`[auth] seed ${role}: ${email}`);
}

/** Tạo sẵn tài khoản admin + 1 tài khoản demo cho người dùng test. */
export async function ensureAdmin(): Promise<void> {
  await ensureUser(env.adminEmail, env.adminPassword, 'admin', 'Quản trị viên', '0567442996', 'paid');
  // Tài khoản MẪU (mật khẩu công khai trong mã nguồn — một cái còn mang vai trò quản lý bản đồ 'gis'):
  // KHÔNG tự tạo nữa trên máy cài mới, trừ khi bật SEED_TAI_KHOAN_MAU=true trong .env (chỉ dùng để thử nghiệm).
  // Tài khoản đã có từ trước thì giữ nguyên, không xoá.
  if (process.env.SEED_TAI_KHOAN_MAU === 'true')
    for (const t of TAI_KHOAN_MAU) await ensureUser(t.email, t.mk, t.role, t.ten, t.sdt);
  soatMatKhauMacDinh().catch(() => {});   // chạy nền — không bắt máy chủ chờ lúc khởi động

  // Quảng cáo bản đồ mẫu (để hiển thị ngay trên bản đồ)
  const ad = await query('SELECT id FROM map_ads LIMIT 1');
  if (!ad.length) {
    await query(
      `INSERT INTO map_ads (advertiser_name, advertiser_phone, image_url, wards, points, package, expires_at, status)
       VALUES ($1,$2,$3,$4::text[],$5::jsonb,$6, now() + interval '6 months', 'active')`,
      ['Nguyễn Quốc Cường', '0567442996', null,
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