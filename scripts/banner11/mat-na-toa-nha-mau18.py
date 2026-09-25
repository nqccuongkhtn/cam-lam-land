# -*- coding: utf-8 -*-
"""
DỰNG LẠI MẶT NẠ TOÀ NHÀ — MẪU BANNER 18 "VƯƠN CAO GIỮA LÒNG CAM LÂM"
====================================================================
Thay cho tach-toa-nha-mau18.py + vet-mat-na-mau18.py (bản cũ, giữ để tham khảo).

Chủ dự án chỉ ra (25/9/2026) hai lỗi ở phần toà nhà nhô lên khỏi khung:
  1. "toà nhà phía trên bị mất một khúc" — mặt nạ cũ cắt cụt vai phải của
     khối nhà, lại kèm một mảng trời;
  2. "vẫn còn viền xanh" — mặt nạ cũ chỉ phủ tới y≈258 trong khi khung ảnh
     bắt đầu ở y=260 → hở một dải, nền xanh của banner lộ ra ngay mép khung.

Cách làm mới:
  · Mặt nạ phủ TRỌN tấm ảnh (cùng toạ độ, cùng khổ với ảnh trong banner) nên
    không bao giờ hụt mép; phần dưới mép khung đã có nhóm c18Tren cắt đi.
  · Toà nhà = mọi điểm KHÔNG PHẢI TRỜI, chỉ giữ MỘT mảng liền chứa chóp toà
    nhà (bỏ toà nhà xám bên trái, cây cối).
  · Mép mặt nạ làm mềm 1 điểm ảnh cho khỏi răng cưa.

Chạy:  python scripts/banner11/mat-na-toa-nha-mau18.py
Toạ độ đặt mặt nạ trong bản thiết kế: xem MAT_NA_M18 trong tach-banner.py.
"""
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')
ANH = os.path.join(RA, 'mia-goldcoast-800.webp')

# Ảnh 800×1200 đặt trong banner ở (1228, 30.6), khổ 448×672. Mép trên khung
# ảnh y=260 ⇔ hàng (260-30.6)/672*1200 ≈ 410 của ảnh. Chỉ cần mặt nạ tới hơi
# quá chỗ đó; phía dưới cứ để trắng hết (đã có clip cắt).
HANG_KHUNG = 410


def main():
    im = Image.open(ANH).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # Trời ban ngày: xanh dương trội hẳn, hoặc trắng hơi xanh gần chân trời.
    xanh = ((b > r + 22) & (b > 120)) | ((b >= g) & (g >= r) & (b > r + 10) & (r > 170))
    # ⚠️ TRỜI = XANH + MỊN. Tường khuất nắng cũng xanh xám nhưng lấm tấm ô cửa
    #    sổ → độ lệch sáng tối trong ô 7×7 cao. Chỉ dựa vào màu thì khoét mất
    #    tường; lấp khe để chữa thì lại lấp luôn khe trời tam giác giữa các gờ
    #    bậc thang ở đỉnh (chủ dự án khoanh đúng chỗ đó). Đo độ lấm tấm là
    #    phân biệt được cả hai.
    sang = a.mean(axis=2).astype(float)
    tb = ndimage.uniform_filter(sang, 7)
    lech = np.sqrt(np.maximum(ndimage.uniform_filter(sang * sang, 7) - tb * tb, 0))
    troi = xanh & (lech < 6)
    troi = ndimage.binary_opening(troi, iterations=1)
    nha = ~troi
    # bỏ đốm lẻ
    nha = ndimage.binary_opening(nha, iterations=2)
    lab, n = ndimage.label(nha)
    # mảng chứa chóp: điểm "nhà" cao nhất trong 1/3 giữa bề ngang
    h, w = nha.shape
    giua = nha[:, w // 3: 2 * w // 3]
    ys, xs = np.nonzero(giua)
    y0 = ys.min()
    x0 = xs[ys == y0][0] + w // 3
    # ⚠️ GIỮ MỌI TOÀ NHÀ chạm xuống mép khung (cả toà thấp bên trái), không
    #    chỉ toà có chóp. Rồi LẤP KÍN TỪNG HÀNG của từng toà: mặt tường khuất
    #    nắng giữa các gờ trắng màu xanh xám, bị nhận nhầm là trời → khoét ra
    #    thành khe, lộ nền xanh banner (chủ dự án: "toà nhà cao bị mất ảnh ra
    #    nền xanh", 25/9/2026). Giữa hai gờ của một toà thì chắc chắn là tường.
    hang = lab[HANG_KHUNG]
    ma = {int(v) for v in np.unique(hang) if v} | {int(lab[y0, x0])}
    giu = np.zeros_like(nha)
    for v in ma:
        k = lab == v
        if k.sum() < 800:
            continue
        giu |= k
    # Chỉ vá lỗ li ti. ĐỪNG lấp khe rộng: lấp 25 điểm ảnh là lấp luôn khe trời
    # tam giác giữa các gờ bậc thang ở đỉnh (đã vấp, bản v4).
    giu = ndimage.binary_closing(giu, structure=np.ones((3, 3), bool))
    # Gọt mép 2 điểm ảnh: ngay mép tường có dải trời chuyển sắc (không mịn) nên
    # bị tính là "nhà" → thành viền xanh nhạt bám quanh toà nhà.
    giu = ndimage.binary_erosion(giu, iterations=2)
    giu = ndimage.binary_fill_holes(giu)
    giu[HANG_KHUNG + 12:, :] = True      # dưới mép khung: trắng hết cho khỏi hở
    m = Image.fromarray((giu * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
    # webp KHÔNG NÉN MẤT (lossless): nén thường là mép mặt nạ lem, lộ viền trời.
    # Giữ đuôi .webp vì bản điện thoại tự đổi đường dẫn sang dt/…webp.
    p = os.path.join(RA, 'm18-matna-v5.webp')  # ⚠️ đổi tên mỗi lần dựng lại (v3, v4…): Cloudflare + trình duyệt giữ ảnh theo tên file
    m.save(p, 'WEBP', lossless=True)
    print('OK', p, m.size, 'chop toa nha o', (int(x0), int(y0)))
    # ảnh xem thử: toà nhà trên nền navy
    nen = Image.new('RGB', im.size, (11, 36, 71))
    nen.paste(im, (0, 0), m)
    nen.crop((0, 0, w, HANG_KHUNG + 40)).save(os.path.join(RA, '_xem-m18-matna.png'))


if __name__ == '__main__':
    main()
