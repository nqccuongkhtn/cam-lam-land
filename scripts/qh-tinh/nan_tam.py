# -*- coding: utf-8 -*-
# Nan khi BIET TI LE (pt/km) nhung khong doc duoc nhan: khop TAM vung mau QH voi TAM ranh hanh chinh OSM.
# Ban do VN-2000 bac-len, khong xoay -> chi can tinh tien (ie, inn). Dung cho huyen GON trong dat lien.
# nan_tam.py <pdf> <osm_boundary.json> <ppkm> <out_sidecar.json>
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2, pymupdf
from shapely.geometry import Polygon, MultiPolygon
import vn2000 as vn

pdf=sys.argv[1]; osmf=sys.argv[2]; ppkm=float(sys.argv[3]); outf=sys.argv[4]
se=1000.0/ppkm; sn=-1000.0/ppkm

# --- tam ranh OSM trong VN2000 ---
d=json.load(open(osmf,encoding="utf-8")); g=d[0]["geojson"]
polys = g["coordinates"] if g["type"]=="MultiPolygon" else [g["coordinates"]]
shp=[]
for poly in polys:
    rings=[[vn.wgs84_to_vn2000(x,y) for x,y in ring] for ring in poly]
    shp.append(Polygon(rings[0], rings[1:]))
osm = max(shp, key=lambda p:p.area) if len(shp)>1 else shp[0]
CE,CN = osm.centroid.x, osm.centroid.y
print(f"Tam ranh OSM (VN2000): E={CE:.1f} N={CN:.1f}  dien tich {osm.area/1e6:.1f} km2")

# --- tam vung mau QH (than ban do) trong PDF pt ---
doc=pymupdf.open(pdf); page=doc[0]; W,H=page.rect.width,page.rect.height
S=0.4
pix=page.get_pixmap(matrix=pymupdf.Matrix(S,S),alpha=False)
img=np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width,pix.n)
img=cv2.cvtColor(img,cv2.COLOR_RGB2BGR); doc.close()
b,gg,r=img[:,:,0].astype(int),img[:,:,1].astype(int),img[:,:,2].astype(int)
white=(b>236)&(gg>236)&(r>236)
land=cv2.morphologyEx((~white).astype(np.uint8),cv2.MORPH_OPEN,np.ones((5,5),np.uint8),1)
n,lab,st,ct=cv2.connectedComponentsWithStats(land,8)
idx=1+int(np.argmax(st[1:,cv2.CC_STAT_AREA])); body=(lab==idx).astype(np.uint8)
body=cv2.morphologyEx(body,cv2.MORPH_CLOSE,np.ones((25,25),np.uint8),2)
ff=body.copy();m=np.zeros((body.shape[0]+2,body.shape[1]+2),np.uint8);cv2.floodFill(ff,m,(0,0),1);body[ff==0]=1
ys,xs=np.where(body>0)
Cx=xs.mean()/S; Cy=ys.mean()/S
area_km2=(body.sum()/(S*S))*(1000.0/ppkm)**2/1e6
print(f"Tam vung mau QH (PDF pt): x={Cx:.1f} y={Cy:.1f}  dien tich ~{area_km2:.1f} km2")

ie = CE - se*Cx; inn = CN - sn*Cy
json.dump({"se":se,"ie":ie,"sn":sn,"inn":inn,"cach":"khop-tam-OSM"}, open(outf,"w"))
print(f"se ie sn inn = {se:.6f} {ie:.3f} {sn:.6f} {inn:.3f}")
for nm,(x,y) in [("tam",(W/2,H/2)),("TL",(0,0)),("BR",(W,H))]:
    lo,la=vn.vn2000_to_wgs84(se*x+ie, sn*y+inn); print(f"  {nm}: lng={lo:.5f} lat={la:.5f}")
print(f"So khop dien tich: QH {area_km2:.0f} vs OSM {osm.area/1e6:.0f} km2 (lech {abs(area_km2-osm.area/1e6)/(osm.area/1e6)*100:.1f}%)")
