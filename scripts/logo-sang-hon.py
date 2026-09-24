# -*- coding: utf-8 -*-
"""
LÀM LOGO SÁNG LÊN CHO KHỎI CHÌM VÀO NỀN
========================================
Chủ dự án nhìn thanh menu trang chủ và nói "logo hơi tối so với nền".

NGUYÊN NHÂN: ô vuông của logo tô đúng màu navy #0A2540, mà dải trên cùng của
banner cũng bị phủ một lớp đen mờ (`from-black/45` trong Nav.tsx) → hai mảng
tối nằm cạnh nhau, cái ô vuông gần như tan vào nền, chỉ còn thấy nét vàng.

CÁCH CHỮA: nâng độ sáng của NỀN Ô VUÔNG lên vài bậc so với navy gốc, đồng
thời làm nét vàng sáng hơn. Ô vuông vẫn là navy, vẫn đúng nhận diện, nhưng
tách hẳn khỏi nền tối phía sau.

⚠️ ĐỪNG NÂNG SÁNG NÉT VÀNG MÀ GIỮ NGUYÊN NỀN. Đã thử: nét sáng lên thì cái ô
   vuông càng chìm, nhìn như chữ vàng lơ lửng, mất luôn hình khối logo.
⚠️ Phải xem CẢ HAI trạng thái: thanh menu trong suốt trên banner (nền tối) và
   thanh menu trắng khi cuộn xuống (nền trắng). Nền càng sáng thì ở thanh menu
   TRẮNG ô vuông lại càng nhạt đi — mức 3 là giới hạn, quá nữa là xám xịt.

Chạy:  python scripts/logo-sang-hon.py
       → apps/frontend/public/logo-thu/so-sang.png
"""
import importlib.util
import os

from PIL import Image, ImageDraw, ImageFont

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-thu')
HINH = 'mau6m2'          # đúng hình đang dùng (xem scripts/dung-logo-chinh.py)

# (mã, tên, màu nền ô vuông, màu viền trong, kiểu tô nét)
# Nét vàng sáng dần theo nền để hai bên luôn đủ tương phản.
MUC = [
    ('sang0', 'Đang dùng', (10, 37, 64), (255, 233, 176, 120),
     ('chuyen', (255, 236, 186), (200, 161, 75))),
    ('sang1', 'Sáng nhẹ', (19, 52, 89), (255, 233, 176, 150),
     ('chuyen', (255, 240, 198), (214, 175, 88))),
    ('sang2', 'Sáng vừa', (26, 66, 110), (255, 233, 176, 175),
     ('chuyen', (255, 244, 212), (226, 187, 100))),
    ('sang3', 'Sáng nhiều', (33, 81, 132), (255, 233, 176, 200),
     ('chuyen', (255, 248, 224), (236, 199, 116))),
]


def nap_bo_phoi():
    p = os.path.join(GOC, 'scripts', 'phoi-mau-logo.py')
    spec = importlib.util.spec_from_file_location('phoi_mau_logo', p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def _font(co, dam=False):
    for ten in (('seguisb.ttf', 'segoeui.ttf') if dam else ('segoeui.ttf',)):
        try:
            return ImageFont.truetype('C:/Windows/Fonts/' + ten, int(co))
        except Exception:
            pass
    return ImageFont.load_default()


def nen_banner(w, h):
    """Giả lập đúng dải trên cùng của banner trang chủ: ảnh biển xanh bị phủ
    một lớp đen mờ 45%. Đây chính là chỗ logo đang bị chìm."""
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1)
        # xanh biển ngả tối, giống chỗ logo đứng trên trang chủ
        d.line([(0, y), (w, y)], fill=(int(21 + 26 * t), int(45 + 48 * t), int(58 + 60 * t)))
    return im


def main():
    bo = nap_bo_phoi()
    O, KE = 104, 34                     # cỡ xem to và CỠ THẬT trên thanh menu
    COT, HANG = 230, 150
    W = 30 + COT * len(MUC)
    sheet = Image.new('RGB', (W, 30 + HANG * 2 + 26), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    ft, fn = _font(20, True), _font(16)

    for j, m in enumerate(MUC):
        ma, ten, nen, vien, kieu = m
        im = bo.dung_o(HINH, m, 256, 0.66)
        im.save(os.path.join(RA, ma + '.webp'), 'WEBP', quality=95, method=6)
        x = 20 + j * COT
        d.text((x + COT // 2 - 18, 6), ten, fill=(20, 30, 45), font=ft, anchor='ma')
        d.text((x + COT // 2 - 18, 28), '#%02X%02X%02X' % tuple(nen),
               fill=(130, 140, 152), font=fn, anchor='ma')

        for i, lam_nen in enumerate((nen_banner, None)):
            y = 52 + i * HANG
            o = (COT - 26, HANG - 16)
            khung = lam_nen(*o) if lam_nen else Image.new('RGB', o, (255, 255, 255))
            if lam_nen is None:
                ImageDraw.Draw(khung).rectangle([0, 0, o[0] - 1, o[1] - 1], outline=(226, 232, 240))
            for kho, dx in ((O, 16), (KE, 16 + O + 18)):
                s = im.resize((kho, kho), Image.LANCZOS)
                khung.paste(s, (dx, (o[1] - kho) // 2), s)
            sheet.paste(khung, (x, y))

    d.text((20, 52 + 2 * HANG + 2), 'Hàng trên = thanh menu trên banner (nền tối)   ·   '
           'Hàng dưới = thanh menu trắng khi cuộn xuống   ·   Hình nhỏ là CỠ THẬT 34px',
           fill=(100, 112, 126), font=fn)

    p = os.path.join(RA, 'so-sang.png')
    sheet.save(p)
    print('OK', p)


if __name__ == '__main__':
    main()
