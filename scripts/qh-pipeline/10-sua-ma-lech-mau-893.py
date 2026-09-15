# -*- coding: utf-8 -*-
"""
SỬA Ô QĐ893 BỊ GÁN NHẦM MÃ CHỮ CỦA KHỐI BÊN CẠNH (15/9/2026).

Chuyện gì xảy ra:
  Bản vẽ QĐ893 không đặt tên loại đất vào từng ô (level chỉ là số: Level 30…), mà ghi CHỮ MÃ (ODT, DGD…)
  nằm giữa khối. Bước 5-tao-qh-zones.py gán cho mỗi ô cái chữ rơi vào bên trong nó. Ô nhỏ nằm sát khối lớn
  hay "nuốt" chữ của khối bên cạnh → ô trường học màu hồng cam bị ghi "Đất ở tại đô thị".
  Chủ dự án bắt được ở thửa 303 tờ 32 Cam Đức: ẢNH bản đồ tô màu đất công cộng (QĐ2101 cũng ghi Trường học),
  mà bảng thông tin thửa lại in 4.629 m² Đất ở tại đô thị.

Cách sửa (KHÔNG ĐOÁN tên cụ thể):
  Màu tô thì ô nào cũng có, và màu cho biết NHÓM ĐẤT rất chắc (bảng 'nhom_mau_qd893' trong ten-loai-dat.json
  đo từ chính bản vẽ). Ô nào có MÃ CHỮ thuộc nhóm KHÁC HẲN nhóm của màu → chữ đó là chữ lạc → thay bằng TÊN NHÓM
  của màu (vd "Đất công cộng, dịch vụ, sản xuất"). Không dám ghi "Trường học" vì màu đó dùng chung cho trường,
  chợ, trụ sở… — ghi tên nhóm là đúng sự thật, ghi tên cụ thể là đoán.

Cách chạy (sau 5-tao-qh-zones.py):
  python 10-sua-ma-lech-mau-893.py
Ghi ra file .tmp rồi mới đổi tên (không ghi đè trực tiếp), in số ô đã sửa + vài ví dụ.
"""
import io, json, os, sys
from shapely.geometry import Polygon, shape
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
GOC = os.path.abspath(os.path.join(HERE, '..', '..'))
ZONES = os.path.join(GOC, 'apps', 'backend', 'data', 'qh_zones_893.json')
NGUON = os.path.join(GOC, 'quyhoach2025', 'qd893_qh.geojson')
BANG = json.load(io.open(os.path.join(HERE, 'ten-loai-dat.json'), encoding='utf-8'))

MA = {k: v for k, v in BANG['ma_qhsdd'].items() if not k.startswith('_')}
NHOM_MAU = {k.lower(): v[0] for k, v in BANG['nhom_mau_qd893'].items() if not k.startswith('_')}

# Nhóm của từng MÃ — khai tay, rõ ràng. Mã không có ở đây (giao thông, sông, nghĩa trang, khoáng sản,
# chất thải…) thì KHÔNG xét, vì màu của chúng không nằm trong bảng nhóm màu chắc chắn.
NHOM_MA = {}
for m in ('ODT', 'ONT'):
    NHOM_MA[MA[m]] = 'Đất ở'
for m in ('CLN', 'HNK', 'LUC', 'NKH', 'NTS', 'RSX', 'RPH', 'RDD', 'BCS'):
    NHOM_MA[MA[m]] = 'Đất nông nghiệp'
for m in ('TMD', 'DKV', 'DGD', 'DTT', 'DVH', 'DYT', 'CQP', 'CAN', 'SKC', 'SKK', 'SKN', 'TON', 'DNL', 'CCC'):
    NHOM_MA[MA[m]] = 'Đất công cộng, dịch vụ, sản xuất'


def main():
    Z = json.load(io.open(ZONES, encoding='utf-8'))
    d = json.load(io.open(NGUON, encoding='utf-8'))
    polys, mau = [], []
    for f in d['features']:
        c = ((f.get('properties') or {}).get('c') or '').lower()
        try:
            g = shape(f['geometry'])
        except Exception:
            continue
        for p in (g.geoms if g.geom_type == 'MultiPolygon' else [g]):
            if p.is_valid and p.area > 0:
                polys.append(p); mau.append(c)
    tree = STRtree(polys)

    sua, xet, vd = 0, 0, []
    for z in Z:
        loai, bac = z[5], z[7]
        if bac == 0 or loai not in NHOM_MA:
            continue
        try:
            o = Polygon(z[4])
            pt = o.representative_point()
        except Exception:
            continue
        # Ô nguồn NHỎ NHẤT chứa điểm giữa ô → màu của chính ô đó (không lấy màu khối lớn bao ngoài).
        tot, dt = None, None
        for i in tree.query(pt):
            i = int(i)
            if polys[i].contains(pt) and (dt is None or polys[i].area < dt):
                tot, dt = i, polys[i].area
        if tot is None:
            continue
        # CHỈ tin màu khi ô màu và ô mang chữ là CÙNG MỘT HÌNH (trùng khít ≥ 90%). Không kiểm điều này thì
        # điểm giữa ô rơi vào một ô màu khác nhỏ hơn nằm chồng lên → lấy nhầm màu → sửa sai (đối chiếu với
        # các bản quy hoạch khác: bỏ kiểm này thì cứ 4 ô sửa có 1 ô sai).
        try:
            giao = polys[tot].intersection(o).area
            if giao / max(polys[tot].area, o.area) < 0.9:
                continue
        except Exception:
            continue
        nhom_mau = NHOM_MAU.get(mau[tot])
        if not nhom_mau:
            continue
        xet += 1
        if NHOM_MA[loai] != nhom_mau:
            sua += 1
            if len(vd) < 12:
                vd.append('%s  (màu %s)  →  %s   @ %.6f, %.6f' % (loai, mau[tot], nhom_mau, pt.x, pt.y))
            z[5] = nhom_mau

    print('Xét %d ô có mã chữ + màu chắc chắn; sửa %d ô mã chữ lạc nhóm.' % (xet, sua))
    for s in vd:
        print('  ·', s)
    tmp = ZONES + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8', newline='\n') as fo:
        json.dump(Z, fo, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, ZONES)
    print('Đã ghi', ZONES)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--thu':
        # chạy thử: không ghi file
        _replace = os.replace
        os.replace = lambda a, b: (os.remove(a), print('(chạy thử — không ghi)'))
    main()
