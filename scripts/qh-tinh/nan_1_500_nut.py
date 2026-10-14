# -*- coding: utf-8 -*-
# NẮN BẢN VẼ 1/500 KHI KHÔNG CÓ BẢNG GÓC RANH, nhưng bản đồ GIAO THÔNG ghi toạ độ từng NÚT tim đường ngay trên bản vẽ:
# hộp nhãn "N8 | X=1339069.4227 | Y=593605.6517" + ĐƯỜNG DẪN đen nối từ hộp tới đúng điểm nút (Cam Hòa, 14/10/2026).
#   1) gom nhãn: chữ "X=…" + "Y=…" ngay dưới + tên nút "N…" bên trái → khung hộp nhãn;
#   2) điểm nút = đầu kia của đoạn thẳng đen có MỘT đầu chạm khung hộp nhãn (đường dẫn);
#   3) khớp AFFINE từ mọi nút (bỏ điểm lệch > 3 lần sai số trung bình), in sai số từng nút (mét);
#   4) tờ khác cùng bộ (vd tờ sử dụng đất) cùng khổ, cùng khung → dò độ dời giữa hai tờ bằng ảnh nét đỏ (ranh) rồi áp chung.
# Dùng: python -P nan_1_500_nut.py <tờ_giao_thông.pdf> <tờ_cần_nắn.pdf> <ghi.nan.json>
import sys, re, json
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, pymupdf, cv2

def nut_giao_thong(pdf):
    pg = pymupdf.open(pdf)[0]; M = pg.rotation_matrix
    W = pg.get_text('words')
    X = [w for w in W if re.fullmatch(r'X=1\d{6}(\.\d+)?', w[4])]
    Y = [w for w in W if re.fullmatch(r'Y=[5-6]\d{5}(\.\d+)?', w[4])]
    Nn = [w for w in W if re.fullmatch(r'N\d{1,3}', w[4])]
    doan = []
    for dr in pg.get_drawings():
        c = dr.get('color')
        if c is None or max(c) > 0.25: continue                       # đường dẫn màu đen
        for it in dr['items']:
            if it[0] == 'l': doan.append((it[1].x, it[1].y, it[2].x, it[2].y))
    doan = np.array(doan)
    ra = []
    for wx in X:
        wy = [w for w in Y if abs(w[0] - wx[0]) < 6 and 0 < w[1] - wx[1] < 16]
        wn = [w for w in Nn if abs((w[1] + w[3]) / 2 - wx[3]) < 12 and 0 < wx[0] - w[2] < 30]
        if not wy: continue
        wy = min(wy, key=lambda w: w[1] - wx[1])
        x0 = min([wx[0], wy[0]] + [w[0] for w in wn]) - 4; x1 = max(wx[2], wy[2]) + 3
        y0 = min(wx[1], wy[1]) - 3; y1 = max(wx[3], wy[3]) + 3
        def tren_khung(x, y): return (x0 - 3 <= x <= x1 + 3 and y0 - 3 <= y <= y1 + 3) and not (x0 + 3 < x < x1 - 3 and y0 + 3 < y < y1 - 3)
        ung = []
        for a, b, c, d in doan:
            dai = np.hypot(c - a, d - b)
            if dai < 6: continue
            if tren_khung(a, b) and not (x0 - 3 <= c <= x1 + 3 and y0 - 3 <= d <= y1 + 3): ung.append((dai, c, d))
            elif tren_khung(c, d) and not (x0 - 3 <= a <= x1 + 3 and y0 - 3 <= b <= y1 + 3): ung.append((dai, a, b))
        if not ung: continue
        tam = pymupdf.Point((x0 + x1) / 2, (y0 + y1) / 2) * M
        ra.append((wn[0][4] if wn else '?', tam.x, tam.y, float(wy[4][2:]), float(wx[4][2:]),
                   [(pymupdf.Point(px, py) * M) for _, px, py in ung]))       # tên, tâm hộp, E (Y=), N (X=), các đầu đường dẫn
    return ra

def anh_do(pdf, k=0.5):
    pg = pymupdf.open(pdf)[0]; M = pg.rotation_matrix
    im = np.zeros((int(pg.rect.height * k) + 1, int(pg.rect.width * k) + 1), np.float32)
    for dr in pg.get_drawings():
        c = dr.get('color')
        if c is None or not (c[0] > 0.8 and c[1] < 0.25 and c[2] < 0.25): continue
        for it in dr['items']:
            if it[0] == 'l':
                p, q = it[1] * M, it[2] * M
                cv2.line(im, (int(p.x * k), int(p.y * k)), (int(q.x * k), int(q.y * k)), 1.0, 2)
    return im, pg.rect

if __name__ == '__main__':
    gt, to, ra = sys.argv[1], sys.argv[2], sys.argv[3]
    nut = nut_giao_thong(gt)
    # bỏ nhãn trùng (cùng toạ độ)
    da_co, ds = set(), []
    for n in nut:
        k = (round(n[3], 2), round(n[4], 2))
        if k not in da_co: da_co.add(k); ds.append(n)
    nut = ds
    print('nhan nut:', len(nut))
    Q = np.array([[E, N] for _, _, _, E, N, _ in nut])
    # B1: phép thô từ TÂM HỘP NHÃN (lệch bằng độ dài đường dẫn) — khớp ngược EN → trang
    P = np.array([[x, y] for _, x, y, _, _, _ in nut])
    def khop(P, Q, giu):
        A = np.c_[Q[giu], np.ones(giu.sum())]
        cx, *_ = np.linalg.lstsq(A, P[giu, 0], rcond=None); cy, *_ = np.linalg.lstsq(A, P[giu, 1], rcond=None)
        return cx, cy
    giu = np.ones(len(P), bool)
    cx, cy = khop(P, Q, giu)
    # B2: mỗi nhãn chọn đầu đường dẫn GẦN vị trí dự đoán nhất, khớp lại, thu hẹp bán kính
    for ban_kinh in (120, 60, 30, 15, 8, 8):
        du_doan = np.c_[np.c_[Q, np.ones(len(Q))] @ cx, np.c_[Q, np.ones(len(Q))] @ cy]
        P2, g2 = [], []
        for (ten, tx, ty, E, N, ung), d in zip(nut, du_doan):
            if not ung: P2.append((tx, ty)); g2.append(False); continue
            kc = [np.hypot(u.x - d[0], u.y - d[1]) for u in ung]; j = int(np.argmin(kc))
            P2.append((ung[j].x, ung[j].y)); g2.append(kc[j] < ban_kinh)
        P = np.array(P2); giu = np.array(g2)
        if giu.sum() < 6: break
        cx, cy = khop(P, Q, giu)
    # phép xuôi trang → EN trên các nút giữ lại
    A = np.c_[P[giu], np.ones(giu.sum())]
    cE, *_ = np.linalg.lstsq(A, Q[giu, 0], rcond=None); cN, *_ = np.linalg.lstsq(A, Q[giu, 1], rcond=None)
    Af = np.c_[P, np.ones(len(P))]; du = np.hypot(Af @ cE - Q[:, 0], Af @ cN - Q[:, 1])
    tb = float(np.sqrt((du[giu] ** 2).mean()))
    print(f'affine tu {giu.sum()}/{len(P)} nut: sai so TB {tb:.3f} m, lon nhat {du[giu].max():.3f} m; '
          f'ti le {np.hypot(*cE[:2]) ** -1:.4f} pt/m')
    # tờ cần nắn khác tờ giao thông → dò độ DỜI giữa hai tờ bằng ảnh nét đỏ (ranh lập quy hoạch)
    dx = dy = 0.0
    if to != gt:
        a, ra_a = anh_do(gt); b, ra_b = anh_do(to)
        if a.shape == b.shape:
            (sx, sy), resp = cv2.phaseCorrelate(a, b)
            dx, dy = sx / 0.5, sy / 0.5
            print(f'do doi giua hai to: {dx:+.2f}, {dy:+.2f} pt (do tin cay {resp:.2f})')
        else:
            print('LOI: hai to khac kho giay', a.shape, b.shape); sys.exit(1)
    # điểm trên tờ cần nắn = điểm tờ giao thông + (dx, dy) → E = cE·(x - dx, y - dy, 1)
    a_, b_, c_ = cE; d_, e_, f_ = cN
    af = [a_, b_, c_ - a_ * dx - b_ * dy, d_, e_, f_ - d_ * dx - e_ * dy]
    json.dump({'afin': [float(v) for v in af], 'so_nut': int(giu.sum()), 'sai_so_tb_m': round(float(tb), 3),
               'cach': 'nan_1_500_nut.py — toa do nut tim duong ghi tren ban ve giao thong + duong dan toi nut'},
              open(ra, 'w', encoding='utf-8'))
    print('da ghi', ra)
