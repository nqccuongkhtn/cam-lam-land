# -*- coding: utf-8 -*-
# vn2000_to_wgs84 cho MẢNG điểm (numpy) — y hệt công thức vn2000.py (KHÔNG đổi hằng số nào, lấy thẳng từ vn2000.py), chỉ thay math → numpy
# để đổi hàng triệu đỉnh nhanh (bóc vùng quy hoạch dạng vector, 14/10/2026). Tự kiểm: chạy file này so với bản gốc trên 20.000 điểm ngẫu nhiên.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import vn2000 as V

def _invTM(E, N):
    a, e2, ep2, K0, FE, LON0 = V.a, V.e2, V.ep2, V.K0, V.FE, V.LON0
    M = N / K0; mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - np.sqrt(1 - e2)) / (1 + np.sqrt(1 - e2))
    phi = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * np.sin(2 * mu)
           + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * np.sin(4 * mu)
           + (151 * e1 ** 3 / 96) * np.sin(6 * mu) + (1097 * e1 ** 4 / 512) * np.sin(8 * mu))
    C1 = ep2 * np.cos(phi) ** 2; T1 = np.tan(phi) ** 2
    N1 = a / np.sqrt(1 - e2 * np.sin(phi) ** 2)
    R1 = a * (1 - e2) / (1 - e2 * np.sin(phi) ** 2) ** 1.5
    D = (E - FE) / (N1 * K0)
    lat = phi - (N1 * np.tan(phi) / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24
          + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720)
    lon = LON0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
          + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120) / np.cos(phi)
    return lat, lon

def vn2000_to_wgs84(E, N):
    """E, N: mảng numpy (mét VN-2000 Khánh Hoà) → (lng, lat) độ, mảng numpy."""
    E = np.asarray(E, np.float64); N = np.asarray(N, np.float64)
    a, e2 = V.a, V.e2
    lat0, lon0 = _invTM(E, N)
    Nn = a / np.sqrt(1 - e2 * np.sin(lat0) ** 2)
    X = Nn * np.cos(lat0) * np.cos(lon0); Y = Nn * np.cos(lat0) * np.sin(lon0); Z = Nn * (1 - e2) * np.sin(lat0)
    d = 1; k = 1 + d * V.s; Rx = d * V.rx; Ry = d * V.ry; Rz = d * V.rz
    Xt = d * V.dX + k * (X - Rz * Y + Ry * Z)
    Yt = d * V.dY + k * (Rz * X + Y - Rx * Z)
    Zt = d * V.dZ + k * (-Ry * X + Rx * Y + Z)
    lon = np.arctan2(Yt, Xt); p = np.hypot(Xt, Yt)
    lat = np.arctan2(Zt, p * (1 - e2))
    for _ in range(8):
        Nl = a / np.sqrt(1 - e2 * np.sin(lat) ** 2)
        lat = np.arctan2(Zt + e2 * Nl * np.sin(lat), p)
    return np.degrees(lon), np.degrees(lat)

if __name__ == '__main__':
    rng = np.random.default_rng(1)
    E = rng.uniform(540000, 620000, 20000); N = rng.uniform(1300000, 1440000, 20000)
    lo, la = vn2000_to_wgs84(E, N)
    goc = np.array([V.vn2000_to_wgs84(e, n) for e, n in zip(E, N)])
    print('lech lon nhat so voi vn2000.py:', np.abs(lo - goc[:, 0]).max(), np.abs(la - goc[:, 1]).max(), 'do')
