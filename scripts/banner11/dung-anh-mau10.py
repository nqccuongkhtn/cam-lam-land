# -*- coding: utf-8 -*-
"""
DỰNG NGUYÊN LIỆU CHO MẪU BANNER 10 — "XEM RANH THỬA TRÊN BẢN ĐỒ QUY HOẠCH"
==========================================================================
Bản thiết kế gốc của mẫu 10 vẽ ranh thửa BẰNG TAY lên một tấm ảnh flycam đồng
lúa (ranh thửa là nét vẽ tay dò theo bờ ruộng trong ảnh). Chủ dự án muốn đổi:
  1. Nền phải là ẢNH BẢN ĐỒ QUY HOẠCH của chính web, không phải ảnh flycam;
  2. Thu nhỏ lại (nhìn rộng ra) để thấy được TRỌN VẸN từng thửa, chứ không bị
     cắt cụt ở mép banner như hiện nay.

Script này dựng đủ cả hai, và quan trọng nhất là **ranh thửa nay là RANH THẬT**
lấy từ bảng `dia_chinh`, nằm khít trên nền bản đồ vì cùng một khung toạ độ:

  · apps/frontend/public/banner11/m10-quyhoach.webp — ảnh nền (quy hoạch QĐ205
    chồng trên ảnh vệ tinh)
  · in ra màn hình: các thẻ SVG đã tính sẵn để dán vào bản thiết kế — nhóm ranh
    thửa, thửa được tô sáng, nhãn số thửa, thẻ thông tin, nét đo cạnh.

Chạy:  python scripts/banner11/dung-anh-mau10.py

VÌ SAO KHÔNG DÙNG ẢNH VỆ TINH GOOGLE: xem ghi chú dài trong dung-anh-mau19.py —
tóm lại web được phép XEM trực tiếp tile Google, nhưng CẮT ảnh Google nướng vào
một tấm banner quảng cáo là dùng sai phép. Nền vệ tinh ở đây là Sentinel-2
cloudless của EOX (CC BY 4.0), và nó cũng chỉ là lớp lót mờ bên dưới.
"""
import io
import json
import math
import os
import subprocess

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA_ANH = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')

Z = 17                      # mức phóng của tile quy hoạch
# ⚠️ ĐỪNG tăng lên z18: cùng bộ tile nhưng ở z18 các nét gạch chéo giãn ra rất
#    thưa, nhìn thành mấy đường kẻ rời rạc chứ không còn ra dáng bản đồ quy
#    hoạch. z17 là mức vừa đủ: vẫn thấy rõ mảng quy hoạch mà thửa không quá bé.
Z_VT = 16                   # ảnh vệ tinh chỉ nét tới z16, phóng lên cho khớp
RONG, CAO = 1400, 383       # khổ khung dựng (tỉ lệ 3,656 — đúng khổ banner hiện nay)
PHONG = 1                   # giữ đúng khổ gốc, không phóng (phóng chỉ làm nhoè)

# Chỗ đặt khung — đã dò nhiều nơi mới chọn được chỗ này, vì phải thoả CẢ BA:
#   · tile quy hoạch ở đây có mảng màu rõ (nhiều chỗ khác trắng trơn, nhìn không
#     ra bản đồ quy hoạch);
#   · thửa đủ to để nhìn rõ ranh (trung bình ~1.480 m², có thửa 8.600 m²);
#   · gần như thửa nào cũng có ghi loại đất, nên thẻ thông tin không bị trống.
# Đổi chỗ thì nhớ xem lại ảnh dựng ra: vài vùng tile có chữ bị lỗi phông.
TIM_LON, TIM_LAT = 109.13000, 12.06000

# Chỗ đặt thửa được tô sáng trong khung (phần bên phải, tránh cụm chữ bên trái)
HERO_X, HERO_Y = 0.655, 0.44

VE_TINH = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'


def diem_anh(lon, lat, z):
    """Đổi kinh/vĩ độ sang toạ độ điểm ảnh toàn cầu (Web Mercator, ô 256px)."""
    n = 2 ** z * 256
    la = math.radians(lat)
    return ((lon + 180) / 360 * n,
            (1 - math.log(math.tan(la) + 1 / math.cos(la)) / math.pi) / 2 * n)


def met(a, b):
    """Khoảng cách giữa hai điểm (lon, lat) tính ra mét."""
    R = 6371008.8
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dp = p2 - p1
    dl = math.radians(b[0] - a[0])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def psql(sql):
    r = subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam',
                        '-d', 'camlam_gis', '-tAF', '\t', '-c', sql],
                       cwd=GOC, capture_output=True, text=True, encoding='utf-8')
    return [d for d in (r.stdout or '').strip().split('\n') if d.strip()]


def lay_thua(lon0, lat0, lon1, lat1, gioi_han=400):
    """Lấy thửa trong khung. Trả về danh sách bản ghi kèm vòng ngoài."""
    sql = (
        "SELECT so_to, so_thua, round(dien_tich::numeric,1), coalesce(mdsd,''), "
        "ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.000004), 7) "
        "FROM dia_chinh "
        f"WHERE geom && ST_MakeEnvelope({lon0},{lat0},{lon1},{lat1},4326) "
        "AND dien_tich BETWEEN 800 AND 9000 AND mdsd <> '' "
        f"ORDER BY dien_tich DESC LIMIT {gioi_han};")
    ra = []
    for d in psql(sql):
        p = d.split('\t')
        if len(p) < 5:
            continue
        try:
            hinh = json.loads(p[4])
        except Exception:
            continue
        vong = hinh['coordinates'][0] if hinh['type'] == 'Polygon' else hinh['coordinates'][0][0]
        if len(vong) < 4:
            continue
        ra.append({'to': p[0], 'thua': p[1], 'dt': float(p[2]), 'mdsd': p[3], 'vong': vong})
    return ra


def main():
    try:
        from PIL import Image, ImageEnhance, ImageFilter
    except ImportError:
        raise SystemExit('Can thu vien Pillow: pip install pillow')

    # ── 1. Chọn "thửa chính" rồi đặt khung sao cho nó rơi đúng chỗ đã định ────
    d = 0.0022
    quanh = lay_thua(TIM_LON - d, TIM_LAT - d, TIM_LON + d, TIM_LAT + d, 60)
    if not quanh:
        raise SystemExit('Khong lay duoc thua nao quanh tam — database chua chay?')
    hero = next((t for t in quanh if 2500 <= t['dt'] <= 7000), quanh[0])
    hx = sum(p[0] for p in hero['vong']) / len(hero['vong'])
    hy = sum(p[1] for p in hero['vong']) / len(hero['vong'])
    print('Thua chinh: Thua %s · To %s · %.0f m2 · %s'
          % (hero['thua'], hero['to'], hero['dt'], hero['mdsd'] or 'chua ro'))

    cx, cy = diem_anh(hx, hy, Z)
    x0 = cx - RONG * HERO_X
    y0 = cy - CAO * HERO_Y

    def sang_khung(lon, lat):
        px, py = diem_anh(lon, lat, Z)
        return px - x0, py - y0

    def lon_lat_tu(px, py):
        n = 2 ** Z * 256
        lon = (px + x0) / n * 360 - 180
        lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (py + y0) / n))))
        return lon, lat

    lon0, lat0 = lon_lat_tu(0, CAO)
    lon1, lat1 = lon_lat_tu(RONG, 0)
    rong_m = met((lon0, lat0), (lon1, lat0))
    print('Khung: %d×%d diem anh o muc %d — rong ~%.0f m ngoai thuc dia'
          % (RONG, CAO, Z, rong_m))

    # ── 2. Nền: ảnh vệ tinh (lót mờ) + tile quy hoạch QĐ205 của chính web ─────
    tx0, ty0 = int(x0 // 256), int(y0 // 256)
    tx1, ty1 = int((x0 + RONG) // 256), int((y0 + CAO) // 256)
    lech_x, lech_y = int(x0 - tx0 * 256), int(y0 - ty0 * 256)

    # 2a. vệ tinh lấy ở z16 rồi phóng lên cho khớp khung z18
    k = 2 ** (Z - Z_VT)
    vx0, vy0 = x0 / k, y0 / k
    vrong, vcao = RONG / k, CAO / k
    vtx0, vty0 = int(vx0 // 256), int(vy0 // 256)
    vtx1, vty1 = int((vx0 + vrong) // 256), int((vy0 + vcao) // 256)
    vt = Image.new('RGB', ((vtx1 - vtx0 + 1) * 256, (vty1 - vty0 + 1) * 256), (24, 44, 36))
    for tx in range(vtx0, vtx1 + 1):
        for ty in range(vty0, vty1 + 1):
            f = os.path.join(RA_ANH, '_tam-%d-%d-%d.jpg' % (Z_VT, tx, ty))
            if not os.path.exists(f):
                subprocess.run(['curl', '-sS', '--max-time', '60', '-o', f,
                                VE_TINH.format(z=Z_VT, x=tx, y=ty)], capture_output=True)
            try:
                vt.paste(Image.open(f).convert('RGB'), ((tx - vtx0) * 256, (ty - vty0) * 256))
            except Exception:
                pass
    vt = vt.crop((int(vx0 - vtx0 * 256), int(vy0 - vty0 * 256),
                  int(vx0 - vtx0 * 256) + math.ceil(vrong),
                  int(vy0 - vty0 * 256) + math.ceil(vcao)))
    nen = vt.resize((RONG, CAO), Image.LANCZOS)

    # Làm ảnh vệ tinh NHẠT HẲN như giấy in bản đồ, rồi mới phủ nét quy hoạch lên.
    # ⚠️ Đã thử để nền tối (ảnh vệ tinh gần như nguyên bản): màu quy hoạch chìm
    #    nghỉm, nhìn ra một mảng bùn chứ không ra bản đồ. Nền phải sáng.
    nen = ImageEnhance.Color(nen).enhance(0.18)
    nen = ImageEnhance.Brightness(nen).enhance(1.5)
    nen = Image.blend(nen, Image.new('RGB', nen.size, (255, 255, 255)), 0.68)
    nen = nen.filter(ImageFilter.GaussianBlur(1.2))   # ảnh vệ tinh chỉ còn là vân giấy

    # 2b. tile quy hoạch
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
    qh = qh.crop((lech_x, lech_y, lech_x + RONG, lech_y + CAO))
    print('  ghep %d o quy hoach' % co)

    anh = nen.convert('RGBA')
    anh.alpha_composite(qh)
    anh = anh.convert('RGB')
    if PHONG != 1:
        anh = anh.resize((RONG * PHONG, CAO * PHONG), Image.LANCZOS)
    p = os.path.join(RA_ANH, 'm10-quyhoach.webp')
    anh.save(p, 'WEBP', quality=80, method=6)
    print('  OK %s  %d KB' % (os.path.basename(p), os.path.getsize(p) // 1024))

    for f in os.listdir(RA_ANH):
        if f.startswith('_tam-'):
            os.remove(os.path.join(RA_ANH, f))

    # ── 3. Ranh thửa thật, đổi sang thẻ SVG trong hệ toạ độ của khung ─────────
    ds = lay_thua(lon0, lat0, lon1, lat1, 400)
    print('  %d thua trong khung' % len(ds))

    def duong(vong):
        pts = [sang_khung(lo, la) for lo, la in vong]
        return 'M' + 'L'.join('%.1f %.1f' % (a, b) for a, b in pts) + 'Z', pts

    # chỉ giữ thửa lọt TRỌN VẸN trong khung — đúng ý "thấy thửa đầy đủ"
    tron = []
    for t in ds:
        dsvg, pts = duong(t['vong'])
        if all(-4 <= a <= RONG + 4 and -4 <= b <= CAO + 4 for a, b in pts):
            t['d'] = dsvg
            t['pts'] = pts
            t['x'] = sum(a for a, _ in pts) / len(pts)
            t['y'] = sum(b for _, b in pts) / len(pts)
            tron.append(t)
    print('  %d thua nam tron trong khung' % len(tron))

    chinh = next((t for t in tron if t['to'] == hero['to'] and t['thua'] == hero['thua']), None)
    if chinh is None:
        chinh = min(tron, key=lambda t: (t['x'] - RONG * HERO_X) ** 2 + (t['y'] - CAO * HERO_Y) ** 2)

    # vẽ những thửa ở NỬA PHẢI trước (nửa trái bị cụm chữ che), to trước bé sau
    ve = sorted((t for t in tron if t['x'] > RONG * 0.30), key=lambda t: -t['dt'])[:26]
    if chinh not in ve:
        ve.insert(0, chinh)

    mau_to = ['rgba(250,204,21,.18)', 'rgba(190,242,100,.16)', 'rgba(125,211,252,.16)']
    fill = ''.join('<path style="--d:%d" fill="%s" d="%s"/>' % (i * 70, mau_to[i % 3], t['d'])
                   for i, t in enumerate(ve))
    net = ''.join('<path class="draw" pathLength="1" style="--d:%d;--dur:900" d="%s"/>'
                  % (i * 70, t['d']) for i, t in enumerate(ve))

    # nhãn số thửa: 3 thửa to nhất bên phải, không tính thửa chính
    nhan_ds = [t for t in sorted(ve, key=lambda t: -t['dt']) if t is not chinh][:3]
    nhan = ''.join('<text x="%.0f" y="%.0f">Thửa %s</text>' % (t['x'], t['y'], t['thua'])
                   for t in nhan_ds)

    # nét đo: cạnh dài nhất mà lại NẰM NGANG nhất của thửa chính (chữ ghi dọc
    # theo cạnh, cạnh dựng đứng thì chữ quay dọc, đọc rất khó). Số mét là số đo
    # thật giữa hai đầu cạnh.
    pts = chinh['pts']
    goc = chinh['vong']

    def hop(i):
        p1, p2 = pts[i], pts[i + 1]
        nghieng = abs(math.degrees(math.atan2(p2[1] - p1[1], p2[0] - p1[0])))
        nghieng = min(nghieng, 180 - nghieng)
        return met(goc[i], goc[i + 1]) * (1.0 if nghieng < 42 else 0.45)

    canh = max(range(len(goc) - 1), key=hop)
    dai = met(goc[canh], goc[canh + 1])
    (ax, ay), (bx, by) = pts[canh], pts[canh + 1]
    vx, vy = bx - ax, by - ay
    do = math.hypot(vx, vy) or 1
    nx, ny = -vy / do * 11, vx / do * 11          # đẩy nét ra NGOÀI thửa 11 đơn vị
    if ((ax + nx - chinh['x']) ** 2 + (ay + ny - chinh['y']) ** 2
            < (ax - nx - chinh['x']) ** 2 + (ay - ny - chinh['y']) ** 2):
        nx, ny = -nx, -ny
    a2 = (ax + nx, ay + ny)
    b2 = (bx + nx, by + ny)
    gocxoay = math.degrees(math.atan2(vy, vx))
    if gocxoay > 90:
        gocxoay -= 180
    if gocxoay < -90:
        gocxoay += 180
    mx, my = (a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2
    do_svg = ('<path class="dim" pathLength="1" d="M%.1f %.1fL%.1f %.1f"/>'
              '<path class="tick" d="M%.1f %.1fL%.1f %.1fM%.1f %.1fL%.1f %.1f"/>'
              % (a2[0], a2[1], b2[0], b2[1],
                 a2[0] - nx * 0.5, a2[1] - ny * 0.5, a2[0] + nx * 0.5, a2[1] + ny * 0.5,
                 b2[0] - nx * 0.5, b2[1] - ny * 0.5, b2[0] + nx * 0.5, b2[1] + ny * 0.5))

    # ── 4. Ghép hẳn cả khối SVG rồi ghi ra file cho tach-banner.py dùng ──────
    # Làm vậy để tach-banner.py KHÔNG phải mở database: chạy script này lúc nào
    # tiện thì nó để sẵn kết quả ở đây, lúc dựng banner chỉ việc đọc file.
    TEN_DAT = {
        'CLN': 'Đất trồng cây lâu năm', 'LUC': 'Đất trồng lúa',
        'BHK': 'Đất trồng cây hằng năm', 'ONT': 'Đất ở nông thôn',
        'ODT': 'Đất ở đô thị', 'RSX': 'Đất rừng sản xuất',
        'DGT': 'Đất giao thông', 'NTS': 'Đất nuôi trồng thuỷ sản',
        'CLN/ONT': 'Đất ở và trồng cây lâu năm',
    }
    ma = chinh['mdsd'] or ''
    ten_dat = TEN_DAT.get(ma, 'Loại đất %s' % ma if ma else 'Chưa rõ loại đất')
    dt_chu = format(int(round(chinh['dt'])), ',d').replace(',', '.')

    # thẻ thông tin: đặt bên phải thửa chính, né mép khung
    the_x = min(RONG - 268, max(chinh['x'] + 70, RONG * 0.62))
    the_y = max(16, chinh['y'] - 150)
    the = ('<g class="fl-card" data-at="3000" data-once '
           'font-family="Inter, system-ui, sans-serif">'
           '<rect x="%.0f" y="%.0f" width="252" height="104" rx="14" '
           'fill="rgba(15,23,42,.9)" stroke="rgba(251,191,36,.65)"/>'
           '<text x="%.0f" y="%.0f" fill="#fde68a" font-size="21" font-weight="800">'
           'Thửa %s · Tờ %s</text>'
           '<text x="%.0f" y="%.0f" fill="#e2e8f0" font-size="16">%s (%s)</text>'
           '<text x="%.0f" y="%.0f" fill="#e2e8f0" font-size="16">Diện tích %s m²</text>'
           '</g>'
           % (the_x, the_y, the_x + 18, the_y + 34, chinh['thua'], chinh['to'],
              the_x + 18, the_y + 63, ten_dat, ma or '—', the_x + 18, the_y + 89, dt_chu))

    do_chu = ('<text class="count-txt" x="%.0f" y="%.0f" transform="rotate(%.1f %.0f %.0f)" '
              'font-family="Inter, system-ui, sans-serif" font-size="21" font-weight="800" '
              'fill="#fff" text-anchor="middle" '
              'style="paint-order:stroke;stroke:rgba(15,23,42,.6);stroke-width:5px" '
              'data-count="%d" data-pre="≈ " data-suf=" m">≈ %d m</text>'
              % (mx, my, gocxoay, mx, my, round(dai), round(dai)))

    svg = (
        '<svg class="fill-svg" viewBox="0 0 %d %d" preserveAspectRatio="xMidYMid slice" '
        'role="img" aria-label="Bản đồ quy hoạch Cam Lâm có ranh từng thửa đất">'
        '<defs><linearGradient id="flScanG" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#22d3ee" stop-opacity="0"/>'
        '<stop offset=".5" stop-color="#22d3ee" stop-opacity=".45"/>'
        '<stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>'
        '<image href="/banner11/m10-quyhoach.webp" width="%d" height="%d" '
        'preserveAspectRatio="none"/>'
        '<g class="fl-fill" data-at="1700" data-once>%s</g>'
        '<g class="grp fl-parcels" data-at="500" data-once>%s</g>'
        '<path class="fl-hl" data-at="2600" data-once d="%s"/>'
        '<g class="fl-lbl" data-at="2300" data-once font-family="Inter, system-ui, sans-serif" '
        'font-size="19" font-weight="800" fill="#0f172a" text-anchor="middle" '
        'style="paint-order:stroke;stroke:rgba(255,255,255,.85);stroke-width:4px">%s</g>'
        '<g class="fl-measure" data-at="3300" data-once>%s%s</g>'
        '%s'
        '<g class="fl-scan" data-at="4800"><rect x="0" y="-40" width="%d" height="80" '
        'fill="url(#flScanG)"/><rect x="0" y="-1" width="%d" height="2" fill="#0891b2"/></g>'
        '</svg>'
        % (RONG, CAO, RONG, CAO, fill, net, chinh['d'], nhan, do_svg, do_chu, the, RONG, RONG))

    ra_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mau10-noidung.html')
    io.open(ra_file, 'w', encoding='utf-8', newline=chr(10)).write(svg)
    print('  OK %s  %d KB' % (os.path.basename(ra_file), len(svg) // 1024))

    print('')
    print('== DAN VAO BAN THIET KE ==')
    print('[viewBox] 0 0 %d %d' % (RONG, CAO))
    print('[fl-fill]')
    print(fill)
    print('[fl-parcels]')
    print(net)
    print('[fl-hl]')
    print(chinh['d'])
    print('[fl-lbl]')
    print(nhan)
    print('[fl-measure] dai that %.0f m, xoay %.1f do, chu o %.0f,%.0f' % (dai, gocxoay, mx, my))
    print(do_svg)
    print('[the] Thua %s · To %s | %s | %.0f m2 | tam %.0f,%.0f'
          % (chinh['thua'], chinh['to'], chinh['mdsd'] or 'chua ro', chinh['dt'],
             chinh['x'], chinh['y']))
    print('[do-m] %d' % round(dai))


if __name__ == '__main__':
    main()
