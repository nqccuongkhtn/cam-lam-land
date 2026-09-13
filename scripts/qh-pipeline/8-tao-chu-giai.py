# -*- coding: utf-8 -*-
"""
TẠO BẢNG CHÚ GIẢI cho bản đồ quy hoạch trên web.

Đọc các file GeoJSON đã dựng (GIỮ MÀU GỐC CỦA BẢN VẼ) rồi ghi ra
`apps/frontend/public/chu-giai-qh.json` — trang bản đồ nạp file này cho nút "Chú giải".

⚠️ MÀU LẤY ĐÚNG TỪ BẢN VẼ, KHÔNG TỰ ĐẶT.
Ngày 13/9/2026 đã thử tự tô lại theo loại đất cho tươi, nhưng chủ dự án đối chiếu với
MicroStation và app tra cứu thì thấy lệch — bản đồ quy hoạch phải giống bản vẽ được duyệt.
Nên chú giải cũng chỉ LIỆT KÊ lại màu bản vẽ; việc của nó là nói màu nào ứng với loại đất gì.

Xếp nhóm (Đất ở · Cây xanh · Mặt nước…) chỉ để bảng dễ đọc: suy từ TÊN loại đất qua bộ từ khoá
trong `mau-loai-dat.json` (từ khoá → màu mẫu → nhóm). Tên loại đất vẫn là tên thật trong bản vẽ.

Cùng một màu mà nhiều loại đất dùng thì gộp MỘT dòng: ghi 2 tên nhiều ô nhất + "+N loại nữa",
tên đầy đủ để ở `dayDu` (web hiện khi rê chuột). Chỉ liệt kê loại đất THẬT SỰ có trên bản đồ.

Cách gọi:
    python 8-tao-chu-giai.py <vao1.geojson> [vao2.geojson ...]
"""
import collections
import importlib.util
import io
import json
import os
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
GOC = os.path.abspath(os.path.join(HERE, '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'chu-giai-qh.json')

# Dùng lại hàm đổi tên level → tên loại đất của bước 5 để hai bên không bao giờ lệch nhau.
_spec = importlib.util.spec_from_file_location('_z5', os.path.join(HERE, '5-tao-qh-zones.py'))
_z5 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_z5)
ten_loai = _z5.ten_loai

with io.open(os.path.join(HERE, 'mau-loai-dat.json'), encoding='utf-8') as fp:
    _B = json.load(fp)

_NHOM_CUA_MAU = {m.lower(): ten for ten, ms in _B['nhom'].items() for m in ms}
KHAC = 'Loại đất khác'


def khong_dau(s):
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn')
    return s.replace('đ', 'd').replace('Đ', 'D').lower().strip()


# từ khoá → màu mẫu → nhóm  (chỉ dùng để XẾP NHÓM, không dùng để tô)
LUAT_NHOM = [(khong_dau(tu), _NHOM_CUA_MAU.get((m or '').lower(), KHAC)) for tu, m in _B['luat']]
TEN_NHOM = {khong_dau(k): _NHOM_CUA_MAU.get((v or '').lower(), KHAC) for k, v in _B['mau'].items()}
THU_TU = list(_B['nhom']) + [KHAC]


def nhom_cua(ten):
    """Tên loại đất → tên nhóm để xếp trong bảng chú giải."""
    k = khong_dau(ten)
    if k in TEN_NHOM:
        return TEN_NHOM[k]
    for tu, nh in LUAT_NHOM:
        if tu in k:
            return nh
    return KHAC


def main(files):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    dem = collections.Counter()          # (nhóm, màu, tên loại đất) -> số ô
    for f in files:
        d = json.load(io.open(f, encoding='utf-8'))
        for ft in d.get('features', []):
            p = ft.get('properties') or {}
            ten = ten_loai(p.get('lo', ''))
            # Bản vẽ tô HIỆN TRẠNG bằng màu khác hẳn quy hoạch, mà tên level sau khi cắt tiền tố
            # lại ra giống nhau ('Nhóm nhà ở'). Ghi rõ để người xem khỏi tưởng bảng in lặp.
            if p.get('hz') == 'HT':
                ten += ' (hiện trạng)'
            m = (p.get('c') or '').lower()
            if m:
                dem[(nhom_cua(ten), m, ten)] += 1

    ra = []
    for ten_nhom in THU_TU:
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
            ten = [t for t, _ in g['ten']]
            ngan = ' · '.join(ten[:2]) + ((' + %d loại nữa' % (len(ten) - 2)) if len(ten) > 2 else '')
            muc.append({'mau': g['mau'], 'ten': ngan, 'dayDu': ' · '.join(ten), 'so': g['so']})
        ra.append({'nhom': ten_nhom, 'muc': muc})

    with io.open(RA, 'w', encoding='utf-8') as fp:
        json.dump({'_doc': 'Sinh tự động bởi scripts/qh-pipeline/8-tao-chu-giai.py — đừng sửa tay. '
                           'Màu lấy ĐÚNG từ bản vẽ quy hoạch (bảng màu MicroStation).',
                   'nhom': ra}, fp, ensure_ascii=False, indent=1)
    print('Chú giải: %d nhóm, %d dòng màu' % (len(ra), sum(len(x['muc']) for x in ra)))
    for x in ra:
        print('  · %-32s %d dòng' % (x['nhom'], len(x['muc'])))
    print('  >>> %s' % RA)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
