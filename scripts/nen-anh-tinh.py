# -*- coding: utf-8 -*-
"""
NÉN LẠI ẢNH TĨNH CỦA WEB CHO NHẸ MÁY ĐIỆN THOẠI
================================================
Đo thật trên khổ điện thoại (390px): trang chủ tải về **3,8 MB**, trong đó ảnh
chiếm 2,5 MB. Mà mấy tấm nặng nhất lại là ảnh minh hoạ cho THẺ TIN nhỏ xíu:
  · bd-07.png   523 KB  (632×479  — ảnh chụp mà lưu kiểu PNG, phí gấp mười lần)
  · bd-05.jpg   524 KB  (2560×1707 — to gấp đôi màn hình máy tính)
  · vuon-01.webp 455 KB (1000×1500)
Thẻ tin trên điện thoại rộng chừng 350px, nên ảnh 1000px là đã dư.

Script này nén lại:
  · thu về bề ngang tối đa TOI_DA_NGANG;
  · ghi ra WebP chất lượng CHAT_LUONG;
  · thư mục bai-dai thì đổi luôn PNG/JPG sang WebP (mã web tự quét thư mục nên
    đổi đuôi không sao); thư mục tin-mau thì GIỮ NGUYÊN TÊN vì 58 tin đăng
    trong database đang trỏ thẳng vào từng tên file.

⚠️ ẢNH GỐC ĐÃ ĐƯỢC SAO LƯU sang backup/anh-goc-2026-09-23/ TRƯỚC KHI CHẠY.
   Muốn lấy lại thì chép ngược từ đó. Đừng chạy script này lên thư mục chưa
   sao lưu.

Chạy:  python scripts/nen-anh-tinh.py
"""
import os

from PIL import Image

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CONG = os.path.join(GOC, 'apps', 'frontend', 'public')

TOI_DA_NGANG = 1100
CHAT_LUONG = 74

# (thư mục, có được đổi đuôi sang .webp không)
VIEC = [
    ('tin-mau', False),   # database trỏ thẳng tên file → phải giữ nguyên tên
    ('bai-dai', True),    # mã web tự quét thư mục → đổi đuôi thoải mái
]


def nen(duong_dan, doi_duoi):
    kb_cu = os.path.getsize(duong_dan) // 1024
    im = Image.open(duong_dan)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') and 'transparency' in im.info
                    else 'RGB')
    if im.width > TOI_DA_NGANG:
        im = im.resize((TOI_DA_NGANG, round(im.height * TOI_DA_NGANG / im.width)),
                       Image.LANCZOS)
    ra = duong_dan
    if doi_duoi and not duong_dan.lower().endswith('.webp'):
        ra = os.path.splitext(duong_dan)[0] + '.webp'
    im.save(ra, 'WEBP', quality=CHAT_LUONG, method=6)
    if ra != duong_dan:
        os.remove(duong_dan)
    kb_moi = os.path.getsize(ra) // 1024
    return kb_cu, kb_moi, os.path.basename(ra)


def main():
    tong_cu = tong_moi = 0
    for thu_muc, doi_duoi in VIEC:
        d = os.path.join(CONG, thu_muc)
        if not os.path.isdir(d):
            print('Khong thay thu muc', d)
            continue
        print('── %s ──' % thu_muc)
        for f in sorted(os.listdir(d)):
            if not f.lower().endswith(('.webp', '.jpg', '.jpeg', '.png')):
                continue
            cu, moi, ten = nen(os.path.join(d, f), doi_duoi)
            tong_cu += cu
            tong_moi += moi
            if cu - moi > 20:
                print('  %-22s %5d KB -> %4d KB' % (ten, cu, moi))
    print('')
    print('TONG: %d KB -> %d KB  (giam %d KB, %.0f%%)'
          % (tong_cu, tong_moi, tong_cu - tong_moi,
             (tong_cu - tong_moi) / max(tong_cu, 1) * 100))


if __name__ == '__main__':
    main()
