# -*- coding: utf-8 -*-
"""
LẤY TOÀN VĂN VĂN BẢN TỪ TRANG HTML CỦA CỔNG CHÍNH PHỦ (xaydungchinhsach.chinhphu.vn).

Dùng cho những văn bản KHÔNG CÓ trên Công báo hoặc bản Công báo bị cụt. Ví dụ:
Nghị định 112/2024/NĐ-CP về đất trồng lúa — Công báo không đăng (có 111, có 113,
nhảy qua 112), bản PDF trên datafiles.chinhphu.vn là ẢNH QUÉT (bóc ra đúng 205 ký tự).

⚠️ KHÔNG ĐƯỢC TIN HTML MỘT MÌNH. Đã đo: bản HTML toàn văn của cổng Chính phủ với
Luật Đất đai 2024 THIẾU HẲN 3 điều (67, 110, 119) mà không báo gì. Nên bắt buộc phải
đối chiếu với bản PDF ký số — ảnh quét thì OCR ra rồi soi (xem doi-chieu-ocr.py).

Trang nén gzip dù không xin, nên phải tự giải nén.

Chạy:  python lay-toan-van-html.py <url> <ra.txt>
"""
import sys, re, gzip, html as _html
from urllib.request import urlopen, Request

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'}
# Dòng mở đầu phần văn bản thật (bỏ hết menu, tin liên quan phía trên)
BAT_DAU = re.compile(r'(CHÍNH PHỦ|BỘ [A-ZĐÀ-Ỹ ]+)\s*$|^NGHỊ ĐỊNH$|^THÔNG TƯ$')
# Khối chữ ký -> hết văn bản
KET = re.compile(r'^(TM\. CHÍNH PHỦ|KT\. BỘ TRƯỞNG|Nơi nhận\s*:)')


def tai(url):
    b = urlopen(Request(url, headers=UA), timeout=90).read()
    if b[:2] == b'\x1f\x8b':                      # trang trả gzip dù không xin
        b = gzip.decompress(b)
    return b.decode('utf-8', 'replace')


def ra_dong(t):
    """Đổi HTML thành từng dòng chữ, giữ nguyên chữ, chỉ bỏ thẻ."""
    t = re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>', ' ', t)
    # mỗi thẻ khối là một dòng mới
    t = re.sub(r'(?i)</?(p|div|h[1-6]|br|li|tr|table)[^>]*>', '\n', t)
    t = re.sub(r'(?s)<[^>]+>', '', t)
    t = _html.unescape(t)
    t = t.replace(' ', ' ').replace('​', '')
    dong = [re.sub(r'[ \t]+', ' ', d).strip() for d in t.split('\n')]
    return [d for d in dong if d]


def cat_than(dong):
    """Cắt lấy đúng phần văn bản: từ chỗ bắt đầu tới khối chữ ký."""
    d1 = next((i for i, d in enumerate(dong) if BAT_DAU.search(d)), None)
    if d1 is None:
        d1 = 0
    d2 = next((i for i, d in enumerate(dong) if i > d1 and KET.match(d)), len(dong))
    return dong[d1:d2]


if __name__ == '__main__':
    url, ra = sys.argv[1], sys.argv[2]
    dong = cat_than(ra_dong(tai(url)))
    open(ra, 'w', encoding='utf-8', newline='\n').write('\n'.join(dong) + '\n')
    ds = [int(m.group(1)) for d in dong for m in [re.match(r'^Điều\s+(\d{1,3})\s*\.', d)] if m]
    sys.stdout.buffer.write(('%s: %d dong, %d dieu (1..%d)\n' % (
        ra, len(dong), len(ds), max(ds) if ds else 0)).encode('utf-8', 'replace'))
    thieu = [i for i in range(1, (max(ds) if ds else 0) + 1) if i not in set(ds)]
    if thieu:
        print('  [!] THIEU dieu:', thieu[:20])
