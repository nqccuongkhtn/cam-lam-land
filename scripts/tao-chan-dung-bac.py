# -*- coding: utf-8 -*-
"""
TẠO HÌNH KHẮC CHÂN DUNG BÁC HỒ CHO LOGO NGÀY 19/5
==================================================
Chủ dự án muốn ngày sinh nhật Bác (19/5) thì logo có chân dung Bác, và đã gửi
ảnh chân dung chính thức.

Script này đổi tấm ảnh chụp thành HÌNH KHẮC HAI TÔNG (kiểu tranh cổ động quen
thuộc), rồi ghi ra ảnh nền trong suốt để scripts/dung-logo-ngay-le.py tô màu
và ghép vào logo:

    scripts/anh/chan-dung-bac.png     (nét = trắng, nền = trong suốt)

VÌ SAO PHẢI ĐỔI THÀNH HÌNH KHẮC, KHÔNG DÙNG THẲNG ẢNH CHỤP:
Logo chỉ hiện ở cỡ 32 điểm ảnh trên thanh menu. Ảnh chụp thu nhỏ tới cỡ đó là
một vệt xám nhoè, không nhận ra ai. Hình khắc hai tông thì mảng sáng tối rõ
ràng, thu nhỏ vẫn giữ được đường nét khuôn mặt — đúng lý do tranh cổ động
xưa nay vẫn vẽ kiểu này.

⚠️ NGƯỠNG ĐEN/TRẮNG LÀ THỨ QUYẾT ĐỊNH. Đã thử 120 · 140 · 160:
     120 — mảng tối quá ít, mặt gần như trắng trơn, mất hết nét;
     160 — mảng tối loang ra, tóc và râu dính vào nhau thành một cục đen;
     145 — vừa: rõ chân mày, sống mũi, chòm râu, mà tóc vẫn tách khỏi trán.
   Đổi ảnh gốc khác thì phải dò lại ngưỡng, đừng bê nguyên số này.

Chạy:  python scripts/tao-chan-dung-bac.py <anh-chan-dung.png>
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'scripts', 'anh', 'chan-dung-bac.png')

NGUONG = 145        # xem chú thích ở đầu file
# ⚠️ PHẢI CẮT BỎ KHUNG VIỀN CỦA ẢNH GỐC. Tấm ảnh chủ dự án gửi có một khung
#    navy đậm bao quanh — khung đó cũng là chỗ TỐI nên lọt vào hình khắc, ghép
#    lên logo thành một cái hộp chữ nhật bao quanh mặt Bác, nhìn rất lỗi.
#    Cắt 24 điểm ảnh mỗi bên là sạch với ảnh này; ảnh khác thì dò lại.
VIEN = 24


def main():
    if len(sys.argv) < 2:
        raise SystemExit('Cach dung: python scripts/tao-chan-dung-bac.py <anh.png>')
    im = Image.open(sys.argv[1]).convert('RGB')
    im = im.crop((VIEN, VIEN, im.width - VIEN, im.height - VIEN))

    xam = ImageOps.grayscale(im).filter(ImageFilter.MedianFilter(3))
    a = np.asarray(xam).astype(np.float32)
    # Chuyển mềm quanh ngưỡng (±10) để mép nét không bị răng cưa.
    alp = np.clip((NGUONG + 10 - a) / 20.0, 0, 1)

    out = Image.fromarray(np.dstack([
        np.full(a.shape + (3,), 255, np.uint8),
        (alp * 255).astype(np.uint8)]), 'RGBA')
    bb = out.getbbox()
    if bb:
        out = out.crop(bb)
    os.makedirs(os.path.dirname(RA), exist_ok=True)
    out.save(RA)
    print('OK %s  %dx%d  %d KB'
          % (os.path.relpath(RA, GOC), out.width, out.height,
             os.path.getsize(RA) // 1024))

    # xem thử ở cỡ THẬT trên thanh menu
    thu = Image.new('RGB', (520, 150), (10, 37, 64))
    for kho, x in ((120, 20), (56, 170), (30, 250), (20, 300)):
        w = round(kho * out.width / out.height)
        thu.paste(out.resize((w, kho), Image.LANCZOS), (x, 15),
                  out.resize((w, kho), Image.LANCZOS))
    p = os.path.join(GOC, 'scripts', 'anh', '_xem-chan-dung.png')
    thu.save(p)
    print('Anh xem thu:', p)


if __name__ == '__main__':
    main()
