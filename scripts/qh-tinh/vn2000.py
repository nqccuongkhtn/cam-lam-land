# -*- coding: utf-8 -*-
# Port Python y het apps/backend/src/lib/vn2000.ts (VN-2000 Khanh Hoa <-> WGS84).
# KTT 108 15', mui 3 do, k=0.9999, Helmert 7 tham so (Position Vector).
import math, os
a = 6378137.0; f = 1/298.257223563
e2 = f*(2-f); ep2 = e2/(1-e2)
# Kinh tuyến trục: mặc định 108°15' (Khánh Hòa — ĐỪNG đổi). Bản đồ TỈNH KHÁC (15/10/2026): đặt biến môi trường VN2000_KTT_DO theo
# KTT của tỉnh đó, vd Lâm Đồng 107.75 (107°45'). Helmert 7 tham số là bộ chung toàn quốc nên không đổi.
LON0 = math.radians(float(os.environ.get('VN2000_KTT_DO', '108.25'))); K0 = 0.9999; FE = 500000.0
dX=-191.90441429; dY=-39.30318279; dZ=-111.45032835
rx = math.radians(-0.00928836/3600); ry = math.radians(0.01975479/3600); rz = math.radians(-0.00427372/3600)
s = 0.252906278e-6

def geod2ecef(lat, lon):
    N = a/math.sqrt(1-e2*math.sin(lat)**2)
    return [N*math.cos(lat)*math.cos(lon), N*math.cos(lat)*math.sin(lon), N*(1-e2)*math.sin(lat)]
def ecef2geod(X,Y,Z):
    lon = math.atan2(Y,X); p = math.hypot(X,Y)
    lat = math.atan2(Z, p*(1-e2))
    for _ in range(8):
        N = a/math.sqrt(1-e2*math.sin(lat)**2)
        lat = math.atan2(Z+e2*N*math.sin(lat), p)
    return [lat, lon]
def helmert(X,Y,Z,d):
    k = 1 + d*s; Rx=d*rx; Ry=d*ry; Rz=d*rz
    return [ d*dX + k*(X - Rz*Y + Ry*Z),
             d*dY + k*(Rz*X + Y - Rx*Z),
             d*dZ + k*(-Ry*X + Rx*Y + Z) ]
def invTM(E,N):
    M = N/K0; mu = M/(a*(1-e2/4-3*e2**2/64-5*e2**3/256))
    e1 = (1-math.sqrt(1-e2))/(1+math.sqrt(1-e2))
    phi = (mu + (3*e1/2-27*e1**3/32)*math.sin(2*mu)
           + (21*e1**2/16-55*e1**4/32)*math.sin(4*mu)
           + (151*e1**3/96)*math.sin(6*mu) + (1097*e1**4/512)*math.sin(8*mu))
    C1 = ep2*math.cos(phi)**2; T1 = math.tan(phi)**2
    N1 = a/math.sqrt(1-e2*math.sin(phi)**2)
    R1 = a*(1-e2)/(1-e2*math.sin(phi)**2)**1.5
    D = (E-FE)/(N1*K0)
    lat = phi - (N1*math.tan(phi)/R1)*(D**2/2 - (5+3*T1+10*C1-4*C1**2-9*ep2)*D**4/24
          + (61+90*T1+298*C1+45*T1**2-252*ep2-3*C1**2)*D**6/720)
    lon = LON0 + (D - (1+2*T1+C1)*D**3/6
          + (5-2*C1+28*T1-3*C1**2+8*ep2+24*T1**2)*D**5/120)/math.cos(phi)
    return [lat, lon]
def fwdTM(lat,lon):
    Nn = a/math.sqrt(1-e2*math.sin(lat)**2)
    T = math.tan(lat)**2; C = ep2*math.cos(lat)**2; A = (lon-LON0)*math.cos(lat)
    M = a*((1-e2/4-3*e2**2/64-5*e2**3/256)*lat
           - (3*e2/8+3*e2**2/32+45*e2**3/1024)*math.sin(2*lat)
           + (15*e2**2/256+45*e2**3/1024)*math.sin(4*lat)
           - (35*e2**3/3072)*math.sin(6*lat))
    E = FE + K0*Nn*(A + (1-T+C)*A**3/6 + (5-18*T+T**2+72*C-58*ep2)*A**5/120)
    N = K0*(M + Nn*math.tan(lat)*(A**2/2 + (5-T+9*C+4*C**2)*A**4/24
          + (61-58*T+T**2+600*C-330*ep2)*A**6/720))
    return [E, N]
def vn2000_to_wgs84(E,N):
    lat0,lon0 = invTM(E,N)
    x,y,z = geod2ecef(lat0,lon0)
    xt,yt,zt = helmert(x,y,z,1)
    lat,lon = ecef2geod(xt,yt,zt)
    return (math.degrees(lon), math.degrees(lat))  # (lng, lat)
def wgs84_to_vn2000(lng,lat):
    x,y,z = geod2ecef(math.radians(lat), math.radians(lng))
    xt,yt,zt = helmert(x,y,z,-1)
    latv,lonv = ecef2geod(xt,yt,zt)
    E,Nn = fwdTM(latv,lonv)
    return (E, Nn)
