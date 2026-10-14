# -*- coding: utf-8 -*-
# BÓC VÙNG LOẠI ĐẤT từ bản đồ QHSDĐ 2030 dạng PDF (nét vector) → GeoJSON có toạ độ thật (WGS84), cắt theo ranh huyện.
# Dùng để tính DIỆN TÍCH TỪNG LOẠI ĐẤT TRÊN TỪNG THỬA cho các huyện/thị ngoài Cam Lâm (Cam Lâm có CAD gốc, không dùng cái này).
#
# Dùng: python -P boc_loai_dat.py <pdf> <tam_lng> <tam_lat> <ranh.json> <S px/pt> <ra.geojson> [anh_thu.png]
#   (pdf phải nắn được: nan2.py tự đọc nhãn lưới, hoặc có file <pdf>.nan.json bên cạnh)
#
# Cách làm (14/10/2026, phát triển từ bản thử Cam Ranh 13–14/10):
#  1) Vẽ lại MỌI mảng tô màu của PDF theo ĐÚNG THỨ TỰ VẼ của PDF (mảng vẽ sau đè mảng vẽ trước, y như mắt nhìn);
#     mỗi mảng tô đủ mọi vòng một lượt nên lỗ thủng được giữ.
#  2) Đọc NHÃN MÃ LOẠI ĐẤT (ODT, CLN, TMD…) nằm trong ranh. Bản ghi kiểu phân số "CLN / TMD" (mã trên đen = hiện trạng,
#     mã dưới ĐỎ = quy hoạch 2030 — Khánh Vĩnh) thì CHỈ lấy mã đỏ; mã đen đứng ngay trên mã đỏ bị bỏ.
#  3) Gán theo TỪNG MẢNG TÔ (mỗi khu vẽ trên bản đồ là một mảng — giữ đúng ranh khu như bản vẽ):
#     mảng có nhãn nằm trong → mã chiếm đa số của các nhãn đó;
#     mảng KHÔNG có nhãn → chỉ gán khi MÀU của nó chắc chắn dùng cho đúng một mã (≥ 85 % nhãn cùng màu, ≥ 5 nhãn);
#     màu dùng chung (xanh nước = NTS/SON/MNC/mặt nước ven biển, hồng cam = nhóm công trình…) → để "chưa xác định".
#     (Bản thử 13/10 gán theo MÀU + chia theo nhãn gần nhất: cả vịnh Cam Ranh thành "nuôi trồng thuỷ sản",
#      rừng bị chia mảnh cạnh thẳng cắt ngang ranh thật — đã bỏ.)
#  4) Cắt theo ranh, đổi điểm ảnh → điểm PDF → VN-2000 → WGS84 (nan2.lap_phep_doi), ghi mỗi loại thành đa giác.
# ⚠️ Đây là BÓC TỪ ẢNH IN, sai số cỡ vài mét ở mép vùng (1 điểm ảnh ≈ m/pt ÷ S) — dùng để THAM KHẢO,
#    khác hẳn số liệu Cam Lâm tính từ CAD gốc.
import sys, os, re, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf, numpy as np, cv2
import nan2, vn2000 as vn

pdf, tlng, tlat, ranh_path, S, ra = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4], float(sys.argv[5]), sys.argv[6]
anh_thu = sys.argv[7] if len(sys.argv) > 7 else None

p2en, p2w, info = nan2.lap_phep_doi(pdf, tlng, tlat)
if not p2en: sys.exit('LOI: khong nan duoc ban do (thieu nhan luoi / .nan.json)')
EN2P = info.get('en2p') or (lambda E, N: ((E - info['ie']) / info['se'], (N - info['inn']) / info['sn']))
P2EN = info.get('p2en') or p2en
m_moi_px = abs(info['se']) / S

doc = pymupdf.open(pdf); pg = doc[0]; W, H = pg.rect.width, pg.rect.height
Wp, Hp = int(round(W * S)), int(round(H * S))

# ---- ranh (WGS84) → mặt nạ điểm ảnh
g = json.load(open(ranh_path, encoding='utf-8'))
g = g.get('geometry', g) if isinstance(g, dict) else g
polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
mask_ranh = np.zeros((Hp, Wp), np.uint8)
for poly in polys:
    vong = []
    for ring in poly:
        pts = []
        for lng, lat in ring:
            E, N = vn.wgs84_to_vn2000(lng, lat); x, y = EN2P(E, N); pts.append((x * S, y * S))
        vong.append(np.array(pts, np.int32))
    cv2.fillPoly(mask_ranh, vong, 1)

# ---- 1) vẽ lại mảng tô theo thứ tự PDF
def bez(p0, p1, p2, p3, n=6):
    return [((1-t)**3*p0.x + 3*(1-t)**2*t*p1.x + 3*(1-t)*t*t*p2.x + t**3*p3.x,
             (1-t)**3*p0.y + 3*(1-t)**2*t*p1.y + 3*(1-t)*t*t*p2.y + t**3*p3.y) for t in np.linspace(0, 1, n)[1:]]
zone = np.full((Hp, Wp, 3), 255, np.uint8)      # màu gốc (chỉ để vẽ ảnh thử)
idimg = np.zeros((Hp, Wp, 3), np.uint8)          # MÃ MẢNG mã hoá 24 bit (mảng thứ k → k)
mau_mang = [None]
so_mang = 0
for dr in pg.get_drawings():
    f = dr.get('fill')
    if not f: continue
    col = (int(round(f[0] * 255)), int(round(f[1] * 255)), int(round(f[2] * 255)))
    if max(col) < 40 or min(col) > 245: continue      # đen (chữ/nét) và trắng (nền) không phải loại đất
    if col == (255, 0, 0): continue                    # đỏ thuần = ký hiệu đường dây / nét, không phải loại đất
    vong, cur, last = [], [], None
    for it in dr['items']:
        k = it[0]
        if k == 're':
            r = it[1]; vong.append([(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]); cur, last = [], None; continue
        if k == 'qu':
            q = it[1]; vong.append([(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)]); cur, last = [], None; continue
        p0 = it[1]
        if last is None or abs(p0.x - last[0]) > 0.01 or abs(p0.y - last[1]) > 0.01:
            if len(cur) >= 3: vong.append(cur)
            cur = [(p0.x, p0.y)]
        if k == 'l': cur.append((it[2].x, it[2].y)); last = cur[-1]
        elif k == 'c': cur += bez(it[1], it[2], it[3], it[4]); last = cur[-1]
    if len(cur) >= 3: vong.append(cur)
    if not vong: continue
    vv = [np.array([(x * S, y * S) for x, y in v], np.int32) for v in vong]
    cv2.fillPoly(zone, vv, col)
    so_mang += 1; mau_mang.append(col)
    cv2.fillPoly(idimg, vv, (so_mang >> 16, (so_mang >> 8) & 255, so_mang & 255))

pimg = (idimg[:, :, 0].astype(np.int32) << 16) | (idimg[:, :, 1].astype(np.int32) << 8) | idimg[:, :, 2]
del idimg
pimg[mask_ranh == 0] = 0

# ---- 2) nhãn mã loại đất (trong ranh)
MA = set(("ODT ONT LUA LUC LUK LUN BHK NHK HNK CLN RSX RPH RDD RSN RST RSM NTS LMU NKH TSC DTS CQP CAN SKC SKK SKN SKT "
          "SKS SKX TMD DGT DTL DNL DBV DVH DYT DGD DTT DSH DKV DRA DCH DDT DDL TON TIN NTD SON MNC PNK CSD BCS DCS NCS "
          "DNG DKH DXH DSK DCK MVB MBV TSK").split())
nhan = []   # (ma, cx, cy, do, cao)
# KHUNG CHÚ GIẢI (ngoài ranh): mã in TRONG ô màu mẫu → bảng màu → mã của chính bản vẽ (căn cứ, không đoán)
chu_giai = collections.defaultdict(collections.Counter)
def mau_tai(cx, cy):
    ix, iy = int(cx), int(cy)
    o = zone[max(0, iy-3):iy+4, max(0, ix-3):ix+4].reshape(-1, 3)
    o = [tuple(int(v) for v in c) for c in o if not (c >= 246).all()]
    return collections.Counter(o).most_common(1)[0][0] if o else None
for b in pg.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        for s in l['spans']:
            t = s['text'].strip()
            if t not in MA: continue
            x0, y0, x1, y1 = s['bbox']; cx, cy = (x0 + x1) / 2 * S, (y0 + y1) / 2 * S
            ix, iy = int(cx), int(cy)
            if not (0 <= iy < Hp and 0 <= ix < Wp): continue
            if not mask_ranh[iy, ix]:
                col = mau_tai(cx, cy)
                if col: chu_giai[col][t] += 1
                continue
            c = s['color']; r, gg, bb = (c >> 16) & 255, (c >> 8) & 255, c & 255
            nhan.append([t, cx, cy, r > 150 and gg < 100 and bb < 100, (y1 - y0) * S, (x1 - x0) * S])
# PHÂN SỐ "hiện trạng / quy hoạch" (CLN / TMD): hai mã XẾP CHỒNG thẳng hàng → mã TRÊN là hiện trạng, BỎ; mã DƯỚI là quy hoạch 2030.
# Nhận theo VỊ TRÍ chứ không theo màu (Cam Ranh in mã dưới màu đỏ nhưng PDF báo màu chữ đen).
bo = set()
for i, n in enumerate(nhan):
    for j, d in enumerate(nhan):
        if i != j and 0.4 * n[4] < d[2] - n[2] < 1.6 * n[4] and abs(d[1] - n[1]) < 0.6 * max(n[5], d[5]): bo.add(i); break
if bo: print(f'nhan phan so: bo {len(bo)} ma hien trang (ma tren), giu ma quy hoach (ma duoi)')
nhan = [n for i, n in enumerate(nhan) if i not in bo]

def pid_tai(cx, cy):
    ix, iy = int(cx), int(cy)
    if pimg[iy, ix] > 0: return int(pimg[iy, ix])
    sub = pimg[max(0, iy-3):iy+4, max(0, ix-3):ix+4].ravel(); sub = sub[sub > 0]
    if not len(sub): return 0
    v, c = np.unique(sub, return_counts=True); return int(v[c.argmax()])
theo_mang = collections.defaultdict(list)
for t, cx, cy, *_ in nhan:
    p = pid_tai(cx, cy)
    if p: theo_mang[p].append(t)
# màu nào CHẮC CHẮN chỉ một mã (đo trên chính các mảng có nhãn)
theo_mau = collections.defaultdict(collections.Counter)
for p, ds in theo_mang.items(): theo_mau[mau_mang[p]].update(ds)
mau_mot_ma = {}
for col, cc in theo_mau.items():
    top, n = cc.most_common(1)[0]; tong = sum(cc.values())
    if tong >= 5 and n / tong >= 0.85: mau_mot_ma[col] = top
tu_chu_giai = 0
for col, cc in chu_giai.items():           # chú giải là căn cứ chính: màu chỉ in cho ĐÚNG MỘT mã
    if len(cc) == 1: mau_mot_ma[col] = next(iter(cc)); tu_chu_giai += 1
    elif col in mau_mot_ma: del mau_mot_ma[col]   # chú giải ghi màu này dùng chung → không lấy theo màu
print(f'chu giai: {sum(len(c) for c in chu_giai.values())} ma tren {len(chu_giai)} mau; {tu_chu_giai} mau chi dung cho 1 ma:',
      sorted((v, '#%02x%02x%02x' % k) for k, v in mau_mot_ma.items())[:30])

# ---- 3) mảng → loại đất
ma_id, ds_ma = {}, []
def id_ma(m):
    if m not in ma_id: ma_id[m] = len(ma_id) + 1; ds_ma.append(m)
    return ma_id[m]
bang = np.zeros(so_mang + 1, np.uint8)
co_nhan = theo_mau_mot = bo_trong = 0
for p in np.unique(pimg):
    if p == 0: continue
    ds = theo_mang.get(int(p))
    if ds: bang[p] = id_ma(collections.Counter(ds).most_common(1)[0][0]); co_nhan += 1
    elif mau_mang[p] in mau_mot_ma: bang[p] = id_ma(mau_mot_ma[mau_mang[p]]); theo_mau_mot += 1
    else: bo_trong += 1
# Mảng KHÔNG nhãn, màu DÙNG CHUNG nhiều mã theo chú giải → ghi "NHÓM" (các mã có thể), KHÔNG chọn bừa một mã
# (bản thử trước cho kế thừa mảng cùng màu gần nhất: thửa ở Cam Nghĩa ra "DKV" trong khi quanh đó toàn nhãn TMD — đoán, đã bỏ).
nhom = 0
for q in np.unique(pimg):
    if q == 0 or bang[q] or mau_mang[q] not in chu_giai: continue
    cc = chu_giai[mau_mang[q]]
    if len(cc) > 1: bang[q] = id_ma('NHOM:' + '/'.join(sorted(cc))); nhom += 1
ke_thua = nhom
loai = bang[pimg]
print(f'{so_mang} mang to; trong ranh: {co_nhan} mang theo nhan, {theo_mau_mot} mang theo mau mot ma '
      f'({len(mau_mot_ma)} mau), {ke_thua} mang mau dung chung ghi NHOM, {bo_trong - ke_thua} mang de "chua xac dinh"')

# ---- tên loại đất
TEN = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'qh-pipeline', 'ten-loai-dat.json'), encoding='utf-8'))['ma_qhsdd']
TEN.update({'LUA': 'Đất trồng lúa', 'LUK': 'Đất trồng lúa nước còn lại', 'LUN': 'Đất trồng lúa nương',
            'BHK': 'Đất bằng trồng cây hàng năm khác', 'NHK': 'Đất nương rẫy trồng cây hàng năm khác',
            'LMU': 'Đất làm muối', 'TSC': 'Đất xây dựng trụ sở cơ quan', 'DTS': 'Đất xây dựng trụ sở của tổ chức sự nghiệp',
            'DBV': 'Đất công trình bưu chính, viễn thông', 'DCH': 'Đất chợ', 'DDT': 'Đất có di tích lịch sử - văn hóa',
            'DDL': 'Đất danh lam thắng cảnh', 'DSH': 'Đất sinh hoạt cộng đồng', 'TIN': 'Đất cơ sở tín ngưỡng',
            'PNK': 'Đất phi nông nghiệp khác', 'CSD': 'Đất chưa sử dụng', 'DCS': 'Đất đồi núi chưa sử dụng',
            'NCS': 'Núi đá không có rừng cây', 'SKX': 'Đất sản xuất vật liệu xây dựng, làm đồ gốm',
            'DKH': 'Đất xây dựng cơ sở khoa học và công nghệ', 'DXH': 'Đất xây dựng cơ sở dịch vụ xã hội',
            'DNG': 'Đất xây dựng cơ sở ngoại giao'})
# mã không có trong bảng (vd RSN, RST, MVB, DSK, TSK…) thì GIỮ NGUYÊN MÃ — không tự đặt tên (quy tắc ten-loai-dat.json).

# ---- 4) đa giác theo từng loại → WGS84
def px2ll(x, y):
    E, N = P2EN(x / S, y / S); lng, lat = vn.vn2000_to_wgs84(E, N); return [round(lng, 7), round(lat, 7)]
feats, dien_tich = [], collections.Counter()
for i, m in enumerate(ds_ma, 1):
    bm = (loai == i).astype(np.uint8)
    dien_tich[m] = int(bm.sum()) * m_moi_px ** 2
    cnts, hier = cv2.findContours(bm, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hier is None: continue
    hier = hier[0]; da = []
    for j, c in enumerate(cnts):
        if hier[j][3] != -1: continue                         # chỉ vòng ngoài; lỗ gắn theo
        if cv2.contourArea(c) < 2: continue
        c = cv2.approxPolyDP(c, 0.6, True)
        if len(c) < 3: continue
        vong = [[px2ll(float(p[0][0]), float(p[0][1])) for p in c]]; vong[0].append(vong[0][0])
        k = hier[j][2]
        while k != -1:
            h = cv2.approxPolyDP(cnts[k], 0.6, True)
            if len(h) >= 3 and cv2.contourArea(cnts[k]) >= 2:
                r = [px2ll(float(p[0][0]), float(p[0][1])) for p in h]; r.append(r[0]); vong.append(r)
            k = hier[k][0]
        da.append(vong)
    ten = ('Nhóm đất chưa rõ loại (bản vẽ dùng chung màu: ' + m[5:].replace('/', ', ') + ')') if m.startswith('NHOM:') else TEN.get(m, m)
    if da: feats.append({'type': 'Feature', 'properties': {'ma': m, 'ten': ten},
                         'geometry': {'type': 'MultiPolygon', 'coordinates': da}})
json.dump({'type': 'FeatureCollection', 'properties': {'nguon': os.path.basename(pdf), 'm_moi_diem_anh': round(m_moi_px, 2)},
           'features': feats}, open(ra, 'w', encoding='utf-8'), ensure_ascii=False)
phu = (loai > 0).sum() / max(1, mask_ranh.sum()) * 100
print(f'{len(ds_ma)} loai dat, phu {phu:.1f}% dien tich trong ranh, 1 diem anh = {m_moi_px:.1f} m -> {ra}')
for m, a in dien_tich.most_common(12): print(f'   {m}: {a / 1e4:,.0f} ha  {TEN.get(m, m)}')

if anh_thu:   # ảnh xem nhanh: trái = màu gốc trong ranh, phải = loại đất đã gán (mỗi loại một màu ngẫu nhiên cố định)
    rng = np.random.default_rng(7); bang = rng.integers(40, 230, (256, 3)).astype(np.uint8); bang[0] = 255
    goc = zone.copy(); goc[mask_ranh == 0] = 255
    ys, xs = np.nonzero(mask_ranh); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    ghep = np.hstack([goc[y0:y1, x0:x1][:, :, ::-1], bang[loai[y0:y1, x0:x1]]])
    k = 2000 / ghep.shape[1]
    cv2.imwrite(anh_thu, cv2.resize(ghep, (2000, int(ghep.shape[0] * k)), interpolation=cv2.INTER_AREA))
    print('anh thu:', anh_thu)
