-- ============================================================================
-- CHIA THỬA CỦA XÃ CAM TÂN + XÃ CAM AN BẮC CHO ĐÚNG XÃ MỚI (13/10/2026)
--
-- Nghị quyết 1667/NQ-UBTVQH15 (khoản 18–21) ghi hai xã này chỉ nhập MỘT PHẦN:
--   · xã Cam Tân (22435)    → Xã Cam Lâm (22453), Xã Suối Dầu (22708), Xã Cam Hiệp (22435, kế thừa mã)
--   · xã Cam An Bắc (22465) → Xã Cam Lâm (22453), Xã Cam An (22465, kế thừa mã)
-- Nhưng xa-moi.json từng coi hai mã này là xã mới nguyên vẹn (cap2) → thửa nằm trên TỜ BỊ RANH CẮT vẫn mang xã mới cũ
-- (316 thửa Cam Tân trên tờ mà bảng số tờ chỉ cho Cam Lâm / Suối Dầu vẫn ghi Cam Hiệp — sai chắc chắn).
-- (Tờ chỉ thuộc MỘT xã mới thì nap-bang-so-to.mjs đã tự gán đúng từ trước.)
--
-- Cách chia — y như 6 xã bị chia khác (CLAUDE.md "6 xã bị CHIA"): thửa trên tờ bị cắt lấy xã mới của thửa "chắc chắn" GẦN NHẤT,
-- và CHỈ trong các xã mới mà bảng số tờ chính thức cho phép với đúng tờ đó. Đây là ước lượng theo vị trí (văn bản không ghi ranh).
-- Giá trị cũ lưu ở dia_chinh_xa_moi_sao_luu → lui lại được:
--   UPDATE dia_chinh d SET xa_moi_id = s.xa_moi_id FROM dia_chinh_xa_moi_sao_luu s WHERE s.id = d.id;
-- NẠP LẠI dữ liệu địa chính (nap-tat-ca.sh) thì chạy lại file này SAU nap-bang-so-to.mjs:
--   docker compose exec -T postgis psql -U camlam -d camlam_gis < scripts/dia-chinh/chia-thua-to-bi-cat.sql
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS dia_chinh_xa_moi_sao_luu (id bigint PRIMARY KEY, xa_moi_id text, ly_do text, luc timestamptz DEFAULT now());

CREATE TEMP TABLE can_xet ON COMMIT DROP AS
SELECT d.id, d.geom, d.xa_moi_id AS cu, t.ds
FROM dia_chinh d
JOIN (SELECT xa_cu_id, to_cu, array_agg(DISTINCT xa_moi_id) AS ds
      FROM dia_chinh_to WHERE xa_cu_id IN ('22435', '22465') GROUP BY 1, 2) t
  ON t.xa_cu_id = d.xa_id AND t.to_cu = d.to_num
WHERE d.xa_id IN ('22435', '22465') AND cardinality(t.ds) >= 2;
CREATE INDEX ON can_xet (id);
ANALYZE can_xet;

INSERT INTO dia_chinh_xa_moi_sao_luu (id, xa_moi_id, ly_do)
SELECT id, cu, 'NQ 1667: xã Cam Tân / Cam An Bắc bị chia — tờ bị ranh cắt (13/10/2026)' FROM can_xet
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE kq ON COMMIT DROP AS
SELECT c.id, c.cu,
       (SELECT q.xa_moi_id FROM dia_chinh q
        WHERE q.xa_moi_id = ANY (c.ds) AND NOT EXISTS (SELECT 1 FROM can_xet z WHERE z.id = q.id)
        ORDER BY q.geom <-> c.geom LIMIT 1) AS moi
FROM can_xet c;

SELECT 'truoc → sau' AS doi, cu, moi, count(*) FROM kq GROUP BY 2, 3 ORDER BY 2, 3;

UPDATE dia_chinh d SET xa_moi_id = k.moi
FROM kq k WHERE k.id = d.id AND k.moi IS NOT NULL AND d.xa_moi_id IS DISTINCT FROM k.moi;

-- Số thửa + khung bao của 4 xã mới liên quan (cách đếm "xã mới = mọi thửa nay thuộc xã đó", như dung-danh-muc.mjs)
UPDATE dia_chinh_xa x SET so_thua = s.n,
       minx = ST_XMin(s.bb), miny = ST_YMin(s.bb), maxx = ST_XMax(s.bb), maxy = ST_YMax(s.bb),
       cx = (ST_XMin(s.bb) + ST_XMax(s.bb)) / 2, cy = (ST_YMin(s.bb) + ST_YMax(s.bb)) / 2, updated_at = now()
FROM (SELECT xa_moi_id AS k, count(*)::int AS n, ST_Extent(geom)::geometry AS bb
      FROM dia_chinh WHERE xa_moi_id IN ('22435', '22453', '22708', '22465')
        AND geom && ST_MakeEnvelope(108.0, 11.0, 109.8, 13.2, 4326)
      GROUP BY xa_moi_id) s
WHERE x.xa_id = s.k AND x.cap = 2;

COMMIT;
