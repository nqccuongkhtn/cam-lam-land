# -*- coding: utf-8 -*-
"""
DUNG TEP LOGO CHO THANH MENU
=============================
Logo goc chu du an gui la anh vuong nen den, gom BIEU TUONG (ngoi nha + chu
long CL + mat troi + song) va hai dong chu "CAM LAM / NHA DAT" o duoi.

Script nay:
  1. cat rieng phan BIEU TUONG, bo hai dong chu (cho do da co ten thuong hieu
     viet chu ngay ben canh trong thanh menu);
  2. doi nen den thanh TRONG SUOT;
  3. DOI MAU net tu navy sang VANG THUONG HIEU — vi khung logo tren web co nen
     navy (mau chu dao), de nguyen mau navy la chim nghim khong thay gi;
  4. ghi ra apps/frontend/public/logo-cam-lam.webp (288x288, du net cho khung
     36px tren man hinh net cao).

Chay:  python scripts/dung-logo.py <duong-dan-anh-logo-goc.png>
"""
import os
import sys

import numpy as np
from PIL import Image

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-cam-lam.webp')          # nen TOI
RA_TOI = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-cam-lam-toi.webp')  # nen SANG

# ⚠️ DUNG HAI BAN MAU, KHONG PHAI MOT.
#    Thanh menu co hai trang thai: trong suot tren nen banner (toi) va mau
#    trang khi cuon xuong. Mot ban mau thi kieu gi cung co mot trang thai bi
#    chim. Nen dung ra hai tep: net trang cho nen toi, net navy cho nen sang.
NET_SANG = (250, 251, 252)     # trang nga  — dung tren nen toi
TROI_SANG = (229, 188, 98)
NET_TOI = (19, 52, 89)         # navy goc   — dung tren nen sang
TROI_TOI = (198, 158, 73)
KHO = 288


def main():
    if len(sys.argv) < 2:
        raise SystemExit('Cach dung: python scripts/dung-logo.py <anh-logo-goc.png>')
    im = Image.open(sys.argv[1]).convert('RGB')
    a = np.asarray(im)

    # 1. Tim phan co hinh, roi tim DAI TRONG dai nhat de tach bieu tuong khoi chu
    co_hinh = a.sum(axis=2) > 60
    dong = co_hinh.sum(axis=1)
    doan, s = [], None
    for i, n in enumerate(dong):
        if n == 0:
            if s is None:
                s = i
        else:
            if s is not None and i - s > 12:
                doan.append((s, i))
            s = None
    tren = doan[0][1] if doan else 0                 # het dai trong dau tien
    duoi = doan[1][0] if len(doan) > 1 else len(dong)
    cot = np.nonzero(co_hinh[tren:duoi].sum(axis=0))[0]
    b = 10
    khung = (max(0, cot.min() - b), max(0, tren - b),
             min(a.shape[1], cot.max() + b), min(a.shape[0], duoi + b))
    print('Cat bieu tuong o khung', khung)

    c = np.asarray(im.crop(khung)).astype(np.float32)

    # 2. Nen den -> trong suot.
    #    ⚠️ DOC MUOT, DUNG CAT DUT. Truoc day dung nguong 14->60 rat gat nen vien
    #    chu va vien mai bi rang cua, logo nhin tho. Nay doc thoai tu 8 den 48
    #    va them gamma 0,85 cho vien mem dan.
    L = c.max(axis=2)
    alp = np.clip((L - 8) / 40.0, 0, 1) ** 0.85
    k = np.where(alp[..., None] > 0.04, np.minimum(1.0 / np.maximum(alp[..., None], 0.04), 4.0), 1.0)
    rgb = np.clip(c * k, 0, 255)

    # 3. Doi mau net: mot ban cho nen toi, mot ban cho nen sang
    xanh = rgb[:, :, 2] > rgb[:, :, 0] + 12

    # ⚠️ CẮT SÁT, ĐỪNG ĐỘN THÀNH HÌNH VUÔNG.
    #    Biểu tượng bè ngang (tỉ lệ ~1,52). Độn cho vuông là phí mất hơn một
    #    phần ba chiều cao, hình vẽ bị thu nhỏ và nhìn rối.
    for duong, net, troi in ((RA, NET_SANG, TROI_SANG), (RA_TOI, NET_TOI, TROI_TOI)):
        r = rgb.copy()
        r[xanh] = net
        r[(~xanh) & (alp > 0.04)] = troi
        out = Image.fromarray(np.dstack([r.astype(np.uint8), (alp * 255).astype(np.uint8)]), 'RGBA')
        bb = out.getbbox()
        if bb:
            out = out.crop(bb)
        rong = int(round(KHO * out.width / out.height))
        out = out.resize((rong, KHO), Image.LANCZOS)
        out.save(duong, 'WEBP', quality=94, method=6)
        print('OK %s  %d KB  (%dx%d)'
              % (os.path.basename(duong), os.path.getsize(duong) // 1024, rong, KHO))
    print('OK %s  %d KB' % (os.path.basename(RA), os.path.getsize(RA) // 1024))


if __name__ == '__main__':
    main()
