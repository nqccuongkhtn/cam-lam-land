# -*- coding: utf-8 -*-
# GỘP nhiều bộ tile (nền trong suốt) thành MỘT lớp: ô chỉ có ở một bộ thì chép; ô chung nhiều bộ thì chồng trong suốt (alpha)
# theo thứ tự tham số (bộ sau nằm trên). Dùng: python -P gop_tile.py <ra_dir> <bo1_dir> <bo2_dir> …
import sys, os, shutil
import numpy as np, cv2
ra, bo = sys.argv[1], sys.argv[2:]
gap = {}
for b in bo:
    for root, _, fs in os.walk(b):
        for f in fs:
            if f.endswith('.png'): gap.setdefault(os.path.relpath(os.path.join(root, f), b), []).append(os.path.join(root, f))
chung = 0
for rel, ds in gap.items():
    dich = os.path.join(ra, rel); os.makedirs(os.path.dirname(dich), exist_ok=True)
    if len(ds) == 1: shutil.copyfile(ds[0], dich); continue
    chung += 1
    out = np.zeros((256, 256, 4), np.float32)
    for p in ds:
        t = cv2.imread(p, cv2.IMREAD_UNCHANGED).astype(np.float32)
        if t.shape[2] == 3: t = np.dstack([t, np.full((256, 256), 255, np.float32)])
        a = t[:, :, 3:4] / 255.0
        out[:, :, :3] = out[:, :, :3] * (1 - a) + t[:, :, :3] * a
        out[:, :, 3:4] = out[:, :, 3:4] * (1 - a) + 255 * a
    cv2.imwrite(dich, out.astype(np.uint8))
print(f'gop {len(gap)} o ({chung} o chung nhieu bo) -> {ra}')
