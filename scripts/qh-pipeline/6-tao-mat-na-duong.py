# -*- coding: utf-8 -*-
"""
Dựng MẶT NẠ ĐƯỜNG riêng cho từng bản quy hoạch 1/2000.

VÌ SAO CẦN: bản vẽ quy hoạch chỉ tô màu Ô ĐẤT, phần đường để TRẮNG. Tra một thửa thì phần rơi
vào chỗ trắng không đọc ra loại gì, web đành ghi "chỉ phủ 85% thửa". Có mặt nạ này thì ghi
thẳng được "Đất giao thông".

ĐÃ THỬ 3 CÁCH, ĐO TRÊN 43 THỬA THẬT CỦA QĐ2101 (723 điểm rơi vào chỗ trắng):

    cách                                    bắt được chỗ trắng
    ─────────────────────────────────────   ──────────────────
    loang nước từ ngoài biên (như QĐ205)          36%   ✗ loại
    nong nét đường ra  6 m                        92%
    nong nét đường ra  8 m                        96%   ✓ CHỌN
    nong nét đường ra 12 m                       100%   (lấn sang đất nhiều hơn)

Vì sao cách của QĐ205 KHÔNG dùng lại được: QĐ205 có bộ MÉP ĐƯỜNG riêng (roads_signed.json) dựng
qua một quy trình chuyên biệt, mép khép kín nên loang nước được. Còn `chỉ giới đường đỏ` trong
bản 1/2000 đứt quãng, nước không loang vào hành lang → chỉ bắt được 1/3.

Vì sao KHÔNG biến hành lang đường thành "ô đất" trong qh_zones: gộp xong cả mạng đường dính
thành vài khối lớn CÓ LỖ (mỗi lỗ là một khu dân cư), mà định dạng ô đất chỉ chứa được một
đường viền ngoài — mất lỗ thì cả khu dân cư bị tính là đường. Ảnh bitmap thì giữ được lỗ.

⚠️ Mặt nạ này chỉ được hỏi ở chỗ KHÔNG ô đất nào phủ. Điểm nằm trong ô đất thì lấy loại từ ô,
không đụng tới mặt nạ — nên chuyện mặt nạ có lấn sang đất một ít không ảnh hưởng kết quả.

Cách gọi:
    python 6-tao-mat-na-duong.py <ma> <net.geojson> [bán-kính-mét] [mét-mỗi-pixel]
"""
import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.abspath(os.path.join(HERE, '..', '..', 'apps', 'backend', 'data'))
LE = 0.002          # đệm quanh bbox (~220 m) để đường ở rìa không bị cắt cụt

# Level nào là ĐƯỜNG — lấy theo TÊN LEVEL trong bản vẽ, không đoán theo màu.
#   HTKT_GT_*   = hạ tầng kỹ thuật · giao thông (CGDD = chỉ giới đường đỏ, LONGDUONG, NK 13m…)
#   QH-Le duong = lề đường · QH-Via he = vỉa hè · L-duong dao = đường dạo
#   traffic-pavement = MÉP ĐƯỜNG trong bản vẽ QĐ205 (level '-1-TRAFFIC-PAVEMENT', 32.071 nét,
#                      phủ cả huyện). QĐ205 đặt tên level khác ba bản 1/2000 nên phải kể riêng.
KHOA = ('htkt_gt', 'htkt-gt', 'le duong', 'via he', 'duong dao', 'longduong', 'duongsat',
        'traffic-pavement')


def la_duong(lv):
    s = (lv or '').lower()
    return any(k in s for k in KHOA)


def cac_doan(geom, ra):
    if not geom:
        return
    t, c = geom.get('type'), geom.get('coordinates')
    lines = [c] if t == 'LineString' else (c if t == 'MultiLineString' else [])
    for ln in lines:
        for i in range(1, len(ln)):
            ra.append((ln[i - 1][0], ln[i - 1][1], ln[i][0], ln[i][1]))


def main(ma, duong_net, bk=8.0, mpp=3.0):
    Z = json.load(io.open(os.path.join(DATA, 'qh_zones_%s.json' % ma), encoding='utf-8'))
    x0 = min(z[0] for z in Z) - LE; y0 = min(z[1] for z in Z) - LE
    x1 = max(z[2] for z in Z) + LE; y1 = max(z[3] for z in Z) + LE
    W = int((x1 - x0) * 111320 * math.cos(math.radians((y0 + y1) / 2)) / mpp)
    H = int((y1 - y0) * 110540 / mpp)
    print('%s: lưới %dx%d @ %.1f m/px (%.1f triệu ô) · nong nét ra %.0f m' % (ma, W, H, mpp, W * H / 1e6, bk))

    doan = []; bo = 0
    for f in json.load(io.open(duong_net, encoding='utf-8')).get('features', []):
        if la_duong((f.get('properties') or {}).get('lo')):
            cac_doan(f.get('geometry'), doan)
        else:
            bo += 1
    print('  · %d đoạn nét ĐƯỜNG (bỏ %d nét khác: viền ô đất, ranh…)' % (len(doan), bo))
    if not doan:
        print('  LỖI: không thấy nét đường nào — kiểm lại tên level.'); return

    def px(x, y):
        return (int((x - x0) / (x1 - x0) * W), int((1 - (y - y0) / (y1 - y0)) * H))

    im = Image.new('1', (W, H), 0)
    dr = ImageDraw.Draw(im)
    rong = max(1, int(round(2 * bk / mpp)))      # nong đều hai bên nét
    for (ax, ay, bx, by) in doan:
        dr.line([px(ax, ay), px(bx, by)], fill=1, width=rong)
    a = np.array(im, dtype=bool)
    del im, dr
    print('  · mặt nạ phủ %.1f%% lưới' % (100 * a.mean()))

    goi = np.packbits(a, axis=1)
    goi.tofile(os.path.join(DATA, 'road_mask_%s.bin' % ma))
    json.dump({'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'W': W, 'H': H,
               'rowbytes': int(goi.shape[1]), 'mpp': mpp, 'bk': bk},
              io.open(os.path.join(DATA, 'road_mask_%s.json' % ma), 'w', encoding='utf-8'))
    print('  >>> road_mask_%s.bin (%.1f MB)' % (ma, os.path.getsize(os.path.join(DATA, 'road_mask_%s.bin' % ma)) / 1048576))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    main(sys.argv[1], sys.argv[2],
         float(sys.argv[3]) if len(sys.argv) > 3 else 8.0,
         float(sys.argv[4]) if len(sys.argv) > 4 else 3.0)
