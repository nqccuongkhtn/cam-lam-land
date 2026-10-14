# -*- coding: utf-8 -*-
# ĐO ĐỘ LỆCH CỤC BỘ của bản đồ QHSDĐ (bóc từ PDF, bảng qh_pdf) so với BẢN ĐỒ ĐỊA CHÍNH — 14/10/2026.
# Chủ dự án so 10 thửa Nha Trang với app tham chiếu (cùng bản đồ PDF của Sở): web sai trung bình 72,7 % diện tích — bản đồ in
# 1:25.000–27.000 đặt theo lưới km khớp R²=1 nhưng NỘI DUNG bản vẽ lệch so với thửa thật từ vài chục tới cả trăm mét, mỗi nơi một kiểu.
# Cách đo: ở mỗi ô cửa sổ (mặc định 800 m, cách nhau 500 m) trượt MẶT NẠ ĐƯỜNG GIAO THÔNG của bản đồ QH (vùng mã DGT) trên mặt nạ
# THỬA ĐƯỜNG của địa chính (mdsd DGT, đã trừ độ trượt LECH_DC) — chỗ trùng nhiều nhất (tương quan chuẩn hoá) là độ lệch của ô đó.
# Ra: <ra.json> {"o": [[E, N, dE, dN, tin_cay], …]} (dE/dN = phải DỊCH bản đồ QH bao nhiêu mét để khớp địa chính) + ảnh mũi tên.
# Dùng: python -P do_lech_dgt.py <ban> <ten_huyen_trong_dia_chinh_xa> <ra.json> [--cua=800] [--buoc=500] [--quet=150] [--m=2]
import sys, os, json, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, cv2
import vn2000 as vn

co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
ban, huyen, ra = ts[0], ts[1], ts[2]
def tuy(k, mac): return float(next((a.split('=', 1)[1] for a in co if a.startswith('--' + k + '=')), mac))
CUA, BUOC, QUET, M = tuy('cua', 800), tuy('buoc', 500), tuy('quet', 150), tuy('m', 2)
LX, LY = 0.000004899, 0.000001273
t0 = time.time()
def psql(sql):
    return subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam', '-d', 'camlam_gis', '-tA', '-c', sql],
                          capture_output=True, text=True, cwd=r'D:/Cam Lam gis', encoding='utf-8', stdin=subprocess.DEVNULL).stdout
def vong_vn(gj, sx=0.0, sy=0.0):
    g = json.loads(gj); ds = []
    for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
        ds.append([np.array([vn.wgs84_to_vn2000(a - sx, b - sy) for a, b in r]) for r in poly])
    return ds
# vùng đường của bản đồ QH (đơn giản hoá 0,5 m cho nhẹ) + thửa đường địa chính trong ranh bản đồ
qh = [vong_vn(l) for l in psql(f"SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.000005), 8) FROM qh_pdf WHERE ban = '{ban}' AND ma = 'DGT'").splitlines() if l.strip()]
dc = [vong_vn(l, LX, LY) for l in psql(
    f"SELECT ST_AsGeoJSON(d.geom, 8) FROM dia_chinh d JOIN dia_chinh_xa x ON x.xa_id = d.xa_id, qh_pdf_ranh r "
    f"WHERE r.ban = '{ban}' AND x.huyen ILIKE '%{huyen}%' AND d.mdsd = 'DGT' AND d.geom && r.geom").splitlines() if l.strip()]
print(f'{len(qh)} vung duong QH, {len(dc)} thua duong dia chinh ({time.time() - t0:.0f}s)')
allv = np.vstack([r for p in qh for poly in p for r in poly])
E0, N0 = allv.min(0) - QUET - 50; E1, N1 = allv.max(0) + QUET + 50
W, H = int((E1 - E0) / M) + 1, int((N1 - N0) / M) + 1
def ve(ds):
    im = np.zeros((H, W), np.uint8)
    for p in ds:
        for poly in p:
            vs = [np.c_[(r[:, 0] - E0) / M, (N1 - r[:, 1]) / M].astype(np.int32) for r in poly]
            cv2.fillPoly(im, vs[:1], 255)
            if len(vs) > 1: cv2.fillPoly(im, vs[1:], 0)
    return im
A, B = ve(qh), ve(dc)
print(f'mat na {W}x{H} diem anh ({M} m), duong QH {100 * (A > 0).mean():.1f}%, duong dia chinh {100 * (B > 0).mean():.1f}%')
A = cv2.GaussianBlur(A.astype(np.float32), (0, 0), 1.0); B = cv2.GaussianBlur(B.astype(np.float32), (0, 0), 1.0)
c, q, s = int(CUA / M), int(QUET / M), int(BUOC / M)
o = []
for y in range(q, H - c - q, s):
    for x in range(q, W - c - q, s):
        t = A[y:y + c, x:x + c]
        if (t > 128).mean() < 0.03: continue                       # ô gần như không có đường QH → bỏ
        img = B[y - q:y + c + q, x - q:x + c + q]
        if (img > 128).mean() < 0.02: continue
        r = cv2.matchTemplate(img, t, cv2.TM_CCOEFF_NORMED)
        _, vmax, _, (bx, by) = cv2.minMaxLoc(r)
        v0 = float(r[q, q])                                        # không dịch
        # độ tin cậy: đỉnh cao + nổi hẳn so với nền (trừ vùng sát đỉnh)
        rr = r.copy(); cv2.circle(rr, (bx, by), max(3, int(12 / M)), -1, -1); v2 = float(rr.max())
        dE, dN = (bx - q) * M, -(by - q) * M                       # dịch QH (đông, bắc) để khớp địa chính
        Ec, Nc = E0 + (x + c / 2) * M, N1 - (y + c / 2) * M
        o.append([round(Ec, 1), round(Nc, 1), round(dE, 1), round(dN, 1), round(vmax, 3), round(vmax - v2, 3), round(v0, 3)])
print(f'{len(o)} o do duoc ({time.time() - t0:.0f}s)')
json.dump({'ban': ban, 'cua_m': CUA, 'quet_m': QUET, 'o': o, 'cot': ['E', 'N', 'dE', 'dN', 'tuong_quan', 'noi_bat', 'tuong_quan_khong_dich']},
          open(ra, 'w', encoding='utf-8'))
O = np.array(o)
if len(O):
    tot = O[(O[:, 4] > 0.3) & (O[:, 5] > 0.05)]
    print(f'o tin cay: {len(tot)}/{len(O)}; do lech trung vi dong {np.median(tot[:, 2]):+.1f} m, bac {np.median(tot[:, 3]):+.1f} m; '
          f'do lon trung vi {np.median(np.hypot(tot[:, 2], tot[:, 3])):.1f} m, lon nhat {np.hypot(tot[:, 2], tot[:, 3]).max():.1f} m')
    # ảnh mũi tên (độ lệch phóng ×5) trên nền mặt nạ đường
    k = 1600 / max(W, H); bg = cv2.resize(np.dstack([(A > 128) * 160, (B > 128) * 160, np.zeros_like(A)]).astype(np.uint8), (int(W * k), int(H * k)))
    for E, N, dE, dN, v, nb, v0 in O:
        p = (int((E - E0) / M * k), int((N1 - N) / M * k)); mau = (255, 255, 255) if (v > 0.3 and nb > 0.05) else (90, 90, 90)
        cv2.arrowedLine(bg, p, (int(p[0] + dE / M * k * 5), int(p[1] - dN / M * k * 5)), mau, 2, tipLength=0.25)
    cv2.imwrite(ra.replace('.json', '.png'), bg); print('anh', ra.replace('.json', '.png'))
