# -*- coding: utf-8 -*-
"""
DỰNG LOGO CHÍNH THỨC CỦA WEB
=============================
Chủ dự án đã chọn trong trang xem thử (/logo-thu/xem.html):

    hình  = "Khiên · chữ lồng CL"  (mẫu 4, cắt từ ảnh mẫu chủ dự án gửi)
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
HINH = 'mau4'         # Khiên · chữ lồng CL
PHOI = 'gold-sang'    # nét chuyển vàng kem → vàng đồng
KHO = 256


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
    anh = bo.dung_o(HINH, phoi, KHO)
    for ten in ('logo-cam-lam.webp', 'logo-cam-lam-toi.webp'):
        p = os.path.join(CONG, ten)
        anh.save(p, 'WEBP', quality=95, method=6)
        print('OK %-22s %dx%d  %d KB' % (ten, KHO, KHO, os.path.getsize(p) // 1024))
    print('\nNho chay tiep:  python scripts/dong-bo-logo.py')


if __name__ == '__main__':
    main()
