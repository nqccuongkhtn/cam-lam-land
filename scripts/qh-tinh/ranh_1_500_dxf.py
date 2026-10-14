# -*- coding: utf-8 -*-
# RANH LẬP QUY HOẠCH của bản vẽ 1/500 (DXF xuất từ DGN gốc) → GeoJSON WGS84 — 14/10/2026.
# Lấy các đường bao KHÉP KÍN trên level "BV_Rg_lapquyhoach" có kiểu nét "QH_Ranh giới lập quy hoạch" (DXF ghi mất dấu thành
# "QH_Ranh gi i l p quy ho ch"). Bỏ: nét mẫu trong khung chú giải (2 đỉnh, không khép), đường kiểu nét khác (HIDDEN2 = ranh
# nghiên cứu / hành lang, DASHDOT…). Cung tròn (bulge) tính ĐÚNG công thức bằng qh-pipeline/cung_chinh_xac.py (võng ≤ 2 mm,
# bù diện tích). Toạ độ VN-2000 Khánh Hoà → WGS84 bằng vn2000.py (đúng bộ tham số của lớp quy hoạch Cam Lâm).
# Ra 2 file: <ra>.json = hình ranh đúng (MultiPolygon) · <ra>-cat.json = ranh nới --le mét để CẮT ô ảnh (giữ trọn nét ranh in đậm).
# Dùng: python -P ranh_1_500_dxf.py <file.dxf> <ra> [--le=4]
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'qh-pipeline'))
sys.stdout.reconfigure(encoding='utf-8')
import ezdxf
from shapely.geometry import Polygon, MultiPolygon, mapping
from shapely.ops import unary_union, transform
from cung_chinh_xac import _doan_cong
import vn2000 as vn

co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
dxf, ra = ts[0], ts[1]
LE = float(next((a.split('=', 1)[1] for a in co if a.startswith('--le=')), 4))
d = ezdxf.readfile(dxf); msp = d.modelspace()
vung = []
for e in msp.query('LWPOLYLINE[layer=="BV_Rg_lapquyhoach"]'):
    lt = e.dxf.get('linetype', 'BYLAYER')
    if not e.closed or not lt.startswith('QH_Ranh'): continue
    v = [(float(x), float(y), float(b or 0)) for x, y, b in e.get_points('xyb')]
    pts = []
    for i in range(len(v)):
        x0, y0, b = v[i]; x1, y1, _ = v[(i + 1) % len(v)]
        pts.extend(_doan_cong((x0, y0), (x1, y1), b)[:-1] if abs(b) > 1e-12 else [(x0, y0)])
    p = Polygon(pts)
    if not p.is_valid: p = p.buffer(0)
    vung.append(p)
    print(f'  vong ranh: {len(v)} dinh ({sum(1 for t in v if abs(t[2]) > 1e-12)} cung) -> {len(pts)} diem, {p.area:,.1f} m2')
if not vung: sys.exit('LOI: khong thay ranh lap quy hoach khep kin')
U = unary_union(vung)
def ra_wgs(g): return transform(lambda x, y, z=None: vn.vn2000_to_wgs84(x, y), g)
def mp(g): return g if g.geom_type == 'MultiPolygon' else MultiPolygon([g])
json.dump(mapping(mp(ra_wgs(U))), open(ra + '.json', 'w', encoding='utf-8'))
json.dump(mapping(mp(ra_wgs(U.buffer(LE, join_style=2)))), open(ra + '-cat.json', 'w', encoding='utf-8'))
x0, y0, x1, y1 = U.bounds
print(f'{os.path.basename(dxf)}: {len(vung)} vung ranh, tong {U.area / 1e4:,.4f} ha, khung VN-2000 ({x0:.2f},{y0:.2f})-({x1:.2f},{y1:.2f})'
      f' -> {ra}.json + {ra}-cat.json (noi {LE} m)')
