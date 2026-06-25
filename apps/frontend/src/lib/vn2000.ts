// VN-2000 (Khánh Hòa: kinh tuyến trục 108°15', múi 3°, k=0.9999) <-> WGS84.
// 7-parameter (Position Vector) datum transform — official VN-2000 set.
const a = 6378137.0, f = 1 / 298.257223563;
const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
const LON0 = (108.25 * Math.PI) / 180, K0 = 0.9999, FE = 500000;
const dX = -191.90441429, dY = -39.30318279, dZ = -111.45032835;
const rx = (-0.00928836 / 3600) * Math.PI / 180;
const ry = (0.01975479 / 3600) * Math.PI / 180;
const rz = (-0.00427372 / 3600) * Math.PI / 180;
const s = 0.252906278e-6;
const d2r = Math.PI / 180, r2d = 180 / Math.PI;

function geod2ecef(lat: number, lon: number) {
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return [N * Math.cos(lat) * Math.cos(lon), N * Math.cos(lat) * Math.sin(lon), N * (1 - e2) * Math.sin(lat)];
}
function ecef2geod(X: number, Y: number, Z: number) {
  const lon = Math.atan2(Y, X), p = Math.hypot(X, Y);
  let lat = Math.atan2(Z, p * (1 - e2));
  for (let i = 0; i < 8; i++) {
    const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    lat = Math.atan2(Z + e2 * N * Math.sin(lat), p);
  }
  return [lat, lon];
}
// Position-Vector Helmert: dir=+1 VN2000->WGS84, dir=-1 inverse
function helmert(X: number, Y: number, Z: number, dir: number) {
  const k = 1 + dir * s;
  const Rx = dir * rx, Ry = dir * ry, Rz = dir * rz;
  return [
    dir * dX + k * (X - Rz * Y + Ry * Z),
    dir * dY + k * (Rz * X + Y - Rx * Z),
    dir * dZ + k * (-Ry * X + Rx * Y + Z),
  ];
}
function invTM(E: number, N: number) {
  const M = N / K0, mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const C1 = ep2 * Math.cos(phi) ** 2, T1 = Math.tan(phi) ** 2;
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const R1 = a * (1 - e2) / (1 - e2 * Math.sin(phi) ** 2) ** 1.5;
  const D = (E - FE) / (N1 * K0);
  const lat = phi - (N1 * Math.tan(phi) / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720);
  const lon = LON0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120) / Math.cos(phi);
  return [lat, lon];
}
function fwdTM(lat: number, lon: number) {
  const Nn = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const T = Math.tan(lat) ** 2, C = ep2 * Math.cos(lat) ** 2, A = (lon - LON0) * Math.cos(lat);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * lat)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * lat)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * lat));
  const E = FE + K0 * Nn * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120);
  const N = K0 * (M + Nn * Math.tan(lat) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
    + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
  return [E, N];
}
export function vn2000ToWgs84(E: number, N: number): { lng: number; lat: number } {
  const [lat0, lon0] = invTM(E, N);
  const [x, y, z] = geod2ecef(lat0, lon0);
  const [xt, yt, zt] = helmert(x, y, z, 1);
  const [lat, lon] = ecef2geod(xt, yt, zt);
  return { lng: lon * r2d, lat: lat * r2d };
}
export function wgs84ToVn2000(lng: number, lat: number): { x: number; y: number } {
  const [x, y, z] = geod2ecef(lat * d2r, lng * d2r);
  const [xt, yt, zt] = helmert(x, y, z, -1);
  const [latv, lonv] = ecef2geod(xt, yt, zt);
  const [E, Nn] = fwdTM(latv, lonv);
  return { x: E, y: Nn };
}
