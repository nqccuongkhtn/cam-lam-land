# -*- coding: utf-8 -*-
"""
TÁCH CĂN BIỆT THỰ THẬT RA KHỎI ẢNH — MẪU BANNER 15
===================================================
Chủ dự án muốn mẫu 15 ("Hình dung ngôi nhà trên đất của bạn") đặt **ảnh thật**
của một căn biệt thự tân cổ điển lên lô đất, thay cho hình vẽ.

Script này cắt căn biệt thự ra khỏi tấm ảnh phối cảnh (bỏ cây cối, bãi cỏ, nhà
hàng xóm, mặt đường) thành một ảnh nền trong suốt:

  apps/frontend/public/banner11/m15-bietthu.webp

CÁCH LÀM: giữ trọn khung ảnh (nhà + sân vườn + hàng rào + mặt đường), chỉ làm
MỜ DẦN bốn mép để tấm ảnh chìm vào bãi cỏ của banner. Xem ghi chú trong main().

⚠️ ĐỔI ẢNH thì phải chỉnh lại KHUNG bên dưới và chạy lại script.

Chạy:  python scripts/banner11/tach-biet-thu-mau15.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')
ANH = os.path.join(RA, 'h3-villa-tan-co-dien.webp')

# Khung cắt: lấy TRỌN khu đất — nhà, sân vườn, nhà để xe, hàng rào và mặt
# đường trước nhà. Chừa bớt mép trái (toàn cây) và mép phải (nhà hàng xóm).
KHUNG = (34, 78, 772, 612)

# Bề rộng vùng mờ ở mỗi mép, tính theo phần chiều rộng/chiều cao của khung.
VIEN_TRAI, VIEN_PHAI = 0.12, 0.11
VIEN_TREN, VIEN_DUOI = 0.17, 0.06



def main():
    """Lấy TRỌN khu đất: căn nhà + sân vườn + hàng rào + mặt đường trước nhà.

    ⚠️ ĐÃ ĐỔI CÁCH LÀM MỘT LẦN: bản đầu chỉ cắt riêng căn nhà bằng mẹo "cây cỏ
       thì xanh lá". Chủ dự án xem rồi dặn "lấy cả nhà và sân vườn vào, lấy được
       đường thì đưa vào luôn". Mà sân vườn thì cũng xanh lá — dùng lại mẹo cũ là
       xoá mất luôn cái sân. Nên nay giữ NGUYÊN cả khung ảnh, chỉ làm MỜ DẦN
       viền ngoài để tấm ảnh chìm vào bãi cỏ của banner, không lộ mép chữ nhật.
    """
    im = Image.open(ANH).convert('RGB')
    patch = im.crop(KHUNG)
    w, h = patch.size

    # ── Viền mờ dần: trong lòng ảnh đục hẳn, ra tới mép thì trong suốt ───────
    # Mỗi mép mờ theo một bề rộng riêng: mép TRÊN nhiều cây nên mờ sâu hơn,
    # mép DƯỚI là mặt đường nên chỉ mờ nhẹ cho khỏi cụt.
    x = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :]
    y = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]

    def ram(t, rong):
        return np.clip(t / max(rong, 1e-6), 0.0, 1.0)

    a = (ram(x, VIEN_TRAI) * ram(1 - x, VIEN_PHAI)
         * ram(y, VIEN_TREN) * ram(1 - y, VIEN_DUOI))
    a = a ** 1.8                                   # mờ dịu hơn ở gần mép
    alp = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))

    out = Image.merge('RGBA', (*patch.split(), alp))
    p = os.path.join(RA, 'm15-bietthu.webp')
    out.save(p, 'WEBP', quality=90, method=6)
    print('OK %s  %d KB  %dx%d' % (os.path.basename(p), os.path.getsize(p) // 1024,
                                   out.width, out.height))
    print('TI LE ngang/doc = %.4f' % (out.width / out.height))

    thu = Image.new('RGB', out.size, (86, 128, 58))     # nền cỏ giống ảnh banner
    thu.paste(out, (0, 0), out)
    thu.save(os.path.join(RA, '_xem-m15-bietthu.png'))


if __name__ == '__main__':
    main()
