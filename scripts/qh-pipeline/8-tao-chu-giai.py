# -*- coding: utf-8 -*-
"""
TẠO BẢNG CHÚ GIẢI cho bản đồ quy hoạch trên web.

Chạy SAU bước 7 (tô màu theo loại đất), đọc các file đã tô màu rồi ghi ra
`apps/frontend/public/chu-giai-qh.json` — trang bản đồ nạp file này để hiện nút "Chú giải".

Nguyên tắc: CHỈ liệt kê loại đất THẬT SỰ có trên bản đồ. Liệt kê cả bảng màu 80 dòng trong khi
bản đồ chỉ dùng 30 loại là làm người xem phải dò giữa một đống dòng vô nghĩa. Mỗi dòng còn ghi
kèm số ô để biết loại nào nhiều — sắp theo nhóm, trong nhóm sắp theo số ô giảm dần.

Cách gọi:
    python 8-tao-chu-giai.py <vao1_mau.geojson> [vao2_mau.geojson ...]
"""
import collections
import importlib.util
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GOC = os.path.abspath(os.path.join(HERE, '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'chu-giai-qh.json')

_spec = importlib.util.spec_from_file_location('_z7', os.path.join(HERE, '7-to-mau-loai-dat.py'))
_z7 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_z7)

with io.open(os.path.join(HERE, 'mau-loai-dat.json'), encoding='utf-8') as fp:
    _B = json.load(fp)
NHOM = _B['nhom']
MAU_TOI_NHOM = {m.lower(): ten for ten, ms in NHOM.items() for m in ms}


def main(files):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    dem = collections.Counter()      # (mau, ten loai dat) -> so o
    for f in files:
        d = json.load(io.open(f, encoding='utf-8'))
        for ft in d.get('features', []):
            p = ft.get('properties') or {}
            # `lt` do bước 7 ghi, đã kèm phần '(hiện trạng)' / '(sắc nhạt…)'.
            # Không có `lt` (file chưa qua bước 7) thì lùi về tên loại đất trơn.
            ten = p.get('lt') or _z7.ten_loai(p.get('lo', ''))
            m = (p.get('c') or '').lower()
            # `nh` do bước 7 ghi = tên nhóm. Ô nào không có `nh` là ô GIỮ NGUYÊN màu CAD
            # (chưa khai màu) → không đưa vào chú giải, vì chú giải chỉ nói về bộ màu của mình.
            nh = p.get('nh') or MAU_TOI_NHOM.get(m, '')
            if nh:
                dem[(nh, m, ten)] += 1

    # GỘP THEO MÀU. Nhiều loại đất dùng chung một màu (vd 'Trường học' và 'Trường học nông thôn'
    # đều #f2a3a3). Không gộp thì chú giải ra 84 dòng, trong đó có những ô màu giống nhau y hệt
    # xếp cạnh nhau — người xem tưởng mình nhìn lộn. Gộp lại còn ~40 dòng, mỗi ô màu một lần,
    # bên cạnh ghi đủ các loại đất mang màu đó (loại nhiều ô ghi trước).
    ra = []
    for ten_nhom in NHOM:                    # giữ đúng thứ tự khai trong mau-loai-dat.json
        theo_mau = {}
        for (nh, m, t), n in dem.items():
            if nh != ten_nhom:
                continue
            g = theo_mau.setdefault(m, {'mau': m, 'ten': [], 'so': 0})
            g['ten'].append((t, n))
            g['so'] += n
        if not theo_mau:
            continue
        muc = []
        for g in sorted(theo_mau.values(), key=lambda x: -x['so']):
            g['ten'].sort(key=lambda x: -x[1])
            muc.append({'mau': g['mau'], 'ten': ' · '.join(t for t, _ in g['ten']), 'so': g['so']})
        ra.append({'nhom': ten_nhom, 'muc': muc})

    with io.open(RA, 'w', encoding='utf-8') as fp:
        json.dump({'_doc': 'Sinh tự động bởi scripts/qh-pipeline/8-tao-chu-giai.py — đừng sửa tay.',
                   'nhom': ra}, fp, ensure_ascii=False, indent=1)
    print('Chú giải: %d nhóm, %d loại đất' % (len(ra), sum(len(x['muc']) for x in ra)))
    for x in ra:
        print('  · %-32s %d loại' % (x['nhom'], len(x['muc'])))
    print('  >>> %s' % RA)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
