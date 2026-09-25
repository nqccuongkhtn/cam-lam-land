# -*- coding: utf-8 -*-
"""
TÁCH NỀN HAI TẤM ẢNH TẾT CHỦ DỰ ÁN GỬI
=======================================
Chủ dự án gửi hai tấm để ghép vào logo Tết Nguyên đán:
  · cành mai vàng có tràng pháo đỏ;
  · mâm Tết: dưa hấu dán chữ "Xuân", bánh chưng, cành đào.

Hai tấm đều là ảnh CHỤP MÀN HÌNH nên nền không trong suốt thật:
  · tấm cành mai: nền là Ô CỜ CARO trắng–xám (kiểu ô bàn cờ mà phần mềm vẽ ra
    để BÁO là trong suốt) — lưu thành ảnh thì ô cờ đó thành màu thật;
  · tấm mâm Tết: nền trắng trơn.

Cách tách: một điểm bị coi là NỀN khi nó gần như không có màu (đỏ, xanh lục,
xanh lam xấp xỉ bằng nhau) VÀ rất sáng. Hoa mai vàng, pháo đỏ, cành nâu, lá
xanh, dưa hấu… đều có màu rõ nên không bị tách nhầm. Riêng mấy mảng trắng NẰM
BÊN TRONG hình (ruột dưa loang sáng, vệt bóng) thì giữ lại: chỉ xoá phần nền
NỐI LIỀN được ra mép ảnh.

Chạy:  python scripts/tach-nen-anh-tet.py
"""
import os
from collections import deque

import numpy as np
from PIL import Image

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'scripts', 'anh')
NGUON = os.path.join(os.path.expanduser('~'), '.claude', 'image-cache',
                     '100d2661-4499-430f-ad1a-b814e9751851')

# Cột thứ ba = có "loang từ mép vào" hay không.
#   · cành mai: nền là Ô CỜ CARO nên mấy ô lọt THỎM giữa chùm hoa cũng là nền,
#     loang từ mép vào thì không tới được → còn nguyên mấy mảng caro giữa hoa.
#     Hoa mai vàng, pháo đỏ, cành nâu đều có màu rõ nên xoá thẳng mọi điểm
#     trắng–xám là sạch, không sợ ăn nhầm.
#   · mâm Tết: nền trắng trơn nhưng BÊN TRONG hình có mảng trắng thật (vệt
#     bóng trên vỏ dưa, ruột dưa loang sáng) → phải loang từ mép vào mới giữ
#     được mấy mảng đó.
VIEC = [('14.png', 'tet-mai.png', False), ('15.png', 'tet-mam.png', True)]

SANG = 224      # từ mức này trở lên coi là "sáng"
LECH = 26       # ba kênh màu lệch nhau dưới mức này coi là "không có màu"


def tach(duong_vao, duong_ra, loang=True):
    im = Image.open(duong_vao).convert('RGBA')
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    cao_nhat = np.maximum(np.maximum(r, g), b)
    thap_nhat = np.minimum(np.minimum(r, g), b)
    nhat = (thap_nhat >= SANG) & ((cao_nhat - thap_nhat) <= LECH)

    h, w = nhat.shape
    if not loang:
        nen = nhat
        ra = np.array(im)
        ra[..., 3] = np.where(nen, 0, 255)
        out = Image.fromarray(ra)
        bb = out.getchannel('A').getbbox()
        if bb:
            out = out.crop(bb)
        out.save(duong_ra)
        return out.size, int(nen.sum()), h * w

    # Chỉ xoá phần nền nối liền ra được MÉP ảnh (loang từ bốn cạnh vào).
    nen = np.zeros_like(nhat)
    hang_doi = deque()
    for x in range(w):
        for y in (0, h - 1):
            if nhat[y, x] and not nen[y, x]:
                nen[y, x] = True; hang_doi.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if nhat[y, x] and not nen[y, x]:
                nen[y, x] = True; hang_doi.append((y, x))
    while hang_doi:
        y, x = hang_doi.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and nhat[ny, nx] and not nen[ny, nx]:
                nen[ny, nx] = True
                hang_doi.append((ny, nx))

    ra = np.array(im)
    ra[..., 3] = np.where(nen, 0, 255)
    out = Image.fromarray(ra)
    bb = out.getchannel('A').getbbox()
    if bb:
        out = out.crop(bb)
    out.save(duong_ra)
    return out.size, int(nen.sum()), h * w


def main():
    os.makedirs(RA, exist_ok=True)
    for vao, ten, loang in VIEC:
        p = os.path.join(NGUON, vao)
        if not os.path.exists(p):
            print('KHÔNG THẤY', p, '— bỏ qua')
            continue
        kho, bo, tong = tach(p, os.path.join(RA, ten), loang)
        print('OK %-14s còn %sx%s, xoá %.0f%% nền' % (ten, kho[0], kho[1], 100.0 * bo / tong))


if __name__ == '__main__':
    main()
