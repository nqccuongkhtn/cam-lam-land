# -*- coding: utf-8 -*-
"""
VIỀN VÀNG GOLD SÁNG CHẠY QUANH Ô VUÔNG LOGO
============================================
Chủ dự án chốt cách chữa việc "logo hơi tối so với nền":
**giữ nguyên nền navy gốc, chỉ thêm một đường viền vàng gold sáng bao ngoài**
để phân biệt với nền phía sau.

Vì sao cách này hợp hơn cách nâng sáng nền: nền ô vuông vẫn đúng navy
#0A2540 của thương hiệu, không phải bịa thêm một sắc navy mới; mà đường viền
vàng thì nổi trên MỌI nền — nền tối cũng thấy, nền trắng cũng thấy.

⚠️ VIỀN PHẢI NẰM SÁT MÉP NGOÀI, KHÔNG PHẢI ĐƯỜNG KẺ BÊN TRONG. Bản cũ có một
   đường vàng mảnh kẻ thụt vào 4,5% — nó nằm lọt trong lòng ô navy nên không
   giúp gì cho việc tách logo khỏi nền. Ở đây bỏ hẳn đường kẻ trong đó
   (viền trong để trong suốt) và vẽ viền ôm đúng mép ô.
⚠️ Ô vuông bị THU NHỎ LẠI đúng bằng bề dày viền, vì viền phải có chỗ mà nằm.
   Nên viền càng dày thì phần navy càng bé — quá 7% là nhìn như cái khung
   ảnh, mất dáng logo.
⚠️ Vẽ ở cỡ GẤP 4 rồi mới thu nhỏ. Vẽ thẳng ở 256 thì viền mỏng bị răng cưa,
   xuống cỡ thật 34px là đứt quãng thành nét chấm.

Chạy:  python scripts/logo-vien-gold.py
       → apps/frontend/public/logo-thu/so-vien.png
"""
import importlib.util
import os

from PIL import Image, ImageDraw, ImageFont

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-thu')

NEN = (10, 37, 64)                  # navy gốc của web — GIỮ NGUYÊN
VIEN = (242, 212, 138)              # vàng gold SÁNG, sáng hơn gold đồng #C8A14B
NET = ((255, 236, 186), (200, 161, 75))   # nét chữ chuyển vàng kem → vàng đồng

# (mã, tên, bề dày viền tính theo cạnh ô)
MUC = [
    ('vien1', 'Viền mảnh', 0.030),
    ('vien2', 'Viền vừa', 0.045),
    ('vien3', 'Viền dày', 0.062),
]


def nap_bo_phoi():
    p = os.path.join(GOC, 'scripts', 'phoi-mau-logo.py')
    spec = importlib.util.spec_from_file_location('phoi_mau_logo', p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def dung(bo, hinh: str, day: float, kho: int = 256, chiem: float = 0.66,
         phong: int = 4) -> Image.Image:
    """Dựng ô vuông navy + viền vàng gold sáng ôm mép ngoài."""
    K = kho * phong
    d = max(2, int(round(K * day)))
    ki = K - 2 * d                       # cạnh ô navy bên trong viền
    # viền TRONG để trong suốt hoàn toàn — đường kẻ thụt vào không còn tác dụng
    phoi = ('vien-gold', 'Viền gold', NEN, (0, 0, 0, 0), ('chuyen',) + NET)
    im = Image.new('RGBA', (K, K), (0, 0, 0, 0))
    im.alpha_composite(bo.dung_o(hinh, phoi, ki, chiem), (d, d))
    r = int(ki * bo.BO_GOC) + d
    ImageDraw.Draw(im).rounded_rectangle(
        [0, 0, K - 1, K - 1], radius=r, outline=VIEN + (255,), width=d + 1)
    return im.resize((kho, kho), Image.LANCZOS)


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
    bo = nap_bo_phoi()
    hinh = 'mau6m2'
    O, KE = 104, 34
    COT, HANG = 230, 150
    cot = [('Không viền (đang dùng bản nền sáng)', None)] + [(t, d) for _, t, d in MUC]
    W = 30 + COT * len(cot)
    sheet = Image.new('RGB', (W, 30 + HANG * 2 + 26), (255, 255, 255))
    dr = ImageDraw.Draw(sheet)
    ft, fn = _font(19, True), _font(15)

    for j, (ten, day) in enumerate(cot):
        if day is None:
            phoi = next(p for p in bo.PHOI if p[0] == 'gold-sang')
            im = bo.dung_o(hinh, (phoi[0], phoi[1], NEN, phoi[3], phoi[4]), 256, 0.66)
            ghi = 'nền navy gốc'
        else:
            im = dung(bo, hinh, day)
            ghi = 'dày %.1f%% cạnh' % (day * 100)
            im.save(os.path.join(RA, MUC[j - 1][0] + '.webp'), 'WEBP', quality=95, method=6)
        x = 20 + j * COT
        dr.text((x + COT // 2 - 18, 4), ten, fill=(20, 30, 45), font=ft, anchor='ma')
        dr.text((x + COT // 2 - 18, 27), ghi, fill=(130, 140, 152), font=fn, anchor='ma')

        for i, lam in enumerate((nen_banner, None)):
            y = 52 + i * HANG
            o = (COT - 26, HANG - 16)
            khung = lam(*o) if lam else Image.new('RGB', o, (255, 255, 255))
            if lam is None:
                ImageDraw.Draw(khung).rectangle([0, 0, o[0] - 1, o[1] - 1], outline=(226, 232, 240))
            for kho, dx in ((O, 16), (KE, 16 + O + 18)):
                s = im.resize((kho, kho), Image.LANCZOS)
                khung.paste(s, (dx, (o[1] - kho) // 2), s)
            sheet.paste(khung, (x, y))

    dr.text((20, 52 + 2 * HANG + 2), 'Hàng trên = thanh menu trên banner (nền tối)   ·   '
            'Hàng dưới = thanh menu trắng khi cuộn xuống   ·   Hình nhỏ là CỠ THẬT 34px',
            fill=(100, 112, 126), font=fn)
    p = os.path.join(RA, 'so-vien.png')
    sheet.save(p)
    print('OK', p)


if __name__ == '__main__':
    main()
