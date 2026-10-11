# -*- coding: utf-8 -*-
"""
ĐỌC KHUNG CHÚ GIẢI (CHÚ DẪN) CỦA 9 BẢN VẼ QUY HOẠCH → scripts/qh-pipeline/chu-giai-ban-ve.json   (11/10/2026)

VÌ SAO CÓ SCRIPT NÀY
  Chủ dự án so web với app tham chiếu. App đó ghi tên loại đất ĐÚNG NHƯ CHỮ TRONG KHUNG CHÚ GIẢI của từng bản vẽ
  (vd QĐ205: "Đất HỖN HỢP (40% ĐVƠ + 60% DVDL, MẬT ĐỘ CAO)"; QĐ2101: "Đất hỗn hợp nhóm nhà ở và dịch vụ"), còn web đang
  ghi tên tự đặt ngắn gọn ("Đất hỗn hợp", "Đất hỗn hợp – nhóm nhà ở").
  Script này CHỈ ĐỌC — không sửa dữ liệu web. Nó lập bảng: thứ mà quy trình đang dùng để nhận ra loại đất
  (tên level / màu tô / mã loại đất) → đúng chữ trong khung chú giải, kèm bảng "tên web đang dùng → tên theo chú giải".

CÁCH ĐỌC — KHÔNG ĐOÁN
  Khung chú giải = các Ô MÀU MẪU xếp theo cột (Hiện trạng / Đợt đầu / Dài hạn / 2030 / 2045 ...). Mỗi ô màu vẽ trên ĐÚNG level
  (lớp) với vùng tô thật trên bản đồ, chữ giải thích nằm CÙNG HÀNG. Script:
    1. lấy các ô màu nằm trong khung (toạ độ khung + vị trí cột ĐO TAY trên bản vẽ, ghi ở CAU_HINH bên dưới),
    2. gom ô màu cùng hàng; chữ của hàng = mọi dòng chữ trong cột chữ có TÂM rơi vào dải cao của hàng (chữ xuống dòng thì ghép),
       hàng không có chữ nào trong dải thì để trống và báo — KHÔNG lấy chữ hàng bên cạnh,
    3. so với vùng tô thật trên bản đồ (phần nằm trong ranh lập quy hoạch, apps/backend/data/ranh_qh.json) theo (level, màu),
    4. so với tên web đang dùng (apps/backend/data/qh_zones*.json).
  Bản phân khu: tên web = ten_loai(level) của 5-tao-qh-zones.py (5g dùng đúng hàm này) → biết chắc level nào ra tên web nào.
  QĐ205: tên web = bảng lop-205.json (lớp gpkg → tên web) mà 5h-dung-o-205-tu-gpkg.py dùng → cũng biết chắc lớp nào ra tên nào.
  QĐ893: nhận loại đất theo MÃ (ODT, CLN...) ghi trong bản vẽ + màu → so mã với cột mã của khung chú dẫn (Level 56).

ĐỌC NHẸ RAM: file DXF đọc TỪNG HÌNH MỘT (ezdxf.addons.iterdxf) — đọc cả file QĐ893 143 MB một lượt từng bị dừng vì hết bộ nhớ.
QĐ205 đọc từ QD205.gpkg (sqlite, đọc thẳng hình cong) — bản DXF 788 MB của QĐ205 đã mất vùng tô đặc; chữ chú giải hai bản
trùng nhau từng dòng (đã đối chiếu lớp 'T-cmt 28-02-2023' của DXF), riêng DXF bị mất dấu vài chữ ("VAN HOÁ", "ÐÀO T?O").

TÊN HIỂN THỊ ĐỀ XUẤT (ten_hien_thi) — dựng CHỈ từ chữ chú giải:
  · chữ IN HOA hết → viết thường kiểu câu, GIỮ NGUYÊN chữ viết tắt (bảng VIET_TAT) và số, %;
  · chữ đã có hoa/thường (QĐ893, QĐ2222) → giữ nguyên, chỉ coi từ IN HOA ≥ 2 chữ cái là viết tắt;
  · thêm "Đất " ở đầu nếu chữ chú giải chưa có (giống app tham chiếu: "Đất HỖN HỢP (...)"), trừ tên riêng (Đầm Thủy Triều);
  · gộp khoảng trắng thừa, bỏ ký hiệu định dạng CAD (%%% = %, %%u gạch chân).
  Chữ GỐC luôn giữ ở "chu_giai" để đối chiếu.

Cách gọi:
    python scripts/qh-pipeline/8b-doc-chu-giai.py              (cả 9 bản, khoảng 1 phút, RAM < 1 GB)
    python scripts/qh-pipeline/8b-doc-chu-giai.py 2101 918     (vài bản — các bản khác giữ nguyên trong file json)
Đổi bản vẽ thì kiểm lại toạ độ khung trong CAU_HINH (in thử bằng cách đọc file, xem phần "khung chú giải" từng bản).
"""
import collections, importlib.util, io, json, math, os, re, sqlite3, struct, sys, unicodedata

from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
GOC = os.path.abspath(os.path.join(HERE, '..', '..'))
QH = os.path.join(GOC, 'quyhoach2025')
DATA = os.path.join(GOC, 'apps', 'backend', 'data')
RA = os.path.join(HERE, 'chu-giai-ban-ve.json')


def nap(ten, tep):
    sp = importlib.util.spec_from_file_location(ten, os.path.join(HERE, tep))
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


b1 = nap('b1', '1b-doc-dxf.py')            # vn2wgs, bo_level, bảng màu AutoCAD (giống 5g)
b5 = nap('b5', '5-tao-qh-zones.py')        # ten_loai(): level → tên web (5g dùng đúng hàm này)

# ─────────────────────────────── CẤU HÌNH TỪNG BẢN (toạ độ VN-2000, mét) ───────────────────────────────
# khung : (x0, y0, x1, y1) — vùng chứa ô màu mẫu + chữ của khung chú giải (KHÔNG gồm tiêu đề cột)
# cot   : [(x0, x1, nhãn cột)] — ô màu có TÂM rơi vào khoảng x này thuộc cột đó
# chu   : (x0, x1) — khoảng x của MÉP TRÁI dòng chữ giải thích
# nhom_x: (x0, x1) — mép trái chữ ĐẦU MỤC (vd "A- KHU VỰC ĐẤT DÂN DỤNG"), ghi kèm hàng cho dễ hiểu; không có thì bỏ
# Toạ độ đo tay ngày 11/10/2026 trên chính bản vẽ (in danh sách chữ + ô màu quanh chữ "KÝ HIỆU"/"CHÚ DẪN").
CAU_HINH = {
    '205': {
        'ten': 'QĐ205 — Quy hoạch chung đô thị mới Cam Lâm đến 2045', 'tep': 'QD205.gpkg', 'kieu': 'gpkg',
        'khoi': [{'khung': (607940, 1332140, 608800, 1334170),
                  'cot': [(607955, 608070, 'Hiện trạng'), (608105, 608220, 'Quy hoạch đến năm 2030'),
                          (608257, 608372, 'Quy hoạch đến năm 2045')],
                  'chu': (608400, 608800), 'nhom_x': (607940, 607990)}],
    },
    '893': {
        'ten': 'QĐ893 — Quy hoạch sử dụng đất đến 2030 (cấp huyện)', 'tep': 'QD893 QHSDD2030.dxf', 'kieu': 'dxf893',
        'khoi': [
            # bảng mã loại đất: cột "TÊN KÝ HIỆU" (chữ, bên trái) · ô màu HIỆN TRẠNG (mã ghi giữa ô) · ô màu QUY HOẠCH ("mã HT" + mã)
            {'khung': (573800, 1319600, 577700, 1332760),
             'cot': [(576400, 576960, 'Hiện trạng'), (577080, 577660, 'Quy hoạch')], 'chu': (573850, 576300), 'lop': 'Level 56'},
            # bảng KÝ HIỆU bên cạnh: chỉ 2 dòng có ô màu vùng ("Sông, suối, ao, hồ" và nét "Đường giao thông")
            {'khung': (577850, 1320000, 581100, 1324700),
             'cot': [(579850, 580360, 'Hiện trạng'), (580530, 581060, 'Quy hoạch')], 'chu': (577880, 579800),
             'lop': 'Level 56', 'bang_ky_hieu': True},
        ],
    },
    '2076': {
        'ten': 'QĐ2076 — Phân khu phía Bắc (1/2000)', 'tep': 'QD2076PKPB 1.2000.dxf', 'kieu': 'dxf',
        'khoi': [
            {'khung': (601535, 1346060, 601868, 1346562),
             'cot': [(601538, 601572, 'Hiện trạng'), (601572, 601605, 'Quy hoạch đến năm 2030'),
                     (601605, 601639, 'Quy hoạch đến năm 2045')],
             'chu': (601640, 601866), 'nhom_x': (601535, 601550)},
            {'khung': (601865, 1346355, 602178, 1346562),
             'cot': [(601866, 601900, 'Hiện trạng'), (601900, 601933, 'Quy hoạch đến năm 2030'),
                     (601933, 601967, 'Quy hoạch đến năm 2045')],
             'chu': (601898, 602176), 'nhom_x': (601865, 601876)},
        ],
    },
    '2101': {
        'ten': 'QĐ2101 — Phân khu trung tâm (1/2000)', 'tep': 'QD2101 TT 1.2000.dxf', 'kieu': 'dxf',
        'khoi': [{'khung': (599275, 1327820, 599555, 1328226),
                  'cot': [(599276, 599307, 'Hiện trạng'), (599308, 599340, 'Quy hoạch đợt đầu'),
                          (599341, 599369, 'Quy hoạch dài hạn')],
                  'chu': (599369, 599555)}],
    },
    '2222': {
        'ten': 'QĐ2222 — Phân khu bán đảo Cam Ranh (1/2000)', 'tep': 'QD2222.dxf', 'kieu': 'dxf',
        'khoi': [{'khung': (607990, 1336190, 610900, 1343200),
                  'cot': [(609670, 609995, 'Hiện trạng'), (610100, 610425, 'Quy hoạch đợt đầu'),
                          (610525, 610855, 'Quy hoạch dài hạn')],
                  'chu': (608150, 609600)}],
    },
    '918': {
        'ten': 'QĐ918 — Phân khu phức hợp phía Tây (1/2000)', 'tep': '1-2000 phan khu Phia Tay (1).dxf', 'kieu': 'dxf',
        'khoi': [{'khung': (583950, 1322500, 586300, 1330420),
                  'cot': [(583960, 584400, 'Hiện trạng'), (584590, 585030, 'Quy hoạch đợt đầu'),
                          (585215, 585655, 'Quy hoạch dài hạn')],
                  'chu': (585700, 586300)}],
    },
    'cuhin': {
        'ten': 'Phân khu núi Cù Hin (1/2000)', 'tep': 'phân khu cù hin 1.2000.dxf', 'kieu': 'dxf',
        'khoi': [{'khung': (600410, 1340890, 600800, 1341575),
                  'cot': [(600418, 600463, 'Hiện trạng'), (600465, 600511, 'Đến năm 2030'), (600513, 600557, 'Đến năm 2040')],
                  'chu': (600557, 600800)}],
    },
    'taynam': {
        'ten': 'Phân khu Tây Nam (1/2000)', 'tep': 'Tay Nam da sua - ban cuoi.dxf', 'kieu': 'dxf',
        # khung "KÍ HIỆU:" cạnh "GHI CHÚ" của chính bản vẽ. Bản vẽ còn 2 bảng mẫu khác (Phụ lục V của Bộ Xây dựng và
        # "KÝ HIỆU SỬ DỤNG TƯƠNG ỨNG CHO TỪNG LOẠI ĐỒ ÁN") — đó là bảng QUY ĐỊNH CHUNG, không phải chú giải của bản vẽ này.
        'khoi': [{'khung': (603280, 1321000, 604600, 1323720),
                  'cot': [(603285, 603415, 'Hiện trạng'), (603450, 603585, 'Quy hoạch')],
                  'chu': (603670, 604600)}],
    },
    'taybac': {
        'ten': 'Phân khu Tây Bắc (1/2000)', 'tep': '1-2000 Phan khu Tay Bac.dxf', 'kieu': 'dxf',
        'khoi': [{'khung': (583320, 1333800, 583700, 1334312),
                  'cot': [(583325, 583366, 'Hiện trạng'), (583369, 583413, 'Quy hoạch đợt đầu'),
                          (583416, 583460, 'Quy hoạch dài hạn')],
                  'chu': (583458, 583700)}],
    },
}
THU_TU = ['205', '893', '2076', '2101', '2222', '918', 'cuhin', 'taynam', 'taybac']

# Bảng "Phụ lục V" (quy định chung của Bộ Xây dựng: tên level chuẩn → tên chức năng) có sẵn trong bản QĐ918, góc phải.
# CHỈ dùng làm GỢI Ý cho level không có trong khung chú giải của bản vẽ — không phải chữ của bản vẽ đó.
PHU_LUC_V = {'tep': '1-2000 phan khu Phia Tay (1).dxf', 'khung': (608200, 1322900, 608700, 1337800)}

# Ghi chú cho hàng chú giải có chữ SAI trong chính bản vẽ (vẫn giữ nguyên chữ bản vẽ ở 'chu_giai' / 'ten_hien_thi', chỉ báo cho biết)
GHI_CHU_HANG = {
    ('893', 'SKC'): 'Bản vẽ gõ đảo chữ: "Đất sản cơ sở xuất phi nông nghiệp" — tên chuẩn của mã SKC là "Đất cơ sở sản xuất phi nông nghiệp".',
    ('893', 'DDD'): 'Bản vẽ xuống dòng sau "văn hóa" nên thiếu dấu phẩy: "...lịch sử- văn hóa danh lam thắng cảnh, di sản thiên nhiên".',
}

# Chữ viết tắt giữ nguyên khi đổi chữ IN HOA sang chữ thường (lấy đúng các chữ tắt có trong 9 khung chú giải)
VIET_TAT = {'ĐVƠ', 'ĐVO', 'DVDL', 'DV', 'DL', 'TDTT', 'CV', 'THPT', 'THCS', 'TTYT', 'KS', 'VLXD', 'HTKT', 'CBD', 'UBND'}
TEN_RIENG = [('thủy triều', 'Thủy Triều'), ('thuỷ triều', 'Thuỷ Triều'), ('hòn bà', 'Hòn Bà')]
KHONG_THEM_DAT = re.compile(r'^(đầm thủy triều|đầm thuỷ triều)$', re.I)    # tên riêng, không phải nhóm đất


# ─────────────────────────────── CHỮ ───────────────────────────────
def sua(s):
    """Gỡ chữ Việt bị đọc nhầm bảng mã (UTF-8 bị hiểu là cp1252: 'Há»–N' → 'HỖN'). Chữ đúng sẵn thì giữ nguyên."""
    if s is None:
        return ''
    b = bytearray()
    for ch in s:
        o = ord(ch)
        if 0xDC80 <= o <= 0xDCFF:                      # byte lạ đọc kiểu surrogateescape
            b.append(o - 0xDC00)
            continue
        try:
            b += ch.encode('cp1252')
        except Exception:
            if o < 256:
                b.append(o)                             # 0x81 0x8D 0x8F 0x90 0x9D: cp1252 không có, latin-1 giữ nguyên
            else:
                return s                                 # có chữ ngoài bảng → vốn đã đúng
    try:
        return b.decode('utf-8')
    except Exception:
        return s


def nfc(s):
    """Chữ Việt gõ TÁCH DẤU (NFD — dữ liệu từ CAD/Mac hay gặp, vd 'DU LỊCH' của Tây Bắc) → dạng dựng sẵn (NFC) để so khớp."""
    return unicodedata.normalize('NFC', s or '')


def lam_sach(s):
    """Bỏ ký hiệu định dạng CAD + dấu BOM, gộp khoảng trắng."""
    s = nfc(sua(s)).replace('\ufeff', '')
    s = s.replace('%%%', '%')
    s = re.sub(r'%%[uUoOkK]', '', s)
    s = s.replace('%%c', 'Ø').replace('%%d', '°').replace('%%p', '±')
    s = re.sub(r'\\[Pp]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def ten_hien_thi(chu):
    """Chữ chú giải → tên hiển thị gọn (xem đầu file). Chỉ đổi kiểu chữ + thêm 'Đất ', không thêm/bớt chữ."""
    s = lam_sach(chu)
    if not s:
        return ''
    hoa_het = not any(c.islower() for c in s)
    out = []
    for t in re.split(r'(\W+)', s):
        if not t or not re.search(r'\w', t):
            out.append(t)
        elif t.isupper() and ((hoa_het and t in VIET_TAT) or (not hoa_het and len(t) >= 2)):
            out.append(t)                              # chữ viết tắt
        else:
            out.append(t.lower())
    s = ''.join(out)
    for k, v in TEN_RIENG:
        s = s.replace(k, v)
    s = re.sub(r'\s+', ' ', s).strip(' ,;')
    if KHONG_THEM_DAT.match(s):
        return s[0].upper() + s[1:]
    if not re.match(r'^đất\b', s, re.I):
        s = 'Đất ' + s
    return s[0].upper() + s[1:]


# ─────────────────────────────── TOẠ ĐỘ ───────────────────────────────
_E0, _N0 = 590000.0, 1330000.0
_l0, _p0 = b1.vn2wgs(_E0, _N0)
_l1, _p1 = b1.vn2wgs(_E0 + 100, _N0)
_l2, _p2 = b1.vn2wgs(_E0, _N0 + 100)
_J = ((_l1 - _l0) / 100, (_l2 - _l0) / 100, (_p1 - _p0) / 100, (_p2 - _p0) / 100)
_DET = _J[0] * _J[3] - _J[1] * _J[2]


def wgs2vn(lon, lat):
    """WGS84 → VN-2000 Khánh Hoà: lặp ngược đúng hàm vn2wgs của 1b (sai số < 1e-6 m). Dùng để đưa RANH về mét."""
    E = _E0 + (_J[3] * (lon - _l0) - _J[1] * (lat - _p0)) / _DET
    N = _N0 + (-_J[2] * (lon - _l0) + _J[0] * (lat - _p0)) / _DET
    for _ in range(10):
        a, b = b1.vn2wgs(E, N)
        dE = (_J[3] * (lon - a) - _J[1] * (lat - b)) / _DET
        dN = (-_J[2] * (lon - a) + _J[0] * (lat - b)) / _DET
        E += dE
        N += dN
        if abs(dE) < 1e-6 and abs(dN) < 1e-6:
            break
    return E, N


def ranh_vn(ma):
    """Ranh lập quy hoạch (ranh_qh.json, WGS84) → đa giác VN-2000 (mét). Trừ các lỗ '_lo' và vùng khớp nối '_khop'."""
    R = json.load(io.open(os.path.join(DATA, 'ranh_qh.json'), encoding='utf-8'))
    if ma not in R:
        return None
    g = make_valid(Polygon([wgs2vn(x, y) for x, y in R[ma]]))
    bo = [r for r in (R.get('_lo') or {}).get(ma, [])] + [r for r in (R.get('_khop') or {}).get(ma, [])]
    if bo:
        g = make_valid(g.difference(unary_union([make_valid(Polygon([wgs2vn(x, y) for x, y in r])) for r in bo if len(r) >= 4])))
    return g


def chan_le(polys):
    """Tô chẵn–lẻ như CAD: điểm nằm trong số LẺ đường bao thì được tô (giống 5g / 1d)."""
    g = None
    for q in polys:
        g = q if g is None else g.symmetric_difference(q)
    return make_valid(g) if g is not None else None


# ─────────────────────────────── ĐỌC DXF (từng hình một) ───────────────────────────────
def bang_level(vao):
    """Đọc nhanh bảng LEVEL ở đầu file: tên → (số màu, màu thật, đang TẮT?, bị ĐÓNG BĂNG?)."""
    lv, cur = {}, None
    with io.open(vao, encoding='utf-8', errors='surrogateescape') as f:
        while True:
            a = f.readline()
            b = f.readline()
            if not a or not b:
                break
            ma, gt = a.strip(), b.strip()
            if ma == '2' and gt == 'ENTITIES':
                break
            if ma == '0':
                if cur and cur.get('ten') is not None:
                    lv[cur['ten']] = cur
                cur = {'ten': None, 'ci': 7, 'tc': None, 'co': 0} if gt == 'LAYER' else None
            elif cur is not None:
                try:
                    if ma == '2':
                        cur['ten'] = b.rstrip('\r\n')
                    elif ma == '62':
                        cur['ci'] = int(gt or 7)
                    elif ma == '420':
                        cur['tc'] = int(gt)
                    elif ma == '70':
                        cur['co'] = int(gt or 0)
                except ValueError:
                    pass
    return lv


def mau_cua(e, lv):
    """Màu tô (#rrggbb) đúng như 1b.mau_va_so(): màu thật nếu có, không thì tra bảng AutoCAD; BYLAYER/BYBLOCK → màu level."""
    tc = e.dxf.get('true_color', None)
    if tc:
        return '#%06x' % (tc & 0xFFFFFF)
    ci = e.dxf.get('color', 256)
    if ci in (0, 256):
        L = lv.get(e.dxf.get('layer', ''))
        if L and L['tc']:
            return '#%06x' % (L['tc'] & 0xFFFFFF)
        ci = abs(L['ci']) if L else 7
    if ci < 1 or ci > 255:
        return '#9aa0a6'
    return b1.BANG[ci]


def tam_chu(kieu, y, h, ha, va, n_dong=1):
    """Toạ độ y của TÂM dòng chữ (điểm chèn của chữ CAD tuỳ cách canh lề)."""
    h = h or 0
    if kieu == 'TEXT':
        if va == 2 or ha == 4:
            return y
        if va == 3:
            return y - 0.5 * h
        return y + 0.5 * h                    # chân chữ / đáy
    cao = h * (n_dong + 0.667 * (n_dong - 1))  # MTEXT: canh theo cả khối chữ
    if ha in (1, 2, 3):
        return y - 0.5 * cao
    if ha in (7, 8, 9):
        return y + 0.5 * cao
    return y


def trai_chu(kieu, x, h, ha, s):
    """Mép trái gần đúng của dòng chữ (chữ canh giữa / phải thì lùi theo độ dài)."""
    rong = 0.6 * (h or 0) * max([len(d) for d in s.split('\n')] or [1])
    if kieu == 'TEXT':
        if ha in (1, 4):
            return x - rong / 2
        if ha == 2:
            return x - rong
        return x
    if ha in (2, 5, 8):
        return x - rong / 2
    if ha in (3, 6, 9):
        return x - rong
    return x


def doc_dxf(vao, lay_hinh=True, chi_lop=None):
    """Đọc DXF từng hình. Trả về (levels, vùng tô, chữ). Vùng tô: dict(lop, mau, kieu_to, khung, hinh(VN-2000) hoặc None)."""
    from ezdxf.addons import iterdxf
    from ezdxf import path as ezpath
    lv = bang_level(vao)
    vt, chu = [], []
    doc = iterdxf.opendxf(vao)
    try:
        for e in doc.modelspace(types=['HATCH', 'SOLID', 'TRACE', 'TEXT', 'MTEXT']):
            t = e.dxftype()
            lop = e.dxf.get('layer', '') or ''
            try:
                if t in ('TEXT', 'MTEXT'):
                    if t == 'TEXT':
                        s = e.dxf.text
                        ha, va = e.dxf.get('halign', 0), e.dxf.get('valign', 0)
                        p = e.dxf.align_point if ((ha or va) and e.dxf.hasattr('align_point')) else e.dxf.insert
                        h = e.dxf.get('height', 0)
                    else:
                        s = e.plain_text()
                        ha, va = e.dxf.get('attachment_point', 1), 0
                        p = e.dxf.insert
                        h = e.dxf.get('char_height', 0)
                    s2 = nfc(sua(s))
                    chu.append({'lop': nfc(sua(lop)), 'chu': s2, 'x': p.x, 'y': p.y, 'h': h,
                                'yt': tam_chu(t, p.y, h, ha, va, len(s2.split('\n'))), 'xt': trai_chu(t, p.x, h, ha, s2)})
                    continue
                if chi_lop and lop not in chi_lop:
                    # QĐ893: ngoài khung chú dẫn chỉ cần biết MÀU nào có trên bản đồ, không cần hình
                    if t in ('HATCH', 'SOLID', 'TRACE'):
                        vt.append({'lop': sua(lop), 'mau': mau_cua(e, lv), 'kieu_to': e.dxf.get('pattern_name', '') if t == 'HATCH' else 'SOLID',
                                   'khung': None, 'hinh': None})
                    continue
                if t == 'HATCH':
                    ps = []
                    for pth in ezpath.from_hatch(e):
                        pts = [(v.x, v.y) for v in pth.flattening(distance=0.5, segments=8)]
                        if len(pts) >= 3:
                            ps.append(pts)
                    if not ps:
                        continue
                    xs = [x for r in ps for x, _ in r]
                    ys = [y for r in ps for _, y in r]
                    hinh = None
                    if lay_hinh:
                        polys = [make_valid(Polygon(r)) for r in ps if len(r) >= 4]
                        polys = [q for q in polys if not q.is_empty]
                        if polys:
                            hinh = unary_union(polys) if (e.dxf.get('hatch_style', 0) == 2 or len(polys) == 1) else chan_le(polys)
                    vt.append({'lop': sua(lop), 'mau': mau_cua(e, lv), 'kieu_to': e.dxf.get('pattern_name', ''),
                               'khung': (min(xs), min(ys), max(xs), max(ys)), 'hinh': hinh})
                else:
                    v = [(q.x, q.y) for q in e.wcs_vertices()]
                    if len(v) < 3:
                        continue
                    xs, ys = [a for a, _ in v], [b for _, b in v]
                    vt.append({'lop': sua(lop), 'mau': mau_cua(e, lv), 'kieu_to': 'SOLID',
                               'khung': (min(xs), min(ys), max(xs), max(ys)),
                               'hinh': make_valid(Polygon(v)) if lay_hinh else None})
            except Exception:
                continue
    finally:
        doc.close()
    levels = {sua(k): {'mau_so': v['ci'], 'tat': v['ci'] < 0, 'dong_bang': bool(v['co'] & 1)} for k, v in lv.items()}
    return levels, vt, chu


# ─────────────────────────────── ĐỌC GPKG (QĐ205) ───────────────────────────────
def _wkb(w):
    """Đọc hình WKB của GeoPackage (có đường cong) → danh sách vòng [(x, y)...]. Cung tròn chia nhỏ ≤ 5°."""
    pos = [0]

    def u32(bo):
        v = struct.unpack(bo + 'I', w[pos[0]:pos[0] + 4])[0]
        pos[0] += 4
        return v

    def diem(bo, nd):
        v = struct.unpack(bo + 'd' * nd, w[pos[0]:pos[0] + 8 * nd])
        pos[0] += 8 * nd
        return v[0], v[1]

    def cung(a, b, c):
        (x1, y1), (x2, y2), (x3, y3) = a, b, c
        d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))
        if abs(d) < 1e-9:
            return [a, c]
        ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / d
        uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / d
        r = math.hypot(x1 - ux, y1 - uy)
        t1, t2, t3 = (math.atan2(y - uy, x - ux) for x, y in (a, b, c))
        ccw = ((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1)) > 0
        if ccw:
            while t3 <= t1:
                t3 += 2 * math.pi
        else:
            while t3 >= t1:
                t3 -= 2 * math.pi
        n = max(2, int(abs(t3 - t1) / math.radians(5)) + 1)
        return [(ux + r * math.cos(t1 + (t3 - t1) * i / n), uy + r * math.sin(t1 + (t3 - t1) * i / n)) for i in range(n + 1)]

    def hinh():
        bo = '<' if w[pos[0]] == 1 else '>'
        pos[0] += 1
        t = u32(bo)
        nd = 2
        if t & 0x80000000:
            nd += 1
        if t & 0x40000000:
            nd += 1
        t &= 0x0FFFFFFF
        loai, chieu = t % 1000, t // 1000
        nd += {0: 0, 1: 1, 2: 1, 3: 2}.get(chieu, 0)
        if loai == 2:                                   # LineString
            return ('net', [diem(bo, nd) for _ in range(u32(bo))])
        if loai == 8:                                   # CircularString
            p = [diem(bo, nd) for _ in range(u32(bo))]
            ra = [p[0]]
            for i in range(0, len(p) - 2, 2):
                ra += cung(p[i], p[i + 1], p[i + 2])[1:]
            return ('net', ra)
        if loai == 9:                                   # CompoundCurve
            ra = []
            for _ in range(u32(bo)):
                _, q = hinh()
                ra += q if not ra else q[1:]
            return ('net', ra)
        if loai in (3, 10):                             # Polygon / CurvePolygon
            vong = []
            for _ in range(u32(bo)):
                if loai == 3:
                    vong.append([diem(bo, nd) for _ in range(u32(bo))])
                else:
                    vong.append(hinh()[1])
            return ('vung', vong)
        if loai in (6, 12):                             # MultiPolygon / MultiSurface
            vong = []
            for _ in range(u32(bo)):
                vong += hinh()[1]
            return ('vung', vong)
        raise ValueError('kiểu hình chưa đọc được: %d' % t)

    return hinh()[1]


def _gp(blob):
    flags = blob[3]
    n = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 7]
    return blob[8 + n:]


def doc_gpkg205(vao):
    con = sqlite3.connect('file:%s?mode=ro' % vao.replace('\\', '/'), uri=True)
    vt, chu = [], []
    for g, lop, mau, mau24, kt in con.execute('select geom, layer, color, color24, name from hatches'):
        if g is None:
            continue
        try:
            vong = [r for r in _wkb(_gp(g)) if len(r) >= 4]
        except Exception:
            continue
        if not vong:
            continue
        if mau24 is not None and mau24 >= 0:
            c = '#%06x' % (mau24 & 0xFFFFFF)
        else:
            r_, g_, b_ = (int(v) for v in (mau or '0,0,0,255').split(',')[:3])
            c = '#%02x%02x%02x' % (r_, g_, b_)
        xs = [x for r in vong for x, _ in r]
        ys = [y for r in vong for _, y in r]
        vt.append({'lop': nfc(sua(lop)), 'lop_goc': lop, 'mau': c, 'kieu_to': kt or '', 'khung': (min(xs), min(ys), max(xs), max(ys)),
                   'hinh': chan_le([make_valid(Polygon(r)) for r in vong])})
    for g, lop, h, s, ah, av, et in con.execute('select geom, layer, height, text, alignh, alignv, etype from texts'):
        if g is None:
            continue
        w = _gp(g)
        bo = '<' if w[0] == 1 else '>'
        x, y = struct.unpack(bo + 'dd', w[5:21])
        s2 = nfc(sua(s))
        kieu = 'MTEXT' if et == 19 else 'TEXT'
        chu.append({'lop': nfc(sua(lop)), 'chu': s2, 'x': x, 'y': y, 'h': h or 0,
                    'yt': tam_chu(kieu, y, h, ah if kieu == 'MTEXT' else 0, av if kieu == 'TEXT' else 0, len(s2.split('\n'))),
                    'xt': x})
    con.close()
    return {}, vt, chu


# ─────────────────────────────── KHUNG CHÚ GIẢI → CÁC HÀNG ───────────────────────────────
def trong(k, x, y):
    return k[0] <= x <= k[2] and k[1] <= y <= k[3]


def doc_khung(khoi, vt, chu):
    """Một khối chú giải → danh sách hàng {chu_giai, dong_chu, dau_muc_gan_nhat, o_mau:[{cot, lop, mau, kieu_to}]}."""
    K = khoi['khung']
    o = []
    da_co = set()
    for i, v in enumerate(vt):
        if v['khung'] is None:
            continue
        x0, y0, x1, y1 = v['khung']
        if not (K[0] <= x0 and x1 <= K[2] and K[1] <= y0 and y1 <= K[3]):
            continue
        if (x1 - x0) < 3 or (y1 - y0) < 3:
            continue                                     # mảnh vụn / nét ký hiệu
        cx = (x0 + x1) / 2
        cot = next((c[2] for c in khoi['cot'] if c[0] <= cx <= c[1]), None)
        if cot is None:
            continue
        khoa = (v['lop'], v['mau'], round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1))
        if khoa in da_co:
            continue                                     # ô vẽ trùng hai lần (Tây Nam)
        da_co.add(khoa)
        o.append(dict(v, cx=cx, cy=(y0 + y1) / 2, h=y1 - y0, cot=cot, thu_tu=i))
    # Hai ô màu KHÁC MÀU chồng khít cùng chỗ (QĐ893 dòng HNK: vàng #ffff7f bị ô cam #ffdf7f vẽ sau đè lên) → chỉ ô vẽ SAU là ô nhìn thấy.
    bi_che = set()
    for a in o:
        for b in o:
            if a is not b and a['thu_tu'] < b['thu_tu'] and a['cot'] == b['cot'] and abs(a['cx'] - b['cx']) < 1 and abs(a['cy'] - b['cy']) < 1 \
                    and abs(a['h'] - b['h']) < 1 and a['mau'] != b['mau']:
                bi_che.add(id(a))
    # gom hàng theo tâm y
    o.sort(key=lambda v: -v['cy'])
    hang = []
    for v in o:
        if hang and abs(hang[-1]['cy'] - v['cy']) < 0.3 * v['h']:
            hang[-1]['o'].append(v)
        else:
            hang.append({'cy': v['cy'], 'o': [v]})
    for hg in hang:
        hg['y0'] = min(v['khung'][1] for v in hg['o'])
        hg['y1'] = max(v['khung'][3] for v in hg['o'])
        hg['cao'] = hg['y1'] - hg['y0']
    # chữ trong cột chữ
    cx0, cx1 = khoi['chu']
    dong = []
    da_chu = set()
    for c in chu:
        if khoi.get('lop') and c['lop'] != khoi['lop']:
            continue
        if not trong(K, c['x'], c['y']) and not trong(K, c['xt'], c['yt']):
            continue
        if not (cx0 <= c['xt'] <= cx1):
            continue
        s = c['chu'].replace('\n', ' ').strip()
        if not lam_sach(s):
            continue
        k2 = (s, round(c['x'], 1), round(c['y'], 1))
        if k2 in da_chu:
            continue                                     # chữ ghi trùng hai lần
        da_chu.add(k2)
        dong.append(dict(c, s=s))
    dung = set()
    for hg in hang:
        le = 0.35 * hg['cao']
        ds = [d for d in dong if hg['y0'] - le <= d['yt'] <= hg['y1'] + le]
        ds.sort(key=lambda d: (-round(d['yt'], 1), d['xt']))
        hg['dong'] = ds
        for d in ds:
            dung.add(id(d))
    # chữ "cha" (vd "Giáo dục" phía trên "- Trường THPT"; "Lâm nghiệp" phía trên "- Rừng sản xuất") — dòng chữ không thuộc hàng nào
    con_lai = [d for d in dong if id(d) not in dung]
    for hg in hang:
        if hg['dong'] and re.match(r'^\s*-', hg['dong'][0]['s']):
            tren = [d for d in con_lai if d['yt'] > hg['y1'] and d['yt'] - hg['y1'] < 3 * hg['cao']]
            if tren:
                hg['cha'] = min(tren, key=lambda d: d['yt'] - hg['y1'])
    # đầu mục (vd "A- KHU VỰC ĐẤT DÂN DỤNG") — chữ ở cột ô màu đầu tiên, không nằm trên hàng nào
    nhom = []
    if khoi.get('nhom_x'):
        for c in chu:
            if trong(K, c['x'], c['y']) and khoi['nhom_x'][0] <= c['xt'] <= khoi['nhom_x'][1] and lam_sach(c['chu']):
                if not any(v['khung'][0] - 1 <= c['xt'] <= v['khung'][2] + 1 and v['khung'][1] - 1 <= c['yt'] <= v['khung'][3] + 1
                           for v in o):
                    nhom.append(c)
    ra = []
    for hg in hang:
        dong_chu = [lam_sach(d['s']) for d in hg['dong']]
        if hg.get('cha'):
            dong_chu = [lam_sach(hg['cha']['s'])] + dong_chu
        tren = [c for c in nhom if c['yt'] >= hg['y0']]
        mt = min(tren, key=lambda c: c['yt'] - hg['y0']) if tren else None
        o_mau = []
        for v in sorted(hg['o'], key=lambda v: v['cx']):
            om = {'cot': v['cot'], 'lop': v['lop'], 'mau': v['mau']}
            if v.get('kieu_to'):
                om['kieu_to'] = v['kieu_to']
            if id(v) in bi_che:
                om['bi_che'] = True
            o_mau.append(om)
        ra.append({'chu_giai': ' '.join(dong_chu), 'dong_chu': dong_chu, 'dau_muc_gan_nhat': lam_sach(mt['chu']) if mt else None,
                   'o_mau': o_mau, 'y': round(hg['cy'], 1), '_dong': hg['dong']})
    return ra


# ─────────────────────────────── PHÂN TÍCH TỪNG LOẠI BẢN ───────────────────────────────
def ten_web_cua_level(lv):
    """Đúng luật của 5g-dung-o-phan-khu.py: level → tên web (None = không thành ô đất)."""
    if 'ranh gi' in lv.lower() or lv.upper().startswith('RG') or b1.bo_level(lv):
        return None
    if re.search(r'hatch_khop', lv, re.I):
        return None
    if re.fullmatch(r'\s*\d+\s*', lv):
        return b5.CHUA_RO
    return b5.ten_loai(lv)


def ten_web_dang_dung(ma):
    f = os.path.join(DATA, 'qh_zones.json' if ma == '205' else 'qh_zones_%s.json' % ma)
    c = collections.Counter()
    bac = collections.defaultdict(collections.Counter)
    for z in json.load(io.open(f, encoding='utf-8')):
        c[z[5]] += 1
        bac[z[5]][z[7]] += 1
    return c, bac


def hoan_thien_hang(hang, ma):
    """Thêm tên hiển thị + danh sách level / màu / cột cho từng hàng chú giải."""
    for h in hang:
        h['ten_hien_thi'] = ten_hien_thi(h['chu_giai']) if h['chu_giai'] else None
        h['cot'] = list(dict.fromkeys(o['cot'] for o in h['o_mau']))
        h['lop'] = list(dict.fromkeys(o['lop'] for o in h['o_mau']))
        h['mau'] = list(dict.fromkeys(o['mau'] for o in h['o_mau'] if not o.get('bi_che')))
        if not h['chu_giai']:
            h['ghi_chu'] = 'Hàng có ô màu nhưng KHÔNG đọc được chữ cùng hàng — không đoán.'
    return hang


def khop_level(hang, lop, mau, kieu_to=None):
    """(level, màu) trên bản đồ → các hàng chú giải. Ưu tiên cùng level + cùng màu; rồi cùng level khác màu; cuối cùng cùng màu
    + cùng kiểu tô (level khác tên) — hai cách sau chỉ để BÁO, đánh dấu rõ trong 'cach_khop'."""
    a = [h for h in hang if any(o['lop'] == lop and o['mau'] == mau for o in h['o_mau'])]
    if a:
        return a, 'cùng level + cùng màu'
    b = [h for h in hang if any(o['lop'] == lop for o in h['o_mau'])]
    if b:
        return b, 'cùng level, KHÁC màu'
    c = [h for h in hang if kieu_to and any(o['mau'] == mau and o.get('kieu_to') == kieu_to for o in h['o_mau'])]
    if c:
        return c, 'chỉ trùng màu + kiểu tô (level khác tên)'
    return [], None


def kiem_tra_trung(hang):
    """Level / màu xuất hiện ở NHIỀU hàng chú giải khác chữ → không thể đổi tên chỉ theo level (hoặc chỉ theo màu)."""
    theo_lop, theo_mau = collections.defaultdict(set), collections.defaultdict(set)
    for h in hang:
        for o in h['o_mau']:
            if o.get('bi_che'):
                continue
            theo_lop[o['lop']].add(h['chu_giai'])
            theo_mau[o['mau']].add(h['chu_giai'])
    return ({k: sorted(v) for k, v in theo_lop.items() if len(v) > 1},
            {k: sorted(v) for k, v in theo_mau.items() if len(v) > 1})


def doi_chieu(ma, hang, vt, khung_ds, ten_web_fn, levels, phu_luc):
    """Phần dùng chung cho QĐ205 + 7 bản phân khu: vùng tô thật trên bản đồ (trong ranh lập QH) → (level, màu) → hàng chú giải;
    rồi tên web đang dùng → các hàng chú giải đứng sau nó."""
    RG = ranh_vn(ma)
    tk = collections.defaultdict(lambda: {'trong': 0.0, 'ngoai': 0.0, 'so_vung': 0, 'kieu_to': collections.Counter(), 'goc': set()})
    for v in vt:
        if v['khung'] is None or v['hinh'] is None or v['hinh'].is_empty:
            continue
        x0, y0, x1, y1 = v['khung']
        if any(k[0] <= x0 and x1 <= k[2] and k[1] <= y0 and y1 <= k[3] for k in khung_ds):
            continue                                       # chính ô màu mẫu của khung chú giải
        g = v['hinh']
        try:
            a = g.intersection(RG).area if RG is not None else 0.0
        except Exception:
            a = make_valid(g).intersection(RG).area
        t = tk[(v['lop'], v['mau'])]
        t['trong'] += a
        t['ngoai'] += max(0.0, g.area - a)
        t['so_vung'] += 1
        t['kieu_to'][v['kieu_to']] += 1
        t['goc'].add(v.get('lop_goc', v['lop']))
    lop_bd = []
    for (lop, mau), t in sorted(tk.items(), key=lambda kv: -kv[1]['trong']):
        tw = None
        for g in sorted(t['goc']) + [lop]:
            tw = ten_web_fn(g)
            if tw:
                break
        if t['trong'] <= 0:
            continue                                       # không có phần nào trong ranh → không thành ô web (xem 'level_chi_ngoai_ranh')
        kt = t['kieu_to'].most_common(1)[0][0] if t['kieu_to'] else None
        hs, cach = khop_level(hang, lop, mau, kt)
        L = levels.get(lop, {})
        muc = {'lop': lop, 'mau': mau, 'kieu_to': kt, 'dien_tich_trong_ranh_ha': round(t['trong'] / 1e4, 2),
               'dien_tich_ngoai_ranh_ha': round(t['ngoai'] / 1e4, 2), 'so_vung_to': t['so_vung'], 'ten_web': tw,
               'chu_giai': [h['chu_giai'] for h in hs], 'ten_hien_thi': [h['ten_hien_thi'] for h in hs],
               'cot_chu_giai': sorted({o['cot'] for h in hs for o in h['o_mau'] if o['lop'] == lop}), 'cach_khop': cach,
               '_m2': t['trong']}
        if L.get('tat') or L.get('dong_bang'):
            muc['level_bi_an'] = 'TẮT' if L.get('tat') else 'ĐÓNG BĂNG'   # mở bản vẽ KHÔNG nhìn thấy vùng tô của level này
        if not hs:
            goc = re.sub(r'^(HT|QH2030|QH2045|QHDD|QHDH)[-_ ]\s*', '', lop).strip()
            if goc in phu_luc:
                muc['goi_y_phu_luc_V'] = phu_luc[goc]
        lop_bd.append(muc)
    dem, bac = ten_web_dang_dung(ma)
    theo_ten = collections.defaultdict(list)
    for m in lop_bd:
        if m['ten_web'] and m['_m2'] > 0:
            theo_ten[nfc(m['ten_web'])].append(m)          # so khớp theo dạng NFC (tên web có thể lưu kiểu tách dấu)
    bang_ten = []
    for ten, so in dem.most_common():
        ms = theo_ten.get(nfc(ten), [])
        tong = sum(m['_m2'] for m in ms) or 1e-9
        pp = collections.defaultdict(float)
        nguon = []
        for m in ms:
            k = ' | '.join(dict.fromkeys(m['ten_hien_thi'])) if m['ten_hien_thi'] else '(không có trong chú giải)'
            pp[k] += m['_m2']
            nguon.append({'lop': m['lop'], 'mau': m['mau'], 'ha': m['dien_tich_trong_ranh_ha'], 'chu_giai': m['chu_giai'],
                          'cot_chu_giai': m['cot_chu_giai'], 'cach_khop': m['cach_khop'], 'level_bi_an': m.get('level_bi_an')})
        muc = {'ten_web_hien_tai': ten, 'so_o_web': so, 'bac': {str(k): v for k, v in sorted(bac[ten].items())},
               'theo_chu_giai': [{'ten_hien_thi': k, 'ty_le_dien_tich': round(v / tong, 3)}
                                 for k, v in sorted(pp.items(), key=lambda kv: -kv[1])],
               'nguon_level': sorted(nguon, key=lambda n: -n['ha'])}
        co_ten = [(k, v) for k, v in pp.items() if not k.startswith('(')]
        cach = {m['cach_khop'] for m in ms if m['ten_hien_thi']}
        if not ms:
            muc['trang_thai'] = 'không tìm thấy level nào ra tên này trong ranh (ô web chỉ là mảnh chạm ranh?)'
        elif not co_ten:
            muc['trang_thai'] = 'không có trong chú giải'
        elif len(co_ten) > 1 or '|' in co_ten[0][0]:
            muc['trang_thai'] = 'MỘT tên web ứng NHIỀU dòng chú giải — phải đặt tên theo từng level/màu (xem nguon_level)'
        else:
            k, v = co_ten[0]
            muc['ten_hien_thi'] = k
            if v / tong < 0.999:
                muc['trang_thai'] = 'khớp %.1f %% diện tích; phần còn lại không có trong chú giải (xem nguon_level)' % (100 * v / tong)
                if cach == {'chỉ trùng màu + kiểu tô (level khác tên)'}:
                    muc['trang_thai'] += ' — và CHỈ trùng màu + kiểu tô với ô mẫu (tên level khác), cần xác nhận'
            elif cach == {'cùng level + cùng màu'}:
                muc['trang_thai'] = 'khớp'
            elif cach == {'chỉ trùng màu + kiểu tô (level khác tên)'}:
                muc['trang_thai'] = 'CHỈ trùng màu + kiểu tô với ô mẫu (tên level khác) — nên người xem xác nhận'
            else:
                muc['trang_thai'] = 'khớp (có level khớp lỏng — xem cach_khop trong nguon_level)'
        if any(n.get('level_bi_an') for n in nguon):
            muc['canh_bao'] = 'có level đang TẮT/ĐÓNG BĂNG trong bản vẽ (mở bản vẽ không thấy) mà web vẫn dựng thành ô đất'
        bang_ten.append(muc)
    for m in lop_bd:
        m.pop('_m2', None)
    trong_lop = {m['lop'] for m in lop_bd}
    ngoai = collections.defaultdict(float)
    for (lop, mau), t in tk.items():
        if lop not in trong_lop and t['ngoai'] > 0:
            ngoai[lop] += t['ngoai'] / 1e4
    tl, tm = kiem_tra_trung(hang)
    co_tren_bd = {(m['lop'], m['mau']) for m in lop_bd if m['dien_tich_trong_ranh_ha'] > 0.01}
    lop_co = {m['lop'] for m in lop_bd if m['dien_tich_trong_ranh_ha'] > 0.01}
    kt = {
        'dong_chu_giai_khong_co_tren_ban_do': [
            {'chu_giai': h['chu_giai'], 'o_mau': ['%s %s (%s)' % (o['lop'], o['mau'], o['cot']) for o in h['o_mau'] if o['lop'] not in lop_co]}
            for h in hang if any(o['lop'] not in lop_co for o in h['o_mau'])],
        'level_tren_ban_do_khong_khop_dung_o_mau': [
            {'lop': m['lop'], 'mau': m['mau'], 'ha': m['dien_tich_trong_ranh_ha'], 'ten_web': m['ten_web'], 'cach_khop': m['cach_khop'],
             'chu_giai_goi_y': m['chu_giai'], 'goi_y_phu_luc_V': m.get('goi_y_phu_luc_V'), 'level_bi_an': m.get('level_bi_an')}
            for m in lop_bd if m['dien_tich_trong_ranh_ha'] > 0.01 and m['cach_khop'] != 'cùng level + cùng màu' and m['ten_web']],
        'level_ky_hieu_khong_thanh_o_dat_ha': {m['lop']: m['dien_tich_trong_ranh_ha'] for m in lop_bd if not m['ten_web']},
        'level_o_nhieu_dong_chu_giai': tl,
        'mau_o_nhieu_dong_chu_giai': tm,
        'hang_khong_doc_duoc_chu': [h['y'] for h in hang if not h['chu_giai']],
        'level_bi_an_van_co_vung_to_trong_ranh': sorted({m['lop'] for m in lop_bd if m.get('level_bi_an') and m['dien_tich_trong_ranh_ha'] > 0}),
        'o_mau_chu_giai_khong_co_vung_to_cung_mau': sorted('%s %s' % (o['lop'], o['mau']) for h in hang for o in h['o_mau']
                                                          if o['lop'] in lop_co and (o['lop'], o['mau']) not in co_tren_bd),
        'level_chi_ngoai_ranh_ha': {k: round(v, 2) for k, v in sorted(ngoai.items(), key=lambda kv: -kv[1]) if v >= 0.5},
    }
    # Level TẮT / ĐÓNG BĂNG: phần nào KHÔNG bị level đang hiện nào phủ lên = chỗ web ghi loại đất mà mở bản vẽ chỉ thấy trắng
    an = {lop for lop, L in levels.items() if L.get('tat') or L.get('dong_bang')}
    if an & {m['lop'] for m in lop_bd}:
        hien, bi_an = [], collections.defaultdict(list)
        for v in vt:
            if v['khung'] is None or v['hinh'] is None or v['hinh'].is_empty or ten_web_fn(v['lop']) is None:
                continue
            x0, y0, x1, y1 = v['khung']
            if any(k[0] <= x0 and x1 <= k[2] and k[1] <= y0 and y1 <= k[3] for k in khung_ds):
                continue
            (bi_an[v['lop']] if v['lop'] in an else hien).append(v['hinh'])
        U = unary_union(hien).intersection(RG)
        kt['level_bi_an_phan_khong_bi_level_hien_phu_ha'] = {
            lop: round(unary_union(gs).intersection(RG).difference(U).area / 1e4, 2) for lop, gs in bi_an.items()}
    return lop_bd, bang_ten, kt


def doi_ten_theo_level(hang, lop_bd):
    """Bảng gọn để ÁP DỤNG: level → tên hiển thị theo chú giải. Level có ở NHIỀU hàng (khác màu) → {màu: tên}.
    'theo_o_mau' = đúng ô mẫu của khung chú giải; 'chi_trung_mau_kieu_to' = level KHÔNG có ô mẫu, chỉ trùng màu + kiểu tô (cần xác nhận)."""
    a = collections.defaultdict(dict)
    for h in hang:
        if not h.get('ten_hien_thi'):
            continue
        for o in h['o_mau']:
            if not o.get('bi_che'):
                a[o['lop']][o['mau']] = h['ten_hien_thi']
    ra = {}
    for lop, d in sorted(a.items()):
        ra[lop] = next(iter(d.values())) if len(set(d.values())) == 1 else d
    b = {}
    for m in lop_bd:
        if m['cach_khop'] == 'chỉ trùng màu + kiểu tô (level khác tên)' and m['ten_hien_thi'] and m['lop'] not in a:
            b.setdefault(m['lop'], {})[m['mau']] = ' | '.join(dict.fromkeys(m['ten_hien_thi']))
    return {'theo_o_mau': ra, 'chi_trung_mau_kieu_to': b}


def phan_tich_phan_khu(ma, ch, phu_luc):
    levels, vt, chu = doc_dxf(os.path.join(QH, ch['tep']))
    hang = []
    for khoi in ch['khoi']:
        hang += doc_khung(khoi, vt, chu)
    hang = hoan_thien_hang(hang, ma)
    lop_bd, bang_ten, kt = doi_chieu(ma, hang, vt, [k['khung'] for k in ch['khoi']], ten_web_cua_level, levels, phu_luc)
    return hang, lop_bd, bang_ten, kt


def phan_tich_205(ch, phu_luc):
    """QĐ205: tên web theo bảng lop-205.json mà 5h-dung-o-205-tu-gpkg.py dùng (khoá = tên lớp GỐC trong gpkg; lớp không có trong
    bảng = 5h bỏ, không thành ô đất). Không có bảng đó thì coi như không biết tên web của lớp."""
    _, vt, chu = doc_gpkg205(os.path.join(QH, ch['tep']))
    hang = hoan_thien_hang(doc_khung(ch['khoi'][0], vt, chu), '205')
    tep = os.path.join(HERE, 'lop-205.json')
    bang = {}
    if os.path.isfile(tep):
        bang = {k: v for k, v in json.load(io.open(tep, encoding='utf-8')).items() if k != '_doc'}   # lớp '_X_…' là lớp thật
    bang.update({nfc(sua(k)): v for k, v in list(bang.items())})
    lop_bd, bang_ten, kt = doi_chieu('205', hang, vt, [ch['khoi'][0]['khung']], lambda lop: bang.get(lop), {}, phu_luc)
    kt['lop_khong_co_trong_chu_giai_ma_lop_205_van_dat_ten'] = [
        {'lop': m['lop'], 'ten_web': m['ten_web'], 'ha': m['dien_tich_trong_ranh_ha'], 'mau': m['mau']}
        for m in lop_bd if m['ten_web'] and not m['chu_giai'] and m['dien_tich_trong_ranh_ha'] > 0]
    return hang, lop_bd, bang_ten, kt


def phan_tich_893(ch):
    vao = os.path.join(QH, ch['tep'])
    _, vt, chu = doc_dxf(vao, lay_hinh=True, chi_lop={'Level 56'})
    hang = []
    for khoi in ch['khoi']:
        hs = doc_khung(khoi, [v for v in vt if v['lop'] == 'Level 56'], chu)
        for h in hs:
            # mã loại đất = chữ 3 chữ cái IN HOA nằm TRONG ô màu của hàng (cột hiện trạng ghi mã giữa ô; cột quy hoạch ghi "mã HT" + mã)
            ma = []
            for c in chu:
                if c['lop'] != 'Level 56':
                    continue
                s = lam_sach(c['chu'])
                if not re.fullmatch(r'[A-Z]{3}', s):
                    continue
                if any(k[0] <= c['x'] <= k[1] for k in khoi['cot']) and abs(c['yt'] - h['y']) < 110:
                    ma.append(s)
            h['ma'] = sorted(set(ma))
            if khoi.get('bang_ky_hieu'):
                h['bang'] = 'Bảng KÝ HIỆU (không phải bảng mã loại đất)'
        hang += hs
    hang = hoan_thien_hang(hang, '893')
    for h in hang:
        if h.get('bang'):
            h['ten_hien_thi'] = lam_sach(h['chu_giai'])    # bảng KÝ HIỆU: ký hiệu bản đồ, không phải nhóm đất → không thêm "Đất "
        for m in h.get('ma', []):
            if ('893', m) in GHI_CHU_HANG:
                h['ghi_chu'] = GHI_CHU_HANG[('893', m)]
    # màu tô có trên bản đồ (Level 30 = vùng đất; Level 29 = ký hiệu trắng)
    mau_bd = collections.Counter(v['mau'] for v in vt if v['lop'] == 'Level 30')
    # mã ghi trên bản đồ: Level 34 = mã QUY HOẠCH, Level 33 = mã HIỆN TRẠNG (xem 1c-doc-chu-ky-hieu-893.py)
    ma_qh, ma_ht, ghep = collections.Counter(), collections.Counter(), collections.Counter()
    for c in chu:
        if c['lop'] not in ('Level 33', 'Level 34'):
            continue
        s = lam_sach(c['chu'])
        ds = re.findall(r'\b[A-Z]{3}\b', s)
        for m in ds:
            (ma_qh if c['lop'] == 'Level 34' else ma_ht)[m] += 1
        if len(ds) > 1:
            ghep[(c['lop'], re.sub(r'\s+', '', s))] += 1
    b5b = nap('b5b', '5b-tao-qh-zones-893.py')
    TEN = b5b.TEN
    theo_ma = {}
    for h in hang:
        for m in h.get('ma', []):
            theo_ma.setdefault(m, h)
    so_ten = []
    for m, t in sorted(TEN.items()):
        h = theo_ma.get(m)
        so_ten.append({'ma': m, 'ten_trong_5b': t, 'chu_giai': h['chu_giai'] if h else None,
                       'ten_hien_thi': h['ten_hien_thi'] if h else None,
                       'giong_chu_giai': bool(h) and lam_sach(t).lower() == lam_sach(h['chu_giai']).lower()})
    ma_thieu_trong_5b = [{'ma': m, 'chu_giai': h['chu_giai']} for m, h in sorted(theo_ma.items()) if m not in TEN]
    # tên web đang dùng → nguồn (mã / màu) → dòng chú dẫn
    BANG = json.load(io.open(os.path.join(HERE, 'ten-loai-dat.json'), encoding='utf-8'))
    mau893 = {k.lower(): v for k, v in BANG['mau_qd893'].items() if not k.startswith('_')}
    mot_ma = {k.lower() for k in BANG.get('mau_mot_ma_qd893', {}) if not k.startswith('_')}
    # màu "riêng một mã" (5b luật e') không bao giờ ra tên nhóm → bỏ khỏi danh sách màu của tên nhóm
    nhom = {k.lower(): v[0] for k, v in BANG['nhom_mau_qd893'].items() if not k.startswith('_') and k.lower() not in mot_ma}
    ma_cua_ten = collections.defaultdict(list)
    for m, t in TEN.items():
        ma_cua_ten[t].append(m)
    hang_ma = [h for h in hang if h.get('ma')]

    def hang_cua_mau(mau):
        return [h for h in hang_ma if mau in h['mau']]

    dem, _ = ten_web_dang_dung('893')
    bang_ten = []
    for ten, n in dem.most_common():
        muc = {'ten_web_hien_tai': ten, 'so_o_web': n}
        mg = re.fullmatch(r'Đất hỗn hợp \(([A-Z]{3}(?: \+ [A-Z]{3})+)\)', ten)
        if mg:
            # NHÃN GHÉP "A+B" trên bản đồ (5b đặt tên "Đất hỗn hợp (A + B)"). Khung chú dẫn KHÔNG có dòng "đất hỗn hợp" nào — chỉ có
            # dòng riêng cho từng mã. Ghi lại dòng của từng mã, không tự đặt tên mới.
            ms = mg.group(1).split(' + ')
            muc['nguon'] = 'nhãn ghép ' + '+'.join(ms)
            muc['cac_dong_chu_dan_cua_tung_ma'] = [{'ma': m, 'chu_giai': theo_ma[m]['chu_giai'] if m in theo_ma else None} for m in ms]
            muc['trang_thai'] = ('khung chú dẫn KHÔNG có dòng "đất hỗn hợp"; từng mã đều có dòng riêng' if all(m in theo_ma for m in ms)
                                 else 'khung chú dẫn KHÔNG có dòng "đất hỗn hợp"; có mã không có trong chú dẫn')
        elif ten in ma_cua_ten:
            ms = ma_cua_ten[ten]
            hs = [theo_ma[m] for m in ms if m in theo_ma]
            muc['nguon'] = 'mã ' + ', '.join(ms)
            if len(hs) == 1:
                muc['chu_giai'] = hs[0]['chu_giai']
                muc['ten_hien_thi'] = hs[0]['ten_hien_thi']
                muc['trang_thai'] = 'khớp' if lam_sach(ten).lower() == lam_sach(hs[0]['chu_giai']).lower() else 'khác chữ chú dẫn'
            else:
                muc['trang_thai'] = 'mã không có trong chú dẫn'
        else:
            maus = [k for k, v in mau893.items() if v == ten] + [k for k, v in nhom.items() if v == ten]
            hs = []
            for mm in maus:
                hs += [h for h in hang_cua_mau(mm) if h not in hs]
            muc['nguon'] = ('chỉ có màu ' + ', '.join(maus)) if maus else 'không có căn cứ (ô không mã, màu lạ)'
            muc['cac_dong_chu_dan_cung_mau'] = [{'ma': h['ma'], 'chu_giai': h['chu_giai']} for h in hs]
            kh = [h['chu_giai'] for h in hang if h.get('bang') and any(mm in h['mau'] for mm in maus)]
            if kh:
                muc['dong_bang_ky_hieu_cung_mau'] = kh
            if len(hs) == 1:
                muc['chu_giai'] = hs[0]['chu_giai']
                muc['ten_hien_thi'] = hs[0]['ten_hien_thi']
                muc['trang_thai'] = 'màu này chỉ có MỘT dòng chú dẫn → dùng được'
            elif hs:
                muc['trang_thai'] = 'màu dùng chung %d dòng chú dẫn — không có tên riêng, giữ tên nhóm (không đoán)' % len(hs)
            else:
                muc['trang_thai'] = 'không có trong chú dẫn'
        bang_ten.append(muc)
    tl, tm = kiem_tra_trung([h for h in hang if h.get('ma')])
    ma_chu_dan = set(theo_ma)
    kt = {
        'ten_trong_5b_khac_chu_dan': [s for s in so_ten if s['chu_giai'] and not s['giong_chu_giai']],
        'ma_trong_chu_dan_ma_5b_chua_co': ma_thieu_trong_5b,
        'ma_trong_5b_khong_co_trong_chu_dan': [s['ma'] for s in so_ten if not s['chu_giai']],
        'ma_tren_ban_do_khong_co_trong_chu_dan': {
            'quy_hoach_Level34': {m: n for m, n in ma_qh.items() if m not in ma_chu_dan},
            'hien_trang_Level33': {m: n for m, n in ma_ht.items() if m not in ma_chu_dan}},
        'ma_trong_chu_dan_khong_ghi_tren_ban_do_quy_hoach': sorted(m for m in ma_chu_dan if m not in ma_qh),
        'nhan_ghep_nhieu_ma_tren_ban_do': [{'level': k[0], 'nhan': k[1], 'so_lan': n} for k, n in ghep.most_common()],
        'mau_o_nhieu_dong_chu_dan': tm,
        'mau_tren_ban_do_Level30': dict(mau_bd.most_common()),
        'mau_tren_ban_do_khong_co_trong_chu_dan': [m for m in mau_bd if not any(m in h['mau'] for h in hang)],
        'mau_chu_dan_khong_co_tren_ban_do': sorted({m for h in hang for m in h['mau']} - set(mau_bd)),
    }
    return hang, so_ten, bang_ten, kt


def doc_phu_luc_V():
    """Bảng Phụ lục V (quy định chung của Bộ Xây dựng) trong bản QĐ918: chữ tên chức năng ghi TRÊN CHÍNH level chuẩn."""
    _, _, chu = doc_dxf(os.path.join(QH, PHU_LUC_V['tep']), lay_hinh=False, chi_lop={'__khong_lay_vung__'})
    K = PHU_LUC_V['khung']
    d = collections.defaultdict(list)
    cha = [c for c in chu if trong(K, c['x'], c['y']) and c['lop'] == '0']
    for c in chu:
        if trong(K, c['x'], c['y']) and c['lop'].startswith('DAT_'):
            d[c['lop']].append(c)
    ra = {}
    for lop, cs in d.items():
        cs.sort(key=lambda c: -c['yt'])
        s = ' '.join(lam_sach(c['chu']) for c in cs)
        if s.startswith('-'):
            tren = [c for c in cha if c['yt'] > cs[0]['yt']]
            if tren:
                s = lam_sach(min(tren, key=lambda c: c['yt'] - cs[0]['yt'])['chu']) + ' ' + s
        ra[lop] = s
    return ra


def bo_phan_tam(hang):
    for h in hang:
        h.pop('_dong', None)
    return hang


def main(cac_ma):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    cu = {}
    if os.path.isfile(RA):
        try:
            cu = json.load(io.open(RA, encoding='utf-8'))
        except Exception:
            cu = {}
    ra = {'_doc': ('Sinh tự động bởi scripts/qh-pipeline/8b-doc-chu-giai.py — đừng sửa tay. Mỗi bản: "chu_giai" = các hàng của khung chú '
                   'giải (chữ gốc + tên hiển thị đề xuất + ô màu mẫu: cột, level, màu); "lop_ban_do" = level/màu có vùng tô thật trong '
                   'ranh và hàng chú giải tương ứng; "ten_web" = tên web đang dùng → tên theo chú giải; "kiem_tra" = chỗ lệch.'),
          'ban': cu.get('ban', {})}
    phu_luc = doc_phu_luc_V()
    ra['phu_luc_V_tham_khao'] = phu_luc
    for ma in cac_ma:
        ch = CAU_HINH[ma]
        print('== %s: %s' % (ma, ch['tep']))
        if ch['kieu'] == 'gpkg':
            hang, lop_bd, bang_ten, kt = phan_tich_205(ch, phu_luc)
        elif ch['kieu'] == 'dxf893':
            hang, lop_bd, bang_ten, kt = phan_tich_893(ch)
        else:
            hang, lop_bd, bang_ten, kt = phan_tich_phan_khu(ma, ch, phu_luc)
        bo_phan_tam(hang)
        ra['ban'][ma] = {'ten_ban': ch['ten'], 'tep': 'quyhoach2025/' + ch['tep'], 'chu_giai': hang}
        if ma == '893':
            ra['ban'][ma]['doi_ten_theo_ma'] = {m: h['ten_hien_thi'] for h in hang for m in h.get('ma', [])}
            ra['ban'][ma]['so_ten_5b_voi_chu_dan'] = lop_bd
        else:
            ra['ban'][ma]['doi_ten_theo_level'] = doi_ten_theo_level(hang, lop_bd)
            ra['ban'][ma]['lop_ban_do'] = lop_bd
        ra['ban'][ma]['ten_web'] = bang_ten
        ra['ban'][ma]['kiem_tra'] = kt
        print('   %d hàng chú giải · %d tên web (%d khớp)' % (len(hang), len(bang_ten),
                                                           sum(1 for b in bang_ten if (b.get('trang_thai') or '').startswith('khớp'))))
    ra['ban'] = {k: ra['ban'][k] for k in THU_TU if k in ra['ban']}
    tmp = RA + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(ra, f, ensure_ascii=False, indent=1)
    os.replace(tmp, RA)
    print('>>> %s' % RA)


if __name__ == '__main__':
    ds = [a for a in sys.argv[1:] if a in CAU_HINH] or THU_TU
    main(ds)
