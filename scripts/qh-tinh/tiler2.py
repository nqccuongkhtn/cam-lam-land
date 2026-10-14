# -*- coding: utf-8 -*-
# Cat tile NHANH: render PDF 1 lan ra anh nguon lon, roi lay mau cho tung o (khong render tung o).
# Dung: tiler2.py <pdf> <clng> <clat> <ranh.json> <out_dir> <name> <zmin> <zmax> [scale_nguon]
import sys, os, math, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2, pymupdf
import nan2 as NAN
import vn2000 as vn

pdf=sys.argv[1]; clng=float(sys.argv[2]); clat=float(sys.argv[3])
ranh_path=sys.argv[4]; out_dir=sys.argv[5]; name=sys.argv[6]
zmin=int(sys.argv[7]); zmax=int(sys.argv[8])
Ss=float(sys.argv[9]) if len(sys.argv)>9 else 1.8

p2en,p2w,info=NAN.lap_phep_doi(pdf,clng,clat)
se,ie,sn,inn=info['se'],info['ie'],info['sn'],info['inn']
EN2P=info.get('en2p') or (lambda E,N: ((E-ie)/se,(N-inn)/sn))   # nan theo o luoi neu co
W,H=info['W'],info['H']

# ranh
rings=[]
g=json.load(open(ranh_path,encoding="utf-8"))
polys=g["coordinates"] if g["type"]=="MultiPolygon" else [g["coordinates"]]
for poly in polys:
    for ring in poly: rings.append(np.array(ring,float))
allpts=np.vstack(rings)
LON0,LON1=allpts[:,0].min(),allpts[:,0].max()
LAT0,LAT1=allpts[:,1].min(),allpts[:,1].max()
print(f"Pham vi: lng[{LON0:.4f},{LON1:.4f}] lat[{LAT0:.4f},{LAT1:.4f}]  scale_nguon={Ss}")

def ll2gp_s(lon,lat,z):
    n=2**z; x=(lon+180)/360*n*256
    y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n*256
    return x,y
def gp2ll(px,py,z):
    n=2**z; lon=px/(n*256)*360-180
    lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*py/(n*256)))))
    return lon,lat
def ll2gp_vec(lon,lat,z):
    n=2**z; x=(lon+180)/360*n*256
    y=(1-np.arcsinh(np.tan(np.radians(lat)))/np.pi)/2*n*256
    return np.column_stack([x,y]).astype(np.float32)

# --- render anh nguon 1 lan ---
t0=time.time()
doc=pymupdf.open(pdf); page=doc[0]
pix=page.get_pixmap(matrix=pymupdf.Matrix(Ss,Ss),alpha=False)
src=np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width,pix.n)
src=cv2.cvtColor(src, cv2.COLOR_RGBA2BGR if pix.n==4 else cv2.COLOR_RGB2BGR)
doc.close()
SH,SW=src.shape[:2]
print(f"anh nguon {SW}x{SH} ({time.time()-t0:.0f}s)")

GC=9
tong=0
for z in range(zmin,zmax+1):
    x0g,y0g=ll2gp_s(LON0,LAT1,z); x1g,y1g=ll2gp_s(LON1,LAT0,z)
    tx0,tx1=int(x0g//256),int(x1g//256); ty0,ty1=int(y0g//256),int(y1g//256)
    rings_px=[ll2gp_vec(r[:,0],r[:,1],z) for r in rings]
    nz=0
    for ty in range(ty0,ty1+1):
        for tx in range(tx0,tx1+1):
            ox0,oy0=tx*256,ty*256
            mask=np.zeros((256,256),np.uint8); any_in=False
            for rp in rings_px:
                loc=rp.copy(); loc[:,0]-=ox0; loc[:,1]-=oy0
                if loc[:,0].max()<-8 or loc[:,0].min()>263 or loc[:,1].max()<-8 or loc[:,1].min()>263: continue
                cv2.fillPoly(mask,[loc.astype(np.int32)],255); any_in=True
            if not any_in or mask.max()==0: continue
            # Lay mau luoi 4x4 -> khop AFFINE roi ap TOAN o bang cong thuc (muot, khong smear,
            # cac o khop mep nhau). cv2.resize luoi tho kep mep -> nhoe mot dai, nen bo.
            gp=np.linspace(0,255,4)
            P=[]; SX=[]; SY=[]; oob=True
            for oy in gp:
                for oxx in gp:
                    lon,lat=gp2ll(ox0+oxx,oy0+oy,z)
                    E,Nn=vn.wgs84_to_vn2000(lon,lat)
                    pdx,pdy=EN2P(E,Nn)
                    P.append((oxx,oy,1.0)); SX.append(pdx*Ss); SY.append(pdy*Ss)
                    if 0<=pdx<=W and 0<=pdy<=H: oob=False
            if oob: continue
            P=np.array(P);
            cx=np.linalg.lstsq(P,np.array(SX),rcond=None)[0]
            cy=np.linalg.lstsq(P,np.array(SY),rcond=None)[0]
            OX,OY=np.meshgrid(np.arange(256,dtype=np.float32),np.arange(256,dtype=np.float32))
            mapx=(cx[0]*OX+cx[1]*OY+cx[2]).astype(np.float32)
            mapy=(cy[0]*OX+cy[1]*OY+cy[2]).astype(np.float32)
            warp=cv2.remap(src,mapx,mapy,interpolation=cv2.INTER_LINEAR,
                           borderMode=cv2.BORDER_CONSTANT,borderValue=(255,255,255))
            nonwhite=~((warp[:,:,0]>242)&(warp[:,:,1]>242)&(warp[:,:,2]>242))
            alpha=nonwhite&(mask>0)
            if not alpha.any(): continue
            bgra=np.dstack([warp,(alpha.astype(np.uint8)*255)])
            d=os.path.join(out_dir,name,str(z),str(tx)); os.makedirs(d,exist_ok=True)
            cv2.imwrite(os.path.join(d,f"{ty}.png"),bgra)
            nz+=1; tong+=1
    print(f"  z{z}: {nz} o  (tong {tong}, {time.time()-t0:.0f}s)")
print(f"XONG: {tong} o trong {time.time()-t0:.0f}s -> {out_dir}/{name}")
