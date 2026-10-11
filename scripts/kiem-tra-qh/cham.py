# Chấm điểm: web xếp sai bao nhiêu m² so với phiếu chính thức (quy loại đất về NHÓM để so)
import json, re, sys
MA = {'920': 'taynam', '30': 'cuhin'}
NHOM = [('GT', r'giao thông'), ('NGOAI', r'ngoài phạm vi'), ('MN', r'mặt nước|sông|suối|kênh|hồ ao'),
        ('VC', r'vui chơi'), ('CX', r'cây xanh'), ('TT', r'thể dục|thể thao'), ('GD', r'giáo dục|trường'),
        ('O', r'dân cư'),   # 11/10/2026: 'khu dân cư hiện hữu (có nông nghiệp xen kẹp ~75%)' là đất dân cư, không phải nông nghiệp
        ('NN', r'nông nghiệp|lâu năm|hàng năm|lúa|rừng|chưa sử dụng'),
        ('O', r'ở|làng xóm|dân cư'), ('CC', r'.')]
def nhom(s):
    s = s.lower()
    for k, r in NHOM:
        if re.search(r, s): return k
def chinh_thuc(dt, ds):
    if sum(1 for a, _ in ds if a == 'toan') > 1: ds = [x for x in ds if x[0] != 'toan'][:0] + [next(x for x in ds if x[0] == 'toan')]
    so = sum(a for a, _ in ds if isinstance(a, (int, float)))
    out = {}
    for a, loai in ds:
        v = dt if a == 'toan' else (dt - so if a == 'conlai' else a)
        k = nhom(loai); out[k] = out.get(k, 0) + v
    return out
def cham(path):
    R = json.load(open(path, encoding='utf8')); kq = []
    for d in R:
        web = {b['ma']: b['areas'] for b in d['web']}
        for ma, ds in d['ban'].items():
            if ma in ('205',): continue
            # phiếu tách thửa: thửa con có tổng diện tích khớp ranh (±1,5 m²) → dùng số QHGT của riêng thửa con đó
            tach = [t for t in d.get('tach', []) if abs(t[0] - d['dt']) <= 1.5]
            if tach and any(isinstance(a, (int, float)) and 'giao thông' in l.lower() for a, l in ds):
                ds = [(tach[0][1] if isinstance(a, (int, float)) and 'giao thông' in l.lower() else a, l) for a, l in ds]
            ct = chinh_thuc(d['dt'], ds)
            if any(v < -1 for v in ct.values()): continue          # phiếu đọc lỗi
            w = web.get(MA.get(ma, ma))
            if w is None: kq.append((d['file'], ma, d['dt'], d['dt'], 'MAT BAN', ct, {})); continue
            wn = {}
            for x in w: k = nhom(x['type']); wn[k] = wn.get(k, 0) + x['areaM2']
            sai = sum(abs(ct.get(k, 0) - wn.get(k, 0)) for k in set(ct) | set(wn)) / 2
            kq.append((d['file'], ma, d['dt'], round(sai, 1), '', ct, wn))
    return kq
cu, moi = cham('kq_cu.json'), cham('kq_moi.json')
tong = lambda k: sum(r[3] for r in k)
print('so cap (phieu x ban):', len(cu), '| tong m2 sai: CU', round(tong(cu)), ' MOI', round(tong(moi)), '| tong dien tich', round(sum(r[2] for r in cu)))
for a, b in zip(cu, moi):
    if a[3] > 5 or b[3] > 5 or a[4] or b[4]:
        f = lambda dct: ' '.join(f'{k}:{v:.0f}' for k, v in sorted(dct.items()))
        print(f'{a[0][:30]:30} {a[1]:6} dt{a[2]:7.0f} | sai CU {a[3]:>7} {a[4]:7} MOI {b[3]:>7} {b[4]:7} | CT {f(a[5])} | WEB {f(b[6])}')
json.dump({'cu': cu, 'moi': moi}, open('cham.json', 'w', encoding='utf8'), ensure_ascii=False)
