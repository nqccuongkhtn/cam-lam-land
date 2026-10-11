#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NẠP TOÀN BỘ BẢN ĐỒ ĐỊA CHÍNH TỈNH KHÁNH HOÀ VÀO DATABASE
# ─────────────────────────────────────────────────────────────────────────────
# Chạy:  bash scripts/dia-chinh/nap-tat-ca.sh "D:/Cam Lam gis/gis khanh hoa"
#
# Làm gì: duyệt lần lượt từng file .geojson trong thư mục, đổ vào bảng tạm dc_nap,
# rồi chuyển sang bảng thật dia_chinh (có nắn lại hình cho hợp lệ).
# Chạy lại nhiều lần vẫn an toàn: nạp xã nào thì xoá sạch xã đó trước rồi nạp mới,
# nên KHÔNG bao giờ bị nhân đôi dữ liệu.
# Script này chỉ ĐỌC thư mục dữ liệu, không sửa/xoá file gốc.
set -u

THU_MUC="${1:-D:/Cam Lam gis/gis khanh hoa}"
GOC="$(cd "$(dirname "$0")/../.." && pwd)"

psql_ct() { docker compose -f "$GOC/docker-compose.yml" exec -T postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 "$@"; }

echo "== Thư mục dữ liệu: $THU_MUC"
if [ ! -d "$THU_MUC" ]; then echo "!! Không thấy thư mục"; exit 1; fi

# Tháo chỉ mục ra cho nạp nhanh (nạp xong dựng lại) — dựng chỉ mục 1 lần nhanh hơn
# nhiều so với vừa nạp vừa cập nhật chỉ mục cho từng thửa một.
echo "== Tháo chỉ mục cho nạp nhanh"
psql_ct -c "DROP INDEX IF EXISTS dia_chinh_geom_gix; DROP INDEX IF EXISTS dia_chinh_tim_idx; DROP INDEX IF EXISTS dia_chinh_to_thua_idx; DROP INDEX IF EXISTS dia_chinh_xa_moi_thua_idx;" >/dev/null

CHUYEN_SQL="
INSERT INTO dia_chinh (xa_id, cap, so_to, so_thua, to_num, thua_num, dien_tich, mdsd, geom)
SELECT xa_id, cap, so_to, so_thua,
       NULLIF(left(regexp_replace(coalesce(so_to,''),   '[^0-9]', '', 'g'), 9), '')::int,
       NULLIF(left(regexp_replace(coalesce(so_thua,''), '[^0-9]', '', 'g'), 9), '')::int,
       dien_tich, NULLIF(mdsd,''), g
FROM (
  SELECT xa_id, cap, so_to, so_thua, dien_tich, mdsd,
         ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(hinh),4326)),3)) AS g
  FROM dc_nap WHERE hinh IS NOT NULL AND hinh <> ''
) t
WHERE g IS NOT NULL AND NOT ST_IsEmpty(g);
TRUNCATE dc_nap;
"

STT=0
TONG_FILE=$(ls -1 "$THU_MUC"/*.geojson 2>/dev/null | wc -l)
echo "== Tổng cộng $TONG_FILE file"

for F in "$THU_MUC"/*.geojson; do
  STT=$((STT+1))
  TEN=$(basename "$F")
  MA_XA="${TEN##*_}"; MA_XA="${MA_XA%.geojson}"
  printf "[%3d/%3d] %-40s mã %s ... " "$STT" "$TONG_FILE" "${TEN:0:40}" "$MA_XA"

  # Xoá dữ liệu cũ của đúng xã này (nếu có) rồi nạp lại -> chạy lại không sợ trùng
  psql_ct -c "DELETE FROM dia_chinh WHERE xa_id = '$MA_XA'; TRUNCATE dc_nap;" >/dev/null 2>&1

  if ! node "$GOC/scripts/dia-chinh/doc-1-file.mjs" "$F" 2>/dev/null \
       | psql_ct -c "\copy dc_nap FROM STDIN WITH (FORMAT csv)" >/dev/null 2>&1; then
    echo "LỖI đọc/đổ dữ liệu"; continue
  fi

  SO=$(psql_ct -tAc "$CHUYEN_SQL SELECT count(*) FROM dia_chinh WHERE xa_id='$MA_XA';" 2>/dev/null | tail -1)
  echo "${SO:-?} thửa"
done

echo "== Dựng lại chỉ mục (bước này lâu vài phút, đừng tắt)"
psql_ct -c "CREATE INDEX IF NOT EXISTS dia_chinh_geom_gix   ON dia_chinh USING GIST (geom);" >/dev/null
psql_ct -c "CREATE INDEX IF NOT EXISTS dia_chinh_tim_idx    ON dia_chinh (xa_id, to_num, thua_num);" >/dev/null
psql_ct -c "CREATE INDEX IF NOT EXISTS dia_chinh_to_thua_idx ON dia_chinh (to_num, thua_num);" >/dev/null
# Tra "xã mới + số thửa" (không gõ số tờ) — xem migrate.ts (11/10/2026). Cột xa_moi_id do bước sau điền, chỉ mục tự cập nhật theo.
psql_ct -c "CREATE INDEX IF NOT EXISTS dia_chinh_xa_moi_thua_idx ON dia_chinh (xa_moi_id, thua_num);" >/dev/null
psql_ct -c "ANALYZE dia_chinh;" >/dev/null

echo "== Xong. Tổng số thửa trong database:"
psql_ct -c "SELECT count(*) AS tong_thua, count(DISTINCT xa_id) AS so_xa FROM dia_chinh;"
