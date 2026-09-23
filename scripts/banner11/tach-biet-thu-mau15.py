# -*- coding: utf-8 -*-
"""
TÁCH CĂN BIỆT THỰ THẬT RA KHỎI ẢNH — MẪU BANNER 15
===================================================
Chủ dự án muốn mẫu 15 ("Hình dung ngôi nhà trên đất của bạn") đặt **ảnh thật**
của một căn biệt thự tân cổ điển lên lô đất, thay cho hình vẽ.

Script này cắt căn biệt thự ra khỏi tấm ảnh phối cảnh (bỏ cây cối, bãi cỏ, nhà
hàng xóm, mặt đường) thành một ảnh nền trong suốt:

  apps/frontend/public/banner11/m15-bietthu.webp

CÁCH TÁCH — vì sao không dùng cách của mẫu 7 / mẫu 18:
Hai mẫu kia cắt chủ thể khỏi NỀN TRỜI, trời là một mảng màu trơn nên đo được.
Ở đây nền là cây cối lộn xộn, không đo kiểu đó được. Nhưng có một chỗ bám rất
chắc: **cây cỏ thì xanh lá, tức kênh Lục trội hơn hẳn kênh Đỏ và kênh Lam**,
còn tường, mái, sân của căn nhà thì gần như trung tính. Lấy đúng dấu hiệu đó là
gạt sạch được cây và cỏ.
Sau đó chỉ giữ MẢNG LIỀN LỚN NHẤT để bỏ mấy mẩu lẻ (nhà hàng xóm, mặt đường).

⚠️ ĐỔI ẢNH thì phải chỉnh lại KHUNG bên dưới và chạy lại script.

Chạy:  python scripts/banner11/tach-biet-thu-mau15.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')
ANH = os.path.join(RA, 'h3-villa-tan-co-dien.webp')

# Khung cắt: ôm căn biệt thự chính + phần sân trước, bỏ nhà hàng xóm bên phải.
KHUNG = (322, 70, 706, 428)

# Ngưỡng nhận cây cỏ: Lục trội hơn Đỏ và Lam bao nhiêu thì coi là cây/cỏ.
XANH_LA = 6.0
# Vùng mờ chuyển tiếp của mặt nạ (điểm ảnh)
MEM = 1.6


def main():
    im = Image.open(ANH).convert('RGB')
    patch = np.asarray(im.crop(KHUNG), dtype=np.float32)
    h, w, _ = patch.shape
    R, G, B = patch[:, :, 0], patch[:, :, 1], patch[:, :, 2]

    # ── 1. Cây cỏ: Lục trội hơn cả Đỏ lẫn Lam ───────────────────────────────
    troi_luc = np.minimum(G - R, G - B)
    la_cay = troi_luc > XANH_LA
    giu = ~la_cay

    # ── 2. Chỉ giữ mảng liền lớn nhất (bỏ nhà hàng xóm, mặt đường lẻ) ───────
    nhan = np.zeros(giu.shape, dtype=np.int32)
    so, tot, to_nhat = 0, None, 0
    for y in range(h):
        for x in range(w):
            if giu[y, x] and nhan[y, x] == 0:
                so += 1
                ngan, dem = [(y, x)], 0
                nhan[y, x] = so
                while ngan:
                    cy, cx = ngan.pop()
                    dem += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and giu[ny, nx] and nhan[ny, nx] == 0:
                            nhan[ny, nx] = so
                            ngan.append((ny, nx))
                if dem > to_nhat:
                    to_nhat, tot = dem, so
    print('Mang lien lon nhat: %d diem anh (%.0f%% khung)' % (to_nhat, to_nhat / (h * w) * 100))

    m = Image.fromarray(((nhan == tot) * 255).astype(np.uint8))
    # bịt mấy lỗ nhỏ bên trong (khóm cây trồng trên ban công, chậu hoa…)
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    m = m.filter(ImageFilter.GaussianBlur(MEM))
    a = np.asarray(m, dtype=np.float32) / 255.0

    ys, xs = np.nonzero(a > 0.08)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    print('Can nha trong anh goc: (%d,%d)-(%d,%d)  %dx%d'
          % (KHUNG[0] + x0, KHUNG[1] + y0, KHUNG[0] + x1, KHUNG[1] + y1, x1 - x0, y1 - y0))

    rgb = patch[y0:y1, x0:x1].astype(np.uint8)
    alp = (a[y0:y1, x0:x1] * 255).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb, alp]), 'RGBA')
    p = os.path.join(RA, 'm15-bietthu.webp')
    out.save(p, 'WEBP', quality=90, method=6)
    print('OK %s  %d KB  %dx%d' % (os.path.basename(p), os.path.getsize(p) // 1024,
                                   out.width, out.height))
    print('TI LE ngang/doc = %.4f  (dung de tinh chieu cao khi dat vao banner)'
          % (out.width / out.height))

    thu = Image.new('RGB', out.size, (86, 128, 58))     # nền cỏ giống ảnh banner
    thu.paste(out, (0, 0), out)
    thu.save(os.path.join(RA, '_xem-m15-bietthu.png'))


if __name__ == '__main__':
    main()
