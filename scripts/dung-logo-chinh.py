# -*- coding: utf-8 -*-
"""
DỰNG LOGO CHÍNH THỨC CỦA WEB
=============================
Chủ dự án đã chọn trong trang xem thử (/logo-thu/xem.html):

    hình  = "Chữ C đặc khoét L" — NGUYÊN BẢN đã cắt, chỉ BÀO MỎNG NÉT 2,5%
            (chủ dự án chốt: giữ nguyên bản, chỉ làm cho nét mỏng lại.
             Bốn mức mỏng xem ở /logo-thu/so-mau6.png)
    phối  = "Gold sáng"           (nét chuyển từ vàng kem xuống vàng đồng)
    khung = ô vuông navy bo góc, như logo web vẫn dùng

Script này lấy đúng hai thứ đó từ scripts/phoi-mau-logo.py rồi ghi ra hai tệp
logo chính của web:

    apps/frontend/public/logo-cam-lam.webp        (dùng trên nền tối)
    apps/frontend/public/logo-cam-lam-toi.webp    (dùng trên nền sáng)

⚠️ HAI TỆP GIỐNG HỆT NHAU. Ô vuông navy tự mang nền nên đặt ở đâu cũng đọc
   được; vẫn ghi ra hai tên vì khắp nơi trong mã đang gọi theo hai tên đó.

⚠️ CHẠY XONG PHẢI CHẠY TIẾP scripts/dong-bo-logo.py — chính nó mới dựng lại
   icon cài ứng dụng, 17 ảnh màn hình chờ, logo ngày lễ và nhúng logo vào hai
   trang tĩnh. Chỉ chạy script này thôi thì thanh menu đổi logo mà icon điện
   thoại vẫn logo cũ.

Chạy:  python scripts/dung-logo-chinh.py
"""
import importlib.util
import os

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CONG = os.path.join(GOC, 'apps', 'frontend', 'public')

# ⚠️ ĐỔI LOGO THÌ CHỈ SỬA HAI DÒNG NÀY rồi chạy lại script, sau đó chạy
#    scripts/dong-bo-logo.py. Mã hình lấy trong scripts/phoi-mau-logo.py
#    (mau1…mau6), mã phối cũng ở đó (co-dien · anh-kim · gold-ngoc ·
#    gold-hong · gold-duong · gold-sang).
HINH = 'mau6m2'       # nguyên bản, bào mỏng 2,5% (scripts/ve-lai-mau6.py)
PHOI = 'gold-sang'    # nét chuyển vàng kem → vàng đồng
KHO = 256
# Hình chiếm bao nhiêu phần cạnh ô vuông (mặc định của bảng phối là 0,62).
# Nét đã bào mỏng nên để rộng hơn một chút cho cân khung.
CHIEM = 0.66


def nap_bo_phoi():
    """Nạp scripts/phoi-mau-logo.py (tên có dấu gạch ngang nên phải nạp kiểu này)."""
    p = os.path.join(GOC, 'scripts', 'phoi-mau-logo.py')
    spec = importlib.util.spec_from_file_location('phoi_mau_logo', p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    bo = nap_bo_phoi()
    phoi = next(p for p in bo.PHOI if p[0] == PHOI)
    anh = bo.dung_o(HINH, phoi, KHO, CHIEM)
    for ten in ('logo-cam-lam.webp', 'logo-cam-lam-toi.webp'):
        p = os.path.join(CONG, ten)
        anh.save(p, 'WEBP', quality=95, method=6)
        print('OK %-22s %dx%d  %d KB' % (ten, KHO, KHO, os.path.getsize(p) // 1024))
    print('\nNho chay tiep:  python scripts/dong-bo-logo.py')


if __name__ == '__main__':
    main()
