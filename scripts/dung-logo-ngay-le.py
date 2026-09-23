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

from PIL import Image, ImageDraw, ImageFont

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

MAU_NEN_TOI = dict(
    net=TRANG,
    vang=(229, 188, 98), vang_sang=(247, 208, 110), kem=(238, 214, 164),
    nau=(120, 72, 40), do=(218, 37, 29), do_tet=(201, 42, 42),
    hong=(236, 112, 140), xanh=(86, 140, 74), vang_co=VANG_CO,
)
MAU_NEN_SANG = dict(
    net=NAVY,
    vang=(166, 116, 24), vang_sang=(191, 138, 30), kem=(178, 133, 58),
    nau=(92, 56, 30), do=(200, 28, 22), do_tet=(178, 30, 30),
    hong=(211, 64, 104), xanh=(56, 104, 48), vang_co=VANG_CO,
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


def co_to_quoc(d, m, x, y, rong, cao, nghieng=0.0):
    """Lá cờ đỏ sao vàng: nền đỏ, ngôi sao vàng năm cánh đặt chính giữa."""
    d.rectangle([x - rong * 0.06, y - cao * 0.30, x - rong * 0.02, y + cao * 1.55], fill=m['kem'])
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
    """Búa và liềm trên cờ Đảng.

    ⚠️ VẼ ĐẶC VÀ TO, chiếm gần hết lá cờ. Bản đầu vẽ bằng mấy nét mảnh, thu về
       32px là mất hết chi tiết, chỉ còn một vệt vàng nhoè — chủ dự án bảo
       "chưa đẹp". Nay: lưỡi liềm là một vành cung DÀY, búa là khối đặc.
    """
    # lưỡi liềm: vành cung dày, ôm từ trái xuống dưới sang phải
    d.arc([cx - r * 1.05, cy - r * 1.05, cx + r * 1.05, cy + r * 1.05],
          start=95, end=300, fill=mau, width=max(3, r * 0.30))
    # chuôi liềm
    d.line([(cx - r * 0.06, cy + r * 1.02), (cx + r * 0.52, cy + r * 1.16)],
           fill=mau, width=max(3, r * 0.26))
    # cán búa (chéo) + đầu búa
    d.line([(cx - r * 0.86, cy + r * 0.86), (cx + r * 0.36, cy - r * 0.36)],
           fill=mau, width=max(3, r * 0.26))
    d.polygon([(cx + r * 0.16, cy - r * 0.62), (cx + r * 0.86, cy - r * 0.18),
               (cx + r * 0.60, cy + r * 0.22), (cx - r * 0.10, cy - r * 0.22)], fill=mau)


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

def ve_tet(d, m):
    """Tết Nguyên đán: cành mai vàng ở góc trên phải."""
    d.line([(300, 128), (352, 82), (382, 44)], fill=m['nau'], width=7)
    d.line([(352, 82), (400, 94)], fill=m['nau'], width=6)
    hoa(d, 386, 38, 30, m['vang_sang'], m['do_tet'])
    hoa(d, 410, 94, 24, m['vang_sang'], m['do_tet'])
    hoa(d, 338, 74, 21, m['vang_sang'], m['do_tet'])


def ve_tet_duong(d, m):
    """Tết Dương lịch: chùm pháo hoa."""
    tia(d, 362, 74, 14, 52, m['vang_sang'], so=12, day=7)
    tia(d, 362, 74, 30, 46, m['kem'], so=12, day=5, xoay=15)
    d.ellipse([362 - 13, 74 - 13, 362 + 13, 74 + 13], fill=m['vang'])
    for x, y, r in ((312, 36, 7), (416, 40, 6), (412, 120, 6), (316, 118, 5)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=m['vang_sang'])


def ve_gio_to(d, m):
    """Giỗ Tổ Hùng Vương: ĐỀN HÙNG.

    Chủ dự án dặn "cái này nên để Hùng Vương vào". Ngôi sao trống đồng
    (bản đầu) là biểu tượng chung của văn hoá Đông Sơn, ai cũng dùng được;
    còn Đền Hùng thì chỉ có một, nhìn là biết ngày Giỗ Tổ.
    Sau lưng đền vẽ vệt trống đồng mờ cho đủ ý "nguồn cội".
    """
    tia(d, 366, 44, 30, 54, m['vang'], so=14, day=5)
    den_tho(d, 366, 72, 108, 96, m['vang_sang'], m['do_tet'])


def ve_quoc_khanh(d, m):
    """Quốc khánh 2/9: cờ Tổ quốc, to hơn một chút."""
    co_to_quoc(d, m, 318, 20, 112, 74, nghieng=0.3)


def ve_trung_thu(d, m):
    """Trung thu: lồng đèn đỏ treo góc phải (trăng rằm chính là mặt trời sẵn có)."""
    long_den(d, m, 372, 76, 62, 74, m['do_tet'])
    for x, y in ((310, 30), (426, 34), (304, 106)):
        sao(d, x, y, 13, m['vang_sang'])


def ve_noel(d, m):
    """Noel: mũ ông già Noel chụp lên đỉnh mái + hai bông tuyết.

    ⚠️ Mũ phải TO và ĐÈ LÊN mái. Lần đầu vẽ mũ nhỏ đặt hờ phía trên đỉnh mái,
       thu về 32px chỉ còn một chấm đỏ, không ai hiểu là cái mũ.
    """
    mu_noel(d, m, 128, 0, 96, 42)
    bong_tuyet(d, 374, 50, 30, m['net'], day=6)
    bong_tuyet(d, 424, 112, 19, m['net'], day=4)


def ve_phu_nu(d, m):
    """8/3 Quốc tế Phụ nữ: một bông hồng có cành lá."""
    d.line([(374, 136), (374, 76)], fill=m['xanh'], width=7)
    la_cay(d, 374, 112, 200, 40, m['xanh'])
    la_cay(d, 374, 100, -20, 34, m['xanh'])
    hoa_hong(d, 374, 56, 38, m['hong'], m['do_tet'], m['vang_sang'])


def ve_nha_giao(d, m):
    """20/11 Nhà giáo Việt Nam: quyển sách mở, có gáy và trang giấy.

    ⚠️ Phải thấy GÁY SÁCH ở giữa và trang giấy trắng, nếu không nó chỉ là hai
       mảng màu ghép lại, nhìn y như lá cờ — lỗi của bản đầu.
    """
    # bìa sách
    d.polygon([(302, 84), (368, 62), (368, 132), (302, 148)], fill=m['vang'])
    d.polygon([(434, 84), (368, 62), (368, 132), (434, 148)], fill=m['vang'])
    # trang giấy
    d.polygon([(312, 86), (364, 69), (364, 126), (312, 140)], fill=m['net'])
    d.polygon([(424, 86), (372, 69), (372, 126), (424, 140)], fill=m['net'])
    # gáy sách
    d.polygon([(364, 66), (372, 66), (372, 132), (364, 132)], fill=m['nau'])
    # dòng chữ trên trang
    for i in range(3):
        y = 92 + i * 15
        d.line([(320, y + 4), (356, y - 6)], fill=m['nau'], width=3)
        d.line([(380, y - 6), (416, y + 4)], fill=m['nau'], width=3)


def ve_quan_doi(d, m):
    """22/12 Quân đội nhân dân: sao vàng năm cánh trong vành đỏ.

    ⚠️ Ngôi sao phải CHIẾM GẦN HẾT vành đỏ. Bản đầu để sao nhỏ giữa một đĩa đỏ
       to, thu nhỏ lại chỉ thấy một chấm đỏ — không ra ngôi sao.
    """
    d.ellipse([368 - 52, 70 - 52, 368 + 52, 70 + 52], fill=m['do_tet'])
    d.ellipse([368 - 52, 70 - 52, 368 + 52, 70 + 52], outline=m['vang'], width=5)
    sao(d, 368, 70, 46, m['vang_co'])


def ve_gia_dinh(d, m):
    """28/6 Ngày Gia đình Việt Nam: trái tim trên nóc nhà."""
    trai_tim(d, 185, 34, 40, m['do_tet'])
    trai_tim(d, 372, 62, 26, m['hong'])


def ve_thieu_nhi(d, m):
    """1/6 Quốc tế Thiếu nhi: hai quả bóng bay."""
    bong_bay(d, 350, 48, 26, m['do_tet'], m['net'])
    bong_bay(d, 404, 74, 21, m['vang_sang'], m['net'])


def ve_doanh_nhan(d, m):
    """13/10 Doanh nhân Việt Nam: biểu đồ đi lên."""
    mui_ten_len(d, 306, 46, 104, 80, m['vang'], m['do_tet'])


def ve_ong_tao(d, m):
    """23 tháng Chạp — ông Công ông Táo: cá chép vàng."""
    ca_chep(d, 366, 74, 58, m['vang_sang'], m['net'])


def ve_lao_dong(d, m):
    """1/5 Quoc te Lao dong: banh rang."""
    banh_rang(d, 366, 72, 40, m['vang'], m['do_tet'])


def ve_dang(d, m):
    """3/2 Thành lập Đảng: cờ đỏ búa liềm."""
    d.rectangle([318, 8, 325, 140], fill=m['kem'])
    d.polygon([(325, 16), (434, 8), (434, 86), (325, 94)], fill=m['do'])
    bua_liem(d, 380, 50, 30, m['vang_co'])


def ve_30_4(d, m):
    """30/4 Thong nhat dat nuoc: chim bo cau ngam canh."""
    chim_bo_cau(d, 382, 66, 32, m['net'], m['vang_sang'], m['xanh'])


def ve_dien_bien(d, m):
    """7/5 Chiến thắng Điện Biên Phủ: hoa ban Tây Bắc (5 cánh, nhuỵ hồng)."""
    d.line([(366, 140), (366, 86)], fill=m['xanh'], width=6)
    la_cay(d, 366, 118, 200, 36, m['xanh'])
    hoa_nhieu_canh(d, 366, 62, 48, 5, m['net'], m['kem'], m['hong'], lech=18)


def ve_sen(d, m):
    """19/5 sinh nhật Bác: ngôi nhà tranh Làng Sen + hai bông sen.

    ⚠️ KHÔNG VẼ CHÂN DUNG BÁC VÀO LOGO. Chủ dự án có yêu cầu, nhưng:
       1. Ảnh lãnh tụ không dùng cho mục đích thương mại — mà logo một sàn
          bất động sản thì đúng là nhận diện thương mại;
       2. logo chỉ hiện ở cỡ 32 điểm ảnh, khuôn mặt thành một vệt nhoè —
          vừa không ai nhận ra, vừa thành thiếu tôn trọng.
    Làng Sen là NƠI BÁC SINH RA nên hợp với ngày sinh hơn hẳn Lăng Bác
    (bản trước), lại vẽ rõ được ở cỡ nhỏ.
    """
    hoa_nhieu_canh(d, 318, 104, 26, 7, m['hong'], m['kem'], m['vang_sang'])
    hoa_nhieu_canh(d, 416, 110, 22, 7, m['hong'], m['kem'], m['vang_sang'])
    nha_tranh(d, 366, 60, 118, 96, m['vang'], m['net'], m['nau'])


def ve_nen(d, m):
    """27/7 Thuong binh Liet si: ngon nen tri an."""
    ngon_nen(d, 368, 72, 30, m['net'], m['vang_sang'], m['do_tet'])


def ve_vu_lan(d, m):
    """Le Vu Lan: den hoa dang tha tren nuoc."""
    hoa_dang(d, 366, 60, 30, m['hong'], m['vang_sang'], m['kem'])


def ve_nhang(d, m):
    """Ram thang Gieng: ba nen nhang."""
    ba_nen_nhang(d, 368, 100, 26, m['nau'], m['do_tet'], m['kem'])


def ve_hoa_cuc(d, m):
    """20/10 Phụ nữ Việt Nam: bó hoa cúc vàng — cánh mảnh, nhiều cánh."""
    for x0, y0, g in ((352, 130, 250), (380, 132, 290)):
        d.line([(x0, y0), (366, 92)], fill=m['xanh'], width=6)
    la_cay(d, 362, 118, 200, 36, m['xanh'])
    la_cay(d, 372, 124, -18, 32, m['xanh'])
    hoa_nhieu_canh(d, 332, 74, 30, 12, m['vang'], m['vang_sang'], m['do_tet'])
    hoa_nhieu_canh(d, 404, 82, 27, 12, m['vang'], m['vang_sang'], m['do_tet'])
    hoa_nhieu_canh(d, 368, 44, 36, 14, m['vang_sang'], m['vang'], m['do_tet'])


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
    ('tri-an',     'Tri ân 27/7 (nến)',    ve_nen),
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
]


def _ve_phong(d, ve, m):
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
    d.polygon = lambda xy, **k: g_poly(nhan(xy), **k)
    d.ellipse = lambda xy, **k: g_ell(nhan(xy), **k)
    d.rectangle = lambda xy, **k: g_rect(nhan(xy), **k)
    d.rounded_rectangle = lambda xy, **k: g_rr(nhan(xy), **{**k, 'radius': k.get('radius', 0) * PHONG})
    d.arc = lambda xy, start, end, **k: g_arc(nhan(xy), start, end,
                                              **{**k, 'width': int(max(1, k.get('width', 1) * PHONG))})
    try:
        ve(d, m)
    finally:
        d.line, d.polygon, d.ellipse, d.rectangle, d.rounded_rectangle, d.arc = (
            g_line, g_poly, g_ell, g_rect, g_rr, g_arc)


def lam(nen_toi: bool):
    """Dựng cả bộ logo lễ cho MỘT nền (True = thanh menu nền tối)."""
    ten_goc = 'logo-cam-lam.webp' if nen_toi else 'logo-cam-lam-toi.webp'
    goc = Image.open(os.path.join(CONG, ten_goc)).convert('RGBA')
    m = MAU_NEN_TOI if nen_toi else MAU_NEN_SANG
    ra = {}
    for ma, _ten, ve in DIP:
        lop = Image.new('RGBA', (goc.width * PHONG, goc.height * PHONG), (0, 0, 0, 0))
        _ve_phong(ImageDraw.Draw(lop), ve, m)
        anh = goc.copy()
        anh.alpha_composite(lop.resize(goc.size, Image.LANCZOS))
        ra[ma] = anh
    return ra


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
        a = toi[ma] if ma else Image.open(os.path.join(CONG, 'logo-cam-lam.webp')).convert('RGBA')
        b = sang[ma] if ma else Image.open(os.path.join(CONG, 'logo-cam-lam-toi.webp')).convert('RGBA')
        for anh, x0 in ((a, 330), (b, 700)):
            for kho, dx in ((74, 0), (32, 120)):
                w = round(kho * anh.width / anh.height)
                s = anh.resize((w, kho), Image.LANCZOS)
                sheet.paste(s, (x0 + dx, y + (H - kho) // 2), s)
        d.text((880, y + 50), 'cỡ thật →', fill=(150, 160, 172), font=font)
    p = os.path.join(RA, '_xem-thu.png')
    sheet.save(p)
    print('\nAnh xem thu:', p)


def main():
    os.makedirs(RA, exist_ok=True)
    toi, sang = lam(True), lam(False)
    for ma, ten, _ in DIP:
        toi[ma].save(os.path.join(RA, ma + '.webp'), 'WEBP', quality=94, method=6)
        sang[ma].save(os.path.join(RA, ma + '-toi.webp'), 'WEBP', quality=94, method=6)
        print('OK %-11s %-22s %d KB' % (ma, ten, os.path.getsize(os.path.join(RA, ma + '.webp')) // 1024))
    _xem_thu(toi, sang)


if __name__ == '__main__':
    main()
