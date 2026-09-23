# -*- coding: utf-8 -*-
"""
TÁCH TOÀ NHÀ CAO TẦNG RA KHỎI ẢNH — MẪU BANNER 18 "CHỦ THỂ VƯỢT KHUNG"
======================================================================
Mẫu 18 muốn một toà nhà cao tầng VƯƠN RA KHỎI khung ảnh — kiểu ảnh quảng cáo
hay thấy với toà Landmark 81. Chủ dự án nhận xét bản đang chạy "chưa thực sự
làm nổi bật được hiệu ứng", và dặn rõ: **không vẽ đồ hoạ, cắt từ ảnh toà nhà
thật**.

Hai việc script này lo:

1. **Cắt toà nhà ra thành ảnh nền trong suốt** (`m18-toanha.webp`).
   Trước đây chỗ này dùng một MẶT NẠ HÌNH CHỮ NHẬT đè lên ảnh — nghĩa là mảng
   trời đêm quanh toà nhà cũng bị lôi ra theo, thành một khối chữ nhật tối trên
   nền banner. Nay cắt theo đúng bóng toà nhà: trời đêm rất tối, toà nhà sáng
   đèn → chênh màu lớn, cắt ra rất sạch.

2. **In ra đúng toạ độ để dán vào bản thiết kế.** Ảnh cắt phải đặt KHÍT lên tấm
   ảnh trong khung, nếu lệch một chút là lộ ngay.

⚠️ ĐỔI ẢNH NỀN CỦA MẪU 18 THÌ PHẢI CHẠY LẠI SCRIPT NÀY và sửa lại KHUNG, vì
   toạ độ toà nhà là của riêng tấm ảnh hiện tại.

Chạy:  python scripts/banner11/tach-toa-nha-mau18.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')
ANH = os.path.join(RA, 'px-28143540-2000.webp')

# Khung dò: toà nhà kính nằm giữa, hai mép trái/phải chỉ có trời.
# ⚠️ Cắt ngang ở y=1050 vì xuống thấp hơn là núi (trái) và dãy nhà (phải) lấn
#    vào mép — hết trời để đo thì phép tách sai ngay. Chỗ cắt này vẫn nằm SÂU
#    DƯỚI mép trên khung ảnh nên không lộ đường cắt.
KHUNG = (0, 150, 700, 1050)
MEP = 70
NGUONG_TRONG, NGUONG_DUC = 26.0, 62.0

# Cách đặt tấm ảnh trong bản thiết kế (phải khớp với THAY_DOAN[18] của
# tach-banner.py): ảnh 2000×3000 vẽ vào ô 1000×1500 rồi translate(tx ty) scale(s)
TX, TY, S = 1055.0, -65.7, 0.71


def main():
    im = Image.open(ANH).convert('RGB')
    patch = np.asarray(im.crop(KHUNG), dtype=np.float32)
    h, w, _ = patch.shape

    trai = np.median(patch[:, :MEP, :], axis=1)
    phai = np.median(patch[:, -MEP:, :], axis=1)
    k = np.ones(9, dtype=np.float32) / 9.0
    for c in range(3):
        trai[:, c] = np.convolve(np.pad(trai[:, c], 4, mode='edge'), k, 'valid')
        phai[:, c] = np.convolve(np.pad(phai[:, c], 4, mode='edge'), k, 'valid')
    t = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :, None]
    troi = trai[:, None, :] * (1 - t) + phai[:, None, :] * t

    lech = np.sqrt(((patch - troi) ** 2).sum(axis=2))
    a = np.clip((lech - NGUONG_TRONG) / (NGUONG_DUC - NGUONG_TRONG), 0.0, 1.0)

    # giữ mảng liền lớn nhất — bỏ mấy vệt mây sáng và ngôi sao lẻ
    dac = a > 0.55
    nhan = np.zeros(dac.shape, dtype=np.int32)
    so, tot, to_nhat = 0, None, 0
    for y in range(h):
        for x in range(w):
            if dac[y, x] and nhan[y, x] == 0:
                so += 1
                ngan, dem = [(y, x)], 0
                nhan[y, x] = so
                while ngan:
                    cy, cx = ngan.pop()
                    dem += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and dac[ny, nx] and nhan[ny, nx] == 0:
                            nhan[ny, nx] = so
                            ngan.append((ny, nx))
                if dem > to_nhat:
                    to_nhat, tot = dem, so
    print('Mang lien lon nhat: %d diem anh' % to_nhat)

    giu = Image.fromarray(((nhan == tot) * 255).astype(np.uint8))
    giu = giu.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.0))
    a = a * (np.asarray(giu, dtype=np.float32) / 255.0)

    # Mép DƯỚI phải đặc hoàn toàn: toà nhà còn tiếp tục xuống dưới, cắt mềm ở đó
    # là lộ ra một vệt mờ ngay chỗ nối với phần ảnh trong khung.
    a[-6:, :] = np.maximum(a[-6:, :], a[-7:-6, :])

    ys, xs = np.nonzero(a > 0.06)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    u0, v0 = KHUNG[0] + x0, KHUNG[1] + y0
    u1, v1 = KHUNG[0] + x1, KHUNG[1] + y1
    print('Toa nha trong anh goc: (%d,%d)-(%d,%d)  %dx%d' % (u0, v0, u1, v1, x1 - x0, y1 - y0))

    rgb = patch[y0:y1, x0:x1].astype(np.uint8)
    alp = (a[y0:y1, x0:x1] * 255).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb, alp]), 'RGBA')
    out = out.resize((out.width * 2, out.height * 2), Image.LANCZOS)
    p = os.path.join(RA, 'm18-toanha.webp')
    out.save(p, 'WEBP', quality=92, method=6)
    print('OK %s  %d KB  %dx%d' % (os.path.basename(p), os.path.getsize(p) // 1024,
                                   out.width, out.height))

    # ── Toạ độ để dán vào bản thiết kế ───────────────────────────────────────
    k2 = S / 2.0   # ảnh 2000 điểm ảnh ngang vẽ vào ô rộng 1000
    X, Y = TX + k2 * u0, TY + k2 * v0
    W, H = k2 * (u1 - u0), k2 * (v1 - v0)
    print('')
    print('== DAN VAO tach-banner.py ==')
    print('<image href="/banner11/m18-toanha.webp" x="%.1f" y="%.1f" width="%.1f" height="%.1f"/>'
          % (X, Y, W, H))
    print('Dinh toa nha o y=%.1f (mep tren khung anh la y=110) => nho ra %.0f don vi'
          % (Y, 110 - Y))

    thu = Image.new('RGB', out.size, (11, 36, 71))
    thu.paste(out, (0, 0), out)
    thu.save(os.path.join(RA, '_xem-m18-toanha.png'))


if __name__ == '__main__':
    main()
