# -*- coding: utf-8 -*-
# ĐỔI TỜ BẢN ĐỒ ĐỊA CHÍNH DGN V8 → GeoJSON ĐÚNG KHUÔN 147 FILE THỬA CỦA HỆ THỐNG + BẢNG ĐỐI CHIẾU VỚI THỬA ĐANG CÓ TRÊN WEB (15/10/2026).
# Chủ dự án: "mấy file thửa trích lục đó làm chuẩn như file geojson của hệ thống" — rồi dặn "vẫn giữ cái cũ lại, tôi đối chiếu đã, đừng
# bỏ hẳn" ⇒ kịch bản này CHỈ ĐỌC dữ liệu web (file web-cu.ndjson trích từ bảng dia_chinh), KHÔNG sửa gì trên web.
#
# Đầu vào: DXF do xuat_dxf_hang_loat.py xuất (MicroStation) từ bộ tờ DGN V8 xã Cam Lâm (đánh số tờ MỚI 1–399).
# Cách vẽ (đo 15/10/2026: % chiều dài nét mỗi level trùng ranh thửa web ≤ 5 cm, tờ 15 + 32 Cam Đức / tờ 60, 90, 125, 130 xã khác):
#   · RANH THỬA: Level 10 (91 % / 64 %), 23 mép khối giáp đường (96 %), 31 bờ ao / bờ ruộng (95–99 %), 32 mép mương (98 %), 1, 9 (90–100 %);
#   · LẪN LỘN (có chỗ là ranh, có chỗ không): Level 60 (44–78 %), 46, 24, 30;
#   · KHÔNG phải ranh: 14 nhà, 50, 22 mép đường nhựa, 63 lưới / khung ngoài, 55 KHUNG TRONG của tờ (thửa vắt qua mép khung vẫn vẽ trọn —
#     chỉ dùng khung để khép thửa đường / mương chạy ra ngoài tờ, ở bộ nét cuối cùng);
#   · Level 4 = số thửa (chữ dữ liệu), Level 53 = loại đất, Level 13 = ô nhãn "loại đất / số thửa / diện tích";
#   · Level 54 = TÊN CHỦ SỬ DỤNG — thông tin cá nhân, KHÔNG đọc, KHÔNG ghi ra file.
# MỖI XÃ CŨ VẼ MỘT KIỂU (khảo sát 15/10/2026): Cam Đức / Cam Hải Tây / Cam Thành Bắc ghi số thửa ở Level 4; Cam Hải Đông ở Level 51 hoặc
# chữ rời Level 13; tờ 58 Level 4 lại là SỐ CAO ĐỘ (chữ cao 17 m); một nhóm tờ (vd 139) dùng LỚP ĐẶT TÊN CHỮ (47, 52, MEPDUONG…). Nên TỰ DÒ
# THEO TỪNG TỜ: (a) nét ranh = lớp có ≥ 80 % chiều dài trùng ranh thửa web (≤ 5 cm, rải điểm 1 m) — 30–80 % là lớp "lẫn lộn" dùng ở bộ nét
# sau; web CHỈ dùng để CHỌN LỚP, hình thửa vẫn lấy từ bản vẽ; tờ không có thửa web để dò thì dùng bộ level chuẩn ở trên;
# (b) ô nhãn = khối (INSERT) ở BẤT KỲ lớp nào có số nguyên + số thập phân; (c) số thửa = lớp có số nguyên khớp nhiều nhất với số trong ô
# nhãn của chính tờ đó (bỏ chữ cao > 5 m — số cao độ / lưới).
# DỰNG THỬA "KHỚP NHÃN": dựng mặt khép kín từ từng BỘ NÉT (ít → nhiều level). Mỗi số thửa lấy mặt chứa đúng số đó; thửa có ô nhãn thì chọn
# mặt có diện tích KHỚP con số ghi trên nhãn (nhãn làm tròn 0,1 m² → sai ≤ 0,15 m²) — chính bản vẽ tự xác nhận hình nào đúng; không bộ
# nào khớp thì lấy mặt của bộ nét ít level nhất và ghi `khopNhan: false`. Mặt đã nhận không được chồng lên nhau.
#
# Toạ độ: VN-2000 Khánh Hoà (KTT 108°15', múi 3°) → WGS84 bằng đúng bộ 7 tham số lớp quy hoạch dùng, rồi CỘNG độ trượt của lớp thửa web
# (qhCompute.ts LECH_DIA_CHINH: 0,533 m Đông / 0,141 m Bắc) ⇒ CÙNG HỆ với 147 file hệ thống: thửa không đổi chồng khít thửa cũ (tờ 3, 15,
# 25, 27, 32: 2.121 thửa lệch 0 cm). Diện tích `dienTichHinh` đo trên MẶT PHẲNG VN-2000 như MicroStation.
# Số tờ: bản vẽ ghi số tờ MỚI → đổi về số tờ CŨ theo bảng dia_chinh_to (như hệ thống cất), giữ số mới ở `toMoi`.
# Đối chiếu (`doiChieu`): giong (lệch hình ≤ 5 cm, diện tích ≤ 0,1 m²) · dich (cùng hình + diện tích, chỉ TỊNH TIẾN — vd cụm 344 thửa lệch
# đúng 0,27 m Đông / 0,07 m Bắc) · khac · moi (web chưa có số thửa này) · dòng "web-co-ban-ve-khong" trong doi-chieu.csv.
#
# Dùng: python -P doc_thua_v8.py <thu_muc_dxf> <bang.json> <web-cu.ndjson> <thu_muc_ra> [to1,to2,...]
#   bang.json = {"to": {"<tờ mới>": ["<mã xã cũ>", <tờ cũ>]}, "tenXa": {"<mã>": "<tên>"}, "tenFile": {"<mã>": "<tên file hệ thống>"}}
import sys, os, re, json, csv, collections
import numpy as np
import ezdxf
import shapely
from shapely.geometry import LineString, Point, shape, mapping
from shapely.ops import unary_union, polygonize
from shapely import STRtree
from shapely.affinity import translate
from pyproj import Transformer
sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

thu_dxf, bang_p, web_p, ra = sys.argv[1:5]
chi_to = set(int(x) for x in sys.argv[5].split(',')) if len(sys.argv) > 5 else None
bang = json.load(open(bang_p, encoding='utf-8'))
VN2000 = ('+proj=tmerc +lat_0=0 +lon_0=108.25 +k=0.9999 +x_0=500000 +y_0=0 +a=6378137 +rf=298.257223563 '
          '+towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs')
VE_WGS = Transformer.from_crs(VN2000, 'EPSG:4326', always_xy=True)
VE_VN = Transformer.from_crs('EPSG:4326', VN2000, always_xy=True)
LDX, LDY = 0.000004899, 0.000001273            # độ trượt lớp thửa web (độ) — PHẢI khớp LECH_DC_X / LECH_DC_Y trong qhCompute.ts
LOI = ('Level 10', 'Level 23', 'Level 31', 'Level 32', 'Level 1', 'Level 9')
BO_NET = [LOI, LOI + ('Level 60',), LOI + ('Level 60', 'Level 46', 'Level 24', 'Level 30'),
          LOI + ('Level 60', 'Level 46', 'Level 24', 'Level 30', 'Level 55')]
MOI_LEVEL = set(x for b in BO_NET for x in b)
SAI_NHAN = 0.15                                  # m² — nhãn làm tròn 0,1
SAI_NHAN_CHAN = 0.55                             # m² — nhãn ghi diện tích SỐ CHẴN (làm tròn 1 m²)
sai_cua = lambda v: v[3] if len(v) > 3 else SAI_NHAN
GIONG_HINH_M, GIONG_DT_M2 = 0.05, 0.1

def vn_sang_he_thong(g):                          # VN-2000 (m) → WGS84 + độ trượt hệ thống
    def f(a):
        x, y = VE_WGS.transform(a[:, 0], a[:, 1])
        return np.column_stack([np.asarray(x) + LDX, np.asarray(y) + LDY])
    return shapely.transform(g, f)

def he_thong_sang_vn(g):                          # file hệ thống (WGS84 có độ trượt) → VN-2000 (m)
    return shapely.transform(g, lambda a: np.column_stack(VE_VN.transform(a[:, 0] - LDX, a[:, 1] - LDY)))

def doc_net(e, ds):
    t = e.dxftype()
    if t == 'LINE':
        a, b = e.dxf.start, e.dxf.end
        if (a[0], a[1]) != (b[0], b[1]): ds.append(LineString([(a[0], a[1]), (b[0], b[1])]))
    elif t == 'LWPOLYLINE':
        pts = [(p[0], p[1]) for p in e.get_points('xy')]
        if e.closed and len(pts) > 2: pts.append(pts[0])
        if len(pts) >= 2: ds.append(LineString(pts))
    elif t == 'POLYLINE':
        pts = [(v.dxf.location[0], v.dxf.location[1]) for v in e.vertices]
        if e.is_closed and len(pts) > 2: pts.append(pts[0])
        if len(pts) >= 2: ds.append(LineString(pts))
    elif t == 'INSERT':                           # khối (cell) đặt trên level ranh → bung ra nét
        for v in e.virtual_entities(): doc_net(v, ds)

def so_thap_phan(s):
    try: return float(s.strip().replace(',', '.'))
    except ValueError: return None

LV_SO = ('Level 4', 'Level 51', 'Level 15', 'Level 5', 'Level 13')   # lớp hay ghi số thửa (thứ tự ưu tiên khi hoà điểm)
BAN_KINH_KHOP_M = 60                                         # lượt ghép theo diện tích: mặt phải cách chỗ ghi số ≤ 60 m
# KHÔNG BAO GIỜ là ranh thửa: nhà, nét khác, lưới / khung ngoài, khung, mép đường nhựa, chữ / nhãn, tâm thửa
KHONG_RANH = ('Level 14', 'Level 50', 'Level 63', 'Level 62', 'Level 22', 'Level 13', 'Level 11')
KHONG_PHAI_SO = ('Level 63', 'Level 55', 'Level 62')         # số lưới toạ độ / số hiệu tờ / khung
BUNG_KHOI = ('Level 10', 'Level 23', 'Level 31', 'Level 32', 'Level 1', 'Level 9', 'Level 60')   # khối đặt trên level ranh → bung ra nét
def doc_to(p):
    doc = ezdxf.readfile(p); msp = doc.modelspace()
    net = collections.defaultdict(list); so_lop = collections.defaultdict(list); loai = []; nhan = {}; dem_cong = 0
    tp_lop = collections.defaultdict(list); chu_lop = collections.defaultdict(list)
    for e in msp:
        L, t = e.dxf.layer, e.dxftype()
        if t == 'INSERT':
            tx = [(v.dxf.text.strip(), v.dxf.insert) for v in e.virtual_entities() if v.dxftype() == 'TEXT' and v.dxf.text.strip()]
            ma = next((x for x, _ in tx if re.search(r'[A-Za-z]', x)), '')
            tps = [(so_thap_phan(x), q) for x, q in tx if re.fullmatch(r'\d+[.,]\d+', x)]
            nguyen = sorted(((x, q) for x, q in tx if re.fullmatch(r'\d+(-\d+)?', x)), key=lambda t: -t[1][1])   # trên xuống dưới
            sh = dt = None
            sai = SAI_NHAN
            if nguyen and tps: sh, q = nguyen[0]; dt = tps[0][0]
            elif len(nguyen) >= 2 and ma and re.fullmatch(r'\d+', nguyen[-1][0]):   # diện tích ghi số chẵn (vd tờ 337 "6804"): số trên, diện tích dưới
                (sh, q), dt = nguyen[0], float(nguyen[-1][0]); sai = SAI_NHAN_CHAN
            if sh and dt is not None:             # ô nhãn: số thửa + diện tích (+ loại đất) + CHỖ ĐẶT nhãn + sai số cho phép
                if sh not in nhan: nhan[sh] = (ma, dt, Point(q[0], q[1]), sai)
                continue
            if L not in BUNG_KHOI: continue          # ký hiệu (cây, cột điện, tâm thửa…) — không phải nét ranh
        if t in ('LINE', 'LWPOLYLINE', 'POLYLINE', 'INSERT'): doc_net(e, net[L])
        elif t in ('ARC', 'CIRCLE', 'SPLINE', 'ELLIPSE'): dem_cong += 1
        elif t == 'TEXT':
            s = e.dxf.text.strip()
            if not s: continue
            pt = Point(e.dxf.insert[0], e.dxf.insert[1]); h = e.dxf.height or 0
            if L == 'Level 53': loai.append((s, pt))
            elif L not in KHONG_PHAI_SO and h < 5:
                if re.fullmatch(r'\d+(-\d+)?', s): so_lop[L].append((s, pt, h))
                elif re.fullmatch(r'\d+[.,]\d+', s): tp_lop[L].append((so_thap_phan(s), pt, h))
                elif re.fullmatch(r'[A-Z][A-Z+,\- ]*[A-Z]', s): chu_lop[L].append((s, pt, h))
    # NHÃN RỜI (không đóng thành khối): số nguyên + số ngay DƯỚI (≤ 4 lần cỡ chữ) cùng lớp = số thửa + diện tích. Diện tích số chẵn
    # (tờ 311: "2983") chỉ nhận khi có mã loại đất ở gần — tránh ghép nhầm hai số bất kỳ.
    for L, ds in so_lop.items():
        tps = tp_lop.get(L, []); cs = chu_lop.get(L, [])
        for sh, pt, h in ds:
            if sh in nhan: continue
            hh = 4 * max(h, 0.1)
            ma = min(((pt.distance(q), c) for c, q, _ in cs if pt.distance(q) <= 2 * hh), default=(0, ''))[1]
            gan = [(pt.distance(q), dt) for dt, q, _ in tps if abs(q.x - pt.x) <= hh and 0 < pt.y - q.y <= hh]
            sai = SAI_NHAN
            if not gan and ma:
                gan = [(pt.distance(q), float(x)) for x, q, _ in ds if x != sh and re.fullmatch(r'\d+', x) and abs(q.x - pt.x) <= hh and 0 < pt.y - q.y <= hh]
                sai = SAI_NHAN_CHAN
            if gan: nhan[sh] = (ma, min(gan)[1], pt, sai)
    return net, {L: [(s, pt) for s, pt, _ in ds] for L, ds in so_lop.items()}, loai, nhan, dem_cong

def chon_lop_so(so_lop, nhan, mat_bo):
    """Lớp số thửa của tờ (xét MỌI lớp) = lớp GHÉP ĐƯỢC NHIỀU THỬA NHẤT: đếm mặt chứa đúng MỘT số của lớp đó, lấy bộ nét cho điểm cao nhất
    (tờ 113 khu phân lô: chỉ bộ nét cuối có nét chia lô); hoà thì lớp khớp nhiều số trong nhãn hơn, rồi theo thứ tự LV_SO. Lớp nhãn rời (số
    thửa + diện tích số chẵn cùng lớp) tự thua vì mặt chứa 2 số."""
    uu = lambda L: -LV_SO.index(L) if L in LV_SO else -99
    cay_bo = [(m, STRtree(m)) for m in mat_bo if m]
    diem = []
    for L, ds in so_lop.items():
        mot = 0
        for mat0, cay in cay_bo:
            trong = collections.defaultdict(set)
            for x, p in ds:
                hit = [i for i in cay.query(p) if mat0[i].contains(p)]
                if hit: trong[min(hit, key=lambda i: mat0[i].area)].add(x)
            mot = max(mot, sum(1 for v in trong.values() if len(v) == 1))
        diem.append((mot, len(set(x for x, _ in ds) & set(nhan)), uu(L), L))
    if not diem: return None
    tot = max(diem)
    if tot[0] or tot[1]: return tot[3]
    ung = [(len(so_lop.get(L, [])), uu(L), L) for L in LV_SO if so_lop.get(L)]
    return max(ung)[2] if ung else None

def lop_ranh_theo_web(net, ranh_web):
    """% chiều dài nét mỗi lớp nằm trùng ranh thửa web (≤ 5 cm) — rải điểm 1 m dọc nét. Trả (lớp chính ≥ 80 %, lớp lẫn lộn 30–80 %)"""
    if not ranh_web: return None, None
    cay = STRtree(ranh_web); chinh, lan = [], []
    for L, ds in net.items():
        dai = sum(g.length for g in ds)
        if dai < 50: continue                      # lớp ít nét (ký hiệu, chữ gạch chân…) — không xét
        pts = []
        for g in ds:
            n = max(2, int(g.length) + 1)
            pts.extend(shapely.line_interpolate_point(g, np.linspace(0, g.length, n)))
        trung = cay.query(np.array(pts, dtype=object), predicate='dwithin', distance=0.05)
        ti_le = len(set(trung[0].tolist())) / len(pts)
        if ti_le >= 0.8: chinh.append(L)
        elif ti_le >= 0.3: lan.append(L)
    return tuple(sorted(chinh)), tuple(sorted(lan))

def dung_bo(net, bo_net):
    """Mỗi bộ nét → danh sách mặt khép kín (dựng một lần, dùng cho cả chọn lớp số, ghép theo số, ghép theo diện tích)"""
    ra_bo = []
    for bo in bo_net:
        ds = [g for L in bo for g in net[L]]
        ra_bo.append([m for m in polygonize(unary_union(ds)) if m.area > 0.01] if ds else [])
    return ra_bo

def ung_vien(mat_bo, so):
    """Mỗi bộ nét → {số thửa: mặt (gộp các chỗ ghi số đó) — chỉ khi mỗi mặt chứa DUY NHẤT số đó}"""
    ra_bo = []
    for mat in mat_bo:
        if not mat: ra_bo.append({}); continue
        cay = STRtree(mat); trong = collections.defaultdict(set); cho = collections.defaultdict(set)
        for s, p in so:
            hit = [i for i in cay.query(p) if mat[i].contains(p)]
            if hit:
                i = min(hit, key=lambda i: mat[i].area); trong[i].add(s); cho[s].add(i)
            else: cho[s].add(-1)
        kq = {}
        for s, ids in cho.items():
            if -1 in ids or any(len(trong[i]) != 1 for i in ids): continue
            kq[s] = unary_union([mat[i] for i in ids])
        ra_bo.append(kq)
    return ra_bo

# ── thửa web để đối chiếu ──
web_so = collections.defaultdict(list); web_to = collections.defaultdict(list)
with open(web_p, encoding='utf-8') as f:
    for d in (json.loads(x) for x in f if x.strip()):
        web_so[(d['xa'], str(d['to']), str(d['thua']))].append(d); web_to[(d['xa'], str(d['to']))].append(d)
print('thua web doc vao:', sum(len(v) for v in web_to.values()))

os.makedirs(os.path.join(ra, 'geojson'), exist_ok=True)
ra_xa = collections.defaultdict(list); dong_dc = []; tong = []; khong_dung = []
tep = sorted((f for f in os.listdir(thu_dxf) if re.fullmatch(r'dc\d+\.dxf', f.lower())), key=lambda f: int(re.sub(r'\D', '', f)))
for f in tep:
    N = int(re.sub(r'\D', '', f))
    if chi_to and N not in chi_to: continue
    if str(N) not in bang['to']: print('BO QUA', f, '(khong co trong bang doi so to)'); continue
    xa_cu, to_cu = bang['to'][str(N)][0], str(bang['to'][str(N)][1])
    net, so_lop, loai, nhan, dem_cong = doc_to(os.path.join(thu_dxf, f))
    ranh_web = [he_thong_sang_vn(shape(w['g'])).boundary for w in web_to.get((xa_cu, to_cu), [])]
    chinh, lan = lop_ranh_theo_web(net, ranh_web)
    # bộ nét: (0) CHỈ level ranh chuẩn → (1) + lớp dò theo web ≥ 80 % → (2) + lớp lẫn lộn → (3) + 46/24/30 → (4) + khung tờ / ranh khu.
    # Bộ đầu KHÔNG gộp lớp dò theo web: tờ 16 dò ra cả level 3/60/61 (trùng ranh ở chỗ này, chỗ khác chia ngang thửa) → nếu gộp ngay từ
    # đầu thì không còn bộ nào dựng đúng thửa bị chia, khớp nhãn tụt 341/404. Tờ đất rừng (web ít thửa) vẫn có level chuẩn ở bộ đầu.
    co = lambda ds: tuple(x for x in dict.fromkeys(ds) if x in net)
    b0 = co(LOI)
    b1 = co(b0 + tuple(chinh or ()))
    b2 = co(b1 + ('Level 60',) + tuple(lan or ()))
    b3 = co(b2 + ('Level 46', 'Level 24', 'Level 30'))
    b4 = co(b3 + ('Level 55', 'Level 49'))     # khung tờ + ranh khu: chỉ để khép thửa đường / mương / rừng chạm mép
    # (5) BỘ NÉT CUỐI = mọi lớp có nét ≥ 50 m trừ KHONG_RANH — chỉ dùng khi diện tích KHỚP NHÃN (tờ 113: khu phân lô chia lô bằng
    # level 12, mà ở Cam Đức level 12 lại là nét khác, nên không thể cho vào bộ nét thường)
    b5 = co(b4 + tuple(sorted(L for L, ds in net.items() if L not in KHONG_RANH and sum(g.length for g in ds) >= 50)))
    cac_bo = [b0, b1, b2, b3, b4, b5]
    bo_net = [b for i, b in enumerate(cac_bo) if b and b not in cac_bo[:i]]
    k_chi_khop = len(bo_net) - 1 if b5 and b5 not in cac_bo[:5] else -1   # bộ nét cuối: chỉ nhận mặt khớp nhãn
    mat_bo = dung_bo(net, bo_net)
    lop_so = chon_lop_so(so_lop, nhan, mat_bo); so = so_lop.get(lop_so, [])
    uv = ung_vien(mat_bo, so)
    # số thửa của tờ = số ở LỚP SỐ THỬA (đếm, báo chưa dựng). Số chỉ có ở NHÃN (thửa nhỏ ghi nhãn ngoài thửa, bảng "ghi chú các thửa đất
    # nhỏ" bên lề) chỉ thử ở lượt ghép theo diện tích — ghép không được thì bỏ qua, không báo (tờ 139: 75 số là bảng ghi chú bên lề).
    diem_so = {}
    for x, p in so: diem_so.setdefault(x, p)
    cac_so = list(diem_so)
    nhan_ngoai = [x for x, v in nhan.items() if x not in diem_so and len(v) > 2 and v[2] is not None]
    for x in nhan_ngoai: diem_so[x] = nhan[x][2]
    cach = {}
    # chọn mặt: (1) thửa có nhãn — bộ nét ít level nhất mà diện tích khớp nhãn; (2) còn lại — bộ nét ít level nhất có mặt
    chon = {}
    for s in cac_so:
        dtn = nhan.get(s, ('', None))[1]
        if dtn is None: continue
        for k, kq in enumerate(uv):
            if s in kq and abs(kq[s].area - dtn) <= sai_cua(nhan[s]): chon[s] = (kq[s], k, True); break
    da = unary_union([g for g, *_ in chon.values()]) if chon else None
    for s in cac_so:
        if s in chon: continue
        for k, kq in enumerate(uv):
            if s not in kq or k == k_chi_khop: continue
            g = kq[s]
            if da is not None and g.intersection(da).area > max(0.5, 0.01 * g.area): continue
            dtn = nhan.get(s, ('', None))[1]
            chon[s] = (g, k, None if dtn is None else False); da = g if da is None else unary_union([da, g]); break
    # LƯỢT GHÉP THEO DIỆN TÍCH: số còn sót mà có diện tích nhãn → mặt (mọi bộ nét) trong vòng BAN_KINH_KHOP_M quanh chỗ ghi số / nhãn,
    # diện tích khớp nhãn (≤ SAI_NHAN), không chứa số thửa KHÁC, không đè thửa đã nhận; nhiều mặt thì lấy mặt gần nhất.
    moi_diem = [p for _, p in so] + [v[2] for v in nhan.values() if len(v) > 2 and v[2] is not None]
    cay_bo = [STRtree(m) if m else None for m in mat_bo]
    for s in cac_so + nhan_ngoai:
        if s in chon or nhan.get(s, ('', None))[1] is None: continue
        dtn = nhan[s][1]; goc = [diem_so[s]] + ([nhan[s][2]] if len(nhan[s]) > 2 and nhan[s][2] is not None else [])
        ung = []
        for k, (mat, cay) in enumerate(zip(mat_bo, cay_bo)):
            if cay is None: continue
            for g0 in goc:
                for i in cay.query(g0.buffer(BAN_KINH_KHOP_M)):
                    m = mat[i]
                    if abs(m.area - dtn) > sai_cua(nhan[s]): continue
                    so_trong = set(x for x, p in so if m.contains(p)) | set(x for x, v in nhan.items() if len(v) > 2 and v[2] is not None and m.contains(v[2]))
                    if so_trong - {s}: continue
                    if da is not None and m.intersection(da).area > 0.5: continue
                    ung.append((m.distance(g0), k, m))
        if ung:
            _, k, m = min(ung, key=lambda t: (t[0], t[1]))
            chon[s] = (m, k, True); cach[s] = 'khop-dien-tich'; da = m if da is None else unary_union([da, m])
    for s in cac_so:
        if s not in chon:
            p = diem_so[s]
            khong_dung.append({'toMoi': N, 'xaCu': xa_cu, 'toCu': to_cu, 'thua': s, 'x': round(p.x, 2), 'y': round(p.y, 2)})
    dem = collections.Counter(); gap_web = set()
    vung_to = unary_union([g for g, *_ in chon.values()]).buffer(0.5) if chon else None
    for s, (g, k, khop) in chon.items():
        if g.geom_type == 'MultiPolygon' and len(g.geoms) == 1: g = g.geoms[0]
        p_so = diem_so[s]
        ma_trong = [(x, q.distance(p_so)) for x, q in loai if g.contains(q)]
        ma = min(ma_trong, key=lambda t: t[1])[0] if ma_trong else nhan.get(s, ('', None))[0]
        dt_nhan = nhan.get(s, ('', None))[1]; dt_hinh = g.area
        prop = {'to': to_cu, 'thua': s, 'xa': bang['tenXa'][xa_cu], 'xaId': xa_cu,
                'dienTich_m2': dt_nhan if dt_nhan is not None else round(dt_hinh, 1), 'mucDichSuDung': ma, 'nhan': f'Tờ {to_cu}, thửa {s}',
                'toMoi': str(N), 'dienTichHinh': round(dt_hinh, 2), 'nguon': f'dc{N}.dgn', 'boNet': k + 1}
        if khop is not None: prop['khopNhan'] = khop
        if s in cach: prop['cachDung'] = cach[s]
        ws = web_so.get((xa_cu, to_cu, s), [])
        if ws:
            gap_web.update(w['id'] for w in ws)
            ss = []
            for w in ws:
                wv = he_thong_sang_vn(shape(w['g']))
                ss.append((g.hausdorff_distance(wv), abs(dt_hinh - wv.area), wv, w))
            h, ddt, wv, w = min(ss, key=lambda t: t[0])
            dx = dy = 0.0
            if h <= GIONG_HINH_M and ddt <= GIONG_DT_M2: tt = 'giong'
            else:
                c8, cw = g.centroid, wv.centroid; dx, dy = c8.x - cw.x, c8.y - cw.y
                tt = 'dich' if ddt <= GIONG_DT_M2 and g.hausdorff_distance(translate(wv, dx, dy)) <= GIONG_HINH_M else 'khac'
            prop.update({'doiChieu': tt, 'lechHinh_m': round(h, 3), 'dienTichWeb': round(wv.area, 2), 'idWeb': w['id']})
            if tt == 'dich': prop['dich_m'] = [round(dx, 3), round(dy, 3)]
        else:
            tt = 'moi'; prop['doiChieu'] = 'moi'
        dem[tt] += 1
        ra_xa[xa_cu].append({'type': 'Feature', 'geometry': mapping(vn_sang_he_thong(g)), 'properties': prop})
        dong_dc.append([N, bang['tenXa'][xa_cu], to_cu, s, tt, ma, '' if dt_nhan is None else dt_nhan, round(dt_hinh, 2),
                        prop.get('dienTichWeb', ''), round(dt_hinh - prop['dienTichWeb'], 2) if 'dienTichWeb' in prop else '',
                        prop.get('lechHinh_m', ''), ' '.join(map(str, prop.get('dich_m', []))), k + 1, '' if khop is None else ('co' if khop else 'KHONG')])
    for w in web_to.get((xa_cu, to_cu), []):      # thửa web cùng tờ cũ, nằm trong vùng tờ này mà bản vẽ không có
        if w['id'] in gap_web or vung_to is None: continue
        if vung_to.contains(he_thong_sang_vn(shape(w['g'])).representative_point()):
            dem['web-co-ban-ve-khong'] += 1
            dong_dc.append([N, bang['tenXa'][xa_cu], to_cu, w['thua'], 'web-co-ban-ve-khong', w.get('mdsd') or '', '', '', w.get('dt') or '', '', '', '', '', ''])
    co_nhan = sum(1 for s in chon if nhan.get(s, ('', None))[1] is not None)
    khop_nhan = sum(1 for s, (_, _, kh) in chon.items() if kh)
    them_nhan = sum(1 for x in nhan_ngoai if x in chon)
    tong.append({'toMoi': N, 'xaCu': bang['tenXa'][xa_cu], 'toCu': to_cu, 'lopSo': lop_so, 'lopRanh': list(bo_net[0]),
                 'lopLan': [x for x in bo_net[-1] if x not in bo_net[0]], 'soThuaBanVe': len(cac_so) + them_nhan, 'dungDuoc': len(chon),
                 'chuaDung': len(cac_so) - (len(chon) - them_nhan), 'dungTuNhan': them_nhan, 'coNhanDienTich': co_nhan, 'khopNhan': khop_nhan, 'congTron': dem_cong, **dem})
    print(f"to {N:3d} ({bang['tenXa'][xa_cu]} to {to_cu}) [so: {lop_so} | ranh: {','.join(x.replace('Level ', '') for x in bo_net[0])}]: "
          f"so {len(cac_so) + them_nhan}, dung {len(chon)}, chua {len(cac_so) - (len(chon) - them_nhan)}, "
          f"khop nhan {khop_nhan}/{co_nhan} | " + ', '.join(f'{k} {v}' for k, v in sorted(dem.items())))

for xa, fs in ra_xa.items():
    p = os.path.join(ra, 'geojson', bang['tenFile'][xa])
    with open(p + '.tmp', 'w', encoding='utf-8', newline='\n') as fo:
        json.dump({'type': 'FeatureCollection', 'name': bang['tenXa'][xa] + ' — bản đồ V8',
                   'crs': {'type': 'name', 'properties': {'name': 'urn:ogc:def:crs:OGC:1.3:CRS84'}}, 'features': fs}, fo, ensure_ascii=False)
    os.replace(p + '.tmp', p); print('ghi', p, len(fs), 'thua')
with open(os.path.join(ra, 'doi-chieu.csv'), 'w', encoding='utf-8-sig', newline='') as fo:
    w = csv.writer(fo); w.writerow(['to_moi', 'xa_cu', 'to_cu', 'thua', 'doi_chieu', 'loai_dat_ban_ve', 'dien_tich_nhan', 'dien_tich_hinh_ban_ve',
                                    'dien_tich_web', 'chenh_dien_tich', 'lech_hinh_m', 'dich_m', 'bo_net', 'khop_nhan']); w.writerows(dong_dc)
with open(os.path.join(ra, 'chua-dung-duoc.csv'), 'w', encoding='utf-8-sig', newline='') as fo:
    w = csv.DictWriter(fo, ['toMoi', 'xaCu', 'toCu', 'thua', 'x', 'y']); w.writeheader(); w.writerows(khong_dung)
json.dump(tong, open(os.path.join(ra, 'tong-hop.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
c = collections.Counter()
for t in tong:
    for k in ('soThuaBanVe', 'dungDuoc', 'chuaDung', 'coNhanDienTich', 'khopNhan', 'giong', 'dich', 'khac', 'moi', 'web-co-ban-ve-khong'): c[k] += t.get(k, 0)
print('TONG:', dict(c))
