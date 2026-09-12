# -*- coding: utf-8 -*-
"""
ĐỌC THẲNG FILE DXF QUY HOẠCH → GeoJSON (WGS84).  Thay cho bước 1 + 2 cũ.

VÌ SAO PHẢI VIẾT LẠI: bước cũ đi qua ogr2ogr, và ogr2ogr LÀM RƠI những level có tên
tiếng Việt có dấu. Đo trên ba bản vẽ:

    QĐ2101 :  22 / 1.706 vùng tô bị mất   (gồm level 'QHDD_mặt nước sử dụng công cộng_DVO')
    QĐ2076 : 416 / 2.064 vùng tô bị mất   ← mất 20%
    QĐ2222 :  15 /   633 vùng tô bị mất

Hậu quả thấy được: thửa tờ 14 thửa 122 (Cam Thành Bắc) có 1.084 m² là MẶT NƯỚC trong bản vẽ,
nhưng web báo "nằm ngoài phạm vi quy hoạch" vì cả level mặt nước đã biến mất.

Bản này đọc HATCH (vùng tô) thẳng từ DXF nên giữ đúng tên level tiếng Việt, giữ đúng màu gốc,
và tự đổi VN-2000 (KTT 108°15', múi 3°, k=0.9999) → WGS84 bằng phép Helmert 7 tham số.

Cách gọi:
    python 1b-doc-dxf.py <vao.dxf> <ra.geojson> [màu-cần-bỏ,màu-cần-bỏ...] [--bang=<bảng màu>]

Ô cuối "màu-cần-bỏ": có bản vẽ dùng một màu để vẽ KÝ HIỆU / nét chữ chứ không phải ô đất.
QĐ893 có 3.384 mảnh màu trắng kiểu này (bản cũ đọc ra màu đen, cũng bị bỏ y như vậy) — không bỏ
thì bản đồ rỗ chi chít và phần tra cứu đếm nhầm chúng là ô đất. Ví dụ:
    python 1b-doc-dxf.py "QD893 QHSDD2030.dxf" qd893_qh.geojson "#ffffff"
"""
import io
import json
import math
import os
import sys

import ezdxf
from ezdxf import path as ezpath
from ezdxf import colors as ezcolors

# ── BẢNG MÀU: CHỌN ĐƯỢC ──────────────────────────────────────────────────────
# Bản vẽ CAD KHÔNG ghi màu thật, nó chỉ ghi SỐ HIỆU MÀU (1–255). Muốn biết số 42 là màu gì
# thì phải tra vào một "bảng màu". Đây là chỗ dễ sai nhất mà không hề báo lỗi:
#   · AutoCAD và MicroStation có bảng màu KHÁC NHAU — cùng số 42, AutoCAD cho nâu xỉn
#     #a57c00 còn MicroStation (bảng acadcolor) cho vàng nhạt #ffdf7f.
#   · Bản vẽ quy hoạch ở đây vẽ bằng MicroStation, nhưng trước đây web tra theo bảng
#     AutoCAD → toàn bộ bản đồ bị XỈN/ĐỤC so với lúc mở bằng chương trình gốc.
#   · File DGN gốc KHÔNG nhúng bảng màu nào (đã quét cả 3 file, không có) nên phải chọn tay.
# Các bảng .tbl trong thư mục bang-mau/ lấy từ chính máy có MicroStation V8i, mỗi file
# đúng 768 byte = 256 ô × 3 byte đỏ-lục-lam.
BANG_MAU_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bang-mau')
TEN_BANG_MAU = 'autocad'      # đổi bằng tham số --bang=<tên>


def nap_bang_mau(ten):
    """Trả về danh sách 256 chuỗi '#rrggbb'. Tên 'autocad' = bảng sẵn trong ezdxf."""
    if ten in ('autocad', 'aci', ''):
        return ['#%06x' % (ezcolors.DXF_DEFAULT_COLORS[i] & 0xFFFFFF) for i in range(256)]
    f = os.path.join(BANG_MAU_DIR, ten + '.tbl')
    if not os.path.isfile(f):
        co = sorted(x[:-4] for x in os.listdir(BANG_MAU_DIR) if x.endswith('.tbl'))
        raise SystemExit('Không có bảng màu "%s". Đang có: autocad, %s' % (ten, ', '.join(co)))
    b = open(f, 'rb').read()
    if len(b) != 768:
        raise SystemExit('File bảng màu %s phải đúng 768 byte, file này %d byte' % (f, len(b)))
    return ['#%02x%02x%02x' % tuple(b[i * 3:i * 3 + 3]) for i in range(256)]


BANG = nap_bang_mau(TEN_BANG_MAU)

# ── Đổi toạ độ VN-2000 Khánh Hoà → WGS84 (cùng bộ số với 1-convert-dgn.sh) ────
A = 6378137.0
F = 1 / 298.257223563
E2 = F * (2 - F)
DX, DY, DZ = -191.90441429, -39.30318279, -111.45032835
RX, RY, RZ = -0.00928836, 0.01975479, -0.00427372      # giây cung
S_PPM = 0.252906278
LON0 = math.radians(108.25)
K0, E0 = 0.9999, 500000.0


def tm_nguoc(E, N):
    """Toạ độ phẳng → kinh/vĩ độ trên ellipsoid (ngược phép Transverse Mercator)."""
    e1 = (1 - math.sqrt(1 - E2)) / (1 + math.sqrt(1 - E2))
    M = N / K0
    mu = M / (A * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu))
    C1 = (E2 / (1 - E2)) * math.cos(phi1) ** 2
    T1 = math.tan(phi1) ** 2
    N1 = A / math.sqrt(1 - E2 * math.sin(phi1) ** 2)
    R1 = A * (1 - E2) / (1 - E2 * math.sin(phi1) ** 2) ** 1.5
    D = (E - E0) / (N1 * K0)
    lat = phi1 - (N1 * math.tan(phi1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1
                                                            - 9 * E2 / (1 - E2)) * D ** 4 / 24)
    lon = LON0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6) / math.cos(phi1)
    return lon, lat


def _ecef(lon, lat):
    N = A / math.sqrt(1 - E2 * math.sin(lat) ** 2)
    return (N * math.cos(lat) * math.cos(lon), N * math.cos(lat) * math.sin(lon),
            N * (1 - E2) * math.sin(lat))


def _geo(X, Y, Z):
    lon = math.atan2(Y, X)
    p = math.hypot(X, Y)
    lat = math.atan2(Z, p * (1 - E2))
    for _ in range(8):
        N = A / math.sqrt(1 - E2 * math.sin(lat) ** 2)
        lat = math.atan2(Z + E2 * N * math.sin(lat), p)
    return lon, lat


def vn2wgs(E, N):
    lon, lat = tm_nguoc(E, N)
    X, Y, Z = _ecef(lon, lat)
    rx, ry, rz = (math.radians(v / 3600) for v in (RX, RY, RZ))
    s = 1 + S_PPM / 1e6
    Xn = DX + s * (X - rz * Y + ry * Z)
    Yn = DY + s * (rz * X + Y - rx * Z)
    Zn = DZ + s * (-ry * X + rx * Y + Z)
    lo, la = _geo(Xn, Yn, Zn)
    return math.degrees(lo), math.degrees(la)


# ── Level không phải nội dung quy hoạch (giống bước 2 cũ) ─────────────────────
BO_LEVEL = ('ban kinh', 'bankinh', 'check', 'khong in', 'khungten', 'khung ten',
            'chugiai', 'chu giai', 'tenbanve', 'ten ban ve')
KHUNG = (108.5, 11.5, 109.8, 13.2)      # khung Khánh Hoà, loại nét rác văng ra xa


def bo_level(lv):
    s = (lv or '').lower()
    return any(k in s for k in BO_LEVEL)


def nhom(lv):
    if lv.startswith('HT_'):    return 'HT'
    if lv.startswith('QH2030'): return 'QH2030'
    if lv.startswith('QH2045'): return 'QH2045'
    if lv.startswith('QHDD'):   return 'QHDD'
    return 'DAT'


def mau(e, doc):
    """Màu tô của đối tượng → #rrggbb.

    ⚠️ PHẢI XỬ LÝ MÀU "THEO LỚP". Trong CAD, một hình có thể không tự khai màu mà ghi
    `BYLAYER` (mã 256) hoặc `BYBLOCK` (mã 0) — nghĩa là "lấy màu của level chứa nó".
    Quên bước này thì hình ra TRẮNG hết: đo thật, QĐ2076 có 2.027/2.225 vùng và QĐ2222 có
    404/670 vùng khai BYLAYER, bỏ qua là bản đồ trắng xoá gần hết.
    """
    tc = e.dxf.get('true_color', None)
    if tc:
        return '#%06x' % (tc & 0xFFFFFF)
    ci = e.dxf.get('color', 256)
    if ci in (0, 256):                       # BYBLOCK / BYLAYER → hỏi level
        try:
            lay = doc.layers.get(e.dxf.layer)
            ltc = getattr(lay.dxf, 'true_color', None)
            if ltc:
                return '#%06x' % (ltc & 0xFFFFFF)
            ci = abs(int(lay.color))         # level tắt hiển thị thì màu ghi số âm
        except Exception:
            ci = 7
    if ci in (0, 256) or ci < 1 or ci > 255:
        return '#9aa0a6'
    try:
        return BANG[ci]
    except Exception:
        return '#9aa0a6'


def doc_net(d, msp):
    """Rút LỚP NÉT (đường, chỉ giới, ranh…) — dùng cho việc cắt tile và dựng mặt nạ đường."""
    ra = []
    for e in msp:
        t = e.dxftype()
        try:
            if t == 'LWPOLYLINE':
                pts = [(p[0], p[1]) for p in e.get_points('xy')]
            elif t == 'POLYLINE':
                pts = [(v.dxf.location[0], v.dxf.location[1]) for v in e.vertices]
            elif t == 'LINE':
                pts = [(e.dxf.start[0], e.dxf.start[1]), (e.dxf.end[0], e.dxf.end[1])]
            elif t == 'ARC':
                import math as _m
                a0, a1 = _m.radians(e.dxf.start_angle), _m.radians(e.dxf.end_angle)
                if a1 < a0:
                    a1 += 2 * _m.pi
                n = max(6, int((a1 - a0) / 0.15))
                cx, cy, r = e.dxf.center[0], e.dxf.center[1], e.dxf.radius
                pts = [(cx + r * _m.cos(a0 + (a1 - a0) * i / n), cy + r * _m.sin(a0 + (a1 - a0) * i / n))
                       for i in range(n + 1)]
            else:
                continue
        except Exception:
            continue
        lv = e.dxf.get('layer', '') or ''
        if len(pts) < 2 or bo_level(lv):
            continue
        ring = []
        xau = False
        for x, y in pts:
            lo, la = vn2wgs(x, y)
            if not (KHUNG[0] <= lo <= KHUNG[2] and KHUNG[1] <= la <= KHUNG[3]):
                xau = True
                break
            ring.append([round(lo, 8), round(la, 8)])
        if xau or len(ring) < 2:
            continue
        ra.append({'type': 'Feature', 'properties': {'lo': lv, 'c': mau(e, d), 'hz': nhom(lv)},
                   'geometry': {'type': 'LineString', 'coordinates': ring}})
    return ra


def main(vao, ra, bo_mau=(), lay_net=False):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    d = ezdxf.readfile(vao)
    msp = d.modelspace()
    if lay_net:
        out = doc_net(d, msp)
        print('%s: %d nét' % (vao, len(out)))
        with io.open(ra, 'w', encoding='utf-8') as fp:
            json.dump({'type': 'FeatureCollection', 'features': out}, fp, ensure_ascii=False)
        import os
        print('  >>> %s — %.1f MB' % (ra, os.path.getsize(ra) / 1048576))
        return
    hatch = [e for e in msp if e.dxftype() == 'HATCH']
    print('%s: %d vùng tô (HATCH)' % (vao, len(hatch)))

    out = []
    bo_lv = 0
    bo_ngoai = 0
    loi = 0
    for e in hatch:
        lv = e.dxf.get('layer', '') or ''
        if bo_level(lv):
            bo_lv += 1
            continue
        try:
            duong = list(ezpath.from_hatch(e))
        except Exception:
            loi += 1
            continue
        c = mau(e, d)
        if c in bo_mau:
            bo_lv += 1
            continue
        hz = nhom(lv)
        for p in duong:
            try:
                pts = [(v.x, v.y) for v in p.flattening(distance=0.05, segments=8)]
            except Exception:
                loi += 1
                continue
            if len(pts) < 4:
                continue
            ring = []
            xau = False
            for x, y in pts:
                lo, la = vn2wgs(x, y)
                if not (KHUNG[0] <= lo <= KHUNG[2] and KHUNG[1] <= la <= KHUNG[3]):
                    xau = True
                    break
                ring.append([round(lo, 8), round(la, 8)])
            if xau:
                bo_ngoai += 1
                continue
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            if len(ring) < 4:
                continue
            out.append({'type': 'Feature', 'properties': {'lo': lv, 'c': c, 'hz': hz},
                        'geometry': {'type': 'Polygon', 'coordinates': [ring]}})

    print('  · giữ %d vùng | bỏ %d (level không phải quy hoạch), %d (ra ngoài khung), %d (lỗi hình)'
          % (len(out), bo_lv, bo_ngoai, loi))
    from collections import Counter
    cl = Counter(f['properties']['lo'] for f in out)
    viet = [k for k in cl if any(ord(ch) > 127 for ch in k)]
    print('  · %d level, trong đó %d level có chữ tiếng Việt (bản cũ qua ogr2ogr bị rơi hết)'
          % (len(cl), len(viet)))
    for k in sorted(viet, key=lambda a: -cl[a])[:8]:
        print('        %5d  %s' % (cl[k], k))
    with io.open(ra, 'w', encoding='utf-8') as fp:
        json.dump({'type': 'FeatureCollection', 'features': out}, fp, ensure_ascii=False)
    import os
    print('  >>> %s — %.1f MB' % (ra, os.path.getsize(ra) / 1048576))


if __name__ == '__main__':
    arg = [a for a in sys.argv[1:]]
    # --bang=<tên> chọn bảng màu (xem chú thích BẢNG MÀU ở đầu file). Không ghi thì dùng 'autocad'.
    for a in list(arg):
        if a.startswith('--bang='):
            TEN_BANG_MAU = a.split('=', 1)[1].strip()
            BANG[:] = nap_bang_mau(TEN_BANG_MAU)
            print('Dùng bảng màu: %s' % TEN_BANG_MAU)
            arg.remove(a)
    if len(arg) < 2:
        print(__doc__)
        sys.exit(1)
    main(arg[0], arg[1],
         tuple(x.strip().lower() for x in arg[2].split(',')) if len(arg) > 2 and arg[2] != '--net' else (),
         '--net' in arg)
