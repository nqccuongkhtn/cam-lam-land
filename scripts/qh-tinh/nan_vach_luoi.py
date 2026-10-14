# -*- coding: utf-8 -*-
# NẮN THEO VẠCH LƯỚI THẬT (14/10/2026) — thay cách nắn theo TÂM CHỮ nhãn của nan2.py cho các bản đồ có vẽ đường lưới.
# Lỗi đã vấp ở Nha Trang: nhãn "597 / 500" in 2 dòng lệch nhau → nan2 ghép hụt phần "500" → đọc 597 000 thay vì 597 500 (một nửa số
# nhãn sai 500 m) + lấy tâm chữ "597" chứ không phải đường lưới (lệch ~6,5 điểm in) → phép nắn méo, lệch 60–100 m mỗi nơi một kiểu;
# chủ dự án so 10 thửa với app tham chiếu: sai 72,7 % diện tích, nhìn tổng quát thấy lệch bằng mắt thường.
# Cách làm: dò mọi vạch lưới (nét thẳng đứng / nằm ngang dài suốt bản đồ, kể cả đứt khúc) → giữ các vạch CÁCH ĐỀU (một bước lưới)
# → gán giá trị = làm tròn phép nắn thô (nan2) về bội số đúng bước lưới (2,5 km / 1 km…) → ghi "luoi" vào <ra.nan.json>
# (nan2.lap_phep_doi nội suy theo TỪNG Ô LƯỚI: đúng tại mọi vạch).
# Dùng: python -P nan_vach_luoi.py <ban_do.pdf> <tam_lng> <tam_lat> <ra.nan.json>
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, pymupdf
import nan2

pdf, lng, lat, ra = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
pg = pymupdf.open(pdf)[0]
if pg.rotation: sys.exit(f'LOI: trang xoay {pg.rotation} do — vach_luoi dung he chua xoay, can doi he truoc')
xs, ys = nan2.vach_luoi(pg)
side = pdf + '.nan.json'
if os.path.exists(side): print(f'dung phep nan san co {os.path.basename(side)} lam phep tho (chi de gan gia tri cho tung vach)')
p2en, p2w, info = nan2.lap_phep_doi(pdf, lng, lat)
if not p2en: sys.exit('LOI: nan2 khong nan tho duoc')
def deu(v, he, ten, la_E):
    # giữ các vạch nằm trên MỘT dãy cách đều: bước = trung vị khoảng cách các vạch liền nhau (loại khung, ô chú giải…)
    v = np.array(sorted(v)); d = np.diff(v)
    buoc = np.median(d[d > 50])
    # chọn gốc cho nhiều vạch khớp nhất
    tot = max(v, key=lambda x0: np.sum(np.abs((v - x0) / buoc - np.round((v - x0) / buoc)) * buoc < 1.5))
    giu = v[np.abs((v - tot) / buoc - np.round((v - tot) / buoc)) * buoc < 1.5]
    # bước lưới ngoài thực địa (m), làm tròn về giá trị chuẩn
    m_pt = abs(he)
    buoc_m = min((500, 1000, 2000, 2500, 5000, 10000), key=lambda s: abs(s - buoc * m_pt))
    gia = []
    for x in giu:
        E = p2en(x, 0)[0] if la_E else p2en(0, x)[1]
        gia.append(round(E / buoc_m) * buoc_m)
    gia = np.array(gia, float)
    # kiểm: giá trị liền nhau phải cách đúng số bước tương ứng
    k = np.round((giu - giu[0]) / buoc)
    ky_vong = gia[0] + np.sign(he) * k * buoc_m
    sai = np.abs(gia - ky_vong)
    print(f'{ten}: {len(v)} vach -> {len(giu)} vach deu, buoc {buoc:.2f} diem in = {buoc_m} m ({buoc * m_pt:.1f} m theo nan tho), '
          f'gia tri lech day deu toi da {sai.max():.0f} m')
    if sai.max() > 0: print('   CANH BAO: gia tri khong deu — dung day ky vong'); gia = ky_vong
    return giu, gia
LUOI_CU = json.load(open(side, encoding='utf-8')).get('luoi') if os.path.exists(side) else None
if LUOI_CU:
    # bản đã nắn theo TỪNG Ô LƯỚI (Khánh Vĩnh — lưới in KHÔNG đều nên không lọc "cách đều" được): giữ giá trị của từng vạch, chỉ
    # thay VỊ TRÍ bằng vạch dò chính xác gần nhất (≤ 3 điểm in)
    def bam(cu_p, cu_v, moi_p, ten):
        cu_p, cu_v = np.array(cu_p, float), np.array(cu_v, float); ra_p, ra_v, doi = [], [], []
        for p, v in zip(cu_p, cu_v):
            if len(moi_p) == 0: continue
            g = moi_p[np.argmin(np.abs(moi_p - p))]
            if abs(g - p) <= 3: ra_p.append(float(g)); ra_v.append(float(v)); doi.append(g - p)
        print(f'{ten}: {len(ra_p)}/{len(cu_p)} vach cu bam duoc vach do, doi vi tri trung vi {np.median(np.abs(doi)):.3f} diem in, lon nhat {np.abs(doi).max():.3f}')
        return np.array(ra_p), np.array(ra_v)
    gx, gE = bam(LUOI_CU['x'], LUOI_CU['E'], xs, 'vach doc (E)')
    gy, gN = bam(LUOI_CU['y'], LUOI_CU['N'], ys, 'vach ngang (N)')
else:
    gx, gE = deu(xs, info['se'], 'vach doc (E)', True)
    gy, gN = deu(ys, info['sn'], 'vach ngang (N)', False)
# so với phép nắn thô cũ: tại tâm, góc
W, H = info['W'], info['H']
def moi(x, y): return float(np.interp(x, gx, gE, left=None)), float(np.interp(y, gy, gN))
for nm, (x, y) in [('tam', (W / 2, H / 2)), ('goc tren trai', (W * 0.15, H * 0.1)), ('goc duoi phai', (W * 0.85, H * 0.9))]:
    E1, N1 = p2en(x, y); E2 = np.interp(x, gx, gE); N2 = np.interp(y, gy, gN)
    print(f'  {nm}: noi dung doi dong {E2 - E1:+.1f} m, bac {N2 - N1:+.1f} m so voi phep nan cu')
json.dump({'cach': 'nan_vach_luoi.py — vach luoi that, gia tri theo buoc luoi', 'luoi': {'x': [round(float(v), 3) for v in gx], 'E': [float(v) for v in gE],
           'y': [round(float(v), 3) for v in gy], 'N': [float(v) for v in gN]},
           'se': float(np.polyfit(gx, gE, 1)[0]), 'ie': float(np.polyfit(gx, gE, 1)[1]),
           'sn': float(np.polyfit(gy, gN, 1)[0]), 'inn': float(np.polyfit(gy, gN, 1)[1]), 'ne': len(gx), 'nn': len(gy)},
          open(ra, 'w', encoding='utf-8'))
print('da ghi', ra)
