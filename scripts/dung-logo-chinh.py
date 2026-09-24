# -*- coding: utf-8 -*-
"""
DỰNG LOGO CHÍNH THỨC CỦA WEB
=============================
Chủ dự án đã chọn trong trang xem thử (/logo-thu/xem.html):

    hình  = "Chữ C đặc khoét L" — NGUYÊN BẢN đã cắt, chỉ BÀO MỎNG NÉT 2,5%
            (chủ dự án chốt: giữ nguyên bản, chỉ làm cho nét mỏng lại.
             Bốn mức mỏng xem ở /logo-thu/so-mau6.png)
    phối  = nền navy GỐC #0A2540 + **viền vàng gold sáng ôm mép ngoài**
             (xem scripts/logo-vien-gold.py)
    khung = ô vuông navy bo góc, như logo web vẫn dùng

Script này lấy đúng hai thứ đó từ scripts/phoi-mau-logo.py rồi ghi ra hai tệp
logo chính của web:

    apps/frontend/public/logo-cam-lam.webp        (dùng trên nền tối)
    apps/frontend/public/logo-cam-lam-toi.webp    (dùng trên nền sáng)

⚠️ VÌ SAO CÓ VIỀN VÀNG. Thanh menu trang chủ phủ một lớp đen mờ lên banner,
   ô vuông navy nằm lên đó là tan vào nền — chủ dự án nhận xét "logo hơi tối
   so với nền". Đã thử hai cách:
     · nâng sáng nền ô vuông (scripts/logo-sang-hon.py) — được, nhưng phải
       bịa ra một sắc navy mới không đúng màu thương hiệu;
     · **thêm viền vàng gold sáng ôm mép ngoài** — chủ dự án chốt cách này:
       nền giữ đúng navy #0A2540, mà viền vàng thì nổi trên MỌI nền.
   Ba độ dày viền xem ở /logo-thu/so-vien.png, đổi thì sửa VIEN_GOLD bên dưới.

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
# Bề dày viền vàng tính theo cạnh ô: 0.030 mảnh · 0.045 vừa · 0.062 dày.
# Đặt None thì không vẽ viền, khi đó mới dùng tới PHOI bên dưới.
# ⚠️ Đừng quá 0.07 — dày hơn nữa thì phần navy còn quá ít, nhìn như cái
#    khung ảnh chứ không ra logo.
VIEN_GOLD = 0.045
# Chỉ dùng khi VIEN_GOLD = None. Mã phối lấy ở scripts/phoi-mau-logo.py
# (co-dien · anh-kim · gold-ngoc · gold-hong · gold-duong · gold-sang) hoặc ở
# scripts/logo-sang-hon.py (sang0…sang3 — bốn mức sáng của nền ô vuông).
PHOI = 'gold-sang'
KHO = 256
# Hình chiếm bao nhiêu phần cạnh ô vuông (mặc định của bảng phối là 0,62).
# Nét đã bào mỏng nên để rộng hơn một chút cho cân khung.
CHIEM = 0.66


def nap(ten_tep: str, ten_goi: str):
    """Nạp một script bên cạnh (tên tệp có dấu gạch ngang nên phải nạp kiểu này)."""
    p = os.path.join(GOC, 'scripts', ten_tep)
    spec = importlib.util.spec_from_file_location(ten_goi, p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def tim_phoi(bo, ma: str):
    """Tìm bản phối theo mã, ở cả bảng phối màu lẫn bảng bốn mức sáng."""
    for p in bo.PHOI:
        if p[0] == ma:
            return p
    for p in nap('logo-sang-hon.py', 'logo_sang_hon').MUC:
        if p[0] == ma:
            return p
    raise SystemExit('Khong co ban phoi ten "%s"' % ma)


def main():
    bo = nap('phoi-mau-logo.py', 'phoi_mau_logo')
    if VIEN_GOLD:
        anh = nap('logo-vien-gold.py', 'logo_vien_gold').dung(
            bo, HINH, VIEN_GOLD, KHO, CHIEM)
    else:
        anh = bo.dung_o(HINH, tim_phoi(bo, PHOI), KHO, CHIEM)
    for ten in ('logo-cam-lam.webp', 'logo-cam-lam-toi.webp'):
        p = os.path.join(CONG, ten)
        anh.save(p, 'WEBP', quality=95, method=6)
        print('OK %-22s %dx%d  %d KB' % (ten, KHO, KHO, os.path.getsize(p) // 1024))
    print('\nNho chay tiep:  python scripts/dong-bo-logo.py')


if __name__ == '__main__':
    main()
