#!/bin/bash
# Script chay TRONG container GDAL (ghcr.io/osgeo/gdal)
set +e

PGCONN="PG:host=db port=5432 dbname=bds_platform user=bds password=bds_secret"
DGN_DIR="/dgn"

echo "================================"
echo " BAT DAU CONVERT DGN"
echo "================================"
echo ""
echo "Cac file trong $DGN_DIR:"
ls -la $DGN_DIR/*.dgn 2>/dev/null
echo ""

# Tao bang raw truoc bang ogrinfo (qua PostgreSQL)
echo "=== QUY HOACH ==="
for f in "$DGN_DIR"/QD*.dgn "$DGN_DIR"/qd*.dgn; do
  if [ -f "$f" ]; then
    echo ">>> Converting: $(basename "$f")"
    ogr2ogr -f PostgreSQL "$PGCONN" "$f" \
      -nln quy_hoach_raw \
      -t_srs EPSG:4326 -s_srs EPSG:3148 \
      -skipfailures -append -nlt MULTIPOLYGON \
      --config OGR_ORGANIZE_POLYGONS DEFAULT 2>&1 | grep -iE "error|fail|feature" | head -3
    echo "    done"
  fi
done

echo ""
echo "=== DIA CHINH ==="
for f in "$DGN_DIR"/dc*.dgn "$DGN_DIR"/DC*.dgn; do
  if [ -f "$f" ]; then
    echo ">>> Converting: $(basename "$f")"
    ogr2ogr -f PostgreSQL "$PGCONN" "$f" \
      -nln dia_chinh_raw \
      -t_srs EPSG:4326 -s_srs EPSG:3148 \
      -skipfailures -append -nlt MULTIPOLYGON 2>&1 | grep -iE "error|fail|feature" | head -3
    echo "    done"
  fi
done

echo ""
echo "=== KIEM TRA KET QUA ==="
ogrinfo -ro -so "$PGCONN" quy_hoach_raw 2>/dev/null | grep -i "feature count" || echo "quy_hoach_raw: CHUA CO DATA"
ogrinfo -ro -so "$PGCONN" dia_chinh_raw 2>/dev/null | grep -i "feature count" || echo "dia_chinh_raw: CHUA CO DATA"

echo ""
echo "================================"
echo " CONVERT XONG!"
echo "================================"
