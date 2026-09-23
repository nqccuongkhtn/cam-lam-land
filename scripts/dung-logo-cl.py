# -*- coding: utf-8 -*-
"""
DUNG TEP LOGO "CL" (MAU 7) CHO THANH MENU
==========================================
Chu du an chon MAU 7 trong bang 10 mau gui qua chat: chu long **CL** —
chu C la vanh trang khuyet mau navy, chu L nam long trong do mau vang dong.
Yeu cau: **bo hai dong chu "CAM LAM / NHA DAT"**, chi lay rieng hinh chu long.

Vi sao phai viet script chu khong cat tay: anh goc la anh CHUP CA BANG 10 MAU,
nen den, moi mau mot o. Cat tay thi (a) lech, (b) vien den con dinh lai quanh
net chu -> dat len thanh menu mau navy la thay mot mang den vuong.

Script nay:
  1. cat dung o cua mau 7 roi tu do TIM DAI TRONG dai nhat de bo phan chu ben
     duoi — khong ghi cung toa do, doi anh khac van chay;
  2. doi nen den thanh TRONG SUOT theo kieu doc thoai (xem chu thich ben duoi);
  3. ghi ra HAI BAN MAU:
       · logo-cam-lam.webp      — dung khi thanh menu trong suot tren nen banner
                                  (net navy doi thanh trang nga, chu L giu vang);
       · logo-cam-lam-toi.webp  — dung khi cuon xuong, thanh menu nen trang
                                  (giu nguyen navy + vang nhu ban thiet ke).

⚠️ BAN LOGO CU (ngoi nha + song bien + mat troi) dung bang scripts/dung-logo.py.
   Hai script ghi RA CUNG MOT TEN TEP. Muon quay ve logo cu thi chay lai
   dung-logo.py voi anh goc cua no.

Chay:  python scripts/dung-logo-cl.py <anh-bang-10-mau.png>
"""
import os
import sys

import numpy as np
from PIL import Image

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-cam-lam.webp')          # nen TOI
RA_TOI = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-cam-lam-toi.webp')  # nen SANG

# O cua mau 7 trong bang 10 mau (do tren anh 1536x1024: 5 cot x 2 hang).
O_MAU7 = (350, 590, 590, 800)

NET_SANG = (250, 251, 252)     # trang nga — net navy doi sang mau nay khi nen toi
VANG_SANG = (226, 178, 92)     # chu L tren nen toi: vang sang hon mot chut
NET_TOI = (20, 52, 88)         # navy goc — giu nguyen khi nen sang
VANG_TOI = (198, 158, 73)

KHO = 288                      # chieu cao tep xuat ra (du net cho khung 44px man net cao)


def tach_hinh(anh):
    """Bo phan chu 'CAM LAM / NHA DAT' ben duoi, chi giu chu long CL."""
    a = np.asarray(anh).astype(np.float32)
    co_hinh = a.max(axis=2) > 40
    dong = co_hinh.sum(axis=1)
    # tim dai trong dai nhat -> do la khoang cach giua hinh va dong chu
    doan, s = [], None
    for i, n in enumerate(dong):
        if n == 0:
            if s is None:
                s = i
        else:
            if s is not None and i - s >= 4:
                doan.append((s, i))
            s = None
    co = np.nonzero(dong)[0]
    tren, duoi = int(co.min()), int(co.max()) + 1
    for s, e in doan:
        if s > tren + 10:          # dai trong dau tien nam duoi phan hinh
            duoi = s
            break
    cot = np.nonzero(co_hinh[tren:duoi].sum(axis=0))[0]
    return (int(cot.min()), tren, int(cot.max()) + 1, duoi)


def main():
    if len(sys.argv) < 2:
        raise SystemExit('Cach dung: python scripts/dung-logo-cl.py <anh-bang-10-mau.png>')
    im = Image.open(sys.argv[1]).convert('RGB').crop(O_MAU7)
    khung = tach_hinh(im)
    print('Cat chu long CL o khung', khung, '(trong o mau 7)')
    c = np.asarray(im.crop(khung)).astype(np.float32)

    # ── Nen den -> trong suot, DOC THOAI chu dung cat dut ──────────────────
    # ⚠️ Da vap o ban logo truoc: dat nguong gat (vd 14->60) thi vien chu bi
    #    rang cua, thu ve 44px nhin rat tho. Nay doc tu 8 den 48 roi them gamma
    #    0,85 cho vien mem dan; chia lai mau cho khoi bi den keo xuong.
    L = c.max(axis=2)
    alp = np.clip((L - 8) / 40.0, 0, 1) ** 0.85
    k = np.where(alp[..., None] > 0.04, np.minimum(1.0 / np.maximum(alp[..., None], 0.04), 4.0), 1.0)
    rgb = np.clip(c * k, 0, 255)

    # Tach hai net: chu C mau navy (xanh nhieu hon do), chu L mau vang (do nhieu hon xanh)
    xanh = rgb[:, :, 2] > rgb[:, :, 0] + 10

    for duong, net, vang in ((RA, NET_SANG, VANG_SANG), (RA_TOI, NET_TOI, VANG_TOI)):
        r = np.empty_like(rgb)
        r[:] = np.array(vang, np.float32)
        r[xanh] = net
        out = Image.fromarray(np.dstack([r.astype(np.uint8), (alp * 255).astype(np.uint8)]), 'RGBA')
        bb = out.getbbox()
        if bb:
            out = out.crop(bb)
        rong = int(round(KHO * out.width / out.height))
        out = out.resize((rong, KHO), Image.LANCZOS)
        out.save(duong, 'WEBP', quality=94, method=6)
        print('OK %s  %d KB  (%dx%d)  ti le %.3f'
              % (os.path.basename(duong), os.path.getsize(duong) // 1024,
                 rong, KHO, rong / KHO))


if __name__ == '__main__':
    main()
