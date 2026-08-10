import numpy as np
a=6378137.0; f=1/298.257223563; e2=f*(2-f); ep2=e2/(1-e2)
LON0=np.radians(108.25); K0=0.9999; FE=500000.0
dX=-191.90441429; dY=-39.30318279; dZ=-111.45032835
rx=np.radians(-0.00928836/3600); ry=np.radians(0.01975479/3600); rz=np.radians(-0.00427372/3600)
s=0.252906278e-6
def geod2ecef(lat,lon):
    N=a/np.sqrt(1-e2*np.sin(lat)**2)
    return N*np.cos(lat)*np.cos(lon), N*np.cos(lat)*np.sin(lon), N*(1-e2)*np.sin(lat)
def ecef2geod(X,Y,Z):
    lon=np.arctan2(Y,X); p=np.hypot(X,Y); lat=np.arctan2(Z,p*(1-e2))
    for _ in range(8):
        N=a/np.sqrt(1-e2*np.sin(lat)**2); lat=np.arctan2(Z+e2*N*np.sin(lat),p)
    return lat,lon
def helmert(X,Y,Z,d):
    k=1+d*s; Rx=d*rx;Ry=d*ry;Rz=d*rz
    return (d*dX+k*(X-Rz*Y+Ry*Z), d*dY+k*(Rz*X+Y-Rx*Z), d*dZ+k*(-Ry*X+Rx*Y+Z))
def fwdTM(lat,lon):
    Nn=a/np.sqrt(1-e2*np.sin(lat)**2); T=np.tan(lat)**2; C=ep2*np.cos(lat)**2; A=(lon-LON0)*np.cos(lat)
    M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*lat-(3*e2/8+3*e2**2/32+45*e2**3/1024)*np.sin(2*lat)
        +(15*e2**2/256+45*e2**3/1024)*np.sin(4*lat)-(35*e2**3/3072)*np.sin(6*lat))
    E=FE+K0*Nn*(A+(1-T+C)*A**3/6+(5-18*T+T**2+72*C-58*ep2)*A**5/120)
    N=K0*(M+Nn*np.tan(lat)*(A**2/2+(5-T+9*C+4*C**2)*A**4/24+(61-58*T+T**2+600*C-330*ep2)*A**6/720))
    return E,N
def invTM(E,N):
    M=N/K0; mu=M/(a*(1-e2/4-3*e2**2/64-5*e2**3/256))
    e1=(1-np.sqrt(1-e2))/(1+np.sqrt(1-e2))
    phi=mu+(3*e1/2-27*e1**3/32)*np.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*np.sin(4*mu)+(151*e1**3/96)*np.sin(6*mu)+(1097*e1**4/512)*np.sin(8*mu)
    C1=ep2*np.cos(phi)**2; T1=np.tan(phi)**2; N1=a/np.sqrt(1-e2*np.sin(phi)**2)
    R1=a*(1-e2)/(1-e2*np.sin(phi)**2)**1.5; D=(E-FE)/(N1*K0)
    lat=phi-(N1*np.tan(phi)/R1)*(D**2/2-(5+3*T1+10*C1-4*C1**2-9*ep2)*D**4/24+(61+90*T1+298*C1+45*T1**2-252*ep2-3*C1**2)*D**6/720)
    lon=LON0+(D-(1+2*T1+C1)*D**3/6+(5-2*C1+28*T1-3*C1**2+8*ep2+24*T1**2)*D**5/120)/np.cos(phi)
    return lat,lon
def wgs84_to_vn2000(lng,lat):
    x,y,z=geod2ecef(np.radians(lat),np.radians(lng)); xt,yt,zt=helmert(x,y,z,-1)
    latv,lonv=ecef2geod(xt,yt,zt); return fwdTM(latv,lonv)
def vn2000_to_wgs84(E,N):
    lat0,lon0=invTM(E,N); x,y,z=geod2ecef(lat0,lon0); xt,yt,zt=helmert(x,y,z,1)
    lat,lon=ecef2geod(xt,yt,zt); return np.degrees(lon),np.degrees(lat)
