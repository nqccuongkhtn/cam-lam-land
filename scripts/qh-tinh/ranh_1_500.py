# -*- coding: utf-8 -*-
# RANH khu quy hoạch 1/500 → ranh.json (MultiPolygon WGS84) để cắt tile gọn trong ranh (tiler2.py) — 14/10/2026.
#   Cách 1 (chuẩn): lấy thẳng "BẢNG KÊ TỌA ĐỘ GÓC RANH" (VN-2000) in trên bản vẽ:  ranh_1_500.py bang <tờ_có_bảng.pdf> <ra.json>
#   Cách 2 (không có bảng, vd Cam Hòa): dựng từ NÉT ĐỎ ranh lập quy hoạch trên tờ đã nắn (<tờ>.nan.json): vẽ nét đỏ, nối các
#     khúc đứt (giãn 5 điểm ảnh), lấy vùng KÍN lớn nhất mà nét đỏ bao quanh:  ranh_1_500.py net <tờ.pdf> <ra.json>
#   Cách 3 (ranh + tim đường cùng màu đỏ): BAO NGOÀI cả mạng nét đỏ:  ranh_1_500.py bao <tờ.pdf> <ra.json>
#   Thêm --lop=ff0000_0.00 (chỉ lớp nét ranh — 4 đồ án Cam Hải Đông / Cam Hải Tây / Cam Tân / Suối Tân của cùng đơn vị tư vấn) và
#   --nhieu (khu nhiều mảnh). Kiểm: diện tích ranh phải ≈ quy mô ghi trong thuyết minh (4 đồ án trên lệch < 0,5 %).
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
    # --lop=ff0000_0.00 : chỉ lấy đúng lớp nét ranh (màu_bề-dày) — Cam Tân / Cam Hải Đông: ranh = #ff0000 mảnh 0 (đường đậm có
    # chấm tròn), còn #ff0000 0,24 là tim đường / chỉ giới chạy song song NGOÀI ranh → lấy lẫn thì ranh phình 5 %
    lop = next((a.split('=', 1)[1].lower().replace('#', '').split(',') for a in sys.argv[4:] if a.startswith('--lop=')), None)
    for dr in pg.get_drawings():
        c = dr.get('color')
        if c is None or not (c[0] > 0.8 and c[1] < 0.25 and c[2] < 0.25): continue
        if lop and '%02x%02x%02x_%.2f' % (*[int(v * 255) for v in c], dr.get('width') or 0) not in lop: continue
        for it in dr['items']:
            if it[0] in ('l', 'c'):
                p, q = it[1] * M, it[-1] * M
                cv2.line(im, (int(p.x * k), int(p.y * k)), (int(q.x * k), int(q.y * k)), 255, 1)
    im = cv2.dilate(im, np.ones((11, 11), np.uint8))                    # nối khúc đứt của nét chấm-gạch
    if kieu == 'bao':
        # BAO NGOÀI cả mạng nét đỏ (Cam Hải Đông: ranh và tim đường CÙNG màu #ff0000 → vùng kín lớn nhất chỉ là một ô phố):
        # tô kín mọi vùng nét đỏ bao quanh, rồi "mở" bằng nhân 41 điểm để cắt các đoạn tim đường thò ra ngoài ranh
        mk = np.zeros_like(im)
        cv2.drawContours(mk, cv2.findContours(im, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0], -1, 255, -1)
        mk = cv2.morphologyEx(mk, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
        mk = cv2.erode(mk, np.ones((6, 6), np.uint8))                    # lùi về giữa nét (nét đã giãn 5 điểm)
    else:
        cnts, hier = cv2.findContours(im, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        lo = [c for j, c in enumerate(cnts) if hier[0][j][3] != -1]      # các vùng KÍN (lỗ bên trong nét đỏ)
        lon = max(cv2.contourArea(c) for c in lo)
        # --nhieu : khu gồm NHIỀU MẢNH cách nhau bởi đường (Cam Hải Tây: 1 mảnh lớn + 3 mảnh nhỏ = 173,3 ha; chỉ lấy mảnh lớn
        # nhất thì thiếu 30 ha) → lấy mọi vùng kín ≥ 3 % mảnh lớn nhất (bỏ lòng các chấm tròn trên nét ranh)
        chon = [c for c in lo if cv2.contourArea(c) >= 0.03 * lon] if '--nhieu' in sys.argv[4:] else [max(lo, key=cv2.contourArea)]
        mk = np.zeros_like(im); cv2.fillPoly(mk, chon, 255)
        mk = cv2.dilate(mk, np.ones((11, 11), np.uint8))               # nới lại đúng bằng độ giãn → ranh nằm giữa nét đỏ
    polys, tong = [], 0
    for c in sorted(cv2.findContours(mk, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0], key=cv2.contourArea, reverse=True):
        if polys and ('--nhieu' not in sys.argv[4:] or cv2.contourArea(c) < 0.03 * tong): break
        c = cv2.approxPolyDP(c, 1.5, True)
        vong = [list(p2w(float(x) / k, float(y) / k)) for x, y in c[:, 0, :]]; vong.append(vong[0])
        polys.append([vong]); tong = max(tong, cv2.contourArea(c))
        print('ranh tu net do:', len(vong), 'dinh, dien tich (diem anh)', cv2.contourArea(c))
json.dump({'type': 'MultiPolygon', 'coordinates': polys}, open(ra, 'w', encoding='utf-8'))
print('da ghi', ra)
