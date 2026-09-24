# -*- coding: utf-8 -*-
"""
THỬ BA CÁCH BỐ TRÍ TRANG TRÍ NGÀY LỄ — có tính cả DÒNG CHỮ bên cạnh
====================================================================
Chủ dự án: "bạn thiết kế lại phần trang trí, tính toán phần chữ Cam Lâm Land
/ Nhà đất & quy hoạch nữa".

VÌ SAO PHẢI TÍNH LẠI. Ô bọc logo nay chỉ rộng đúng bằng Ô VUÔNG (34px) để
khoảng cách logo–chữ ngày lễ bằng ngày thường. Tấm ảnh logo lễ thì rộng gấp
1,51 lần, nên phần trang trí TRÀN THẲNG VÀO chỗ chữ:

    |← ô vuông 34px →|← khe 10px →|  C a m   L â m   L a n d
    |────── trang trí cũ trải dài tới đây ──────|

Khe hở chỉ 10px, không đủ chỗ cho bất cứ hình gì. Nên chỉ còn ba đường:

  A. GÓC TRÊN-PHẢI Ô VUÔNG — trang trí thu nhỏ, dán vào góc ô vuông và chờm
     nhẹ ra ngoài. Không đụng chữ, nhưng che mất một góc ô vuông.
  B. TRÊN ĐẦU DÒNG CHỮ — trang trí nằm bên phải, nâng lên cao hơn nét chữ
     hoa, thả vào khoảng trống phía trên chữ. Không che gì cả.
  C. CHỜM NHẸ VÀO CHỮ — giữ nguyên chỗ cũ nhưng thu nhỏ và kéo sát ô vuông,
     chấp nhận chờm lên chữ một ít (chữ vẫn vẽ đè lên trên nên đọc được).

⚠️ ẢNH NÀY CHỈ ĐỂ DUYỆT, không đụng gì vào bộ logo đang chạy.

Chạy:  python scripts/thu-bo-cuc-le.py
       → apps/frontend/public/logo-thu/so-bo-cuc-le.png
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CONG = os.path.join(GOC, 'apps', 'frontend', 'public')

CAO = 34          # cỡ thật của ô vuông trên thanh menu
KHE = 10          # khoảng cách logo ↔ chữ (gap-2.5 của Tailwind)
PHONG = 6         # vẽ ở cỡ gấp 6 rồi thu lại cho nét


def _font(co, dam=False):
    for t in (('seguisb.ttf', 'segoeuib.ttf') if dam else ('segoeui.ttf',)):
        try:
            return ImageFont.truetype('C:/Windows/Fonts/' + t, int(co))
        except Exception:
            pass
    return ImageFont.load_default()


def tach_trang_tri(ma: str):
    """Lấy phần trang trí và CẮT SÁT viền.

    ⚠️ PHẢI GHÉP CẢ LỚP LÁ CỜ. Mấy dịp có cờ (2/9, 3/2, 30/4, Điện Biên) có
       mặt cờ nằm ở tệp riêng <mã>-co.webp để ngoài web còn cho nó bay trong
       gió. Xem thử mà quên ghép thì chỉ thấy mỗi CÁI CÁN CỜ trơ trọi —
       tưởng vẽ thiếu.
    """
    im = Image.open(os.path.join(CONG, 'logo-le', ma + '-tt.webp')).convert('RGBA')
    pc = os.path.join(CONG, 'logo-le', ma + '-co.webp')
    if os.path.exists(pc):
        im.alpha_composite(Image.open(pc).convert('RGBA'))
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def dung(ma: str, kieu: str) -> Image.Image:
    """Vẽ nguyên một cụm 'logo + chữ' ở cỡ THẬT rồi phóng to lên để xem."""
    o = CAO * PHONG
    khe = KHE * PHONG
    # Bề ngang đúng bằng chỗ chữ chiếm thật, không chừa thừa — chừa thừa thì
    # khi xếp bốn dịp cạnh nhau mỗi ô bé tí, không soi được chi tiết.
    W, H = o + khe + 158 * PHONG, o + 14 * PHONG
    im = Image.new('RGBA', (W, H), (10, 37, 64, 255))

    nen = Image.open(os.path.join(CONG, 'logo-le', ma + '-nen.webp')).convert('RGBA')
    # -nen là tấm 435×288, ô vuông nằm bên trái 288×288
    nen = nen.crop((0, 0, 288, 288)).resize((o, o), Image.LANCZOS)
    y0 = (H - o) // 2
    im.alpha_composite(nen, (0, y0))

    tt = tach_trang_tri(ma)
    if kieu == 'A':        # góc trên-phải ô vuông, chờm ra ngoài
        c = int(o * 0.52)
        w = max(1, round(c * tt.width / tt.height))
        tt = tt.resize((w, c), Image.LANCZOS)
        im.alpha_composite(tt, (o - int(o * 0.30), y0 - int(o * 0.06)))
    elif kieu == 'B':      # nằm trên đầu dòng chữ
        c = int(o * 0.42)
        w = max(1, round(c * tt.width / tt.height))
        tt = tt.resize((w, c), Image.LANCZOS)
        im.alpha_composite(tt, (o + khe, y0 - int(o * 0.10)))
    else:                  # C — chờm nhẹ vào chữ
        c = int(o * 0.62)
        w = max(1, round(c * tt.width / tt.height))
        tt = tt.resize((w, c), Image.LANCZOS)
        im.alpha_composite(tt, (o + khe // 2, y0 + int(o * 0.04)))

    d = ImageDraw.Draw(im)
    x = o + khe
    f1, f2 = _font(18 * PHONG, dam=True), _font(10 * PHONG)
    d.text((x, y0 + 1 * PHONG), 'Cam Lâm ', font=f1, fill=(255, 255, 255))
    w1 = d.textlength('Cam Lâm ', font=f1)
    d.text((x + w1, y0 + 1 * PHONG), 'Land', font=f1, fill=(200, 161, 75))
    d.text((x, y0 + 22 * PHONG), 'Nhà đất & quy hoạch', font=f2, fill=(190, 200, 214))
    return im


def main():
    ra = os.path.join(CONG, 'logo-thu')
    DIP = [('tet', 'Tết Nguyên đán'), ('quoc-khanh', 'Quốc khánh 2/9'),
           ('trung-thu', 'Trung thu'), ('noel', 'Giáng sinh')]
    KIEU = [('A', 'A · Dán góc trên-phải ô vuông'),
            ('B', 'B · Nằm trên đầu dòng chữ'),
            ('C', 'C · Chờm nhẹ vào chữ (như hiện nay, thu nhỏ)')]
    # Xem ở cỡ GẤP 2,4 LẦN cỡ thật: cỡ thật thì trang trí chỉ vài điểm ảnh,
    # không phân biệt nổi ba kiểu bố trí khác nhau chỗ nào.
    XEM = 2.4
    mau = dung('tet', 'A')
    w, h = int(mau.width / PHONG * XEM), int(mau.height / PHONG * XEM)
    HANG, COT = h + 30, w + 22
    sheet = Image.new('RGB', (24 + COT * len(DIP), 24 + HANG * len(KIEU) + 10), (246, 247, 249))
    d = ImageDraw.Draw(sheet)
    ft, fn = _font(15, True), _font(12)
    for i, (k, tenk) in enumerate(KIEU):
        y = 24 + i * HANG
        d.text((14, y - 15), tenk, fill=(20, 30, 45), font=ft)
        for j, (ma, tend) in enumerate(DIP):
            x = 14 + j * COT
            im = dung(ma, k).resize((w, h), Image.LANCZOS)
            sheet.paste(im, (x, y), im)
            d.text((x, y + h + 2), tend, fill=(130, 140, 152), font=fn)
    p = os.path.join(ra, 'so-bo-cuc-le.png')
    sheet.save(p)
    print('OK', p)


if __name__ == '__main__':
    main()
