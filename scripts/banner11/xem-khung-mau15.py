# -*- coding: utf-8 -*-
"""
XEM TRƯỚC KHUNG NHÌN CỦA MẪU 15 — không cần mở trình duyệt
===========================================================
Banner mẫu 15 có khung nhìn `viewBox="250 566 700 226"`, tức là người xem chỉ
thấy MỘT DẢI NGANG của tấm ảnh nền. Chỉnh chỗ đặt ảnh (NEN_Y trong
ve-nha-mau15.py) mà cứ phải dựng lại web rồi mở trình duyệt thì rất lâu —
script này tính đúng phép chiếu đó rồi cắt sẵn cho xem.

Phép tính (đúng như trình duyệt làm, vì ảnh đặt preserveAspectRatio="none"
nhưng khung khai ĐÚNG tỉ lệ ảnh nên không méo):
    tỉ lệ thu   = NEN_W / rộng_ảnh
    hàng thấy   = (566 - NEN_Y)/tỉ lệ  …  (792 - NEN_Y)/tỉ lệ

Chạy:  python scripts/banner11/xem-khung-mau15.py [NEN_Y ...]
       → apps/frontend/public/logo-thu/_m15-khung.png
"""
import importlib.util as iu
import os
import sys

from PIL import Image, ImageDraw, ImageFont

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CONG = os.path.join(GOC, 'apps', 'frontend', 'public')
VB_Y, VB_CAO = 566.0, 226.0          # khung nhìn của mẫu 15

_spec = iu.spec_from_file_location(
    've_nha_mau15', os.path.join(GOC, 'scripts', 'banner11', 've-nha-mau15.py'))
_m = iu.module_from_spec(_spec); _spec.loader.exec_module(_m)


def _font(c, dam=False):
    for t in (('seguisb.ttf',) if dam else ('segoeui.ttf',)):
        try:
            return ImageFont.truetype('C:/Windows/Fonts/' + t, int(c))
        except Exception:
            pass
    return ImageFont.load_default()


def cat(nen, net, nen_y: float):
    ti = _m.NEN_W / nen.width
    y0 = max(0, int((VB_Y - nen_y) / ti))
    y1 = min(nen.height, int((VB_Y + VB_CAO - nen_y) / ti))
    a = nen.crop((0, y0, nen.width, y1)).convert('RGBA')
    b = net.crop((0, y0, net.width, y1))
    a.alpha_composite(b)
    return a, y0, y1


def main():
    nen = Image.open(os.path.join(CONG, 'banner11', 'm15-nen.webp')).convert('RGB')
    net = Image.open(os.path.join(CONG, 'banner11', 'm15-net.webp')).convert('RGBA')
    muc = [float(x) for x in sys.argv[1:]] or [_m.NEN_Y]
    W = 980
    anh = []
    for y in muc:
        im, y0, y1 = cat(nen, net, y)
        k = W / im.width
        anh.append((im.resize((W, max(1, int(im.height * k))), Image.LANCZOS),
                    'NEN_Y = %g   (thấy hàng %d…%d của ảnh gốc)' % (y, y0, y1)))
    H = sum(a.height + 26 for a, _ in anh) + 10
    sheet = Image.new('RGB', (W + 20, H), (246, 247, 249))
    d = ImageDraw.Draw(sheet)
    yy = 6
    for a, nhan in anh:
        d.text((12, yy), nhan, fill=(20, 30, 45), font=_font(14, True))
        sheet.paste(a, (10, yy + 20), a)
        yy += a.height + 26
    p = os.path.join(CONG, 'logo-thu', '_m15-khung.png')
    sheet.save(p)
    print('OK', p)


if __name__ == '__main__':
    main()
