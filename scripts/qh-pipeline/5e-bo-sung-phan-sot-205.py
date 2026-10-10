# -*- coding: utf-8 -*-
"""
BỔ SUNG PHẦN VÙNG TÔ QĐ205 BỊ SÓT (10/10/2026).

Dựng MỌI vùng tô của bản vẽ gốc (quyhoach2025/QD205.gpkg lớp `hatches`) theo LUẬT CHẴN–LẺ (đúng cách MicroStation tô — GDAL đọc
vòng 1 = ngoài, còn lại = lỗ là SAI với vùng tô nhiều vòng lồng nhau), so với ô đất web (qh_zones.json): phần vùng tô CHƯA CÓ Ô
NÀO PHỦ trước đây bị tính là khe hở → "Đất giao thông". Vd thửa 4 tờ 22 Cam Hiệp nằm giữa khối "Đơn vị ở mật độ thấp đến năm 2045"
(ảnh quy hoạch tô rõ) mà web ghi cả thửa là đường.

Loại đất của phần bổ sung = loại đất CHIẾM NHIỀU NHẤT trong các ô web đang phủ CHÍNH vùng tô đó (không đoán theo tên lớp);
vùng tô chưa có ô nào phủ thì bỏ qua (không biết loại). Bỏ lớp khung / ranh / ký hiệu và mảnh ngoài khung Cam Lâm.
Đánh dấu 'bs205c' để chạy lại không nhân đôi.
Cách gọi:  python 5e-bo-sung-phan-sot-205.py <hatch205_all.geojson>   (xuất bằng ogr2ogr -nlt CONVERT_TO_LINEAR, xem 5d)
"""
import io, json, os, sys, importlib.util, collections
from shapely.geometry import Polygon
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'apps', 'backend', 'data', 'qh_zones.json')
DAU = 'bs205c'
BO_LOP = ('khung', 'ranh', 'kyhieu', 'ky hieu', 'bendulich', 'net-', 'text', 'chu giai', 'chugiai')
spec = importlib.util.spec_from_file_location('b1', os.path.join(HERE, '1b-doc-dxf.py')); b1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(b1)


def chan_le(g):
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    kq = None
    for p in polys:
        for r in p:
            if len(r) < 4: continue
            v = Polygon([(x, y) for x, y, *_ in r]).buffer(0)
            kq = v if kq is None else kq.symmetric_difference(v)
    return kq


def main(vao):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    Z = [e for e in json.load(io.open(OUT, encoding='utf-8')) if not (len(e) > 8 and e[8] == DAU)]
    ZP = [make_valid(Polygon(e[4])) for e in Z]; ZT = STRtree(ZP)
    wgs = lambda g: transform(lambda x, y, z=None: tuple(zip(*[b1.vn2wgs(a, b) for a, b in zip(x, y)])), g)
    them = []; theo_loai = collections.Counter()
    for ft in json.load(io.open(vao, encoding='utf-8'))['features']:
        g = ft['geometry']; lv = ((ft['properties'] or {}).get('layer') or '')
        if not g or any(k in lv.lower() for k in BO_LOP): continue
        kq = chan_le(g)
        if kq is None or kq.area < 50: continue
        w = make_valid(wgs(kq))
        x0, y0, x1, y1 = w.bounds
        if not (108.9 < x0 and x1 < 109.3 and 11.9 < y0 and y1 < 12.25): continue
        idx = list(ZT.query(w))
        if not idx: continue
        dt = collections.Counter(); bac = {}
        for i in idx:
            a = w.intersection(ZP[i]).area
            if a > 0: dt[Z[i][5]] += a; bac[Z[i][5]] = Z[i][7]
        if not dt: continue
        loai, a_max = dt.most_common(1)[0]
        if a_max < 0.5 * w.area * 0 + 0.3 * sum(dt.values()): continue   # loại chiếm nhiều nhất phải ≥ 30 % phần đã phủ
        con = w.difference(unary_union([ZP[i] for i in idx]))
        for p in (con.geoms if hasattr(con, 'geoms') else [con]):
            if p.geom_type != 'Polygon' or p.area * 1.21e10 < 50: continue
            # mảnh dài mảnh (bề rộng quy đổi < 3 m) = chỗ vẽ chưa khít giữa 2 ô → bỏ, để luật khe hở lo
            if 2 * p.area / p.length * 111000 < 3: continue
            p = Polygon(p.exterior); bx0, by0, bx1, by1 = p.bounds
            them.append([round(bx0, 7), round(by0, 7), round(bx1, 7), round(by1, 7),
                         [[round(x, 7), round(y, 7)] for x, y in p.exterior.coords], loai, p.area, bac[loai], DAU])
            theo_loai[loai] += p.area * 1.21e10 / 1e4
    Z += them
    json.dump(Z, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('them %d manh, %.1f ha' % (len(them), sum(theo_loai.values())))
    for k, v in theo_loai.most_common(): print('   %-35s %.2f ha' % (k, v))


if __name__ == '__main__':
    main(sys.argv[1])
