import { Router } from 'express';
import { query } from '../lib/db.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';

export const listingsRouter = Router();

const SELECT = `
  SELECT id, title, description, price, area, property_type AS "propertyType",
         address, ward, bedrooms, status, images,
         ST_X(geom) AS lng, ST_Y(geom) AS lat, created_at AS "createdAt"
  FROM listings`;

// GET /api/listings — filters: minPrice,maxPrice,propertyType,ward,q,bbox,limit,offset
listingsRouter.get('/', async (req, res, next) => {
  try {
    const { minPrice, maxPrice, propertyType, ward, q, bbox } = req.query as Record<string, string>;
    const where: string[] = [`status <> 'hidden'`];
    const params: any[] = [];
    const p = (v: any) => { params.push(v); return `$${params.length}`; };

    if (minPrice)     where.push(`price >= ${p(Number(minPrice))}`);
    if (maxPrice)     where.push(`price <= ${p(Number(maxPrice))}`);
    if (propertyType) where.push(`property_type = ${p(propertyType)}`);
    if (ward)         where.push(`ward = ${p(ward)}`);
    if (q) { const t = p(`%${q}%`); where.push(`(title ILIKE ${t} OR description ILIKE ${t})`); }
    if (bbox) {
      const [w, s, e, n] = bbox.split(',').map(Number);
      where.push(`geom && ST_MakeEnvelope(${p(w)},${p(s)},${p(e)},${p(n)},4326)`);
    }
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const offset = Number(req.query.offset ?? 0);
    const rows = await query(
      `${SELECT} WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params);
    res.json({ count: rows.length, listings: rows });
  } catch (e) { next(e); }
});

// GET /api/listings/geojson — as a GeoJSON FeatureCollection (for map markers)
listingsRouter.get('/geojson', async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT json_build_object(
        'type','Feature',
        'geometry', ST_AsGeoJSON(geom)::json,
        'properties', json_build_object('id',id,'title',title,'price',price,
          'propertyType',property_type,'area',area,'ward',ward)
      ) AS feature
      FROM listings WHERE status <> 'hidden'`);
    res.json({ type: 'FeatureCollection', features: rows.map((r: any) => r.feature) });
  } catch (e) { next(e); }
});

listingsRouter.get('/:id', async (req, res, next) => {
  try {
    const [row] = await query(`${SELECT} WHERE id=$1`, [Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'Listing not found' });
    res.json(row);
  } catch (e) { next(e); }
});

listingsRouter.post('/', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.title || b.price == null || b.lng == null || b.lat == null)
      return res.status(400).json({ error: 'title, price, lng, lat are required' });
    const [row] = await query(
      `INSERT INTO listings (title,description,price,area,property_type,address,ward,bedrooms,images,geom,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, ST_SetSRID(ST_MakePoint($10,$11),4326), $12)
       RETURNING id`,
      [b.title, b.description ?? null, b.price, b.area ?? null, b.propertyType ?? 'land',
       b.address ?? null, b.ward ?? null, b.bedrooms ?? null, b.images ?? [], b.lng, b.lat, req.user!.id]);
    const [created] = await query(`${SELECT} WHERE id=$1`, [row.id]);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

listingsRouter.put('/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const [row] = await query(
      `UPDATE listings SET
         title=COALESCE($2,title), description=COALESCE($3,description),
         price=COALESCE($4,price), area=COALESCE($5,area),
         property_type=COALESCE($6,property_type), address=COALESCE($7,address),
         ward=COALESCE($8,ward), bedrooms=COALESCE($9,bedrooms),
         status=COALESCE($10,status), images=COALESCE($11,images),
         geom=CASE WHEN $12::float8 IS NULL THEN geom ELSE ST_SetSRID(ST_MakePoint($12,$13),4326) END
       WHERE id=$1 RETURNING id`,
      [id, b.title ?? null, b.description ?? null, b.price ?? null, b.area ?? null,
       b.propertyType ?? null, b.address ?? null, b.ward ?? null, b.bedrooms ?? null,
       b.status ?? null, b.images ?? null, b.lng ?? null, b.lat ?? null]);
    if (!row) return res.status(404).json({ error: 'Listing not found' });
    const [updated] = await query(`${SELECT} WHERE id=$1`, [id]);
    res.json(updated);
  } catch (e) { next(e); }
});

listingsRouter.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const r = await query('DELETE FROM listings WHERE id=$1 RETURNING id', [Number(req.params.id)]);
    if (!r.length) return res.status(404).json({ error: 'Listing not found' });
    res.json({ deleted: r[0].id });
  } catch (e) { next(e); }
});
