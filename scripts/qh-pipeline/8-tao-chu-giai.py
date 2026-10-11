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
import re
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
_spec1 = importlib.util.spec_from_file_location('_b1', os.path.join(HERE, '1b-doc-dxf.py'))
_b1 = importlib.util.module_from_spec(_spec1)
_spec1.loader.exec_module(_b1)
# TÊN ĐÚNG CHỮ KHUNG CHÚ GIẢI (11/10/2026) — cùng bảng với 5g / 5h (ten-theo-chu-giai.json): bảng chú giải và bảng Thông tin thửa
# phải ghi CÙNG một tên. Mã lớp web → mã bản trong bảng.
try:
    with io.open(os.path.join(HERE, 'ten-theo-chu-giai.json'), encoding='utf-8') as fp:
        TCG = json.load(fp)
except Exception:
    TCG = {}
MA_BAN = {'qh-qd2076': '2076', 'qh-qd2101': '2101', 'qh-qd2222': '2222', 'qh-qd918': '918', 'qh-cuhin': 'cuhin',
          'qh-taynam': 'taynam', 'qh-taybac': 'taybac'}
DATA = os.path.join(GOC, 'apps', 'backend', 'data')
# Level bị tắt / đóng băng trong bản vẽ (5g bỏ qua; ảnh bản đồ cũ còn vẽ cho tới khi cắt lại) — 11/10/2026 đo ở QĐ2076.
LEVEL_TAT = {'qh-qd2076': {'DAT_O_Nhomnhao Thaptang', 'DAT_NO_Nhaochungcu'}}
TEP_MAU = os.path.join(GOC, 'apps', 'frontend', 'public', 'mau-loai-dat-qh.json')


def sua_chu(s):
    """Tên lớp tiếng Việt bị đọc nhầm bảng mã (chữ UTF-8 bị hiểu thành cp1252) → sửa lại. Ký tự \x80–\x9f (byte cp1252 KHÔNG định
    nghĩa — vd 'Đ' = C4 90 thành 'Ä\x90') lấy nguyên byte: trước 11/10/2026 gặp chúng là bó tay → lớp QĐ205 "_X_ĐVO mớiTB_2030"
    (857 ha) không khớp khung chú giải, web ghi tên chung "Đất đơn vị ở"."""
    try:
        b = bytearray()
        for ch in s:
            o = ord(ch)
            b += bytes([o]) if o < 0x100 else ch.encode('cp1252')
        return b.decode('utf-8')
    except Exception:
        return s


def ten_theo_chu_giai(ma_lop, lo, ci):
    """Tên loại đất của một vùng tô: theo khung chú giải nếu khớp chắc chắn (level + màu gốc), không thì tên cũ theo level."""
    t = TCG.get(MA_BAN.get(ma_lop, ''), {})
    mau = (_b1.BANG[ci] if isinstance(ci, int) and 0 < ci < 256 else '').lower()
    return t.get('theo_level_mau', {}).get('%s||%s' % (sua_chu(lo), mau)) or t.get('theo_level', {}).get(sua_chu(lo)) or ten_loai(lo)

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


# Luật THÊM cho tên đúng chữ khung chú giải (11/10/2026): khớp NGUYÊN CỤM TỪ (hai đầu là ranh giới chữ), xét trước LUAT_NHOM.
LUAT_THEM = [(tu, nh) for nh, ds in (
    ('Công nghiệp', ('phi nong nghiep', 'khoang san')),
    ('Đất ở', ('dat o', 'dat o tai do thi', 'dat o tai nong thon')),
    ('Nông nghiệp', ('cay hang nam', 'cay lau nam', 'chan nuoi', 'trong lua', 'lam nghiep')),
    ('Giao thông – hạ tầng', ('thuy loi', 'thien tai', 'chat thai', 'nang luong', 'buu chinh', 'vien thong', 'nghia trang')),
    ('Công trình công cộng', ('vui choi', 'cong cong', 'sinh hoat cong dong', 'tin nguong', 'su nghiep', 'cho dan sinh', 'cho dau moi')),
) for tu in ds]


def _khop(tu, k, hai_dau=False):
    """Từ khoá có trong tên (đã bỏ dấu) — xét RANH GIỚI CHỮ: "rung" không được khớp vào "t-rung" (trước 11/10/2026 "Đất trung tâm
    y tế", "Đất chăn nuôi tập trung" bị xếp vào nhóm Rừng). Đầu sau để mở (tên level dính liền: 'qhdd_dat_cayxanhcc')."""
    return re.search(r'(?<![a-z0-9])' + re.escape(tu) + (r'(?![a-z0-9])' if hai_dau else ''), k) is not None


def nhom_cua(ten):
    """Tên loại đất → tên nhóm để xếp trong bảng chú giải."""
    k = khong_dau(ten)
    if k in TEN_NHOM:
        return TEN_NHOM[k]
    if 'rung' in k.split() or k.startswith('dat rung') or 'lam nghiep (rung' in k:
        return 'Rừng'
    if _khop('cay xanh', k) or _khop('cayxanh', k):     # "Đất cây xanh sử dụng công cộng" là cây xanh, không phải công trình công cộng
        return 'Cây xanh – thể dục thể thao'
    for tu, nh in LUAT_THEM:
        if _khop(tu, k, True):
            return nh
    for tu, nh in LUAT_NHOM:
        if _khop(tu, k):
            return nh
    return KHAC


def main(files):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    dem = collections.Counter()          # (nhóm, màu, tên loại đất) -> số ô  (gộp mọi bản)
    dem_ban = collections.defaultdict(collections.Counter)   # mã lớp -> như trên, riêng từng bản
    mau_ten_pk = collections.defaultdict(collections.Counter)  # tên loại đất phân khu -> màu ảnh -> số vùng tô
    for arg in files:
        ma, f = arg.split('=', 1) if '=' in arg else (os.path.splitext(os.path.basename(arg))[0], arg)
        d = json.load(io.open(f, encoding='utf-8'))
        for ft in d.get('features', []):
            p = ft.get('properties') or {}
            if (p.get('lo') or '').strip().isdigit():
                continue    # level chỉ là con số (vd '0' ở Cù Hin): bản vẽ không nói đất gì, in "0" vào chú giải vô nghĩa
            if 'hatch_khop' in (p.get('lo') or '').lower():
                continue    # vùng KHỚP NỐI (tô đất của bản bên cạnh để đối chiếu) — không phải loại đất của bản này
            if p.get('lo') in LEVEL_TAT.get(ma, ()):
                continue    # level bị TẮT / ĐÓNG BĂNG trong bản vẽ: MicroStation không hiện, dữ liệu tính QH (5g) cũng bỏ
            ten = ten_theo_chu_giai(ma, p.get('lo', ''), p.get('ci'))
            ten0 = ten
            # Bản vẽ tô HIỆN TRẠNG bằng màu khác hẳn quy hoạch, mà tên level sau khi cắt tiền tố
            # lại ra giống nhau ('Nhóm nhà ở'). Ghi rõ để người xem khỏi tưởng bảng in lặp.
            if p.get('hz') == 'HT':
                ten += ' (hiện trạng)'
            m = (p.get('c') or '').lower()
            if m:
                dem[(nhom_cua(ten), m, ten)] += 1
                dem_ban[ma][(nhom_cua(ten), m, ten)] += 1
                mau_ten_pk[ten0][m] += 1          # màu ô vuông bảng Thông tin thửa: theo tên (không kèm "(hiện trạng)")

    ra = xep(dem)
    ban = {ma: xep(c) for ma, c in dem_ban.items()}
    # ── CHÚ GIẢI QĐ205 + QĐ893 (11/10/2026 — chủ dự án: "205 và 893 trên web chưa có chú giải") ──
    # Lấy đúng các loại đất có trong dữ liệu tính quy hoạch (tên y như bảng Thông tin thửa), màu = màu bản vẽ (ảnh bản đồ QĐ205 /
    # QĐ893 dùng đúng màu bản vẽ: đã so ô mẫu khung chú giải với bảng màu web). QĐ205 màu theo LỚP gpkg (chu-giai-ban-ve.json).
    bang_mau = json.load(io.open(TEP_MAU, encoding='utf-8'))
    try:
        cg = json.load(io.open(os.path.join(HERE, 'chu-giai-ban-ve.json'), encoding='utf-8'))['ban']
    except Exception:
        cg = {}
    t205 = TCG.get('205', {}).get('theo_level', {})
    mau205 = collections.defaultdict(collections.Counter)
    for x in (cg.get('205') or {}).get('lop_ban_do') or []:
        lop = sua_chu(x.get('lop') or ''); ten = t205.get(lop) or x.get('ten_web')
        if ten and x.get('mau'): mau205[ten][x['mau'].lower()] += x.get('dien_tich_trong_ranh_ha') or 0
    for ma_lop, tep, khoa in (('qh-qd205', 'qh_zones.json', 'qd205'), ('qh-qd893', 'qh_zones_893.json', 'qd893')):
        try:
            Z = json.load(io.open(os.path.join(DATA, tep), encoding='utf-8'))
        except Exception:
            continue
        so = collections.Counter(z[5] for z in Z)
        c = collections.Counter()
        for ten, n in so.items():
            m = (mau205[ten].most_common(1)[0][0] if khoa == 'qd205' and mau205.get(ten) else (bang_mau.get(khoa) or {}).get(ten))
            if not m: continue
            if khoa == 'qd205': bang_mau.setdefault('qd205', {})[ten] = m
            c[(nhom_cua(ten), m.lower(), ten)] += n
        ban[ma_lop] = xep(c)
    # màu ô vuông bảng Thông tin thửa cho tên phân khu (tên theo chú giải mới + tên cũ còn dùng)
    for ten, cm in mau_ten_pk.items():
        bang_mau.setdefault('phankhu', {})[ten] = cm.most_common(1)[0][0]
    with io.open(TEP_MAU, 'w', encoding='utf-8', newline='\n') as fp:
        json.dump(bang_mau, fp, ensure_ascii=False, indent=1)
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
