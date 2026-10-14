# -*- coding: utf-8 -*-
# NẮN BẢN VẼ 1/500 KHÔNG CÓ TOẠ ĐỘ NÀO bằng cách ĐỐI CHIẾU NÉT NỀN HIỆN TRẠNG với RANH THỬA ĐỊA CHÍNH (bảng dia_chinh) — 14/10/2026.
# Căn cứ: nền của bản vẽ 1/500 là bản đo đạc hiện trạng; đo trên TK B (đã nắn bằng bảng góc ranh) thấy các nhóm nét xám/ô-liu mảnh
# trùng ranh thửa địa chính tới ~1 m (96–98 % điểm trong 2 m).
#   1) lấy ranh mọi thửa địa chính trong khung tìm (theo tên xã cũ hoặc khung lng/lat) → ảnh cạnh 2 m/điểm ảnh;
#   2) lấy nét NỀN hiện trạng (một lớp xám, bỏ chấm ký hiệu) của tờ bản vẽ (trang đã xoay) → thử tỷ lệ 0,4–6 pt/m (bước 3 %), hướng Bắc lên, trượt tìm chỗ
#      trùng ranh thửa nhiều nhất (matchTemplate);
#   3) tinh chỉnh kiểu ICP (kéo điểm nét về điểm ranh thửa gần nhất trong 3 m, giải phép đồng dạng, lặp) → "afin" như nan_1_500.py.
# Dùng: python -P nan_1_500_dia_chinh.py <tờ.pdf> <ra.nan.json> --xa="xã Cam Tân" [--xa=…] | --khung=lng0,lat0,lng1,lat1  [--soi=ảnh.png] [--lop=7f7f7f_0.24] [--dien-tich-ha=178] [--ti-le=0.8,2.0]
import sys, os, json, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, cv2, pymupdf
import vn2000 as vn
from scipy.spatial import cKDTree

co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
pdf, ra = ts[0], ts[1]
xa = [a.split('=', 1)[1] for a in co if a.startswith('--xa=')]
khung = next((list(map(float, a.split('=', 1)[1].split(','))) for a in co if a.startswith('--khung=')), None)
soi = next((a.split('=', 1)[1] for a in co if a.startswith('--soi=')), None)
# --dien-tich-ha = quy mô khu (thuyết minh): đo trên 5 đồ án đã nắn, cạnh dài tờ giấy (điểm) / tỷ lệ = 2,2–3,9 × √diện tích →
# chỉ dò tỷ lệ trong khoảng đó (nới thêm chút) — tránh khuôn bé xíu "trùng" ở đâu cũng được.
dt_ha = next((float(a.split('=', 1)[1]) for a in co if a.startswith('--dien-tich-ha=')), None)
t0 = time.time()

def psql(sql):
    return subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam', '-d', 'camlam_gis', '-tA', '-c', sql],
                          capture_output=True, text=True, cwd=r'D:/Cam Lam gis', encoding='utf-8', stdin=subprocess.DEVNULL).stdout

# ---- 1) ranh thửa địa chính
if xa:
    ds = ','.join("'" + x.replace("'", "''") + "'" for x in xa)
    loc = f"d.xa_id IN (SELECT xa_id FROM dia_chinh_xa WHERE ten IN ({ds}))"
else:
    loc = f"ST_Within(d.geom, ST_MakeEnvelope({khung[0]},{khung[1]},{khung[2]},{khung[3]},4326))"   # thửa NẰM TRỌN trong khung (thửa lớn kéo dài không làm phình khung)
out = psql(f"SELECT ST_AsGeoJSON(d.geom, 7) FROM dia_chinh d WHERE {loc}")
rings = []
for line in out.splitlines():
    g = json.loads(line); polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys: rings += poly
VN = [np.array([vn.wgs84_to_vn2000(lng, lat) for lng, lat in r]) for r in rings]
# bỏ thửa SAI TOẠ ĐỘ trong dữ liệu gốc (Suối Tân có thửa rơi cách 300 km → khung tìm 360 km, tràn bộ nhớ): tâm cách trung vị > 15 km
tam_ = np.array([v.mean(0) for v in VN]); xa_ = np.hypot(*(tam_ - np.median(tam_, 0)).T)
if (xa_ > 15000).any(): print(f'bo {(xa_ > 15000).sum()} thua sai toa do (cach > 15 km)')
VN = [v for v, d_ in zip(VN, xa_) if d_ <= 15000]
allv = np.vstack(VN)
E0, N0 = allv.min(0) - 50; E1, N1 = allv.max(0) + 50
print(f'dia chinh: {len(rings)} vong ranh thua, khung {(E1 - E0) / 1000:.1f} x {(N1 - N0) / 1000:.1f} km')
R = 3.0                                                        # dò thô ở 3 m/điểm ảnh
Wt, Ht = int((E1 - E0) / R) + 1, int((N1 - N0) / R) + 1
tg = np.zeros((Ht, Wt), np.uint8)
for v in VN: cv2.polylines(tg, [np.c_[(v[:, 0] - E0) / R, (N1 - v[:, 1]) / R].astype(np.int32)], True, 255, 1)
tgd = cv2.dilate(tg, np.ones((3, 3), np.uint8))

# ---- 2) nét mảnh của bản vẽ (trang đã xoay)
pg = pymupdf.open(pdf)[0]; M = pg.rotation_matrix
# NÉT NỀN = MỘT lớp nét XÁM (cùng màu + cùng bề dày): bản đo hiện trạng in xám — TK B #c1c1c1 mảnh (trùng ranh thửa trung vị 1,0 m),
# TK C Cam Hải Đông #7f7f7f dày 0,24 pt. BỎ đường vẽ ngắn < 3 điểm: chấm / gạch ký hiệu cát, cây, cỏ (TK C có 32 vạn chấm như vậy,
# giãn ra thành vệt kín che mất hình nét thật — 14/10/2026 nắn hỏng, trung vị 54 m). Tự chọn lớp xám có tổng độ dài (sau khi bỏ chấm)
# lớn nhất; --lop=7f7f7f_0.24 để chỉ định (nhiều lớp cách nhau dấu phẩy).
lop_chi = next((a.split('=', 1)[1].lower().replace('#', '').split(',') for a in co if a.startswith('--lop=')), None)
def khoa(dr): return '%02x%02x%02x_%.2f' % (*[int(v * 255) for v in dr['color']], dr.get('width') or 0)
def doan(dr):                                                  # mọi đoạn thẳng của một đường vẽ (đường cong bẻ 8 đoạn)
    for it in dr['items']:
        if it[0] == 'l': yield it[1], it[2]
        elif it[0] == 'c':
            a, b, c_, d_ = it[1:5]; q0 = a
            for t in np.linspace(0, 1, 9)[1:]:
                q = a * (1 - t) ** 3 + b * 3 * t * (1 - t) ** 2 + c_ * 3 * t * t * (1 - t) + d_ * t ** 3; yield q0, q; q0 = q
        elif it[0] == 're':
            r_ = it[1]; yield r_.tl, r_.tr; yield r_.tr, r_.br; yield r_.br, r_.bl; yield r_.bl, r_.tl
ve = [dr for dr in pg.get_drawings() if dr.get('color') is not None and (dr.get('width') or 0) <= 0.3]
dai_ve = {id(dr): sum(abs(q - p) for p, q in doan(dr)) for dr in ve}
ve = [dr for dr in ve if dai_ve[id(dr)] >= 3]
if lop_chi: nen = [dr for dr in ve if khoa(dr) in lop_chi]
else:
    tong = {}
    for dr in ve:
        c = dr['color']
        if max(c) - min(c) < 0.05 and 0.3 < c[0] < 0.92: tong[khoa(dr)] = tong.get(khoa(dr), 0) + dai_ve[id(dr)]
    xep = sorted(tong.items(), key=lambda kv: -kv[1]); print('lop xam (tong do dai, diem):', [(k, round(v)) for k, v in xep[:4]])
    nen = [dr for dr in ve if khoa(dr) == xep[0][0]] if xep else ve
print(f'net nen: {len(nen)} duong ve, lop {sorted(set(khoa(dr) for dr in nen))[:5]}')
pts = []
for dr in nen:
    for p0, q0 in doan(dr):
        p, q = p0 * M, q0 * M; L = abs(q - p)
        n = max(1, int(L / 1.5))
        for t in np.linspace(0, 1, n + 1): pts.append((p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t))
P = np.array(pts)
if len(P) > 400000: P = P[np.random.default_rng(1).choice(len(P), 400000, replace=False)]
print(f'net manh: {len(P)} diem')
# KHUÔN SO = phần GIỮA tờ (60 % khung bao nét nền): cả tờ ở tỷ lệ đúng có khi rộng hơn khung tìm (TK B ~2,3 × 3,3 km) → bị bỏ qua
lo_, hi_ = np.percentile(P, 20, axis=0), np.percentile(P, 80, axis=0)
Pg = P[(P[:, 0] > lo_[0]) & (P[:, 0] < hi_[0]) & (P[:, 1] > lo_[1]) & (P[:, 1] < hi_[1])]

# ---- 3) dò tỷ lệ + vị trí (Bắc lên trên) — TỪ THÔ ĐẾN MỊN. Bản vẽ rộng ~2 km: lệch 1,5 % tỷ lệ đã lệch 30 m ở mép, nên dò một bậc
# với bước 3 % thì điểm đúng không trội lên (TK B từng bắt nhầm tỷ lệ 6,0 thay vì 1,03).
def anh_canh(R_, gian):
    Wt_, Ht_ = int((E1 - E0) / R_) + 1, int((N1 - N0) / R_) + 1
    im_ = np.zeros((Ht_, Wt_), np.uint8)
    for v_ in VN: cv2.polylines(im_, [np.c_[(v_[:, 0] - E0) / R_, (N1 - v_[:, 1]) / R_].astype(np.int32)], True, 255, 1)
    return cv2.dilate(im_, np.ones((2 * gian + 1, 2 * gian + 1), np.uint8)) if gian else im_
def khuon(s_, R_):
    Q_ = np.c_[Pg[:, 0] / s_, -Pg[:, 1] / s_]; mn_ = Q_.min(0); Qi_ = ((Q_ - mn_) / R_).astype(int)
    h_, w_ = Qi_[:, 1].max() + 1, Qi_[:, 0].max() + 1
    t_ = np.zeros((h_, w_), np.uint8); t_[h_ - 1 - Qi_[:, 1], Qi_[:, 0]] = 255
    return t_, mn_, h_
def khop(T, t):
    # so khuôn t trên ảnh T; BỎ chỗ dưới khuôn gần như không có nét địa chính (biển, vùng trống) hoặc toàn nét — ở đó phép so
    # chuẩn hoá chia cho ~0 và ra 1,0 giả (TK B từng "trùng 100 %" ở chỗ không có thửa nào)
    r = cv2.matchTemplate(T, t, cv2.TM_CCOEFF_NORMED)
    phan = cv2.matchTemplate(T.astype(np.float32) / 255.0, np.ones(t.shape, np.float32), cv2.TM_CCORR) / t.size
    r[(phan < 0.02) | (phan > 0.97) | ~np.isfinite(r)] = -1
    _, v, _, l = cv2.minMaxLoc(r)
    return v, l
# bậc 1: 12 m/điểm ảnh, giãn ±1 điểm ảnh, tỷ lệ bước 3 % → 5 ứng viên tốt nhất (khác chỗ nhau)
R1 = 3.0; T1 = anh_canh(R1, 1); ung = []          # 3 m: ở 6–12 m nền phố dày đặc tô kín ảnh → mất hình dạng (đo TK B: đúng chỗ 0,186 / nhầm 0,05)
dai = max(pg.rect.width, pg.rect.height)
s_min, s_max = (dai / (4.5 * np.sqrt(dt_ha * 1e4)), dai / (1.9 * np.sqrt(dt_ha * 1e4))) if dt_ha else (0.5, 6.0)
tl_ = next((list(map(float, a.split('=', 1)[1].split(','))) for a in co if a.startswith('--ti-le=')), None)
if tl_: s_min, s_max = tl_                                       # --ti-le=0.8,2.0 : chỉ định khoảng dò (điểm/m)
print(f'do ty le trong khoang {s_min:.3f}–{s_max:.3f} pt/m')
for s_ in np.exp(np.arange(np.log(s_min), np.log(s_max), np.log(1.01))):
    t_, mn_, h_ = khuon(s_, R1)
    if min(t_.shape) < 100: continue                             # khuôn quá bé (< 300 m) → bỏ
    if (t_ > 0).mean() > 0.6: continue                           # khuôn gần như kín trắng → không còn hình dạng để so
    if t_.shape[0] >= T1.shape[0] or t_.shape[1] >= T1.shape[1] or min(t_.shape) < 12: continue
    v_, l_ = khop(T1, t_)
    # toạ độ (E, N) của góc trên-trái khuôn → dùng lại ở bậc 2
    ung.append((v_, s_, E0 + l_[0] * R1 - mn_[0], N1 - l_[1] * R1 - (h_ - 1) * R1 - mn_[1]))
ung.sort(reverse=True); ung = ung[:5]
print('bac 1 (3 m):', [(round(u[1], 3), round(u[0], 3)) for u in ung])
# bậc 2: 4 m/điểm ảnh, tỷ lệ ±4 % bước 0,5 %, chỉ tìm trong cửa sổ ±150 m quanh ứng viên
R2 = 2.0; T2 = anh_canh(R2, 1); tot = None
for v1, s1, dE, dN in ung:
    for s_ in s1 * np.exp(np.arange(np.log(0.985), np.log(1.0151), np.log(1.0025))):
        t_, mn_, h_ = khuon(s_, R2)
        # vị trí dự đoán của góc trên-trái khuôn trong ảnh bậc 2 (theo phép dời bậc 1: E = x/s + dE)
        cx_ = int((dE + mn_[0] - E0) / R2); cy_ = int((N1 - (dN + mn_[1] + (h_ - 1) * R2)) / R2)
        m = int(60 / R2); x0_, y0_ = max(0, cx_ - m), max(0, cy_ - m)
        x1_, y1_ = min(T2.shape[1], cx_ + t_.shape[1] + m), min(T2.shape[0], cy_ + t_.shape[0] + m)
        vung = T2[y0_:y1_, x0_:x1_]
        if vung.shape[0] <= t_.shape[0] or vung.shape[1] <= t_.shape[1]: continue
        v_, l_ = khop(vung, t_)
        if tot is None or v_ > tot[0]: tot = (v_, s_, (l_[0] + x0_, l_[1] + y0_), mn_, h_)
v, s, loc_, mn, h = tot
R = R2
print(f'do tho: {s:.4f} pt/m, tuong quan {v:.3f} ({time.time() - t0:.0f} giay)')
# điểm trang → (E, N) thô: E = E0 + loc_x·R + (x/s − mn_x);  N = N1 − loc_y·R − (h−1)·R + (−y/s − mn_y)
def tho(P_):
    return np.c_[E0 + loc_[0] * R + (P_[:, 0] / s - mn[0]), N1 - loc_[1] * R - (h - 1) * R + (-P_[:, 1] / s - mn[1])]

# ---- 4) ICP: điểm nét → điểm ranh thửa gần nhất (≤ 3 m), giải phép đồng dạng trang → EN
Eh = tho(P)
cx, cy = Eh.mean(0); ban = 0.6 * np.ptp(Eh, axis=0).max() + 200
dense = []
for vv in VN:
    if np.abs(vv.mean(0) - [cx, cy]).max() > ban: continue
    for a_, b_ in zip(vv[:-1], vv[1:]):
        n = max(1, int(np.hypot(*(b_ - a_)) / 0.5))
        dense += list(a_ + (b_ - a_) * np.linspace(0, 1, n, endpoint=False)[:, None])
D = np.array(dense); cay = cKDTree(D)
sub = P[np.random.default_rng(2).choice(len(P), min(len(P), 60000), replace=False)]
A_ = np.c_[sub, np.ones(len(sub))]
T = np.c_[np.linalg.lstsq(np.c_[P[:5000], np.ones(5000)], Eh[:5000], rcond=None)[0]]   # phép thô dạng ma trận 3×2
for vong, nguong in enumerate([12, 8, 5, 3, 3, 2, 2, 2, 2, 2]):
    Q = A_ @ T
    d, j = cay.query(Q, distance_upper_bound=nguong); ok = np.isfinite(d)
    X = sub[ok]; Y = D[j[ok]]
    # đồng dạng (có lật trục y): Y ≈ sR·[x, −y] + t
    Xf = X * [1, -1]; mx, my = Xf.mean(0), Y.mean(0); U, S_, Vt = np.linalg.svd((Y - my).T @ (Xf - mx))
    Dg = np.eye(2); Dg[1, 1] = np.sign(np.linalg.det(U @ Vt)); Rm = U @ Dg @ Vt
    sc = (S_ * np.diag(Dg)).sum() / ((Xf - mx) ** 2).sum(); tt = my - sc * Rm @ mx
    T = np.vstack([(sc * Rm @ np.diag([1, -1])).T, tt])
d, _ = cay.query(A_ @ T)
print(f'tinh chinh: ti le {1 / sc:.4f} pt/m, xoay {np.degrees(np.arctan2(Rm[1, 0], Rm[0, 0])):+.2f} do; diem net cach ranh thua: '
      f'trung vi {np.median(d):.2f} m, <1m {100 * (d < 1).mean():.0f}%, <2m {100 * (d < 2).mean():.0f}%')
af = [float(T[0, 0]), float(T[1, 0]), float(T[2, 0]), float(T[0, 1]), float(T[1, 1]), float(T[2, 1])]
json.dump({'afin': af, 'ti_le_pt_m': round(float(1 / sc), 5), 'net_cach_ranh_thua_trung_vi_m': round(float(np.median(d)), 3),
           'cach': 'nan_1_500_dia_chinh.py — net nen hien trang khop ranh thua dia chinh'}, open(ra, 'w', encoding='utf-8'))
print('da ghi', ra, f'({time.time() - t0:.0f} giay)')
