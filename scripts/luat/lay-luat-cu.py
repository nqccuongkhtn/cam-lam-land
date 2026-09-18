# -*- coding: utf-8 -*-
"""
LẤY TOÀN VĂN LUẬT ĐẤT ĐAI CÁC ĐỜI CŨ (1993, 2003) — thứ Công báo KHÔNG có.

Vì sao phải đi đường khác: kho Công báo điện tử chỉ lùi được tới khoảng năm 2010
(đã đo: trang 40 của danh sách luật đã là năm 2010 rồi lặp lại). Luật Đất đai 2013
còn tìm được, nhưng 2003 và 1993 thì không có ở đó.

Vì sao vẫn cần: hồ sơ cũ phải áp luật của ĐÚNG THỜI ĐIỂM đó. Đất dùng từ 1995 mà
xét theo Luật 2024 là sai; mốc 15/10/1993 và 01/7/2004 trong Luật 2024 chính là ngày
hai đạo luật kia có hiệu lực.

⚠️ NGUỒN KHÔNG PHẢI CÔNG BÁO THÌ PHẢI ĐỐI CHIẾU CHÉO. Đây là trang tư nhân tổng hợp,
không phải bản gốc ký số. Nên lấy ở HAI nơi độc lập rồi so tiêu đề từng điều với nhau;
lệch một điều cũng không đưa lên web. Số điều mong đợi cũng khai sẵn để tự kiểm.

Chạy:  python lay-luat-cu.py <url> <ra.txt> [so-dieu-mong-doi]
"""
import sys, re, gzip, html as _html
from urllib.request import urlopen, Request

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8'}


def tai(url, lan=4):
    """Thiếu Referer là trang trả 403 — đã vấp. Hỏng thì nghỉ rồi thử lại."""
    import time
    h = dict(UA)
    h['Referer'] = 'https://' + url.split('/')[2] + '/'
    for i in range(lan):
        try:
            b = urlopen(Request(url, headers=h), timeout=90).read()
            if b[:2] == b'\x1f\x8b':               # trang trả gzip dù không xin
                b = gzip.decompress(b)
            return b.decode('utf-8', 'replace')
        except Exception as e:
            if i == lan - 1:
                raise
            time.sleep(3.0 * (i + 1))
    return ''


def ra_dong(t):
    """Đổi HTML thành từng dòng chữ. Giữ nguyên chữ, chỉ bỏ thẻ và gộp khoảng trắng.

    Chú ý: trang này xuống dòng CỨNG ngay giữa câu, thậm chí giữa từ ("Điều 1. Phạm\\n\\nvi
    điều chỉnh"), nên phải gộp khoảng trắng TRONG từng thẻ <p> trước khi cắt dòng."""
    # chỉ lấy phần thân văn bản
    i = t.find('id="divContentDoc"')
    if i > 0:
        t = t[i:]
    t = re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>', ' ', t)
    doan = re.split(r'(?i)</p>|<br\s*/?>', t)
    ra = []
    for d in doan:
        d = _html.unescape(re.sub(r'(?s)<[^>]+>', '', d))
        d = d.replace(' ', ' ').replace('​', '')
        d = re.sub(r'\s+', ' ', d).strip()
        if d:
            ra.append(d)
    return ra


# Đuôi trang: nút bấm, quảng cáo, rồi bản tiếng Anh. Mấy thứ này DÍNH LIỀN vào cuối câu
# của điều cuối cùng (không xuống dòng riêng) nên phải cắt GIỮA DÒNG, không chỉ bỏ cả dòng.
RAC_DUOI = re.compile(r'(Lưu trữ Ghi chú|MỤC LỤC VĂN BẢN|THE NATIONAL ASSE'
                      r'|Hãy đăng nhập|Bạn Chưa Đăng Nhập|Văn bản này chưa)')


def cat_than(dong):
    """Lấy từ chỗ mở đầu văn bản tới hết điều cuối, bỏ sạch phần đuôi của trang web."""
    d1 = next((i for i, d in enumerate(dong)
               if re.match(r'^(Chương\s+([IVXLC]+|\d+)\s*:?\s*$|Điều\s+1\s*\.?\s*$)', d)), 0)
    # Giữ lại phần đầu ("Số: 24-L/CTN", "Hà Nội, ngày 14 tháng 7 năm 1993") vì bộ dựng kho
    # đọc số hiệu và ngày ban hành từ đó. Cắt thẳng vào Chương 1 là mất cả hai.
    dau = next((i for i, d in enumerate(dong[:40]) if re.match(r'^Số:\s*\S', d)), None)
    if dau is not None and dau < d1:
        d1 = dau
    ra = []
    for d in dong[d1:]:
        m = RAC_DUOI.search(d)
        if m:
            d = d[:m.start()].strip()
            if d:
                ra.append(d)
            break
        ra.append(d)
    return ra


if __name__ == '__main__':
    url, ra = sys.argv[1], sys.argv[2]
    mong = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    dong = cat_than(ra_dong(tai(url)))
    open(ra, 'w', encoding='utf-8', newline='\n').write('\n'.join(dong) + '\n')
    # Nhận cả lối mới "Điều 1." lẫn lối cũ "Điều 1" (không dấu chấm, không tiêu đề).
    ds = [int(m.group(1)) for d in dong
          for m in [re.match(r'^Điều\s+(\d{1,3})\s*(?:\.|$)', d)] if m]
    kh = sorted(set(ds))
    sys.stdout.buffer.write(('%s: %d dong, %d dieu khac nhau (1..%d)\n'
                             % (ra, len(dong), len(kh), max(kh) if kh else 0)).encode('utf-8', 'replace'))
    thieu = [i for i in range(1, (max(kh) if kh else 0) + 1) if i not in set(kh)]
    if thieu:
        print('  [!] THIEU dieu:', thieu[:20])
    if mong and len(kh) != mong:
        print('  [!] SO DIEU KHONG DUNG: lay duoc %d, mong doi %d' % (len(kh), mong))
    elif mong:
        print('  OK dung %d dieu nhu mong doi' % mong)
