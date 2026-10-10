# -*- coding: utf-8 -*-
"""
QĐ205: BỔ SUNG CÁC VÙNG ĐẤT BỊ THIẾU vào apps/backend/data/qh_zones.json (10/10/2026).

Phát hiện khi đối chiếu web với bản vẽ gốc QD205 (QD205.gpkg lớp `hatches` = 1.947 vùng tô còn nguyên đường bao):
rải 13.910 điểm trong các vùng tô → web khớp 95–100 % ở gần như mọi lớp, TRỪ 2 lớp web KHÔNG CÓ ô nào:
  · `_X_ĐVO mớiTB_2030`   (đơn vị ở mới mật độ trung bình, giai đoạn 2030) — 857 ha, web ghi "Đất khác"/"đất giao thông"
  · `L-QH-langxomdothihoa` (làng xóm đô thị hoá — quy hoạch)              —  56 ha, web ghi "đất giao thông"
(Lớp đầu bị sót có lẽ vì tên có dấu bị lỗi mã "Ä\\x90VO má»›i" nên lúc dựng không nhận ra.)

Tên loại đất dùng ĐÚNG tên web đang dùng cho lớp anh em đã có:
  · `_X_DVO moiTB_2045` (cùng màu 238,200,16, cùng kiểu tô) → web ghi "Đất đơn vị ở"
  · `L-htrang_lang xom do thi hoa` → web ghi "Làng xóm đô thị hóa"
Bậc 2 (quy hoạch) vì cả hai đều là lớp QUY HOẠCH.

⚠️ HAI BẪY HÌNH HỌC (đã đo):
  1. GDAL đọc vùng tô nhiều vòng thì lấy vòng ĐẦU làm vòng ngoài, các vòng sau làm LỖ — sai với vùng tô CAD có nhiều vòng
     rời nhau (có vùng "0,1 ha mà lỗ 35 ha"). Phải dựng theo LUẬT CHẴN–LẺ (điểm trong số lẻ vòng = được tô):
     ra 857 ha thay vì 735 ha; 122 ha chênh có mật độ nét tô trong QD205.dxf 20,7 nét/ha = đúng bằng cả lớp (20,2),
     và 99,1 % nét tô của lớp nằm trong hình chẵn–lẻ → chẵn–lẻ đúng.
  2. qhCompute.ts KHÔNG hỗ trợ ô có LỖ → vùng có lỗ được CẮT thành nhiều mảnh không lỗ (đường cắt dọc qua tâm lỗ),
     nhờ vậy lòng đường / ô khác nằm trong lỗ vẫn giữ nguyên.

Cách gọi (chạy lại nhiều lần vẫn an toàn — xoá các ô do chính script này thêm lần trước rồi mới thêm lại):
    ogr2ogr -f GeoJSON -t_srs EPSG:4326 -s_srs "<PROJ VN-2000 Khánh Hoà>" -nlt MULTIPOLYGON -skipfailures \\
            hatch205.geojson quyhoach2025/QD205.gpkg hatches
    python scripts/qh-pipeline/5c-bo-sung-205-tu-gpkg.py hatch205.geojson
"""
import io, json, os, sys
from shapely.geometry import Polygon, MultiPolygon, LineString, box
from shapely.ops import unary_union, split

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'apps', 'backend', 'data', 'qh_zones.json')
BO_SUNG = [  # (chuỗi nhận diện trong tên lớp, tên loại đất trên web, bậc)
    ('TB_2030', 'Đất đơn vị ở', 2),
    ('L-QH-langxomdothihoa', 'Làng xóm đô thị hóa', 2),
]
DAU = 'bs205'   # đánh dấu ô do script này thêm (phần tử thứ 9) để chạy lại không nhân đôi


def chan_le(geom):
    kq = None
    for p in geom['coordinates']:
        for r in p:
            if len(r) < 4:
                continue
            v = Polygon(r).buffer(0)
            kq = v if kq is None else kq.symmetric_difference(v)
    return kq


def cat_lo(p):
    """Cắt đa giác có lỗ thành các mảnh KHÔNG lỗ."""
    if p.is_empty:
        return []
    if not p.interiors:
        return [p]
    cx = p.interiors[0].centroid.x
    minx, miny, maxx, maxy = p.bounds
    dao = split(p, LineString([(cx, miny - 1), (cx, maxy + 1)]))
    ra = []
    for m in dao.geoms:
        for q in (m.geoms if isinstance(m, MultiPolygon) else [m]):
            ra.extend(cat_lo(q))
    return ra


def main(vao):
    g = json.load(io.open(vao, encoding='utf-8'))
    Z = json.load(io.open(OUT, encoding='utf-8'))
    truoc = len(Z)
    Z = [z for z in Z if not (len(z) > 8 and z[8] == DAU)]
    for khoa, ten, bac in BO_SUNG:
        F = [f for f in g['features'] if f['geometry'] and khoa in f['properties']['layer']]
        hinh = unary_union([chan_le(f['geometry']) for f in F])
        manh = []
        for p in (hinh.geoms if hasattr(hinh, 'geoms') else [hinh]):
            manh.extend(cat_lo(p))
        dt = 0
        for m in manh:
            if m.area < 1e-10:        # mảnh vụn < ~1 m²
                continue
            r = [[round(x, 6), round(y, 6)] for x, y in m.exterior.coords]
            minx, miny, maxx, maxy = m.bounds
            Z.append([round(minx, 6), round(miny, 6), round(maxx, 6), round(maxy, 6), r, ten, float('%.8g' % m.area), bac, DAU])
            dt += m.area
        print(f'{khoa}: {len(F)} vùng tô → {len(manh)} mảnh, {dt * 108860 * 110600 / 1e4:.1f} ha → "{ten}" bậc {bac}')
    json.dump(Z, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'qh_zones.json: {truoc} → {len(Z)} ô')


if __name__ == '__main__':
    main(sys.argv[1])
