# -*- coding: utf-8 -*-
# KIỂM nan2.py: vị trí NHÃN toạ độ (cái nan2 dùng để khớp) lệch bao nhiêu so với VẠCH LƯỚI THẬT trên bản đồ — 14/10/2026.
# Bẫy đã vấp: Nha Trang ghi nhãn "595" (km) ở trên-trái và "000" ở dưới-phải, đường lưới đi GIỮA hai chữ; nan2 lấy tâm chữ "595"
# → lệch 6,5 điểm in ≈ 57 m đông (cạnh trái ~44 m bắc) → mọi thửa Nha Trang tính quy hoạch sai (chủ dự án so app tham chiếu).
# Dùng: python -P kiem_luoi_nhan.py <ban_do.pdf> <tam_lng> <tam_lat>
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, pymupdf
import nan2, vn2000 as vn

pdf, lng, lat = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
pg = pymupdf.open(pdf)[0]
E0, N0 = vn.wgs84_to_vn2000(lng, lat)
toks = nan2.cac_token(pg)
luoi = nan2.vach_luoi(pg)
for ngang in (True, False):
    tam = E0 if ngang else N0
    dung = []
    for line in nan2.gom_duong(toks, ngang):
        if len(line) < 6: continue
        pts = nan2.phuc_hoi_gia_tri(line, ngang, tam / 1000.0)
        if len(pts) < 6: continue
        f = nan2.khop_ben_vung(pts)
        if not f or f[2] < 0.995: continue
        dung += pts
    if not dung: print('truc', 'E' if ngang else 'N', ': khong co nhan'); continue
    gl = luoi[0] if ngang else luoi[1]                         # x vạch dọc (cho nhãn E) / y vạch ngang (cho nhãn N)
    lech = []
    for p, v in dung:
        if len(gl) == 0: break
        g = gl[np.argmin(np.abs(gl - p))]
        if abs(g - p) < 15: lech.append(g - p)
    f = nan2.khop_ben_vung(dung); m_pt = abs(f[0])
    if lech:
        print(f"truc {'E' if ngang else 'N'}: {len(dung)} nhan, {len(gl)} vach luoi; vach - nhan = trung vi {np.median(lech):+.2f} diem in "
              f"(~{np.median(lech) * m_pt:+.0f} m), {len(lech)} nhan co vach gan")
    else: print(f"truc {'E' if ngang else 'N'}: {len(dung)} nhan, KHONG thay vach luoi gan nhan")
