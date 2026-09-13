# -*- coding: utf-8 -*-
"""
ĐỔI BẢNG MÀU CHO DỮ LIỆU ĐÃ DỰNG — không phải đọc lại file DXF.

Bản vẽ CAD không ghi màu thật, nó chỉ ghi SỐ HIỆU MÀU (1–255); muốn biết số đó là màu gì
thì phải tra một BẢNG MÀU. Mà chọn bảng nào cho đúng thì phải thử rồi so với bản vẽ mở bằng
MicroStation — tức là đổi qua đổi lại nhiều lần.

Bước `1b-doc-dxf.py` ghi sẵn số hiệu màu vào trường `ci` của từng ô đất, nên công cụ này chỉ
việc tra lại bảng rồi ghi đè trường `c`. Vài giây là xong, thay vì đọc lại DXF mất vài phút
mỗi bản vẽ.

Cách gọi:
    python 9-doi-bang-mau.py <vao.geojson> <ra.geojson> <tên-bảng-màu>

Tên bảng màu: `autocad` (bảng sẵn trong ezdxf) hoặc tên file .tbl trong thư mục `bang-mau/`
(vd `mau-microstation`, `acadcolor`, `color256`).

Ô nào không có số hiệu màu (`ci` = 0 — hình khai MÀU THẬT trong bản vẽ chứ không qua bảng)
thì GIỮ NGUYÊN màu cũ, vì màu đó không phụ thuộc bảng.
"""
import collections
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BANG_DIR = os.path.join(HERE, 'bang-mau')


def nap_bang(ten):
    """Tên bảng màu → danh sách 256 chuỗi '#rrggbb'."""
    if ten in ('autocad', 'aci'):
        from ezdxf import colors as ezcolors
        return ['#%06x' % (ezcolors.DXF_DEFAULT_COLORS[i] & 0xFFFFFF) for i in range(256)]
    f = os.path.join(BANG_DIR, ten + '.tbl')
    if not os.path.isfile(f):
        co = sorted(x[:-4] for x in os.listdir(BANG_DIR) if x.endswith('.tbl'))
        raise SystemExit('Không có bảng màu "%s". Đang có: autocad, %s' % (ten, ', '.join(co)))
    b = open(f, 'rb').read()
    if len(b) != 768:
        raise SystemExit('File bảng màu phải đúng 768 byte, file này %d byte' % len(b))
    return ['#%02x%02x%02x' % tuple(b[i * 3:i * 3 + 3]) for i in range(256)]


def main(vao, ra, ten_bang):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    bang = nap_bang(ten_bang)
    d = json.load(io.open(vao, encoding='utf-8'))
    doi = giu = 0
    dem = collections.Counter()
    for f in d.get('features', []):
        p = f.get('properties') or {}
        ci = p.get('ci') or 0
        if 1 <= ci <= 255:
            p['c'] = bang[ci]
            doi += 1
            dem[(ci, bang[ci])] += 1
        else:
            giu += 1
    with io.open(ra, 'w', encoding='utf-8') as fp:
        json.dump(d, fp, ensure_ascii=False)
    print('%s → %s   (bảng màu: %s)' % (os.path.basename(vao), os.path.basename(ra), ten_bang))
    print('  · đổi màu %d ô · giữ nguyên %d ô (không có số hiệu màu)' % (doi, giu))
    print('  · 6 số hiệu nhiều ô nhất: ' + ' · '.join('%d→%s (%d ô)' % (ci, m, n) for (ci, m), n in dem.most_common(6)))
    print('  >>> %s — %.1f MB' % (ra, os.path.getsize(ra) / 1048576))


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
