# -*- coding: utf-8 -*-
# Do DUONG LUOI trong NET VECTOR (tranh nuoc bien) de nan chinh xac.
# Dua phep nan BAN DAU (se ie sn inn) + buoc km -> tinh chinh bang vi tri duong luoi that.
# grid_vec.py <pdf> <se0> <ie0> <sn0> <inn0> <buoc_km>
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pymupdf, numpy as np
import vn2000 as vn
pdf=sys.argv[1]; se0,ie0,sn0,inn0=map(float,sys.argv[2:6]); buoc=float(sys.argv[6])
doc=pymupdf.open(pdf); page=doc[0]; W,H=page.rect.width,page.rect.height
vx=[]; hy=[]   # x cua net doc, y cua net ngang
for dr in page.get_drawings():
    for it in dr.get("items",[]):
        if it[0]!="l": continue
        p1,p2=it[1],it[2]
        dx,dy=abs(p1.x-p2.x),abs(p1.y-p2.y); ln=max(dx,dy)
        if ln < 0.35*min(W,H): continue
        if dx<1.5 and dy>0.35*H: vx.append((p1.x+p2.x)/2)   # net doc dai
        elif dy<1.5 and dx>0.35*W: hy.append((p1.y+p2.y)/2)  # net ngang dai
def gom(a, tol=3):
    a=sorted(a); out=[]; cur=[a[0]]
    for v in a[1:]:
        if v-cur[-1]<=tol: cur.append(v)
        else: out.append(sum(cur)/len(cur)); cur=[v]
    out.append(sum(cur)/len(cur)); return out
vx=gom(vx) if vx else []; hy=gom(hy) if hy else []
print(f"Net doc (grid dong): {len(vx)}  | Net ngang (grid bac): {len(hy)}")
pitch=buoc*1000/abs(se0)   # pt mong doi moi o
def snap_fit(lines, s0, i0, horizontal):
    # moi duong -> gia tri lam tron ve boi so buoc theo phep ban dau
    pts=[]
    for L in lines:
        val0 = s0*L + i0
        val = round(val0/(buoc*1000))*(buoc*1000)   # lam tron ve duong luoi gan nhat
        if abs(val-val0) < buoc*1000*0.3:            # chi nhan khi gan 1 duong luoi
            pts.append((L,val))
    if len(pts)<3: return None
    pts=np.array(pts); A=np.polyfit(pts[:,0],pts[:,1],1)
    pred=np.polyval(A,pts[:,0]); ss=np.sum((pts[:,1]-pred)**2); tot=np.sum((pts[:,1]-pts[:,1].mean())**2)
    return A[0],A[1],(1-ss/tot if tot>1 else 1.0),len(pts)
fe=snap_fit(vx, se0, ie0, True); fn=snap_fit(hy, sn0, inn0, False)
if not fe or not fn:
    print("KHONG du duong luoi vector de tinh chinh (vx,hy):", len(vx), len(hy)); sys.exit(2)
se,ie,r2e,ne=fe; sn,inn,r2n,nn=fn
print(f"TINH CHINH:")
print(f"  E: {se:.6f}*x+{ie:.1f}  R2={r2e:.8f} n={ne} ({1000/se:.4f}pt/km)")
print(f"  N: {sn:.6f}*y+{inn:.1f}  R2={r2n:.8f} n={nn} ({-1000/sn:.4f}pt/km)")
print(f"  se ie sn inn = {se:.6f} {ie:.3f} {sn:.6f} {inn:.3f}")
for nm,(x,y) in [("tam",(W/2,H/2)),("TL",(0,0)),("BR",(W,H))]:
    lo,la=vn.vn2000_to_wgs84(se*x+ie, sn*y+inn); print(f"  {nm}: lng={lo:.5f} lat={la:.5f}")
