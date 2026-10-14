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
    va_ = [np.array(v, np.float64) for v in vong]
    vv = [np.round(v * S).astype(np.int32) for v in va_]
    cv2.fillPoly(zone, vv, col)
    so_mang += 1; mau_mang.append(col); hinh.append(('to', va_, 0))
    a = np.vstack(va_); hop.append((a[:, 0].min(), a[:, 1].min(), a[:, 0].max(), a[:, 1].max()))
    cv2.fillPoly(idimg, vv, ma24(so_mang))
hop = np.array(hop, np.float64)

pimg = (idimg[:, :, 0].astype(np.int32) << 16) | (idimg[:, :, 1].astype(np.int32) << 8) | idimg[:, :, 2]
del idimg
pimg[mask_ranh == 0] = 0

# ---- 2) nhãn mã loại đất (trong ranh) + khung chú giải (ngoài ranh)
MA = set(("ODT ONT LUA LUC LUK LUN BHK NHK HNK CLN RSX RPH RDD RSN RST RSM NTS LMU NKH TSC DTS CQP CAN SKC SKK SKN SKT "
          "SKS SKX TMD DGT DTL DNL DBV DVH DYT DGD DTT DSH DKV DRA DCH DDT DDL TON TIN NTD SON MNC PNK CSD BCS DCS NCS "
          "DNG DKH DXH DSK DCK MVB MBV TSK").split())
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
            nhan.append([t, cx, cy, r > 150 and gg < 100 and bb < 100, (y1 - y0) * S, (x1 - x0) * S, s['size']])
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
for col, cc in chu_giai.items():
    if len(cc) == 1: mau_mot_ma[col] = next(iter(cc)); tu_chu_giai += 1
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

# ---- 3) mảng → loại đất
ma_id, ds_ma = {}, []
def id_ma(m):
    if m not in ma_id: ma_id[m] = len(ma_id) + 1; ds_ma.append(m)
    return ma_id[m]
bang = np.zeros(so_mang + 1, np.uint8)
so_px = np.bincount(pimg.ravel(), minlength=so_mang + 1)
co_nhan_ = theo_mau_mot = nhom = bo_trong = 0
for p in np.unique(pimg):
    if p == 0: continue
    ds = theo_mang.get(int(p)); cg = mau_cg(mau_mang[p])
    if ds: bang[p] = id_ma(collections.Counter(ds).most_common(1)[0][0]); co_nhan_ += 1
    elif cg in mau_mot_ma: bang[p] = id_ma(mau_mot_ma[cg]); theo_mau_mot += 1
    elif cg in chu_giai and len(chu_giai[cg]) > 1: bang[p] = id_ma('NHOM:' + '/'.join(sorted(chu_giai[cg]))); nhom += 1
    else: bo_trong += 1
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
print(f'{so_mang} mang; trong ranh: {co_nhan_} theo nhan, {theo_mau_mot} theo mau mot ma ({len(mau_mot_ma)} mau), '
      f'{nhom} mau dung chung ghi NHOM, {bo_trong} de "chua xac dinh"')
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
            'RSN': 'Đất rừng sản xuất là rừng tự nhiên'})
# mã không có trong bảng (vd RST, MVB, DSK, TSK — chú giải các bản không ghi tên) thì GIỮ NGUYÊN MÃ — không tự đặt tên
# (quy tắc ten-loai-dat.json).
# Tên NHÓM (màu chú giải dùng chung nhiều mã): chỉ đặt tên khi MỌI mã trong nhóm cùng một họ; ngoài ra liệt kê mã.
HO = [({'LUA', 'LUC', 'LUK', 'LUN'}, 'Đất trồng lúa'),
      ({'RSX', 'RSN', 'RPH', 'RDD', 'RST', 'RSM'}, 'Đất rừng (bản vẽ chưa ghi rõ loại rừng)'),
      ({'DTL', 'NTS', 'SON', 'MNC', 'MVB', 'MBV'}, 'Mặt nước – thuỷ lợi, sông suối hoặc nuôi trồng thuỷ sản (bản vẽ chưa ghi rõ)'),
      ({'DBV', 'DCH', 'DDT', 'DDL', 'DGD', 'DKH', 'DKV', 'DNL', 'DSH', 'DTS', 'DTT', 'DVH', 'DXH', 'DYT', 'PNK', 'SKC', 'SKK',
        'SKN', 'SKS', 'SKX', 'TIN', 'TMD', 'TON', 'TSC', 'DSK', 'DCK', 'DRA', 'DNG', 'TSK'},
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
