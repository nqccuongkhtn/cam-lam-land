# VÁ CHỖ THỦNG bộ ảnh QĐ893 (qd893v1) — 15/10/2026, chủ dự án: "893 vẫn có vài chỗ lổm chổm".
# Chỗ thủng = vùng tô của bản vẽ gốc bị hỏng viền / lẫn vòng hỏng nên bộ ảnh cũ (cắt từ dữ liệu GDAL) thiếu — phần TÍNH đã bổ sung 11/10 (5f),
# ảnh thì chưa. Vá: trong khung mỗi chỗ thủng (lo-thung.json, dò ở mức 15, nới 25 m), ở MỌI mức 8–18: điểm ảnh nào nằm trong vùng tô của
# BẢN VẼ GỐC (quyhoach2025/qd893_qh_chanle.geojson — màu tô thật 'c') thì đặt ảnh cũ ĐÈ LÊN màu tô đó (điểm trong suốt → màu tô, điểm đã có
# màu / nét giữ nguyên). Ô nào đổi thì SAO LƯU bản cũ trước (D:\KhoQH\sao-luu\qd893v1-truoc-va-thung-15-10\), ghi tệp tạm rồi đổi tên.
# Chạy: python va_lo_thung.py [--thu]   (--thu = chỉ đếm, không ghi gì)
import io, json, math, os, sys, shutil
import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import shape, box, Polygon, MultiPolygon
from shapely.strtree import STRtree

GOC = r'D:\Cam Lam gis'
TILES = os.path.join(GOC, 'apps', 'frontend', 'public', 'tiles', 'qd893v1')
SAO_LUU = r'D:\KhoQH\sao-luu\qd893v1-truoc-va-thung-15-10'
HERE = os.path.dirname(os.path.abspath(__file__))
THU = '--thu' in sys.argv
NOI_M = 25.0

def lon2x(lng, z): return (lng + 180) / 360 * (2 ** z) * 256
def lat2y(lat, z):
    r = math.radians(lat); return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * (2 ** z) * 256
def x2lon(px, z): return px / ((2 ** z) * 256) * 360 - 180
def y2lat(py, z):
    n = math.pi - 2 * math.pi * py / ((2 ** z) * 256); return math.degrees(math.atan(math.sinh(n)))

# vùng tô gốc (màu thật) — vẽ vùng TO trước, vùng nhỏ sau (vùng nhỏ nằm trên, như bản vẽ hiển thị)
VT = []
for f in json.load(io.open(os.path.join(GOC, 'quyhoach2025', 'qd893_qh_chanle.geojson'), encoding='utf-8'))['features']:
    c = (f['properties'].get('c') or '').lower()
    if len(c) != 7 or not c.startswith('#'): continue
    g = shape(f['geometry'])
    if g.is_empty: continue
    VT.append((g.area, g, tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))))
VT.sort(key=lambda t: -t[0])
TREE = STRtree([t[1] for t in VT])

LO = json.load(io.open(os.path.join(HERE, 'lo-thung.json'), encoding='utf-8'))
dlng = NOI_M / (111320 * math.cos(math.radians(12.1))); dlat = NOI_M / 110570
KHUNG = [box(r['khung'][0] - dlng, r['khung'][1] - dlat, r['khung'][2] + dlng, r['khung'][3] + dlat) for r in LO]

def ve_vung(tx, ty, z):
    """(ảnh màu RGB, mặt nạ có vùng tô) của ô — vẽ đúng thứ tự lớp."""
    w, s_, e, n = x2lon(tx * 256, z), y2lat(ty * 256 + 256, z), x2lon(tx * 256 + 256, z), y2lat(ty * 256, z)
    ids = sorted(int(i) for i in TREE.query(box(w, s_, e, n)))
    mau = Image.new('RGB', (256, 256), (0, 0, 0)); mn = Image.new('L', (256, 256), 0)
    dm, dn = ImageDraw.Draw(mau), ImageDraw.Draw(mn)
    for i in ids:   # ids đã theo thứ tự diện tích giảm dần (VT đã sắp)
        g, c = VT[i][1], VT[i][2]
        for p in (g.geoms if isinstance(g, MultiPolygon) else [g]):
            vong_ngoai = [(lon2x(x, z) - tx * 256, lat2y(y, z) - ty * 256) for x, y in p.exterior.coords]
            if len(vong_ngoai) < 3: continue
            # vẽ vòng ngoài màu tô, rồi khoét lỗ: lỗ để lại cho vùng khác (nhỏ hơn, vẽ sau) tô — đúng như chẵn–lẻ
            dm.polygon(vong_ngoai, fill=c); dn.polygon(vong_ngoai, fill=255)
            for lo in p.interiors:
                pts = [(lon2x(x, z) - tx * 256, lat2y(y, z) - ty * 256) for x, y in lo.coords]
                if len(pts) >= 3: dm.polygon(pts, fill=(0, 0, 0)); dn.polygon(pts, fill=0)
    return np.array(mau, dtype=np.float32), np.array(mn) > 0

def mat_na_khung(tx, ty, z):
    im = Image.new('L', (256, 256), 0); d = ImageDraw.Draw(im)
    w, s_, e, n = x2lon(tx * 256, z), y2lat(ty * 256 + 256, z), x2lon(tx * 256 + 256, z), y2lat(ty * 256, z)
    o = box(w, s_, e, n)
    for k in KHUNG:
        if not k.intersects(o): continue
        x0, y0, x1, y1 = k.bounds
        d.rectangle([lon2x(x0, z) - tx * 256, lat2y(y1, z) - ty * 256, lon2x(x1, z) - tx * 256, lat2y(y0, z) - ty * 256], fill=255)
    return np.array(im) > 0

def main():
    tong_o = tong_diem = 0
    for z in range(8, 19):
        o_z = set()
        for k in KHUNG:
            x0, y0, x1, y1 = k.bounds
            for tx in range(int(lon2x(x0, z) // 256), int(lon2x(x1, z) // 256) + 1):
                for ty in range(int(lat2y(y1, z) // 256), int(lat2y(y0, z) // 256) + 1):
                    o_z.add((tx, ty))
        doi_z = diem_z = 0
        for tx, ty in sorted(o_z):
            f = os.path.join(TILES, str(z), str(tx), f'{ty}.png')
            if not os.path.isfile(f): continue      # ô không có (ngoài vùng vẽ) — không tự sinh ô mới
            cu = np.array(Image.open(f).convert('RGBA')).astype(np.float32)
            a = cu[:, :, 3:4] / 255.0
            mau, co = ve_vung(tx, ty, z)
            vung = co & mat_na_khung(tx, ty, z) & (cu[:, :, 3] < 250)
            if not vung.any(): continue
            moi = cu.copy()
            pha = cu[:, :, :3] * a + mau * (1 - a)               # ảnh cũ đè lên màu tô gốc
            moi[:, :, :3][vung] = pha[vung]; moi[:, :, 3][vung] = 255
            n = int(vung.sum()); diem_z += n; doi_z += 1
            if THU: continue
            ra = os.path.join(SAO_LUU, str(z), str(tx), f'{ty}.png')
            if not os.path.isfile(ra):
                os.makedirs(os.path.dirname(ra), exist_ok=True); shutil.copy2(f, ra)
            tam = f + '.tam.png'
            Image.fromarray(np.clip(moi + 0.5, 0, 255).astype(np.uint8), 'RGBA').save(tam, optimize=True)
            os.replace(tam, f)
        print(f'muc {z}: {doi_z} o {"se doi" if THU else "da doi"}, {diem_z:,} diem anh duoc to'); tong_o += doi_z; tong_diem += diem_z
    print(f'TONG: {tong_o} o, {tong_diem:,} diem anh' + (' (CHI DEM — chua ghi)' if THU else f' — sao luu o {SAO_LUU}'))

if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    main()
