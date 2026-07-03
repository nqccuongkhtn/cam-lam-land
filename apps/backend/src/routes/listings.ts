import { Router } from 'express';
import { query } from '../lib/db.ts';
import { isFlagOn } from '../lib/flags.ts';
import { cached, cachePut, cacheDrop } from '../lib/cache.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { vnNoAccent, vnTokens } from '../lib/vn.ts';

export const listingsRouter = Router();

const FREE_POST_LIMIT = 1; // tài khoản free: 1 tin/tháng
const SELECT = `
  SELECT listings.id, listings.title, listings.description, listings.price, listings.area,
         listings.property_type AS "propertyType", listings.address, listings.ward, listings.bedrooms,
         listings.bathrooms, listings.direction, listings.legal, listings.frontage,
         COALESCE(listings.contact_name, u.full_name, 'Cam Lâm Land') AS "contactName",
         COALESCE(listings.contact_phone, u.phone, '0988888888') AS "contactPhone",
         u.avatar AS "posterAvatar",
         listings.status, listings.boosted, listings.tier, listings.bumped_at AS "bumpedAt", listings.images, listings.created_by AS "createdBy",
         ST_X(listings.geom) AS lng, ST_Y(listings.geom) AS lat, listings.created_at AS "createdAt"
  FROM listings LEFT JOIN users u ON u.id = listings.created_by`;

/** Ẩn bớt SĐT: chỉ hiện 6 số đầu + '...'. */
function maskPhone(p: any): string | null {
  if (!p) return null;
  const d = String(p).replace(/\D/g, '');
  if (d.length <= 6) return String(p);
  return d.slice(0, 4) + ' ' + d.slice(4, 6) + '...';
}
function linkImages(listingId: number, images: any): Promise<any> {
  const ids = (Array.isArray(images) ? images : []).map((u: string) => {
    const m = /\/api\/images\/(\d+)/.exec(String(u)); return m ? Number(m[1]) : null;
  }).filter((x): x is number => x != null);
  if (!ids.length) return Promise.resolve();
  return query(`UPDATE listing_images SET listing_id=$1 WHERE id = ANY($2::int[])`, [listingId, ids]);
}

// GET /api/listings — bộ lọc + ưu tiên tin đẩy
listingsRouter.get('/', async (req, res, next) => {
  try {
    const ckey = 'listings:list:' + JSON.stringify(req.query);
    const chit = cached<any>(ckey);
    if (chit) { res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60'); return res.json(chit); }
    const { minPrice, maxPrice, propertyType, ward, q, bbox } = req.query as Record<string, string>;
    const where: string[] = [`listings.status NOT IN ('hidden','pending')`, `(listings.tier <> 'normal' OR COALESCE(listings.bumped_at, listings.created_at) > now() - interval '7 days')`];
    const params: any[] = [];
    const p = (v: any) => { params.push(v); return `$${params.length}`; };
    if (minPrice)     where.push(`price >= ${p(Number(minPrice))}`);
    if (maxPrice)     where.push(`price <= ${p(Number(maxPrice))}`);
    if (propertyType) where.push(`property_type = ${p(propertyType)}`);
    if (ward)         where.push(`vn_unaccent(COALESCE(listings.ward,'')) = ${p(vnNoAccent(String(ward).trim()))}`);
    // Tìm KHÔNG DẤU, không phân biệt hoa/thường, khớp MỌI token (AND) trên: tiêu đề + mô tả + địa chỉ + xã.
    if (q) {
      const doc = `vn_unaccent(COALESCE(listings.title,'')||' '||COALESCE(listings.description,'')||' '||COALESCE(listings.address,'')||' '||COALESCE(listings.ward,''))`;
      for (const tok of vnTokens(q)) where.push(`${doc} LIKE ${p('%' + tok + '%')}`);
    }
    if (bbox) { const [w, s, e, n] = bbox.split(',').map(Number); where.push(`geom && ST_MakeEnvelope(${p(w)},${p(s)},${p(e)},${p(n)},4326)`); }
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    const rows = await query(
      `${SELECT} WHERE ${where.join(' AND ')} ORDER BY CASE listings.tier WHEN 'diamond' THEN 3 WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END DESC, COALESCE(listings.bumped_at, listings.created_at) DESC LIMIT ${p(limit)} OFFSET ${p(offset)}`, params);
    rows.forEach((r: any) => { r.contactPhone = maskPhone(r.contactPhone); });
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
       FROM listings WHERE status NOT IN ('hidden','pending')
       GROUP BY 1 ORDER BY count DESC`);
    const payload = { areas: rows };
    cachePut('listings:areas', payload, 60000);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(payload);
  } catch (e) { next(e); }
});

// POST /api/listings/:id/boost — đặt hạng VIP / đẩy lên đầu (chủ tin hoặc admin)
listingsRouter.post('/:id/boost', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const [l] = await query('SELECT created_by FROM listings WHERE id=$1', [id]);
    if (!l) return res.status(404).json({ error: 'Không tìm thấy tin' });
    if (l.created_by !== req.user!.id && req.user!.role !== 'admin') return res.status(403).json({ error: 'Không có quyền' });
    if (!(await isFlagOn('services_live')) && req.user!.role !== 'admin') return res.status(403).json({ error: 'Tính năng đẩy tin hiện chưa được mở.' });
    const tier = ['normal', 'silver', 'gold', 'diamond'].includes(req.body?.tier) ? req.body.tier : null;
    const bump = !!req.body?.bump;
    const isBoost = bump || (tier !== null && tier !== 'normal');
    if (isBoost && req.user!.role !== 'admin') {
      const [u] = await query(`SELECT boost_quota, boost_used, pkg_tier, boost_expires_at FROM users WHERE id=$1`, [req.user!.id]);
      const active = !!u && !!u.boost_expires_at && new Date(u.boost_expires_at).getTime() > Date.now();
      if (!active) return res.status(403).json({ error: 'Bạn chưa có gói đẩy tin hoặc gói đã hết hạn. Vào Bảng giá để mua gói.' });
      if (Number(u.boost_used) >= Number(u.boost_quota)) return res.status(403).json({ error: `Hết lượt đẩy của gói (đã dùng ${u.boost_used}/${u.boost_quota}). Nâng gói tại Bảng giá.` });
      const rank: Record<string, number> = { normal: 0, silver: 1, gold: 2, diamond: 3 };
      if (tier && (rank[tier] ?? 0) > (rank[u.pkg_tier] ?? 0)) return res.status(403).json({ error: `Gói của bạn chỉ tới hạng ${u.pkg_tier}. Nâng gói để dùng hạng cao hơn.` });
    }
    const [row] = await query(
      `UPDATE listings SET tier=COALESCE($2,tier), bumped_at=CASE WHEN $3 THEN now() ELSE bumped_at END, boosted=(COALESCE($2,tier) <> 'normal')
       WHERE id=$1 RETURNING id, tier, boosted`, [id, tier, bump]);
    if (isBoost && req.user!.role !== 'admin') await query('UPDATE users SET boost_used = boost_used + 1 WHERE id=$1', [req.user!.id]);
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

// GET /api/listings/mine — tin của tôi + số khách quan tâm
listingsRouter.get('/mine', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const rows = await query(
      `SELECT id, title, price, property_type AS "propertyType", ward, status, boosted, tier, bumped_at AS "bumpedAt", images,
              ST_X(geom) AS lng, ST_Y(geom) AS lat, created_by AS "createdBy",
              created_at AS "createdAt",
              (SELECT count(*)::int FROM listing_leads ll WHERE ll.listing_id=listings.id) AS "leadCount",
              (SELECT COALESCE(sum(views),0)::int FROM listing_leads ll WHERE ll.listing_id=listings.id) AS "leadViews"
       FROM listings WHERE created_by=$1 ORDER BY CASE tier WHEN 'diamond' THEN 3 WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END DESC, COALESCE(bumped_at, created_at) DESC`, [req.user!.id]);
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
    const [row] = await query(`${SELECT} WHERE listings.id=$1`, [Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy tin' });
    row.contactPhone = maskPhone(row.contactPhone);
    res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
    res.json(row);
  } catch (e) { next(e); }
});

// POST /api/listings/:id/reveal — khách đăng nhập xem số đầy đủ (ghi lead)
listingsRouter.post('/:id/reveal', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const [l] = await query(`SELECT COALESCE(listings.contact_phone, u.phone, '0988888888') AS contact_phone, COALESCE(listings.contact_name, u.full_name, 'Cam Lâm Land') AS contact_name, listings.created_by FROM listings LEFT JOIN users u ON u.id = listings.created_by WHERE listings.id=$1`, [id]);
    if (!l) return res.status(404).json({ error: 'Không tìm thấy tin' });
    // Không ghi lead khi người xem là chủ tin hoặc admin
    if (req.user!.role !== 'admin' && l.created_by !== req.user!.id) {
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
    if (req.user!.role !== 'admin' && l.created_by !== req.user!.id) return res.status(403).json({ error: 'Không có quyền' });
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
    if (svcOn && req.user!.role !== 'admin') {
      const [u] = await query(
        `SELECT post_expires_at AS exp, post_quota AS "postQuota", post_used AS "postUsed",
                COALESCE((SELECT posts FROM listing_usage WHERE user_id=$1 AND ym=to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM')),0) AS "freePosts"
           FROM users WHERE id=$1`, [req.user!.id]);
      pkgActive = !!u?.exp && new Date(u.exp).getTime() > Date.now();
      if (pkgActive) {
        if (Number(u?.postUsed ?? 0) >= Number(u?.postQuota ?? 0))
          return res.status(403).json({ error: `Đã dùng hết ${u.postQuota} tin của gói (gói còn hạn tới ${new Date(u.exp).toLocaleDateString('vi-VN')}). Mua thêm gói để đăng tiếp.` });
      } else if (Number(u?.freePosts ?? 0) >= FREE_POST_LIMIT) {
        return res.status(403).json({ error: `Đã đạt giới hạn ${FREE_POST_LIMIT} tin/tháng (tài khoản miễn phí). Mua gói để đăng thêm.` });
      }
    }
    const [row] = await query(
      `INSERT INTO listings
         (title,description,price,area,property_type,address,ward,bedrooms,bathrooms,direction,legal,frontage,
          contact_name,contact_phone,images,status,geom,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active', ST_SetSRID(ST_MakePoint($16,$17),4326), $18)
       RETURNING id`,
      [b.title, b.description ?? null, b.price, b.area ?? null, b.propertyType ?? 'land', b.address ?? null,
       b.ward ?? null, b.bedrooms ?? null, b.bathrooms ?? null, b.direction ?? null, b.legal ?? null, b.frontage ?? null,
       b.contactName ?? null, b.contactPhone ?? null, b.images ?? [], b.lng, b.lat, req.user!.id]);
    await linkImages(row.id, b.images);
    cacheDrop('listings:');
    if (svcOn && req.user!.role !== 'admin') { if (pkgActive) await query('UPDATE users SET post_used = post_used + 1 WHERE id=$1', [req.user!.id]); else bumpUsage(req.user!.id, 'posts').catch(() => {}); }
    const [created] = await query(`${SELECT} WHERE listings.id=$1`, [row.id]);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

async function ownerOrAdmin(req: AuthedRequest, id: number): Promise<boolean> {
  if (req.user!.role === 'admin') return true;
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
    const [row] = await query(
      `UPDATE listings SET
         title=COALESCE($2,title), description=COALESCE($3,description), price=COALESCE($4,price), area=COALESCE($5,area),
         property_type=COALESCE($6,property_type), address=COALESCE($7,address), ward=COALESCE($8,ward),
         bedrooms=COALESCE($9,bedrooms), bathrooms=COALESCE($10,bathrooms), direction=COALESCE($11,direction),
         legal=COALESCE($12,legal), frontage=COALESCE($13,frontage), contact_name=COALESCE($14,contact_name),
         contact_phone=COALESCE($15,contact_phone), status=COALESCE($16,status), images=COALESCE($17,images),
         geom=CASE WHEN $18::float8 IS NULL THEN geom ELSE ST_SetSRID(ST_MakePoint($18,$19),4326) END
       WHERE id=$1 RETURNING id`,
      [id, b.title ?? null, b.description ?? null, b.price ?? null, b.area ?? null, b.propertyType ?? null,
       b.address ?? null, b.ward ?? null, b.bedrooms ?? null, b.bathrooms ?? null, b.direction ?? null,
       b.legal ?? null, b.frontage ?? null, b.contactName ?? null, b.contactPhone ?? null, b.status ?? null,
       b.images ?? null, b.lng ?? null, b.lat ?? null]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy tin' });
    if (b.images) await linkImages(id, b.images);
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
