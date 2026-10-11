# ĐÁP ÁN CẮT HÌNH THẲNG (12/10/2026) cho các thửa do kiem-ngau-nhien.ts ghi ra — so với số web tính.
# Chạy: docker cp camlam_backend:/tmp/kiem-ngau-nhien.jsonl . && python dap-an-cat-hinh.py kiem-ngau-nhien.jsonl dap-an.jsonl
# (file thửa có hình + số web; KHÔNG có họ tên — nhưng vẫn đừng đưa lên git, nặng vài chục MB)
#   trong ô đất                        → loại đất của ô (ô chồng nhau: bậc cao thắng, cùng bậc ô nhỏ thắng — như web / bản vẽ)
#   bản phân khu + QĐ205: trong ranh (trừ lỗ _lo/_khop) mà không ô nào → Đất giao thông; ngoài ranh → Nằm ngoài phạm vi
#   QĐ893: không ô nào → Nằm ngoài phạm vi
# Ra: file thứ hai (từng thửa × bản) + bảng tóm tắt in ra màn hình.
import json, io, sys, math, collections
from shapely.geometry import Polygon, MultiPolygon, box
from shapely.strtree import STRtree
from shapely.ops import unary_union
from shapely.validation import make_valid
sys.stdout.reconfigure(encoding='utf-8')
D = 'D:/Cam Lam gis/apps/backend/data/'
VAO, RA = sys.argv[1], sys.argv[2]
NGOAI = 'Nằm ngoài phạm vi bản quy hoạch này'
GT = 'Đất giao thông'
RANH = json.load(io.open(D + 'ranh_qh.json', encoding='utf-8'))


def da_giac(x):          # vòng [[x,y]…] hoặc đa giác có lỗ [[vòng ngoài], [lỗ]…]
    if x and isinstance(x[0][0], (list, tuple)):
        return make_valid(Polygon(x[0], x[1:]))
    return make_valid(Polygon(x))


def ranh_that(ma):
    if ma == '893': return None
    r = make_valid(Polygon(RANH[ma]))
    lo = list(RANH.get('_lo', {}).get(ma, [])) + list(RANH.get('_khop', {}).get(ma, []))
    if lo: r = r.difference(unary_union([da_giac(x) for x in lo]))
    return r


def hinh_thua(t):
    h = t['hinh']
    if t['kieu'] == 'Polygon': g = Polygon(h[0], h[1:])
    else: g = MultiPolygon([Polygon(p[0], p[1:]) for p in h])
    return g if g.is_valid else make_valid(g)


THUA = [json.loads(l) for l in io.open(VAO, encoding='utf-8')]
for t in THUA: t['_g'] = hinh_thua(t)
print('so thua', len(THUA))

def nhom(s):
    s = (s or '').lower()
    if 'ngoài phạm vi' in s or 'chưa ghi' in s: return 'NGOAI'
    if 'giao thông' in s: return 'GT'
    return 'K'

out = io.open(RA, 'w', encoding='utf-8')
TK = {}
for ma, tep in [('205', 'qh_zones.json'), ('893', 'qh_zones_893.json'), ('2076', 'qh_zones_2076.json'), ('2101', 'qh_zones_2101.json'),
                ('2222', 'qh_zones_2222.json'), ('918', 'qh_zones_918.json'), ('cuhin', 'qh_zones_cuhin.json'),
                ('taynam', 'qh_zones_taynam.json'), ('taybac', 'qh_zones_taybac.json')]:
    Z = json.load(io.open(D + tep, encoding='utf-8'))
    hop = [box(e[0], e[1], e[2], e[3]) for e in Z]
    cay = STRtree(hop)
    poly = {}
    def lay(i):
        if i not in poly:
            p = Polygon(Z[i][4]); poly[i] = p if p.is_valid else make_valid(p)
        return poly[i]
    rv = ranh_that(ma)
    tk = TK[ma] = {'n': 0, 'dt': 0.0, 'lech': 0.0, 'lech_nhom': 0.0, 'cap': collections.Counter(), 'thieu': 0, 'thua_ra': 0, 'ds': []}
    for t in THUA:
        G = t['_g']
        idx = list(cay.query(G))
        cham_ranh = rv is not None and G.intersects(rv)
        if not idx and not cham_ranh:
            if ma in t['ban']: tk['thua_ra'] += 1; tk['ds'].append((sum(t['ban'][ma].values()), t, {}, 'web co dong, dap an khong'))
            continue
        lat = G.centroid.y; kk = 111320 * math.cos(math.radians(lat)) * 110574
        tl = t['dt'] / (G.area * kk)
        idx.sort(key=lambda i: (-Z[i][7], Z[i][6]))
        con = G; kq = collections.Counter()
        for i in idx:
            if con.is_empty: break
            p = lay(i)
            if not con.intersects(p): continue
            g = con.intersection(p)
            if g.area > 0:
                kq[Z[i][5]] += g.area * kk * tl
                con = con.difference(p)
        if not con.is_empty and con.area > 0:
            if rv is None: kq[NGOAI] += con.area * kk * tl
            else:
                tr = con.intersection(rv).area
                if tr > 0: kq[GT] += tr * kk * tl
                if con.area - tr > 0: kq[NGOAI] += (con.area - tr) * kk * tl
        kq = {k: v for k, v in kq.items() if v >= 0.05}
        # web bỏ hẳn dòng của bản khi thửa nằm trọn ngoài phạm vi
        if set(kq) <= {NGOAI}: kq = {}
        web = t['ban'].get(ma)
        if not kq and not web: continue
        if not web:
            tk['thieu'] += 1; tk['ds'].append((sum(kq.values()), t, kq, 'dap an co, web KHONG co dong'))
            web = {}
        if not kq:
            tk['thua_ra'] += 1; tk['ds'].append((sum(web.values()), t, kq, 'web co dong, dap an khong'))
        ks = set(web) | set(kq)
        lech = sum(abs(web.get(k, 0) - kq.get(k, 0)) for k in ks) / 2
        gw, gd = collections.Counter(), collections.Counter()
        for k, v in web.items(): gw[nhom(k)] += v
        for k, v in kq.items(): gd[nhom(k)] += v
        lech_n = sum(abs(gw[k] - gd[k]) for k in set(gw) | set(gd)) / 2
        tk['n'] += 1; tk['dt'] += t['dt']; tk['lech'] += lech; tk['lech_nhom'] += lech_n
        if lech > 0.5:
            # cặp lệch: loại web ghi THÊM ↔ loại đáp án có THÊM
            hon = {k: web.get(k, 0) - kq.get(k, 0) for k in ks}
            for a, va in hon.items():
                if va > 0.3:
                    for b, vb in hon.items():
                        if vb < -0.3: tk['cap'][(a, b)] += min(va, -vb)
            tk['ds'].append((lech, t, kq, ''))
        out.write(json.dumps({'id': t['id'], 'xa': t['xa'], 'to': t['to'], 'thua': t['thua'], 'dt': t['dt'], 'ma': ma, 'lech': round(lech, 2),
                              'web': web, 'dap_an': {k: round(v, 2) for k, v in kq.items()}, 'theo': t.get('theo')}, ensure_ascii=False) + '\n')
    del Z, hop, cay, poly
    print('\n=== %s: %d thua · tong %.0f m2 · lech %.2f %% (%.1f m2) · lech theo NHOM (ngoai/duong/dat) %.2f %% · web thieu dong %d · web thua dong %d'
          % (ma, tk['n'], tk['dt'], 100 * tk['lech'] / max(1, tk['dt']), tk['lech'], 100 * tk['lech_nhom'] / max(1, tk['dt']), tk['thieu'], tk['thua_ra']))
    lechs = sorted(x[0] for x in tk['ds'] if not x[3])
    print('    thua lech > 0,5 m2: %d · > 5 m2: %d · > 50 m2: %d' % (len(lechs), sum(1 for x in lechs if x > 5), sum(1 for x in lechs if x > 50)))
    for (a, b), v in tk['cap'].most_common(6):
        print('    web "%s"  <-  dap an "%s": %.1f m2' % (a[:50], b[:50], v))
    for lech, t, kq, ghi in sorted(tk['ds'], key=lambda x: -x[0])[:8]:
        print('    ▸ %s to %s thua %s (%s m2, id %s) lech %.1f %s | web %s | dap an %s' % (t['xa'], t['to'], t['thua'], t['dt'], t['id'], lech, ghi,
              {k[:28]: round(v, 1) for k, v in (t['ban'].get(ma) or {}).items()}, {k[:28]: round(v, 1) for k, v in kq.items()}))
    sys.stdout.flush()
out.close()

# QĐ205: số "thuần" (chưa hoà hợp) so với số đang hiện
hh = [t for t in THUA if t.get('theo')]
print('\nQD205 hoa hop theo ban chi tiet: %d / %d thua mot vong' % (len(hh), sum(1 for t in THUA if t.get('thuan') is not None)))
ch = []
for t in hh:
    a, b = t['ban'].get('205') or {}, t['thuan'] or {}
    ks = set(a) | set(b)
    ch.append((sum(abs(a.get(k, 0) - b.get(k, 0)) for k in ks) / 2, t))
ch.sort(key=lambda x: -x[0])
print('    tong m2 doi do hoa hop: %.1f · thua doi > 1 m2: %d · > 5 m2: %d' % (sum(x[0] for x in ch), sum(1 for x in ch if x[0] > 1), sum(1 for x in ch if x[0] > 5)))
for d, t in ch[:8]:
    print('    ▸ %s to %s thua %s (%s m2) theo %s: doi %.1f m2 | dang hien %s | thuan %s' % (t['xa'], t['to'], t['thua'], t['dt'], t['theo'], d,
          {k[:24]: round(v, 1) for k, v in (t['ban'].get('205') or {}).items()}, {k[:24]: round(v, 1) for k, v in (t['thuan'] or {}).items()}))
