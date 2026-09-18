# -*- coding: utf-8 -*-
"""
DỰNG LƯỢC ĐỒ VĂN BẢN — học cách Thư viện pháp luật bày, nhưng tính bằng máy từ chính chữ
của văn bản chứ không chép của ai.

Trước đây chỉ có MỘT loại quan hệ: "văn bản này nhắc tới văn bản kia" (đọc trong thân bài).
Thiếu ba loại quan trọng mà người tra luật cần nhất:

  1. CĂN CỨ BAN HÀNH — nằm ở phần mở đầu: "Căn cứ Luật Đất đai ngày 18 tháng 01 năm 2024;".
     Đây là quan hệ CHẮC CHẮN NHẤT: nghị định này sinh ra từ luật nào. Phần mở đầu bị bộ
     tách bỏ đi (vì nó nằm trước Điều 1) nên phải đọc lại từ tệp chữ gốc.
  2. THAY THẾ / BỊ THAY THẾ — nằm ở điều "Hiệu lực thi hành": "Luật này thay thế Luật Đất đai
     số 45/2013/QH13". Nhờ nó mà biết tra hồ sơ cũ thì phải lùi về văn bản nào.
  3. ĐƯỢC HƯỚNG DẪN BỞI — tính ngược: nghị định nào, thông tư nào dựa trên văn bản này.

Chạy:  python dung-luoc-do.py <thu-muc-json> <thu-muc-txt>
"""
import sys, os, re, json, glob

# "Luật Đất đai ngày 18 tháng 01 năm 2024" — luật thì hay gọi bằng NGÀY chứ không bằng số hiệu.
RE_CAN_CU = re.compile(r'Căn cứ\s+([^;]{5,200});')
RE_SO_HIEU = re.compile(r'(\d{1,4}/\d{4}/[A-ZĐ][A-ZĐ0-9\-]*)')
RE_NGAY_TRONG_CAU = re.compile(r'ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})')
# Chỗ nói về hết hiệu lực / thay thế. Sau cụm này là DANH SÁCH, ngăn nhau bằng dấu chấm phẩy.
RE_HET = re.compile(r'(?:hết hiệu lực|thay thế)([^.]{0,1200})', re.I)
# Mục trong danh sách bắt đầu bằng "Khoản/Điều/Điểm/Chương/Mục" => chỉ bãi bỏ MỘT PHẦN,
# tuyệt đối không được ghi thành "thay thế cả văn bản". Nghị định 151/2025 chỉ bãi bỏ
# "khoản 1 và khoản 2 Điều 22 Nghị định 71/2024" — ghi nhầm thành thay thế là sai nặng.
RE_CA_VAN_BAN = re.compile(r'^\s*(Nghị định|Luật|Thông tư|Quyết định|Nghị quyết|Pháp lệnh)\b')


def tim_vb(cum, theo_so, theo_ngay):
    """Từ một cụm chữ, tìm ra mã văn bản trong kho: ưu tiên số hiệu, không có thì tra theo ngày."""
    ra = []
    for so in RE_SO_HIEU.findall(cum):
        if so in theo_so:
            ra.append(theo_so[so])
    if not ra and 'Luật Đất đai' in cum:
        for m in RE_NGAY_TRONG_CAU.finditer(cum):
            ng = '%04d-%02d-%02d' % (int(m.group(3)), int(m.group(2)), int(m.group(1)))
            if ng in theo_ngay:
                ra.append(theo_ngay[ng])
    return ra


def lam(thu_muc_json, thu_muc_txt):
    kho = json.load(open(os.path.join(thu_muc_json, '_kho.json'), encoding='utf-8'))
    theo_so = {x['soHieu']: x['ma'] for x in kho}
    theo_ngay = {x['ngay']: x['ma'] for x in kho if x['ma'].startswith('ldd')}
    goc = {x['ma']: x for x in kho}

    # tên tệp chữ gốc của từng văn bản (để đọc lại phần mở đầu)
    tep = {}
    for f in glob.glob(os.path.join(thu_muc_txt, '*_p1.txt')):
        tep[os.path.basename(f)[:-7]] = f

    BANG = {'nd': 'NĐ-CP', 'tt': 'TT'}
    for x in kho:
        x['canCu'] = []
        x['thayThe'] = []
        x['baiBoMotPhan'] = []

    for x in kho:
        # --- 1. CĂN CỨ BAN HÀNH (đọc phần mở đầu của tệp chữ gốc) ---
        ten_tep = None
        for k, v in tep.items():
            if k == x['ma'] or k.replace('-', '/').upper().startswith(x['soHieu'].split('/')[0]):
                pass
        # khớp theo số hiệu nằm trong tên tệp (vd '88-2024-N-CP_p1.txt' <-> '88/2024/NĐ-CP')
        can = re.sub(r'[^0-9A-Za-z]+', '-', x['soHieu']).strip('-').lower()
        for k, v in tep.items():
            if re.sub(r'[^0-9a-z]+', '-', k.lower()).strip('-') == can or k == x['ma']:
                ten_tep = v
                break
        if ten_tep:
            dau = open(ten_tep, encoding='utf-8').read()[:6000].replace('\n', ' ')
            for m in RE_CAN_CU.finditer(dau):
                for ma2 in tim_vb(m.group(1), theo_so, theo_ngay):
                    if ma2 != x['ma'] and ma2 not in x['canCu']:
                        x['canCu'].append(ma2)

        # --- 2. THAY THẾ / BÃI BỎ (đọc điều "Hiệu lực thi hành") ---
        p = os.path.join(thu_muc_json, x['ma'] + '.json')
        if os.path.exists(p):
            vb = json.load(open(p, encoding='utf-8'))
            for d in vb['dieu']:
                if 'hiệu lực' not in (d['tieuDe'] or '').lower() and d['tieuDe']:
                    continue
                chu = ' '.join(k['chu'] + ' ' + ' '.join(y['chu'] for y in k['diem']) for k in d['khoan'])
                # Câu đặt số hiệu TRƯỚC cụm từ khoá: "Luật Đất đai số 45/2013/QH13 … hết hiệu
                # lực kể từ ngày Luật này có hiệu lực thi hành." Quét theo CÂU mới bắt được.
                for cau in re.split(r'(?<=[.])\s+', chu):
                    if not re.search(r'hết hiệu lực|thay thế', cau, re.I):
                        continue
                    if not RE_CA_VAN_BAN.match(cau.strip()):
                        continue
                    for ma2 in tim_vb(cau, theo_so, theo_ngay):
                        if ma2 != x['ma'] and ma2 not in x['thayThe']:
                            x['thayThe'].append(ma2)
                for m in RE_HET.finditer(chu):
                    for muc in m.group(1).split(';'):
                        muc = muc.strip(' :,')
                        if not muc:
                            continue
                        ds = tim_vb(muc, theo_so, theo_ngay)
                        for ma2 in ds:
                            if ma2 == x['ma']:
                                continue
                            if not RE_CA_VAN_BAN.match(muc):
                                ghi = {'ma': ma2, 'phan': re.sub(r'\s+', ' ', muc)[:120]}
                                if ghi not in x['baiBoMotPhan']:
                                    x['baiBoMotPhan'].append(ghi)
                            elif ma2 not in x['thayThe']:
                                x['thayThe'].append(ma2)

    # --- 3. tính ngược ---
    for x in kho:
        x['laCanCuCho'] = sorted({y['ma'] for y in kho if x['ma'] in y['canCu']})
        x['biThayTheBoi'] = sorted({y['ma'] for y in kho if x['ma'] in y['thayThe']})
        x['biBaiBoMotPhanBoi'] = sorted({y['ma'] for y in kho
                                         if any(z['ma'] == x['ma'] for z in y['baiBoMotPhan'])})

    # Văn bản bị văn bản khác thay thế thì CHẮC CHẮN đã hết hiệu lực — tự gắn nhãn, đừng
    # để kho hiện "còn hiệu lực" cho một nghị định đã bị thay. (Đã vấp: Nghị định 42/2024 về
    # lấn biển bị Nghị định 102/2024 thay thế từ 01/8/2024 mà kho vẫn ghi còn hiệu lực.)
    ten = {x['ma']: x for x in kho}
    for x in kho:
        if x['biThayTheBoi'] and not x.get('hetHieuLuc'):
            boi = ', '.join(ten[m]['soHieu'] for m in x['biThayTheBoi'] if m in ten)
            x['hetHieuLuc'] = ('ĐÃ HẾT HIỆU LỰC — bị %s thay thế. Giữ lại để tra hồ sơ thuộc '
                               'thời kỳ trước đó.' % boi)

    json.dump(kho, open(os.path.join(thu_muc_json, '_kho.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    print('LUOC DO VAN BAN:')
    for x in kho:
        if x['canCu'] or x['thayThe'] or x['laCanCuCho']:
            sys.stdout.buffer.write(('  %-16s can cu: %-24s thay the: %-20s la can cu cho: %d van ban\n' % (
                x['soHieu'], ','.join(x['canCu']) or '-', ','.join(x['thayThe']) or '-',
                len(x['laCanCuCho']))).encode('utf-8', 'replace'))


if __name__ == '__main__':
    lam(sys.argv[1], sys.argv[2])
