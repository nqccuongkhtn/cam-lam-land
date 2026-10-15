# -*- coding: utf-8 -*-
# BÓC VÙNG LOẠI ĐẤT từ bản đồ QHSDĐ 2030 dạng PDF (nét vector) → GeoJSON có toạ độ thật (WGS84), cắt theo ranh huyện.
# Dùng để tính DIỆN TÍCH TỪNG LOẠI ĐẤT TRÊN TỪNG THỬA cho các huyện/thị ngoài Cam Lâm (Cam Lâm có CAD gốc, không dùng cái này).
#
# Dùng: python -P boc_loai_dat.py <pdf> <tam_lng> <tam_lat> <ranh.json> <S1 px/pt> <ra.geojson> [anh_thu.png] [--m=2.0] [--mau-chuan=bang-mau-chuan.json]
#   S1   = độ phóng LƯỢT 1 (quyết định loại đất cho từng mảng; 1,5 là đủ).
#   --m  = mét / điểm ảnh của LƯỢT 2 (vẽ ranh vùng sắc nét theo từng ô 2048 điểm ảnh; mặc định 2 m).
#   --mau-chuan = BẢNG MÀU CHUẨN của tỉnh (lap_bang_mau_chuan.py, gom từ chú giải các bản đọc được đầy đủ) — chỉ BỔ SUNG màu mà
#       chú giải của chính bản này không có (Ninh Hòa đọc được 10 mã: thiếu #ffaa32 DGT, #ffa0ff ODT…). Chú giải của bản vẫn ưu tiên.
#   Ghi kèm <ra>.chu-giai.json = chú giải bản này đọc được (để lập / soi bảng màu chuẩn).
#   (pdf phải nắn được: nan2.py tự đọc nhãn lưới, hoặc có file <pdf>.nan.json bên cạnh — xem nan/)
#
# Cách làm (14/10/2026, phát triển từ bản thử Cam Ranh 13–14/10):
#  1) Vẽ lại MỌI mảng tô màu (+ nét DÀY có màu, vd đường giao thông vẽ bằng nét cam) theo ĐÚNG THỨ TỰ VẼ của PDF
#     (vẽ sau đè vẽ trước, y như mắt nhìn); mỗi mảng tô đủ mọi vòng một lượt nên lỗ thủng được giữ.
#  2) NHÃN MÃ LOẠI ĐẤT (ODT, CLN, TMD…) trong ranh. Nhãn PHÂN SỐ "CLN / TMD" (mã trên = hiện trạng, mã dưới = quy hoạch 2030):
#     hai mã xếp chồng thẳng hàng CÓ VẠCH NGANG ở giữa → bỏ mã trên.
#  3) KHUNG CHÚ GIẢI: mã in trong ô màu mẫu (ngoài ranh, chữ to hơn nhãn bản đồ; bản in chữ cùng cỡ thì lấy mọi mã ngoài ranh)
#     → màu nào chú giải chỉ dùng cho ĐÚNG MỘT mã. Màu bản vẽ hay lệch ô mẫu vài đơn vị → so "gần nhất rõ ràng".
#  4) Gán theo TỪNG MẢNG: có nhãn bên trong → mã đa số; không nhãn → màu một mã (theo chú giải); màu dùng chung nhiều mã →
#     "nhóm" (đặt tên theo nhóm: đất trồng lúa / đất rừng / công trình công cộng…), KHÔNG chọn bừa một mã; còn lại để trống.
#  5) LƯỢT 2: vẽ lại từng ô ở ~2 m/điểm ảnh, lấp khe do nét viền (≤ 12 m) bằng loại kề bên, cắt theo ranh, đổi
#     điểm ảnh → điểm PDF → VN-2000 → WGS84 (nan2.lap_phep_doi), mỗi vùng một đa giác (properties: ma, ten, mau).
# ⚠️ Đây là BÓC TỪ BẢN IN 1:25.000 — sai số cỡ vài mét ở mép vùng: dùng để THAM KHẢO, khác hẳn số liệu Cam Lâm tính từ CAD gốc.
# Đã thử và BỎ: gán theo MÀU + chia theo nhãn gần nhất (cả vịnh Cam Ranh thành "thuỷ sản", rừng chia mảnh cạnh thẳng);
# kế thừa mảng cùng màu gần nhất (thửa Cam Nghĩa ra "DKV" giữa vùng toàn nhãn TMD — là đoán).
import sys, os, json, collections, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf, numpy as np, cv2
from shapely.geometry import Polygon as _Poly
import nan2, vn2000 as vn

co = [a for a in sys.argv[1:] if a.startswith('--')]
ts = [a for a in sys.argv[1:] if not a.startswith('--')]
pdf, tlng, tlat, ranh_path, S, ra = ts[0], float(ts[1]), float(ts[2]), ts[3], float(ts[4]), ts[5]
anh_thu = ts[6] if len(ts) > 6 else None
M_PX = float(next((a.split('=')[1] for a in co if a.startswith('--m=')), 2.0))
MAU_CHUAN = next((a.split('=', 1)[1] for a in co if a.startswith('--mau-chuan=')), None)
t0 = time.time()

p2en, p2w, info = nan2.lap_phep_doi(pdf, tlng, tlat)
if not p2en: sys.exit('LOI: khong nan duoc ban do (thieu nhan luoi / .nan.json)')
EN2P = info.get('en2p') or (lambda E, N: ((E - info['ie']) / info['se'], (N - info['inn']) / info['sn']))
P2EN = info.get('p2en') or p2en
m_moi_pt = abs(info['se'])
m_moi_px = m_moi_pt / S

doc = pymupdf.open(pdf); pg = doc[0]; W, H = pg.rect.width, pg.rect.height
Wp, Hp = int(round(W * S)), int(round(H * S))

# ---- ranh (WGS84) → vòng theo điểm PDF + mặt nạ lượt 1
g = json.load(open(ranh_path, encoding='utf-8'))
g = g.get('geometry', g) if isinstance(g, dict) else g
polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
ranh_pt = []                                   # [[vòng (n×2, điểm PDF)…] mỗi đa giác]
for poly in polys:
    ranh_pt.append([np.array([EN2P(*vn.wgs84_to_vn2000(lng, lat)) for lng, lat in ring], np.float64) for ring in poly])
mask_ranh = np.zeros((Hp, Wp), np.uint8)
for poly in ranh_pt: cv2.fillPoly(mask_ranh, [np.round(r * S).astype(np.int32) for r in poly], 1)
RX0 = min(r[:, 0].min() for p in ranh_pt for r in p); RX1 = max(r[:, 0].max() for p in ranh_pt for r in p)
RY0 = min(r[:, 1].min() for p in ranh_pt for r in p); RY1 = max(r[:, 1].max() for p in ranh_pt for r in p)

# ---- 1) vẽ lại mảng tô (+ nét dày có màu) theo thứ tự PDF — lượt 1, đồng thời CẤT hình từng mảng cho lượt 2
def bez(p0, p1, p2, p3, n=6):
    return [((1-t)**3*p0.x + 3*(1-t)**2*t*p1.x + 3*(1-t)*t*t*p2.x + t**3*p3.x,
             (1-t)**3*p0.y + 3*(1-t)**2*t*p1.y + 3*(1-t)*t*t*p2.y + t**3*p3.y) for t in np.linspace(0, 1, n)[1:]]
zone = np.full((Hp, Wp, 3), 255, np.uint8)      # màu gốc (đọc chú giải + vẽ ảnh thử)
vach = []                                        # đoạn NGANG ngắn (3–40 pt) = ứng viên vạch phân số (y, x0, x1) theo điểm ảnh
idimg = np.zeros((Hp, Wp, 3), np.uint8)          # MÃ MẢNG mã hoá 24 bit (mảng thứ k → k)
mau_mang = [None]
hinh = [None]                                    # hình từng mảng (điểm PDF): ('to', [vòng…]) hoặc ('net', [đường…], dày_pt)
hop = [(0, 0, 0, 0)]                             # khung bao từng mảng (điểm PDF)
so_mang = 0
glyph_do, glyph_den = [], []                     # khung (điểm PDF) các mảng tô nhỏ cỡ chữ màu ĐỎ / ĐEN = nét chữ của nhãn
MAU_NET_CHU = {(0, 0, 255), (150, 0, 150), (0, 135, 135)}   # màu NÉT CHỮ / ký hiệu nhãn (xanh dương, tím, xanh đậm) — không phải loại đất
S_LO = 0.5                                       # ảnh mã mảng CHỈ GỒM MẢNG TÔ (không nét), 0,5 điểm ảnh / điểm PDF — để dò viền hồng ranh huyện
H_LO, W_LO = int(round(H * S_LO)) + 1, int(round(W * S_LO)) + 1
idlo = np.zeros((H_LO, W_LO), np.int32)
def ma24(k): return (k >> 16, (k >> 8) & 255, k & 255)
for dr in pg.get_drawings():
    if dr.get('color') is not None:
        for it in dr['items']:
            if it[0] == 'l' and abs(it[1].y - it[2].y) < 0.05 and 3 < abs(it[1].x - it[2].x) < 40:
                vach.append((it[1].y * S, min(it[1].x, it[2].x) * S, max(it[1].x, it[2].x) * S))
    sc, sw = dr.get('color'), dr.get('width') or 0
    if sc is not None and sw >= 1.0 and not dr.get('fill'):
        scol = (int(round(sc[0] * 255)), int(round(sc[1] * 255)), int(round(sc[2] * 255)))
        if max(scol) >= 40 and min(scol) <= 245 and scol != (255, 0, 0):
            net = []
            for it in dr['items']:
                if it[0] == 'l': net.append(np.array([(it[1].x, it[1].y), (it[2].x, it[2].y)]))
                elif it[0] == 'c': net.append(np.array([(it[1].x, it[1].y)] + bez(it[1], it[2], it[3], it[4])))
            if net:
                vv = [np.round(v * S).astype(np.int32) for v in net]; day = max(1, int(round(sw * S)))
                cv2.polylines(zone, vv, False, scol, day)
                so_mang += 1; mau_mang.append(scol); hinh.append(('net', net, sw))
                a = np.vstack(net); hop.append((a[:, 0].min() - sw, a[:, 1].min() - sw, a[:, 0].max() + sw, a[:, 1].max() + sw))
                cv2.polylines(idimg, vv, False, ma24(so_mang), day)
    f = dr.get('fill')
    if not f: continue
    col = (int(round(f[0] * 255)), int(round(f[1] * 255)), int(round(f[2] * 255)))
    if max(col) < 40 or col == (255, 0, 0):
        # đen (chữ/nét) và đỏ thuần (ký hiệu đường dây / nét) không phải loại đất. Nhưng mảng nhỏ cỡ chữ của hai màu này chính là
        # NÉT CHỮ của nhãn (Nha Trang, Cam Ranh: nhãn vẽ bằng hình, phần chữ máy đọc được đều báo màu đen) → cất khung để biết
        # nhãn nào in ĐỎ (quy hoạch) / ĐEN (hiện trạng)
        r_ = dr['rect']
        if r_.width < 20 and r_.height < 20: (glyph_do if col == (255, 0, 0) else glyph_den).append((r_.x0, r_.y0, r_.x1, r_.y1))
        continue
    if min(col) > 245: continue                        # trắng (nền)
    # (15/10/2026) XANH DƯƠNG THUẦN #0000ff cỡ chữ = nét chữ mã hiện trạng / vạch phân số / ký hiệu của NHÃN (Khánh Sơn 2.577 hình, Vạn Ninh
    # 797, Diên Khánh 478; hình lớn nhất 14,8 điểm in; không bản nào dùng #0000ff làm màu loại đất). Trước thành mảng "chưa xác định" vẽ
    # SAU nên CHE đất bên dưới → thửa nằm dưới nhãn mất cả trăm m² (Thửa 430 · Tờ 6 Suối Hiệp: vạch xanh che 549 / 831 m² thành "chưa xác
    # định", đất thật bên dưới là CLN + đường). Nay bỏ qua như nét chữ đen / đỏ.
    # Cùng kiểu: chữ TÊN ĐỊA DANH màu TÍM #960096 (Vạn Ninh 621 hình, Khánh Sơn 51 — chữ "g" của "Vạn Giã" che 177 m² Thửa 353 · Tờ 8
    # xã Vạn Ninh) và XANH ĐẬM #008787 (Vạn Ninh 7 hình); mọi hình ≤ 8,8 điểm in, không màu nào trong chú giải.
    if col in MAU_NET_CHU and dr['rect'].width < 20 and dr['rect'].height < 20: continue
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
    va_ = [np.array(v, np.float64) for v in vong]
    vv = [np.round(v * S).astype(np.int32) for v in va_]
    cv2.fillPoly(zone, vv, col)
    so_mang += 1; mau_mang.append(col); hinh.append(('to', va_, 0))
    a = np.vstack(va_); hop.append((a[:, 0].min(), a[:, 1].min(), a[:, 0].max(), a[:, 1].max()))
    cv2.fillPoly(idimg, vv, ma24(so_mang))
    cv2.fillPoly(idlo, [np.round(v * S_LO).astype(np.int32) for v in va_], so_mang)
hop = np.array(hop, np.float64)

pimg = (idimg[:, :, 0].astype(np.int32) << 16) | (idimg[:, :, 1].astype(np.int32) << 8) | idimg[:, :, 2]
del idimg
pimg[mask_ranh == 0] = 0

# ---- 2) nhãn mã loại đất (trong ranh) + khung chú giải (ngoài ranh)
MA = set(("ODT ONT LUA LUC LUK LUN BHK NHK HNK CLN RSX RPH RDD RSN RST RSM NTS LMU NKH TSC DTS CQP CAN SKC SKK SKN SKT "
          "SKS SKX TMD DGT DTL DNL DBV DVH DYT DGD DTT DSH DKV DRA DCH DDT DDL TON TIN NTD SON MNC PNK CSD BCS DCS NCS "
          "DNG DKH DXH DSK DCK MVB MBV TSK "
          # mã Thông tư 08/2024/TT-BTNMT (chú giải bản Diên Khánh QĐ 1564/2025 — đọc 14/10/2026 khuya)
          "CNT DDD DPC CSK SCC SCT CCC DCT TVC CGT MCS NNP CHN PNN OTC CQA DSN DMT DKT LNP "
          # mã cũ có trong chú giải Nha Trang / Vạn Ninh (đọc 14/10/2026 khuya): phát triển hạ tầng, mặt nước ven biển
          "DHT MVT MVK MVR").split())
nhan = []   # [ma, cx, cy, do, cao, rong, co_chu] theo điểm ảnh lượt 1
chu_giai = collections.defaultdict(collections.Counter)
ngoai = []   # mã NGOÀI ranh: chú giải + nhãn của phần đất huyện bên cạnh (nếu bản vẽ có tô) → phải tách
def mau_tai(cx, cy):
    ix, iy = int(cx), int(cy)
    c0 = zone[iy, ix]
    if not (c0 >= 246).all(): return tuple(int(v) for v in c0)      # đúng tại tâm chữ (chữ nằm trong ô màu mẫu)
    o = zone[max(0, iy-3):iy+4, max(0, ix-3):ix+4].reshape(-1, 3)
    o = [tuple(int(v) for v in c) for c in o if not (c >= 246).all()]
    return collections.Counter(o).most_common(1)[0][0] if o else None
GDO = np.array(glyph_do, np.float64) if glyph_do else np.zeros((0, 4))
GDEN = np.array(glyph_den, np.float64) if glyph_den else np.zeros((0, 4))
def phu_chu(bb, G):                              # tổng diện tích giao giữa khung chữ bb và các khung nét chữ G (điểm PDF²)
    if not len(G): return 0.0
    ix = np.clip(np.minimum(G[:, 2], bb[2]) - np.maximum(G[:, 0], bb[0]), 0, None)
    iy = np.clip(np.minimum(G[:, 3], bb[3]) - np.maximum(G[:, 1], bb[1]), 0, None)
    return float((ix * iy).sum())
so_do_hinh = 0                                   # số nhãn nhận màu theo NÉT CHỮ vẽ bằng hình (không theo màu chữ PDF báo)
for b in pg.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        for s in l['spans']:
            t = s['text'].strip()
            if t not in MA: continue
            x0, y0, x1, y1 = s['bbox']; cx, cy = (x0 + x1) / 2 * S, (y0 + y1) / 2 * S
            ix, iy = int(cx), int(cy)
            if not (0 <= iy < Hp and 0 <= ix < Wp): continue
            if not mask_ranh[iy, ix]:
                ngoai.append((t, cx, cy, s['size'])); continue
            c = s['color']; r, gg, bb = (c >> 16) & 255, (c >> 8) & 255, c & 255
            do_ = r > 150 and gg < 100 and bb < 100
            # Màu THẬT của nhãn = màu nét chữ vẽ bằng hình đè đúng chỗ chữ (Nha Trang: chữ PDF báo đen hết, nhãn quy hoạch đỏ là hình)
            a_do, a_den = phu_chu((x0, y0, x1, y1), GDO), phu_chu((x0, y0, x1, y1), GDEN)
            if a_do + a_den > 0.15 * max((x1 - x0) * (y1 - y0), 1e-6): do_ = a_do > a_den; so_do_hinh += 1
            nhan.append([t, cx, cy, do_, (y1 - y0) * S, (x1 - x0) * S, s['size']])
# NHÃN VẼ BẰNG HÌNH (--nhan-hinh=<file.json>, 14/10/2026 khuya): bản KHÔNG có lớp chữ (Diên Khánh: 0 chữ, mọi nhãn là hình tô nhỏ, đỏ =
# quy hoạch, đen = hiện trạng) → doc_nhan_hinh.py gom chữ cái theo hình dạng + bảng chữ người nhìn gán → [{t, do, bbox, cao}]. Dùng y như
# nhãn chữ: trong ranh → nhãn; ngoài ranh → ứng viên chú giải (cỡ = chiều cao chữ, chú giải in to hơn nhãn). Màu lấy thẳng màu nét chữ.
NHAN_HINH = next((a.split('=', 1)[1] for a in co if a.startswith('--nhan-hinh=')), None)
if NHAN_HINH:
    so_nh = 0; ngoai_hinh = []
    for w in json.load(open(NHAN_HINH, encoding='utf-8')):
        t = w['t']
        if t not in MA: continue
        x0, y0, x1, y1 = w['bbox']; cx, cy = (x0 + x1) / 2 * S, (y0 + y1) / 2 * S
        ix, iy = int(cx), int(cy)
        if not (0 <= iy < Hp and 0 <= ix < Wp): continue
        if not mask_ranh[iy, ix]: ngoai_hinh.append((t, cx, cy, w['cao'], bool(w['do']))); continue
        nhan.append([t, cx, cy, bool(w['do']), (y1 - y0) * S, (x1 - x0) * S, w['cao']]); so_nh += 1
    # Chú giải HAI CỘT "Hiện trạng | Quy hoạch" (Diên Khánh, Thông tư 08/2024): cột Quy hoạch ghi mã ĐỎ trong ô màu quy hoạch; cột Hiện trạng
    # ghi mã đen. Nhóm đất CHƯA SỬ DỤNG (MCS, CSD, BCS, DCS, CGT, NCS) có màu ở cột Hiện trạng nhưng ô Quy hoạch để TRẮNG → mã đen của nhóm này
    # KHÔNG được định màu quy hoạch (trước: màu xanh hồ chứa #b4ffff bị gán thêm MCS → 178 ha hồ chứa thành "nhóm"). Mã khác giữ cả hai cột:
    # thử "chỉ lấy mã đỏ" thì mất SKN (chữ đỏ SKN ở cột Quy hoạch đọc sót) → 87 ha cụm công nghiệp thành "nhóm".
    CHUA_SD = {'MCS', 'CSD', 'BCS', 'DCS', 'CGT', 'NCS'}
    co_do_ngoai = any(x[4] for x in ngoai_hinh)
    ngoai += [(t, cx, cy, sz) for t, cx, cy, sz, do_ in ngoai_hinh if do_ or not co_do_ngoai or t not in CHUA_SD]
    print(f'nhan ve bang hinh: {so_nh} trong ranh, {len(ngoai_hinh)} ngoai ranh'
          f'{" (chu giai: bo ma DEN nhom chua su dung)" if co_do_ngoai else ""} (tu {NHAN_HINH})')
# CHÚ GIẢI = mã ngoài ranh có cỡ chữ TO hơn hẳn nhãn trên bản đồ (Cam Ranh: chú giải 5,1–5,5; nhãn 4,1–4,5).
# Mã ngoài ranh cỡ chữ như nhãn = nhãn của huyện bên cạnh → bỏ (trước đọc lẫn nên màu đường giao thông ra 8 mã).
co_nhan = sorted(n[6] for n in nhan)
nguong_co = (co_nhan[len(co_nhan) // 2] * 1.12) if co_nhan else 0
for t, cx, cy, sz in ngoai:
    if sz < nguong_co: continue
    col = mau_tai(cx, cy)
    if col: chu_giai[col][t] += 1
if sum(len(c) for c in chu_giai.values()) < 8:
    # Dự phòng: bản in chữ chú giải CÙNG CỠ nhãn (Khánh Vĩnh) → lấy mọi mã ngoài ranh. Chỉ an toàn khi bản vẽ KHÔNG tô màu
    # phần huyện bên cạnh (Khánh Vĩnh: ngoài ranh để trắng) — bản nào tô cả huyện bên cạnh thì phải soi lại chú giải bằng mắt.
    chu_giai.clear()
    for t, cx, cy, sz in ngoai:
        col = mau_tai(cx, cy)
        if col: chu_giai[col][t] += 1
    print('chu giai: chu cung co nhan -> lay moi ma ngoai ranh (du phong)')

json.dump({'#%02x%02x%02x' % k: dict(v) for k, v in chu_giai.items()}, open(ra.replace('.geojson', '') + '.chu-giai.json', 'w',
          encoding='utf-8'), ensure_ascii=False, indent=0)
if '--chi-chu-giai' in co: print('chu giai:', sum(len(c) for c in chu_giai.values()), 'ma tren', len(chu_giai), 'mau (chi doc chu giai)'); sys.exit(0)
if MAU_CHUAN:
    them = 0
    for hx, mas in json.load(open(MAU_CHUAN, encoding='utf-8'))['mau'].items():
        col = (int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16))
        if col in chu_giai: continue                      # chú giải của chính bản này ưu tiên
        chu_giai[col] = collections.Counter({m: 1 for m in mas['ma']}); them += 1
    print(f'bang mau chuan: bo sung {them} mau chu giai ban nay khong co')

# PHÂN SỐ "hiện trạng / quy hoạch" (CLN / TMD): hai mã XẾP CHỒNG thẳng hàng CÓ VẠCH NGANG ở giữa → bỏ mã TRÊN (hiện trạng).
# Nhận theo VỊ TRÍ chứ không theo màu (Cam Ranh in mã dưới màu đỏ nhưng PDF báo màu chữ đen).
va = np.array(vach) if vach else np.zeros((0, 3))
def co_vach(n, d):
    if not len(va): return False
    m = (va[:, 0] > n[2]) & (va[:, 0] < d[2]) & (va[:, 1] < max(n[1], d[1])) & (va[:, 2] > min(n[1], d[1]))
    return bool(m.any())
bo = set()
for i, n in enumerate(nhan):
    for j, d in enumerate(nhan):
        if i != j and 0.4 * n[4] < d[2] - n[2] < 1.8 * n[4] and abs(d[1] - n[1]) < 0.6 * max(n[5], d[5]) and co_vach(n, d):
            bo.add(i); break
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
# màu nào CHẮC CHẮN chỉ một mã: đo trên chính các mảng có nhãn, rồi CHÚ GIẢI (căn cứ chính) ghi đè
theo_mau = collections.defaultdict(collections.Counter)
for p, ds in theo_mang.items(): theo_mau[mau_mang[p]].update(ds)
mau_mot_ma = {}
for col, cc in theo_mau.items():
    top, n = cc.most_common(1)[0]; tong = sum(cc.values())
    if tong >= 5 and n / tong >= 0.85: mau_mot_ma[col] = top
tu_chu_giai = 0
# TÊN NHÓM trong chú giải Thông tư 08/2024 (dòng tiêu đề nhóm, hay tô CÙNG màu với mã con duy nhất của nó: Diên Khánh "TVC — Đất có mặt
# nước chuyên dùng" cùng màu MNC) → màu chỉ gồm tên nhóm + đúng MỘT mã cụ thể thì là mã cụ thể đó (không phải màu dùng chung).
TEN_NHOM_TT08 = {'NNP', 'CHN', 'LNP', 'PNN', 'OTC', 'CQA', 'DSN', 'CSK', 'SCC', 'CCC', 'TVC', 'CSD'}
for col, cc in chu_giai.items():
    cu_the = [m for m in cc if m not in TEN_NHOM_TT08]
    if len(cc) == 1: mau_mot_ma[col] = next(iter(cc)); tu_chu_giai += 1
    elif len(cu_the) == 1: mau_mot_ma[col] = cu_the[0]; tu_chu_giai += 1
    elif col in mau_mot_ma: del mau_mot_ma[col]
# Màu bản vẽ hay LỆCH ô mẫu chú giải (Cam Ranh: lúa #fffc8c ↔ #fffc82 = 324 ha; Khánh Vĩnh: CLN #ffd2a0 ↔ #ffd7aa) →
# "GẦN NHẤT RÕ RÀNG": lệch ≤ 25 (tổng |ΔR|+|ΔG|+|ΔB|) VÀ màu chú giải gần thứ hai mà ghi MÃ KHÁC xa gấp ≥ 1,8 lần.
LECH_MAU, GAP_RO = 25, 1.8
_lech = lambda c, col: sum(abs(a - b) for a, b in zip(c, col))
_cg_cache = {}
def mau_cg(col):
    if col in _cg_cache: return _cg_cache[col]
    kq = None
    if col in chu_giai or col in mau_mot_ma: kq = col
    elif chu_giai:
        ds = sorted(chu_giai, key=lambda c: _lech(c, col)); gan = ds[0]; d1 = _lech(gan, col)
        if d1 <= LECH_MAU:
            khac = [c for c in ds[1:] if set(chu_giai[c]) != set(chu_giai[gan])]
            if not khac or _lech(khac[0], col) >= GAP_RO * max(d1, 1): kq = gan
    _cg_cache[col] = kq; return kq
print(f'chu giai: {sum(len(c) for c in chu_giai.values())} ma tren {len(chu_giai)} mau; {tu_chu_giai} mau chi dung cho 1 ma:',
      sorted((v, '#%02x%02x%02x' % k) for k, v in mau_mot_ma.items())[:30])

# ---- 2b) VIỀN HỒNG QUANH RANH HUYỆN (15/10/2026) — KHÔNG PHẢI LOẠI ĐẤT
# Bản vẽ tô một dải hồng rộng ~10–14 điểm in (~100–150 m) bao quanh ranh huyện (hoặc tô cả nền huyện màu hồng rồi vẽ đất đè lên — chỉ còn
# lộ dải viền), màu trùng / sát màu đất ở: Diên Khánh #ffa0ff (= ODT), Vạn Ninh #ffa0ff, Khánh Sơn #ffd0ff (= ONT) + #ffbff1, Nha Trang
# #ff9efc, Cam Ranh #ffa0fc, Ninh Hòa + Khánh Vĩnh #ffd0e8 (nền từng mảnh bản đồ). Ranh dựng từ vùng màu nên ôm cả dải này → trước bị bóc
# thành "Đất ở…": Diên Khánh 1 vùng ODT 1.637 ha nằm trọn trên đất Nha Trang / Khánh Vĩnh / Cam Lâm (1 thửa Diên Khánh / 500 thửa huyện
# khác), Vạn Ninh 1.008 ha, Khánh Sơn 516 ha…; thửa của chính huyện vắt qua ranh vẽ thì dính vài chục — vài trăm m² "đất ở" giả.
# DÒ: mảng TÔ màu hồng (lệch ODT #ffa0ff / ONT #ffd0ff ≤ 45 mỗi kênh) mà ≥ 90 % phần NHÌN THẤY (trong ranh, chỉ xét mảng tô) nằm cách chỗ
# KHÔNG TÔ GÌ (nền trắng ngoài bản đồ) ≤ 18 điểm in; vùng đất ở thật nằm lọt trong huyện ~0 % (đo cả 7 bản: viền 94–100 %, đất ở thật 0–10 %).
#   • màu đúng ô chú giải (ODT / ONT) → còn phải lộ ≥ 10 ha (mảng đất ở nhỏ sát chỗ trắng giữ nguyên);
#   • màu KHÔNG có trong chú giải mà ≥ 90 % diện tích lộ của màu đó là viền → màu NỀN: bỏ MỌI mảng màu đó (cả chỗ nền lộ qua khe trong huyện).
# Mảng viền thành TRONG SUỐT (y như nét ranh giới): không ghi loại, không che mảng khác; chỗ đó trên thửa thành "Chưa xác định loại đất".
mask_lo = cv2.resize(mask_ranh, (W_LO, H_LO), interpolation=cv2.INTER_NEAREST)
co_to_lo = idlo > 0
dist_lo = cv2.distanceTransform(co_to_lo.astype(np.uint8), cv2.DIST_L2, 3) / S_LO       # (điểm in) tới chỗ không tô gần nhất
lo_trong = co_to_lo & (mask_lo > 0)
vis_lo = np.bincount(idlo[lo_trong], minlength=so_mang + 1)
gan_lo = np.bincount(idlo[lo_trong & (dist_lo <= 18)], minlength=so_mang + 1)
del dist_lo, co_to_lo, lo_trong, mask_lo
px_lo_m2 = (m_moi_pt / S_LO) ** 2
def _hong(c): return min(max(abs(a - b) for a, b in zip(c, m)) for m in ((255, 160, 255), (255, 208, 255))) <= 45
mau_hong = collections.defaultdict(lambda: [0, 0])                 # màu → [diện tích lộ, phần lộ của mảng viền]
for k in range(1, so_mang + 1):
    if hinh[k][0] != 'to' or not _hong(mau_mang[k]) or not vis_lo[k]: continue
    mau_hong[mau_mang[k]][0] += vis_lo[k]
    if gan_lo[k] >= 0.9 * vis_lo[k]: mau_hong[mau_mang[k]][1] += vis_lo[k]
mau_nen = {c for c, (a, b) in mau_hong.items() if c not in chu_giai and b >= 0.9 * a}
vien_hong = set()
for k in range(1, so_mang + 1):
    if hinh[k][0] != 'to': continue
    if mau_mang[k] in mau_nen: vien_hong.add(k); continue
    if _hong(mau_mang[k]) and vis_lo[k] * px_lo_m2 >= 1e5 and gan_lo[k] >= 0.9 * vis_lo[k]: vien_hong.add(k)
# Mảng TRÙNG HÌNH mảng viền (Vạn Ninh vẽ dải viền HAI LẦN, mảng 86095 = 86096): mảng dưới bị che kín nên lượt 1 không lộ điểm nào, bỏ
# mảng trên thì nó lộ ra và lại thành "Đất ở" 1.008 ha → cùng màu + cùng khung bao (lệch ≤ 0,1 điểm in) với mảng viền thì cũng là viền.
_khung_vien = {(mau_mang[k], tuple(np.round(hop[k], 1))) for k in vien_hong}
for k in range(1, so_mang + 1):
    if hinh[k][0] == 'to' and k not in vien_hong and (mau_mang[k], tuple(np.round(hop[k], 1))) in _khung_vien: vien_hong.add(k)
print(f'vien hong quanh ranh huyen (bo, khong phai loai dat): {len(vien_hong)} mang, lo {sum(int(vis_lo[k]) for k in vien_hong) * px_lo_m2 / 1e4:,.0f} ha; '
      f'mau nen: {sorted("#%02x%02x%02x" % c for c in mau_nen)}')
del idlo

# ---- 3) mảng → loại đất
ma_id, ds_ma = {}, []
def id_ma(m):
    if m not in ma_id: ma_id[m] = len(ma_id) + 1; ds_ma.append(m)
    return ma_id[m]
bang = np.zeros(so_mang + 1, np.uint8)
so_px = np.bincount(pimg.ravel(), minlength=so_mang + 1)
co_nhan_ = theo_mau_mot = nhom = bo_trong = 0
# GÁN MÃ (sửa 14/10/2026 — chủ dự án so 10 thửa Nha Trang với app tham chiếu): trước đây CÓ NHÃN TRONG MẢNG là lấy nhãn, kể cả khi
# màu mảng nói khác → dải đường cam (DGT) dài chứa nhãn "DTL" của con kênh chạy cạnh bị ghi thành thuỷ lợi; vùng màu dùng chung chứa
# nhãn đen hiện trạng "ONT" bị ghi ONT thay vì nhãn đỏ quy hoạch "DKV". Nay:
#   1) màu chú giải chỉ dùng cho MỘT mã → theo MÀU (nhãn trong mảng có thể là của đối tượng khác);
#   2) màu dùng chung nhiều mã (vd hồng cá hồi = 16 mã đất công cộng) → chỉ nhận nhãn THUỘC tập mã của màu đó và NẰM TRONG mảng.
#      Bản có phân biệt màu nhãn (đỏ = quy hoạch, đen = hiện trạng — màu lấy theo NÉT CHỮ vẽ bằng hình, xem phu_chu) thì CHỈ nhận nhãn
#      ĐỎ; không có nhãn đỏ hợp lệ trong mảng → ghi NHÓM "chưa ghi rõ loại" (bản đồ không ghi thì không đoán).
#      Đã thử và BỎ: lấy nhãn hợp lệ gần nhất ngoài mảng (30 điểm in rồi 10 điểm in): 2/10 thửa đối chứng Nha Trang ra SAI tên
#      (thửa 15 tờ 33 Vĩnh Lương: mảng không nhãn — app tham chiếu ghi PNK — bị gán DKV của mảng bên cạnh; thửa 107 tờ 49 Phước
#      Đồng: dải ven sông — app ghi DKV — bị gán TMD là mã HIỆN TRẠNG in đen ở phân số "TMD / ONT").
#   3) màu chú giải không có → theo nhãn trong mảng như cũ.
#   (nhãn đỏ đè ra NGOÀI vùng — trên mặt sông, lòng đường — xem nhan_ngoai bên dưới)
CO_CHU_DO = sum(1 for n in nhan if n[3]) >= max(20, 0.05 * len(nhan))
# Luật chữ đen đứng một mình, KIỂU CHẶT (xem chỗ gán mã màu dùng chung). 15/10/2026 chủ dự án DUYỆT → MẶC ĐỊNH BẬT; tắt: --khong-chu-den.
CHU_DEN = '--khong-chu-den' not in co
print(f'nhan: {len(nhan)} trong ranh, {sum(1 for n in nhan if n[3])} nhan DO ({so_do_hinh} nhan xet mau theo net chu ve bang hinh)'
      f' -> {"CHI NHAN DO cho mau dung chung" if CO_CHU_DO else "ban khong phan biet mau nhan"}')
nhan_mang = collections.defaultdict(list)                    # mảng → [(mã, đỏ?)]
for t, cx, cy, do_, *_ in nhan:
    p = pid_tai(cx, cy)
    if p: nhan_mang[p].append((t, do_))
def tap_cua(p):
    cg = mau_cg(mau_mang[p]) if p else None
    return set(chu_giai[cg]) if (cg is not None and cg in chu_giai) else set()
# NHÃN ĐÈ RA NGOÀI VÙNG: vùng hẹp / dải ven sông thì người vẽ hay đặt nhãn đè lên mặt sông, lòng đường bên cạnh (Nha Trang: thửa 15
# tờ 33 Vĩnh Lương — "DKV" đỏ của vùng cá hồi nằm trên mặt sông #a0ffff). Nhãn đỏ hợp lệ mà mảng dưới tâm chữ KHÔNG cùng nhóm mã →
# gán cho mảng cùng nhóm GẦN NHẤT trong 3 điểm in (~28 m ở 1:10.000), CHỈ KHI RÕ RÀNG: mảng cùng nhóm gần thứ hai xa gấp ≥ 2 lần.
nhan_ngoai = collections.defaultdict(list)
R_NG = int(round(3 * S))
for t, cx, cy, do_, *_ in nhan:
    if CO_CHU_DO and not do_: continue
    p0 = pid_tai(cx, cy)
    if p0 and t in tap_cua(p0): continue                     # nằm trong mảng của chính nó → đã tính ở trên
    ix, iy = int(cx), int(cy)
    y0_, x0_ = max(0, iy - R_NG), max(0, ix - R_NG)
    w = pimg[y0_:iy + R_NG + 1, x0_:ix + R_NG + 1]
    if not w.size: continue
    yy, xx = np.nonzero(w > 0)
    if not len(yy): continue
    d = np.hypot(xx + x0_ - cx, yy + y0_ - cy); ids = w[yy, xx]
    gan = {}
    for q, dq in zip(ids.tolist(), d.tolist()):
        if q != p0 and (q not in gan or dq < gan[q]): gan[q] = dq
    ung = sorted((dq, q) for q, dq in gan.items() if dq <= R_NG and t in tap_cua(q) and len(tap_cua(q)) > 1)
    if ung and (len(ung) == 1 or ung[1][0] >= 2 * max(ung[0][0], 0.5)): nhan_ngoai[ung[0][1]].append(t)
for p in np.unique(pimg):
    if p == 0: continue
    p = int(p); ds = nhan_mang.get(p, []); cg = mau_cg(mau_mang[p])
    tap = set(chu_giai[cg]) if (cg is not None and cg in chu_giai) else None
    if cg in mau_mot_ma: bang[p] = id_ma(mau_mot_ma[cg]); theo_mau_mot += 1
    elif tap and len(tap) > 1:
        hop_le = [t for t, do_ in ds if t in tap and (do_ or not CO_CHU_DO)] or nhan_ngoai.get(p, [])
        # LUẬT CHỮ ĐEN — KIỂU CHẶT (15/10/2026, chủ dự án duyệt sau khi xem số liệu: 53.584 ha / 133.783 ha "nhóm" của 7 bản ghi được đúng tên,
        # 90 % là rừng; soi 18 chỗ trên PDF đều hợp lý): không có nhãn đỏ hợp lệ thì nhận nhãn ĐEN đứng một mình (mã trên của phân số đã bỏ)
        # thuộc đúng tập mã của màu — theo quy ước bản đồ: đất GIỮ NGUYÊN loại hiện trạng (đổi loại thì phải có mã đỏ). CHỈ KHI trong mảng
        # KHÔNG có nhãn đỏ nào (kể cả mã khác nhóm màu): có là mâu thuẫn, không đoán (Nha Trang: vùng có cả "TMD" đen lẫn "DKV" đỏ).
        if not hop_le and CHU_DEN and not any(do_ for _, do_ in ds):
            hop_le = [t for t, do_ in ds if t in tap and not do_]
        if hop_le: bang[p] = id_ma(collections.Counter(hop_le).most_common(1)[0][0]); co_nhan_ += 1
        else: bang[p] = id_ma('NHOM:' + '/'.join(sorted(tap))); nhom += 1
    elif ds: bang[p] = id_ma(collections.Counter(t for t, _ in ds).most_common(1)[0][0]); co_nhan_ += 1
    else: bo_trong += 1
# MẢNG KHÔNG CÒN ĐIỂM ẢNH NÀO Ở LƯỢT 1 (14/10/2026 khuya): dải đường 2–3 m mảnh hơn 1 điểm ảnh, hay bị mảng vẽ sau đè kín ở độ phân giải
# thô → vòng lặp trên chỉ duyệt mảng CÓ điểm ảnh nên bỏ sót, mảng thành "chưa xác định". Lượt 2 kiểu vector vẫn để nó CHE mảng dưới mà
# không ghi ra gì → Thửa 59 · Tờ 6 Phương Sơn mất dải đường 13,9 m² (mảng cam #ffaa32 = DGT; app tham chiếu ghi DGT 13,6 m²).
# Nay gán đúng luật trên: màu một mã → theo màu; màu dùng chung → NHÓM (không còn điểm ảnh thì không xét được nhãn nằm trong mảng).
khong_px = 0
for p in range(1, so_mang + 1):
    if bang[p] or so_px[p]: continue
    x0_, y0_, x1_, y1_ = hop[p]
    if x1_ < RX0 or x0_ > RX1 or y1_ < RY0 or y0_ > RY1: continue      # ngoài khung ranh
    cg = mau_cg(mau_mang[p])
    if cg in mau_mot_ma: bang[p] = id_ma(mau_mot_ma[cg]); khong_px += 1
    elif cg is not None and cg in chu_giai and len(chu_giai[cg]) > 1:
        bang[p] = id_ma('NHOM:' + '/'.join(sorted(chu_giai[cg]))); khong_px += 1
print(f'mang khong con diem anh o luot 1, gan theo mau: {khong_px}')
# NÉT DÀY chỉ là ĐẤT khi là đường giao thông hoặc kênh / sông / mặt nước (DGT, DTL, SON, MNC). Nét khác — RANH GIỚI hành chính
# (hồng dày, màu gần ODT #ffa0ff nên từng bị ghi thành "đất ở đô thị" một dải 5–10 m dọc ranh huyện), đường dây điện… —
# là TRONG SUỐT: không vẽ ở lượt 2, đất bên dưới giữ nguyên loại.
NET_LA_DAT = {'DGT', 'DTL', 'SON', 'MNC'}
def net_la_dat(k):
    m = ds_ma[bang[k] - 1] if bang[k] else None
    if not m: return False
    tap = set(m[5:].split('/')) if m.startswith('NHOM:') else {m}
    return tap <= NET_LA_DAT | {'NTS'} and bool(tap & NET_LA_DAT)
trong_suot = set()
for k in range(1, so_mang + 1):
    if hinh[k][0] == 'net' and not net_la_dat(k): trong_suot.add(k); bang[k] = 0
print(f'net day trong suot (ranh gioi, duong day…): {len(trong_suot)}')
for k in vien_hong: trong_suot.add(k); bang[k] = 0               # viền hồng ranh huyện (mục 2b) — trong suốt như nét ranh giới
print(f'{so_mang} mang; trong ranh: {co_nhan_} theo nhan, {theo_mau_mot} theo mau mot ma ({len(mau_mot_ma)} mau), '
      f'{nhom} mau dung chung ghi NHOM, {bo_trong} de "chua xac dinh"')
if '--thong-ke-den' in co:
    # CHỈ ĐẾM, KHÔNG ĐỔI KẾT QUẢ (15/10/2026 — đếm để chủ dự án quyết; từ khi luật chữ đen BẬT mặc định thì chỉ còn đếm phần mà luật bỏ qua —
    # muốn đếm như lúc chưa áp thì chạy kèm --khong-chu-den): vùng "nhóm" (màu dùng chung) KHÔNG có nhãn đỏ hợp lệ nhưng CÓ nhãn ĐEN
    # đứng một mình (đã bỏ mã trên của phân số) mang mã thuộc đúng tập mã của màu → theo quy ước bản đồ là đất GIỮ NGUYÊN loại hiện trạng.
    px_m2 = (m_moi_pt / S) ** 2
    dt_den = collections.Counter(); so_den = 0
    dt_chat = collections.Counter(); so_chat = 0     # bản CHẶT: trong mảng KHÔNG có nhãn đỏ nào (kể cả mã khác nhóm màu) — không có gì mâu thuẫn
    for p, ds in nhan_mang.items():
        if not bang[p] or not ds_ma[bang[p] - 1].startswith('NHOM:'): continue
        tap = set(ds_ma[bang[p] - 1][5:].split('/'))
        den = [t for t, do_ in ds if not do_ and t in tap]
        if den: so_den += 1; dt_den[collections.Counter(den).most_common(1)[0][0]] += so_px[p] * px_m2
        if den and not any(do_ for _, do_ in ds) and not nhan_ngoai.get(p):
            so_chat += 1; dt_chat[collections.Counter(den).most_common(1)[0][0]] += so_px[p] * px_m2
    tong_nhom = sum(int(so_px[p]) for p in range(1, so_mang + 1) if bang[p] and ds_ma[bang[p] - 1].startswith('NHOM:')) * px_m2
    print(f'THONG KE CHU DEN: {so_den} mang nhom co chu den cung nhom mau = {sum(dt_den.values()) / 1e4:.1f} ha / {tong_nhom / 1e4:.1f} ha nhom; '
          f'ma: {[(m, round(v / 1e4, 1)) for m, v in dt_den.most_common(12)]}')
    print(f'THONG KE CHU DEN (CHAT - mang khong co nhan do nao): {so_chat} mang = {sum(dt_chat.values()) / 1e4:.1f} ha; '
          f'ma: {[(m, round(v / 1e4, 1)) for m, v in dt_chat.most_common(12)]}')
    # Ghi VỊ TRÍ từng nhãn đen đó (điểm PDF) ra <ra>.chu-den.json — để cắt ảnh PDF đúng chỗ mà soi bằng mắt trước khi quyết.
    mau_den = []
    for t, cx, cy, do_, *_ in nhan:
        if do_: continue
        p = pid_tai(cx, cy)
        if not p or not bang[p] or not ds_ma[bang[p] - 1].startswith('NHOM:'): continue
        if t not in set(ds_ma[bang[p] - 1][5:].split('/')): continue
        mau_den.append({'ma': t, 'nhom': ds_ma[bang[p] - 1][5:], 'mang': p, 'ha': round(float(so_px[p] * px_m2) / 1e4, 2),
                        'x_pt': round(cx / S, 1), 'y_pt': round(cy / S, 1), 'mau': str(mau_mang[p]),
                        'chat': not any(d_ for _, d_ in nhan_mang.get(p, [])) and not nhan_ngoai.get(p)})
    json.dump(mau_den, open(ra + '.chu-den.json', 'w', encoding='utf-8'), ensure_ascii=False)
    sys.exit(0)
loai1 = bang[pimg]
_tr = collections.Counter()
for q in np.unique(pimg[(loai1 == 0) & (pimg > 0)]): _tr[mau_mang[q]] += int(so_px[q])
for col, n in _tr.most_common(6):
    gan = min(chu_giai, key=lambda c: _lech(c, col)) if chu_giai else None
    if gan: print(f'   trong: #{col[0]:02x}{col[1]:02x}{col[2]:02x} {n * m_moi_px ** 2 / 1e4:,.0f} ha | gan chu giai '
                  f'#{gan[0]:02x}{gan[1]:02x}{gan[2]:02x} (lech {_lech(gan, col)}) = {"/".join(sorted(chu_giai[gan]))}')

# ---- tên + màu từng loại
TEN = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'qh-pipeline', 'ten-loai-dat.json'), encoding='utf-8'))['ma_qhsdd']
TEN.update({'LUA': 'Đất trồng lúa', 'LUK': 'Đất trồng lúa nước còn lại', 'LUN': 'Đất trồng lúa nương',
            'BHK': 'Đất bằng trồng cây hàng năm khác', 'NHK': 'Đất nương rẫy trồng cây hàng năm khác',
            'LMU': 'Đất làm muối', 'TSC': 'Đất xây dựng trụ sở cơ quan', 'DTS': 'Đất xây dựng trụ sở của tổ chức sự nghiệp',
            'DBV': 'Đất công trình bưu chính, viễn thông', 'DCH': 'Đất chợ', 'DDT': 'Đất có di tích lịch sử - văn hóa',
            'DDL': 'Đất danh lam thắng cảnh', 'DSH': 'Đất sinh hoạt cộng đồng', 'TIN': 'Đất cơ sở tín ngưỡng',
            'PNK': 'Đất phi nông nghiệp khác', 'CSD': 'Đất chưa sử dụng', 'DCS': 'Đất đồi núi chưa sử dụng',
            'NCS': 'Núi đá không có rừng cây', 'SKX': 'Đất sản xuất vật liệu xây dựng, làm đồ gốm',
            'DKH': 'Đất xây dựng cơ sở khoa học và công nghệ', 'DXH': 'Đất xây dựng cơ sở dịch vụ xã hội',
            'DNG': 'Đất xây dựng cơ sở ngoại giao',
            # RSN lấy THEO CHÚ GIẢI in trên bản đồ Cam Ranh / Ninh Hòa / Khánh Vĩnh (Khánh Sơn ghi "Đất CÓ rừng sản xuất…") — 14/10/2026
            'RSN': 'Đất rừng sản xuất là rừng tự nhiên',
            # DSK: Thông tư 08/2024/TT-BTNMT, Phụ lục II mục A, dòng 4.10
            'DSK': 'Đất xây dựng công trình sự nghiệp khác',
            # mã MỚI Thông tư 08/2024 — tên chép NGUYÊN VĂN chú giải bản Diên Khánh (QĐ 1564/QĐ-UBND 10/6/2025), 14/10/2026 khuya
            'NNP': 'Nhóm đất nông nghiệp', 'CHN': 'Đất trồng cây hằng năm', 'LNP': 'Đất lâm nghiệp', 'CNT': 'Đất chăn nuôi tập trung',
            'PNN': 'Nhóm đất phi nông nghiệp', 'OTC': 'Đất ở', 'CQA': 'Đất quốc phòng, an ninh', 'DSN': 'Đất xây dựng công trình sự nghiệp',
            'DMT': 'Đất xây dựng cơ sở môi trường', 'DKT': 'Đất xây dựng cơ sở khí tượng thủy văn',
            'CSK': 'Đất sản xuất, kinh doanh phi nông nghiệp', 'SCC': 'Đất khu công nghiệp, cụm công nghiệp',
            'SCT': 'Đất khu công nghệ thông tin tập trung', 'CCC': 'Đất sử dụng vào mục đích công cộng',
            'DCT': 'Đất công trình cấp nước, thoát nước', 'DPC': 'Đất công trình phòng, chống thiên tai',
            'DDD': 'Đất có di tích lịch sử - văn hóa, danh lam thắng cảnh, di sản thiên nhiên', 'TVC': 'Đất có mặt nước chuyên dùng',
            'CGT': 'Đất do Nhà nước thu hồi theo quy định của pháp luật đất đai chưa giao, chưa cho thuê',
            'MCS': 'Đất có mặt nước chưa sử dụng',
            # tên chép từ CHÚ GIẢI: DHT — bản Vạn Ninh (QĐ 701/2024); MVK — bản Nha Trang (QĐ 2978/2022). MVT, MVR: chú giải không ghi tên → giữ mã
            'DHT': 'Đất phát triển hạ tầng cấp quốc gia, cấp tỉnh, cấp huyện, cấp xã',
            'MVK': 'Đất mặt nước ven biển có mục đích khác'})
# mã không có trong bảng (vd RST, MVB, TSK — chú giải các bản không ghi tên, Thông tư 08/2024 cũng không có) thì GIỮ NGUYÊN MÃ — không tự đặt tên
# (quy tắc ten-loai-dat.json).
# Tên NHÓM (màu chú giải dùng chung nhiều mã): chỉ đặt tên khi MỌI mã trong nhóm cùng một họ; ngoài ra liệt kê mã.
HO = [({'LUA', 'LUC', 'LUK', 'LUN'}, 'Đất trồng lúa'),
      # RSN là MỘT PHẦN của RSX (chú giải: "Trong đó: Đất rừng sản xuất là rừng tự nhiên") → nhóm RSN/RSX CHẮC CHẮN là rừng sản xuất
      ({'RSX', 'RSN'}, 'Đất rừng sản xuất (bản vẽ chưa ghi rõ có phải là rừng tự nhiên)'),
      ({'RSX', 'RSN', 'RPH', 'RDD', 'RST', 'RSM', 'LNP'}, 'Đất rừng (bản vẽ chưa ghi rõ loại rừng)'),
      # nhóm chỉ gồm mặt nước chuyên dùng / ven biển (Nha Trang: MNC + MVK cùng màu) — đừng gọi là "thuỷ lợi, sông suối, nuôi trồng"
      ({'MNC', 'TVC', 'MCS', 'MVB', 'MBV', 'MVT', 'MVK', 'MVR'}, 'Mặt nước chuyên dùng hoặc mặt nước ven biển (bản vẽ chưa ghi rõ loại)'),
      ({'DTL', 'NTS', 'SON', 'MNC', 'MVB', 'MBV', 'TVC', 'DCT', 'MVT', 'MVK', 'MVR'}, 'Mặt nước – thuỷ lợi, sông suối hoặc nuôi trồng thuỷ sản (bản vẽ chưa ghi rõ)'),
      ({'DBV', 'DCH', 'DDT', 'DDL', 'DGD', 'DKH', 'DKV', 'DNL', 'DSH', 'DTS', 'DTT', 'DVH', 'DXH', 'DYT', 'PNK', 'SKC', 'SKK',
        'SKN', 'SKS', 'SKX', 'TIN', 'TMD', 'TON', 'TSC', 'DSK', 'DCK', 'DRA', 'DNG', 'TSK',
        'CSK', 'SCC', 'SCT', 'CCC', 'DPC', 'DDD', 'DSN', 'DMT', 'DKT', 'DGT', 'DTL', 'DCT', 'DHT', 'PNN'},   # PNN: tiêu đề nhóm phi nông nghiệp (Diên Khánh)
       'Đất công trình công cộng, dịch vụ, sản xuất (bản vẽ chưa ghi rõ loại)')]
def ten_ma(m):
    if not m.startswith('NHOM:'): return TEN.get(m, m)
    nh = set(m[5:].split('/'))
    for tap, ten in HO:
        if nh <= tap: return ten
    return 'Nhóm đất chưa rõ loại (' + ', '.join(sorted(nh)) + ')'
mau_ma = {}
_dem = collections.defaultdict(collections.Counter)
for p in np.unique(pimg):
    if p and bang[p]: _dem[int(bang[p])][mau_mang[p]] += int(so_px[p])
for i, cc in _dem.items():
    c = cc.most_common(1)[0][0]; mau_ma[i] = '#%02x%02x%02x' % c

if anh_thu:   # ảnh xem nhanh (lượt 1): trái = màu gốc trong ranh, phải = loại đất đã gán (mỗi loại một màu ngẫu nhiên cố định)
    rng = np.random.default_rng(7); bng = rng.integers(40, 230, (256, 3)).astype(np.uint8); bng[0] = 255
    goc = zone.copy(); goc[mask_ranh == 0] = 255
    ys, xs = np.nonzero(mask_ranh); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    ghep = np.hstack([goc[y0:y1, x0:x1][:, :, ::-1], bng[loai1[y0:y1, x0:x1]]])
    k = 2000 / ghep.shape[1]
    cv2.imwrite(anh_thu, cv2.resize(ghep, (2000, int(ghep.shape[0] * k)), interpolation=cv2.INTER_AREA))
    print('anh thu:', anh_thu)
del zone, pimg, loai1, mask_ranh

# ---- 5a) LƯỢT 2 KIỂU VECTOR (--vector, 14/10/2026 tối) — LẤY THẲNG HÌNH NÉT VECTOR CỦA PDF, KHÔNG QUA ẢNH.
# Vì sao: soi Thửa 59 · Tờ 6 Phương Sơn — mảng tô PDF đè lên thửa cho đúng 76,1 m² ODT + 13,9 m² DGT (app tham chiếu 76,5 + 13,6:
# cùng nguồn dữ liệu) nhưng lượt 2 vẽ ảnh 2 m/điểm ảnh ra 81,5 ODT + 3,2 DGT + 5,4 "chưa xác định": dải đường hẹp 2–3 m chỉ còn 1 điểm
# ảnh, mép vùng răng cưa. Nay: mỗi mảng (tô / nét dày là đất) dựng đúng hình (chẵn–lẻ, đường cong đã bẻ ở lượt 1), phần NHÌN THẤY =
# hình đó TRỪ mọi mảng vẽ SAU đè lên (đúng thứ tự vẽ của PDF như mắt nhìn), cắt theo ranh, đổi toạ độ từng đỉnh (chèn đỉnh ≤ 2 điểm in
# để theo đúng phép nắn từng ô lưới). Mã loại đất từng mảng giữ nguyên như lượt 1. Không còn bước "lấp khe" — chỗ PDF không tô là
# chỗ bản đồ để trắng thật.
if '--vector' in co:
    import shapely
    from shapely.geometry import Polygon as _P, MultiLineString as _MLS
    from shapely.ops import unary_union
    from shapely.strtree import STRtree
    import vn2000_np
    t1 = time.time()
    ranh_g = unary_union([_P(p[0], list(p[1:])).buffer(0) for p in ranh_pt])
    def _hinh_to(vong):
        g_ = None
        for v in vong:
            if len(v) < 3: continue
            pp = _P(v)
            if not pp.is_valid: pp = pp.buffer(0)
            if pp.is_empty: continue
            g_ = pp if g_ is None else g_.symmetric_difference(pp)
        return g_
    def _noi_net(ds_):                   # nối các đoạn liền nhau (đầu đoạn sau = cuối đoạn trước) thành MỘT đường → chỗ gãy được bo
        out = []                         # như PDF vẽ (vẽ từng đoạn rời thì mỗi chỗ gãy hở một khe hình nêm ở phía ngoài khúc quanh)
        for l in ds_:
            l = np.asarray(l, float)
            if out and abs(out[-1][-1][0] - l[0][0]) < 0.01 and abs(out[-1][-1][1] - l[0][1]) < 0.01: out[-1] = np.vstack([out[-1], l[1:]])
            else: out.append(l)
        return [o for o in out if len(o) >= 2]
    gs = {}
    for k in range(1, so_mang + 1):
        if k in trong_suot: continue
        kieu, hh, day = hinh[k]
        try:
            if kieu == 'to': g_ = _hinh_to(hh)
            else:
                ls = _noi_net([l for l in hh if len(l) >= 2])
                g_ = _MLS(ls).buffer(day / 2, cap_style='flat', join_style='round') if ls else None
        except Exception:
            g_ = None
        if g_ is None or g_.is_empty or not g_.intersects(ranh_g): continue
        gs[k] = g_
    ks = sorted(gs)
    cay = STRtree([gs[k] for k in ks])
    shapely.prepare(ranh_g)                          # hỏi "nằm trọn trong ranh?" nhanh — mảng trọn trong ranh khỏi cắt theo ranh
    print(f'vector: {len(ks)} mang cham ranh, dung hinh {time.time() - t1:.0f}s', flush=True)
    # phép nắn trang PDF → VN-2000 dạng MẢNG (y hệt nan2.lap_phep_doi: "luoi" nội suy từng ô lưới, "afin", hoặc thẳng)
    nj = json.load(open(pdf + '.nan.json', encoding='utf-8')) if os.path.exists(pdf + '.nan.json') else {}
    def _ns(v, a, b):
        a = np.asarray(a, float); b = np.asarray(b, float); r = np.interp(v, a, b)
        lo, hi = v < a[0], v > a[-1]
        r[lo] = b[0] + (v[lo] - a[0]) * (b[1] - b[0]) / (a[1] - a[0])
        r[hi] = b[-1] + (v[hi] - a[-1]) * (b[-1] - b[-2]) / (a[-1] - a[-2])
        return r
    if nj.get('luoi'):
        L_ = nj['luoi']
        def p2en_v(x, y): return _ns(x, L_['x'], L_['E']), _ns(y, L_['y'], L_['N'])
    elif nj.get('afin'):
        a_, b_, c_, d_, e_, f_ = nj['afin']
        def p2en_v(x, y): return a_ * x + b_ * y + c_, d_ * x + e_ * y + f_
    else:
        def p2en_v(x, y): return info['se'] * x + info['ie'], info['sn'] * y + info['inn']
    def doi(xy):
        xy = np.asarray(xy, float); E, N = p2en_v(xy[:, 0], xy[:, 1]); lo_, la_ = vn2000_np.vn2000_to_wgs84(E, N)
        return np.round(np.c_[lo_, la_], 8).tolist(), np.c_[E, N]
    feats, dien_tich = [], collections.Counter()
    so_manh = 0
    for n_, k in enumerate(ks):
        if not bang[k]: continue                      # mảng chưa xác định: vẫn CHE mảng dưới (đã tính ở mảng dưới), không ghi ra
        g_ = gs[k]
        # chỉ những mảng vẽ SAU mà ĐÈ THẬT lên mảng này (không lấy cả mảng chỉ nằm trong khung bao — mảng rừng lớn ở Khánh Sơn có
        # khung bao trùm hàng nghìn mảng không chạm tới, gộp hết vào thì một mảng mất cả phút)
        sau = [ks[i] for i in cay.query(g_, predicate='intersects') if ks[i] > k]
        if sau:
            che = unary_union([gs[j] for j in sau])
            g_ = g_.difference(che)
        if not ranh_g.contains(g_): g_ = g_.intersection(ranh_g)
        if g_.is_empty: continue
        g_ = shapely.segmentize(g_, 2.0)              # ≤ 2 điểm in giữa 2 đỉnh (theo đúng phép nắn gãy khúc ở đường lưới)
        m = ds_ma[bang[k] - 1]
        for pp in (g_.geoms if hasattr(g_, 'geoms') else [g_]):
            if pp.geom_type != 'Polygon' or pp.area <= 0: continue
            ngoai, en0 = doi(pp.exterior.coords)
            trong = []; dt = _P(en0).area
            for h in pp.interiors:
                c_, enh = doi(h.coords); trong.append(c_); dt -= _P(enh).area
            if dt < 0.01: continue
            dien_tich[m] += dt; so_manh += 1
            feats.append({'type': 'Feature', 'properties': {'ma': m, 'ten': ten_ma(m), 'mau': mau_ma.get(int(bang[k]), '#cccccc')},
                          'geometry': {'type': 'Polygon', 'coordinates': [ngoai] + trong}})
        if n_ % 2000 == 0: print(f'   ... {n_}/{len(ks)} mang, {so_manh} manh, {time.time() - t1:.0f}s', flush=True)
    json.dump({'type': 'FeatureCollection', 'properties': {'nguon': os.path.basename(pdf), 'cach': 'vector'}, 'features': feats},
              open(ra, 'w', encoding='utf-8'), ensure_ascii=False)
    # diện tích ranh (mét vuông, trên VN-2000)
    dt_ranh = 0.0
    for pp in (ranh_g.geoms if hasattr(ranh_g, 'geoms') else [ranh_g]):
        pp2 = shapely.segmentize(pp, 2.0); dt_ranh += _P(doi(pp2.exterior.coords)[1]).area - sum(_P(doi(h.coords)[1]).area for h in pp2.interiors)
    print(f'luot 2 VECTOR: {so_manh} manh, {len(dien_tich)} loai, phu {100 * sum(dien_tich.values()) / max(dt_ranh, 1):.1f}% trong ranh, '
          f'{time.time() - t1:.0f}s -> {ra}')
    for m, v in dien_tich.most_common(12): print(f'   {m:40s} {v / 1e4:10.1f} ha')
    print(f'XONG {time.time() - t0:.0f}s')
    sys.exit(0)

# ---- 5) LƯỢT 2: vẽ lại theo TỪNG Ô ở ~M_PX m/điểm ảnh → đa giác sắc nét
S2 = m_moi_pt / M_PX
O, LE = 2048, 16                                # cỡ ô + lề (lấp khe sát mép ô cần nhìn sang ô bên)
KHE_PX = 12.0 / M_PX                            # khe do nét viền ≤ 12 m
X0, Y0 = int(RX0 * S2) - 2, int(RY0 * S2) - 2; X1, Y1 = int(RX1 * S2) + 3, int(RY1 * S2) + 3
def px2ll(x, y):
    E, N = P2EN(x / S2, y / S2); lng, lat = vn.vn2000_to_wgs84(E, N); return [round(lng, 7), round(lat, 7)]
feats, dien_tich = [], collections.Counter()
so_o = 0; tong_ranh = 0
for oy in range(Y0, Y1, O):
    for ox in range(X0, X1, O):
        ax, ay = ox - LE, oy - LE; w, h = O + 2 * LE, O + 2 * LE   # khung vẽ (có lề) theo điểm ảnh lượt 2
        px0, py0, px1, py1 = ax / S2, ay / S2, (ax + w) / S2, (ay + h) / S2
        mr = np.zeros((h, w), np.uint8)
        for poly in ranh_pt: cv2.fillPoly(mr, [np.round(r * S2 - (ax, ay)).astype(np.int32) for r in poly], 1)
        if not mr[LE:LE + O, LE:LE + O].any(): continue
        so_o += 1
        chon = np.nonzero((hop[:, 2] >= px0) & (hop[:, 0] <= px1) & (hop[:, 3] >= py0) & (hop[:, 1] <= py1))[0]
        idt = np.zeros((h, w, 3), np.uint8)
        for k in chon:
            if k == 0 or k in trong_suot: continue
            kieu, hh, day = hinh[k]
            vv = [np.round(v * S2 - (ax, ay)).astype(np.int32) for v in hh]
            if kieu == 'to': cv2.fillPoly(idt, vv, ma24(int(k)))
            else: cv2.polylines(idt, vv, False, ma24(int(k)), max(1, int(round(day * S2))))
        pid = (idt[:, :, 0].astype(np.int32) << 16) | (idt[:, :, 1].astype(np.int32) << 8) | idt[:, :, 2]
        del idt
        lo = bang[pid]; lo[mr == 0] = 0
        khe = (pid == 0) & (mr > 0)
        if khe.any() and lo.any():
            hat = np.where(lo > 0, 0, 1).astype(np.uint8)
            d, lb = cv2.distanceTransformWithLabels(hat, cv2.DIST_L2, 3, labelType=cv2.DIST_LABEL_PIXEL)
            pos = np.argwhere(hat == 0); l2t = np.zeros(len(pos) + 1, np.uint8); l2t[1:] = lo[pos[:, 0], pos[:, 1]]
            lap = khe & (d <= KHE_PX); lo[lap] = l2t[lb[lap]]
            del d, lb, hat
        lo = np.ascontiguousarray(lo[LE:LE + O, LE:LE + O]); tong_ranh += int(mr[LE:LE + O, LE:LE + O].sum())
        for i in np.unique(lo):
            if i == 0: continue
            m = ds_ma[i - 1]; bm = (lo == i).astype(np.uint8)
            dien_tich[m] += int(bm.sum()) * M_PX ** 2
            cnts, hier = cv2.findContours(bm, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
            if hier is None: continue
            hier = hier[0]
            for j, c in enumerate(cnts):
                if hier[j][3] != -1 or cv2.contourArea(c) < 2: continue
                c = cv2.approxPolyDP(c, 0.6, True)
                if len(c) < 3: continue
                lo_ = []
                kk = hier[j][2]
                while kk != -1:
                    hc = cv2.approxPolyDP(cnts[kk], 0.6, True)
                    if len(hc) >= 3 and cv2.contourArea(cnts[kk]) >= 2: lo_.append(hc[:, 0, :].astype(float))
                    kk = hier[kk][0]
                # Đường viền OpenCV đi qua TÂM điểm ảnh ngoài cùng → hai vùng KHÁC LOẠI kề nhau hở 1 điểm ảnh (~2 m, thửa sát ranh
                # vùng bị hụt 5–10 % "chưa xác định"). Nới mỗi vùng NỬA điểm ảnh (góc vuông) → ranh về đúng MÉP điểm ảnh, hai vùng khít.
                hp = _Poly(c[:, 0, :].astype(float), lo_).buffer(0.5, join_style=2, mitre_limit=2.0)
                for pp in (hp.geoms if hp.geom_type == 'MultiPolygon' else [hp]):
                    if pp.is_empty or pp.geom_type != 'Polygon': continue
                    vong = [[px2ll(x + ox, y + oy) for x, y in pp.exterior.coords]]
                    vong += [[px2ll(x + ox, y + oy) for x, y in h.coords] for h in pp.interiors]
                    feats.append({'type': 'Feature', 'properties': {'ma': m, 'ten': ten_ma(m), 'mau': mau_ma.get(i, '#cccccc')},
                                  'geometry': {'type': 'Polygon', 'coordinates': vong}})
json.dump({'type': 'FeatureCollection', 'properties': {'nguon': os.path.basename(pdf), 'm_moi_diem_anh': M_PX},
           'features': feats}, open(ra, 'w', encoding='utf-8'), ensure_ascii=False)
phu = sum(dien_tich.values()) / max(1, tong_ranh * M_PX ** 2) * 100
print(f'luot 2: {so_o} o, {len(feats)} vung, {len(dien_tich)} loai, phu {phu:.1f}% trong ranh, {M_PX} m/diem anh, '
      f'{time.time() - t0:.0f} giay -> {ra}')
for m, a in dien_tich.most_common(14): print(f'   {a / 1e4:8,.0f} ha  {m:6.6s} {ten_ma(m)[:70]}')
