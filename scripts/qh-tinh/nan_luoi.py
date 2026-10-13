# -*- coding: utf-8 -*-
# Nan toa do bang CACH DO DUONG LUOI (cyan) + gan gia tri da biet (doc bang mat).
# Dung khi nhan ve thanh net, OCR khong sach. Dua: 1 moc dong (x_pt, E_m) + 1 moc bac (y_pt, N_m) + buoc km.
# nan_luoi.py <pdf> <x_anchor_pt> <E_anchor_m> <y_anchor_pt> <N_anchor_m> <buoc_km>
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pymupdf, numpy as np, cv2
import vn2000 as vn

pdf=sys.argv[1]; xA=float(sys.argv[2]); EA=float(sys.argv[3]); yA=float(sys.argv[4]); NA=float(sys.argv[5]); buoc=float(sys.argv[6])
doc=pymupdf.open(pdf); page=doc[0]; W,H=page.rect.width,page.rect.height
S=0.7
pix=page.get_pixmap(matrix=pymupdf.Matrix(S,S),alpha=False)
img=np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width,pix.n)
b,g,r=img[:,:,2].astype(int),img[:,:,1].astype(int),img[:,:,0].astype(int)  # luu y RGB
# cyan nhat: G,B cao; R thap hon
cyan=((g>170)&(b>170)&(r<175)&((g+b-2*r)>50)).astype(np.uint8)
col=cyan.sum(axis=0).astype(float); row=cyan.sum(axis=1).astype(float)

def dinh(sig, minspace):
    thr=max(sig.max()*0.45, np.percentile(sig,98))
    idx=np.where(sig>thr)[0]
    if len(idx)==0: return []
    groups=[[idx[0]]]
    for v in idx[1:]:
        if v-groups[-1][-1]<=minspace*0.5: groups[-1].append(v)
        else: groups.append([v])
    # tam cum = trung binh co trong so
    return [float(np.average(gidx, weights=sig[gidx])) for gidx in groups]

# buoc ~ buoc_km * pt/km(1:25000=113.4) * S
pitch_px = buoc*113.386*S
xs_px=dinh(col, pitch_px); ys_px=dinh(row, pitch_px)
xs=[x/S for x in xs_px]; ys=[y/S for y in ys_px]   # ve pt
print(f"Trang {W:.0f}x{H:.0f}. Duong doc(dong): {len(xs)}  ngang(bac): {len(ys)}")
print(f"  pitch ky vong {buoc}km = {pitch_px/S:.1f}pt")
# gan gia tri: duong gan xA nhat = EA, moi duong +buoc km
def gan(lines, anchor_pos, anchor_val, step_m, tang_theo_pos):
    lines=sorted(lines)
    i0=int(np.argmin([abs(l-anchor_pos) for l in lines]))
    pts=[]
    for i,l in enumerate(lines):
        val=anchor_val + (i-i0)*step_m*(1 if tang_theo_pos else -1)
        pts.append((l,val))
    return np.array(pts)
pe=gan(xs, xA, EA, buoc*1000, True)       # E tang theo x
pn=gan(ys, yA, NA, buoc*1000, False)      # N giam theo y
def fit(p):
    A=np.polyfit(p[:,0],p[:,1],1); pred=np.polyval(A,p[:,0])
    ss=np.sum((p[:,1]-pred)**2); tot=np.sum((p[:,1]-p[:,1].mean())**2)
    return A[0],A[1],(1-ss/tot if tot>0 else 0)
se,ie,r2e=fit(pe); sn,inn,r2n=fit(pn)
print(f"  E: {se:.5f}*x+{ie:.0f}  R2={r2e:.7f} n={len(pe)} ({1000/se:.3f}pt/km)")
print(f"  N: {sn:.5f}*y+{inn:.0f}  R2={r2n:.7f} n={len(pn)} ({-1000/sn:.3f}pt/km)")
for nm,(x,y) in [("tam",(W/2,H/2)),("TL",(0,0)),("BR",(W,H))]:
    E=se*x+ie; N=sn*y+inn; lo,la=vn.vn2000_to_wgs84(E,N)
    print(f"  {nm}: lng={lo:.5f} lat={la:.5f}")
