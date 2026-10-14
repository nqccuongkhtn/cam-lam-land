#!/usr/bin/env bash
# ĐƯA LÊN WEB THẬT (14/10/2026, bản tối) — MỘT LỆNH làm hết. Chủ dự án nháy đúp DUA-LEN-WEB-14-10.bat ở thư mục gốc
# (hoặc: bash "D:/Cam Lam gis/scripts/qh-tinh/dua-len-web-14-10.sh"). Gồm:
#   • 7 lớp QHSDĐ 2030 (Ninh Hòa, Nha Trang, Khánh Sơn, Vạn Ninh, Cam Ranh, Diên Khánh, Khánh Vĩnh) CẮT LẠI theo VẠCH LƯỚI THẬT của bản
#     đồ (nan_vach_luoi.py). Bản trước nắn theo TÂM CHỮ số lưới: Nha Trang lệch ~350 m, Khánh Sơn ~105 m, Ninh Hòa ~70 m, Vạn Ninh 30–40 m;
#   • quy hoạch theo từng thửa cho 7 huyện/thị đó — bóc lại theo phép nắn mới + luật nhãn đỏ (boc_loai_dat.py);
#   • QH chi tiết 1/500 CHÍNH THỨC — 6 đồ án, QĐ 2043–2048/QĐ-UBND ngày 25/9/2026 — CHỈ ADMIN XEM: ô ảnh + quyết định nằm ở volume
#     riêng camlamgis_qh_rieng, máy chủ kiểm vé admin từng ô (routes/qhRieng.ts); in thẳng từ MicroStation (in_1_500_dgn.py);
#   • GỠ HẲN 1/500 DỰ THẢO (9 khu lấy ý kiến) khỏi web: bộ ô qhct500camlam-* + 9 thông báo (đã bỏ khỏi mã nguồn);
#   • xoá các bộ ô cũ đã được thay (chủ dự án dặn "lớp cắt cũ bị thay thế thì xoá đi cho nhẹ máy").
# Dừng ngay khi có bước lỗi (set -e) — web cũ vẫn chạy nguyên, chạy lại lệnh là làm tiếp.
set -euo pipefail
# Git Bash tự đổi đối số dạng "/dest", "kho:/t" thành đường dẫn Windows (C:/Program Files/Git/dest) → docker cp / -v hỏng. Tắt:
export MSYS_NO_PATHCONV=1
cd "/d/Cam Lam gis" 2>/dev/null || cd "D:/Cam Lam gis"
DC="docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.tunnel.yml"
T="D:/KhoQH/tiles-qh"                 # bộ ô ảnh 7 lớp QHSDĐ (ổ D)
S="D:/KhoQH/qh-pdf"                   # file nạp quy hoạch theo thửa
R="D:/KhoQH/qh-rieng"                 # lớp CHỈ ADMIN: danh-sach.json + tai-lieu/ + tiles/
MOI="ninhhoa2030v3 nhatrang2030v2 khanhson2030v2 vanninh2030v2 camranh2030v2 dienkhanh2030v2 khanhvinh2030v2"
CU="ninhhoa2030v2 nhatrang2030v1 khanhson2030v1 vanninh2030v1 camranh2030v1 qhct500camlam-v1 qhct500camlam-v2 qhct500camlam-v3"
BAN="nhatrang2030 ninhhoa2030 khanhson2030 vanninh2030 camranh2030 dienkhanh2030 khanhvinh2030"
ANH="camlamgis-frontend:latest"       # ảnh có sẵn lệnh sh/find để thao tác trong volume
psql_() { $DC exec -T postgis psql -v ON_ERROR_STOP=1 -U camlam -d camlam_gis "$@"; }
dem_vol() { docker run --rm -v "$1":/t "$ANH" sh -c "find /t/$2 -type f 2>/dev/null | wc -l"; }

echo "[0/8] Kiểm đủ file trước khi làm…"
for t in $MOI; do [ -d "$T/$t" ] || { echo "LỖI: thiếu bộ ô $T/$t"; exit 1; }; done
for b in $BAN; do [ -s "$S/nap-$b.sql" ] || { echo "LỖI: thiếu file nạp $S/nap-$b.sql"; exit 1; }; done
[ -s "$R/danh-sach.json" ] && [ -d "$R/tiles/qhct500-v1" ] && [ -d "$R/tai-lieu" ] || { echo "LỖI: thiếu dữ liệu lớp riêng ở $R"; exit 1; }

echo "[1/8] Chép 7 bộ ô ảnh mới vào kho ô ảnh của web (camlamgis_camlam_tiles) — chép sang tên tạm rồi mới đổi chỗ…"
docker rm -f chep_tiles >/dev/null 2>&1 || true
docker create --name chep_tiles -v camlamgis_camlam_tiles:/dest "$ANH" true >/dev/null
for t in $MOI; do
  echo "   - $t"
  docker run --rm -v camlamgis_camlam_tiles:/t "$ANH" sh -c "rm -rf /t/$t.moi"
  docker cp "$T/$t" "chep_tiles:/dest/$t.moi"
done
docker rm chep_tiles >/dev/null
for t in $MOI; do
  n_may=$(find "$T/$t" -type f -name '*.webp' | wc -l)
  n_web=$(docker run --rm -v camlamgis_camlam_tiles:/t "$ANH" sh -c "find /t/$t.moi -type f -name '*.webp' | wc -l")
  echo "   $t: $n_web / $n_may ô"
  [ "$n_may" -eq "$n_web" ] || { echo "LỖI: chép thiếu ô ở $t — dừng (web cũ vẫn chạy)"; exit 1; }
done
# đổi chỗ: bộ cũ cùng tên (nếu đã đưa lên trước đây theo phép nắn cũ) bị thay HẲN, không còn ô cũ lẫn vào
for t in $MOI; do docker run --rm -v camlamgis_camlam_tiles:/t "$ANH" sh -c "rm -rf /t/$t && mv /t/$t.moi /t/$t"; done

echo "[2/8] Nạp quy hoạch theo thửa 7 huyện/thị (bóc lại theo phép nắn mới)…"
for b in $BAN; do echo "   - $b"; psql_ -q < "$S/nap-$b.sql"; done
psql_ -q < "$S/ten-ma-chu-giai.sql"
psql_ -tA -c "SELECT '   ' || ban || ': ' || count(*) || ' vùng' FROM qh_pdf GROUP BY ban ORDER BY ban;"

echo "[3/8] Dựng lại máy chủ + giao diện (5–10 phút, web chập chờn ~10 giây lúc đổi)…"
$DC up -d --no-deps --build backend frontend
$DC restart nginx
docker exec camlam_nginx sh -c 'rm -rf /var/cache/nginx/[0-9a-f]'      # CHỈ thư mục đệm 0-9a-f (CLAUDE.md: đừng xoá *)

echo "[4/8] Chờ web lên…"
code=000
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/health || true)
  [ "$code" = 200 ] && break; sleep 4
done
echo "   /api/health → $code"; [ "$code" = 200 ] || { echo "LỖI: máy chủ chưa lên — xem: $DC logs --tail 80 backend"; exit 1; }

echo "[5/8] Chép lớp 1/500 CHÍNH THỨC (chỉ admin) vào volume riêng camlamgis_qh_rieng…"
docker rm -f chep_rieng >/dev/null 2>&1 || true
docker create --name chep_rieng -v camlamgis_qh_rieng:/dest "$ANH" true >/dev/null
docker run --rm -v camlamgis_qh_rieng:/t "$ANH" sh -c "mkdir -p /t/tiles /t/tai-lieu && rm -rf /t/tiles/qhct500-v1.moi"
docker cp "$R/danh-sach.json" chep_rieng:/dest/danh-sach.json
for f in "$R"/tai-lieu/*.pdf; do docker cp "$f" "chep_rieng:/dest/tai-lieu/$(basename "$f")"; done
docker cp "$R/tiles/qhct500-v1" chep_rieng:/dest/tiles/qhct500-v1.moi
docker rm chep_rieng >/dev/null
n_may=$(find "$R/tiles/qhct500-v1" -type f -name '*.webp' | wc -l); n_web=$(dem_vol camlamgis_qh_rieng tiles/qhct500-v1.moi)
echo "   qhct500-v1: $n_web / $n_may ô"
[ "$n_may" -eq "$n_web" ] || { echo "LỖI: chép thiếu ô lớp 1/500 — dừng"; exit 1; }
docker run --rm -v camlamgis_qh_rieng:/t "$ANH" sh -c "rm -rf /t/tiles/qhct500-v1 && mv /t/tiles/qhct500-v1.moi /t/tiles/qhct500-v1 && ls /t /t/tai-lieu"

echo "[6/8] Bật tra quy hoạch theo thửa cho huyện/thị ngoài Cam Lâm (cờ qh_pdf_bat)…"
psql_ -q -c "INSERT INTO app_flags(key) VALUES ('qh_pdf_bat') ON CONFLICT DO NOTHING;"

echo "[7/8] Kiểm thử trên web…"
for t in $MOI; do
  f=$(cd "$T/$t" && find . -type f -name '*.webp' | sort | sed -n '1p' | sed 's|^\./||')
  curl -s -o /dev/null -w "   ô $t/$f → %{http_code} %{content_type}\n" "http://localhost/tiles/$t/$f"
done
# lớp riêng: KHÔNG đăng nhập phải bị chặn; vé giả phải bị chặn; ô không được nằm ở /tiles/ công khai
c1=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/qh-rieng/ve)
f=$(cd "$R/tiles/qhct500-v1" && find . -type f -name '*.webp' | sort | sed -n '1p' | sed 's|^\./||; s|\.webp$||')
c2=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/qh-rieng/o/qhct500-v1/$f?v=1.1.ve-gia")
c3=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/tiles/qhct500-v1/$f.webp")
echo "   1/500 chỉ admin: xin vé khi chưa đăng nhập → $c1 (phải 401) · ô với vé giả → $c2 (phải 403) · tìm ở /tiles/ công khai → $c3 (phải 404)"
[ "$c1" = 401 ] && [ "$c2" = 403 ] && [ "$c3" = 404 ] || { echo "LỖI: lớp 1/500 KHÔNG được chặn đúng — kiểm tra lại trước khi dùng"; exit 1; }
# một thửa Diên Khánh (trong ranh bản QH) → phải có trang "Quy hoạch sử dụng đất 2030" (mã pdf-dienkhanh2030)
diem=$(psql_ -tA -c "SELECT ST_X(c) || ',' || ST_Y(c) FROM (SELECT ST_PointOnSurface(d.geom) c FROM dia_chinh d, qh_pdf_ranh r WHERE r.ban = 'dienkhanh2030' AND d.geom && r.geom AND ST_Within(d.geom, r.geom) LIMIT 1) x;")
lng=${diem%,*}; lat=${diem#*,}
if curl -s "http://localhost/api/parcels/at?lng=$lng&lat=$lat" | grep -q 'pdf-dienkhanh2030'; then echo "   thửa Diên Khánh ($lng, $lat): CÓ quy hoạch theo thửa ✓"
else echo "   CẢNH BÁO: thửa Diên Khánh ($lng, $lat) chưa ra quy hoạch theo thửa"; fi

echo "[8/8] Xoá các bộ ô cũ đã được thay + 1/500 dự thảo…"
for t in $CU; do
  docker run --rm -v camlamgis_camlam_tiles:/t "$ANH" sh -c "[ -e /t/$t ] && rm -rf /t/$t && echo '   - đã xoá $t' || true"
done
docker run --rm -v camlamgis_camlam_tiles:/t "$ANH" sh -c 'du -sh /t; ls /t'
echo "XONG — mở https://batdongsancamlam.dpdns.org/map (điện thoại: tải lại trang 1 lần). Lớp 1/500 chỉ hiện khi đăng nhập tài khoản admin."
