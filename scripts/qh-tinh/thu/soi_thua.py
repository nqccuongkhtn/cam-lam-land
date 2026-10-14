# Vẽ vùng loại đất đã bóc (tô màu theo 'mau') quanh 1 thửa + ranh thửa (xanh) — soi phần "chưa xác định" nằm đâu
import sys, json
sys.path.insert(0, r'D:/Cam Lam gis/scripts/qh-tinh')
import numpy as np, cv2, vn2000 as vn
from shapely.geometry import shape, box
from shapely.ops import transform
gj, thua_path, idx, ra = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
t = json.load(open(thua_path, encoding='utf-8'))[idx]
tv = lambda g: transform(lambda xs, ys, z=None: tuple(zip(*[vn.wgs84_to_vn2000(x, y) for x, y in zip(xs, ys)])), g)
P = tv(shape(t['g'])); x0, y0, x1, y1 = P.buffer(40).bounds; R = 0.25
Wc, Hc = int((x1 - x0) / R), int((y1 - y0) / R)
im = np.full((Hc, Wc, 3), 255, np.uint8)
win = box(x0, y0, x1, y1)
def px(c): return np.array([((x - x0) / R, (y1 - y) / R) for x, y in c], np.int32)
for f in json.load(open(gj, encoding='utf-8'))['features']:
    g = shape(f['geometry'])
    # lọc nhanh theo khung WGS84
    gb = g.bounds
    lng0, lat0 = vn.vn2000_to_wgs84(x0, y0); lng1, lat1 = vn.vn2000_to_wgs84(x1, y1)
    if gb[2] < lng0 or gb[0] > lng1 or gb[3] < lat0 or gb[1] > lat1: continue
    G = tv(g).intersection(win)
    if G.is_empty: continue
    c = f['properties']['mau'].lstrip('#'); col = (int(c[4:6], 16), int(c[2:4], 16), int(c[0:2], 16))
    for p in (G.geoms if hasattr(G, 'geoms') else [G]):
        if p.geom_type != 'Polygon': continue
        cv2.fillPoly(im, [px(p.exterior.coords)] + [px(h.coords) for h in p.interiors], col)
        cv2.polylines(im, [px(p.exterior.coords)], True, (90, 90, 90), 1)
cv2.polylines(im, [px(P.exterior.coords if P.geom_type == 'Polygon' else list(P.geoms)[0].exterior.coords)], True, (255, 0, 0), 3)
cv2.imwrite(ra, im); print(ra, im.shape)
