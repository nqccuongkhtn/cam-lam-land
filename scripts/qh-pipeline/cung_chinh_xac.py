# -*- coding: utf-8 -*-
"""
ĐỌC ĐƯỜNG BAO VÙNG TÔ (HATCH) VỚI CUNG TRÒN THẬT — sai số ≤ 1 mm (11/10/2026).

Vì sao có file này: chủ dự án đo tay trên MicroStation thửa 1297 tờ 15 Cam Đức (sát vòng xoay quảng trường) thấy web lệch
1–2 m² (cây xanh web 410,1 — đo tay 408,35). Nguyên nhân nằm ở bước đổi bản vẽ → dữ liệu web:
  · thư viện ezdxf (ezpath.from_hatch) đổi cung tròn / elip / đoạn cong (bulge) thành ĐƯỜNG CONG BÉZIER, mỗi phần tư vòng tròn
    chỉ 1 đường cong — lệch khỏi cung thật tới 0,027 % bán kính (bán kính 100 m lệch 2,7 cm);
  · rồi chia đường cong đó thành đoạn thẳng với độ võng tới 5 cm (distance=0,05).
  Mỗi đoạn hụt một mẩu, dọc 60 m cung tròn cộng lại ~2 m².
Ở đây cung tròn tính ĐÚNG CÔNG THỨC từ tâm + bán kính + góc ghi trong bản vẽ:
  · số đoạn chọn sao cho độ võng (khoảng cách cung thật ↔ dây cung) ≤ SAI_SO;
  · các ĐỈNH GIỮA cung đặt ra ngoài một chút (bán kính R' tính đúng công thức) để diện tích hình gấp khúc BẰNG ĐÚNG diện tích hình
    quạt của cung thật — chia đoạn thẳng thông thường thì luôn HỤT (dây cung nằm trong cung), dọc 60 m cung hụt 2/3·võng·60 m².
    Nay đường gấp khúc lúc ngoài lúc trong cung (lệch tối đa 2/3·SAI_SO), phần dư và phần hụt bù trừ hết → diện tích không lệch.
  · hai đầu cung giữ ĐÚNG điểm của bản vẽ (nối khít với cạnh thẳng bên cạnh).
Spline dùng đường B-spline thật của ezdxf (BSpline.flattening) — không qua Bézier gần đúng.
QĐ205: đọc thẳng QD205.gpkg (cung tròn lưu dạng 3 điểm — CircularString) bằng vong_gpkg(), không qua ogr2ogr (ogr2ogr bẻ cung
4° một đoạn: thửa 1297 tờ 15 Cam Đức hụt 1,9 m² cây xanh, dư 0,45 m² đường so với bản vẽ).
Cách nối các cạnh thành vòng giữ ĐÚNG như ezdxf (from_hatch_edge_path) để không đổi hình nào ngoài phần cung.

Dùng:  from cung_chinh_xac import duong_bao_hatch
       for pts in duong_bao_hatch(e): ...      # pts = [(x, y), ...] toạ độ bản vẽ (WCS), vòng chưa khép
"""
import math

from ezdxf.entities.boundary_paths import ArcEdge, EdgePath, EllipseEdge, LineEdge, PolylinePath, SplineEdge
from ezdxf.math import BSpline, ConstructionEllipse, Vec3, fit_points_to_cad_cv

import os
import struct

SAI_SO = float(os.environ.get('QH_SAI_SO_CUNG', '0.002'))   # mét — độ võng lớn nhất giữa cung thật và dây cung


def _so_doan(goc, ban_kinh, sai_so=SAI_SO):
    """Số đoạn thẳng chia một cung góc `goc` (radian) bán kính `ban_kinh` để độ võng ≤ sai_so.
    Ít nhất 2 đoạn: cần ít nhất 1 đỉnh giữa thì mới bù được diện tích (cung ngắn chỉ 1 dây cung là hụt nguyên viên phân —
    trước khi thêm luật này, vùng tô lệch nhiều nhất còn 0,003 m²)."""
    goc = abs(goc)
    if goc < 1e-12 or ban_kinh <= 1e-9:
        return 1
    it_nhat = max(2, int(math.ceil(goc / (math.pi / 2) - 1e-9)))   # mỗi đoạn ≤ 1/4 vòng tròn (công thức bù cần góc đoạn < 180°)
    if ban_kinh <= sai_so:
        return it_nhat
    buoc = 2.0 * math.acos(1.0 - sai_so / ban_kinh)
    return max(it_nhat, int(math.ceil(goc / buoc)))


def _cung(cx, cy, r, a0, a1):
    """Các điểm của cung tâm (cx, cy) bán kính r, đi từ góc a0 tới a1 (radian, chiều theo dấu a1 − a0), gồm cả 2 đầu.
    Đỉnh giữa nằm trên bán kính R' sao cho diện tích hình quạt gấp khúc = diện tích hình quạt cung thật:
        (n−2)·R'² + 2·R·R' = R²·n·Δ / sin Δ        (Δ = góc một đoạn; 2 đầu cung giữ trên bán kính R)."""
    n = _so_doan(a1 - a0, r)
    return [(cx + r * u, cy + r * v) for u, v in _cung_don_vi(a0, a1, n)]


def _he_so_bu(n, d):
    """Tỉ lệ R'/R của các đỉnh giữa (n đoạn, mỗi đoạn góc d radian) để diện tích quạt gấp khúc = diện tích quạt cung thật."""
    if n < 2:
        return 1.0
    q = n * d / math.sin(d)
    return q / 2.0 if n == 2 else (math.sqrt(1.0 + (n - 2) * q) - 1.0) / (n - 2)


def _cung_don_vi(a0, a1, n):
    """n + 1 điểm của cung trên ĐƯỜNG TRÒN ĐƠN VỊ từ góc a0 tới a1, đỉnh giữa đã bù diện tích (hai đầu nằm đúng trên đường tròn)."""
    if n < 1:
        n = 1
    d = (a1 - a0) / n
    k = _he_so_bu(n, abs(d)) if n >= 2 else 1.0
    return [((1.0 if i in (0, n) else k) * math.cos(a0 + d * i), (1.0 if i in (0, n) else k) * math.sin(a0 + d * i)) for i in range(n + 1)]


def _cung_3_diem(p0, p1, p2):
    """Cung tròn đi qua 3 điểm (kiểu CircularString của gpkg): từ p0 qua p1 tới p2. Thẳng hàng → đoạn thẳng."""
    # toạ độ tương đối so với p0 để khỏi mất chữ số (toạ độ VN-2000 cỡ 600.000 m)
    bx, by = p1[0] - p0[0], p1[1] - p0[1]
    cx_, cy_ = p2[0] - p0[0], p2[1] - p0[1]
    if math.hypot(cx_, cy_) < 1e-9:                       # p0 = p2: cả vòng tròn, p1 đối diện p0
        ox, oy = p0[0] + bx / 2.0, p0[1] + by / 2.0
        r = math.hypot(bx, by) / 2.0
        a0 = math.atan2(p0[1] - oy, p0[0] - ox)
        pts = _cung(ox, oy, r, a0, a0 + 2.0 * math.pi)
        pts[0] = pts[-1] = p0
        return pts
    d = 2.0 * (bx * cy_ - by * cx_)
    day = math.hypot(cx_, cy_)
    if abs(d) / 2.0 <= 1e-9 * day * day:                  # thẳng hàng
        return [p0, p2]
    ux = (cy_ * (bx * bx + by * by) - by * (cx_ * cx_ + cy_ * cy_)) / d
    uy = (bx * (cx_ * cx_ + cy_ * cy_) - cx_ * (bx * bx + by * by)) / d
    ox, oy = p0[0] + ux, p0[1] + uy
    r = math.hypot(ux, uy)
    a0 = math.atan2(p0[1] - oy, p0[0] - ox)
    a1 = math.atan2(p1[1] - oy, p1[0] - ox)
    a2 = math.atan2(p2[1] - oy, p2[0] - ox)
    s = (a2 - a0) % (2.0 * math.pi)
    m = (a1 - a0) % (2.0 * math.pi)
    quet = s if m < s else s - 2.0 * math.pi             # p1 nằm trên chiều ngược kim đồng hồ từ p0 tới p2 → đi chiều đó
    pts = _cung(ox, oy, r, a0, a0 + quet)
    pts[0], pts[-1] = p0, p2
    return pts


def _gan(p, q):
    """Hai điểm trùng nhau — cùng ngưỡng như Vec3.isclose của ezdxf (rel 1e-9, abs 1e-12)."""
    d = math.hypot(p[0] - q[0], p[1] - q[1])
    return d <= max(1e-9 * max(math.hypot(*p), math.hypot(*q)), 1e-12)


def _doan_cong(p, q, bulge):
    """Đoạn cong (bulge) từ p tới q: bulge = tan(góc ở tâm / 4), dương = ngược chiều kim đồng hồ. Trả điểm từ p tới q (gồm 2 đầu)."""
    goc = 4.0 * math.atan(bulge)
    dx, dy = q[0] - p[0], q[1] - p[1]
    c = math.hypot(dx, dy)
    if c < 1e-12 or abs(goc) < 1e-12:
        return [p, q]
    r = c / (2.0 * math.sin(abs(goc) / 2.0))
    h = (c / 2.0) / math.tan(goc / 2.0)            # khoảng cách có dấu từ trung điểm dây cung tới tâm (bên trái = dương)
    mx, my = (p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0
    cx, cy = mx - dy / c * h, my + dx / c * h
    a0 = math.atan2(p[1] - cy, p[0] - cx)
    pts = _cung(cx, cy, r, a0, a0 + goc)
    pts[0], pts[-1] = p, q                          # giữ đúng 2 đầu mút của bản vẽ
    return pts


def _vong_polyline(path):
    v = [(float(x), float(y), float(b or 0.0)) for x, y, b in path.vertices]
    if len(v) < 2:
        return []
    out = []
    n = len(v)
    cuoi = n if path.is_closed else n - 1
    for i in range(cuoi):
        x0, y0, b = v[i]
        x1, y1, _ = v[(i + 1) % n]
        if abs(b) > 1e-12:
            out.extend(_doan_cong((x0, y0), (x1, y1), b)[:-1])
        else:
            out.append((x0, y0))
    if not path.is_closed:
        out.append(v[-1][:2])
    return out


def _spline_bu(bs):
    """Bẻ đường B-spline thành đoạn thẳng mà DIỆN TÍCH KHÔNG HỤT: lấy điểm đều theo tham số, mỗi cặp đoạn dùng điểm giữa thật của
    đường cong để đặt đỉnh giữa ở 4/3 độ võng (đúng quy tắc Simpson) → phần dư/hụt mỗi đoạn bù nhau, sai số bậc 4 theo bước chia."""
    tho = [(p.x, p.y) for p in bs.flattening(SAI_SO, segments=4)]
    n = max(16, 16 * len(tho))                             # đủ mịn: dày gấp 16 lần cách chia theo độ võng (lệch < 0,000001 m²)
    pts = [(p.x, p.y) for p in bs.approximate(2 * n)]
    if len(pts) < 3:
        return tho
    out = [pts[0]]
    for k in range(0, len(pts) - 2, 2):
        a, m, b = pts[k], pts[k + 1], pts[k + 2]
        gx, gy = (a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0
        out.append((gx + (m[0] - gx) * 4.0 / 3.0, gy + (m[1] - gy) * 4.0 / 3.0))
        out.append(b)
    return out


def _canh(edge):
    """Một cạnh của đường bao → danh sách điểm (toạ độ OCS của vùng tô), đúng chiều ezdxf hiểu."""
    if isinstance(edge, LineEdge):
        return [(edge.start[0], edge.start[1]), (edge.end[0], edge.end[1])]
    if isinstance(edge, ArcEdge):
        if abs(edge.radius) <= 1e-12:
            return None
        # ezdxf đã đổi cung cùng chiều kim đồng hồ thành cung NGƯỢC chiều (start → end) lúc đọc file — như from_arc()
        a0 = math.radians(edge.start_angle)
        a1 = math.radians(edge.end_angle)
        while a1 <= a0 + 1e-12:
            a1 += 2.0 * math.pi
        if a1 - a0 > 2.0 * math.pi + 1e-9:
            a1 -= 2.0 * math.pi
        return _cung(edge.center[0], edge.center[1], abs(edge.radius), a0, a1)
    if isinstance(edge, EllipseEdge):
        if math.hypot(edge.major_axis[0], edge.major_axis[1]) <= 1e-12:
            return None
        el = edge.construction_tool()
        t0, t1 = el.start_param, el.end_param
        while t1 <= t0 + 1e-12:
            t1 += 2.0 * math.pi
        # Elip = hình tròn đơn vị bị kéo giãn (phép biến đổi affine) → diện tích mọi hình đổi CÙNG một tỉ lệ. Bẻ cung tròn đơn vị
        # bằng _cung() (đã bù diện tích) rồi kéo giãn ra elip → diện tích hình quạt elip cũng đúng tuyệt đối.
        n = _so_doan(t1 - t0, el.major_axis.magnitude)    # bán kính lớn → độ võng ≤ sai số ở mọi chỗ trên elip
        mj, mn, c = el.major_axis, el.minor_axis, el.center
        return [(c.x + mj.x * u + mn.x * v, c.y + mj.y * u + mn.y * v) for u, v in _cung_don_vi(t0, t1, n)]
    if isinstance(edge, SplineEdge):
        if len(edge.control_points):
            bs = BSpline(control_points=[Vec3(p[0], p[1], 0) for p in edge.control_points], order=edge.degree + 1,
                         knots=edge.knot_values, weights=edge.weights if edge.weights else None)
        elif len(edge.fit_points):
            tg = None
            if edge.start_tangent and edge.end_tangent:
                tg = (Vec3(edge.start_tangent[0], edge.start_tangent[1], 0), Vec3(edge.end_tangent[0], edge.end_tangent[1], 0))
            bs = fit_points_to_cad_cv([Vec3(p[0], p[1], 0) for p in edge.fit_points], tangents=tg)
        else:
            return None
        return _spline_bu(bs)
    raise TypeError(type(edge))


def _vong_canh(path):
    """Nối các cạnh thành vòng — y hệt ezdxf.path.converter.from_hatch_edge_path (kể cả chỗ hở: vòng chưa khép thì nối thẳng)."""
    vong, loop = [], None
    for edge in path.edges:
        seg = _canh(edge)
        if not seg:
            continue
        if loop is None:
            loop = list(seg)
            continue
        if _gan(loop[-1], seg[0]):
            loop.extend(seg[1:])
        elif _gan(loop[-1], seg[-1]):
            loop.extend(seg[::-1][1:])
        elif _gan(loop[0], seg[-1]):
            loop = list(seg[:-1]) + loop
        elif _gan(loop[0], seg[0]):
            loop = loop[::-1]
            loop.extend(seg[1:])
        else:
            if _gan(loop[0], loop[-1]):      # vòng đã khép → bắt đầu vòng mới
                vong.append(loop)
                loop = list(seg)
            else:                            # chỗ hở → nối thẳng rồi đi tiếp (như ezdxf từ bản 0.18)
                loop.extend(seg)
    if loop is not None:
        vong.append(loop)
    return vong


def duong_bao_hatch(e):
    """Mọi đường bao của một vùng tô HATCH → danh sách vòng [(x, y), ...] toạ độ bản vẽ (WCS), điểm cuối KHÔNG lặp điểm đầu."""
    ocs = e.ocs()
    cao = e.dxf.elevation.z if e.dxf.hasattr('elevation') else 0.0
    doi = ocs.transform
    for bp in e.paths:
        if isinstance(bp, EdgePath):
            ds = _vong_canh(bp)
        elif isinstance(bp, PolylinePath):
            ds = [_vong_polyline(bp)]
        else:
            continue
        for pts in ds:
            if doi:
                pts = [(w.x, w.y) for w in (ocs.to_wcs(Vec3(x, y, cao)) for x, y in pts)]
            while len(pts) > 1 and _gan(pts[0], pts[-1]):
                pts = pts[:-1]
            if len(pts) >= 3:
                yield pts


# ── ĐỌC HÌNH HỌC GEOPACKAGE (WKB chuẩn ISO, có đường cong) ──
def _doc(b, i, bo, fmt):
    v = struct.unpack_from(bo + fmt, b, i)
    return v, i + struct.calcsize(fmt)


def _hinh_wkb(b, i):
    """Đọc 1 hình WKB tại vị trí i → (kiểu gốc, dữ liệu, vị trí kế tiếp). Đường cong được bẻ ngay thành điểm (cung chính xác)."""
    bo = '<' if b[i] == 1 else '>'
    (t,), i = _doc(b, i + 1, bo, 'I')
    z = m = False
    if t & 0x80000000: z = True
    if t & 0x40000000: m = True
    t &= 0x0FFFFFFF
    goc = t % 1000
    if t // 1000 in (1, 3): z = True
    if t // 1000 in (2, 3): m = True
    so = 2 + int(z) + int(m)

    def diem(i):
        (n,), i = _doc(b, i, bo, 'I')
        v = struct.unpack_from(bo + 'd' * (so * n), b, i)
        return [(v[k * so], v[k * so + 1]) for k in range(n)], i + 8 * so * n

    if goc == 2:                                    # LineString
        p, i = diem(i); return goc, p, i
    if goc == 8:                                    # CircularString
        p, i = diem(i)
        out = [p[0]] if p else []
        for k in range(0, len(p) - 2, 2):
            out.extend(_cung_3_diem(p[k], p[k + 1], p[k + 2])[1:])
        return goc, out, i
    if goc == 9:                                    # CompoundCurve
        (n,), i = _doc(b, i, bo, 'I')
        out = []
        for _ in range(n):
            _, p, i = _hinh_wkb(b, i)
            out.extend(p if not out else (p[1:] if p and _gan(out[-1], p[0]) else p))
        return goc, out, i
    if goc == 3:                                    # Polygon
        (n,), i = _doc(b, i, bo, 'I')
        vong = []
        for _ in range(n):
            p, i = diem(i); vong.append(p)
        return goc, vong, i
    if goc == 10:                                   # CurvePolygon
        (n,), i = _doc(b, i, bo, 'I')
        vong = []
        for _ in range(n):
            _, p, i = _hinh_wkb(b, i); vong.append(p)
        return goc, vong, i
    if goc in (6, 12, 7):                           # MultiPolygon / MultiSurface / GeometryCollection
        (n,), i = _doc(b, i, bo, 'I')
        vong = []
        for _ in range(n):
            g, p, i = _hinh_wkb(b, i)
            if g in (3, 10, 6, 12, 7): vong.extend(p)
        return goc, vong, i
    raise ValueError('kiểu WKB chưa hỗ trợ: %d' % t)


def vong_gpkg(blob):
    """Hình học một dòng GeoPackage (vùng tô) → danh sách vòng [(x, y), ...] (cung tròn bẻ chính xác), điểm cuối không lặp điểm đầu."""
    if not blob or blob[:2] != b'GP':
        return []
    co = blob[3]
    env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}.get((co >> 1) & 7, 0)
    g, vong, _ = _hinh_wkb(blob, 8 + env)
    if g not in (3, 10, 6, 12, 7):
        return []
    ra = []
    for pts in vong:
        while len(pts) > 1 and _gan(pts[0], pts[-1]):
            pts = pts[:-1]
        if len(pts) >= 3:
            ra.append(pts)
    return ra
