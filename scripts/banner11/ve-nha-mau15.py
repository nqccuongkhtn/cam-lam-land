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

import os

# ── CHỖ ĐẶT ẢNH KHU ĐẤT TRÊN BẢN VẼ ────────────────────────────────────────
# Khung nhìn của mẫu là viewBox="250 566 700 226", cắt kiểu slice nên phần
# THẤY ĐƯỢC chỉ là y ≈ 577…781; đáy banner còn bị khung tìm kiếm cao ~38 đơn vị
# che, nên nội dung phải nằm trên y ≈ 735.
# CỠ ẢNH ăn theo ảnh nền: hàng dừa trong ảnh nền cao chừng 40 đơn vị, nên khu
# đất rộng ~126 đơn vị là vừa mắt — đúng bằng khung đỏ chủ dự án khoanh. Để 225
# như lần đầu thì căn nhà to lấn át cả cánh đồng, nhìn không thật.
# ⚠️ TỈ LỆ PHẢI ĐÚNG TỈ LỆ TỆP ẢNH (1014×818 → 1,239). Ghi sai thì thẻ <image>
#    với preserveAspectRatio="meet" sẽ chừa viền trống một bên, và quan trọng
#    hơn: lớp nét và lớp ảnh thật lệch nhau.
ANH_X = 636.9            # mép trái ảnh
ANH_DAY = 690.0          # ĐÁY ảnh — mép trước lô đất, đặt trên khoảng cỏ phẳng
ANH_W = 126.2
ANH_H = round(ANH_W * 818 / 1014, 1)
# Giữ lại cho mấy hàm cũ (_doc_goc, duong_lo) vẫn chạy được.
ANH_Y = ANH_DAY - ANH_H

# ── Hình bình hành của lô đất ───────────────────────────────────────────────
# ⚠️ BA GÓC NÀY KHÔNG CHÉP TAY NỮA. Chúng là HÀNG RÀO THẬT trong ảnh, do
#    scripts/banner11/tach-biet-thu-mau15.py đọc trên ảnh gốc rồi ghi ra
#    banner11/m15-khung.json cùng lúc với việc cắt ảnh. Ở đây chỉ quy đổi từ
#    điểm ảnh sang toạ độ bản vẽ theo đúng chỗ đặt ảnh ở trên.
#    Lý do: trước đây chép tay ba con số sang. Cắt lại ảnh cho chuẩn hơn một
#    cái là khung ảnh đổi, nét phác thảo lệch hẳn khỏi hàng rào mà không có
#    dấu hiệu gì báo — đúng lỗi "vẽ chưa khớp" chủ dự án từng nhắc.
def _doc_goc():
    """Đổi ba góc lô từ điểm ảnh trong ảnh đã cắt sang toạ độ bản vẽ."""
    import json
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     '..', '..', 'apps', 'frontend', 'public', 'banner11',
                     'm15-khung.json')
    with open(os.path.abspath(p), encoding='utf-8') as f:
        k = json.load(f)
    # SVG đặt ảnh bằng preserveAspectRatio="xMidYMax meet": thu cho vừa khung,
    # căn giữa theo chiều ngang, dán đáy xuống mép dưới khung.
    ti = min(ANH_W / k['rong'], ANH_H / k['cao'])
    ox = ANH_X + (ANH_W - k['rong'] * ti) / 2
    oy = ANH_Y + (ANH_H - k['cao'] * ti)
    doi = lambda p: (ox + p[0] * ti, oy + p[1] * ti)
    g = k['goc']
    vien = [doi(p) for p in k.get('vien') or []]
    # Chiều cao tường rào: đo trên ảnh gốc khoảng 30 điểm ảnh.
    return doi(g['truoc']), doi(g['phai']), doi(g['trai']), vien, 30 * ti


P0, P1, P3, VIEN, CAO_RAO = _doc_goc()   # góc trước · góc phải · góc trái · hàng rào
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


# ── CHỖ ĐẶT HAI LỚP ẢNH TRÊN BẢN VẼ ────────────────────────────────────────
# Ảnh gốc 1200×840. Đặt bằng preserveAspectRatio="none" NHƯNG khung khai đúng
# tỉ lệ 1200/840 → không méo một chút nào, mà mình lại tự quyết định được
# phần nào của ảnh lọt vào khung nhìn.
#   khung nhìn của mẫu: viewBox="250 566 700 226"
#   tỉ lệ thu: 700/1200 = 0,583  →  cao 840 × 0,583 = 490
#   Khung nhìn chỉ cao 226 đơn vị mà ảnh thu về cao 490 → chỉ thấy được một
#   DẢI NGANG 388 hàng của ảnh gốc. Không thể thấy cả tấm: ảnh tỉ lệ 1,43 mà
#   khung banner tỉ lệ 3,1, muốn thấy hết thì ảnh phải thu nhỏ tới mức không
#   phủ kín bề ngang nữa.
#   NEN_Y = 512 → thấy hàng 92…480, tức là thân nhà, ban công, mái hiên, lối
#   xe và chiếc ô tô. Đây là phần "ra hình căn nhà" nhất.
#   Kéo NEN_Y XUỐNG thì thấy nhiều phần trên (nóc mái, cây cối); kéo LÊN thì
#   thấy nhiều sân hơn nhưng cụt mái.
# ⚠️ HAI LỚP PHẢI DÙNG ĐÚNG BỐN SỐ NÀY. Lệch một đơn vị là bản vẽ không trùng
#    ảnh — mà khớp chính là lý do tồn tại của cách làm này.
NEN_X, NEN_Y = 250.0, 512.0
NEN_W, NEN_H = 700.0, 490.0
KHUNG_ANH = ('x="%.1f" y="%.1f" width="%.1f" height="%.1f" '
             'preserveAspectRatio="none"' % (NEN_X, NEN_Y, NEN_W, NEN_H))


def sinh():
    """Trả về (nhóm nền + ảnh thật, nhóm bản vẽ 2D) cho mẫu 15.

    ⚠️ ĐÃ ĐỔI CÁCH LÀM BỐN LẦN — ghi lại để đừng quay về đường cũ:
       · Đời 1: vẽ căn nhà bằng vector → "vẽ đang sơ sài quá".
       · Đời 2: ảnh thật căn biệt thự + nét phác thảo VẼ TAY bám hàng rào →
         vẫn lệch, vì nét và ảnh dựng từ hai nguồn khác nhau.
       · Đời 3: cắt lô đất khỏi ảnh rồi dán lên một tấm ảnh cánh đồng khác →
         chủ dự án hỏi thẳng "sao không lấy nền là ảnh đó luôn".
       · Đời 4 (nay): CHÍNH TẤM ẢNH ĐÓ LÀM NỀN CẢ BANNER, bản vẽ 2D phủ đúng
         lên trên. Chủ dự án chốt: "ghé vào nó sẽ khớp 100%".

    Hai tệp do scripts/banner11/tach-lo-dat-mau15.py dựng, CÙNG KHỔ 1200×840:
        /banner11/m15-nen.webp  ảnh nền (nguyên tấm)
        /banner11/m15-net.webp  bản vẽ 2D, máy dò nét từ chính tấm ảnh đó
    Cùng khổ + cùng khung đặt ⇒ khớp tuyệt đối, không còn chỗ cho sai lệch.

    Mạch chuyện: nền hiện ra xám và mờ → bản vẽ 2D lộ dần từ trái sang như
    đang vẽ → nền sáng có màu trở lại, bản vẽ nhạt đi.
    """
    # Lớp NỀN: chính tấm ảnh, ban đầu xám rồi lên màu (lớp .m15-nen trong
    # banner11-them.css lo phần đổi màu).
    nhom_mat = ('<g class="b5-face" data-at="3300" data-once>'
                '<image class="m15-nen" href="/banner11/m15-nen.webp" %s/>'
                '</g>' % KHUNG_ANH)

    # Lớp BẢN VẼ 2D. Hiệu ứng "vẽ dần" của bản thiết kế dùng stroke-dasharray
    # — chỉ chạy được với đường vector. Đây là ẢNH nên phải che bớt rồi mở dần
    # (lớp .m15-ve trong banner11-them.css).
    nhom_net = ('<g class="grp b5-wire c15-wire" data-at="1000" data-once>'
                '<image class="m15-ve" href="/banner11/m15-net.webp" %s/>'
                '</g>' % KHUNG_ANH)
    return nhom_mat, nhom_net


def duong_lo():
    """Hình lô đất — dán vào THAY_DOAN[15] của tach-banner.py.

    ⚠️ NAY TRẢ VỀ ĐƯỜNG RỖNG, CỐ Ý. Ranh giới lô đất đã nằm sẵn TRONG bản vẽ
       2D (/banner11/m15-lo-net.webp — xem tach-lo-dat-mau15.py, chỗ vẽ thêm
       đường RANH). Vẽ thêm một đường lô bằng SVG ở đây là có HAI đường ranh
       chồng nhau mà không trùng nhau, nhìn ra ngay là lệch.
       Vẫn giữ hàm để tach-banner.py khỏi phải sửa, chỉ cho nó vẽ ra hư không.
    """
    return 'M0 0' 


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
