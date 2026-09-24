# -*- coding: utf-8 -*-
"""
SÁU MẪU LOGO × SÁU BẢN PHỐI MÀU — đặt trong KHUNG NAVY như logo thật
=====================================================================
Chủ dự án muốn nhìn từng mẫu **đặt trong ô vuông bo góc** giống logo đang chạy
để dễ hình dung, và muốn xem thêm vài bản phối màu **trẻ trung, hiện đại** chứ
không chỉ vàng đồng.

Nguyên liệu: mấy tấm mặt nạ đã cắt sẵn ở apps/frontend/public/logo-thu/
(do scripts/cat-logo-mau.py sinh ra từ ảnh mẫu chủ dự án gửi).

SÁU BẢN PHỐI — nền NAVY và nét VÀNG ĐỒNG giữ nguyên làm chủ đạo, chỉ đổi
điểm nhấn cho trẻ trung hơn:
  1. Cổ điển          — vàng đồng đặc, viền vàng mờ (đúng bộ màu đang dùng)
  2. Vàng ánh kim     — nét chuyển sắc trong dải vàng, như kim loại bắt sáng
  3. Gold + ngọc      — nét vàng, có bóng xanh ngọc lệch hai phía (kiểu TikTok)
  4. Gold + hồng      — nét vàng, bóng hồng san hô lệch hai phía
  5. Gold + xanh dương— nét vàng, viền trong của khung đổi sang xanh dương
  6. Gold sáng        — nét chuyển từ vàng kem xuống vàng đồng

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
#   kiểu tô: ('dac', màu) · ('chuyen', màu trên, màu dưới) · ('bong', màu nét, màu bóng)
#
# ⚠️ NAVY VÀ VÀNG ĐỒNG LÀ CHỦ ĐẠO — chủ dự án chốt rồi, đừng đổi nền hay đổi
#    màu nét chính. Muốn "trẻ trung" thì chỉ được thêm ĐIỂM NHẤN: bóng lệch
#    màu, viền trong đổi màu, hoặc cho nét chuyển sắc trong dải vàng. Bản
#    trước đổi hẳn sang nền đen / nền trắng / nét xanh lá — lạc khỏi nhận diện.
NEN = (10, 37, 64)          # navy của web
GOLD = (200, 161, 75)       # vàng đồng của web

PHOI = [
    ('co-dien', 'Cổ điển', NEN, GOLD + (115,), ('dac', GOLD)),
    ('anh-kim', 'Vàng ánh kim', NEN, (243, 217, 164, 120),
     ('chuyen', (245, 222, 170), (176, 124, 40))),
    ('gold-ngoc', 'Gold + ngọc', NEN, (37, 244, 238, 90), ('bong', GOLD, (37, 244, 238))),
    ('gold-hong', 'Gold + hồng', NEN, (255, 107, 107, 90), ('bong', GOLD, (255, 107, 107))),
    ('gold-duong', 'Gold + xanh dương', NEN, (59, 130, 246, 120), ('dac', GOLD)),
    ('gold-sang', 'Gold sáng', NEN, (255, 233, 176, 120),
     ('chuyen', (255, 236, 186), (200, 161, 75))),
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
    # ── kiểu 'bóng lệch': nét VÀNG nằm trên, một bóng màu nhấn lệch phía sau ──
    # Đây là cách mượn từ hiệu ứng chữ của TikTok nhưng GIỮ VÀNG LÀM CHÍNH:
    # màu nhấn chỉ ló ra một viền mỏng ở hai phía, đủ tạo cảm giác trẻ mà vẫn
    # là logo vàng trên nền navy.
    # ⚠️ Độ lệch tính theo CẠNH ẢNH (2%) chứ không ghi số cứng: ghi cứng thì ở
    #    bản 32 điểm ảnh hai lớp chồng khít lên nhau, mất sạch hiệu ứng.
    net, nhan = kieu[1], kieu[2]
    lech = max(2, int(w * 0.020))
    ra = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for dx, dy in ((-lech, -lech), (lech, lech)):
        lop = Image.new('RGBA', (w, h), tuple(nhan) + (0,))
        lop.putalpha(mn)
        tam = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        tam.paste(lop, (dx, dy), lop)
        ra.alpha_composite(tam)
    tren = Image.new('RGBA', (w, h), tuple(net) + (0,))
    tren.putalpha(mn)
    ra.alpha_composite(tren)
    return ra


def dung_o(ma: str, phoi, kho: int = KHO, chiem: float = CHIEM) -> Image.Image:
    _mp, _tp, nen, vien, kieu = phoi
    im = Image.new('RGBA', (kho, kho), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(kho * BO_GOC)
    d.rounded_rectangle([0, 0, kho - 1, kho - 1], radius=r, fill=tuple(nen) + (255,))
    d.rounded_rectangle([kho * 0.045, kho * 0.045, kho * 0.955, kho * 0.955],
                        radius=int(r * 0.82), outline=tuple(vien),
                        width=max(1, int(kho * 0.007)))
    mn = doc_mat_na(ma)
    c = int(kho * chiem)
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
