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

    ⚠️ ĐÃ ĐỔI CÁCH LÀM: trước đây vẽ căn nhà bằng vector. Chủ dự án xem rồi chê
       "vẽ đang sơ sài quá", "chưa rõ 3D lắm", và dặn **để ẢNH THẬT vào**.
       Nay phần khối nhà là ẢNH CHỤP THẬT một căn biệt thự tân cổ điển, đã cắt
       nền trong suốt bằng scripts/banner11/tach-biet-thu-mau15.py.
       Phần vẽ tay chỉ còn: nét phác thảo lô đất + hàng rào (chạy hiệu ứng "vẽ
       dần" trước), rồi căn nhà thật hiện lên đè vào — đúng mạch chuyện
       "phác thảo ngôi nhà trên đất của bạn".

    Cách tính chỗ đặt ảnh (đừng ướm mắt, tính lại theo lối này nếu đổi ảnh):
      · khung nhìn của mẫu là `viewBox="250 566 700 226"`, cắt kiểu slice nên
        phần THẤY ĐƯỢC chỉ là y ≈ 577…781;
      · đáy banner còn bị khung tìm kiếm cao ~38 đơn vị che → nội dung phải nằm
        trên y ≈ 735;
      · CỠ ẢNH phải ăn theo ảnh nền: trong ảnh nền có hàng dừa cao chừng 40
        đơn vị, nên khu đất rộng ~128 đơn vị là vừa mắt — đúng bằng khung đỏ
        chủ dự án khoanh. Để 225 đơn vị như lần trước thì căn nhà to lấn át cả
        cánh đồng, nhìn không thật.
      · đáy ảnh đặt ở y = 690, tức mép trước lô đất, để căn nhà đứng trên đúng
        khoảng cỏ phẳng giữa ảnh.
    """
    # Ảnh khu đất thật: 780×555 điểm ảnh ⇒ tỉ lệ ngang/dọc 1,4054
    # (gồm cả nhà, sân vườn, nhà để xe, hàng rào và mặt đường trước nhà)
    ANH_X, ANH_Y = 637.1, 599.0
    ANH_W, ANH_H = 125.8, 91.0

    mat = []
    # ── Sân cỏ của lô (chỉ một lớp xanh nhạt, phần còn lại ảnh nhà đã có sẵn) ─
    mat.append('<path d="%s" fill="%s" opacity=".22"/>'
               % (ds(d(0.02, 0.02), d(0.98, 0.02), d(0.98, 0.98), d(0.02, 0.98)), CO))
    # ── Bóng đổ dưới chân nhà cho căn nhà "dính" xuống đất ───────────────────
    tam = d(0.5, 0.42)
    mat.append('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="#0f172a" opacity=".22"/>'
               % (tam[0], tam[1] + TANG * 0.10, DAI_U * 0.52, DAI_U * 0.17))
    # ── CĂN BIỆT THỰ THẬT ────────────────────────────────────────────────────
    mat.append('<image href="/banner11/m15-bietthu.webp" x="%.1f" y="%.1f" '
               'width="%.1f" height="%.1f" preserveAspectRatio="xMidYMax meet"/>'
               % (ANH_X, ANH_Y, ANH_W, ANH_H))
    # (Không vẽ thêm cây nữa: ảnh khu đất đã có sẵn cây, hàng rào và lối đi.)

    nhom_mat = '<g class="b5-face" data-at="3300" data-once>' + ''.join(mat) + '</g>'

    # ── Nét phác thảo: ranh lô + khối nhà + hàng rào (vẽ dần trước khi ảnh hiện)
    net = []
    net.append('<path class="draw" pathLength="1" style="--dur:700" stroke="#67e8f9" d="%s"/>'
               % ds(d(0.02, 0.02), d(0.98, 0.02), d(0.98, 0.98), d(0.02, 0.98)))
    H = TANG * 2.2
    canh = ''.join('M%.1f %.1fL%.1f %.1f' % (p[0], p[1], q[0], q[1])
                   for p, q in ((d(A0, B0), d(A0, B0, H)), (d(A1, B0), d(A1, B0, H)),
                                (d(A1, B1), d(A1, B1, H)), (d(A0, B1), d(A0, B1, H))))
    net.append('<path class="draw" pathLength="1" style="--d:500;--dur:600" stroke="#f8fafc" '
               'opacity=".9" d="%s"/>' % canh)
    net.append('<path class="draw" pathLength="1" style="--d:1100;--dur:600" stroke="#f8fafc" '
               'opacity=".9" d="%s"/>'
               % ds(d(A0, B0, H), d(A1, B0, H), d(A1, B1, H), d(A0, B1, H)))
    z_rao = TANG * 0.38
    net.append('<path class="draw" pathLength="1" style="--d:1700;--dur:800" stroke="#fde68a" '
               'opacity=".9" d="%s"/>'
               % mo(d(0.02, 0.02, z_rao), d(0.98, 0.02, z_rao), d(0.98, 0.98, z_rao),
                    d(0.02, 0.98, z_rao), d(0.02, 0.02, z_rao)))
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
