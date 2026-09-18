# -*- coding: utf-8 -*-
"""
DỰNG KHO DỮ LIỆU LUẬT CHO WEB: từ các tệp chữ (bóc từ PDF Công báo) ra JSON có cấu trúc.

⚠️ CÔNG BÁO CẮT VĂN BẢN DÀI RA NHIỀU SỐ. Nghị định 101/2024 đăng ở Công báo 913+914 rồi
cuối trang ghi "(Xem tiếp Công báo số 915 + 916)". Lấy mỗi phần đầu thì được 60/68 điều —
mà NHÌN VÀO KHÔNG BIẾT LÀ THIẾU vì 60 điều đó vẫn liên tục 1..60. Đã vấp thật với 4 văn bản.
Nên ở đây nhận vào NHIỀU PHẦN (_p1, _p2, _p3...) rồi nối lại, và tự soi mạch nối.

Mỗi văn bản tự đọc lấy SỐ HIỆU, NGÀY BAN HÀNH, TÊN từ chính trang đầu của nó — không gõ tay,
không lấy từ tên tệp. Gõ tay là có ngày sai mà không ai biết.

TỰ KIỂM, in ra hết, tệp nào trượt thì KHÔNG ghi ra web:
  1. Số hiệu đọc được trong tệp phải khớp số hiệu mong đợi.
  2. MẠCH NỐI: phần k ghi "Xem tiếp Công báo số A + B" thì phần k+1 phải đúng là số A + B.
     Phần cuối cùng KHÔNG được còn chữ "Xem tiếp" (còn nghĩa là thiếu phần).
  3. Số điều phải liên tục 1..N, không đứt quãng.
  4. Điều cuối phải là điều khoản thi hành / hiệu lực (dấu hiệu văn bản không bị cụt).

CHƯA ĐƯA LÊN WEB ĐƯỢC (để đây cho lần sau, đừng mất công tìm lại):
  · 112/2024/NĐ-CP (đất trồng lúa) — Công báo KHÔNG đăng (có 111, có 113, nhảy qua 112);
    bản trên datafiles.chinhphu.vn là ảnh quét, bóc ra đúng 205 ký tự.
  · 09/2024/TT-BTNMT — bản PDF ký số tải được có lớp chữ thật nhưng THIẾU điều khoản
    thi hành (tìm khắp 627 nghìn ký tự không có chữ "Hiệu lực thi hành") -> bản cụt.
  · 23/2025/TT-BNNMT — thông tư SỬA ĐỔI, chép nguyên cả Chương V của thông tư khác vào
    trong ngoặc kép, mang theo "Điều 34..42" của văn bản kia; tách ra bị đứt số điều.
Cả ba vẫn tra được ở thẻ "Danh mục văn bản đất đai" kèm đường tải bản gốc.

Chạy:  python dung-kho-luat.py <thu-muc-txt> <thu-muc-ra>
"""
import sys, os, re, json, glob, importlib.util

_spec = importlib.util.spec_from_file_location(
    'tachpdf', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tach-luat-pdf.py'))
tachpdf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tachpdf)

RE_SO = re.compile(r'Số:\s*([0-9]{1,4}\s*/\s*[0-9]{4}\s*/\s*[A-ZĐ][A-ZĐ\-]*)')
# Ngày ban hành nằm ở dòng ký "Hà Nội, ngày ... tháng ... năm ...". Phải bám vào chữ
# "Hà Nội," chứ lấy "ngày ... tháng ... năm ..." đầu tiên là vớ phải ngày của văn bản
# được viện dẫn trong phần "Căn cứ" (đã vấp: Luật 43/2024 ra nhầm ngày 17/11/2020).
RE_NGAY = re.compile(r'Hà Nội,\s*ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})')
# LUẬT thì không ký kiểu "Hà Nội, ngày..." mà ghi ở cuối: "...kỳ họp thứ 7 thông qua
# ngày 29 tháng 6 năm 2024." -> đó mới là ngày ban hành của luật.
RE_NGAY_LUAT = re.compile(r'thông qua\s+ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})')
RE_XEM_TIEP = re.compile(r'\(\s*Xem tiếp Công báo số\s*([\d\s+]+)\)')
RE_DAU_TRANG = re.compile(r'CÔNG BÁO/\s*Số\s*([\d\s+]+)/')
RE_TIEP_THEO = re.compile(r'^\(\s*Tiếp theo Công báo số[^)]*\)\s*$')
# NGƯỜI KÝ và NGÀY HIỆU LỰC — hai trường Thư viện pháp luật luôn hiện ở hộp thuộc tính,
# người tra luật nhìn vào đó trước cả nội dung. Lấy máy từ chính bản gốc, không gõ tay.
RE_KHOI_KY = re.compile(r'(TM\. CHÍNH PHỦ|KT\. THỦ TƯỚNG CHÍNH PHỦ|THỦ TƯỚNG CHÍNH PHỦ'
                        r'|CHỦ TỊCH QUỐC HỘI|KT\. BỘ TRƯỞNG|BỘ TRƯỞNG)')
RE_TEN_NGUOI = re.compile(r'^[A-ZĐÀ-Ỹ][a-zđà-ỹ]+(?: [A-ZĐÀ-Ỹ][a-zđà-ỹ]+){1,4}$')
RE_HIEU_LUC = re.compile(r'có hiệu lực (?:thi hành )?(?:kể )?từ ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})')
CUOI_OK = re.compile(r'hiệu lực|trách nhiệm (thi hành|thực hiện)|tổ chức thực hiện'
                     r'|điều khoản (thi hành|chuyển tiếp)|quy định chi tiết', re.I)


def chuan_so(s):
    """'915 + 916' -> '915+916' để so cho chắc."""
    return re.sub(r'\s+', '', s or '')


def noi_cac_phan(duong_cac_tep):
    """Nối các phần của một văn bản, đồng thời soi mạch nối. Trả (chữ, danh sách lỗi)."""
    loi, manh = [], []
    for i, d in enumerate(duong_cac_tep):
        t = open(d, encoding='utf-8').read()
        if i > 0:
            # Bỏ phần đầu trang bìa của các phần sau (chữ ký số, tên văn bản lặp lại)
            # tới hết dòng "(Tiếp theo Công báo số ...)". Không bỏ thì tên văn bản lặp
            # lại lọt vào giữa thân bài.
            dong = t.split('\n')
            vt = next((k for k, x in enumerate(dong) if RE_TIEP_THEO.match(x.strip())), None)
            if vt is None:
                loi.append('phan %d khong co dong "(Tiep theo Cong bao so ...)"' % (i + 1))
            else:
                t = '\n'.join(dong[vt + 1:])
        # soi mạch: phần này bảo xem tiếp ở số nào?
        tiep = RE_XEM_TIEP.findall(t)
        dau = RE_DAU_TRANG.search(open(d, encoding='utf-8').read())
        manh.append({'tiep': chuan_so(tiep[-1]) if tiep else '', 'dau': chuan_so(dau.group(1)) if dau else ''})
        # bỏ dòng "(Xem tiếp ...)" khỏi chữ vì nó không phải nội dung văn bản
        t = RE_XEM_TIEP.sub('', t)
        duong_cac_tep[i] = t
    for i in range(len(manh)):
        if manh[i]['tiep']:
            if i + 1 >= len(manh):
                loi.append('phan %d bao "xem tiep Cong bao %s" nhung KHONG CO phan sau -> THIEU' % (i + 1, manh[i]['tiep']))
            elif manh[i + 1]['dau'] and manh[i + 1]['dau'] != manh[i]['tiep']:
                loi.append('mach noi lech: phan %d bao tiep o %s, phan %d lai la %s'
                           % (i + 1, manh[i]['tiep'], i + 2, manh[i + 1]['dau']))
    return '\n'.join(duong_cac_tep), loi


def doc_dau(t):
    """Đọc số hiệu, ngày ban hành, tên văn bản từ phần đầu."""
    dau = t[:6000]
    mot_dong = dau.replace('\n', ' ')
    m = RE_SO.search(mot_dong)
    so = re.sub(r'\s+', '', m.group(1)) if m else ''
    m2 = RE_NGAY.search(mot_dong) or RE_NGAY_LUAT.search(t.replace('\n', ' '))
    ngay = '%04d-%02d-%02d' % (int(m2.group(3)), int(m2.group(2)), int(m2.group(1))) if m2 else ''
    # Tên = các dòng ngay sau chữ NGHỊ ĐỊNH / LUẬT / THÔNG TƯ, dừng khi gặp "Căn cứ"
    ten = ''
    m3 = re.search(r'(?m)^\s*(NGHỊ ĐỊNH|LUẬT|THÔNG TƯ|NGHỊ QUYẾT)\s*$', dau)
    if m3:
        lay = []
        for d in [x.strip() for x in dau[m3.end():].split('\n') if x.strip()][:8]:
            if d.startswith('Căn cứ') or d.startswith('Theo đề nghị') or RE_SO.search(d):
                break
            lay.append(d)
        ten = ' '.join(lay).strip()
    # bản gốc hay có dòng gạch ngang trang trí "________" ngay dưới tên -> bỏ đi
    ten = re.sub(r'[\s_\-–—]+$', '', ten)
    return so, ngay, ten


# Tên của LUẬT in TOÀN CHỮ HOA trên bản gốc ("LUẬT ĐẤT ĐAI"), máy không tự hạ chữ hoa
# đúng được (hạ máy móc thì ra "luật nhà ở số 27/2023/qh15"). Nên chép tay đúng từng chữ
# theo bản PDF ký số, chỉ đổi mỗi chữ hoa/thường chứ không đổi lời.
TEN_RIENG = {
    'ldd2024': 'Luật Đất đai',
    'ldd2013': 'Luật Đất đai (bản năm 2013)',
    'l43-2024': ('Luật sửa đổi, bổ sung một số điều của Luật Đất đai số 31/2024/QH15, '
                 'Luật Nhà ở số 27/2023/QH15, Luật Kinh doanh bất động sản số 29/2023/QH15 '
                 'và Luật Các tổ chức tín dụng số 32/2024/QH15'),
}


# Văn bản đã HẾT HIỆU LỰC nhưng vẫn giữ trong kho để đối chiếu cũ ↔ mới. Phải ghi rõ ra
# giao diện, không để người dùng tra nhầm rồi tưởng là luật đang áp dụng.
HET_HIEU_LUC = {
    'ldd2013': 'Hết hiệu lực từ 01/8/2024 — đã được thay bằng Luật Đất đai 2024 (31/2024/QH15). '
               'Giữ lại ở đây CHỈ để đối chiếu cũ ↔ mới.',
}


def doc_nguoi_ky(t):
    """Tên người ký nằm ngay dưới khối chức danh IN HOA ở cuối văn bản."""
    dong = [d.strip() for d in t.split('\n') if d.strip()]
    vt = [i for i, d in enumerate(dong) if RE_KHOI_KY.match(d)]
    for i in reversed(vt):
        for d in dong[i + 1:i + 6]:
            if RE_TEN_NGUOI.match(d):
                return d
    return ''


def doc_hieu_luc(vb):
    """Ngày có hiệu lực lấy từ chính điều "Hiệu lực thi hành" của văn bản."""
    for d in vb['dieu']:
        if 'hiệu lực' not in d['tieuDe'].lower():
            continue
        chu = ' '.join(k['chu'] + ' ' + ' '.join(x['chu'] for x in k['diem']) for k in d['khoan'])
        m = RE_HIEU_LUC.search(chu)
        if m:
            return '%04d-%02d-%02d' % (int(m.group(3)), int(m.group(2)), int(m.group(1)))
    return ''


def lam(cac_tep, so_mong, ma, ra_dir):
    t, loi = noi_cac_phan(list(cac_tep))
    so, ngay, ten = doc_dau(t)
    ten = TEN_RIENG.get(ma, ten)
    if so_mong and chuan_so(so_mong) not in chuan_so(t):
        loi.append('so hieu "%s" KHONG co trong tep' % so_mong)
    vb = tachpdf.tach(t, ma, so or so_mong, ngay, ten,
                      'Công báo Chính phủ (bản PDF ký số, có lớp chữ) — congbao.chinhphu.vn')
    vb['soPhan'] = len(cac_tep)
    vb['nguoiKy'] = doc_nguoi_ky(t)
    vb['ngayHieuLuc'] = doc_hieu_luc(vb)
    if ma in HET_HIEU_LUC:
        vb['hetHieuLuc'] = HET_HIEU_LUC[ma]
    ds = [d['so'] for d in vb['dieu']]
    if not ds:
        loi.append('khong tach duoc dieu nao')
    else:
        thieu = [i for i in range(1, max(ds) + 1) if i not in set(ds)]
        if thieu:
            loi.append('thieu dieu %s' % thieu[:12])
        cuoi = max(vb['dieu'], key=lambda d: d['so'])
        if not CUOI_OK.search(cuoi['tieuDe']):
            loi.append('dieu cuoi KHONG phai dieu khoan thi hanh: "%s"' % cuoi['tieuDe'][:60])
    if not ngay:
        loi.append('khong doc duoc ngay ban hanh')
    tt = 'OK ' if not loi else '[!]'
    sys.stdout.buffer.write(('%s %-16s %3d dieu  %-11s %d phan  %s%s\n' % (
        tt, so or so_mong, len(ds), ngay or '?', len(cac_tep), ten[:46],
        ('\n      <-- ' + '; '.join(loi)) if loi else '')).encode('utf-8', 'replace'))
    if loi:
        return None
    json.dump(vb, open(os.path.join(ra_dir, ma + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    ra = {'ma': ma, 'soHieu': vb['soHieu'], 'ngay': ngay, 'ten': ten, 'soDieu': len(ds),
          'nguoiKy': vb['nguoiKy'], 'ngayHieuLuc': vb['ngayHieuLuc'],
          'kb': os.path.getsize(os.path.join(ra_dir, ma + '.json')) // 1024}
    if ma in HET_HIEU_LUC:
        ra['hetHieuLuc'] = HET_HIEU_LUC[ma]
    return ra


# tên gốc của tệp -> (số hiệu mong đợi, mã dùng trên web)
BANG = {
    'ldd2024': ('31/2024/QH15', 'ldd2024'),
    'ldd2013': ('45/2013/QH13', 'ldd2013'),
    '10-2024-TT-BTNMT': ('10/2024/TT-BTNMT', 'tt10-2024'),
    '12-2024-TT-BTNMT': ('12/2024/TT-BTNMT', 'tt12-2024'),
    '25-2024-TT-BTNMT': ('25/2024/TT-BTNMT', 'tt25-2024'),
    '26-2024-TT-BTNMT': ('26/2024/TT-BTNMT', 'tt26-2024'),
    '29-2024-TT-BTNMT': ('29/2024/TT-BTNMT', 'tt29-2024'),
    '71-2024-N-CP': ('71/2024/NĐ-CP', 'nd71-2024'),
    '88-2024-N-CP': ('88/2024/NĐ-CP', 'nd88-2024'),
    '101-2024-N-CP': ('101/2024/NĐ-CP', 'nd101-2024'),
    '102-2024-N-CP': ('102/2024/NĐ-CP', 'nd102-2024'),
    '103-2024-N-CP': ('103/2024/NĐ-CP', 'nd103-2024'),
    '104-2024-N-CP': ('104/2024/NĐ-CP', 'nd104-2024'),
    '123-2024-N-CP': ('123/2024/NĐ-CP', 'nd123-2024'),
    '151-2025-N-CP': ('151/2025/NĐ-CP', 'nd151-2025'),
    '42-2024-N-CP': ('42/2024/NĐ-CP', 'nd42-2024'),
    '43-2024-QH15': ('43/2024/QH15', 'l43-2024'),
}

if __name__ == '__main__':
    vao, ra_dir = sys.argv[1], sys.argv[2]
    os.makedirs(ra_dir, exist_ok=True)
    xong = []
    for goc, (so, ma) in sorted(BANG.items()):
        cac = sorted(glob.glob(os.path.join(vao, goc + '_p*.txt')),
                     key=lambda p: int(re.search(r'_p(\d+)\.txt$', p).group(1)))
        if not cac:
            cac = [p for p in [os.path.join(vao, goc + '.txt')] if os.path.exists(p)]
        if not cac:
            print('[!] khong thay tep cho', goc)
            continue
        kq = lam(cac, so, ma, ra_dir)
        if kq:
            xong.append(kq)
    # Thứ tự hiện trên web: LUẬT ĐẤT ĐAI 2024 đứng đầu (văn bản gốc đang áp dụng),
    # rồi tới các văn bản hướng dẫn theo ngày, cuối cùng mới tới văn bản hết hiệu lực.
    xong.sort(key=lambda x: (0 if x['ma'] == 'ldd2024' else (2 if x.get('hetHieuLuc') else 1), x['ngay']))
    # Chủ dự án chốt: KHÔNG làm phần đối chiếu luật mới với luật cũ. Luật Đất đai 2013
    # vẫn tách ra và giữ tệp (khỏi phải làm lại nếu sau này cần), nhưng KHÔNG đưa vào danh
    # sách hiện trên web — để giao diện gọn và người học chỉ tập trung vào luật đang áp dụng.
    xong = [x for x in xong if x['ma'] != 'ldd2013']

    # ── LƯỢC ĐỒ VĂN BẢN (học của Thư viện pháp luật) ──
    # Văn bản nào NHẮC TỚI văn bản nào. Đọc thẳng trong chữ luật: hễ thấy số hiệu của một
    # văn bản khác trong kho là ghi một mối nối. Nhờ vậy biết ngay "nghị định nào hướng dẫn
    # điều này" và ngược lại "nghị định này dựa trên luật nào", khỏi phải đoán.
    theo_so = {x['soHieu']: x['ma'] for x in xong}
    for x in xong:
        vb = json.load(open(os.path.join(ra_dir, x['ma'] + '.json'), encoding='utf-8'))
        chu = ' '.join(k['chu'] + ' ' + ' '.join(y['chu'] for y in k['diem'])
                       for d in vb['dieu'] for k in d['khoan'])
        x['dan'] = sorted({m for so, m in theo_so.items() if m != x['ma'] and so in chu})
    for x in xong:
        x['duocDan'] = sorted({y['ma'] for y in xong if x['ma'] in y['dan']})
    json.dump(xong, open(os.path.join(ra_dir, '_kho.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('ghi duoc %d/%d van ban' % (len(xong), len(BANG)))
