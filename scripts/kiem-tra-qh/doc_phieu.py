# Đọc 1 bản trích đo / phiếu kiểm tra QH (GeoJSON đổi từ DGN V7): lấy bảng toạ độ + số liệu QH chính thức
import json, re, sys
from tcvn3 import tcvn3

def doc(path):
    raw = open(path, encoding='latin1').read()
    g = json.loads(raw)
    txt = []
    for f in g['features']:
        t = f['properties'].get('Text'); geo = f.get('geometry')
        if not t or not geo: continue
        c = geo['coordinates']
        while isinstance(c[0], list): c = c[0]
        txt.append((tcvn3(t).strip(), c[0], c[1]))
    # --- bảng toạ độ: số X ~ 13xxxxx.xx, Y ~ 5xxxxx.xx/6xxxxx.xx, cùng hàng
    xs = [(float(t.replace(',', '.')), x, y) for t, x, y in txt if re.fullmatch(r'1[23]\d{5}[.,]\d{1,3}', t)]
    ys = [(float(t.replace(',', '.')), x, y) for t, x, y in txt if re.fullmatch(r'[56]\d{5}[.,]\d{1,3}', t)]
    hang = []
    for N, x, y in xs:
        cand = [(abs(yy - y) + abs(xx - x) * 0.01, E) for E, xx, yy in ys if abs(yy - y) < 1.5 and 0 < abs(xx - x) < 60]
        if cand: hang.append((x, -y, N, min(cand)[1]))
    # nhiều bảng (bảng kê lặp lại) → lấy cụm theo cột x, chọn cụm đông nhất
    cot = {}
    for h in hang: cot.setdefault(round(h[0] / 5), []).append(h)
    ring = []
    if cot:
        best = max(cot.values(), key=len)
        best.sort(key=lambda h: h[1])
        for h in best:
            p = [h[2], h[3]]
            if not ring or ring[-1] != p: ring.append(p)
        if len(ring) > 3 and ring[0] == ring[-1]: ring.pop()
    # --- số liệu QH: dòng "<số> m ... thuộc ..." gán về tiêu đề "Quyết định số NNN" gần nhất PHÍA TRÊN
    tieuDe = [(m.group(1), x, y) for t, x, y in txt for m in [re.search(r'(?:Quy[ếe]t [đĐ]ịnh|QĐ)[^0-9]{0,15}(\d{3,4})\s*/', t)] if m]
    ban = {}
    for t, x, y in txt:
        m = re.match(r'^[+\-\s]*([\d.,]+)\s*m\s*2?\s*(?:đất\s*)?thuộc\s*(.+)$', t)
        if not m or 'theo bản đồ' in t.lower(): continue
        so = float(m.group(1).replace(',', '.')) if m.group(1).count(',') <= 1 and '.' not in m.group(1) else float(m.group(1).replace(',', ''))
        tren = [(ty - y, ma) for ma, tx, ty in tieuDe if ty > y and abs(tx - x) < 80]
        ma = min(tren)[1] if tren else '?'
        ban.setdefault(ma, []).append({'loai': m.group(2).strip(), 'm2': so})
    dt = [t for t, x, y in txt if re.search(r'[Dd]iện tích', t)]
    return {'ring': ring, 'ban': ban}

if __name__ == '__main__':
    for p in sys.argv[1:]:
        r = doc(p); print(json.dumps({'file': p.split('/')[-1], 'n': len(r['ring']), **r}, ensure_ascii=False))
