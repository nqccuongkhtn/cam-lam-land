# -*- coding: utf-8 -*-
"""
CẮT HÌNH LOGO RA KHỎI ẢNH CHỤP MÀN HÌNH design.com
===================================================
Chủ dự án đang làm logo trên design.com và chụp màn hình gửi sang. Mỗi tấm có
6 ô màu, ô đầu tiên (góc trên trái) là ô đang chọn. Trong mỗi ô: HÌNH LOGO ở
trên, hai dòng chữ "CAM LÂM LAND / SINCE 2026" ở dưới.

Chủ dự án dặn: **chỉ lấy hình, bỏ hai dòng chữ**.

⚠️ VÌ SAO PHẢI CẮT CHỨ KHÔNG VẼ LẠI. Bản đầu tôi vẽ lại bằng hình khối cho
   giống — chủ dự án xem xong nói "6 logo tôi gửi đẹp mà bạn làm xấu quá".
   Đúng: mấy mẫu kia là thiết kế vector, nét thanh mảnh và tỉ lệ đã chuốt;
   vẽ lại bằng mấy lệnh hình tròn hình chữ nhật thì không bao giờ bằng được.
   Cắt thẳng từ ảnh thì giữ nguyên dáng gốc.

⚠️ NHƯNG ẢNH CHỤP MÀN HÌNH CHỈ RỘNG 750 ĐIỂM ẢNH, hình logo trong đó chỉ
   khoảng 110 điểm ảnh. Phóng lên 256 là nhoè. Nên ở đây không phóng thẳng:
   dò lấy MẶT NẠ (chỗ nào là nét), làm trơn mặt nạ rồi mới phóng — cách này
   giữ được mép sắc. Muốn thật nét thì phải tải tệp gốc từ design.com về.

⚠️ CHỈ CẮT BA TẤM CHỤP design.com. Ba tấm còn lại (pngtree, shutterstock) là
   ảnh bán của bên khác, có tấm còn đóng dấu chìm giữa hình — không lấy.

Chạy:  python scripts/cat-logo-mau.py <anh1.png> <anh2.png> ...
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'logo-thu')

# Ô đầu tiên trong lưới 6 ô của ảnh chụp 750 điểm ảnh ngang.
# Cắt rộng xuống quá cả dòng chữ, rồi để hàm bo_chu() tự tìm chỗ cắt —
# ⚠️ vì ba tấm chụp ở ba thời điểm khác nhau nên lưới ô LỆCH NHAU vài chục
#    điểm ảnh; ghi cứng một mốc y thì có tấm cắt cụt hình, có tấm lấy cả chữ
#    (đã vấp: mẫu 3 lôi nguyên dòng "CAM LÂM LAND" vào logo).
# Khung của RIÊNG HÌNH LOGO trong ô đầu tiên, đo bằng cách kẻ lưới lên ảnh.
# ⚠️ Mỗi tấm chụp một khác nên phải ghi riêng từng khung — đã thử để máy tự dò
#    theo "dải trống giữa hình và chữ" nhưng trượt: ô đang chọn có VIỀN XANH
#    chạy quanh, máy tưởng viền là nét nên cắt ngay dưới viền, mất sạch hình.
O_HINH = {
    '124': (158, 543, 264, 638),     # vòng tròn mảnh, chữ C
    '125': (153, 538, 250, 650),     # vầng trăng khuyết ôm chữ C
    '126': (158, 524, 264, 626),     # khung vuông hở góc, chữ C
}
O_HINH.update({
    '127': (222, 196, 418, 452),     # ⚠️ toạ độ đọc TRÊN ẢNH GỐC 640×640, đừng
                                     #    đọc trên bản đã thu nhỏ để kẻ lưới —
                                     #    lần đầu đọc nhầm, cắt mất nửa khiên     # chữ lồng CL trong tấm khiên
    '128': (80, 76, 384, 384),       # vòng tròn C lồng chữ L
    '129': (330, 330, 1180, 1230),   # chữ C đặc khoét chữ L
})
O_MAC_DINH = (86, 522, 340, 640)

# Ngưỡng "lệch xa màu nền bao nhiêu thì tính là nét", cộng ba kênh màu.
# ⚠️ Ba tấm 127/128/129 có ĐÓNG DẤU CHÌM xám nhạt chạy ngang giữa hình. Để
#    ngưỡng thấp như mấy tấm kia thì dấu chìm cũng bị tính là nét, logo dính
#    nguyên chữ "shutterstock" mờ mờ. Nâng ngưỡng lên thì chỉ nét ĐEN ĐẬM mới
#    lọt, dấu chìm rơi hết.
NGUONG = {'127': 150.0, '128': 380.0, '129': 380.0}
NGUONG_MAC_DINH = 38.0
KHO = 320          # cạnh tệp xuất ra

NAVY = (10, 37, 64)
VANG = (200, 161, 75)


def lay_mat_na(im: Image.Image, nguong: float = 38.0) -> Image.Image:
    """Dò xem chỗ nào là NÉT LOGO, trả về mặt nạ xám (255 = nét).

    Nền của ô có thể rất sáng (ảnh 2) hoặc rất tối (ảnh 1, 3), nên không đặt
    ngưỡng cố định được: lấy màu nền là màu HAY GẶP NHẤT ở viền ô, rồi nét là
    những điểm ảnh LỆCH XA màu nền đó.
    """
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    vien = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3),
                           a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    nen = np.median(vien, axis=0)
    lech = np.abs(a - nen).sum(axis=2)
    # Chuẩn hoá rồi lấy dốc mềm: nét đậm ăn trọn, mép nét mờ dần cho khỏi răng cưa
    m = np.clip((lech - nguong) / max(20.0, nguong * 1.2), 0, 1)
    return Image.fromarray((m * 255).astype(np.uint8), 'L')


def bo_chu(mn: Image.Image) -> Image.Image:
    """Cắt bỏ phần CHỮ bên dưới hình logo.

    Trong ô luôn có một DẢI TRỐNG giữa hình và dòng chữ. Nên: đếm lượng nét
    trên từng hàng, tìm dải trống dài nhất, cắt ngay tại đó. Không phụ thuộc
    vào việc lưới ô nằm ở đâu.
    """
    a = np.asarray(mn).astype(np.float32) / 255.0
    # ⚠️ BỎ QUA HÀNG NÀO KÉO DÀI GẦN HẾT BỀ NGANG — đó là đường viền của ô
    #    (ô đang chọn có viền xanh), không phải nét logo. Không bỏ thì hàm này
    #    tưởng viền là hình rồi cắt ngay dưới viền, logo mất sạch.
    rong_net = (a > 0.25).sum(axis=1) / a.shape[1]
    hang = np.where(rong_net > 0.85, 0.0, a.sum(axis=1))
    co = hang > max(1e-6, hang.max()) * 0.03
    # bỏ qua phần trống ở trên cùng, tìm dải trống ĐẦU TIÊN đủ dài sau khi đã
    # gặp nét — đó là khoảng cách giữa hình và dòng chữ
    thay, dau = False, None
    for y, c in enumerate(co):
        if c:
            thay, dau = True, None
        elif thay:
            if dau is None:
                dau = y
            elif y - dau >= max(6, mn.height * 0.05):
                return mn.crop((0, 0, mn.width, dau))
    return mn


def lam_tron(mn: Image.Image, phong: int = 4) -> Image.Image:
    """Phóng mặt nạ lên rồi làm trơn — mép nét sắc lại thay vì nhoè khối.

    Phóng ảnh xong mới làm trơn thì các bậc thang của ảnh gốc bị san phẳng,
    còn hình tổng thể vẫn giữ nguyên.
    """
    lon = mn.resize((mn.width * phong, mn.height * phong), Image.LANCZOS)
    lon = lon.filter(ImageFilter.GaussianBlur(phong * 0.55))
    a = np.asarray(lon).astype(np.float32) / 255.0
    a = np.clip((a - 0.42) / 0.20, 0, 1)      # nén lại cho mép dứt khoát
    return Image.fromarray((a * 255).astype(np.uint8), 'L')


def to_mau(mn: Image.Image, mau) -> Image.Image:
    im = Image.new('RGBA', mn.size, tuple(mau) + (0,))
    im.putalpha(mn)
    return im


def main():
    if len(sys.argv) < 2:
        raise SystemExit('Cach dung: python scripts/cat-logo-mau.py <anh1.png> ...')
    os.makedirs(RA, exist_ok=True)
    ra = []
    for i, p in enumerate(sys.argv[1:], 1):
        ten_anh = os.path.splitext(os.path.basename(p))[0]
        im = Image.open(p).convert('RGB').crop(O_HINH.get(ten_anh, O_MAC_DINH))
        mn = lam_tron(lay_mat_na(im, NGUONG.get(ten_anh, NGUONG_MAC_DINH)))
        bb = mn.getbbox()
        if bb:
            mn = mn.crop(bb)
        # đặt vào ô vuông, chừa lề 8%
        cao = int(KHO * 0.84)
        rong = max(1, round(cao * mn.width / mn.height))
        if rong > int(KHO * 0.92):
            rong = int(KHO * 0.92)
            cao = max(1, round(rong * mn.height / mn.width))
        mn = mn.resize((rong, cao), Image.LANCZOS)
        o = Image.new('L', (KHO, KHO), 0)
        o.paste(mn, ((KHO - rong) // 2, (KHO - cao) // 2))
        ten = 'mau%d' % i
        to_mau(o, VANG).save(os.path.join(RA, ten + '.webp'), 'WEBP', quality=95, method=6)
        to_mau(o, NAVY).save(os.path.join(RA, ten + '-toi.webp'), 'WEBP', quality=95, method=6)
        ra.append((ten, o))
        print('OK %s  net cao %d diem anh trong anh goc' % (ten, bb[3] - bb[1] if bb else 0))

    # ── ảnh so sánh ──
    H, W = 140, 900
    sheet = Image.new('RGB', (W, H * len(ra)), (255, 255, 255))
    from PIL import ImageDraw, ImageFont
    try:
        f = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 21)
    except Exception:
        f = ImageFont.load_default()
    d = ImageDraw.Draw(sheet)
    for i, (ten, o) in enumerate(ra):
        y = i * H
        d.rectangle([200, y, 560, y + H - 2], fill=NAVY)
        d.line([(0, y + H - 1), (W, y + H - 1)], fill=(226, 232, 240))
        d.text((18, y + 58), 'Mẫu %d' % (i + 1), fill=(20, 30, 45), font=f)
        for mau, x0 in ((VANG, 230), (NAVY, 600)):
            im = to_mau(o, mau)
            for kho, dx in ((96, 0), (32, 140)):
                s = im.resize((kho, kho), Image.LANCZOS)
                sheet.paste(s, (x0 + dx, y + (H - kho) // 2), s)
        d.text((760, y + 58), '↑ cỡ thật', fill=(150, 160, 172), font=f)
    p = os.path.join(GOC, 'scripts', 'anh', '_xem-logo-cat.png')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    sheet.save(p)
    print('\nAnh so sanh:', p)


if __name__ == '__main__':
    main()
