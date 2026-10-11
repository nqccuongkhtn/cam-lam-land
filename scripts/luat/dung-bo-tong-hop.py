# -*- coding: utf-8 -*-
"""
DỰNG "BỘ TỔNG HỢP" — MỘT danh mục gom MỌI văn bản người dùng học được trong công cụ
"Học và tra cứu Luật Đất đai" (trang /tra-cuu-luat), bày cho dễ tra:

  · theo LOẠI: Luật · Nghị quyết của Quốc hội · Nghị định · Thông tư · văn bản của Khánh Hòa
              · văn bản hướng dẫn, giải đáp vướng mắc (tham khảo);
  · theo CHỦ ĐỀ (đúng hàng "Chủ đề nhanh" của trang) và theo CHẶNG của lộ trình học;
  · mỗi văn bản: số hiệu, tên, cơ quan ban hành, ngày ban hành, ngày hiệu lực, TÌNH TRẠNG (còn /
    hết hiệu lực / bị sửa đổi, bãi bỏ một phần — lấy từ dữ liệu đã tính sẵn, không đoán), QUAN HỆ
    (căn cứ, sửa đổi, thay thế, bãi bỏ, được hướng dẫn bởi), chủ đề chính, chặng nào dùng tới.

Không tự viết lại dữ liệu nào: chỉ GOM những thứ các script khác đã tính, cộng với phần khai tay
của văn bản tham khảo (tham-khao/*.json). Chạy lại bất cứ lúc nào, kết quả chỉ phụ thuộc dữ liệu.

ĐỌC:  apps/frontend/public/luat/_kho.json + <mã>.json    (văn bản có Điều)
      apps/frontend/public/luat/tham-khao/*.json          (công văn hướng dẫn, giải đáp — tham khảo)
      apps/frontend/public/luat/lo-trinh.json             (chặng của từng điều)
      apps/frontend/public/luat/danh-muc.json             (danh mục toàn quốc — tìm đường tải bản gốc)
      apps/frontend/src/app/tra-cuu-luat/page.tsx         (hàng CHỦ ĐỀ NHANH — MỘT nơi khai tên chủ đề)
      scripts/luat/van-ban-goc/chi-muc.json               (bản lưu trữ các tệp chủ dự án gửi)
GHI:  apps/frontend/public/luat/bo-tong-hop.json          (trang web đọc)
      docs/HOC-LUAT-BO-TONG-HOP.md                        (tài liệu — SINH TỰ ĐỘNG, đừng sửa tay)

Chạy:  python scripts/luat/dung-bo-tong-hop.py
"""
import sys, os, re, json, glob, datetime, unicodedata, importlib.util

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

GOC = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WEB = os.path.join(GOC, 'apps', 'frontend', 'public', 'luat')
TK = os.path.join(WEB, 'tham-khao')
TRANG = os.path.join(GOC, 'apps', 'frontend', 'src', 'app', 'tra-cuu-luat', 'page.tsx')
CHI_MUC = os.path.join(GOC, 'scripts', 'luat', 'van-ban-goc', 'chi-muc.json')
RA_JSON = os.path.join(WEB, 'bo-tong-hop.json')
RA_MD = os.path.join(GOC, 'docs', 'HOC-LUAT-BO-TONG-HOP.md')

# Bắt dẫn chiếu trong công văn — dùng CHUNG bộ bắt của them-van-ban.py để hai nơi không lệch nhau.
_s = importlib.util.spec_from_file_location('themvb', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'them-van-ban.py'))
themvb = importlib.util.module_from_spec(_s)
_s.loader.exec_module(themvb)

# ── NHÓM THEO LOẠI VĂN BẢN — thứ tự bày ra là thứ tự "đọc từ gốc tới ngọn" ──
NHOM = [
    {'ma': 'luat', 'icon': '⚖️', 'ten': 'Luật của Quốc hội',
     'moTa': 'Văn bản gốc. Luật Đất đai 2024 là trục; luật sửa đổi và các đời luật cũ giữ lại để tra hồ sơ thời kỳ trước.'},
    {'ma': 'nghi-quyet', 'icon': '🏛️', 'ten': 'Nghị quyết của Quốc hội, Ủy ban Thường vụ Quốc hội',
     'moTa': 'Cơ chế, chính sách đặc thù, tháo gỡ vướng mắc khi thi hành luật — trong thời gian áp dụng có thể khác luật.'},
    {'ma': 'nghi-dinh', 'icon': '📘', 'ten': 'Nghị định của Chính phủ',
     'moTa': 'Quy định chi tiết, hướng dẫn thi hành luật: trình tự, hồ sơ, tiền, xử phạt.'},
    {'ma': 'thong-tu', 'icon': '📗', 'ten': 'Thông tư của Bộ',
     'moTa': 'Hướng dẫn chuyên môn: mẫu giấy tờ, hồ sơ địa chính, đo đạc, quy hoạch, dữ liệu.'},
    {'ma': 'dia-phuong', 'icon': '📍', 'ten': 'Văn bản của tỉnh Khánh Hòa',
     'moTa': 'Quyết định của UBND tỉnh, nghị quyết của HĐND tỉnh — áp dụng thẳng ở Cam Lâm.'},
    {'ma': 'huong-dan', 'icon': '📨', 'ten': 'Văn bản hướng dẫn, giải đáp vướng mắc (tham khảo)',
     'moTa': 'Công văn trả lời, hướng dẫn của bộ, của sở các tỉnh. KHÔNG phải văn bản quy phạm pháp luật; '
             'văn bản của tỉnh khác chỉ để tham khảo cách hiểu, không bắt buộc ở Khánh Hòa.'},
]

TINH_TRANG = {
    'con-hieu-luc': {'icon': '✅', 'ten': 'Còn hiệu lực'},
    'sua-doi-mot-phan': {'icon': '✏️', 'ten': 'Còn hiệu lực, có phần bị sửa đổi / bãi bỏ'},
    'het-hieu-luc': {'icon': '⛔', 'ten': 'Hết hiệu lực'},
    'tham-khao': {'icon': '📨', 'ten': 'Tham khảo (không phải văn bản quy phạm)'},
}

# Văn bản BIẾT LÀ CẦN mà chưa đưa vào kho được — chép từ ghi chú đầu dung-kho-luat.py để người
# xem danh mục biết thiếu gì, vì sao thiếu.
THIEU_DA_BIET = [
    {'soHieu': '112/2024/NĐ-CP', 'ten': 'Quy định chi tiết về đất trồng lúa',
     'lyDo': 'Công báo không đăng; bản trên cổng Chính phủ là ảnh quét, bóc chữ không ra.'},
    {'soHieu': '09/2024/TT-BTNMT', 'ten': '',
     'lyDo': 'Bản PDF tải được bị cụt — không có điều khoản thi hành.'},
    {'soHieu': '23/2025/TT-BNNMT', 'ten': 'Quy định phân cấp, phân định thẩm quyền quản lý nhà nước trong lĩnh vực đất đai',
     'lyDo': 'Thông tư sửa đổi chép nguyên chương của văn bản khác trong ngoặc kép, bộ tách bị đứt số điều.'},
]
# Văn bản ngoài kho mà văn bản tham khảo hay văn bản trong kho cần tới, kèm tên — để gợi ý bổ sung.
TEN_BIET = {
    '16/2017/QH14': 'Luật Lâm nghiệp (đã được Luật Đất đai 2024, Điều 248 sửa một số điều)',
}


def kd(s):
    """Bỏ dấu y như hàm kd() của trang web (để đếm chủ đề ra cùng kết quả với ô tìm trên trang)."""
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if not (0x300 <= ord(c) <= 0x36F))
    return s.replace('đ', 'd').replace('Đ', 'D').lower()


def ngay_vn(s):
    if not s or len(s) < 10:
        return ''
    return '%s/%s/%s' % (s[8:10], s[5:7], s[:4])


def doc(p, mac_dinh=None):
    if not os.path.exists(p):
        return mac_dinh
    return json.load(open(p, encoding='utf-8'))


def chu_de_cua_trang():
    """Lấy hàng CHỦ ĐỀ NHANH (mảng CHU_DE) thẳng từ page.tsx — một nơi khai, hai nơi dùng."""
    t = open(TRANG, encoding='utf-8').read()
    khoi = re.search(r'const CHU_DE[^=]*=\s*\[(.*?)\n\];', t, re.S)
    if not khoi:
        raise SystemExit('LỖI: không tìm thấy mảng CHU_DE trong page.tsx — đổi tên mảng thì sửa cả script này.')
    ra = []
    for m in re.finditer(r"\{\s*ten:\s*'([^']+)',\s*icon:\s*'([^']+)',\s*tim:\s*'([^']+)'\s*\}", khoi.group(1)):
        ra.append({'ten': m.group(1), 'icon': m.group(2), 'tim': m.group(3)})
    if len(ra) < 5:
        raise SystemExit('LỖI: chỉ đọc được %d chủ đề từ page.tsx — kiểm lại cách viết mảng CHU_DE.' % len(ra))
    return ra


def nhan_ngan(ma, so_hieu):
    """Nhãn ngắn giống nhanNgan() của trang: 'Luật Đất đai 2024', 'NĐ 102/2024', 'TT 10/2024'."""
    if ma.startswith('ldd'):
        return 'Luật Đất đai ' + ma[3:]
    if ma.startswith('lsd'):
        return 'Luật sửa đổi ' + ma[3:]
    p = (so_hieu or '').split('/')
    if len(p) >= 3:
        if 'HĐND' in p[2]:
            return 'NQ %s/%s (HĐND)' % (p[0], p[1])
        if 'UBND' in p[2]:
            return 'QĐ %s/%s (UBND)' % (p[0], p[1])
        if ma.startswith('nq') or '/NQ-' in so_hieu:
            return 'NQ %s/%s' % (p[0], p[1])
        if p[2].startswith('QH'):
            return 'Luật %s/%s' % (p[0], p[1])
        if p[2].startswith('TT'):
            return 'TT %s/%s' % (p[0], p[1])
        return 'NĐ %s/%s' % (p[0], p[1])
    return so_hieu or ma


def nhom_cua(x):
    ma, so = x['ma'], x.get('soHieu', '')
    if x.get('nhom'):
        return x['nhom']
    if ma.startswith(('ldd', 'lsd')) or re.match(r'^l\d', ma):
        return 'luat'
    if ma.startswith('nq') or re.search(r'/NQ-|UBTVQH', so):
        return 'dia-phuong' if 'HĐND' in so else 'nghi-quyet'
    if ma.startswith('nd') or 'NĐ-CP' in so:
        return 'nghi-dinh'
    if ma.startswith('tt') or '/TT-' in so:
        return 'thong-tu'
    if re.search(r'QĐ-UBND|NQ-HĐND|KH-UBND', so):
        return 'dia-phuong'
    return 'luat' if '/QH' in so else 'huong-dan'


def nhom_goi_y(r):
    """Văn bản CHƯA có trong kho thì xếp vào nhóm nào (để gợi ý ngay dưới nhóm đó)."""
    so, ten = r.get('soHieu', ''), (r.get('ten') or '') + ' ' + (r.get('loaiDanhMuc') or '')
    if 'NĐ-CP' in so:
        return 'nghi-dinh'
    if '/TT-' in so:
        return 'thong-tu'
    if re.search(r'QĐ-UBND|NQ-HĐND', so):
        return 'dia-phuong'
    if '/QH' in so or 'UBTVQH' in so:
        return 'nghi-quyet' if re.match(r'\s*(Nghị quyết|NQ)', ten) or 'Nghị quyết' in (r.get('loaiDanhMuc') or '') else 'luat'
    return 'huong-dan'


LOAI = {'luat': 'Luật', 'nghi-quyet': 'Nghị quyết', 'nghi-dinh': 'Nghị định', 'thong-tu': 'Thông tư',
        'dia-phuong': 'Văn bản của tỉnh'}
BO = {'BTNMT': 'Bộ Tài nguyên và Môi trường', 'BNNMT': 'Bộ Nông nghiệp và Môi trường', 'BTC': 'Bộ Tài chính',
      'BXD': 'Bộ Xây dựng', 'BTP': 'Bộ Tư pháp', 'BNNPTNT': 'Bộ Nông nghiệp và Phát triển nông thôn'}


def co_quan_cua(x, nhom):
    so = x.get('soHieu', '')
    if 'UBTVQH' in so:
        return 'Ủy ban Thường vụ Quốc hội'
    if nhom in ('luat', 'nghi-quyet'):
        return 'Quốc hội'
    if nhom == 'nghi-dinh':
        return 'Chính phủ'
    if nhom == 'thong-tu':
        m = re.search(r'TT-([A-ZĐ]+)', so)
        return BO.get(m.group(1), m.group(1)) if m else 'Bộ'
    if 'HĐND' in so:
        return 'Hội đồng nhân dân tỉnh Khánh Hòa'
    if 'UBND' in so:
        return 'Ủy ban nhân dân tỉnh Khánh Hòa'
    return ''


def chu_dieu(d):
    return 'Điều %s %s %s' % (d['so'], d.get('tieuDe') or '', ' '.join(
        k['chu'] + ' ' + ' '.join(x['chu'] for x in k['diem']) for k in d['khoan']))


def cau_hieu_luc(vb):
    """Câu NGUYÊN VĂN nói về hiệu lực (dùng khi chưa đọc được ngày hiệu lực thành con số)."""
    for d in vb['dieu']:
        if 'hiệu lực' not in (d.get('tieuDe') or '').lower():
            continue
        for k in d['khoan']:
            # NFC: vài chỗ trong kho lưu chữ TÁCH DẤU (vd "tháng" = "tha" + dấu sắc rời + "ng" ở Thông tư
            # 12/2024) — nhìn y hệt nhưng so chữ thì trượt. Dựng lại dấu trước khi đọc ngày.
            for cau in re.split(r'(?<=[.;])\s+', unicodedata.normalize('NFC', k['chu'])):
                if 'có hiệu lực' in cau:
                    return re.sub(r'\s+', ' ', cau).strip()
    return ''


def lam():
    kho = doc(os.path.join(WEB, '_kho.json'), [])
    K = {x['ma']: x for x in kho}
    theo_so = {x['soHieu']: x['ma'] for x in kho}
    lt = doc(os.path.join(WEB, 'lo-trinh.json'), {'chang': [], 'theoDieu': {}, 'theoVanBan': {}})
    dm = doc(os.path.join(WEB, 'danh-muc.json'), {'vanBan': []})
    dm_theo_so = {}
    for z in dm.get('vanBan', []):
        dm_theo_so.setdefault(z.get('so', ''), z)
    cm = {x['ma']: x for x in (doc(CHI_MUC, {'tep': []})['tep'])}
    chu_de = chu_de_cua_trang()
    tk = []
    for p in sorted(glob.glob(os.path.join(TK, '*.json'))):
        if p.endswith('.nhap.json'):
            continue
        v = json.load(open(p, encoding='utf-8'))
        if v.get('nhap'):
            print('  [bỏ qua] %s còn là BẢN NHÁP (chưa soát) — chưa đưa lên bộ tổng hợp' % v.get('ma'))
            continue
        tk.append(v)

    van_ban, the_dieu = [], {}
    # ── 1. Văn bản có Điều (trong kho) ──
    for x in kho:
        vb = doc(os.path.join(WEB, x['ma'] + '.json'))
        if not vb:
            print('  [!] thiếu tệp %s.json — bỏ qua' % x['ma'])
            continue
        nhom = nhom_cua(x)
        dieu = vb['dieu']
        n_het = sum(1 for d in dieu if (d.get('tinhTrang') or {}).get('loai') == 'het-hieu-luc')
        n_mot = sum(1 for d in dieu if (d.get('tinhTrang') or {}).get('loai') == 'bai-bo-mot-phan')
        n_sua = sum(1 for d in dieu if (d.get('tinhTrang') or {}).get('loai') == 'sua-doi' or d.get('suaDoi'))
        boi = sorted({(d.get('tinhTrang') or {}).get('boi') for d in dieu if d.get('tinhTrang')} |
                     {s['boi'] for d in dieu for s in (d.get('suaDoi') or [])} |
                     set(x.get('biSuaDoiBoi') or []) | set(x.get('biBaiBoMotPhanBoi') or []))
        boi = [b for b in boi if b]
        if x.get('hetHieuLuc'):
            tt, tt_chu = 'het-hieu-luc', x['hetHieuLuc']
        elif n_het or n_mot or n_sua or vb.get('mauBiBaiBo') or x.get('biSuaDoiBoi') or x.get('biBaiBoMotPhanBoi'):
            phan = []
            if n_het:
                phan.append('%d điều đã hết hiệu lực' % n_het)
            if n_mot:
                phan.append('%d điều bị bãi bỏ một phần' % n_mot)
            if n_sua:
                phan.append('%d điều bị sửa đổi, bổ sung' % n_sua)
            if vb.get('mauBiBaiBo'):
                phan.append('mẫu đơn kèm theo đã bị bãi bỏ')
            tt = 'sua-doi-mot-phan'
            tt_chu = 'Còn hiệu lực — %s (bởi %s).' % (', '.join(phan) or 'có phần bị sửa đổi',
                                                    ', '.join(nhan_ngan(b, K[b]['soHieu']) if b in K else b for b in boi))
        else:
            tt, tt_chu = 'con-hieu-luc', 'Còn hiệu lực.'
        # chủ đề: đếm số điều có cụm từ của chủ đề (y như ô tìm của trang).
        #  · "chủ đề chính" của văn bản = chủ đề chiếm từ 4% số điều trở lên, lấy 6 cái nhiều nhất;
        #  · còn để TRA THEO CHỦ ĐỀ thì văn bản nào có từ 2 điều trở lên (văn bản ngắn: 1 điều) là kể ra.
        chi_muc = [kd(chu_dieu(d)) for d in dieu]
        cd, dem_cd = [], {}
        for c in chu_de:
            n = sum(1 for t in chi_muc if kd(c['tim']) in t)
            dem_cd[c['ten']] = n
            if n >= max(2, round(0.04 * len(dieu))) or (len(dieu) <= 12 and n >= 1):
                cd.append({'ten': c['ten'], 'icon': c['icon'], 'soDieu': n})
        cd.sort(key=lambda z: -z['soDieu'])
        # (danh sách để TRA THEO CHỦ ĐỀ tính sau, khi đã biết chủ đề đó hiếm hay phổ biến trong cả kho)
        cd_tra = dem_cd
        # chặng: đếm số điều của văn bản thuộc từng chặng (một điều có thể thuộc nhiều chặng)
        dem = {}
        for d in dieu:
            for c in lt['theoDieu'].get('%s:%s' % (x['ma'], d['so']), []):
                dem[c] = dem.get(c, 0) + 1
        loi_chang = lt['theoVanBan'].get(x['ma'])
        chang = sorted(({'so': c, 'soDieu': n, **({'loi': True} if c == loi_chang else {})} for c, n in dem.items()),
                       key=lambda z: (-z['soDieu'], z['so']))
        qh = {}
        for k in ('canCu', 'laCanCuCho', 'thayThe', 'biThayTheBoi', 'suaDoi', 'biSuaDoiBoi', 'biBaiBoMotPhanBoi'):
            if x.get(k):
                qh[k] = list(x[k])
        if x.get('baiBoMotPhan'):
            qh['baiBoMotPhan'] = sorted({z['ma'] for z in x['baiBoMotPhan']})
        muc = {
            'ma': x['ma'], 'nhom': nhom, 'loai': LOAI.get(nhom, ''), 'soHieu': x['soHieu'],
            'nhan': nhan_ngan(x['ma'], x['soHieu']), 'ten': x['ten'], 'coQuan': co_quan_cua(x, nhom),
            'ngay': x.get('ngay', ''), 'ngayHieuLuc': x.get('ngayHieuLuc', ''),
            'nguoiKy': x.get('nguoiKy', ''), 'tinhTrang': tt, 'tinhTrangChu': tt_chu,
            'soDieu': len(dieu), 'soChuong': len(vb.get('chuong') or []),
            'dieuHetHieuLuc': n_het, 'dieuBaiBoMotPhan': n_mot, 'dieuSuaDoi': n_sua,
            'quanHe': qh, 'chuDe': cd[:6], 'chang': chang, 'nguon': vb.get('nguon', ''),
            'coToanVan': True, '_chuDeTra': cd_tra,
        }
        if not muc['ngayHieuLuc']:
            # Kho chưa ghi ngày hiệu lực → đọc từ CÂU NGUYÊN VĂN về hiệu lực của chính văn bản; câu
            # không có ngày cụ thể (vd "kể từ ngày Luật Đất đai … có hiệu lực") thì để nguyên câu.
            cau = cau_hieu_luc(vb)
            muc['hieuLucNguyenVan'] = cau
            m = re.search(r'ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})', cau)
            if m:
                muc['ngayHieuLuc'] = '%s-%02d-%02d' % (m.group(3), int(m.group(2)), int(m.group(1)))
                muc['ngayHieuLucDoc'] = 'đọc từ câu hiệu lực của văn bản'
            elif re.search(r'kể từ ngày ký|từ ngày ký ban hành', cau):
                muc['ngayHieuLuc'] = muc['ngay']
                muc['ngayHieuLucDoc'] = 'từ ngày ký ban hành (câu hiệu lực của văn bản)'
        if x['ma'] in cm:
            muc['luuTru'] = {k: cm[x['ma']].get(k) for k in ('tep', 'kichThuocGoc', 'kichThuocLuu', 'cachLuu')}
        van_ban.append(muc)

    # ── 2. Văn bản tham khảo (công văn hướng dẫn, giải đáp) ──
    for v in tk:
        nhom = v.get('nhom') or 'huong-dan'
        # chú thích cuối trang ghi kèm số mũ như bản gốc: "¹ Quy định về…"
        cac_doan = list(v.get('doan') or []) + ['%s %s' % (str(c.get('so', '')).translate(str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')),
                                                           c.get('chu', '')) for c in (v.get('chuThich') or [])]
        toan_bo = kd(' '.join([v.get('ten', '')] + cac_doan))
        cd_khai = list(v.get('chuDe') or [])
        cd = []
        for c in chu_de:
            co = c['ten'] in cd_khai or kd(c['tim']) in toan_bo
            if co:
                cd.append({'ten': c['ten'], 'icon': c['icon']})
        cd_tra = [{'ten': c['ten']} for c in cd]
        for t in cd_khai:
            if not any(c['ten'] == t for c in chu_de):
                print('  [!] %s khai chủ đề "%s" không có trong CHU_DE của page.tsx' % (v['ma'], t))
        chang = [{'so': c} for c in (v.get('chang') or [])]
        dan_kho = [z for z in (v.get('danChieu') or []) if z.get('ma')]
        muc = {
            'ma': v['ma'], 'nhom': nhom, 'loai': v.get('loai', 'Công văn'), 'soHieu': v['soHieu'],
            'nhan': '%s %s' % ('CV' if v.get('loai', 'Công văn') == 'Công văn' else v.get('loai', ''), v['soHieu']),
            'ten': v['ten'], 'coQuan': v.get('coQuanNgan') or v.get('coQuan', ''),
            'tinh': v.get('tinh', ''), 'phamVi': v.get('phamVi', ''),
            'ngay': v['ngay'], 'ngayHieuLuc': '', 'nguoiKy': v.get('nguoiKy', ''),
            'tinhTrang': 'tham-khao',
            'tinhTrangChu': v.get('canhBao') or 'Văn bản tham khảo, không phải văn bản quy phạm pháp luật.',
            'soDoan': len(v.get('doan') or []), 'nguonChu': v.get('nguonChu', ''),
            'banGoc': v.get('banGoc', ''), 'chuDe': cd, 'chang': chang,
            'danChieu': [{'ma': z['ma'], 'so': z['so'], **({'khoan': z['khoan']} if z.get('khoan') else {}),
                          **({'canh': True} if z.get('canh') else {})} for z in dan_kho],
            'lienQuan': [{'ma': z['ma'], 'so': z['so']} for z in (v.get('lienQuan') or []) if z.get('ma')],
            'nhacToiNgoaiKho': sorted({z['soHieu'] for z in (v.get('vanBanNhacToi') or []) if not z.get('ma')}),
            'tom': (v.get('giaiThich') or {}).get('tom', ''),
            'coToanVan': True, '_chuDeTra': cd_tra,
        }
        if v['ma'] in cm:
            c = cm[v['ma']]
            muc['luuTru'] = {k: c.get(k) for k in ('tep', 'kichThuocGoc', 'kichThuocLuu', 'cachLuu')}
        van_ban.append(muc)
        # ── chỉ mục ngược: điều nào của kho được văn bản tham khảo nhắc tới ──
        for z in dan_kho:
            trich = []
            for d in cac_doan:
                for m in themvb.RE_DAN_CV.finditer(themvb.chuan(d)):
                    dieu = int(m.group(3))
                    ma2 = ('ldd' + (m.group(5) or '2024')) if m.group(4) else theo_so.get(m.group(6) or '')
                    if ma2 == z['ma'] and dieu == z['so'] and d not in trich:
                        trich.append(d)
            the_dieu.setdefault('%s:%s' % (z['ma'], z['so']), []).append({
                'ma': v['ma'], 'kieu': 'trich-dan', **({'khoan': z['khoan']} if z.get('khoan') else {}),
                'trich': trich[:3], **({'luuY': z['luuY']} if z.get('luuY') else {}),
                **({'canh': True} if z.get('canh') else {})})
        for z in (v.get('lienQuan') or []):
            if z.get('ma'):
                the_dieu.setdefault('%s:%s' % (z['ma'], z['so']), []).append({
                    'ma': v['ma'], 'kieu': 'lien-quan', **({'khoan': z['khoan']} if z.get('khoan') else {}),
                    'lyDo': z.get('lyDo', '')})

    # văn bản trong kho bị văn bản tham khảo báo là đã hết hiệu lực một phần → cần kiểm
    theo_ma = {x['ma']: x for x in van_ban}
    for v in tk:
        for z in (v.get('danChieu') or []):
            if z.get('canh') and z.get('ma') in theo_ma:
                theo_ma[z['ma']].setdefault('canKiemTra', []).append(
                    {'tu': v['ma'], 'dieu': z['so'], **({'khoan': z['khoan']} if z.get('khoan') else {}),
                     'ghi': z.get('luuY', '')})

    # ── 3. Văn bản nên bổ sung (được nhắc tới mà kho chưa có) ──
    co_so = {x['soHieu'] for x in van_ban}
    nen = {}
    for v in tk:
        for z in (v.get('vanBanNhacToi') or []) + [y for y in (v.get('danChieu') or []) if y.get('ngoaiKho')]:
            so = z.get('soHieu')
            if not so or z.get('ma') or so in co_so:
                continue
            r = nen.setdefault(so, {'soHieu': so, 'ten': '', 'duocNhacBoi': []})
            if z.get('ten') and not r['ten']:
                r['ten'] = z['ten']
            if z.get('canKiemTra'):
                r['canKiemTra'] = z['canKiemTra']
            if v['ma'] not in r['duocNhacBoi']:
                r['duocNhacBoi'].append(v['ma'])
    for so, ten in TEN_BIET.items():
        if so in co_so:
            continue
        nhac = [x['ma'] for x in kho if so in json.dumps(doc(os.path.join(WEB, x['ma'] + '.json'), {}), ensure_ascii=False)]
        if nhac or so in nen:
            r = nen.setdefault(so, {'soHieu': so, 'ten': '', 'duocNhacBoi': []})
            r['ten'] = r['ten'] or ten
            r['duocNhacBoi'] += [m for m in nhac if m not in r['duocNhacBoi']]
    for z in THIEU_DA_BIET:
        if z['soHieu'] in co_so:
            continue
        r = nen.setdefault(z['soHieu'], {'soHieu': z['soHieu'], 'ten': z['ten'], 'duocNhacBoi': []})
        r['lyDoChuaCo'] = z['lyDo']
    for so, r in nen.items():
        g = dm_theo_so.get(so)
        if g:
            r['ten'] = r['ten'] or g.get('ten', '')
            r['danhMuc'] = {'link': g.get('link', ''), 'tep': g.get('tep', [])}
            r['loaiDanhMuc'] = g.get('loai', '')
        r['nhom'] = nhom_goi_y(r)
        # Văn bản mà lời lưu ý của văn bản tham khảo nói là ĐANG LÀM THAY ĐỔI hiệu lực của một điều có
        # trong kho → nạp trước tiên: có nó thì các script tự đánh dấu đúng điều đó còn/hết hiệu lực.
        anh = []
        for v in tk:
            for z in (v.get('danChieu') or []):
                if z.get('ma') and so in (z.get('luuY') or ''):
                    k = '%s Điều %s' % (nhan_ngan(z['ma'], K[z['ma']]['soHieu']) if z['ma'] in K else z['ma'], z['so'])
                    if k not in anh:
                        anh.append(k)
        if anh:
            r['anhHuongDieu'] = anh
    # Thứ tự: làm thay đổi hiệu lực điều đang có trong kho → nhiều văn bản nhắc tới → còn lại
    nen_bo_sung = sorted(nen.values(), key=lambda r: (0 if r.get('anhHuongDieu') else 1, -len(r['duocNhacBoi']),
                                                      'lyDoChuaCo' in r, r['soHieu']))

    # Thứ tự trong từng nhóm: Luật Đất đai 2024 đứng đầu; văn bản còn hiệu lực xếp theo ngày ban hành
    # (cũ → mới, đọc từ gốc tới ngọn); văn bản hết hiệu lực xuống cuối, mới → cũ (tra hồ sơ thì lùi
    # dần từng đời); văn bản tham khảo mới nhất lên đầu.
    thu_tu_nhom = {n['ma']: i for i, n in enumerate(NHOM)}

    def khoa_xep(x):
        ngay = int(re.sub(r'\D', '', x.get('ngay') or '') or 0)
        het = x['tinhTrang'] == 'het-hieu-luc'
        nguoc = het or x['tinhTrang'] == 'tham-khao'
        return (thu_tu_nhom.get(x['nhom'], 99), het, 0 if x['ma'] == 'ldd2024' else 1, -ngay if nguoc else ngay)
    van_ban.sort(key=khoa_xep)
    nhom_ra = []
    for n in NHOM:
        ds = [x for x in van_ban if x['nhom'] == n['ma']]
        nhom_ra.append({**n, 'soVanBan': len(ds),
                        'conHieuLuc': sum(1 for x in ds if x['tinhTrang'] in ('con-hieu-luc', 'sua-doi-mot-phan')),
                        'nenBoSung': sum(1 for r in nen_bo_sung if r.get('nhom') == n['ma'])})
    # TRA THEO CHỦ ĐỀ: văn bản có từ 2 điều nói tới chủ đề trở lên thì kể ra (văn bản ngắn: 1 điều).
    # Chủ đề HIẾM (cả kho chưa tới 10 điều, vd "trồng rừng thay thế" chỉ có 1 điều) thì 1 điều cũng kể —
    # bỏ đi là mất đúng chỗ duy nhất trong kho nói về việc đó.
    tong_cd = {}
    for x in van_ban:
        if isinstance(x['_chuDeTra'], dict):
            for ten, n in x['_chuDeTra'].items():
                tong_cd[ten] = tong_cd.get(ten, 0) + n
    for x in van_ban:
        if isinstance(x['_chuDeTra'], dict):
            x['_chuDeTra'] = [{'ten': ten, 'soDieu': n} for ten, n in x['_chuDeTra'].items()
                              if n >= 2 or (n >= 1 and (x.get('soDieu', 99) <= 12 or tong_cd.get(ten, 0) < 10))]
    chu_de_ra = []
    for c in chu_de:
        ds = [{'ma': x['ma'], **({'soDieu': z['soDieu']} if 'soDieu' in z else {})}
              for x in van_ban for z in x['_chuDeTra'] if z['ten'] == c['ten']]
        # văn bản có điều xếp theo số điều nhiều → ít; văn bản tham khảo đứng cuối
        ds.sort(key=lambda z: -z.get('soDieu', 0.5))
        chu_de_ra.append({**c, 'vanBan': ds})
    for x in van_ban:
        x.pop('_chuDeTra', None)
    ra = {
        'capNhat': datetime.date.today().isoformat(),
        'ghiChu': 'Sinh tự động bởi scripts/luat/dung-bo-tong-hop.py — đừng sửa tay. Văn bản tham khảo khai ở '
                  'public/luat/tham-khao/<mã>.json; văn bản có Điều nằm trong _kho.json.',
        'tong': {'vanBan': len(van_ban), 'coDieu': len(kho), 'thamKhao': len(tk),
                 'dieu': sum(x.get('soDieu', 0) for x in van_ban)},
        'nhom': nhom_ra, 'tinhTrang': TINH_TRANG, 'chuDe': chu_de_ra, 'chang': lt['chang'],
        'vanBan': van_ban, 'theoDieu': the_dieu, 'nenBoSung': nen_bo_sung,
    }
    with open(RA_JSON, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(ra, f, ensure_ascii=False, separators=(',', ':'))
    viet_md(ra, tk, cm, K)
    print('Bộ tổng hợp: %d văn bản (%d có điều, %d tham khảo), %d điều có văn bản tham khảo nhắc tới, '
          '%d văn bản nên bổ sung' % (len(van_ban), len(kho), len(tk), len(the_dieu), len(nen_bo_sung)))
    print('  -> %s (%d KB)' % (os.path.relpath(RA_JSON, GOC), os.path.getsize(RA_JSON) // 1024))
    print('  -> %s' % os.path.relpath(RA_MD, GOC))


# ───────────────────────────── tài liệu Markdown ─────────────────────────────
TEN_QH = [('canCu', 'Căn cứ ban hành'), ('thayThe', 'Thay thế'), ('biThayTheBoi', 'Bị thay thế bởi'),
          ('suaDoi', 'Sửa đổi, bổ sung'), ('biSuaDoiBoi', 'Bị sửa đổi, bổ sung bởi'),
          ('baiBoMotPhan', 'Bãi bỏ một phần của'), ('biBaiBoMotPhanBoi', 'Bị bãi bỏ một phần bởi'),
          ('laCanCuCho', 'Được hướng dẫn bởi (là căn cứ của)')]


def so_dep(n):
    return format(int(n or 0), ',').replace(',', '.')


def viet_md(ra, tk, cm, K):
    vb = {x['ma']: x for x in ra['vanBan']}
    chang = {c['so']: c for c in ra['chang']}
    nh = lambda m: vb[m]['nhan'] if m in vb else m
    L = []
    w = L.append
    w('# Bộ tổng hợp văn bản — công cụ "Học và tra cứu Luật Đất đai"')
    w('')
    w('> **Tệp này do máy sinh** bằng `python scripts/luat/dung-bo-tong-hop.py` — đừng sửa tay, sửa dữ liệu rồi chạy lại.')
    w('> Cập nhật: %s · **%d văn bản** (%d văn bản có điều + %d văn bản tham khảo) · **%s điều**.'
      % (ngay_vn(ra['capNhat']), ra['tong']['vanBan'], ra['tong']['coDieu'], ra['tong']['thamKhao'],
         so_dep(ra['tong']['dieu'])))
    w('> Trên web: trang `/tra-cuu-luat` → thẻ **📚 Danh mục** → **Bộ văn bản để học** (chỉ quản trị viên).')
    w('')
    w('**Nguyên văn là nguyên văn:** chữ của văn bản lấy từ bản gốc (PDF ký số / Công báo), không viết lại. '
      'Phần "tóm tắt", "lưu ý" dưới đây là lời người làm web viết cho dễ hiểu — **không phải văn bản luật**.')
    w('')
    w('Ký hiệu tình trạng: ' + ' · '.join('%s %s' % (t['icon'], t['ten']) for t in ra['tinhTrang'].values()))
    w('')
    w('## Tóm tắt theo loại')
    w('')
    w('| Loại | Số văn bản | Còn hiệu lực | Nên bổ sung |')
    w('|---|---:|---:|---:|')
    for n in ra['nhom']:
        w('| %s %s | %d | %s | %s |' % (n['icon'], n['ten'], n['soVanBan'],
                                       '—' if n['ma'] == 'huong-dan' else n['conHieuLuc'], n.get('nenBoSung') or '—'))
    w('')
    for i, n in enumerate(ra['nhom'], 1):
        ds = [x for x in ra['vanBan'] if x['nhom'] == n['ma']]
        w('## %d. %s %s' % (i, n['icon'], n['ten']))
        w('')
        w('_%s_' % n['moTa'])
        w('')
        if not ds:
            w('Chưa có văn bản nào trong kho.')
            w('')
        for x in ds:
            t = ra['tinhTrang'][x['tinhTrang']]
            if x['soHieu'] in x['nhan']:            # công văn: nhãn đã có số hiệu → ghi cơ quan + ngày cho dễ nhận
                w('### %s %s — %s, %s' % (t['icon'], x['nhan'], x.get('tinh') or x['coQuan'], ngay_vn(x['ngay'])))
            else:
                w('### %s %s — %s' % (t['icon'], x['nhan'], x['soHieu']))
            w('')
            w('- **Tên:** %s' % x['ten'])
            w('- **Cơ quan ban hành:** %s%s' % (x['coQuan'] or '—', (' · **Người ký:** %s' % x['nguoiKy']) if x.get('nguoiKy') else ''))
            if x.get('ngayHieuLuc'):
                hl = ngay_vn(x['ngayHieuLuc']) + ((' _(%s: “%s”)_' % (x['ngayHieuLucDoc'], x['hieuLucNguyenVan']))
                                                  if x.get('ngayHieuLucDoc') else '')
            else:
                hl = ('chưa ghi được ngày — nguyên văn: “%s”' % x['hieuLucNguyenVan']) if x.get('hieuLucNguyenVan') else '—'
            if x['tinhTrang'] == 'tham-khao':
                hl = 'không áp dụng (văn bản hành chính)'
            w('- **Ban hành:** %s · **Hiệu lực:** %s' % (ngay_vn(x['ngay']) or '—', hl))
            w('- **Tình trạng:** %s %s' % (t['icon'], x['tinhTrangChu']))
            for ck in x.get('canKiemTra') or []:
                w('- ⚠️ **Cần kiểm:** Điều %s%s — %s _(theo %s)_' % (ck['dieu'], (' khoản %s' % ck['khoan']) if ck.get('khoan') else '',
                                                                  ck['ghi'], nh(ck['tu'])))
            for k, ten in TEN_QH:
                if x.get('quanHe', {}).get(k):
                    w('- **%s:** %s' % (ten, ', '.join(nh(m) for m in x['quanHe'][k])))
            if x.get('chuDe'):
                w('- **Chủ đề chính:** %s' % ' · '.join(
                    '%s %s%s' % (c['icon'], c['ten'], (' (%d điều)' % c['soDieu']) if c.get('soDieu') else '') for c in x['chuDe']))
            if x.get('chang'):
                w('- **Chặng lộ trình học:** %s' % ' · '.join(
                    '%s Chặng %d. %s%s' % (chang[c['so']]['icon'], c['so'] + 1, chang[c['so']]['ten'],
                                           (' (%d điều)' % c['soDieu']) if c.get('soDieu') else '')
                    for c in x['chang'][:5] if c['so'] in chang) + (' · …' if len(x['chang']) > 5 else ''))
            if x['tinhTrang'] == 'tham-khao':
                v = next(z for z in tk if z['ma'] == x['ma'])
                w('- **Trích yếu:** %s' % v['ten'])
                w('- **Kính gửi:** %s' % v.get('kinhGui', ''))
                if v.get('danChieu'):
                    w('- **Dẫn chiếu:** ' + '; '.join(
                        ('%s (→ %s Điều %s)' % (z['chu'], nh(z['ma']), z['so'])) if z.get('ma') else
                        ('%s (chưa có trong kho)' % z['chu']) for z in v['danChieu']))
                if v.get('lienQuan'):
                    w('- **Điều liên quan nên đọc kèm** _(người làm web chọn, công văn không trích)_: ' + '; '.join(
                        '%s Điều %s — %s' % (nh(z['ma']), z['so'], z.get('lyDo', '')) for z in v['lienQuan']))
                if x.get('nhacToiNgoaiKho'):
                    w('- **Nhắc tới văn bản chưa có trong kho:** %s' % ', '.join(x['nhacToiNgoaiKho']))
                w('- **Chữ trong kho:** %s' % (
                    'lấy thẳng từ lớp chữ của bản PDF gốc' if v.get('nguonChu') == 'lop-chu-pdf'
                    else 'MÁY ĐỌC từ ảnh quét rồi người soát lại với ảnh — trích dẫn chính thức phải đối chiếu ảnh bản gốc'))
                gt = v.get('giaiThich') or {}
                if gt.get('tom'):
                    w('- **Tóm tắt** _(không phải văn bản luật)_: %s' % gt['tom'])
                for y in gt.get('y') or []:
                    w('    - %s' % y)
                if gt.get('luuY'):
                    w('- **Lưu ý** _(không phải văn bản luật)_: %s' % gt['luuY'])
            else:
                w('- **Quy mô:** %d điều%s%s' % (x['soDieu'], (', %d chương' % x['soChuong']) if x.get('soChuong') else '',
                                                (' · nguồn chữ: %s' % x['nguon']) if x.get('nguon') else ''))
            if x.get('luuTru'):
                l = x['luuTru']
                w('- **Bản gốc lưu trữ:** `%s` — %s byte → %s byte (%s)' % (
                    l['tep'], so_dep(l['kichThuocGoc']), so_dep(l['kichThuocLuu']), l['cachLuu']))
            w('')
        goi_y = [r for r in ra['nenBoSung'] if r.get('nhom') == n['ma']]
        if goi_y:
            w('➕ **Nên bổ sung vào nhóm này** (chi tiết ở mục "Văn bản nên bổ sung"): %s.' % '; '.join(
                '%s%s' % (r['soHieu'], (' — ' + r['ten']) if r.get('ten') else '') for r in goi_y))
            w('')
    w('## Tra theo chủ đề')
    w('')
    w('_Chủ đề = hàng "Chủ đề nhanh" trên trang. Với văn bản có điều: đếm số điều có cụm từ của chủ đề (giống ô tìm trên trang)._')
    w('')
    for c in ra['chuDe']:
        if not c['vanBan']:
            continue
        w('- **%s %s** (cụm tìm: “%s”): %s' % (c['icon'], c['ten'], c['tim'], ' · '.join(
            '%s%s' % (nh(z['ma']), (' (%d điều)' % z['soDieu']) if z.get('soDieu') else ' 📨') for z in c['vanBan'])))
    w('')
    w('## Tra theo chặng lộ trình học')
    w('')
    for c in ra['chang']:
        ds = [(x, next(z for z in x['chang'] if z['so'] == c['so'])) for x in ra['vanBan']
              if any(z['so'] == c['so'] for z in x['chang'])]
        ds.sort(key=lambda p: -p[1].get('soDieu', 0))
        w('- **%s Chặng %d. %s**%s: %s' % (c['icon'], c['so'] + 1, c['ten'], ' ★ trọng tâm' if c.get('trongTam') else '',
                                          ' · '.join('%s%s' % (nh(x['ma']), (' (%d điều)' % z['soDieu']) if z.get('soDieu') else ' 📨')
                                                     for x, z in ds) or '—'))
    w('')
    w('## Điều luật có văn bản tham khảo nhắc tới')
    w('')
    if not ra['theoDieu']:
        w('Chưa có.')
    for k, ds in sorted(ra['theoDieu'].items()):
        ma, so = k.split(':')
        for z in ds:
            w('- **%s Điều %s**%s ← %s %s%s' % (nh(ma), so, (' khoản %s' % z['khoan']) if z.get('khoan') else '',
                                                 nh(z['ma']), '(trích dẫn)' if z['kieu'] == 'trich-dan' else '(liên quan, đọc kèm)',
                                                 (' — ⚠️ ' + z['luuY']) if z.get('canh') and z.get('luuY') else ''))
    w('')
    w('## Văn bản nên bổ sung vào kho')
    w('')
    w('| Số hiệu | Tên | Vì sao cần | Bản gốc |')
    w('|---|---|---|---|')
    for r in ra['nenBoSung']:
        vi_sao = []
        if r.get('anhHuongDieu'):
            vi_sao.append('**⚠️ làm thay đổi hiệu lực của điều đang có trong kho: %s — nạp trước**' % ', '.join(r['anhHuongDieu']))
        if r['duocNhacBoi']:
            vi_sao.append('được %s nhắc tới' % ', '.join(nh(m) for m in r['duocNhacBoi']))
        if r.get('lyDoChuaCo'):
            vi_sao.append('chưa đưa vào được: ' + r['lyDoChuaCo'])
        if r.get('canKiemTra'):
            vi_sao.append('⚠️ ' + r['canKiemTra'])
        goc = ''
        if r.get('danhMuc'):
            goc = '[cổng Chính phủ](%s)' % r['danhMuc']['link'] + ''.join(' · [PDF](%s)' % u for u in r['danhMuc']['tep'][:1])
        w('| %s | %s | %s | %s |' % (r['soHieu'], r.get('ten') or '—', '; '.join(vi_sao) or '—', goc or 'chưa tìm thấy trong danh mục toàn quốc'))
    w('')
    w('## Bản lưu trữ các tệp chủ dự án gửi')
    w('')
    w('_Thư mục `scripts/luat/van-ban-goc/` — chỉ mục đầy đủ ở `chi-muc.json` (cách đã thử, chữ ký số của bản gốc, sha256)._')
    w('')
    w('| Mã | Tên tệp gốc | Ngày nhận | Trang | Trước → sau | Cách lưu |')
    w('|---|---|---|---:|---|---|')
    for m, c in sorted(cm.items(), key=lambda z: z[1].get('ngayNhan', '') + z[0]):
        w('| `%s` | %s | %s | %d | %s → %s byte | %s |' % (m, c.get('tenGoc', ''), ngay_vn(c.get('ngayNhan')), c.get('soTrang', 0),
                                                       so_dep(c.get('kichThuocGoc')), so_dep(c.get('kichThuocLuu')), c.get('cachLuu', '')))
    w('')
    os.makedirs(os.path.dirname(RA_MD), exist_ok=True)
    with open(RA_MD, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(L))


if __name__ == '__main__':
    lam()
