# -*- coding: utf-8 -*-
"""
BỔ SUNG MẶT NƯỚC / SÔNG SUỐI QĐ205 BỊ SÓT (10/10/2026).

Đối chiếu 1.947 vùng tô của bản vẽ gốc (quyhoach2025/QD205.gpkg lớp `hatches`) với ô đất web (qh_zones.json): mọi lớp được
phủ ≥ 98,5 % trừ vài AO/HỒ nhỏ (lớp Matnuoc_hoaodam, ~1,6 ha) và một vùng QHDD_DAT_NN_Songsuoi 505 ha trên mặt nước.
Chỗ sót đó web từng coi là khe hở → "Đất giao thông" (thửa 209 tờ 3 Suối Dầu: cái ao giữa ruộng ghi thành đường).

Script chỉ thêm PHẦN CHƯA CÓ Ô NÀO PHỦ của các vùng tô đó (không đè ô sẵn có), đánh dấu 'bs205b' để chạy lại không nhân đôi.
Cần file vùng tô đã đổi sang đường thẳng:  ogr2ogr -f GeoJSON -nlt CONVERT_TO_LINEAR -dim XY hatch205_all.geojson QD205.gpkg hatches -select layer,color
Cách gọi:  python 5d-bo-sung-mat-nuoc-205.py <hatch205_all.geojson>
"""
import io, json, os, sys, importlib.util
from shapely.geometry import shape, Polygon, mapping
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'apps', 'backend', 'data', 'qh_zones.json')
LOP = {'Matnuoc_hoaodam': 'Mặt nước', 'QHDD_DAT_NN_Songsuoi': 'Sông suối'}
DAU = 'bs205b'
spec = importlib.util.spec_from_file_location('b1', os.path.join(HERE, '1b-doc-dxf.py')); b1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(b1)


def main(vao):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    Z = [e for e in json.load(io.open(OUT, encoding='utf-8')) if not (len(e) > 8 and e[8] == DAU)]
    bac = {t: max([e[7] for e in Z if e[5] == t] or [2]) for t in set(LOP.values())}
    ZP = [make_valid(Polygon(e[4])) for e in Z]; ZT = STRtree(ZP)
    wgs = lambda g: transform(lambda x, y, z=None: tuple(zip(*[b1.vn2wgs(a, b) for a, b in zip(x, y)])), g)
    them = []
    for ft in json.load(io.open(vao, encoding='utf-8'))['features']:
        lv = (ft['properties'] or {}).get('layer') or ''
        if lv not in LOP or not ft['geometry']: continue
        g = make_valid(wgs(make_valid(shape(ft['geometry']))))
        idx = ZT.query(g)
        con = g.difference(unary_union([ZP[i] for i in idx])) if len(idx) else g
        for p in (con.geoms if hasattr(con, 'geoms') else [con]):
            if p.geom_type != 'Polygon' or p.area * 1.21e10 < 50: continue
            if not (108.9 < p.bounds[0] and p.bounds[2] < 109.3 and 11.9 < p.bounds[1] and p.bounds[3] < 12.25): continue   # rác ngoài khung (khung bản vẽ / chú giải)
            p = Polygon(p.exterior)   # mảnh sót không lỗ (lỗ = ô đất đã có, được ưu tiên vì ô nhỏ hơn / bậc cao hơn)
            x0, y0, x1, y1 = p.bounds
            them.append([round(x0, 7), round(y0, 7), round(x1, 7), round(y1, 7),
                         [[round(x, 7), round(y, 7)] for x, y in p.exterior.coords], LOP[lv], p.area, bac[LOP[lv]], DAU])
    Z += them
    json.dump(Z, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('them %d manh, %.1f ha' % (len(them), sum(t[6] for t in them) * 1.21e10 / 1e4))


if __name__ == '__main__':
    main(sys.argv[1])
