import { Router } from 'express';
import { query } from '../lib/db.ts';

export const parcelsRouter = Router();

// candidate JSONB property keys used by Vietnamese cadastral data
const KEYS_TO = ['so_to', 'SoTo', 'SOTO', 'soto', 'to', 'TO', 'ToBanDo', 'SoToBanDo', 'SHBanDo', 'MaToBanDo'];
const KEYS_THUA = ['so_thua', 'SoThua', 'SOTHUA', 'sothua', 'thua', 'THUA', 'ThuaDat', 'SHThua', 'MaThua'];
const KEYS_XA = ['xa', 'Xa', 'XA', 'TenXa', 'ten_xa', 'Phuong', 'MaXa'];

function keyClause(keys: string[], val: string, params: any[]): string {
  params.push(val);
  const p = `$${params.length}`;
  return '(' + keys.map((k) => `f.properties->>'${k}' = ${p}`).join(' OR ') + ')';
}

// GET /api/parcels/search?soto=&sothua=&xa=  — find cadastral parcels by sheet/parcel no.
parcelsRouter.get('/search', async (req, res, next) => {
  try {
    const { soto, sothua, xa } = req.query as Record<string, string>;
    if (!soto && !sothua) return res.status(400).json({ error: 'Cần ít nhất số tờ hoặc số thửa' });
    const params: any[] = [];
    const where: string[] = [`l.layer_type IN ('parcel','custom','zoning')`];
    if (soto) where.push(keyClause(KEYS_TO, soto, params));
    if (sothua) where.push(keyClause(KEYS_THUA, sothua, params));
    if (xa) where.push(keyClause(KEYS_XA, xa, params));
    const rows = await query(`
      SELECT f.id, f.properties,
             ST_AsGeoJSON(f.geom)::json AS geometry,
             ST_X(ST_Centroid(f.geom)) AS lng, ST_Y(ST_Centroid(f.geom)) AS lat,
             ROUND(ST_Area(f.geom::geography)::numeric, 1) AS area_m2,
             l.name AS layer_name
      FROM gis_features f JOIN gis_layers l ON l.id = f.layer_id
      WHERE ${where.join(' AND ')}
      LIMIT 50`, params);
    res.json({ count: rows.length, parcels: rows });
  } catch (e) { next(e); }
});

// GET /api/parcels/at?lng=&lat=  — parcel + zoning + linked listings at a clicked point
parcelsRouter.get('/at', async (req, res, next) => {
  try {
    const lng = Number(req.query.lng), lat = Number(req.query.lat);
    if (Number.isNaN(lng) || Number.isNaN(lat)) return res.status(400).json({ error: 'lng and lat required' });
    const pt = `ST_SetSRID(ST_MakePoint($1,$2),4326)`;
    const [parcel] = await query(`
      SELECT f.id, f.properties, ST_AsGeoJSON(f.geom)::json AS geometry, l.name AS layer_name
      FROM gis_features f JOIN gis_layers l ON l.id=f.layer_id
      WHERE l.layer_type='parcel' AND ST_Contains(f.geom, ${pt}) LIMIT 1`, [lng, lat]);
    const [zoning] = await query(`
      SELECT f.properties, l.name AS layer_name
      FROM gis_features f JOIN gis_layers l ON l.id=f.layer_id
      WHERE l.layer_type='zoning' AND ST_Contains(f.geom, ${pt}) LIMIT 1`, [lng, lat]);
    const linked = parcel
      ? await query(`SELECT id,title,price,property_type AS "propertyType", ST_X(geom) lng, ST_Y(geom) lat
          FROM listings WHERE status<>'hidden' AND ST_Contains((SELECT geom FROM gis_features WHERE id=$1), geom)`, [parcel.id])
      : await query(`SELECT id,title,price,property_type AS "propertyType", ST_X(geom) lng, ST_Y(geom) lat
          FROM listings WHERE status<>'hidden' AND ST_DWithin(geom::geography, ${pt}::geography, 300)`, [lng, lat]);
    if (!parcel && !zoning && linked.length === 0)
      return res.json({ found: false, point: { lng, lat }, parcel: null, zoning: null, listings: [] });
    res.json({ found: true, point: { lng, lat }, parcel: parcel ?? null, zoning: zoning?.properties ?? null, listings: linked });
  } catch (e) { next(e); }
});
