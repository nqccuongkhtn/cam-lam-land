#!/usr/bin/env bash
# ĐƯA LÊN WEB THẬT (14/10/2026) — MỘT LỆNH làm hết, chủ dự án chạy (hệ thống an toàn không cho trợ lý tự dựng web thật):
#   bash "D:/Cam Lam gis/scripts/qh-tinh/dua-len-web-14-10.sh"
# Gồm:
#   • 7 lớp QHSDĐ 2030 (Ninh Hòa, Nha Trang, Khánh Sơn, Vạn Ninh, Cam Ranh + MỚI Diên Khánh, Khánh Vĩnh): ô ảnh nét gấp đôi
#     (512 điểm, WebP, cắt bằng tiler3.py), thêm mức phóng 17;
#   • lớp QH chi tiết 1/500 Cam Lâm — 9 khu DỰ THẢO lấy ý kiến (nắn lại 14/10, kiểm chéo địa chính + phân khu 1/2000);
#   • tra quy hoạch theo từng thửa cho huyện/thị ngoài Cam Lâm (bóc từ bản đồ PDF của Sở — tham khảo) + nạp Diên Khánh, Khánh Vĩnh;
#   • sửa đăng nhập: email không phân biệt hoa/thường;
#   • XOÁ 5 bộ ô cũ đã được thay (chủ dự án dặn "lớp cắt cũ bị thay thế thì xoá đi cho nhẹ máy").
# Dừng ngay khi có bước lỗi (set -e) — web cũ vẫn chạy nguyên, chạy lại lệnh là làm tiếp.
set -euo pipefail
# Git Bash tự đổi đối số dạng "/dest", "kho:/t" thành đường dẫn Windows (C:/Program Files/Git/dest) → docker cp / -v hỏng. Tắt:
export MSYS_NO_PATHCONV=1
cd "/d/Cam Lam gis" 2>/dev/null || cd "D:/Cam Lam gis"
DC="docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.tunnel.yml"
T="D:/KhoQH/tiles-qh"                 # bộ ô ảnh mới (ổ D)
S="D:/KhoQH/qh-pdf"                   # file nạp dữ liệu quy hoạch theo thửa
MOI="ninhhoa2030v3 nhatrang2030v2 khanhson2030v2 vanninh2030v2 camranh2030v2 dienkhanh2030v2 khanhvinh2030v2 qhct500camlam-v3"
CU="ninhhoa2030v2 nhatrang2030v1 khanhson2030v1 vanninh2030v1 camranh2030v1"
psql_() { $DC exec -T postgis psql -v ON_ERROR_STOP=1 -U camlam -d camlam_gis "$@"; }

echo "[1/7] Chép bộ ô ảnh mới vào kho ô ảnh của web (camlamgis_camlam_tiles)…"
docker rm -f chep_tiles >/dev/null 2>&1 || true
docker create --name chep_tiles -v camlamgis_camlam_tiles:/dest camlamgis-frontend:latest true >/dev/null
for t in $MOI; do
  echo "   - $t"; docker cp "$T/$t" chep_tiles:/dest/
done
docker rm chep_tiles >/dev/null
for t in $MOI; do
  n_may=$(find "$T/$t" -type f | wc -l)
  n_web=$(docker run --rm -v camlamgis_camlam_tiles:/t camlamgis-frontend:latest sh -c "find /t/$t -type f | wc -l")
  echo "   $t: $n_web / $n_may ô"
  [ "$n_may" -eq "$n_web" ] || { echo "LỖI: chép thiếu ô ở $t — dừng (web cũ vẫn chạy)"; exit 1; }
done

echo "[2/7] Nạp dữ liệu quy hoạch theo thửa Diên Khánh + Khánh Vĩnh…"
for f in nap-dienkhanh.sql nap-khanhvinh.sql; do echo "   - $f"; psql_ -q < "$S/$f"; done
psql_ -q < "$S/ten-ma-chu-giai.sql"
psql_ -tA -c "SELECT '   ' || ban || ': ' || count(*) || ' vùng' FROM qh_pdf GROUP BY ban ORDER BY ban;"

echo "[3/7] Dựng lại máy chủ + giao diện (5–10 phút, web chập chờn ~10 giây lúc đổi)…"
$DC up -d --no-deps --build backend frontend
$DC restart nginx
docker exec camlam_nginx sh -c 'rm -rf /var/cache/nginx/[0-9a-f]'      # CHỈ thư mục đệm 0-9a-f (CLAUDE.md: đừng xoá *)

echo "[4/7] Chờ web lên…"
code=000
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/health || true)
  [ "$code" = 200 ] && break; sleep 4
done
echo "   /api/health → $code"; [ "$code" = 200 ] || { echo "LỖI: máy chủ chưa lên — xem: $DC logs --tail 80 backend"; exit 1; }

echo "[5/7] Bật tra quy hoạch theo thửa cho huyện/thị ngoài Cam Lâm (cờ qh_pdf_bat)…"
psql_ -q -c "INSERT INTO app_flags(key) VALUES ('qh_pdf_bat') ON CONFLICT DO NOTHING;"

echo "[6/7] Kiểm thử trên web…"
for t in dienkhanh2030v2 khanhvinh2030v2 qhct500camlam-v3 ninhhoa2030v3; do
  f=$(cd "$T/$t" && find . -type f -name '*.webp' | sort | sed -n '1p' | sed 's|^\./||')
  curl -s -o /dev/null -w "   ô $t/$f → %{http_code} %{content_type}\n" "http://localhost/tiles/$t/$f"
done
# một thửa Diên Khánh (trong ranh bản QH) → phải có trang "Quy hoạch sử dụng đất 2030" (mã pdf-dienkhanh2030)
diem=$(psql_ -tA -c "SELECT ST_X(c) || ',' || ST_Y(c) FROM (SELECT ST_PointOnSurface(d.geom) c FROM dia_chinh d, qh_pdf_ranh r WHERE r.ban = 'dienkhanh2030' AND d.geom && r.geom AND ST_Within(d.geom, r.geom) LIMIT 1) x;")
lng=${diem%,*}; lat=${diem#*,}
if curl -s "http://localhost/api/parcels/at?lng=$lng&lat=$lat" | grep -q 'pdf-dienkhanh2030'; then echo "   thửa Diên Khánh ($lng, $lat): CÓ quy hoạch theo thửa ✓"
else echo "   CẢNH BÁO: thửa Diên Khánh ($lng, $lat) chưa ra quy hoạch theo thửa"; fi

echo "[7/7] Xoá 5 bộ ô cũ đã được thay…"
for t in $CU; do
  docker run --rm -v camlamgis_camlam_tiles:/t camlamgis-frontend:latest sh -c "rm -rf /t/$t" && echo "   - đã xoá $t"
done
docker run --rm -v camlamgis_camlam_tiles:/t camlamgis-frontend:latest sh -c 'du -sh /t; ls /t'
echo "XONG — mở https://batdongsancamlam.dpdns.org/map (điện thoại: tải lại trang 1 lần)."
