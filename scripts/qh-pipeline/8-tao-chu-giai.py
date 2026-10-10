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

Cùng một màu mà nhiều loại đất dùng thì gộp MỘT dòng màu, ghi ĐỦ MỌI TÊN trong `tenDs` (web hiện mỗi tên
một dòng). Trước 10/10/2026 chỉ ghi 2 tên + "+N loại nữa" → chủ dự án chê "là sao", nên bỏ hẳn kiểu cắt.
Chỉ liệt kê loại đất THẬT SỰ có trên bản đồ.

Ghi THÊM chú giải RIÊNG cho từng bản (`ban`: mã lớp trên web → nhóm/màu/tên) để trang bản đồ chỉ hiện loại đất
của bản đang bật. Mã lớp ghi trước dấu '=' (vd qh-qd2076=...), không ghi thì lấy tên file.

Cách gọi (đúng bộ đang dùng cho 7 bộ tile phân khu, 10/10/2026):
    python 8-tao-chu-giai.py qh-qd2076=quyhoach2025/qd2076_qh_tuoi2_sach.geojson         qh-qd2101=quyhoach2025/qd2101_qh_tuoi2_sach.geojson qh-qd2222=quyhoach2025/qd2222_qh_tuoi2_sach.geojson         qh-qd918=quyhoach2025/qd918_qh_tuoi2_sach.geojson qh-cuhin=quyhoach2025/qdcuhin_qh_tuoi2_sach.geojson         qh-taynam=quyhoach2025/qdtaynam_qh_tuoi2_sach.geojson qh-taybac=quyhoach2025/qdtaybac_qh_tuoi2_sach.geojson
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
    dem = collections.Counter()          # (nhóm, màu, tên loại đất) -> số ô  (gộp mọi bản)
    dem_ban = collections.defaultdict(collections.Counter)   # mã lớp -> như trên, riêng từng bản
    for arg in files:
        ma, f = arg.split('=', 1) if '=' in arg else (os.path.splitext(os.path.basename(arg))[0], arg)
        d = json.load(io.open(f, encoding='utf-8'))
        for ft in d.get('features', []):
            p = ft.get('properties') or {}
            if (p.get('lo') or '').strip().isdigit():
                continue    # level chỉ là con số (vd '0' ở Cù Hin): bản vẽ không nói đất gì, in "0" vào chú giải vô nghĩa
            ten = ten_loai(p.get('lo', ''))
            # Bản vẽ tô HIỆN TRẠNG bằng màu khác hẳn quy hoạch, mà tên level sau khi cắt tiền tố
            # lại ra giống nhau ('Nhóm nhà ở'). Ghi rõ để người xem khỏi tưởng bảng in lặp.
            if p.get('hz') == 'HT':
                ten += ' (hiện trạng)'
            m = (p.get('c') or '').lower()
            if m:
                dem[(nhom_cua(ten), m, ten)] += 1
                dem_ban[ma][(nhom_cua(ten), m, ten)] += 1

    ra = xep(dem)
    ban = {ma: xep(c) for ma, c in dem_ban.items()}
    with io.open(RA, 'w', encoding='utf-8') as fp:
        json.dump({'_doc': 'Sinh tự động bởi scripts/qh-pipeline/8-tao-chu-giai.py — đừng sửa tay. '
                           'Màu lấy ĐÚNG từ bản vẽ quy hoạch (bảng màu MicroStation).',
                   'nhom': ra, 'ban': ban}, fp, ensure_ascii=False, indent=1)
    print('Chú giải: %d nhóm, %d dòng màu · %d bản riêng' % (len(ra), sum(len(x['muc']) for x in ra), len(ban)))
    for x in ra:
        print('  · %-32s %d dòng' % (x['nhom'], len(x['muc'])))
    print('  >>> %s' % RA)


def xep(dem):
    """(nhóm, màu, tên) -> số ô  ⇒  [{nhom, muc: [{mau, tenDs: [tên...], so}]}] theo thứ tự nhóm, màu nhiều ô trước."""
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
            muc.append({'mau': g['mau'], 'tenDs': [t for t, _ in g['ten']], 'so': g['so']})
        ra.append({'nhom': ten_nhom, 'muc': muc})
    return ra


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
