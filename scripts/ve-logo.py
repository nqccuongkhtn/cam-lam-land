# -*- coding: utf-8 -*-
"""
VẼ BỘ BIỂU TƯỢNG CAM LÂM LAND từ đúng hình thửa đất của logo.

Logo trên web vẽ bằng SVG (sắc nét ở mọi cỡ). Nhưng biểu tượng để CÀI VÀO MÀN HÌNH
ĐIỆN THOẠI thì Android/iOS bắt buộc phải là ảnh PNG, nên phải vẽ lại y hệt ra ảnh.
Toạ độ dưới đây lấy nguyên từ components/LogoMark.tsx (hệ 44x44) rồi nhân lên,
sửa logo bên đó thì chạy lại tệp này cho khớp.

Chạy:  python scripts/ve-logo.py
"""
import os
from PIL import Image, ImageDraw

RA = os.path.join('apps', 'frontend', 'public', 'icons')
NAVY_1, NAVY_2 = (18, 52, 89), (8, 27, 48)
VANG = (200, 161, 75)

# Toạ độ trong hệ 44x44 của LogoMark.tsx
THUA = [(11.2, 17.2), (29.8, 12.2), (33.2, 27.0), (14.8, 32.4)]
TACH = [(26.6, 13.4), (18.2, 31.4)]
MOC = [(11.2, 17.2), (29.8, 12.2), (33.2, 27.0)]


def nen_doc(kt, bo_tron):
    """Nền chuyển màu chéo từ navy sáng sang navy đậm."""
    nen = Image.new('RGB', (kt, kt))
    d = ImageDraw.Draw(nen)
    for y in range(kt):
        for_x = y / max(kt - 1, 1)
        d.line([(0, y), (kt, y)], fill=tuple(
            int(NAVY_1[i] + (NAVY_2[i] - NAVY_1[i]) * for_x) for i in range(3)))
    if bo_tron:
        mat = Image.new('L', (kt, kt), 0)
        ImageDraw.Draw(mat).rounded_rectangle([0, 0, kt - 1, kt - 1],
                                              radius=int(kt * 12 / 44), fill=255)
        ra = Image.new('RGBA', (kt, kt), (0, 0, 0, 0))
        ra.paste(nen, (0, 0), mat)
        return ra
    return nen.convert('RGBA')


def ve(kt, bo_tron=True, le=0.0):
    """le: chừa mép cho biểu tượng 'maskable' (Android cắt tròn quanh mép)."""
    anh = nen_doc(kt, bo_tron)
    d = ImageDraw.Draw(anh)
    k = kt / 44 * (1 - le * 2)
    dx = kt * le

    def q(p):
        return [(x * k + dx, y * k + dx) for x, y in p]

    day = max(2, int(2.2 * k))

    def lop(mo):
        """Vẽ lên một lớp riêng rồi chồng lên — Pillow KHÔNG tự pha trong suốt,
        vẽ thẳng màu có alpha lên ảnh là nó GHI ĐÈ, nét nào cũng đặc như nhau."""
        l = Image.new('RGBA', anh.size, (0, 0, 0, 0))
        mo(ImageDraw.Draw(l))
        return Image.alpha_composite(anh, l)

    if bo_tron:                      # viền vàng rất mảnh quanh mép
        m = kt * 1.4 / 44
        anh = lop(lambda dd: dd.rounded_rectangle(
            [m, m, kt - 1 - m, kt - 1 - m], radius=int(kt * 10.6 / 44),
            outline=VANG + (90,), width=max(1, int(0.8 * kt / 44))))
    # đường tách thửa — mảnh và mờ hơn hẳn cạnh thửa
    anh = lop(lambda dd: dd.line(q(TACH), fill=VANG + (120,),
                                 width=max(1, int(day * 0.42))))
    d = ImageDraw.Draw(anh)
    # thửa đất
    d.line(q(THUA) + [q(THUA)[0]], fill=VANG, width=day, joint='curve')
    # mốc giới
    r = day * 0.72
    for x, y in q(MOC):
        d.ellipse([x - r, y - r, x + r, y + r], fill=VANG)
    return anh


def lam():
    os.makedirs(RA, exist_ok=True)
    bo = [('icon-192.png', 192, True, 0.0),
          ('icon-512.png', 512, True, 0.0),
          ('icon-512-maskable.png', 512, False, 0.14),
          ('apple-180.png', 180, True, 0.0)]
    for ten, kt, tron, le in bo:
        # vẽ to gấp 4 rồi thu nhỏ -> nét mượt, không răng cưa
        a = ve(kt * 4, tron, le).resize((kt, kt), Image.LANCZOS)
        p = os.path.join(RA, ten)
        a.save(p)
        print('  %-24s %dx%d  %d KB' % (ten, kt, kt, os.path.getsize(p) // 1024))


if __name__ == '__main__':
    lam()
