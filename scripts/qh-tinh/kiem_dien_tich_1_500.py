# -*- coding: utf-8 -*-
# KIỂM HÌNH LÔ 1/500 BẰNG SỐ GHI TRÊN NHÃN BẢN VẼ (15/10/2026) — chỉ ĐỌC, không sửa gì.
# Mỗi lô bản vẽ 1/500 có vòng tròn ghi mã lô + diện tích (vd "NOX146 · 11.808,07"). So với diện tích hình lô to_mau_1_500.py lấy từ
# vùng tô (cung tròn đúng công thức, đổi WGS84 → mặt phẳng VN-2000). Lô lớn bị hẻm chia thành nhiều vùng tô → thử tổ hợp 1–3 mảnh gần nhãn.
# Kết quả 15/10/2026: ~868/897 lô khớp ≤ 0,05 m² (hoặc ≤ 0,05 % với bản ghi số nguyên — Cam Hải Tây), lệch trung vị 0,003 m²; còn lại
# phần lớn là ghép nhầm nhãn (số tầng cao) + vài lô bản vẽ tự lệch (NOX-147 Cam Đức +38 m², ODTH-07 Cam Hiệp Bắc, SO-04 Cam Tân).
# Dùng: python -X utf8 kiem_dien_tich_1_500.py [qh500-mau.json=D:/KhoQH/qh-rieng/tung-ban/qh500-mau.json]
import sys, os, json, re, ezdxf, math, collections, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.stdout.reconfigure(encoding='utf-8')
import vn2000 as vn
from shapely.geometry import shape, Point
from shapely.ops import transform
from shapely.strtree import STRtree
d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'D:/KhoQH/qh-rieng/tung-ban/qh500-mau.json', encoding='utf-8'))
BAN = [('gdqd', 'CamThanhBacGDQD.QH03-SDD.dxf'), ('camduc', 'CamDuc160.QH-03.SDD QUY HOACH.dxf'), ('camhiepbac', 'CamHiepBac.QH03 SDD CBC.dxf'),
       ('camtan', 'CamTanQH04- SDDQH.dxf'), ('camhoa', 'CamHoa.QH-03-QH.SDD-FIT.dxf'), ('camhaitay', 'CamHaiTay.CamHoaQH04-SDDQH.dxf')]
MA = re.compile(r'^\s*([A-ZĐ]{1,6})[-\s]?(\d{1,3}[A-Z]?)\s*$')
SO = re.compile(r'^\s*(\d{1,3}(?:\.\d{3})+,\d{1,2}|\d+,\d{1,2}|\d+\.\d{1,2}|\d{1,3}(?:\.\d{3})+)\s*$')   # 1.234,56 · 1234,56 · 1234.56 · 16.858 (số nguyên)
vnp = lambda g: transform(lambda x, y, z=None: vn.wgs84_to_vn2000(x, y), g)
tong_kq = []
for ma, tep in BAN:
    lo = [(vnp(shape(v['g'])), v) for v in d['vung'] if v['ban'] == ma]
    cay = STRtree([g for g, _ in lo])
    doc = ezdxf.readfile('D:/Cam Lam gis/quyhoach2025/1.500/' + tep)
    nhan, so = [], []
    def chu(e):
        t = e.dxftype()
        return e.plain_text() if t == 'MTEXT' else (e.dxf.text if t in ('TEXT', 'ATTRIB') else None)
    for e in doc.modelspace():
        t = e.dxftype()
        ds = [e] if t in ('MTEXT', 'TEXT') else (list(getattr(e, 'attribs', [])) if t == 'INSERT' else [])
        for a in ds:
            s = chu(a) or ''
            ins = a.dxf.insert
            if MA.match(s): nhan.append((MA.match(s).group(1) + '-' + MA.match(s).group(2), ins[0], ins[1]))
            elif SO.match(s):
                t_ = SO.match(s).group(1)
                v_ = float(t_.replace('.', '').replace(',', '.')) if (',' in t_ or re.fullmatch(r'\d{1,3}(?:\.\d{3})+', t_)) else float(t_)
                so.append((v_, ins[0], ins[1]))
    kq = []
    for code, x, y in nhan:
        # số diện tích = số có dạng "1.234,56" GẦN nhất phía DƯỚI mã lô (trong vòng tròn), cách ≤ 6 m
        ung = [(math.hypot(sx - x, sy - y), v) for v, sx, sy in so if sy < y and math.hypot(sx - x, sy - y) < 10]
        if not ung: continue
        ghi = min(ung)[1]
        p = Point(x, y)
        cand = sorted(((lo[i][0].distance(p), i) for i in cay.query(p.buffer(150)) if lo[i][1]['loai'] != 'giao_thong'), key=lambda t: t[0])[:8]
        # lô = 1 đến 3 vùng tô (lô lớn bị hẻm chia) — chọn tổ hợp có tổng sát số ghi nhất, có ít nhất 1 mảnh cách nhãn < 25 m
        tot = None
        for k_ in (1, 2, 3):
            for to in itertools.combinations(cand, k_):
                if min(t[0] for t in to) > 25: continue
                dt = sum(lo[i][0].area for _, i in to)
                if tot is None or abs(dt - ghi) < tot[0]: tot = (abs(dt - ghi), dt, lo[to[0][1]][1]['loai'], k_)
        if not tot: continue
        kq.append((ma, code, ghi, tot[1], tot[2] + ('' if tot[3] == 1 else f' ({tot[3]} mảnh)')))
    lech = [abs(a - b) for _, _, b, a, _ in kq]
    khop = sum(1 for l, (_, _, b, _, _) in zip(lech, kq) if l <= max(0.05, 0.0005 * b))
    print(f'{ma}: {len(kq)} lô so được · khớp ≤ 0,05 m² (hoặc ≤ 0,05 %): {khop} · lệch trung vị {sorted(lech)[len(lech)//2] if lech else 0:.3f} m²')
    for (m_, code, ghi, dt, loai), l in sorted(zip(kq, lech), key=lambda t: -t[1])[:4]:
        print(f'    {code}: bản vẽ ghi {ghi:,.2f} · hình lô {dt:,.2f} m² ({loai})')
    tong_kq += kq
