import json, math, os, sys
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS=None
qx=int(sys.argv[1]); qy=int(sys.argv[2]); DST=sys.argv[3]
ov=json.load(open('QD205_overlay.json')); W,S,E,N=ov['bounds']
Z=17; n=2**Z
def merc(lo,la):
    x=(lo+180)/360.0*n*256; y=(1-math.asinh(math.tan(math.radians(la)))/math.pi)/2*n*256; return x,y
x0,y0=merc(W,N); x1,y1=merc(E,S)
tx0=int(x0//256); tx1=int(x1//256); ty0=int(y0//256); ty1=int(y1//256)
NX=tx1-tx0+1; NY=ty1-ty0+1; hx=(NX+1)//2; hy=(NY+1)//2
qtxa=tx0+qx*hx; qtxb=min(tx1,qtxa+hx-1); qtya=ty0+qy*hy; qtyb=min(ty1,qtya+hy-1)
oxq=qtxa*256.0; oyq=qtya*256.0; QW=(qtxb-qtxa+1)*256; QH=(qtyb-qtya+1)*256
img=Image.new('RGBA',(QW,QH),(0,0,0,0)); d=ImageDraw.Draw(img)
for col,ext in json.load(open('colored_polys.json')):
    pts=[]; minx=miny=1e18; maxx=maxy=-1e18
    for lo,la in ext:
        px,py=merc(lo,la); X=px-oxq; Y=py-oyq; pts.append((X,Y))
        minx=min(minx,X); maxx=max(maxx,X); miny=min(miny,Y); maxy=max(maxy,Y)
    if maxx<0 or minx>QW or maxy<0 or miny>QH: continue
    if len(pts)>=3: d.polygon(pts, fill=(col[0],col[1],col[2],255))
saved=0
for tx in range(qtxa,qtxb+1):
    for ty in range(qtya,qtyb+1):
        t=img.crop(((tx-qtxa)*256,(ty-qtya)*256,(tx-qtxa)*256+256,(ty-qtya)*256+256))
        if t.getbbox() is None: continue
        dd=f'{DST}/17/{tx}'; os.makedirs(dd,exist_ok=True); t.save(f'{dd}/{ty}.png'); saved+=1
print(f"Q({qx},{qy}) z17: {saved} ô | {QW}x{QH}")
