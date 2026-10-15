#!/usr/bin/env bash
# ĐƯA 2 LỚP QHSDĐ 2030 TỈNH LÂM ĐỒNG (TP Đà Lạt, huyện Đức Trọng) LÊN WEB THẬT — chuẩn bị 15/10/2026 tối, CHƯA chạy.
# Chủ dự án nháy đúp DUA-LEN-WEB-LAM-DONG.bat ở thư mục gốc (hoặc: bash "D:/Cam Lam gis/scripts/qh-tinh/dua-len-web-lam-dong.sh").
# Chờ ổ C còn TRỐNG ≥ 3 GB mới chạy (ô ảnh ~520 MB chép vào kho Docker nằm trên ổ C + dựng lại phần giao diện) — kịch bản tự kiểm, thiếu
# chỗ thì dừng ngay, không đụng gì. Các bước:
#   [0] kiểm ổ C, giờ (không chạy 2h00–2h15 — máy tự nén kho Docker), đủ ô ảnh ở ổ D
#   [1] chép 2 bộ ô ảnh (D:\KhoQH\tiles-qh\dalat2030v1, ductrong2030v1) vào kho ô ảnh của web — chép sang tên tạm, đếm đủ rồi mới đổi chỗ
#   [2] khai 2 lớp vào trang bản đồ (them_lop_lam_dong.py — chạy lại nhiều lần vẫn an toàn)
#   [3] dựng lại phần giao diện (--no-deps: không đụng máy chủ dữ liệu) + khởi động lại nginx
#   [4] tự kiểm: ô ảnh hai lớp trả 200 qua nginx
# Dừng ngay khi có bước lỗi (set -e) — web cũ vẫn chạy nguyên; chạy lại lệnh là làm tiếp (--tu-buoc=N để bỏ qua bước đã xong).
set -euo pipefail
export MSYS_NO_PATHCONV=1
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) RONG=NUL ;; *) RONG=/dev/null ;; esac
TU=0; for a in "$@"; do case "$a" in --tu-buoc=*) TU="${a#--tu-buoc=}" ;; esac; done
cd "/d/Cam Lam gis" 2>/dev/null || cd "D:/Cam Lam gis"
DC="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
grep -q '^TUNNEL_TOKEN=.' .env 2>/dev/null && DC="$DC -f docker-compose.tunnel.yml"
T="D:/KhoQH/tiles-qh"
BO="dalat2030v1 ductrong2030v1"
ANH="camlamgis-frontend:latest"       # ảnh có sẵn lệnh sh/find để thao tác trong kho ô ảnh

echo "[0/4] Kiểm trước khi làm (luôn kiểm, kể cả khi chạy tiếp từ bước sau)…"
trong_c=$(df -BM /c 2>/dev/null | awk 'NR==2 {gsub("M","",$4); print $4}')
echo "   Ổ C còn trống: ${trong_c:-?} MB"
[ -n "$trong_c" ] && [ "$trong_c" -ge 3072 ] || { echo "DỪNG: ổ C còn dưới 3 GB — bấm 'Nen kho Docker' trên bảng điều khiển rồi chạy lại."; exit 1; }
gio=$(date +%H%M); if [ "$gio" -ge 0200 ] && [ "$gio" -lt 0215 ]; then echo "DỪNG: 2h00–2h15 máy đang tự nén kho Docker — chạy lại sau 2h15."; exit 1; fi
for t in $BO; do [ -d "$T/$t" ] || { echo "LỖI: thiếu bộ ô $T/$t"; exit 1; }; done
if [ "$TU" -le 1 ]; then
# Bộ ô đã có ĐỦ trong kho (đếm khớp ổ D) thì bỏ qua bước chép — 16/10 2h17 bước 1–2 đã xong, chỉ bước dựng giao diện bị máy dừng vì thiếu RAM.
du_ca=1
for t in $BO; do
  n_may=$(find "$T/$t" -type f -name '*.webp' | wc -l)
  n_web=$(docker run --rm -v camlamgis_camlam_tiles:/t "$ANH" sh -c "find /t/$t -type f -name '*.webp' 2>/dev/null | wc -l")
  [ "$n_may" -eq "$n_web" ] || du_ca=0
done
if [ "$du_ca" = 1 ]; then echo "[1/4] Kho ô ảnh đã có đủ 2 bộ ô (đếm khớp ổ D) — bỏ qua bước chép."; TU=2; fi
fi
if [ "$TU" -le 1 ]; then
echo "[1/4] Chép 2 bộ ô ảnh vào kho ô ảnh của web (camlamgis_camlam_tiles)…"
docker rm -f chep_tiles_ld >/dev/null 2>&1 || true
docker create --name chep_tiles_ld -v camlamgis_camlam_tiles:/dest "$ANH" true >/dev/null
for t in $BO; do
  echo "   - $t"
  docker run --rm -v camlamgis_camlam_tiles:/t "$ANH" sh -c "rm -rf /t/$t.moi"
  docker cp "$T/$t" "chep_tiles_ld:/dest/$t.moi"
done
docker rm chep_tiles_ld >/dev/null
for t in $BO; do
  n_may=$(find "$T/$t" -type f -name '*.webp' | wc -l)
  n_web=$(docker run --rm -v camlamgis_camlam_tiles:/t "$ANH" sh -c "find /t/$t.moi -type f -name '*.webp' | wc -l")
  echo "   $t: $n_web / $n_may ô"
  [ "$n_may" -eq "$n_web" ] || { echo "LỖI: chép thiếu ô ở $t — dừng (web cũ vẫn chạy)"; exit 1; }
done
for t in $BO; do docker run --rm -v camlamgis_camlam_tiles:/t "$ANH" sh -c "rm -rf /t/$t && mv /t/$t.moi /t/$t"; done
fi
if [ "$TU" -le 2 ]; then
echo "[2/4] Khai 2 lớp vào trang bản đồ…"
python -P scripts/qh-tinh/them_lop_lam_dong.py
fi
if [ "$TU" -le 3 ]; then
echo "[3/4] Dựng lại phần giao diện (chỉ frontend, --no-deps), xoá đệm nginx (CHỈ thư mục đệm [0-9a-f]) rồi khởi động lại nginx…"
$DC up -d --no-deps --build frontend
docker exec camlam_nginx sh -c 'rm -rf /var/cache/nginx/[0-9a-f]' || true
$DC restart nginx
fi
echo "[4/4] Tự kiểm ô ảnh qua nginx…"
sleep 5
for u in /tiles/dalat2030v1/9/410/238.webp /tiles/ductrong2030v1/9/409/239.webp; do
  m=$(curl -s -o "$RONG" -w "%{http_code}" "http://localhost$u")
  echo "   $u → $m"; [ "$m" = 200 ] || { echo "LỖI: ô ảnh không ra 200"; exit 1; }
done
echo "XONG: trang bản đồ có thêm 'QHSDĐ 2030 · TP Đà Lạt (Lâm Đồng)' và '· Huyện Đức Trọng (Lâm Đồng)' (ô Địa giới chọn Đà Lạt / Đức Trọng)."
echo "Nhớ lưu mã: git add apps/frontend/src/app/map/page.tsx && git commit -m 'Them 2 lop QHSDD 2030 Lam Dong'"
