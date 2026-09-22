# -*- coding: utf-8 -*-
"""
DỰNG NGUYÊN LIỆU CHO MẪU BANNER 19 — "TỪ ẢNH THẬT ĐẾN BẢN ĐỒ QUY HOẠCH"
========================================================================
Mẫu 19 kể đúng việc web mình làm: nhìn từ xa là ảnh vệ tinh, phóng dần vào thì
hiện bản đồ quy hoạch, rồi hiện ranh từng thửa đất, cuối cùng dừng ở một thửa.

Script này dựng sẵn 3 thứ, TẤT CẢ ĐỀU CHỒNG KHÍT NHAU (cùng một khung toạ độ):

  1. public/banner11/m19-vetinh.webp   — ảnh vệ tinh
  2. public/banner11/m19-quyhoach.webp — bản đồ quy hoạch (lớp QĐ205 của web)
  3. in ra màn hình: các đường ranh thửa THẬT dưới dạng SVG, dán vào bản thiết kế

Chạy:  python scripts/banner11/dung-anh-mau19.py

NGUỒN ẢNH VỆ TINH — CHỖ NÀY QUAN TRỌNG:
  Dùng **Sentinel-2 cloudless của EOX** (ảnh vệ tinh châu Âu, giấy phép mở
  CC BY 4.0 — dùng thoải mái, chỉ cần ghi nguồn).
  ⚠️ KHÔNG dùng ảnh vệ tinh Google. Trang bản đồ của web xem trực tiếp ảnh Google
     (có ghi nguồn) thì đúng luật, nhưng CẮT ảnh Google nướng vào một tấm banner
     quảng cáo là dùng sai phép. Đừng đổi sang Google cho "nét hơn".
  Ảnh Sentinel-2 hơi mềm vì mỗi điểm ảnh là 10m ngoài thực địa. Không sao: trong
  mẫu này ảnh vệ tinh chỉ là cảnh NHÌN TỪ XA, phóng vào là bản đồ quy hoạch và
  ranh thửa che lên hết.

RANH THỬA lấy từ bảng `dia_chinh` của chính mình (733.249 thửa toàn tỉnh, dựng
từ dữ liệu địa chính) — dữ liệu của dự án, không vướng bản quyền của ai.
"""
import io
import json
import math
import os
import subprocess
import sys

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA_ANH = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')

Z = 16                    # mức phóng để lấy ô bản đồ
RONG, CAO = 2560, 827     # khổ ảnh dựng ra (gấp ~1,33 lần khổ banner cho đỡ vỡ khi phóng)
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
        from PIL import Image
    except ImportError:
        raise SystemExit('Cần thư viện Pillow: pip install pillow')

    cx, cy = diem_anh(TAM_LON, TAM_LAT, Z)
    x0, y0 = cx - RONG / 2, cy - CAO / 2          # góc trên bên trái của khung
    tx0, ty0 = int(x0 // 256), int(y0 // 256)
    tx1, ty1 = int((x0 + RONG) // 256), int((y0 + CAO) // 256)
    print(f'Khung: {RONG}×{CAO} điểm ảnh ở mức phóng {Z} — ô từ ({tx0},{ty0}) đến ({tx1},{ty1})')

    # ── 1. Ảnh vệ tinh ───────────────────────────────────────────────────────
    ve = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), (12, 30, 50))
    thieu = 0
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            u = VE_TINH.format(z=Z, x=tx, y=ty)
            f = os.path.join(RA_ANH, f'_tam-{Z}-{tx}-{ty}.jpg')
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
        print(f'  ⚠ thiếu {thieu} ô ảnh vệ tinh')
    ve = ve.crop((int(x0 - tx0 * 256), int(y0 - ty0 * 256),
                  int(x0 - tx0 * 256) + RONG, int(y0 - ty0 * 256) + CAO))
    p1 = os.path.join(RA_ANH, 'm19-vetinh.webp')
    ve.save(p1, 'WEBP', quality=82, method=6)
    print(f'  ✓ {os.path.basename(p1)}  {os.path.getsize(p1)//1024} KB')

    # ── 2. Bản đồ quy hoạch (lớp QĐ205 của chính web) ────────────────────────
    qh = Image.new('RGBA', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), (0, 0, 0, 0))
    co = 0
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            f = os.path.join(GOC, 'apps', 'frontend', 'public', 'tiles', 'qd205v11',
                             str(Z), str(tx), f'{ty}.png')
            if os.path.exists(f):
                qh.alpha_composite(Image.open(f).convert('RGBA'), ((tx - tx0) * 256, (ty - ty0) * 256))
                co += 1
    qh = qh.crop((int(x0 - tx0 * 256), int(y0 - ty0 * 256),
                  int(x0 - tx0 * 256) + RONG, int(y0 - ty0 * 256) + CAO))
    p2 = os.path.join(RA_ANH, 'm19-quyhoach.webp')
    qh.save(p2, 'WEBP', quality=86, method=6)      # giữ nền trong suốt
    print(f'  ✓ {os.path.basename(p2)}  {os.path.getsize(p2)//1024} KB  (ghép {co} ô quy hoạch)')

    # dọn ô tạm
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
    print(f'  Khung toạ độ: {lon0:.5f},{lat1:.5f} → {lon1:.5f},{lat0:.5f}')

    sql = f"""
    SELECT so_to, so_thua, round(dien_tich::numeric,1), coalesce(mdsd,''),
           ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.000012), 6)
    FROM dia_chinh
    WHERE geom && ST_MakeEnvelope({lon0},{lat1},{lon1},{lat0},4326)
      AND dien_tich > 120
    LIMIT 900;"""
    r = subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam',
                        '-d', 'camlam_gis', '-tAF', '\t', '-c', sql],
                       cwd=GOC, capture_output=True, text=True, encoding='utf-8')
    dong = [d for d in (r.stdout or '').strip().split('\n') if d.strip()]
    print(f'  Lấy được {len(dong)} thửa trong khung')
    if not dong:
        print('  ⚠ không lấy được thửa nào — database chưa chạy?')
        return

    def sang_diem_anh(lon, lat):
        px, py = diem_anh(lon, lat, Z)
        return px - x0, py - y0

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
        vong = hinh['coordinates'] if hinh['type'] == 'Polygon' else [c for m in hinh['coordinates'] for c in m]
        for v in vong[:1]:                       # chỉ lấy vòng ngoài
            xs = [sang_diem_anh(lo, la) for lo, la in v]
            if len(xs) < 4:
                continue
            diem_vung.append([(a, b) for a, b in xs])
            try:
                if float(dt) > lon_nhat and 300 < float(dt) < 3000:
                    lon_nhat = float(dt)
                    d_svg = ''.join(('M' if i == 0 else 'L') + f'{a:.1f} {b:.1f}'
                                    for i, (a, b) in enumerate(xs)) + 'Z'
                    to_nhat = {'to': so_to, 'thua': so_thua, 'dt': dt, 'mdsd': mdsd, 'd': d_svg,
                               'x': sum(a for a, _ in xs) / len(xs),
                               'y': sum(b for _, b in xs) / len(xs)}
            except ValueError:
                pass

    # Vẽ ranh thửa thành MỘT LỚP ẢNH TRONG SUỐT.
    # ⚠️ Đừng nhét 900 đường vẽ thẳng vào mã trang: nặng ~100 KB, mà trang chủ
    #    ai vào cũng phải tải. Vẽ ra ảnh thì chỉ còn vài chục KB và trình duyệt
    #    hiện nhanh hơn nhiều. Riêng thửa được chọn thì vẫn để dạng đường vẽ (rất
    #    ngắn) để còn tô sáng và chạy hiệu ứng viền.
    from PIL import ImageDraw
    lop = Image.new('RGBA', (RONG, CAO), (0, 0, 0, 0))
    but = ImageDraw.Draw(lop)
    for d in diem_vung:
        if len(d) >= 4:
            but.line(d + [d[0]], fill=(255, 250, 205, 255), width=3)   # dày và sáng cho nổi trên bản đồ
    p3 = os.path.join(RA_ANH, 'm19-ranh-thua.webp')
    lop.save(p3, 'WEBP', quality=88, method=6, lossless=False)
    print(f'  ✓ {os.path.basename(p3)}  {os.path.getsize(p3)//1024} KB  ({len(diem_vung)} thửa)')

    if to_nhat:
        print('')
        print(f'  THỬA ĐỂ PHÓNG VÀO: Thửa {to_nhat["thua"]} · Tờ {to_nhat["to"]} · '
              f'{to_nhat["dt"]} m² · {to_nhat["mdsd"] or "chưa rõ"}')
        print(f'  Tâm thửa trong ảnh: {to_nhat["x"]:.0f},{to_nhat["y"]:.0f} '
              f'= {to_nhat["x"]/RONG*100:.2f}% , {to_nhat["y"]/CAO*100:.2f}%')
        print('  Đường vẽ của thửa (dán vào bản thiết kế):')
        print(f'  {to_nhat["d"]}')


if __name__ == '__main__':
    main()
