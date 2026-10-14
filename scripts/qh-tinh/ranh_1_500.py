# -*- coding: utf-8 -*-
# RANH khu quy hoạch 1/500 → ranh.json (MultiPolygon WGS84) để cắt tile gọn trong ranh (tiler2.py) — 14/10/2026.
#   Cách 1 (chuẩn): lấy thẳng "BẢNG KÊ TỌA ĐỘ GÓC RANH" (VN-2000) in trên bản vẽ:  ranh_1_500.py bang <tờ_có_bảng.pdf> <ra.json>
#   Cách 2 (không có bảng, vd Cam Hòa): dựng từ NÉT ĐỎ ranh lập quy hoạch trên tờ đã nắn (<tờ>.nan.json): vẽ nét đỏ, nối các
#     khúc đứt (giãn 5 điểm ảnh), lấy vùng KÍN lớn nhất mà nét đỏ bao quanh:  ranh_1_500.py net <tờ.pdf> <ra.json>
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, cv2, pymupdf
import vn2000 as vn, nan2, nan_1_500

kieu, pdf, ra = sys.argv[1], sys.argv[2], sys.argv[3]
if kieu == 'bang':
    da = nan_1_500.doc_bang(pdf)
    polys = []
    for d in da:
        vong = [list(vn.vn2000_to_wgs84(E, N)) for _, E, N in d]; vong.append(vong[0])
        polys.append([vong])
    print('ranh tu bang:', [len(d) for d in da], 'goc')
else:
    p2en, p2w, info = nan2.lap_phep_doi(pdf, 109.1, 12.0)
    pg = pymupdf.open(pdf)[0]; M = pg.rotation_matrix; k = 1.0
    im = np.zeros((int(pg.rect.height * k) + 2, int(pg.rect.width * k) + 2), np.uint8)
    for dr in pg.get_drawings():
        c = dr.get('color')
        if c is None or not (c[0] > 0.8 and c[1] < 0.25 and c[2] < 0.25): continue
        for it in dr['items']:
            if it[0] == 'l':
                p, q = it[1] * M, it[2] * M
                cv2.line(im, (int(p.x * k), int(p.y * k)), (int(q.x * k), int(q.y * k)), 255, 1)
    im = cv2.dilate(im, np.ones((11, 11), np.uint8))                    # nối khúc đứt của nét chấm-gạch
    cnts, hier = cv2.findContours(im, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    lo = [c for j, c in enumerate(cnts) if hier[0][j][3] != -1]          # các vùng KÍN (lỗ bên trong nét đỏ)
    c = max(lo, key=cv2.contourArea)
    mk = np.zeros_like(im); cv2.fillPoly(mk, [c], 255)
    mk = cv2.dilate(mk, np.ones((11, 11), np.uint8))                   # nới lại đúng bằng độ giãn → ranh nằm giữa nét đỏ
    c = max(cv2.findContours(mk, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0], key=cv2.contourArea)
    c = cv2.approxPolyDP(c, 1.5, True)
    vong = [list(p2w(float(x) / k, float(y) / k)) for x, y in c[:, 0, :]]; vong.append(vong[0])
    polys = [[vong]]
    print('ranh tu net do:', len(vong), 'dinh, dien tich (diem anh)', cv2.contourArea(c))
json.dump({'type': 'MultiPolygon', 'coordinates': polys}, open(ra, 'w', encoding='utf-8'))
print('da ghi', ra)
