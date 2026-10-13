# -*- coding: utf-8 -*-
# Do nhan luoi km (viet tat 2 chu so) nam tren cac neat-line de lap phep nan toa do.
# In ra: day nhan dong (easting) va bac (northing) + he so tuyen tinh.
import sys, re, pymupdf, numpy as np
pdf = sys.argv[1]
doc = pymupdf.open(pdf); page = doc[0]
W,H = page.rect.width, page.rect.height
words = page.get_text("words")

toks=[]
for w in words:
    t=w[4].strip()
    if re.fullmatch(r"\d{2}", t):   # chi lay 2 chu so (nhan luoi viet tat)
        cx,cy=(w[0]+w[2])/2,(w[1]+w[3])/2
        toks.append((int(t),cx,cy))
# dedup gan nhau
ded=[]
for v,x,y in toks:
    if any(abs(x-X)<3 and abs(y-Y)<3 and v==V for V,X,Y in ded): continue
    ded.append((v,x,y))
toks=ded
print(f"Trang {W:.0f}x{H:.0f}. So token 2 chu so (sau dedup): {len(toks)}")

def fit_line(points):  # points=[(key,pos)]; tra (slope,intercept,R2,n)
    k=np.array([p[0] for p in points],float); p=np.array([p[1] for p in points],float)
    if len(k)<3 or k.max()==k.min(): return None
    A=np.polyfit(p,k,1)  # key = A0*pos + A1
    pred=np.polyval(A,p); ss=np.sum((k-pred)**2); tot=np.sum((k-k.mean())**2)
    r2=1-ss/tot if tot>0 else 0
    return A[0],A[1],r2,len(k)

# EASTING: cac token cung mot hang ngang (y gan nhau), value tang theo x
# Thu gom theo y, buoc 2km. Tim hang co nhieu diem + fit tot + trai rong theo x.
def best_axis(toks, horizontal=True):
    best=None
    # gom theo toa do vuong goc (y neu ngang, x neu dung)
    coords = sorted(set(round((t[2] if horizontal else t[1])/6)*6 for t in toks))
    for c in coords:
        band=[t for t in toks if abs((t[2] if horizontal else t[1])-c) <= 25]
        # loai trung value giu diem gan voi duong c nhat
        byval={}
        for v,x,y in band:
            pos = x if horizontal else y
            d = abs((y if horizontal else x)-c)
            if v not in byval or d<byval[v][1]:
                byval[v]=(pos,d)
        pts=[(v,p) for v,(p,d) in byval.items()]
        if len(pts)<5: continue
        f=fit_line(pts)
        if not f: continue
        slope,inter,r2,n=f
        span=max(p for _,p in pts)-min(p for _,p in pts)
        if r2>0.9995 and span> (0.5* (W if horizontal else H)):
            score=(n, r2, span)
            if best is None or score>best[0]:
                best=(score, pts, c, slope, inter, r2)
    return best

eax=best_axis(toks, horizontal=True)
nax=best_axis(toks, horizontal=False)
print("\n== TRUC DONG (easting) ==")
if eax:
    score,pts,c,slope,inter,r2=eax
    pts=sorted(pts,key=lambda p:p[1])
    print(f"  hang y≈{c:.0f}, {len(pts)} nhan, R2={r2:.6f}")
    print(f"  value(km2chuso) = {slope:.6g}*x + {inter:.6g}  -> x per 1km = {1/slope:.3f} pt")
    print(f"  cac nhan: {[p[0] for p in pts]}")
    print(f"  x cac nhan: {[round(p[1]) for p in pts]}")
else:
    print("  KHONG tim thay")
print("\n== TRUC BAC (northing) ==")
if nax:
    score,pts,c,slope,inter,r2=nax
    pts=sorted(pts,key=lambda p:p[1])
    print(f"  cot x≈{c:.0f}, {len(pts)} nhan, R2={r2:.6f}")
    print(f"  value(km2chuso) = {slope:.6g}*y + {inter:.6g}  -> y per 1km = {1/slope:.3f} pt")
    print(f"  cac nhan: {[p[0] for p in pts]}")
    print(f"  y cac nhan: {[round(p[1]) for p in pts]}")
else:
    print("  KHONG tim thay")
doc.close()
