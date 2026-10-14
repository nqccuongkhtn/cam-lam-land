# -*- coding: utf-8 -*-
# Nan toa do CHUNG, tu nhan format nhan luoi: (a) 2 chu so viet tat, (b) km 3-4 so co the kem .0/.5,
# (c) du met. Khop ben vung (RANSAC) nen bo duoc token doc sai.
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pymupdf, numpy as np
import vn2000 as vn

def cac_token(page):
    out=[]
    for w in page.get_text("words"):
        t=w[4].strip()
        if re.fullmatch(r"\d{1,7}", t):
            out.append((int(t), t, (w[0]+w[2])/2, (w[1]+w[3])/2))
    return out

def gom_duong(toks, ngang, dungsai=7):
    # gom token theo toa do vuong goc (y neu ngang, x neu doc) -> cac "duong" nhan
    key=(lambda t:t[3]) if ngang else (lambda t:t[2])
    sv=sorted(toks,key=key)
    nhom=[]; cur=[sv[0]]
    for t in sv[1:]:
        if abs(key(t)-key(cur[-1]))<=dungsai: cur.append(t)
        else: nhom.append(cur); cur=[t]
    nhom.append(cur)
    return nhom

def phuc_hoi_gia_tri(line, ngang, tam_km):
    # line: list token tren 1 duong. Tra list (pos, E_or_N_met).
    pos=lambda t:(t[2] if ngang else t[3])
    line=sorted(line,key=pos)
    vals=[t[0] for t in line]
    maxv=max(vals) if vals else 0
    pts=[]
    if maxv>=100000:              # DU MET: moi nhan 1 token
        for t in line:
            if t[0]>=100000: pts.append((pos(t), float(t[0])))
    elif maxv>=100:               # KM (3-4 so), co the kem frac 0/500
        km=[t for t in line if 100<=t[0]<=9999 and t[0] not in (500,)]
        fr=[t for t in line if t[0] in (0,500)]
        for t in km:
            # tim frac gan ben phai
            f=0
            for ft in fr:
                if 0<=pos(ft)-pos(t)<=55 and abs((t[3] if ngang else t[2])-(ft[3] if ngang else ft[2]))<40:
                    f=ft[0]; break
            pts.append((pos(t), t[0]*1000.0+f))
    else:                          # VIET TAT 2 so: unwrap buoc 2
        g=line
        printed=[t[0] for t in g]; P=[pos(t) for t in g]
        absv=[printed[0]]
        for i in range(1,len(g)):
            step=(printed[i]-printed[i-1])%100
            absv.append(absv[-1]+(2 if step==2 else (-2 if step==98 else (printed[i]-printed[i-1]))))
        mid=absv[len(absv)//2]
        base=round((tam_km-mid)/100.0)*100
        for p,a in zip(P,absv): pts.append((p,(a+base)*1000.0))
    return pts

def khop_ben_vung(pts):
    pts=np.array(pts)
    if len(pts)<4: return None
    keep=np.ones(len(pts),bool); A=np.polyfit(pts[:,0],pts[:,1],1)
    for _ in range(8):
        pred=np.polyval(A,pts[:,0]); res=np.abs(pts[:,1]-pred)
        thr=max(150.0, 4*np.median(res[keep])) if keep.any() else 150.0
        keep=res<thr
        if keep.sum()<4: break
        A=np.polyfit(pts[keep,0],pts[keep,1],1)
    pin=pts[keep]; pred=np.polyval(A,pin[:,0])
    ss=np.sum((pin[:,1]-pred)**2); tot=np.sum((pin[:,1]-pin[:,1].mean())**2)
    return A[0],A[1],(1-ss/tot if tot>0 else 0),int(keep.sum())

def truc(toks, ngang, tam_m, dai):
    # Moi "duong" (cum token cung y hoac cung x) TU KHOP rieng: chi nhan duong khop tot
    # (R2>0.995, 80<pt/km<320) -> loai cac dong nhan rai trong than ban do.
    nhom=gom_duong(toks, ngang)
    good=[]
    for line in nhom:
        if len(line)<6: continue
        pts=phuc_hoi_gia_tri(line, ngang, tam_m/1000.0)
        if len(pts)<6: continue
        ps=[p for p,_ in pts]
        if max(ps)-min(ps) < 0.35*dai: continue
        f=khop_ben_vung(pts)
        if not f: continue
        slope,inter,r2,nin=f
        ppkm=abs(1000.0/slope) if slope!=0 else 0
        if r2>0.995 and 80<ppkm<320 and nin>=6:
            good.append(pts)
    if not good: return None
    allpts=[p for pts in good for p in pts]
    return khop_ben_vung(allpts)

def lap_phep_doi(pdf_path, tam_lng, tam_lat):
    # Phep nan NHAP TAY (cho ban nhan luoi ve thanh net, khong tu doc duoc): file ben canh <pdf>.nan.json
    # chua {"se":..,"ie":..,"sn":..,"inn":..}. Co thi dung thang.
    import json
    side = pdf_path + ".nan.json"
    if os.path.exists(side):
        c=json.load(open(side,encoding="utf-8"))
        se,ie,sn,inn=c.get("se",1.0),c.get("ie",0.0),c.get("sn",-1.0),c.get("inn",0.0)
        doc=pymupdf.open(pdf_path); W,H=doc[0].rect.width,doc[0].rect.height; doc.close()
        def p2en(x,y): return (se*x+ie, sn*y+inn)
        def en2p(E,N): return ((E-ie)/se, (N-inn)/sn)
        AF=c.get("afin")
        if AF:
            # NẮN AFFINE (14/10/2026 — bản vẽ 1/500 nắn theo bảng góc ranh, nan_1_500.py): E = a·x+b·y+c, N = d·x+e·y+f,
            # x,y = điểm PDF của trang ĐÃ XOAY (như get_pixmap vẽ ra). Có thể xoay nhẹ nên phải đủ 6 tham số.
            a_,b_,c_,d_,e_,f_ = AF
            det = a_*e_ - b_*d_
            def p2en(x,y): return (a_*x+b_*y+c_, d_*x+e_*y+f_)
            def en2p(E,N):
                E0, N0 = E-c_, N-f_
                return ((e_*E0 - b_*N0)/det, (-d_*E0 + a_*N0)/det)
            se, sn = (a_*a_+d_*d_)**0.5, -((b_*b_+e_*e_)**0.5)       # m/pt (chỉ để báo + chọn độ nét)
            ie, inn = c_, f_
        L=c.get("luoi")
        if L:
            # NAN THEO TUNG O LUOI (14/10/2026): ban in co luoi KHONG DEU (Khanh Vinh: phia dong o rong 227,0 pt, phia tay 226,5)
            # -> mot phep thang lech toi 10 m o mep. Noi suy tuyen tinh giua cac duong luoi = dung tai MOI duong luoi;
            # ngoai duong luoi ngoai cung thi keo dai theo o cuoi. "luoi": {"x":[pt],"E":[m],"y":[pt],"N":[m]} (x,y tang dan).
            def _ns(v, a, b):
                if v <= a[0]: return b[0] + (v-a[0])*(b[1]-b[0])/(a[1]-a[0])
                if v >= a[-1]: return b[-1] + (v-a[-1])*(b[-1]-b[-2])/(a[-1]-a[-2])
                import bisect
                k = bisect.bisect_right(a, v) - 1
                return b[k] + (v-a[k])*(b[k+1]-b[k])/(a[k+1]-a[k])
            lx, lE, ly, lN = [list(map(float, L[k])) for k in ("x","E","y","N")]
            lNr, lyr = lN[::-1], ly[::-1]   # N tang dan (y giam dan) cho chieu nguoc
            def p2en(x,y): return (_ns(x, lx, lE), _ns(y, ly, lN))
            def en2p(E,N): return (_ns(E, lE, lx), _ns(N, lNr, lyr))
        def p2w(x,y):
            E,N=p2en(x,y); return vn.vn2000_to_wgs84(E,N)
        info=dict(W=W,H=H,se=se,ie=ie,r2e=1.0,ne=c.get("ne",0),sn=sn,inn=inn,r2n=1.0,nn=c.get("nn",0),
                  ppkm_x=1000.0/se, ppkm_y=-1000.0/sn, nhap_tay=True, p2en=p2en, en2p=en2p)
        return p2en,p2w,info
    doc=pymupdf.open(pdf_path); page=doc[0]; W,H=page.rect.width,page.rect.height
    E0,N0=vn.wgs84_to_vn2000(tam_lng,tam_lat)
    toks=cac_token(page)
    e=truc(toks, True,  E0, W); n=truc(toks, False, N0, H)
    doc.close()
    if not e or not n:
        return None, None, dict(W=W,H=H, e=e, n=n, loi="khong khop du truc")
    se,ie,r2e,ne=e; sn,inn,r2n,nn=n
    def p2en(x,y): return (se*x+ie, sn*y+inn)
    def p2w(x,y):
        E,N=p2en(x,y); return vn.vn2000_to_wgs84(E,N)
    info=dict(W=W,H=H,se=se,ie=ie,r2e=r2e,ne=ne,sn=sn,inn=inn,r2n=r2n,nn=nn,
              ppkm_x=1000.0/se, ppkm_y=-1000.0/sn)
    return p2en,p2w,info

if __name__=="__main__":
    pdf=sys.argv[1]; lng=float(sys.argv[2]); lat=float(sys.argv[3])
    p2en,p2w,info=lap_phep_doi(pdf,lng,lat)
    if not p2en: print("LOI:",info.get("loi"), "e=",info.get("e"),"n=",info.get("n")); sys.exit(1)
    print(f"  E: {info['se']:.5f}*x+{info['ie']:.0f}  R2={info['r2e']:.7f} n={info['ne']} ({info['ppkm_x']:.3f}pt/km)")
    print(f"  N: {info['sn']:.5f}*y+{info['inn']:.0f}  R2={info['r2n']:.7f} n={info['nn']} ({info['ppkm_y']:.3f}pt/km)")
    W,H=info['W'],info['H']
    for nm,(x,y) in [("tam",(W/2,H/2)),("TL",(0,0)),("BR",(W,H))]:
        lo,la=p2w(x,y); print(f"  {nm}: lng={lo:.5f} lat={la:.5f}")
