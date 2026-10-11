# -*- coding: utf-8 -*-
"""
DỰNG LẠI RANH LẬP QUY HOẠCH CỦA 7 BẢN PHÂN KHU THẲNG TỪ DXF GỐC — ĐƯỜNG CONG TÍNH ĐÚNG (12/10/2026).

Vì sao: ranh_qh.json dựng hôm 10/10 từ quyhoach2025/*_net.geojson — file NÉT xuất trước đây đã LÀM THẲNG đường cong: cung tròn
bẻ dây cung thô, đường cong trơn (SPLINE) thành MỘT đoạn thẳng nối hai đầu. So với nét ranh trong DXF gốc (12/10/2026): mọi đỉnh
ranh web nằm đúng trên nét bản vẽ (< 1 cm) nhưng giữa các đỉnh thì lệch — QĐ2101 0,65 m, QĐ2076 3,2 m (cung tròn lớn), Cù Hin,
Tây Bắc, QĐ918, QĐ2222 tới hơn 20 m (đường cong trơn). Từ 12/10 phần đường / ngoài phạm vi ở mép ranh được CẮT HÌNH theo ranh,
và 5g cắt ô đất theo ranh → ranh lệch là dải đất dọc mép ranh bị ghi sai "trong bản quy hoạch" ↔ "ngoài phạm vi".

Cách dựng: đọc dòng chảy (nhẹ RAM) mọi nét trên ĐÚNG lớp ranh lập quy hoạch của bản đó (đối chiếu: ranh cũ trùng 100 % lớp này):
  LINE · LWPOLYLINE / POLYLINE (đoạn cong bulge tính đúng công thức) · ARC (tâm + bán kính + góc) · SPLINE (đường B-spline thật)
— cùng các hàm của cung_chinh_xac.py, sai số ≤ 2 mm — đổi VN-2000 → WGS84 như 5g (1b-doc-dxf.vn2wgs), nối nét (unary_union) rồi
dựng mặt (polygonize), GỘP các mặt rồi lấy VÒNG NGOÀI của khối lớn nhất (lớp ranh có khi có nét chia bên trong). Toạ độ 8 số lẻ
(~1 mm) như ô đất.

Cách gọi:
    python 6b-dung-ranh-tu-dxf.py                 # chỉ SO với ranh đang dùng, không ghi gì
    python 6b-dung-ranh-tu-dxf.py --ghi           # ghi vào apps/backend/data/ranh_qh.json (giữ _lo, _khop, QĐ205)
    python 6b-dung-ranh-tu-dxf.py --ghi cuhin,2076
Ghi xong PHẢI chạy lại 5g cho bản đổi ranh (ô đất cắt theo ranh) rồi 7-lo-trong-ranh.py (lỗ trong ranh).
"""
import io, json, math, os, re, sys, importlib.util
from ezdxf.addons import iterdxf
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union, polygonize

HERE = os.path.dirname(os.path.abspath(__file__))
GOC = os.path.abspath(os.path.join(HERE, '..', '..'))
DATA = os.path.join(GOC, 'apps', 'backend', 'data')
QH = os.path.join(GOC, 'quyhoach2025')
sys.path.insert(0, HERE)
import cung_chinh_xac as CX
sp = importlib.util.spec_from_file_location('b1', os.path.join(HERE, '1b-doc-dxf.py')); b1 = importlib.util.module_from_spec(sp); sp.loader.exec_module(b1)

# bản → (file DXF, hàm nhận lớp ranh lập QH). Lớp chọn theo đối chiếu 12/10/2026: ranh cũ trùng 100 % nét của lớp này.
BAN = {
    '2076':   ('QD2076PKPB 1.2000.dxf', lambda lv: lv == 'BV_Rg_lapquyhoach'),
    '2101':   ('QD2101 TT 1.2000.dxf', lambda lv: lv == 'BV_Rg_lapquyhoach'),
    '2222':   ('QD2222.dxf', lambda lv: lv == 'BV_Rg_lapquyhoach'),
    '918':    ('1-2000 phan khu Phia Tay (1).dxf', lambda lv: lv == 'BV_Rg_lapquyhoach'),
    'taybac': ('1-2000 Phan khu Tay Bac.dxf', lambda lv: lv == 'BV_Rg_lapquyhoach'),
    'cuhin':  ('phân khu cù hin 1.2000.dxf', lambda lv: lv.startswith('1-QH_Ranh')),
    'taynam': ('Tay Nam da sua - ban cuoi.dxf', lambda lv: lv.startswith('1-QH_Ranh')),
}


def diem_net(e):
    """Các điểm (toạ độ bản vẽ) của một nét, đường cong tính đúng (cung_chinh_xac). Trả list các đường (mỗi đường = list điểm)."""
    t = e.dxftype()
    if t == 'LINE':
        return [[(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)]]
    if t == 'ARC':
        c, r = e.dxf.center, e.dxf.radius
        a0, a1 = math.radians(e.dxf.start_angle), math.radians(e.dxf.end_angle)
        while a1 <= a0: a1 += 2 * math.pi               # cung DXF luôn đi ngược chiều kim đồng hồ từ góc đầu tới góc cuối
        return [CX._cung(c.x, c.y, r, a0, a1)]
    if t == 'SPLINE':
        return [CX._spline_bu(e.construction_tool())]
    if t == 'LWPOLYLINE':
        v = [(float(x), float(y), float(b or 0.0)) for x, y, s, w, b in e.get_points('xyseb')]
        dong = bool(e.closed)
    elif t == 'POLYLINE':
        v = [(float(p.dxf.location.x), float(p.dxf.location.y), float(p.dxf.get('bulge', 0.0) or 0.0)) for p in e.vertices]
        dong = bool(e.is_closed)
    else:
        return []
    if len(v) < 2: return []
    out = []; n = len(v)
    for i in range(n if dong else n - 1):
        x0, y0, bg = v[i]; x1, y1, _ = v[(i + 1) % n]
        out.extend(CX._doan_cong((x0, y0), (x1, y1), bg)[:-1] if abs(bg) > 1e-12 else [(x0, y0)])
    out.append(v[0][:2] if dong else v[-1][:2])
    return [out]


def dung_ranh(ma):
    tep, la_ranh = BAN[ma]
    net, dem = [], {}
    for e in iterdxf.modelspace(os.path.join(QH, tep), types=['LINE', 'ARC', 'LWPOLYLINE', 'POLYLINE', 'SPLINE']):
        lv = e.dxf.get('layer', '') or ''
        if not la_ranh(lv): continue
        try:
            ds = diem_net(e)
        except Exception as ex:
            print('   ! bỏ một nét %s: %s' % (e.dxftype(), ex)); continue
        for pts in ds:
            if len(pts) < 2: continue
            w = [b1.vn2wgs(x, y) for x, y in pts]
            net.append(LineString([(round(a[0], 8), round(a[1], 8)) for a in w]))
            dem[e.dxftype()] = dem.get(e.dxftype(), 0) + 1
    mat = list(polygonize(unary_union(net)))
    if not mat: return None, dem
    # GỘP mọi mặt rồi lấy khối lớn nhất: lớp ranh có khi vẽ thêm nét chia bên trong (QĐ2222: 847 mặt, mặt lớn nhất chỉ 1.615 /
    # 3.554 ha) — lấy mặt lớn nhất là mất phần còn lại của ranh.
    u = unary_union(mat)
    lon = max(getattr(u, 'geoms', [u]), key=lambda p: p.area)
    return [[round(x, 8), round(y, 8)] for x, y in lon.exterior.coords], dem


def main():
    ghi = '--ghi' in sys.argv
    chon = [a for a in sys.argv[1:] if not a.startswith('--')]
    ds = chon[0].split(',') if chon else list(BAN)
    tep_r = os.path.join(DATA, 'ranh_qh.json')
    R = json.load(io.open(tep_r, encoding='utf-8'))
    kx, ky = 111320 * math.cos(math.radians(12.08)), 110574
    for ma in ds:
        moi, dem = dung_ranh(ma)
        if not moi:
            print('[%s] KHÔNG dựng được vòng ranh từ DXF — giữ ranh cũ' % ma); continue
        cu = Polygon(R[ma]); pm = Polygon(moi)
        if not cu.is_valid: cu = cu.buffer(0)
        if not pm.is_valid: pm = pm.buffer(0)
        lech = cu.symmetric_difference(pm)
        hd = max(LineString(R[ma]).hausdorff_distance(LineString(moi)), 0) * (kx + ky) / 2
        print('[%s] nét đọc được %s · ranh mới %d đỉnh (cũ %d) · diện tích %.2f ha (cũ %.2f ha) · khác nhau %.2f ha · lệch xa nhất %.1f m'
              % (ma, dem, len(moi), len(R[ma]), pm.area * kx * ky / 1e4, cu.area * kx * ky / 1e4, lech.area * kx * ky / 1e4, hd))
        if hd > 300:
            print('   ! lệch quá 300 m — nghi dựng nhầm vòng, KHÔNG ghi bản này'); continue
        if ghi: R[ma] = moi
    if ghi:
        with io.open(tep_r + '.tmp', 'w', encoding='utf-8', newline='\n') as f:
            json.dump(R, f, ensure_ascii=False, separators=(',', ':'))
        os.replace(tep_r + '.tmp', tep_r)
        print('Đã ghi', tep_r, '— nhớ chạy lại 5g cho bản đổi ranh rồi 7-lo-trong-ranh.py')


if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    main()
