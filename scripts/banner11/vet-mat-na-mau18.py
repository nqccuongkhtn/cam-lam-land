# -*- coding: utf-8 -*-
"""
VÉT SẠCH MẶT NẠ TOÀ NHÀ — MẪU BANNER 18 "CHỦ THỂ VƯỢT KHUNG"
=============================================================
Lỗi chủ dự án chụp được (24/9/2026): phần toà nhà nhô LÊN TRÊN khung ảnh bị
kèm theo **một khối chữ nhật** nằm ngay sát mép trên khung, và trong khung
thì thấy **một đường cắt ngang**.

Nguyên nhân: `tach-toa-nha-mau18.py` chỉ dò trời ở khoảng `KHUNG` rồi coi
MỌI THỨ KHÔNG PHẢI TRỜI là toà nhà. Xuống dưới đường chân trời thì cây cối,
dãy nhà thấp, biển hiệu… đều "không phải trời" → mấy hàng cuối của mặt nạ
trắng GẦN HẾT BỀ NGANG. Mảng trắng đó nằm đúng khoảng trên mép khung nên lòi
ra thành khối chữ nhật, và chỗ mặt nạ bị cắt ngang thành đường kẻ.

Cách vá ở đây: giữ lại DUY NHẤT vệt trắng của toà nhà. Đi từng hàng, tìm các
đoạn trắng liền nhau, chỉ giữ đoạn nào nối tiếp được với toà nhà ở hàng trên;
mọi đoạn khác bỏ đi. Nhờ vậy bóng toà nhà vẫn liền một mạch từ chóp xuống
tận mép khung, còn dãy nhà thấp hai bên thì biến mất.

Chạy:  python scripts/banner11/vet-mat-na-mau18.py
"""
import os
import numpy as np
from PIL import Image

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')
TEP = os.path.join(RA, 'm18-matna.webp')
LUU = os.path.join(RA, '_m18-matna-truoc-khi-vet.webp')   # bản cũ, giữ để lỡ cần lùi


def doan_trang(hang):
    """Các đoạn trắng liền nhau trong một hàng: [(đầu, cuối), …]."""
    ds, dau = [], None
    for x, v in enumerate(hang):
        if v and dau is None:
            dau = x
        elif not v and dau is not None:
            ds.append((dau, x)); dau = None
    if dau is not None:
        ds.append((dau, len(hang)))
    return ds


def main():
    im = Image.open(TEP).convert('L')
    a = np.asarray(im) > 128
    h, w = a.shape
    if not os.path.exists(LUU):
        im.save(LUU, 'WEBP', quality=92, method=6)

    # Hàng đầu tiên có điểm trắng = chóp toà nhà.
    hang_dau = next((y for y in range(h) if a[y].any()), None)
    if hang_dau is None:
        print('Mặt nạ trống, không làm gì.')
        return

    giu = np.zeros_like(a)
    # Chóp: giữ đoạn trắng DÀI NHẤT của hàng đầu (chóp nhà), bỏ nhiễu lấm tấm.
    ds = doan_trang(a[hang_dau])
    d0, c0 = max(ds, key=lambda t: t[1] - t[0])
    giu[hang_dau, d0:c0] = True
    truoc = [(d0, c0)]

    # ── Tìm ĐƯỜNG CHÂN TRỜI ──────────────────────────────────────────────
    # Từ hàng này trở xuống, mặt nạ trắng gần hết bề ngang: đó là lúc dãy nhà
    # thấp, cây cối hai bên dính liền vào chân toà nhà. Bên trên nó thì chỉ có
    # trời với toà nhà nên cứ theo vệt trắng là đúng.
    ty_le = a.mean(axis=1)
    chan_troi = h
    for y in range(hang_dau + 10, h):
        if ty_le[y] > 0.45:
            chan_troi = y
            break

    # ── Trên chân trời: bám theo vệt trắng của toà nhà ──
    d, c = d0, c0
    for y in range(hang_dau + 1, min(chan_troi, h)):
        cham = [(d2, c2) for d2, c2 in doan_trang(a[y]) if d2 < c and d < c2]
        if not cham:
            chan_troi = y
            break
        d = min(t[0] for t in cham)
        c = max(t[1] for t in cham)
        giu[y, d:c] = True

    # ── Từ chân trời xuống: KHÔNG tin vệt trắng nữa ──
    # Chỉ nối tiếp hai mép toà nhà theo đúng độ dốc nó đang có, nở ra rất chậm.
    # Làm vậy thì bóng toà nhà liền mạch xuống tận mép khung ảnh (không hở),
    # mà dãy nhà thấp hai bên không bị lôi ra thành khối chữ nhật.
    doc = max(0.4, (c - d) * 0.0015)      # mỗi hàng nở thêm bấy nhiêu điểm mỗi bên
    fd, fc = float(d), float(c)
    for y in range(chan_troi, h):
        fd -= doc
        fc += doc
        x0, x1 = max(0, int(fd)), min(w, int(fc))
        if x1 > x0:
            giu[y, x0:x1] = True

    bo = int(a.sum() - giu.sum())
    Image.fromarray((giu * 255).astype('uint8')).save(TEP, 'WEBP', quality=92, method=6)
    print('Đã vét mặt nạ: bỏ %d điểm thừa (%.0f%%), còn lại đúng bóng toà nhà.'
          % (bo, 100.0 * bo / max(1, a.sum())))
    print('Bản cũ giữ ở:', os.path.basename(LUU))


if __name__ == '__main__':
    main()
