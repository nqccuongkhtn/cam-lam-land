# -*- coding: utf-8 -*-
"""
ĐỔI LOGO MỘT CHỖ — CẢ WEB TỰ THEO
==================================
Chạy MỘT lệnh này là mọi chỗ có logo trên web được dựng lại từ cùng một tấm
ảnh gốc, không phải đi sửa từng nơi:

    python scripts/dong-bo-logo.py                      (dựng lại từ logo hiện có)
    python scripts/dong-bo-logo.py duong-dan-anh.png    (đổi hẳn sang logo mới)

NÓ LÀM NHỮNG GÌ
  1. (nếu có ảnh gốc) chạy scripts/dung-logo.py → hai tệp logo chính:
       public/logo-cam-lam.webp       nét sáng, dùng trên nền tối
       public/logo-cam-lam-toi.webp   nét navy,  dùng trên nền sáng
  2. bộ icon cài đặt ứng dụng (PWA) + icon iPhone:
       public/icons/icon-192.png · icon-512.png · icon-512-maskable.png · apple-180.png
  3. 17 ảnh màn hình chờ khi mở ứng dụng trên iPhone/iPad: public/splash/*.png
  4. bộ logo NGÀY LỄ (cành mai Tết, cờ Tổ quốc, mũ Noel…): public/logo-le/*.webp

VÌ SAO GOM VỀ MỘT LỆNH
Logo nằm rải ở hơn hai chục chỗ: thanh menu, icon ứng dụng, màn hình chờ, dấu
mờ nung lên ảnh tin đăng, phiếu trích lục, hợp đồng, trang bảo trì… Trước đây
mỗi chỗ một tệp/một đoạn mã riêng, đổi logo là phải nhớ đủ hai chục chỗ — chắc
chắn sót, và sót thì web có hai logo khác nhau cùng lúc.
Nay mọi thứ ĐỀU SINH RA TỪ public/logo-cam-lam.webp:
  · những chỗ hiện ảnh thì trỏ thẳng vào tệp đó (không vẽ lại bằng mã nữa);
  · những chỗ cần ảnh riêng (icon, màn hình chờ, logo lễ) thì script này dựng.

⚠️ CHẠY LẠI SAU MỖI LẦN ĐỔI LOGO. Quên chạy thì thanh menu đã là logo mới mà
   icon ứng dụng với màn hình chờ vẫn logo cũ.
⚠️ DỰNG XONG PHẢI BUILD LẠI FRONTEND. Bản chạy thật đóng gói cả thư mục
   public vào ảnh Docker, chép tệp vào thôi thì ngoài web vẫn thấy tệp cũ:
       docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend
       docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
⚠️ Web là PWA nên trình duyệt còn giữ ảnh cũ — xem thử thì Ctrl+Shift+R.
"""
import os
import runpy
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CONG = os.path.join(GOC, 'apps', 'frontend', 'public')
LOGO_SANG = os.path.join(CONG, 'logo-cam-lam.webp')       # nét sáng (nền tối)
LOGO_TOI = os.path.join(CONG, 'logo-cam-lam-toi.webp')    # nét navy (nền sáng)

NAVY = (10, 37, 64)
VANG = (200, 161, 75)
CHU_PHU = (255, 255, 255)

# Đúng 17 khổ màn hình chờ mà layout.tsx đang khai bằng thẻ
# <link rel="apple-touch-startup-image">. Thêm/bớt ở đây thì sửa cả bên đó.
SPLASH = [
    ('universal', 1290, 2796),
    ('iphone-750x1334', 750, 1334), ('iphone-828x1792', 828, 1792),
    ('iphone-1125x2436', 1125, 2436), ('iphone-1170x2532', 1170, 2532),
    ('iphone-1179x2556', 1179, 2556), ('iphone-1206x2622', 1206, 2622),
    ('iphone-1242x2688', 1242, 2688), ('iphone-1284x2778', 1284, 2778),
    ('iphone-1290x2796', 1290, 2796), ('iphone-1320x2868', 1320, 2868),
    ('ipad-1536x2048', 1536, 2048), ('ipad-1620x2160', 1620, 2160),
    ('ipad-1640x2360', 1640, 2360), ('ipad-1668x2224', 1668, 2224),
    ('ipad-1668x2388', 1668, 2388), ('ipad-2048x2732', 2048, 2732),
]

TEN = 'Cam Lâm Land'
PHU = 'Nhà đất & Bản đồ quy hoạch Cam Lâm, Khánh Hòa'


def _font(co, dam=True):
    for ten in (('segoeuib.ttf', 'arialbd.ttf') if dam else ('segoeui.ttf', 'arial.ttf')):
        try:
            return ImageFont.truetype('C:/Windows/Fonts/' + ten, co)
        except Exception:
            pass
    return ImageFont.load_default()


def _dat_giua(nen, anh, tam_x, tam_y, cao):
    """Dán logo vào giữa một điểm, thu theo chiều cao cho trước."""
    rong = round(cao * anh.width / anh.height)
    s = anh.resize((rong, cao), Image.LANCZOS)
    nen.paste(s, (round(tam_x - rong / 2), round(tam_y - cao / 2)), s)


def lam_icon(logo):
    """Bốn tệp icon: ô vuông bo góc nền navy, logo vàng kem ở giữa.

    ⚠️ BẢN 'maskable' PHẢI KHÁC. Android cắt icon maskable theo hình của máy
       (tròn, giọt nước, vuông bo…) và chỉ chắc chắn giữ lại VÒNG TRÒN GIỮA
       chiếm 80% cạnh. Nên bản này: nền phủ KÍN (không bo góc, không viền, vì
       viền sẽ bị cắt mất một phần trông rất lỗi) và logo nhỏ lại còn 46% cạnh.
    """
    ra = os.path.join(CONG, 'icons')
    os.makedirs(ra, exist_ok=True)
    viec = [('icon-192.png', 192, False), ('icon-512.png', 512, False),
            ('apple-180.png', 180, False), ('icon-512-maskable.png', 512, True)]
    for ten, kho, mask in viec:
        im = Image.new('RGBA', (kho, kho), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        if mask:
            d.rectangle([0, 0, kho, kho], fill=NAVY + (255,))
            _dat_giua(im, logo, kho / 2, kho / 2, round(kho * 0.30))
        else:
            r = round(kho * 0.22)
            d.rounded_rectangle([0, 0, kho - 1, kho - 1], radius=r, fill=NAVY + (255,))
            d.rounded_rectangle([kho * 0.045, kho * 0.045, kho * 0.955, kho * 0.955],
                                radius=r * 0.82, outline=VANG + (120,),
                                width=max(1, round(kho * 0.006)))
            _dat_giua(im, logo, kho / 2, kho / 2, round(kho * 0.40))
        im.save(os.path.join(ra, ten))
        print('  icon %-24s %dx%d' % (ten, kho, kho))


def lam_splash(logo):
    """17 ảnh màn hình chờ: nền navy, ô bo góc chứa logo, tên + mô tả bên dưới.

    ⚠️ MỌI CỠ ĐỀU TÍNH THEO BỀ NGANG ẢNH, đừng ghi số cứng: bộ này có cả
       iPhone 750px lẫn iPad 2048px, ghi số cứng thì chữ trên iPad bé như con
       kiến còn trên iPhone thì tràn ra ngoài.
    ⚠️ Khối logo + chữ đặt hơi CAO HƠN GIỮA (42% chiều cao) vì phần dưới màn
       hình iPhone bị thanh cử chỉ che, đặt đúng giữa nhìn thành lệch xuống.
    """
    ra = os.path.join(CONG, 'splash')
    os.makedirs(ra, exist_ok=True)
    for ten, w, h in SPLASH:
        im = Image.new('RGB', (w, h), NAVY)
        d = ImageDraw.Draw(im)
        tam_y = round(h * 0.42)
        o = round(w * 0.30)                      # cạnh ô bo góc quanh logo
        d.rounded_rectangle([w / 2 - o / 2, tam_y - o / 2, w / 2 + o / 2, tam_y + o / 2],
                            radius=o * 0.26, outline=VANG,
                            width=max(2, round(w * 0.004)))
        _dat_giua(im, logo, w / 2, tam_y, round(o * 0.52))

        f1 = _font(round(w * 0.072))
        f2 = _font(round(w * 0.030), dam=False)
        y = tam_y + o * 0.62 + w * 0.03
        d.text((w / 2, y), TEN, font=f1, fill=VANG, anchor='ma')
        # mô tả dài → tự xuống dòng cho vừa 78% bề ngang
        toi_da = w * 0.78
        dong, cur = [], ''
        for tu in PHU.split():
            thu = (cur + ' ' + tu).strip()
            if d.textlength(thu, font=f2) > toi_da and cur:
                dong.append(cur)
                cur = tu
            else:
                cur = thu
        dong.append(cur)
        y += w * 0.095
        for t in dong:
            d.text((w / 2, y), t, font=f2, fill=CHU_PHU, anchor='ma')
            y += w * 0.042
        im.save(os.path.join(ra, ten + '.png'))
    print('  splash: %d anh' % len(SPLASH))


def main():
    # 1. Ảnh gốc mới (nếu có) → dựng lại hai tệp logo chính
    if len(sys.argv) > 1:
        print('1. Dung lai logo chinh tu', sys.argv[1])
        sys.argv = [os.path.join(GOC, 'scripts', 'dung-logo.py'), sys.argv[1]]
        runpy.run_path(sys.argv[0], run_name='__main__')
    else:
        print('1. Dung logo chinh dang co (khong truyen anh goc)')
    for p in (LOGO_SANG, LOGO_TOI):
        if not os.path.exists(p):
            raise SystemExit('Thieu %s — chay: python scripts/dung-logo.py <anh-goc.png>' % p)

    logo = Image.open(LOGO_SANG).convert('RGBA')   # bản nét sáng, hợp nền navy
    print('2. Icon cai dat ung dung')
    lam_icon(logo)
    print('3. Anh man hinh cho iPhone/iPad')
    lam_splash(logo)
    print('4. Logo ngay le')
    r = subprocess.run([sys.executable, os.path.join(GOC, 'scripts', 'dung-logo-ngay-le.py')],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    print('  ' + (r.stdout or r.stderr or '').strip().replace('\n', '\n  '))

    print('\nXONG. Nho dung lai frontend roi khoi dong lai nginx:')
    print('  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend')
    print('  docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx')


if __name__ == '__main__':
    main()
