# -*- coding: utf-8 -*-
"""
TÌM "LỖ TRỐNG" LỚN TRONG RANH LẬP QUY HOẠCH CỦA BẢN PHÂN KHU (11/10/2026).

Web coi khe trắng TRONG ranh phân khu là lòng đường (bản phân khu chỉ tô ô đất, đường để trắng). Nhưng phân khu Tây Nam có
một vùng ~1.000 ha quanh Suối Tà Nia (Na Tia) nằm trong ranh mà KHÔNG TÔ GÌ — chủ dự án mở file DGN gốc trong MicroStation
xác nhận trống thật. Luật cũ biến cả vùng đó thành "Đất giao thông" (thửa 5 tờ 49: 129 ha đường — sai).

Cách tìm (không đoán bằng tay): khe trắng = ranh − mọi ô đất; "co" khe vào 150 m rồi "nở" lại 150 m → đường (dù là hành lang
cao tốc 100–200 m) mất hết, chỉ còn chỗ trắng rộng hơn 300 m theo mọi hướng. Nở thêm 20 m rồi cắt lại theo khe để phủ sát
mép ô đất. Kết quả (11/10/2026): chỉ đúng 1 vùng, Na Tia 1.015 ha — 6 bản phân khu còn lại không có chỗ nào.
Ghi vào ranh_qh.json khoá "_lo" = {mã bản: [vòng, ...]}; qhCompute coi điểm trong lỗ là NGOÀI ranh → "ngoài phạm vi".
Chạy lại khi dựng lại qh_zones_*.json hoặc ranh_qh.json.
"""
import io, json, os, sys
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.validation import make_valid

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'apps', 'backend', 'data')
M = 1 / 111000          # 1 m theo độ (xấp xỉ, đủ cho việc co/nở)
CO, THEM, NHO_NHAT_HA = 150, 20, 20

def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    tep = os.path.join(D, 'ranh_qh.json')
    R = json.load(io.open(tep, encoding='utf-8'))
    lo = {}
    for ma, ring in R.items():
        if ma.startswith('_') or ma == '205': continue   # QĐ205 có luật khe riêng (trongRanh205)
        Z = json.load(io.open(os.path.join(D, 'qh_zones_%s.json' % ma), encoding='utf-8'))
        U = unary_union([make_valid(Polygon(e[4])) for e in Z if len(e[4]) >= 4])
        trong = make_valid(Polygon(ring)).difference(U)
        g = trong.buffer(-CO * M).buffer((CO + THEM) * M).intersection(trong)
        ds = [p for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and p.area * 1.21e10 / 1e4 >= NHO_NHAT_HA]
        for p in ds:
            c = p.representative_point()
            print('%-7s lỗ %.1f ha tại %.4f %.4f' % (ma, p.area * 1.21e10 / 1e4, c.x, c.y))
        if ds:
            lo[ma] = [[[round(x, 7), round(y, 7)] for x, y in p.simplify(0.5 * M).exterior.coords] for p in ds]
    R['_lo'] = lo
    json.dump(R, io.open(tep, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('ghi %d bản có lỗ' % len(lo))

if __name__ == '__main__':
    main()
