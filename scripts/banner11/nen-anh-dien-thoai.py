# -*- coding: utf-8 -*-
"""
DỰNG BỘ ẢNH BANNER RIÊNG CHO ĐIỆN THOẠI
========================================
Ảnh của 19 mẫu banner được làm ở khổ rộng 1600–2560 điểm ảnh cho màn máy tính.
Điện thoại chỉ rộng 360–430 điểm ảnh (nhân đôi cho màn nét cao là ~860), nên
tải ảnh 2000 điểm ảnh về là phí đứt 3/4 dung lượng.

Script này dựng bộ ảnh thu nhỏ đặt ở `public/banner11/dt/` (dt = điện thoại),
giữ NGUYÊN TÊN FILE. Lúc chạy, Banner11.tsx chỉ việc đổi đường dẫn
`/banner11/...` thành `/banner11/dt/...` khi màn hình hẹp — xem hàm `lamNhe()`.

Đo thật trên khổ 390px: trang chủ 3,8 MB → 2,4 MB sau khi nén ảnh tin mẫu và
đặt lại thời gian giữ ảnh; bộ ảnh điện thoại này cắt thêm khoảng 300–400 KB nữa
cho mỗi mẫu banner có ảnh lớn.

⚠️ CHẠY LẠI MỖI KHI THÊM/ĐỔI ẢNH BANNER. Thiếu file trong `dt/` thì trên điện
   thoại chỗ đó mất ảnh (đường dẫn trỏ vào file không có).

Chạy:  python scripts/banner11/nen-anh-dien-thoai.py
"""
import os

from PIL import Image

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VAO = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')
RA = os.path.join(VAO, 'dt')

TOI_DA_NGANG = 900     # đủ nét cho màn điện thoại nét cao (430 × 2)
CHAT_LUONG = 70


def main():
    os.makedirs(RA, exist_ok=True)
    cu = moi = 0
    so = 0
    for f in sorted(os.listdir(VAO)):
        if not f.lower().endswith(('.webp', '.png', '.jpg', '.jpeg')):
            continue
        p = os.path.join(VAO, f)
        if os.path.isdir(p):
            continue
        # ⚠️ ẢNH MẶT NẠ (tên có "matna") CHÉP NGUYÊN, KHÔNG THU/NÉN. Mẫu 18 dùng
        #    nó để cắt toà nhà ra khỏi nền rồi cho "mọc" vượt khung; nén còn
        #    chất lượng 70 thì phần nền quanh toà nhà lệch màu với nền banner →
        #    lộ một mảng chữ nhật sáng ngay chỗ cắt (chủ dự án: "vẫn còn lỗi
        #    chỗ cắt"). Chỉ bản điện thoại bị, vì bản máy tính dùng ảnh gốc.
        if 'matna' in f:
            import shutil
            shutil.copyfile(p, os.path.join(RA, f))
            continue
        im = Image.open(p)
        # giữ nền trong suốt nếu ảnh có (mặt nạ toà nhà, máy bay cắt rời…)
        trong = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
        im = im.convert('RGBA' if trong else 'RGB')
        # ⚠️ ẢNH MẪU 19 (tên "m19-…") GIỮ TỚI 1920px, NÉN NHẸ TAY. Banner điện
        #    thoại cao ~212px mà ảnh này dẹt 3:1 → phải kéo giãn cho kín chiều
        #    cao, lại còn phóng 2,6 lần làm hiệu ứng "bay vào gần". Thu còn
        #    900px thì vỡ nét (chủ dự án: "ảnh bản đồ vệ tinh rất mờ").
        rong_max, chat = (1920, 82) if f.startswith('m19-') else (TOI_DA_NGANG, CHAT_LUONG)
        if im.width > rong_max:
            im = im.resize((rong_max, max(1, round(im.height * rong_max / im.width))),
                           Image.LANCZOS)
        ra = os.path.join(RA, os.path.splitext(f)[0] + '.webp')
        im.save(ra, 'WEBP', quality=chat, method=6)
        a, b = os.path.getsize(p) // 1024, os.path.getsize(ra) // 1024
        cu += a
        moi += b
        so += 1
        if a - b > 30:
            print('  %-30s %5d KB -> %4d KB' % (f, a, b))
    print('')
    print('%d anh: %d KB -> %d KB (giam %d KB, %.0f%%)'
          % (so, cu, moi, cu - moi, (cu - moi) / max(cu, 1) * 100))


if __name__ == '__main__':
    main()
