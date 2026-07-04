# Lọc ranh giới xã sạch (WGS84) từ ranh-raw.geojson → ranh-xa.geojson
import json
from collections import Counter
RAW = r"D:\Cam Lam gis\apps\frontend\public\ranh-raw.geojson"
OUT = r"D:\Cam Lam gis\apps\frontend\public\ranh-xa.geojson"
raw = json.loads(open(RAW, encoding="latin-1").read())
fs = raw["features"]

def coords_xy(geom):
    xs = []; ys = []
    def walk(c):
        if isinstance(c, (list, tuple)):
            if c and isinstance(c[0], (int, float)):
                xs.append(c[0]); ys.append(c[1])
            else:
                for x in c:
                    walk(x)
    walk(geom.get("coordinates"))
    return xs, ys

lines = []
for f in fs:
    g = f.get("geometry") or {}
    if g.get("type") in ("LineString", "MultiLineString"):
        xs, ys = coords_xy(g)
        if not xs:
            continue
        span = max(max(xs) - min(xs), max(ys) - min(ys))
        if span > 0.004:  # bỏ các đoạn mẫu trong CHÚ THÍCH (rất ngắn)
            lines.append({
                "type": "Feature",
                "properties": {"color": f["properties"].get("ColorIndex"), "level": f["properties"].get("Level")},
                "geometry": g,
            })

out = {"type": "FeatureCollection", "features": lines}
open(OUT, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False))
print("KEPT_LINES", len(lines))
print("BY_COLOR", dict(Counter(l["properties"]["color"] for l in lines)))
allx = []; ally = []
for l in lines:
    xs, ys = coords_xy(l["geometry"])
    allx += xs; ally += ys
print("BBOX", round(min(allx), 5), round(min(ally), 5), round(max(allx), 5), round(max(ally), 5))
