# -*- coding: utf-8 -*-
"""
TÁCH CHIẾC MÁY BAY THẬT RA KHỎI ẢNH — MẪU BANNER 7 "KẾT NỐI SÂN BAY QUỐC TẾ"
=============================================================================
Trong ảnh nền của mẫu 7 có một chiếc máy bay thật đang hạ cánh. Chủ dự án muốn
CHÍNH chiếc máy bay đó bay được — bay vượt ra khỏi khung tròn, giống hiệu ứng
"chủ thể vượt khung" của mẫu 18.

Muốn nó bay thì phải tách nó ra thành một tấm ảnh riêng có NỀN TRONG SUỐT.
Script này làm việc đó và ghi ra:

  apps/frontend/public/banner11/m7-maybay.webp

CÁCH TÁCH — vì sao không cắt bằng tay:
Viền máy bay có cánh mỏng, càng đáp, ăng-ten… cắt tay bằng đa giác thì răng cưa
và mất chi tiết. Ở đây nền trời quanh máy bay khá phẳng nên làm theo cách đo:
  1. Lấy một khung rộng, hai mép trái/phải chắc chắn chỉ có trời.
  2. Với TỪNG HÀNG điểm ảnh, lấy màu trời ở mép trái và mép phải rồi nội suy
     ngang → ước lượng được "nếu không có máy bay thì trời chỗ này màu gì".
  3. Chỗ nào lệch xa màu trời ước lượng thì đó là máy bay → độ đục (alpha) tính
     theo mức lệch, nên viền tự mềm, không răng cưa.
  4. Xoá nốt mấy đốm lẻ (mây đậm) bằng phép chỉ giữ mảng liền lớn nhất.

Chạy:  python scripts/banner11/tach-may-bay-mau7.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')

ANH = os.path.join(RA, 'un-158069887246-1200.webp')
# Khung rộng: máy bay nằm gọn ở giữa, hai mép trái/phải chỉ có trời.
KHUNG = (470, 676, 930, 848)          # trái, trên, phải, dưới
MEP = 60                              # bao nhiêu cột mép dùng để đo màu trời
NGUONG_TRONG, NGUONG_DUC = 30.0, 62.0  # mức lệch màu: dưới = trời, trên = máy bay
# ⚠️ Đừng hạ hai số này xuống thấp: mây trong ảnh cũng lệch màu ~15-25, để
#    ngưỡng thấp là mây dính theo thành mảng xám lờ nhờ quanh máy bay.


def main():
    im = Image.open(ANH).convert('RGB')
    patch = np.asarray(im.crop(KHUNG), dtype=np.float32)
    h, w, _ = patch.shape

    # ── 1. Ước lượng màu trời: mỗi hàng nội suy từ mép trái sang mép phải ─────
    trai = np.median(patch[:, :MEP, :], axis=1)      # (h, 3)
    phai = np.median(patch[:, -MEP:, :], axis=1)     # (h, 3)
    # làm trơn theo chiều dọc cho khỏi giật giữa các hàng
    k = np.ones(9, dtype=np.float32) / 9.0
    for c in range(3):
        trai[:, c] = np.convolve(np.pad(trai[:, c], 4, mode='edge'), k, 'valid')
        phai[:, c] = np.convolve(np.pad(phai[:, c], 4, mode='edge'), k, 'valid')
    t = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :, None]
    troi = trai[:, None, :] * (1 - t) + phai[:, None, :] * t

    # ── 2. Lệch càng xa màu trời thì càng đục ────────────────────────────────
    lech = np.sqrt(((patch - troi) ** 2).sum(axis=2))
    a = (lech - NGUONG_TRONG) / (NGUONG_DUC - NGUONG_TRONG)
    a = np.clip(a, 0.0, 1.0)

    # ── 3. Chỉ giữ mảng liền lớn nhất (bỏ mây đậm lác đác) ───────────────────
    dac = a > 0.6
    nhan = np.zeros(dac.shape, dtype=np.int32)
    so = 0
    tot, to_nhat = None, 0
    for y in range(h):
        for x in range(w):
            if dac[y, x] and nhan[y, x] == 0:
                so += 1
                ngan = [(y, x)]
                nhan[y, x] = so
                dem = 0
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

    # nở mảng đó ra vài điểm để ôm lấy phần viền mờ (alpha 0..0.5)
    giu0 = Image.fromarray(((nhan == tot) * 255).astype(np.uint8))
    giu = giu0.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    a = a * (np.asarray(giu, dtype=np.float32) / 255.0)

    # ── 4. Cắt sát máy bay rồi ghi ra ────────────────────────────────────────
    ys, xs = np.nonzero(a > 0.08)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    print('Khung may bay trong anh goc: (%d,%d)-(%d,%d)  %dx%d'
          % (KHUNG[0] + x0, KHUNG[1] + y0, KHUNG[0] + x1, KHUNG[1] + y1, x1 - x0, y1 - y0))

    rgb = patch[y0:y1, x0:x1].astype(np.uint8)
    alp = (a[y0:y1, x0:x1] * 255).astype(np.uint8)
    ra = Image.fromarray(np.dstack([rgb, alp]), 'RGBA')
    # phóng to 2 lần cho nét khi banner hiện ở màn hình lớn
    ra = ra.resize((ra.width * 2, ra.height * 2), Image.LANCZOS)
    p = os.path.join(RA, 'm7-maybay.webp')
    ra.save(p, 'WEBP', quality=92, method=6)
    print('OK %s  %d KB  %dx%d' % (os.path.basename(p), os.path.getsize(p) // 1024,
                                   ra.width, ra.height))

    # ── 5. Ảnh nền ĐÃ XOÁ MÁY BAY ────────────────────────────────────────────
    # Nếu để nguyên ảnh cũ thì lúc chiếc máy bay cắt rời bay lên sẽ lòi ra chiếc
    # máy bay gốc nằm im trong ảnh → hoá ra hai chiếc. Nên phải lấp chỗ đó bằng
    # chính màu trời đã ước lượng ở bước 1.
    # Mặt nạ LẤP rộng tay hơn mặt nạ CẮT: cắt thì phải sát viền cho đẹp, còn lấp
    # mà sát viền là còn sót cái bóng mờ của máy bay (đã bị như vậy một lần).
    lap = np.clip((lech - 14.0) / 18.0, 0.0, 1.0) * (np.asarray(giu0.filter(ImageFilter.MaxFilter(25)), dtype=np.float32) / 255.0)
    lap_img = Image.fromarray((np.clip(lap, 0, 1) * 255).astype(np.uint8))
    lap_img = lap_img.filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.GaussianBlur(7.0))
    lap = np.asarray(lap_img, dtype=np.float32)[:, :, None] / 255.0
    vung = patch * (1 - lap) + troi * lap
    nen = im.copy()
    nen.paste(Image.fromarray(vung.astype(np.uint8)), (KHUNG[0], KHUNG[1]))
    pn = os.path.join(RA, 'm7-troi.webp')
    nen.save(pn, 'WEBP', quality=82, method=6)
    print('OK %s  %d KB (anh nen da xoa may bay)'
          % (os.path.basename(pn), os.path.getsize(pn) // 1024))

    # ảnh xem thử trên nền xanh nhạt giống nền banner, để soi viền
    thu = Image.new('RGB', ra.size, (224, 242, 254))
    thu.paste(ra, (0, 0), ra)
    thu.save(os.path.join(RA, '_xem-m7-maybay.png'))
    nen.crop(KHUNG).save(os.path.join(RA, '_xem-m7-troi.png'))
    print('Anh xem thu: _xem-m7-maybay.png, _xem-m7-troi.png (xoa duoc sau khi xem)')


if __name__ == '__main__':
    main()
