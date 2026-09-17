# -*- coding: utf-8 -*-
"""
TÁCH TOÀN VĂN MỘT ĐẠO LUẬT / NGHỊ ĐỊNH THÀNH TỪNG ĐIỀU, TỪNG KHOẢN.

Đầu vào: tệp HTML toàn văn (lấy từ cổng Chính phủ) hoặc tệp .txt đã bóc chữ từ PDF ký số.
Đầu ra: JSON có cấu trúc Chương → Mục → Điều → Khoản, giữ NGUYÊN VĂN từng chữ.

⚠️ NGUYÊN TẮC: chỉ CẮT chữ, TUYỆT ĐỐI KHÔNG viết lại, không tóm tắt, không "sửa cho gọn".
Đây là văn bản pháp luật — sai một chữ là sai nghĩa. Phần giải thích cho dễ hiểu để RIÊNG
một trường khác, không trộn vào nguyên văn.

Có sẵn bước TỰ KIỂM: đếm số điều lấy ra được và soi xem có đứt quãng số điều không
(vd nhảy từ Điều 57 sang Điều 59 là biết bóc sót), in cảnh báo rõ ràng.
"""
import sys, os, re, json, html


def tu_html(duong):
    t = open(duong, encoding='utf-8', errors='replace').read()
    t = re.sub(r'<script.*?</script>', ' ', t, flags=re.S | re.I)
    t = re.sub(r'<style.*?</style>', ' ', t, flags=re.S | re.I)
    # Giữ ranh giới đoạn: thẻ khối -> xuống dòng, để còn tách khoản
    t = re.sub(r'<(?:br|/p|/div|/li|/h\d|/tr)[^>]*>', '\n', t, flags=re.I)
    t = re.sub(r'<[^>]+>', ' ', t)
    t = html.unescape(t)
    t = t.replace('\xa0', ' ')
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r'\n\s*\n+', '\n', t)
    return t


def tu_txt(duong):
    t = open(duong, encoding='utf-8', errors='replace').read()
    t = t.replace('\xa0', ' ')
    t = re.sub(r'[ \t]+', ' ', t)
    return t


# "Điều 12." hoặc "Điều 12 ." — bắt đầu một điều
RE_DIEU = re.compile(r'(?:^|\n|\s)Điều\s+(\d{1,3})\s*[\.\:]\s*', re.M)
RE_CHUONG = re.compile(r'(?:^|\n)\s*Chương\s+([IVXLC]+)\s*[\.\:]?\s*\n?\s*([^\n]{0,120})', re.M)
RE_MUC = re.compile(r'(?:^|\n)\s*Mục\s+(\d+)\s*[\.\:]?\s*\n?\s*([^\n]{0,120})', re.M)
# Khoản: "1." đầu dòng. Điểm: "a)" đầu dòng.
RE_KHOAN = re.compile(r'(?:^|\n)\s*(\d{1,2})\s*\.\s+')


def cat_khoan(than):
    """Cắt phần thân của một điều thành các khoản. Không có khoản thì trả về một cục."""
    vt = [(m.start(), m.group(1)) for m in RE_KHOAN.finditer(than)]
    # chỉ nhận nếu bắt đầu từ khoản 1 và số khoản tăng dần
    loc = []
    cho = 1
    for pos, so in vt:
        if int(so) == cho:
            loc.append((pos, int(so)))
            cho += 1
    if not loc:
        return [{'so': 0, 'chu': than.strip()}]
    ra = []
    dau = than[:loc[0][0]].strip()
    if dau:
        ra.append({'so': 0, 'chu': dau})
    for i, (pos, so) in enumerate(loc):
        het = loc[i + 1][0] if i + 1 < len(loc) else len(than)
        chu = than[pos:het].strip()
        chu = re.sub(r'^\d{1,2}\s*\.\s*', '', chu)
        ra.append({'so': so, 'chu': chu.strip()})
    return ra


def tach(van_ban_id, ten, so_hieu, ngay, duong):
    t = tu_html(duong) if duong.lower().endswith(('.htm', '.html')) else tu_txt(duong)
    moc_dieu = [(m.start(), m.end(), int(m.group(1))) for m in RE_DIEU.finditer(t)]
    # Bỏ những chỗ chỉ là TRÍCH DẪN ("theo quy định tại Điều 5 của Luật này") —
    # nhận ra vì ngay trước nó là chữ thường/dấu phẩy chứ không phải đầu dòng.
    that = []
    for a, b, so in moc_dieu:
        truoc = t[max(0, a - 40):a]
        if re.search(r'(tại|theo|của|và|,|;|\(|khoản)\s*$', truoc.strip()[-12:] if truoc.strip() else '', re.I):
            continue
        that.append((a, b, so))
    dieu = []
    for i, (a, b, so) in enumerate(that):
        het = that[i + 1][0] if i + 1 < len(that) else len(t)
        khoi = t[b:het].strip()
        dong = khoi.split('\n', 1)
        tieu_de = dong[0].strip()
        than = dong[1].strip() if len(dong) > 1 else ''
        dieu.append({'so': so, 'tieuDe': tieu_de, 'khoan': cat_khoan(than)})
    # Bỏ trùng: giữ lần xuất hiện có THÂN DÀI NHẤT cho mỗi số điều (mục lục đầu văn bản thân rỗng)
    tot = {}
    for d in dieu:
        dai = sum(len(k['chu']) for k in d['khoan'])
        if d['so'] not in tot or dai > tot[d['so']][0]:
            tot[d['so']] = (dai, d)
    dieu = [v[1] for k, v in sorted(tot.items())]
    return {'id': van_ban_id, 'ten': ten, 'soHieu': so_hieu, 'ngay': ngay, 'dieu': dieu}


def tu_kiem(vb):
    so = [d['so'] for d in vb['dieu']]
    print('  %s: lay duoc %d dieu (tu Dieu %d den Dieu %d)' % (vb['soHieu'], len(so), min(so) if so else 0, max(so) if so else 0))
    thieu = [i for i in range(1, (max(so) if so else 0) + 1) if i not in set(so)]
    if thieu:
        print('  [!] THIEU dieu:', thieu[:30], '...' if len(thieu) > 30 else '')
    rong = [d['so'] for d in vb['dieu'] if sum(len(k['chu']) for k in d['khoan']) < 30]
    if rong:
        print('  [!] dieu co than qua ngan (co the boc hut):', rong[:20])
    return not thieu


if __name__ == '__main__':
    duong, vid, so_hieu, ngay = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    ten = sys.argv[5] if len(sys.argv) > 5 else so_hieu
    ra = sys.argv[6] if len(sys.argv) > 6 else vid + '.json'
    vb = tach(vid, ten, so_hieu, ngay, duong)
    tu_kiem(vb)
    with open(ra, 'w', encoding='utf-8') as f:
        json.dump(vb, f, ensure_ascii=False)
    print('  -> ghi', ra, '(%d KB)' % (os.path.getsize(ra) // 1024))
