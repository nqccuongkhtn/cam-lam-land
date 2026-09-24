# -*- coding: utf-8 -*-
"""
SÁU MẪU LOGO × SÁU BẢN PHỐI MÀU — đặt trong KHUNG NAVY như logo thật
=====================================================================
Chủ dự án muốn nhìn từng mẫu **đặt trong ô vuông bo góc** giống logo đang chạy
để dễ hình dung, và muốn xem thêm vài bản phối màu **trẻ trung, hiện đại** chứ
không chỉ vàng đồng.

Nguyên liệu: mấy tấm mặt nạ đã cắt sẵn ở apps/frontend/public/logo-thu/
(do scripts/cat-logo-mau.py sinh ra từ ảnh mẫu chủ dự án gửi).

SÁU BẢN PHỐI
  1. Cổ điển      — nền navy, nét vàng đồng (đúng bộ màu web đang dùng)
  2. Vàng cam     — nền navy, nét chuyển vàng sang cam, ấm hơn
  3. TikTok       — nền đen, nét trắng, có bóng xanh ngọc và hồng lệch nhau
  4. Biển xanh    — nền navy, nét chuyển xanh ngọc sang xanh dương
  5. Hoàng hôn    — nền trắng, nét chuyển hồng sang cam
  6. Chanh        — nền navy đậm, nét vàng chanh

⚠️ MỖI Ô ĐỀU KÈM CỠ THẬT 32 ĐIỂM ẢNH. Bản to thì phối màu nào cũng đẹp; chỉ
   ở cỡ thật mới thấy bản nào bị nhoè, bản nào nét vẫn tách bạch. Riêng kiểu
   TikTok (ba lớp lệch nhau) rất dễ thành một cục ở cỡ nhỏ — phải nhìn kỹ.

Chạy:  python scripts/phoi-mau-logo.py
       → scripts/anh/_xem-phoi-mau.png
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
NGUON = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-thu')
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-thu', 'phoi')

KHO = 256           # cạnh ô vuông logo
BO_GOC = 0.273      # bán kính bo góc / cạnh — lấy đúng tỉ lệ 12/44 của logo thật
CHIEM = 0.62        # hình logo chiếm bao nhiêu phần cạnh ô

MAU = [
    ('mau1', 'Vòng tròn · chữ C'),
    ('mau2', 'Trăng khuyết · chữ C'),
    ('mau3', 'Khung vuông · chữ C'),
    ('mau4', 'Khiên · chữ lồng CL'),
    ('mau5', 'Vòng tròn · C lồng L'),
    ('mau6', 'Chữ C đặc khoét L'),
]

# (mã, tên, màu nền, màu viền trong, kiểu tô nét)
#   kiểu tô: ('dac', màu) · ('chuyen', màu trên, màu dưới) · ('tiktok',)
PHOI = [
    ('co-dien', 'Cổ điển', (10, 37, 64), (200, 161, 75, 115), ('dac', (200, 161, 75))),
    ('vang-cam', 'Vàng cam', (10, 37, 64), (240, 170, 90, 110),
     ('chuyen', (250, 214, 130), (224, 138, 60))),
    ('tiktok', 'TikTok', (11, 11, 15), (255, 255, 255, 60), ('tiktok',)),
    ('bien-xanh', 'Biển xanh', (10, 37, 64), (94, 234, 212, 110),
     ('chuyen', (125, 240, 220), (59, 130, 246))),
    ('hoang-hon', 'Hoàng hôn', (250, 250, 250), (251, 113, 133, 90),
     ('chuyen', (251, 113, 133), (245, 158, 11))),
    ('chanh', 'Chanh', (7, 27, 47), (190, 242, 100, 110),
     ('chuyen', (217, 249, 157), (132, 204, 22))),
]


def _font(co):
    for ten in ('segoeui.ttf', 'arial.ttf'):
        try:
            return ImageFont.truetype('C:/Windows/Fonts/' + ten, int(co))
        except Exception:
            pass
    return ImageFont.load_default()


def doc_mat_na(ma: str) -> Image.Image:
    """Lấy lại MẶT NẠ của một mẫu từ tệp đã cắt (kênh trong suốt chính là nét)."""
    p = os.path.join(NGUON, ma + '.webp')
    return Image.open(p).convert('RGBA').getchannel('A')


def to_net(mn: Image.Image, kieu) -> Image.Image:
    """Tô màu cho nét theo kiểu phối."""
    w, h = mn.size
    if kieu[0] == 'dac':
        im = Image.new('RGBA', (w, h), tuple(kieu[1]) + (0,))
        im.putalpha(mn)
        return im
    if kieu[0] == 'chuyen':
        tren, duoi = np.array(kieu[1], np.float32), np.array(kieu[2], np.float32)
        t = (np.arange(h, dtype=np.float32) / max(1, h - 1))[:, None, None]
        rgb = tren[None, None, :] * (1 - t) + duoi[None, None, :] * t
        rgb = np.repeat(rgb, w, axis=1)
        im = Image.fromarray(np.dstack([rgb.astype(np.uint8),
                                        np.asarray(mn)]), 'RGBA')
        return im
    # ── kiểu TikTok: ba lớp lệch nhau, xanh ngọc và hồng nằm dưới, trắng trên ──
    # ⚠️ Độ lệch tính theo CẠNH ẢNH (2,2%) chứ không ghi số cứng: ghi cứng thì
    #    ở bản 32 điểm ảnh ba lớp chồng khít lên nhau, mất sạch hiệu ứng.
    lech = max(2, int(w * 0.022))
    ra = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for mau, dx, dy in (((37, 244, 238), -lech, -lech), ((254, 44, 85), lech, lech)):
        lop = Image.new('RGBA', (w, h), mau + (0,))
        lop.putalpha(mn)
        ra.alpha_composite(lop, (0, 0) if False else (0, 0))
        ra.alpha_composite(Image.new('RGBA', (w, h), (0, 0, 0, 0)))
        tam = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        tam.paste(lop, (dx, dy), lop)
        ra.alpha_composite(tam)
    trang = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    trang.putalpha(mn)
    ra.alpha_composite(trang)
    return ra


def dung_o(ma: str, phoi, kho: int = KHO) -> Image.Image:
    _mp, _tp, nen, vien, kieu = phoi
    im = Image.new('RGBA', (kho, kho), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(kho * BO_GOC)
    d.rounded_rectangle([0, 0, kho - 1, kho - 1], radius=r, fill=tuple(nen) + (255,))
    d.rounded_rectangle([kho * 0.045, kho * 0.045, kho * 0.955, kho * 0.955],
                        radius=int(r * 0.82), outline=tuple(vien),
                        width=max(1, int(kho * 0.007)))
    mn = doc_mat_na(ma)
    c = int(kho * CHIEM)
    mn = mn.resize((c, c), Image.LANCZOS)
    net = to_net(mn, kieu)
    im.alpha_composite(net, ((kho - c) // 2, (kho - c) // 2))
    return im


def main():
    os.makedirs(RA, exist_ok=True)
    f = _font(20)
    fn = _font(23)
    O, KE = 96, 32
    COT, HANG = 150, 132
    W = 190 + COT * len(PHOI)
    H = 42 + HANG * len(MAU)
    sheet = Image.new('RGB', (W, H), (255, 255, 255))
    d = ImageDraw.Draw(sheet)

    for j, p in enumerate(PHOI):
        d.text((190 + j * COT + COT // 2, 14), p[1], fill=(20, 30, 45), font=fn, anchor='ma')
    for i, (ma, ten) in enumerate(MAU):
        y = 42 + i * HANG
        d.text((16, y + HANG // 2 - 10), ten, fill=(20, 30, 45), font=f)
        d.line([(0, y + HANG - 1), (W, y + HANG - 1)], fill=(232, 236, 241))
        for j, p in enumerate(PHOI):
            im = dung_o(ma, p)
            x = 190 + j * COT + 10
            sheet.paste(im.resize((O, O), Image.LANCZOS), (x, y + 8),
                        im.resize((O, O), Image.LANCZOS))
            sheet.paste(im.resize((KE, KE), Image.LANCZOS), (x + O + 6, y + 8 + O - KE),
                        im.resize((KE, KE), Image.LANCZOS))
            im.save(os.path.join(RA, '%s-%s.webp' % (ma, p[0])), 'WEBP',
                    quality=95, method=6)

    p = os.path.join(GOC, 'scripts', 'anh', '_xem-phoi-mau.png')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    sheet.save(p)
    print('OK %d mau x %d ban phoi = %d tep' % (len(MAU), len(PHOI), len(MAU) * len(PHOI)))
    print('Anh so sanh:', p)


if __name__ == '__main__':
    main()
