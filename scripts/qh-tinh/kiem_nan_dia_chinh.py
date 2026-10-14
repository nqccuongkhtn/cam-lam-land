# -*- coding: utf-8 -*-
# TỰ KIỂM một phép nắn bản vẽ 1/500 bằng RANH THỬA ĐỊA CHÍNH (14/10/2026): nét nền hiện trạng của tờ (đặt theo <tờ>.nan.json)
# cách ranh thửa bao xa, và nếu cho "trượt thêm" (ICP đồng dạng, bắt đầu từ chính phép nắn đó) thì nó muốn dời đi bao nhiêu.
# Dời < ~0,5 m và trung vị nhỏ = phép nắn khớp địa chính. Dùng được cho cả đồ án nắn theo bảng toạ độ (kiểm chéo độc lập).
# Ranh thửa đã trừ độ trượt của lớp dia_chinh (LECH_DC_X/Y trong apps/backend/src/lib/qhCompute.ts).
# Dùng: python -P kiem_nan_dia_chinh.py <tờ.pdf> <ranh.json> [--lop=767676_0.24] [--nan=<file nan khác>]
import sys, os, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, pymupdf
from scipy.spatial import cKDTree
from shapely.geometry import shape, Point
from shapely.ops import transform as s_transform
from shapely.prepared import prep
import vn2000 as vn

co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
pdf, ranh_p = ts[0], ts[1]
lop_chi = next((a.split('=', 1)[1].lower().replace('#', '').split(',') for a in co if a.startswith('--lop=')), None)
nan_p = next((a.split('=', 1)[1] for a in co if a.startswith('--nan=')), pdf + '.nan.json')
af = json.load(open(nan_p, encoding='utf-8'))['afin']
T = np.array([[af[0], af[3]], [af[1], af[4]], [af[2], af[5]]])          # [x y 1] @ T = [E N]
LX, LY = 0.000004899, 0.000001273

ranh = shape(json.load(open(ranh_p, encoding='utf-8')))
ranh_vn = s_transform(lambda x, y, z=None: vn.wgs84_to_vn2000(x, y), ranh)
vung = prep(ranh_vn.buffer(30))
x0, y0, x1, y1 = ranh.bounds; d = 0.002
sql = (f"SELECT ST_AsGeoJSON(geom, 8) FROM dia_chinh WHERE geom && ST_MakeEnvelope({x0 - d},{y0 - d},{x1 + d},{y1 + d},4326)")
out = subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam', '-d', 'camlam_gis', '-tA', '-c', sql],
                     capture_output=True, text=True, cwd=r'D:/Cam Lam gis', encoding='utf-8', stdin=subprocess.DEVNULL).stdout
dense = []
for line in out.splitlines():
    g = json.loads(line)
    for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
        for r in poly:
            v = np.array([vn.wgs84_to_vn2000(lng - LX, lat - LY) for lng, lat in r])
            for a_, b_ in zip(v[:-1], v[1:]):
                n = max(1, int(np.hypot(*(b_ - a_)) / 0.5)); dense += list(a_ + (b_ - a_) * np.linspace(0, 1, n, endpoint=False)[:, None])
D = np.array(dense); cay = cKDTree(D)

pg = pymupdf.open(pdf)[0]; M = pg.rotation_matrix
def khoa(dr): return '%02x%02x%02x_%.2f' % (*[int(v * 255) for v in dr['color']], dr.get('width') or 0)
def doan(dr):
    for it in dr['items']:
        if it[0] == 'l': yield it[1], it[2]
        elif it[0] == 'c':
            a, b, c_, d_ = it[1:5]; q0 = a
            for t in np.linspace(0, 1, 9)[1:]:
                q = a * (1 - t) ** 3 + b * 3 * t * (1 - t) ** 2 + c_ * 3 * t * t * (1 - t) + d_ * t ** 3; yield q0, q; q0 = q
        elif it[0] == 're':
            r_ = it[1]; yield r_.tl, r_.tr; yield r_.tr, r_.br; yield r_.br, r_.bl; yield r_.bl, r_.tl
ve = [dr for dr in pg.get_drawings() if dr.get('color') is not None and (dr.get('width') or 0) <= 0.3]
dv = {id(dr): sum(abs(q - p) for p, q in doan(dr)) for dr in ve}
ve = [dr for dr in ve if dv[id(dr)] >= 3]
if lop_chi: nen = [dr for dr in ve if khoa(dr) in lop_chi]
else:
    tong = {}
    for dr in ve:
        c = dr['color']
        if max(c) - min(c) < 0.05 and 0.3 < c[0] < 0.92: tong[khoa(dr)] = tong.get(khoa(dr), 0) + dv[id(dr)]
    lop = max(tong, key=tong.get); nen = [dr for dr in ve if khoa(dr) == lop]
pts = []
for dr in nen:
    for p0, q0 in doan(dr):
        p, q = p0 * M, q0 * M; n = max(1, int(abs(q - p) / 1.5))
        for t in np.linspace(0, 1, n + 1): pts.append((p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t))
P = np.array(pts); EN = np.c_[P, np.ones(len(P))] @ T
trong = np.array([vung.contains(Point(e, n)) for e, n in EN])
P, EN = P[trong], EN[trong]
if len(P) > 80000:
    k = np.random.default_rng(5).choice(len(P), 80000, replace=False); P, EN = P[k], EN[k]
dd, _ = cay.query(EN)
print(f'{os.path.basename(pdf)[:40]:40s} lop {sorted(set(khoa(dr) for dr in nen))[:2]} · {len(P)} diem net nen trong ranh · '
      f'cach ranh thua: trung vi {np.median(dd):.2f} m, <1m {100 * (dd < 1).mean():.0f}%, <2m {100 * (dd < 2).mean():.0f}%')
# ICP đồng dạng bắt đầu từ phép nắn hiện tại → nó muốn dời bao nhiêu
A_ = np.c_[P, np.ones(len(P))]; T2 = T.copy()
for nguong in [3, 2.5, 2, 2, 1.5, 1.5, 1.5, 1.5]:
    Q = A_ @ T2; d_, j = cay.query(Q, distance_upper_bound=nguong); ok = np.isfinite(d_)
    X = P[ok] * [1, -1]; Y = D[j[ok]]; mx, my = X.mean(0), Y.mean(0)
    U, S_, Vt = np.linalg.svd((Y - my).T @ (X - mx)); Dg = np.eye(2); Dg[1, 1] = np.sign(np.linalg.det(U @ Vt)); Rm = U @ Dg @ Vt
    sc = (S_ * np.diag(Dg)).sum() / ((X - mx) ** 2).sum(); tt = my - sc * Rm @ mx
    T2 = np.vstack([(sc * Rm @ np.diag([1, -1])).T, tt])
dd2, _ = cay.query(A_ @ T2)
dich = np.linalg.norm((A_ @ T2) - (A_ @ T), axis=1)
print(f'   neu cho truot them: doi trung binh {dich.mean():.2f} m (lon nhat {dich.max():.2f} m) → trung vi {np.median(dd2):.2f} m, '
      f'<1m {100 * (dd2 < 1).mean():.0f}%')
