# -*- coding: utf-8 -*-
"""
Làm SẠCH file GeoJSON vừa rút từ DXF quy hoạch, để sẵn sàng cắt tile.

Đầu vào: GeoJSON do ogr2ogr xuất ra, mỗi vùng có 2 thuộc tính `Layer` và `OGR_STYLE`.
Đầu ra:  GeoJSON có `lo` (tên level), `c` (màu #rrggbb), `hz` (nhóm kịch bản).

Bốn việc nó làm:
  1. Lấy MÀU GỐC trong bản vẽ CAD ra thành trường riêng — nhờ vậy không cần bảng chú giải.
  2. Sửa lỗi mã chữ: tên level tiếng Việt trong DXF hay bị đọc thành "ÄVO má»iTB".
  3. Bỏ vùng rơi ra ngoài khung Khánh Hoà (bản vẽ CAD hay sót vài nét rác gần gốc toạ độ,
     để nguyên thì khung cắt tile phình ra cả nghìn km → tile vô dụng).
  4. Xếp nhóm level KHÔNG ghi năm (DAT_...) xuống CUỐI file. QGIS vẽ theo thứ tự trong file,
     nên nằm cuối = vẽ sau = nằm trên. Đây là phần chia nhỏ chi tiết bên trong khu ở,
     đúng ra phải nằm đè lên khối lớn.

Cách gọi:
    python 2-dxf-them-mau.py <vao.geojson> <ra.geojson> [minx,miny,maxx,maxy] [màu-cần-bỏ]

Ô cuối "màu-cần-bỏ" (vd `#000000`, nhiều màu thì cách nhau dấu phẩy): có bản vẽ dùng màu đen
để vẽ KÝ HIỆU và nét chữ chứ không phải ô đất — ở QĐ893 có 3.370 mảnh đen như vậy, mảnh giữa
chỉ rộng 7 m². Không bỏ đi thì bản đồ rỗ đen chi chít.

Khung bao ở cuối là TUỲ CHỌN nhưng NÊN DÙNG. Chạy lần đầu không có khung, xem nó báo khung
bao thật ra bao nhiêu; thấy có vùng vẽ lỗi văng ra xa thì chạy lại lần hai kèm khung ôm sát.
Vì sao quan trọng: chỉ MỘT vùng vẽ sai toạ độ cũng kéo khung cắt tile rộng gấp đôi,
tức là mất gấp đôi thời gian để sinh ra một đống ô trống trơn.
"""
import io
import json
import re
import sys

# Khung bao rộng của tỉnh Khánh Hoà — chỉ dùng để loại nét rác, không phải để cắt.
KHUNG = (108.5, 11.5, 109.8, 13.2)
MAU_MAC_DINH = '#9aa0a6'   # xám: vùng không có màu trong bản vẽ


def sua_ma_chu(s):
    """Tên level tiếng Việt lưu UTF-8 nhưng bị đọc kiểu cp1252 → 'ĐVO mới' thành 'ÄVO má»i'."""
    try:
        return s.encode('cp1252').decode('utf-8')
    except Exception:
        return s


# ── LEVEL KHÔNG PHẢI NỘI DUNG QUY HOẠCH — BỎ HẲN, đừng đưa lên bản đồ ──────────
# Bản vẽ CAD chứa nhiều thứ chỉ phục vụ việc IN RA GIẤY hoặc để người vẽ tự kiểm, không phải
# thông tin quy hoạch. Đưa lên web là rối mắt mà chẳng nói lên điều gì:
#   · 'ban kinh 500m'  — vòng tròn bán kính phục vụ, đường kính ~1000 m, màu xanh lơ.
#                        Riêng QĐ2101 có 53 vòng, phủ kín bản đồ.
#   · 'check…'         — level nháp người vẽ dùng để tự đối chiếu ('check dai han theo qhc')
#   · 'NET KHONG IN'   — chính tên nó đã ghi là nét không in
#   · 'khung ten', 'chu giai' — khung tên và bảng chú giải của tờ bản vẽ giấy
BO_LEVEL = ('ban kinh', 'bankinh', 'check', 'khong in', 'khungten', 'khung ten',
            'chugiai', 'chu giai', 'tenbanve', 'ten ban ve')


def bo_level(lv):
    s = (lv or '').lower()
    return any(k in s for k in BO_LEVEL)


def nhom(lv):
    if lv.startswith('HT_'):    return 'HT'
    if lv.startswith('QH2030'): return 'QH2030'
    if lv.startswith('QH2045'): return 'QH2045'
    if lv.startswith('QHDD'):   return 'QHDD'
    return 'DAT'


def toa_do(g):
    xs, ys = [], []
    def di(o):
        if isinstance(o, list):
            if o and isinstance(o[0], (int, float)):
                xs.append(o[0]); ys.append(o[1])
            else:
                for i in o: di(i)
    di(g.get('coordinates'))
    return xs, ys


def main(vao, ra, khung=KHUNG, bo_mau=()):
    d = json.load(io.open(vao, encoding='utf-8'))
    giu, bo_ngoai, khong_mau, bo_theo_mau = [], 0, 0, 0
    bo_rac = 0
    bo_ten = []
    KHUNG_ = khung
    BO_MAU = set(x.lower() for x in bo_mau)
    for f in d.get('features', []):
        p = f.get('properties') or {}
        g = f.get('geometry')
        if not g:
            continue
        xs, ys = toa_do(g)
        if not xs:
            continue
        if (min(xs) < KHUNG_[0] or max(xs) > KHUNG_[2] or min(ys) < KHUNG_[1] or max(ys) > KHUNG_[3]):
            bo_ngoai += 1
            bo_ten.append(sua_ma_chu(p.get('Layer') or '?'))
            continue
        if bo_level(sua_ma_chu(p.get('Layer') or '')):
            bo_rac += 1
            continue
        st = p.get('OGR_STYLE') or ''
        # Vùng tô dùng BRUSH(fc:#...), còn NÉT VẼ dùng PEN(c:#...). Phải thử 'fc:' TRƯỚC,
        # vì chuỗi 'fc:' cũng chứa 'c:' — tìm 'c:' trước là bắt nhầm.
        m = re.search(r'fc:(#[0-9a-fA-F]{6})', st) or re.search(r'[(,]c:(#[0-9a-fA-F]{6})', st)
        if m and m.group(1).lower() in BO_MAU:
            bo_theo_mau += 1
            continue
        if not m:
            # KHÔNG tô xám mặc định nữa. Hình không có màu trong bản vẽ nghĩa là nó KHÔNG được tô —
            # chỉ là nét bao. Tô xám vào là BỊA ra một mảng đất không có thật: ở QĐ893 có 101 hình
            # như vậy, mảng to nhất 5.359 m², hiện lên bản đồ thành những vệt xám giữa khu dân cư.
            khong_mau += 1
            continue
        lv = sua_ma_chu(p.get('Layer') or '')
        f['properties'] = {'lo': lv, 'c': (m.group(1).lower() if m else MAU_MAC_DINH), 'hz': nhom(lv)}
        giu.append(f)

    # ⚠️ SẮP XẾP: MẢNG TO VẼ TRƯỚC, MẢNG NHỎ VẼ SAU (nằm trên).
    # QGIS vẽ theo đúng thứ tự trong file. Không sắp thì mảng to vẽ sau che sạch chi tiết:
    # ở QĐ893 có mảng rộng 6.010 ha nằm ở vị trí 9568/10479, vẽ gần cuối nên trùm kín cả vùng,
    # bản đồ chỉ còn vài mảng màu khổng lồ. Sắp theo diện tích giảm dần là hết.
    # Cách này cũng thay luôn quy tắc cũ "nhóm DAT_ xuống cuối" — mấy ô chia nhỏ trong khu ở
    # vốn đã nhỏ nên tự động nằm cuối, tức là nằm trên.
    def co_lon(f):
        t = 0.0
        g = f.get('geometry') or {}
        kieu = g.get('type')
        khoi = [g.get('coordinates')] if kieu == 'Polygon' else (g.get('coordinates') or [])
        if kieu not in ('Polygon', 'MultiPolygon'):
            return 0.0
        for poly in khoi:
            r = (poly or [None])[0]
            if not r or len(r) < 4:
                continue
            s2 = 0.0
            for i in range(len(r)):
                s2 += r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1]
            t += abs(s2) / 2
        return t
    giu.sort(key=co_lon, reverse=True)

    d['features'] = giu
    with io.open(ra, 'w', encoding='utf-8') as fp:
        json.dump(d, fp, ensure_ascii=False)

    from collections import Counter
    c = Counter(x['properties']['hz'] for x in giu)
    print('Giữ lại %d hình | bỏ %d ngoài khung | bỏ %d theo màu | bỏ %d level không phải quy hoạch | BỎ %d hình không có màu'
          % (len(giu), bo_ngoai, bo_theo_mau, bo_rac, khong_mau))
    if bo_ten:
        print('  Các vùng bị bỏ: ' + ' · '.join('%s x%d' % (k, v) for k, v in Counter(bo_ten).most_common(5)))
    print('Theo nhóm: ' + ' · '.join('%s %d' % (k, v) for k, v in c.most_common()))
    print('Số màu khác nhau: %d' % len(set(x['properties']['c'] for x in giu)))
    xs = [b for f in giu for b in (toa_do(f['geometry'])[0])]
    ys = [b for f in giu for b in (toa_do(f['geometry'])[1])]
    if xs:
        print('KHUNG BAO SAU KHI LỌC: %.4f,%.4f,%.4f,%.4f' % (min(xs), min(ys), max(xs), max(ys)))
    print('>>> Đã ghi: %s' % ra)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    k = KHUNG
    if len(sys.argv) > 3 and sys.argv[3].strip():
        k = tuple(float(x) for x in sys.argv[3].split(','))
    bm = tuple(x.strip() for x in sys.argv[4].split(',')) if len(sys.argv) > 4 else ()
    main(sys.argv[1], sys.argv[2], k, bm)
