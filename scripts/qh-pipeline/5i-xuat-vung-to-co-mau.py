# -*- coding: utf-8 -*-
"""
XUẤT VÙNG TÔ CÓ MÀU ĐỂ CẮT LẠI ẢNH TILE PHÂN KHU (11/10/2026) — CÙNG HÌNH với ô đất web đang TÍNH (5g), CÙNG MÀU với bản vẽ gốc.

Vì sao cần: ảnh tile 7 bản phân khu vẫn cắt từ chuỗi cũ (1b → *_qh_tuoi2_sach.geojson), mà chuỗi cũ có 3 lỗi đã sửa ở phần TÍNH
(5g): lấp lỗ trong vùng tô (QĐ2222 hồ nước 7 ha hiện thành đất du lịch), vẽ cả phần ngoài ranh, xếp lớp khác ảnh MicroStation.
Không tô lại theo BẢNG MÀU chú giải của web được: cùng một loại đất, bản vẽ tô màu khác nhau theo giai đoạn (QĐ2101 "Nhóm nhà ở
mật độ trung bình": hiện trạng #4c4c26 ô liu, quy hoạch #a57c00 vàng) — tô theo bảng màu là mất phân biệt đó, sai với bản vẽ.
Nên xuất lại đúng hình 5g + MÀU CỦA TỪNG VÙNG TÔ trong bản vẽ, xếp thứ tự vẽ đúng thứ tự thắng của phần tính (bậc thấp vẽ trước,
cùng bậc thì vùng to vẽ trước → vùng nhỏ nằm trên), rồi đưa vào 3-cat-tile.py (trường màu 'c').

⚠️ KHÔNG ghi gì vào apps/backend/data — chỉ ghi tệp GeoJSON ra chỗ chỉ định. Cắt tile và thay bộ tile trên web phải chờ chủ dự án
duyệt ảnh thử (quy ước "vẽ thử trước khi cắt tile").

Cách gọi (đủ chuỗi cắt lại tile, GIỮ NGUYÊN bảng màu + hoa văn đã duyệt 14/9/2026):
  python 5i-xuat-vung-to-co-mau.py <ban_ve.dxf> <ma> <vung.geojson>
  python 9-doi-bang-mau.py <vung.geojson> <vung_tuoi.geojson> autocad-tuoi     # bảng 'autocad-tuoi' = đúng bảng của bộ tile đang chạy
                                                                                 # (đã thử: ra trùng 1.637/1.637 ô cả màu lẫn hoa văn)
  3-cat-tile.py <vung_tuoi.geojson> <thư mục tile mới> 8 18 c <qd<ma>_net.geojson>    (chạy bằng python của QGIS — xem 3-cat-tile.py)
Tệp ra có 'lo' (level) + 'ci' (số hiệu màu) như tệp của bước 1b nên 9-doi-bang-mau.py dùng thẳng được; 'c' = màu gốc bản vẽ.
"""
import io, json, os, re, sys, importlib.util
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
sp = importlib.util.spec_from_file_location('g5', os.path.join(HERE, '5g-dung-o-phan-khu.py'))
g5 = importlib.util.module_from_spec(sp); sp.loader.exec_module(g5)      # chỉ lấy các hàm dùng chung, KHÔNG gọi main()


def main(vao, ma, ra):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    b1, b5, CX = g5.b1, g5.b5, g5.CX
    R = json.load(io.open(os.path.join(g5.DATA, 'ranh_qh.json'), encoding='utf-8'))
    RG = make_valid(Polygon(R[ma]))
    try: TCG = json.load(io.open(os.path.join(HERE, 'ten-theo-chu-giai.json'), encoding='utf-8')).get(ma) or {}
    except Exception: TCG = {}
    try: SL = json.load(io.open(os.path.join(HERE, 'ten-suy-luan.json'), encoding='utf-8')).get(ma) or {}
    except Exception: SL = {}
    from shapely.ops import transform
    wgs = lambda g: transform(lambda x, y, z=None: tuple(zip(*[b1.vn2wgs(a, b) for a, b in zip(x, y)])), g)
    import ezdxf
    d = ezdxf.readfile(vao); msp = d.modelspace()
    ft = []
    for e in msp:
        if e.dxftype() != 'HATCH': continue
        lv = e.dxf.get('layer', '') or ''
        if 'ranh gi' in lv.lower() or lv.upper().startswith('RG') or b1.bo_level(lv): continue
        L = d.layers.get(lv) if d.layers.has_entry(lv) else None
        if L is not None and (L.is_frozen() or L.is_off()): continue
        if g5.KHOP.search(lv): continue
        try: ds = list(CX.duong_bao_hatch(e))
        except Exception: continue
        polys = [make_valid(Polygon(p)) for p in ds if len(p) >= 3]
        if not polys: continue
        g = unary_union(polys) if e.dxf.get('hatch_style', 0) == 2 or len(polys) == 1 else make_valid(g5.chan_le(polys))
        if g.is_empty: continue
        W = make_valid(wgs(g))
        x0, y0, x1, y1 = W.bounds
        if not (b1.KHUNG[0] <= x0 and x1 <= b1.KHUNG[2] and b1.KHUNG[1] <= y0 and y1 <= b1.KHUNG[3]): continue
        if re.fullmatch(r'\s*\d+\s*', lv): loai, bac = b5.CHUA_RO, 0
        else: loai, bac = b5.ten_loai(lv), g5.BAC.get(b1.nhom(lv), 3)
        mau, ci = b1.mau_va_so(e, d); mau = mau.lower()
        loai = TCG.get('theo_level_mau', {}).get('%s||%s' % (g5.h5_sua(lv), mau)) or TCG.get('theo_level', {}).get(g5.h5_sua(lv)) or loai
        loai = SL.get(g5.h5_sua(lv), loai)
        for phan in g5.cac_da_giac(W):
            dt = Polygon(phan.exterior).area
            trong = make_valid(phan.intersection(RG))
            if trong.is_empty: continue
            for m in g5.cac_da_giac(trong):
                if m.area * 1.21e10 < 0.5: continue
                ft.append((bac, -dt, {'type': 'Feature', 'properties': {'c': mau, 'ci': ci, 'lo': lv, 'loai': loai, 'bac': bac},
                                       'geometry': mapping(m)}))
    ft.sort(key=lambda x: (x[0], x[1]))            # bậc thấp trước; cùng bậc vùng TO trước → vùng nhỏ / bậc cao vẽ đè lên trên
    json.dump({'type': 'FeatureCollection', 'features': [f for _, _, f in ft]}, io.open(ra, 'w', encoding='utf-8'), ensure_ascii=False)
    print('%s: ghi %d vùng có màu → %s' % (ma, len(ft), ra))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
