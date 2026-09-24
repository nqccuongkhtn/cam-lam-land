# -*- coding: utf-8 -*-
"""
DỰNG LOGO Ô VUÔNG NAVY — NGÔI NHÀ VÀNG CÓ CHẤM TRÒN
====================================================
Đây là logo GỐC của web, cái đã dùng từ đầu: một ô vuông bo góc nền navy, bên
trong là nét ngôi nhà màu vàng đồng, giữa nhà có một chấm tròn vàng.

Trước đây hình này được VẼ TAY BẰNG SVG ở chín chỗ khác nhau trong mã (thanh
menu, ô đăng nhập, phiếu trích lục, hợp đồng…). Nay dựng ra TỆP ẢNH để mọi nơi
dùng chung một hình — xem chú thích trong components/LogoAnh.tsx.

⚠️ Ô VUÔNG NÀY TỰ CÓ NỀN nên KHÔNG cần hai bản màu như logo ảnh chụp: đặt trên
   nền tối hay nền sáng đều đọc được. Vẫn ghi ra hai tên tệp (…-toi) cho khớp
   với chỗ gọi, nội dung hai tệp giống hệt nhau.

Chạy:  python scripts/dung-logo-o-vuong.py
"""
import os

from PIL import Image, ImageDraw

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CONG = os.path.join(GOC, 'apps', 'frontend', 'public')

KHO = 256          # cạnh tệp xuất ra
PHONG = 6          # vẽ ở cỡ gấp 6 rồi thu lại cho mượt

# Màu lấy đúng từ bản SVG cũ trong mã
NAVY_TREN = (18, 52, 89)       # #123459
NAVY_DUOI = (8, 27, 48)        # #081B30
VANG = (200, 161, 75)          # #C8A14B


def ve(kho: int) -> Image.Image:
    """Vẽ một tấm logo cạnh `kho` điểm ảnh. Toạ độ theo hệ 44×44 của bản SVG cũ."""
    n = kho * PHONG
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = n / 44.0                      # đổi từ hệ 44×44 sang điểm ảnh thật

    # ── Nền: ô vuông bo góc, chuyển màu navy từ sáng (trên) xuống tối (dưới) ──
    nen = Image.new('RGB', (1, n))
    for y in range(n):
        t = y / max(1, n - 1)
        nen.putpixel((0, y), tuple(int(NAVY_TREN[i] * (1 - t) + NAVY_DUOI[i] * t)
                                   for i in range(3)))
    nen = nen.resize((n, n))
    khuon = Image.new('L', (n, n), 0)
    ImageDraw.Draw(khuon).rounded_rectangle([0, 0, n - 1, n - 1],
                                            radius=int(12 * k), fill=255)
    im.paste(nen, (0, 0), khuon)

    # ── Viền vàng mảnh bên trong ──
    d.rounded_rectangle([1.2 * k, 1.2 * k, 42.8 * k, 42.8 * k],
                        radius=10.8 * k, outline=VANG + (115,),
                        width=max(1, int(1.2 * k)))

    # ── Ngôi nhà: mái hình chữ V ngược + thân hình hộp hở nóc ──
    # ⚠️ Nét bo TRÒN ở đầu và ở khớp. Để nét vuông thì ba đầu nét nhọn hoắt,
    #    thu về 32 điểm ảnh nhìn lởm chởm.
    day = int(2.4 * k)
    d.line([(11 * k, 21.5 * k), (22 * k, 12 * k), (33 * k, 21.5 * k)],
           fill=VANG, width=day, joint='curve')
    d.line([(14.2 * k, 20 * k), (14.2 * k, 31.4 * k),
            (29.8 * k, 31.4 * k), (29.8 * k, 20 * k)],
           fill=VANG, width=day, joint='curve')
    for x, y in ((11, 21.5), (33, 21.5), (22, 12),
                 (14.2, 20), (29.8, 20), (14.2, 31.4), (29.8, 31.4)):
        r = day / 2
        d.ellipse([x * k - r, y * k - r, x * k + r, y * k + r], fill=VANG)

    # ── Chấm tròn giữa nhà ──
    r = 2.5 * k
    d.ellipse([22 * k - r, 25.6 * k - r, 22 * k + r, 25.6 * k + r], fill=VANG)

    return im.resize((kho, kho), Image.LANCZOS)


def main():
    anh = ve(KHO)
    for ten in ('logo-cam-lam.webp', 'logo-cam-lam-toi.webp'):
        p = os.path.join(CONG, ten)
        anh.save(p, 'WEBP', quality=95, method=6)
        print('OK %-22s %dx%d  %d KB' % (ten, KHO, KHO, os.path.getsize(p) // 1024))

    # xem thử ở cỡ THẬT trên thanh menu, trên cả hai nền
    thu = Image.new('RGB', (520, 150), (255, 255, 255))
    thu.paste(Image.new('RGB', (260, 150), (10, 37, 64)), (0, 0))
    for x0 in (0, 260):
        for kho, dx in ((96, 24), (44, 140), (32, 196)):
            s = anh.resize((kho, kho), Image.LANCZOS)
            thu.paste(s, (x0 + dx, (150 - kho) // 2), s)
    p = os.path.join(GOC, 'scripts', 'anh', '_xem-logo-o-vuong.png')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    thu.save(p)
    print('Anh xem thu:', p)


if __name__ == '__main__':
    main()
