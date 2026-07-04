import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired, type AuthedRequest } from '../middleware/auth.ts';
import { hashPassword } from '../lib/auth.ts';

export const adminRouter = Router();
adminRouter.use(adminRequired);

// ─── Dữ liệu mẫu để TEST (bấm 1 nút tạo ~50 tin + tin nhắn; bấm nút khác xoá sạch) ───
const DEMO_WARDS = ['Cam Đức','Cam Hải Đông','Cam Hải Tây','Cam Thành Bắc','Cam Hòa','Cam Tân','Cam Hiệp Bắc','Cam Hiệp Nam','Cam An Bắc','Cam An Nam','Cam Phước Tây','Sơn Tân','Suối Cát','Suối Tân'];
// Xã ven biển + trung tâm huyện — nơi tập trung ~80% tin mẫu.
const HOT_WARDS = ['Cam Đức', 'Cam Hải Đông', 'Cam Hải Tây', 'Cam Hòa', 'Cam Thành Bắc'];
const OTHER_WARDS = DEMO_WARDS.filter((w) => !HOT_WARDS.includes(w));
// Tâm xã (kinh độ, vĩ độ) gần đúng để marker rơi đúng khu vực (ven biển lng cao ~109.19).
const WARD_CENTERS: Record<string, [number, number]> = {
  'Cam Đức': [109.145, 12.073], 'Cam Hải Đông': [109.190, 12.035], 'Cam Hải Tây': [109.160, 12.098],
  'Cam Hòa': [109.128, 12.140], 'Cam Thành Bắc': [109.128, 12.100], 'Cam Tân': [109.070, 12.055],
  'Cam Hiệp Bắc': [109.100, 12.065], 'Cam Hiệp Nam': [109.108, 12.030], 'Cam An Bắc': [109.135, 12.010],
  'Cam An Nam': [109.140, 11.975], 'Cam Phước Tây': [109.075, 11.995], 'Sơn Tân': [109.010, 11.945],
  'Suối Cát': [109.070, 12.110], 'Suối Tân': [109.100, 12.165],
};
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
  const rows = await query(`SELECT id FROM users WHERE email LIKE 'demo-%@camlam.local'`);
  const ids = rows.map((r: any) => r.id);
  if (ids.length) {
    await query(`DELETE FROM listings WHERE created_by = ANY($1::int[])`, [ids]);
    await query(`DELETE FROM chat_messages WHERE user_id = ANY($1::int[]) OR room = ANY($2::text[])`, [ids, ids.flatMap((id: number) => ['advisory:' + id, 'support:' + id])]);
  }
  await query(`DELETE FROM chat_messages WHERE room='community'`); // xoá HOÀN TOÀN chat cộng đồng để tạo lại
  await query(`DELETE FROM consignments WHERE description LIKE '%(dữ liệu mẫu)%'`);
  await query(`DELETE FROM invest_leads WHERE note LIKE '%(dữ liệu mẫu)%'`);
  return ids;
}
const DEMO_CUSTOMERS = ['Phạm Văn Dũng','Hoàng Thị Em','Võ Minh Phúc','Đặng Thị Giang','Bùi Quốc Huy','Ngô Thị Kim','Đỗ Văn Long','Trần Thị Mai','Lý Văn Nam','Phan Thị Oanh','Trương Văn Phú','Hồ Thị Quỳnh'];
// 10 khách demo để trao đổi ở nhóm cộng đồng + nhắn hỗ trợ/tư vấn.
const DEMO_CUST_USERS = DEMO_CUSTOMERS.slice(0, 10).map((name, i) => ({ email: `demo-cust-${i + 1}@camlam.local`, name, phone: '0901' + String(100000 + i) }));
async function demoCustomerIds(): Promise<number[]> {
  const ids: number[] = [];
  for (const c of DEMO_CUST_USERS) {
    const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(c.email)}`;
    let [u] = await query(`SELECT id FROM users WHERE email=$1`, [c.email]);
    if (!u) [u] = await query(`INSERT INTO users (email,password_hash,role,full_name,phone,email_verified,avatar) VALUES ($1,$2,'user',$3,$4,true,$5) RETURNING id`,
      [c.email, await hashPassword('demo-' + Math.random().toString(36).slice(2)), c.name, c.phone, avatar]);
    else await query(`UPDATE users SET full_name=$2, phone=$3, avatar=$4 WHERE id=$1`, [u.id, c.name, c.phone, avatar]);
    ids.push(u.id);
  }
  return ids;
}

// POST /api/admin/seed-demo — tạo ~50 tin mẫu đủ loại + tin nhắn mẫu (dọn mẫu cũ trước, không nhân đôi).
adminRouter.post('/seed-demo', async (req: AuthedRequest, res, next) => {
  try {
    const nSale = Math.min(Math.max(Number(req.body?.sale) || 179, 0), 400);
    const nRent = Math.min(Math.max(Number(req.body?.rent) || 168, 0), 400);
    const deals: string[] = [...Array(nSale).fill('sale'), ...Array(nRent).fill('rent')];
    const ids = await demoAgentIds();
    const custIds = await demoCustomerIds();
    await clearDemoContent();
    const saleTypes = ['land','house','apartment','villa','commercial','farm'];
    const rentTypes = ['house','apartment','room','commercial','office','warehouse'];
    const tiers = ['normal','normal','normal','normal','normal','silver','silver','gold','diamond'];
    const typeVN: Record<string, string> = { land:'đất nền', house:'nhà phố', apartment:'căn hộ', villa:'biệt thự', commercial:'mặt bằng', farm:'đất vườn', room:'phòng trọ', office:'văn phòng', warehouse:'kho xưởng' };
    // Xã "hot" (trung tâm + ven biển) ~80%; Cam Đức & Cam Hải Đông dày nhất.
    const HOT_WEIGHTED = ['Cam Đức','Cam Đức','Cam Đức','Cam Hải Đông','Cam Hải Đông','Cam Hải Đông','Cam Hải Tây','Cam Hải Tây','Cam Hòa','Cam Thành Bắc'];
    const rowsL: any[][] = [];
    for (let i = 0; i < deals.length; i++) {
      const deal = deals[i];
      const pt = deal === 'rent' ? pick(rentTypes) : pick(saleTypes);
      const ward = Math.random() < 0.8 ? pick(HOT_WEIGHTED) : pick(OTHER_WARDS);
      const tier = pick(tiers);
      const area = roundTo(rnd(pt === 'room' ? 18 : 60, (pt === 'land' || pt === 'farm') ? 500 : 220), 1);
      // Giá sát thị trường Cam Lâm: đất tính theo m² × đơn giá vùng (ven biển/trung tâm cao hơn); nhà/căn hộ theo khoảng thực tế.
      const hot = HOT_WEIGHTED.includes(ward);
      let price: number;
      if (deal === 'rent') {
        const rr: Record<string, [number, number]> = { room: [1.2, 3.5], house: [5, 16], apartment: [4, 11], commercial: [6, 40], office: [5, 22], warehouse: [9, 45] };
        const [lo, hi] = rr[pt] || [4, 15];
        price = roundTo(rnd(lo * 1e6, hi * 1e6) * (hot ? 1.15 : 0.9), 5e5);
      } else if (pt === 'land') {
        price = roundTo(area * rnd(hot ? 12e6 : 3e6, hot ? 28e6 : 9e6), 5e7);
      } else if (pt === 'farm') {
        price = roundTo(area * rnd(0.6e6, 2.5e6), 5e7);
      } else {
        const sr: Record<string, [number, number]> = { house: [2e9, 9e9], villa: [6e9, 25e9], apartment: [1.3e9, 4e9], commercial: [3e9, 20e9] };
        const [lo, hi] = sr[pt] || [2e9, 8e9];
        price = roundTo(rnd(lo, hi) * (hot ? 1.2 : 0.9), 5e7);
      }
      const beds = ['house','apartment','villa','room'].includes(pt) ? Math.floor(rnd(1, 5)) : null;
      const baths = beds ? Math.max(1, Math.floor(rnd(1, beds + 1))) : null;
      // Rải rác quanh xã, mật độ DÀY DẦN về tâm (dist tuyến tính → gần tâm nhiều hơn).
      const wc = WARD_CENTERS[ward] || [109.145, 12.05];
      const ang = Math.random() * 2 * Math.PI, dist = Math.random() * 0.02;
      const lng = wc[0] + dist * Math.cos(ang), lat = wc[1] + dist * Math.sin(ang) * 0.85;
      const priceTxt = deal === 'rent'
        ? `${(price / 1e6).toFixed(0)} triệu/tháng`
        : (price >= 1e9 ? `${(price / 1e9).toFixed(price % 1e9 ? 1 : 0)} tỷ` : `${(price / 1e6).toFixed(0)} triệu`);
      const title = `${deal === 'rent' ? 'Cho thuê' : 'Bán'} ${typeVN[pt]} ${ward} ${area}m² - ${priceTxt}${tier !== 'normal' ? ' (VIP)' : ''}`;
      const desc = `${deal === 'rent' ? 'Cho thuê' : 'Cần bán'} ${typeVN[pt]} tại ${ward}, Cam Lâm, Khánh Hòa. Diện tích ${area}m²${beds ? `, ${beds} phòng ngủ` : ''}. Vị trí thuận tiện, pháp lý rõ ràng. (Tin mẫu để kiểm thử)`;
      const nImg = 2 + Math.floor(Math.random() * 3);
      const images = Array.from({ length: nImg }, (_, k) => `https://picsum.photos/seed/demo${i}-${k}/800/600`);
      const status = i % 17 === 0 ? 'hidden' : (i % 23 === 0 ? 'sold' : 'active');
      const isVip = tier !== 'normal';
      const ageDays = isVip ? Math.floor(rnd(0, 90)) : (i % 5 === 0 ? Math.floor(rnd(10, 120)) : Math.floor(rnd(0, 6)));
      const views = Math.floor(rnd(0, Math.min(600, ageDays * 8 + 25)));
      rowsL.push([title, desc, price, area, pt, `Thôn ${Math.ceil(rnd(1, 9))}, ${ward}`, ward, beds, baths, pick(DEMO_DIRS), pick(DEMO_LEGAL), roundTo(rnd(3, 12), 0.5),
        pick(DEMO_AGENTS).name, pick(DEMO_PHONES), images, status, ids[i % ids.length], deal, views, tier, tier !== 'normal', lng, lat, String(ageDays)]);
    }
    for (let c = 0; c < rowsL.length; c += 40) {
      const slice = rowsL.slice(c, c + 40); const vals: string[] = []; const params: any[] = [];
      for (const r of slice) {
        const b = params.length; params.push(...r);
        vals.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16},$${b+17},$${b+18},$${b+19},$${b+20},$${b+21}, ST_SetSRID(ST_MakePoint($${b+22},$${b+23}),4326), now() - ($${b+24}||' days')::interval, CASE WHEN $${b+20} <> 'normal' THEN now() - (random()*2||' days')::interval ELSE NULL END)`);
      }
      await query(`INSERT INTO listings (title,description,price,area,property_type,address,ward,bedrooms,bathrooms,direction,legal,frontage,contact_name,contact_phone,images,status,created_by,deal,views,tier,boosted,geom,created_at,bumped_at) VALUES ${vals.join(',')}`, params);
    }
    const created = rowsL.length;
    // ── 168 tin nhắn CỘNG ĐỒNG, ~10 người trao đổi ──
    const chatUsers = custIds.map((id, i) => ({ id, name: DEMO_CUST_USERS[i].name })).concat(ids.map((id, i) => ({ id, name: DEMO_AGENTS[i].name })));
    const cTpl: ((w: string) => string)[] = [
      (w) => `Khu ${w} giờ giá tầm bao nhiêu 1m² vậy cả nhà?`,
      (w) => `Có anh chị nào cần mua đất ${w} sổ đỏ riêng không ạ?`,
      (w) => `Mình có lô ${w} giá tốt, ai quan tâm ib nhé.`,
      (w) => `Cho thuê nhà nguyên căn ${w}, ai cần liên hệ mình.`,
      (w) => `Đất ${w} dạo này giao dịch sôi động không mọi người?`,
      (w) => `Mới đi xem lô ${w}, view đẹp mà giá hơi chát 😅`,
      (w) => `${w} có dự án nào sắp mở bán không cả nhà?`,
      (w) => `Nhận ký gửi mua bán nhà đất ${w}, uy tín ạ.`,
      (w) => `Pháp lý đất ${w} ổn không mọi người, mình đang tính xuống tiền.`,
      (w) => `Cần thuê mặt bằng ${w} mở quán, ai có ib giúp em.`,
      () => `Sân bay Cam Lâm mà triển khai thì khu ven biển còn lên nữa 🚀`,
      () => `Cao tốc với đường ven biển xong là bất động sản khu này bay 🔥`,
      () => `Cả nhà cho hỏi thủ tục tách thửa giờ mất bao lâu ạ?`,
      () => `Mua đất mà sợ dính quy hoạch thì kiểm tra ở đâu vậy mọi người?`,
      () => `Lãi suất vay mua nhà giờ khoảng bao nhiêu % rồi các bác nhỉ?`,
      () => `Thuế phí sang tên sổ đỏ tính sao vậy, ai rành chỉ em với.`,
    ];
    {
      const params: any[] = []; const vals: string[] = [];
      for (let k = 0; k < 168; k++) {
        const u = pick(chatUsers);
        const w = Math.random() < 0.8 ? pick(HOT_WEIGHTED) : pick(OTHER_WARDS);
        const body = pick(cTpl)(w);
        const hoursAgo = ((168 - k) * 1.4 * (Math.random() * 0.6 + 0.7)).toFixed(1); // rải ~10 ngày, cũ→mới
        const b = params.length; params.push(u.id, u.name, body, hoursAgo);
        vals.push(`('community',$${b + 1},$${b + 2},$${b + 3}, now() - ($${b + 4}||' hours')::interval)`);
      }
      await query(`INSERT INTO chat_messages (room, user_id, name, body, created_at) VALUES ${vals.join(',')}`, params);
    }
    // ── Khách nhắn HỖ TRỢ & TƯ VẤN (nhiều luồng, đủ tình huống) ──
    const admin = req.user!.id;
    const cm: [string, number, string, string, number][] = [];
    const supTopics: [string, string][] = [
      ['Cho em hỏi đăng tin có mất phí không ạ?', 'Dạ miễn phí 1 tin/tháng, đăng thêm thì mua gói ạ.'],
      ['Mình quên mật khẩu thì lấy lại kiểu gì shop?', 'Anh/chị bấm Quên mật khẩu ở trang đăng nhập, hệ thống gửi mã qua email ạ.'],
      ['Sao tin em đăng 1 tuần rồi không thấy trên danh sách nữa?', 'Tin thường hiển thị 7 ngày, anh/chị bấm Đẩy tin để lên lại ạ.'],
      ['Em muốn đổi số điện thoại liên hệ thì làm ở đâu ạ?', 'Anh/chị vào Tài khoản của tôi để cập nhật SĐT ạ.'],
      ['Tải ảnh lên bị lỗi thì xử lý sao vậy ạ?', 'Anh/chị thử ảnh dưới 5MB, định dạng JPG/PNG giúp em ạ.'],
      ['Mua gói VIP thì tin nổi bật thế nào ạ?', 'Tin VIP hiện giá + tên gói trên bản đồ và luôn ở đầu danh sách ạ.'],
    ];
    const advTopics: [string, string][] = [
      ['Em có 500 triệu muốn đầu tư đất Cam Lâm, nên chọn khu nào ạ?', 'Tầm đó nên xem đất nền ven Cam Đức hoặc Cam Hải Tây, thanh khoản tốt ạ.'],
      ['Gói góp vốn CamInvest lãi suất bao nhiêu %/năm vậy?', 'Lãi suất theo kỳ hạn, kỳ càng dài càng cao; em gửi hợp đồng mẫu để tham khảo ạ.'],
      ['Đất nông nghiệp muốn lên thổ cư cần điều kiện gì ạ?', 'Cần phù hợp quy hoạch và nộp nghĩa vụ tài chính; em kiểm tra giúp theo thửa ạ.'],
      ['Mua đất ven biển Bãi Dài giờ có hợp lý không anh?', 'Bãi Dài tiềm năng dài hạn nhờ hạ tầng du lịch; nên chọn lô pháp lý sạch ạ.'],
      ['Vay ngân hàng mua nhà thì vay tối đa bao nhiêu %?', 'Thường 70% giá trị tài sản; anh/chị dùng công cụ tính vay trên web để ước tính ạ.'],
      ['Bán đất thì đóng những loại thuế phí gì ạ?', 'Thuế TNCN 2% và lệ phí trước bạ 0,5%; em tư vấn chi tiết theo hồ sơ ạ.'],
    ];
    supTopics.forEach(([q, a], i) => { const uid = custIds[i % custIds.length]; const nm = DEMO_CUST_USERS[i % DEMO_CUST_USERS.length].name; cm.push(['support:' + uid, uid, nm, q, 6 - i * 0.4]); cm.push(['support:' + uid, admin, 'Hỗ trợ Cam Lâm Land', a, 5.7 - i * 0.4]); });
    advTopics.forEach(([q, a], i) => { const j = (i + 3) % custIds.length; const uid = custIds[j]; const nm = DEMO_CUST_USERS[j].name; cm.push(['advisory:' + uid, uid, nm, q, 9 - i * 0.4]); cm.push(['advisory:' + uid, admin, 'Chuyên viên tư vấn', a, 8.7 - i * 0.4]); });
    {
      const params: any[] = []; const vals: string[] = [];
      for (const [room, uid, nm, body, h] of cm) { const b = params.length; params.push(room, uid, nm, body, String(h)); vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4}, now() - ($${b + 5}||' hours')::interval)`); }
      await query(`INSERT INTO chat_messages (room, user_id, name, body, created_at) VALUES ${vals.join(',')}`, params);
    }
    const chatCount = 168 + cm.length;

    // Khách GỬI BÁN (ký gửi) — hiện ở trang "Khách gửi bán"
    const cTypes = ['land','house','apartment','villa','commercial','farm'];
    const cStatus = ['new','new','new','contacted','done'];
    const priceExpects = ['Khoảng 2 tỷ','3,5 tỷ thương lượng','1,8 tỷ','5 tỷ','800 triệu','Thoả thuận','12 tỷ','2,2 tỷ/lô'];
    let consign = 0;
    for (let k = 0; k < 12; k++) {
      await query(
        `INSERT INTO consignments (name, phone, property_type, ward, address, area, price_expect, description, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() - ($10||' hours')::interval)`,
        [pick(DEMO_CUSTOMERS), '0900' + String(100000 + k), pick(cTypes), pick(DEMO_WARDS), `Thôn ${Math.ceil(rnd(1, 9))}`, roundTo(rnd(60, 400), 1), pick(priceExpects), 'Cần bán, pháp lý đầy đủ, liên hệ chính chủ. — (dữ liệu mẫu)', pick(cStatus), String(k * 5)]);
      consign++;
    }
    // Khách đăng ký TƯ VẤN ĐẦU TƯ (CamInvest) — hiện ở trang "Đăng ký góp vốn"
    const amounts = ['200 triệu','500 triệu','1 tỷ','2 tỷ','300 triệu','5 tỷ','800 triệu'];
    const tenures = ['6 tháng','12 tháng','24 tháng','36 tháng'];
    let invest = 0;
    for (let k = 0; k < 12; k++) {
      await query(
        `INSERT INTO invest_leads (name, phone, amount, tenure, note, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6, now() - ($7||' hours')::interval)`,
        [pick(DEMO_CUSTOMERS), '0900' + String(200000 + k), pick(amounts), pick(tenures), 'Quan tâm gói góp vốn, muốn tư vấn lợi nhuận & hợp đồng. — (dữ liệu mẫu)', pick(cStatus), String(k * 7)]);
      invest++;
    }
    res.json({ ok: true, listings: created, agents: ids.length, custUsers: custIds.length, chat: chatCount, consignments: consign, invest });
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
