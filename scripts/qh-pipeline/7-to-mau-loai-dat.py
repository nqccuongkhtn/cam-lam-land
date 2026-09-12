# -*- coding: utf-8 -*-
"""
TÔ LẠI MÀU BẢN ĐỒ QUY HOẠCH THEO LOẠI ĐẤT (thay cho màu trong bản vẽ CAD).

Chạy sau bước 1b (đọc DXF ra GeoJSON) + bước 4 (cắt theo ranh), TRƯỚC bước 3 (cắt ảnh tile).

Vì sao cần bước này — xem phần `_doc` trong `mau-loai-dat.json`. Nói ngắn: bản vẽ CAD
vẽ để xem trên nền đen nên nhiều ô tối gần như đen (Làng xóm của QĐ918 là #262613,
tức RGB 38,38,19), và cùng một loại đất mà hai bản vẽ tô hai màu khác nhau
(Đất du lịch: QĐ2101 hồng #ff00ff, QĐ918 tím tối #7f007f).

Nó KHÔNG sửa nội dung: tên loại đất vẫn lấy đúng từ tên level trong bản vẽ.
Chỉ đổi trường màu `c`, giữ màu CAD cũ ở trường `cc`, và ghi tên hiện ra ở `lt`.

⚠️ GIỮ LẠI HAI KHÁC BIỆT THẬT, đừng gộp phẳng thành một màu
--------------------------------------------------------
Tên level sau khi cắt tiền tố thì HIỆN TRẠNG và QUY HOẠCH ra cùng một tên
('HT_DAT_O_Nhomnhao' và 'QHDD_DAT_O_Nhomnhao' đều thành 'Nhóm nhà ở'). Gộp một màu là
người xem không còn phân biệt được đất đang là gì với đất sẽ thành gì — mất thông tin
quan trọng nhất của bản đồ quy hoạch. Nên:

  1. Nhóm 'HT' (hiện trạng) tô XỈN ĐI (ngả xám) + hơi nhạt, tên ghi kèm '(hiện trạng)'.
  2. Trong cùng một loại đất + cùng nhóm, nếu BẢN VẼ dùng nhiều màu khác nhau thì giữ lại
     sự khác nhau đó bằng cách tô ĐẬM/NHẠT khác nhau. Ví dụ 'Nhóm nhà ở' của QĐ2101 được
     bản vẽ tô #a57c00 (462 ô) và #dfff7f (252 ô) — đó là hai mật độ xây dựng khác nhau
     (trên bản vẽ ghi OM1 / OM2 / OMĐ), tên level không nói ra nhưng màu thì có.
     Chỉ tách khi mỗi sắc chiếm từ 5% số ô trở lên, để bỏ qua mấy ô lẻ vẽ sai màu
     (vd 'Nhóm nhà ở thấp tầng' có 360 ô #a57c00 và đúng 3 ô #00ff00).

Cách gọi:
    python 7-to-mau-loai-dat.py <vao.geojson> <ra.geojson>
"""
import collections
import importlib.util
import io
import json
import os
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))

# Dùng lại đúng hàm đổi tên level → tên loại đất của bước 5, để hai bên không bao giờ lệch nhau.
_spec = importlib.util.spec_from_file_location('_z5', os.path.join(HERE, '5-tao-qh-zones.py'))
_z5 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_z5)
ten_loai = _z5.ten_loai

with io.open(os.path.join(HERE, 'mau-loai-dat.json'), encoding='utf-8') as fp:
    _B = json.load(fp)

TACH_TOI_THIEU = 0.05      # một sắc phải chiếm ≥5% số ô mới được coi là sắc riêng


def khong_dau(s):
    """Bỏ dấu tiếng Việt + hạ chữ thường, để so tên không phụ thuộc cách gõ dấu."""
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn')
    return s.replace('đ', 'd').replace('Đ', 'D').lower().strip()


MAU = {khong_dau(k): v for k, v in _B['mau'].items()}
LUAT = [(khong_dau(k), v) for k, v in _B['luat']]
# Màu GỐC (chưa pha đậm/nhạt) → tên nhóm, để ghi vào từng ô. Bước 8 dựng bảng chú giải
# cần biết một sắc lạ như #d0a735 thuộc nhóm nào, mà nó không có trong bảng 'nhom'
# (bảng đó chỉ khai màu gốc) nên phải ghi sẵn ở đây.
NHOM_CUA_MAU = {m.lower(): ten for ten, ms in _B['nhom'].items() for m in ms}


def mau_cua(ten):
    """Tên loại đất → màu hiển thị. Không tra được thì trả None (giữ nguyên màu CAD)."""
    k = khong_dau(ten)
    if k in MAU:
        return MAU[k], 'ten'
    for tu, m in LUAT:
        if tu in k:
            return m, 'tu-khoa'
    return None, 'giu-mau-cad'


# ── Mấy phép tính màu nho nhỏ ────────────────────────────────────────────────
def _rgb(h):
    h = (h or '#000000').lstrip('#')
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _hex(t):
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v)))) for v in t)


def sang_hon(h, t):
    """Pha với màu trắng theo tỉ lệ t (0–1) → nhạt hơn."""
    r, g, b = _rgb(h)
    return _hex((r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t))


def toi_hon(h, t):
    """Pha với màu đen theo tỉ lệ t (0–1) → đậm hơn."""
    r, g, b = _rgb(h)
    return _hex((r * (1 - t), g * (1 - t), b * (1 - t)))


def do_sang(h):
    r, g, b = _rgb(h)
    return 0.299 * r + 0.587 * g + 0.114 * b


def xam_hon(h, t):
    """Kéo màu về phía xám cùng độ sáng → màu xỉn đi mà không sáng/tối thêm.

    Dùng cho nhóm HIỆN TRẠNG. Lúc đầu tôi cho hiện trạng chỉ 'nhạt hơn', nhưng khi đó
    'Nhóm nhà ở (hiện trạng)' ra #f7dc8f, còn 'Nhóm nhà ở (sắc nhạt)' ra #f6d478 —
    hai màu đặt cạnh nhau gần như không phân biệt nổi. Làm xỉn đi thì khác hẳn:
    một bên là vàng tươi, một bên là be ngả xám, đúng cảm giác 'đang có sẵn' chứ không phải
    'sẽ làm mới'.
    """
    r, g, b = _rgb(h)
    x = do_sang(h)
    return _hex((r + (x - r) * t, g + (x - g) * t, b + (x - b) * t))


def sac(h, thu_tu, so_sac):
    """Đổi màu gốc thành sắc thứ `thu_tu` trong `so_sac` sắc (0 = nhạt nhất)."""
    if so_sac <= 1:
        return h, ''
    if so_sac == 2:
        return (sang_hon(h, 0.30), ' (sắc nhạt trong bản vẽ)') if thu_tu == 0 else (toi_hon(h, 0.14), ' (sắc đậm trong bản vẽ)')
    if thu_tu == 0:
        return sang_hon(h, 0.32), ' (sắc nhạt trong bản vẽ)'
    if thu_tu == so_sac - 1:
        return toi_hon(h, 0.20), ' (sắc đậm trong bản vẽ)'
    return h, ''


def main(vao, ra):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    d = json.load(io.open(vao, encoding='utf-8'))
    fs = d.get('features', [])

    # ── Lượt 1: đếm xem mỗi (loại đất, nhóm) được bản vẽ tô những màu nào ───────
    dem_sac = collections.defaultdict(collections.Counter)
    for f in fs:
        p = f.get('properties') or {}
        khoa = (ten_loai(p.get('lo', '')), 'HT' if p.get('hz') == 'HT' else 'QH')
        dem_sac[khoa][(p.get('cc') or p.get('c') or '').lower()] += 1
    # Sắc nào chiếm ≥5% thì giữ, xếp theo độ sáng tăng dần (nhạt nhất đứng cuối → đảo lại)
    thu_tu_sac = {}
    for khoa, c in dem_sac.items():
        tong = sum(c.values()) or 1
        giu = [m for m, n in c.items() if n / tong >= TACH_TOI_THIEU]
        giu.sort(key=do_sang, reverse=True)         # nhạt nhất trước
        thu_tu_sac[khoa] = giu

    # ── Lượt 2: tô ────────────────────────────────────────────────────────────
    dem = collections.Counter()
    chi_tiet = {}
    giu_cad = collections.Counter()
    for f in fs:
        p = f.get('properties') or {}
        ten = ten_loai(p.get('lo', ''))
        la_ht = p.get('hz') == 'HT'
        khoa = (ten, 'HT' if la_ht else 'QH')
        m, cach = mau_cua(ten)
        dem[cach] += 1
        if not m:
            giu_cad[ten] += 1
            p['lt'] = ten
            continue
        if 'cc' not in p:
            p['cc'] = p.get('c')                    # giữ màu CAD gốc để còn đối chiếu
        p['nh'] = NHOM_CUA_MAU.get(m.lower(), '')   # nhóm để in bảng chú giải
        cad = (p.get('cc') or '').lower()
        ds = thu_tu_sac.get(khoa) or []
        if cad in ds and len(ds) > 1:
            m, ghi = sac(m, ds.index(cad), len(ds))
        else:
            ghi = ''
        if la_ht:
            m = sang_hon(xam_hon(m, 0.60), 0.12)    # hiện trạng: xỉn đi + hơi nhạt
            ghi = ' (hiện trạng)' + ghi
        p['c'] = m
        p['lt'] = ten + ghi
        chi_tiet.setdefault(p['lt'], [m, cach, 0])
        chi_tiet[p['lt']][2] += 1

    with io.open(ra, 'w', encoding='utf-8') as fp:
        json.dump(d, fp, ensure_ascii=False)

    print('%s → %s' % (os.path.basename(vao), os.path.basename(ra)))
    print('  · tô lại %d ô (khớp tên %d, khớp từ khoá %d) · giữ nguyên màu CAD %d ô'
          % (dem['ten'] + dem['tu-khoa'], dem['ten'], dem['tu-khoa'], dem['giu-mau-cad']))
    print('  · %d mục màu, nhiều ô nhất:' % len(chi_tiet))
    for ten, (m, cach, n) in sorted(chi_tiet.items(), key=lambda x: -x[1][2])[:14]:
        print('        %s  %5d ô  %s' % (m, n, ten[:58]))
    if giu_cad:
        print('  ⚠ CHƯA CÓ MÀU nên giữ nguyên màu bản vẽ (thêm vào mau-loai-dat.json nếu muốn đổi):')
        for ten, n in giu_cad.most_common(10):
            print('        %5d ô  %s' % (n, ten[:60]))
    print('  >>> %s — %.1f MB' % (ra, os.path.getsize(ra) / 1048576))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
