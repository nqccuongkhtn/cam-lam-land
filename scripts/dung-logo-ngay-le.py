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
    """Giỗ Tổ Hùng Vương: ngôi sao trống đồng."""
    tia(d, 366, 72, 20, 54, m['vang'], so=14, day=6)
    d.ellipse([366 - 26, 72 - 26, 366 + 26, 72 + 26], fill=m['vang_sang'])
    sao(d, 366, 72, 19, m['do_tet'], canh=14, trong=0.55)


def ve_30_4(d, m):
    """30/4 – 1/5: lá cờ Tổ quốc."""
    co_to_quoc(d, m, 330, 26, 96, 64)


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
    """8/3 và 20/10: một bông hoa hồng."""
    d.line([(372, 128), (372, 66)], fill=m['xanh'], width=7)
    d.ellipse([334, 92, 372, 112], fill=m['xanh'])
    hoa(d, 372, 54, 36, m['hong'], m['vang_sang'], canh=6)


def ve_tri_an(d, m):
    """27/7 Thương binh Liệt sĩ · Vu Lan · rằm tháng Giêng: hoa sen."""
    hoa_sen(d, 368, 70, 52, m['kem'], m['do_tet'])
    d.line([(368, 108), (368, 140)], fill=m['xanh'], width=6)


def ve_nha_giao(d, m):
    """20/11 Nhà giáo Việt Nam: quyển sách mở + một bông hoa."""
    quyen_sach(d, 364, 92, 108, 62, m['vang'], m['vang_sang'])
    hoa(d, 410, 34, 24, m['hong'], m['vang_sang'], canh=6)


def ve_quan_doi(d, m):
    """22/12 Quân đội Nhân dân: ngôi sao vàng trên nền đỏ."""
    d.ellipse([368 - 48, 72 - 48, 368 + 48, 72 + 48], fill=m['do_tet'])
    sao(d, 368, 72, 38, m['vang_co'])


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


# mã · tên hiển thị · hàm vẽ
DIP = [
    ('tet',        'Tết Nguyên đán',      ve_tet),
    ('tet-duong',  'Tết Dương lịch 1/1',  ve_tet_duong),
    ('gio-to',     'Giỗ Tổ Hùng Vương',   ve_gio_to),
    ('30-4',       '30/4 và 1/5',         ve_30_4),
    ('quoc-khanh', 'Quốc khánh 2/9',      ve_quoc_khanh),
    ('trung-thu',  'Tết Trung thu',       ve_trung_thu),
    ('noel',       'Giáng sinh 24-25/12', ve_noel),
    ('phu-nu',     '8/3 và 20/10',        ve_phu_nu),
    ('tri-an',     'Tri ân 27/7 · Vu Lan', ve_tri_an),
    ('nha-giao',   'Nhà giáo 20/11',      ve_nha_giao),
    ('quan-doi',   'Quân đội 22/12',      ve_quan_doi),
    ('gia-dinh',   'Gia đình Việt Nam',   ve_gia_dinh),
    ('thieu-nhi',  'Thiếu nhi 1/6',       ve_thieu_nhi),
    ('doanh-nhan', 'Doanh nhân 13/10',    ve_doanh_nhan),
    ('ong-tao',    'Ông Công ông Táo',    ve_ong_tao),
]


def _ve_phong(d, ve, m):
    """Gọi hàm vẽ nhưng mọi toạ độ tự được nhân lên PHONG lần.

    Nhờ vậy trong mấy hàm vẽ ở trên cứ ghi toạ độ theo cỡ THẬT (435×288) cho
    dễ đọc, còn nét thì vẫn được vẽ ở cỡ gấp 4 nên mượt.
    """
    g_line, g_poly = d.line, d.polygon
    g_ell, g_rect, g_rr = d.ellipse, d.rectangle, d.rounded_rectangle

    def nhan(xy):
        if isinstance(xy[0], (int, float)):
            return [v * PHONG for v in xy]
        return [(x * PHONG, y * PHONG) for x, y in xy]

    d.line = lambda xy, **k: g_line(nhan(xy), **{**k, 'width': max(1, round(k.get('width', 1) * PHONG))})
    d.polygon = lambda xy, **k: g_poly(nhan(xy), **k)
    d.ellipse = lambda xy, **k: g_ell(nhan(xy), **k)
    d.rectangle = lambda xy, **k: g_rect(nhan(xy), **k)
    d.rounded_rectangle = lambda xy, **k: g_rr(nhan(xy), **{**k, 'radius': k.get('radius', 0) * PHONG})
    try:
        ve(d, m)
    finally:
        d.line, d.polygon, d.ellipse, d.rectangle, d.rounded_rectangle = (
            g_line, g_poly, g_ell, g_rect, g_rr)


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
