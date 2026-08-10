#!/usr/bin/env bash
# ============================================================================
#  BƯỚC 1 — Convert file QH gốc (DGN/DWG/DXF của QĐ205) → GeoJSON (WGS84)
#  Giữ nguyên "level" (layer CAD) làm thuộc tính để BƯỚC 2 ánh xạ loại đất.
#
#  YÊU CẦU: GDAL (ogr2ogr). Cài 1 trong các cách:
#     - conda:   conda install -c conda-forge gdal
#     - Ubuntu:  sudo apt install gdal-bin
#     - Windows: cài OSGeo4W / QGIS (đã kèm ogr2ogr), hoặc qua conda
#
#  LƯU Ý DGN:
#     - Driver mã nguồn mở chỉ đọc DGN V7. Nếu file là DGN V8 → mở MicroStation
#       và "Save As" ra V7, HOẶC export DXF, rồi chạy script với file đó.
#     - DWG: mở AutoCAD → export DXF (hoặc dùng ODA File Converter) rồi chạy.
#
#  CÁCH DÙNG:
#     ./1-convert-dgn.sh QD205.dgn            # → qd205_raw.geojson
#     ./1-convert-dgn.sh QD205.dxf ra.geojson
# ============================================================================
set -euo pipefail

IN="${1:?Cần file gốc, vd: ./1-convert-dgn.sh QD205.dgn}"
OUT="${2:-qd205_raw.geojson}"

# Hệ toạ độ NGUỒN của bản vẽ: VN-2000, Kinh tuyến trục Khánh Hoà 108°15', múi 3°, k=0.9999
# (7 tham số chuyển đổi VN2000 ↔ WGS84 chính thức)
VN2000_KH='+proj=tmerc +lat_0=0 +lon_0=108.25 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs'

echo "→ Đang convert: $IN"
echo "   Hệ nguồn: VN-2000 KTT 108°15' (Khánh Hoà) → WGS84 (EPSG:4326)"

ogr2ogr -f GeoJSON "$OUT" "$IN" \
  -s_srs "$VN2000_KH" -t_srs EPSG:4326 \
  -nlt PROMOTE_TO_MULTI -skipfailures -lco RFC7946=YES

echo ""
echo "✓ Xong: $OUT"
echo "  → Bước 2: node 2-map-levels.mjs $OUT qd205-levels.json"
echo "  (Chạy bước 2 lần đầu để XEM danh sách level, rồi điền bảng map.)"
