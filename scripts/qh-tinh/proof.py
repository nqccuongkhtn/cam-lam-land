# -*- coding: utf-8 -*-
# Dung ANH THU: chong ban do QH (da nan toa do) len anh ve tinh Google.
# Dung: proof.py <pdf> <center_lng> <center_lat> <bbox lng0 lat0 lng1 lat1> <z> <out.png>
import sys, os, math, io, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2, pymupdf
import nan2 as NAN

pdf=sys.argv[1]; clng=float(sys.argv[2]); clat=float(sys.argv[3])
lng0,lat0,lng1,lat1=map(float,sys.argv[4:8]); z=int(sys.argv[8]); out=sys.argv[9]
lng0,lng1=min(lng0,lng1),max(lng0,lng1); lat0,lat1=min(lat0,lat1),max(lat0,lat1)

p2en,p2w,info = NAN.lap_phep_doi(pdf,clng,clat)
se,ie,sn,inn = info['se'],info['ie'],info['sn'],info['inn']
import vn2000 as vn

def lonlat2gp(lon,lat,z):
    n=2**z; x=(lon+180)/360*n*256
    y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n*256
    return x,y
def gp2lonlat(px,py,z):
    n=2**z; lon=px/(n*256)*360-180
    lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*py/(n*256)))))
    return lon,lat

# --- 1. pham vi tile ---
x0g,y0g=lonlat2gp(lng0,lat1,z)   # goc tren-trai (lng nho, lat lon)
x1g,y1g=lonlat2gp(lng1,lat0,z)
tx0,ty0=int(x0g//256),int(y0g//256)
tx1,ty1=int(x1g//256),int(y1g//256)
Wt,Ht=(tx1-tx0+1),(ty1-ty0+1)
Wbig,Hbig=Wt*256,Ht*256
print(f"z={z} tile x[{tx0}..{tx1}] y[{ty0}..{ty1}] = {Wt}x{Ht} tile -> {Wbig}x{Hbig}px")
# pixel goc cua anh ghep (toa do global pixel cua goc tren-trai)
gpx0,gpy0=tx0*256,ty0*256

# --- 2. tai + ghep tile ve tinh Google (hybrid lyrs=y) ---
base=np.zeros((Hbig,Wbig,3),np.uint8)
UA={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}
def tai_tile(x,y,z):
    for s in range(4):
        url=f"https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi"
        try:
            req=urllib.request.Request(url,headers=UA)
            d=urllib.request.urlopen(req,timeout=30).read()
            arr=cv2.imdecode(np.frombuffer(d,np.uint8),cv2.IMREAD_COLOR)
            if arr is not None and arr.shape[:2]==(256,256): return arr
        except Exception as e:
            time.sleep(0.3)
    return np.full((256,256,3),200,np.uint8)
nfail=0
for ty in range(ty0,ty1+1):
    for tx in range(tx0,tx1+1):
        t=tai_tile(tx,ty,z)
        base[(ty-ty0)*256:(ty-ty0+1)*256,(tx-tx0)*256:(tx-tx0+1)*256]=t
print("Da ghep xong anh ve tinh.")

# --- 3. render vung PDF phu bbox ---
# tinh PDF pt cho nhieu diem tren bbox -> lay khung bao
def wgs2pdf(lon,lat):
    E,N=vn.wgs84_to_vn2000(lon,lat); return ((E-ie)/se,(N-inn)/sn)
xs=[];ys=[]
for a in range(11):
    for b in range(11):
        lo=lng0+(lng1-lng0)*a/10; la=lat0+(lat1-lat0)*b/10
        px,py=wgs2pdf(lo,la); xs.append(px); ys.append(py)
px0,px1=min(xs)-20,max(xs)+20; py0,py1=min(ys)-20,max(ys)+20
S=1.6
doc=pymupdf.open(pdf); page=doc[0]
clip=pymupdf.Rect(px0,py0,px1,py1)
pix=page.get_pixmap(matrix=pymupdf.Matrix(S,S),clip=clip,alpha=False)
src=np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width,pix.n)
if pix.n==4: src=cv2.cvtColor(src,cv2.COLOR_RGBA2BGR)
else: src=cv2.cvtColor(src,cv2.COLOR_RGB2BGR)
doc.close()
print(f"Render PDF vung thu: {src.shape[1]}x{src.shape[0]}px (S={S})")

# --- 4. lap ban do map (coarse) output-pixel -> src-pixel ---
GC,GR=80,80
gx=np.linspace(0,Wbig-1,GC); gy=np.linspace(0,Hbig-1,GR)
mapx_c=np.zeros((GR,GC),np.float32); mapy_c=np.zeros((GR,GC),np.float32)
for i,oy in enumerate(gy):
    for j,ox in enumerate(gx):
        lon,lat=gp2lonlat(gpx0+ox,gpy0+oy,z)
        E,N=vn.wgs84_to_vn2000(lon,lat)
        pdx=(E-ie)/se; pdy=(N-inn)/sn
        mapx_c[i,j]=(pdx-px0)*S; mapy_c[i,j]=(pdy-py0)*S
mapx=cv2.resize(mapx_c,(Wbig,Hbig),interpolation=cv2.INTER_LINEAR)
mapy=cv2.resize(mapy_c,(Wbig,Hbig),interpolation=cv2.INTER_LINEAR)
warp=cv2.remap(src,mapx,mapy,interpolation=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=(255,255,255))

# --- 5. chong mo: chi ve cho pixel KHONG trang (co net/mau QH) ---
white=(warp[:,:,0]>243)&(warp[:,:,1]>243)&(warp[:,:,2]>243)
alpha=np.where(white,0.0,0.6).astype(np.float32)[...,None]
blend=(base.astype(np.float32)*(1-alpha)+warp.astype(np.float32)*alpha).astype(np.uint8)

cv2.imwrite(out,blend)
cv2.imwrite(out.replace(".png","_vetinh.png"),base)
cv2.imwrite(out.replace(".png","_qh.png"),warp)
print("Da luu:",out)
