# -*- coding: utf-8 -*-
# QH CHI TIẾT 1/500 — TÔ MÀU THEO LOẠI ĐẤT kiểu ảnh phân khu 1/2000 (15/10/2026).
# Chủ dự án: "1/500 làm kiểu màu giống 1/2000 và 893 được không, làm như kiểu 205 khó xem quá".
# Ảnh 1/500 đầu tiên (qhct500-v1) là bản IN THẲNG từ MicroStation: bản vẽ 1/500 chỉ tô HOA VĂN (BRASS, SWAMP, AR-CONC…) chứ không
# tô màu đặc → nền gần như trắng, chấm xám, chi chít vòng tròn ghi mã lô / diện tích / mật độ → khó đọc.
# Ở đây đọc thẳng DXF của 6 đồ án:
#   · mỗi VÙNG TÔ (HATCH) = một lô đất; LOẠI ĐẤT lấy theo TÊN LỚP (QH_DAT_NO_Nhaonongthon, QHDH_DAT_CTHTXH_CayxanhCC…) — bảng
#     mau-1-500.json (từ khoá trong tên lớp → tên loại đất + màu). Màu = màu bản phân khu 1/2000 đang dùng cho ĐÚNG loại đó
#     (chỉ mượn BẢNG MÀU, không mượn dữ liệu: lô nào màu gì chỉ do chính bản 1/500 quyết định);
#   · đường bao vùng tô dựng theo LUẬT CHẴN–LẺ (vùng có lỗ), cung tròn tính ĐÚNG CÔNG THỨC (qh-pipeline/cung_chinh_xac.py) như 1/2000;
#   · bỏ level TẮT / ĐÓNG BĂNG (MicroStation không hiện) và mọi thứ ngoài RANH LẬP QUY HOẠCH (khung chú giải, khung tên — riêng bản
#     Cam Thành Bắc có cả bộ ô mẫu đủ loại đất ở khung chú giải);
#   · nét: lòng đường, hè đường, tim đường, chỉ giới, dải phân cách, hẻm, nét chia lô — mỗi loại một kiểu nét cố định cho cả 6 bản
#     (mỗi bản vẽ tự đặt màu nét khác nhau: lòng đường Cam Đức màu 7, Cam Tân màu 4 — để nguyên thì 6 bản lệch kiểu nhau);
#   · BỎ chữ, ký hiệu, kích thước, khung tên, chú giải (như ảnh 1/2000).
# Dùng:
#   python -X utf8 to_mau_1_500.py doc <thư mục DXF> <thư mục ranh> <ra.json>                 # đọc 6 bản → vùng + nét (WGS84)
#   python -X utf8 to_mau_1_500.py cat <vào.json> <thư mục ô ra> [zmin=12] [zmax=20] [--sieu=3]  # cắt ô 512 điểm ảnh WebP
#   python -X utf8 to_mau_1_500.py chu-giai <vào.json> > chu-giai.json                          # chú giải → danh-sach.json "chuGiai"
#   python -X utf8 to_mau_1_500.py nap-sql <vào.json> <ra.sql>   rồi  docker compose exec -T postgis psql -U camlam -d camlam_gis < ra.sql
#                                                                # → bảng qh_500 / qh_500_ranh: quy hoạch 1/500 trên từng thửa (lib/qh500.ts)
import sys, os, json, math, re, unicodedata, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'qh-pipeline'))
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
# (mã ranh, tệp DXF) — mã ranh trùng ranh-<mã>.json do ranh_1_500_dxf.py dựng (lap_danh_sach_qh_rieng.py dùng chung)
BAN = [('gdqd', 'CamThanhBacGDQD.QH03-SDD.dxf'), ('camduc', 'CamDuc160.QH-03.SDD QUY HOACH.dxf'),
       ('camhiepbac', 'CamHiepBac.QH03 SDD CBC.dxf'), ('camtan', 'CamTanQH04- SDDQH.dxf'),
       ('camhoa', 'CamHoa.QH-03-QH.SDD-FIT.dxf'), ('camhaitay', 'CamHaiTay.CamHoaQH04-SDDQH.dxf')]


def khong_dau(s):
    s = unicodedata.normalize('NFD', str(s or '')).replace('đ', 'd').replace('Đ', 'D')
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()


def gon(s):
    """Tên lớp → chuỗi so khớp: không dấu, chữ thường, bỏ khoảng trắng / gạch nối / gạch dưới."""
    return re.sub(r'[\s_\-\.]+', '', khong_dau(s))


BANG = json.load(open(os.path.join(HERE, 'mau-1-500.json'), encoding='utf-8'))


def loai_vung(lop):
    """Tên lớp của vùng tô → mục loại đất trong mau-1-500.json (None = không phải lô đất: khung, chú giải, nét phụ…)."""
    g = gon(lop)
    if any(gon(k) in g for k in BANG['bo_lop']): return None
    for m in BANG['loai']:
        if m.get('tien_to') and not any(lop.upper().startswith(t.upper()) for t in m['tien_to']): continue
        if any(gon(k) in g for k in m['khoa']): return m
    return None


def loai_net(lop):
    g = gon(lop)
    if any(gon(k) in g for k in BANG['bo_lop']): return None
    for m in BANG['net']:
        if any(gon(k) == g or (k.endswith('*') and g.startswith(gon(k[:-1]))) for k in m['lop']): return m
    return None


# ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# BƯỚC 1 — ĐỌC DXF
# ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
def doc(thu_muc_dxf, thu_muc_ranh, ra):
    import ezdxf
    from shapely.geometry import Polygon, MultiPolygon, LineString, shape, mapping
    from shapely.ops import unary_union, transform
    from shapely.validation import make_valid
    import cung_chinh_xac as CX
    from cung_chinh_xac import _doan_cong
    import vn2000_np as vnp

    def wgs(g):
        return transform(lambda x, y, z=None: vnp.vn2000_to_wgs84(np.asarray(x, float), np.asarray(y, float)), g)

    def cac_da_giac(g):
        if g is None or g.is_empty: return []
        if isinstance(g, Polygon): return [g] if g.area > 0 else []
        return [p for q in getattr(g, 'geoms', []) for p in cac_da_giac(q)]

    def chan_le(polys):
        g = None
        for q in polys: g = q if g is None else g.symmetric_difference(q)
        return g

    def net_cua(e):
        """Đối tượng nét → danh sách đường (toạ độ bản vẽ), cung tròn đúng công thức."""
        t = e.dxftype()
        if t == 'LINE': return [[(e.dxf.start[0], e.dxf.start[1]), (e.dxf.end[0], e.dxf.end[1])]]
        if t == 'LWPOLYLINE':
            v = [(float(x), float(y), float(b or 0)) for x, y, b in e.get_points('xyb')]
            n = len(v) if e.closed else len(v) - 1
            pts = []
            for i in range(n):
                x0, y0, b = v[i]; x1, y1, _ = v[(i + 1) % len(v)]
                pts.extend(_doan_cong((x0, y0), (x1, y1), b)[:-1] if abs(b) > 1e-12 else [(x0, y0)])
            pts.append((v[0][0], v[0][1]) if e.closed else (v[-1][0], v[-1][1]))
            return [pts]
        if t == 'POLYLINE':
            pts = [(v.dxf.location[0], v.dxf.location[1]) for v in e.vertices]
            if e.is_closed and pts: pts.append(pts[0])
            return [pts]
        if t in ('ARC', 'CIRCLE'):
            cx, cy, r = e.dxf.center[0], e.dxf.center[1], e.dxf.radius
            a0, a1 = (math.radians(e.dxf.start_angle), math.radians(e.dxf.end_angle)) if t == 'ARC' else (0.0, 2 * math.pi)
            if a1 <= a0: a1 += 2 * math.pi
            n = max(8, int(math.ceil((a1 - a0) / (2 * math.acos(max(-1.0, 1 - 0.002 / max(r, 1e-6)))))))   # võng ≤ 2 mm
            n = min(n, 2000)
            return [[(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]]
        if t in ('SPLINE', 'ELLIPSE'):
            return [[(p[0], p[1]) for p in e.flattening(0.002)]]
        return []

    vung_ra, net_ra, tk, ranh_ra, net_bo = [], [], {}, {}, []
    for ma, tep in BAN:
        f = os.path.join(thu_muc_dxf, tep)
        if not os.path.isfile(f): print('  THIẾU', f); continue
        R = make_valid(shape(json.load(open(os.path.join(thu_muc_ranh, f'ranh-{ma}.json'), encoding='utf-8'))))
        ranh_ra[ma] = mapping(R)
        Rnet = R.buffer(0.3 / 111000)                         # nét sát ranh (lòng đường chạy dọc ranh) giữ trọn
        d = ezdxf.readfile(f); msp = d.modelspace()
        lop_tat = {L.dxf.name for L in d.layers if L.is_frozen() or L.is_off()}
        dem = collections.Counter(); dt_loai = collections.Counter(); khong_ro = collections.Counter()
        lo_ban = []                                           # lô đất CÓ MÀU của bản này (để lọc nét đường lọt vào lòng lô)
        for e in msp.query('HATCH'):                          # lượt 1: vùng tô = lô đất
            lop = e.dxf.get('layer', '') or ''
            if lop in lop_tat: dem['level_tat'] += 1; continue
            m = loai_vung(lop)
            if m is None:
                khong_ro[(lop, e.dxf.pattern_name)] += 1; continue
            try: ds = list(CX.duong_bao_hatch(e))
            except Exception: dem['loi_doc'] += 1; continue
            polys = [make_valid(Polygon(p)) for p in ds if len(p) >= 3]
            if not polys: continue
            g = unary_union(polys) if e.dxf.get('hatch_style', 0) == 2 or len(polys) == 1 else make_valid(chan_le(polys))
            W = make_valid(wgs(g))
            if not W.intersects(R): dem['ngoai_ranh'] += 1; continue
            C = make_valid(W.intersection(R))
            for p in cac_da_giac(C):
                # diện tích thật (m²) chỉ để xếp lớp vẽ: lô to vẽ trước, lô nhỏ đè lên
                dt = p.area * (111320 * math.cos(math.radians(12.1))) * 110574
                if dt < 0.05: continue
                vung_ra.append({'ban': ma, 'lop': lop, 'loai': m['ma'], 'bac': 1 if lop.upper().startswith('HT') else 2,
                                'dt': round(dt, 2), 'g': mapping(p)})
                dt_loai[m['ma']] += dt
                if m.get('mau') and not m.get('lop_phu'): lo_ban.append(p)   # lớp phủ (hành lang cây xanh) chồng lên đường: không lọc
            dem['vung'] += 1
        # NÉT ĐƯỜNG LỌT VÀO LÒNG LÔ (15/10/2026): bản vẽ có ĐƯỜNG DẪN CHÚ THÍCH (nét vàng trỏ từ vòng tròn "BDX01" vào lô) vẽ trên
        # chính lớp hè đường → in ra thành vạch xanh chéo qua lô. Không lọc theo màu được (Cam Đức có 65 nét tim đường nội bộ tự đặt
        # màu riêng, hợp lệ). Lọc theo VỊ TRÍ: nét lòng đường / hè / tim / phân cách mà quá nửa chiều dài nằm trong lòng lô (lô thu
        # vào 0,3 m để nét chạy đúng mép lô không bị tính) là không phải nét đường → bỏ cả nét; ít hơn thì chỉ cắt bỏ khúc trong lô.
        long_lo = unary_union([p.buffer(-0.3 / 111000) for p in lo_ban]) if lo_ban else None
        for e in msp:                                         # lượt 2: nét
            t = e.dxftype(); lop = e.dxf.get('layer', '') or ''
            if t == 'HATCH' or lop in lop_tat: continue
            m = loai_net(lop)
            if m is None: continue
            for pts in net_cua(e):
                if len(pts) < 2: continue
                L = wgs(LineString(pts))
                if not L.intersects(Rnet): continue
                L = L.intersection(Rnet)
                if long_lo is not None and m.get('loc_trong_lo') and L.length > 0 and L.intersects(long_lo):
                    trong = L.intersection(long_lo).length
                    if trong > 0.5 * L.length:
                        dem['net_trong_lo_bo'] += 1
                        net_bo.append({'ban': ma, 'lop': lop, 'kieu': m['ma'], 'cat': False, 'g': mapping(L)}); continue
                    net_bo.append({'ban': ma, 'lop': lop, 'kieu': m['ma'], 'cat': True, 'g': mapping(L.intersection(long_lo))})
                    L = L.difference(long_lo); dem['net_cat_khuc_trong_lo'] += 1
                for l in ([L] if L.geom_type == 'LineString' else [q for q in getattr(L, 'geoms', []) if q.geom_type == 'LineString']):
                    if l.length > 0: net_ra.append({'ban': ma, 'lop': lop, 'kieu': m['ma'], 'g': [list(c) for c in l.coords]})
            dem['net'] += 1
        tk[ma] = {'dem': dict(dem), 'ha_theo_loai': {k: round(v / 1e4, 3) for k, v in dt_loai.most_common()},
                  'vung_to_khong_xep_loai': {f'{a} | {b}': n for (a, b), n in khong_ro.most_common()}}
        print(f'== {ma}: {dict(dem)}')
        print('   ha theo loại:', tk[ma]['ha_theo_loai'])
        if khong_ro: print('   vùng tô KHÔNG xếp loại (bỏ):', dict(khong_ro))
    json.dump({'vung': vung_ra, 'net': net_ra, 'ranh': ranh_ra, 'net_bo': net_bo, 'thong_ke': tk}, open(ra, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'ĐÃ GHI {ra}: {len(vung_ra)} vùng, {len(net_ra)} nét')


# ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# BƯỚC 2 — CẮT Ô ẢNH (512 điểm ảnh WebP, web khai tileSize 256 như mọi lớp 1/500 / QHSDĐ 2030 → nét gấp đôi trên điện thoại)
# ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# Vẽ ở khổ SIEU × 512 KHÔNG khử răng cưa (tô đè theo thứ tự như bản vẽ: hiện trạng dưới, quy hoạch trên, lô to trước lô nhỏ),
# rồi thu về 512 bằng INTER_AREA với alpha NHÂN TRƯỚC → mép mịn, không viền đen / trắng quanh lô.
# Nét theo mức phóng: xa (≤ 15) chỉ có màu lô + viền lô mảnh; 16 thêm mép lòng đường; ≥ 17 đủ mọi nét. Độ rộng ghi ở mau-1-500.json
# tính bằng điểm ảnh của ô 512 ở mức ≥ 18, mức thấp hơn thu nhỏ dần.
KICH = 512


def _hex(m):
    m = m.lstrip('#'); return (int(m[0:2], 16), int(m[2:4], 16), int(m[4:6], 16))


def _px(lng, lat, z):
    n = (2 ** z) * KICH
    x = (np.asarray(lng) + 180.0) / 360.0 * n
    r = np.radians(np.asarray(lat))
    y = (1 - np.log(np.tan(r) + 1 / np.cos(r)) / math.pi) / 2 * n
    return x, y


def _lnglat_o(z, tx, ty):
    n = 2 ** z
    lng0, lng1 = tx / n * 360 - 180, (tx + 1) / n * 360 - 180
    lat0 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (ty + 1) / n))))
    lat1 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ty / n))))
    return lng0, lat0, lng1, lat1


def _he_so_net(z):
    return 1.0 if z >= 18 else (0.85 if z == 17 else (0.7 if z == 16 else 0.55))


def _ve_o(job):
    """Vẽ MỘT ô — chạy trong tiến trình con (dữ liệu nạp sẵn ở _KHO)."""
    import cv2
    from shapely.geometry import box
    z, tx, ty, out = job
    K = _KHO
    S = K['sieu']; N = KICH * S
    b = _lnglat_o(z, tx, ty)
    q = box(*b).buffer((b[2] - b[0]) * 0.02)
    idv = [i for i in K['cay_vung'].query(q) if K['vung_g'][i].intersects(q)]
    idn = [i for i in K['cay_net'].query(q) if K['net_g'][i].intersects(q)] if z >= 16 else []
    if not idv and not idn: return 0
    img = np.zeros((N, N, 4), np.uint8)
    x0, y0 = tx * KICH, ty * KICH

    def diem(coords):
        a = np.asarray(coords, float)
        x, y = _px(a[:, 0], a[:, 1], z)
        return np.stack([(x - x0) * S * 4, (y - y0) * S * 4], 1).round().astype(np.int32)   # shift=2 → 1/4 điểm ảnh

    hs = _he_so_net(z)
    idv.sort(key=lambda i: K['thu_tu'][i])
    for i in idv:                                         # 1) màu lô
        g = K['vung_g'][i]; mau = K['vung_mau'][i]
        if not mau: continue
        vong = [diem(g.exterior.coords)] + [diem(r.coords) for r in g.interiors]
        cv2.fillPoly(img, vong, (*mau[::-1], 255), lineType=cv2.LINE_8, shift=2)
    day_vien = max(1, int(round(0.7 * hs * S)))          # 2) viền lô — màu lô sẫm đi, như nét bao vùng tô của ảnh 1/2000
    for i in idv:
        g = K['vung_g'][i]; mau = K['vung_vien'][i]
        if not mau or K['vung_hoa'][i]: continue
        vong = [diem(g.exterior.coords)] + [diem(r.coords) for r in g.interiors]
        cv2.polylines(img, vong, True, (*mau[::-1], 255), thickness=day_vien, lineType=cv2.LINE_8, shift=2)
    for i in idv:                                         # 2b) LỚP PHỦ (hành lang cây xanh): hoa văn ô chéo phủ CẢ dải, kể cả phần
        hv = K['vung_hoa'][i]                              #     đè lên lô khác — như bản vẽ (hoa văn trong suốt) và như ảnh 1/2000
        if not hv: continue
        g = K['vung_g'][i]
        vong = [diem(g.exterior.coords)] + [diem(r.coords) for r in g.interiors]
        mk = np.zeros((N, N), np.uint8)
        cv2.fillPoly(mk, vong, 255, lineType=cv2.LINE_8, shift=2)
        if not mk.any(): continue
        kc, rg = max(2, int(round(hv['khoang'] * S))), max(1, int(round(hv['rong'] * S)))
        # toạ độ TOÀN CẦU của điểm ảnh → hoa văn nối liền qua mép các ô
        gx = (np.arange(N) + x0 * S)[None, :]; gy = (np.arange(N) + y0 * S)[:, None]
        cheo = (((gx + gy) % kc) < rg) | (((gx - gy) % kc) < rg)
        mau = (*_hex(hv['mau'])[::-1], 255)
        img[(mk > 0) & cheo] = mau
        cv2.polylines(img, vong, True, mau, thickness=day_vien, lineType=cv2.LINE_8, shift=2)
    def ve_net(p, st):
        """Một đường (toạ độ 1/4 điểm ảnh) theo kiểu `st`: màu, rộng, nét gạch [vạch, hở, vạch, hở…] tính bằng điểm ảnh ô 512."""
        day = max(1, int(round(st['rong'] * hs * S)))
        mau = (*_hex(st['mau'])[::-1], 255)
        mau_gach = st.get('net_dut')
        if not mau_gach:
            cv2.polylines(img, [p], False, mau, thickness=day, lineType=cv2.LINE_8, shift=2); return
        f = p.astype(float); seg = np.diff(f, axis=0)
        cum = np.concatenate([[0], np.cumsum(np.hypot(seg[:, 0], seg[:, 1]))])
        kh = [v * hs * S * 4 for v in mau_gach]
        s, k = 0.0, 0
        while s < cum[-1]:
            e = min(s + kh[k % len(kh)], cum[-1])
            if k % 2 == 0:
                tt = np.concatenate([[s], cum[(cum > s) & (cum < e)], [e]])
                q2 = np.stack([np.interp(tt, cum, f[:, 0]), np.interp(tt, cum, f[:, 1])], 1).round().astype(np.int32)
                cv2.polylines(img, [q2], False, mau, thickness=day, lineType=cv2.LINE_8, shift=2)
            s = e; k += 1

    for i in sorted(idn, key=lambda i: K['net_thu_tu'][i]):   # 3) nét đường
        kieu = K['net_kieu'][i]
        if z == 16 and kieu not in ('mep_duong', 'chi_gioi', 'duong_sat'): continue
        st = K['kieu'][kieu]
        p = diem(K['net_g'][i].coords)
        ve_net(p, st)
        if st.get('tren'): ve_net(p, st['tren'])            # đường sắt: nét đậm + vạch trắng đè lên
    if z >= 15:                                           # 4) ranh lập quy hoạch — nét đứt (ảnh 1/2000 không vẽ ranh, nhưng lòng
        for vong in K['ranh_vong']:                        #    đường để trống nên thiếu nét này thì không thấy quy hoạch hết ở đâu)
            if vong.intersects(q): ve_net(diem(vong.coords), K['ranh_kieu'])
    if S > 1:
        a = img[:, :, 3:4].astype(np.float32) / 255.0
        A = cv2.resize(a[:, :, 0], (KICH, KICH), interpolation=cv2.INTER_AREA)
        C = cv2.resize(img[:, :, :3].astype(np.float32) * a, (KICH, KICH), interpolation=cv2.INTER_AREA)
        C = np.where(A[:, :, None] > 1e-6, C / np.maximum(A[:, :, None], 1e-6), 0)
        img = np.dstack([np.clip(C + 0.5, 0, 255), np.clip(A * 255 + 0.5, 0, 255)]).astype(np.uint8)
    if img[:, :, 3].max() == 0: return 0
    d = os.path.join(out, str(z), str(tx)); os.makedirs(d, exist_ok=True)
    cv2.imwrite(os.path.join(d, f'{ty}.webp'), img, [cv2.IMWRITE_WEBP_QUALITY, 101])   # > 100 = WebP KHÔNG MẤT (màu phẳng, mép sắc)
    return 1


_KHO = None


def _nap(vao, sieu):
    global _KHO
    from shapely.geometry import shape, LineString
    from shapely.strtree import STRtree
    d = json.load(open(vao, encoding='utf-8'))
    loai = {m['ma']: m for m in BANG['loai']}
    vg, vm, vv, tt, hv = [], [], [], [], []
    for v in d['vung']:
        g = shape(v['g'])
        if g.geom_type != 'Polygon': continue
        L = loai.get(v['loai'], {}); m = L.get('mau', '')
        vg.append(g); vm.append(_hex(m) if m else None)
        vv.append(tuple(int(c * 0.72) for c in _hex(m)) if m else None)
        hv.append(L.get('hoa_van'))
        # lớp phủ dưới cùng (bậc 0) → lô khác đè lên; rồi hiện trạng dưới, quy hoạch trên; lô to vẽ trước
        tt.append((0 if L.get('lop_phu') else v['bac'], -v['dt']))
    thu_tu = {i: r for r, i in enumerate(sorted(range(len(vg)), key=lambda i: tt[i]))}
    ng, nk = [], []
    for n in d['net']:
        ng.append(LineString(n['g'])); nk.append(n['kieu'])
    kieu = {m['ma']: m for m in BANG['net']}
    uu = {k: i for i, k in enumerate([m['ma'] for m in BANG['net']][::-1])}   # nét đứng đầu bảng vẽ sau cùng (nằm trên)
    ranh_vong = []
    for r in d.get('ranh', {}).values():
        g = shape(r)
        for p in (g.geoms if hasattr(g, 'geoms') else [g]):
            ranh_vong += [p.exterior] + list(p.interiors)
    _KHO = {'sieu': sieu, 'vung_g': vg, 'vung_mau': vm, 'vung_vien': vv, 'vung_hoa': hv, 'thu_tu': thu_tu, 'cay_vung': STRtree(vg),
            'net_g': ng, 'net_kieu': nk, 'net_thu_tu': [uu.get(k, 0) for k in nk], 'cay_net': STRtree(ng) if ng else STRtree([]),
            'kieu': kieu, 'ranh_vong': ranh_vong, 'ranh_kieu': BANG['ranh']}
    return d


def _khoi_tao(vao, sieu):
    _nap(vao, sieu)


def cat(vao, out, zmin='12', zmax='20'):
    import time
    from multiprocessing import Pool
    from shapely.geometry import shape
    from shapely.ops import unary_union
    zmin, zmax = int(zmin), int(zmax)
    sieu = int(next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--sieu=')), 3))
    so_tien_trinh = int(next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--tien-trinh=')), 6))
    d = _nap(vao, sieu)
    U = unary_union([shape(r) for r in d['ranh'].values()]).buffer(2 / 111000)   # ô nào chạm ranh (nới 2 m) mới vẽ
    from shapely.geometry import box
    viec = []
    for z in range(zmin, zmax + 1):
        lng0, lat0, lng1, lat1 = U.bounds
        x0, y1 = _px(lng0, lat0, z); x1, y0 = _px(lng1, lat1, z)
        for tx in range(int(x0 // KICH), int(x1 // KICH) + 1):
            for ty in range(int(y0 // KICH), int(y1 // KICH) + 1):
                if U.intersects(box(*_lnglat_o(z, tx, ty))): viec.append((z, tx, ty, out))
    print(f'{len(viec)} ô cần vẽ (z{zmin}–{zmax}), siêu lấy mẫu ×{sieu}, {so_tien_trinh} tiến trình')
    t0 = time.time()
    with Pool(so_tien_trinh, initializer=_khoi_tao, initargs=(vao, sieu)) as p:
        n = sum(p.imap_unordered(_ve_o, viec, chunksize=8))
    print(f'XONG: {n} ô có hình → {out} ({time.time() - t0:.0f} giây)')


# ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# BƯỚC 3 — CHÚ GIẢI (cùng dạng /chu-giai-qh.json: [{nhom, muc: [{mau, tenDs, so}]}]) → ghi vào danh-sach.json của lớp chỉ-admin
# (mục `chuGiai`), máy chủ gửi kèm vé cho admin — KHÔNG đưa vào tệp chú giải công khai. Lô cùng màu gộp một dòng như chú giải 1/2000.
# ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
def chu_giai(vao):
    d = json.load(open(vao, encoding='utf-8'))
    loai = {m['ma']: m for m in BANG['loai']}
    dem = collections.Counter(v['loai'] for v in d['vung'])
    ra = []
    for nhom, ds in BANG['nhom_chu_giai'].items():
        theo_mau = {}
        for ma in ds:
            m = loai.get(ma)
            if not m or not m.get('mau') or not dem.get(ma): continue
            o = theo_mau.setdefault(m['mau'], {'mau': m['mau'], 'tenDs': [], 'so': 0})
            o['tenDs'].append(m['ten']); o['so'] += dem[ma]
        if theo_mau: ra.append({'nhom': nhom, 'muc': sorted(theo_mau.values(), key=lambda o: -o['so'])})
    thieu = [k for k in dem if k not in {x for v in BANG['nhom_chu_giai'].values() for x in v} and loai.get(k, {}).get('mau')]
    if thieu: print('⚠️ loại đất chưa xếp nhóm chú giải:', thieu, file=sys.stderr)
    return ra


# ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# BƯỚC 4 — NẠP VÀO CƠ SỞ DỮ LIỆU để tính quy hoạch 1/500 TRÊN TỪNG THỬA (máy chủ lib/qh500.ts, CHỈ ADMIN thấy số liệu)
# ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# Lô chồng nhau (dải cây xanh chuyên dụng Cam Tân đè lô thương mại, lô nhà ở vẽ trùng ở Cam Hiệp Bắc…) → TÁCH KHÔNG CHỒNG theo đúng
# thứ tự vẽ của ảnh tô màu: lô nằm TRÊN giữ phần chồng, lô dưới bị khoét → màu thấy trên ảnh = loại đất được tính, không đếm trùng.
# Lô không màu (giao thông) không nạp: máy chủ tính đường = phần trong ranh không có lô.
QD_BAN = {'gdqd': ('2043/QĐ-UBND', 'Khu Gia đình Quân đội thuộc một phần Tiểu khu G, phân khu đô thị Trung tâm'),
          'camduc': ('2044/QĐ-UBND', 'Một phần Tiểu khu B, phân khu đô thị Trung tâm'),
          'camhiepbac': ('2048/QĐ-UBND', 'Một phần Tiểu khu C, phân khu đô thị Trung tâm'),
          'camtan': ('2047/QĐ-UBND', 'Một phần Tiểu khu B, phân khu đô thị phía Bắc'),
          'camhoa': ('2045/QĐ-UBND', 'Một phần Tiểu khu D, phân khu đô thị phía Bắc'),
          'camhaitay': ('2046/QĐ-UBND', 'Một phần Tiểu khu E, phân khu đô thị phía Bắc')}   # như lap_danh_sach_qh_rieng.py


def nap_sql(vao, ra):
    from shapely.geometry import shape, Polygon, MultiPolygon
    from shapely.ops import unary_union
    from shapely.strtree import STRtree
    from shapely.validation import make_valid
    d = json.load(open(vao, encoding='utf-8'))
    loai = {m['ma']: m for m in BANG['loai']}
    V = []
    for v in d['vung']:
        L = loai.get(v['loai'])
        if not L or not L.get('mau'): continue
        V.append((v, make_valid(shape(v['g'])), (0 if L.get('lop_phu') else v['bac'], -v['dt']), L))
    V.sort(key=lambda t: t[2])                     # dưới → trên, y như thứ tự vẽ ô ảnh (_nap / _ve_o)
    hinh = [t[1] for t in V]; cay = STRtree(hinh)
    K = 111320 * math.cos(math.radians(12.1)) * 110574

    def da_giac(g):
        if g is None or g.is_empty: return []
        if isinstance(g, Polygon): return [g]
        return [p for q in getattr(g, 'geoms', []) for p in da_giac(q)]
    def wkt(g):
        ps = [p for p in da_giac(g) if p.area * K >= 0.01]
        if not ps: return None
        def vong(r): return '(' + ','.join(f'{x:.8f} {y:.8f}' for x, y in r.coords) + ')'
        return 'MULTIPOLYGON(' + ','.join('(' + ','.join([vong(p.exterior)] + [vong(r) for r in p.interiors]) + ')' for p in ps) + ')'
    def q(s): return "'" + str(s).replace("'", "''") + "'"
    dong, tong_truoc, tong_sau = [], 0.0, 0.0
    for i, (v, g, _, L) in enumerate(V):
        tren = [hinh[j] for j in cay.query(g) if j > i and hinh[j].intersects(g)]
        m = make_valid(g.difference(unary_union(tren))) if tren else g
        tong_truoc += g.area * K; tong_sau += m.area * K
        w = wkt(m)
        if w: dong.append(f"({q(v['ban'])},{q(v['loai'])},{q(L['ten'])},{q(L['mau'])},ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_GeomFromText('{w}',4326)),3)))")
    with open(ra, 'w', encoding='utf-8', newline='\n') as f:
        f.write('-- QH chi tiết 1/500 trên từng thửa (scripts/qh-tinh/to_mau_1_500.py nap-sql) — chạy lại nhiều lần vẫn đúng\nBEGIN;\n')
        f.write('DELETE FROM qh_500; DELETE FROM qh_500_ranh;\n')
        for k in range(0, len(dong), 200):
            f.write('INSERT INTO qh_500 (ban, loai, ten, mau, geom) VALUES\n' + ',\n'.join(dong[k:k + 200]) + ';\n')
        for ma, r in d['ranh'].items():
            so, ten = QD_BAN.get(ma, ('', ma))
            f.write(f"INSERT INTO qh_500_ranh (ban, qd, ten, geom) VALUES ({q(ma)},{q(so)},{q(ten)},"
                    f"ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_GeomFromText('{wkt(shape(r))}',4326)),3)));\n")
        f.write('COMMIT;\nSELECT ban, count(*), round((sum(ST_Area(geom::geography))/1e4)::numeric, 2) AS ha FROM qh_500 GROUP BY ban ORDER BY ban;\n')
    print(f'ĐÃ GHI {ra}: {len(dong)} lô (tách không chồng: {tong_truoc / 1e4:.2f} ha → {tong_sau / 1e4:.2f} ha), {len(d["ranh"])} ranh', file=sys.stderr)


if __name__ == '__main__':
    lenh = sys.argv[1] if len(sys.argv) > 1 else ''
    ts = [a for a in sys.argv[2:] if not a.startswith('--')]
    if lenh == 'doc': doc(ts[0], ts[1], ts[2])
    elif lenh == 'cat': cat(*ts)
    elif lenh == 'chu-giai': print(json.dumps(chu_giai(ts[0]), ensure_ascii=False, indent=1))
    elif lenh == 'nap-sql': nap_sql(ts[0], ts[1])
    else: print(open(__file__, encoding='utf-8').read()[:2400])
