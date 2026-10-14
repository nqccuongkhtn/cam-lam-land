# -*- coding: utf-8 -*-
# ĐỔI dữ liệu đã dựng theo phép nắn CŨ sang phép nắn MỚI (14/10/2026) — không phải bóc lại từ PDF: mỗi đỉnh (lng, lat) cũ → VN-2000 →
# điểm trang PDF (nghịch đảo phép CŨ) → VN-2000 (phép MỚI) → (lng, lat). Đúng tuyệt đối vì mọi thứ (vùng loại đất, ranh) vốn dựng
# trên trang PDF rồi mới đổi toạ độ. Cạnh dài được chèn thêm đỉnh mỗi ≤ 20 m để theo đúng phép nắn từng ô lưới (gãy khúc ở vạch).
# Dùng: python -P doi_nan_geojson.py <vao.geojson|json hình> <cu> <moi.nan.json> <ra>
#   <cu> = "thang:se,ie,sn,inn" (phép thẳng nan2 cũ) hoặc đường dẫn file .nan.json cũ (thẳng hoặc "luoi").
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
import vn2000 as vn

vao, cu, moi, ra = sys.argv[1:5]
def doc_nan(spec):
    if spec.startswith('thang:'):
        se, ie, sn, inn = map(float, spec[6:].split(',')); return {'se': se, 'ie': ie, 'sn': sn, 'inn': inn}
    return json.load(open(spec, encoding='utf-8'))
def _ns(v, a, b):
    if v <= a[0]: return b[0] + (v - a[0]) * (b[1] - b[0]) / (a[1] - a[0])
    if v >= a[-1]: return b[-1] + (v - a[-1]) * (b[-1] - b[-2]) / (a[-1] - a[-2])
    k = int(np.searchsorted(a, v, side='right') - 1)
    return b[k] + (v - a[k]) * (b[k + 1] - b[k]) / (a[k + 1] - a[k])
def p2en_cua(c):
    L = c.get('luoi')
    if L:
        lx, lE, ly, lN = [np.array(L[k], float) for k in ('x', 'E', 'y', 'N')]
        return lambda x, y: (_ns(x, lx, lE), _ns(y, ly, lN)), lambda E, N: (_ns(E, lE, lx), _ns(N, lN[::-1], ly[::-1]))
    se, ie, sn, inn = c['se'], c['ie'], c['sn'], c['inn']
    return lambda x, y: (se * x + ie, sn * y + inn), lambda E, N: ((E - ie) / se, (N - inn) / sn)
_, en2p_cu = p2en_cua(doc_nan(cu))
p2en_moi, _ = p2en_cua(doc_nan(moi))
def doi_diem(lng, lat):
    E, N = vn.wgs84_to_vn2000(lng, lat); x, y = en2p_cu(E, N); E2, N2 = p2en_moi(x, y); return list(vn.vn2000_to_wgs84(E2, N2))
dich = []
def doi_vong(r):
    out = []
    for (a, b), (c, d) in zip(r[:-1], r[1:]):
        E0, N0 = vn.wgs84_to_vn2000(a, b); E1, N1 = vn.wgs84_to_vn2000(c, d)
        n = max(1, int(np.hypot(E1 - E0, N1 - N0) / 20))
        for t in np.linspace(0, 1, n, endpoint=False):
            lo, la = (a + (c - a) * t, b + (d - b) * t); p = doi_diem(lo, la); out.append(p)
    out.append(doi_diem(*r[-1]))
    E0, N0 = vn.wgs84_to_vn2000(*r[0]); E1, N1 = vn.wgs84_to_vn2000(*out[0]); dich.append(np.hypot(E1 - E0, N1 - N0))
    return out
def doi_hinh(g):
    if g['type'] == 'Polygon': return {'type': 'Polygon', 'coordinates': [doi_vong(r) for r in g['coordinates']]}
    if g['type'] == 'MultiPolygon': return {'type': 'MultiPolygon', 'coordinates': [[doi_vong(r) for r in p] for p in g['coordinates']]}
    raise SystemExit('kieu hinh chua ho tro: ' + g['type'])
d = json.load(open(vao, encoding='utf-8'))
if d.get('type') == 'FeatureCollection':
    for f in d['features']: f['geometry'] = doi_hinh(f['geometry'])
else: d = doi_hinh(d)
json.dump(d, open(ra, 'w', encoding='utf-8'))
dich = np.array(dich)
print(f'{os.path.basename(vao)}: doi {len(dich)} vong, dinh dau moi vong dich trung binh {dich.mean():.2f} m (nho nhat {dich.min():.2f}, lon nhat {dich.max():.2f}) -> {ra}')
