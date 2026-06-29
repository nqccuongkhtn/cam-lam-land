import { Router } from 'express';
import { cached, cachePut, cacheDrop } from '../lib/cache.ts';
import { query } from '../lib/db.ts';
import { adminRequired, type AuthedRequest } from '../middleware/auth.ts';

export const mapAdsRouter = Router();

// GET /api/map-ads/active — các điểm quảng cáo đang hiệu lực (công khai, hiển thị trên bản đồ)
mapAdsRouter.get('/active', async (_req, res, next) => {
  try {
    const ahit = cached<any>('mapads:active');
    if (ahit) { res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120'); return res.json(ahit); }
    const rows = await query(
      `SELECT id, advertiser_name, advertiser_phone, image_url, points, style
         FROM map_ads WHERE status='active' AND now() < expires_at`);
    const ads: any[] = [];
    for (const r of rows) {
      if ((r.style || 'seal') === 'text') {
        ads.push({ id: r.id, name: r.advertiser_name, phone: r.advertiser_phone, style: 'text' });
        continue;
      }
      const pts = Array.isArray(r.points) ? r.points : [];
      for (const p of pts) {
        if (p && Number.isFinite(+p.lng) && Number.isFinite(+p.lat))
          ads.push({ id: r.id, name: r.advertiser_name, phone: r.advertiser_phone, image: r.image_url, style: 'seal', lng: +p.lng, lat: +p.lat });
      }
    }
    const apayload = { ads };
    cachePut('mapads:active', apayload, 30000);
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json(apayload);
  } catch (e) { next(e); }
});

// GET /api/map-ads — danh sách đầy đủ (admin)
mapAdsRouter.get('/', adminRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, advertiser_name AS "advertiserName", advertiser_phone AS "advertiserPhone",
              image_url AS "imageUrl", wards, points, package, style, status,
              starts_at AS "startsAt", expires_at AS "expiresAt",
              (status='active' AND now() < expires_at) AS active
         FROM map_ads ORDER BY created_at DESC`);
    res.json({ count: rows.length, ads: rows });
  } catch (e) { next(e); }
});

// POST /api/map-ads — tạo quảng cáo (admin), độc quyền: chống trùng xã đang hiệu lực
mapAdsRouter.post('/', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body ?? {};
    const name = String(b.advertiserName ?? '').trim();
    const phone = String(b.advertiserPhone ?? '').trim();
    const wards: string[] = Array.isArray(b.wards) ? b.wards.filter((w: any) => typeof w === 'string' && w.trim()) : [];
    const points = Array.isArray(b.points)
      ? b.points.filter((p: any) => p && Number.isFinite(+p.lng) && Number.isFinite(+p.lat)).map((p: any) => ({ lng: +p.lng, lat: +p.lat }))
      : [];
    const months = Math.max(1, Math.min(36, Math.round(Number(b.months) || 1)));
    const style = b.style === 'text' ? 'text' : 'seal';
    if (!name || !phone) return res.status(400).json({ error: 'Cần tên và SĐT người quảng cáo' });
    if (!wards.length) return res.status(400).json({ error: 'Chọn ít nhất 1 xã' });
    if (style !== 'text' && !points.length) return res.status(400).json({ error: 'Ghim ít nhất 1 điểm hiển thị trên bản đồ' });
    const clash = await query(
      `SELECT advertiser_name, wards FROM map_ads
        WHERE status='active' AND now() < expires_at AND wards && $1::text[]`, [wards]);
    if (clash.length) {
      const taken = new Set<string>();
      clash.forEach((c: any) => (c.wards || []).forEach((w: string) => { if (wards.includes(w)) taken.add(w); }));
      return res.status(409).json({ error: `Các xã đã có người đăng ký độc quyền: ${[...taken].join(', ')}. Hãy bỏ các xã này hoặc xoá quảng cáo cũ trước.` });
    }
    const [row] = await query(
      `INSERT INTO map_ads (advertiser_name, advertiser_phone, image_url, wards, points, package, style, expires_at, status, created_by)
       VALUES ($1,$2,$3,$4::text[],$5::jsonb,$6,$7, now() + make_interval(months => $8::int), 'active', $9)
       RETURNING id`,
      [name, phone, b.imageUrl ?? null, wards, JSON.stringify(points), b.package ?? `${months} tháng`, style, months, req.user!.id]);
    res.status(201).json({ id: row.id });
  } catch (e) { next(e); }
});

// PUT /api/map-ads/:id — sửa quảng cáo (admin). Giữ độc quyền xã (trừ chính nó). months=0 => giữ nguyên hạn.
mapAdsRouter.put('/:id', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const [cur] = await query('SELECT package FROM map_ads WHERE id=$1', [id]);
    if (!cur) return res.status(404).json({ error: 'Không tìm thấy' });
    const b = req.body ?? {};
    const name = String(b.advertiserName ?? '').trim();
    const phone = String(b.advertiserPhone ?? '').trim();
    const wards: string[] = Array.isArray(b.wards) ? b.wards.filter((w: any) => typeof w === 'string' && w.trim()) : [];
    const points = Array.isArray(b.points)
      ? b.points.filter((p: any) => p && Number.isFinite(+p.lng) && Number.isFinite(+p.lat)).map((p: any) => ({ lng: +p.lng, lat: +p.lat }))
      : [];
    const months = Math.max(0, Math.min(36, Math.round(Number(b.months) || 0)));
    const style = b.style === 'text' ? 'text' : 'seal';
    if (!name || !phone) return res.status(400).json({ error: 'Cần tên và SĐT người quảng cáo' });
    if (!wards.length) return res.status(400).json({ error: 'Chọn ít nhất 1 xã' });
    if (style !== 'text' && !points.length) return res.status(400).json({ error: 'Ghim ít nhất 1 điểm hiển thị trên bản đồ' });
    const clash = await query(
      `SELECT wards FROM map_ads WHERE id<>$2 AND status='active' AND now() < expires_at AND wards && $1::text[]`, [wards, id]);
    if (clash.length) {
      const taken = new Set<string>();
      clash.forEach((c: any) => (c.wards || []).forEach((w: string) => { if (wards.includes(w)) taken.add(w); }));
      return res.status(409).json({ error: `Các xã đã có người khác đăng ký độc quyền: ${[...taken].join(', ')}.` });
    }
    const pkg = months ? `${months} tháng` : cur.package;
    await query(
      `UPDATE map_ads SET advertiser_name=$2, advertiser_phone=$3, image_url=$4, wards=$5::text[], points=$6::jsonb, package=$7, style=$9,
         expires_at = CASE WHEN $8::int > 0 THEN now() + make_interval(months => $8::int) ELSE expires_at END, status='active'
       WHERE id=$1`,
      [id, name, phone, b.imageUrl ?? null, wards, JSON.stringify(points), pkg, months, style]);
    cacheDrop('mapads:'); res.json({ id });
  } catch (e) { next(e); }
});

// DELETE /api/map-ads/:id (admin)
mapAdsRouter.delete('/:id', adminRequired, async (req, res, next) => {
  try {
    const r = await query('DELETE FROM map_ads WHERE id=$1 RETURNING id', [Number(req.params.id)]);
    if (!r.length) return res.status(404).json({ error: 'Không tìm thấy' });
    cacheDrop('mapads:'); res.json({ deleted: r[0].id });
  } catch (e) { next(e); }
});
