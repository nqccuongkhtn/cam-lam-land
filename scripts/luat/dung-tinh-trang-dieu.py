# -*- coding: utf-8 -*-
"""
ĐÁNH DẤU TÌNH TRẠNG TỪNG ĐIỀU: điều nào đã bị BÃI BỎ, điều nào bị SỬA ĐỔI, bởi văn bản nào,
từ ngày nào. Đây là thứ Thư viện pháp luật luôn hiện ngay trên đầu mỗi điều, mà mình còn thiếu.

VÌ SAO CỰC KỲ QUAN TRỌNG — một ví dụ thật vừa vấp:
Nghị định 151/2025 (hiệu lực 01/7/2025) bãi bỏ của Nghị định 101/2024 các Điều 21, 22, 28,
29, 38, 39 … 60 và TOÀN BỘ Mẫu số 01/ĐK → 14/ĐK. Đó đúng là những điều nói về NƠI NỘP HỒ SƠ,
THỜI HẠN GIẢI QUYẾT, HỒ SƠ GỒM GÌ, MẪU ĐƠN — tức là phần người đi làm hồ sơ dùng nhiều nhất.
Đọc nguyên văn mấy điều đó mà không biết chúng đã hết hiệu lực thì làm sai cả bộ hồ sơ.

CÁCH ĐỌC — danh sách trong điều "Hiệu lực thi hành" viết theo NHÓM, số hiệu văn bản đặt ở
CUỐI nhóm và áp cho mọi mục phía trước trong nhóm đó:
    "Khoản 5 và khoản 11 Điều 9; khoản 1 Điều 19; các Điều 21, 22, 28 … ;
     các Mẫu số 01/ĐK … 14/ĐK  ⟵ Nghị định số 101/2024/NĐ-CP;"
Nên phải gom các mục lại tới khi gặp số hiệu rồi mới biết chúng thuộc văn bản nào.

Chạy:  python dung-tinh-trang-dieu.py <thu-muc-json>
"""
import sys, os, re, json

RE_SO_HIEU = re.compile(r'(\d{1,4}/\d{4}/[A-ZĐ][A-ZĐ0-9\-]*)')
RE_DIEU = re.compile(r'Điều\s+(\d{1,3})')
# "các Điều 21, 22, 28, 29, … , 60" — sau chữ "Điều" đầu tiên là CẢ DÃY SỐ ngăn nhau bằng
# dấu phẩy, không lặp lại chữ "Điều". Bắt trống thì chỉ lấy được mỗi Điều 21, mất 24 điều
# còn lại — mà đó đúng là những điều nói về hồ sơ, thời hạn, mẫu đơn.
RE_DAY_DIEU = re.compile(r'Điều\s+((?:\d{1,3}\s*(?:,|và)\s*)*\d{1,3})')


def so_dieu_trong(muc):
    """Lấy mọi số điều trong một mục, mở hết dãy liệt kê."""
    ra = []
    for m in RE_DAY_DIEU.finditer(muc):
        ra += [int(x) for x in re.findall(r'\d{1,3}', m.group(1))]
    return ra
# Mục chỉ động tới MỘT PHẦN của điều: bắt đầu bằng khoản / điểm
RE_PHAN = re.compile(r'^\s*(các\s+)?(khoản|điểm)\b', re.I)
RE_MAU = re.compile(r'^\s*(các\s+)?Mẫu số\b', re.I)
# Điều "sửa đổi, bổ sung <cái gì> của <văn bản nào>" trong các luật/nghị định sửa đổi
RE_SUA = re.compile(r'[Ss]ửa đổi, bổ sung\s+((?:khoản|điểm|Điều)[^;.]{0,120})')


def gom_nhom(ds_muc):
    """Gom các mục lại thành nhóm, mỗi nhóm kết thúc ở mục có số hiệu văn bản."""
    nhom, dem = [], []
    for muc in ds_muc:
        dem.append(muc)
        if RE_SO_HIEU.search(muc):
            nhom.append(dem)
            dem = []
    return nhom


def doc_bai_bo(chu):
    """Trả về danh sách (ma_so_hieu, so_dieu, phan_mo_ta, la_mot_phan, la_mau)."""
    ra = []
    for m in re.finditer(r'hết hiệu lực[^:]{0,60}?:?([^.]{0,2000})', chu, re.I):
        for nh in gom_nhom([x.strip(' :,') for x in m.group(1).split(';') if x.strip()]):
            so_hieu = RE_SO_HIEU.search(' '.join(nh))
            if not so_hieu:
                continue
            so_hieu = so_hieu.group(1)
            for muc in nh:
                if RE_MAU.match(muc):
                    ra.append((so_hieu, None, re.sub(r'\s+', ' ', muc)[:160], True, True))
                    continue
                ds = so_dieu_trong(muc)
                if not ds:
                    continue
                mot_phan = bool(RE_PHAN.match(muc))
                for so in ds:
                    ra.append((so_hieu, so, re.sub(r'\s+', ' ', muc)[:160], mot_phan, False))
    return ra


def lam(thu_muc):
    kho = json.load(open(os.path.join(thu_muc, '_kho.json'), encoding='utf-8'))
    theo_so = {x['soHieu']: x['ma'] for x in kho}
    ngay_hl = {x['ma']: (x.get('ngayHieuLuc') or x['ngay']) for x in kho}
    ten = {x['ma']: x for x in kho}

    # dọn dấu cũ để chạy lại không bị chồng
    vb = {}
    for x in kho:
        p = os.path.join(thu_muc, x['ma'] + '.json')
        if not os.path.exists(p):
            continue
        vb[x['ma']] = json.load(open(p, encoding='utf-8'))
        for d in vb[x['ma']]['dieu']:
            d.pop('tinhTrang', None)
        vb[x['ma']].pop('mauBiBaiBo', None)

    dem_bo, dem_phan, dem_sua = 0, 0, 0
    for ma, v in vb.items():
        for d in v['dieu']:
            if d['tieuDe'] and 'hiệu lực' not in d['tieuDe'].lower():
                continue
            chu = ' '.join(k['chu'] + ' ' + ' '.join(y['chu'] for y in k['diem']) for k in d['khoan'])
            for so_hieu, so_dieu, mo_ta, mot_phan, la_mau in doc_bai_bo(chu):
                ma2 = theo_so.get(so_hieu)
                if not ma2 or ma2 == ma or ma2 not in vb:
                    continue
                if la_mau:
                    vb[ma2].setdefault('mauBiBaiBo', []).append(
                        {'boi': ma, 'tuNgay': ngay_hl.get(ma, ''), 'phan': mo_ta})
                    continue
                dich = next((z for z in vb[ma2]['dieu'] if z['so'] == so_dieu), None)
                if not dich:
                    continue
                dich['tinhTrang'] = {
                    'loai': 'bai-bo-mot-phan' if mot_phan else 'het-hieu-luc',
                    'boi': ma, 'tuNgay': ngay_hl.get(ma, ''), 'phan': mo_ta if mot_phan else '',
                }
                if mot_phan:
                    dem_phan += 1
                else:
                    dem_bo += 1

    # --- SỬA ĐỔI: luật/nghị định sửa đổi thì mỗi điều của nó nói sửa cái gì của ai ---
    for ma, v in vb.items():
        for d in v['dieu']:
            tie = d['tieuDe'] or ''
            m_so = RE_SO_HIEU.search(tie)
            if 'sửa đổi, bổ sung' not in tie.lower() or not m_so:
                continue
            ma2 = theo_so.get(m_so.group(1))
            if not ma2 or ma2 not in vb or ma2 == ma:
                continue
            chu = ' '.join(k['chu'] for k in d['khoan'])
            for m in RE_SUA.finditer(tie + ' ; ' + chu):
                for so in set(so_dieu_trong(m.group(1))):
                    dich = next((z for z in vb[ma2]['dieu'] if z['so'] == so), None)
                    if not dich or dich.get('tinhTrang'):
                        continue
                    dich['tinhTrang'] = {'loai': 'sua-doi', 'boi': ma, 'boiDieu': d['so'],
                                         'tuNgay': ngay_hl.get(ma, ''),
                                         'phan': re.sub(r'\s+', ' ', m.group(1))[:160]}
                    dem_sua += 1

    for ma, v in vb.items():
        json.dump(v, open(os.path.join(thu_muc, ma + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)

    print('Da danh dau: %d dieu HET HIEU LUC, %d dieu bi bai bo mot phan, %d dieu bi SUA DOI'
          % (dem_bo, dem_phan, dem_sua))
    for ma, v in vb.items():
        ds = [d for d in v['dieu'] if d.get('tinhTrang')]
        if ds:
            nhom = {}
            for d in ds:
                nhom.setdefault(d['tinhTrang']['loai'], []).append(d['so'])
            for loai, so in nhom.items():
                sys.stdout.buffer.write(('  %-16s %-18s %d dieu: %s\n' % (
                    v['soHieu'], loai, len(so), ', '.join(map(str, sorted(so)[:22])))).encode('utf-8', 'replace'))
        if v.get('mauBiBaiBo'):
            sys.stdout.buffer.write(('  %-16s mau bi bai bo: %s\n' % (
                v['soHieu'], v['mauBiBaiBo'][0]['phan'][:90])).encode('utf-8', 'replace'))


if __name__ == '__main__':
    lam(sys.argv[1])
