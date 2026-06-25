#!/usr/bin/env python3
"""Generate realistic synthetic GIS data for Cam Lâm district, Khánh Hòa (EPSG:4326).
Coastline runs along the east; National Highway 1A runs N-S inland; Cam Đức is the
administrative centre. Output: admin_boundaries / zoning / land_parcels / roads GeoJSON."""
import json, math, random
random.seed(42)
CENTER = (109.0917, 12.0771)  # lng, lat — Cam Lâm district centre (Cam Đức)
M_PER_DEG_LAT = 111320.0

def area_m2(ring):
    # planar approximation good enough for small parcels at this latitude
    lats = [p[1] for p in ring]
    lat0 = sum(lats) / len(lats)
    mlng = M_PER_DEG_LAT * math.cos(math.radians(lat0))
    pts = [(p[0] * mlng, p[1] * M_PER_DEG_LAT) for p in ring]
    s = 0.0
    for i in range(len(pts) - 1):
        s += pts[i][0] * pts[i+1][1] - pts[i+1][0] * pts[i][1]
    return round(abs(s) / 2.0, 1)

def fc(features):
    return {"type": "FeatureCollection",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
            "features": features}

def poly(coords, props):
    ring = coords + [coords[0]]
    props = dict(props)
    props.setdefault("area_m2", area_m2(ring))
    return {"type": "Feature", "properties": props, "geometry": {"type": "Polygon", "coordinates": [ring]}}

def line(coords, props):
    return {"type": "Feature", "properties": props, "geometry": {"type": "LineString", "coordinates": coords}}

# ── 1. Administrative boundaries (district + 4 representative wards) ──────────
district = poly([
    [108.985,12.205],[109.060,12.215],[109.150,12.190],[109.215,12.120],
    [109.225,12.045],[109.180,11.985],[109.090,11.970],[109.010,12.010],
    [108.975,12.090],[108.980,12.160]
], {"name":"Huyện Cam Lâm","name_en":"Cam Lam District","admin_level":"district","province":"Khánh Hòa"})

wards = [
    ("Thị trấn Cam Đức","town",   [[109.075,12.090],[109.110,12.092],[109.112,12.062],[109.078,12.060]]),
    ("Xã Cam Hải Đông","commune", [[109.160,12.085],[109.210,12.070],[109.205,12.020],[109.158,12.030]]),
    ("Xã Cam Hải Tây","commune",  [[109.110,12.115],[109.150,12.112],[109.150,12.078],[109.112,12.080]]),
    ("Xã Cam Thành Bắc","commune",[[109.050,12.130],[109.085,12.128],[109.086,12.095],[109.052,12.097]]),
]
admin_features = [district] + [
    poly(c, {"name":n,"admin_level":"ward","commune_type":t,"province":"Khánh Hòa","district":"Cam Lâm"})
    for (n,t,c) in wards
]

# ── 2. Planning / zoning layer (large land-use zones) ────────────────────────
zones = [
    ("Khu dân cư đô thị Cam Đức","residential","Đất ở đô thị","#e57373",
     [[109.070,12.092],[109.115,12.094],[109.118,12.058],[109.072,12.056]]),
    ("Vùng nông nghiệp Cam Hải Tây","agricultural","Đất nông nghiệp","#81c784",
     [[109.105,12.150],[109.165,12.145],[109.168,12.088],[109.108,12.090]]),
    ("Khu du lịch ven biển Bãi Dài","tourism","Đất thương mại - dịch vụ du lịch","#64b5f6",
     [[109.165,12.090],[109.212,12.072],[109.206,12.012],[109.160,12.028]]),
    ("Đất rừng phòng hộ phía Tây","forest","Đất rừng phòng hộ","#388e3c",
     [[108.990,12.160],[109.045,12.158],[109.048,12.060],[108.992,12.062]]),
]
zoning_features = [
    poly(c, {"zone_name":n,"zoning":z,"zoning_vi":vi,"color":col,"plan_year":2030})
    for (n,z,vi,col,c) in zones
]

# ── 3. Cadastral land parcels (grids inside each developable zone) ───────────
def grid(origin, cols, rows, cw, ch, base_props, jitter=0.00012, start=1):
    out=[]; ox,oy=origin; n=start
    for r in range(rows):
        for c in range(cols):
            x=ox+c*cw; y=oy+r*ch
            j=lambda: random.uniform(-jitter,jitter)
            ring=[[x+j(),y+j()],[x+cw*0.92+j(),y+j()],
                  [x+cw*0.92+j(),y+ch*0.92+j()],[x+j(),y+ch*0.92+j()]]
            p=dict(base_props); p["parcel_id"]=f'{base_props["prefix"]}-{n:03d}'; p.pop("prefix")
            out.append(poly(ring,p)); n+=1
    return out

parcels=[]
parcels+=grid((109.074,12.060),6,5,0.0050,0.0050,
    {"prefix":"CD","land_use":"residential","land_use_vi":"Đất ở","zoning":"residential","ward":"Cam Đức"})
parcels+=grid((109.112,12.092),5,5,0.0090,0.0090,
    {"prefix":"NN","land_use":"agricultural","land_use_vi":"Đất trồng cây lâu năm","zoning":"agricultural","ward":"Cam Hải Tây"})
parcels+=grid((109.168,12.034),4,5,0.0085,0.0085,
    {"prefix":"DL","land_use":"tourism","land_use_vi":"Đất dịch vụ du lịch","zoning":"tourism","ward":"Cam Hải Đông"})
for i,f in enumerate(parcels):
    f["properties"]["owner_status"]=random.choice(["Đã cấp sổ","Chưa cấp sổ","Quy hoạch"])

# ── 4. Road network ──────────────────────────────────────────────────────────
roads=[
    line([[109.102,12.180],[109.100,12.120],[109.099,12.085],[109.100,12.040],[109.103,11.990]],
         {"name":"Quốc lộ 1A","ref":"QL.1A","road_type":"primary","lanes":4}),
    line([[109.205,12.085],[109.200,12.055],[109.192,12.030],[109.185,12.005]],
         {"name":"Đường ven biển Bãi Dài","ref":"ĐT.657G","road_type":"secondary","lanes":2}),
    line([[109.100,12.076],[109.130,12.072],[109.165,12.066],[109.196,12.058]],
         {"name":"Đường liên xã Cam Đức - Cam Hải","ref":None,"road_type":"tertiary","lanes":2}),
    line([[109.085,12.092],[109.078,12.115],[109.070,12.130]],
         {"name":"Đường Cam Thành Bắc","ref":None,"road_type":"tertiary","lanes":2}),
    line([[109.100,12.085],[109.112,12.100],[109.135,12.108]],
         {"name":"Đường nội đồng Cam Hải Tây","ref":None,"road_type":"residential","lanes":1}),
]

out={
 "admin_boundaries.geojson":fc(admin_features),
 "zoning.geojson":fc(zoning_features),
 "land_parcels.geojson":fc(parcels),
 "roads.geojson":fc(roads),
}
for fn,data in out.items():
    with open(fn,"w",encoding="utf-8") as f:
        json.dump(data,f,ensure_ascii=False)
    print(f"{fn:28s} {len(data['features']):4d} features")
