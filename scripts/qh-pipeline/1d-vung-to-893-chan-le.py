# -*- coding: utf-8 -*-
"""
DỰNG LẠI FILE VÙNG TÔ QĐ893 (đầu vào của 5b-tao-qh-zones-893.py) THẲNG TỪ DXF — TÔ ĐÚNG LUẬT CHẴN–LẺ (11/10/2026).

Vì sao: file cũ quyhoach2025/qd893_qh.geojson dựng bằng GDAL (dấu vết: màu xám ra #dcdcdc — chỉ bảng màu của GDAL cho số này).
GDAL hiểu vùng tô nhiều vòng theo kiểu "vòng đầu = ngoài, mọi vòng sau = lỗ" — SAI với vùng tô có ĐẢO NẰM TRONG LỖ (CAD tô
chẵn–lẻ: vòng lồng tầng 3 lại được tô). So toàn bản QĐ893 với bản vẽ (rải điểm 20 m khắp huyện) thấy hậu quả:
  · web có mảnh ĐƯỜNG phủ lên khối đất ở 0,87 ha ở chỗ bản vẽ không tô đường (lỗ của vùng tô đường bị lấp);
  · vùng tô đường 22 ha (B51E1A) mất một phần 3,4 ha → web ghi "ngoài phạm vi".
Bản này đọc từng vùng tô bằng ezdxf (cùng bộ đọc với 1b-doc-dxf.py), dựng chẵn–lẻ TẤT CẢ đường bao, và đọc thêm hình tô
đặc SOLID/TRACE (774 hình ~160 ha trên Level 30 — bản cũ có, phải giữ). Đọc kiểu TỪNG HÌNH MỘT (ezdxf.addons.iterdxf) nên
nhẹ RAM — đọc cả file 143 MB một lượt từng bị hệ thống dừng vì hết bộ nhớ.
Bỏ: màu trắng #ffffff (ký hiệu, như 1b) và Level 56 (khung chú dẫn — 5b cũng bỏ).
Màu ghi ra GIỐNG HỆT file cũ (bảng màu AutoCAD của 1b, riêng số 254 ghi #dcdcdc như GDAL) để bảng tên theo màu của 5b
(mau_qd893, nhom_mau_qd893) và bảng màu giao diện không lệch.

Cách gọi:
    python 1d-vung-to-893-chan-le.py "QD893 QHSDD2030.dxf" qd893_qh_chanle.geojson
    python 5b-tao-qh-zones-893.py qd893_qh_chanle.geojson qd893_chu.geojson qd893_kyhieu.geojson
    python 5f-bo-sung-vung-to-hong-893.py <h893.geojson> qd893_chu.geojson      (như cũ)
"""
import io, json, os, sys, importlib.util
from ezdxf.addons import iterdxf
from ezdxf import path as ezpath
from shapely.geometry import Polygon, MultiPolygon, mapping
from shapely.ops import unary_union, transform
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
sp = importlib.util.spec_from_file_location('b1', os.path.join(HERE, '1b-doc-dxf.py')); b1 = importlib.util.module_from_spec(sp); sp.loader.exec_module(b1)
sys.path.insert(0, HERE)
import cung_chinh_xac as CX
MAU_NHU_GDAL = {254: '#dcdcdc'}   # số hiệu màu mà bảng màu GDAL (file cũ) khác bảng AutoCAD của 1b


def mau_cac_level(vao):
    """Đọc nhanh BẢNG LEVEL ở đầu file (trước phần ENTITIES): tên level → (số hiệu màu, màu thật). Cần cho hình khai màu
    'theo level' (BYLAYER) — đọc từng hình một thì không có sẵn bảng này như khi đọc cả file."""
    lv, cur, ma = {}, None, None
    with io.open(vao, encoding='utf-8', errors='replace') as f:
        while True:
            a = f.readline(); b = f.readline()
            if not a or not b: break
            ma, gt = a.strip(), b.strip()
            if ma == '2' and gt == 'ENTITIES': break
            if ma == '0':
                if cur and cur.get('ten') is not None: lv[cur['ten']] = cur
                cur = {'ten': None, 'ci': 7, 'tc': None} if gt == 'LAYER' else None
            elif cur is not None:
                if ma == '2': cur['ten'] = gt
                elif ma == '62': cur['ci'] = abs(int(gt or 7))
                elif ma == '420': cur['tc'] = int(gt)
    return lv


def mau_cua(e, lv):
    """Như 1b.mau_va_so(): màu thật nếu có, không thì tra số hiệu; BYLAYER/BYBLOCK → màu của level."""
    tc = e.dxf.get('true_color', None)
    if tc: return '#%06x' % (tc & 0xFFFFFF)
    ci = e.dxf.get('color', 256)
    if ci in (0, 256):
        L = lv.get(e.dxf.get('layer', ''))
        if L and L['tc']: return '#%06x' % (L['tc'] & 0xFFFFFF)
        ci = L['ci'] if L else 7
    if ci < 1 or ci > 255: return '#9aa0a6'
    return MAU_NHU_GDAL.get(ci, b1.BANG[ci])



def cac_da_giac(g):
    """MỌI đa giác trong một hình, ở mọi tầng. Đổi toạ độ xong, thư viện hình học có lúc trả về "hộp chứa" gồm nhiều đa giác
    lẫn vài nét thừa (GeometryCollection[MultiPolygon, MultiLineString]) — chỉ nhặt đa giác đơn ở tầng ngoài là SÓT cả nhóm
    (11/10/2026: QĐ205 mất 76,8 ha đất nông nghiệp + 7,8 ha sông suối theo cách đó)."""
    if g is None or g.is_empty: return []
    if isinstance(g, Polygon): return [g] if g.area > 0 else []
    return [p for q in getattr(g, 'geoms', []) for p in cac_da_giac(q)]


def main(vao, ra):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    lv = mau_cac_level(vao)
    wgs = lambda g: transform(lambda x, y, z=None: tuple(zip(*[b1.vn2wgs(a, b) for a, b in zip(x, y)])), g)
    out, dem = [], {'HATCH': 0, 'SOLID': 0, 'TRACE': 0, 'bo': 0, 'loi': 0}
    doc = iterdxf.opendxf(vao)
    try:
        for e in doc.modelspace(types=['HATCH', 'SOLID', 'TRACE']):
            t = e.dxftype(); layer = e.dxf.get('layer', '') or ''
            c = mau_cua(e, lv)
            if layer == 'Level 56' or c == '#ffffff': dem['bo'] += 1; continue
            try:
                if t == 'HATCH':
                    ps = []
                    for pts in CX.duong_bao_hatch(e):     # cung tròn chính xác (cung_chinh_xac.py, 11/10/2026)
                        if len(pts) >= 3:
                            q = make_valid(Polygon(pts))
                            if not q.is_empty and q.area > 0: ps.append(q)
                    if not ps: continue
                    if e.dxf.get('hatch_style', 0) == 2 or len(ps) == 1: g = unary_union(ps)
                    else:
                        g = None
                        for q in ps: g = q if g is None else g.symmetric_difference(q)
                else:   # SOLID / TRACE: tứ giác (hoặc tam giác) tô đặc
                    v = [(p.x, p.y) for p in e.wcs_vertices()]
                    if len(v) < 3: continue
                    g = make_valid(Polygon(v))
                g = make_valid(g)
                if g.is_empty or g.area < 0.01: continue
                W = make_valid(wgs(g))
            except Exception:
                dem['loi'] += 1; continue
            x0, y0, x1, y1 = W.bounds
            if not (b1.KHUNG[0] <= x0 and x1 <= b1.KHUNG[2] and b1.KHUNG[1] <= y0 and y1 <= b1.KHUNG[3]): continue
            for p in cac_da_giac(W):
                out.append({'type': 'Feature', 'properties': {'lo': layer, 'c': c, 'hz': 'DAT', 'h': e.dxf.handle},
                            'geometry': mapping(p)})
            dem[t] += 1
    finally:
        doc.close()
    json.dump({'type': 'FeatureCollection', 'features': out}, io.open(ra, 'w', encoding='utf-8'), ensure_ascii=False)
    print('%s: %d vùng tô + %d SOLID + %d TRACE → %d hình | bỏ %d (Level 56 / màu ký hiệu) | %d lỗi'
          % (vao, dem['HATCH'], dem['SOLID'], dem['TRACE'], len(out), dem['bo'], dem['loi']))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
