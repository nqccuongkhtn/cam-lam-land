# -*- coding: utf-8 -*-
"""
SÁU MẪU LOGO THỬ — vẽ theo các ảnh mẫu chủ dự án gửi
=====================================================
Chủ dự án gửi 6 ảnh logo tham khảo (mấy mẫu sinh tự động trên design.com và
vài mẫu chữ lồng CL), dặn: **chỉ lấy hình, bỏ hai dòng chữ bên dưới**, rồi
dựng thử để chọn dùng cho web.

Script này KHÔNG chép lại mấy tấm ảnh đó (chúng là ảnh của bên khác, có tấm
còn đóng dấu chìm). Nó VẼ LẠI theo đúng ý hình của từng mẫu, bằng màu thương
hiệu của web: navy #0A2540 và vàng đồng #C8A14B.

Sáu mẫu:
  A. Vòng tròn mảnh, chữ C ở giữa          (ảnh 1)
  B. Vầng trăng khuyết ôm chữ C            (ảnh 2)
  C. Khung vuông hở góc, chữ C ở giữa      (ảnh 3)
  D. Chữ lồng CL trong tấm khiên           (ảnh 4)
  E. Vòng tròn C lồng chữ L                (ảnh 5)
  F. Chữ C đặc khoét chữ L                 (ảnh 6)

⚠️ CÁCH DỰNG: mỗi mẫu vẽ ra một MẶT NẠ TRẮNG–ĐEN ở cỡ gấp 6 rồi mới tô màu và
   thu nhỏ. Vẽ thẳng bằng màu ở cỡ thật thì mọi đường cong đều răng cưa; mà
   quan trọng hơn: có mấy mẫu phải KHOÉT (chữ L khoét vào chữ C), khoét trên
   mặt nạ thì chỉ việc tô số 0, chứ tô màu trong suốt lên ảnh màu là không
   khoét được.

⚠️ MỖI MẪU PHẢI ĐỌC ĐƯỢC Ở CỠ 32 ĐIỂM ẢNH — đó là cỡ thật trên thanh menu.
   Ảnh xem thử bên dưới luôn kèm cỡ 32 để so, đừng chỉ nhìn bản to.

Chạy:  python scripts/dung-logo-thu.py
       → apps/frontend/public/logo-thu/<mã>.webp  (nền trong suốt, nét vàng)
       → scripts/anh/_xem-6-logo.png              (ảnh so sánh để chọn)
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-thu')

KHO = 256          # cạnh tệp xuất ra
PHONG = 6          # vẽ ở cỡ gấp 6 rồi thu lại

NAVY = (10, 37, 64)
VANG = (200, 161, 75)
TRANG = (250, 251, 252)


def _font_nhan(co):
    """Font cho phần CHỮ CHÚ THÍCH của ảnh so sánh.

    ⚠️ Phải dùng Segoe UI chứ không dùng Georgia: Georgia trên máy này thiếu
       chữ có dấu tiếng Việt, tên mẫu in ra toàn ô vuông rỗng.
    """
    for ten in ('segoeui.ttf', 'arial.ttf'):
        try:
            return ImageFont.truetype('C:/Windows/Fonts/' + ten, int(co))
        except Exception:
            pass
    return ImageFont.load_default()


def _font(co):
    """Font có chân, dáng cổ điển — dùng cho CHỮ TRONG LOGO."""
    for ten in ('georgiab.ttf', 'georgia.ttf', 'timesbd.ttf', 'times.ttf', 'arial.ttf'):
        try:
            return ImageFont.truetype('C:/Windows/Fonts/' + ten, int(co))
        except Exception:
            pass
    return ImageFont.load_default()


def _chu_giua(d, chu, cx, cy, co, mau=255):
    f = _font(co)
    l, t, r, b = d.textbbox((0, 0), chu, font=f)
    d.text((cx - (r + l) / 2, cy - (b + t) / 2), chu, font=f, fill=mau)


def _cung(d, hop, dau, cuoi, day, mau=255):
    d.arc(hop, dau, cuoi, fill=mau, width=int(day))


# ── A. Vòng tròn mảnh, chữ C ở giữa ─────────────────────────────────────────
def mau_a(d, n):
    r = n * 0.40
    c = n / 2
    d.ellipse([c - r, c - r, c + r, c + r], outline=255, width=int(n * 0.022))
    _chu_giua(d, 'C', c, c - n * 0.01, n * 0.42)


# ── B. Vầng trăng khuyết ôm chữ C ───────────────────────────────────────────
def mau_b(d, n):
    """Trăng khuyết = hình tròn lớn KHOÉT một hình tròn lệch sang phải."""
    c = n / 2
    r = n * 0.42
    d.ellipse([c - r, c - r, c + r, c + r], fill=255)
    r2 = r * 0.86
    d.ellipse([c - r2 + n * 0.13, c - r2 - n * 0.01,
               c + r2 + n * 0.13, c + r2 - n * 0.01], fill=0)
    _chu_giua(d, 'C', c + n * 0.09, c, n * 0.46)


# ── C. Khung vuông hở góc, chữ C ở giữa ────────────────────────────────────
def mau_c(d, n):
    """Khung vuông nhưng HỞ GÓC TRÊN TRÁI — chữ C nằm lọt vào chỗ hở đó."""
    a, b = n * 0.24, n * 0.76        # hai mép khung
    day = int(n * 0.026)
    d.line([(a + n * 0.16, a), (b, a)], fill=255, width=day)      # cạnh trên (hở bên trái)
    d.line([(b, a), (b, b)], fill=255, width=day)                 # cạnh phải
    d.line([(b, b), (a, b)], fill=255, width=day)                 # cạnh dưới
    d.line([(a, b), (a, a + n * 0.16)], fill=255, width=day)      # cạnh trái (hở bên trên)
    _chu_giua(d, 'C', a + n * 0.055, a + n * 0.055, n * 0.30)


# ── D. Chữ lồng CL trong tấm khiên ─────────────────────────────────────────
def mau_d(d, n):
    """Tấm khiên: vai vuông ở trên, thon dần xuống một mũi nhọn ở đáy."""
    x0, x1 = n * 0.22, n * 0.78
    y0, y1 = n * 0.18, n * 0.86
    diem = [(x0, y0), (x1, y0), (x1, y0 + (y1 - y0) * 0.42)]
    N = 18
    for i in range(N + 1):                      # sườn phải cong vào mũi
        t = i / N
        diem.append((x1 - (x1 - n / 2) * t ** 1.6,
                     y0 + (y1 - y0) * (0.42 + 0.58 * t)))
    for i in range(N, -1, -1):                  # sườn trái, đối xứng
        t = i / N
        diem.append((x0 + (n / 2 - x0) * t ** 1.6,
                     y0 + (y1 - y0) * (0.42 + 0.58 * t)))
    d.polygon(diem, fill=255)
    # khoét lòng khiên cho thành nét viền dày
    nho = [( (x - n / 2) * 0.80 + n / 2, (y - (y0 + y1) / 2) * 0.80 + (y0 + y1) / 2)
           for x, y in diem]
    d.polygon(nho, fill=0)
    # chữ lồng CL bên trong
    _chu_giua(d, 'CL', n / 2, (y0 + y1) / 2 - n * 0.02, n * 0.26)


# ── E. Vòng tròn C lồng chữ L ──────────────────────────────────────────────
def mau_e(d, n):
    """Chữ C là một vành tròn hở bên phải; chữ L nằm lọt trong lòng, chân chữ
       L chìa ra đúng chỗ hở — hai chữ khoá vào nhau."""
    c = n / 2
    r = n * 0.40
    day = n * 0.115
    _cung(d, [c - r, c - r, c + r, c + r], 28, 332, day)          # vành C
    x = c - n * 0.06
    d.rectangle([x - day / 2, c - r * 0.62, x + day / 2, c + r * 0.34], fill=255)
    d.rectangle([x - day / 2, c + r * 0.34 - day / 2,
                 c + r * 0.74, c + r * 0.34 + day / 2], fill=255)


# ── F. Chữ C đặc khoét chữ L ───────────────────────────────────────────────
def mau_f(d, n):
    """Chữ C rất dày, bên trong hiện ra chữ L bằng KHOẢNG TRỐNG.

    ⚠️ Cách dựng: vẽ chữ C thật dày trước, rồi KHOÉT một chữ L to hơn một
       chút bằng số 0 — phần bị khoét chính là chữ L nhìn thấy. Khoét bằng
       một nét mảnh thì ở cỡ 32 điểm ảnh nét đó biến mất, chữ L không hiện ra.
    """
    c = n / 2
    r = n * 0.44
    day = n * 0.26
    _cung(d, [c - r, c - r, c + r, c + r], 34, 326, day)
    # khoét chữ L: cột dọc + chân ngang, để hở đều quanh nét
    x = c - n * 0.035
    ho = n * 0.055
    d.rectangle([x - ho, c - r * 0.80, x + n * 0.085 + ho, c + r * 0.22], fill=0)
    d.rectangle([x - ho, c + r * 0.22 - ho, c + r * 0.95, c + r * 0.22 + n * 0.085 + ho],
                fill=0)
    # vẽ lại chính chữ L bằng nét đặc, nằm lọt trong chỗ vừa khoét
    d.rectangle([x, c - r * 0.80 + ho, x + n * 0.085, c + r * 0.22], fill=255)
    d.rectangle([x, c + r * 0.22, c + r * 0.95 - ho, c + r * 0.22 + n * 0.085], fill=255)


MAU = [
    ('a-vong-tron', 'A · Vòng tròn mảnh, chữ C', mau_a),
    ('b-trang-khuyet', 'B · Vầng trăng khuyết ôm chữ C', mau_b),
    ('c-khung-vuong', 'C · Khung vuông hở góc', mau_c),
    ('d-khien-cl', 'D · Chữ lồng CL trong khiên', mau_d),
    ('e-vong-cl', 'E · Vòng tròn C lồng chữ L', mau_e),
    ('f-c-khoet-l', 'F · Chữ C đặc khoét chữ L', mau_f),
]


def dung(ve, mau=VANG):
    n = KHO * PHONG
    mn = Image.new('L', (n, n), 0)
    ve(ImageDraw.Draw(mn), n)
    mn = mn.resize((KHO, KHO), Image.LANCZOS)
    im = Image.new('RGBA', (KHO, KHO), mau + (0,))
    im.putalpha(mn)
    return im


def main():
    os.makedirs(RA, exist_ok=True)
    anh = {}
    for ma, _ten, ve in MAU:
        im = dung(ve)
        anh[ma] = im
        p = os.path.join(RA, ma + '.webp')
        im.save(p, 'WEBP', quality=95, method=6)
        print('OK %-16s %d KB' % (ma, os.path.getsize(p) // 1024))

    # ── Ảnh so sánh: mỗi mẫu một hàng, nền navy và nền trắng, kèm cỡ thật ──
    f = _font_nhan(21)
    H, W = 130, 1080
    sheet = Image.new('RGB', (W, H * len(MAU)), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for i, (ma, ten, _) in enumerate(MAU):
        y = i * H
        d.rectangle([330, y, 700, y + H - 2], fill=NAVY)
        d.line([(0, y + H - 1), (W, y + H - 1)], fill=(226, 232, 240))
        d.text((18, y + 52), ten, fill=(20, 30, 45), font=f)
        for nen_toi, x0 in ((True, 360), (False, 730)):
            im = anh[ma] if nen_toi else dung(dict(MAU=None) and [v for k, _t, v in MAU if k == ma][0], NAVY)
            for kho, dx in ((84, 0), (32, 128)):
                s = im.resize((kho, kho), Image.LANCZOS)
                sheet.paste(s, (x0 + dx, y + (H - kho) // 2), s)
        d.text((900, y + 54), '↑ cỡ thật 32px', fill=(150, 160, 172), font=f)
    p = os.path.join(GOC, 'scripts', 'anh', '_xem-6-logo.png')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    sheet.save(p)
    print('\nAnh so sanh:', p)


if __name__ == '__main__':
    main()
