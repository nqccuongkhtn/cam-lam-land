# -*- coding: utf-8 -*-
"""
LOGO THEO NGÀY LỄ
==================
Chủ dự án muốn: ngày thường dùng logo gốc (ngôi nhà + chữ CL + sóng + mặt
trời), còn đến dịp lễ thì logo tự đổi sang bản có trang trí của dịp đó.

Script này KHÔNG vẽ lại logo. Nó lấy đúng hai tệp logo gốc
(logo-cam-lam.webp cho nền tối, logo-cam-lam-toi.webp cho nền sáng) rồi VẼ
THÊM chi tiết trang trí lên trên, ghi ra thư mục:

    apps/frontend/public/logo-le/<mã>.webp        (dùng khi nền tối)
    apps/frontend/public/logo-le/<mã>-toi.webp    (dùng khi nền sáng)

CHỖ TRỐNG ĐỂ TRANG TRÍ — đo trên chính logo gốc 435×288:
  · góc trên phải  x 300…435, y 0…140   → rộng rãi nhất, để đồ trang trí chính
  · góc trên trái  x 0…110,  y 0…85     → để thêm vài chi tiết nhỏ
  · đỉnh mái nhà   ≈ (185, 28)          → chỗ đội mũ (Noel)
  · mặt trời       tâm ≈ (352, 220), bán kính ≈ 50
  · sóng biển      y 230…275

⚠️ LOGO CHỈ HIỆN Ở CỠ 48×32 TRÊN MÀN HÌNH. Tức mọi chi tiết bị thu nhỏ hơn
   chín lần. Nên trang trí phải TO, ĐẶC và ÍT CHI TIẾT — vẽ cành mai mười bông
   li ti thì ngoài web chỉ thấy một vệt vàng. Mỗi dịp chỉ một hình chính,
   to khoảng một phần tư chiều cao logo.

⚠️ VẼ Ở CỠ GẤP 4 RỒI MỚI THU LẠI (biến PHONG). Vẽ thẳng ở cỡ thật thì mọi
   đường xiên đều răng cưa, đặt cạnh logo gốc (vốn rất mượt) là lộ ngay.

Chạy:  python scripts/dung-logo-ngay-le.py
       → ghi các tệp logo lễ + một tấm ảnh xem thử để chủ dự án duyệt.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CONG = os.path.join(GOC, 'apps', 'frontend', 'public')
RA = os.path.join(CONG, 'logo-le')

PHONG = 4                    # vẽ ở cỡ gấp 4 cho mượt rồi thu lại

# ── HAI BẢNG MÀU, KHÔNG PHẢI MỘT ───────────────────────────────────────────
# ⚠️ Chủ dự án báo: "nền trong suốt thì các hiệu ứng dễ thấy, nhưng qua nền
#    trắng thì không thấy". Đúng — vàng kem đặt trên nền navy thì nổi bật, còn
#    đặt trên nền TRẮNG thì gần như cùng màu với nền, mất hút.
#    Nên mỗi nền một bảng màu riêng: nền tối dùng vàng SÁNG, nền sáng dùng
#    vàng NÂU ĐẬM (cùng tông thương hiệu nhưng tối hơn hẳn nền).
#    Đỏ và hồng thì nổi trên cả hai nền nên gần như giữ nguyên.
TRANG = (250, 251, 252)
NAVY = (19, 52, 89)
VANG_CO = (255, 222, 0)      # ngôi sao trên cờ — luôn nằm trên nền đỏ nên không đổi

# ⚠️ MÀU PHẢI TƯƠI. Chủ dự án xem bộ logo và nhận xét "màu hoa mai trang trí
#    và màu vua hùng chưa tươi, màu doanh nhân cũng vậy". Ba chỗ đó đều lấy
#    màu từ `vang`, `vang_sang` và `do_tet` — nên chỉnh ở đây là cả ba cùng
#    tươi lên, khỏi sửa từng hàm vẽ.
#    Cách chỉnh: KÉO ĐỘ BÃO HOÀ LÊN chứ không chỉ làm sáng. Vàng cũ
#    (229,188,98) lệch sang nâu vì kênh xanh lam còn cao; hạ kênh lam xuống
#    và nâng kênh đỏ thì ra vàng rực. Đỏ cũng vậy.
#    ⚠️ ĐỪNG kéo tiếp nữa: quá mức thì trên nền navy màu bị "cháy", mất hết
#       sắc độ và nhìn như hình dán rẻ tiền.
MAU_NEN_TOI = dict(
    net=TRANG,
    vang=(248, 199, 72), vang_sang=(255, 221, 92), kem=(245, 222, 170),
    nau=(146, 90, 46), do=(232, 42, 32), do_tet=(228, 46, 46),
    hong=(244, 118, 146), xanh=(96, 156, 80), vang_co=VANG_CO,
)
# Nền sáng (thanh menu trắng): cùng sắc nhưng đậm hơn cho đọc rõ trên trắng.
MAU_NEN_SANG = dict(
    net=NAVY,
    vang=(198, 138, 16), vang_sang=(216, 156, 20), kem=(186, 140, 60),
    nau=(96, 58, 30), do=(210, 28, 20), do_tet=(206, 30, 30),
    hong=(220, 62, 108), xanh=(62, 116, 52), vang_co=VANG_CO,
)

def sao(d, cx, cy, r, mau, canh=5, trong=0.42, xoay=-90):
    """Ngôi sao `canh` cánh. `trong` là tỉ lệ bán kính chỗ lõm vào."""
    ds = []
    for i in range(canh * 2):
        g = math.radians(xoay + i * 180.0 / canh)
        bk = r if i % 2 == 0 else r * trong
        ds.append((cx + bk * math.cos(g), cy + bk * math.sin(g)))
    d.polygon(ds, fill=mau)


def hoa(d, cx, cy, r, mau, nhuy, canh=5):
    """Bông hoa: mấy cánh tròn xếp quanh một nhuỵ."""
    for i in range(canh):
        g = math.radians(-90 + i * 360.0 / canh)
        x, y = cx + r * 0.62 * math.cos(g), cy + r * 0.62 * math.sin(g)
        d.ellipse([x - r * 0.46, y - r * 0.46, x + r * 0.46, y + r * 0.46], fill=mau)
    d.ellipse([cx - r * 0.26, cy - r * 0.26, cx + r * 0.26, cy + r * 0.26], fill=nhuy)


def tia(d, cx, cy, r1, r2, mau, so=12, day=3.0, xoay=0.0):
    """Chùm tia toả ra từ tâm (dùng cho pháo hoa và ngôi sao trống đồng)."""
    for i in range(so):
        g = math.radians(xoay + i * 360.0 / so)
        d.line([(cx + r1 * math.cos(g), cy + r1 * math.sin(g)),
                (cx + r2 * math.cos(g), cy + r2 * math.sin(g))], fill=mau, width=day)


# ── LÁ CỜ VẼ RIÊNG MỘT LỚP ──────────────────────────────────────────────────
# Chủ dự án: "lá cờ nó vẫy trong gió chứ không phải lắc qua lắc lại".
# Muốn mặt cờ gợn sóng thì phải làm hiệu ứng CHỈ TRÊN MẶT CỜ — cán cờ, xe
# tăng, nóc hầm, bóng chiến sĩ phải đứng yên. Nên mỗi dịp có cờ được vẽ
# LÀM HAI LẦN với biến PHAN_VE khác nhau, ra hai tấm ảnh:
#     <mã>-tt.webp  mọi thứ TRỪ mặt cờ   → đứng yên
#     <mã>-co.webp  CHỈ mặt cờ           → gợn sóng
# Trước đây chỉ có một lớp nên hiệu ứng phải xoay cả cụm — thành ra cả cán
# cờ lẫn người cầm cùng lắc, đúng cái chủ dự án chê.
PHAN_VE = 'het'          # 'het' | 'khong-co' (bỏ mặt cờ) | 'chi-co' (chỉ mặt cờ)

# Những dịp có LÁ CỜ trong phần trang trí. Thêm cờ vào dịp nào thì thêm mã dịp
# đó vào đây, đồng thời thêm vào CO_VAY bên components/LogoLe.tsx — thiếu một
# trong hai chỗ là cờ đứng im.
DIP_CO_CO = ('quoc-khanh', 'dang', '30-4', 'dien-bien')


def _ve_phan_khac() -> bool:
    return PHAN_VE != 'chi-co'


def _ve_mat_co() -> bool:
    return PHAN_VE != 'khong-co'


def co_to_quoc(d, m, x, y, rong, cao, nghieng=0.0):
    """Lá cờ đỏ sao vàng: nền đỏ, ngôi sao vàng năm cánh đặt chính giữa."""
    if _ve_phan_khac():          # cán cờ — thuộc phần ĐỨNG YÊN
        # ⚠️ CÁN NGẮN THÔI. Bản trước cán dài gần gấp đôi lá cờ (từ -0,30 đến
        #    +1,55 lần chiều cao cờ). Khi cụm trang trí bị thu vào một khuôn
        #    nhỏ thì cả cụm co theo CHIỀU CAO, nên lá cờ chỉ còn hơn nửa khuôn
        #    mà cán chiếm hết phần còn lại — nhìn như lá cờ bị TUỘT lên đỉnh
        #    một cây sào (chủ dự án: "cờ bị tuột à"). Nay cán chỉ nhô lên một
        #    chút và thò xuống vừa phải, lá cờ chiếm gần hết khuôn.
        d.rectangle([x - rong * 0.06, y - cao * 0.16, x - rong * 0.02, y + cao * 1.06], fill=m['kem'])
    if not _ve_mat_co():
        return
    b = cao * 0.10 * (1 + nghieng)          # mặt cờ hơi lượn cho đỡ cứng
    d.polygon([(x, y), (x + rong, y - b), (x + rong, y + cao - b), (x, y + cao)], fill=m['do'])
    sao(d, x + rong * 0.5, y + cao * 0.5 - b * 0.5, cao * 0.34, m['vang_co'])


def mu_noel(d, m, x, y, rong, cao):
    """Mũ ông già Noel đặt nghiêng trên đỉnh mái nhà."""
    d.polygon([(x, y + cao), (x + rong * 0.52, y - cao * 0.05),
               (x + rong * 1.02, y + cao * 0.42), (x + rong * 0.9, y + cao)], fill=m['do'])
    d.rounded_rectangle([x - rong * 0.08, y + cao * 0.78, x + rong * 0.98, y + cao * 1.22],
                        radius=cao * 0.22, fill=TRANG)
    r = cao * 0.30
    d.ellipse([x + rong * 0.98 - r, y + cao * 0.42 - r,
               x + rong * 0.98 + r, y + cao * 0.42 + r], fill=TRANG)


def bong_tuyet(d, cx, cy, r, mau, day=3.0):
    for i in range(3):
        g = math.radians(i * 60)
        dx, dy = r * math.cos(g), r * math.sin(g)
        d.line([(cx - dx, cy - dy), (cx + dx, cy + dy)], fill=mau, width=day)
    for i in range(6):
        g = math.radians(i * 60)
        x, y = cx + r * 0.62 * math.cos(g), cy + r * 0.62 * math.sin(g)
        g2 = g + math.radians(40)
        d.line([(x, y), (x + r * 0.3 * math.cos(g2), y + r * 0.3 * math.sin(g2))],
               fill=mau, width=day * 0.8)


def long_den(d, m, cx, cy, rong, cao, mau):
    """Lồng đèn Trung thu treo lủng lẳng."""
    d.line([(cx, cy - cao * 0.95), (cx, cy - cao * 0.52)], fill=m['kem'], width=rong * 0.08)
    d.ellipse([cx - rong / 2, cy - cao / 2, cx + rong / 2, cy + cao / 2], fill=mau)
    d.rectangle([cx - rong * 0.30, cy - cao * 0.60, cx + rong * 0.30, cy - cao * 0.44], fill=m['vang'])
    d.rectangle([cx - rong * 0.30, cy + cao * 0.44, cx + rong * 0.30, cy + cao * 0.60], fill=m['vang'])
    d.line([(cx, cy + cao * 0.58), (cx, cy + cao * 0.95)], fill=m['vang'], width=rong * 0.10)


def trai_tim(d, cx, cy, r, mau):
    d.ellipse([cx - r, cy - r * 0.98, cx + r * 0.06, cy + r * 0.10], fill=mau)
    d.ellipse([cx - r * 0.06, cy - r * 0.98, cx + r, cy + r * 0.10], fill=mau)
    d.polygon([(cx - r * 0.99, cy - r * 0.22), (cx + r * 0.99, cy - r * 0.22),
               (cx, cy + r * 1.08)], fill=mau)


def hoa_sen(d, cx, cy, r, mau, nhuy):
    """Hoa sen: năm cánh nhọn xoè lên. Dùng cho 27/7, Vu Lan, rằm tháng Giêng."""
    for goc in (-90, -46, -134, -10, -170):
        g = math.radians(goc)
        dx, dy = math.cos(g), math.sin(g)
        px, py = cx + dx * r * 0.52, cy + dy * r * 0.52
        w = r * 0.26
        d.polygon([(cx, cy), (px - dy * w, py + dx * w),
                   (cx + dx * r, cy + dy * r), (px + dy * w, py - dx * w)], fill=mau)
    d.ellipse([cx - r * 0.2, cy - r * 0.2, cx + r * 0.2, cy + r * 0.2], fill=nhuy)


def quyen_sach(d, cx, cy, w, h, mau, mau2):
    """Quyển sách mở — ngày Nhà giáo."""
    d.polygon([(cx - w / 2, cy - h * 0.30), (cx, cy - h * 0.10),
               (cx, cy + h * 0.52), (cx - w / 2, cy + h * 0.32)], fill=mau)
    d.polygon([(cx + w / 2, cy - h * 0.30), (cx, cy - h * 0.10),
               (cx, cy + h * 0.52), (cx + w / 2, cy + h * 0.32)], fill=mau2)


def bong_bay(d, cx, cy, r, mau, day):
    d.ellipse([cx - r, cy - r * 1.18, cx + r, cy + r * 1.02], fill=mau)
    d.polygon([(cx - r * 0.22, cy + r * 0.92), (cx + r * 0.22, cy + r * 0.92),
               (cx, cy + r * 1.34)], fill=mau)
    d.line([(cx, cy + r * 1.3), (cx + r * 0.42, cy + r * 2.5)], fill=day, width=3)


def mui_ten_len(d, x, y, w, h, mau, dam):
    """Ba cột tăng dần + mũi tên đi lên — ngày Doanh nhân."""
    for bx, bh in ((0.0, 0.42), (0.37, 0.70), (0.74, 1.0)):
        d.rectangle([x + bx * w, y + h - bh * h, x + bx * w + w * 0.23, y + h], fill=mau)
    d.line([(x + w * 0.06, y + h * 0.42), (x + w * 0.96, y - h * 0.16)], fill=dam, width=7)
    d.polygon([(x + w * 1.02, y - h * 0.22), (x + w * 0.70, y - h * 0.10),
               (x + w * 0.92, y + h * 0.18)], fill=dam)


def ca_chep(d, cx, cy, r, mau, net):
    """Cá chép vàng — ông Công ông Táo (23 tháng Chạp)."""
    d.ellipse([cx - r, cy - r * 0.50, cx + r * 0.62, cy + r * 0.50], fill=mau)
    d.polygon([(cx + r * 0.52, cy), (cx + r * 1.18, cy - r * 0.55),
               (cx + r * 1.18, cy + r * 0.55)], fill=mau)
    d.polygon([(cx - r * 0.24, cy - r * 0.42), (cx + r * 0.22, cy - r * 0.92),
               (cx + r * 0.30, cy - r * 0.34)], fill=mau)
    d.polygon([(cx - r * 0.20, cy + r * 0.40), (cx + r * 0.18, cy + r * 0.86),
               (cx + r * 0.26, cy + r * 0.32)], fill=mau)
    d.ellipse([cx - r * 0.80, cy - r * 0.18, cx - r * 0.52, cy + r * 0.10], fill=net)


def den_tho(d, cx, cy, w, h, mau, dam):
    """Mái đền kiểu Việt: hai tầng mái cong, thân đền có cửa vòm, bậc thềm.

    ⚠️ ĐUÔI MÁI PHẢI CONG LÊN. Bỏ chi tiết đó thì còn lại mấy hình thang
       xếp chồng, nhìn ra ngôi nhà chứ không ra đền — mà trong logo đã có
       sẵn một ngôi nhà rồi, thành ra hai ngôi nhà cạnh nhau.
    """
    def mai(nua_rong, y_duoi, y_tren, nua_tren):
        d.polygon([(cx - w * nua_rong, cy + h * y_duoi),
                   (cx - w * nua_tren, cy + h * y_tren),
                   (cx + w * nua_tren, cy + h * y_tren),
                   (cx + w * nua_rong, cy + h * y_duoi)], fill=mau)
        # hai đuôi mái hất cong lên
        for dau in (-1, 1):
            d.polygon([(cx + dau * w * nua_rong, cy + h * y_duoi),
                       (cx + dau * w * (nua_rong + 0.16), cy + h * (y_duoi - 0.16)),
                       (cx + dau * w * (nua_rong - 0.02), cy + h * (y_duoi + 0.05))], fill=mau)

    mai(0.40, -0.22, -0.46, 0.22)        # mái trên
    mai(0.62, 0.08, -0.16, 0.40)         # mái dưới
    d.rectangle([cx - w * 0.30, cy + h * 0.10, cx + w * 0.30, cy + h * 0.46], fill=mau)
    d.ellipse([cx - w * 0.15, cy + h * 0.14, cx + w * 0.15, cy + h * 0.44], fill=dam)
    d.rectangle([cx - w * 0.15, cy + h * 0.29, cx + w * 0.15, cy + h * 0.46], fill=dam)
    d.rectangle([cx - w * 0.50, cy + h * 0.46, cx + w * 0.50, cy + h * 0.54], fill=mau)
    d.rectangle([cx - w * 0.62, cy + h * 0.54, cx + w * 0.62, cy + h * 0.62], fill=mau)


def nha_tranh(d, cx, cy, w, h, tranh, vach, cot):
    """Ngôi nhà tranh năm gian kiểu làng quê xứ Nghệ — nơi Bác sinh ra.

    Mái tranh DÀY, THẤP và XỐ XUỐNG gần tới hè, vuông vắn chứ không nhọn
    như mái ngói — nhờ thế mà không bị nhìn lẫn với ngôi nhà sẵn có trong
    logo (mà ngôi nhà kia là nét viền, còn cái này là mảng đặc).
    """
    # mái tranh: hình thang rất bè, nóc hơi bầu
    d.polygon([(cx - w * 0.60, cy + h * 0.10), (cx - w * 0.30, cy - h * 0.34),
               (cx + w * 0.30, cy - h * 0.34), (cx + w * 0.60, cy + h * 0.10)], fill=tranh)
    d.ellipse([cx - w * 0.32, cy - h * 0.44, cx + w * 0.32, cy - h * 0.24], fill=tranh)
    # vách và hiên
    d.rectangle([cx - w * 0.46, cy + h * 0.10, cx + w * 0.46, cy + h * 0.44], fill=vach)
    # cột hiên
    for dx in (-0.34, -0.11, 0.11, 0.34):
        d.rectangle([cx + w * dx - w * 0.035, cy + h * 0.10,
                     cx + w * dx + w * 0.035, cy + h * 0.44], fill=cot)
    # cửa giữa
    d.rectangle([cx - w * 0.08, cy + h * 0.18, cx + w * 0.08, cy + h * 0.44], fill=cot)
    # thềm đất
    d.rectangle([cx - w * 0.56, cy + h * 0.44, cx + w * 0.56, cy + h * 0.52], fill=cot)


def noc_ham(d, cx, cy, w, h, mau, gan):
    """Nóc hầm Đờ Cát: mái tôn uốn NỬA HÌNH TRỤ, có gân chạy dọc.

    ⚠️ Phải ra hình NỬA ỐNG chứ không phải gò đất tròn. Trong tấm ảnh lịch sử
       chủ dự án gửi, thứ nhận ra ngay là cái mái tôn cong có gân — vẽ thành
       mô đất thì mất hẳn.
    """
    diem = []
    N = 44
    for i in range(N + 1):
        t = i / N
        diem.append((cx - w / 2 + w * t, cy - h * math.sin(math.pi * t) ** 0.55))
    diem += [(cx + w / 2, cy + h * 0.34), (cx - w / 2, cy + h * 0.34)]
    d.polygon(diem, fill=mau)
    # gân mái: mấy vạch dọc ôm theo vòm
    for i in range(1, 11):
        t = i / 11
        x = cx - w / 2 + w * t
        y = cy - h * math.sin(math.pi * t) ** 0.55
        d.line([(x, y + h * 0.06), (x, cy + h * 0.30)], fill=gan, width=2)


def chien_si(d, cx, cy, h, mau, giuong_co=False):
    """Bóng người lính: mũ, thân, hai chân; giương_cờ thì một tay đưa lên."""
    d.polygon([(cx - h * 0.22, cy - h * 0.08), (cx + h * 0.22, cy - h * 0.08),
               (cx + h * 0.15, cy - h * 0.20), (cx - h * 0.15, cy - h * 0.20)], fill=mau)
    d.ellipse([cx - h * 0.13, cy - h * 0.18, cx + h * 0.13, cy + h * 0.10], fill=mau)
    d.polygon([(cx - h * 0.14, cy + h * 0.06), (cx + h * 0.14, cy + h * 0.06),
               (cx + h * 0.18, cy + h * 0.62), (cx - h * 0.18, cy + h * 0.62)], fill=mau)
    d.line([(cx - h * 0.06, cy + h * 0.58), (cx - h * 0.16, cy + h * 1.00)],
           fill=mau, width=max(2, h * 0.13))
    d.line([(cx + h * 0.06, cy + h * 0.58), (cx + h * 0.18, cy + h * 1.00)],
           fill=mau, width=max(2, h * 0.13))
    if giuong_co:
        d.line([(cx + h * 0.08, cy + h * 0.16), (cx + h * 0.44, cy - h * 0.24)],
               fill=mau, width=max(2, h * 0.12))
    else:
        # tay cầm súng chếch xuống
        d.line([(cx - h * 0.10, cy + h * 0.16), (cx - h * 0.44, cy + h * 0.40)],
               fill=mau, width=max(2, h * 0.11))


def tuong_vua_hung(d, cx, cy, h, mau, dam):
    """Tượng Vua Hùng đứng trên bệ — theo mẫu tượng đồng chủ dự án gửi.

    RÚT GọN CÒN SÁU MẢNG, vì logo chỉ hiện ở cỡ 32 điểm ảnh:
      mũ miện có chùm lông · đầu · hai vai giáp bè · hai tay buông dọc ·
      thân áo choàng · bệ đá hai cấp.
    ⚠️ PHẢI CÓ HAI TAY VÀ VAI BÈ RA. Bản trước chỉ có một khối thân thon kèm
       chùm lông nhọn trên đỉnh — thu nhỏ lại nhìn ra cái đuốc chứ không ra
       người. Vai rộng + hai tay dọc là thứ làm mắt nhận ra dáng người.
    `cy` là ĐÁY bệ; tượng dựng ngược lên trên.
    """
    # bệ đá hai cấp
    d.rectangle([cx - h * 0.36, cy - h * 0.10, cx + h * 0.36, cy], fill=dam)
    d.rectangle([cx - h * 0.27, cy - h * 0.24, cx + h * 0.27, cy - h * 0.10], fill=mau)
    # thân áo choàng: xoè dần xuống gấu
    d.polygon([(cx - h * 0.20, cy - h * 0.72), (cx + h * 0.20, cy - h * 0.72),
               (cx + h * 0.30, cy - h * 0.24), (cx - h * 0.30, cy - h * 0.24)], fill=mau)
    d.polygon([(cx - h * 0.08, cy - h * 0.68), (cx + h * 0.08, cy - h * 0.68),
               (cx + h * 0.11, cy - h * 0.28), (cx - h * 0.11, cy - h * 0.28)], fill=dam)
    # hai tay buông dọc hai bên thân
    for dx in (-1, 1):
        d.polygon([(cx + dx * h * 0.32, cy - h * 0.70), (cx + dx * h * 0.22, cy - h * 0.70),
                   (cx + dx * h * 0.24, cy - h * 0.38), (cx + dx * h * 0.34, cy - h * 0.40)],
                  fill=mau)
        d.ellipse([cx + dx * h * 0.35 - h * 0.055, cy - h * 0.44,
                   cx + dx * h * 0.35 + h * 0.055, cy - h * 0.33], fill=dam)
    # hai vai giáp bè ngang
    d.polygon([(cx - h * 0.40, cy - h * 0.72), (cx + h * 0.40, cy - h * 0.72),
               (cx + h * 0.22, cy - h * 0.82), (cx - h * 0.22, cy - h * 0.82)], fill=mau)
    # đầu
    d.ellipse([cx - h * 0.105, cy - h * 0.97, cx + h * 0.105, cy - h * 0.79], fill=mau)
    d.ellipse([cx - h * 0.06, cy - h * 0.88, cx + h * 0.06, cy - h * 0.76], fill=dam)   # râu
    # mũ miện: vành ngang + ba chùm lông ngắn
    d.polygon([(cx - h * 0.15, cy - h * 0.94), (cx + h * 0.15, cy - h * 0.94),
               (cx + h * 0.12, cy - h * 1.04), (cx - h * 0.12, cy - h * 1.04)], fill=mau)
    for goc, dai in ((-108, 0.16), (-90, 0.21), (-72, 0.16)):
        canh_nhon(d, cx, cy - h * 1.02, goc, h * dai, h * 0.05, mau)


def quan_hieu(d, cx, cy, r, do, do_nhat, vang, vang_dam):
    """Quân hiệu Quân đội nhân dân Việt Nam.

    Theo đúng mẫu chủ dự án gửi, xếp từ ngoài vào: vành bông lúa vàng · vành
    tròn vàng · nền đỏ có tia · ngôi sao vàng năm cánh · nửa bánh răng ở đáy.

    ⚠️ NGÔI SAO PHẢI TO, chiếm quá nửa đường kính. Mấy chi tiết vành lúa và
       bánh răng ở cỡ 32 điểm ảnh sẽ nhoè thành một viền vàng có vân — không
       sao, chính ngôi sao mới là thứ người ta nhận ra.
    """
    # vành bông lúa: những hạt nhọn xếp nghiêng quanh vòng
    for i in range(30):
        g = -90 + i * 360.0 / 30
        rad = math.radians(g)
        px, py = cx + r * 0.93 * math.cos(rad), cy + r * 0.93 * math.sin(rad)
        canh_nhon(d, px, py, g + 118, r * 0.20, r * 0.055, vang)
    # vành tròn vàng + nền đỏ
    d.ellipse([cx - r * 0.86, cy - r * 0.86, cx + r * 0.86, cy + r * 0.86], fill=vang)
    d.ellipse([cx - r * 0.78, cy - r * 0.78, cx + r * 0.78, cy + r * 0.78], fill=do)
    # tia sáng toả từ tâm
    for i in range(48):
        g = math.radians(i * 360.0 / 48)
        d.line([(cx + r * 0.22 * math.cos(g), cy + r * 0.22 * math.sin(g)),
                (cx + r * 0.76 * math.cos(g), cy + r * 0.76 * math.sin(g))],
               fill=do_nhat, width=max(1, r * 0.035))
    # nửa bánh răng ở đáy
    for i in range(9):
        g = math.radians(20 + i * 17.5)
        for k in (-1, 1):
            pass
        x1 = cx + r * 0.30 * math.cos(g)
        y1 = cy + r * 0.30 * math.sin(g)
        x2 = cx + r * 0.46 * math.cos(g)
        y2 = cy + r * 0.46 * math.sin(g)
        d.line([(x1, y1), (x2, y2)], fill=vang, width=max(2, r * 0.10))
    d.ellipse([cx - r * 0.34, cy + r * 0.30, cx + r * 0.34, cy + r * 0.98], fill=vang)
    d.ellipse([cx - r * 0.20, cy + r * 0.44, cx + r * 0.20, cy + r * 0.84], fill=do)
    # ngôi sao vàng
    sao(d, cx, cy, r * 0.66, vang)
    sao(d, cx, cy, r * 0.40, vang_dam)


def non_la(d, cx, cy, w, h, mau, gan, quai):
    """Chiếc nón lá: chóp nhọn, vành hơi võng, có gân đan và quai.

    ⚠️ Đây là thứ nhận ra NGAY ở cỡ nhỏ. Vẽ nguyên cô gái áo dài như ảnh mẫu
       thì thu về 32 điểm ảnh chỉ còn một vệt hồng — cái nón thì vẫn là cái
       nón. `cy` là tâm vành nón.
    """
    chop = (cx, cy - h)

    def vanh(t):
        """Điểm trên vành nón theo tỉ lệ ngang t (0 → 1)."""
        return (cx - w / 2 + w * t, cy + h * 0.20 * math.sin(math.pi * t))

    N = 30
    d.polygon([chop] + [vanh(i / N) for i in range(N + 1)], fill=mau)
    # gân đan: mấy đường cong song song với vành
    for k in (0.40, 0.64, 0.86):
        duong = []
        for i in range(N + 1):
            vx, vy = vanh(i / N)
            duong.append((chop[0] + (vx - chop[0]) * k, chop[1] + (vy - chop[1]) * k))
        d.line(duong, fill=gan, width=max(1, h * 0.035))
    # quai nón
    d.line([vanh(0.22), (cx - w * 0.10, cy + h * 0.62)], fill=quai, width=max(2, h * 0.06))
    d.line([vanh(0.78), (cx + w * 0.12, cy + h * 0.66)], fill=quai, width=max(2, h * 0.06))


def mu_tot_nghiep(d, cx, cy, w, h, mau, dam):
    """Mũ tốt nghiệp: tấm vuông nghiêng + chỏm mũ + dây tua."""
    d.polygon([(cx, cy - h * 0.44), (cx + w * 0.50, cy - h * 0.10),
               (cx, cy + h * 0.24), (cx - w * 0.50, cy - h * 0.10)], fill=mau)
    d.polygon([(cx - w * 0.24, cy + h * 0.06), (cx + w * 0.24, cy + h * 0.06),
               (cx + w * 0.20, cy + h * 0.44), (cx - w * 0.20, cy + h * 0.44)], fill=dam)
    d.line([(cx + w * 0.46, cy - h * 0.12), (cx + w * 0.50, cy + h * 0.34)],
           fill=dam, width=max(2, h * 0.07))
    d.ellipse([cx + w * 0.42, cy + h * 0.30, cx + w * 0.58, cy + h * 0.50], fill=dam)


def bat_tay(d, cx, cy, w, h, mau, dam):
    """Cái bắt tay — biểu tượng ngày Doanh nhân.

    ⚠️ Rút gọn còn HAI CẲNG TAY chụm vào nhau và một cục nắm ở giữa. Vẽ đủ
       năm ngón như ảnh mẫu thì ở cỡ 32 điểm ảnh chỉ còn một vệt vàng.
    """
    d.line([(cx - w * 0.52, cy + h * 0.30), (cx - w * 0.08, cy - h * 0.04)],
           fill=mau, width=max(3, h * 0.34))
    d.line([(cx + w * 0.52, cy - h * 0.30), (cx + w * 0.08, cy + h * 0.04)],
           fill=mau, width=max(3, h * 0.34))
    d.ellipse([cx - w * 0.22, cy - h * 0.26, cx + w * 0.22, cy + h * 0.26], fill=mau)
    for i in range(3):
        y = cy - h * 0.13 + i * h * 0.13
        d.line([(cx - w * 0.15, y), (cx + w * 0.15, y - h * 0.05)],
               fill=dam, width=max(1, h * 0.05))


def phao_hoa(d, cx, cy, r, so, mau, mau2, day=3.0):
    """Một quả pháo hoa: chùm tia mảnh toả đều, đầu tia có đốm sáng."""
    for i in range(so):
        g = math.radians(i * 360.0 / so)
        d.line([(cx + r * 0.16 * math.cos(g), cy + r * 0.16 * math.sin(g)),
                (cx + r * math.cos(g), cy + r * math.sin(g))], fill=mau, width=day)
        d.ellipse([cx + r * math.cos(g) - day * 0.9, cy + r * math.sin(g) - day * 0.9,
                   cx + r * math.cos(g) + day * 0.9, cy + r * math.sin(g) + day * 0.9],
                  fill=mau2)


def bat_che(d, cx, cy, w, h, bat, bat_dam, vien):
    """Bát chè trôi nước — món của Tết Nguyên tiêu (rằm tháng Giêng)."""
    # ba viên trôi nước nhô trên miệng bát
    for dx, dy, r in ((-0.22, -0.12, 0.20), (0.22, -0.12, 0.20), (0.0, -0.22, 0.23)):
        d.ellipse([cx + w * dx - w * r, cy + h * dy - h * r * 1.5,
                   cx + w * dx + w * r, cy + h * dy + h * r * 1.5], fill=vien)
    # thân bát: hình thang đáy nhỏ
    d.polygon([(cx - w * 0.50, cy), (cx + w * 0.50, cy),
               (cx + w * 0.26, cy + h * 0.62), (cx - w * 0.26, cy + h * 0.62)], fill=bat)
    # miệng bát
    d.ellipse([cx - w * 0.50, cy - h * 0.14, cx + w * 0.50, cy + h * 0.14], fill=bat_dam)
    # chân bát
    d.rectangle([cx - w * 0.16, cy + h * 0.60, cx + w * 0.16, cy + h * 0.76], fill=bat_dam)


def chum_mimosa(d, cx, cy, r, mau, dam, la):
    """Chùm mimosa — hoa của ngày 8/3: nhiều quả cầu nhỏ li ti."""
    for gx, gy, n, rr in ((-0.9, 0.25, 7, 0.26), (0.9, 0.35, 7, 0.24), (0.0, -0.5, 9, 0.28)):
        for i in range(n):
            g = math.radians(i * 360.0 / n)
            x = cx + r * gx + r * rr * 1.25 * math.cos(g)
            y = cy + r * gy + r * rr * 1.25 * math.sin(g)
            d.ellipse([x - r * rr * 0.55, y - r * rr * 0.55,
                       x + r * rr * 0.55, y + r * rr * 0.55], fill=mau)
        d.ellipse([cx + r * gx - r * rr * 0.5, cy + r * gy - r * rr * 0.5,
                   cx + r * gx + r * rr * 0.5, cy + r * gy + r * rr * 0.5], fill=dam)
    for goc in (208, 250, 300):
        canh_nhon(d, cx, cy + r * 0.55, goc, r * 1.15, r * 0.16, la)


def nam_tay(d, cx, cy, w, h, mau, ranh):
    """Nắm tay giơ lên — biểu tượng ngày Quốc tế Lao động."""
    d.rounded_rectangle([cx - w * 0.22, cy + h * 0.16, cx + w * 0.22, cy + h * 0.86],
                        radius=w * 0.14, fill=mau)
    d.rounded_rectangle([cx - w * 0.42, cy - h * 0.46, cx + w * 0.38, cy + h * 0.24],
                        radius=w * 0.22, fill=mau)
    for i in range(3):
        y = cy - h * 0.28 + i * h * 0.17
        d.line([(cx - w * 0.30, y), (cx + w * 0.26, y)], fill=ranh, width=max(1, h * 0.05))
    d.rounded_rectangle([cx - w * 0.52, cy - h * 0.16, cx - w * 0.22, cy + h * 0.14],
                        radius=w * 0.12, fill=mau)


def xe_tang(d, cx, cy, w, h, than, banh, nong):
    """Xe tăng — hình gắn với ngày 30/4 (xe tăng húc cổng Dinh Độc Lập).

    Rút gọn còn bốn mảng: thân xe · tháp pháo · nòng pháo · dãy bánh xích.
    """
    d.rounded_rectangle([cx - w * 0.50, cy - h * 0.02, cx + w * 0.50, cy + h * 0.34],
                        radius=h * 0.10, fill=than)
    d.polygon([(cx - w * 0.26, cy - h * 0.04), (cx - w * 0.18, cy - h * 0.34),
               (cx + w * 0.16, cy - h * 0.34), (cx + w * 0.24, cy - h * 0.04)], fill=than)
    d.rectangle([cx + w * 0.10, cy - h * 0.28, cx + w * 0.62, cy - h * 0.18], fill=nong)
    d.rounded_rectangle([cx - w * 0.52, cy + h * 0.30, cx + w * 0.52, cy + h * 0.62],
                        radius=h * 0.16, fill=banh)
    for i in range(5):
        x = cx - w * 0.38 + i * w * 0.19
        d.ellipse([x - h * 0.10, cy + h * 0.36, x + h * 0.10, cy + h * 0.56], fill=than)


def song_nuoc(d, cx, cy, w, h, mau):
    """Mấy ngọn sóng nước đơn giản."""
    import math as _m
    for k, (dy, rong) in enumerate(((0.0, 1.0), (0.42, 0.72))):
        diem = []
        N = 32
        for i in range(N + 1):
            t = i / N
            diem.append((cx - w * rong / 2 + w * rong * t,
                         cy + h * dy - h * 0.30 * _m.sin(t * _m.pi * 3)))
        d.line(diem, fill=mau, width=max(2, h * 0.22))


# ── CHÂN DUNG BÁC (ngày 19/5) ──────────────────────────────────────────────
# Hình khắc hai tông, do scripts/tao-chan-dung-bac.py đổi từ ảnh chân dung
# chính thức chủ dự án gửi. Nét là màu trắng nên tô lại màu nào cũng được.
# ⚠️ Đây là hình DÁN VÀO, không vẽ bằng hình khối như mọi dịp khác — khuôn mặt
#    người thì không dựng bằng đa giác được.
_CHAN_DUNG = os.path.join(GOC, 'scripts', 'anh', 'chan-dung-bac.png')


def dan_chan_dung(lop, cx, cy, cao, mau):
    """Dán hình khắc chân dung vào lớp trang trí, tô theo màu cho trước.

    Toạ độ ghi theo cỡ THẬT (435×288) giống mọi hàm vẽ khác; ở đây tự nhân
    lên PHONG vì hàm này dán ảnh chứ không đi qua bộ bọc _ve_phong().
    """
    if not os.path.exists(_CHAN_DUNG):
        return
    anh = Image.open(_CHAN_DUNG).convert('RGBA')
    h = int(cao * PHONG)
    w = max(1, round(h * anh.width / anh.height))
    anh = anh.resize((w, h), Image.LANCZOS)
    to = Image.new('RGBA', anh.size, tuple(mau) + (255,))
    to.putalpha(anh.getchannel('A'))
    lop.alpha_composite(to, (int(cx * PHONG - w / 2), int(cy * PHONG - h / 2)))


def ca_chep_bay(d, cx, cy, w, h, than, vay, mat):
    """Cá chép vượt sóng: thân CONG, đuôi xoè to, vây lưng dựng.

    ⚠️ Thân phải CONG chứ không phải hình bầu dục nằm ngang. Bản trước vẽ
       bầu dục nên nhìn ra con cá cảnh, không ra cá chép đang vượt.
    """
    than_diem = []
    N = 26
    for i in range(N + 1):                       # mép lưng
        t = i / N
        than_diem.append((cx - w * 0.46 + w * 0.92 * t,
                          cy - h * 0.34 * math.sin(math.pi * t) - h * 0.10 * t))
    for i in range(N, -1, -1):                   # mép bụng
        t = i / N
        than_diem.append((cx - w * 0.46 + w * 0.92 * t,
                          cy + h * 0.30 * math.sin(math.pi * t) - h * 0.10 * t))
    d.polygon(than_diem, fill=than)
    d.polygon([(cx + w * 0.42, cy - h * 0.16), (cx + w * 0.78, cy - h * 0.62),
               (cx + w * 0.74, cy + h * 0.22), (cx + w * 0.40, cy + h * 0.02)], fill=than)
    d.polygon([(cx - w * 0.10, cy - h * 0.34), (cx + w * 0.14, cy - h * 0.76),
               (cx + w * 0.22, cy - h * 0.26)], fill=vay)
    d.polygon([(cx - w * 0.08, cy + h * 0.28), (cx + w * 0.10, cy + h * 0.62),
               (cx + w * 0.18, cy + h * 0.22)], fill=vay)
    d.ellipse([cx - w * 0.40, cy - h * 0.16, cx - w * 0.26, cy - h * 0.02], fill=mat)


def banh_u(d, cx, cy, w, h, la, la_dam, lat):
    """Bánh ú tro: khối tam giác BÈ, đáy phẳng, có lạt buộc chéo.

    ⚠️ ĐÁY PHẢI RỘNG HƠN CHIỀU CAO. Bản trước vẽ tam giác cao và nhọn, thu
       nhỏ lại nhìn y như cái cây thông — chủ dự án bảo làm lại.
    """
    d.polygon([(cx, cy - h * 0.50), (cx + w * 0.58, cy + h * 0.42),
               (cx - w * 0.58, cy + h * 0.42)], fill=la)
    d.polygon([(cx, cy - h * 0.50), (cx + w * 0.58, cy + h * 0.42),
               (cx + w * 0.08, cy + h * 0.42)], fill=la_dam)
    # ⚠️ LẠT NGANG THÔI, ĐỬNG KẲ LẠT DỌC XUỐNG TẬN ĐÁY. Vệt dọc giữa một
    #    hình tam giác xanh trông hệt thân cây — chiếc bánh thành cây thông.
    d.line([(cx - w * 0.44, cy + h * 0.06), (cx + w * 0.44, cy + h * 0.06)],
           fill=lat, width=max(3, h * 0.11))
    d.line([(cx - w * 0.30, cy + h * 0.26), (cx + w * 0.30, cy + h * 0.26)],
           fill=lat, width=max(3, h * 0.09))
    # nếp gấp lá ở chóp
    d.line([(cx, cy - h * 0.46), (cx - w * 0.16, cy - h * 0.10)],
           fill=la_dam, width=max(2, h * 0.06))


def bieu_tuong_nu(d, cx, cy, r, mau, dam):
    """Biểu tượng nữ ♀ — vòng tròn dày và chữ thập bên dưới."""
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=mau)
    d.ellipse([cx - r * 0.56, cy - r * 0.56, cx + r * 0.56, cy + r * 0.56], fill=dam)
    d.rectangle([cx - r * 0.20, cy + r * 0.82, cx + r * 0.20, cy + r * 2.30], fill=mau)
    d.rectangle([cx - r * 0.72, cy + r * 1.42, cx + r * 0.72, cy + r * 1.80], fill=mau)


def tay_bat(d, cx, cy, w, h, mau, khe):
    """Hai bàn tay nắm nhau — vẽ ĐẬM, có khe tối tách hai bàn tay."""
    d.polygon([(cx - w * 0.58, cy - h * 0.30), (cx - w * 0.04, cy - h * 0.30),
               (cx + w * 0.08, cy + h * 0.06), (cx - w * 0.46, cy + h * 0.06)], fill=mau)
    d.polygon([(cx + w * 0.58, cy + h * 0.34), (cx + w * 0.04, cy + h * 0.34),
               (cx - w * 0.08, cy - h * 0.02), (cx + w * 0.46, cy - h * 0.02)], fill=mau)
    d.ellipse([cx - w * 0.28, cy - h * 0.34, cx + w * 0.28, cy + h * 0.38], fill=mau)
    d.line([(cx - w * 0.30, cy + h * 0.16), (cx + w * 0.26, cy - h * 0.14)],
           fill=khe, width=max(2, h * 0.09))
    d.line([(cx - w * 0.22, cy - h * 0.16), (cx + w * 0.10, cy - h * 0.30)],
           fill=khe, width=max(2, h * 0.07))


def chiec_cup(d, cx, cy, w, h, mau, dam):
    """Chiếc cúp vô địch — ngày Doanh nhân.

    ⚠️ ĐÃ BỎ CÁI BẮT TAY. Vẽ hai bàn tay nắm nhau thì dù đậm cỡ nào, thu
       về 32 điểm ảnh cũng chỉ còn một dải vàng nằm ngang — chủ dự án bảo
       làm lại. Chiếc cúp có bóng đứng rất riêng (miệng rộng, hai quai,
       chân đế), nhìn phát là biết.
    """
    d.polygon([(cx - w * 0.34, cy - h * 0.42), (cx + w * 0.34, cy - h * 0.42),
               (cx + w * 0.20, cy + h * 0.10), (cx - w * 0.20, cy + h * 0.10)], fill=mau)
    for dau in (-1, 1):
        d.ellipse([cx + dau * w * 0.30 - w * 0.22, cy - h * 0.40,
                   cx + dau * w * 0.30 + w * 0.22, cy - h * 0.02], outline=mau,
                  width=max(3, h * 0.09))
    d.rectangle([cx - w * 0.07, cy + h * 0.06, cx + w * 0.07, cy + h * 0.26], fill=mau)
    d.polygon([(cx - w * 0.26, cy + h * 0.44), (cx + w * 0.26, cy + h * 0.44),
               (cx + w * 0.18, cy + h * 0.24), (cx - w * 0.18, cy + h * 0.24)], fill=mau)
    d.rectangle([cx - w * 0.34, cy + h * 0.44, cx + w * 0.34, cy + h * 0.58], fill=dam)
    sao(d, cx, cy - h * 0.20, w * 0.17, dam)


def bien_tet(d, cx, cy, r, do, vien):
    """Tấm biển Tết hình thoi nền đỏ viền vàng — thứ treo trước cửa ngày Tết.

    Hình thoi đỏ là mảng đặc, góc cạnh rõ, nên ở cỡ 32 điểm ảnh vẫn
    đọc ra ngay — khác hẳn mấy chùm hoa nhỏ dễ lem.
    """
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=vien)
    k = r * 0.86
    d.polygon([(cx, cy - k), (cx + k, cy), (cx, cy + k), (cx - k, cy)], fill=do)


def banh_chung(d, cx, cy, w, la, lat):
    """Bánh chưng: vuông xanh, có hai sợi lạt buộc chữ thập."""
    d.rectangle([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=la)
    d.line([(cx - w / 2, cy), (cx + w / 2, cy)], fill=lat, width=max(2, w * 0.13))
    d.line([(cx, cy - w / 2), (cx, cy + w / 2)], fill=lat, width=max(2, w * 0.13))


def canh_nhon(d, cx, cy, goc, dai, rong, mau):
    """Một CÁNH HOA nhọn đầu, mọc từ (cx,cy) hướng theo `goc` (độ).

    ⚠️ ĐỪNG VẼ CÁNH HOA BẰNG HÌNH TRÒN. Bản đầu xếp mấy hình tròn quanh một
       nhuỵ cho nhanh — thu nhỏ lại thì thành một cục lổn nhổn, chủ dự án xem
       xong bảo mấy logo hoa "chưa đẹp". Cánh hoa thật thì THON và NHỌN ĐẦU,
       nên ở đây dựng bằng đường cong hình hạnh nhân: bề ngang phình ở giữa
       (theo hàm sin) rồi thóp lại về hai đầu.
    """
    g = math.radians(goc)
    dx, dy = math.cos(g), math.sin(g)
    nx, ny = -dy, dx
    N = 16
    tren, duoi = [], []
    for i in range(N + 1):
        t = i / N
        w = rong * math.sin(math.pi * t) ** 0.78
        x, y = cx + dx * dai * t, cy + dy * dai * t
        tren.append((x + nx * w, y + ny * w))
        duoi.append((x - nx * w, y - ny * w))
    d.polygon(tren + duoi[::-1], fill=mau)


def hoa_nhieu_canh(d, cx, cy, r, so, mau, mau_trong, nhuy, lech=0.0):
    """Bông hoa hai lớp cánh nhọn — dùng cho sen, ban, cúc."""
    for i in range(so):
        canh_nhon(d, cx, cy, -90 + lech + i * 360.0 / so, r, r * 0.30, mau)
    for i in range(so):
        canh_nhon(d, cx, cy, -90 + lech + 180.0 / so + i * 360.0 / so,
                  r * 0.72, r * 0.24, mau_trong)
    d.ellipse([cx - r * 0.20, cy - r * 0.20, cx + r * 0.20, cy + r * 0.20], fill=nhuy)


def hoa_hong(d, cx, cy, r, ngoai, trong, tam):
    """Bông hồng: mấy lớp cánh ôm dần vào giữa."""
    for i in range(5):
        canh_nhon(d, cx, cy, -90 + i * 72, r, r * 0.40, ngoai)
    for i in range(5):
        canh_nhon(d, cx, cy, -54 + i * 72, r * 0.66, r * 0.34, trong)
    d.ellipse([cx - r * 0.30, cy - r * 0.30, cx + r * 0.30, cy + r * 0.30], fill=ngoai)
    d.ellipse([cx - r * 0.19, cy - r * 0.19, cx + r * 0.19, cy + r * 0.19], fill=tam)


def la_cay(d, cx, cy, goc, dai, mau):
    canh_nhon(d, cx, cy, goc, dai, dai * 0.30, mau)


def banh_rang(d, cx, cy, r, mau, lo):
    """Banh rang - ngay Quoc te Lao dong."""
    for i in range(8):
        g = math.radians(i * 45)
        dx, dy = math.cos(g), math.sin(g)
        w = r * 0.20
        d.polygon([(cx + dx * r * 0.82 - dy * w, cy + dy * r * 0.82 + dx * w),
                   (cx + dx * r * 1.26 - dy * w * 0.62, cy + dy * r * 1.26 + dx * w * 0.62),
                   (cx + dx * r * 1.26 + dy * w * 0.62, cy + dy * r * 1.26 - dx * w * 0.62),
                   (cx + dx * r * 0.82 + dy * w, cy + dy * r * 0.82 - dx * w)], fill=mau)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=mau)
    d.ellipse([cx - r * 0.40, cy - r * 0.40, cx + r * 0.40, cy + r * 0.40], fill=lo)


def bua_liem(d, cx, cy, r, mau):
    """Búa và liềm trên cờ Đảng — dựng theo ĐÚNG ảnh mẫu chủ dự án gửi.

    Bố cục của mẫu (đừng đảo lại, đừng làm dày lên):
      · LƯỠI LIỀM là vành trăng khuyết MỎNG, lưng dày nằm bên PHẢI hơi chếch
        xuống, miệng mở sang TRÁI hơi chếch lên; hai đầu VUỐT NHỌN — mũi trên
        ở khoảng 11–12 giờ, mũi dưới ở khoảng 7–8 giờ;
      · CHUÔI LIỀM nối tiếp mũi dưới, là thanh dày chìa sang TRÁI;
      · CÁI BÚA nằm chéo: đầu búa khối chữ nhật ở TRÊN–TRÁI, cán xuyên qua
        lòng liềm và THÒ HẲN RA ngoài ở DƯỚI–PHẢI.

    ⚠️ Đã vẽ sai ba lần, ghi lại cho khỏi lặp:
       1. d.arc() → vành cung dày đều, thu nhỏ nhìn thành chữ "C" có gạch ngang;
       2. dựng được trăng khuyết nhưng ĐẶT NGƯỢC (miệng mở lên trên–phải);
       3. đúng hướng nhưng LƯỠI QUÁ DÀY (bề dày bằng 56% bán kính) nên nhìn
          như chữ "Ɔ" béo, hai mũi cụt chứ không nhọn.
       Bề dày lưng liềm phải quanh 32% bán kính, vành ôm khoảng 220 độ.
    """
    # ── LƯỠI LIỀM ──────────────────────────────────────────────────────────
    # Dựng bằng phần thừa giữa HAI ĐƯỜNG TRÒN LỆCH TÂM — đúng cách vẽ trăng
    # khuyết, nên hai đầu tự vuốt nhọn. Ba con số dưới đây tính ngược lại từ
    # ảnh mẫu: vành ôm ~220 độ, lưng dày ~0,32 bán kính.
    R = r * 1.02                         # vòng ngoài của lưỡi
    ri = R * 0.943                       # vòng trong
    lech = R * 0.263                     # độ lệch tâm
    g_mo = math.radians(195)             # hướng MIỆNG liềm: trái, hơi chếch lên
    ux, uy = math.cos(g_mo), math.sin(g_mo)
    ox, oy = lech * ux, lech * uy
    a = (R * R - ri * ri + lech * lech) / (2 * lech)
    h = math.sqrt(max(0.0, R * R - a * a))
    px, py = cx + a * ux, cy + a * uy
    g1 = (px - h * uy, py + h * ux)      # hai đầu mũi liềm
    g2 = (px + h * uy, py - h * ux)
    xa = math.atan2(-uy, -ux)            # hướng lưng liềm (dày nhất)

    def _cung(tx, ty, bk, p1, p2):
        quay = lambda t: t % (2 * math.pi)
        b1 = quay(math.atan2(p1[1] - ty, p1[0] - tx))
        b2 = quay(math.atan2(p2[1] - ty, p2[0] - tx))
        do_dai = quay(b2 - b1)
        if quay(quay(xa) - b1) > do_dai:
            b1, b2 = b2, b1
            do_dai = quay(b2 - b1)
            dao = True
        else:
            dao = False
        n = 60
        ds = [(tx + bk * math.cos(b1 + do_dai * i / n),
               ty + bk * math.sin(b1 + do_dai * i / n)) for i in range(n + 1)]
        return ds[::-1] if dao else ds

    d.polygon(_cung(cx, cy, R, g1, g2) + _cung(cx + ox, cy + oy, ri, g1, g2)[::-1],
              fill=mau)

    # ── CHUÔI LIỀM — thanh dày chìa sang trái, nối từ mũi DƯỚI ────────────
    mui = g1 if g1[1] > g2[1] else g2
    gx, gy = math.cos(math.radians(168)), math.sin(math.radians(168))
    day = R * 0.17
    dx_, dy_ = -gy * day, gx * day       # pháp tuyến của chuôi
    cuoi = (mui[0] + gx * R * 0.52, mui[1] + gy * R * 0.52)
    d.polygon([(mui[0] - dx_, mui[1] - dy_), (mui[0] + dx_, mui[1] + dy_),
               (cuoi[0] + dx_, cuoi[1] + dy_), (cuoi[0] - dx_, cuoi[1] - dy_)], fill=mau)

    # ── CÁI BÚA — đầu ở TRÊN–TRÁI, cán thò ra ở DƯỚI–PHẢI ─────────────────
    cx_h, cy_h = 0.7071, 0.7071          # hướng cán: chéo xuống phải
    nx, ny = 0.7071, -0.7071             # vuông góc với cán
    hx, hy = cx - R * 0.46, cy - R * 0.46            # tâm đầu búa
    ex, ey = cx + R * 0.80, cy + R * 0.80            # mũi cán, thò ra ngoài lưỡi
    dc = R * 0.115                                    # nửa bề dày cán
    d.polygon([(hx - nx * dc, hy - ny * dc), (hx + nx * dc, hy + ny * dc),
               (ex + nx * dc, ey + ny * dc), (ex - nx * dc, ey - ny * dc)], fill=mau)
    dai, dayb = R * 0.42, R * 0.20       # nửa chiều dài / nửa bề dày đầu búa
    d.polygon([
        (hx - nx * dai - cx_h * dayb, hy - ny * dai - cy_h * dayb),
        (hx + nx * dai - cx_h * dayb, hy + ny * dai - cy_h * dayb),
        (hx + nx * dai + cx_h * dayb, hy + ny * dai + cy_h * dayb),
        (hx - nx * dai + cx_h * dayb, hy - ny * dai + cy_h * dayb),
    ], fill=mau)


def chim_bo_cau(d, cx, cy, r, than, mo, la):
    """Chim bo cau ngam canh - 30/4 thong nhat, hoa binh."""
    d.ellipse([cx - r * 0.95, cy - r * 0.38, cx + r * 0.45, cy + r * 0.42], fill=than)
    d.polygon([(cx + r * 0.30, cy), (cx + r * 1.20, cy - r * 0.58),
               (cx + r * 1.08, cy + r * 0.30)], fill=than)
    d.ellipse([cx - r * 1.26, cy - r * 0.64, cx - r * 0.70, cy - r * 0.08], fill=than)
    d.polygon([(cx - r * 1.24, cy - r * 0.42), (cx - r * 1.74, cy - r * 0.26),
               (cx - r * 1.22, cy - r * 0.12)], fill=mo)
    d.polygon([(cx - r * 0.58, cy - r * 0.18), (cx + r * 0.18, cy - r * 1.08),
               (cx + r * 0.38, cy - r * 0.10)], fill=mo)
    for i in range(3):
        d.ellipse([cx - r * 2.00 - i * r * 0.26, cy - r * 0.08 + i * r * 0.16,
                   cx - r * 1.58 - i * r * 0.26, cy + r * 0.20 + i * r * 0.16], fill=la)


def ngon_nen(d, cx, cy, r, than, lua, quang):
    """Ngon nen tri an - 27/7."""
    d.ellipse([cx - r * 1.35, cy - r * 1.60, cx + r * 1.35, cy + r * 0.20], fill=quang)
    d.rounded_rectangle([cx - r * 0.42, cy - r * 0.15, cx + r * 0.42, cy + r * 1.50],
                        radius=r * 0.18, fill=than)
    d.polygon([(cx, cy - r * 1.34), (cx + r * 0.38, cy - r * 0.52),
               (cx, cy - r * 0.20), (cx - r * 0.38, cy - r * 0.52)], fill=lua)


def hoa_dang(d, cx, cy, r, canh, lua, nuoc):
    """Den hoa dang tha tren mat nuoc - le Vu Lan."""
    for i in range(5):
        g = math.radians(-162 + i * 42)
        dx, dy = math.cos(g), math.sin(g)
        d.polygon([(cx, cy),
                   (cx + dx * r * 1.05 - dy * r * 0.24, cy + dy * r * 1.05 + dx * r * 0.24),
                   (cx + dx * r * 1.32, cy + dy * r * 1.32),
                   (cx + dx * r * 1.05 + dy * r * 0.24, cy + dy * r * 1.05 - dx * r * 0.24)],
                  fill=canh)
    d.polygon([(cx, cy - r * 1.34), (cx + r * 0.36, cy - r * 0.48),
               (cx, cy - r * 0.16), (cx - r * 0.36, cy - r * 0.48)], fill=lua)
    for i, w in enumerate((1.5, 1.1, 0.72)):
        y = cy + r * (0.62 + i * 0.34)
        d.line([(cx - r * w, y), (cx + r * w, y)], fill=nuoc, width=max(2, r * 0.16))


def ba_nen_nhang(d, cx, cy, r, than, dau, khoi):
    """Ba nen nhang dang chay - ram thang Gieng."""
    for i, dx in enumerate((-0.62, 0.0, 0.62)):
        x = cx + r * dx
        cao = r * (1.6 if i == 1 else 1.34)
        d.line([(x, cy + r * 0.9), (x + r * dx * 0.22, cy - cao)],
               fill=than, width=max(2, r * 0.17))
        d.ellipse([x + r * dx * 0.22 - r * 0.18, cy - cao - r * 0.18,
                   x + r * dx * 0.22 + r * 0.18, cy - cao + r * 0.18], fill=dau)
    for dx, dy, rr in ((-0.10, -2.10, 0.24), (0.34, -2.50, 0.18), (-0.36, -2.70, 0.14)):
        d.ellipse([cx + r * dx - r * rr, cy + r * dy - r * rr,
                   cx + r * dx + r * rr, cy + r * dy + r * rr], fill=khoi)


def bo_hoa(d, cx, cy, r, canh, nhuy, la):
    """Bo hoa cuc - ngay Phu nu Viet Nam 20/10."""
    d.line([(cx, cy + r * 2.4), (cx - r * 0.2, cy + r * 0.5)], fill=la, width=max(2, r * 0.22))
    d.ellipse([cx - r * 1.15, cy + r * 0.95, cx - r * 0.20, cy + r * 1.55], fill=la)
    d.ellipse([cx + r * 0.20, cy + r * 1.15, cx + r * 1.15, cy + r * 1.75], fill=la)
    hoa(d, cx - r * 0.74, cy + r * 0.10, r * 0.80, canh, nhuy, canh=8)
    hoa(d, cx + r * 0.78, cy + r * 0.30, r * 0.72, canh, nhuy, canh=8)
    hoa(d, cx, cy - r * 0.60, r * 0.92, canh, nhuy, canh=8)


# ── Từng dịp: vẽ gì lên logo ────────────────────────────────────────────────
# Hàm nhận (d, m); `m` là BẢNG MÀU của nền đang dựng (tối hay sáng).

def bong_mai(d, cx, cy, r, m):
    """Một bông mai: 5 cánh vàng, viền trong sáng hơn, nhụy đỏ + chấm nhuỵ vàng.

    Vẽ HAI LỚP cánh (lớp ngoài vàng đậm, lớp trong vàng sáng) cho bông có
    chiều sâu. Một lớp phẳng nhìn bệt, thu nhỏ lại thành đốm vàng chết.
    """
    for i in range(5):
        canh_nhon(d, cx, cy, -90 + i * 72, r, r * 0.46, m['vang'])
    for i in range(5):
        canh_nhon(d, cx, cy, -90 + i * 72, r * 0.74, r * 0.40, m['vang_sang'])
    d.ellipse([cx - r * 0.26, cy - r * 0.26, cx + r * 0.26, cy + r * 0.26], fill=m['do_tet'])


def nu_mai(d, cx, cy, r, m):
    """Nụ mai chưa nở: một chấm tròn vàng có cuống nâu."""
    d.line([(cx, cy), (cx - r * 0.2, cy + r * 1.5)], fill=m['nau'], width=max(2, int(r * 0.5)))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=m['vang'])


def ve_tet(d, m):
    """Tết Nguyên đán — logo quan trọng nhất trong năm.

    ⚠️ CÀNH MAI MỌC TỪ NGÔI NHÀ RA PHÍA PHẢI — chỉ MỘT nhánh chính.
       Bản trước vẽ ngược: cành mọc từ bên phải vượt qua mái sang trái,
       thành ra cành đè lên cả ngôi nhà — chủ dự án bảo "bạn làm ngược".

    ⚠️ CỤM PHẢI GẦN VUÔNG, KHÔNG NẰM DÀI. Bản trước cành vươn ngang một dải
       258→460 mà chỉ cao hơn trăm đơn vị. Khi cụm bị dồn vào khuôn vuông nhỏ
       ở góc ô logo, cụm nằm dài phải co lại rất nhiều — hoa teo đi, nhìn
       thưa thớt (chủ dự án: "hoa mai bị thiếu và chưa tươi"). Nay cành vươn
       CHÉO nên cụm gần vuông, vào khuôn nào cũng còn to.

    ⚠️ NĂM BÔNG TO + BA NỤ, xếp thành MỘT MẢNG liền nhau chứ không rải đều.
       Rải đều thì ở cỡ 32 điểm ảnh thành confetti vãi lộn xộn; chụm lại thì
       thu nhỏ vẫn ra một mảng vàng rõ ràng — đó mới là "tươi".
       Mỗi bông vẽ hai lớp cánh (vàng đậm ngoài, vàng sáng trong) cho có
       chiều sâu, nhuỵ đỏ ở giữa.
    """
    # ── CÀNH: gốc sát mép ô vuông, vươn chéo lên góc trên phải ──
    khuc = [(294, 156), (330, 124), (364, 92), (396, 62), (428, 30)]
    for k in range(len(khuc) - 1):
        d.line([khuc[k], khuc[k + 1]], fill=m['nau'], width=max(3, int(11 - k * 1.8)))
    d.line([(364, 92), (330, 66)], fill=m['nau'], width=5)      # nhánh chĩa lên trái
    d.line([(396, 62), (438, 74)], fill=m['nau'], width=4)      # nhánh chĩa xuống phải

    # ── NỤ trước, HOA sau (hoa nằm đè lên nụ cho có lớp) ──
    for cx, cy in ((318, 58), (446, 62), (306, 112)):
        nu_mai(d, cx, cy, 9, m)

    for cx, cy, r in ((336, 112, 30), (374, 74, 34), (418, 40, 30),
                      (330, 62, 25), (430, 84, 24)):
        bong_mai(d, cx, cy, r, m)

    # ── BÁNH CHƯNG XANH — màu xanh lá duy nhất trong cả bộ logo lễ ──
    banh_chung(d, 322, 176, 46, m['xanh'], m['kem'])


def ve_tet_duong(d, m):
    """Tết Dương lịch: chùm pháo hoa — một quả lớn, hai quả nhỏ."""
    phao_hoa(d, 320, 40, 34, 14, m['kem'], m['vang_sang'], day=3)
    phao_hoa(d, 414, 62, 30, 12, m['kem'], m['vang_sang'], day=3)
    phao_hoa(d, 362, 86, 52, 20, m['vang_sang'], m['vang'], day=4)


def ve_gio_to(d, m):
    """Giỗ Tổ Hùng Vương: tượng Vua Hùng trên nền TRỐNG ĐỒNG.

    ⚠️ Phải có cái đĩa trống đồng phía sau. Để tượng đứng trơ trên nền trong
       thì khối tượng quá mảnh, thu nhỏ lại nhìn ra cái đuốc — chủ dự án đã
       bảo làm lại một lần vì thế. Đĩa tròn đỏ cho tượng một cái nền chắc,
       ở cỡ 32 điểm ảnh vẫn ra một huy hiệu tròn rõ ràng.
    """
    d.ellipse([368 - 60, 72 - 60, 368 + 60, 72 + 60], fill=m['do_tet'])
    tia(d, 368, 72, 30, 56, m['vang'], so=16, day=5)
    d.ellipse([368 - 60, 72 - 60, 368 + 60, 72 + 60], outline=m['vang'], width=5)
    tuong_vua_hung(d, 368, 132, 116, m['vang_sang'], m['vang'])


def ve_quoc_khanh(d, m):
    """Quốc khánh 2/9: cờ Tổ quốc, to hơn một chút."""
    co_to_quoc(d, m, 318, 20, 112, 74, nghieng=0.3)


def ve_trung_thu(d, m):
    """Trung thu: lồng đèn đỏ treo, vài ngôi sao nhỏ.

    ⚠️ ĐÂY LÀ BẢN ĐẦU TIÊN và chủ dự án chốt giữ nó: "trung thu bạn làm
       lại logo như ban đầu là được rồi đừng sửa nữa". Đã thử thêm mặt trăng
       to ở giữa — bị chê. ĐỪNG SỬA NỮA.
    Mặt trăng chính là vầng mặt trời sẵn có trong logo.
    """
    long_den(d, m, 372, 76, 62, 74, m['do_tet'])
    for x, y in ((310, 30), (426, 34), (304, 106)):
        sao(d, x, y, 13, m['vang_sang'])


def ve_noel(d, m):
    """Noel: mũ ông già Noel chụp lên đỉnh mái + hai bông tuyết.

    ⚠️ Mũ phải TO và ĐÈ LÊN mái. Lần đầu vẽ mũ nhỏ đặt hờ phía trên đỉnh mái,
       thu về 32px chỉ còn một chấm đỏ, không ai hiểu là cái mũ.
    """
    # ⚠️ MŨ ĐỘI LÊN CHỮ CL, không phải đặt hờ trên mép ô vuông.
    #    Chữ CL chiếm khoảng x 49…239, y 49…239 trong ô vuông 288. Đặt mũ
    #    chớm xuống y ≈ 26 và lệch phải một chút là nó ngồi đúng trên đỉnh
    #    nét cong chữ C, nhìn như đội mũ thật.
    #    Đây là dịp DUY NHẤT trang trí được đè lên ô vuông (chủ dự án chỉ
    #    định riêng), nên nó cũng là dịp duy nhất không bị _xep_lai() dồn
    #    sang phải.
    mu_noel(d, m, 96, 26, 118, 52)
    bong_tuyet(d, 400, 60, 34, m['net'], day=6)
    bong_tuyet(d, 470, 132, 22, m['net'], day=4)
    bong_tuyet(d, 352, 152, 17, m['net'], day=3)


def ve_phu_nu(d, m):
    """8/3 Quốc tế Phụ nữ: biểu tượng ♀ lồng trong vành hoa.

    ⚠️ Chùm mimosa (bản trước) toàn chấm nhỏ, thu lại nhìn như bụi cỏ — chủ
       dự án bảo làm lại. Biểu tượng ♀ thì chỉ có hai mảng lớn (vòng tròn và
       chữ thập), ở cỡ 32 điểm ảnh vẫn đọc ra ngay.
    """
    for i in range(8):
        canh_nhon(d, 366, 52, -90 + i * 45, 52, 15, m['hong'])
    bieu_tuong_nu(d, 366, 52, 30, m['vang_sang'], m['do_tet'])


def ve_nha_giao(d, m):
    """20/11 Nhà giáo Việt Nam: mũ tốt nghiệp đặt trên quyển sách mở.

    Ảnh mẫu chủ dự án gửi là cảnh học trò tặng hoa thầy giáo trước bảng đen —
    vẽ cả cảnh thì ở cỡ 32 điểm ảnh chỉ còn mấy vệt màu. Hai thứ trong tấm
    ảnh ấy nhận ra ngay ở cỡ nhỏ là MŨ TỐT NGHIỆP và QUYỂN SÁCH.
    """
    # quyển sách mở
    d.polygon([(306, 104), (368, 88), (368, 138), (306, 150)], fill=m['vang'])
    d.polygon([(430, 104), (368, 88), (368, 138), (430, 150)], fill=m['vang'])
    d.polygon([(314, 106), (364, 93), (364, 132), (314, 143)], fill=m['net'])
    d.polygon([(422, 106), (372, 93), (372, 132), (422, 143)], fill=m['net'])
    d.polygon([(364, 90), (372, 90), (372, 138), (364, 138)], fill=m['nau'])
    mu_tot_nghiep(d, 366, 48, 104, 74, m['vang_sang'], m['do_tet'])


def ve_quan_doi(d, m):
    """22/12 Quân đội nhân dân Việt Nam: quân hiệu."""
    quan_hieu(d, 368, 66, 62, m['do_tet'], m['do'], m['vang_co'], m['vang'])


def ve_gia_dinh(d, m):
    """28/6 Ngày Gia đình Việt Nam: trái tim trên nóc nhà."""
    trai_tim(d, 185, 34, 40, m['do_tet'])
    trai_tim(d, 372, 62, 26, m['hong'])


def ve_thieu_nhi(d, m):
    """1/6 Quốc tế Thiếu nhi: hai quả bóng bay."""
    bong_bay(d, 350, 48, 26, m['do_tet'], m['net'])
    bong_bay(d, 404, 74, 21, m['vang_sang'], m['net'])


def ve_doanh_nhan(d, m):
    """13/10 Doanh nhân Việt Nam: biểu đồ tăng trưởng.

    Đã qua ba kiểu: biểu đồ mảnh → cái bắt tay → chiếc cúp. Chủ dự án chốt
    quay về BIỂU ĐỒ nhưng phải đậm: ba cột đặc cao dần + mũi tên vọt lên.
    ⚠️ CỘT PHẢI DÀY và mũi tên phải TO hơn cột. Bản đầu cột mảnh, mũi tên
       bé — thu về 32 điểm ảnh chỉ còn mấy vạch vàng rời rạc.
    """
    for bx, bh in ((0.0, 0.40), (0.36, 0.66), (0.72, 0.94)):
        d.rectangle([300 + bx * 128, 140 - bh * 96, 300 + bx * 128 + 32, 140], fill=m['vang'])
    d.line([(306, 96), (420, 36)], fill=m['do_tet'], width=11)
    d.polygon([(436, 28), (396, 34), (414, 62)], fill=m['do_tet'])


def ve_ong_tao(d, m):
    """Ông Công ông Táo (23 tháng Chạp): cá chép vàng vượt sóng."""
    song_nuoc(d, 368, 128, 136, 28, m['kem'])
    ca_chep_bay(d, 362, 62, 128, 86, m['do_tet'], m['vang_sang'], m['net'])


def ve_lao_dong(d, m):
    """1/5 Quốc tế Lao động: nắm tay giơ cao trước bánh răng.

    Theo ảnh mẫu chủ dự án gửi (những người thợ giơ nắm tay). Bản trước
    chỉ có bánh răng — đúng "lao động" nhưng thiếu khí thế.
    """
    # ⚠️ DÙNG SẮC SÁNG NHẤT. Bánh răng vẽ bằng `vang` thường thì nằm cạnh
    #    nắm tay `vang_sang` nên trông xỉn hẳn đi — chủ dự án bảo "màu quốc
    #    tế lao động cũng tươi lên". Cho cả hai cùng sắc sáng, lấy lỗ trục
    #    đỏ làm điểm nhấn.
    banh_rang(d, 402, 50, 30, m['vang_sang'], m['do'])
    nam_tay(d, 352, 76, 74, 84, m['vang_sang'], m['nau'])


def ve_dang(d, m):
    """3/2 Thành lập Đảng: cờ đỏ búa liềm."""
    if _ve_phan_khac():
        d.rectangle([318, 8, 325, 106], fill=m['kem'])          # cán cờ (ngắn, xem co_to_quoc)
    if not _ve_mat_co():
        return
    d.polygon([(325, 16), (434, 8), (434, 86), (325, 94)], fill=m['do'])
    bua_liem(d, 380, 50, 30, m['vang_co'])


def ve_30_4(d, m):
    """30/4 Thống nhất đất nước: xe tăng và lá cờ.

    Theo ảnh mẫu chủ dự án gửi. Bản trước vẽ chim bồ câu — đúng ý hoà
    bình nhưng không ai nhìn ra ngày 30/4.
    """
    if _ve_phan_khac():
        d.line([(330, 104), (338, 28)], fill=m['nau'], width=5)   # cán cờ
        xe_tang(d, 366, 106, 122, 62, m['xanh'], m['nau'], m['net'])
    if not _ve_mat_co():
        return
    d.polygon([(338, 28), (402, 16), (396, 52), (334, 62)], fill=m['do'])
    sao(d, 368, 36, 13, m['vang_co'])


def ve_dien_bien(d, m):
    """7/5 Chiến thắng Điện Biên Phủ: chiến sĩ cắm cờ trên nóc hầm Đờ Cát.

    Dựng theo đúng tấm ảnh lịch sử chủ dự án gửi. Bản trước vẽ hoa ban Tây Bắc
    — đúng vùng đất nhưng không nói được ngày gì.

    ⚠️ RÚT GỌN CÒN BA MẢNG: mái hầm · hai bóng chiến sĩ · lá cờ. Vẽ đủ chi
       tiết như ảnh gốc thì ở cỡ 32 điểm ảnh chỉ còn một vệt lổn nhổn.
    """
    if _ve_phan_khac():
        noc_ham(d, 368, 136, 142, 40, m['xanh'], m['net'])
        chien_si(d, 396, 80, 30, m['xanh'])
        chien_si(d, 344, 78, 32, m['xanh'], giuong_co=True)
        d.line([(358, 90), (396, 24)], fill=m['nau'], width=5)    # cán cờ
    if not _ve_mat_co():
        return
    # mặt cờ đỏ sao vàng — lớp duy nhất được gợn sóng
    d.polygon([(396, 26), (432, 40), (424, 70), (390, 58)], fill=m['do'])
    sao(d, 411, 47, 13, m['vang_co'])


def ve_sen(d, m, lop=None):
    """19/5 sinh nhật Bác: CHÂN DUNG BÁC (hình khắc) và một đoá sen.

    Chủ dự án gửi ảnh chân dung chính thức và dặn để ảnh Bác vào. Ảnh chụp
    thu về cỡ logo thì nhoè, nên đổi thành HÌNH KHẮC HAI TÔNG kiểu tranh cổ
    động (xem scripts/tao-chan-dung-bac.py) — thu nhỏ vẫn còn đường nét.
    Chân dung để TO gần hết chiều cao logo, vì đây là thứ chính của ngày này.

    ⚠️ CHÂN DUNG ĐỂ MÀU ĐỎ (chủ dự án chốt 25/9/2026), cả nền tối lẫn nền
       sáng. Trước đây nền tối thì in nét TRẮNG — nhìn lạnh và dễ lẫn vào
       chữ trắng của thanh menu; đỏ mới ra đúng chất tranh cổ động.
    """
    hoa_nhieu_canh(d, 320, 126, 26, 7, m['hong'], m['kem'], m['vang_sang'])
    if lop is not None:
        dan_chan_dung(lop, 380, 76, 148, m['do'])


def ve_nen(d, m):
    """27/7 Thương binh Liệt sĩ: ngôi sao vàng và tấm băng đỏ "Tổ quốc ghi công".

    Theo ảnh mẫu chủ dự án gửi. Bản trước vẽ ngọn nến — đúng không khí tưởng
    niệm nhưng nến thì dịp nào cũng thắp.
    ⚠️ Khác quân hiệu 22/12 ở chỗ: sao đứng TRẦN trên nền trong, có dải băng
       đỏ dọc đè giữa; còn quân hiệu là sao nằm trong đĩa đỏ có vành lúa.
    """
    sao(d, 368, 66, 54, m['vang_sang'])
    sao(d, 368, 66, 40, m['vang'])
    d.polygon([(354, 24), (382, 24), (382, 114), (368, 104), (354, 114)], fill=m['do_tet'])
    sao(d, 368, 44, 12, m['vang_co'])


def ve_vu_lan(d, m):
    """Le Vu Lan: den hoa dang tha tren nuoc."""
    hoa_dang(d, 366, 60, 30, m['hong'], m['vang_sang'], m['kem'])


def ve_nhang(d, m):
    """Rằm tháng Giêng (Tết Nguyên tiêu): bát chè trôi nước + cánh hoa đào.

    Bản trước vẽ ba nén nhang — đúng là ngày cúng rằm, nhưng nhang thì rằm
    nào cũng thắp. Chè trôi nước thì chỉ riêng Nguyên tiêu.
    """
    bat_che(d, 368, 80, 104, 62, m['do_tet'], m['do'], m['net'])
    hoa_nhieu_canh(d, 312, 34, 17, 5, m['hong'], m['kem'], m['vang_sang'])
    hoa_nhieu_canh(d, 424, 42, 14, 5, m['hong'], m['kem'], m['vang_sang'])


def ve_hoa_cuc(d, m):
    """20/10 Phụ nữ Việt Nam: chiếc nón lá và một bông hồng.

    Chủ dự án gửi ảnh mẫu (cô gái áo dài đội nón lá, ôm bó hồng). Vẽ nguyên
    cô gái thì ở cỡ 32 điểm ảnh chỉ còn một vệt hồng, nên rút lại còn hai thứ
    nhận ra ngay: NÓN LÁ và BÔNG HỒNG.
    Khác hẳn bản 8/3 (chỉ một bông hồng có cành) nên hai ngày không lẫn nhau.
    """
    non_la(d, 356, 74, 118, 60, m['kem'], m['nau'], m['do_tet'])
    hoa_hong(d, 412, 104, 28, m['hong'], m['do_tet'], m['vang_sang'])


def ve_doan_ngo(d, m):
    """Tết Đoan Ngọ (5/5 âm): chiếc bánh ú tro bè ngang, buộc hai sợi lạt.

    ⚠️ ĐÁY RỘNG GẤP RƯHI CHIỀU CAO và KHÔNG ĐỂ LÁ CHĨA RA HAI BÊN.
       Đã vẽ ba lần: tam giác cao → ra cây thông; thêm lá hai bên → ra
       cánh buồm. Chỉ còn một khối tam giác bè với hai sợi lạt ngang.
    """
    d.polygon([(368, 44), (444, 128), (292, 128)], fill=m['xanh'])
    d.polygon([(368, 44), (444, 128), (374, 128)], fill=m['nau'])
    d.line([(304, 104), (432, 104)], fill=m['kem'], width=10)
    d.line([(318, 122), (418, 122)], fill=m['kem'], width=8)


# mã · tên hiển thị · hàm vẽ
# ⚠️ MỖI DỊP MỘT HÌNH RIÊNG. Đừng cho hai dịp dùng chung một bản: chủ dự án
#    xem bảng logo và bảo "nhiều lễ bạn vẽ logo trùng nhau quá".
#    Ngoại lệ duy nhất: lá cờ Tổ quốc dùng cho cả 2/9 và 2/4.
DIP = [
    ('tet',        'Tết Nguyên đán',      ve_tet),
    ('tet-duong',  'Tết Dương lịch 1/1',  ve_tet_duong),
    ('gio-to',     'Giỗ Tổ Hùng Vương',   ve_gio_to),
    ('30-4',       '30/4 Thống nhất',     ve_30_4),
    ('quoc-khanh', 'Quốc khánh 2/9',      ve_quoc_khanh),
    ('trung-thu',  'Tết Trung thu',       ve_trung_thu),
    ('noel',       'Giáng sinh 24-25/12', ve_noel),
    ('phu-nu',     'Quốc tế Phụ nữ 8/3',  ve_phu_nu),
    ('tri-an',     'Tri ân 27/7 (nến)',   ve_nen),
    ('nha-giao',   'Nhà giáo 20/11',      ve_nha_giao),
    ('quan-doi',   'Quân đội 22/12',      ve_quan_doi),
    ('gia-dinh',   'Gia đình Việt Nam',   ve_gia_dinh),
    ('thieu-nhi',  'Thiếu nhi 1/6',       ve_thieu_nhi),
    ('doanh-nhan', 'Doanh nhân 13/10',    ve_doanh_nhan),
    ('ong-tao',    'Ông Công ông Táo',    ve_ong_tao),
    ('lao-dong',   'Quốc tế Lao động 1/5', ve_lao_dong),
    ('dang',       'Thành lập Đảng 3/2',  ve_dang),
    ('dien-bien',  'Điện Biên Phủ 7/5',   ve_dien_bien),
    ('sen',        'Sinh nhật Bác 19/5',  ve_sen),
    ('vu-lan',     'Lễ Vu Lan',           ve_vu_lan),
    ('nhang',      'Rằm tháng Giêng',     ve_nhang),
    ('hoa-cuc',    'Phụ nữ Việt Nam 20/10', ve_hoa_cuc),
    ('doan-ngo',   'Tết Đoan Ngọ 5/5 âm', ve_doan_ngo),
]


def doi_mat_troi(anh, mau_troi, do, vien):
    """ĐỔI MẦU MẶT TRỜI ngay trên ảnh logo gốc (dùng cho Tết).

    Mặt trời trong logo là mảng DUY NHẤT mang màu vàng đồng (mọi nét khác
    là trắng ngà hoặc navy), nên đổi màu chỉ cần dò theo MÀU — không phải
    biết nó nằm ở đâu, không phải vẽ đè lên (vẽ đè thì che mất đụn cát
    đang nằm trước mặt trời).
    Phần rìa (màu pha giữa vàng và nền) để nguyên làm viền vàng sẵn.
    """
    a = np.asarray(anh).astype(np.int16)
    rgb = a[:, :, :3]
    d2 = np.abs(rgb - np.array(mau_troi, np.int16)).sum(axis=2)
    loi = d2 < 40            # lõi mặt trời: đúng màu vàng đồng
    ria = (d2 >= 40) & (d2 < 130) & (a[:, :, 3] > 40)   # vành pha màu quanh lõi
    r = a.copy()
    r[loi, :3] = do
    r[ria, :3] = vien
    return Image.fromarray(r.astype(np.uint8), 'RGBA')


def _ve_phong(d, ve, m, lop=None):
    """Gọi hàm vẽ nhưng mọi toạ độ tự được nhân lên PHONG lần.

    Nhờ vậy trong mấy hàm vẽ ở trên cứ ghi toạ độ theo cỡ THẬT (435×288) cho
    dễ đọc, còn nét thì vẫn được vẽ ở cỡ gấp 4 nên mượt.
    """
    g_line, g_poly = d.line, d.polygon
    g_ell, g_rect, g_rr = d.ellipse, d.rectangle, d.rounded_rectangle
    # ⚠️ NHỚ BỌC CẢ arc. Quên một hàm là hàm đó vẽ ở TOẠ ĐỘ CHƯA NHÂN, tức
    #    bằng 1/4 chỗ đúng → hình rơi tít lên góc trên trái, trông như logo
    #    dính vết bẩn. Đã vấp đúng thế với lưỡi liềm của cờ Đảng.
    g_arc = d.arc

    def nhan(xy):
        if isinstance(xy[0], (int, float)):
            return [v * PHONG for v in xy]
        return [(x * PHONG, y * PHONG) for x, y in xy]

    d.line = lambda xy, **k: g_line(nhan(xy), **{**k, 'width': max(1, round(k.get('width', 1) * PHONG))})
    # ⚠️ NHỚ NHÂN CẢ `width`. Mấy hàm này cũng nhận `width` (nét viền), quên
    #    nhân thì viền mảnh dính một phần tư, mà PIL lại đòi số nguyên nên còn
    #    báo lỗi "float object cannot be interpreted as an integer".
    def rong(k):
        return {**k, 'width': int(max(1, round(k['width'] * PHONG)))} if 'width' in k else k

    d.polygon = lambda xy, **k: g_poly(nhan(xy), **rong(k))
    d.ellipse = lambda xy, **k: g_ell(nhan(xy), **rong(k))
    d.rectangle = lambda xy, **k: g_rect(nhan(xy), **rong(k))
    d.rounded_rectangle = lambda xy, **k: g_rr(nhan(xy), **{**k, 'radius': k.get('radius', 0) * PHONG})
    d.arc = lambda xy, start, end, **k: g_arc(nhan(xy), start, end,
                                              **{**k, 'width': int(max(1, k.get('width', 1) * PHONG))})
    try:
        if 'lop' in ve.__code__.co_varnames[:ve.__code__.co_argcount]:
            ve(d, m, lop)
        else:
            ve(d, m)
    finally:
        d.line, d.polygon, d.ellipse, d.rectangle, d.rounded_rectangle, d.arc = (
            g_line, g_poly, g_ell, g_rect, g_rr, g_arc)


# Khung của một tấm logo lễ: ô vuông logo bên TRÁI, khoảng trống trang trí
# bên PHẢI. Giữ đúng tỉ lệ 435×288 như trước để thanh menu không phải đổi.
O_VUONG = 288            # cạnh ô vuông logo (cũng là chiều cao cả tấm)
# ⚠️ BỀ NGANG NỚI RỘNG TỪ 435 LÊN 560. Trang trí nay được xếp lại thành một
#    cụm gọn ĐỨNG BÊN PHẢI ô vuông (chủ dự án chốt "chọn hướng bên phải ô
#    vuông"), cao bằng 60% ô vuông — ở khổ 435 thì cụm đó rộng hơn chỗ còn
#    lại nên bị cắt cụt mất một mép.
#    ⚠️ ĐỔI SỐ NÀY THÌ PHẢI ĐỔI CẢ TI_LE_LE trong components/LogoLe.tsx —
#       bên đó tính bề ngang thẻ ảnh theo đúng tỉ lệ này. Lệch là méo hình.
RONG_LE = 560            # bề ngang cả tấm
# ⚠️ CHỖ ĐẶT TRANG TRÍ — CHỐT NGÀY 25/9/2026: GÓC TRÊN BÊN PHẢI Ô VUÔNG.
#    Trước đây trang trí nằm ở DẢI TRỐNG XA BÊN PHẢI (mẫu C, x = 330…552).
#    Đo ra mới thấy hỏng: trên thanh menu chữ "Cam Lâm Land" bắt đầu ở khoảng
#    42 điểm ảnh, mà trang trí nằm ở 36,7…61,3 — tức 78% BỀ NGANG TRANG TRÍ
#    NẰM DƯỚI CHỮ, khách gần như không thấy gì. Riêng Giáng sinh thoát vì cái
#    mũ nằm hẳn trên ô vuông.
#    Chủ dự án khoanh đỏ đúng góc trên phải ô vuông và chốt "khuôn gọn".
#    Nay trang trí nằm trong ô 206…330 × 4…128 — vắt qua đúng góc đó, không
#    dính chữ, và chỗ nào đè lên ô vuông thì _khoet_vien() xoá sợi viền vàng.
#    ⚠️ ĐỪNG DỜI RA DẢI PHẢI NỮA. Ghi chú cũ nói "chờm lên chữ là chủ ý của
#       mẫu C, chủ dự án đã đồng ý" — điều đó ĐÃ BỊ THAY THẾ bởi quyết định
#       này, sau khi chủ dự án nhìn thấy kết quả thật trên thanh menu.
HOP_TT = (206, 4, 330, 128)   # khuôn trang trí: trái, trên, phải, dưới


def lam(nen_toi: bool):
    """Dựng cả bộ logo lễ cho MỘT nền (True = thanh menu nền tối).

    ⚠️ NỀN GIỜ LÀ Ô VUÔNG NAVY, KHÔNG PHẢI ẢNH LOGO CHỤP NỮA. Chủ dự án chốt
       quay về logo gốc: ô vuông navy, ngôi nhà vàng có chấm tròn ở giữa.
       Ô vuông tự có nền nên hai bản sáng/tối giống hệt nhau; chỉ MÀU TRANG
       TRÍ là đổi theo nền của thanh menu.
    ⚠️ TRANG TRÍ NẰM Ở KHOẢNG TRỐNG BÊN PHẢI Ô VUÔNG (x ≈ 290…435), không vẽ
       đè lên ô vuông: ô vuông là nhận diện, che vào là hỏng. Vài dịp có chi
       tiết ló sang mép ô vuông một chút cho đỡ rời (cờ cắm, cành mai) thì
       vẫn phải chừa nguyên phần ngôi nhà.
    """
    # ⚠️ LẤY ĐÚNG TỆP LOGO CỦA NỀN ĐANG DỰNG. Hai tệp logo nay KHÁC nhau ở
    #    bề dày viền vàng (dày cho nền tối, mảnh cho nền trắng) — trước kia
    #    chúng giống hệt nhau nên chỗ này lấy cứng một tệp cũng không sao,
    #    giờ lấy cứng là bản nền trắng đeo viền dày của bản nền tối.
    o = Image.open(os.path.join(
        CONG, 'logo-cam-lam.webp' if nen_toi else 'logo-cam-lam-toi.webp')).convert('RGBA')
    o = o.resize((O_VUONG, O_VUONG), Image.LANCZOS)
    goc = Image.new('RGBA', (RONG_LE, O_VUONG), (0, 0, 0, 0))
    goc.alpha_composite(o, (0, 0))

    mau_o = _mau_nen_o(o)
    m = MAU_NEN_TOI if nen_toi else MAU_NEN_SANG
    ra = {}
    for ma, _ten, ve in DIP:
        lop = Image.new('RGBA', (goc.width * PHONG, goc.height * PHONG), (0, 0, 0, 0))
        _ve_phong(ImageDraw.Draw(lop), ve, m, lop)
        nen = goc.copy()
        tt = lop.resize(goc.size, Image.LANCZOS)
        anh = nen.copy()
        anh.alpha_composite(tt)
        # ⚠️ GHI RA BA TỆP chứ không phải một:
        #    · <mã>      — ảnh ghép sẵn, dùng để xem trước và làm bản dự phòng;
        #    · <mã>-nen  — phần Ô VUÔNG LOGO;
        #    · <mã>-tt   — phần TRANG TRÍ, nền trong suốt.
        #    Tách ra vì chủ dự án dặn: NGÔI NHÀ LÀ BIỂU TƯỢNG CỦA WEB, không
        #    được lắc — kể cả trong logo ngày lễ. Chỉ phần trang trí mới động.
        # Dịp có cờ: vẽ lại hai lần để tách MẶT CỜ ra một lớp riêng.
        co = None
        if ma in DIP_CO_CO:
            co = _lop_rieng(ve, m, goc.size, 'chi-co')
            tt = _lop_rieng(ve, m, goc.size, 'khong-co')
        # Dồn về khuôn chuẩn bên phải ô vuông.
        # ⚠️ GIÁNG SINH LÀ NGOẠI LỆ: chủ dự án muốn CÁI MŨ ĐỘI LÊN CHỮ CL,
        #    tức là mũ phải nằm TRÊN Ô VUÔNG chứ không dồn sang phải. Dồn
        #    cả cụm thì mũ bay sang bên cạnh, hết ra ông già Noel.
        if ma != 'noel':
            tt, co = _xep_lai(tt, co)
        # Trang trí đè lên ô vuông thì XOÁ SỢI VIỀN VÀNG ở đúng chỗ bị đè
        # (chủ dự án dặn). Không đụng gì khi trang trí nằm ngoài ô vuông.
        nen = _khoet_vien(nen, tt, co, mau_o)
        anh = nen.copy()
        anh.alpha_composite(tt)
        if co is not None:
            anh.alpha_composite(co)
        ra[ma] = (anh, nen, tt, co)
    return ra


def _mau_nen_o(o: Image.Image):
    """Màu nền của ô vuông logo — navy ở bản nền tối, trắng ở bản nền sáng.

    Lấy màu ĐẶC xuất hiện nhiều nhất trong ô vuông chứ không ghi cứng, để đổi
    tệp logo khác màu thì chỗ này tự theo.
    """
    dem = {}
    px = o.load()
    for y in range(0, o.height, 3):
        for x in range(0, o.width, 3):
            r, g, b, a = px[x, y]
            if a > 250:
                dem[(r, g, b)] = dem.get((r, g, b), 0) + 1
    return max(dem, key=dem.get) if dem else (10, 37, 64)


def _khoet_vien(nen: Image.Image, tt: Image.Image, co: Image.Image | None, mau):
    """Xoá SỢI VIỀN VÀNG của ô vuông ở đúng chỗ trang trí đè lên.

    Chủ dự án: "những chỗ trang trí đè thì xoá phần viền vàng chỗ đó đi".
    Để nguyên thì sợi viền vàng chui qua sau hình trang trí, chỗ hình mỏng nó
    lại ló ra — nhìn rối, mà ở cỡ 32 điểm ảnh thì thành một vệt vàng lem.

    ⚠️ KHÔNG khoét thủng ô vuông. Chỉ đổi chỗ bị đè về đúng MÀU NỀN của ô,
       còn hình dáng bo tròn giữ y nguyên (lấy lại lớp trong suốt của ảnh gốc).
       Khoét thủng thì nhìn xuyên qua thấy màu thanh menu, ô vuông bị mẻ góc.
    """
    gop = tt.copy()
    if co is not None:
        gop.alpha_composite(co)
    mat_na = gop.split()[3].point(lambda v: 255 if v > 40 else 0)
    mat_na = mat_na.filter(ImageFilter.MaxFilter(9))   # nới ra ~4 điểm cho hở đều
    ra = nen.copy()
    ra.paste(Image.new('RGBA', ra.size, tuple(mau) + (255,)), (0, 0), mat_na)
    ra.putalpha(nen.split()[3])                        # giữ nguyên dáng bo tròn
    return ra


def _xep_lai(tt: Image.Image, co: Image.Image | None):
    """Dồn cụm trang trí vào đúng KHUÔN CHUẨN ở góc trên phải ô vuông (HOP_TT).

    Vì sao phải làm: mỗi dịp vẽ một kiểu, hình to nhỏ và đặt cao thấp khác
    nhau — để nguyên thì cái chồm ra ngoài, cái lại tụt vào trong, nhìn cả bộ
    không ra một nhà. Ở đây đo khung thật của từng hình rồi thu phóng cho vừa
    khuôn và đặt vào giữa khuôn, nên 23 dịp cùng một chuẩn.

    ⚠️ THU PHÓNG GIỮ NGUYÊN TỈ LỆ (lấy cạnh nào chật hơn). Kéo cho đầy khuôn
       là hình bị bóp méo.
    ⚠️ LÁ CỜ PHẢI ĐI CÙNG MỘT PHÉP BIẾN HÌNH với phần còn lại. Đo khung trên
       ẢNH GỘP (trang trí + cờ) rồi áp y hệt cho cả hai — tính riêng từng tấm
       là cờ rời khỏi cán.
    """
    gop = tt.copy()
    if co is not None:
        gop.alpha_composite(co)
    bb = gop.getbbox()
    if not bb:
        return tt, co
    x0, y0, x1, y1 = HOP_TT
    kw, kh = x1 - x0, y1 - y0
    w0, h0 = bb[2] - bb[0], bb[3] - bb[1]
    ti = min(kw / w0, kh / h0)
    rong, cao = max(1, round(w0 * ti)), max(1, round(h0 * ti))
    x = x0 + (kw - rong) // 2
    y = y0 + (kh - cao) // 2

    def dat(anh):
        if anh is None:
            return None
        ra = Image.new('RGBA', (RONG_LE, O_VUONG), (0, 0, 0, 0))
        ra.alpha_composite(anh.crop(bb).resize((rong, cao), Image.LANCZOS), (x, y))
        return ra

    return dat(tt), dat(co)


def _lop_rieng(ve, m, kho, phan: str) -> Image.Image:
    """Vẽ trang trí ở một 'phần' nhất định rồi thu về đúng cỡ.

    ⚠️ Phải ĐẶT LẠI PHAN_VE về 'het' sau khi vẽ xong. Quên thì mọi dịp vẽ
       sau đó cũng bị cắt mất phần — mà không báo lỗi gì cả, chỉ là logo
       thiếu chi tiết.
    """
    global PHAN_VE
    PHAN_VE = phan
    try:
        lop = Image.new('RGBA', (kho[0] * PHONG, kho[1] * PHONG), (0, 0, 0, 0))
        _ve_phong(ImageDraw.Draw(lop), ve, m, lop)
        return lop.resize(kho, Image.LANCZOS)
    finally:
        PHAN_VE = 'het'


def _xem_thu(toi, sang):
    """Một tấm ảnh duy nhất để chủ dự án duyệt: mỗi dịp một hàng, bên trái là
       nền navy (thanh menu trong suốt trên banner), bên phải nền trắng (khi
       cuộn xuống), và cạnh mỗi bản có thêm CỠ THẬT 32px để biết nhìn có rõ."""
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 21)
    except Exception:
        font = ImageFont.load_default()
    H, W = 118, 1060
    n = len(DIP) + 1
    sheet = Image.new('RGB', (W, H * n), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    hang = [('', 'Ngày thường (logo gốc)', None)] + DIP
    for i, (ma, ten, _) in enumerate(hang):
        y = i * H
        d.rectangle([300, y, 660, y + H - 2], fill=(10, 37, 64))
        d.line([(0, y + H - 1), (W, y + H - 1)], fill=(226, 232, 240))
        d.text((18, y + 48), ten, fill=(20, 30, 45), font=font)
        a = toi[ma][0] if ma else Image.open(os.path.join(CONG, 'logo-cam-lam.webp')).convert('RGBA')
        b = sang[ma][0] if ma else Image.open(os.path.join(CONG, 'logo-cam-lam-toi.webp')).convert('RGBA')
        for anh, x0 in ((a, 330), (b, 700)):
            for kho, dx in ((74, 0), (32, 120)):
                w = round(kho * anh.width / anh.height)
                s = anh.resize((w, kho), Image.LANCZOS)
                sheet.paste(s, (x0 + dx, y + (H - kho) // 2), s)
        d.text((880, y + 50), 'cỡ thật →', fill=(150, 160, 172), font=font)
    p = os.path.join(RA, '_xem-thu.png')
    sheet.save(p)
    print('\nAnh xem thu:', p)


def ve_xe_tuan_loc():
    """Vẽ CHIẾC XE TUẦN LỘC ra một tệp riêng (không nằm trong logo).

    Ngày Giáng sinh, ngoài thanh menu sẽ có ông già Noel cưỡi xe tuần lộc
    chạy ngang qua logo rồi biến mất — hai phút mới chạy một lần.
    ⚠️ ĐỂ RIÊNG MỘT TỆP, đừng vẽ vào logo: nó phải chạy ngang qua màn
       hình, còn logo thì đứng yên một chỗ.
    """
    W, H = 150, 88
    lop = Image.new('RGBA', (W * PHONG, H * PHONG), (0, 0, 0, 0))
    d = ImageDraw.Draw(lop)
    k = PHONG
    NAU = (138, 94, 52)
    NAU_D = (104, 68, 36)
    DO = (201, 42, 42)
    TRANG = (250, 251, 252)
    VANG = (247, 208, 110)

    # ── tuần lộc (bên trái, đang phi) ──
    d.ellipse([18 * k, 42 * k, 58 * k, 62 * k], fill=NAU)                 # thân
    d.ellipse([8 * k, 32 * k, 26 * k, 46 * k], fill=NAU)                  # đầu
    d.polygon([(10 * k, 34 * k), (2 * k, 22 * k), (12 * k, 28 * k)], fill=NAU_D)   # sừng
    d.polygon([(18 * k, 32 * k), (14 * k, 18 * k), (24 * k, 27 * k)], fill=NAU_D)
    for x0, x1 in ((22, 16), (32, 28), (44, 48), (52, 58)):               # chân
        d.line([(x0 * k, 58 * k), (x1 * k, 74 * k)], fill=NAU_D, width=int(3.4 * k))
    d.polygon([(56 * k, 46 * k), (68 * k, 38 * k), (62 * k, 52 * k)], fill=NAU_D)  # đuôi
    # dây kéo
    d.line([(52 * k, 52 * k), (78 * k, 56 * k)], fill=NAU_D, width=int(2.2 * k))

    # ── xe trượt ──
    d.polygon([(78 * k, 46 * k), (128 * k, 46 * k), (122 * k, 68 * k), (84 * k, 68 * k)], fill=DO)
    d.line([(76 * k, 70 * k), (132 * k, 70 * k)], fill=VANG, width=int(3 * k))
    d.line([(132 * k, 70 * k), (140 * k, 62 * k)], fill=VANG, width=int(3 * k))
    # ── ông già Noel ──
    d.polygon([(92 * k, 46 * k), (116 * k, 46 * k), (112 * k, 26 * k), (96 * k, 26 * k)], fill=DO)
    d.ellipse([96 * k, 18 * k, 114 * k, 36 * k], fill=(246, 214, 186))     # mặt
    d.ellipse([94 * k, 28 * k, 116 * k, 44 * k], fill=TRANG)              # râu
    d.polygon([(94 * k, 22 * k), (116 * k, 22 * k), (108 * k, 10 * k)], fill=DO)   # mũ
    d.ellipse([102 * k, 4 * k, 114 * k, 16 * k], fill=TRANG)              # chóp mũ
    d.line([(92 * k, 24 * k), (116 * k, 24 * k)], fill=TRANG, width=int(4 * k))    # vành mũ
    # túi quà
    d.polygon([(118 * k, 46 * k), (140 * k, 46 * k), (136 * k, 30 * k), (122 * k, 30 * k)], fill=VANG)

    out = lop.resize((W, H), Image.LANCZOS)
    p = os.path.join(RA, 'noel-xe.webp')
    out.save(p, 'WEBP', quality=94, method=6)
    print('OK %-11s %-22s %d KB' % ('noel-xe', 'Xe tuan loc Giang sinh',
                                    os.path.getsize(p) // 1024))


def main():
    os.makedirs(RA, exist_ok=True)
    toi, sang = lam(True), lam(False)
    for ma, ten, _ in DIP:
        for bo, duoi in ((toi, ''), (sang, '-toi')):
            anh, nen, tt, co = bo[ma]
            anh.save(os.path.join(RA, ma + duoi + '.webp'), 'WEBP', quality=94, method=6)
            nen.save(os.path.join(RA, ma + '-nen' + duoi + '.webp'), 'WEBP', quality=94, method=6)
            tt.save(os.path.join(RA, ma + '-tt' + duoi + '.webp'), 'WEBP', quality=94, method=6)
            if co is not None:
                co.save(os.path.join(RA, ma + '-co' + duoi + '.webp'), 'WEBP', quality=94, method=6)
        print('OK %-11s %-22s %d KB' % (ma, ten, os.path.getsize(os.path.join(RA, ma + '.webp')) // 1024))
    ve_xe_tuan_loc()
    _xem_thu(toi, sang)


if __name__ == '__main__':
    main()
