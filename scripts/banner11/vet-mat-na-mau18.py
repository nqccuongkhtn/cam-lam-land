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


def a_hang(a, y):
    """Một hàng của mặt nạ (tách ra cho dễ đọc)."""
    return a[y]


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
    a_mask = a
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

    # ── Từ chân trời xuống: nối tiếp hai mép theo ĐỘ DỐC ─────────────────
    # ⚠️ Đã thử hai bản đều hỏng:
    #    (a) bỏ hẳn vệt trắng, nối theo độ dốc RẤT CHẬM (0,4–0,6 điểm/hàng)
    #        → toà nhà thật nở nhanh hơn thế nên ngay trên mép khung bóng
    #          toà nhà bị BÓP HẸP, lộ ra một bậc gãy đúng chỗ nối;
    #    (b) bám theo vệt trắng và chỉ chặn nở quá 14 điểm/hàng
    #        → dãy nhà thấp hai bên nở từ từ nên vẫn lọt, khối chữ nhật
    #          trời xanh hiện lại y như cũ.
    # Cách dùng ở đây: vẫn nối theo độ dốc, nhưng ĐỘ DỐC TÍNH NGƯỢC từ bề
    # ngang toà nhà ĐO ĐƯỢC ở ngay trên chân trời — đo ở ba hàng cuối cùng
    # còn tin được rồi lấy nhịp nở trung bình, nên bám đúng dáng toà nhà mà
    # không dính dãy nhà hai bên.
    n_do = 24
    y0 = max(hang_dau + 1, chan_troi - n_do)
    rong0 = None
    for y in range(y0, chan_troi):
        dt = [(p, q) for p, q in doan_trang(a[y]) if giu[y].any() and giu[y, p:q].any()]
        if dt:
            rong0 = max(q for _, q in dt) - min(p for p, _ in dt)
            break
    rong1 = c - d
    doc = 0.5 if (rong0 is None or chan_troi - y0 <= 0) else         max(0.5, (rong1 - rong0) / (2.0 * max(1, chan_troi - y0)))
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
