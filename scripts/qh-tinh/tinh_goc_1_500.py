# -*- coding: utf-8 -*-
# TINH CHỈNH phép nắn 1/500 theo TỪNG GÓC RANH (14/10/2026). nan_1_500.py khớp CẢ ĐƯỜNG nét đỏ đứt với đa giác bảng toạ độ
# (ICP) — trung vị lệch 0,5–2,2 m. Ở đây: với mỗi CẠNH ranh trong bảng, gom các đoạn nét đỏ nằm dọc cạnh đó (bỏ 12 % hai đầu
# cạnh), khớp một ĐƯỜNG THẲNG (bình phương tối thiểu toàn phần, loại điểm lạc); GÓC = giao điểm hai đường kề nhau → cặp điểm
# (góc trên bản vẽ ↔ X, Y trong bảng VN-2000) → giải phép đồng dạng bằng bình phương tối thiểu, loại góc lệch xa. Cạnh CONG
# (bản vẽ là cung, bảng nối dây cung) tự bị loại vì điểm nét không nằm trên một đường thẳng.
# Dùng: python -P tinh_goc_1_500.py <tờ_có_bảng.pdf> <tờ_cần_nắn.pdf> <nan.json hiện có> [ra.nan.json]
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, pymupdf
import nan_1_500 as N5

bang, to, nan_cu = sys.argv[1], sys.argv[2], sys.argv[3]
ra = sys.argv[4] if len(sys.argv) > 4 and not sys.argv[4].startswith("--") else None
# nét ranh có khi là DẢI ~1 m (2 nét song song / nét đứt lệch nhau — TK B độ lệch chuẩn 0,4–0,55 m): tâm dải vẫn là đường ranh
NGUONG_THANG = float(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--thang=")), 0.25))
da = N5.doc_bang(bang)
af = json.load(open(nan_cu, encoding='utf-8'))['afin']
A = np.array([[af[0], af[1]], [af[3], af[4]]]); c0 = np.array([af[2], af[5]]); Ai = np.linalg.inv(A)
def en2p(E): return (Ai @ (np.atleast_2d(E) - c0).T).T
def p2en(P): return (A @ np.atleast_2d(P).T).T + c0
s_m = 1 / np.sqrt(abs(np.linalg.det(A)))                        # điểm PDF / mét

pg = pymupdf.open(to)[0]
_, doan = N5.anh_net_do(pg, 1.0)                                 # mọi đoạn nét đỏ (x0, y0, x1, y1) trên trang đã xoay
# điểm rải dày trên nét đỏ (mỗi 0,3 điểm PDF)
pts = []
for x0, y0, x1, y1 in doan:
    n = max(1, int(np.hypot(x1 - x0, y1 - y0) / 0.3))
    t = np.linspace(0, 1, n + 1); pts.append(np.c_[x0 + (x1 - x0) * t, y0 + (y1 - y0) * t])
Pd = np.vstack(pts)
EN_d = p2en(Pd)                                                  # nét đỏ theo phép nắn hiện tại (mét)

cap = []                                                         # (góc trên trang, góc trong bảng, số hiệu)
for vong in da:
    V = np.array([[E, Nn] for _, E, Nn in vong]); ids = [so for so, _, _ in vong]; n = len(V)
    duong = []
    for i in range(n):
        a, b = V[i], V[(i + 1) % n]; L = np.hypot(*(b - a))
        if L < 8: duong.append(None); continue
        u = (b - a) / L; nrm = np.array([-u[1], u[0]])
        t = (EN_d - a) @ u; d = (EN_d - a) @ nrm
        chon = (t > 0.12 * L) & (t < 0.88 * L) & (np.abs(d) < 3.0)
        if chon.sum() < 30: duong.append(None); continue
        Q = Pd[chon]
        for _ in range(4):                                       # đường thẳng TLS trên trang, loại điểm lạc > 2,5 σ
            m = Q.mean(0); _, S, Vt = np.linalg.svd(Q - m); huong = Vt[0]; ph = np.array([-huong[1], huong[0]])
            r = (Q - m) @ ph; sd = max(r.std(), 1e-6)
            giu = np.abs(r) < 2.5 * sd
            if giu.all(): break
            Q = Q[giu]
        do_thang = r.std() / s_m                                 # độ lệch khỏi đường thẳng, tính bằng mét
        phu = (np.ptp((Q - m) @ huong) / s_m) / (0.76 * L)       # nét đỏ phủ bao nhiêu phần đoạn giữa cạnh
        if do_thang > NGUONG_THANG or phu < 0.5: duong.append(None); continue
        duong.append((m, huong, do_thang, phu))
    for i in range(n):
        d1, d2 = duong[i - 1], duong[i]                          # cạnh (i-1 → i) và (i → i+1) gặp nhau ở góc i
        if d1 is None or d2 is None: continue
        (m1, h1, *_), (m2, h2, *_) = d1, d2
        sin_g = abs(h1[0] * h2[1] - h1[1] * h2[0])
        if sin_g < 0.17: continue                                # hai cạnh gần thẳng hàng (< 10°) → giao điểm không chắc
        M_ = np.array([h1, -h2]).T; t1 = np.linalg.solve(M_, m2 - m1)[0]
        cap.append((m1 + t1 * h1, V[i], ids[i]))
if len(cap) < 3: sys.exit(f'LOI: chi tim duoc {len(cap)} goc')
Pg = np.array([c[0] for c in cap]); Eg = np.array([c[1] for c in cap]); so = [c[2] for c in cap]
lech_cu = np.linalg.norm(p2en(Pg) - Eg, axis=1)
giu = np.ones(len(cap), bool)
for _ in range(5):                                               # đồng dạng (có lật trục y của trang)
    s, R, t = N5.dong_dang(Pg[giu] * [1, -1], Eg[giu])
    du = np.linalg.norm((s * (R @ (Pg * [1, -1]).T)).T + t - Eg, axis=1)
    moi = du < max(0.5, 3 * np.median(du[giu]))
    if (moi == giu).all(): break
    giu = moi
T = np.vstack([(s * R @ np.diag([1, -1])).T, t])
print(f'{os.path.basename(to)[:45]}: {len(cap)} goc tim duoc, dung {giu.sum()}')
print(f'   lech goc theo phep nan CU : trung binh {lech_cu.mean():.2f} m, lon nhat {lech_cu.max():.2f} m')
print(f'   lech goc theo phep nan MOI: trung binh {du[giu].mean():.3f} m, lon nhat {du[giu].max():.3f} m '
      f'(goc bi loai: {[so[i] for i in range(len(so)) if not giu[i]]})')
cu_tam = p2en(Pg.mean(0, keepdims=True))[0]; moi_tam = np.r_[Pg.mean(0), 1] @ T
print(f'   ty le {1 / s:.5f} pt/m (cu {s_m:.5f}), xoay {np.degrees(np.arctan2(R[1, 0], R[0, 0])):+.3f} do, '
      f'doi o tam {np.linalg.norm(moi_tam - cu_tam):.2f} m')
if ra:
    json.dump({'afin': [float(T[0, 0]), float(T[1, 0]), float(T[2, 0]), float(T[0, 1]), float(T[1, 1]), float(T[2, 1])],
               'ti_le_pt_m': round(float(1 / s), 5), 'goc_dung': int(giu.sum()), 'lech_goc_tb_m': round(float(du[giu].mean()), 3),
               'lech_goc_max_m': round(float(du[giu].max()), 3),
               'cach': 'tinh_goc_1_500.py — giao diem 2 canh net do ranh (duong thang TLS) khop goc bang toa do VN-2000'},
              open(ra, 'w', encoding='utf-8'))
    print('   da ghi', ra)
