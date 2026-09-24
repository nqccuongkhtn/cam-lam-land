# -*- coding: utf-8 -*-
"""
CẮT CẢ LÔ ĐẤT RA KHỎI ẢNH + TỰ DÒ NÉT THÀNH BẢN VẼ 2D — MẪU BANNER 15
======================================================================
Chủ dự án chốt cách làm cho mẫu 15 ("Hình dung ngôi nhà trên đất của bạn"):

    cắt ảnh nhà ra  →  vẽ 2D lên đó  →  ghép ảnh thật vào thì KHỚP

Mấu chốt nằm ở chữ "khớp". Mấy lần trước tôi VẼ TAY căn nhà bằng hình khối
rồi đặt cạnh ảnh — hai thứ dựng từ hai nguồn khác nhau nên không bao giờ
trùng, chủ dự án xem là thấy ngay ("vẽ nhà vẫn chưa ok").
Nay bản vẽ 2D được MÁY DÒ RA TỪ CHÍNH TẤM ẢNH ĐÃ CẮT — cùng một gốc toạ độ,
cùng một tấm hình, nên khớp tuyệt đối, không còn chỗ cho sai lệch.

Ghi ra hai tệp CÙNG KHỔ NGUYÊN BẢN 1200×840, chồng khít lên nhau:
    banner11/m15-nen.webp  ẢNH NỀN của cả banner (nguyên tấm, không cắt)
    banner11/m15-net.webp  bản vẽ 2D: nét trắng trong lô đất, ngoài lô trong suốt

⚠️ VÌ SAO KHÔNG CẮT LÔ ĐẤT RA NỮA. Bản trước cắt lô rồi dán lên một tấm ảnh
   cánh đồng khác — chủ dự án xem xong hỏi thẳng "sao không lấy nền là ảnh đó
   luôn". Đúng: chính tấm ảnh này đã là một khung cảnh hoàn chỉnh, dán vào
   ảnh khác vừa mất công vừa lộ mép ghép.
   Nay ảnh gốc làm NỀN cả banner, bản vẽ 2D phủ đúng lên trên. Hai tệp cùng
   khổ nguyên bản nên đặt cùng một x/y/width/height là KHỚP TUYỆT ĐỐI, dù
   trình duyệt co giãn kiểu gì.

Banner chạy: nền hiện ra mờ và xám → bản vẽ 2D lộ dần từ trái sang như đang
vẽ → nền sáng và có màu trở lại, bản vẽ nhạt đi. Tức là "phác thảo trước,
thành nhà thật sau".

⚠️ ĐƯỜNG RANH ĐỌC TRÊN ẢNH GỐC 1200×840, bằng cách kẻ lưới 25 điểm ảnh rồi
   phóng to từng góc mà đọc. Đổi ảnh là phải đọc lại từ đầu.
⚠️ Ranh đi theo TƯỜNG RÀO TRẮNG, nhưng chỗ nào MÁI NHÀ CAO HƠN tường rào thì
   phải vòng lên ôm lấy mái — đi thẳng theo tường là cắt cụt mất nóc nhà.
⚠️ CỐ Ý BỎ RA NGOÀI: rặng cây quanh lô, mặt đường nhựa góc dưới phải, và
   phần nhà hàng xóm. Lấy vào là banner có cây cối lạ mọc giữa cánh đồng.

Chạy:  python scripts/banner11/tach-lo-dat-mau15.py
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')
ANH = os.path.join(GOC, 'scripts', 'banner11', 'anh-goc', 'm15-biet-thu-goc.png')

# ── ĐƯỜNG RANH CỦA LÔ ĐẤT ──────────────────────────────────────────────────
# Đi ngược chiều kim đồng hồ, bắt đầu từ góc tường rào phía sau bên trái.
RANH = [
    # ── tường rào phía sau, chạy lên bên phải ──
    (196, 226), (260, 206), (330, 183), (400, 159), (428, 150),
    # ── vòng LÊN ÔM LẤY MÁI NHÀ (mái cao hơn tường rào) ──
    (410, 114), (470, 76), (530, 48), (600, 27), (660, 48),
    (730, 92), (790, 132), (826, 162),
    # ── mép phải căn nhà rồi nhập lại vào tường rào ──
    (842, 214), (836, 292),
    # ── tường rào bên phải, chạy xuống ──
    (900, 332), (970, 378), (1040, 428), (1100, 470), (1128, 490),
    # ── góc phải rồi tới hàng cổng sắt ──
    (1118, 556), (1082, 598), (1010, 638), (930, 682), (868, 712),
    # ── cổng sắt + trụ, đi xuống mép dưới ảnh ──
    (806, 748), (742, 782), (688, 812), (664, 838),
    # ── mép dưới ảnh (lô đất còn chạy tiếp ra ngoài khung) ──
    (500, 838),
    # ── tường rào bên trái, chạy ngược lên ──
    (436, 744), (372, 676), (306, 604), (248, 540), (186, 470),
    (126, 400), (146, 330), (172, 268),
]

# Dải nhoè ở mép cắt (điểm ảnh). Mép quá sắc thì dán lên bãi cỏ nhìn như
# miếng dán; nhoè quá thì hàng rào trắng bị ăn mất.
NHOE = 2.2

# ── BẢN VẼ 2D ──────────────────────────────────────────────────────────────
# Dò nét bằng cách so sánh ảnh với chính nó đã làm mờ (unsharp) — cách này
# bắt được cả mép mái, mép tường, mép lối đi, tức là đúng những đường mà
# người vẽ tay sẽ vẽ.
# ⚠️ BA CON SỐ NÀY QUYẾT ĐỊNH BẢN VẼ ĐẸP HAY RỐI.
#    Để mờ ít (2.0) thì máy bắt cả HOA VĂN GẠCH LÁT SÂN và từng chiếc lá —
#    bản vẽ thành một mảng lấm tấm như nhiễu, không ra bản vẽ kiến trúc.
#    Làm mờ nhiều hơn thì chỉ những mép LỚN (mái, tường, lan can, hàng rào,
#    mép lối đi) mới còn chênh lệch đủ lớn — đúng những đường người vẽ tay
#    sẽ vẽ.
NET_MO = 5.0        # làm mờ bao nhiêu trước khi so sánh
NET_NGUONG = 26.0   # chênh lệch bao nhiêu thì tính là nét
NET_DAM = 1.15      # nhân thêm cho nét rõ


def mat_na_lo(kho) -> Image.Image:
    mn = Image.new('L', kho, 0)
    ImageDraw.Draw(mn).polygon(RANH, fill=255)
    return mn.filter(ImageFilter.GaussianBlur(NHOE))


def do_net(im: Image.Image) -> Image.Image:
    """Trả về mặt nạ nét (255 = có nét) dò từ chính tấm ảnh."""
    xam = np.asarray(im.convert('L')).astype(np.float32)
    mo = np.asarray(im.convert('L').filter(
        ImageFilter.GaussianBlur(NET_MO))).astype(np.float32)
    net = np.abs(xam - mo) * NET_DAM
    net = np.clip((net - NET_NGUONG) / 30.0, 0, 1)
    mn = Image.fromarray((net * 255).astype(np.uint8), 'L')
    # ⚠️ LỌC BỎ ĐỐM LẺ. Dù đã làm mờ nhiều, lá cây và sạn trên sân vẫn để lại
    #    những chấm một-hai điểm ảnh. Lọc trung vị xoá sạch chấm lẻ mà KHÔNG
    #    làm đứt nét dài — nét dài thì quanh nó chỗ nào cũng có nét nên trung
    #    vị vẫn ra sáng.
    return mn.filter(ImageFilter.MedianFilter(3))


def main():
    im = Image.open(ANH).convert('RGB')
    mn = mat_na_lo(im.size)

    that = im.convert('RGBA')
    that.putalpha(mn)

    net = do_net(im)
    # nét chỉ nằm trong lô đất
    net = Image.fromarray(
        (np.asarray(net).astype(np.float32) / 255.0
         * np.asarray(mn).astype(np.float32) / 255.0 * 255).astype(np.uint8), 'L')
    # ⚠️ VẼ THÊM ĐƯỜNG RANH LÔ ĐẤT. Máy dò nét chỉ bắt được những gì CÓ TRONG
    #    ẢNH; cái ranh giới lô thì nằm ở mép ảnh đã cắt nên không có nét nào.
    #    Thiếu nó thì bản vẽ nhìn như một mảng hình trôi nổi, không ra bản vẽ
    #    lô đất. Vẽ đè lên mặt nạ nét, cùng một toạ độ nên vẫn khớp tuyệt đối.
    d = ImageDraw.Draw(net)
    d.line(RANH + [RANH[0]], fill=255, width=4, joint='curve')
    ban_ve = Image.new('RGBA', im.size, (255, 255, 255, 0))
    ban_ve.putalpha(net)

    # ⚠️ KHÔNG CẮT THEO KHUNG BAO. Hai tệp phải giữ nguyên khổ 1200×840 của
    #    ảnh gốc thì mới đặt chồng lên nhau bằng cùng một toạ độ được.
    for ten, anh in (('m15-nen.webp', im.convert('RGB')), ('m15-net.webp', ban_ve)):
        p = os.path.join(RA, ten)
        anh.save(p, 'WEBP', quality=92, method=6)
        print('OK %-18s %dx%d  %d KB' % (ten, anh.width, anh.height,
                                         os.path.getsize(p) // 1024))

    # ── ảnh duyệt: nét · ảnh thật · chồng hai lớp ──
    H = 300
    k = H / im.height
    W = int(im.width * k)
    sheet = Image.new('RGB', (W * 3 + 40, H + 20), (24, 46, 30))
    for i, lop in enumerate((ban_ve, im.convert('RGBA'), None)):
        x = 10 + i * (W + 10)
        if lop is None:
            o = ban_ve.resize((W, H), Image.LANCZOS)
            sheet.paste(o, (x, 10), o)
            o2 = im.convert('RGBA').resize((W, H), Image.LANCZOS)
            o2.putalpha(o2.getchannel('A').point(lambda v: int(v * 0.78)))
            sheet.paste(o2, (x, 10), o2)
        else:
            o = lop.resize((W, H), Image.LANCZOS)
            sheet.paste(o, (x, 10), o)
    p = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-thu', '_m15-xem.png')
    sheet.save(p)
    print('Anh duyet:', p)


if __name__ == '__main__':
    main()
