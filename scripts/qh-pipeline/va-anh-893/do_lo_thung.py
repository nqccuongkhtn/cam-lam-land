# Dò CHỖ THỦNG của bộ ảnh QĐ893 (qd893v1): điểm ảnh TRONG SUỐT mà dữ liệu vùng QĐ893 (qh_zones_893.json) lại có đất.
# Quét ô mức Z (mặc định 15) khắp huyện; gom điểm ảnh thủng thành mảng liền, bỏ đường khe mảnh (< 3 điểm ảnh bề ngang — mép nối giữa hai vùng),
# in danh sách mảng (toạ độ, diện tích, loại đất) + ghi lo-thung.json để bước vá dùng. Không sửa ô ảnh nào.
import io, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from shapely.geometry import Polygon, box
from shapely.strtree import STRtree

GOC = r'D:\Cam Lam gis'
TILES = os.path.join(GOC, 'apps', 'frontend', 'public', 'tiles', 'qd893v1')
Z = int(sys.argv[1]) if len(sys.argv) > 1 else 15
ZONES = json.load(io.open(os.path.join(GOC, 'apps', 'backend', 'data', 'qh_zones_893.json'), encoding='utf-8'))
# thứ tự vẽ như 5b: bậc thấp trước, cùng bậc thì vùng to trước (vùng nhỏ nằm trên)
ZONES.sort(key=lambda e: (e[7], -e[6]))
POLY = [Polygon(e[4]) for e in ZONES]
TREE = STRtree([box(e[0], e[1], e[2], e[3]) for e in ZONES])

def lon2x(lng, z): return (lng + 180) / 360 * (2 ** z) * 256
def lat2y(lat, z):
    r = math.radians(lat); return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * (2 ** z) * 256
def x2lon(px, z): return px / ((2 ** z) * 256) * 360 - 180
def y2lat(py, z):
    n = math.pi - 2 * math.pi * py / ((2 ** z) * 256); return math.degrees(math.atan(math.sinh(n)))

def raster_vung(tx, ty, z):
    """Ảnh 256×256: chỉ số vùng (+1) phủ từng điểm ảnh, 0 = không vùng nào. Vẽ đúng thứ tự lớp."""
    w, s_, e, n = x2lon(tx * 256, z), y2lat(ty * 256 + 256, z), x2lon(tx * 256 + 256, z), y2lat(ty * 256, z)
    ids = sorted(int(i) for i in TREE.query(box(w, s_, e, n)))
    im = Image.new('I', (256, 256), 0); d = ImageDraw.Draw(im)
    for i in ids:
        pts = [(lon2x(x, z) - tx * 256, lat2y(y, z) - ty * 256) for x, y in ZONES[i][4]]
        if len(pts) >= 3: d.polygon(pts, fill=i + 1)
    return np.array(im, dtype=np.int64)

def main():
    W, S, E, N = 108.95, 11.95, 109.27, 12.25
    x0, x1 = int(lon2x(W, Z) // 256), int(lon2x(E, Z) // 256)
    y0, y1 = int(lat2y(N, Z) // 256), int(lat2y(S, Z) // 256)
    m2_px = (156543.03 * math.cos(math.radians(12.1)) / 2 ** Z) ** 2
    mang = []
    for tx in range(x0, x1 + 1):
        for ty in range(y0, y1 + 1):
            f = os.path.join(TILES, str(Z), str(tx), f'{ty}.png')
            if not os.path.isfile(f): continue
            a = np.array(Image.open(f).convert('RGBA'))[:, :, 3]
            v = raster_vung(tx, ty, Z)
            lo = (a < 8) & (v > 0)
            if not lo.any(): continue
            lo = ndimage.binary_opening(lo, structure=np.ones((3, 3)))   # bỏ khe mảnh 1–2 điểm ảnh (mép nối vùng)
            nhan, so = ndimage.label(lo)
            for k in range(1, so + 1):
                m = nhan == k; n = int(m.sum())
                if n < 6: continue
                ys, xs = np.nonzero(m)
                loai = np.bincount(v[m]).argmax() - 1
                cx, cy = xs.mean() + tx * 256, ys.mean() + ty * 256
                mang.append({'z': Z, 'tx': tx, 'ty': ty, 'lng': round(x2lon(cx, Z), 6), 'lat': round(y2lat(cy, Z), 6), 'm2': round(n * m2_px),
                             'loai': ZONES[loai][5], 'khung': [round(x2lon(xs.min() + tx * 256, Z), 6), round(y2lat(ys.max() + 1 + ty * 256, Z), 6),
                                                           round(x2lon(xs.max() + 1 + tx * 256, Z), 6), round(y2lat(ys.min() + ty * 256, Z), 6)]})
    mang.sort(key=lambda r: -r['m2'])
    io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lo-thung.json'), 'w', encoding='utf-8').write(json.dumps(mang, ensure_ascii=False, indent=1))
    print(f'muc {Z}: {len(mang)} mang thung, tong {sum(r["m2"] for r in mang):,} m2')
    for r in mang[:40]: print(f"  {r['m2']:>8,} m2  {r['lng']:.5f},{r['lat']:.5f}  {r['loai']}")

if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    main()
