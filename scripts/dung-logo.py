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
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-cam-lam.webp')

VANG_NET = (200, 161, 75)      # #C8A14B  — vang thuong hieu
VANG_TROI = (240, 205, 130)    # mat troi de sang hon cho tach bach
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

    # 2. Nen den -> trong suot (do sang chinh la do duc)
    alp = np.clip((c.max(axis=2) - 14) / 46.0, 0, 1)
    k = np.where(alp[..., None] > 0.05, np.minimum(1.0 / np.maximum(alp[..., None], 0.05), 3.0), 1.0)
    rgb = np.clip(c * k, 0, 255)

    # 3. Net navy -> vang; phan von da vang (mat troi) -> vang sang hon
    xanh = rgb[:, :, 2] > rgb[:, :, 0] + 12
    rgb[xanh] = VANG_NET
    rgb[(~xanh) & (alp > 0.05)] = VANG_TROI

    out = Image.fromarray(np.dstack([rgb.astype(np.uint8), (alp * 255).astype(np.uint8)]), 'RGBA')
    # ⚠️ CẮT SÁT, ĐỪNG ĐỘN THÀNH HÌNH VUÔNG.
    #    Biểu tượng bè ngang (730×480). Độn cho vuông là phí mất hơn một phần ba
    #    chiều cao, hình vẽ bị thu nhỏ lại và ở khung 36px nhìn rối tung — chủ
    #    dự án đã nhận xét "logo nhỏ nên hơi rối".
    #    Giữ đúng tỉ lệ thật, khung trên web sẽ làm hơi bè ngang cho khớp.
    khung2 = out.getbbox()
    if khung2:
        out = out.crop(khung2)
    w, h = out.size
    rong = int(round(KHO * w / h))
    out = out.resize((rong, KHO), Image.LANCZOS)
    out.save(RA, 'WEBP', quality=94, method=6)
    print('Ti le ngang/doc = %.3f' % (rong / KHO))
    print('OK %s  %d KB' % (os.path.basename(RA), os.path.getsize(RA) // 1024))


if __name__ == '__main__':
    main()
