# -*- coding: utf-8 -*-
"""
QĐ893: RÚT CHỮ MÃ LOẠI ĐẤT + KÝ HIỆU CÔNG TRÌNH từ DXF → hai file điểm GeoJSON (WGS84).
Dùng cho 5b-tao-qh-zones-893.py. (15/9/2026, sau khi chủ dự án bắt lỗi thửa 303 tờ 32 Cam Đức.)

Ba điều đo được trên chính bản vẽ — đọc kỹ trước khi sửa:
  1. CHỮ MÃ Ở HAI LEVEL KHÁC NGHĨA. Khung chú dẫn có hai cột "HIỆN TRẠNG" và "QUY HOẠCH".
     Level 34 = mã QUY HOẠCH, Level 33 = mã HIỆN TRẠNG. Bằng chứng: 77 vùng có chữ ở cả hai level,
     cả 77 vùng hai mã KHÁC nhau (vd hiện trạng CLN → quy hoạch DGD). Level 56 = chữ trong khung chú dẫn.
  2. VỊ TRÍ CHỮ = ĐIỂM CANH (align_point) khi chữ canh giữa/phải, KHÔNG phải điểm chèn (insert).
     Lấy nhầm điểm chèn thì chữ lệch hàng chục mét: chữ ODT của khu nhà ở rơi vào trong ô trường mẫu giáo.
  3. KÝ HIỆU CÔNG TRÌNH (khối INSERT ở Level 8/9) đặt ĐÚNG giữa công trình: quyển sách = trường học,
     vòng tròn dấu thập = y tế, dấu thập trên chấm tròn = nhà thờ, hình bầu dục = sân vận động, chấm tròn
     đặc = UBND. Khối vô danh (*U11…) là bản sao của khối có tên → nhận ra bằng "dấu vân tay" hình học
     (đếm loại nét). Đã vẽ từng khối ra ảnh để nhìn tận mắt trước khi ghi bảng dưới.

Cách gọi:
    python 1c-doc-chu-ky-hieu-893.py "QD893 QHSDD2030.dxf" qd893_chu.geojson qd893_kyhieu.geojson
"""
import collections, importlib.util, io, json, os, sys
import ezdxf

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('_b1', os.path.join(HERE, '1b-doc-dxf.py'))
b1 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(b1)

# Khối CÓ TÊN → mã loại đất. Chỉ những ký hiệu có nghĩa MỘT loại đất rõ ràng.
# CỐ Ý BỎ: CHUA (chú dẫn gộp "Đình, chùa, miếu, đền" = có thể TON hoặc TIN), BD (bưu điện — ký hiệu nhỏ, nhà bưu điện
# thường nằm trong khối đất khác).
KHOI_TEN = {'TH': 'DGD', 'NT': 'TON', 'UB.X': 'TSC', 'UB.H': 'TSC', 'BVTX': 'DYT', 'SVD': 'DTT'}
# Khối VÔ DANH → nhận bằng dấu vân tay hình học (đã đối chiếu ảnh vẽ ra với khối có tên cùng hình).
VAN_TAY = {
    (('LINE', 16), ('LWPOLYLINE', 8)): 'DGD',                             # quyển sách mở = trường học (giống khối TH)
    (('HATCH', 1), ('LINE', 2)): 'TON',                                   # dấu thập trên chấm tròn = nhà thờ (giống NT)
    (('CIRCLE', 1), ('HATCH', 4), ('LINE', 4), ('SOLID', 1)): 'DYT',      # vòng tròn dấu thập = y tế (giống BVTX)
    (('LINE', 2), ('LWPOLYLINE', 2)): 'DTT',                              # hình bầu dục = sân vận động (giống SVD)
}


def ma_khoi(doc, ten):
    goc = ten.split('_')[0]
    if goc in KHOI_TEN:
        return KHOI_TEN[goc]
    if ten.startswith('*U') and ten in doc.blocks:
        vt = tuple(sorted(collections.Counter(e.dxftype() for e in doc.blocks[ten]).items()))
        return VAN_TAY.get(vt)
    return None


def main(vao, ra_chu, ra_kh):
    doc = ezdxf.readfile(vao)
    msp = doc.modelspace()
    chu = []
    for e in msp.query('TEXT MTEXT'):
        try:
            if e.dxftype() == 'TEXT':
                s = e.dxf.text
                p = e.dxf.align_point if ((e.dxf.get('halign', 0) or e.dxf.get('valign', 0)) and e.dxf.hasattr('align_point')) else e.dxf.insert
            else:
                s = e.plain_text(); p = e.dxf.insert
            lon, lat = b1.vn2wgs(p.x, p.y)
            chu.append({'type': 'Feature', 'properties': {'Text': s, 'lo': e.dxf.layer},
                        'geometry': {'type': 'Point', 'coordinates': [lon, lat]}})
        except Exception:
            pass
    kh = []
    for e in msp.query('INSERT'):
        if e.dxf.layer not in ('Level 8', 'Level 9'):
            continue
        m = ma_khoi(doc, e.dxf.name)
        if not m:
            continue
        p = e.dxf.insert
        lon, lat = b1.vn2wgs(p.x, p.y)
        kh.append({'type': 'Feature', 'properties': {'ma': m, 'khoi': e.dxf.name},
                   'geometry': {'type': 'Point', 'coordinates': [lon, lat]}})
    for tep, fs in ((ra_chu, chu), (ra_kh, kh)):
        with io.open(tep, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'type': 'FeatureCollection', 'features': fs}, f, ensure_ascii=False)
    print('%d chữ → %s' % (len(chu), ra_chu))
    print('%d ký hiệu công trình → %s  %s' % (len(kh), ra_kh, dict(collections.Counter(f['properties']['ma'] for f in kh))))


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(__doc__); sys.exit(1)
    main(*sys.argv[1:4])
