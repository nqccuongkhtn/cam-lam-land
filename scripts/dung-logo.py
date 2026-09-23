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
from PIL import Image, ImageFilter

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-cam-lam.webp')          # nen TOI
RA_TOI = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-cam-lam-toi.webp')  # nen SANG
# Ban RUT GON cho thanh menu: chi giu NGOI NHA + chu long CL, bo mat troi va
# song. Logo day du co bon chi tiet, thu ve 44px la chat; ban rut gon thi can
# nha chiem tron chieu cao nen net to hon khoang mot nua, nhin thoang han.
RA_GON = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-gon.webp')
RA_GON_TOI = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-gon-toi.webp')
# Phan can nha nam o dau trong bieu tuong (tinh theo ti le cua bieu tuong):
# tu mep tren xuong 77% chieu cao, va 82% be ngang ke tu trai.
GON_NGANG, GON_DOC = 0.81, 0.735

# ⚠️ DUNG HAI BAN MAU, KHONG PHAI MOT.
#    Thanh menu co hai trang thai: trong suot tren nen banner (toi) va mau
#    trang khi cuon xuong. Mot ban mau thi kieu gi cung co mot trang thai bi
#    chim. Nen dung ra hai tep: net trang cho nen toi, net navy cho nen sang.
NET_SANG = (250, 251, 252)     # trang nga  — dung tren nen toi
NET_TOI = (19, 52, 89)         # navy goc   — dung tren nen sang
TROI_SANG = (229, 188, 98)
TROI_TOI = (198, 158, 73)

# ── VANG KEM: cho logo do trang trơ, nhung KHONG phoi het ──────────────────
# Chu du an: "phoi them mau vang kem nhe vao de do trang nhung k phai phoi het
# lam cho no nghe thuat". Nen lam kieu CHUYEN MAU DUNG: phan tren cua ngoi nha
# giu trang nga, cang xuong gan bai cat cang ngả sang kem — nhin nhu nang chieu
# len tuong nha. Hai phan ba tren van trang nen chu CL doc ro nhu cu.
KEM = (238, 214, 164)
# Chuyen mau bat dau o 60% chieu cao va an het trong 20% tiep theo.
KEM_TU, KEM_DAI = 0.60, 0.20

# ── LAM DAY NET NHA ────────────────────────────────────────────────────────
# ⚠️ Chu du an: "net nha hoi manh so voi phan con lai nhin logo bi yeu".
#    Dung — do song bien va mat troi la MANG DAC, con ngoi nha chi la NET VIEN
#    day ~33/749 = 4,4% be ngang, thu ve 67px thi con chua toi 3 cham -> nhin
#    mong manh han so voi mang cat vang ben duoi.
#    Cach chua: no net nha ra (phep gian anh), roi lam mem vien lai.
#    ⚠️ DUNG QUA 9. Da thu: 11 la nut chu "C" bat dau bit lai, 15 thi chu CL
#       dinh liền vao tuong, khong doc duoc nua. 7 la vua dep.
DAY_NET = 7

# ⛔ DA TAT: tung to chu long "CL" mau do (dung mau nut "Dang nhap") cho logo
#    do don dieu, nhung chu du an xem roi noi "mau do khong hop" -> tat di.
#    Bat lai thi doi DUNG_DO = True.
DUNG_DO = False
DO_SANG = (239, 68, 68)        # tren nen toi thi do hoi sang cho noi
DO_TOI = (220, 38, 38)         # tren nen sang thi do dam hon
# Khung chua RIENG chu CL trong bieu tuong (do tren anh goc 749x501).
# Trong khung nay khong dinh net nao cua mai hay tuong — da kiem tra tung canh.
CL_KHUNG = (122, 163, 470, 381)
KHO = 288


def no_net(a):
    """No net nha ra cho day dan roi lam mem vien lai (xem chu thich DAY_NET)."""
    if DAY_NET < 3:
        return a
    im = Image.fromarray((a * 255).astype(np.uint8), 'L')
    im = im.filter(ImageFilter.MaxFilter(DAY_NET)).filter(ImageFilter.GaussianBlur(0.6))
    return np.asarray(im).astype(np.float32) / 255.0


def ghep(a_nha, a_vang, yy, cao_goc, net, kem, troi, do, vung_cl):
    """Ghep net nha (co chuyen mau trang -> kem) len tren song bien mau vang."""
    t = np.clip((yy - cao_goc * KEM_TU) / (cao_goc * KEM_DAI), 0, 1)[..., None]
    mau = np.array(net, np.float32) * (1 - t) + np.array(kem, np.float32) * t
    if do is not None:
        mau = np.where(vung_cl[..., None], np.array(do, np.float32), mau)
    # Cho nao net nha day hon thi net nha nam TREN, con lai la song/mat troi.
    tren = (a_nha >= a_vang)[..., None]
    r = np.where(tren, mau, np.array(troi, np.float32))
    a = np.clip(np.maximum(a_nha, a_vang), 0, 1)
    return Image.fromarray(np.dstack([r.astype(np.uint8), (a * 255).astype(np.uint8)]), 'RGBA')


def ghi(out, duong):
    bb = out.getbbox()
    if bb:
        out = out.crop(bb)
    rong = int(round(KHO * out.width / out.height))
    out = out.resize((rong, KHO), Image.LANCZOS)
    out.save(duong, 'WEBP', quality=94, method=6)
    print('OK %s  %d KB  (%dx%d)'
          % (os.path.basename(duong), os.path.getsize(duong) // 1024, rong, KHO))


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

    # 3. Tach rieng HAI MANG: net nha (von mau navy) va song + mat troi (von vang)
    xanh = rgb[:, :, 2] > rgb[:, :, 0] + 12

    # ⚠️ CẮT SÁT, ĐỪNG ĐỘN THÀNH HÌNH VUÔNG.
    #    Biểu tượng bè ngang (tỉ lệ ~1,52). Độn cho vuông là phí mất hơn một
    #    phần ba chiều cao, hình vẽ bị thu nhỏ và nhìn rối.
    H, W = alp.shape
    yy, xx = np.mgrid[0:H, 0:W]
    vung_cl = ((xx >= CL_KHUNG[0]) & (xx <= CL_KHUNG[2])
               & (yy >= CL_KHUNG[1]) & (yy <= CL_KHUNG[3]))

    a_nha = no_net(alp * xanh)       # net nha da no day
    a_vang = alp * (~xanh)           # song bien + mat troi, giu nguyen

    for duong, net, kem, troi, do in (
            (RA, NET_SANG, KEM, TROI_SANG, DO_SANG),
            (RA_TOI, NET_TOI, NET_TOI, TROI_TOI, DO_TOI)):
        out = ghep(a_nha, a_vang, yy, H, net, kem, troi,
                   do if DUNG_DO else None, vung_cl)
        ghi(out, duong)

    # ── Bản RÚT GỌN: cắt lấy phần ngôi nhà, bỏ mặt trời và sóng ─────────────
    cao, rongc = int(H * GON_DOC), int(W * GON_NGANG)
    for duong, net, kem, troi, do in (
            (RA_GON, NET_SANG, KEM, TROI_SANG, DO_SANG),
            (RA_GON_TOI, NET_TOI, NET_TOI, TROI_TOI, DO_TOI)):
        out = ghep(a_nha[:cao, :rongc], np.zeros((cao, rongc), np.float32),
                   yy[:cao, :rongc], H, net, kem, troi,
                   do if DUNG_DO else None, vung_cl[:cao, :rongc])
        ghi(out, duong)


if __name__ == '__main__':
    main()
