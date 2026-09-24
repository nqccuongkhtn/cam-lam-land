# -*- coding: utf-8 -*-
"""
ẢNH XEM NHANH LOGO ĐANG DÙNG
=============================
Mở một đường dẫn là thấy ngay logo chính thức hiện tại nằm trên ba loại nền
mà nó thật sự phải đứng: dải tối của banner trang chủ, thanh menu trắng khi
cuộn xuống, và nền navy đặc.

Mỗi nền có bản to + bản CỠ THẬT 34px — cỡ thật mới biết logo có bị chìm không.

Chạy:  python scripts/xem-logo-dang-dung.py
       → apps/frontend/public/logo-thu/xem-logo-dang-dung.png
"""
import os

from PIL import Image, ImageDraw, ImageFont

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CONG = os.path.join(GOC, 'apps', 'frontend', 'public')

O, KE = 104, 34
COT, HANG = 250, 150


def _font(co, dam=False):
    for ten in (('seguisb.ttf', 'segoeui.ttf') if dam else ('segoeui.ttf',)):
        try:
            return ImageFont.truetype('C:/Windows/Fonts/' + ten, int(co))
        except Exception:
            pass
    return ImageFont.load_default()


def nen_banner(w, h):
    """Giả lập dải trên cùng của banner trang chủ (ảnh biển + lớp đen mờ 45%)."""
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=(int(21 + 26 * t), int(45 + 48 * t), int(58 + 60 * t)))
    return im


def main():
    # ⚠️ HAI TỆP KHÁC NHAU (viền dày/mảnh) — mỗi nền phải lấy đúng tệp của
    #    nền đó, lấy nhầm là xem không ra cái đang chạy thật.
    sang = Image.open(os.path.join(CONG, 'logo-cam-lam.webp')).convert('RGBA')
    toi = Image.open(os.path.join(CONG, 'logo-cam-lam-toi.webp')).convert('RGBA')
    NEN = [('Trên banner (menu trong suốt)', nen_banner, sang),
           ('Thanh menu trắng (khi cuộn xuống)',
            lambda w, h: Image.new('RGB', (w, h), (255, 255, 255)), toi),
           ('Nền navy đặc', lambda w, h: Image.new('RGB', (w, h), (10, 37, 64)), sang)]

    W = 20 + COT * len(NEN)
    sheet = Image.new('RGB', (W, 34 + HANG + 26), (246, 247, 249))
    d = ImageDraw.Draw(sheet)
    ft, fn = _font(15, True), _font(14)

    for j, (ten, lam, logo) in enumerate(NEN):
        x = 10 + j * COT
        d.text((x + 6, 8), ten, fill=(20, 30, 45), font=ft)
        o = (COT - 16, HANG - 16)
        khung = lam(*o)
        if j == 1:
            ImageDraw.Draw(khung).rectangle([0, 0, o[0] - 1, o[1] - 1], outline=(226, 232, 240))
        for kho, dx in ((O, 18), (KE, 18 + O + 20)):
            s = logo.resize((kho, kho), Image.LANCZOS)
            khung.paste(s, (dx, (o[1] - kho) // 2), s)
        sheet.paste(khung, (x, 30))

    d.text((12, 34 + HANG + 2), 'Hình nhỏ là CỠ THẬT 34px trên thanh menu.',
           fill=(100, 112, 126), font=fn)
    p = os.path.join(CONG, 'logo-thu', 'xem-logo-dang-dung.png')
    sheet.save(p)
    print('OK', p)


if __name__ == '__main__':
    main()
