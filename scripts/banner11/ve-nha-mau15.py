# -*- coding: utf-8 -*-
"""
VẼ CĂN NHÀ 3 TẦNG CÓ SÂN VƯỜN CHO MẪU BANNER 15
================================================
Mẫu 15 "Hình dung ngôi nhà trên đất của bạn" vẽ một căn nhà phác thảo đặt lên
lô đất trong ảnh. Bản thiết kế vẽ nhà 1 trệt mái thái; chủ dự án muốn đổi thành
NHÀ 3 TẦNG CÓ SÂN VƯỜN.

Chạy:  python scripts/banner11/ve-nha-mau15.py
       → in ra 3 đoạn mã SVG, dán vào THAY_DOAN của scripts/banner11/tach-banner.py

CÁCH VẼ — vì sao không vẽ tay từng điểm:
Lô đất trong bản thiết kế là một hình bình hành vẽ theo phép chiếu trục đo
(nhìn chéo). Muốn căn nhà đứng ĐÚNG trên lô đất thì mọi điểm phải tính theo
chính hai cạnh của hình bình hành đó, không thể ước lượng bằng mắt.
  · Gốc P0 = góc gần người xem nhất của lô đất.
  · u = cạnh chạy sang phải, v = cạnh chạy về phía sau.
  · Một điểm trên mặt đất = P0 + a·u + b·v  (a, b chạy từ 0 đến 1).
  · Lên cao thì trừ vào toạ độ y (trục đứng trong phép chiếu này).
Nhờ vậy nhà, sân, hàng rào, lối đi đều nằm khít trong lô đất.
"""

# Hình bình hành của lô đất, lấy nguyên từ bản thiết kế (class "b5-plot")
P0 = (601.8, 745.9)        # góc trước (gần người xem)
P1 = (651.0, 723.6)        # góc phải
P3 = (572.5, 721.6)        # góc trái
U = (P1[0] - P0[0], P1[1] - P0[1])
V = (P3[0] - P0[0], P3[1] - P0[1])

TANG = 10.4                # chiều cao một tầng
SO_TANG = 3


def d(a, b, z=0.0):
    """Điểm trên lô đất: a chạy theo cạnh phải, b chạy về phía sau, z là độ cao."""
    return (P0[0] + a * U[0] + b * V[0],
            P0[1] + a * U[1] + b * V[1] - z)


def ds(*ps):
    """Nối các điểm thành một đường khép kín."""
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in ps) + 'Z'


def mo(*ps):
    """Nối các điểm thành một đường hở."""
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in ps)


# ── Khối nhà: chiếm phần sau bên trái của lô, chừa sân vườn phía trước phải ──
A0, A1 = 0.07, 0.58        # phạm vi theo cạnh phải
B0, B1 = 0.36, 0.95        # phạm vi theo cạnh sau
H = TANG * SO_TANG

A = d(A0, B0); B = d(A1, B0); C = d(A1, B1); D = d(A0, B1)          # nền nhà
At = d(A0, B0, H); Bt = d(A1, B0, H); Ct = d(A1, B1, H); Dt = d(A0, B1, H)   # đỉnh tường
Am = d(A0, B0, H + 3.2); Bm = d(A1, B0, H + 3.2)
Cm = d(A1, B1, H + 3.2); Dm = d(A0, B1, H + 3.2)                     # lan can sân thượng


def cua_so(mat, tang, i, tong):
    """Một ô cửa sổ trên mặt tường. `mat` = 'phai' (theo cạnh u) hoặc 'trai'."""
    z0 = tang * TANG + 3.0
    z1 = z0 + 4.6
    buoc = (A1 - A0) / tong if mat == 'phai' else (B1 - B0) / tong
    g0 = (A0 if mat == 'phai' else B0) + buoc * (i + 0.22)
    g1 = (A0 if mat == 'phai' else B0) + buoc * (i + 0.78)
    if mat == 'phai':
        return ds(d(g0, B0, z0), d(g1, B0, z0), d(g1, B0, z1), d(g0, B0, z1))
    return ds(d(A0, g0, z0), d(A0, g1, z0), d(A0, g1, z1), d(A0, g0, z1))


# ── Cây trong sân: thân + tán ───────────────────────────────────────────────
def cay(a, b, cao=7.0, tan=3.4):
    goc = d(a, b)
    ngon = d(a, b, cao)
    return (f'<path d="{mo(goc, ngon)}" stroke="#a16207" stroke-width="1.1" fill="none"/>'
            f'<circle cx="{ngon[0]:.1f}" cy="{ngon[1]:.1f}" r="{tan:.1f}" '
            f'fill="#22c55e" opacity=".55"/>')


def sinh():
    """Trả về (nhóm mặt, nhóm nét) để tach-banner.py ghép vào mẫu 15."""
    # ── 1. Nhóm MẶT PHẲNG (tô màu) ──────────────────────────────────────────
    mat = []
    # sân vườn: phần lô đất còn lại
    mat.append(f'<path d="{ds(d(0.62,0.02), d(0.99,0.02), d(0.99,0.98), d(0.62,0.98))}" '
               f'fill="#16a34a" opacity=".28"/>')
    mat.append(f'<path d="{ds(d(0.02,0.02), d(0.60,0.02), d(0.60,0.32), d(0.02,0.32))}" '
               f'fill="#16a34a" opacity=".28"/>')
    # lối đi từ góc lô vào cửa
    mat.append(f'<path d="{ds(d(0.20,0.05), d(0.34,0.05), d(0.34,0.34), d(0.20,0.34))}" '
               f'fill="#e7e5e4" opacity=".75"/>')
    # hai mặt tường nhìn thấy
    mat.append(f'<path d="{ds(A, B, Bt, At)}" fill="rgba(255,255,255,.86)"/>')      # mặt phải
    mat.append(f'<path d="{ds(A, D, Dt, At)}" fill="rgba(226,232,240,.74)"/>')      # mặt trái
    # sân thượng + lan can
    mat.append(f'<path d="{ds(At, Bt, Ct, Dt)}" fill="url(#c15Roof)"/>')
    mat.append(f'<path d="{ds(At, Bt, Bm, Am)}" fill="rgba(255,255,255,.55)"/>')
    mat.append(f'<path d="{ds(At, Dt, Dm, Am)}" fill="rgba(226,232,240,.5)"/>')
    # cửa sổ
    for t in range(SO_TANG):
        for i in range(3):
            mat.append(f'<path d="{cua_so("phai", t, i, 3)}" fill="#7dd3fc" opacity=".9"/>')
        for i in range(2):
            mat.append(f'<path d="{cua_so("trai", t, i, 2)}" fill="#7dd3fc" opacity=".8"/>')
    # cửa chính ở tầng trệt, mặt phải
    mat.append(f'<path d="{ds(d(0.22,B0,0), d(0.33,B0,0), d(0.33,B0,6.4), d(0.22,B0,6.4))}" '
               f'fill="#7c2d12" opacity=".9"/>')
    # cây trong sân
    for a, b in ((0.76, 0.18), (0.88, 0.55), (0.72, 0.84), (0.16, 0.12)):
        mat.append(cay(a, b))

    nhom_mat = '<g class="b5-face" data-at="3300" data-once>' + ''.join(mat) + '</g>'

    # ── 2. Nhóm NÉT VẼ (chạy hiệu ứng vẽ dần) ───────────────────────────────
    net = []
    net.append(f'<path class="draw" pathLength="1" style="--dur:700" stroke="#67e8f9" '
               f'd="{ds(A, B, C, D)}"/>')                                   # nền nhà
    canh = 'M' + 'M'.join(f'{p[0]:.1f} {p[1]:.1f}L{q[0]:.1f} {q[1]:.1f}'.lstrip('M')
                          for p, q in ((A, At), (B, Bt), (C, Ct), (D, Dt)))
    canh = ''.join(f'M{p[0]:.1f} {p[1]:.1f}L{q[0]:.1f} {q[1]:.1f}'
                   for p, q in ((A, At), (B, Bt), (C, Ct), (D, Dt)))
    net.append(f'<path class="draw" pathLength="1" style="--d:600;--dur:600" stroke="#f8fafc" '
               f'd="{canh}"/>')                                             # 4 cạnh đứng
    san = ''.join(f'M{d(A0,B0,z)[0]:.1f} {d(A0,B0,z)[1]:.1f}'
                  f'L{d(A1,B0,z)[0]:.1f} {d(A1,B0,z)[1]:.1f}'
                  f'M{d(A0,B0,z)[0]:.1f} {d(A0,B0,z)[1]:.1f}'
                  f'L{d(A0,B1,z)[0]:.1f} {d(A0,B1,z)[1]:.1f}'
                  for z in (TANG, TANG * 2))
    net.append(f'<path class="draw" pathLength="1" style="--d:1200;--dur:600" stroke="#f8fafc" '
               f'opacity=".8" d="{san}"/>')                                 # vạch chia tầng
    net.append(f'<path class="draw" pathLength="1" style="--d:1800;--dur:700" stroke="#fde68a" '
               f'd="{ds(Am, Bm, Cm, Dm)}"/>')                               # lan can sân thượng
    nhom_net = '<g class="grp b5-wire c15-wire" data-at="1000" data-once>' + ''.join(net) + '</g>'
    return nhom_mat, nhom_net


if __name__ == '__main__':
    a, b = sinh()
    print('=== NHÓM MẶT (thay cho b5-face) ===')
    print(a)
    print()
    print('=== NHÓM NÉT (thay cho b5-wire) ===')
    print(b)
