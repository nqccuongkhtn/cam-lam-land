# -*- coding: utf-8 -*-
# NẮN BẢN VẼ QUY HOẠCH (PDF nét vector, KHÔNG có lưới toạ độ) theo "BẢNG TOẠ ĐỘ ĐIỂM RANH GIỚI" (VN-2000) in trên bộ bản vẽ
# — viết 14/10/2026 cho bộ 1/500 dự thảo (đã xoá), dùng lại 14/10 tối cho phân khu 1/2000 Tây Nha Trang (bảng N1–N50 in ở tờ
# hiện trạng, tờ sử dụng đất không có bảng): bảng ở MỘT tờ, nắn tờ KHÁC cùng ranh.
#   1) đọc bảng: số hiệu (12 · M12 · N12) + X (bắc) + Y (đông); bảng dọc hoặc ngang; điểm đầu lặp lại ở cuối = đa giác khép kín;
#   2) nét RANH LẬP QUY HOẠCH là nét đỏ đứt bị TÁCH thành hàng nghìn đoạn nhỏ → vẽ mọi nét đỏ thành ảnh, trượt hình đa giác bảng
#      (dò tỷ lệ 0,1–20 pt/m, xoay ±4°) tìm chỗ TRÙNG KHÍT nhất (matchTemplate), rồi TINH CHỈNH kiểu ICP (đồng dạng);
#   3) ghi <ra>.nan.json {"afin":[a,b,c,d,e,f]}: E = a·x + b·y + c, N = d·x + e·y + f (x,y = điểm trang ĐÃ XOAY như ảnh hiện ra)
#      + sai số: khoảng cách từ cạnh ranh thật (sau nắn) tới nét đỏ gần nhất (mét).
# Dùng: python -P nan_theo_bang_ranh.py <tờ_có_bảng.pdf> <tờ_cần_nắn.pdf> [ghi.nan.json] [ảnh_soi.png] [--lop=net|to|ca]
#        [--vung=x0,y0,x1,y1 (điểm PDF, khung bản đồ)] [--ti-le=a,b (pt/m)]
import sys, re, json
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, pymupdf, cv2

def doc_bang(pdf):
    pg = pymupdf.open(pdf)[0]
    W = pg.get_text('words')
    xs = [w for w in W if re.match(r'^1[0-9]{6}\.\d{1,3}$', w[4])]
    ys = [w for w in W if re.match(r'^[5-6][0-9]{5}\.\d{1,3}$', w[4])]
    ids = [w for w in W if re.match(r'^[A-Za-z]{0,2}[0-9]{1,3}$', w[4])]          # 12 · M12 · A1
    def so_hieu(t): return int(re.sub(r'^[A-Za-z]+', '', t)) if not t.isdigit() else int(t)
    diem = []
    for w in xs:
        cx = (w[0] + w[2]) / 2; cy = (w[1] + w[3]) / 2
        yy = [v for v in ys if abs((v[0] + v[2]) / 2 - cx) < 3 and 0 < v[1] - w[1] < 120]
        ii = [v for v in ids if abs((v[0] + v[2]) / 2 - cx) < 3 and 0 < w[1] - v[1] < 80]
        if yy and ii:                                           # bảng xoay dọc
            y = min(yy, key=lambda v: v[1] - w[1]); i = min(ii, key=lambda v: w[1] - v[1]); khoa = (round(w[1]), -round(cx))
        else:                                                   # bảng nằm ngang
            yy = [v for v in ys if abs((v[1] + v[3]) / 2 - cy) < 3 and 0 < v[0] - w[0] < 160]
            ii = [v for v in ids if abs((v[1] + v[3]) / 2 - cy) < 3 and 0 < w[0] - v[0] < 120]
            if not (yy and ii): continue
            y = min(yy, key=lambda v: v[0] - w[0]); i = min(ii, key=lambda v: w[0] - v[0]); khoa = (round(w[0] / 40), round(w[1]))   # cột theo mép trái (số rộng hẹp khác nhau)
        diem.append((khoa, so_hieu(i[4]), float(y[4]), float(w[4])))
    diem.sort(key=lambda d: d[0])
    da, cur, thay = [], [], {}
    for _, so, E, N in diem:
        if so in thay and cur and so == cur[0][0]:
            da.append(cur); cur = []; continue
        thay[so] = (E, N); cur.append((so, E, N))
    if len(cur) >= 3: da.append(cur)
    return da

def thuoc_ty_le(pg):
    # nhãn số kèm "M" cùng hàng (vd "0", "20 M", "100 M") + các ô đen/trắng của thước ngay phía trên → điểm PDF / mét
    M = pg.rotation_matrix
    W = [(w[4], pymupdf.Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2) * M) for w in pg.get_text('words')]
    mm = [(t, p) for t, p in W if t in ('M', 'm') or re.fullmatch(r'\d{2,4}\s?[Mm]', t)]
    for tM, pM in mm:
        so = [(int(re.sub(r'\D', '', t)), p) for t, p in W if re.fullmatch(r'\d{2,4}(\s?[Mm])?', t) and abs(p.y - pM.y) < 3 and -1 < pM.x - p.x < 40]
        if not so: continue
        L, pL = max(so, key=lambda x: x[0])
        khong = [p for t, p in W if t == '0' and abs(p.y - pM.y) < 3 and 0 < pL.x - p.x < 600]
        if not khong: continue
        p0 = max(khong, key=lambda p: p.x)
        xs = []
        for dr in pg.get_drawings():
            r = pymupdf.Rect(dr['rect']) * M
            if r.y1 < pM.y - 2 and r.y0 > pM.y - 60 and r.x0 > p0.x - 15 and r.x1 < pL.x + 40: xs += [r.x0, r.x1]
        if len(xs) >= 2:
            return (max(xs) - min(xs)) / L, L, (min(xs), max(xs))
    return None

def anh_net_do(pg, k, lop='net', vung=None):
    # vẽ các nét ĐỎ (ranh lập quy hoạch) thành ảnh trắng-đen ở k điểm ảnh / điểm PDF.
    # lop='net': nét vẽ đỏ (bản 1/500) · 'to': MẢNG TÔ đỏ thuần (Tây Nha Trang 1/2000: nét ranh dày vẽ thành mảng tô; nét đỏ là tim
    # đường) · 'ca': cả hai. vung=(x0,y0,x1,y1) điểm PDF: chỉ lấy trong khung bản đồ (bỏ sơ đồ thu nhỏ / chú giải có cùng ranh).
    M = pg.rotation_matrix; Wp, Hp = int(pg.rect.width * k) + 1, int(pg.rect.height * k) + 1
    im = np.zeros((Hp, Wp), np.uint8); doan = []
    def them(p, q):
        if vung and not (vung[0] <= p.x <= vung[2] and vung[1] <= p.y <= vung[3]): return
        cv2.line(im, (int(p.x * k), int(p.y * k)), (int(q.x * k), int(q.y * k)), 255, 1)
        doan.append((p.x, p.y, q.x, q.y))
    for dr in pg.get_drawings():
        c, f = dr.get('color'), dr.get('fill')
        la_net = c is not None and c[0] > 0.8 and c[1] < 0.25 and c[2] < 0.25 and lop in ('net', 'ca')
        la_to = f is not None and f[0] > 0.99 and f[1] < 0.01 and f[2] < 0.01 and lop in ('to', 'ca')
        if not (la_net or la_to): continue
        for it in dr['items']:
            if it[0] == 'l': them(it[1] * M, it[2] * M)
            elif it[0] == 'c': them(it[1] * M, it[4] * M)
            elif it[0] == 're':
                r = it[1]; g = [pymupdf.Point(r.x0, r.y0) * M, pymupdf.Point(r.x1, r.y0) * M, pymupdf.Point(r.x1, r.y1) * M, pymupdf.Point(r.x0, r.y1) * M]
                for a, b in zip(g, g[1:] + g[:1]): them(a, b)
    return im, np.array(doan)

def mat_do(da, buoc_m):
    # điểm rải đều trên các cạnh đa giác ranh thật (E, N), mỗi buoc_m mét
    P = []
    for d in da:
        V = np.array([[E, N] for _, E, N in d]); V = np.vstack([V, V[:1]])
        for a, b in zip(V[:-1], V[1:]):
            n = max(1, int(np.hypot(*(b - a)) / buoc_m))
            P += [a + (b - a) * t for t in np.linspace(0, 1, n, endpoint=False)]
    return np.array(P)

def dong_dang(P, Q):
    mp, mq = P.mean(0), Q.mean(0); A, B = P - mp, Q - mq
    U, S, Vt = np.linalg.svd(B.T @ A)
    D = np.eye(2); D[1, 1] = np.sign(np.linalg.det(U @ Vt))
    R = U @ D @ Vt; s = (S * np.diag(D)).sum() / (A ** 2).sum()
    return s, R, mq - s * R @ mp

if __name__ == '__main__':
    co = [a for a in sys.argv[1:] if a.startswith('--')]; sys.argv = [sys.argv[0]] + [a for a in sys.argv[1:] if not a.startswith('--')]
    LOP = next((a.split('=', 1)[1] for a in co if a.startswith('--lop=')), 'net')
    VUNG = next((tuple(map(float, a.split('=', 1)[1].split(','))) for a in co if a.startswith('--vung=')), None)
    TL = next((tuple(map(float, a.split('=', 1)[1].split(','))) for a in co if a.startswith('--ti-le=')), (0.1, 20))
    bang, to = sys.argv[1], sys.argv[2]
    da = doc_bang(bang)
    print('bang goc ranh:', [f'{len(d)} goc ({d[0][0]}..{d[-1][0]})' for d in da])
    if not da: sys.exit('LOI: khong doc duoc bang goc ranh')
    pg = pymupdf.open(to)[0]
    tl = thuoc_ty_le(pg)
    k = 0.5                                                     # ảnh nét đỏ: 1 điểm ảnh = 2 pt
    im, doan = anh_net_do(pg, k, LOP, VUNG)
    # LUÔN dò tỷ lệ 0,5–20 pt/m (bước 4 %): thước in trên bản vẽ có khi KHÔNG dùng được (Cam Hiệp Bắc ghi "1 cm = 50 m" nhưng
    # vạch 50 / 100 / 500 m không đều nhau — chép từ bản vẽ khác). Thước đọc được chỉ là thêm một ứng viên.
    ds_tl = list(np.exp(np.arange(np.log(TL[0]), np.log(TL[1]), np.log(1.04))))   # --ti-le=a,b (pt/m); tờ 1/2000 khổ A3 ~0,3
    if tl:
        s_thuoc, L, _ = tl; ds_tl += [s_thuoc * f for f in (0.99, 1.0, 1.01)]
        print(f'thuoc ty le (ung vien): {L} m = {s_thuoc * L:.1f} pt -> {s_thuoc:.4f} pt/m')
    s0 = None
    print('net do:', len(doan), 'doan')
    imd = cv2.dilate(im, np.ones((3, 3), np.uint8))
    EN = mat_do(da, 2.0); c0 = EN.mean(0)
    tot = None
    for st in ds_tl:
      for goc in np.arange(-4, 4.01, 1.0):   # bản vẽ thường hướng Bắc lên — chỉ thử xoay nhỏ
        g = np.radians(goc); R = np.array([[np.cos(g), -np.sin(g)], [np.sin(g), np.cos(g)]])
        P = ((EN - c0) * [1, -1]) @ R.T * st * k                  # lật trục bắc → trục y PDF hướng xuống
        mn = P.min(0); Pi = np.round(P - mn).astype(int) + 2
        tpl = np.zeros((Pi[:, 1].max() + 3, Pi[:, 0].max() + 3), np.uint8); tpl[Pi[:, 1], Pi[:, 0]] = 255
        if tpl.shape[0] >= imd.shape[0] or tpl.shape[1] >= imd.shape[1] or tpl.shape[0] < 8: continue
        r = cv2.matchTemplate(imd, tpl, cv2.TM_CCORR)
        _, v, _, loc = cv2.minMaxLoc(r)
        v = v / (255.0 * 255.0 * (tpl > 0).sum())                # TỶ LỆ điểm cạnh ranh trùng nét đỏ (so được giữa các tỷ lệ)
        if tot is None or v > tot[0]: tot = (v, goc, loc, mn, st)
    v, goc, loc, mn, st = tot
    s0 = st; print(f'do ty le: {st:.4f} pt/m, xoay {goc:+.0f} do, trung {100 * v:.0f}% diem')
    # phép thô: điểm PDF = ((EN - c0)·[1,-1]·R·s0·k - mn + 2 + loc) / k
    g = np.radians(goc); R0 = np.array([[np.cos(g), -np.sin(g)], [np.sin(g), np.cos(g)]])
    def thô(EN_): return (((EN_ - c0) * [1, -1]) @ R0.T * s0 * k - mn + 2 + np.array(loc)) / k
    print(f'tim tho: xoay {goc:+.1f} do, vi tri {loc}')
    # ICP: kéo từng điểm cạnh ranh về điểm nét đỏ gần nhất (trong 12 pt), giải lại đồng dạng EN → PDF
    mid = np.c_[(doan[:, 0] + doan[:, 2]) / 2, (doan[:, 1] + doan[:, 3]) / 2]
    dau = np.vstack([doan[:, :2], doan[:, 2:], mid])
    from scipy.spatial import cKDTree
    cay = cKDTree(dau)
    P = thô(EN)
    for vong in range(30):
        d, j = cay.query(P, distance_upper_bound=12)
        ok = np.isfinite(d)
        if ok.sum() < 10: break
        s, R, t = dong_dang(EN[ok] * [1, -1], dau[j[ok]])
        P2 = (s * (R @ (EN * [1, -1]).T).T + t)
        doi = np.abs(P2 - P).max(); P = P2
        if doi < 0.01: break
    d, _ = cay.query(P)
    print(f'tinh chinh: {vong + 1} vong, ti le {s:.4f} pt/m (thuoc {s0:.4f}), khop {100 * (d < 3).mean():.0f}% diem canh ranh; '
          f'cach net do TB {np.median(d) / s:.2f} m (trung vi), {np.percentile(d, 90) / s:.2f} m (90%)')
    # đảo phép: PDF → EN (affine 6 tham số, đúng bằng phép đồng dạng vừa giải)
    A = np.c_[P, np.ones(len(P))]
    cE, *_ = np.linalg.lstsq(A, EN[:, 0], rcond=None); cN, *_ = np.linalg.lstsq(A, EN[:, 1], rcond=None)
    if len(sys.argv) > 3:
        json.dump({'afin': [*map(float, cE), *map(float, cN)], 'ti_le_pt_m': round(float(s), 5), 'thuoc_pt_m': round(float(s0), 5),
                   'cach_net_do_trung_vi_m': round(float(np.median(d) / s), 3), 'khop_phan_tram': round(float(100 * (d < 3).mean()), 1),
                   'cach': 'nan_theo_bang_ranh.py — bang toa do diem ranh + khop net do ranh lap quy hoach'},
                  open(sys.argv[3], 'w', encoding='utf-8'))
        print('da ghi', sys.argv[3])
    if len(sys.argv) > 4:                                       # ảnh soi: nét đỏ (xám) + ranh thật đã nắn (xanh)
        S = 1.0; pix = pg.get_pixmap(matrix=pymupdf.Matrix(S, S), alpha=False)
        img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3][:, :, ::-1].copy()
        for dd in da:
            V = np.array([[E, N] for _, E, N in dd]); Q = (s * (R @ (V * [1, -1]).T).T + t) * S
            cv2.polylines(img, [np.round(Q).astype(np.int32)], True, (255, 120, 0), 2)
            for (so, _, _), q in zip(dd, Q): cv2.putText(img, str(so), (int(q[0]) + 4, int(q[1]) - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
        cv2.imwrite(sys.argv[4], img); print('anh soi:', sys.argv[4])
