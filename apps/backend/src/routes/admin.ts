import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired, type AuthedRequest } from '../middleware/auth.ts';
import { hashPassword } from '../lib/auth.ts';

export const adminRouter = Router();
adminRouter.use(adminRequired);

// ─── Dữ liệu mẫu để TEST (bấm 1 nút tạo ~50 tin + tin nhắn; bấm nút khác xoá sạch) ───
const DEMO_WARDS = ['Cam Đức','Cam Hải Đông','Cam Hải Tây','Cam Thành Bắc','Cam Hòa','Cam Tân','Cam Hiệp Bắc','Cam Hiệp Nam','Cam An Bắc','Cam An Nam','Cam Phước Tây','Sơn Tân','Suối Cát','Suối Tân'];
const DEMO_DIRS = ['Đông','Tây','Nam','Bắc','Đông Bắc','Đông Nam','Tây Bắc','Tây Nam'];
const DEMO_LEGAL = ['Sổ đỏ / Sổ hồng','Sổ hồng riêng','Sổ chung','Hợp đồng mua bán','Đang chờ sổ'];
const DEMO_AGENTS = [
  { email: 'demo-agent-1@camlam.local', name: 'Nguyễn Văn Ánh', phone: '0905123456' },
  { email: 'demo-agent-2@camlam.local', name: 'Trần Thị Bích', phone: '0912987654' },
  { email: 'demo-agent-3@camlam.local', name: 'Lê Hoàng Cường', phone: '0938111222' },
];
const DEMO_PHONES = ['0905123456', '0912987654', '0938111222'];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

async function demoAgentIds(): Promise<number[]> {
  const ids: number[] = [];
  for (const a of DEMO_AGENTS) {
    const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(a.email)}`;
    let [u] = await query(`SELECT id FROM users WHERE email=$1`, [a.email]);
    if (!u) {
      [u] = await query(
        `INSERT INTO users (email,password_hash,role,full_name,phone,email_verified,avatar)
         VALUES ($1,$2,'user',$3,$4,true,$5) RETURNING id`,
        [a.email, await hashPassword('demo-' + Math.random().toString(36).slice(2)), a.name, a.phone, avatar]);
    } else {
      await query(`UPDATE users SET full_name=$2, phone=$3, avatar=$4 WHERE id=$1`, [u.id, a.name, a.phone, avatar]);
    }
    ids.push(u.id);
  }
  return ids;
}
async function clearDemoContent(): Promise<number[]> {
  const rows = await query(`SELECT id FROM users WHERE email LIKE 'demo-agent-%@camlam.local'`);
  const ids = rows.map((r: any) => r.id);
  if (ids.length) {
    await query(`DELETE FROM listings WHERE created_by = ANY($1::int[])`, [ids]);
    await query(`DELETE FROM chat_messages WHERE user_id = ANY($1::int[]) OR room = ANY($2::text[])`, [ids, ids.map((id: number) => 'advisory:' + id)]);
  }
  return ids;
}

// POST /api/admin/seed-demo — tạo ~50 tin mẫu đủ loại + tin nhắn mẫu (dọn mẫu cũ trước, không nhân đôi).
adminRouter.post('/seed-demo', async (req: AuthedRequest, res, next) => {
  try {
    const n = Math.min(Math.max(Number(req.body?.count) || 50, 1), 120);
    const ids = await demoAgentIds();
    await clearDemoContent();
    const saleTypes = ['land','house','apartment','villa','commercial','farm'];
    const rentTypes = ['house','apartment','room','commercial','office','warehouse'];
    const tiers = ['normal','normal','normal','normal','normal','silver','silver','gold','diamond'];
    const typeVN: Record<string, string> = { land:'đất nền', house:'nhà phố', apartment:'căn hộ', villa:'biệt thự', commercial:'mặt bằng', farm:'đất vườn', room:'phòng trọ', office:'văn phòng', warehouse:'kho xưởng' };
    const [W, S, E, N] = [108.98, 11.90, 109.20, 12.19];
    let created = 0;
    for (let i = 0; i < n; i++) {
      const deal = Math.random() < 0.32 ? 'rent' : 'sale';
      const pt = deal === 'rent' ? pick(rentTypes) : pick(saleTypes);
      const ward = pick(DEMO_WARDS);
      const tier = pick(tiers);
      const area = roundTo(rnd(pt === 'room' ? 18 : 60, (pt === 'land' || pt === 'farm') ? 500 : 220), 1);
      const price = deal === 'rent'
        ? roundTo(rnd(2e6, (pt === 'warehouse' || pt === 'commercial') ? 55e6 : 18e6), 5e5)
        : roundTo(rnd(8e8, pt === 'villa' ? 30e9 : 12e9), 5e7);
      const beds = ['house','apartment','villa','room'].includes(pt) ? Math.floor(rnd(1, 5)) : null;
      const baths = beds ? Math.max(1, Math.floor(rnd(1, beds + 1))) : null;
      const lng = rnd(W, E), lat = rnd(S, N);
      const priceTxt = deal === 'rent'
        ? `${(price / 1e6).toFixed(0)} triệu/tháng`
        : (price >= 1e9 ? `${(price / 1e9).toFixed(price % 1e9 ? 1 : 0)} tỷ` : `${(price / 1e6).toFixed(0)} triệu`);
      const title = `${deal === 'rent' ? 'Cho thuê' : 'Bán'} ${typeVN[pt]} ${ward} ${area}m² - ${priceTxt}${tier !== 'normal' ? ' (VIP)' : ''}`;
      const desc = `${deal === 'rent' ? 'Cho thuê' : 'Cần bán'} ${typeVN[pt]} tại ${ward}, Cam Lâm, Khánh Hòa. Diện tích ${area}m²${beds ? `, ${beds} phòng ngủ` : ''}. Vị trí thuận tiện, pháp lý rõ ràng. (Tin mẫu để kiểm thử)`;
      const nImg = 2 + Math.floor(Math.random() * 3);
      const images = Array.from({ length: nImg }, (_, k) => `https://picsum.photos/seed/demo${i}-${k}/800/600`);
      const status = i % 17 === 0 ? 'hidden' : (i % 23 === 0 ? 'sold' : 'active');
      const isVip = tier !== 'normal';
      // Tin thường >7 ngày bị ẩn khỏi danh sách: cho phần lớn "mới" (hiện được), ~1/5 cũ (để test mục tin hết hạn).
      const ageDays = isVip ? Math.floor(rnd(0, 90)) : (i % 5 === 0 ? Math.floor(rnd(10, 120)) : Math.floor(rnd(0, 6)));
      const views = Math.floor(rnd(0, Math.min(600, ageDays * 8 + 25)));
      const createdBy = ids[i % ids.length];
      await query(
        `INSERT INTO listings
           (title,description,price,area,property_type,address,ward,bedrooms,bathrooms,direction,legal,frontage,
            contact_name,contact_phone,images,status,created_by,deal,views,tier,boosted,geom,created_at,bumped_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
            $13,$14,$15,$16,$17,$18,$19,$20,$21, ST_SetSRID(ST_MakePoint($22,$23),4326), now() - ($24||' days')::interval,
            CASE WHEN $20 <> 'normal' THEN now() - (random()*2||' days')::interval ELSE NULL END)`,
        [title, desc, price, area, pt, `Thôn ${Math.ceil(rnd(1, 9))}, ${ward}`, ward, beds, baths, pick(DEMO_DIRS), pick(DEMO_LEGAL), roundTo(rnd(3, 12), 0.5),
         pick(DEMO_AGENTS).name, pick(DEMO_PHONES), images, status, createdBy, deal, views, tier, tier !== 'normal', lng, lat, String(ageDays)]);
      created++;
    }
    // Tin nhắn cộng đồng mẫu
    const community = [
      'Chào cả nhà, khu Bãi Dài dạo này giao dịch sôi động phết 👍',
      'Có anh chị nào cần đất Cam Đức gần chợ không ạ, em có vài lô đẹp.',
      'Giá đất Cam Hải Đông giờ tầm bao nhiêu 1m² vậy mọi người?',
      'Mình mới xem lô ven biển view đẹp mà pháp lý sạch, ưng quá.',
      'Cho thuê nhà nguyên căn Cam Đức 3PN giá 8 triệu, ai cần inbox em nhé.',
      'Sân bay Cam Lâm mà triển khai thì khu này còn lên nữa các bác ạ.',
    ];
    for (let k = 0; k < community.length; k++) {
      await query(
        `INSERT INTO chat_messages (room, user_id, name, body, created_at) VALUES ('community',$1,$2,$3, now() - ($4||' hours')::interval)`,
        [ids[k % ids.length], DEMO_AGENTS[k % DEMO_AGENTS.length].name, community[k], String(community.length - k)]);
    }
    // Hội thoại Tư vấn mẫu (để admin thấy trong hộp thư Tư vấn đầu tư & pháp lý)
    const a1 = ids[0];
    await query(`INSERT INTO chat_messages (room, user_id, name, body, created_at) VALUES ($1,$2,$3,$4, now() - interval '2 hours')`,
      ['advisory:' + a1, a1, DEMO_AGENTS[0].name, 'Em muốn hỏi thủ tục tách thửa đất ở Cam Hải Đông cần điều kiện gì ạ?']);
    await query(`INSERT INTO chat_messages (room, user_id, name, body, created_at) VALUES ($1,$2,$3,$4, now() - interval '1 hours')`,
      ['advisory:' + a1, req.user!.id, 'Chuyên viên tư vấn', 'Chào anh/chị, tách thửa cần đủ diện tích tối thiểu theo quy định của tỉnh và thửa phải có sổ. Anh/chị để lại SĐT em tư vấn chi tiết ạ.']);
    res.json({ ok: true, listings: created, agents: ids.length, chat: community.length + 2 });
  } catch (e) { next(e); }
});

// POST /api/admin/clear-demo — xoá toàn bộ dữ liệu mẫu (tin + tin nhắn + tài khoản agent mẫu).
adminRouter.post('/clear-demo', async (_req, res, next) => {
  try {
    const ids = await clearDemoContent();
    if (ids.length) await query(`DELETE FROM users WHERE id = ANY($1::int[])`, [ids]);
    res.json({ ok: true, removedAgents: ids.length });
  } catch (e) { next(e); }
});

// Báo cáo / thống kê
adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [users] = await query(`SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE role='gis')::int AS gis,
      count(*) FILTER (WHERE role='user')::int  AS users,
      count(*) FILTER (WHERE role='admin')::int AS admins,
      count(*) FILTER (WHERE tier='paid')::int  AS paid
      FROM users`);
    const [listings] = await query(`SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE status='active')::int AS active,
      count(*) FILTER (WHERE status='pending')::int AS pending,
      count(*) FILTER (WHERE status='hidden')::int AS hidden,
      count(*) FILTER (WHERE boosted)::int AS boosted,
      COALESCE(sum(price),0)::float8 AS "totalValue"
      FROM listings`);
    const byType = await query(`SELECT property_type AS type, count(*)::int AS n FROM listings GROUP BY property_type ORDER BY n DESC`);
    const byWard = await query(`SELECT COALESCE(ward,'(khác)') AS ward, count(*)::int AS n FROM listings GROUP BY ward ORDER BY n DESC LIMIT 8`);
    const [images] = await query(`SELECT count(*)::int AS total, COALESCE(sum(size),0)::bigint AS bytes FROM listing_images`);
    res.json({ users, listings, byType, byWard, images });
  } catch (e) { next(e); }
});

// Người dùng
adminRouter.get('/users', async (_req, res, next) => {
  try {
    const rows = await query(`SELECT id, email, role, full_name AS "fullName", phone, tier, status, boost_quota AS "boostQuota",
      is_advisor AS "isAdvisor", email_verified AS "emailVerified", created_at AS "createdAt" FROM users ORDER BY created_at DESC LIMIT 500`);
    res.json({ users: rows });
  } catch (e) { next(e); }
});
adminRouter.patch('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id); const b = req.body ?? {};
    const [row] = await query(
      `UPDATE users SET role=COALESCE($2,role), tier=COALESCE($3,tier), status=COALESCE($4,status), boost_quota=COALESCE($5,boost_quota), is_advisor=COALESCE($6,is_advisor)
       WHERE id=$1 RETURNING id, email, role, tier, status, boost_quota AS "boostQuota", is_advisor AS "isAdvisor"`,
      [id, b.role ?? null, b.tier ?? null, b.status ?? null, b.boostQuota ?? null, typeof b.isAdvisor === 'boolean' ? b.isAdvisor : null]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json({ user: row });
  } catch (e) { next(e); }
});

// Quản lý tin (mọi trạng thái)
adminRouter.get('/listings', async (_req, res, next) => {
  try {
    const rows = await query(`SELECT id, title, price, property_type AS "propertyType", ward, status, boosted, tier,
      created_by AS "createdBy", created_at AS "createdAt", images FROM listings ORDER BY CASE tier WHEN 'diamond' THEN 3 WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END DESC, COALESCE(bumped_at, created_at) DESC LIMIT 500`);
    res.json({ listings: rows });
  } catch (e) { next(e); }
});
adminRouter.patch('/listings/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id); const b = req.body ?? {};
    const [row] = await query(
      `UPDATE listings SET status=COALESCE($2,status), tier=COALESCE($3,tier),
              bumped_at=CASE WHEN $4 THEN now() ELSE bumped_at END,
              boosted=(COALESCE($3,tier) <> 'normal')
       WHERE id=$1 RETURNING id, status, tier, boosted`, [id, b.status ?? null, b.tier ?? null, !!b.bump]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy tin' });
    res.json({ listing: row });
  } catch (e) { next(e); }
});
