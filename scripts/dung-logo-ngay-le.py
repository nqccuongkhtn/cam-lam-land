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

# ── Bảng màu ────────────────────────────────────────────────────────────────
VANG = (229, 188, 98)
VANG_SANG = (247, 208, 110)
KEM = (238, 214, 164)
TRANG = (250, 251, 252)
NAVY = (19, 52, 89)
DO = (218, 37, 29)           # đỏ cờ Tổ quốc
DO_TET = (201, 42, 42)
VANG_CO = (255, 222, 0)      # vàng ngôi sao trên cờ
HONG = (236, 112, 140)
NAU = (120, 72, 40)
XANH_LA = (86, 140, 74)


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


def co_to_quoc(d, x, y, rong, cao, nghieng=0.0):
    """Lá cờ đỏ sao vàng: nền đỏ, ngôi sao vàng năm cánh đặt chính giữa."""
    d.rectangle([x - rong * 0.06, y - cao * 0.30, x - rong * 0.02, y + cao * 1.55], fill=KEM)
    b = cao * 0.10 * (1 + nghieng)          # mặt cờ hơi lượn cho đỡ cứng
    d.polygon([(x, y), (x + rong, y - b), (x + rong, y + cao - b), (x, y + cao)], fill=DO)
    sao(d, x + rong * 0.5, y + cao * 0.5 - b * 0.5, cao * 0.34, VANG_CO)


def mu_noel(d, x, y, rong, cao):
    """Mũ ông già Noel đặt nghiêng trên đỉnh mái nhà."""
    d.polygon([(x, y + cao), (x + rong * 0.52, y - cao * 0.05),
               (x + rong * 1.02, y + cao * 0.42), (x + rong * 0.9, y + cao)], fill=DO)
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


def long_den(d, cx, cy, rong, cao, mau):
    """Lồng đèn Trung thu treo lủng lẳng."""
    d.line([(cx, cy - cao * 0.95), (cx, cy - cao * 0.52)], fill=KEM, width=rong * 0.08)
    d.ellipse([cx - rong / 2, cy - cao / 2, cx + rong / 2, cy + cao / 2], fill=mau)
    d.rectangle([cx - rong * 0.30, cy - cao * 0.60, cx + rong * 0.30, cy - cao * 0.44], fill=VANG)
    d.rectangle([cx - rong * 0.30, cy + cao * 0.44, cx + rong * 0.30, cy + cao * 0.60], fill=VANG)
    d.line([(cx, cy + cao * 0.58), (cx, cy + cao * 0.95)], fill=VANG, width=rong * 0.10)


# ── Từng dịp: vẽ gì lên logo ────────────────────────────────────────────────
# Hàm nhận (d, net); `net` là màu nét phụ, đổi theo nền sáng/tối.

def ve_tet(d, net):
    """Tết Nguyên đán: cành mai vàng ở góc trên phải."""
    d.line([(300, 128), (352, 82), (382, 44)], fill=NAU, width=7)
    d.line([(352, 82), (400, 94)], fill=NAU, width=6)
    hoa(d, 386, 38, 30, VANG_SANG, DO_TET)
    hoa(d, 410, 94, 24, VANG_SANG, DO_TET)
    hoa(d, 338, 74, 21, VANG_SANG, DO_TET)


def ve_tet_duong(d, net):
    """Tết Dương lịch: chùm pháo hoa vàng."""
    tia(d, 362, 74, 14, 52, VANG_SANG, so=12, day=7)
    tia(d, 362, 74, 30, 46, KEM, so=12, day=5, xoay=15)
    d.ellipse([362 - 13, 74 - 13, 362 + 13, 74 + 13], fill=VANG)
    for x, y, r in ((312, 36, 7), (416, 40, 6), (412, 120, 6), (316, 118, 5)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=VANG_SANG)


def ve_gio_to(d, net):
    """Giỗ Tổ Hùng Vương: ngôi sao trống đồng."""
    tia(d, 366, 72, 20, 54, VANG, so=14, day=6)
    d.ellipse([366 - 26, 72 - 26, 366 + 26, 72 + 26], fill=VANG_SANG)
    sao(d, 366, 72, 19, DO_TET, canh=14, trong=0.55)


def ve_30_4(d, net):
    """30/4 – 1/5: lá cờ Tổ quốc."""
    co_to_quoc(d, 330, 26, 96, 64)


def ve_quoc_khanh(d, net):
    """Quốc khánh 2/9: cờ Tổ quốc, to hơn một chút."""
    co_to_quoc(d, 318, 20, 112, 74, nghieng=0.3)


def ve_trung_thu(d, net):
    """Trung thu: lồng đèn đỏ treo góc phải (trăng rằm chính là mặt trời sẵn có)."""
    long_den(d, 372, 76, 62, 74, DO_TET)
    for x, y in ((310, 30), (426, 34), (304, 106)):
        sao(d, x, y, 13, KEM)


def ve_noel(d, net):
    """Noel: mũ ông già Noel chụp lên đỉnh mái + hai bông tuyết.

    ⚠️ Mũ phải TO và ĐÈ LÊN mái. Lần đầu vẽ mũ nhỏ đặt hờ phía trên đỉnh mái,
       thu về 32px chỉ còn một chấm đỏ, không ai hiểu là cái mũ.
    """
    mu_noel(d, 128, 0, 96, 42)
    bong_tuyet(d, 374, 50, 30, net, day=6)
    bong_tuyet(d, 424, 112, 19, net, day=4)


def ve_phu_nu(d, net):
    """8/3 và 20/10: một bông hoa hồng."""
    d.line([(372, 128), (372, 66)], fill=XANH_LA, width=7)
    d.ellipse([334, 92, 372, 112], fill=XANH_LA)
    hoa(d, 372, 54, 36, HONG, VANG_SANG, canh=6)


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
]


def _ve_phong(d, ve, net):
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
        ve(d, net)
    finally:
        d.line, d.polygon, d.ellipse, d.rectangle, d.rounded_rectangle = (
            g_line, g_poly, g_ell, g_rect, g_rr)


def lam(nen_toi: bool):
    """Dựng cả bộ logo lễ cho MỘT nền (True = thanh menu nền tối)."""
    ten_goc = 'logo-cam-lam.webp' if nen_toi else 'logo-cam-lam-toi.webp'
    goc = Image.open(os.path.join(CONG, ten_goc)).convert('RGBA')
    net = TRANG if nen_toi else NAVY
    ra = {}
    for ma, _ten, ve in DIP:
        lop = Image.new('RGBA', (goc.width * PHONG, goc.height * PHONG), (0, 0, 0, 0))
        _ve_phong(ImageDraw.Draw(lop), ve, net)
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
