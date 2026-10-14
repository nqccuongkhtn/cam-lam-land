# -*- coding: utf-8 -*-
# TỰ KIỂM phép nắn bản vẽ 1/500 bằng Ô ĐẤT QUY HOẠCH PHÂN KHU 1/2000 (dựng từ CAD gốc, toạ độ chuẩn — apps/backend/data/
# qh_zones_<bản>.json) — 14/10/2026. Dùng cho đồ án KHÔNG in nền hiện trạng (Cam Hiệp Bắc / Nam) nên không kiểm bằng địa chính được.
# Bản 1/500 chi tiết hoá bản 1/2000: MÉP KHỐI (chỉ giới đường đỏ) của hai bản phải trùng nhau. Lấy viền các mảng TÔ MÀU của
# tờ 1/500 (đặt theo <tờ>.nan.json), đo khoảng cách tới viền ô đất 1/2000, và cho "trượt thêm" (ICP đồng dạng) xem muốn dời bao nhiêu.
# Dùng: python -P kiem_nan_phan_khu.py <tờ.pdf> <ranh.json> <qh_zones_2101.json> [--nan=<file nan khác>]
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, pymupdf
from scipy.spatial import cKDTree
from shapely.geometry import shape, Point
from shapely.ops import transform as s_transform
from shapely.prepared import prep
import vn2000 as vn

co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
pdf, ranh_p, zones_p = ts[0], ts[1], ts[2]
nan_p = next((a.split('=', 1)[1] for a in co if a.startswith('--nan=')), pdf + '.nan.json')
af = json.load(open(nan_p, encoding='utf-8'))['afin']
T = np.array([[af[0], af[3]], [af[1], af[4]], [af[2], af[5]]])
ranh = shape(json.load(open(ranh_p, encoding='utf-8')))
ranh_vn = s_transform(lambda x, y, z=None: vn.wgs84_to_vn2000(x, y), ranh)
vung = prep(ranh_vn.buffer(-15))                                   # bỏ dải sát ranh (ranh 1/500 có khi cắt ngang khối 1/2000)
x0, y0, x1, y1 = ranh.bounds
dense = []
for z in json.load(open(zones_p, encoding='utf-8')):
    if z[2] < x0 - 0.002 or z[0] > x1 + 0.002 or z[3] < y0 - 0.002 or z[1] > y1 + 0.002: continue
    v = np.array([vn.wgs84_to_vn2000(lng, lat) for lng, lat in z[4]])
    for a_, b_ in zip(v[:-1], v[1:]):
        n = max(1, int(np.hypot(*(b_ - a_)) / 0.5)); dense += list(a_ + (b_ - a_) * np.linspace(0, 1, n, endpoint=False)[:, None])
D = np.array(dense); cay = cKDTree(D)
pg = pymupdf.open(pdf)[0]; M = pg.rotation_matrix
pts = []
for dr in pg.get_drawings():
    f = dr.get('fill')
    if f is None or min(f) > 0.95: continue                        # chỉ mảng TÔ MÀU (bỏ nền trắng)
    for it in dr['items']:
        if it[0] == 'l': segs = [(it[1], it[2])]
        elif it[0] == 'c': segs = [(it[1], it[4])]
        elif it[0] == 're': r_ = it[1]; segs = [(r_.tl, r_.tr), (r_.tr, r_.br), (r_.br, r_.bl), (r_.bl, r_.tl)]
        else: segs = []
        for p0, q0 in segs:
            p, q = p0 * M, q0 * M; n = max(1, int(abs(q - p) / 1.0))
            for t in np.linspace(0, 1, n + 1): pts.append((p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t))
P = np.array(pts); EN = np.c_[P, np.ones(len(P))] @ T
trong = np.array([vung.contains(Point(e, n)) for e, n in EN]); P, EN = P[trong], EN[trong]
if len(P) > 80000:
    k = np.random.default_rng(5).choice(len(P), 80000, replace=False); P, EN = P[k], EN[k]
dd, _ = cay.query(EN)
print(f'{os.path.basename(pdf)[:40]:40s} · {len(P)} diem vien mang to trong ranh · cach vien o dat 1/2000: trung vi {np.median(dd):.2f} m, '
      f'<0.5m {100 * (dd < 0.5).mean():.0f}%, <1m {100 * (dd < 1).mean():.0f}%')
A_ = np.c_[P, np.ones(len(P))]; T2 = T.copy()
for nguong in [3, 2.5, 2, 1.5, 1, 1, 0.8, 0.8]:
    Q = A_ @ T2; d_, j = cay.query(Q, distance_upper_bound=nguong); ok = np.isfinite(d_)
    X = P[ok] * [1, -1]; Y = D[j[ok]]; mx, my = X.mean(0), Y.mean(0)
    U, S_, Vt = np.linalg.svd((Y - my).T @ (X - mx)); Dg = np.eye(2); Dg[1, 1] = np.sign(np.linalg.det(U @ Vt)); Rm = U @ Dg @ Vt
    sc = (S_ * np.diag(Dg)).sum() / ((X - mx) ** 2).sum(); tt = my - sc * Rm @ mx
    T2 = np.vstack([(sc * Rm @ np.diag([1, -1])).T, tt])
dd2, _ = cay.query(A_ @ T2); dich = np.linalg.norm((A_ @ T2) - (A_ @ T), axis=1)
print(f'   neu cho truot them: doi trung binh {dich.mean():.2f} m (lon nhat {dich.max():.2f} m) → trung vi {np.median(dd2):.2f} m, '
      f'<0.5m {100 * (dd2 < 0.5).mean():.0f}%, <1m {100 * (dd2 < 1).mean():.0f}%; ty le {1 / sc:.5f} pt/m')
if '--ghi' in ' '.join(co):
    ra = next(a.split('=', 1)[1] for a in co if a.startswith('--ghi='))
    json.dump({'afin': [float(T2[0, 0]), float(T2[1, 0]), float(T2[2, 0]), float(T2[0, 1]), float(T2[1, 1]), float(T2[2, 1])],
               'ti_le_pt_m': round(float(1 / sc), 5), 'cach': 'kiem_nan_phan_khu.py — vien mang to 1/500 khop vien o dat phan khu 1/2000'},
              open(ra, 'w', encoding='utf-8')); print('   da ghi', ra)
