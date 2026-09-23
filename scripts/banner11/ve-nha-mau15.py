# -*- coding: utf-8 -*-
"""
VẼ BIỆT THỰ TÂN CỔ ĐIỂN CÓ SÂN VƯỜN — MẪU BANNER 15
====================================================
Mẫu 15 "Hình dung ngôi nhà trên đất của bạn" vẽ phác thảo một căn nhà đặt lên lô
đất trong ảnh. Đã qua ba đời:
  · bản thiết kế gốc: nhà 1 trệt mái thái;
  · lần sửa trước: nhà hộp 3 tầng — chủ dự án chê "vẽ đang sơ sài quá, sân vườn
    cũng xấu";
  · nay: BIỆT THỰ TÂN CỔ ĐIỂN 3 tầng, có hàng cột lớn chạy suốt hai tầng, ban
    công con tiện, mái dốc có ô văng giữa, cùng sân vườn đủ cổng, lối xe, bồn
    hoa tròn, hàng rào và cây.
Chủ dự án còn dặn DỜI lô đất lên khoảng cỏ trống ở giữa ảnh (chỗ khoanh đỏ) —
nên bốn góc lô dưới đây là chỗ mới, không còn là chỗ cũ ở mép dưới ảnh.

Chạy:  python scripts/banner11/ve-nha-mau15.py
       → in ra 2 đoạn mã SVG (dùng để xem thử). Lúc dựng banner thì
         scripts/banner11/tach-banner.py tự gọi hàm sinh() ở đây.

CÁCH VẼ — vì sao không vẽ tay từng điểm:
Lô đất là một hình bình hành vẽ theo phép chiếu trục đo (nhìn chéo). Muốn mọi
thứ đứng ĐÚNG trên lô đất thì phải tính theo chính hai cạnh của hình bình hành:
  · Gốc P0 = góc gần người xem nhất của lô đất.
  · U = cạnh chạy sang phải, V = cạnh chạy về phía sau.
  · Một điểm trên mặt đất = P0 + a·U + b·V  (a, b chạy từ 0 đến 1).
  · Lên cao thì trừ vào toạ độ y (trục đứng trong phép chiếu này).
Nhờ vậy nhà, sân, hàng rào, lối đi đều nằm khít trong lô đất, và ĐỔI LÔ ĐẤT thì
chỉ cần sửa 3 điểm P0/P1/P3 ở đây rồi chạy lại.

⚠️ Sửa P0/P1/P3 thì PHẢI sửa luôn đường vẽ lô đất trong THAY_DOAN[15] của
   scripts/banner11/tach-banner.py (hai chỗ: `b5-grid` và `b5-plot`), nếu không
   căn nhà sẽ đứng lệch ra ngoài khung lô.
"""

# ── Hình bình hành của lô đất ───────────────────────────────────────────────
# Chỗ mới: khoảng cỏ trống, phẳng và sáng, ở giữa ảnh (chủ dự án khoanh đỏ).
P0 = (676.0, 690.0)        # góc trước (gần người xem)
P1 = (762.0, 668.0)        # góc phải
P3 = (649.0, 660.0)        # góc trái
P2 = (P1[0] + P3[0] - P0[0], P1[1] + P3[1] - P0[1])   # góc sau (tự suy ra)

U = (P1[0] - P0[0], P1[1] - P0[1])
V = (P3[0] - P0[0], P3[1] - P0[1])

# Chiều cao một tầng, lấy theo bề ngang lô cho cân đối dù lô to hay nhỏ
DAI_U = (U[0] ** 2 + U[1] ** 2) ** 0.5
TANG = DAI_U * 0.155      # biệt thự phải BỀ NGANG hơn chiều cao mới ra dáng;
#                           để 0,20 là thành nhà ống 3 tầng, nhìn cao lêu nghêu
SO_TANG = 3

# Phạm vi khối nhà trên lô: lùi về phía sau, chừa sân vườn phía trước và bên phải
A0, A1 = 0.06, 0.78
B0, B1 = 0.30, 0.93


def d(a, b, z=0.0):
    """Điểm trên lô đất: a chạy theo cạnh phải, b chạy về phía sau, z là độ cao."""
    return (P0[0] + a * U[0] + b * V[0],
            P0[1] + a * U[1] + b * V[1] - z)


def ds(*ps):
    """Nối các điểm thành một đường khép kín."""
    return 'M' + 'L'.join('%.1f %.1f' % (x, y) for x, y in ps) + 'Z'


def mo(*ps):
    """Nối các điểm thành một đường hở."""
    return 'M' + 'L'.join('%.1f %.1f' % (x, y) for x, y in ps)


def khoi(a0, a1, b0, b1, z0, z1):
    """Bốn mặt nhìn thấy của một khối hộp đứng: (mặt phải, mặt trái, mặt trên)."""
    mat_phai = ds(d(a0, b0, z0), d(a1, b0, z0), d(a1, b0, z1), d(a0, b0, z1))
    mat_trai = ds(d(a0, b0, z0), d(a0, b1, z0), d(a0, b1, z1), d(a0, b0, z1))
    mat_tren = ds(d(a0, b0, z1), d(a1, b0, z1), d(a1, b1, z1), d(a0, b1, z1))
    return mat_phai, mat_trai, mat_tren


# ── Bảng màu phác thảo ──────────────────────────────────────────────────────
TUONG_SANG = 'rgba(255,253,245,.92)'     # mặt hứng nắng
TUONG_TOI = 'rgba(226,232,240,.78)'      # mặt khuất
GO = '#7c2d12'
KINH = '#7dd3fc'
CO = '#16a34a'
DA = '#e7e5e4'


def cay(a, b, cao=None, tan=None, mau=CO):
    """Một cái cây trong sân: thân + tán."""
    cao = cao if cao is not None else TANG * 0.62
    tan = tan if tan is not None else TANG * 0.30
    goc = d(a, b)
    ngon = d(a, b, cao)
    return ('<path d="%s" stroke="#a16207" stroke-width="%.1f" fill="none"/>'
            '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" opacity=".55"/>'
            '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" opacity=".4"/>'
            % (mo(goc, ngon), max(0.8, TANG * 0.07), ngon[0], ngon[1], tan, mau,
               ngon[0] - tan * 0.5, ngon[1] + tan * 0.35, tan * 0.7, mau))


def sinh():
    """Trả về (nhóm mặt, nhóm nét) để tach-banner.py ghép vào mẫu 15.

    Bố cục lấy theo đúng ảnh mẫu chủ dự án gửi (biệt thự tân cổ điển 1 tầng
    mái thái của một đơn vị thiết kế):
      · khối nhà lùi hẳn về góc SAU–TRÁI của lô;
      · mái thái lớn màu xám đậm, nhiều mái phụ, giữa mặt trước có khối mái đua
        cao hẳn lên — đây là thứ đập vào mắt đầu tiên, phải vẽ to;
      · sảnh chính có hàng cột trắng và bậc thềm hình bán nguyệt xoè ra sân;
      · sân trước LÁT ĐÁ cả mảng rộng chứ không phải chỉ một lối đi;
      · hàng rào trắng có trụ đều nhau chạy quanh lô, cổng mở ra mặt đường;
      · cây cọ cao ở các góc.
    """
    mat = []
    net = []

    # ── Kích thước chính ────────────────────────────────────────────────────
    cao_be = TANG * 0.20          # bệ nền nhà
    cao_tuong = TANG * 1.15       # nhà MỘT TẦNG nhưng trần cao
    cao_mai = TANG * 0.95         # mái thái rất lớn, chiếm gần nửa chiều cao nhà
    z_mai = cao_be + cao_tuong
    nhoi = 0.055                  # mái đua ra khỏi tường

    # ══ 1. SÂN VƯỜN ═════════════════════════════════════════════════════════
    mat.append('<path d="%s" fill="%s" opacity=".24"/>'
               % (ds(d(0.02, 0.02), d(0.98, 0.02), d(0.98, 0.98), d(0.02, 0.98)), CO))
    # sân lát đá: cả mảng trước nhà và chạy sang phải, như trong ảnh mẫu
    mat.append('<path d="%s" fill="#cbd5e1" opacity=".8"/>'
               % ds(d(0.06, 0.05), d(0.95, 0.05), d(0.95, 0.72), d(0.83, 0.72),
                    d(0.83, 0.27), d(0.06, 0.27)))
    # ⚠️ ĐỪNG vẽ vạch lát đá: ở khổ banner căn nhà chỉ rộng chừng 110 điểm ảnh,
    #    thêm vạch là thành một mảng rối, nhìn bẩn chứ không ra chất liệu.

    # ══ 2. KHỐI NHÀ ═════════════════════════════════════════════════════════
    p, t, _ = khoi(A0 - 0.04, A1 + 0.04, B0 - 0.04, B1 + 0.04, 0, cao_be)
    mat.append('<path d="%s" fill="rgba(226,232,240,.85)"/>' % p)
    mat.append('<path d="%s" fill="rgba(203,213,225,.8)"/>' % t)

    p, t, _ = khoi(A0, A1, B0, B1, cao_be, z_mai)
    mat.append('<path d="%s" fill="%s"/>' % (p, TUONG_SANG))
    mat.append('<path d="%s" fill="%s"/>' % (t, TUONG_TOI))

    # gờ chỉ chân tường và gờ dưới mái
    for z in (cao_be + cao_tuong * 0.18, z_mai - TANG * 0.10):
        day = TANG * 0.07
        mat.append('<path d="%s" fill="rgba(255,255,255,.96)"/>'
                   % ds(d(A0 - 0.025, B0 - 0.025, z - day), d(A1 + 0.025, B0 - 0.025, z - day),
                        d(A1 + 0.025, B0 - 0.025, z), d(A0 - 0.025, B0 - 0.025, z)))
        mat.append('<path d="%s" fill="rgba(226,232,240,.92)"/>'
                   % ds(d(A0 - 0.025, B0 - 0.025, z - day), d(A0 - 0.025, B1 + 0.025, z - day),
                        d(A0 - 0.025, B1 + 0.025, z), d(A0 - 0.025, B0 - 0.025, z)))

    # ── cửa sổ vòm trên mặt trước và mặt trái ───────────────────────────────
    def o_vom(g0, g1, z0, cao, ben=False, mau=KINH, mo_=0.88):
        gc = (g0 + g1) / 2.0
        if ben:
            than = ds(d(A0, g0, z0), d(A0, g1, z0), d(A0, g1, z0 + cao), d(A0, g0, z0 + cao))
            dinh = d(A0, gc, z0 + cao)
            r = abs(d(0, 0)[0] - d(0, (g1 - g0) / 2)[0])
        else:
            than = ds(d(g0, B0, z0), d(g1, B0, z0), d(g1, B0, z0 + cao), d(g0, B0, z0 + cao))
            dinh = d(gc, B0, z0 + cao)
            r = abs(d(0, 0)[0] - d((g1 - g0) / 2, 0)[0])
        return ('<path d="%s" fill="%s" opacity="%s"/>'
                '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="%s" opacity="%s"/>'
                % (than, mau, mo_, dinh[0], dinh[1], max(r, .6), max(r * .8, .5), mau, mo_))

    z_cua = cao_be + cao_tuong * 0.26
    h_cua = cao_tuong * 0.52
    rw = (A1 - A0) * 0.105
    for x in (0.15, 0.85):
        c = A0 + (A1 - A0) * x
        mat.append(o_vom(c - rw, c + rw, z_cua, h_cua))
    for x in (0.40, 0.78):
        c = B0 + (B1 - B0) * x
        rb = (B1 - B0) * 0.10
        mat.append(o_vom(c - rb, c + rb, z_cua, h_cua, ben=True, mo_=0.7))

    # ══ 3. SẢNH CHÍNH: hàng cột + cửa gỗ + bậc thềm bán nguyệt ═════════════
    a_sanh = A0 + (A1 - A0) * 0.50
    rong_sanh = (A1 - A0) * 0.17
    b_sanh = B0 - 0.10
    # nền sảnh nhô ra
    mat.append('<path d="%s" fill="rgba(241,245,249,.95)"/>'
               % ds(d(a_sanh - rong_sanh - 0.02, b_sanh, cao_be),
                    d(a_sanh + rong_sanh + 0.02, b_sanh, cao_be),
                    d(a_sanh + rong_sanh + 0.02, B0, cao_be),
                    d(a_sanh - rong_sanh - 0.02, B0, cao_be)))
    # cửa chính bằng gỗ
    mat.append('<path d="%s" fill="%s" opacity=".92"/>'
               % (ds(d(a_sanh - rong_sanh * .55, B0, cao_be),
                     d(a_sanh + rong_sanh * .55, B0, cao_be),
                     d(a_sanh + rong_sanh * .55, B0, cao_be + cao_tuong * .72),
                     d(a_sanh - rong_sanh * .55, B0, cao_be + cao_tuong * .72)), GO))
    # bốn cột tròn trắng đỡ mái sảnh
    rc = (A1 - A0) * 0.030
    for x in (-1.0, -0.42, 0.42, 1.0):
        ca = a_sanh + rong_sanh * x
        mat.append('<path d="%s" fill="rgba(255,255,255,.99)"/>'
                   % ds(d(ca - rc, b_sanh, cao_be), d(ca + rc, b_sanh, cao_be),
                        d(ca + rc, b_sanh, z_mai + TANG * .05),
                        d(ca - rc, b_sanh, z_mai + TANG * .05)))
        for z, dy in ((z_mai + TANG * .05, TANG * .10), (cao_be + TANG * .08, TANG * .08)):
            mat.append('<path d="%s" fill="rgba(248,250,252,.99)"/>'
                       % ds(d(ca - rc - .012, b_sanh, z - dy), d(ca + rc + .012, b_sanh, z - dy),
                            d(ca + rc + .012, b_sanh, z), d(ca - rc - .012, b_sanh, z)))
    # bậc thềm bán nguyệt xoè ra sân
    for i, (rr, bb) in enumerate(((1.35, 0.13), (1.6, 0.16), (1.85, 0.19))):
        z = cao_be * (1 - (i + 1) / 3.5)
        mat.append('<path d="%s" fill="#e2e8f0" opacity=".92"/>'
                   % ds(d(a_sanh - rong_sanh * rr, B0 - bb, z),
                        d(a_sanh + rong_sanh * rr, B0 - bb, z),
                        d(a_sanh + rong_sanh * rr, B0 - bb + .02, z + cao_be / 3.5),
                        d(a_sanh - rong_sanh * rr, B0 - bb + .02, z + cao_be / 3.5)))

    # ══ 4. MÁI THÁI LỚN — phần đập vào mắt nhất ═══════════════════════════
    MAI_SANG, MAI_TOI, MAI_SAU = '#64748b', '#475569', '#334155'
    e0, e1 = A0 - nhoi, A1 + nhoi
    f0, f1 = B0 - nhoi, B1 + nhoi
    s0 = d(A0 + 0.11, (f0 + f1) / 2, z_mai + cao_mai)
    s1 = d(A1 - 0.11, (f0 + f1) / 2, z_mai + cao_mai)
    mat.append('<path d="%s" fill="%s"/>'          # diềm mái
               % (ds(d(e0, f0, z_mai), d(e1, f0, z_mai), d(e1, f1, z_mai), d(e0, f1, z_mai)),
                  'rgba(255,255,255,.97)'))
    mat.append('<path d="%s" fill="%s"/>' % (ds(d(e0, f0, z_mai), d(e1, f0, z_mai), s1, s0), MAI_SANG))
    mat.append('<path d="%s" fill="%s"/>' % (ds(d(e0, f0, z_mai), d(e0, f1, z_mai), s0), MAI_TOI))
    mat.append('<path d="%s" fill="%s"/>'
               % (ds(d(e0, f1, z_mai), d(e1, f1, z_mai), s1, s0), MAI_SAU))
    # sống nóc + hai đường hoành cho mái có lớp
    net.append('<path class="draw" pathLength="1" style="--d:1900;--dur:700" stroke="#e2e8f0" '
               'opacity=".9" d="%s"/>' % mo(s0, s1))
    for k in (0.34, 0.66):
        pa = (d(e0, f0, z_mai)[0] + (s0[0] - d(e0, f0, z_mai)[0]) * k,
              d(e0, f0, z_mai)[1] + (s0[1] - d(e0, f0, z_mai)[1]) * k)
        pb = (d(e1, f0, z_mai)[0] + (s1[0] - d(e1, f0, z_mai)[0]) * k,
              d(e1, f0, z_mai)[1] + (s1[1] - d(e1, f0, z_mai)[1]) * k)
        mat.append('<path d="%s" stroke="rgba(226,232,240,.35)" stroke-width="%.1f" fill="none"/>'
                   % (mo(pa, pb), max(.5, TANG * .04)))

    # mái đua giữa mặt trước: khối gãy cao hẳn lên, đúng nét của ảnh mẫu
    gx0 = a_sanh - rong_sanh * 1.45
    gx1 = a_sanh + rong_sanh * 1.45
    g_dinh = d(a_sanh, f0 + 0.10, z_mai + cao_mai * 1.22)
    mat.append('<path d="%s" fill="%s"/>'
               % (ds(d(gx0, f0 - 0.02, z_mai), d(gx1, f0 - 0.02, z_mai), g_dinh), MAI_SANG))
    mat.append('<path d="%s" fill="rgba(255,255,255,.97)"/>'
               % ds(d(gx0 + 0.012, f0 - 0.012, z_mai - TANG * .04),
                    d(gx1 - 0.012, f0 - 0.012, z_mai - TANG * .04),
                    d(a_sanh, f0 - 0.012, z_mai + cao_mai * .78)))
    # ô cửa sổ nhỏ trên khối mái đua
    mat.append('<path d="%s" fill="%s" opacity=".85"/>'
               % (ds(d(a_sanh - rong_sanh * .32, f0 - 0.012, z_mai + cao_mai * .10),
                     d(a_sanh + rong_sanh * .32, f0 - 0.012, z_mai + cao_mai * .10),
                     d(a_sanh + rong_sanh * .32, f0 - 0.012, z_mai + cao_mai * .48),
                     d(a_sanh - rong_sanh * .32, f0 - 0.012, z_mai + cao_mai * .48)), KINH))

    # ══ 5. HÀNG RÀO TRẮNG CÓ TRỤ + CỔNG ═══════════════════════════════════
    z_rao = TANG * 0.42
    net.append('<path class="draw" pathLength="1" style="--d:2300;--dur:900" stroke="#f8fafc" '
               'opacity=".95" d="%s"/>'
               % mo(d(0.02, 0.02, z_rao), d(0.98, 0.02, z_rao), d(0.98, 0.98, z_rao),
                    d(0.02, 0.98, z_rao), d(0.02, 0.02, z_rao)))
    tru = []
    for k in range(6):
        tru.append((0.02 + 0.96 * k / 5.0, 0.02))
        tru.append((0.02 + 0.96 * k / 5.0, 0.98))
    for k in range(1, 4):
        tru.append((0.02, 0.02 + 0.96 * k / 4.0))
        tru.append((0.98, 0.02 + 0.96 * k / 4.0))
    for a_, b_ in tru:
        mat.append('<path d="%s" stroke="rgba(255,255,255,.95)" stroke-width="%.1f" fill="none"/>'
                   % (mo(d(a_, b_), d(a_, b_, z_rao * 1.3)), max(.7, TANG * .055)))
    # cổng chính mở ra mặt trước
    # ⚠️ Hai trụ cổng là HAI đoạn rời. Trước đây nối chuỗi kiểu cắt bỏ chữ "M"
    #    của đoạn sau → hai trụ dính thành một vệt dài chạy ra ngoài lô.
    net.append('<path class="draw" pathLength="1" style="--d:3000;--dur:600" stroke="#fde68a" d="%s"/>'
               % (mo(d(0.56, 0.02), d(0.56, 0.02, z_rao * 1.55))
                  + mo(d(0.84, 0.02), d(0.84, 0.02, z_rao * 1.55))))
    net.append('<path class="draw" pathLength="1" style="--d:3200;--dur:500" stroke="#fde68a" '
               'opacity=".9" d="%s"/>'
               % mo(d(0.56, 0.02, z_rao * 1.5), d(0.70, 0.02, z_rao * 1.62),
                    d(0.84, 0.02, z_rao * 1.5)))

    # ══ 6. NÉT DỰNG HÌNH (chạy hiệu ứng vẽ dần) ═══════════════════════════
    net.insert(0, '<path class="draw" pathLength="1" style="--dur:700" stroke="#67e8f9" d="%s"/>'
               % ds(d(A0, B0), d(A1, B0), d(A1, B1), d(A0, B1)))
    canh = ''.join('M%.1f %.1fL%.1f %.1f' % (p[0], p[1], q[0], q[1])
                   for p, q in ((d(A0, B0), d(A0, B0, z_mai)), (d(A1, B0), d(A1, B0, z_mai)),
                                (d(A1, B1), d(A1, B1, z_mai)), (d(A0, B1), d(A0, B1, z_mai))))
    net.insert(1, '<path class="draw" pathLength="1" style="--d:600;--dur:600" stroke="#f8fafc" d="%s"/>'
               % canh)

    nhom_mat = '<g class="b5-face" data-at="3300" data-once>' + ''.join(mat)
    # cây cọ ở các góc sân — vẽ SAU khối nhà nên không bị tường che
    for a_, b_ in ((0.93, 0.22), (0.95, 0.72), (0.10, 0.10), (0.30, 0.95)):
        nhom_mat += cay(a_, b_, cao=TANG * 1.15, tan=TANG * 0.34, mau='#15803d')
    nhom_mat += cay(0.72, 0.93, cao=TANG * 0.8, tan=TANG * 0.26)
    nhom_mat += '</g>'

    nhom_net = ('<g class="grp b5-wire c15-wire" data-at="1000" data-once>'
                + ''.join(net) + '</g>')
    return nhom_mat, nhom_net


def duong_lo():
    """Đường vẽ hình lô đất — dán vào THAY_DOAN[15] của tach-banner.py."""
    return ds(P0, P1, P2, P3)


if __name__ == '__main__':
    a, b = sinh()
    print('=== DUONG VE LO DAT (thay cho b5-grid va b5-plot) ===')
    print(duong_lo())
    print()
    print('=== NHOM MAT (thay cho b5-face) ===')
    print(a)
    print()
    print('=== NHOM NET (thay cho b5-wire) ===')
    print(b)
