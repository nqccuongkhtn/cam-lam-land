# -*- coding: utf-8 -*-
"""
Dựng file Ô ĐẤT cho phần KIỂM TRA QUY HOẠCH của backend.

Khác với tile (chỉ để NHÌN), file này để backend TÍNH: bấm vào một thửa thì tra xem thửa đó
dính những loại đất gì, mỗi loại bao nhiêu m². Vì vậy nó cần TÊN LOẠI ĐẤT đọc được, chứ
không chỉ cần màu.

Định dạng ra — GIỐNG HỆT apps/backend/data/qh_zones.json đang dùng cho QĐ205, để backend
đọc bằng cùng một đoạn mã:
    [minx, miny, maxx, maxy, ring, "Tên loại đất", diện-tích-độ², bậc]
  · bậc 2 = quy hoạch, 1 = hiện trạng. Cùng một điểm thì ô bậc cao thắng, cùng bậc thì ô NHỎ
    hơn thắng (ô nhỏ = cụ thể hơn).

Cách gọi:
    python 5-tao-qh-zones.py <vung_qh.geojson> <ma> [text_ma.geojson]

  <ma>  : mã ngắn, thành tên file qh_zones_<ma>.json  (vd 2076, 893)
  text_ma.geojson : CHỈ dùng cho QĐ893 — bản vẽ đó đánh số level (Level 30…) nên không suy ra
                    loại đất từ tên được, phải lấy MÃ LOẠI ĐẤT ghi bên trong từng ô
                    (ODT, CLN, LUC…) rồi tra sang tên đầy đủ.
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GOC = os.path.abspath(os.path.join(HERE, '..', '..'))
RA_DIR = os.path.join(GOC, 'apps', 'backend', 'data')

with io.open(os.path.join(HERE, 'ten-loai-dat.json'), encoding='utf-8') as fp:
    BANG = json.load(fp)
TEN = {k.lower(): v for k, v in BANG['ten'].items()}
MA_QHSDD = {k: v for k, v in BANG['ma_qhsdd'].items() if not k.startswith('_')}
MAU_893 = {k.lower(): v for k, v in BANG.get('mau_qd893', {}).items() if not k.startswith('_')}

# Nhãn cho ô mà BẢN VẼ KHÔNG GHI loại đất. Nói thẳng là chưa rõ, TUYỆT ĐỐI KHÔNG đoán.
# Đã thử đoán bằng 'ô cùng màu quanh đó ghi gì': với màu hồng #ff7fff (đất ở) thì đúng
# 93–95%, nghe thì cao nhưng 5% sai lại rơi vào đúng chỗ chết người — đất trường học,
# đất thể thao, đất thương mại bị đoán thành đất ở. In ra phiếu là sai sự thật.
CHUA_RO = 'Loại đất khác'
# MÀU → NHÓM ĐẤT. Xem chú thích 'nhom_mau_qd893' trong ten-loai-dat.json: bảng này ĐO từ chính
# những ô đã ghi chữ trong bản vẽ, không phải đoán. Dùng cho ô không ghi mã chữ, để người xem
# đọc được "Đất ở" / "Đất nông nghiệp" thay vì một câu khó hiểu.
NHOM_MAU = {k.lower(): v[0] for k, v in BANG.get('nhom_mau_qd893', {}).items() if not k.startswith('_')}


def sua_ma_chu(s):
    """Chữ Việt trong DXF hay bị đọc nhầm bảng mã ('ĐVO mới' → 'ÄVO má»i'). latin-1 gỡ được."""
    for enc in ('latin-1', 'cp1252'):
        try:
            return s.encode(enc).decode('utf-8')
        except Exception:
            pass
    return s


def ten_loai(lo):
    """Tên level trong CAD → tên loại đất đọc được. Không tra được thì GIỮ NGUYÊN, không đoán."""
    t = sua_ma_chu(lo or '')
    t = t.lstrip('-_ ')   # có level viết '-DAT_DD_Honhop', dấu '-' đầu làm trượt hết các bước cắt dưới
    t = re.sub(r'^(HT|QH2030|QH2045|QHDD|QHDH)[-_ ]\s*', '', t)
    t = re.sub(r'^DAT_?\s*', '', t)
    t = re.sub(r'^(NDD|DD|NNK|NN|HTXH|HTKT|KHAC|NO|O)_?\s*', '', t)
    # Đuôi '_CH' = CẤP HUYỆN. Từ 2025 cả nước bỏ cấp huyện (tỉnh → xã), nên ghi 'cấp huyện'
    # lên phiếu là ghi một cấp hành chính KHÔNG CÒN TỒN TẠI. Cắt bỏ, giữ lại tên loại đất.
    t = re.sub(r'[-_ ]CH$', '', t)
    t = t.strip()
    return TEN.get(t.lower(), t or sua_ma_chu(lo or '').strip() or 'Chưa rõ loại đất')


def bac_cua(hz):
    return 1 if hz == 'HT' else 2      # hiện trạng xếp dưới, quy hoạch xếp trên


def cac_ring(geom):
    """Mỗi polygon ra MỘT ring ngoài. MultiPolygon thì tách thành nhiều ô."""
    if not geom:
        return []
    t = geom.get('type')
    if t == 'Polygon':
        r = (geom.get('coordinates') or [None])[0]
        return [r] if r and len(r) >= 4 else []
    if t == 'MultiPolygon':
        ra = []
        for poly in geom.get('coordinates') or []:
            r = (poly or [None])[0]
            if r and len(r) >= 4:
                ra.append(r)
        return ra
    return []


def dien_tich_do2(r):
    """Diện tích đa giác theo độ² — chỉ dùng để so ô nào nhỏ hơn, không phải số m² thật."""
    s = 0.0
    for i in range(len(r)):
        x1, y1 = r[i - 1][0], r[i - 1][1]
        x2, y2 = r[i][0], r[i][1]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def nap_ma_tu_chu(duong_text, rings_info):
    """QĐ893: lấy mã loại đất ghi BÊN TRONG từng ô (chồng điểm chữ lên ô nhỏ nhất chứa nó)."""
    from shapely.geometry import shape, Polygon
    from shapely.strtree import STRtree
    d = json.load(io.open(duong_text, encoding='utf-8'))
    diem = []
    for f in d['features']:
        t = sua_ma_chu(((f['properties'] or {}).get('Text') or '')).strip()
        g = f.get('geometry')
        if not t or not g:
            continue
        m = re.findall(r'\b[A-Z]{2,4}\b', t)
        if m and m[0] in MA_QHSDD:
            try:
                diem.append((m[0], shape(g).representative_point()))
            except Exception:
                pass
    polys = [Polygon(r) for r, _ in rings_info]
    tree = STRtree(polys)
    ma = {}
    for code, p in diem:
        tot, dtn = -1, None
        for i in tree.query(p):
            try:
                if polys[i].contains(p):
                    a = polys[i].area
                    if dtn is None or a < dtn:
                        dtn, tot = a, i
            except Exception:
                pass
        if tot >= 0:
            ma[tot] = code
    print('  · %d/%d ô có mã loại đất ghi bên trong' % (len(ma), len(polys)))
    return ma


def tim_o_lot_ben_trong(rings_info, co_ten):
    """Ô KHÔNG có tên nào nằm LỌT hẳn trong một ô ĐÃ CÓ TÊN.

    Phân biệt hai loại ô không tên, vì cách xử lý ngược nhau:
      · Nằm lọt trong ô đã có tên  → BỎ. Bản vẽ chia nhỏ bên trong một khối lớn; giữ lại là
        nó che mất tên của khối lớn (cách tra ưu tiên ô nhỏ nhất chứa điểm).
      · KHÔNG nằm trong ô nào      → GIỮ, ghi 'chưa ghi loại đất'. Bỏ nó đi là để lại LỖ TRỐNG
        giữa bản đồ. Đo trên QĐ893: 4.846 ô kiểu này, ~8.861 ha — và vì thủng lỗ mà cứ 5 thửa
        ở Cam Đức thì 1 thửa mất hẳn dòng QĐ893 trên phiếu tra cứu.
    """
    from shapely.geometry import Polygon
    from shapely.strtree import STRtree
    polys = [Polygon(r) for r, _ in rings_info]
    gpolys = [polys[i] for i in co_ten]
    if not gpolys:
        return set()
    tree = STRtree(gpolys)
    ra = set()
    for i in range(len(polys)):
        if i in co_ten:
            continue
        try:
            pt = polys[i].representative_point()
        except Exception:
            continue
        for j in tree.query(pt):
            if gpolys[int(j)].contains(pt):
                ra.add(i)
                break
    return ra


def main(vao, ma, duong_text=None):
    d = json.load(io.open(vao, encoding='utf-8'))
    rings_info = []                                  # [(ring, properties)]
    for f in d.get('features', []):
        p = f.get('properties') or {}
        for r in cac_ring(f.get('geometry')):
            rings_info.append((r, p))
    print('%s: %d ô đất' % (ma, len(rings_info)))

    ma_theo_o = nap_ma_tu_chu(duong_text, rings_info) if duong_text else {}

    lot_trong_o_co_ten = set()
    if duong_text:
        co_ten = set(ma_theo_o) | {i for i, (_, p) in enumerate(rings_info)
                                   if (p.get('c') or '').lower() in MAU_893}
        lot_trong_o_co_ten = tim_o_lot_ben_trong(rings_info, co_ten)
        print('  · %d ô không ghi mã nằm lọt trong ô đã có tên (bỏ), %d ô còn lại giữ làm "chưa rõ"'
              % (len(lot_trong_o_co_ten), len(rings_info) - len(co_ten) - len(lot_trong_o_co_ten)))

    out = []
    chua_ro = 0
    for i, (r, p) in enumerate(rings_info):
        xs = [c[0] for c in r]
        ys = [c[1] for c in r]
        bac = bac_cua(p.get('hz'))
        if duong_text and (p.get('c') or '').lower() in MAU_893:
            # ⚠️ MÀU THẮNG CHỮ, ở ĐÚNG hai màu đường và kênh mương (xem chú thích 'mau_qd893').
            # Vì sao phải ưu tiên màu: mã loại đất được gán bằng cách xem CHỮ nào rơi vào trong ô.
            # Ô đường là dải dài ngoằn ngoèo len giữa các khối nhà, nên chữ 'ODT' của khối bên cạnh
            # rất hay rơi trúng nó → cả dải đường bị gán nhầm thành 'Đất ở tại đô thị'.
            # Đo thật: trong 1.572 ô màu cam, 1.444 ô có chữ ghi DGT (đúng) nhưng 128 ô bị chữ của
            # khối khác rơi vào, gán sai thành đất ở / đất giáo dục.
            # Hậu quả thấy được: thửa tờ 25 thửa 70 (Cam Đức) có 129,7 m² nằm trong dải đường màu
            # cam, ẢNH bản đồ vẽ đúng là đường, nhưng phiếu tra cứu lại ghi cả 511,9 m² là đất ở.
            # Màu thì cả dải chỉ có một, không thể lệch như chữ — nên màu đáng tin hơn hẳn.
            loai = MAU_893[(p.get('c') or '').lower()]
        elif i in ma_theo_o:
            loai = MA_QHSDD[ma_theo_o[i]]            # QĐ893: tên theo mã chuẩn ghi trong bản vẽ
        elif duong_text:
            # Ô KHÔNG ghi mã, màu cũng không đủ căn cứ. VẪN KHÔNG ĐOÁN loại đất — nhưng cũng
            # KHÔNG vứt ô đi nữa (xem CHUA_RO ở dưới): vứt là thủng lỗ, mà thủng lỗ thì cả bản
            # quy hoạch biến mất khỏi phiếu tra cứu.
            if i in lot_trong_o_co_ten:
                # Ô nhỏ nằm LỌT trong một ô đã có tên → bỏ đúng. Giữ lại là nó thắng ô lớn
                # (cách tra ưu tiên ô NHỎ NHẤT chứa điểm) → tra thửa nào cũng ra "chưa rõ".
                chua_ro += 1
                continue
            loai = NHOM_MAU.get((p.get('c') or '').lower(), CHUA_RO)
            bac = 0          # bậc 0 = thấp nhất, luôn thua mọi ô có tên thật
        elif re.fullmatch(r'\s*\d+\s*', p.get('lo') or ''):
            # Level chỉ là con số (vd '0' — level mặc định của CAD): bản vẽ KHÔNG nói đây là đất gì.
            # Không ghi thì phiếu tra cứu in ra loại đất tên "0" (gặp ở Cù Hin, 2 ô). Không đoán.
            loai = CHUA_RO
            bac = 0
        else:
            loai = ten_loai(p.get('lo'))
        # làm tròn toạ độ 6 số lẻ (~0,1 m) cho file nhẹ đi đáng kể
        ring = [[round(c[0], 6), round(c[1], 6)] for c in r]
        out.append([round(min(xs), 6), round(min(ys), 6), round(max(xs), 6), round(max(ys), 6),
                    ring, loai, dien_tich_do2(r), bac])

    os.makedirs(RA_DIR, exist_ok=True)
    ra = os.path.join(RA_DIR, 'qh_zones_%s.json' % ma)
    with io.open(ra, 'w', encoding='utf-8') as fp:
        json.dump(out, fp, ensure_ascii=False, separators=(',', ':'))
    from collections import Counter
    c = Counter(z[5] for z in out)
    theo_nhom = sum(v for k, v in c.items() if k in set(NHOM_MAU.values()))
    print('  · %d loại đất khác nhau%s · %d ô đặt tên theo NHÓM (màu), %d ô "%s"'
          % (len(c), (' · bỏ %d ô lọt bên trong' % chua_ro) if chua_ro else '',
             theo_nhom, c.get(CHUA_RO, 0), CHUA_RO))
    print('  · 5 loại nhiều ô nhất: ' + ' · '.join('%s (%d)' % (k[:28], v) for k, v in c.most_common(5)))
    print('  >>> %s — %.1f MB' % (ra, os.path.getsize(ra) / 1048576))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
