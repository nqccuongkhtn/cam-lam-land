# -*- coding: utf-8 -*-
# NẠP vùng loại đất bóc từ PDF (boc_loai_dat.py) vào cơ sở dữ liệu → bảng qh_pdf + qh_pdf_ranh (khai ở apps/backend/src/lib/migrate.ts).
# Máy chủ dùng ở lib/qhPdf.ts để tính diện tích từng loại đất trên từng thửa cho các huyện/thị NGOÀI Cam Lâm.
#
# Dùng (in ra câu lệnh SQL, đổ thẳng vào psql):
#   python -P nap_qh_pdf.py <ban> "<tên hiển thị>" <loai-dat.geojson> <ranh.json> "<nguồn>" > nap.sql
#   docker compose exec -T postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 < nap.sql
#   vd: python -P nap_qh_pdf.py camranh2030 "QHSDĐ 2030 · TP Cam Ranh" camranh-loai-dat.geojson nan/ranh-cam-ranh.json "CamRanh2030.pdf (Sở NN&MT)"
# XOÁ SẠCH bản <ban> rồi nạp lại trong MỘT giao dịch → chạy lại nhiều lần vẫn đúng, lỗi giữa chừng thì không mất bản cũ.
# Ghi file bằng xuống dòng LF (psql \copy/COPY gặp CRLF là hỏng — bẫy đã vấp ở CLAUDE.md).
import sys, json
sys.stdout.reconfigure(encoding='utf-8', newline='\n')
from shapely.geometry import shape, MultiPolygon, Polygon
from shapely import to_wkb, set_srid

ban, ten_ban, gj, ranh_path, nguon = sys.argv[1:6]
q = lambda s: "'" + str(s).replace("'", "''") + "'"
w = sys.stdout.write

r = json.load(open(ranh_path, encoding='utf-8'))
r = r.get('geometry', r) if r.get('type') != 'FeatureCollection' else r['features'][0]['geometry']
w('BEGIN;\n')
w(f'DELETE FROM qh_pdf WHERE ban = {q(ban)};\n')
w(f'DELETE FROM qh_pdf_ranh WHERE ban = {q(ban)};\n')
w(f"INSERT INTO qh_pdf_ranh (ban, ten, nguon, geom) VALUES ({q(ban)}, {q(ten_ban)}, {q(nguon)}, "
  f"ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON({q(json.dumps(r))}), 4326)), 3)));\n")
w('COPY qh_pdf (ban, ma, ten, mau, geom) FROM STDIN;\n')
n = 0
for f in json.load(open(gj, encoding='utf-8'))['features']:
    g = shape(f['geometry'])
    if g.is_empty: continue
    mp = g if isinstance(g, MultiPolygon) else MultiPolygon([g]) if isinstance(g, Polygon) else None
    if mp is None: continue
    pr = f['properties']
    hexwkb = to_wkb(set_srid(mp, 4326), hex=True, include_srid=True)
    sach = lambda s: str(s).replace('\\', '/').replace('\t', ' ').replace('\n', ' ')
    w(f"{sach(ban)}\t{sach(pr['ma'])}\t{sach(pr['ten'])}\t{sach(pr.get('mau') or '')}\t{hexwkb}\n"); n += 1
w('\\.\n')
w(f'UPDATE qh_pdf SET geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)) WHERE ban = {q(ban)} AND NOT ST_IsValid(geom);\n')
w(f'DELETE FROM qh_pdf WHERE ban = {q(ban)} AND ST_IsEmpty(geom);\n')
w('COMMIT;\nANALYZE qh_pdf;\nANALYZE qh_pdf_ranh;\n')
w(f"SELECT {q(ban)} AS ban, count(*) AS so_vung, round(sum(ST_Area(geom::geography))::numeric / 1e4) AS ha FROM qh_pdf WHERE ban = {q(ban)};\n")
print(f'-- {n} vung', file=sys.stderr)
