# -*- coding: utf-8 -*-
# CHỈ ĐO, KHÔNG GHI DỮ LIỆU (14/10/2026). Dùng: python -P so_khop_hai_nguon.py <vung-pdf.geojson> <gis.geojson> [số điểm]
# Hai nguồn có CÙNG MỘT BẢN QUY HOẠCH không? Rải điểm ngẫu nhiên trên vùng PDF đã có MÃ RIÊNG (không tính "nhóm"), so mã PDF với mã GIS
# tại cùng điểm. Khớp cao (> 90 %) = cùng bản; thấp = khác đợt (vd QHSDĐ cũ / điều chỉnh).
# Dù khớp cao cũng KHÔNG lấy mã nguồn này điền cho vùng "nhóm" của nguồn kia — chủ dự án dặn mỗi bản quy hoạch xử lý độc lập
# (memory qh-moi-ban-doc-lap). Đo 14/10: QHSDĐ Nha Trang PDF ↔ cổng GIS tỉnh khớp 49 % → hai đợt khác nhau.
import sys, json, random, collections
sys.stdout.reconfigure(encoding='utf-8')
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
pdf = [(shape(f['geometry']), f['properties']['ma']) for f in json.load(open(sys.argv[1], encoding='utf-8'))['features']]
gis = [(shape(f['geometry']), f['properties']['ma']) for f in json.load(open(sys.argv[2], encoding='utf-8'))['features']]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 4000
pdf = [(g, m) for g, m in pdf if not m.startswith('NHOM:') and g.area > 0]
tong = sum(g.area for g, _ in pdf)
cay_g = STRtree([g for g, _ in gis])
random.seed(7)
# chọn mảng theo diện tích rồi rải điểm trong mảng
w = [g.area for g, _ in pdf]
khop = khong_gis = 0; nham = collections.Counter(); dem = 0
for g, m in random.choices(pdf, weights=w, k=N):
    x0, y0, x1, y1 = g.bounds
    for _ in range(50):
        p = Point(random.uniform(x0, x1), random.uniform(y0, y1))
        if g.contains(p): break
    else: continue
    dem += 1
    ds = [gis[int(i)][1] for i in cay_g.query(p, predicate='intersects')]
    if not ds: khong_gis += 1; continue
    if m in ds: khop += 1
    else: nham[(m, ds[0])] += 1
print(f'{dem} diem: khop {100 * khop / dem:.1f}% | GIS khong co {100 * khong_gis / dem:.1f}% | khac ma {100 * sum(nham.values()) / dem:.1f}%')
print('khac ma nhieu nhat (PDF -> GIS):', [(a, b, n) for (a, b), n in nham.most_common(12)])
