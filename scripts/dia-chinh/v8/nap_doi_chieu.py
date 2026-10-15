# -*- coding: utf-8 -*-
# GỘP kết quả doc_thua_v8.py (có thể chạy chia nhiều phần song song) + TẠO FILE NẠP bảng RIÊNG dia_chinh_v8 (15/10/2026).
# Bảng này chỉ để admin xem ĐỐI CHIẾU trên bản đồ (routes/qhRieng.ts /dc-v8) — KHÔNG đụng bảng dia_chinh (chủ dự án: "vẫn giữ cái cũ
# lại, tôi đối chiếu đã, đừng bỏ hẳn"). File nạp XOÁ SẠCH bảng riêng rồi nạp lại → chạy lại nhiều lần vẫn an toàn.
# Dùng: python -P nap_doi_chieu.py <thu_muc_gop_ra> <thu_muc_ket_qua_1> [<thu_muc_ket_qua_2> ...]
#   → <gop>/geojson/*.geojson (đúng khuôn file hệ thống) · doi-chieu.csv · chua-dung-duoc.csv · tong-hop.json · nap-doi-chieu.sql
#   Nạp: docker compose exec -T postgis psql -U camlam -d camlam_gis < <gop>/nap-doi-chieu.sql
import sys, os, re, json, csv, collections
import shapely
from shapely.geometry import shape, MultiPolygon
sys.stdout.reconfigure(encoding='utf-8')
gop, vao = sys.argv[1], sys.argv[2:]
os.makedirs(os.path.join(gop, 'geojson'), exist_ok=True)

# LƯỚI AN TOÀN (15/10/2026 tối): cột loại đất chỉ được là MÃ (chữ HOA không dấu, số, + . , / -). Bản đầu ghi nhầm 270 tên chủ sử dụng
# (dòng tên trong ô nhãn) vào cột này — doc_thua_v8.py đã sửa tận gốc; ở đây chặn thêm lần nữa: chữ thường / ký tự có dấu ⇒ bỏ trống.
la_ma = lambda v: not v or (len(v) <= 12 and re.fullmatch(r'[A-Z0-9]+([+.,/-][A-Z0-9]+)*', v) is not None)
bo_ma = 0

# ── gộp GeoJSON theo xã cũ (giữ đúng tên file hệ thống) ──
theo_tep = collections.defaultdict(list); ten_fc = {}
for d in vao:
    gd = os.path.join(d, 'geojson')
    for f in sorted(os.listdir(gd)) if os.path.isdir(gd) else []:
        fc = json.load(open(os.path.join(gd, f), encoding='utf-8'))
        for ft in fc['features']:
            if not la_ma(ft['properties'].get('mucDichSuDung')): ft['properties']['mucDichSuDung'] = ''; bo_ma += 1
        theo_tep[f].extend(fc['features']); ten_fc[f] = fc.get('name', '')
for f, fs in theo_tep.items():
    fs.sort(key=lambda ft: (int(ft['properties']['to']), ft['properties']['thua']))
    p = os.path.join(gop, 'geojson', f)
    with open(p + '.tmp', 'w', encoding='utf-8', newline='\n') as fo:
        json.dump({'type': 'FeatureCollection', 'name': ten_fc[f], 'crs': {'type': 'name', 'properties': {'name': 'urn:ogc:def:crs:OGC:1.3:CRS84'}},
                   'features': fs}, fo, ensure_ascii=False)
    os.replace(p + '.tmp', p); print('gop', f, len(fs), 'thua')

# ── gộp bảng đối chiếu / chưa dựng / tổng hợp ──
for ten in ('doi-chieu.csv', 'chua-dung-duoc.csv'):
    dau = None; dong = []
    for d in vao:
        p = os.path.join(d, ten)
        if not os.path.exists(p): continue
        r = list(csv.reader(open(p, encoding='utf-8-sig')))
        if r:
            dau = r[0]; c = dau.index('loai_dat_ban_ve') if 'loai_dat_ban_ve' in dau else -1
            for x in r[1:]:
                if c >= 0 and c < len(x) and not la_ma(x[c]): x[c] = ''; bo_ma += 1
            dong.extend(r[1:])
    dong.sort(key=lambda x: (int(x[0]) if x and x[0].isdigit() else 0))
    with open(os.path.join(gop, ten), 'w', encoding='utf-8-sig', newline='') as fo:
        w = csv.writer(fo); w.writerow(dau or []); w.writerows(dong)
tong = []
for d in vao:
    p = os.path.join(d, 'tong-hop.json')
    if os.path.exists(p): tong.extend(json.load(open(p, encoding='utf-8')))
tong.sort(key=lambda t: t['toMoi'])
json.dump(tong, open(os.path.join(gop, 'tong-hop.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ── file nạp bảng dia_chinh_v8 (COPY dạng chữ: tab ngăn cột, \N = rỗng; xuống dòng KIỂU UNIX — CRLF làm psql từ chối) ──
def o(v):
    if v is None or v == '': return '\\N'
    if isinstance(v, bool): return 't' if v else 'f'
    return str(v).replace('\\', '\\\\').replace('\t', '\\t').replace('\n', '\\n').replace('\r', '\\r')
COT = 'xa_id, so_to, so_thua, to_moi, mdsd, dien_tich, dien_tich_hinh, doi_chieu, lech_hinh, dich_x, dich_y, dien_tich_web, id_web, khop_nhan, bo_net, nguon, geom'
n = 0
with open(os.path.join(gop, 'nap-doi-chieu.sql.tmp'), 'w', encoding='utf-8', newline='\n') as fo:
    fo.write('\\set ON_ERROR_STOP on\nBEGIN;\n')
    fo.write("""CREATE TABLE IF NOT EXISTS dia_chinh_v8 (
  id SERIAL PRIMARY KEY, xa_id TEXT NOT NULL, so_to TEXT NOT NULL, so_thua TEXT NOT NULL, to_moi INT, mdsd TEXT,
  dien_tich NUMERIC, dien_tich_hinh NUMERIC, doi_chieu TEXT, lech_hinh NUMERIC, dich_x NUMERIC, dich_y NUMERIC,
  dien_tich_web NUMERIC, id_web INT, khop_nhan BOOLEAN, bo_net INT, nguon TEXT,
  geom geometry(MultiPolygon, 4326) NOT NULL);
CREATE INDEX IF NOT EXISTS dia_chinh_v8_geom_idx ON dia_chinh_v8 USING GIST (geom);
TRUNCATE dia_chinh_v8 RESTART IDENTITY;
""")
    fo.write(f'COPY dia_chinh_v8 ({COT}) FROM STDIN;\n')
    for f, fs in theo_tep.items():
        for ft in fs:
            p = ft['properties']; g = shape(ft['geometry'])
            if g.geom_type == 'Polygon': g = MultiPolygon([g])
            dx, dy = (p.get('dich_m') or [None, None])[:2]
            fo.write('\t'.join(o(v) for v in (p['xaId'], p['to'], p['thua'], p.get('toMoi'), p.get('mucDichSuDung'), p.get('dienTich_m2'),
                     p.get('dienTichHinh'), p.get('doiChieu'), p.get('lechHinh_m'), dx, dy, p.get('dienTichWeb'), p.get('idWeb'),
                     p.get('khopNhan'), p.get('boNet'), p.get('nguon'), 'SRID=4326;' + shapely.to_wkt(g, rounding_precision=10))) + '\n')
            n += 1
    fo.write('\\.\nCOMMIT;\nANALYZE dia_chinh_v8;\nSELECT doi_chieu, count(*) FROM dia_chinh_v8 GROUP BY 1 ORDER BY 1;\n')
os.replace(os.path.join(gop, 'nap-doi-chieu.sql.tmp'), os.path.join(gop, 'nap-doi-chieu.sql'))
print('file nap:', os.path.join(gop, 'nap-doi-chieu.sql'), n, 'thua')
print('loai dat khong dung dang ma (da bo trong):', bo_ma)
