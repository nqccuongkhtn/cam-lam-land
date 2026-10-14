# -*- coding: utf-8 -*-
"""
BỔ SUNG VÙNG TÔ QĐ893 BỊ HỎNG VIỀN (11/10/2026).

Đối chiếu đáp án đo trên bản vẽ với web (2.448 thửa): thửa 250 tờ 1 Cam An bị ghi 6.175 m² "Nằm ngoài phạm vi" dù nằm
giữa huyện. Soi bản vẽ gốc: khu "Điện mặt trời Miền Trung" (ký hiệu DNL) CÓ TÔ MÀU, nhưng đường viền vùng tô là
233 đoạn nối đuôi nhau (không phải một vòng khép kín) → GDAL không dựng được thành vùng, đọc ra thành NÉT, và
dữ liệu web thủng một lỗ 68 ha. Cả bản vẽ có đúng 4 vùng tô kiểu này (78,3 ha), sót TRỌN cả 4.

Script dựng lại 4 vùng đó — và (bản 2, cùng ngày) bổ sung luôn MỌI phần vùng tô chưa có ô nào phủ: 5b bỏ trọn vùng tô "chỉ có màu"
khi một ô có mã đè lên MỘT PHẦN của nó, phần còn lại thành lỗ (thửa 187 tờ 1 Suối Dầu 2.366 m², thửa 221 tờ 3 Suối Dầu 3.334 m² bị ghi
"ngoài phạm vi"). Đầu vào lúc này là TẤT CẢ vùng tô (bỏ Level 56 = khung chú dẫn), xem lệnh ogr2ogr dưới.
Cách dựng 4 vùng hỏng viền (nới 1 cm cho các đoạn khít lại, rồi chẵn–lẻ giữa các vòng = đúng cách CAD tô), đặt tên
y hệt luật của 5b-tao-qh-zones-893.py (không đoán):
  b. mã QUY HOẠCH (Level 34) bên trong → mã đó;  d. mã HIỆN TRẠNG (Level 33) hợp màu → mã đó;  e. còn lại → tên nhóm màu, bậc 0.
Chỉ thêm PHẦN CHƯA CÓ Ô NÀO PHỦ, đánh dấu 'bs893a' nên chạy lại không nhân đôi. Chạy lại 5b thì phải chạy lại script này.

Cách gọi (lấy riêng các vùng tô hỏng bằng ogr2ogr — nhẹ RAM, không cần đọc cả file bằng ezdxf):
  ogr2ogr -f GeoJSON h893_mau.geojson "QD893 QHSDD2030.dxf" -sql "SELECT Layer, EntityHandle, OGR_STYLE
      FROM entities WHERE SubClasses LIKE '%Hatch%' AND Layer <> 'Level 56'" -nlt CONVERT_TO_LINEAR -dim XY
  python 5f-bo-sung-vung-to-hong-893.py h893_mau.geojson ../../quyhoach2025/qd893_chu.geojson
"""
import io, json, os, re, sys, importlib.util
from shapely.geometry import shape, Polygon, Point
from shapely.ops import unary_union, transform
from shapely.strtree import STRtree
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'apps', 'backend', 'data', 'qh_zones_893.json')
DAU = 'bs893a'
def nap(ten, tep):
    sp = importlib.util.spec_from_file_location(ten, os.path.join(HERE, tep)); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m); return m
b1 = nap('b1', '1b-doc-dxf.py'); b5 = nap('b5', '5b-tao-qh-zones-893.py')


def main(vao, tep_chu):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    Z = [e for e in json.load(io.open(OUT, encoding='utf-8')) if not (len(e) > 8 and e[8] == DAU)]
    ZP = [make_valid(Polygon(e[4])) for e in Z]; ZT = STRtree(ZP)
    CHU = [(Point(f['geometry']['coordinates'][:2]), (f['properties'].get('Text') or '').strip().upper(), f['properties'].get('lo'))
           for f in json.load(io.open(tep_chu, encoding='utf-8'))['features']]
    wgs = lambda g: transform(lambda x, y, z=None: tuple(zip(*[b1.vn2wgs(a, c) for a, c in zip(x, y)])), g)
    # khung cả bản vẽ (theo các ô đã có) — để nhận ra DẢI VIỀN RANH HUYỆN (15/10/2026, b5.la_vien_ranh): 5b đã bỏ dải này; không bỏ ở đây
    # thì cả dải "chưa có ô nào phủ" và bị bổ sung lại thành "Đất ở".
    KHUNG = (min(e[0] for e in Z), min(e[1] for e in Z), max(e[2] for e in Z), max(e[3] for e in Z))
    them = []
    for f in json.load(io.open(vao, encoding='utf-8'))['features']:
        m = re.search(r'#[0-9a-fA-F]{6}', f['properties'].get('OGR_STYLE') or '')
        if not m: continue
        mau = m.group(0).lower()
        if mau == '#ffffff': continue   # màu ký hiệu, 1b cũng bỏ
        if (f['properties'].get('Layer') or '') == 'Level 56': continue   # khung chú dẫn, không phải đất
        try:
            g0 = shape(f['geometry'])
        except Exception:
            # vùng tô lẫn VÒNG HỎNG (< 4 điểm) → đọc cả hình bị lỗi và cả vùng bị bỏ (C096E0, 2,2 ha đất công cộng ở Cam Hòa):
            # bỏ vòng hỏng, dựng các vòng còn lại theo chẵn–lẻ
            g = f['geometry']; kq = None
            for r in [r for p in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]) for r in p if len(r) >= 4]:
                v = Polygon(r).buffer(0); kq = v if kq is None else kq.symmetric_difference(v)
            g0 = None
        if g0 is None:
            pass
        elif 'LineString' in g0.geom_type:   # viền hỏng: nới 1 cm cho khít rồi chẵn–lẻ
            b = unary_union(g0.buffer(0.01)); kq = None
            for v in sorted([Polygon(p.exterior) for p in getattr(b, 'geoms', [b])], key=lambda p: -p.area):
                kq = v if kq is None else kq.symmetric_difference(v)
        else:
            kq = make_valid(g0)
        if kq is None or kq.area < 500: continue
        W = make_valid(wgs(kq))
        x0, y0, x1, y1 = W.bounds
        if not (108.9 < x0 and x1 < 109.3 and 11.9 < y0 and y1 < 12.25): continue
        if b5.la_vien_ranh(W.bounds, W.area, KHUNG): print('  bỏ dải viền ranh huyện', f['properties'].get('EntityHandle')); continue
        idx = ZT.query(W)
        con = W.difference(unary_union([ZP[i] for i in idx])) if len(idx) else W
        # chỉ giữ mảnh sót ≥ 500 m² và rộng ≥ 3 m (mảnh mỏng = chỗ vẽ chưa khít giữa 2 ô, không phải đất bị mất)
        con = unary_union([p for p in getattr(con, 'geoms', [con]) if p.geom_type == 'Polygon' and p.area * 1.21e10 >= 500
                           and 2 * p.area / p.length * 111000 >= 3])
        if con.is_empty: continue
        # chữ / ký hiệu chỉ lấy trong PHẦN SÓT — lấy cả vùng tô thì vớ nhầm chữ của ô nhỏ lồng bên trong (5b gán chữ cho ô NHỎ NHẤT)
        qh = [t for p, t, l in CHU if l == b5.LV_QH and t in b5.TEN and con.contains(p)]
        ht = [t for p, t, l in CHU if l == b5.LV_HT and t in b5.TEN and con.contains(p) and b5.hop_mau(t, mau)]
        if mau in b5.MAU_893: loai, bac = b5.MAU_893[mau], 2   # a. màu đường / sông (như 5b)
        elif qh: loai, bac = b5.TEN[([x for x in qh if b5.hop_mau(x, mau)] or qh)[0]], 2
        elif ht: loai, bac = b5.TEN[ht[0]], 2
        elif mau in b5.NHIEU_MA: loai, bac = b5.ten_nhieu_ma(b5.NHIEU_MA[mau]), 0   # màu chú dẫn dùng chung nhiều mã (như 5b)
        else:    loai, bac = b5.NHOM_MAU.get(mau, 'Loại đất khác'), 0
        for p in b5.tach_lo(con):
            if p.area * 1.21e10 < 50: continue
            r = [[round(c[0], 8), round(c[1], 8)] for c in p.exterior.coords]
            x0, y0, x1, y1 = p.bounds
            them.append([round(x0, 8), round(y0, 8), round(x1, 8), round(y1, 8), r, loai, p.area, bac, DAU])
        print('  %s %s  %.1f ha → %s (bậc %d)' % (f['properties'].get('EntityHandle'), mau, con.area * 1.21e10 / 1e4, loai, bac))
    Z += them
    json.dump(Z, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('them %d manh' % len(them))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
