# -*- coding: utf-8 -*-
# ẢNH THỬ đúng như sẽ hiện trên web: ghép các ô TILE đã cắt (trong ranh, nền trong suốt) lên ảnh VỆ TINH cùng ô, ở một mức phóng.
# Dùng: python -P ghep_tile_ve_tinh.py <thư_mục_tile_của_lớp> <z> <ra.png> [độ_đậm 0..1, mặc định 0.75]
import sys, os, io, time, urllib.request
import numpy as np, cv2
goc, z, ra = sys.argv[1], int(sys.argv[2]), sys.argv[3]
dam = float(sys.argv[4]) if len(sys.argv) > 4 else 0.75
thu = os.path.join(goc, str(z))
o = [(int(x), int(f[:-4])) for x in os.listdir(thu) for f in os.listdir(os.path.join(thu, x)) if f.endswith('.png')]
x0, x1 = min(a for a, _ in o), max(a for a, _ in o); y0, y1 = min(b for _, b in o), max(b for _, b in o)
W, H = (x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256
nen = np.zeros((H, W, 3), np.uint8)
for x in range(x0, x1 + 1):
    for y in range(y0, y1 + 1):
        for lan in range(3):
            try:
                b = urllib.request.urlopen(urllib.request.Request(f'https://mt{(x + y) % 4}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi',
                                           headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read()
                t = cv2.imdecode(np.frombuffer(b, np.uint8), cv2.IMREAD_COLOR)
                nen[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = t[:, :, :3]; break
            except Exception: time.sleep(1)
out = nen.astype(np.float32)
for x, y in o:
    t = cv2.imread(os.path.join(thu, str(x), f'{y}.png'), cv2.IMREAD_UNCHANGED)
    if t is None or t.shape[2] < 4: continue
    a = (t[:, :, 3:4].astype(np.float32) / 255.0) * dam
    sl = out[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256]
    sl[:] = sl * (1 - a) + t[:, :, :3].astype(np.float32) * a
cv2.imwrite(ra, out.astype(np.uint8)); print('anh thu', ra, W, 'x', H)
