# -*- coding: utf-8 -*-
# KIỂM TRÊN WEB THẬT (14/10/2026): gọi /api/parcels/at cho các thửa trong file đáp án (dap-an/*.json) — xem web đang trả quy hoạch theo
# thửa từ bản PDF thế nào, so với app tham chiếu. Không ghi gì vào web (chỉ đọc).
# Dùng: python -P kiem_web_thua.py <dap_an.json> [http://localhost]
import sys, json, subprocess, urllib.request
sys.stdout.reconfigure(encoding='utf-8')
dap = json.load(open(sys.argv[1], encoding='utf-8'))
GOC = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost'
def psql(sql):
    return subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam', '-d', 'camlam_gis', '-tA', '-F', '|', '-c', sql],
                          capture_output=True, text=True, cwd=r'D:/Cam Lam gis', encoding='utf-8', stdin=subprocess.DEVNULL).stdout
tong = []
for t in dap:
    r = psql(f"SELECT ST_X(c), ST_Y(c), ST_Area(d.geom::geography) FROM (SELECT d.geom, ST_PointOnSurface(d.geom) c FROM dia_chinh d JOIN dia_chinh_xa x ON "
             f"x.xa_id = d.xa_id WHERE lower(x.ten) = lower('{t['xa']}') AND d.so_to = '{t['to']}' AND d.so_thua = '{t['thua']}' LIMIT 1) d").strip()
    if not r: print('KHONG THAY', t['xa'], t['to'], t['thua']); continue
    x, y, dt = map(float, r.split('|'))
    d = json.load(urllib.request.urlopen(f'{GOC}/api/parcels/at?lng={x}&lat={y}', timeout=60))
    ban = [b for b in (d.get('qhCacBan') or []) if str(b.get('ma', '')).startswith('pdf-')]
    areas = {}
    for b in ban:
        for a in b.get('areas') or []: areas[a['type']] = areas.get(a['type'], 0) + a['areaM2']
    S = sum(areas.values()) or 1
    print(f"Thửa {t['thua']} · Tờ {t['to']} {t['xa']}: web {', '.join(f'{k} {v:.1f}' for k, v in sorted(areas.items(), key=lambda kv: -kv[1]))}"
          f" | app {', '.join(f'{k} {v}' for k, v in t['loai'].items())} | ban {[b.get('ma') for b in ban]}")
