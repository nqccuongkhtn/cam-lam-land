# -*- coding: utf-8 -*-
"""
TÁCH NỀN ẢNH MINH HOẠ CHO LOGO NGÀY LỄ
=======================================
Chủ dự án gửi ảnh minh hoạ (ảnh vẽ, nền một màu phẳng) và dặn cắt lấy nhân vật
để ghép vào logo. Script này lo phần cắt nền.

Khác `tach-nen-anh-tet.py` ở chỗ: bên đó nền là TRẮNG hoặc ô cờ caro, còn đây
nền có thể là MỘT MÀU BẤT KỲ (cam, xanh…). Cách làm: lấy màu ở bốn góc làm
"màu nền", rồi loang từ mép ảnh vào, xoá mọi điểm gần giống màu đó.

⚠️ CHỈ XOÁ PHẦN NỀN NỐI LIỀN RA ĐƯỢC MÉP. Nhân vật cũng có mảng màu cam gần
   giống nền (con cá chép), xoá theo màu là thủng cả mình cá.

Chạy:  python scripts/tach-nen-anh-le.py
"""
import os
from collections import deque

import numpy as np
from PIL import Image

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'scripts', 'anh')

# ẢNH ÔNG TÁO (bản 2, 25/9/2026): ông Táo cầm câu đối cưỡi cá chép vàng.
# Ảnh gốc lưu hẳn trong dự án (scripts/anh/ong-tao-goc-2.png) — bản 1 đọc
# thẳng từ thư mục tạm của Claude nên mất ảnh gốc là không dựng lại được.
#
# Ảnh này nền có HAI màu: cam + vòng tròn và mây TRẮNG, lại có dòng chữ trắng.
# Nên "màu nền" không phải một điểm mà là cả DẢI MÀU từ cam đến trắng (gồm
# luôn mấy điểm ảnh pha lẫn ở mép vòng tròn). Loang từ mép vào vẫn giữ được
# lòng trắng MẮT cá và mắt ông Táo vì chúng nằm lọt trong hình.
# ⚠️ Sai số 20. Da mặt ông Táo (255,224,178) chỉ cách dải cam–trắng ~33,
#    để sai số cao hơn là mặt bị ăn thủng.
#
# Sau khi loang còn sót vài mảng của vòng tròn trắng bị dải lụa quây kín
# (không nối ra mép nên loang không tới). Ghi rõ toạ độ góc trên–trái của
# từng mảng để xoá — đừng xoá "mọi mảng trắng to", vì làm thế thì mất luôn
# lòng trắng mắt cá (đã vấp).
VIEC = [dict(vao=os.path.join(RA, 'ong-tao-goc-2.png'), ra='ong-tao.png',
             nen=((240, 103, 34), (255, 255, 255)), sai_so=20,
             xoa_them={(244, 212), (473, 243), (452, 400), (433, 425)})]


def tach(duong_vao, duong_ra, nen, sai_so, xoa_them=()):
    from scipy import ndimage
    im = Image.open(duong_vao).convert('RGBA')
    a = np.asarray(im).astype(float)
    h, w = a.shape[:2]

    # Độ lệch của mỗi điểm so với DẢI MÀU NỀN (đoạn thẳng từ màu 1 đến màu 2).
    c0 = np.array(nen[0], float); c1 = np.array(nen[1], float)
    v = c1 - c0
    t = np.clip(((a[..., :3] - c0) @ v) / max(v @ v, 1), 0, 1)
    lech = np.abs(a[..., :3] - (c0 + t[..., None] * v)).sum(axis=2)
    giong = lech <= sai_so

    # Loang từ mép vào: chỉ xoá phần nền nối liền ra được mép.
    xoa = np.zeros_like(giong)
    hang_doi = deque()
    for y in range(h):
        for x in range(w):
            if (y in (0, h - 1) or x in (0, w - 1)) and giong[y, x]:
                xoa[y, x] = True; hang_doi.append((y, x))
    while hang_doi:
        y, x = hang_doi.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and giong[ny, nx] and not xoa[ny, nx]:
                xoa[ny, nx] = True
                hang_doi.append((ny, nx))

    # Bỏ mấy mẩu lẻ (dòng chữ, chấm mây) — chỉ giữ các khối to.
    lab, n = ndimage.label(~xoa)
    if n:
        co = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        xoa |= ~np.isin(lab, 1 + np.where(co >= 0.02 * co.max())[0])

    # Xoá thêm các mảng trắng bị quây kín, chỉ đích danh theo góc trên–trái.
    if xoa_them:
        trang = a[..., :3].min(axis=2) >= 235
        lt, _ = ndimage.label(trang)
        them = np.zeros_like(trang)
        for i, sl in enumerate(ndimage.find_objects(lt), 1):
            if sl and (sl[1].start, sl[0].start) in xoa_them:
                them |= lt == i
        # nở 2 điểm để ăn luôn viền pha màu quanh mảng trắng
        them = ndimage.binary_dilation(them, iterations=2) & (a[..., :3].min(axis=2) >= 200)
        xoa |= them

    ra = np.array(im)
    ra[..., 3] = np.where(xoa, 0, 255)
    out = Image.fromarray(ra)
    bb = out.getchannel('A').getbbox()
    if bb:
        out = out.crop(bb)
    out.save(duong_ra)
    return out.size, int(xoa.sum()), h * w


def main():
    os.makedirs(RA, exist_ok=True)
    for v in VIEC:
        if not os.path.exists(v['vao']):
            print('KHÔNG THẤY', v['vao'], '— bỏ qua')
            continue
        kho, bo, tong = tach(v['vao'], os.path.join(RA, v['ra']), v['nen'],
                             v['sai_so'], v.get('xoa_them', ()))
        print('OK %-14s còn %sx%s · xoá %.0f%%'
              % (v['ra'], kho[0], kho[1], 100.0 * bo / tong))

if __name__ == '__main__':
    main()
