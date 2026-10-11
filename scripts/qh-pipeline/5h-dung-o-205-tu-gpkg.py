# -*- coding: utf-8 -*-
"""
DỰNG LẠI Ô ĐẤT QĐ205 (quy hoạch chung đô thị mới Cam Lâm đến 2045) THẲNG TỪ BẢN VẼ GỐC QD205.gpkg (11/10/2026).

Vì sao: ô QĐ205 trên web (apps/backend/data/qh_zones.json) dựng từ đợt chuyển đổi cũ (DGN qua GDAL, đặt tên theo bảng level)
rồi vá thêm 3 đợt từ gpkg (5c / 5d / 5e) — HÌNH ô không cùng nguồn với vùng tô gốc nên lệch ở mép, góc cua:
  · thửa 326 tờ 7 Cam Đức (góc giao lộ): bản vẽ = 1.217,9 m² đất hỗn hợp + 469,1 m² lòng đường, app tham chiếu ghi 1.218,7 +
    468,3 — web ghi 1.185,4 + 501,5 (dư 33 m² đường);
  · so cả bản (rải điểm 20 m khắp ranh): khớp 98,67 %, lệch 593 ha khác tên (lớn nhất 261 ha đất nông nghiệp web ghi "Đất đồi núi"
    — vùng tô bị lấp lỗ), 116 ha web có ô mà bản vẽ không tô; 111 ô web có hình tự cắt nhau.
Bản này: mỗi vùng tô gpkg dựng CHẴN–LẺ đủ mọi vòng (GDAL đọc vòng 1 = ngoài, còn lại = lỗ — sai với đảo trong lỗ) → đổi VN-2000 →
WGS84 (hàm của 1b-doc-dxf.py) → CẮT THEO RANH LẬP QH QĐ205 (ranh_qh.json "205"; 2.036 ha vùng tô vẽ ra ngoài ranh) → cắt mảnh
không lỗ. Tên loại đất theo bảng lop-205.json (lớp không có trong bảng = không phải đất: khung, ký hiệu, nét ranh → bỏ).
Bậc: lớp hiện trạng (HT…, …htrang…) = 1, còn lại = 2; cùng bậc thì vùng tô gốc nhỏ hơn nằm trên (diện tích xếp = vòng ngoài vùng tô
gốc, không phải mảnh). Các lớp hiện trạng / 2030 / 2045 hầu như không chồng nhau khác tên (đo: ~14 ha cả bản) nên thứ tự lớp
không làm đổi kết quả. Thay luôn 5c / 5d / 5e (chúng chỉ vá chỗ ô cũ thiếu so với gpkg).

Cách gọi (xuất vùng tô gpkg bằng ogr2ogr của QGIS rồi dựng):
  ogr2ogr -f GeoJSON h205.geojson quyhoach2025/QD205.gpkg hatches -nlt CONVERT_TO_LINEAR -dim XY -select handle,layer
  python 5h-dung-o-205-tu-gpkg.py h205.geojson
Ghi đè apps/backend/data/qh_zones.json.
"""
import io, json, os, sys, importlib.util, collections
from shapely.geometry import Polygon, MultiPolygon, GeometryCollection, box
from shapely.ops import transform
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'apps', 'backend', 'data')
sp = importlib.util.spec_from_file_location('b1', os.path.join(HERE, '1b-doc-dxf.py')); b1 = importlib.util.module_from_spec(sp); sp.loader.exec_module(b1)


def sua_chu(s):
    """Tên lớp tiếng Việt bị đọc nhầm bảng mã ('_X_ÄVO má»›iTB_2030' = '_X_ĐVO mớiTB_2030')."""
    try: return s.encode('cp1252').decode('utf-8')
    except Exception: return s


def bac_cua(lv):
    l = sua_chu(lv).lower()
    return 1 if (l.startswith('ht') or 'htrang' in l or 'hien trang' in l) else 2


def manh_khong_lo(g, sau=0):
    """Cắt hình có lỗ thành các mảnh KHÔNG lỗ (qhCompute không đọc lỗ)."""
    if g.is_empty: return []
    if isinstance(g, (MultiPolygon, GeometryCollection)):
        return [m for p in g.geoms for m in manh_khong_lo(p, sau)]
    if not isinstance(g, Polygon): return []
    if not g.interiors: return [g]
    if sau > 200: raise RuntimeError('cắt mãi không hết lỗ')
    x0, y0, x1, y1 = g.bounds
    c = Polygon(g.interiors[0]).representative_point()
    hai = (box(x0, y0, c.x, y1), box(c.x, y0, x1, y1)) if x1 - x0 >= y1 - y0 else (box(x0, y0, x1, c.y), box(x0, c.y, x1, y1))
    ra = []
    for b in hai: ra += manh_khong_lo(make_valid(g.intersection(b)), sau + 1)
    return [p for p in ra if isinstance(p, Polygon) and p.area > 0]



def cac_da_giac(g):
    """MỌI đa giác trong một hình, ở mọi tầng. Đổi toạ độ xong, thư viện hình học có lúc trả về "hộp chứa" gồm nhiều đa giác
    lẫn vài nét thừa (GeometryCollection[MultiPolygon, MultiLineString]) — chỉ nhặt đa giác đơn ở tầng ngoài là SÓT cả nhóm
    (11/10/2026: QĐ205 mất 76,8 ha đất nông nghiệp + 7,8 ha sông suối theo cách đó)."""
    if g is None or g.is_empty: return []
    if isinstance(g, Polygon): return [g] if g.area > 0 else []
    return [p for q in getattr(g, 'geoms', []) for p in cac_da_giac(q)]


def main(vao):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    TEN = {k: v for k, v in json.load(io.open(os.path.join(HERE, 'lop-205.json'), encoding='utf-8')).items() if k != '_doc'}
    RG = make_valid(Polygon(json.load(io.open(os.path.join(DATA, 'ranh_qh.json'), encoding='utf-8'))['205']))
    wgs = lambda g: transform(lambda x, y, z=None: tuple(zip(*[b1.vn2wgs(a, b) for a, b in zip(x, y)])), g)
    out, bo, theo = [], collections.Counter(), collections.Counter()
    for f in json.load(io.open(vao, encoding='utf-8'))['features']:
        lv = (f['properties'] or {}).get('layer') or ''
        if lv not in TEN or not f['geometry']:
            bo[sua_chu(lv)] += 1; continue
        g = None
        for r in f['geometry']['coordinates']:                  # CHẴN–LẺ đủ mọi vòng
            if len(r) < 4: continue
            v = make_valid(Polygon([(a[0], a[1]) for a in r]))
            g = v if g is None else g.symmetric_difference(v)
        if g is None or g.is_empty or g.area < 1: continue
        W = make_valid(wgs(make_valid(g)))
        for phan in cac_da_giac(W):
            dt = Polygon(phan.exterior).area                    # xếp lớp theo vòng ngoài vùng tô gốc
            trong = make_valid(phan.intersection(RG))
            for m in manh_khong_lo(trong):
                if m.area * 1.21e10 < 0.5: continue
                r = [[round(x, 6), round(y, 6)] for x, y in m.exterior.coords]
                if len(r) < 4: continue
                mx0, my0, mx1, my1 = m.bounds
                out.append([round(mx0, 6), round(my0, 6), round(mx1, 6), round(my1, 6), r, TEN[lv], dt, bac_cua(lv)])
                theo[TEN[lv]] += m.area * 1.21e10 / 1e4
    json.dump(out, io.open(os.path.join(DATA, 'qh_zones.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('QĐ205: %d ô (trong ranh %.0f ha) | bỏ lớp không phải đất: %s' % (len(out), sum(theo.values()), dict(bo.most_common())))
    for k, v in theo.most_common(): print('   %-40s %9.1f ha' % (k, v))


if __name__ == '__main__':
    main(sys.argv[1])
