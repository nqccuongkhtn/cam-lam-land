import numpy as np, cv2, os, time, math, sys
from geo import wgs84_to_vn2000
E0,Ntop,mphx,HW,HH=np.load('hires_meta.npy'); HW=int(HW);HH=int(HH)
pdf=cv2.imread('pdf_hires-1.png'); mask=cv2.imread('mask_hires.png',0)
OUT=sys.argv[1]; ZS=[int(x) for x in sys.argv[2].split(',')]
latmin,latmax=11.9250,12.2230; lngmin,lngmax=108.9345,109.2700
def lon2tx(lon,z): return (lon+180)/360*(2**z)
def lat2ty(lat,z): return (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*(2**z)
G=16; gi=np.linspace(0,256,G+1); II,JJ=np.meshgrid(gi,gi)
count=0; t0=time.time()
for z in ZS:
    n=2**z
    txmin=int(math.floor(lon2tx(lngmin,z))); txmax=int(math.floor(lon2tx(lngmax,z)))
    tymin=int(math.floor(lat2ty(latmax,z))); tymax=int(math.floor(lat2ty(latmin,z)))
    zc=0
    for tx in range(txmin,txmax+1):
        for ty in range(tymin,tymax+1):
            fn=OUT+'/%d/%d/%d.png'%(z,tx,ty)
            if os.path.exists(fn): count+=1; zc+=1; continue
            lon=(tx+II/256)/n*360-180
            lat=np.degrees(np.arctan(np.sinh(np.pi*(1-2*(ty+JJ/256)/n))))
            E,N=wgs84_to_vn2000(lon,lat)
            hx=((E-E0)/mphx).astype(np.float32); hy=((Ntop-N)/mphx).astype(np.float32)
            if hx.max()<0 or hx.min()>HW or hy.max()<0 or hy.min()>HH: continue
            mx=cv2.resize(hx,(256,256)); my=cv2.resize(hy,(256,256))
            alpha=cv2.remap(mask,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
            if int(alpha.max())==0: continue
            bgr=cv2.remap(pdf,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=(255,255,255))
            bgra=cv2.cvtColor(bgr,cv2.COLOR_BGR2BGRA); bgra[:,:,3]=alpha
            os.makedirs(OUT+'/%d/%d'%(z,tx),exist_ok=True)
            cv2.imwrite(fn,bgra); count+=1; zc+=1
    print('z%d tiles=%d total=%d t=%ds'%(z,zc,count,time.time()-t0),flush=True)
print('DONE total=%d'%count,flush=True)
