# Bộ đọc phiếu v2: đọc khối "Thông tin quy hoạch" theo thứ tự từ trên xuống
#   dòng "Quyết định số NNN"  → đổi bản QH đang xét
#   dòng "+ <số> m ... thuộc <loại>"       → (số, loại)
#   dòng "+ Toàn bộ ... thuộc <loại>"      → ('toan', loại)
#   dòng "+ Diện tích/Phần còn lại ... thuộc <loại>" → ('conlai', loại)
# Bỏ: dòng "thông báo thu hồi", dòng mẫu trống "+ m² thuộc", phần sau "Bản vẽ/Giấy tờ/Hợp đồng/Văn bản".
import json, re, sys
from tcvn3 import tcvn3
from doc_phieu import doc as doc_v1   # lấy bảng toạ độ như cũ

SO = r'(\d+(?:[.,]\d+)?)'
def doc(path):
    g = json.loads(open(path, encoding='latin1').read())
    txt = []
    for f in g['features']:
        t = f['properties'].get('Text'); geo = f.get('geometry')
        if not t or not geo: continue
        c = geo['coordinates']
        while isinstance(c[0], list): c = c[0]
        for k, dong in enumerate(tcvn3(t).split('\n')):   # chữ nhiều dòng → tách
            if dong.strip(): txt.append((dong.strip(), c[0], c[1] - k * 0.5))
    # khử trùng lặp (bản vẽ hay chép đè 2 lần)
    seen = set(); tt = []
    for t in txt:
        key = (t[0], round(t[1]), round(t[2]))
        if key not in seen: seen.add(key); tt.append(t)
    heads = [t for t in tt if re.search(r'Th[ôo]ng tin quy ho', t[0], re.I)]
    khoi = []
    for h in heads:
        # các dòng cùng cột (x lệch < 15m), nằm dưới tiêu đề trong vòng 80m
        L = sorted([t for t in tt if abs(t[1] - h[1]) < 15 and 0 < h[2] - t[2] < 80], key=lambda t: -t[2])
        ban, cur = {}, None
        for t, x, y in L:
            tl = t.lower()
            if re.search(r'^[-+*\s]*(bản vẽ|giấy|hợp đồng|văn bản|quyết định số \d+/\d{4}/qđ-ta|v/v tranh)', tl): break
            m = re.search(r'(?:quy[ếe]t [đd][ịi]nh|qđ)\D{0,12}(\d{2,4})\s*/\s*q', tl)
            if m: cur = m.group(1); ban.setdefault(cur, []); continue
            if 'thu hồi' in tl or cur is None: continue
            m = re.match(r'^\+\s*' + SO + r'\s*m\s*[²2]?\s*(?:đất\s*)?thuộc\s*(.+)$', t, re.I)
            if m: ban[cur].append((float(m.group(1).replace(',', '.')), m.group(2))); continue
            m = re.match(r'^\+\s*to[àa]n bộ.*?thuộc\s+(?:thửa đất thuộc\s+)?(.+)$', t, re.I)
            if m: ban[cur].append(('toan', m.group(1))); continue
            # mọi dòng "+ … thuộc <loại>" KHÔNG có số m² (còn lại / phần còn lại / diện tích thửa đất thuộc…) = phần còn lại
            m = re.match(r'^\+\s*(?!\d)[^0-9]*?thuộc\s+(?:thửa đất thuộc\s+)?(.+)$', t, re.I)
            if m and not re.search(r'^\+\s*m\s*[²2]', t): ban[cur].append(('conlai', m.group(1))); continue
        ban = {k: v for k, v in ban.items() if v}
        if ban: khoi.append(ban)
    # nhiều khối (khung mẫu sót lại) → lấy khối có nhiều dòng thật nhất
    diem = lambda b: sum((1 if a == 'conlai' else 2) for v in b.values() for a, _ in v)
    khoi = [b for b in khoi if any(a != 'conlai' for v in b.values() for a, _ in v)]   # khung mẫu trống (toàn 'còn lại') → bỏ
    ban = max(khoi, key=diem) if khoi else {}
    if not ban:   # mẫu phiếu cũ (dòng không có dấu +) → bộ đọc v1
        v1 = doc_v1(path)['ban']
        ban = {k: [(x['m2'], x['loai']) for x in v] for k, v in v1.items() if k != '?'}
    # PHIẾU TÁCH THỬA: mỗi thửa con có ghi chú riêng "Tổng diện tích đất: X / Diện tích QHGT: Y" ngay dưới nhau.
    # Con số trong mục "Thông tin quy hoạch" là TỔNG của cả thửa gốc → phải so với đúng thửa con.
    tong = [(float(m.group(1)), x, y) for t, x, y in tt for m in [re.search(r'Tổng diện tích đất\s*:\s*([\d.]+)', t)] if m]
    qhgt = [(float(m.group(1)), x, y) for t, x, y in tt for m in [re.search(r'Diện tích QHGT\s*:\s*([\d.]+)', t)] if m]
    con = []
    for v, x, y in tong:
        gan = [(abs(qx - x) + abs(y - qy), q) for q, qx, qy in qhgt if 0 < y - qy < 15 and abs(qx - x) < 15]
        if gan: con.append([v, min(gan)[1]])   # không thấy dòng QHGT ngay dưới thì KHÔNG đoán là 0
    return {'ring': doc_v1(path)['ring'], 'ban': ban, 'tach': con}

if __name__ == '__main__':
    for p in sys.argv[1:]:
        r = doc(p); print(json.dumps({'file': p.replace(chr(92), '/').split('/')[-1], 'n': len(r['ring']), **r}, ensure_ascii=False))
