# -*- coding: utf-8 -*-
"""
TÁCH NỀN ẢNH MINH HOẠ CHO LOGO NGÀY LỄ
=======================================
Chủ dự án gửi ảnh minh hoạ (ảnh vẽ, nền một màu phẳng) và dặn cắt lấy nhân vật
để ghép vào logo. Script này lo phần cắt nền.

Khác `tach-nen-anh-tet.py` ở chỗ: bên đó nền là TRẮNG hoặc ô cờ caro, còn đây
nền có thể là MỘT MÀU BẤT KỲ (cam, xanh…). Cách làm: lấy màu ở bốn góc làm
"màu nền", rồi loang từ mép ảnh vào, xoá mọi điểm gần giống màu đó.

⚠️ CHỈ XOÁ PHẦN NỀN NỐI LIỀN RA ĐƯỢC MÉP. Nhân vật cũng có mảng màu cam gần
   giống nền (con cá chép), xoá theo màu là thủng cả mình cá.

Chạy:  python scripts/tach-nen-anh-le.py
"""
import os
from collections import deque

import numpy as np
from PIL import Image

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'scripts', 'anh')
NGUON = os.path.join(os.path.expanduser('~'), '.claude', 'image-cache',
                     '100d2661-4499-430f-ad1a-b814e9751851')

# (tệp nguồn, tên tệp ra, sai số màu cho phép)
# ⚠️ Sai số để 22 thôi. Để 40 thì ĐỒNG TIỀN VÀNG sau đầu cá (màu vàng
#    nhạt, gần giống nền cam) bị ăn mất gần hết.
VIEC = [('30.png', 'ong-tao.png', 22)]


def tach(duong_vao, duong_ra, sai_so):
    im = Image.open(duong_vao).convert('RGBA')
    a = np.asarray(im).astype(np.int16)
    h, w = a.shape[:2]

    # Màu nền = màu hay gặp nhất ở bốn góc.
    goc = [tuple(a[y, x, :3]) for y, x in
           ((2, 2), (2, w - 3), (h - 3, 2), (h - 3, w - 3))]
    nen_mau = max(set(goc), key=goc.count)

    lech = np.abs(a[..., :3] - np.array(nen_mau)).sum(axis=2)
    giong = lech <= sai_so

    nen = np.zeros_like(giong)
    hang_doi = deque()
    for x in range(w):
        for y in (0, h - 1):
            if giong[y, x] and not nen[y, x]:
                nen[y, x] = True; hang_doi.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if giong[y, x] and not nen[y, x]:
                nen[y, x] = True; hang_doi.append((y, x))
    while hang_doi:
        y, x = hang_doi.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and giong[ny, nx] and not nen[ny, nx]:
                nen[ny, nx] = True
                hang_doi.append((ny, nx))

    ra = np.array(im)
    ra[..., 3] = np.where(nen, 0, 255)
    out = Image.fromarray(ra)
    bb = out.getchannel('A').getbbox()
    if bb:
        out = out.crop(bb)
    out.save(duong_ra)
    return out.size, nen_mau, int(nen.sum()), h * w


def main():
    os.makedirs(RA, exist_ok=True)
    for vao, ten, sai_so in VIEC:
        p = os.path.join(NGUON, vao)
        if not os.path.exists(p):
            print('KHÔNG THẤY', p, '— bỏ qua')
            continue
        kho, mau, bo, tong = tach(p, os.path.join(RA, ten), sai_so)
        print('OK %-14s nền %s · còn %sx%s · xoá %.0f%%'
              % (ten, mau, kho[0], kho[1], 100.0 * bo / tong))


if __name__ == '__main__':
    main()
