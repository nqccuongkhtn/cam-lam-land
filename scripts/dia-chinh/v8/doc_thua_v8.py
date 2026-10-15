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
import sys, os, re, json, csv, collections, itertools
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
# tờ lấy từ NGOÀI bộ chính (vd 303 / 313 / 314 nằm lẻ ở thư mục cha) — ghi rõ nguồn: <thu_muc_dxf>/nguon.json {"303": "…/dc303.dgn"}
_p_nguon = os.path.join(thu_dxf, 'nguon.json')
NGUON_RIENG = json.load(open(_p_nguon, encoding='utf-8')) if os.path.exists(_p_nguon) else {}
# tờ mà NỘI DUNG bản vẽ là một tờ cũ KHÁC bảng tra số tờ (dia_chinh_to) — <thu_muc_dxf>/to-cu-theo-ban-ve.json {"396": ["22471", 16, "căn cứ"]}.
# 15/10/2026: tờ 396 / 397 / 398 — 100 % thửa nằm trên thửa web Cam An Nam tờ 16 / tờ 17 / Cam An Bắc tờ 21 (tiêu đề dc398 ghi "xã Cam An
# Bắc - Tờ số 21") trong khi bảng tra ghi Cam An Nam 15 / 16 / 17. Đối chiếu theo tờ của BẢN VẼ, giữ số theo bảng ở `toCuBangTra`.
_p_sua = os.path.join(thu_dxf, 'to-cu-theo-ban-ve.json')
SUA_TO = json.load(open(_p_sua, encoding='utf-8')) if os.path.exists(_p_sua) else {}
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
# Mặt KHÔNG có nhãn xác nhận mà rộng quá 150 ha thì không nhận (15/10 tối): tờ 386 "thửa 345" 6.297 ha, tờ 246 "thửa 332" 4.727 ha, tờ 120
# "thửa 83" 860 ha là ô bao cả vùng tờ. Thửa khớp nhãn lớn nhất cả xã chỉ 75 ha; thửa khớp nhãn thì không giới hạn.
MAT_TOI_DA_KHONG_NHAN_M2 = 1_500_000
# KHÔNG BAO GIỜ là ranh thửa: nhà, nét khác, lưới / khung ngoài, khung, mép đường nhựa, chữ / nhãn, tâm thửa
KHONG_RANH = ('Level 14', 'Level 50', 'Level 63', 'Level 62', 'Level 22', 'Level 13', 'Level 11')
KHONG_PHAI_SO = ('Level 63', 'Level 55', 'Level 62')         # số lưới toạ độ / số hiệu tờ / khung
BUNG_KHOI = ('Level 10', 'Level 23', 'Level 31', 'Level 32', 'Level 1', 'Level 9', 'Level 60')   # khối đặt trên level ranh → bung ra nét
LOP_TEN_CHU = ('Level 54', 'KHUNGTHU')           # lớp TÊN CHỦ SỬ DỤNG — bỏ qua hẳn, không đọc
# Mã loại đất trong ô nhãn: chữ HOA không dấu / số, nối bằng + . , / - (ONT+LNQ, 2L, R.T.P…), không dấu cách, ≤ 12 ký tự. 15/10/2026 tối:
# ô nhãn một số tờ có cả dòng TÊN CHỦ (vd khối N_THUA tờ 210) — bản đầu lấy "chữ đầu tiên có chữ cái" làm loại đất nên ghi nhầm 270 tên người
# vào cột loại đất ⇒ chỉ nhận đúng dạng mã, mọi dòng chữ khác bỏ ngay, không lưu.
MA_LOAI = re.compile(r'[A-Z0-9]+([+.,/-][A-Z0-9]+)*')
la_ma_loai = lambda x: len(x) <= 12 and bool(re.search(r'[A-Z]', x)) and bool(MA_LOAI.fullmatch(x))
def bo_so_trong_bang(ds):
    """Bỏ số nằm trong BẢNG (bảng thống kê thửa / diện tích): ≥ 8 số cùng lớp THẲNG HÀNG tuyệt đối — cùng toạ độ Y (một hàng) hoặc cùng X (một
    cột) trong phạm vi 5 % cỡ chữ. Tờ 344: bảng 2 hàng ~120 số nằm TRONG khung dưới đáy tờ; tờ 247: bảng cột bên lề. Số thửa ghi tay theo
    từng thửa không bao giờ thẳng hàng như vậy."""
    if len(ds) < 8: return ds
    bo = set()
    for truc in (0, 1):
        thu_tu = sorted(range(len(ds)), key=lambda i: (ds[i][1].x, ds[i][1].y)[truc])
        nhom = [thu_tu[0]]
        for i in thu_tu[1:] + [None]:
            if i is not None:
                a, b = ds[nhom[-1]], ds[i]
                if abs((b[1].x, b[1].y)[truc] - (a[1].x, a[1].y)[truc]) <= 0.05 * max(a[2], b[2], 0.1): nhom.append(i); continue
            if len(nhom) >= 8: bo.update(nhom)
            if i is not None: nhom = [i]
    return [x for k, x in enumerate(ds) if k not in bo]

def tim_khung(net, diem_so):
    """KHUNG TRONG của tờ = lớp có các đoạn NGANG / ĐỨNG dài (≥ 200 m) mà tổng chiều dài ≈ chu vi khung bao của chính chúng (0,9–1,15 lần —
    4 cạnh, không phải lưới km) và chứa ≥ 50 % số của tờ (tờ 247: bảng bên lề chiếm 1/3 số); nhiều lớp thì lấy khung NHỎ nhất. Mỗi tờ vẽ khung ở lớp khác nhau (tờ 16: Level
    55, 1 × 1 km; tờ 247 / 344 / 59 tỷ lệ nhỏ: Level 60, 9 × 7 km) nên phải nhận theo HÌNH."""
    if not diem_so: return None
    ung = []
    for L, ds in net.items():
        doan = []
        for g in ds:
            c = list(g.coords)
            for a, b in zip(c, c[1:]):
                l = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
                if l >= 200 and (abs(a[0] - b[0]) < 0.01 * l or abs(a[1] - b[1]) < 0.01 * l): doan.append((a, b, l))
        if len(doan) < 4: continue
        xs = [q[0] for a, b, _ in doan for q in (a, b)]; ys = [q[1] for a, b, _ in doan for q in (a, b)]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        cv = 2 * ((x1 - x0) + (y1 - y0))
        if (x1 - x0) * (y1 - y0) < 1e5 or not 0.9 <= sum(l for *_, l in doan) / cv <= 1.15: continue
        if sum(1 for q in diem_so if x0 <= q.x <= x1 and y0 <= q.y <= y1) >= 0.5 * len(diem_so): ung.append(((x1 - x0) * (y1 - y0), (x0, y0, x1, y1)))
    return min(ung)[1] if ung else None

def doc_to(p):
    doc = ezdxf.readfile(p); msp = doc.modelspace()
    net = collections.defaultdict(list); so_lop = collections.defaultdict(list); loai = []; nhan = {}; dem_cong = 0
    tp_lop = collections.defaultdict(list); chu_lop = collections.defaultdict(list)
    for e in msp:
        L, t = e.dxf.layer, e.dxftype()
        if L in LOP_TEN_CHU: continue
        if t == 'INSERT':
            tx = [(v.dxf.text.strip(), v.dxf.insert) for v in e.virtual_entities() if v.dxftype() == 'TEXT' and v.dxf.text.strip()]
            tx = [(x, q) for x, q in tx if la_ma_loai(x) or re.fullmatch(r'\d+([.,]\d+|-\d+)?', x)]   # chỉ giữ mã loại đất + con số
            ma = next((x for x, _ in tx if la_ma_loai(x)), '')
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
            if L == 'Level 53':                   # lớp loại đất — có tờ ghi lẫn tên cơ quan / chữ khác: chỉ nhận đúng dạng mã
                if la_ma_loai(s): loai.append((s, pt))
            elif L not in KHONG_PHAI_SO:
                # Chữ cao >= 5 m xét RIÊNG thành lớp "<lớp>~lon": tờ tỷ lệ nhỏ (Cam Hòa, Suối Tân, Cam Hiệp miền núi, Cam Hải Đông 58–59…)
                # ghi số thửa Level 13 cao 18 m — bản đầu bỏ hết chữ >= 5 m (vì số cao độ tờ 58 cao 17 m) nên tờ 247 chỉ đọc được 54 / 289 số.
                # Tách riêng thì số cao độ (Level 4~lon) và số thửa chữ lớn (Level 13~lon) tự thi nhau ở chon_lop_so như mọi lớp khác.
                Lk = L if h < 5 else L + '~lon'
                if re.fullmatch(r'\d{1,6}(-\d+)?', s): so_lop[Lk].append((s, pt, h))   # ≤ 6 chữ số (diện tích số chẵn tới 99 ha vẫn cần để ghép nhãn); "3276109" là số toạ độ
                elif re.fullmatch(r'\d+[.,]\d+', s): tp_lop[Lk].append((so_thap_phan(s), pt, h))
                elif la_ma_loai(s):
                    chu_lop[Lk].append((s, pt, h))
                    if Lk.endswith('~lon'): loai.append((s, pt))   # tờ chữ lớn: mã loại đất ghi cạnh số thửa (lớp 13), không ở lớp 53
    # BẢNG BÊN LỀ: số nằm NGOÀI khung trong của tờ (Level 55) là bảng thống kê / bảng diện tích (tờ 247: cột "1 917, 2 1486…" ngoài khung)
    # → bỏ. Chỉ tính khung khi nó chứa ≥ 80 % số của tờ — có tờ Level 55 không phải khung thì thôi. Việc LỌC làm ở vòng chính sau khi dựng
    # mặt (loc_ngoai_khung) để giữ số của thửa vắt qua mép khung.
    for L in [k for k in so_lop if k.endswith('~lon')]: so_lop[L] = bo_so_trong_bang(so_lop[L])   # chỉ tờ chữ lớn: khu phân lô chữ nhỏ có số lô
    #   xếp thẳng hàng tuyệt đối (tờ 88, 64, 385…: mất 1–4 thửa giống web khi áp cho mọi lớp)
    khung = tim_khung(net, [q for ds in so_lop.values() for _, q, _ in ds])
    # TỜ CHỮ LỚN (lớp "~lon"): nhãn = SỐ THỬA ở trên + DIỆN TÍCH SỐ CHẴN ngay dưới (lệch xuống 0,8–2,2 cỡ chữ, ngang ≤ 1,5 cỡ chữ, cùng cỡ),
    # thường KHÔNG kèm mã loại đất (tờ 247: "101" trên "25722", "99" trên "4327"). Số làm diện tích phải BỎ khỏi danh sách số thửa — không thì
    # mặt nào cũng chứa 2 số và không thửa nào dựng được (tờ 247 từng 52 / 444). Xét từ trên xuống nên số thửa luôn được xét trước số diện tích.
    for L in [k for k in so_lop if k.endswith('~lon')]:
        ds = sorted(so_lop[L], key=lambda t: -t[1].y); la_dt = set(); cs = chu_lop.get(L, [])
        for i, (sh, pt, h) in enumerate(ds):
            if i in la_dt or (khung and not (khung[0] <= pt.x <= khung[2] and khung[1] <= pt.y <= khung[3])): continue
            ung = [(pt.distance(q), j) for j, (x, q, h2) in enumerate(ds) if j != i and j not in la_dt and re.fullmatch(r'\d+', x)
                   and abs(h2 - h) <= 0.3 * h and abs(q.x - pt.x) <= 1.5 * h and 0.8 * h <= pt.y - q.y <= 2.2 * h]
            if not ung: continue
            j = min(ung)[1]; la_dt.add(j)
            if sh not in nhan:
                ma = min(((pt.distance(q), c) for c, q, _ in cs if pt.distance(q) <= 4 * h), default=(0, ''))[1]
                nhan[sh] = (ma, float(ds[j][0]), pt, SAI_NHAN_CHAN)
        so_lop[L] = [x for k, x in enumerate(ds) if k not in la_dt]
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
    return net, {L: [(s, pt) for s, pt, _ in ds] for L, ds in so_lop.items()}, loai, nhan, dem_cong, khung

def loc_ngoai_khung(so_lop, khung, mat_bo, chi_khop):
    """Bỏ số nằm NGOÀI khung trong của tờ (bảng thống kê bên lề), TRỪ số nằm trong một mặt khép kín (bộ nét bất kỳ) — tờ có vẽ cả thửa
    nằm ngoài khung (tờ 16 Thửa 357: cả thửa ngoài khung 13–60 m, web vẫn có ở tờ 16, giống hệt). Bảng bên lề kẻ bằng lớp không phải ranh
    (13, 63…) nên số trong bảng không nằm trong mặt nào."""
    if not khung: return so_lop
    x0, y0, x1, y1 = khung
    cay = [(m, STRtree(m)) for m in mat_bo if m]   # mọi bộ nét, kể cả bộ chỉ-khớp-nhãn: lô sát đường ở mép tờ chỉ khép được khi có mép đường
    def giu(q):
        if x0 <= q.x <= x1 and y0 <= q.y <= y1: return True
        return any(m[i].contains(q) for m, c in cay for i in c.query(q))
    return {L: [(x, q) for x, q in ds if giu(q)] for L, ds in so_lop.items()}

def chon_lop_so(so_lop, nhan, mat_bo):
    """Lớp số thửa của tờ (xét MỌI lớp) = lớp GHÉP ĐƯỢC NHIỀU THỬA NHẤT: đếm mặt chứa đúng MỘT số của lớp đó, lấy bộ nét cho điểm cao nhất
    (tờ 113 khu phân lô: chỉ bộ nét cuối có nét chia lô); hoà thì lớp khớp nhiều số trong nhãn hơn, rồi theo thứ tự LV_SO. Lớp nhãn rời (số
    thửa + diện tích số chẵn cùng lớp) tự thua vì mặt chứa 2 số."""
    uu = lambda L: -LV_SO.index(L) if L in LV_SO else -99
    cay_bo = [(m, STRtree(m)) for m in mat_bo if m]
    co_nhan = len(nhan) >= 3      # tờ có nhãn: chỉ tính điểm số CÓ TRONG NHÃN — tờ 314 lớp "_0" chứa số lưới / thước / bảng ghi chú rải
                                  # khắp nơi nên "mặt chứa đúng một số" nhiều hơn cả lớp số thật (level 4)
    # … và số phải nằm GẦN chính nhãn của nó (≤ BAN_KINH_KHOP_M): tờ 210 (tờ gần trống, 17 thửa) lớp "_0" là BẢNG thửa biến động + lưới
    # toạ độ — ô bảng khép thành mặt, mỗi ô một số trùng số thửa có nhãn (3, 4, 5…) ⇒ "_0" thắng, báo 119 số / hụt 104. Bảng nằm xa nhãn.
    gan = lambda x, p: not co_nhan or (x in nhan and nhan[x][2] is not None and nhan[x][2].distance(p) <= BAN_KINH_KHOP_M)
    diem = []
    for L, ds in so_lop.items():
        mot = 0
        for mat0, cay in cay_bo:
            trong = collections.defaultdict(set); dat = set()
            for x, p in ds:
                hit = [i for i in cay.query(p) if mat0[i].contains(p)]
                if hit:
                    i = min(hit, key=lambda i: mat0[i].area); trong[i].add(x)
                    if gan(x, p): dat.add((i, x))
            mot = max(mot, sum(1 for i, v in trong.items() if len(v) == 1 and (i, next(iter(v))) in dat))
        diem.append((mot, len(set(x for x, p in ds if x in nhan and gan(x, p))), uu(L), L))
    if not diem: return None
    tot = max(diem)
    if tot[0] or tot[1]: return tot[3]
    ung = [(len(so_lop.get(L, [])), uu(L), L) for L in LV_SO if so_lop.get(L)]
    return max(ung)[2] if ung else None

def lop_ranh_theo_web(net, ranh_web):
    """% chiều dài nét mỗi lớp nằm trùng ranh thửa web (≤ 5 cm) — rải điểm 1 m dọc nét. Trả (lớp chính ≥ 80 %, lớp lẫn lộn 30–80 %,
    lớp KHÔNG BAO GIỜ là ranh ở tờ này: dài ≥ 2 km mà trùng < 2 % — vd tờ 247 / 344 miền núi: Level 1 là ĐƯỜNG ĐỒNG MỨC (75 km, 0 %)
    cắt ngang mọi thửa; chỉ áp khi web có ≥ 20 thửa và có lớp trùng ≥ 30 % — web lệch cả tờ thì không xét)"""
    if not ranh_web: return None, None, ()
    cay = STRtree(ranh_web); chinh, lan = [], []; ti = {}
    for L, ds in net.items():
        dai = sum(g.length for g in ds)
        if dai < 50: continue                      # lớp ít nét (ký hiệu, chữ gạch chân…) — không xét
        pts = []
        for g in ds:
            n = max(2, int(g.length) + 1)
            pts.extend(shapely.line_interpolate_point(g, np.linspace(0, g.length, n)))
        trung = cay.query(np.array(pts, dtype=object), predicate='dwithin', distance=0.05)
        ti_le = len(set(trung[0].tolist())) / len(pts); ti[L] = (ti_le, dai)
        if ti_le >= 0.8: chinh.append(L)
        elif ti_le >= 0.3: lan.append(L)
    bo = ()
    if len(ranh_web) >= 20 and max((v[0] for v in ti.values()), default=0) >= 0.3:
        bo = tuple(sorted(L for L, (t, d) in ti.items() if t < 0.02 and d >= 2000))
    return tuple(sorted(chinh)), tuple(sorted(lan)), bo

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
    to_bang = None
    if str(N) in SUA_TO:
        to_bang = f"{bang['tenXa'].get(xa_cu, xa_cu)} tờ {to_cu}"
        xa_cu, to_cu = str(SUA_TO[str(N)][0]), str(SUA_TO[str(N)][1])
    net, so_lop, loai, nhan, dem_cong, khung = doc_to(os.path.join(thu_dxf, f))
    web_pg = [(he_thong_sang_vn(shape(w['g'])), w) for w in web_to.get((xa_cu, to_cu), [])]
    ranh_web = [pg.boundary for pg, _ in web_pg]
    cay_web = STRtree([pg for pg, _ in web_pg]) if web_pg else None
    chinh, lan, bo_lop = lop_ranh_theo_web(net, ranh_web)
    # bộ nét: (0) CHỈ level ranh chuẩn → (1) + lớp dò theo web ≥ 80 % → (2) + lớp lẫn lộn → (3) + 46/24/30 → (4) + khung tờ / ranh khu.
    # Bộ đầu KHÔNG gộp lớp dò theo web: tờ 16 dò ra cả level 3/60/61 (trùng ranh ở chỗ này, chỗ khác chia ngang thửa) → nếu gộp ngay từ
    # đầu thì không còn bộ nào dựng đúng thửa bị chia, khớp nhãn tụt 341/404. Tờ đất rừng (web ít thửa) vẫn có level chuẩn ở bộ đầu.
    co = lambda ds: tuple(x for x in dict.fromkeys(ds) if x in net)
    # lớp "không bao giờ là ranh ở tờ này" (bo_lop, vd đường đồng mức Level 1 ở tờ miền núi) chỉ bỏ khỏi bộ LÕI (bộ 5 / 6 chỉ nhận mặt khớp
    # nhãn nên nét thừa ở đó vô hại, còn bỏ thì tờ 222 / 385 mất thửa ghép mặt giống web) —
    # KHÔNG bỏ các lớp khép thửa thêm vào có chủ đích (60, 46, 24, 30, khung 55, ranh khu 49, mép đường 50 / 22): tờ 88, 17, 64, 385 từng mất
    # 1–4 thửa giống web khi bỏ cả những lớp đó.
    b0 = co(tuple(x for x in LOI if x not in bo_lop))
    b1 = co(b0 + tuple(chinh or ()))
    b2 = co(b1 + ('Level 60',) + tuple(lan or ()))
    b3 = co(b2 + ('Level 46', 'Level 24', 'Level 30'))
    b4 = co(b3 + ('Level 55', 'Level 49'))     # khung tờ + ranh khu: chỉ để khép thửa đường / mương / rừng chạm mép
    # (5) BỘ NÉT CUỐI = mọi lớp có nét ≥ 50 m trừ KHONG_RANH — chỉ dùng khi diện tích KHỚP NHÃN (tờ 113: khu phân lô chia lô bằng
    # level 12, mà ở Cam Đức level 12 lại là nét khác, nên không thể cho vào bộ nét thường)
    b5 = co(b4 + tuple(sorted(L for L, ds in net.items() if L not in KHONG_RANH and sum(g.length for g in ds) >= 50)))
    # (6) + MÉP ĐƯỜNG (Level 50 / 22 — thường KHÔNG phải ranh) — cũng chỉ nhận khi KHỚP NHÃN: tờ 8 dãy lô 747–749, 321–323 sát đường lấy
    # đúng nét mép đường (Level 50) làm cạnh lô, thiếu nét này thì không khép được thửa nào.
    b6 = co(b5 + ('Level 50', 'Level 22'))
    cac_bo = [b0, b1, b2, b3, b4, b5, b6]
    bo_net = [b for i, b in enumerate(cac_bo) if b and b not in cac_bo[:i]]
    chi_khop = {bo_net.index(b) for b in (b5, b6) if b and b in bo_net and b not in cac_bo[:5]}   # hai bộ cuối: chỉ nhận mặt khớp nhãn
    mat_bo = dung_bo(net, bo_net)
    so_lop = loc_ngoai_khung(so_lop, khung, mat_bo, chi_khop)
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
    # Mặt chứa duy nhất số đó (bộ nét ít lớp nhất) đi TRƯỚC các lượt ghép theo nhãn — đã thử đảo lại (15/10 tối) thì hỏng: nhãn rời có khi
    # ghép nhầm số (tờ 139: số 878 dính diện tích 3.703,6 của thửa 448) hoặc lệch vài phần mười m² (tờ 8 thửa 246, 457) → lượt theo nhãn
    # cướp mặt đúng của thửa đang giống web.
    for s in cac_so:
        if s in chon: continue
        for k, kq in enumerate(uv):
            if s not in kq or k in chi_khop: continue
            g = kq[s]
            if g.area > MAT_TOI_DA_KHONG_NHAN_M2: continue   # mặt khổng lồ không có nhãn xác nhận = ô bao cả vùng tờ, không phải thửa
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
                    # số KHÁC trong mặt: chỉ chặn khi số đó cũng có nhãn khớp mặt (mơ hồ) hoặc có từ 2 số có nhãn trở lên. Số không nhãn nằm
                    # chung mặt hay là SỐ THỬA CŨ để lại (tờ 317: mặt 470,69 m² = nhãn thửa 115 nhưng chứa cả số 114 không nhãn) — 15/10 tối.
                    khac = so_trong - {s}
                    if any(x in nhan and abs(m.area - nhan[x][1]) <= sai_cua(nhan[x]) for x in khac): continue
                    if any(x in nhan for x in khac) and len(khac) > 1: continue
                    if da is not None and m.intersection(da).area > 0.5: continue
                    ung.append((m.distance(g0), k, m))
        if ung:
            _, k, m = min(ung, key=lambda t: (t[0], t[1]))
            chon[s] = (m, k, True); cach[s] = 'khop-dien-tich'; da = m if da is None else unary_union([da, m])
    # LƯỢT GHÉP MẶT KHỚP NHÃN (15/10/2026 tối): số còn sót có nhãn, mặt chứa số NHỎ HƠN nhãn → ghép thêm 1–2 mặt LIỀN KỀ (chung cạnh > 0,1 m)
    # KHÔNG chứa số / nhãn nào, tổng diện tích khớp nhãn (≤ sai số nhãn); chỉ nhận khi ĐÚNG MỘT tổ hợp khớp, xét bộ nét MỊN nhất trước.
    # Tờ 8: dãy lô sát đường bị nét mép đường (Level 50) chia ngang, phần lô bên kia nét là một dải ~2 m — 31/38 số còn sót ghép được,
    # 11 lô trùng khít thửa web (lệch 0 cm). Đánh dấu cachDung = 'ghep-mat' để chủ dự án soi lại.
    co_diem = []
    for mat, cay in zip(mat_bo, cay_bo):
        cs = set()
        if cay is not None:
            for p in moi_diem:
                for i in cay.query(p):
                    if mat[i].contains(p): cs.add(i)
        co_diem.append(cs)
    for s in cac_so:
        if s in chon or nhan.get(s, ('', None))[1] is None: continue
        dtn = nhan[s][1]; tol = sai_cua(nhan[s]); p = diem_so[s]
        for k in range(len(mat_bo) - 1, -1, -1):
            mat, cay = mat_bo[k], cay_bo[k]
            if cay is None: continue
            hit = [i for i in cay.query(p) if mat[i].contains(p)]
            if not hit: continue
            i0 = min(hit, key=lambda i: mat[i].area); f0 = mat[i0]
            if f0.area > dtn + tol: continue
            if (set(x for x, q in so if f0.contains(q)) | set(x for x, v in nhan.items() if len(v) > 2 and v[2] is not None and f0.contains(v[2]))) - {s}:
                continue
            if da is not None and f0.intersection(da).area > 0.5: continue
            vien = f0.buffer(0.05)
            ke = [j for j in cay.query(vien) if j != i0 and j not in co_diem[k] and f0.boundary.intersection(mat[j].boundary).length > 0.1
                  and (da is None or mat[j].intersection(da).area <= 0.5)]
            ke = sorted(ke, key=lambda j: mat[j].area)[:8]
            dung = []
            for r in (1, 2):
                for to in itertools.combinations(ke, r):
                    if abs(f0.area + sum(mat[j].area for j in to) - dtn) <= tol:
                        u = unary_union([f0] + [mat[j] for j in to])
                        if u.geom_type == 'Polygon': dung.append(u)
            if len(dung) == 1:
                chon[s] = (dung[0], k, True); cach[s] = 'ghep-mat'; da = dung[0] if da is None else unary_union([da, dung[0]])
            if dung: break
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
                'toMoi': str(N), 'dienTichHinh': round(dt_hinh, 2), 'nguon': NGUON_RIENG.get(str(N), f'dc{N}.dgn'), 'boNet': k + 1}
        if khop is not None: prop['khopNhan'] = khop
        nghi = ''
        if khop is False and dt_nhan:
            tl = dt_hinh / dt_nhan
            if tl > 5 or tl < 0.2: nghi = f'o gap {tl:.1f} lan dien tich nhan'   # ĐÁNH DẤU để soi, không bỏ (80 thửa loại này trùng khít web)
        if nghi: prop['nghiNgo'] = nghi
        if to_bang: prop['toCuBangTra'] = to_bang
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
        if nghi: dem['nghiNgo'] += 1
        # SO THEO VỊ TRÍ (15/10/2026 tối): tờ 343 — thửa "100" của bản vẽ nằm đúng chỗ một thửa web cùng hình nhưng web đánh số khác (đánh số
        # lại) → không phải "web thiếu" / "khác hình". Ghi số thửa web đó để chủ dự án thấy.
        if tt in ('khac', 'moi') and cay_web is not None:
            for i in cay_web.query(g):
                wv2, w2 = web_pg[i]
                if str(w2['thua']) == s: continue
                if abs(wv2.area - dt_hinh) <= GIONG_DT_M2 and g.hausdorff_distance(wv2) <= 0.6:
                    prop['thuaWebCungHinh'] = str(w2['thua']); dem['khacSoCungHinh'] += 1; break
        ra_xa[xa_cu].append({'type': 'Feature', 'geometry': mapping(vn_sang_he_thong(g)), 'properties': prop})
        dong_dc.append([N, bang['tenXa'][xa_cu], to_cu, s, tt, ma, '' if dt_nhan is None else dt_nhan, round(dt_hinh, 2),
                        prop.get('dienTichWeb', ''), round(dt_hinh - prop['dienTichWeb'], 2) if 'dienTichWeb' in prop else '',
                        prop.get('lechHinh_m', ''), ' '.join(map(str, prop.get('dich_m', []))), k + 1, '' if khop is None else ('co' if khop else 'KHONG'),
                        prop.get('thuaWebCungHinh', ''), nghi])
    for w in web_to.get((xa_cu, to_cu), []):      # thửa web cùng tờ cũ, nằm trong vùng tờ này mà bản vẽ không có
        if w['id'] in gap_web or vung_to is None: continue
        if vung_to.contains(he_thong_sang_vn(shape(w['g'])).representative_point()):
            dem['web-co-ban-ve-khong'] += 1
            dong_dc.append([N, bang['tenXa'][xa_cu], to_cu, w['thua'], 'web-co-ban-ve-khong', w.get('mdsd') or '', '', '', w.get('dt') or '', '', '', '', '', '', '', ''])
    co_nhan = sum(1 for s in chon if nhan.get(s, ('', None))[1] is not None)
    khop_nhan = sum(1 for s, (_, _, kh) in chon.items() if kh)
    them_nhan = sum(1 for x in nhan_ngoai if x in chon)
    tong.append({'toMoi': N, 'xaCu': bang['tenXa'][xa_cu], 'toCu': to_cu, 'lopSo': lop_so, 'lopRanh': list(bo_net[0]),
                 'lopLan': [x for x in bo_net[-1] if x not in bo_net[0]], 'lopBo': list(bo_lop), **({'toCuBangTra': to_bang} if to_bang else {}), 'soThuaBanVe': len(cac_so) + them_nhan, 'dungDuoc': len(chon),
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
                                    'dien_tich_web', 'chenh_dien_tich', 'lech_hinh_m', 'dich_m', 'bo_net', 'khop_nhan', 'thua_web_cung_hinh', 'nghi_ngo']); w.writerows(dong_dc)
with open(os.path.join(ra, 'chua-dung-duoc.csv'), 'w', encoding='utf-8-sig', newline='') as fo:
    w = csv.DictWriter(fo, ['toMoi', 'xaCu', 'toCu', 'thua', 'x', 'y']); w.writeheader(); w.writerows(khong_dung)
json.dump(tong, open(os.path.join(ra, 'tong-hop.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
c = collections.Counter()
for t in tong:
    for k in ('soThuaBanVe', 'dungDuoc', 'chuaDung', 'coNhanDienTich', 'khopNhan', 'giong', 'dich', 'khac', 'moi', 'web-co-ban-ve-khong', 'khacSoCungHinh', 'nghiNgo'): c[k] += t.get(k, 0)
print('TONG:', dict(c))
