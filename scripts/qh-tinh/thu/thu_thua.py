# Thử tính quy hoạch theo thửa từ vùng loại đất bóc PDF: diện tích từng loại + ảnh thửa vẽ lên chính bản đồ PDF.
import sys, json, collections
sys.path.insert(0, r'D:/Cam Lam gis/scripts/qh-tinh')
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf, numpy as np, cv2, nan2, vn2000 as vn
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import transform
from shapely.strtree import STRtree
pdf, tlng, tlat, gj, thua_path, ra = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4], sys.argv[5], sys.argv[6]
p2en, p2w, info = nan2.lap_phep_doi(pdf, tlng, tlat)
EN2P = info.get('en2p') or (lambda E, N: ((E - info['ie']) / info['se'], (N - info['inn']) / info['sn']))
def ve_vn(lng, lat, z=None): return vn.wgs84_to_vn2000(lng, lat)
def sang_vn(g): return transform(lambda xs, ys, z=None: tuple(zip(*[vn.wgs84_to_vn2000(x, y) for x, y in zip(xs, ys)])), g)
zs = json.load(open(gj, encoding='utf-8'))['features']
hinh = [sang_vn(shape(f['geometry']).buffer(0)) for f in zs]; ma = [f['properties']['ma'] for f in zs]
cay = STRtree(hinh)
pg = pymupdf.open(pdf)[0]
anh = []
for t in json.load(open(thua_path, encoding='utf-8')):
    g = sang_vn(shape(t['g']).buffer(0)); A = g.area; kq = collections.Counter()
    for i in cay.query(g):
        a = g.intersection(hinh[i]).area
        if a > 0.01: kq[ma[i]] += a
    con = A - sum(kq.values())
    print(f"{t['xa']} · Thửa {t['so_thua']} · Tờ {t['so_to']} — {A:,.1f} m² (sổ {t['dt']}):",
          ', '.join(f'{k} {v:,.1f}' for k, v in kq.most_common()), f'| chua xac dinh {max(con, 0):,.1f}')
    # ảnh: cắt PDF quanh thửa, vẽ ranh thửa màu xanh
    ring = list(shape(t['g']).geoms)[0].exterior.coords if t['g']['type'] == 'MultiPolygon' else shape(t['g']).exterior.coords
    pts = [EN2P(*vn.wgs84_to_vn2000(x, y)) for x, y in ring]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]; cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    r = max(max(xs) - min(xs), max(ys) - min(ys)) * 1.6 + 6
    clip = pymupdf.Rect(cx - r, cy - r, cx + r, cy + r); k = 400 / (2 * r)
    pix = pg.get_pixmap(matrix=pymupdf.Matrix(k, k), clip=clip, alpha=False)
    im = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3][:, :, ::-1].copy()
    cv2.polylines(im, [np.array([((x - clip.x0) * k, (y - clip.y0) * k) for x, y in pts], np.int32)], True, (255, 60, 0), 3)
    cv2.putText(im, f"T{t['so_thua']} To{t['so_to']}", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 200), 2)
    anh.append(cv2.resize(im, (400, 400)))
while len(anh) % 3: anh.append(np.full((400, 400, 3), 255, np.uint8))
cv2.imwrite(ra, np.vstack([np.hstack(anh[i:i + 3]) for i in range(0, len(anh), 3)]))
print('anh:', ra)
