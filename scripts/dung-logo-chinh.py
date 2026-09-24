# -*- coding: utf-8 -*-
"""
DỰNG LOGO CHÍNH THỨC CỦA WEB
=============================
Chủ dự án đã chọn trong trang xem thử (/logo-thu/xem.html):

    hình  = "Chữ C đặc khoét L" — NGUYÊN BẢN đã cắt, chỉ BÀO MỎNG NÉT 2,5%
            (chủ dự án chốt: giữ nguyên bản, chỉ làm cho nét mỏng lại.
             Bốn mức mỏng xem ở /logo-thu/so-mau6.png)
    phối  = "Sáng vừa"            (nền ô vuông navy SÁNG HƠN navy gốc một bậc,
             nét vàng cũng sáng lên theo — xem scripts/logo-sang-hon.py)
    khung = ô vuông navy bo góc, như logo web vẫn dùng

Script này lấy đúng hai thứ đó từ scripts/phoi-mau-logo.py rồi ghi ra hai tệp
logo chính của web:

    apps/frontend/public/logo-cam-lam.webp        (dùng trên nền tối)
    apps/frontend/public/logo-cam-lam-toi.webp    (dùng trên nền sáng)

⚠️ VÌ SAO NỀN Ô VUÔNG KHÔNG PHẢI NAVY GỐC #0A2540. Thanh menu trang chủ phủ
   một lớp đen mờ lên banner, ô vuông navy gốc nằm lên đó là tan vào nền —
   chủ dự án nhận xét "logo hơi tối so với nền". Nâng nền ô vuông lên
   #1A426E thì ô tách hẳn ra mà vẫn là navy. Bốn mức sáng xem ở
   /logo-thu/so-sang.png, đổi mức thì sửa PHOI bên dưới.

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
# Mã phối lấy ở scripts/phoi-mau-logo.py (co-dien · anh-kim · gold-ngoc ·
# gold-hong · gold-duong · gold-sang) HOẶC ở scripts/logo-sang-hon.py
# (sang0 · sang1 · sang2 · sang3 — bốn mức sáng của nền ô vuông).
PHOI = 'sang2'        # nền navy sáng vừa #1A426E, nét vàng sáng theo
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
    phoi = tim_phoi(bo, PHOI)
    anh = bo.dung_o(HINH, phoi, KHO, CHIEM)
    for ten in ('logo-cam-lam.webp', 'logo-cam-lam-toi.webp'):
        p = os.path.join(CONG, ten)
        anh.save(p, 'WEBP', quality=95, method=6)
        print('OK %-22s %dx%d  %d KB' % (ten, KHO, KHO, os.path.getsize(p) // 1024))
    print('\nNho chay tiep:  python scripts/dong-bo-logo.py')


if __name__ == '__main__':
    main()
