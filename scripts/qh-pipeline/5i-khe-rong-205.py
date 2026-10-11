# -*- coding: utf-8 -*-
"""
QĐ205 — TÍNH SẴN "KHE RỘNG" (lòng đường) TỪ Ô ĐẤT CHUẨN (11/10/2026). Chạy SAU 5h-dung-o-205-tu-gpkg.py.

QĐ205 không vẽ ô "đất giao thông": đường = phần TRONG RANH không tô màu. Ngoài khung mặt nạ đường (road_mask, chỉ phủ ~7×6 km
quanh Cam Đức) web dùng luật "điểm trong khe cách ô gần nhất ≥ 2,5 m thì là đường, gần hơn thì tính cho ô đó" — đặt ra để lấp
kẽ hở VẼ CHƯA KHÍT giữa hai ô. Nhưng với ô dựng chuẩn từ gpkg (mép ô trùng mép đường) luật đó cắt MỖI BÊN ĐƯỜNG một dải 2,5 m
giao cho ô bên cạnh: đường 20 m bị đếm thiếu 5 m (thửa 646 tờ 7 xã 22471: bản vẽ 476,5 m² đơn vị ở + 683,3 m² lòng đường,
web ghi 556,4 + 603,4).
Cách đúng: phân biệt KHE RỘNG (lòng đường) với KẼ HỞ HẸP (vẽ chưa khít) theo BỀ RỘNG của chính khe: co phần không tô vào 1,5 m
rồi nở lại 1,5 m — chỗ nào còn lại là khe rộng ≥ 3 m (đường: TOÀN BỘ, sát mép vẫn là đường); kẽ hẹp < 3 m biến mất (→ ô gần nhất
như cũ). Ghi apps/backend/data/khe_rong_205.json dạng ô đất (qhCompute nạp như một kho ô riêng).
"""
import io, json, os, sys, importlib.util
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'apps', 'backend', 'data')
sp = importlib.util.spec_from_file_location('h5', os.path.join(HERE, '5h-dung-o-205-tu-gpkg.py')); h5 = importlib.util.module_from_spec(sp); sp.loader.exec_module(h5)
R_M = 1.5                                  # nửa bề rộng tối thiểu của khe rộng (m)


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    Z = json.load(io.open(os.path.join(DATA, 'qh_zones.json'), encoding='utf-8'))
    RG = make_valid(Polygon(json.load(io.open(os.path.join(DATA, 'ranh_qh.json'), encoding='utf-8'))['205']))
    U = unary_union([make_valid(Polygon(z[4])) for z in Z])
    khe = make_valid(RG.difference(U))
    d = R_M / 111000
    rong = make_valid(khe.buffer(-d, join_style=2).buffer(d, join_style=2).intersection(khe))
    out = []
    for m in h5.manh_khong_lo(make_valid(rong)):
        if m.area * 1.21e10 < 1: continue
        r = [[round(x, 6), round(y, 6)] for x, y in m.exterior.coords]
        if len(r) < 4: continue
        x0, y0, x1, y1 = m.bounds
        out.append([round(x0, 6), round(y0, 6), round(x1, 6), round(y1, 6), r, 'Đất giao thông', m.area, 2])
    json.dump(out, io.open(os.path.join(DATA, 'khe_rong_205.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('khe trống trong ranh %.0f ha → khe rộng (đường) %.0f ha, %d mảnh; kẽ hẹp %.1f ha'
          % (khe.area * 1.21e10 / 1e4, rong.area * 1.21e10 / 1e4, len(out), (khe.area - rong.area) * 1.21e10 / 1e4))


if __name__ == '__main__':
    main()
