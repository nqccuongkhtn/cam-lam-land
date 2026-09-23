# -*- coding: utf-8 -*-
"""
DỰNG NGUYÊN LIỆU CHO MẪU BANNER 19 — "TỪ ẢNH THẬT ĐẾN BẢN ĐỒ QUY HOẠCH"
========================================================================
Mẫu 19 kể đúng việc web mình làm: nhìn từ xa là ảnh thật, lau qua thì hiện bản
đồ quy hoạch, rồi hiện ranh từng thửa đất, cuối cùng phóng dần vào một thửa.

Script này dựng cả BA lớp trong CÙNG MỘT KHUNG TOẠ ĐỘ, nên chồng lên nhau là
khít tuyệt đối:

  1. public/banner11/m19-vetinh.webp    — ảnh thật nhìn từ trên cao (vệ tinh)
  2. public/banner11/m19-quyhoach.webp  — bản đồ quy hoạch QĐ205 của chính web
  3. public/banner11/m19-ranh-thua.webp — ranh thửa thật từ bảng `dia_chinh`

Chạy:  python scripts/banner11/dung-anh-mau19.py

⚠️ BÀI HỌC ĐÃ TRẢ GIÁ — ĐỌC KỸ TRƯỚC KHI SỬA:
   Có một dạo lớp quy hoạch dùng tấm `qh-cam-lam-rong.webp` (đẹp hơn, lấy từ bản
   quy hoạch 1/2000). Nhưng tấm đó là CHỖ KHÁC — khu trung tâm Cam Đức — trong
   khi ảnh thật và ranh thửa là vùng Bãi Dài. Chủ dự án nhìn phát ra ngay:
   "không khớp cả bản đồ địa chính". Ba lớp của mẫu này BẮT BUỘC phải do chính
   script này dựng ra cùng một lượt. Muốn đổi vùng thì đổi TAM_LON/TAM_LAT rồi
   chạy lại, đừng bao giờ ghép tay một tấm ở đâu đó vào.

NGUỒN ẢNH VỆ TINH — CHỖ NÀY QUAN TRỌNG:
  Dùng **Sentinel-2 cloudless của EOX** (ảnh vệ tinh châu Âu, giấy phép mở
  CC BY 4.0 — dùng thoải mái, chỉ cần ghi nguồn).
  ⚠️ KHÔNG dùng ảnh vệ tinh Google. Trang bản đồ của web xem trực tiếp ảnh Google
     (có ghi nguồn) thì đúng luật, nhưng CẮT ảnh Google nướng vào một tấm banner
     quảng cáo là dùng sai phép. Đừng đổi sang Google cho "nét hơn".
  Ảnh Sentinel-2 hơi mềm vì mỗi điểm ảnh là 10m ngoài thực địa. Không sao: trong
  mẫu này ảnh vệ tinh chỉ là cảnh NHÌN TỪ XA, lau qua là bản đồ quy hoạch và
  ranh thửa che lên hết.

RANH THỬA lấy từ bảng `dia_chinh` của chính mình (733.249 thửa toàn tỉnh, dựng
từ dữ liệu địa chính) — dữ liệu của dự án, không vướng bản quyền của ai.
"""
import json
import math
import os
import subprocess

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA_ANH = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')

Z = 16                      # mức phóng để lấy ô bản đồ
RONG, CAO = 2560, 827       # khung tính toán
RA_RONG, RA_CAO = 1920, 620  # khổ ghi ra (thu nhỏ không làm đổi vùng đất)
TAM_LON, TAM_LAT = 109.1815, 12.0985      # giữa vùng Cam Hải Đông – Bãi Dài
VE_TINH = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'


def diem_anh(lon, lat, z):
    """Đổi kinh/vĩ độ sang toạ độ điểm ảnh toàn cầu (Web Mercator, ô 256px)."""
    n = 2 ** z * 256
    la = math.radians(lat)
    return ((lon + 180) / 360 * n,
            (1 - math.log(math.tan(la) + 1 / math.cos(la)) / math.pi) / 2 * n)


def main():
    try:
        from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
    except ImportError:
        raise SystemExit('Can thu vien Pillow: pip install pillow')

    cx, cy = diem_anh(TAM_LON, TAM_LAT, Z)
    x0, y0 = cx - RONG / 2, cy - CAO / 2          # góc trên bên trái của khung
    tx0, ty0 = int(x0 // 256), int(y0 // 256)
    tx1, ty1 = int((x0 + RONG) // 256), int((y0 + CAO) // 256)
    print('Khung: %d×%d diem anh o muc phong %d — o tu (%d,%d) den (%d,%d)'
          % (RONG, CAO, Z, tx0, ty0, tx1, ty1))

    def thu_nho(im):
        return im.resize((RA_RONG, RA_CAO), Image.LANCZOS)

    # ── 1. Ảnh vệ tinh ───────────────────────────────────────────────────────
    ve = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), (12, 30, 50))
    thieu = 0
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            u = VE_TINH.format(z=Z, x=tx, y=ty)
            f = os.path.join(RA_ANH, '_tam-%d-%d-%d.jpg' % (Z, tx, ty))
            if not os.path.exists(f):
                r = subprocess.run(['curl', '-sS', '--max-time', '60', '-o', f, u],
                                   capture_output=True)
                if r.returncode != 0:
                    thieu += 1
                    continue
            try:
                ve.paste(Image.open(f).convert('RGB'), ((tx - tx0) * 256, (ty - ty0) * 256))
            except Exception:
                thieu += 1
    if thieu:
        print('  thieu %d o anh ve tinh' % thieu)
    ve = ve.crop((int(x0 - tx0 * 256), int(y0 - ty0 * 256),
                  int(x0 - tx0 * 256) + RONG, int(y0 - ty0 * 256) + CAO))

    vt = thu_nho(ve)
    # ảnh vệ tinh 10m/điểm ảnh, phóng lên thì bệt — kéo màu và nét cho ra dáng
    # "ảnh chụp từ trên cao" chứ không thành một mảng xanh lờ nhờ
    vt = ImageEnhance.Color(vt).enhance(1.25)
    vt = ImageEnhance.Contrast(vt).enhance(1.12)
    vt = vt.filter(ImageFilter.UnsharpMask(radius=3, percent=90, threshold=2))
    p1 = os.path.join(RA_ANH, 'm19-vetinh.webp')
    vt.save(p1, 'WEBP', quality=80, method=6)
    print('  OK %s  %d KB' % (os.path.basename(p1), os.path.getsize(p1) // 1024))

    # ── 2. Bản đồ quy hoạch (lớp QĐ205 của chính web) ────────────────────────
    # Ghi ra ảnh ĐỤC: ảnh vệ tinh làm nhạt hẳn đi rồi phủ nét quy hoạch lên trên.
    # Như vậy lúc lau qua, mắt thấy rõ "ảnh thật → bản đồ" chứ không phải chỉ
    # thấy thêm vài nét vẽ.
    qh = Image.new('RGBA', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), (0, 0, 0, 0))
    co = 0
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            f = os.path.join(GOC, 'apps', 'frontend', 'public', 'tiles', 'qd205v11',
                             str(Z), str(tx), '%d.png' % ty)
            if os.path.exists(f):
                qh.alpha_composite(Image.open(f).convert('RGBA'),
                                   ((tx - tx0) * 256, (ty - ty0) * 256))
                co += 1
    qh = qh.crop((int(x0 - tx0 * 256), int(y0 - ty0 * 256),
                  int(x0 - tx0 * 256) + RONG, int(y0 - ty0 * 256) + CAO))

    nen = thu_nho(ve)
    nen = ImageEnhance.Color(nen).enhance(0.18)
    nen = ImageEnhance.Brightness(nen).enhance(1.55)     # nhạt như giấy in bản đồ
    nen = Image.blend(nen, Image.new('RGB', nen.size, (255, 255, 255)), 0.45)
    ban_do = nen.convert('RGBA')
    ban_do.alpha_composite(thu_nho(qh))
    p2 = os.path.join(RA_ANH, 'm19-quyhoach.webp')
    ban_do.convert('RGB').save(p2, 'WEBP', quality=84, method=6)
    print('  OK %s  %d KB  (ghep %d o quy hoach)'
          % (os.path.basename(p2), os.path.getsize(p2) // 1024, co))

    for f in os.listdir(RA_ANH):
        if f.startswith('_tam-'):
            os.remove(os.path.join(RA_ANH, f))

    # ── 3. Ranh thửa thật, đổi sang đường vẽ SVG ─────────────────────────────
    lon0 = x0 / (2 ** Z * 256) * 360 - 180
    lon1 = (x0 + RONG) / (2 ** Z * 256) * 360 - 180

    def lat_tu_y(y):
        n = 2 ** Z * 256
        return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))

    lat0, lat1 = lat_tu_y(y0), lat_tu_y(y0 + CAO)
    print('  Khung toa do: %.5f,%.5f -> %.5f,%.5f' % (lon0, lat1, lon1, lat0))

    sql = ("SELECT so_to, so_thua, round(dien_tich::numeric,1), coalesce(mdsd,''), "
           "ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.000012), 6) "
           "FROM dia_chinh "
           "WHERE geom && ST_MakeEnvelope(%f,%f,%f,%f,4326) AND dien_tich > 120 "
           "LIMIT 1200;" % (lon0, lat1, lon1, lat0))
    r = subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam',
                        '-d', 'camlam_gis', '-tAF', '\t', '-c', sql],
                       cwd=GOC, capture_output=True, text=True, encoding='utf-8')
    dong = [d for d in (r.stdout or '').strip().split('\n') if d.strip()]
    print('  Lay duoc %d thua trong khung' % len(dong))
    if not dong:
        print('  ⚠ khong lay duoc thua nao — database chua chay?')
        return

    def sang_diem_anh(lon, lat):
        px, py = diem_anh(lon, lat, Z)
        return (px - x0) * RA_RONG / RONG, (py - y0) * RA_CAO / CAO

    diem_vung, to_nhat, lon_nhat = [], None, 0
    for d in dong:
        p = d.split('\t')
        if len(p) < 5:
            continue
        so_to, so_thua, dt, mdsd, gj = p[0], p[1], p[2], p[3], p[4]
        try:
            hinh = json.loads(gj)
        except Exception:
            continue
        vong = (hinh['coordinates'] if hinh['type'] == 'Polygon'
                else [c for m in hinh['coordinates'] for c in m])
        for v in vong[:1]:                       # chỉ lấy vòng ngoài
            xs = [sang_diem_anh(lo, la) for lo, la in v]
            if len(xs) < 4:
                continue
            diem_vung.append([(a, b) for a, b in xs])
            try:
                if float(dt) > lon_nhat and 300 < float(dt) < 3000:
                    lon_nhat = float(dt)
                    d_svg = ''.join(('M' if i == 0 else 'L') + '%.1f %.1f' % (a, b)
                                    for i, (a, b) in enumerate(xs)) + 'Z'
                    to_nhat = {'to': so_to, 'thua': so_thua, 'dt': dt, 'mdsd': mdsd, 'd': d_svg,
                               'x': sum(a for a, _ in xs) / len(xs),
                               'y': sum(b for _, b in xs) / len(xs)}
            except ValueError:
                pass

    # Vẽ ranh thửa thành MỘT LỚP ẢNH TRONG SUỐT.
    # ⚠️ Đừng nhét cả nghìn đường vẽ thẳng vào mã trang: nặng cả trăm KB, mà
    #    trang chủ ai vào cũng phải tải. Vẽ ra ảnh thì nhẹ hơn nhiều.
    lop = Image.new('RGBA', (RA_RONG, RA_CAO), (0, 0, 0, 0))
    but = ImageDraw.Draw(lop)
    for d in diem_vung:
        if len(d) >= 4:
            but.line(d + [d[0]], fill=(120, 53, 15, 255), width=2)
    p3 = os.path.join(RA_ANH, 'm19-ranh-thua.webp')
    lop.save(p3, 'WEBP', quality=88, method=6, lossless=False)
    print('  OK %s  %d KB  (%d thua)'
          % (os.path.basename(p3), os.path.getsize(p3) // 1024, len(diem_vung)))

    if to_nhat:
        print('')
        print('  THUA DE PHONG VAO: Thua %s · To %s · %s m2 · %s'
              % (to_nhat['thua'], to_nhat['to'], to_nhat['dt'], to_nhat['mdsd'] or 'chua ro'))
        print('  Tam thua trong anh: %.0f,%.0f = %.2f%% , %.2f%%'
              % (to_nhat['x'], to_nhat['y'],
                 to_nhat['x'] / RA_RONG * 100, to_nhat['y'] / RA_CAO * 100))
        print('  Duong ve cua thua (he toa do 1000x323 cua ban thiet ke):')
        k = 1000.0 / RA_RONG
        print('  ' + ''.join(('M' if i == 0 else 'L') + '%.1f %.1f' % (a * k, 40 + b * 323.0 / RA_CAO)
                             for i, (a, b) in enumerate([])) or '  (xem duoi)')
        print('  ' + to_nhat['d'])


if __name__ == '__main__':
    main()
