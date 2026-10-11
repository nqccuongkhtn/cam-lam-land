# -*- coding: utf-8 -*-
"""
TÌM "LỖ TRỐNG" TRONG RANH LẬP QUY HOẠCH CỦA BẢN PHÂN KHU (11/10/2026).

Web coi khe trắng TRONG ranh phân khu là lòng đường (bản phân khu chỉ tô ô đất, đường để trắng). Nhưng có chỗ bản vẽ để trắng mà
KHÔNG phải đường — web từng ghi "Đất giao thông" cả vùng. Hai lượt tìm, ghi chung vào ranh_qh.json khoá "_lo" = {mã bản: [vòng, ...]};
qhCompute coi điểm trong lỗ là NGOÀI ranh → "Nằm ngoài phạm vi bản quy hoạch này".

LƯỢT 1 — VÙNG TRẮNG RỘNG > 300 m: khe trắng = ranh − mọi ô đất; "co" khe vào 150 m rồi "nở" lại 150 m → đường (dù là hành lang
cao tốc 100–200 m) mất hết, chỉ còn chỗ trắng rộng hơn 300 m theo mọi hướng. Nở thêm 20 m rồi cắt lại theo khe để phủ sát mép ô đất.
Kết quả: chỉ đúng 1 vùng, Na Tia ~1.015 ha của Tây Nam (chủ dự án mở file DGN gốc trong MicroStation xác nhận trống thật; thửa 5
tờ 49 từng bị ghi 129 ha đường).

LƯỢT 2 — VÙNG "TRẮNG TRƠN" RỘNG > 60 m (thêm 11/10/2026 tối): không ô đất VÀ KHÔNG MỘT NÉT VẼ NÀO của bản vẽ gốc (mọi lớp — lấy cả
file nét qd<ma>_net.geojson lẫn file DXF đã dựng ô đất ở bước 5g; Tây Nam: nét đường chỉ có trong file nét, Tây Bắc: chỉ có trong DXF),
rộng hơn 60 m theo mọi hướng, ≥ 0,3 ha. Đường thật luôn có nét mép / tim / chỉ giới chạy trong lòng (đã soi: các hành lang QL1A,
đường sắt của QĐ918 / Tây Bắc rộng 100 m vẫn có nét) → không lọt. Còn lại là dải hở giữa vùng tô và ranh, thung lũng giữa các vùng
rừng… Kết quả: 10 vùng ~20 ha (Tây Nam 4 vùng rừng 10,1 ha: thửa 14 tờ 5 Suối Tân từng bị ghi 2,2 ha đường trong rừng đặc dụng).
Ảnh soi + toạ độ: docs/BAO-CAO-CHU-GIAI-CAN-DUYET.md mục I.

Chạy lại khi dựng lại qh_zones_*.json hoặc ranh_qh.json:  python 7-lo-trong-ranh.py
(cần các file nét quyhoach2025/qd<ma>_net.geojson và DXF trong bảng DXF bên dưới; thiếu file nào thì bỏ lượt 2 của bản đó).
"""
import io, json, math, os, sys
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union
from shapely.affinity import scale
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, '..', '..', 'apps', 'backend', 'data')
QH = os.path.join(HERE, '..', '..', 'quyhoach2025')
M = 1 / 111000          # 1 m theo độ (xấp xỉ, đủ cho việc co/nở)
CO, THEM, NHO_NHAT_HA = 150, 20, 20
# lượt 2
RONG_M, NET_DEM_M, NHO_NHAT_2_HA = 60, 3, 0.3
DXF = {'2076': 'QD2076PKPB 1.2000.dxf', '2101': 'QD2101 TT 1.2000.dxf', '2222': 'QD2222.dxf',
       '918': '1-2000 phan khu Phia Tay (1).dxf', 'cuhin': 'phân khu cù hin 1.2000.dxf',
       'taynam': 'Tay Nam da sua - ban cuoi.dxf', 'taybac': '1-2000 Phan khu Tay Bac.dxf'}


def net_ve(ma, to_m, khung):
    """Mọi nét vẽ (mét, hệ toạ độ cục bộ) của bản `ma` từ file nét geojson + file DXF. None nếu thiếu file."""
    tep_net = os.path.join(QH, 'qd%s_net.geojson' % ma)
    tep_dxf = os.path.join(QH, DXF.get(ma, '-'))
    if not (os.path.exists(tep_net) and os.path.exists(tep_dxf)):
        return None
    net = []
    def them(L):
        b = L.bounds
        if b[2] < khung[0] or b[0] > khung[2] or b[3] < khung[1] or b[1] > khung[3]: return
        net.append(L)
    for f in json.load(io.open(tep_net, encoding='utf-8'))['features']:
        g = f.get('geometry') or {}
        cs = [g['coordinates']] if g.get('type') == 'LineString' else (g['coordinates'] if g.get('type') == 'MultiLineString' else [])
        for c in cs:
            if len(c) >= 2: them(to_m(LineString([p[:2] for p in c])))
    import ezdxf, importlib.util
    sp = importlib.util.spec_from_file_location('b1', os.path.join(HERE, '1b-doc-dxf.py'))
    b1 = importlib.util.module_from_spec(sp); sp.loader.exec_module(b1)
    msp = ezdxf.readfile(tep_dxf).modelspace()
    for e in msp:
        if e.dxftype() not in ('LINE', 'LWPOLYLINE', 'POLYLINE', 'ARC', 'CIRCLE', 'SPLINE', 'ELLIPSE'): continue
        try:
            pts = [b1.vn2wgs(q.x, q.y) for q in ezdxf.path.make_path(e).flattening(1.0)]
        except Exception:
            continue
        if len(pts) >= 2: them(to_m(LineString(pts)))
    return net


def an_toan(f, *a):
    """Phép giao / hiệu của GEOS đôi khi báo lỗi làm tròn — thử lại trên lưới 5 cm."""
    try:
        return make_valid(f(*a))
    except Exception:
        return make_valid(f(*[x.buffer(0) for x in a], grid_size=0.05))


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    tep = os.path.join(D, 'ranh_qh.json')
    R = json.load(io.open(tep, encoding='utf-8'))
    lo = {}
    for ma, ring in R.items():
        if ma.startswith('_') or ma == '205': continue   # QĐ205 có luật khe riêng (trongRanh205)
        Z = json.load(io.open(os.path.join(D, 'qh_zones_%s.json' % ma), encoding='utf-8'))
        U = unary_union([make_valid(Polygon(e[4])) for e in Z if len(e[4]) >= 4])
        ranh = make_valid(Polygon(ring))
        khop = [make_valid(Polygon(v)) for v in (R.get('_khop', {}).get(ma) or [])]
        if khop: ranh = make_valid(ranh.difference(unary_union(khop)))
        trong = ranh.difference(U)
        # ── lượt 1: trắng rộng > 300 m
        g = an_toan(lambda a, b, **k: a.intersection(b, **k), trong.buffer(-CO * M).buffer((CO + THEM) * M), trong)
        ds = [p for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and p.area * 1.21e10 / 1e4 >= NHO_NHAT_HA]
        for p in ds:
            c = p.representative_point()
            print('%-7s lỗ %.1f ha tại %.4f %.4f' % (ma, p.area * 1.21e10 / 1e4, c.x, c.y))
        # ── lượt 2: trắng trơn (không ô, không nét) rộng > 60 m — tính trong hệ mét cục bộ
        lat = ranh.centroid.y
        kx, ky = 111320 * math.cos(math.radians(lat)), 110574.0
        to_m = lambda h: scale(h, xfact=kx, yfact=ky, origin=(0, 0))
        ve_do = lambda h: scale(h, xfact=1 / kx, yfact=1 / ky, origin=(0, 0))
        con = to_m(make_valid(trong.difference(unary_union(ds)) if ds else trong))
        net = net_ve(ma, to_m, con.bounds)
        if net is None:
            print('%-7s (thiếu file nét / DXF — bỏ lượt 2)' % ma)
        else:
            tron = an_toan(lambda a, b, **k: a.difference(b, **k), con, unary_union([l.buffer(NET_DEM_M) for l in net]))
            mo = make_valid(tron.buffer(-RONG_M / 2, join_style=2).buffer(RONG_M / 2, join_style=2))
            g2 = an_toan(lambda a, b, **k: a.intersection(b, **k), mo, tron)
            ds2 = [p for p in getattr(g2, 'geoms', [g2]) if p.geom_type == 'Polygon' and p.area >= NHO_NHAT_2_HA * 1e4]
            for p in ds2:
                c = p.representative_point()
                print('%-7s trắng trơn %.2f ha tại %.6f %.6f' % (ma, p.area / 1e4, c.y / ky, c.x / kx))
            ds += [ve_do(p) for p in ds2]
        if ds:
            lo[ma] = [[[round(x, 7), round(y, 7)] for x, y in p.simplify(0.5 * M).exterior.coords] for p in ds]
    R['_lo'] = lo
    json.dump(R, io.open(tep, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('ghi %d bản có lỗ: %s' % (len(lo), ', '.join('%s %d vùng' % (m, len(v)) for m, v in lo.items())))

if __name__ == '__main__':
    main()
