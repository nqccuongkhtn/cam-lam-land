# -*- coding: utf-8 -*-
"""
DỰNG LẠI Ô ĐẤT QĐ893 (quy hoạch sử dụng đất 2030) CHO PHẦN TÍNH QUY HOẠCH — thay 5-tao-qh-zones.py + 10-sua-ma-lech-mau-893.py
riêng cho bản này (15/9/2026). Các bản phân khu vẫn dùng 5-tao-qh-zones.py như cũ.

VÌ SAO VIẾT LẠI — chủ dự án so với app tham chiếu: thửa 303 tờ 32 Cam Đức (Trường mẫu giáo Cam Đức) app ghi
"DGD 4.658,7 m² + ODT 73,1 m²", web ghi "Đất ở tại đô thị 4.629 m²". Nghiên cứu lại cả bản vẽ thì ra 5 LỖI HỆ THỐNG:
  1. VÙNG CÓ LỖ BỊ LẤP LỖ. Bản cũ chỉ lấy đường viền NGOÀI. Khu đất ở 32.405 m² khoét lỗ đúng chỗ trường mẫu giáo
     → mất lỗ thì khu đất ở phủ luôn lên trường. Có cả một vùng nền "đất ở" 9.050 điểm phủ gần hết huyện.
  2. LẤY LẪN MÃ HIỆN TRẠNG. Level 33 = mã hiện trạng, Level 34 = mã quy hoạch (xem 1c-doc-chu-ky-hieu-893.py).
     Bản cũ dùng cả hai như nhau → 525 vùng chỉ có mã hiện trạng bị in thành loại đất quy hoạch.
  3. SAI VỊ TRÍ CHỮ (điểm chèn thay vì điểm canh) → chữ rơi sang vùng bên cạnh.
  4. THIẾU MÃ: chú dẫn bản vẽ có LUA, LUK, RSN, CNT, TSC, DSN, DXH, DSK, DCT, DPC, DDD, DBV, DCH, TIN, CSD mà
     bảng tra không có → chữ bị bỏ qua.
  5. BỎ QUA KÝ HIỆU CÔNG TRÌNH (quyển sách = trường học…) — căn cứ duy nhất của rất nhiều ô công trình nhỏ không đủ
     chỗ ghi chữ, như chính ô trường mẫu giáo này.

CÁCH GÁN LOẠI ĐẤT CHO MỖI VÙNG — theo thứ tự, căn cứ nào có trước thì dùng, KHÔNG ĐOÁN:
  a. Màu đường giao thông / sông suối (bảng mau_qd893) → theo màu (dải dài hay nuốt chữ khối bên cạnh).
  b. Có MÃ QUY HOẠCH (Level 34) bên trong → mã đó. Nhiều mã khác nhau thì ưu tiên mã HỢP MÀU.
  c. Có KÝ HIỆU CÔNG TRÌNH bên trong, hợp màu → mã của ký hiệu.
  d. Chỉ có MÃ HIỆN TRẠNG (Level 33), HỢP MÀU → giữ mã đó (đất giữ nguyên mục đích). Không hợp màu thì bỏ qua mã.
  e. Không có gì → TÊN NHÓM theo màu (vd "Đất công cộng, dịch vụ, sản xuất"), bậc 0 — thua mọi ô có căn cứ.
  "Hợp màu" = mã thuộc cùng nhóm với màu tô (bảng nhom_mau_qd893 đo từ chính bản vẽ).
  Mỗi chữ / ký hiệu gán cho vùng NHỎ NHẤT chứa nó, ưu tiên vùng hợp màu — tính trên hình ĐỦ LỖ.

ĐẦU RA giống hệt định dạng cũ [minx,miny,maxx,maxy, ring, tên, diện-tích-độ², bậc] để backend khỏi sửa:
vùng có lỗ được CẮT thành các mảnh không lỗ (cắt đôi khung bao qua lỗ cho tới khi hết lỗ) — ghép lại đúng
bằng vùng cũ, lỗ vẫn là lỗ.

Cách chạy (sau 1d + 1c — KHÔNG dùng file qd893_qh.geojson cũ dựng bằng GDAL: hiểu sai đảo trong lỗ, đã xoá 11/10/2026):
    python 1d-vung-to-893-chan-le.py "QD893 QHSDD2030.dxf" qd893_qh_chanle.geojson
    python 5b-tao-qh-zones-893.py qd893_qh_chanle.geojson qd893_chu.geojson qd893_kyhieu.geojson
    rồi chạy 5f-bo-sung-vung-to-hong-893.py
"""
import collections, io, json, os, re, sys
from shapely.geometry import shape, box, Polygon, MultiPolygon, GeometryCollection
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
GOC = os.path.abspath(os.path.join(HERE, '..', '..'))
RA = os.path.join(GOC, 'apps', 'backend', 'data', 'qh_zones_893.json')
BANG = json.load(io.open(os.path.join(HERE, 'ten-loai-dat.json'), encoding='utf-8'))
MAU_893 = {k.lower(): v for k, v in BANG['mau_qd893'].items() if not k.startswith('_')}
NHOM_MAU = {k.lower(): v[0] for k, v in BANG['nhom_mau_qd893'].items() if not k.startswith('_')}
MAU_MOT_MA = {k.lower(): v for k, v in BANG.get('mau_mot_ma_qd893', {}).items() if not k.startswith('_')}
MA_NUOC = ('MNC', 'SON', 'DTL', 'DCT', 'NTS')   # 5 mã chú dẫn tô CHUNG màu xanh nước #7fffff
# XẾP LỚP NHƯ BẢN VẼ HIỂN THỊ (11/10/2026): mọi ô ngang bậc, ô có VÙNG TÔ GỐC nhỏ hơn nằm trên. Bản cũ: ô chỉ có màu bậc 0 (thua
# cả ô có mã nằm DƯỚI nó — khối công cộng 35 ha 89411F mất 3 ha vào khu rừng phòng hộ 6.010 ha bên dưới) và xếp theo diện
# tích MẢNH sau khi cắt lỗ (mảnh nhỏ của khu rừng lớn thắng khối nằm trên). Đặt QH893_THEO_BAN_VE=0 để chạy kiểu cũ (so sánh).
THEO_BAN_VE = os.environ.get('QH893_THEO_BAN_VE', '1') == '1'

# TÊN LOẠI ĐẤT — chép ĐÚNG chữ trong khung chú dẫn của bản vẽ QĐ893 (Level 56), không lấy tên từ nơi khác.
TEN = {
    'LUA': 'Đất trồng lúa', 'LUC': 'Đất chuyên trồng lúa', 'LUK': 'Đất trồng lúa còn lại',
    'HNK': 'Đất trồng cây hàng năm khác', 'CLN': 'Đất trồng cây lâu năm', 'RDD': 'Đất rừng đặc dụng',
    'RPH': 'Đất rừng phòng hộ', 'RSX': 'Đất rừng sản xuất', 'RSN': 'Đất rừng sản xuất là rừng tự nhiên',
    'NTS': 'Đất nuôi trồng thủy sản', 'CNT': 'Đất chăn nuôi tập trung', 'NKH': 'Đất nông nghiệp khác',
    'ONT': 'Đất ở tại nông thôn', 'ODT': 'Đất ở tại đô thị', 'TSC': 'Đất xây dựng trụ sở cơ quan',
    'CQP': 'Đất quốc phòng', 'CAN': 'Đất an ninh', 'DSN': 'Đất xây dựng công trình sự nghiệp',
    'DVH': 'Đất xây dựng cơ sở văn hóa', 'DXH': 'Đất xây dựng cơ sở xã hội', 'DYT': 'Đất xây dựng cơ sở y tế',
    'DGD': 'Đất xây dựng cơ sở giáo dục và đào tạo', 'DTT': 'Đất xây dựng cơ sở thể dục, thể thao',
    'DSK': 'Đất xây dựng công trình sự nghiệp khác', 'SKK': 'Đất khu công nghiệp', 'SKN': 'Đất cụm công nghiệp',
    'TMD': 'Đất thương mại, dịch vụ', 'SKC': 'Đất cơ sở sản xuất phi nông nghiệp',
    'SKS': 'Đất sử dụng cho hoạt động khoáng sản', 'CCC': 'Đất sử dụng vào mục đích công cộng',
    'DGT': 'Đất công trình giao thông', 'DTL': 'Đất công trình thủy lợi', 'DCT': 'Đất công trình cấp nước, thoát nước',
    'DPC': 'Đất công trình phòng, chống thiên tai', 'DDD': 'Đất có di tích lịch sử - văn hóa, danh lam thắng cảnh, di sản thiên nhiên',
    'DRA': 'Đất công trình xử lý chất thải', 'DNL': 'Đất công trình năng lượng, chiếu sáng công cộng',
    'DBV': 'Đất công trình hạ tầng bưu chính, viễn thông, công nghệ thông tin', 'DCH': 'Đất chợ dân sinh, chợ đầu mối',
    'DKV': 'Đất khu vui chơi, giải trí công cộng, sinh hoạt cộng đồng', 'TON': 'Đất tôn giáo', 'TIN': 'Đất tín ngưỡng',
    'NTD': 'Đất nghĩa trang, nhà tang lễ, cơ sở hỏa táng, đất cơ sở lưu giữ tro cốt', 'MNC': 'Đất có mặt nước chuyên dùng dạng ao, hồ, đầm, phá',
    'SON': 'Đất có mặt nước dạng sông, ngòi, kênh, rạch, suối', 'CSD': 'Đất chưa sử dụng',
}
# NHÓM của mã, để so với nhóm của màu. Mã không có ở đây (giao thông, thủy lợi, mặt nước, khoáng sản, chất thải,
# nghĩa trang, chưa sử dụng) thì không so — màu của chúng không có trong bảng nhóm màu chắc chắn.
NHOM = {}
for m in ('ODT', 'ONT'):
    NHOM[m] = 'Đất ở'
for m in ('LUA', 'LUC', 'LUK', 'HNK', 'CLN', 'RDD', 'RPH', 'RSX', 'RSN', 'NTS', 'CNT', 'NKH'):
    NHOM[m] = 'Đất nông nghiệp'
for m in ('TSC', 'CQP', 'CAN', 'DSN', 'DVH', 'DXH', 'DYT', 'DGD', 'DTT', 'DSK', 'SKK', 'SKN', 'TMD', 'SKC', 'CCC',
          'DCT', 'DPC', 'DDD', 'DNL', 'DBV', 'DCH', 'DKV', 'TON', 'TIN'):
    NHOM[m] = 'Đất công cộng, dịch vụ, sản xuất'

LV_QH, LV_HT = 'Level 34', 'Level 33'


def hop_mau(ma, mau):
    if '+' in ma:                                   # nhãn ghép: hợp màu khi có ít nhất một mã hợp màu
        return any(hop_mau(x, mau) for x in ma.split('+'))
    nm = NHOM_MAU.get(mau)
    return nm is not None and NHOM.get(ma) == nm


def ma_ghep(ds):
    """Nhãn ghép "A+B(+C)" → một mã mới, tên "Đất hỗn hợp (A + B …)" — giữ đúng thứ tự và chữ của bản vẽ."""
    k = '+'.join(ds)
    if k not in TEN:
        TEN[k] = 'Đất hỗn hợp (%s)' % ' + '.join(ds)
        nh = {NHOM.get(x) for x in ds}
        if len(nh) == 1 and None not in nh:
            NHOM[k] = nh.pop()
    return k


def tach_lo(g, sau=0):
    """Cắt vùng có lỗ thành các mảnh KHÔNG lỗ (cắt đôi khung bao đi qua tâm lỗ đầu tiên)."""
    if g.is_empty:
        return []
    if isinstance(g, (MultiPolygon, GeometryCollection)):
        return [m for p in g.geoms for m in tach_lo(p, sau)]
    if not isinstance(g, Polygon):
        return []
    if not g.interiors or sau > 40:
        return [g]
    x0, y0, x1, y1 = g.bounds
    c = Polygon(g.interiors[0]).centroid
    if x1 - x0 >= y1 - y0:
        hai = (box(x0, y0, c.x, y1), box(c.x, y0, x1, y1))
    else:
        hai = (box(x0, y0, x1, c.y), box(x0, c.y, x1, y1))
    ra = []
    for b in hai:
        try:
            ra += tach_lo(g.intersection(b), sau + 1)
        except Exception:
            pass
    return [p for p in ra if isinstance(p, Polygon) and p.area > 0]


def la_vien_ranh(b, dt, khung):
    """DẢI VIỀN RANH HUYỆN: khung bao ≥ 80 % khung cả bản vẽ theo CẢ HAI chiều mà diện tích ≤ 5 % khung bao (dải mảnh ôm cả huyện).
    Dùng chung cho 5b, 5f (5f phải bỏ cùng vùng tô này, không thì nó "bổ sung phần sót" lại đúng dải viền)."""
    x0, y0, x1, y1 = b
    X0, Y0, X1, Y1 = khung
    return (x1 - x0) >= 0.8 * (X1 - X0) and (y1 - y0) >= 0.8 * (Y1 - Y0) and dt <= 0.05 * (x1 - x0) * (y1 - y0)


def main(vao, tep_chu, tep_kh):
    d = json.load(io.open(vao, encoding='utf-8'))
    vung, mau = [], []
    # DẢI VIỀN RANH HUYỆN (15/10/2026): vùng tô hồng #ff7fff ở Level 0 (h 6ADCB9) là dải viền chạy quanh ranh huyện — khung 31 × 31 km
    # = cả huyện, rộng trung bình 75 m, 860 ha, không phải đất. Trước đây thành ô "Đất ở" nằm DƯỚI mọi ô khác (vùng tô gốc lớn nhất) nên
    # chỉ lộ ra NGOÀI phần đã quy hoạch: 266 thửa Cam Lâm sát ranh (70,6 ha — Thửa 368 · Tờ 1 Suối Dầu ghi 40.272 m² "Đất ở") và 742
    # thửa huyện bên (431 ha) hiện dòng QĐ893 "Đất ở" bịa. Luật: khung bao ≥ 80 % khung cả bản vẽ theo CẢ HAI chiều mà diện tích
    # ≤ 5 % khung bao (dải mảnh ôm cả huyện) → bỏ. Không vùng tô đất thật nào ôm cả huyện (vùng dài nhất là QL1A: 7,7 × 26,3 km).
    hinh = []
    for f in d['features']:
        # Level 56 = phần TRÌNH BÀY của tờ bản vẽ, không phải đất (11/10/2026): 94 ô màu mẫu chú dẫn 11 ha/ô xếp cột ở mép tây,
        # sơ đồ vị trí in góc tây bắc (nước 616 ha…), 2 ô 108 ha + 68 ha góc đông nam sát Cam Ranh. Trước đây lọt vào dữ liệu web
        # thành 109 ô "đất" 1.385 ha nằm đè lên đất thật Khánh Vĩnh / Cam Ranh → thửa ở đó hiện dòng QĐ893 bịa hoàn toàn.
        if ((f.get('properties') or {}).get('lo') or '') == 'Level 56':
            continue
        try:
            g = shape(f['geometry'])
            if not g.is_valid:
                g = g.buffer(0)
        except Exception:
            continue
        hinh.append((f, g))
    KX0 = min(g.bounds[0] for f, g in hinh); KY0 = min(g.bounds[1] for f, g in hinh)
    KX1 = max(g.bounds[2] for f, g in hinh); KY1 = max(g.bounds[3] for f, g in hinh)
    for f, g in hinh:
        if la_vien_ranh(g.bounds, g.area, (KX0, KY0, KX1, KY1)):
            print('Bỏ dải viền ranh huyện: %s · %.1f ha' % (f.get('properties'), g.area * 111320 * 110574 * 0.978 / 1e4))
            continue
        for p in (g.geoms if hasattr(g, 'geoms') else [g]):
            if isinstance(p, Polygon) and p.area > 0:
                vung.append(p); mau.append(((f.get('properties') or {}).get('c') or '').lower())
    tree = STRtree(vung)
    print('%d vùng tô' % len(vung))

    def gan(pt, ma):
        """Vùng nhỏ nhất chứa điểm, ưu tiên vùng hợp màu với mã."""
        chua = [int(i) for i in tree.query(pt) if vung[int(i)].contains(pt)]
        if not chua:
            return None
        hop = [i for i in chua if hop_mau(ma, mau[i])]
        return min(hop or chua, key=lambda i: vung[i].area)

    from shapely.geometry import Point
    qh, ht, kh = collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list)
    for f in json.load(io.open(tep_chu, encoding='utf-8'))['features']:
        lv = (f['properties'] or {}).get('lo')
        t = ((f['properties'] or {}).get('Text') or '').strip()
        if lv not in (LV_QH, LV_HT):
            continue
        # %%u / %%U = mã gạch chân của CAD dính liền chữ ("%%uHNK+RSX+CSD%%U") → bỏ trước, không thì mã đầu bị sót.
        t = re.sub(r'%%[uUoO]', '', t)
        ds = [ma for ma in re.findall(r'\b[A-Z]{3}\b', t) if ma in TEN]
        # NHÃN GHÉP bằng dấu "+" (11/10/2026): "TMD+ODT", "NKH+TMD", "DTT+DKV+TMD"… = ĐẤT HỖN HỢP gồm các mã đó (119 nhãn quy
        # hoạch). Trước đây tách rời từng mã rồi bỏ mã "trái màu" → web ghi một loại đơn lẻ (thửa 326 tờ 7 Cam Đức: bản vẽ ghi
        # "TMD+ODT", web ghi "Đất thương mại, dịch vụ"; app tham chiếu ghi đất hỗn hợp). Nay giữ cả nhãn thành MỘT loại.
        if '+' in t and len(ds) >= 2:
            ds = [ma_ghep(ds)]
        for ma in ds:
            i = gan(Point(f['geometry']['coordinates']), ma)
            if i is not None:
                (qh if lv == LV_QH else ht)[i].append(ma)
    for f in json.load(io.open(tep_kh, encoding='utf-8'))['features']:
        ma = f['properties']['ma']
        i = gan(Point(f['geometry']['coordinates']), ma)
        if i is not None:
            kh[i].append(ma)

    def chon(ds, m):
        hop = [x for x in ds if hop_mau(x, m)]
        return collections.Counter(hop or ds).most_common(1)[0][0]

    # Mã quy hoạch TRÁI MÀU thì không nhận: vùng tô màu nhóm đất rõ ràng (ở / công cộng / nông nghiệp) mà chữ lại
    # thuộc nhóm khác — hoặc là mã ĐƯỜNG / SÔNG, vốn có màu riêng (cam / xanh nước) nên không thể nằm trong vùng màu
    # đất. Kiểm tra màu ảnh 4.000 điểm (15/9/2026): chữ DGT của một con đường rơi vào khu rừng phòng hộ lớn phía Tây
    # Nam → cả khu rừng thành "đất giao thông", chiếm 80/81 điểm lệch còn lại.
    def trai_mau(ma, m):
        if '+' in ma:                               # nhãn ghép trái màu khi KHÔNG mã nào thuộc nhóm của màu tô
            return m in NHOM_MAU and all(NHOM.get(x) != NHOM_MAU[m] for x in ma.split('+'))
        return m in NHOM_MAU and NHOM.get(ma) != NHOM_MAU[m]
    for i, m in enumerate(mau):
        qh[i] = [x for x in qh[i] if not trai_mau(x, m)]

    loai, bac, can_cu = [None] * len(vung), [0] * len(vung), collections.Counter()
    chi_mau = [False] * len(vung)   # ô KHÔNG căn cứ chữ / ký hiệu, chỉ có màu (luật e, e')
    for i, m in enumerate(mau):
        # a'. MÀU XANH NƯỚC mà bên trong ghi MÃ NHÓM NƯỚC → theo mã (11/10/2026). Chú dẫn bản vẽ dùng CHUNG màu #7fffff cho 5 mã
        # NTS / SON / MNC / DTL / DCT, nên "màu nước = sông ngòi" là sai khi chính vùng đó ghi MNC: 4 vùng 856 ha hồ chứa, mặt nước
        # chuyên dùng từng bị ghi "Đất sông, ngòi, kênh, rạch". Chỉ nhận mã thuộc nhóm nước — chữ ODT, RSX… của khối bên cạnh rơi
        # vào dải sông vẫn bị bỏ qua như cũ (lý do luật a).
        nuoc = [x for x in qh[i] if x in MA_NUOC] or [x for x in ht[i] if x in MA_NUOC]
        if m in MAU_893 and MAU_893[m] != 'Đất giao thông' and nuoc:
            loai[i], bac[i] = TEN[collections.Counter(nuoc).most_common(1)[0][0]], 2; can_cu["a'. màu nước + mã nhóm nước"] += 1
        elif m in MAU_893:
            loai[i], bac[i] = MAU_893[m], 2; can_cu['a. màu đường/sông'] += 1
        elif qh[i]:
            ma = chon(qh[i], m)
            loai[i], bac[i] = TEN[ma], 2
            can_cu['b. mã quy hoạch' + ('' if hop_mau(ma, m) or m not in NHOM_MAU or ma not in NHOM else ' (KHÁC MÀU)')] += 1
        elif [x for x in kh[i] if hop_mau(x, m)]:
            loai[i], bac[i] = TEN[chon([x for x in kh[i] if hop_mau(x, m)], m)], 2; can_cu['c. ký hiệu công trình'] += 1
        elif [x for x in ht[i] if hop_mau(x, m)]:
            loai[i], bac[i] = TEN[chon([x for x in ht[i] if hop_mau(x, m)], m)], 2; can_cu['d. mã hiện trạng hợp màu'] += 1
        elif m in MAU_MOT_MA:
            # e'. màu mà KHUNG CHÚ DẪN chỉ dùng cho đúng MỘT mã (bảng mau_mot_ma_qd893) → tên của mã đó (vd xám = nghĩa trang,
            # trước ghi "Loại đất khác"). Vẫn bậc 0 như luật e: thua ô có mã chữ khi chồng nhau.
            loai[i], bac[i] = TEN[MAU_MOT_MA[m]], 0; chi_mau[i] = True; can_cu["e'. chỉ có màu — màu riêng một mã"] += 1
        else:
            loai[i], bac[i] = NHOM_MAU.get(m, 'Loại đất khác'), 0; chi_mau[i] = True; can_cu['e. chỉ có màu'] += 1
    print('Căn cứ gán loại đất:', dict(sorted(can_cu.items())))

    # Vùng KHÔNG căn cứ nằm lọt hẳn trong vùng CÓ căn cứ (tính trên hình đủ lỗ) = nét chia nhỏ bên trong → bỏ,
    # không thì nó thắng vùng lớn (vùng nhỏ thắng) nhưng lại chỉ mang tên nhóm.
    # ⚠️ CHỈ BỎ KHI CÙNG MÀU với vùng chứa nó (11/10/2026) — khác màu trong chú dẫn là khác mã, kể cả cùng nhóm.
    # Khác màu là một LOẠI ĐẤT KHÁC vẽ đè lên — bản vẽ hiện
    # rõ màu của nó: khối công cộng 3 ha giữa rừng phòng hộ (89411F), khối nông nghiệp 2,4 ha trong khu thương mại dịch vụ
    # 18,4 ha (336D86) — bản cũ bỏ đi nên web ghi cả khối theo vùng bên ngoài. Giữ lại và cho NGANG BẬC (2) để "ô nhỏ nằm trên"
    # như bản vẽ hiển thị.
    co = [i for i in range(len(vung)) if not chi_mau[i]]
    tree_co = STRtree([vung[i] for i in co])
    bo = set()
    for i in range(len(vung)):
        if not chi_mau[i]:
            continue
        pt = vung[i].representative_point()
        # "lọt hẳn" phải là PHỦ ≥ 95 % diện tích, không chỉ chứa một điểm: khối công cộng 35 ha 89411F giữa rừng phòng hộ có điểm
        # đại diện rơi trúng một lô nhỏ có mã cùng màu bên trong → bản cũ bỏ cả 35 ha, web ghi rừng phòng hộ.
        chua = [co[int(j)] for j in tree_co.query(pt) if vung[co[int(j)]].contains(pt)
                and vung[co[int(j)]].intersection(vung[i]).area >= 0.95 * vung[i].area]
        if not chua:
            continue
        j = min(chua, key=lambda k: vung[k].area)          # vùng có căn cứ NHỎ NHẤT chứa nó = vùng nó nằm ngay trên
        if mau[i] == mau[j]:                                # cùng màu = nét chia nhỏ bên trong → bỏ như cũ
            bo.add(i)
        elif vung[j].intersection(vung[i]).area >= 0.90 * vung[j].area:
            # TRÙNG KHÍT (phủ nhau ≥ 90 % CẢ HAI CHIỀU, 12/10/2026): không biết ai vẽ đè ai — "ô nhỏ nằm trên" chỉ còn do chênh diện tích
            # li ti quyết định (may rủi). Lấy vùng CÓ CĂN CỨ chữ / ký hiệu. Soát 12/10: vùng 31,97 ha "Đất thương mại, dịch vụ" (mã TMD)
            # trùng khít vùng chỉ có màu "Đất công cộng, dịch vụ, sản xuất" — web ghi đúng tên có mã là nhờ may; vùng 0,72 ha ghi
            # "Đất nông nghiệp" (tên nhóm) thay vì mã "Đất nông nghiệp khác".
            bo.add(i); can_cu['bỏ ô chỉ có màu trùng khít ô có mã'] += 1
        else:
            bac[i] = 2; can_cu['giữ ô khác màu nằm trên ô có mã'] += 1
    print('Giữ %d vùng khác màu nằm trên vùng có căn cứ' % can_cu['giữ ô khác màu nằm trên ô có mã'])
    if THEO_BAN_VE:
        bac = [2 if loai[i] is not None else b for i, b in enumerate(bac)]

    out, so_manh = [], 0
    for i, g in enumerate(vung):
        if i in bo:
            continue
        for p in tach_lo(g):
            r = [[round(c[0], 8), round(c[1], 8)] for c in p.exterior.coords]   # bỏ toạ độ độ cao nếu có
            if len(r) < 4:
                continue
            x0, y0, x1, y1 = p.bounds
            # diện tích dùng để xếp lớp: cả VÙNG TÔ GỐC (vòng ngoài) — cắt mảnh không được làm đổi thứ tự hiển thị
            out.append([round(x0, 8), round(y0, 8), round(x1, 8), round(y1, 8), r, loai[i],
                        Polygon(g.exterior).area if THEO_BAN_VE else p.area, bac[i]])
            so_manh += 1
    tmp = RA + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8', newline='\n') as fo:
        json.dump(out, fo, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, RA)
    print('Bỏ %d vùng không căn cứ nằm lọt trong vùng có căn cứ · ghi %d mảnh → %s (%.1f MB)'
          % (len(bo), so_manh, RA, os.path.getsize(RA) / 1048576))

    # MÀU Ô DIỆN TÍCH trên bảng Thông tin thửa (apps/frontend/public/mau-loai-dat-qh.json, mục "qd893"):
    # mỗi tên loại đất lấy MÀU TÔ chiếm đa số trong các vùng mang tên đó. Tên mới theo chú dẫn mà thiếu màu thì ô ra xám.
    dem = collections.defaultdict(collections.Counter)
    for i in range(len(vung)):
        if i not in bo and mau[i].startswith('#'):
            dem[loai[i]][mau[i]] += 1
    tep_mau = os.path.join(GOC, 'apps', 'frontend', 'public', 'mau-loai-dat-qh.json')
    bang_mau = json.load(io.open(tep_mau, encoding='utf-8'))
    bang_mau['qd893'] = {ten: c.most_common(1)[0][0] for ten, c in sorted(dem.items())}
    with io.open(tep_mau + '.tmp', 'w', encoding='utf-8', newline='\n') as fo:
        json.dump(bang_mau, fo, ensure_ascii=False, indent=1)
    os.replace(tep_mau + '.tmp', tep_mau)
    print('Cập nhật màu %d loại đất QĐ893 → %s' % (len(bang_mau['qd893']), tep_mau))


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(__doc__); sys.exit(1)
    main(*sys.argv[1:4])
