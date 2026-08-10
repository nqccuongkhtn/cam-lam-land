-- ══════════════════════════════════════════════════════════════════════════
-- SEED DỮ LIỆU ĐO TẢI — sinh N tin đăng NGẪU NHIÊN để kiểm tra hiệu năng/chịu tải.
-- ⚠ CHỈ chạy trên DB thử nghiệm/staging (KHÔNG chạy trên DB thật có dữ liệu quan trọng).
--
-- Chạy (mặc định 5000 tin):
--   docker compose exec -T postgis psql -U camlam -d camlam_gis -f - < db/seed-load.sql
-- Chạy số lượng khác (vd 20000):
--   docker compose exec -T postgis psql -U camlam -d camlam_gis -v n=20000 -f - < db/seed-load.sql
--
-- Xoá sạch dữ liệu đo tải sau khi xong:
--   docker compose exec -T postgis psql -U camlam -d camlam_gis -c "DELETE FROM listings WHERE title LIKE '%LOADTEST%';"
-- ══════════════════════════════════════════════════════════════════════════
\if :{?n}
\else
  \set n 5000
\endif

INSERT INTO listings
  (title, description, price, area, property_type, address, ward, bedrooms, bathrooms,
   deal, status, tier, verified, boosted, images, geom, contact_name, contact_phone, created_at)
SELECT
  'Bán ' || ptxt || ' ' || ward_v || ' ' || area_v::int || 'm² - LOADTEST #' || g,
  'Tin sinh tự động để ĐO TẢI hệ thống Cam Lâm Land. Vị trí ' || ward_v || ', Cam Lâm, Khánh Hòa; pháp lý rõ ràng.',
  price_v, area_v, ptype,
  'Thôn ' || (1 + (g % 9)) || ', xã ' || ward_v || ', Cam Lâm, Khánh Hòa', ward_v,
  (1 + (g % 5)), (1 + (g % 4)),
  CASE WHEN random() < 0.85 THEN 'sale' ELSE 'rent' END,
  'active', tier_v, random() < 0.2, random() < 0.15,
  ARRAY['https://picsum.photos/seed/lt' || g || '/800/600', 'https://picsum.photos/seed/lt' || g || 'b/800/600'],
  ST_SetSRID(ST_MakePoint(109.03 + random() * 0.20, 11.90 + random() * 0.18), 4326),
  (ARRAY['Nguyễn Văn An','Trần Thị Bình','Lê Hoàng Cường','Phạm Thị Dung'])[1 + floor(random() * 4)::int],
  '09' || lpad(floor(random() * 100000000)::bigint::text, 8, '0'),
  now() - (floor(random() * 180) || ' days')::interval
FROM generate_series(1, :n) AS g
CROSS JOIN LATERAL (
  SELECT
    (ARRAY['land','house','apartment','villa','commercial','farm'])[1 + floor(random() * 6)::int] AS ptype,
    (ARRAY['Cam Lâm','Suối Dầu','Cam Hiệp','Cam An','Cam Đức','Cam Hải Đông','Cam Hải Tây','Cam Thành Bắc','Cam Hòa','Cam Tân','Cam Hiệp Bắc','Cam An Bắc'])[1 + floor(random() * 12)::int] AS ward_v,
    (ARRAY['normal','normal','normal','normal','normal','silver','gold','diamond'])[1 + floor(random() * 8)::int] AS tier_v,
    round((random() * 49 + 0.3)::numeric * 1e9, 0) AS price_v,
    round((random() * 300 + 40)::numeric, 1) AS area_v
) r
CROSS JOIN LATERAL (
  SELECT CASE ptype
    WHEN 'land' THEN 'đất nền' WHEN 'house' THEN 'nhà phố' WHEN 'apartment' THEN 'căn hộ'
    WHEN 'villa' THEN 'biệt thự' WHEN 'commercial' THEN 'mặt bằng kinh doanh' ELSE 'đất vườn' END AS ptxt
) p;

ANALYZE listings;
\echo '✔ Đã seed' :n 'tin LOADTEST. Xoá bằng: DELETE FROM listings WHERE title LIKE ''%LOADTEST%'';'
