# -*- coding: utf-8 -*-
# ĐỐI CHIẾU quy hoạch theo thửa (bóc từ PDF — bảng qh_pdf) với ĐÁP ÁN của app tham chiếu, và DÒ ĐỘ DỊCH làm khớp nhất
# (14/10/2026 — chủ dự án gửi ảnh 10 thửa Nha Trang: web lệch "quá lệch", vd thửa 525 tờ 105 Nam Nha Trang app ghi 60 m² ODT,
# web ghi 48,7 m² đường). Cùng một bản đồ PDF của Sở nên lệch là do ĐẶT KHỚP (nắn), không phải do dữ liệu.
# Dùng: python -P doi_chieu_thua_pdf.py <ban> <dap_an.json> [--quet=30] [--buoc=1] [--dich=dx,dy]
#   dap_an.json: [{"xa": "phường Phước Long", "to": "4", "thua": "525", "loai": {"ODT": 60.0}}, …]
import sys, os, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from shapely.geometry import shape
from shapely.ops import transform as s_transform
from shapely.affinity import translate
import vn2000 as vn

co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
ban, dap_an_p = ts[0], ts[1]
QUET = float(next((a.split('=', 1)[1] for a in co if a.startswith('--quet=')), 30))
BUOC = float(next((a.split('=', 1)[1] for a in co if a.startswith('--buoc=')), 1))
DICH = next((tuple(map(float, a.split('=', 1)[1].split(','))) for a in co if a.startswith('--dich=')), None)
LX, LY = 0.000004899, 0.000001273                                # độ trượt lớp dia_chinh (qhCompute.ts LECH_DC_X/Y)
def psql(sql):
    return subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam', '-d', 'camlam_gis', '-tA', '-F', '|', '-c', sql],
                          capture_output=True, text=True, cwd=r'D:/Cam Lam gis', encoding='utf-8', stdin=subprocess.DEVNULL).stdout
def sang_vn(g, sx=0.0, sy=0.0): return s_transform(lambda x, y, z=None: vn.wgs84_to_vn2000(x - sx, y - sy), g)
# --nan-cu=se,ie,sn,inn --nan-moi=<file.nan.json>: vùng QH trong qh_pdf được bóc theo phép nắn CŨ (thẳng) → đổi sang phép nắn MỚI
# (vd "luoi" theo vạch lưới thật) mà không phải bóc lại: (E,N) cũ → điểm trang → (E,N) mới.
NAN_CU = next((list(map(float, a.split('=', 1)[1].split(','))) for a in co if a.startswith('--nan-cu=')), None)
NAN_MOI = next((json.load(open(a.split('=', 1)[1], encoding='utf-8')) for a in co if a.startswith('--nan-moi=')), None)
def _ns(v, a, b):
    a = np.asarray(a, float); b = np.asarray(b, float)
    if v <= a[0]: return b[0] + (v - a[0]) * (b[1] - b[0]) / (a[1] - a[0])
    if v >= a[-1]: return b[-1] + (v - a[-1]) * (b[-1] - b[-2]) / (a[-1] - a[-2])
    k = int(np.searchsorted(a, v, side='right') - 1)
    return b[k] + (v - a[k]) * (b[k + 1] - b[k]) / (a[k + 1] - a[k])
def doi_nan(g):
    if not (NAN_CU and NAN_MOI): return g
    se, ie, sn, inn = NAN_CU; L = NAN_MOI['luoi']
    return s_transform(lambda E, N, z=None: (_ns((E - ie) / se, L['x'], L['E']), _ns((N - inn) / sn, L['y'], L['N'])), g)

# --geojson=<file>: lấy vùng QH từ file (vd vùng đã đổi sang phép nắn mới, chưa nạp vào bảng qh_pdf) thay vì cơ sở dữ liệu
GJ = next((a.split('=', 1)[1] for a in co if a.startswith('--geojson=')), None)
VUNG_FILE = None
if GJ:
    from shapely.strtree import STRtree
    _fs = json.load(open(GJ, encoding='utf-8'))['features']
    _gs = [sang_vn(shape(f['geometry'])).buffer(0) for f in _fs]; _ma = [f['properties']['ma'] for f in _fs]
    VUNG_FILE = (STRtree(_gs), _gs, _ma)
dap = json.load(open(dap_an_p, encoding='utf-8'))
ca = []
for t in dap:
    out = psql(f"SELECT ST_AsGeoJSON(d.geom, 9) FROM dia_chinh d JOIN dia_chinh_xa x ON x.xa_id = d.xa_id "
               f"WHERE lower(x.ten) = lower('{t['xa']}') AND d.so_to = '{t['to']}' AND d.so_thua = '{t['thua']}' LIMIT 1").strip()
    if not out: print('KHONG THAY', t); continue
    thua = sang_vn(shape(json.loads(out)), LX, LY).buffer(0)
    lng0, lat0, lng1, lat1 = shape(json.loads(out)).bounds; d = 0.006 if NAN_MOI else 0.0015
    vung = []
    if VUNG_FILE:
        cay, gs, mas = VUNG_FILE
        for i in cay.query(thua.buffer(60)): vung.append((mas[int(i)], gs[int(i)]))
    else:
     for line in psql(f"SELECT ma, ST_AsGeoJSON(geom, 9) FROM qh_pdf WHERE ban = '{ban}' AND geom && "
                     f"ST_MakeEnvelope({lng0 - d},{lat0 - d},{lng1 + d},{lat1 + d},4326)").splitlines():
        if '|' not in line: continue
        ma, gj = line.split('|', 1); vung.append((ma, doi_nan(sang_vn(shape(json.loads(gj)))).buffer(0)))
    ca.append((t, thua, vung))
print(f'{len(ca)} thua doi chieu, ban {ban}')

def tinh(thua, vung, dx, dy):
    kq = {}
    for ma, g in vung:
        a = translate(g, dx, dy).intersection(thua).area
        if a > 0.01: kq[ma] = kq.get(ma, 0) + a
    tong = sum(kq.values())
    if tong > 0: kq = {k: v * thua.area / max(tong, thua.area) for k, v in kq.items()}   # như qhPdf.ts: không vượt diện tích thửa
    return kq
def sai(kq, ref, S):                                             # phần diện tích gán SAI loại (0..1)
    ma = set(kq) | set(ref)
    return sum(abs(kq.get(m, 0) - ref.get(m, 0) * S / sum(ref.values())) for m in ma) / 2 / S

def bao_cao(dx, dy, ghi=True):
    tong = []
    for t, thua, vung in ca:
        kq = tinh(thua, vung, dx, dy); e = sai(kq, t['loai'], thua.area); tong.append(e)
        if ghi:
            print(f"  {t['xa'][:18]:18s} T{t['to']}/{t['thua']:>4s} {thua.area:8.1f} m² | sai {100 * e:5.1f}% | web: "
                  + ', '.join(f'{k} {v:.1f}' for k, v in sorted(kq.items(), key=lambda kv: -kv[1])) + ' | app: '
                  + ', '.join(f'{k} {v}' for k, v in t['loai'].items()))
    return float(np.mean(tong))
print('--- KHONG DICH:'); e0 = bao_cao(0, 0)
print(f'  => sai trung binh {100 * e0:.1f}%')
if DICH:
    print(f'--- DICH {DICH}:'); e1 = bao_cao(*DICH); print(f'  => sai trung binh {100 * e1:.1f}%'); sys.exit()
tot = []
for dx in np.arange(-QUET, QUET + 1e-9, BUOC):
    for dy in np.arange(-QUET, QUET + 1e-9, BUOC):
        tot.append((bao_cao(dx, dy, False), dx, dy))
tot.sort()
print('--- 5 do dich tot nhat (dong, bac):', [(round(dx, 1), round(dy, 1), f'{100 * e:.1f}%') for e, dx, dy in tot[:5]])
print(f'--- DICH TOT NHAT {tot[0][1]:+.1f} m dong, {tot[0][2]:+.1f} m bac:'); e1 = bao_cao(tot[0][1], tot[0][2])
print(f'  => sai trung binh {100 * e1:.1f}%')
# từng thửa: độ dịch tốt nhất RIÊNG (để biết lệch đều hay lệch mỗi nơi một kiểu)
print('--- do dich tot nhat RIENG tung thua:')
for t, thua, vung in ca:
    r = min(((sai(tinh(thua, vung, dx, dy), t['loai'], thua.area), dx, dy) for dx in np.arange(-QUET, QUET + 1e-9, 2 * BUOC)
             for dy in np.arange(-QUET, QUET + 1e-9, 2 * BUOC)))
    print(f"  {t['xa'][:18]:18s} T{t['to']}/{t['thua']:>4s}: dich ({r[1]:+.0f}, {r[2]:+.0f}) m -> sai {100 * r[0]:.1f}%")
