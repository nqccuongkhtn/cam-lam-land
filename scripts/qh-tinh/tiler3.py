# -*- coding: utf-8 -*-
# CẮT TILE NÉT (bản 3 — 14/10/2026, chủ dự án chê ảnh quy hoạch "mờ, không thấy được"). Khác tiler2.py:
#  1) Ô 512 điểm ảnh (gấp đôi) — web vẫn khai tileSize 256 nên mỗi ô hiện ở 256 điểm CSS: trên điện thoại màn hình mật độ 2–3
#     (90 % người xem) ảnh nét gấp đôi; máy tính thường tự thu nhỏ mịn (mipmap). KHÔNG phải sửa lõi bản đồ (MapView).
#  2) MỖI MỨC PHÓNG VẼ LẠI TỪ PDF đúng độ phân giải của mức đó (tiler2 vẽ một ảnh lớn rồi lấy mẫu cho mọi mức → ở mức thấp
#     nhảy cóc điểm ảnh, nét mảnh đứt / răng cưa). Vẽ theo KHỐI k×k ô bằng danh sách lệnh vẽ (DisplayList) nên trang nặng
#     (bản 1/500 ~1 triệu nét) vẫn nhanh.
#  3) Siêu lấy mẫu ×2 rồi gộp điểm ảnh (INTER_AREA) với alpha NHÂN TRƯỚC → nét mảnh, chữ, mép ranh mịn, không viền trắng.
#  4) Toạ độ: lưới 9×9 điểm chính xác mỗi ô (VN-2000 → trang PDF theo phép nắn) rồi nội suy song tuyến, tính theo TÂM điểm ảnh
#     (tiler2 khớp một phép affine mỗi ô — đủ cho nắn tuyến tính, nhưng nắn theo ô lưới "luoi" có gãy khúc ở đường lưới).
# Dùng: python -P tiler3.py <pdf> <clng> <clat> <ranh.json> <out_dir> <name> <zmin> <zmax> [--kich=512] [--sieu=2] [--khoi=4]
#                                    [--dinh=webp|png] [--cl=90] [--phan=0/3] [--bo-qua-co]
import sys, os, math, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, cv2, pymupdf
import nan2 as NAN
import vn2000 as vn

co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
def tuy(k, mac): return next((a.split('=', 1)[1] for a in co if a.startswith('--' + k + '=')), mac)
pdf, clng, clat, ranh_path, out_dir, name = ts[0], float(ts[1]), float(ts[2]), ts[3], ts[4], ts[5]
zmin, zmax = int(ts[6]), int(ts[7])
KICH, SIEU, KHOI = int(tuy('kich', 512)), int(tuy('sieu', 2)), int(tuy('khoi', 4))
DINH, CL = tuy('dinh', 'webp'), int(tuy('cl', 90))
BO_QUA = '--bo-qua-co' in sys.argv                                # ô đã có file thì bỏ qua (chạy tiếp / chia lại việc)
PHAN = tuple(map(int, tuy('phan', '0/1').split('/')))          # --phan=i/n: chỉ làm khối thứ i, i+n, … (chạy n tiến trình song song)
N = KICH * SIEU                                                  # cạnh ô khi siêu lấy mẫu

p2en, p2w, info = NAN.lap_phep_doi(pdf, clng, clat)
EN2P = info.get('en2p') or (lambda E, Nn: ((E - info['ie']) / info['se'], (Nn - info['inn']) / info['sn']))
W, H = info['W'], info['H']

rings = []
g = json.load(open(ranh_path, encoding='utf-8'))
for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
    for ring in poly: rings.append(np.array(ring, float))
allp = np.vstack(rings)
LON0, LON1, LAT0, LAT1 = allp[:, 0].min(), allp[:, 0].max(), allp[:, 1].min(), allp[:, 1].max()

def ll2gp(lon, lat, z):                                          # kinh vĩ độ → toạ độ điểm ảnh toàn cầu (thang 256) ở mức z
    n = 2 ** z
    return (lon + 180) / 360 * n * 256, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n * 256
def gp2ll(px, py, z):
    n = 2 ** z
    return px / (n * 256) * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * py / (n * 256)))))
def ll2gp_vec(lon, lat, z):
    n = 2 ** z
    return np.c_[(lon + 180) / 360 * n * 256, (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n * 256]
def trang(lon, lat):                                             # kinh vĩ độ → điểm trên trang PDF (đã xoay)
    E, Nn = vn.wgs84_to_vn2000(lon, lat); return EN2P(E, Nn)

# mét / điểm PDF tại tâm (để chọn độ phóng vẽ cho từng mức)
cx_, cy_ = trang(clng, clat); E0_, N0_ = vn.wgs84_to_vn2000(clng, clat)
px1, py1 = EN2P(E0_ + 500, N0_); px2, py2 = EN2P(E0_, N0_ + 500)
m_moi_pt = 1000 / (math.hypot(px1 - cx_, py1 - cy_) + math.hypot(px2 - cx_, py2 - cy_))
print(f'pham vi lng[{LON0:.4f},{LON1:.4f}] lat[{LAT0:.4f},{LAT1:.4f}] · {m_moi_pt:.3f} m/diem PDF · o {KICH} diem anh, sieu x{SIEU}, {DINH}')

doc = pymupdf.open(pdf); dl = doc[0].get_displaylist()
G = 9                                                            # lưới điểm chính xác mỗi ô
tam_luoi = (np.arange(N) + 0.5) / N * (G - 1); i0 = np.minimum(tam_luoi.astype(int), G - 2); fr = (tam_luoi - i0).astype(np.float32)
def noi_suy(A):                                                  # A: G×G giá trị tại nút → N×N tại tâm điểm ảnh (song tuyến)
    hang = A[:, i0] * (1 - fr) + A[:, i0 + 1] * fr               # G × N
    return (hang[i0, :] * (1 - fr)[:, None] + hang[i0 + 1, :] * fr[:, None]).astype(np.float32)

t0 = time.time(); tong = 0; dung = 0
for z in range(zmin, zmax + 1):
    gx0, gy0 = ll2gp(LON0, LAT1, z); gx1, gy1 = ll2gp(LON1, LAT0, z)
    tx0, tx1, ty0, ty1 = int(gx0 // 256), int(gx1 // 256), int(gy0 // 256), int(gy1 // 256)
    rp_all = [ll2gp_vec(r[:, 0], r[:, 1], z) for r in rings]
    # điểm ảnh ra (thang KICH) dài bao nhiêu mét → độ phóng vẽ PDF: mỗi điểm ảnh nguồn = 1/SIEU điểm ảnh ra
    m_px = 40075016.686 * math.cos(math.radians((LAT0 + LAT1) / 2)) / (2 ** z * KICH)
    Ss = SIEU * m_moi_pt / m_px
    nz = 0
    for bx in range(tx0, tx1 + 1, KHOI):
        for by in range(ty0, ty1 + 1, KHOI):
            if ((bx - tx0) // KHOI + (by - ty0) // KHOI) % PHAN[1] != PHAN[0]: continue
            o_khoi = []
            for tx in range(bx, min(bx + KHOI, tx1 + 1)):
                for ty in range(by, min(by + KHOI, ty1 + 1)):
                    ox0, oy0 = tx * 256, ty * 256
                    if BO_QUA and os.path.exists(os.path.join(out_dir, name, str(z), str(tx), f'{ty}.{"webp" if DINH == "webp" else "png"}')): continue
                    mk = np.zeros((N, N), np.uint8); co_ranh = False
                    for rp in rp_all:
                        loc = (rp - [ox0, oy0]) * (N / 256) - 0.5
                        if loc[:, 0].max() < -4 or loc[:, 0].min() > N + 4 or loc[:, 1].max() < -4 or loc[:, 1].min() > N + 4: continue
                        cv2.fillPoly(mk, [np.round(loc * 16).astype(np.int32)], 255, cv2.LINE_8, 4); co_ranh = True
                    if not co_ranh or not mk.any(): continue
                    # toạ độ trang PDF tại 9×9 nút của ô (nút ở mép ô: 0 .. 256 theo thang 256)
                    PX = np.empty((G, G)); PY = np.empty((G, G))
                    for j in range(G):
                        for i in range(G):
                            PX[j, i], PY[j, i] = trang(*gp2ll(ox0 + i * 256 / (G - 1), oy0 + j * 256 / (G - 1), z))
                    if PX.max() < 0 or PX.min() > W or PY.max() < 0 or PY.min() > H: continue
                    o_khoi.append((tx, ty, mk, PX, PY))
            if not o_khoi: continue
            # vẽ PHẦN TRANG phủ cả khối một lần
            bx0 = max(0, min(o[3].min() for o in o_khoi) - 3); bx1 = min(W, max(o[3].max() for o in o_khoi) + 3)
            by0 = max(0, min(o[4].min() for o in o_khoi) - 3); by1 = min(H, max(o[4].max() for o in o_khoi) + 3)
            if bx1 <= bx0 or by1 <= by0: continue
            pix = dl.get_pixmap(matrix=pymupdf.Matrix(Ss, Ss), clip=pymupdf.Rect(bx0, by0, bx1, by1), alpha=False)
            src = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)
            src = cv2.cvtColor(src, cv2.COLOR_RGB2BGR); DX, DY = pix.x, pix.y
            for tx, ty, mk, PX, PY in o_khoi:
                mapx = noi_suy(PX * Ss - DX - 0.5); mapy = noi_suy(PY * Ss - DY - 0.5)
                warp = cv2.remap(src, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))
                a = (~((warp[:, :, 0] > 242) & (warp[:, :, 1] > 242) & (warp[:, :, 2] > 242)) & (mk > 0)).astype(np.float32)
                if not a.any(): continue
                # gộp 2×2 → 1 với alpha nhân trước: màu = Σ(màu·a)/Σa, độ đục = trung bình a
                if SIEU > 1:
                    A_ = cv2.resize(a, (KICH, KICH), interpolation=cv2.INTER_AREA)
                    C_ = cv2.resize(warp.astype(np.float32) * a[:, :, None], (KICH, KICH), interpolation=cv2.INTER_AREA)
                    C_ = C_ / np.maximum(A_, 1e-6)[:, :, None]
                else: A_, C_ = a, warp.astype(np.float32)
                bgra = np.dstack([np.clip(C_ + 0.5, 0, 255).astype(np.uint8), np.clip(A_ * 255 + 0.5, 0, 255).astype(np.uint8)])
                d = os.path.join(out_dir, name, str(z), str(tx)); os.makedirs(d, exist_ok=True)
                if DINH == 'webp': cv2.imwrite(os.path.join(d, f'{ty}.webp'), bgra, [cv2.IMWRITE_WEBP_QUALITY, CL])
                else: cv2.imwrite(os.path.join(d, f'{ty}.png'), bgra, [cv2.IMWRITE_PNG_COMPRESSION, 6])
                nz += 1; tong += 1
    print(f'  z{z}: {nz} o (Ss {Ss:.2f}, tong {tong}, {time.time() - t0:.0f}s)')
print(f'XONG: {tong} o trong {time.time() - t0:.0f}s -> {out_dir}/{name}')
