# -*- coding: utf-8 -*-
"""
DỰNG LẠI Ô ĐẤT BẢN PHÂN KHU 1/2000 THẲNG TỪ DXF — TÔ ĐÚNG NHƯ BẢN VẼ (11/10/2026). Thay chuỗi 1b → 4 → 5 cho phần TÍNH.

Chủ dự án kiểm nhiều thửa thấy sai, nghi "thuật toán biến đổi DXF → dữ liệu web bị sai" và "xác định sai loại quy hoạch".
So thẳng bản vẽ gốc với web (rải điểm 10 m khắp ranh 7 bản) tìm ra BA lỗi của chuỗi cũ:

 1. LỖ TRONG VÙNG TÔ BỊ LẤP. Vùng tô CAD có nhiều đường bao: vòng ngoài + các vòng trong là LỖ (tô chẵn–lẻ). 1b-doc-dxf.py
    xuất MỖI đường bao thành một hình đặc, 5-tao-qh-zones.py coi mỗi hình là một ô → cái lỗ thành ô cùng loại với vùng
    ngoài. Lô thật nằm trong lỗ có hình TRÙNG KHÍT cái "lỗ giả" nên ai thắng là hú hoạ. Đo được ~75 ha ghi sai loại:
    Tây Bắc 36,8 ha ĐẤT QUỐC PHÒNG thành đất nông nghiệp · QĐ2101 7,1 ha NGHĨA TRANG thành cây xanh · QĐ2222 7 ha HỒ NƯỚC
    thành đất du lịch · QĐ918 6,6 ha nông nghiệp thành sông suối, quốc phòng / nghĩa trang thành cây xanh · Tây Nam nghĩa
    trang, trường học, văn hoá thành cây xanh / làng xóm · QĐ2076 di tích thành cây xanh.
 2. VÙNG TÔ NGOÀI RANH vẫn tính. Bản vẽ phân khu vẽ cả phần KHỚP NỐI với khu bên cạnh (chỉ để tham khảo, ngoài phạm vi
    pháp lý). 4-cat-theo-ranh.py giữ hình nào chạm ranh một điểm → QĐ2222 còn 1.742 ha ngoài ranh (946 ha "Hatch_Khop",
    658 ha biển), Tây Nam 804 ha rừng phòng hộ… Thửa 4 tờ 39 xã Cam Lâm (trong đầm) hiện dòng QĐ2222 "Hatch_Khop" 3.580 m².
 3. THỨ TỰ LỚP khác ảnh bản đồ. Ảnh tile (và MicroStation — chủ dự án đã đối chiếu) để lớp có MỐC NĂM (QH2030_/QH2045_/
    QHDD_) NẰM TRÊN lớp phân loại chung DAT_; phần tính lại coi ngang hàng, ô nhỏ thắng → QĐ2076 ~250 ha ghi "Nhóm nhà ở
    thấp tầng" trong khi bản đồ hiện "Đơn vị ở mật độ thấp đến năm 2045", "Đơn vị ở mới mật độ trung bình"… Phiếu VPĐK ghi
    theo lớp trên ("nhóm nhà ở mới (mật độ trung bình)").

Cách dựng: mỗi vùng tô = chẵn–lẻ mọi đường bao (kiểu tô 2 "bỏ qua lỗ" thì tô đặc) → đổi VN-2000 → WGS84 (đúng hàm của
1b-doc-dxf.py) → cắt theo RANH LẬP QUY HOẠCH (ranh_qh.json) → cắt mảnh có lỗ thành mảnh không lỗ (qhCompute không đọc lỗ).
Tên loại đất y hệt 5-tao-qh-zones.py (ten_loai, level chỉ là số = 'Loại đất khác' bậc 0). Bậc ưu tiên: hiện trạng HT_ = 1,
DAT_/khác = 2, có mốc năm = 3. Diện tích dùng để xếp "ô nhỏ nằm trên" = diện tích VÒNG NGOÀI của từng phần vùng tô (như cũ),
không phải của mảnh sau khi cắt — cắt mảnh không được làm đổi thứ tự hiển thị.

Cách gọi:  python 5g-dung-o-phan-khu.py <ban_ve.dxf> <ma>      (ma: 2076 2101 2222 918 cuhin taynam taybac)
Ghi đè apps/backend/data/qh_zones_<ma>.json. Đổi bản vẽ / ranh thì chạy lại, rồi chạy 7-lo-trong-ranh.py.
"""
import io, json, os, re, sys, importlib.util
import ezdxf
from ezdxf import path as ezpath
from shapely.geometry import Polygon, MultiPolygon, GeometryCollection, box
from shapely.ops import unary_union, transform
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'apps', 'backend', 'data')
def nap(ten, tep):
    sp = importlib.util.spec_from_file_location(ten, os.path.join(HERE, tep)); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m); return m
b1 = nap('b1', '1b-doc-dxf.py'); b5 = nap('b5', '5-tao-qh-zones.py')
sys.path.insert(0, HERE)
import cung_chinh_xac as CX
BAC = {'HT': 1, 'DAT': 2}          # còn lại (QH2030 / QH2045 / QHDD) = 3 — nằm trên, như ảnh tile
KHOP = re.compile(r'hatch_khop', re.I)   # level tô VÙNG KHỚP NỐI với quy hoạch bên cạnh — không phải loại đất (xem dưới)


def h5_sua(s):
    """Tên lớp tiếng Việt bị đọc nhầm bảng mã (chữ UTF-8 bị hiểu thành cp1252) → sửa lại. Ký tự \x80–\x9f (byte cp1252 KHÔNG định
    nghĩa — vd 'Đ' = C4 90 thành 'Ä\x90') lấy nguyên byte: trước 11/10/2026 gặp chúng là bó tay → lớp QĐ205 "_X_ĐVO mớiTB_2030"
    (857 ha) không khớp khung chú giải, web ghi tên chung "Đất đơn vị ở"."""
    try:
        b = bytearray()
        for ch in s:
            o = ord(ch)
            b += bytes([o]) if o < 0x100 else ch.encode('cp1252')
        return b.decode('utf-8')
    except Exception:
        return s


def chan_le(polys):
    g = None
    for q in polys:
        g = q if g is None else g.symmetric_difference(q)
    return g


def manh_khong_lo(g, sau=0):
    """Cắt hình có lỗ thành các mảnh KHÔNG lỗ: cắt đôi khung bao đi qua tâm một lỗ, lặp tới khi hết lỗ."""
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
    for b in hai:
        ra += manh_khong_lo(make_valid(g.intersection(b)), sau + 1)
    return [p for p in ra if isinstance(p, Polygon) and p.area > 0]



def cac_da_giac(g):
    """MỌI đa giác trong một hình, ở mọi tầng. Đổi toạ độ xong, thư viện hình học có lúc trả về "hộp chứa" gồm nhiều đa giác
    lẫn vài nét thừa (GeometryCollection[MultiPolygon, MultiLineString]) — chỉ nhặt đa giác đơn ở tầng ngoài là SÓT cả nhóm
    (11/10/2026: QĐ205 mất 76,8 ha đất nông nghiệp + 7,8 ha sông suối theo cách đó)."""
    if g is None or g.is_empty: return []
    if isinstance(g, Polygon): return [g] if g.area > 0 else []
    return [p for q in getattr(g, 'geoms', []) for p in cac_da_giac(q)]


def main(vao, ma):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    R = json.load(io.open(os.path.join(DATA, 'ranh_qh.json'), encoding='utf-8'))
    RG = make_valid(Polygon(R[ma]))
    try: TCG = json.load(io.open(os.path.join(HERE, 'ten-theo-chu-giai.json'), encoding='utf-8')).get(ma) or {}
    except Exception: TCG = {}
    try: SL = json.load(io.open(os.path.join(HERE, 'ten-suy-luan.json'), encoding='utf-8')).get(ma) or {}
    except Exception: SL = {}
    wgs = lambda g: transform(lambda x, y, z=None: tuple(zip(*[b1.vn2wgs(a, b) for a, b in zip(x, y)])), g)
    d = ezdxf.readfile(vao); msp = d.modelspace()
    out = []; khop = []; dem = {'vung': 0, 'co_lo': 0, 'ngoai_ranh': 0, 'loi': 0}
    for e in msp:
        if e.dxftype() != 'HATCH': continue
        lv = e.dxf.get('layer', '') or ''
        if 'ranh gi' in lv.lower() or lv.upper().startswith('RG') or b1.bo_level(lv): continue   # như 1b-doc-dxf.py
        # LEVEL BỊ TẮT / ĐÓNG BĂNG (11/10/2026): MicroStation không hiện → không phải nội dung bản vẽ. QĐ2076 có 290 vùng tô
        # 'DAT_O_Nhomnhao Thaptang' (905 ha, web ghi "Nhóm nhà ở thấp tầng") + 30 vùng 'DAT_NO_Nhaochungcu' (178 ha, chính là ô
        # "Nhà ở chung cư 5,7 ha vẽ trùm cả lô lẫn đường") nằm trên level đóng băng — khung chú giải cũng không có hai loại này.
        L = d.layers.get(lv) if d.layers.has_entry(lv) else None
        if L is not None and (L.is_frozen() or L.is_off()):
            dem['level_tat'] = dem.get('level_tat', 0) + 1; continue
        # CUNG TRÒN CHÍNH XÁC (11/10/2026, cung_chinh_xac.py): ezdxf đổi cung thành đường cong Bézier rồi bẻ võng 5 cm → hụt diện
        # tích dọc mọi đường cong (thửa sát vòng xoay lệch 1–2 m² so với đo tay MicroStation). Nay tính cung đúng công thức.
        try: ds = list(CX.duong_bao_hatch(e))
        except Exception: dem['loi'] += 1; continue
        polys = []
        for pts in ds:
            if len(pts) >= 3: polys.append(make_valid(Polygon(pts)))
        if not polys: continue
        dem['vung'] += 1
        g = unary_union(polys) if e.dxf.get('hatch_style', 0) == 2 or len(polys) == 1 else make_valid(chan_le(polys))
        if len(polys) > 1: dem['co_lo'] += 1
        if g.is_empty: continue
        W = make_valid(wgs(g))
        x0, y0, x1, y1 = W.bounds
        if not (b1.KHUNG[0] <= x0 and x1 <= b1.KHUNG[2] and b1.KHUNG[1] <= y0 and y1 <= b1.KHUNG[3]): continue
        if KHOP.search(lv):
            # VÙNG KHỚP NỐI (QĐ2222 'Hatch_Khop'): tô phần đất của quy hoạch BÊN CẠNH để đối chiếu — 99,7 % nằm ngoài ranh, phần lọt
            # vào trong chỉ là mẩu dọc mép ranh. Không phải loại đất của bản này: không thành ô đất (trước đây web ghi "Hatch_Khop"),
            # mà ghi vào ranh_qh.json["_khop"] để chỗ đó tính là NGOÀI PHẠM VI (không bị luật "khe trong ranh = đường" biến thành đường).
            t = make_valid(W.intersection(RG))
            khop += [p for p in (t.geoms if hasattr(t, 'geoms') else [t]) if isinstance(p, Polygon) and p.area * 1.21e10 >= 50]
            continue
        if re.fullmatch(r'\s*\d+\s*', lv): loai, bac = b5.CHUA_RO, 0      # level chỉ là con số: bản vẽ không nói đất gì
        else: loai, bac = b5.ten_loai(lv), BAC.get(b1.nhom(lv), 3)
        # TÊN ĐÚNG CHỮ KHUNG CHÚ GIẢI (11/10/2026, ten-theo-chu-giai.json — chỉ cặp level + màu khớp chắc chắn một dòng chú giải):
        # cùng level mà khác màu có thể là dòng khác (QĐ2101 "Nhóm nhà ở" #a57c00 = mật độ trung bình, #dfff7f = mật độ thấp).
        mau_to = b1.mau_va_so(e, d)[0].lower()
        loai = TCG.get('theo_level_mau', {}).get('%s||%s' % (h5_sua(lv), mau_to)) or TCG.get('theo_level', {}).get(h5_sua(lv)) or loai
        loai = SL.get(h5_sua(lv), loai)   # tên SUY LUẬN cho lớp không có trong chú giải của chính bản vẽ (ten-suy-luan.json)
        for phan in cac_da_giac(W):
            dt = Polygon(phan.exterior).area                  # xếp thứ tự theo VÒNG NGOÀI của phần này (như cũ)
            trong = make_valid(phan.intersection(RG))
            if trong.is_empty or trong.area < phan.area * 1e-9:
                dem['ngoai_ranh'] += 1; continue
            for m in manh_khong_lo(trong):
                if m.area * 1.21e10 < 0.5: continue          # vụn < 0,5 m² do cắt
                r = [[round(x, 8), round(y, 8)] for x, y in m.exterior.coords]   # 8 số lẻ (~1 mm): 6 số lẻ (~10 cm) lệch tới 1,3 m² ở thửa có mép dài
                if len(r) < 4: continue
                mx0, my0, mx1, my1 = m.bounds
                out.append([round(mx0, 8), round(my0, 8), round(mx1, 8), round(my1, 8), r, loai, dt, bac])
    ra = os.path.join(DATA, 'qh_zones_%s.json' % ma)
    json.dump(out, io.open(ra, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    # vùng khớp nối lọt trong ranh → lỗ của ranh (đọc lại file ranh rồi mới ghi, giữ nguyên các khoá khác như "_lo")
    R = json.load(io.open(os.path.join(DATA, 'ranh_qh.json'), encoding='utf-8'))
    R.setdefault('_khop', {})
    if khop: R['_khop'][ma] = [[[round(x, 8), round(y, 8)] for x, y in m.exterior.coords] for p in khop for m in manh_khong_lo(p)]
    else: R['_khop'].pop(ma, None)
    json.dump(R, io.open(os.path.join(DATA, 'ranh_qh.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('%s: %d vùng tô (%d có lỗ) → %d ô | bỏ %d phần nằm trọn ngoài ranh | %d vùng lỗi đọc | %d vùng trên level tắt | khớp nối trong ranh %.2f ha'
          % (ma, dem['vung'], dem['co_lo'], len(out), dem['ngoai_ranh'], dem['loi'], dem.get('level_tat', 0), sum(p.area for p in khop) * 1.21e10 / 1e4))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
