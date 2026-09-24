# -*- coding: utf-8 -*-
"""
VẼ LẠI MẪU "CHỮ C ĐẶC KHOÉT L" CHO ĐẸP HƠN
===========================================
Chủ dự án chốt hình này + phối "Gold sáng", nhưng muốn **thiết kế lại cho đẹp
hơn**. Bản đang dùng là hình CẮT từ ảnh mẫu, nên còn dính mấy khuyết điểm của
ảnh gốc: mép hơi rỗ, khe giữa chữ C và chữ L chỗ dày chỗ mỏng, tỉ lệ lệch nhẹ.

Script này dựng hai phương án để chủ dự án so:

  A · LÀM SẠCH   — giữ nguyên dáng đã cắt (đúng cái chủ dự án ưng), chỉ làm
                   mượt mép, nong đều khe C–L và căn lại cho cân trong khung.
  B · VẼ LẠI     — dựng lại hoàn toàn bằng hình học: vành tròn đều tăm tắp,
                   khe rộng đều, chữ L bo góc. Nét sắc tuyệt đối ở mọi cỡ.

⚠️ VÌ SAO LÀM CẢ HAI. Bản cắt giữ đúng "hồn" của mẫu chủ dự án chọn nhưng
   không bao giờ sạch bằng hình dựng; bản dựng thì sạch nhưng có thể lệch
   chút so với mẫu gốc. Phải nhìn cạnh nhau mới quyết được.

⚠️ MỌI THỨ VẼ Ở CỠ GẤP 6 RỒI MỚI THU LẠI. Vẽ thẳng ở cỡ thật thì vành tròn
   răng cưa ngay.

Chạy:  python scripts/ve-lai-mau6.py
       → apps/frontend/public/logo-thu/mau6a.webp  (làm sạch)
       → apps/frontend/public/logo-thu/mau6b.webp  (vẽ lại)
       → apps/frontend/public/logo-thu/so-mau6.png (ảnh so sánh)
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-thu')

KHO = 512          # cạnh tệp mặt nạ xuất ra
PHONG = 4

NAVY = (10, 37, 64)
GOLD_TREN = (255, 236, 186)     # vàng kem (phối "Gold sáng")
GOLD_DUOI = (200, 161, 75)      # vàng đồng


# ── A · LÀM SẠCH BẢN ĐÃ CẮT ────────────────────────────────────────────────
def lam_sach() -> Image.Image:
    """Mượt mép và nong đều khe C–L của bản cắt từ ảnh mẫu.

    ⚠️ KHE GIỮA CHỮ C VÀ CHỮ L LÀ CHỖ QUYẾT ĐỊNH. Ở ảnh gốc khe này chỗ dày
       chỗ mỏng; thu về 34 điểm ảnh thì chỗ mỏng dính liền, chữ L biến mất.
       Cách nong khe: làm MỎNG nét đi một chút (phép co ảnh) rồi bù lại độ dày
       bằng cách làm mượt — khe rộng thêm đều khắp mà nét không gầy đi.
    """
    mn = Image.open(os.path.join(RA, 'mau6.webp')).convert('RGBA').getchannel('A')
    n = KHO * 2
    mn = mn.resize((n, n), Image.LANCZOS)
    # co nét lại ~1,5% cạnh để khe rộng đều
    mn = mn.filter(ImageFilter.MinFilter(int(n * 0.012) // 2 * 2 + 1))
    mn = mn.filter(ImageFilter.GaussianBlur(n * 0.004))
    a = np.asarray(mn).astype(np.float32) / 255.0
    a = np.clip((a - 0.45) / 0.16, 0, 1)
    mn = Image.fromarray((a * 255).astype(np.uint8), 'L')
    bb = mn.getbbox()
    if bb:
        mn = mn.crop(bb)
    o = Image.new('L', (KHO, KHO), 0)
    c = int(KHO * 0.96)
    r = max(1, round(c * mn.width / mn.height))
    if r > c:
        r, c = c, max(1, round(c * mn.height / mn.width))
    o.paste(mn.resize((r, c), Image.LANCZOS), ((KHO - r) // 2, (KHO - c) // 2))
    return o


# ── B · VẼ LẠI BẰNG HÌNH HỌC ───────────────────────────────────────────────
def ve_lai() -> Image.Image:
    """Dựng lại chữ C đặc khoét chữ L bằng hình tròn và hình chữ nhật.

    Cấu tạo (toạ độ theo hệ 1000×1000, tâm 500,500):
      · vành C  = hình tròn đặc R=460, khoét lòng r=232, khoét thêm một MIỆNG
        mở bên phải (hình chữ nhật từ tâm chạy sang phải, cao 0,52 đường kính);
      · chữ L   = một cột đứng + một chân ngang, đặt trong lòng chữ C;
      · khe     = nong chữ L ra 34 đơn vị rồi khoét, sau đó vẽ chữ L đặc vào
        giữa chỗ vừa khoét — nhờ vậy khe rộng ĐỀU TUYỆT ĐỐI quanh chữ L.

    ⚠️ KHE PHẢI ≥ 3% ĐƯỜNG KÍNH. Hẹp hơn thì ở cỡ 34 điểm ảnh khe khép lại,
       chữ C và chữ L dính thành một cục.
    """
    n = KHO * PHONG
    k = n / 1000.0
    mn = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(mn)

    cx = cy = 500 * k
    R, r_in = 460 * k, 232 * k

    # vành chữ C
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
    d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=0)
    # miệng mở bên phải
    mieng = 262 * k
    d.rectangle([cx, cy - mieng, cx + R + 10 * k, cy + mieng], fill=0)
    # bo tròn hai đầu vành cho mềm
    for dy in (-1, 1):
        y = cy + dy * (r_in + (R - r_in) / 2)
        rr = (R - r_in) / 2
        d.ellipse([cx - rr, y - rr, cx + rr, y + rr], fill=255)

    # chữ L: cột đứng + chân ngang, đặt lệch trái trong lòng chữ C
    lx, ly = 372 * k, 214 * k          # góc trên trái của cột
    day = 132 * k                      # bề dày nét chữ L
    chan_y = 604 * k                   # mép trên của chân ngang
    chan_x = 806 * k                   # mép phải của chân ngang
    khe = 38 * k                       # khe hở quanh chữ L

    def chu_l(no, mau):
        d.rounded_rectangle([lx - no, ly - no, lx + day + no, chan_y + day + no],
                            radius=(day / 2 + no), fill=mau)
        d.rounded_rectangle([lx - no, chan_y - no, chan_x + no, chan_y + day + no],
                            radius=(day / 2 + no), fill=mau)

    chu_l(khe, 0)       # khoét chỗ trống quanh chữ L
    chu_l(0, 255)       # rồi vẽ chữ L đặc vào giữa

    mn = mn.resize((KHO, KHO), Image.LANCZOS)
    bb = mn.getbbox()
    if bb:
        mn = mn.crop(bb)
    o = Image.new('L', (KHO, KHO), 0)
    c = int(KHO * 0.96)
    rw = max(1, round(c * mn.width / mn.height))
    o.paste(mn.resize((rw, c), Image.LANCZOS), ((KHO - rw) // 2, (KHO - c) // 2))
    return o


# ── Dựng ô vuông navy có nét vàng chuyển sắc ───────────────────────────────
def dung_o(mn: Image.Image, kho: int = 256, chiem: float = 0.68) -> Image.Image:
    im = Image.new('RGBA', (kho, kho), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(kho * 0.273)
    d.rounded_rectangle([0, 0, kho - 1, kho - 1], radius=r, fill=NAVY + (255,))
    d.rounded_rectangle([kho * 0.045, kho * 0.045, kho * 0.955, kho * 0.955],
                        radius=int(r * 0.82), outline=(255, 233, 176, 120),
                        width=max(1, int(kho * 0.007)))
    c = int(kho * chiem)
    m = mn.resize((c, c), Image.LANCZOS)
    tren = np.array(GOLD_TREN, np.float32)
    duoi = np.array(GOLD_DUOI, np.float32)
    t = (np.arange(c, dtype=np.float32) / max(1, c - 1))[:, None, None]
    rgb = tren[None, None, :] * (1 - t) + duoi[None, None, :] * t
    rgb = np.repeat(rgb, c, axis=1)
    net = Image.fromarray(np.dstack([rgb.astype(np.uint8), np.asarray(m)]), 'RGBA')
    im.alpha_composite(net, ((kho - c) // 2, (kho - c) // 2))
    return im


def main():
    bo = {'mau6a': lam_sach(), 'mau6b': ve_lai()}
    for ten, mn in bo.items():
        im = Image.new('RGBA', mn.size, GOLD_DUOI + (0,))
        im.putalpha(mn)
        im.save(os.path.join(RA, ten + '.webp'), 'WEBP', quality=95, method=6)
        print('OK %s' % ten)

    try:
        f = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 22)
    except Exception:
        f = ImageFont.load_default()
    H, W = 150, 860
    hang = [('mau6', 'Bản đang dùng (cắt thẳng)'),
            ('mau6a', 'A · Làm sạch bản cắt'),
            ('mau6b', 'B · Vẽ lại bằng hình học')]
    sheet = Image.new('RGB', (W, H * len(hang)), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for i, (ten, nhan) in enumerate(hang):
        y = i * H
        d.rectangle([300, y, 600, y + H - 2], fill=NAVY)
        d.line([(0, y + H - 1), (W, y + H - 1)], fill=(230, 235, 240))
        d.text((16, y + 62), nhan, fill=(20, 30, 45), font=f)
        mn = (Image.open(os.path.join(RA, 'mau6.webp')).convert('RGBA').getchannel('A')
              if ten == 'mau6' else bo[ten])
        im = dung_o(mn, 256, 0.62 if ten == 'mau6' else 0.68)
        for x0 in (330, 640):
            for kho, dx in ((96, 0), (34, 116)):
                s = im.resize((kho, kho), Image.LANCZOS)
                sheet.paste(s, (x0 + dx, y + (H - kho) // 2), s)
    p = os.path.join(RA, 'so-mau6.png')
    sheet.save(p)
    print('Anh so sanh:', p)


if __name__ == '__main__':
    main()
