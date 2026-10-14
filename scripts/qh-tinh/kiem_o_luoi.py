# -*- coding: utf-8 -*-
# KIỂM Ô ẢNH ĐÃ CẮT CÓ ĐÚNG CHỖ KHÔNG — đo ngay trên ô ảnh (14/10/2026): mỗi VẠCH LƯỚI km của bản đồ (E = hằng số hoặc N = hằng số,
# lấy từ <pdf>.nan.json "luoi") phải hiện ĐÚNG đường thẳng VN-2000 tương ứng. Rải điểm dọc vạch, đổi sang điểm ảnh ở mức z, tìm nét tối
# (vạch lưới in xám/đen) trong ±R điểm ảnh theo pháp tuyến → độ lệch (mét). Không phụ thuộc ảnh vệ tinh hay dữ liệu khác.
# Dùng: python -P kiem_o_luoi.py <thu_muc_o> <z> <pdf.nan.json> [--so-vach=6] [--r=12]
import sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, cv2
import vn2000 as vn
co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
od, z, nan_p = ts[0], int(ts[1]), ts[2]
SO = int(next((a.split('=', 1)[1] for a in co if a.startswith('--so-vach=')), 6))
R = int(next((a.split('=', 1)[1] for a in co if a.startswith('--r=')), 12))
KICH = 512
L = json.load(open(nan_p, encoding='utf-8'))['luoi']
Es, Ns = L['E'], L['N']
cache = {}
def o(tx, ty):
    k = (tx, ty)
    if k not in cache:
        p = os.path.join(od, str(z), str(tx), f'{ty}.webp')
        t = cv2.imread(p, cv2.IMREAD_UNCHANGED) if os.path.exists(p) else None
        if t is not None and t.shape[2] == 4:
            a = t[:, :, 3:4] / 255.0; t = (t[:, :, :3] * a + 255 * (1 - a)).astype(np.uint8)
        cache[k] = t
    return cache[k]
def px(gx, gy):
    tx, ty = int(gx // KICH), int(gy // KICH); t = o(tx, ty)
    if t is None: return None
    return t[int(gy - ty * KICH), int(gx - tx * KICH)]
def gp(lon, lat):
    n = 2 ** z
    return (lon + 180) / 360 * n * KICH, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n * KICH
lat0 = vn.vn2000_to_wgs84(np.mean(Es), np.mean(Ns))[1]
m_px = 156543.03392 * math.cos(math.radians(lat0)) / 2 ** z / (KICH / 256)
ket = []
def do_vach(E=None, N=None):
    # Vạch lưới là nét MỘT MÀU chạy suốt (Nha Trang: xanh lơ) nằm đè lên mọi thứ: tại đúng độ dời t của vạch, màu lấy ở mọi điểm
    # dọc vạch GIỐNG NHAU; lệch khỏi vạch thì màu thay đổi theo nền. Chọn t có tỉ lệ "màu phổ biến nhất" cao nhất (không cần biết màu).
    if E is not None: ds = [(E, n) for n in np.linspace(min(Ns), max(Ns), 120)]
    else: ds = [(e, N) for e in np.linspace(min(Es), max(Es), 120)]
    cot = {t: [] for t in range(-R, R + 1)}
    for (e, n) in ds:
        x, y = gp(*vn.vn2000_to_wgs84(e, n))
        if E is not None: x2, y2 = gp(*vn.vn2000_to_wgs84(e + 1, n))   # pháp tuyến của vạch E = hướng tăng E
        else: x2, y2 = gp(*vn.vn2000_to_wgs84(e, n + 1))
        dx, dy = x2 - x, y2 - y; nn = math.hypot(dx, dy); dx, dy = dx / nn, dy / nn
        hang = []
        for t in range(-R, R + 1):
            v = px(x + dx * t, y + dy * t)
            if v is None or (v >= 245).all(): hang = []; break      # ngoài vùng có ô / nền trắng (ngoài ranh)
            hang.append(tuple(int(c) // 16 for c in v))
        if hang:
            for t, c in zip(range(-R, R + 1), hang): cot[t].append(c)
    if not cot[0] or len(cot[0]) < 8: return None
    import collections
    dem = {t: collections.Counter(v).most_common(1)[0][1] / len(v) for t, v in cot.items()}
    t_tot = max(dem, key=dem.get)
    # nét vạch dày nhiều điểm ảnh → lấy TÂM dải các độ dời có độ đồng màu gần bằng cao nhất
    dai = [t for t in dem if dem[t] >= 0.9 * dem[t_tot] and abs(t - t_tot) <= 6]
    return (float(np.mean(dai)) * m_px, dem[t_tot], len(cot[0]))
for E in Es[1:-1][::max(1, len(Es) // SO)]:
    r = do_vach(E=E)
    if r and r[1] >= 0.6: ket.append(('E', E) + r)
for N in Ns[1:-1][::max(1, len(Ns) // SO)]:
    r = do_vach(N=N)
    if r and r[1] >= 0.6: ket.append(('N', N) + r)
for k, v, md, dong, n in ket: print(f'  vach {k}={v:.0f}: lech {md:+.2f} m (dong mau {dong:.0%} tren {n} diem)')
if ket: print(f'{os.path.basename(od)} z{z} ({m_px:.2f} m/diem anh): {len(ket)} vach, lech lon nhat {max(abs(k[2]) for k in ket):.2f} m')
else: print('khong do duoc vach nao (vach luoi khong hien o muc nay?)')
