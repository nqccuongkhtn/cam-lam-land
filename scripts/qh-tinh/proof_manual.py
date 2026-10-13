# -*- coding: utf-8 -*-
# Anh thu voi phep nan NHAP TAY (se ie sn inn). Chong ban do QH len ve tinh Google.
# proof_manual.py <pdf> <se> <ie> <sn> <inn> <lng0> <lat0> <lng1> <lat1> <z> <out.png>
import sys, os, math, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2, pymupdf
import vn2000 as vn
pdf=sys.argv[1]; se,ie,sn,inn=map(float,sys.argv[2:6])
lng0,lat0,lng1,lat1=map(float,sys.argv[6:10]); z=int(sys.argv[10]); out=sys.argv[11]
lng0,lng1=min(lng0,lng1),max(lng0,lng1); lat0,lat1=min(lat0,lat1),max(lat0,lat1)
doc=pymupdf.open(pdf); page=doc[0]; W,H=page.rect.width,page.rect.height
def ll2gp(lon,lat,z):
    n=2**z; return (lon+180)/360*n*256, (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n*256
def gp2ll(px,py,z):
    n=2**z; return px/(n*256)*360-180, math.degrees(math.atan(math.sinh(math.pi*(1-2*py/(n*256)))))
x0g,y0g=ll2gp(lng0,lat1,z); x1g,y1g=ll2gp(lng1,lat0,z)
tx0,ty0=int(x0g//256),int(y0g//256); tx1,ty1=int(x1g//256),int(y1g//256)
Wt,Ht=(tx1-tx0+1),(ty1-ty0+1); Wb,Hb=Wt*256,Ht*256; gpx0,gpy0=tx0*256,ty0*256
base=np.zeros((Hb,Wb,3),np.uint8)
UA={"User-Agent":"Mozilla/5.0"}
def tai(x,y,z):
    for s in range(4):
        try:
            d=urllib.request.urlopen(urllib.request.Request(f"https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi",headers=UA),timeout=30).read()
            a=cv2.imdecode(np.frombuffer(d,np.uint8),cv2.IMREAD_COLOR)
            if a is not None and a.shape[:2]==(256,256): return a
        except Exception: pass
    return np.full((256,256,3),200,np.uint8)
for ty in range(ty0,ty1+1):
    for tx in range(tx0,tx1+1):
        base[(ty-ty0)*256:(ty-ty0+1)*256,(tx-tx0)*256:(tx-tx0+1)*256]=tai(tx,ty,z)
# render PDF vung phu bbox
def wgs2pdf(lon,lat):
    E,N=vn.wgs84_to_vn2000(lon,lat); return ((E-ie)/se,(N-inn)/sn)
xs=[];ys=[]
for a in range(11):
    for b in range(11):
        px,py=wgs2pdf(lng0+(lng1-lng0)*a/10, lat0+(lat1-lat0)*b/10); xs.append(px);ys.append(py)
px0,px1=max(0,min(xs)-20),min(W,max(xs)+20); py0,py1=max(0,min(ys)-20),min(H,max(ys)+20)
S=2.0; pix=page.get_pixmap(matrix=pymupdf.Matrix(S,S),clip=pymupdf.Rect(px0,py0,px1,py1),alpha=False)
src=np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width,pix.n)
src=cv2.cvtColor(src,cv2.COLOR_RGBA2BGR if pix.n==4 else cv2.COLOR_RGB2BGR)
GC=60; gx=np.linspace(0,Wb-1,GC); gy=np.linspace(0,Hb-1,GC)
mxc=np.zeros((GC,GC),np.float32); myc=np.zeros((GC,GC),np.float32)
for i,oy in enumerate(gy):
    for j,ox in enumerate(gx):
        lon,lat=gp2ll(gpx0+ox,gpy0+oy,z); E,N=vn.wgs84_to_vn2000(lon,lat)
        mxc[i,j]=((E-ie)/se-px0)*S; myc[i,j]=((N-inn)/sn-py0)*S
mapx=cv2.resize(mxc,(Wb,Hb)); mapy=cv2.resize(myc,(Wb,Hb))
warp=cv2.remap(src,mapx,mapy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=(255,255,255))
white=(warp[:,:,0]>243)&(warp[:,:,1]>243)&(warp[:,:,2]>243)
al=np.where(white,0.0,0.6).astype(np.float32)[...,None]
cv2.imwrite(out,(base*(1-al)+warp*al).astype(np.uint8))
print("Da luu",out)
