import { Router } from 'express';
import { laAdmin, verifyToken } from '../lib/auth.ts';
import { query } from '../lib/db.ts';
import { isFlagOn } from '../lib/flags.ts';
import { cached, cachePut, cacheDrop } from '../lib/cache.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { vnNoAccent, vnTokens } from '../lib/vn.ts';

export const listingsRouter = Router();

const FREE_POST_LIMIT = 1; // tài khoản free: 1 tin/tháng
// Giới hạn độ dài chuỗi trước khi lưu (chống dữ liệu rác/quá khổ làm phình DB). null giữ nguyên null.
const clip = (v: any, n: number) => (v === undefined || v === null ? null : String(v).slice(0, n));
const SELECT = `
  SELECT listings.id, listings.title, listings.description, listings.price, listings.area,
         listings.property_type AS "propertyType", listings.address, listings.ward, listings.bedrooms,
         listings.bathrooms, listings.direction, listings.legal, listings.frontage,
         COALESCE(listings.contact_name, u.full_name, 'Cam Lâm Land') AS "contactName",
         COALESCE(listings.contact_phone, u.phone, '0988888888') AS "contactPhone",
         u.avatar AS "posterAvatar", CASE WHEN COALESCE(u.rating_count,0) > 0 THEN u.rating END AS "posterRating", u.rating_count AS "posterRatingCount",
         listings.status, listings.deal, listings.views, listings.boosted, listings.tier, listings.verified, listings.bumped_at AS "bumpedAt", listings.images, listings.created_by AS "createdBy",
         ST_X(listings.geom) AS lng, ST_Y(listings.geom) AS lat, listings.created_at AS "createdAt"
  FROM listings LEFT JOIN users u ON u.id = listings.created_by`;

/** Ẩn bớt SĐT: chỉ hiện 6 số đầu + '...'. */
function maskPhone(p: any): string | null {
  if (!p) return null;
  const d = String(p).replace(/\D/g, '');
  if (d.length <= 6) return String(p);
  return d.slice(0, 4) + ' ' + d.slice(4, 6) + '...';
}
// Người đang xem (KHÔNG bắt buộc đăng nhập): có thẻ hợp lệ thì trả người đó, không thì null.
function nguoiXem(req: any) {
  const m = /^Bearer (.+)$/.exec(String(req.headers?.authorization || ''));
  return m ? verifyToken(m[1]) : null;
}

// ⚠️ 29/9/2026 (rà soát bảo mật): CHỈ gắn ảnh DO CHÍNH NGƯỜI NÀY TẢI LÊN và CHƯA thuộc tin khác.
//    Trước đây câu UPDATE không kiểm chủ → gửi danh sách id ảnh tăng dần là "hút" hết ảnh của mọi tin
//    (cả PDF công văn danh sách nóng) về tin mình, xoá tin là database XOÁ THEO toàn bộ ảnh đó.
//    Admin vẫn gắn được ảnh bất kỳ (sửa tin hộ người khác). Tối đa 15 ảnh một tin.
function linkImages(listingId: number, images: any, user: any): Promise<any> {
  const ids = (Array.isArray(images) ? images : []).map((u: string) => {
    const m = /\/api\/images\/(\d+)/.exec(String(u)); return m ? Number(m[1]) : null;
  }).filter((x): x is number => x != null && Number.isInteger(x) && x > 0 && x < 2 ** 31).slice(0, 15);
  if (!ids.length) return Promise.resolve();
  return query(
    `UPDATE listing_images SET listing_id=$1
      WHERE id = ANY($2::int[]) AND (listing_id IS NULL OR listing_id = $1) AND ($3::boolean OR owner_id = $4)`,
    [listingId, ids, laAdmin(user), user?.id ?? -1]);
}

// GET /api/listings — bộ lọc + ưu tiên tin đẩy
// Nhận CẢ slug (dat-nen, nha-pho…) lẫn giá trị gốc (land, house…) cho propertyType → trang landing /nha-dat/* luôn lọc đúng.
const TYPE_SLUG: Record<string, string> = {
  'dat-nen': 'land', 'dat-tho-cu': 'land', 'dat-mat-tien': 'land', 'dat-nen-du-an': 'land', 'dat-ven-bien': 'land',
  'dat-vuon': 'farm', 'dat-nong-nghiep': 'farm', 'nha-pho': 'house', 'nha-cap-4': 'house', 'nha-mat-tien': 'house',
  'biet-thu': 'villa', 'can-ho': 'apartment', 'mat-bang-kinh-doanh': 'commercial', 'kho-xuong': 'warehouse',
  'cho-thue-nha': 'house', 'cho-thue-can-ho': 'apartment', 'cho-thue-phong-tro': 'room', 'cho-thue-mat-bang': 'commercial', 'cho-thue-van-phong': 'office', 'cho-thue-kho-xuong': 'warehouse',
};
// Sáp nhập 01/7/2025: xã MỚI (2 cấp) ⊇ các xã CŨ (3 cấp). Lọc bằng tên MỚI → khớp mọi xã cũ thành phần
// (xã cũ bị tách sang nhiều xã mới nên đây là khớp GẦN ĐÚNG, chấp nhận được cho bộ lọc). Key = tên mới đã bỏ dấu.
// 30/9/2026: sửa lại ĐÚNG theo NQ 1667 (scripts/dia-chinh/xa-moi.json) — bản trước xếp nhầm Cam Tân, Sơn Tân,
// Cam An Bắc vào xã Cam Lâm và Cam Tân, Sơn Tân vào Suối Dầu; thiếu Suối Tân ở Cam Lâm / Cam Hiệp.
const WARD_EXPAND: Record<string, string[]> = {
  'cam lam': ['Cam Lâm', 'Cam Đức', 'Cam Hải Đông', 'Cam Hải Tây', 'Cam Thành Bắc', 'Cam Hòa', 'Cam Hiệp Bắc', 'Cam Hiệp Nam', 'Cam An Nam', 'Suối Tân'],
  'suoi dau': ['Suối Dầu', 'Suối Cát', 'Cam Hòa', 'Suối Tân'],
  'cam hiep': ['Cam Hiệp', 'Cam Tân', 'Sơn Tân', 'Cam Hòa', 'Cam Hiệp Bắc', 'Cam Hiệp Nam', 'Suối Tân'],
  'cam an': ['Cam An', 'Cam An Bắc', 'Cam Phước Tây', 'Cam An Nam'],
};

listingsRouter.get('/', async (req, res, next) => {
  try {
    const ckey = 'listings:list:' + JSON.stringify(req.query);
    const chit = cached<any>(ckey);
    if (chit) { res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60'); return res.json(chit); }
    const { minPrice, maxPrice, propertyType, ward, q, bbox, deal } = req.query as Record<string, string>;
    const where: string[] = [`listings.status NOT IN ('hidden','pending')`, `(listings.tier <> 'normal' OR COALESCE(listings.bumped_at, listings.created_at) > now() - interval '7 days')`];
    const params: any[] = [];
    const p = (v: any) => { params.push(v); return `$${params.length}`; };
    // Mặc định chỉ hiện tin BÁN; ?deal=rent để xem tin cho thuê; ?deal=all để xem tất cả.
    if (deal !== 'all') where.push(`listings.deal = ${p(deal === 'rent' ? 'rent' : 'sale')}`);
    if (minPrice)     where.push(`price >= ${p(Number(minPrice))}`);
    if (maxPrice)     where.push(`price <= ${p(Number(maxPrice))}`);
    if (propertyType) where.push(`property_type = ${p(TYPE_SLUG[propertyType] || propertyType)}`);
    // Ward khớp KHÔNG DẤU; chuẩn hoá '-' của slug thành ' ' ("cam-duc"→"Cam Đức"). Nếu là XÃ MỚI → mở rộng ra các xã cũ.
    if (ward) {
      const key = vnNoAccent(String(ward).trim().replace(/[-_]+/g, ' '));
      const names = WARD_EXPAND[key];
      if (names) where.push(`vn_unaccent(COALESCE(listings.ward,'')) IN (${names.map((n) => p(vnNoAccent(n))).join(',')})`);
      else where.push(`vn_unaccent(COALESCE(listings.ward,'')) = ${p(key)}`);
    }
    // Tìm KHÔNG DẤU, không phân biệt hoa/thường, khớp MỌI token (AND) trên: tiêu đề + mô tả + địa chỉ + xã.
    if (q) {
      const doc = `vn_unaccent(COALESCE(listings.title,'')||' '||COALESCE(listings.description,'')||' '||COALESCE(listings.address,'')||' '||COALESCE(listings.ward,''))`;
      for (const tok of vnTokens(q)) where.push(`${doc} LIKE ${p('%' + tok + '%')}`);
    }
    if (bbox) { const [w, s, e, n] = bbox.split(',').map(Number); where.push(`geom && ST_MakeEnvelope(${p(w)},${p(s)},${p(e)},${p(n)},4326)`); }
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    const rows = await query(
      // Thứ tự: VIP (hạng cao trước, mới đẩy trước) → TIN THƯỜNG theo giờ đăng TĂNG DẦN (đăng sau hiện sau/xuống dưới; muốn lên đầu thì đẩy tin).
      `${SELECT} WHERE ${where.join(' AND ')} ORDER BY CASE listings.tier WHEN 'diamond' THEN 3 WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END DESC, CASE WHEN listings.tier = 'normal' THEN COALESCE(listings.bumped_at, listings.created_at) END ASC, COALESCE(listings.bumped_at, listings.created_at) DESC LIMIT ${p(limit)} OFFSET ${p(offset)}`, params);
    // Ẩn bớt SĐT + CẮT NGẮN mô tả trong DANH SÁCH (thẻ tin không dùng mô tả đầy đủ → nhẹ payload, tải nhanh; trang chi tiết vẫn lấy đủ).
    rows.forEach((r: any) => { r.contactPhone = maskPhone(r.contactPhone); if (r.description && r.description.length > 160) r.description = r.description.slice(0, 160) + '…'; });
    const payload = { count: rows.length, listings: rows };
    cachePut(ckey, payload, 20000);
    res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
    res.json(payload);
  } catch (e) { next(e); }
});

// GET /api/listings/areas — số tin đang hiển thị theo từng xã/khu vực (cho mục "Bất động sản theo địa điểm")
// Đặt TRƯỚC route '/:id' để không bị nuốt.
listingsRouter.get('/areas', async (_req, res, next) => {
  try {
    const ahit = cached<any>('listings:areas');
    if (ahit) { res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300'); return res.json(ahit); }
    const rows = await query(
      `SELECT COALESCE(NULLIF(TRIM(ward), ''), 'Khác') AS ward, COUNT(*)::int AS count
       FROM listings WHERE status NOT IN ('hidden','pending') AND deal = 'sale'
       GROUP BY 1 ORDER BY count DESC`);
    const payload = { areas: rows };
    cachePut('listings:areas', payload, 60000);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(payload);
  } catch (e) { next(e); }
});

// GET /api/listings/gia-khu-vuc — giá THAM KHẢO trung vị (đ/m²) theo xã, tính từ tin đang đăng. ?type= lọc loại BĐS (tuỳ chọn).
listingsRouter.get('/gia-khu-vuc', async (req, res, next) => {
  try {
    const type = String((req.query as any).type || '').trim();
    const ckey = 'listings:giakv:' + type;
    const hit = cached<any>(ckey);
    if (hit) { res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600'); return res.json(hit); }
    const params: any[] = [];
    let typeCond = '';
    if (type) { params.push(type); typeCond = ` AND property_type = $${params.length}`; }
    const rows = await query(
      `SELECT COALESCE(NULLIF(TRIM(ward), ''), 'Khác') AS ward,
              COUNT(*)::int AS count,
              ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY price / NULLIF(area, 0)))::bigint AS "medPerM2",
              ROUND(MIN(price / NULLIF(area, 0)))::bigint AS "minPerM2",
              ROUND(MAX(price / NULLIF(area, 0)))::bigint AS "maxPerM2"
         FROM listings
        WHERE status NOT IN ('hidden','pending') AND deal = 'sale' AND area >= 10 AND price >= 1000000${typeCond}
        GROUP BY 1 HAVING COUNT(*) >= 1 ORDER BY count DESC`, params);
    const payload = { type: type || null, areas: rows };
    cachePut(ckey, payload, 120000);
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
    res.json(payload);
  } catch (e) { next(e); }
});

// ⚠️ 11/10/2026 (rà soát bảo mật): trang cá nhân + "Hiện số" CHỈ dành cho NGƯỜI ĐĂNG TIN (có ít nhất 1 tin công khai).
//    Trước đây đổi số id là xem được tên + 6 số đầu SĐT của BẤT KỲ tài khoản nào, và (đã đăng nhập) lấy được SĐT
//    ĐẦY ĐỦ — mà đăng ký tài khoản bắt buộc nhập SĐT → cào được SĐT của toàn bộ khách hàng, kể cả người chưa đăng
//    tin bao giờ. Admin và chính chủ tài khoản vẫn xem được như cũ.
async function laNguoiDangTin(id: number): Promise<boolean> {
  const [r] = await query(`SELECT EXISTS (SELECT 1 FROM listings WHERE created_by=$1 AND status NOT IN ('hidden','pending')) AS co`, [id]);
  return !!r?.co;
}
function duocXemMoiNguoi(u: any, id: number): boolean { return !!u && (Number(u.id) === id || laAdmin(u)); }

// GET /api/listings/agent/:id — trang cá nhân người đăng (môi giới): thông tin + tin đang hiển thị + tin hết hạn/đã ẩn.
listingsRouter.get('/agent/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id >= 2 ** 31) return res.status(400).json({ error: 'id không hợp lệ' });
    const xem = nguoiXem(req);
    const dacBiet = duocXemMoiNguoi(xem, id);              // admin / chính chủ → được xem cả tài khoản chưa đăng tin
    if (!dacBiet && !(await laNguoiDangTin(id))) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    // ⚠️ KHÔNG trả `role` (29/9/2026): lộ ai là admin/gis là chỉ đường cho kẻ xấu nhắm vào tài khoản đó.
    const [agent] = await query(`SELECT id, full_name AS "name", phone, avatar, rating, rating_count AS "ratingCount", created_at AS "createdAt",
       -- "Môi giới chuyên nghiệp" = admin đã DUYỆT (xem routes/moiGioiCn.ts) → trang tin hiện khung xanh ngọc có nhãn.
       (cn_trang_thai = 'duyet') AS "pro"
       FROM users WHERE id=$1`, [id]);
    if (!agent) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    const active = await query(
      `${SELECT} WHERE listings.created_by=$1 AND listings.status NOT IN ('hidden','pending','sold')
         AND (listings.tier <> 'normal' OR COALESCE(listings.bumped_at, listings.created_at) > now() - interval '7 days')
       ORDER BY CASE listings.tier WHEN 'diamond' THEN 3 WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END DESC, COALESCE(listings.bumped_at, listings.created_at) DESC LIMIT 60`, [id]);
    const expired = await query(
      `${SELECT} WHERE listings.created_by=$1 AND listings.status <> 'pending'
         AND (listings.status IN ('hidden','sold') OR (listings.tier = 'normal' AND COALESCE(listings.bumped_at, listings.created_at) <= now() - interval '7 days'))
       ORDER BY COALESCE(listings.bumped_at, listings.created_at) DESC LIMIT 60`, [id]);
    for (const r of active) r.contactPhone = maskPhone(r.contactPhone);
    for (const r of expired) r.contactPhone = maskPhone(r.contactPhone);
    // ⚠️ 29/9/2026 (rà soát bảo mật): CHE số của chính người đăng. Trước đây trang /moi-gioi/:id chỉ che
    //    TRÊN MÀN HÌNH nhưng máy chủ gửi đủ 10 số (nằm trong nút tel:), ai cũng dò được SĐT của MỌI tài khoản
    //    bằng cách đổi số id. Số đầy đủ lấy qua POST /agent/:id/reveal (phải đăng nhập), giống "Hiện số" ở tin.
    agent.phone = agent.phone ? maskPhone(agent.phone) : null;
    // Bản trả cho admin / chính chủ có thể là tài khoản chưa đăng tin → không cho nginx / trình duyệt khác giữ lại.
    res.set('Cache-Control', dacBiet ? 'private, no-store' : 'public, max-age=30, stale-while-revalidate=120');
    res.json({ agent, active, expired });
  } catch (e) { next(e); }
});

// POST /api/listings/:id/boost — đặt hạng VIP / đẩy lên đầu (chủ tin hoặc admin)
listingsRouter.post('/:id/boost', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const [l] = await query('SELECT created_by FROM listings WHERE id=$1', [id]);
    if (!l) return res.status(404).json({ error: 'Không tìm thấy tin' });
    if (l.created_by !== req.user!.id && !laAdmin(req.user)) return res.status(403).json({ error: 'Không có quyền' });
    if (!(await isFlagOn('services_live')) && !laAdmin(req.user)) return res.status(403).json({ error: 'Tính năng đẩy tin hiện chưa được mở.' });
    const tier = ['normal', 'silver', 'gold', 'diamond'].includes(req.body?.tier) ? req.body.tier : null;
    const bump = !!req.body?.bump;
    const isBoost = bump || (tier !== null && tier !== 'normal');
    if (isBoost && !laAdmin(req.user)) {
      const [u] = await query(`SELECT boost_quota, boost_used, pkg_tier, boost_expires_at FROM users WHERE id=$1`, [req.user!.id]);
      const active = !!u && !!u.boost_expires_at && new Date(u.boost_expires_at).getTime() > Date.now();
      if (!active) return res.status(403).json({ error: 'Bạn chưa có gói đẩy tin hoặc gói đã hết hạn. Vào Bảng giá để mua gói.' });
      const rank: Record<string, number> = { normal: 0, silver: 1, gold: 2, diamond: 3 };
      if (tier && (rank[tier] ?? 0) > (rank[u.pkg_tier] ?? 0)) return res.status(403).json({ error: `Gói của bạn chỉ tới hạng ${u.pkg_tier}. Nâng gói để dùng hạng cao hơn.` });
      // ATOMIC: chỉ +1 lượt đẩy khi CÒN lượt → chống vượt quota khi bấm nhanh / nhiều tab cùng lúc.
      const consumed = await query(`UPDATE users SET boost_used = boost_used + 1 WHERE id=$1 AND boost_used < boost_quota RETURNING boost_used`, [req.user!.id]);
      if (!consumed.length) return res.status(403).json({ error: `Hết lượt đẩy của gói (đã dùng ${u.boost_used}/${u.boost_quota}). Nâng gói tại Bảng giá.` });
    }
    const [row] = await query(
      `UPDATE listings SET tier=COALESCE($2,tier), bumped_at=CASE WHEN $3 THEN now() ELSE bumped_at END, boosted=(COALESCE($2,tier) <> 'normal')
       WHERE id=$1 RETURNING id, tier, boosted`, [id, tier, bump]);
    cacheDrop('listings:');
    res.json({ ok: true, tier: row.tier });
  } catch (e) { next(e); }
});

listingsRouter.get('/geojson', async (_req, res, next) => {
  try {
    const ghit = cached<any>('listings:geojson');
    if (ghit) { res.set('Cache-Control', 'public, max-age=20, stale-while-revalidate=60'); return res.json(ghit); }
    const rows = await query(`
      SELECT json_build_object('type','Feature','geometry', ST_AsGeoJSON(geom)::json,
        'properties', json_build_object('id',id,'title',title,'price',price,'propertyType',property_type,
          'area',area,'ward',ward,'boosted',boosted,'image', (images)[1])) AS feature
      FROM listings WHERE status NOT IN ('hidden','pending')
        AND (tier <> 'normal' OR COALESCE(bumped_at, created_at) > now() - interval '7 days')`);
    const gpayload = { type: 'FeatureCollection', features: rows.map((r: any) => r.feature) };
    cachePut('listings:geojson', gpayload, 30000);
    res.set('Cache-Control', 'public, max-age=20, stale-while-revalidate=60');
    res.json(gpayload);
  } catch (e) { next(e); }
});

// GET /api/listings/mine — tin của tôi + số khách quan tâm. ?deal=sale|rent lọc theo tab (tuỳ chọn).
listingsRouter.get('/mine', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const deal = String((req.query as any).deal || '');
    const params: any[] = [req.user!.id];
    let dealCond = '';
    if (deal === 'rent' || deal === 'sale') { params.push(deal); dealCond = ` AND deal = $${params.length}`; }
    const rows = await query(
      `SELECT id, title, price, property_type AS "propertyType", deal, views, ward, status, boosted, tier, bumped_at AS "bumpedAt", images,
              ST_X(geom) AS lng, ST_Y(geom) AS lat, created_by AS "createdBy",
              created_at AS "createdAt",
              (SELECT count(*)::int FROM listing_leads ll WHERE ll.listing_id=listings.id) AS "leadCount",
              (SELECT COALESCE(sum(ll.views),0)::int FROM listing_leads ll WHERE ll.listing_id=listings.id) AS "leadViews"
       FROM listings WHERE created_by=$1${dealCond} ORDER BY CASE tier WHEN 'diamond' THEN 3 WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END DESC, COALESCE(bumped_at, created_at) DESC`, params);
    res.json({ count: rows.length, listings: rows });
  } catch (e) { next(e); }
});

listingsRouter.get('/usage', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const [u] = await query(
      `SELECT COALESCE(usg.posts,0) AS "freePosts", usr.post_used AS "postUsed", usr.boost_quota AS "boostQuota", usr.boost_used AS "boostUsed",
              usr.pkg_tier AS "pkgTier", usr.post_quota AS "postQuota", usr.post_expires_at AS "postExpiresAt", usr.boost_expires_at AS "boostExpiresAt"
         FROM users usr LEFT JOIN listing_usage usg ON usg.user_id=usr.id AND usg.ym=to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM')
        WHERE usr.id=$1`, [req.user!.id]);
    const pActive = !!u?.postExpiresAt && new Date(u.postExpiresAt).getTime() > Date.now();
    res.json({ posts: pActive ? Number(u?.postUsed ?? 0) : Number(u?.freePosts ?? 0), boostQuota: u?.boostQuota ?? 0, boostUsed: u?.boostUsed ?? 0, pkgTier: u?.pkgTier ?? null, postQuota: u?.postQuota ?? 0, postExpiresAt: u?.postExpiresAt ?? null, boostExpiresAt: u?.boostExpiresAt ?? null });
  } catch (e) { next(e); }
});

listingsRouter.get('/:id', async (req, res, next) => {
  try {
    const idTin = Number(req.params.id);
    if (!Number.isInteger(idTin) || idTin <= 0) return res.status(404).json({ error: 'Không tìm thấy tin' });
    const [row] = await query(`${SELECT} WHERE listings.id=$1`, [idTin]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy tin' });
    // ⚠️ 29/9/2026: tin đang ẨN / CHỜ DUYỆT chỉ chủ tin hoặc admin xem được (trước đây ai biết số là xem).
    if (row.status === 'hidden' || row.status === 'pending') {
      const u = nguoiXem(req);
      if (!u || (u.id !== row.createdBy && !laAdmin(u))) return res.status(404).json({ error: 'Không tìm thấy tin' });
    }
    // Đếm lượt xem tin (không chặn phản hồi). Trang sửa tin gọi kèm ?noview=1 để không tự tăng.
    if (req.query.noview !== '1') {
      query('UPDATE listings SET views = views + 1 WHERE id=$1', [row.id]).catch(() => {});
      row.views = (row.views || 0) + 1;
    }
    row.contactPhone = maskPhone(row.contactPhone);
    res.json(row);
  } catch (e) { next(e); }
});

// POST /api/listings/agent/:id/reveal — khách ĐĂNG NHẬP xem số đầy đủ của người đăng (trang /moi-gioi/:id).
listingsRouter.post('/agent/:id/reveal', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id >= 2 ** 31) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    if (!duocXemMoiNguoi(req.user, id) && !(await laNguoiDangTin(id))) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    const [u] = await query('SELECT phone FROM users WHERE id=$1', [id]);
    if (!u) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.set('Cache-Control', 'private, no-store');
    res.json({ phone: u.phone || null });
  } catch (e) { next(e); }
});

// POST /api/listings/:id/reveal — khách đăng nhập xem số đầy đủ (ghi lead)
listingsRouter.post('/:id/reveal', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const [l] = await query(`SELECT COALESCE(listings.contact_phone, u.phone, '0988888888') AS contact_phone, COALESCE(listings.contact_name, u.full_name, 'Cam Lâm Land') AS contact_name, listings.created_by, listings.status FROM listings LEFT JOIN users u ON u.id = listings.created_by WHERE listings.id=$1`, [id]);
    if (!l) return res.status(404).json({ error: 'Không tìm thấy tin' });
    // Tin đang ẨN / CHỜ DUYỆT: chỉ chủ tin hoặc admin (giống GET /:id) — trước đây ai đoán số tin là lấy được SĐT.
    if ((l.status === 'hidden' || l.status === 'pending') && l.created_by !== req.user!.id && !laAdmin(req.user))
      return res.status(404).json({ error: 'Không tìm thấy tin' });
    // Không ghi lead khi người xem là chủ tin hoặc admin
    if (!laAdmin(req.user) && l.created_by !== req.user!.id) {
      const [u] = await query('SELECT full_name, phone, email FROM users WHERE id=$1', [req.user!.id]);
      await query(
        `INSERT INTO listing_leads (listing_id, user_id, name, phone) VALUES ($1,$2,$3,$4)
         ON CONFLICT (listing_id, user_id)
         DO UPDATE SET views = listing_leads.views + 1, last_at = now(), name = EXCLUDED.name, phone = EXCLUDED.phone`,
        [id, req.user!.id, u?.full_name ?? null, u?.phone ?? u?.email ?? null]);
    }
    res.json({ contactPhone: l.contact_phone, contactName: l.contact_name });
  } catch (e) { next(e); }
});

// GET /api/listings/:id/leads — chủ tin/admin xem khách quan tâm (xếp theo số lần xem)
listingsRouter.get('/:id/leads', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const [l] = await query('SELECT title, created_by FROM listings WHERE id=$1', [id]);
    if (!l) return res.status(404).json({ error: 'Không tìm thấy tin' });
    if (!laAdmin(req.user) && l.created_by !== req.user!.id) return res.status(403).json({ error: 'Không có quyền' });
    const leads = await query(
      `SELECT id, name, phone, views, first_at AS "firstAt", last_at AS "lastAt"
       FROM listing_leads WHERE listing_id=$1 ORDER BY views DESC, last_at DESC`, [id]);
    res.json({ title: l.title, count: leads.length, leads });
  } catch (e) { next(e); }
});

// POST /api/listings — đăng tin (môi giới/admin)
listingsRouter.post('/', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.title || b.price == null || b.lng == null || b.lat == null)
      return res.status(400).json({ error: 'Cần tiêu đề, giá và vị trí trên bản đồ' });
    if (Number(b.price) < 0) return res.status(400).json({ error: 'Giá không được âm' });
    const svcOn = await isFlagOn('services_live');
    let pkgActive = false;
    if (svcOn && !laAdmin(req.user)) {
      const [u] = await query(
        `SELECT post_expires_at AS exp, post_quota AS "postQuota", post_used AS "postUsed",
                COALESCE((SELECT posts FROM listing_usage WHERE user_id=$1 AND ym=to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM')),0) AS "freePosts"
           FROM users WHERE id=$1`, [req.user!.id]);
      pkgActive = !!u?.exp && new Date(u.exp).getTime() > Date.now();
      if (pkgActive) {
        // ATOMIC: trừ 1 tin của gói NGAY, chỉ khi còn hạn mức → chống vượt quota khi đăng nhiều lần/nhiều tab.
        const consumed = await query(`UPDATE users SET post_used = post_used + 1 WHERE id=$1 AND post_used < post_quota RETURNING post_used`, [req.user!.id]);
        if (!consumed.length)
          return res.status(403).json({ error: `Đã dùng hết ${u.postQuota} tin của gói (gói còn hạn tới ${new Date(u.exp).toLocaleDateString('vi-VN')}). Mua thêm gói để đăng tiếp.` });
      } else if (Number(u?.freePosts ?? 0) >= FREE_POST_LIMIT) {
        return res.status(403).json({ error: `Đã đạt giới hạn ${FREE_POST_LIMIT} tin/tháng (tài khoản miễn phí). Mua gói để đăng thêm.` });
      }
    }
    const [row] = await query(
      `INSERT INTO listings
         (title,description,price,area,property_type,address,ward,bedrooms,bathrooms,direction,legal,frontage,
          contact_name,contact_phone,images,status,geom,created_by,deal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active', ST_SetSRID(ST_MakePoint($16,$17),4326), $18, $19)
       RETURNING id`,
      [clip(b.title, 200), clip(b.description, 5000), b.price, b.area ?? null, clip(b.propertyType, 40) ?? 'land', clip(b.address, 300),
       clip(b.ward, 120), b.bedrooms ?? null, b.bathrooms ?? null, clip(b.direction, 60), clip(b.legal, 120), b.frontage ?? null,
       clip(b.contactName, 120), clip(b.contactPhone, 30), b.images ?? [], b.lng, b.lat, req.user!.id, b.deal === 'rent' ? 'rent' : 'sale']);
    await linkImages(row.id, b.images, req.user);
    cacheDrop('listings:');
    if (svcOn && !laAdmin(req.user) && !pkgActive) bumpUsage(req.user!.id, 'posts').catch(() => {}); // gói trả phí ĐÃ trừ atomic ở trên; free-tier đếm theo tháng ở đây
    const [created] = await query(`${SELECT} WHERE listings.id=$1`, [row.id]);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

async function ownerOrAdmin(req: AuthedRequest, id: number): Promise<boolean> {
  if (laAdmin(req.user)) return true;
  const [l] = await query('SELECT created_by FROM listings WHERE id=$1', [id]);
  return !!l && l.created_by === req.user!.id;
}
// Chỉ chủ tin (admin KHÔNG được sửa nội dung tin người khác)
async function ownerOnly(req: AuthedRequest, id: number): Promise<boolean> {
  const [l] = await query('SELECT created_by FROM listings WHERE id=$1', [id]);
  return !!l && l.created_by === req.user!.id;
}
// Đếm lượt đăng/đẩy theo tháng (chỉ tăng, KHÔNG giảm khi xoá tin)
async function bumpUsage(userId: number, field: 'posts' | 'boosts'): Promise<void> {
  if (!userId) return;
  await query(
    `INSERT INTO listing_usage (user_id, ym, ${field}) VALUES ($1, to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM'), 1)
     ON CONFLICT (user_id, ym) DO UPDATE SET ${field} = listing_usage.${field} + 1`, [userId]);
}

listingsRouter.put('/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!(await ownerOnly(req, id))) return res.status(403).json({ error: 'Chỉ chủ tin mới được sửa. Admin chỉ có thể xoá.' });
    const b = req.body ?? {};
    if (b.price != null && Number(b.price) < 0) return res.status(400).json({ error: 'Giá không được âm' });
    // ⚠️ 29/9/2026 (rà soát bảo mật): chủ tin chỉ được đặt 'active' hoặc 'sold', và KHÔNG được tự gỡ
    //    trạng thái 'hidden'/'pending' do admin đặt (trước đây gửi status:'active' là tin bị ẩn hiện lại).
    let trangThai: string | null = clip(b.status, 20) || null;
    if (trangThai && !laAdmin(req.user)) {
      const [cu] = await query('SELECT status FROM listings WHERE id=$1', [id]);
      if (!['active', 'sold'].includes(trangThai) || ['hidden', 'pending'].includes(cu?.status)) trangThai = null;
    }
    const [row] = await query(
      `UPDATE listings SET
         title=COALESCE($2,title), description=COALESCE($3,description), price=COALESCE($4,price), area=COALESCE($5,area),
         property_type=COALESCE($6,property_type), address=COALESCE($7,address), ward=COALESCE($8,ward),
         bedrooms=COALESCE($9,bedrooms), bathrooms=COALESCE($10,bathrooms), direction=COALESCE($11,direction),
         legal=COALESCE($12,legal), frontage=COALESCE($13,frontage), contact_name=COALESCE($14,contact_name),
         contact_phone=COALESCE($15,contact_phone), status=COALESCE($16,status), images=COALESCE($17,images),
         geom=CASE WHEN $18::float8 IS NULL THEN geom ELSE ST_SetSRID(ST_MakePoint($18,$19),4326) END,
         deal=COALESCE($20,deal)
       WHERE id=$1 RETURNING id`,
      [id, clip(b.title, 200), clip(b.description, 5000), b.price ?? null, b.area ?? null, clip(b.propertyType, 40),
       clip(b.address, 300), clip(b.ward, 120), b.bedrooms ?? null, b.bathrooms ?? null, clip(b.direction, 60),
       clip(b.legal, 120), b.frontage ?? null, clip(b.contactName, 120), clip(b.contactPhone, 30), trangThai,
       b.images ?? null, b.lng ?? null, b.lat ?? null, clip(b.deal, 10)]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy tin' });
    if (b.images) await linkImages(id, b.images, req.user);
    const [updated] = await query(`${SELECT} WHERE listings.id=$1`, [id]);
    res.json(updated);
  } catch (e) { next(e); }
});

listingsRouter.delete('/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!(await ownerOrAdmin(req, id))) return res.status(403).json({ error: 'Không có quyền xoá tin này' });
    const r = await query('DELETE FROM listings WHERE id=$1 RETURNING id', [id]);
    cacheDrop('listings:');
    if (!r.length) return res.status(404).json({ error: 'Không tìm thấy tin' });
    res.json({ deleted: r[0].id });
  } catch (e) { next(e); }
});
