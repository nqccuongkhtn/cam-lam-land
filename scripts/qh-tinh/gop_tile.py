# -*- coding: utf-8 -*-
# GỘP nhiều bộ tile (nền trong suốt) thành MỘT lớp: ô chỉ có ở một bộ thì chép; ô chung nhiều bộ thì chồng trong suốt
# theo thứ tự tham số (bộ sau nằm trên). Nhận .png lẫn .webp (tiler3.py), ghi ra cùng đuôi.
# 14/10/2026: chồng đúng công thức "over" với alpha KHÔNG nhân trước — tile của tiler3 có viền mờ (alpha lẻ) nên công thức cũ
# (màu ra = màu·alpha) làm sẫm viền ở ô chung.
# Dùng: python -P gop_tile.py <ra_dir> <bo1_dir> <bo2_dir> …  [--cl=90 chất lượng webp]
import sys, os, shutil
import numpy as np, cv2
co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
ra, bo = ts[0], ts[1:]
CL = int(next((a.split('=', 1)[1] for a in co if a.startswith('--cl=')), 90))
gap = {}
for b in bo:
    for root, _, fs in os.walk(b):
        for f in fs:
            if f.endswith(('.png', '.webp')): gap.setdefault(os.path.relpath(os.path.join(root, f), b), []).append(os.path.join(root, f))
chung = 0
for rel, ds in gap.items():
    dich = os.path.join(ra, rel); os.makedirs(os.path.dirname(dich), exist_ok=True)
    if len(ds) == 1: shutil.copyfile(ds[0], dich); continue
    chung += 1
    mau = alpha = None
    for p in ds:
        t = cv2.imread(p, cv2.IMREAD_UNCHANGED).astype(np.float32)
        if t.shape[2] == 3: t = np.dstack([t, np.full(t.shape[:2], 255, np.float32)])
        a = t[:, :, 3:4] / 255.0
        if mau is None: mau, alpha = t[:, :, :3], a; continue
        moi = a + alpha * (1 - a)
        mau = (t[:, :, :3] * a + mau * alpha * (1 - a)) / np.maximum(moi, 1e-6); alpha = moi
    bgra = np.dstack([np.clip(mau + 0.5, 0, 255), np.clip(alpha * 255 + 0.5, 0, 255)]).astype(np.uint8)
    if dich.endswith('.webp'): cv2.imwrite(dich, bgra, [cv2.IMWRITE_WEBP_QUALITY, CL])
    else: cv2.imwrite(dich, bgra)
print(f'gop {len(gap)} o ({chung} o chung nhieu bo) -> {ra}')
