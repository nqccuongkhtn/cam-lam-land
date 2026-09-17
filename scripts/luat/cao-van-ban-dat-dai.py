# -*- coding: utf-8 -*-
"""
CÀO TOÀN BỘ VĂN BẢN VỀ ĐẤT ĐAI TỪ HỆ THỐNG VĂN BẢN CỦA CHÍNH PHỦ.

Nguồn: vanban.chinhphu.vn — hệ thống văn bản CHÍNH THỨC của Chính phủ, mỗi văn bản có
bản PDF ký số gốc đặt trên datafiles.chinhphu.vn. Đây là nguồn đáng tin nhất tải được:
thuvienphapluat chặn máy, vbpl.vn chạy bằng JavaScript nên cào không ra.

Cách làm: mã văn bản (docid) chạy TUẦN TỰ theo ngày đăng, nên quét CẢ DẢI thay vì tìm kiếm
(tìm kiếm của trang là ASP.NET có VIEWSTATE, cào rất mệt mà vẫn sót). Quét cả dải thì
KHÔNG BỎ SÓT văn bản nào — đúng yêu cầu "cào hết".

  · Bước 1: quét từng docid, lấy TIÊU ĐỀ + link tệp PDF. Ghi vào kho-van-ban.jsonl (chạy lại
    được, đã quét rồi thì bỏ qua).
  · Bước 2: lọc văn bản LIÊN QUAN ĐẤT ĐAI theo từ khoá.
  · Bước 3: tải PDF gốc của những văn bản đã lọc.

Chạy (trong container backend vì cần pdftotext ở bước sau):
    python3 cao-van-ban-dat-dai.py quet 205000 219700
    python3 cao-van-ban-dat-dai.py loc
    python3 cao-van-ban-dat-dai.py tai
"""
import sys, os, re, json, html, time
from urllib.request import urlopen, Request
from urllib.error import URLError
from concurrent.futures import ThreadPoolExecutor

KHO = os.environ.get('KHO_LUAT', '/tmp/kholuat')
CHI_MUC = os.path.join(KHO, 'kho-van-ban.jsonl')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'}

# Từ khoá nhận ra văn bản về đất đai. Để RỘNG rồi lọc tay còn hơn để hẹp mà sót.
TU_KHOA = re.compile(
    r'đất đai|quyền sử dụng đất|sử dụng đất|thu hồi đất|giá đất|bồi thường.{0,20}tái định cư'
    r'|địa chính|giấy chứng nhận quyền sử dụng|quy hoạch sử dụng đất|tiền sử dụng đất'
    r'|tiền thuê đất|đất trồng lúa|đất lâm nghiệp|đất nông nghiệp|giao đất|cho thuê đất'
    r'|chuyển mục đích sử dụng đất|đăng ký đất|quỹ phát triển đất|đấu giá quyền sử dụng'
    r'|lấn biển|đất ở|thống kê, kiểm kê đất', re.I)


def lay(url, lan=3):
    for i in range(lan):
        try:
            with urlopen(Request(url, headers=UA), timeout=30) as r:
                return r.read().decode('utf-8', 'replace')
        except (URLError, OSError, Exception):
            if i == lan - 1:
                return ''
            time.sleep(0.6 * (i + 1))
    return ''


def doc_trang(docid):
    t = lay('https://vanban.chinhphu.vn/?pageid=27160&docid=%d' % docid)
    if not t:
        return None
    m = re.search(r'<title>\s*([^<]{0,300})', t)
    ten = html.unescape(m.group(1)).strip() if m else ''
    if not ten or 'Trang ch' in ten[:12]:
        return None
    tep = sorted(set(re.findall(r'https?://datafiles\.chinhphu\.vn/[^"\'<> ]+\.(?:pdf|doc|docx)', t)))
    ngay = ''
    m2 = re.search(r'Ngày ban hành[^<]*<[^>]*>\s*([\d/\.-]{8,12})', t)
    if m2:
        ngay = m2.group(1)
    return {'docid': docid, 'ten': ten, 'ngay': ngay, 'tep': tep}


def quet(tu, den):
    os.makedirs(KHO, exist_ok=True)
    da = set()
    if os.path.exists(CHI_MUC):
        for d in open(CHI_MUC, encoding='utf-8'):
            try:
                da.add(json.loads(d)['docid'])
            except Exception:
                pass
    can = [i for i in range(tu, den) if i not in da]
    print('da co %d, con phai quet %d' % (len(da), len(can)))
    f = open(CHI_MUC, 'a', encoding='utf-8')
    n = 0
    with ThreadPoolExecutor(max_workers=10) as ex:
        for kq in ex.map(doc_trang, can):
            n += 1
            if kq:
                f.write(json.dumps(kq, ensure_ascii=False) + '\n')
            if n % 500 == 0:
                f.flush()
                print('  ...%d/%d' % (n, len(can)), flush=True)
    f.close()
    print('quet xong')


def doc_kho():
    ra = []
    if os.path.exists(CHI_MUC):
        for d in open(CHI_MUC, encoding='utf-8'):
            try:
                ra.append(json.loads(d))
            except Exception:
                pass
    return ra


def loc():
    ds = [x for x in doc_kho() if TU_KHOA.search(x['ten'])]
    ds.sort(key=lambda x: x['docid'])
    with open(os.path.join(KHO, 'dat-dai.json'), 'w', encoding='utf-8') as f:
        json.dump(ds, f, ensure_ascii=False, indent=1)
    print('tim duoc %d van ban ve dat dai (trong %d van ban da quet)' % (len(ds), len(doc_kho())))
    for x in ds[:40]:
        sys.stdout.buffer.write(('   %d %s\n' % (x['docid'], x['ten'][:96])).encode('utf-8', 'replace'))


def tai():
    ds = json.load(open(os.path.join(KHO, 'dat-dai.json'), encoding='utf-8'))
    d = os.path.join(KHO, 'pdf')
    os.makedirs(d, exist_ok=True)
    def mot(x):
        if not x['tep']:
            return 0
        n = 0
        for i, u in enumerate(x['tep']):
            ra = os.path.join(d, '%d_%d%s' % (x['docid'], i, os.path.splitext(u)[1]))
            if os.path.exists(ra) and os.path.getsize(ra) > 1000:
                n += 1
                continue
            try:
                with urlopen(Request(u, headers=UA), timeout=120) as r, open(ra, 'wb') as f:
                    f.write(r.read())
                n += 1
            except Exception:
                pass
        return n
    with ThreadPoolExecutor(max_workers=6) as ex:
        tong = sum(ex.map(mot, ds))
    print('tai duoc %d tep' % tong)


if __name__ == '__main__':
    lenh = sys.argv[1] if len(sys.argv) > 1 else 'quet'
    if lenh == 'quet':
        quet(int(sys.argv[2]), int(sys.argv[3]))
    elif lenh == 'loc':
        loc()
    elif lenh == 'tai':
        tai()
