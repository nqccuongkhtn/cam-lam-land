# -*- coding: utf-8 -*-
# KIỂM Ô ẢNH 1/500 (14/10/2026): ghép các ô ảnh ở một mức phóng thành ảnh lớn, vẽ chồng lên
#   · RANH lập quy hoạch lấy từ DXF (xanh dương) — nét ranh đỏ chấm của bản in phải nằm ĐÚNG trên đường này;
#   · ranh THỬA ĐỊA CHÍNH (xanh lơ, đã trừ độ trượt 0,533 m đông / 0,141 m bắc của lớp địa chính — qhCompute.ts LECH_DC_X/Y).
# và ĐO độ lệch: dò điểm ảnh đỏ (nét ranh in) theo pháp tuyến tại các điểm rải đều trên ranh DXF → khoảng cách có dấu.
# Dùng: python -P kiem_o_1_500.py <thu_muc_o> <z> <ranh.json> <ra.png> [--dc] [--khung=lng0,lat0,lng1,lat1]
import sys, os, math, json, glob, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, cv2
from shapely.geometry import shape
co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
od, z, ranh_p, ra = ts[0], int(ts[1]), ts[2], ts[3]
KICH = 512
g = shape(json.load(open(ranh_p, encoding='utf-8')))
KH = next((tuple(map(float, a.split('=', 1)[1].split(','))) for a in co if a.startswith('--khung=')), None)
lng0, lat0, lng1, lat1 = KH if KH else g.bounds
def gp(lon, lat):                                     # toạ độ điểm ảnh toàn cầu ở mức z (ô KICH điểm)
    n = 2 ** z
    return (lon + 180) / 360 * n * KICH, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n * KICH
X0, Y0 = gp(lng0, lat1); X1, Y1 = gp(lng1, lat0)
tx0, ty0, tx1, ty1 = int(X0 // KICH), int(Y0 // KICH), int(X1 // KICH), int(Y1 // KICH)
W, H = (tx1 - tx0 + 1) * KICH, (ty1 - ty0 + 1) * KICH
if W * H > 400e6: sys.exit(f'anh qua lon {W}x{H}')
anh = np.full((H, W, 3), 255, np.uint8)
co_o = 0
for tx in range(tx0, tx1 + 1):
    for ty in range(ty0, ty1 + 1):
        p = os.path.join(od, str(z), str(tx), f'{ty}.webp')
        if not os.path.exists(p): continue
        t = cv2.imread(p, cv2.IMREAD_UNCHANGED)
        if t is None: print('O HONG', p); continue
        if t.shape[2] == 4:
            a = t[:, :, 3:4] / 255.0; t = (t[:, :, :3] * a + 255 * (1 - a)).astype(np.uint8)
        anh[(ty - ty0) * KICH:(ty - ty0 + 1) * KICH, (tx - tx0) * KICH:(tx - tx0 + 1) * KICH] = t; co_o += 1
goc = anh.copy()
def ve(geom, mau, day):
    for poly in (geom.geoms if geom.geom_type == 'MultiPolygon' else [geom]):
        for ring in [poly.exterior] + list(poly.interiors):
            pts = np.array([gp(x, y) for x, y in ring.coords]) - [tx0 * KICH, ty0 * KICH]
            cv2.polylines(anh, [np.round(pts * 4).astype(np.int32)], True, mau, day, cv2.LINE_AA, shift=2)
if '--dc' in co:
    LX, LY = 0.000004899, 0.000001273
    sql = (f"SELECT ST_AsGeoJSON(ST_Translate(geom, -{LX}, -{LY}), 8) FROM dia_chinh WHERE geom && "
           f"ST_MakeEnvelope({lng0},{lat0},{lng1},{lat1},4326)")
    out = subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam', '-d', 'camlam_gis', '-tA', '-c', sql],
                         capture_output=True, text=True, cwd=r'D:/Cam Lam gis', encoding='utf-8', stdin=subprocess.DEVNULL).stdout
    n = 0
    for line in out.splitlines():
        if line.strip(): ve(shape(json.loads(line)), (200, 160, 0), 1); n += 1
    print('thua dia chinh ve chong:', n)
ve(g, (255, 0, 0), 1)
# ĐO: nét ranh in màu đỏ (R lớn, G,B nhỏ) — dò dọc pháp tuyến ±6 m tại điểm cách đều 5 m trên ranh DXF
m_px = 156543.03392 * math.cos(math.radians((lat0 + lat1) / 2)) / 2 ** z / (KICH / 256)
do = (goc[:, :, 2] > 200) & (goc[:, :, 1] < 90) & (goc[:, :, 0] < 90)
lech = []
for poly in (g.geoms if g.geom_type == 'MultiPolygon' else [g]):
    ring = poly.exterior; L = ring.length; k = 0
    # bước 5 m (đổi độ → m xấp xỉ theo vĩ độ)
    buoc = 5 / 111320.0
    s = 0.0
    while s < L:
        p0 = ring.interpolate(s); p1 = ring.interpolate(min(L, s + buoc / 4))
        x, y = gp(p0.x, p0.y); x2, y2 = gp(p1.x, p1.y)
        dx, dy = x2 - x, y2 - y; nn = math.hypot(dx, dy)
        s += buoc
        if nn == 0: continue
        nx, ny = -dy / nn, dx / nn
        x -= tx0 * KICH; y -= ty0 * KICH
        tot = []
        for t in np.arange(-6 / m_px, 6 / m_px, 0.25):
            xi, yi = int(round(x + nx * t)), int(round(y + ny * t))
            if 0 <= xi < W and 0 <= yi < H and do[yi, xi]: tot.append(t)
        if tot: lech.append(np.median(tot) * m_px)
lech = np.array(lech)
if len(lech):
    print(f'{co_o} o ghep, {m_px * 100:.1f} cm/diem anh; do lech net ranh in (do) so ranh DXF tai {len(lech)} diem: '
          f'trung vi {np.median(lech) * 100:+.1f} cm, trung binh |lech| {np.mean(np.abs(lech)) * 100:.1f} cm, 90% trong {np.percentile(np.abs(lech), 90) * 100:.1f} cm')
cv2.imwrite(ra, anh); print('anh', ra, anh.shape)
