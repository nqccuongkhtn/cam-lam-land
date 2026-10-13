# -*- coding: utf-8 -*-
"""
BOC BANG DON GIA CAY TRONG, VAT NUOI cua QD 35/2026/QD-UBND (UBND tinh Khanh Hoa, 04/5/2026)
tu ban Word tren Cong bao (da doi .doc -> .docx bang LibreOffice, roi docx_dump.py -> dump.json).

Dung:  python -I boc_cay_trong.py <35_dump.json> <cay-trong.json> <cay-trong-mat-do.json>

Moi phan tu: {nhom, ten, phanLoai, dv, gia, ghiChu, pl, bang, stt, giaGoc}
 - gia: so nguyen (dong). Bang tinh bang "1.000 dong" thi nhan 1000, ghi so goc vao giaGoc.
 - O ghi "-" (khong co gia) -> KHONG tao phan tu.
 - Hang ghi "Tinh theo thuc te" -> van giu, gia = null, ghiChu ghi ro.
"""
import sys, io, json, re, unicodedata

sys.stdout.reconfigure(encoding='utf-8')


def gon(s):
    s = unicodedata.normalize('NFC', s or '').replace(' ', ' ')
    return re.sub(r'\s+', ' ', s).strip()


def so(s):
    s = gon(s)
    return int(s.replace('.', '')) if re.fullmatch(r'\d{1,3}(?:\.\d{3})*', s) else None


def main(src, out, out_md):
    dump = json.load(io.open(src, encoding='utf-8'))
    bangs = [k['hang'] for k in dump if k['loai'] == 'bang']
    # bang 0..2 = khung chu ky / tieu de; 3 = PL I; 4 = PL II bang 1; 5 = bang phu; 6 = mat do; 7 = PL III; 8 = PL IV
    pl1, pl2, pl2b, matdo, pl3, pl4 = bangs[3], bangs[4], bangs[5], bangs[6], bangs[7], bangs[8]
    ra = []

    # ---------- PHU LUC I: cay hang nam ----------
    assert gon(pl1[0][1]) == 'Cây trồng', pl1[0]
    for h in pl1[1:]:
        stt, ten, dv, gia = [gon(x) for x in h[:4]]
        g = so(gia)
        assert g is not None, h
        ra.append({'nhom': 'Cây hằng năm', 'ten': ten, 'phanLoai': '', 'dv': dv, 'gia': g,
                   'ghiChu': '', 'pl': 'I', 'bang': 'Bảng đơn giá bồi thường đối với cây hằng năm', 'stt': stt, 'giaGoc': gia})

    # ---------- PHU LUC II bang 1: cay lau nam ----------
    tieu = [gon(x) for x in pl2[1]]
    assert tieu[3:10] == ['1 năm', '2 năm', '3 năm', '4 năm', 'Loại A', 'Loại B', 'Loại C'], tieu
    for h in pl2[2:]:
        h = [gon(x) for x in h]
        stt, ten, dv = h[0], h[1], h[2]
        for c in range(3, 10):
            v = h[c]
            if v in ('-', ''):
                continue
            g = so(v)
            assert g is not None, (h, c)
            pha = ('Cây ở thời kỳ xây dựng cơ bản – ' + tieu[c]) if c < 7 else ('Cây đến thời kỳ thu hoạch – ' + tieu[c])
            ra.append({'nhom': 'Cây lâu năm (cây ăn quả, cây công nghiệp)', 'ten': ten, 'phanLoai': pha,
                       'dv': 'đồng/' + dv, 'gia': g * 1000,
                       'ghiChu': 'Bảng ghi đơn vị 1.000 đồng: %s' % v, 'pl': 'II',
                       'bang': 'Bảng 1. Bảng đơn giá bồi thường đối với cây lâu năm', 'stt': stt, 'giaGoc': v})

    # ---------- PHU LUC II bang phu (Cao su, Mang cut, Xoai hat) ----------
    tieu2 = [gon(x) for x in pl2b[0]]
    assert tieu2[1] == 'Cây trồng' and tieu2[2] == '1 năm' and tieu2[9] == 'Loại A', tieu2
    for h in pl2b[1:]:
        h = [gon(x) for x in h]
        stt, ten = h[0], h[1]
        for c in range(2, 12):
            v = h[c]
            if v in ('-', ''):
                continue
            g = so(v)
            assert g is not None, (h, c)
            pha = ('Cây ở thời kỳ xây dựng cơ bản – ' + tieu2[c]) if c < 9 else ('Cây đến thời kỳ thu hoạch – ' + tieu2[c])
            ra.append({'nhom': 'Cây lâu năm (cây ăn quả, cây công nghiệp)', 'ten': ten, 'phanLoai': pha,
                       'dv': 'đồng/cây', 'gia': g * 1000,
                       'ghiChu': 'Bảng phụ ngay sau Bảng 1 (thời kỳ xây dựng cơ bản tới 7 năm); bảng này KHÔNG có cột đơn vị tính, '
                                 'chỉ ghi "Đơn vị tính: 1.000 đồng" — hiểu theo cây như Bảng 1. Số gốc: %s' % v,
                       'pl': 'II', 'bang': 'Bảng 1 (bảng phụ: Cao su, Măng cụt, Xoài hạt)', 'stt': stt, 'giaGoc': v})

    # ---------- PHU LUC III: cay lam nghiep ----------
    loai, nam = '', ''
    for h in pl3[1:]:
        h = [gon(x) for x in h]
        stt, ten, dv, gia = h[0], h[1], h[2], h[3]
        if ten == dv == gia and ten:          # dong ten loai cay (gop ngang)
            loai, nam = ten, ''
            continue
        if re.fullmatch(r'\d+\.\d+', stt):    # 1.1 Nam thu nhat
            nam = ten.rstrip(':').strip()
            continue
        if stt == '-':
            g = so(gia)
            if g is None:
                ra.append({'nhom': 'Cây lâm nghiệp', 'ten': loai, 'phanLoai': (nam + ' – ' if nam else '') + ten,
                           'dv': dv, 'gia': None, 'ghiChu': 'Văn bản ghi: "%s" (không có đơn giá cố định)' % gia,
                           'pl': 'III', 'bang': 'Bảng đơn giá bồi thường đối với cây lâm nghiệp', 'stt': '', 'giaGoc': gia})
            else:
                dv2 = dv if dv.startswith('đồng') else 'đồng/' + dv
                gc = '' if dv.startswith('đồng') else 'Cột đơn vị tính ghi "%s", cột giá ghi "Đơn giá (đồng)"' % dv
                if loai.startswith('Dó bầu'):
                    gc = (gc + '; ' if gc else '') + 'Cỡ cây đo tại vị trí 1,3 m (theo tên mục)'
                ra.append({'nhom': 'Cây lâm nghiệp', 'ten': loai, 'phanLoai': (nam + ' – ' if nam else '') + ten,
                           'dv': dv2, 'gia': g, 'ghiChu': gc,
                           'pl': 'III', 'bang': 'Bảng đơn giá bồi thường đối với cây lâm nghiệp', 'stt': '', 'giaGoc': gia})
            continue
        raise SystemExit('hang la PL III: %r' % h)

    # ---------- PHU LUC IV: vat nuoi la thuy san ----------
    loai, cach, stt_loai = '', '', ''
    for h in pl4[1:]:
        h = [gon(x) for x in h]
        stt, ten, dv, gia = h[0], h[1], h[2], h[3]
        g = so(gia)
        if g is None:
            if re.fullmatch(r'\d+', stt) and stt == '3' and ten.startswith('Nuôi quảng canh') and loai == 'Tôm thẻ chân trắng':
                cach = ten   # van ban danh so '3' nhung thuc chat la muc 1.3 cua tom the
                continue
            if re.fullmatch(r'\d+', stt):
                loai, cach, stt_loai = ten, '', stt
            elif re.fullmatch(r'\d+\.\d+', stt):
                cach = ten
            else:
                raise SystemExit('hang la PL IV: %r' % h)
            continue
        gc = ''
        if loai == 'Tôm thẻ chân trắng' and cach.startswith('Nuôi quảng canh'):
            gc = 'Văn bản đánh số mục này là "3" (nằm giữa 1.2 và mục 2 "Tôm sú") — thực chất là 1.3 của tôm thẻ chân trắng'
        ra.append({'nhom': 'Vật nuôi là thủy sản', 'ten': loai, 'phanLoai': (cach + ' – ' if cach else '') + ten,
                   'dv': dv, 'gia': g, 'ghiChu': gc, 'pl': 'IV',
                   'bang': 'Bảng đơn giá bồi thường đối với vật nuôi là thủy sản', 'stt': stt_loai, 'giaGoc': gia})

    io.open(out, 'w', encoding='utf-8', newline='\n').write(json.dumps(ra, ensure_ascii=False, indent=1) + '\n')

    # ---------- BANG 2: mat do (khong phai gia) -> file rieng ----------
    md = []
    for h in matdo[2:]:
        h = [gon(x) for x in h]
        md.append({'stt': h[0], 'ten': h[1], 'dv': h[2], 'matDoTuHat': so(h[3]), 'matDoChietGhep': so(h[4]),
                   'ghiChu': 'Mật độ cây, bụi/ha (Bảng 2 Phụ lục II QĐ 35/2026)'})
    io.open(out_md, 'w', encoding='utf-8', newline='\n').write(json.dumps(md, ensure_ascii=False, indent=1) + '\n')

    import collections
    c = collections.Counter(x['pl'] for x in ra)
    print('Tong', len(ra), 'dong; theo phu luc', dict(c), '; gia null:', sum(1 for x in ra if x['gia'] is None))
    print('So loai/ten:', {pl: len({x['ten'] for x in ra if x['pl'] == pl}) for pl in c})
    print('Mat do:', len(md), 'dong')


if __name__ == '__main__':
    main(*sys.argv[1:])
