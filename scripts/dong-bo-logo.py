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
  5. nhúng logo vào hai trang tĩnh: public/offline.html và nginx/maintenance.html

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
    """Bốn tệp icon.

    ⚠️ LOGO GIỜ ĐÃ LÀ MỘT Ô VUÔNG NAVY BO GÓC rồi, nên KHÔNG đặt nó lên một ô
       vuông navy nữa — làm thế thành hai lớp khung lồng nhau, nhìn rất dở.
       Icon thường = chính tấm logo phóng to hết cỡ.
    ⚠️ Riêng bản 'maskable': Android cắt icon theo hình của máy (tròn, giọt
       nước…) và chỉ chắc chắn giữ lại vòng tròn giữa chiếm 80% cạnh. Nên bản
       này phải đổ nền navy KÍN cả ô rồi đặt logo nhỏ lại ở giữa, nếu không
       góc bo của logo bị cắt mất một phần trông như lỗi.
    """
    ra = os.path.join(CONG, 'icons')
    os.makedirs(ra, exist_ok=True)
    for ten, kho, mask in (('icon-192.png', 192, False), ('icon-512.png', 512, False),
                           ('apple-180.png', 180, False), ('icon-512-maskable.png', 512, True)):
        im = Image.new('RGBA', (kho, kho), (0, 0, 0, 0))
        if mask:
            ImageDraw.Draw(im).rectangle([0, 0, kho, kho], fill=NAVY + (255,))
            _dat_giua(im, logo, kho / 2, kho / 2, round(kho * 0.62))
        else:
            s2 = logo.resize((kho, kho), Image.LANCZOS)
            im.alpha_composite(s2)
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
        # ⚠️ Không vẽ thêm khung bo góc nữa — logo tự đã là một ô vuông bo góc.
        o = round(w * 0.30)
        _dat_giua(im, logo, w / 2, tam_y, o)

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


def don_logo_cu(logo):
    """Ghi đè hai tệp logo cũ còn sót lại trong public/.

    logo-gon.webp / logo-gon-toi.webp là bản "rút gọn" của LOGO NGÔI NHÀ đời
    trước (do scripts/dung-logo.py sinh ra). Nay không còn chỗ nào trong mã
    trỏ tới chúng, nhưng để nguyên thì trong kho vẫn còn hình logo cũ — lần
    sau ai mở ra dùng lại là web có hai logo khác nhau cùng lúc.
    Nên ghi đè bằng logo hiện hành, giữ tên tệp để đường dẫn cũ (nếu còn nằm
    trong bộ nhớ đệm trình duyệt của ai đó) cũng trả về logo đúng.
    """
    for ten in ('logo-gon.webp', 'logo-gon-toi.webp'):
        p = os.path.join(CONG, ten)
        logo.save(p, 'WEBP', lossless=True, quality=100, method=6)
        print('  ghi de logo cu %-20s (%d KB)' % (ten, os.path.getsize(p) // 1024))



def nhung_trang_tinh(logo):
    """Nhúng thẳng logo (dạng base64) vào trang bảo trì và trang mất mạng.

    ⚠️ HAI TRANG NÀY KHÔNG ĐƯỢC TRỎ VÀO ĐƯỜNG DẪN ẢNH. Chúng hiện ra đúng lúc
       web đang hỏng: trang bảo trì thì container frontend đã tắt (nginx không
       lấy được tệp nào từ đó), trang mất mạng thì máy người dùng đang offline.
       Trỏ /logo-cam-lam.webp là lúc cần nhất lại hỏng ảnh.
       Nên nhúng thẳng nội dung ảnh vào trang — nặng thêm ~30 KB, đổi lại
       chắc chắn hiện.
    """
    import base64
    import io as _io
    nho = logo.copy()
    nho.thumbnail((160, 160), Image.LANCZOS)      # 25px trên màn hình → 160 là dư nét
    b = _io.BytesIO()
    nho.save(b, 'WEBP', quality=88, method=6)
    uri = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
    for p in (os.path.join(CONG, 'offline.html'),
              os.path.join(GOC, 'nginx', 'maintenance.html')):
        if not os.path.exists(p):
            print('  bo qua (khong thay):', p)
            continue
        s = open(p, encoding='utf-8').read()
        i = s.find('<!-- LOGO-BAT-DAU')
        j = s.find('<!-- LOGO-KET-THUC -->')
        if i < 0 or j < 0:
            print('  bo qua (khong thay dau nhan LOGO-BAT-DAU):', os.path.basename(p))
            continue
        k = s.index('<img class="lg"', i)
        e = s.index('>', k) + 1
        moi = '<img class="lg" alt="" aria-hidden="true" src="%s">' % uri
        s = s[:k] + moi + s[e:]
        open(p, 'w', encoding='utf-8', newline='\n').write(s)
        print('  nhung logo vao %-18s (%d KB)' % (os.path.basename(p), len(uri) // 1024))

    # ── Phiếu trích lục quy hoạch ──
    # Phiếu in ra giấy, hay in ở nơi mạng chập chờn. Nhúng luôn tấm logo vào
    # mã để nếu tệp ảnh không tải kịp thì phiếu vẫn có logo ĐÚNG, thay vì rơi
    # về một hình vẽ tay đã lỗi thời (đã vấp: web đổi logo mà phiếu vẫn in
    # ngôi nhà cũ suốt một thời gian dài).
    pq = os.path.join(GOC, 'apps', 'frontend', 'src', 'lib', 'phieuQh.ts')
    if os.path.exists(pq):
        s = open(pq, encoding='utf-8').read()
        i = s.find('const LOGO_DUPHONG = ')
        if i < 0:
            print('  bo qua phieuQh.ts (khong thay LOGO_DUPHONG)')
        else:
            e = s.index(chr(10), i)
            s = s[:i] + "const LOGO_DUPHONG = '%s';" % uri + s[e:]
            open(pq, 'w', encoding='utf-8', newline=chr(10)).write(s)
            print('  nhung logo vao %-18s (%d KB)' % ('phieuQh.ts', len(uri) // 1024))


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
    print('4. Nhung logo vao trang bao tri / mat mang')
    don_logo_cu(logo)
    nhung_trang_tinh(logo)
    print('5. Logo ngay le')
    r = subprocess.run([sys.executable, os.path.join(GOC, 'scripts', 'dung-logo-ngay-le.py')],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    print('  ' + (r.stdout or r.stderr or '').strip().replace('\n', '\n  '))

    print('\nXONG. Nho dung lai frontend roi khoi dong lai nginx:')
    print('  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend')
    print('  docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx')


if __name__ == '__main__':
    main()
