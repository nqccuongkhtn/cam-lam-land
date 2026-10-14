# -*- coding: utf-8 -*-
# TINH CHỈNH phép nắn 1/500 theo ĐÚNG LỚP NÉT RANH (14/10/2026). nan_1_500.py dùng MỌI nét đỏ — lẫn cả tim đường (đỏ chấm gạch,
# chạy song song cách ranh vài chục mét), gạch tô lô đất (#dd0000), nên ở Cam Hiệp Bắc nét ranh lệch cạnh bảng 1–3,5 m theo
# kiểu bị xoay. Ở đây:
#   1) với từng lớp nét đỏ (màu + bề dày), đo phần độ dài nằm sát (≤ 4 m) cạnh đa giác bảng toạ độ → lớp RANH = lớp bám cạnh nhiều nhất;
#   2) điểm rải trên lớp ranh, gán cho cạnh gần nhất (bỏ 4 % hai đầu cạnh), giải phép ĐỒNG DẠNG cực tiểu tổng bình phương
#      KHOẢNG CÁCH VUÔNG GÓC tới cạnh (bài toán tuyến tính), gán lại, lặp; loại điểm lạc > 3 σ; cạnh nào lệch HỆ THỐNG
#      (bản vẽ là cung cong mà bảng nối dây cung) thì bỏ cả cạnh.
# Dùng: python -P tinh_ranh_net.py <tờ_có_bảng.pdf> <tờ_cần_nắn.pdf> <nan.json hiện có> [ra.nan.json]
import sys, os, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, pymupdf
import nan_1_500 as N5

bang, to, nan_cu = sys.argv[1], sys.argv[2], sys.argv[3]
ra = sys.argv[4] if len(sys.argv) > 4 else None
da = N5.doc_bang(bang)
af = json.load(open(nan_cu, encoding='utf-8'))['afin']
A0 = np.array([[af[0], af[1]], [af[3], af[4]]]); c0 = np.array([af[2], af[5]])
def p2en(P, A=A0, c=c0): return (A @ np.atleast_2d(P).T).T + c

canh = []                                                        # (đầu A, cuối B, số hiệu đầu, số hiệu cuối)
for vong in da:
    V = [(so, np.array([E, Nn])) for so, E, Nn in vong]
    for i in range(len(V)):
        (s1, a), (s2, b) = V[i], V[(i + 1) % len(V)]
        if np.hypot(*(b - a)) >= 10: canh.append((a, b, s1, s2))
def gan(EN, mep=0.04, xa=4.0):
    # điểm → cạnh gần nhất (khoảng cách vuông góc, chỉ phần giữa cạnh); trả chỉ số cạnh (-1 = không gán) và khoảng cách có dấu
    best = np.full(len(EN), -1); dbest = np.full(len(EN), np.inf); dsign = np.zeros(len(EN))
    for k, (a, b, _, _) in enumerate(canh):
        L = np.hypot(*(b - a)); u = (b - a) / L; nr = np.array([-u[1], u[0]])
        t = (EN - a) @ u; d = (EN - a) @ nr
        ok = (t > mep * L) & (t < (1 - mep) * L) & (np.abs(d) < np.minimum(dbest, xa))
        best[ok] = k; dbest[ok] = np.abs(d[ok]); dsign[ok] = d[ok]
    return best, dsign

pg = pymupdf.open(to)[0]; M = pg.rotation_matrix
lop = collections.defaultdict(list)
for dr in pg.get_drawings():
    c = dr.get('color')
    if c is None or not (c[0] > 0.8 and c[1] < 0.3 and c[2] < 0.3): continue
    k = '%02x%02x%02x_%.2f' % (*[int(v * 255) for v in c], dr.get('width') or 0)
    for it in dr['items']:
        if it[0] in ('l', 'c'):
            p, q = it[1] * M, it[-1] * M; n = max(1, int(abs(q - p) / 0.5))
            t = np.linspace(0, 1, n + 1); lop[k].append(np.c_[p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t])
bam = {}
for k, ds in lop.items():
    P = np.vstack(ds); b_, _ = gan(p2en(P)); bam[k] = ((b_ >= 0).sum(), len(P))
xep = sorted(bam.items(), key=lambda kv: -kv[1][0])
print('lop net do (diem sat canh / tong):', [(k, v) for k, v in xep[:5]])
k_ranh = xep[0][0]
P = np.vstack(lop[k_ranh])
# thêm lớp thứ hai nếu nó cũng bám cạnh mạnh (≥ 60 % điểm của nó sát cạnh, ≥ 30 % số điểm sát cạnh của lớp đầu)
for k, (n_sat, n_tong) in xep[1:3]:
    if n_sat >= 0.6 * n_tong and n_sat >= 0.3 * xep[0][1][0]: P = np.vstack([P] + lop[k]); k_ranh += ' + ' + k
print('lop ranh:', k_ranh, '·', len(P), 'diem')

par = None; A, c = A0, c0; bo_canh = set()
for vong in range(12):
    EN = p2en(P, A, c); idx, dsg = gan(EN, xa=4.0 if vong < 3 else 2.5)
    ok = idx >= 0
    for k in bo_canh: ok &= idx != k
    if par is not None:                                          # loại điểm lạc > 3σ
        s_ = np.std(dsg[ok]); ok &= np.abs(dsg) < max(0.3, 3 * s_)
    X = P[ok, 0]; Y = -P[ok, 1]
    nr = np.array([[-(canh[k][1] - canh[k][0])[1], (canh[k][1] - canh[k][0])[0]] for k in idx[ok]], float)
    nr /= np.linalg.norm(nr, axis=1)[:, None]
    Aa = np.array([canh[k][0] for k in idx[ok]])
    # E = a·X − b·Y + tx ; N = b·X + a·Y + ty  →  r = nx·(E − Ax) + ny·(N − Ay)
    G = np.c_[nr[:, 0] * X + nr[:, 1] * Y, -nr[:, 0] * Y + nr[:, 1] * X, nr[:, 0], nr[:, 1]]
    h = (nr * Aa).sum(1)
    par, *_ = np.linalg.lstsq(G, h, rcond=None)
    a_, b_, tx, ty = par
    A = np.array([[a_, -b_], [b_, a_]]) @ np.diag([1, -1]); c = np.array([tx, ty])
    r = G @ par - h
    # cạnh lệch hệ thống: trung bình phần dư theo cạnh > 0,6 m → bỏ cạnh (cung cong / bảng khác bản vẽ)
    if vong in (3, 6):
        for k in set(idx[ok]):
            m = r[idx[ok] == k]
            if len(m) > 20 and abs(m.mean()) > 0.6: bo_canh.add(k)
EN = p2en(P, A, c); idx, dsg = gan(EN, xa=2.5); ok = idx >= 0
for k in bo_canh: ok &= idx != k
r = dsg[ok]
print(f'   {ok.sum()} diem dung, bo {len(bo_canh)} canh: {[f"{canh[k][2]}-{canh[k][3]}" for k in sorted(bo_canh)]}')
print(f'   lech vuong goc net ranh -> canh bang: trung vi {np.median(np.abs(r)):.3f} m, trung binh {np.abs(r).mean():.3f} m, '
      f'90% {np.percentile(np.abs(r), 90):.3f} m')
theo_canh = {f'{canh[k][2]}-{canh[k][3]}': round(float(dsg[ok & (idx == k)].mean()), 2) for k in sorted(set(idx[ok]))}
print('   lech trung binh tung canh (m):', theo_canh)
s_moi = 1 / np.sqrt(abs(np.linalg.det(A))); s_cu = 1 / np.sqrt(abs(np.linalg.det(A0)))
tam = P.mean(0)
print(f'   ty le {s_moi:.5f} pt/m (cu {s_cu:.5f}), xoay {np.degrees(np.arctan2(par[1], par[0])):+.3f} do, doi o tam '
      f'{np.linalg.norm(p2en(tam, A, c) - p2en(tam)):.2f} m')
if ra:
    json.dump({'afin': [float(A[0, 0]), float(A[0, 1]), float(c[0]), float(A[1, 0]), float(A[1, 1]), float(c[1])],
               'ti_le_pt_m': round(float(s_moi), 5), 'lop_ranh': k_ranh, 'lech_vuong_goc_trung_vi_m': round(float(np.median(np.abs(r))), 3),
               'cach': 'tinh_ranh_net.py — lop net ranh khop canh bang toa do (khoang cach vuong goc)'}, open(ra, 'w', encoding='utf-8'))
    print('   da ghi', ra)
