#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dựng MẶT NẠ ĐƯỜNG (road_mask) cho backend — CÁCH C (khớp qhviet ±3%).

Ý tưởng "số hoá lại từ DXF, GIỮ CUNG":
  - Vẽ MÉP ĐƯỜNG (pavement, cung cong thật từ DXF → roads_signed.json) lên lưới raster làm "tường".
  - FLOOD-FILL từ biên ngoài: phần loang tới được = LÒNG ĐƯỜNG + vùng ngoài; phần bị tường vây kín = Ô ĐẤT (block).
  - Nhờ đọc theo lòng đường thật (không phụ thuộc qh_vector vẽ đủ hay thiếu) nên thửa kiểu 326
    (qh_vector vẽ thiếu ~10%) vẫn ra đủ diện tích đất, không bị tính nhầm thành giao thông.

Xuất: apps/backend/data/road_mask.bin (bit-packed, 1=đường) + road_mask.json (x0,y0,x1,y1,W,H,rowbytes,mpp).
Backend (qhCompute.ts) nạp 2 file này + qh_zones.json để tính loại đất theo thửa.

Chạy lại khi: đổi ranh đường (DXF mới → roads_signed.json mới) hoặc mở rộng vùng phủ.
Cần: numpy, pillow. roads_signed.json (mép đường WGS84) + geojson thửa (để lấy bbox vùng phủ).
"""
import json, math, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

# ── Đường dẫn (sửa nếu cần) ─────────────────────────────────────────────────
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
DATA = os.path.join(REPO, 'apps', 'backend', 'data')
SEG_PATH    = os.path.join(DATA, 'roads_signed.json')                 # mép đường [x1,y1,x2,y2,sign]
PARCEL_PATH = os.environ.get('PARCELS', os.path.join(REPO, 'thua_camduc_all.geojson'))  # thửa (lấy bbox)
XA          = os.environ.get('XA', 'Cam Đức')   # xã cần phủ (None = tất cả)
MPP         = float(os.environ.get('MPP', '1.8'))  # mét/pixel (1.8 = cân bằng chính xác/kích thước)
MARGIN      = 0.004                                  # đệm bbox (~440m) để phủ đường ở rìa

def ring_of(ft):
    gm = ft['geometry']
    return gm['coordinates'][0] if gm['type'] == 'Polygon' else max(gm['coordinates'], key=lambda p: len(p[0]))[0]

def main():
    SEG = json.load(open(SEG_PATH, encoding='utf-8'))
    g = json.load(open(PARCEL_PATH, encoding='utf-8'))
    axs, ays = [], []
    for f in g['features']:
        if XA and f['properties'].get('Xa') != XA:
            continue
        for c in ring_of(f):
            axs.append(c[0]); ays.append(c[1])
    if not axs:
        print('LỖI: không có thửa nào (kiểm tra XA / PARCELS).'); sys.exit(1)
    x0, x1 = min(axs) - MARGIN, max(axs) + MARGIN
    y0, y1 = min(ays) - MARGIN, max(ays) + MARGIN
    W = int((x1 - x0) * 111320 * math.cos(math.radians((y0 + y1) / 2)) / MPP)
    H = int((y1 - y0) * 110540 / MPP)
    print(f'bbox lon {x0:.5f}..{x1:.5f} lat {y0:.5f}..{y1:.5f}  lưới {W}x{H} @ {MPP}m/px')

    def px(x, y):
        return (int((x - x0) / (x1 - x0) * W), int((1 - (y - y0) / (y1 - y0)) * H))

    wall = Image.new('1', (W, H), 0); dr = ImageDraw.Draw(wall); n = 0
    for s in SEG:
        if max(s[0], s[2]) < x0 or min(s[0], s[2]) > x1 or max(s[1], s[3]) < y0 or min(s[1], s[3]) > y1:
            continue
        dr.line([px(s[0], s[1]), px(s[2], s[3])], fill=1, width=1); n += 1
    wa = np.array(wall, dtype=bool)
    print(f'vẽ {n} đoạn mép đường (tường 1px)')

    filled = np.zeros((H, W), dtype=bool); dq = deque()
    for xx in range(W):
        for yy in (0, H - 1):
            if not wa[yy, xx] and not filled[yy, xx]:
                filled[yy, xx] = True; dq.append((yy, xx))
    for yy in range(H):
        for xx in (0, W - 1):
            if not wa[yy, xx] and not filled[yy, xx]:
                filled[yy, xx] = True; dq.append((yy, xx))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and not wa[ny, nx] and not filled[ny, nx]:
                filled[ny, nx] = True; dq.append((ny, nx))

    road = filled | wa  # đường = lòng loang + mép (pavement-to-pavement)
    print(f'đường chiếm {100 * road.mean():.1f}% diện tích lưới (gồm cả vùng ngoài — thửa nội vùng không bị ảnh hưởng)')

    packed = np.packbits(road, axis=1)
    packed.tofile(os.path.join(DATA, 'road_mask.bin'))
    json.dump({'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'W': W, 'H': H,
               'rowbytes': int(packed.shape[1]), 'mpp': MPP},
              open(os.path.join(DATA, 'road_mask.json'), 'w'))
    print(f"XUẤT {DATA}/road_mask.bin ({os.path.getsize(DATA + '/road_mask.bin') // 1024} KB) + road_mask.json")

if __name__ == '__main__':
    main()
