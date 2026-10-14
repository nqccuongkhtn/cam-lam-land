# -*- coding: utf-8 -*-
# ĐỌC NHÃN MÃ LOẠI ĐẤT VẼ BẰNG HÌNH (14/10/2026 khuya) — bản PDF KHÔNG có lớp chữ (Diên Khánh: 0 chữ, 0 phông; mọi nhãn là hình tô nhỏ,
# mỗi hình MỘT chữ cái; đỏ = quy hoạch, đen = hiện trạng). Không dùng máy nhận dạng chữ (dễ sai): cùng một chữ cái thì hình y hệt nhau.
#   --gom2 [--tu=0 --n=120 | --xem=id,id]: vẽ mỗi chữ thành ảnh 16 điểm cao, gom theo độ trùng ≥ 0,82 → ảnh mẫu <ra>-mau2-*.png
#        (số nhóm GIỮ NGUYÊN giữa các lần chạy cùng một PDF) → NGƯỜI NHÌN ảnh mẫu, ghi bảng {số nhóm: chữ cái} cho chữ IN HOA ĐỨNG
#        (chữ thường, chữ nghiêng, số, dấu thanh: KHÔNG ghi → "?" → từ có "?" bị bỏ, không đoán).
#   --doc=<bảng chữ.json>: ghép chữ thành từ theo TÂM DÒNG có dung sai (chữ tròn O, C, S nhô trên/dưới chữ thẳng), chỉ giữ MÃ hợp lệ
#        (từ dính nhiều mã liền như 'ODTODT' thì tách đều) → <ra>-ma.json [{t, do, bbox, cao}] → boc_loai_dat.py --nhan-hinh=<file>.
#        Có in "chữ ? hay gặp (nhóm, từ)" để gán nốt chữ còn thiếu.
# Diên Khánh: bảng chữ ở nhan-hinh/bang-chu-dien-khanh.json — 7.701 nhãn mã (2.358 đỏ); soi tay 4 vùng trên bản gốc đều đúng.
# Dùng: python -P doc_nhan_hinh.py <pdf> <tiền tố ra> --gom2      (ghi <ra>-gom2.json + ảnh mẫu; PHẢI chạy trước --doc)
#       python -P doc_nhan_hinh.py <pdf> <tiền tố ra> --doc=nhan-hinh/bang-chu-<huyen>.json
import sys, os, json, collections
import numpy as np, cv2, pymupdf
pdf, ra = sys.argv[1], sys.argv[2]
co = [a for a in sys.argv[3:] if a.startswith('--')]
p = pymupdf.open(pdf)[0]

def bez(p0, p1, p2, p3, n=8):
    return [((1-t)**3*p0.x + 3*(1-t)**2*t*p1.x + 3*(1-t)*t*t*p2.x + t**3*p3.x,
             (1-t)**3*p0.y + 3*(1-t)**2*t*p1.y + 3*(1-t)*t*t*p2.y + t**3*p3.y) for t in np.linspace(0, 1, n)[1:]]
def vong_cua(dr):
    vong, cur, last = [], [], None
    for it in dr['items']:
        k = it[0]
        if k == 're': r = it[1]; vong.append([(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]); cur, last = [], None; continue
        if k == 'qu': q = it[1]; vong.append([(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)]); cur, last = [], None; continue
        p0 = it[1]
        if last is None or abs(p0.x - last[0]) > 0.01 or abs(p0.y - last[1]) > 0.01:
            if len(cur) >= 3: vong.append(cur)
            cur = [(p0.x, p0.y)]
        if k == 'l': cur.append((it[2].x, it[2].y)); last = cur[-1]
        elif k == 'c': cur += bez(it[1], it[2], it[3], it[4]); last = cur[-1]
    if len(cur) >= 3: vong.append(cur)
    return vong
def chu_ky(dr, r):
    h = max(r.height, 0.01); s = ''.join(it[0][0] for it in dr['items'])
    pts = []
    for it in dr['items']:
        for q in it[1:]:
            if hasattr(q, 'x'): pts.append(f'{(q.x - r.x0) / h:.1f},{(q.y - r.y0) / h:.1f}')
    return s + '|' + f'{r.width / h:.1f}' + '|' + ';'.join(pts)

glyph = []                       # (chữ ký, màu, x0, y0, x1, y1, vòng)
for dr in p.get_drawings():
    f = dr.get('fill'); r = dr['rect']
    if not f or r.width >= 8 or r.height >= 8 or r.height < 1.2: continue
    col = tuple(int(round(v * 255)) for v in f)
    if col not in ((0, 0, 0), (255, 0, 0)): continue
    glyph.append((chu_ky(dr, r), 'do' if col == (255, 0, 0) else 'den', r.x0, r.y0, r.x1, r.y1, vong_cua(dr)))
nhom = collections.defaultdict(list)
for g in glyph: nhom[g[0]].append(g)
ds = sorted(nhom.items(), key=lambda kv: -len(kv[1]))
id_cua = {k: n for n, (k, v) in enumerate(ds)}
print(f'{len(glyph)} chu cai (hinh), {len(ds)} nhom hinh; 60 nhom dau: {[len(v) for k, v in ds[:60]]}')

if '--gom' in co:
    N = int(next((a.split('=')[1] for a in co if a.startswith('--n=')), 90))
    o_list = []
    for n, (k, v) in enumerate(ds[:N]):
        _, c, x0, y0, x1, y1, vong = v[0]
        h = y1 - y0; sc = 60 / h
        W = int((x1 - x0) * sc) + 10
        m = np.zeros((70, W), np.uint8)
        for vg in vong:
            t = np.zeros_like(m); cv2.fillPoly(t, [np.round((np.array(vg) - [x0, y0]) * sc + 5).astype(np.int32)], 1); m ^= t
        im = np.full((100, max(W, 80), 3), 255, np.uint8); im[25:95, :W][m > 0] = (0, 0, 200) if c == 'do' else (0, 0, 0)
        cv2.putText(im, f'{n}', (2, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 0, 0), 1)
        cv2.putText(im, f'x{len(v)}', (max(W, 80) - 48, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (120, 120, 120), 1)
        o_list.append(im)
    hang, cur, cw, WM = [], [], 0, 1500
    for o in o_list:
        if cw + o.shape[1] + 6 > WM and cur: hang.append(cur); cur, cw = [], 0
        cur.append(o); cur.append(np.full((100, 6, 3), 230, np.uint8)); cw += o.shape[1] + 6
    if cur: hang.append(cur)
    rows = [np.hstack(r + [np.full((100, WM - sum(x.shape[1] for x in r), 3), 255, np.uint8)]) for r in hang]
    cv2.imwrite(ra + '-mau.png', np.vstack(rows)); print('anh mau:', ra + '-mau.png')


# ---- GOM THEO ẢNH NHỎ (--gom2): mỗi chữ vẽ thành ảnh 16 điểm cao × tối đa 24 rộng (giữ tỷ lệ), gom theo độ trùng (IoU) ≥ 0,82 — chữ
# cong (O, D, C, S) làm tròn toạ độ hay tách nhóm, so ảnh thì không. Ghi gom2.json: mỗi chữ → nhóm; ảnh mẫu nhóm lớn nhất.
def anh_nho(g):
    _, c, x0, y0, x1, y1, vong = g
    h = max(y1 - y0, 1e-6); sc = 16 / h
    w = min(24, max(1, int(round((x1 - x0) * sc))))
    m = np.zeros((16, 24), np.uint8)
    for vg in vong:
        t = np.zeros((16, 24), np.uint8)
        cv2.fillPoly(t, [np.round((np.array(vg) - [x0, y0]) * sc).astype(np.int32)], 1); m ^= t
    return m.astype(bool), w
if '--gom2' in co:
    import time
    t0 = time.time()
    anh = [anh_nho(g) for g in glyph]
    print(f've {len(anh)} anh nho {time.time() - t0:.0f}s')
    proto, pw, thanh_vien = [], [], []
    gan = np.full(len(glyph), -1, np.int32)
    # duyệt theo nhóm chữ ký lớn trước để mẫu nhóm là chữ "chuẩn"
    thu_tu = sorted(range(len(glyph)), key=lambda i: -len(nhom[glyph[i][0]]))
    P = np.zeros((0, 16 * 24), bool)
    for i in thu_tu:
        a, w = anh[i]; v = a.ravel()
        if len(proto):
            inter = (P & v).sum(1); uni = (P | v).sum(1); iou = inter / np.maximum(uni, 1)
            iou[np.abs(np.array(pw) - w) > 2] = 0
            j = int(iou.argmax())
            if iou[j] >= 0.82: gan[i] = j; thanh_vien[j].append(i); continue
        proto.append(v); pw.append(w); thanh_vien.append([i]); gan[i] = len(proto) - 1
        P = np.vstack([P, v[None]])
    thu = sorted(range(len(proto)), key=lambda j: -len(thanh_vien[j]))
    so_moi = {j: n for n, j in enumerate(thu)}
    print(f'{len(proto)} nhom anh; 80 nhom dau: {[len(thanh_vien[j]) for j in thu[:80]]}; {time.time() - t0:.0f}s')
    cao = [float(np.median([glyph[k][5] - glyph[k][3] for k in thanh_vien[j]])) for j in thu]
    json.dump({'gan': [so_moi[int(j)] for j in gan], 'so': [len(thanh_vien[j]) for j in thu], 'cao': cao}, open(ra + '-gom2.json', 'w'))
    N = int(next((a.split('=')[1] for a in co if a.startswith('--n=')), 120))
    o_list = []
    TU = int(next((a.split('=')[1] for a in co if a.startswith('--tu=')), 0))
    XEM = next((list(map(int, a.split('=')[1].split(','))) for a in co if a.startswith('--xem=')), None)
    for n, j in ([(x, thu[x]) for x in XEM] if XEM else list(enumerate(thu))[TU:TU + N]):
        i = thanh_vien[j][0]; m = anh[i][0]
        do_ = sum(1 for k in thanh_vien[j] if glyph[k][1] == 'do')
        im = np.full((100, 84, 3), 255, np.uint8)
        big = cv2.resize(m.astype(np.uint8) * 255, (72, 48), interpolation=cv2.INTER_NEAREST)
        im[30:78, 6:78][big > 0] = (0, 0, 200) if do_ > len(thanh_vien[j]) / 2 else (0, 0, 0)
        cv2.putText(im, f'{n}', (2, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 0, 0), 1)
        hc = float(np.median([glyph[k][5] - glyph[k][3] for k in thanh_vien[j]]))
        cv2.putText(im, f'{hc:.1f}', (50, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 120, 0), 1)
        cv2.putText(im, f'x{len(thanh_vien[j])}', (2, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (120, 120, 120), 1)
        cv2.putText(im, f'd{do_}', (46, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 200), 1)
        o_list.append(im)
    hang, cur, cw, WM = [], [], 0, 1500
    for o in o_list:
        if cw + o.shape[1] + 4 > WM and cur: hang.append(cur); cur, cw = [], 0
        cur.append(o); cur.append(np.full((100, 4, 3), 230, np.uint8)); cw += o.shape[1] + 4
    if cur: hang.append(cur)
    rows = [np.hstack(r + [np.full((100, WM - sum(x.shape[1] for x in r), 3), 255, np.uint8)]) for r in hang]
    ten_anh = ra + (f'-xem.png' if XEM else f'-mau2-{TU}.png'); cv2.imwrite(ten_anh, np.vstack(rows)); print('anh mau:', ten_anh)

doc = next((a.split('=', 1)[1] for a in co if a.startswith('--doc=')), None)
if doc:
    bang = {int(k): v for k, v in json.load(open(doc, encoding='utf-8')).items()}
    # ghép chữ thành TỪ: cùng màu, cùng chiều cao (±0,15 pt), cùng đáy (±0,2 pt), khe giữa hai chữ < 0,5 × cao
    gan2 = json.load(open(ra + '-gom2.json'))['gan'] if os.path.exists(ra + '-gom2.json') else None
    # ghép chữ thành TỪ theo TÂM DÒNG có dung sai (chữ tròn O, C, S nhô trên/dưới chữ thẳng ~0,05–0,1 điểm in → không ghép theo đáy
    # làm tròn được): chữ sau cùng màu, cao lệch < 0,4, tâm dòng lệch < 0,35 × cao, mép trái cách mép phải chữ trước −0,2 … 0,5 × cao
    G = []
    for gi, g in enumerate(glyph):
        ch = bang.get(gan2[gi]) if gan2 is not None else bang.get(id_cua[g[0]])
        G.append((g[2], g[3], g[4], g[5], g[1], ch or '?'))
    luoi = collections.defaultdict(list)
    for k, (x0, y0, x1, y1, c, ch) in enumerate(G): luoi[(c, int(x0 // 2), int(((y0 + y1) / 2) // 2))].append(k)
    def ke_tiep(k):
        x0, y0, x1, y1, c, ch = G[k]; h = y1 - y0; cy = (y0 + y1) / 2; tot = None
        for gx in range(int(x1 // 2) - 1, int((x1 + 0.5 * h) // 2) + 1):
            for gy in range(int(cy // 2) - 1, int(cy // 2) + 2):
                for j in luoi.get((c, gx, gy), ()):
                    if j == k: continue
                    a0, b0, a1, b1, _, _ = G[j]; hj = b1 - b0
                    if abs(hj - h) < 0.4 and abs((b0 + b1) / 2 - cy) < 0.35 * h and x1 - 0.2 * h < a0 < x1 + 0.5 * h and a0 > x0:
                        if tot is None or a0 < G[tot][0]: tot = j
        return tot
    sau = {k: ke_tiep(k) for k in range(len(G))}
    co_truoc = set(v for v in sau.values() if v is not None)
    tu = []
    for k in range(len(G)):
        if k in co_truoc: continue                  # không phải chữ đầu từ
        cs, j, da = [], k, set()
        while j is not None and j not in da: da.add(j); cs.append(j); j = sau[j]
        tu.append((G[k][4], [(G[j][0], G[j][2], G[j][5], (None, G[j][4], G[j][0], G[j][1], G[j][2], G[j][3])) for j in cs]))
    ra_ds = []; dem = collections.Counter()
    for c, cs in tu:
        t = ''.join(a[2] for a in cs)
        x0 = min(a[3][2] for a in cs); y0 = min(a[3][3] for a in cs); x1 = max(a[3][4] for a in cs); y1 = max(a[3][5] for a in cs)
        ra_ds.append({'t': t, 'do': c == 'do', 'bbox': [round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)], 'cao': round(y1 - y0, 2)})
        dem[t] += 1
    json.dump(ra_ds, open(ra + '-nhan.json', 'w', encoding='utf-8'), ensure_ascii=False)
    # chữ chưa gán ('?') nằm trong từ 2–4 chữ mà các chữ còn lại đã biết → nhóm ảnh nào hay gặp nhất (để gán nốt)
    nhom_hoi = collections.Counter()
    for c, cs in tu:
        t = ''.join(a[2] for a in cs)
        if 2 <= len(t) <= 4 and t.count('?') == 1:
            for a in cs:
                if a[2] == '?':
                    k = next(k for k, gg in enumerate(G) if gg[0] == a[0] and gg[2] == a[1])
                    nhom_hoi[(gan2[k] if gan2 else -1, t)] += 1
    print('chu ? hay gap (nhom, tu):', nhom_hoi.most_common(40))
    print(f'{len(ra_ds)} tu; 40 tu hay gap:', dem.most_common(40))
    # CHỈ GIỮ MÃ LOẠI ĐẤT HỢP LỆ (cùng danh sách MA của boc_loai_dat.py); từ dính nhiều mã liền nhau (vd 'ODTODT' — hai nhãn sát nhau) tách
    # đều từng 3 chữ nếu MỌI phần đều là mã hợp lệ (chia lại khung theo tỷ lệ chữ)
    MA_HOP_LE = set(("ODT ONT LUA LUC LUK LUN BHK NHK HNK CLN RSX RPH RDD RSN RST RSM NTS LMU NKH TSC DTS CQP CAN SKC SKK SKN SKT "
          "SKS SKX TMD DGT DTL DNL DBV DVH DYT DGD DTT DSH DKV DRA DCH DDT DDL TON TIN NTD SON MNC PNK CSD BCS DCS NCS "
          "DNG DKH DXH DSK DCK MVB MBV TSK").split())
    ma = []; dem_ma = collections.Counter(); bo = collections.Counter()
    for w in ra_ds:
        t = w['t']; x0, y0, x1, y1 = w['bbox']
        if t in MA_HOP_LE: ma.append(w); dem_ma[t] += 1; continue
        if len(t) > 3 and len(t) % 3 == 0 and all(t[i:i + 3] in MA_HOP_LE for i in range(0, len(t), 3)):
            n = len(t) // 3; d = (x1 - x0) / n
            for i in range(n):
                ma.append({'t': t[3 * i:3 * i + 3], 'do': w['do'], 'bbox': [round(x0 + i * d, 3), y0, round(x0 + (i + 1) * d, 3), y1], 'cao': w['cao'], 'tach': True})
                dem_ma[t[3 * i:3 * i + 3]] += 1
            continue
        if len(t) == 3 and '?' not in t: bo[t] += 1
    json.dump(ma, open(ra + '-ma.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(ma)} nhan MA hop le ({sum(1 for m in ma if m["do"])} do):', dem_ma.most_common(45))
    print('tu 3 chu BO (khong phai ma):', bo.most_common(25))
