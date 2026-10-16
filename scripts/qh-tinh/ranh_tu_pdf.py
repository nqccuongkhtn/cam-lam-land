# -*- coding: utf-8 -*-
# Tach ranh "than ban do" (vung mau lon nhat) tu PDF -> polygon WGS84 de cat tile.
# Tu dong loai bang chu giai / so do vi tri / chu ky o goc (cac khoi mau ROI, khong dinh than ban do).
# Dung: ranh_tu_pdf.py <pdf> <clng> <clat> <out.json> <viz.png>
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2, pymupdf
import nan2 as NAN
import vn2000 as vn

pdf=sys.argv[1]; clng=float(sys.argv[2]); clat=float(sys.argv[3]); outjson=sys.argv[4]; viz=sys.argv[5]
p2en,p2w,info=NAN.lap_phep_doi(pdf,clng,clat)
se,ie,sn,inn=info['se'],info['ie'],info['sn'],info['inn']
P2EN=info.get('p2en') or (lambda x,y: (se*x+ie, sn*y+inn))   # nan theo o luoi neu co
W,H=info['W'],info['H']
S=0.4
doc=pymupdf.open(pdf); page=doc[0]
pix=page.get_pixmap(matrix=pymupdf.Matrix(S,S),alpha=False)
img=np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width,pix.n)
img=cv2.cvtColor(img, cv2.COLOR_RGBA2BGR if pix.n==4 else cv2.COLOR_RGB2BGR)
doc.close()
Hh,Ww=img.shape[:2]
print(f"render {Ww}x{Hh}")

# mau khong-trang
b,g,r=img[:,:,0].astype(int),img[:,:,1].astype(int),img[:,:,2].astype(int)
white=(b>236)&(g>236)&(r>236)
land=(~white).astype(np.uint8)
# bo net mong (luoi km, chu, net vien) de con lai cac MANG mau dac
land=cv2.morphologyEx(land, cv2.MORPH_OPEN, np.ones((5,5),np.uint8), iterations=1)
# vung lon nhat = than ban do (bang chu giai/so do o goc la khoi roi, nho hon)
n,lab,stats,cent=cv2.connectedComponentsWithStats(land,8)
if n<=1:
    print("KHONG tim thay vung"); sys.exit(1)
idx=1+int(np.argmax(stats[1:,cv2.CC_STAT_AREA]))
body=(lab==idx).astype(np.uint8)
# --them=x,y;x,y (16/10/2026): GỘP THÊM các mảng màu chứa các điểm này (toạ độ ĐIỂM IN trên trang PDF). Tuy Phong: mũi rừng tây bắc
# chỉ nối với thân bản đồ bằng một khúc hẹp → bị tách thành mảng riêng và bỏ (ranh hụt 21 % diện tích huyện); đảo Hòn Cau cũng vậy.
for a in [a for a in sys.argv[6:] if a.startswith('--them=')]:
    for cap in a.split('=',1)[1].split(';'):
        if not cap.strip(): continue
        x_pt,y_pt=map(float,cap.split(','))
        px,py=int(round(x_pt*S)),int(round(y_pt*S))
        k=lab[py,px] if 0<=py<Hh and 0<=px<Ww else 0
        if k==0:   # điểm rơi vào nét / nền trắng → tìm mảng gần nhất trong bán kính 6 điểm ảnh
            o=lab[max(0,py-6):py+7,max(0,px-6):px+7]; ks=o[o>0]
            k=int(np.bincount(ks).argmax()) if ks.size else 0
        if k>0:
            body[lab==k]=1; print(f"gop them mang mau tai ({x_pt:.0f},{y_pt:.0f}) diem in: {int(stats[k,cv2.CC_STAT_AREA])} diem anh")
        else: print(f"CANH BAO: khong thay mang mau tai ({x_pt:.0f},{y_pt:.0f})")
# noi lien + lap lo + noi rong ra chut cho khoi cat thieu mep
body=cv2.morphologyEx(body, cv2.MORPH_CLOSE, np.ones((25,25),np.uint8), iterations=2)
# lap lo trong (flood tu bien)
ff=body.copy(); h2,w2=ff.shape
m=np.zeros((h2+2,w2+2),np.uint8)
cv2.floodFill(ff,m,(0,0),1)           # nen ngoai = 1
holes=(ff==0)                          # lo ben trong
body[holes]=1
body=cv2.dilate(body,np.ones((9,9),np.uint8),1)   # noi rong ~3.6px(~80m) cho khong cat sat mep

cnts,_=cv2.findContours(body,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
cnts=sorted(cnts,key=cv2.contourArea,reverse=True)
# giu cac vung du lon (than + ban dao roi neu co)
polys=[]
for c in cnts:
    if cv2.contourArea(c) < (0.0001 if any(a.startswith("--them=") for a in sys.argv[6:]) else 0.002)*Hh*Ww: continue   # có điểm gieo: giữ cả đảo nhỏ đã gộp
    c=cv2.approxPolyDP(c, 1.2, True)   # don gian hoa ~1.2px
    if len(c)<4: continue
    ring=[]
    for p in c[:,0,:]:
        px_pt=p[0]/S; py_pt=p[1]/S
        E,Nn=P2EN(px_pt,py_pt)
        lon,lat=vn.vn2000_to_wgs84(E,Nn)
        ring.append([round(lon,6),round(lat,6)])
    ring.append(ring[0])
    polys.append([ring])
geo={"type":"MultiPolygon","coordinates":polys}
json.dump(geo,open(outjson,"w",encoding="utf-8"))
print(f"So vung giu: {len(polys)}  -> {outjson}")

# viz: ve ranh len ban do
vimg=img.copy()
for c in cnts[:len(polys)]:
    cv2.drawContours(vimg,[c],-1,(0,0,255),3)
cv2.imwrite(viz,vimg)
print("viz:",viz)
# khung bao
allll=np.array([pt for poly in polys for pt in poly[0]])
print(f"bbox lng[{allll[:,0].min():.4f},{allll[:,0].max():.4f}] lat[{allll[:,1].min():.4f},{allll[:,1].max():.4f}]")
