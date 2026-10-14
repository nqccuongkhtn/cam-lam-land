# -*- coding: utf-8 -*-
# TẢI MỘT LỚP QUY HOẠCH DẠNG SỐ từ CỔNG GIS CHÍNH THỨC của tỉnh (gis.khanhhoa.gov.vn, mục "Tra cứu quy hoạch" — dịch vụ ArcGIS
# MapServer công khai, không đăng nhập) → GeoJSON toạ độ WGS84 + giữ nguyên thuộc tính (mã loại đất…). 14/10/2026 khuya.
# Vì sao: bản PDF in 1:25.000 dùng CHUNG MỘT MÀU cho 16 mã đất công cộng → bóc từ PDF chỉ ghi được "nhóm"; dịch vụ của tỉnh có sẵn
# vùng nét kèm MÃ LOẠI ĐẤT từng vùng (vd QHSDĐ Nha Trang: 14.952 vùng, 43 mã) — đúng dữ liệu gốc, không phải đoán màu.
# Hệ toạ độ dịch vụ: VN-2000 Khánh Hoà múi 3° (kinh tuyến trục 108°15', k = 0,9999) — y hệt vn2000.py → đổi sang WGS84 bằng vn2000_np.
# Tải NHẸ TAY: hỏi danh sách mã đối tượng một lần rồi lấy từng gói 500, nghỉ 1,5 giây giữa hai lần hỏi; gói đã tải cất lại ở thư mục
# tạm (chạy lại không hỏi lại). Không ghi gì lên máy chủ của tỉnh.
# Dùng: python -P tai_arcgis.py <url MapServer/số lớp> <ra.geojson> [--truong-ma=Ma_Loai] [--truong-ten=Info]
import sys, os, json, time, math, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
import vn2000_np

co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
URL, RA = ts[0].rstrip('/'), ts[1]
TRUONG_MA = next((a.split('=', 1)[1] for a in co if a.startswith('--truong-ma=')), 'Ma_Loai')
TRUONG_TEN = next((a.split('=', 1)[1] for a in co if a.startswith('--truong-ten=')), 'Info')
GOI = 500
KHO = RA + '.goi'                                    # gói đã tải (JSON gốc của máy chủ) — để chạy lại không phải hỏi lại
os.makedirs(KHO, exist_ok=True)

def hoi(params, ten_goi=None):
    if ten_goi and os.path.exists(os.path.join(KHO, ten_goi)):
        return json.load(open(os.path.join(KHO, ten_goi), encoding='utf-8'))
    q = urllib.parse.urlencode(params)
    for lan in range(5):
        try:
            req = urllib.request.Request(URL + '/query?' + q, headers={'User-Agent': 'Mozilla/5.0'})
            d = json.loads(urllib.request.urlopen(req, timeout=120).read().decode('utf-8'))
            if 'error' in d: raise RuntimeError(d['error'])
            if ten_goi: json.dump(d, open(os.path.join(KHO, ten_goi), 'w', encoding='utf-8'), ensure_ascii=False)
            time.sleep(1.5)
            return d
        except Exception as e:
            print(f'  hoi lai ({lan + 1}): {e}', flush=True); time.sleep(10 * (lan + 1))
    raise SystemExit('LOI: may chu khong tra loi')

thong_tin = json.loads(urllib.request.urlopen(urllib.request.Request(URL + '?f=json', headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read())
print('lop:', thong_tin.get('name'), thong_tin.get('geometryType'), '| truong:', [f['name'] for f in thong_tin.get('fields') or []])
ids = sorted(hoi({'where': '1=1', 'returnIdsOnly': 'true', 'f': 'json'}, 'ids.json')['objectIds'] or [])
print(f'{len(ids)} doi tuong, {math.ceil(len(ids) / GOI)} goi', flush=True)

def vong_sang_wgs(r):
    a = np.asarray(r, np.float64)[:, :2]
    lo, la = vn2000_np.vn2000_to_wgs84(a[:, 0], a[:, 1])
    return np.round(np.c_[lo, la], 9).tolist()
def dt_co_dau(r):                                    # diện tích có dấu (công thức dây giày) trên VN-2000 (y hướng bắc)
    a = np.asarray(r, np.float64); x, y = a[:, 0], a[:, 1]
    return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))

from shapely.geometry import Polygon, Point
feats, so_vong_le = [], 0
for i in range(0, len(ids), GOI):
    nhom = ids[i:i + GOI]
    # hỏi theo KHOẢNG mã (đường dẫn ngắn — liệt kê 500 mã thì cổng của tỉnh trả 404 vì địa chỉ quá dài)
    d = hoi({'where': f'OBJECTID>={nhom[0]} AND OBJECTID<={nhom[-1]}', 'outFields': '*', 'returnGeometry': 'true', 'f': 'json'},
            f'goi-{nhom[0]}-{nhom[-1]}.json')
    if len(d.get('features', [])) != len(nhom): print(f'  CANH BAO goi {nhom[0]}-{nhom[-1]}: {len(d.get("features", []))}/{len(nhom)} doi tuong', flush=True)
    for f in d.get('features', []):
        rings = (f.get('geometry') or {}).get('rings') or []
        # Esri: vòng NGOÀI đi theo chiều kim đồng hồ (diện tích có dấu < 0), vòng LỖ ngược chiều → gom lỗ vào vòng ngoài chứa nó
        ngoai = [r for r in rings if len(r) >= 4 and dt_co_dau(r) < 0]
        lo = [r for r in rings if len(r) >= 4 and dt_co_dau(r) > 0]
        nhom_vong = [[r] for r in ngoai]
        for h in lo:
            p = Point(h[0][0], h[0][1]); cho = None
            for g in nhom_vong:
                if Polygon(g[0]).contains(p): cho = g; break
            if cho is None: so_vong_le += 1; nhom_vong.append([h[::-1]])     # lỗ không nằm trong vòng ngoài nào → coi là vùng riêng
            else: cho.append(h)
        if not nhom_vong: continue
        toa = [[vong_sang_wgs(r) for r in g] for g in nhom_vong]
        at = f.get('attributes') or {}
        pr = {k: v for k, v in at.items() if not k.startswith('Shape')}
        pr['ma'] = str(at.get(TRUONG_MA) or '').strip(); pr['ten'] = str(at.get(TRUONG_TEN) or '').strip()
        pr['dt_vn2000'] = round(sum(abs(dt_co_dau(g[0])) - sum(abs(dt_co_dau(h)) for h in g[1:]) for g in nhom_vong), 2)
        feats.append({'type': 'Feature', 'properties': pr,
                      'geometry': {'type': 'MultiPolygon', 'coordinates': toa} if len(toa) > 1 else {'type': 'Polygon', 'coordinates': toa[0]}})
    print(f'  ... {min(i + GOI, len(ids))}/{len(ids)}', flush=True)
json.dump({'type': 'FeatureCollection', 'properties': {'nguon': URL, 'tai_luc': time.strftime('%d/%m/%Y %H:%M')}, 'features': feats},
          open(RA, 'w', encoding='utf-8'), ensure_ascii=False)
tong = sum(f['properties']['dt_vn2000'] for f in feats)
print(f'XONG {len(feats)} vung, {tong / 1e4:.1f} ha, {so_vong_le} vong le -> {RA}')
