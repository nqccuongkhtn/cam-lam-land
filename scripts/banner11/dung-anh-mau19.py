# -*- coding: utf-8 -*-
"""
DỰNG NGUYÊN LIỆU CHO MẪU BANNER 19 — "TỪ ẢNH THẬT ĐẾN BẢN ĐỒ QUY HOẠCH"
========================================================================
Mẫu 19 kể đúng việc web mình làm: nhìn từ xa là ảnh thật, lau qua thì hiện bản
đồ quy hoạch, rồi PHÓNG DẦN từ cảnh toàn huyện Cam Lâm vào tận một thửa đất.

⚠️ VÌ SAO PHẢI DỰNG BA TẦNG ẢNH CHỨ KHÔNG PHẢI MỘT
   Bản trước chỉ có MỘT tấm ảnh rồi phóng to lên. Phóng bao nhiêu lần thì nhoè
   bấy nhiêu lần — chủ dự án nhận xét "ảnh nền bản đồ rất mờ".
   Nay làm giống hệt cách bản đồ thật chạy: ba tầng ảnh, mỗi tầng chụp ở một
   mức phóng riêng nên tầng nào cũng NÉT ở đúng lúc nó hiện ra:

     tầng 1 — cả huyện Cam Lâm   (~36 km ngang)
     tầng 2 — vùng Cam Đức       (~4,5 km, gấp 8 lần)
     tầng 3 — quanh thửa đất     (~1,1 km, gấp 32 lần)

   Ba tầng cùng TÂM là thửa đất được chọn, nên phóng dần là chúng chồng khít
   lên nhau; CSS chỉ việc mờ tầng này đi, rõ tầng kia lên (xem `m19-l1/l2/l3`
   trong banner11-them.css).

Ghi ra:
  public/banner11/m19-vetinh.webp   — ảnh thật cả huyện (lớp đáy, bị lau đi)
  public/banner11/m19-qh1.webp      — bản đồ quy hoạch cả huyện
  public/banner11/m19-qh2.webp      — bản đồ quy hoạch vùng Cam Đức
  public/banner11/m19-qh3.webp      — bản đồ quy hoạch + ranh thửa + thửa tô sáng

Chạy:  python scripts/banner11/dung-anh-mau19.py

⚠️ BÀI HỌC ĐÃ TRẢ GIÁ: có một dạo lớp quy hoạch lấy tấm `qh-cam-lam-rong.webp`
   (đẹp hơn) nhưng đó là CHỖ KHÁC, trong khi ảnh thật và ranh thửa là vùng Bãi
   Dài → chủ dự án nhìn phát ra ngay "không khớp cả bản đồ địa chính".
   Mọi lớp của mẫu này BẮT BUỘC do chính script này dựng ra cùng một lượt.

NGUỒN ẢNH VỆ TINH: **Sentinel-2 cloudless của EOX** (CC BY 4.0 — dùng thoải mái,
chỉ cần ghi nguồn). ⚠️ KHÔNG dùng ảnh vệ tinh Google: trang bản đồ của web xem
trực tiếp tile Google (có ghi nguồn) thì đúng luật, nhưng CẮT ảnh Google nướng
vào một tấm banner quảng cáo là dùng sai phép.
Ảnh Sentinel-2 chụp ở 10 m một điểm ảnh, nên NÉT NHẤT khi khung rộng: tầng 1
(36 km / 1920 điểm ảnh = 18,7 m mỗi điểm) là THU NHỎ lại chứ không phóng to.

RANH THỬA lấy từ bảng `dia_chinh` của chính mình — dữ liệu của dự án.
"""
import json
import math
import os
import subprocess

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA_ANH = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')

RONG, CAO = 1920, 620         # khổ khung banner (đơn vị bản vẽ)

# ⚠️ LỚP QUY HOẠCH DỰNG TO HƠN KHUNG 1,5 LẦN.
#    Lý do: mỗi tầng chỉ NÉT ĐÚNG MỘT CỠ — cỡ mà nó được dựng. Nhưng
#    hiệu ứng phóng chạy liên tục từ 1 lên 32 lần, nên giữa hai tầng bao
#    giờ cũng có lúc ảnh đang bị kéo to gấp 2–3 lần — đúng lúc đó nhìn mờ.
#    Dựng sẵn to hơn 1,5 lần là có chỗ để kéo mà không hụt điểm ảnh.
#    Không dựng to hơn nữa vì tệp nặng thêm, mà banner còn phải tải trên
#    điện thoại.
NET = 1.5
RONG_QH, CAO_QH = int(RONG * NET), int(CAO * NET)
# Thửa đất đích: Thửa 354 · Tờ 11, khu trung tâm Cam Đức, ~4.788 m², đất ở + CLN
TAM_LON, TAM_LAT = 109.14956, 12.06930

# Ba tầng: (tên file, mức phóng của khung, mức phóng lấy tile quy hoạch,
#           gấp mấy lần tầng 1).
# ⚠️ TILE LẤY Ở MỨC PHÓNG SÂU HƠN KHUNG rồi thu nhỏ lại. Hai cái lợi: nét gạch
#    mịn hơn, và CHỮ GHI CHÚ TRÊN TILE nhỏ lại theo. Bản trước tầng 2 lấy tile
#    z17 cho khung z16 (chỉ sâu 1 bậc) nên giữa bản đồ có một chữ "CH" đen
#    to tướng — ký hiệu loại đất, đúng ra chỉ bằng đầu ngón tay.
TANG = [
    ('m19-qh1', 13, 15, 1),
    ('m19-qh2', 16, 18, 8),
    ('m19-qh3', 18, 18, 32),
]
VE_TINH = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'


def diem_anh(lon, lat, z):
    """Đổi kinh/vĩ độ sang toạ độ điểm ảnh toàn cầu (Web Mercator, ô 256px)."""
    n = 2 ** z * 256
    la = math.radians(lat)
    return ((lon + 180) / 360 * n,
            (1 - math.log(math.tan(la) + 1 / math.cos(la)) / math.pi) / 2 * n)


def khung(z):
    """Góc trên trái của khung ảnh ở mức phóng z (khung luôn lấy thửa làm tâm)."""
    cx, cy = diem_anh(TAM_LON, TAM_LAT, z)
    return cx - RONG / 2, cy - CAO / 2


def ghep_tile(z, x0, y0, rong, cao, nen, doc_anh):
    """Ghép các ô 256px thành một tấm ảnh phủ đúng khung đã cho."""
    from PIL import Image
    tx0, ty0 = int(x0 // 256), int(y0 // 256)
    tx1, ty1 = int((x0 + rong) // 256), int((y0 + cao) // 256)
    im = Image.new(nen[0], ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), nen[1])
    co = 0
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            o = doc_anh(z, tx, ty)
            if o is None:
                continue
            if nen[0] == 'RGBA':
                im.alpha_composite(o, ((tx - tx0) * 256, (ty - ty0) * 256))
            else:
                im.paste(o, ((tx - tx0) * 256, (ty - ty0) * 256))
            co += 1
    im = im.crop((int(x0 - tx0 * 256), int(y0 - ty0 * 256),
                  int(x0 - tx0 * 256) + int(rong), int(y0 - ty0 * 256) + int(cao)))
    return im, co


def ve_ranh_thua(anh, z, x0, y0, net=1.0):
    """Vẽ ranh thửa thật lên tầng gần nhất, tô sáng thửa ở giữa khung."""
    from PIL import ImageDraw
    n = 2 ** z * 256
    lon0 = x0 / n * 360 - 180
    lon1 = (x0 + RONG) / n * 360 - 180

    def lat_tu_y(y):
        return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))

    lat0, lat1 = lat_tu_y(y0), lat_tu_y(y0 + CAO)
    sql = ("SELECT so_to, so_thua, round(dien_tich::numeric,1), coalesce(mdsd,''), "
           "ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0000015), 7) "
           "FROM dia_chinh "
           "WHERE geom && ST_MakeEnvelope(%f,%f,%f,%f,4326) AND dien_tich > 80 "
           "LIMIT 1500;" % (lon0, lat1, lon1, lat0))
    r = subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam',
                        '-d', 'camlam_gis', '-tAF', '\t', '-c', sql],
                       cwd=GOC, capture_output=True, text=True, encoding='utf-8')
    dong = [d for d in (r.stdout or '').strip().split('\n') if d.strip()]
    print('  Lay duoc %d thua quanh thua dich' % len(dong))
    if not dong:
        print('  ⚠ khong lay duoc thua nao — database chua chay?')
        return anh

    def sang_khung(lon, lat):
        px, py = diem_anh(lon, lat, z)
        return (px - x0) * net, (py - y0) * net

    but = ImageDraw.Draw(anh, 'RGBA')
    giua = (RONG * net / 2, CAO * net / 2)
    chinh, gan_nhat = None, 1e9
    for d in dong:
        p = d.split('\t')
        if len(p) < 5:
            continue
        try:
            hinh = json.loads(p[4])
        except Exception:
            continue
        vong = (hinh['coordinates'][0] if hinh['type'] == 'Polygon'
                else hinh['coordinates'][0][0])
        xs = [sang_khung(lo, la) for lo, la in vong]
        if len(xs) < 4:
            continue
        but.line(xs + [xs[0]], fill=(120, 53, 15, 235), width=max(2, round(2 * net)))
        cx = sum(a for a, _ in xs) / len(xs)
        cy = sum(b for _, b in xs) / len(xs)
        xa = (cx - giua[0]) ** 2 + (cy - giua[1]) ** 2
        if xa < gan_nhat:
            gan_nhat, chinh = xa, (p[0], p[1], p[2], p[3], xs, cx, cy)

    if chinh:
        so_to, so_thua, dt, mdsd, xs, cx, cy = chinh
        but.polygon(xs, fill=(253, 224, 71, 95), outline=(202, 138, 4, 255),
                    width=max(3, round(4 * net)))
        print('  THUA TO SANG: Thua %s · To %s · %s m2 · %s'
              % (so_thua, so_to, dt, mdsd or 'chua ro'))
        print('  Tam thua trong khung: %.1f%% , %.1f%%'
              % (cx / (RONG * net) * 100, cy / (CAO * net) * 100))
    return anh


def main():
    try:
        from PIL import Image, ImageEnhance, ImageFilter
    except ImportError:
        raise SystemExit('Can thu vien Pillow: pip install pillow')

    def doc_vetinh(z, tx, ty):
        f = os.path.join(RA_ANH, '_tam-%d-%d-%d.jpg' % (z, tx, ty))
        if not os.path.exists(f):
            subprocess.run(['curl', '-sS', '--max-time', '60', '-o', f,
                            VE_TINH.format(z=z, x=tx, y=ty)], capture_output=True)
        try:
            return Image.open(f).convert('RGB')
        except Exception:
            return None

    def doc_quyhoach(z, tx, ty):
        f = os.path.join(GOC, 'apps', 'frontend', 'public', 'tiles', 'qd205v11',
                         str(z), str(tx), '%d.png' % ty)
        return Image.open(f).convert('RGBA') if os.path.exists(f) else None

    for ten, z, z_qh, lan in TANG:
        x0, y0 = khung(z)
        rong_m = 156543.03392 * math.cos(math.radians(TAM_LAT)) / (2 ** z) * RONG
        print('%s: muc phong %d — rong ~%.2f km ngoai thuc dia (gap %d lan tang 1)'
              % (ten, z, rong_m / 1000, lan))

        ve, _ = ghep_tile(z, x0, y0, RONG, CAO, ('RGB', (12, 30, 50)), doc_vetinh)

        if lan == 1:
            # tầng 1 kiêm luôn lớp "ảnh thật" — đây là cảnh mở đầu, chỉnh cho tươi
            # ⚠️ CHỤP Ở MỨC PHÓNG SÂU HƠN MỘT BẬC RỒI THU NHỎ LẠI ("chụp gấp đôi
            #    rồi ép xuống"). Khung tầng 1 ở mức phóng 13, mỗi điểm ảnh ôm
            #    18,7 m ngoài thực địa — trong khi ảnh Sentinel-2 gốc chụp 10 m
            #    một điểm. Lấy đúng mức 13 là vứt mất một nửa độ chi tiết mà
            #    máy chủ có, ảnh ra nhoè (chủ dự án: "quá mờ").
            #    Lấy mức 14 (9,3 m/điểm, đúng bằng độ nét gốc của Sentinel-2)
            #    trên khung rộng gấp đôi rồi thu về đúng khổ: mỗi điểm ảnh cuối
            #    cùng là trung bình của 4 điểm thật — sắc nét hẳn, lại hết nhiễu.
            zz = z + 1
            cx2, cy2 = diem_anh(TAM_LON, TAM_LAT, zz)
            ve2, _ = ghep_tile(zz, cx2 - RONG, cy2 - CAO, RONG * 2, CAO * 2,
                               ('RGB', (12, 30, 50)), doc_vetinh)
            vt = ve2.resize((RONG, CAO), Image.LANCZOS)
            vt = ImageEnhance.Color(vt).enhance(1.3)
            vt = ImageEnhance.Contrast(vt).enhance(1.16)
            vt = vt.filter(ImageFilter.UnsharpMask(radius=1.4, percent=150, threshold=2))
            p = os.path.join(RA_ANH, 'm19-vetinh.webp')
            vt.save(p, 'WEBP', quality=90, method=6)
            print('  OK %s  %d KB' % (os.path.basename(p), os.path.getsize(p) // 1024))

        k = 2 ** (z_qh - z)
        qh, co = ghep_tile(z_qh, x0 * k, y0 * k, RONG * k, CAO * k,
                           ('RGBA', (0, 0, 0, 0)), doc_quyhoach)
        if (qh.width, qh.height) != (RONG_QH, CAO_QH):
            qh = qh.resize((RONG_QH, CAO_QH), Image.LANCZOS)

        # ── NỀN GIẤY PHẰNG, KHÔNG DÙNG ẢNH VỆ TINH ────────────────────────
        # ⚠️ ĐÂY CHÍNH LÀ CHỖ TỪ NG MỜ. Bản trước lấy chính ảnh vệ tinh làm
        #    nền rồi làm nhạt đi. Ảnh Sentinel-2 chụp 10 m một điểm ảnh, mà
        #    tầng 2 (­~4,5 km) và tầng 3 (~1,1 km) cần tới 2,4 m và 0,6 m một
        #    điểm ảnh — tức phải kéo to 4 lần và 16 lần. Kéo từng đó thì chỉ
        #    còn mấy vệt xanh xám nhoè, nằm ngay dưới nét quy hoạch — đúng
        #    cái chủ dự án bảo "lấy bản đồ vẫn chưa mượt, rất mờ".
        #    Bản đồ quy hoạch thật in trên GIẤY TRẮNG, không có ảnh chụp bên
        #    dưới. Nền phẳng thì phóng bao nhiêu lần cũng không thể mờ.
        ban_do = Image.new('RGBA', (RONG_QH, CAO_QH), (249, 247, 242, 255))
        ban_do.alpha_composite(qh)

        if lan == 32:
            ban_do = ve_ranh_thua(ban_do, z, x0, y0, NET)

        p = os.path.join(RA_ANH, ten + '.webp')
        ban_do.convert('RGB').save(p, 'WEBP', quality=84, method=6)
        print('  OK %s  %d KB  (ghep %d o quy hoach)'
              % (os.path.basename(p), os.path.getsize(p) // 1024, co))

    for f in os.listdir(RA_ANH):
        if f.startswith('_tam-'):
            os.remove(os.path.join(RA_ANH, f))


if __name__ == '__main__':
    main()
