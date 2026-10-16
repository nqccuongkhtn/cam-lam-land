#!/usr/bin/env bash
# CẮT Ô ẢNH QHSDĐ 2030 CÁC TỈNH KHÁC vào kho ô ổ D (16/10/2026) — web đọc qua đường /tiles-qg/ (nginx, TILES_QG_DIR).
# Chủ dự án: "cứ để đỡ ở ổ D khi nào còn 2gb thì ngưng" → TRƯỚC MỖI HUYỆN kiểm ổ D còn ≥ 2 GB + dự phòng 300 MB, thiếu là DỪNG.
# Dùng: bash cat_o_ca_nuoc.sh <danh_sach.txt>
#   mỗi dòng: <pdf> <tam_lng> <tam_lat> <ranh.json> <ten_bo_o> [ktt_do]      (dòng bắt đầu bằng # bỏ qua)
#   bộ ô đã có (thư mục <ten_bo_o> tồn tại, có tệp xong.txt) thì bỏ qua → chạy lại bao nhiêu lần cũng được.
# Mức phóng 9–16, ô 512 WebP (tiler3) — ô z16 512 điểm ảnh ≈ độ nét z17 thường; mỗi huyện ~50–150 MB (z17 thêm ~2,5 lần, chưa cắt).
set -u
cd "$(dirname "$0")"
KHO="${KHO_TILES_QG:-D:/KhoQH/tiles-qg}"
NGUONG_MB=$((2048 + 300))
while read -r pdf lng lat ranh ten ktt; do
  [ -z "${pdf:-}" ] && continue; case "$pdf" in \#*) continue ;; esac
  if [ -f "$KHO/$ten/xong.txt" ]; then echo "[$(date +%H:%M)] $ten: da co, bo qua"; continue; fi
  trong=$(df -BM /d 2>/dev/null | awk 'NR==2 {gsub("M","",$4); print $4}')
  if [ -z "$trong" ] || [ "$trong" -lt "$NGUONG_MB" ]; then
    echo "[$(date +%H:%M)] DUNG: o D con ${trong:-?} MB (< ${NGUONG_MB} MB) — chu du an dan con 2 GB thi ngung"; exit 2
  fi
  echo "[$(date +%H:%M)] $ten: bat dau cat (o D con ${trong} MB)"
  rm -rf "$KHO/$ten.tam"
  if VN2000_KTT_DO="${ktt:-108.25}" PYTHONIOENCODING=utf-8 python -P tiler3.py "$pdf" "$lng" "$lat" "$ranh" "$KHO" "$ten.tam" 9 16 --khoi=2 > "$KHO/log-$ten.txt" 2>&1; then
    n=$(find "$KHO/$ten.tam" -type f -name '*.webp' | wc -l)
    rm -rf "$KHO/$ten" && mv "$KHO/$ten.tam" "$KHO/$ten" && echo "$n o · $(date '+%d/%m/%Y %H:%M')" > "$KHO/$ten/xong.txt"
    echo "[$(date +%H:%M)] $ten: XONG $n o, $(du -sm "$KHO/$ten" | cut -f1) MB"
  else
    echo "[$(date +%H:%M)] $ten: LOI — xem $KHO/log-$ten.txt"; tail -3 "$KHO/log-$ten.txt"
  fi
done < "$1"
echo "[$(date +%H:%M)] het danh sach"
