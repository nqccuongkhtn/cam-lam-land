# Nắn PDF theo ĐƯỜNG LƯỚI ĐỨT KHÚC: cho vị trí gần đúng đường lưới đầu tiên + giá trị toạ độ của nó (đọc bằng mắt ở mép),
# tự gom đoạn thẳng quanh từng đường (cách đều `buoc_pt`), lấy toạ độ trung bình theo chiều dài, khớp bình phương nhỏ nhất.
# Dùng: nan_luoi_dut.py <pdf> <x_dau_pt> <E_dau> <y_dau_pt> <N_dau> <buoc_pt> <buoc_m> [ghi_nan_json]
import sys, json, collections, pymupdf as fitz, numpy as np
sys.stdout.reconfigure(encoding='utf-8')
pdf, x0, E0, y0, N0, bpt, bm = sys.argv[1], *map(float, sys.argv[2:8])
pg = fitz.open(pdf)[0]; W, H = pg.rect.width, pg.rect.height
doc_, ngang = [], []
for d in pg.get_drawings():
    for it in d['items']:
        if it[0] != 'l': continue
        p, q = it[1], it[2]
        if abs(p.x - q.x) < 0.05 and abs(p.y - q.y) > 0.5: doc_.append(((p.x + q.x) / 2, abs(p.y - q.y)))
        elif abs(p.y - q.y) < 0.05 and abs(p.x - q.x) > 0.5: ngang.append(((p.y + q.y) / 2, abs(p.x - q.x)))
def gom(ds, v0, gioi, ten):
    # Dò NỐI TIẾP: đường kế tiếp tìm quanh (đường vừa thấy + 1 ô) → chịu được ô lưới rộng hẹp khác nhau.
    ds = np.array(ds); kq = {}
    def tim(c):
        m = np.abs(ds[:, 0] - c) < 2.0
        if ds[m, 1].sum() < 0.25 * (H if ten == 'E' else W): return None
        c2 = np.average(ds[m, 0], weights=ds[m, 1]); m2 = np.abs(ds[:, 0] - c2) < 0.3
        if ds[m2, 1].sum() < 0.15 * (H if ten == 'E' else W): return None
        return (np.average(ds[m2, 0], weights=ds[m2, 1]), ds[m2, 1].sum())
    for huong in (+1, -1):
        last_i, last_v = 0, v0
        for k in range(0, 80):
            i = huong * k
            c = last_v + (i - last_i) * bpt
            if c < 0 or c > gioi: break
            r = tim(c)
            if r: kq[i] = (i, r[0], r[1]); last_i, last_v = i, r[0]
    return [kq[i] for i in sorted(kq)]
ke = gom(doc_, x0, W, 'E'); kn = gom(ngang, y0, H, 'N')
def khop(kq, v0val, dau):
    i = np.array([k[0] for k in kq]); v = np.array([k[1] for k in kq]); val = v0val + dau * bm * i
    a, b = np.polyfit(v, val, 1); du = val - (a * v + b)
    return a, b, du, i, v
se, ie, due, ie_i, ve = khop(ke, E0, +1); sn, inn, dun, in_i, vn_ = khop(kn, N0, -1)
print('DOC (Dong):', len(ke), 'duong; m/pt = %.6f ; sai so lon nhat %.2f m, TB %.2f m' % (se, abs(due).max(), np.sqrt((due**2).mean())))
for (i, v, L), d in zip(ke, due): print('   E=%d  x=%.2f  dai=%.0f  lech=%.2f m' % (E0 + bm * i, v, L, d))
print('NGANG (Bac):', len(kn), 'duong; m/pt = %.6f ; sai so lon nhat %.2f m, TB %.2f m' % (sn, abs(dun).max(), np.sqrt((dun**2).mean())))
for (i, v, L), d in zip(kn, dun): print('   N=%d  y=%.2f  dai=%.0f  lech=%.2f m' % (N0 - bm * i, v, L, d))
print('ti le x/y: %.6f' % (se / -sn))
if len(sys.argv) > 8:
    json.dump({'se': round(se, 7), 'ie': round(ie, 3), 'sn': round(sn, 7), 'inn': round(inn, 3), 'ne': len(ke), 'nn': len(kn),
               'cach': 'nan_luoi_dut.py — duong luoi dut khuc, nhan doc bang mat',
               'luoi': {'x': [round(v, 3) for _, v, _ in ke], 'E': [E0 + bm * i for i, _, _ in ke],
                        'y': [round(v, 3) for _, v, _ in kn], 'N': [N0 - bm * i for i, _, _ in kn]}}, open(sys.argv[8], 'w', encoding='utf-8'))
    print('da ghi', sys.argv[8])
