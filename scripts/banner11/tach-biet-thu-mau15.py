# -*- coding: utf-8 -*-
"""
TÁCH CĂN BIỆT THỰ THẬT RA KHỎI ẢNH — MẪU BANNER 15
===================================================
Chủ dự án muốn mẫu 15 ("Hình dung ngôi nhà trên đất của bạn") đặt **ảnh thật**
của một căn biệt thự tân cổ điển lên lô đất, thay cho hình vẽ.

Script này cắt căn biệt thự ra khỏi tấm ảnh phối cảnh (bỏ cây cối, bãi cỏ, nhà
hàng xóm, mặt đường) thành một ảnh nền trong suốt:

  apps/frontend/public/banner11/m15-bietthu.webp

CÁCH LÀM: cắt theo ĐƯỜNG RANH của khu đất (hàng rào + mép mái), không cắt kiểu
hình chữ nhật — xem biến RANH và ghi chú trong main().

⚠️ ĐỔI ẢNH thì phải chỉnh lại KHUNG bên dưới và chạy lại script.

Chạy:  python scripts/banner11/tach-biet-thu-mau15.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')
ANH = os.path.join(RA, 'h3-villa-tan-co-dien.webp')





# Ranh khu đất, dò bằng mắt trên ảnh gốc 800×615 (đã kẻ lưới để soi).
# Đi theo HÀNG RÀO và mép mái, cố ý chừa ra:
#   · rặng cây và cột điện phía trên bên trái (ngoài khu đất);
#   · căn nhà hàng xóm bên phải (mái xám, bắt đầu từ x ≈ 645);
# và cố ý giữ lại: căn nhà, nhà để xe, sân lát đá, hàng rào, dải cỏ và mặt
# đường trước nhà (chủ dự án dặn "lấy được đường thì đưa vào luôn").
RANH = [
    (340, 58), (640, 55), (640, 300), (700, 332), (795, 392),
    (795, 612), (110, 612), (8, 470), (8, 262), (300, 250),
]
MEM = 7.0            # độ mềm của viền cắt (điểm ảnh)


def main():
    """Cắt khu đất theo đúng đường ranh, không cắt kiểu hình chữ nhật.

    ⚠️ ĐÃ ĐỔI CÁCH LÀM HAI LẦN:
       · lần 1 — mẹo "cây cỏ thì xanh lá": tách được riêng căn nhà nhưng XOÁ
         mất cả sân vườn, mà chủ dự án lại muốn có sân vườn;
       · lần 2 — cắt hình chữ nhật rồi làm mờ bốn mép: giữ được sân vườn nhưng
         lôi theo rặng cây, cột điện và căn nhà hàng xóm ở hai góc trên;
       · lần này — cắt theo ĐƯỜNG RANH khu đất (biến RANH ở trên), viền làm mềm
         để tấm ảnh chìm vào bãi cỏ của banner.
    """
    im = Image.open(ANH).convert('RGB')
    w, h = im.size

    mat_na = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mat_na).polygon(RANH, fill=255)
    mat_na = mat_na.filter(ImageFilter.GaussianBlur(MEM))

    out = Image.merge('RGBA', (*im.split(), mat_na))
    # cắt sát phần còn nhìn thấy cho file nhẹ
    khung = out.getbbox()
    out = out.crop(khung)
    p = os.path.join(RA, 'm15-bietthu.webp')
    out.save(p, 'WEBP', quality=90, method=6)
    print('Khung sau khi cat sat:', khung)
    print('OK %s  %d KB  %dx%d' % (os.path.basename(p), os.path.getsize(p) // 1024,
                                   out.width, out.height))
    print('TI LE ngang/doc = %.4f' % (out.width / out.height))

    thu = Image.new('RGB', out.size, (110, 150, 70))    # nền cỏ giống ảnh banner
    thu.paste(out, (0, 0), out)
    thu.save(os.path.join(RA, '_xem-m15-bietthu.png'))


if __name__ == '__main__':
    main()
