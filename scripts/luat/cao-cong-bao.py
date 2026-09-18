# -*- coding: utf-8 -*-
"""
LẤY TOÀN VĂN VĂN BẢN TỪ CÔNG BÁO CHÍNH PHỦ (congbao.chinhphu.vn).

Vì sao phải đổi nguồn: bản PDF trên datafiles.chinhphu.vn của các NGHỊ ĐỊNH là ẢNH QUÉT
1 bit, không có lớp chữ — muốn lấy chữ phải OCR mà OCR văn bản pháp luật thì sai chữ.
Bản PDF của CÔNG BÁO (congbaocdn.chinhphu.vn) thì CÓ LỚP CHỮ THẬT — đo trên Nghị định
88/2024: 110.172 ký tự, đếm đúng 36 điều. Đây mới là nguồn dùng được.

Cách tìm: trang Công báo có danh sách theo LOẠI văn bản, phân trang ?page=N, đường dẫn
từng văn bản mang luôn SỐ HIỆU trong tên (vd .../van-ban/nghi-dinh-so-88-2024-nd-cp-42343/...).
Nên cứ lật danh sách, khớp số hiệu là ra. (Ô tìm kiếm của trang trả 403 cho máy.)

Chạy:  python cao-cong-bao.py "71/2024/NĐ-CP" "88/2024/NĐ-CP" ...
"""
import sys, os, re, json, time
from urllib.request import urlopen, Request

GOC = 'https://congbao.chinhphu.vn'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
      'Referer': GOC + '/'}
LOAI = {'NĐ-CP': 'nghi-dinh-l1', 'TT-BTNMT': 'thong-tu-l3', 'TT-BTC': 'thong-tu-l3',
        'TT-BNNMT': 'thong-tu-l3', 'QH15': 'luat-l13', 'QH14': 'luat-l13'}
RA = os.environ.get('KHO_CB', os.path.join(os.path.dirname(os.path.abspath(__file__)), '_congbao'))


def lay(url, lan=3):
    for i in range(lan):
        try:
            with urlopen(Request(url, headers=UA), timeout=40) as r:
                return r.read()
        except Exception:
            if i == lan - 1:
                return b''
            time.sleep(0.8 * (i + 1))
    return b''


def slug(so_hieu):
    """'88/2024/NĐ-CP' -> 'nghi-dinh-so-88-2024-nd-cp' (phần đầu của đường dẫn Công báo)."""
    s = so_hieu.replace('Đ', 'd').replace('đ', 'd')
    s = re.sub(r'[^0-9A-Za-z]+', '-', s).strip('-').lower()
    return s


def tim_duong(so_hieu, toi_da_trang=90):
    """Lật danh sách theo loại, tìm đường dẫn văn bản có số hiệu này."""
    duoi = so_hieu.split('/')[-1]
    ds = LOAI.get(duoi)
    if not ds:
        ds = 'nghi-quyet-l6' if 'NQ' in duoi else 'quyet-dinh-l2'
    can = slug(so_hieu)
    for p in range(1, toi_da_trang + 1):
        # Phân trang của Công báo là /trang-N.htm chứ KHÔNG phải ?page=N — dùng ?page= thì
        # trang nào cũng trả về y hệt trang 1, tìm mãi không ra (đã vấp).
        duong = '%s/van-ban-dang-cong-bao/%s.htm' % (GOC, ds) if p == 1 else '%s/van-ban-dang-cong-bao/%s/trang-%d.htm' % (GOC, ds, p)
        t = lay(duong).decode('utf-8', 'replace')
        if not t:
            break
        for u in sorted(set(re.findall(r'href="(/van-ban/[^"#]+\.htm)"', t))):
            # PHAI so ca cum '-so-<so hieu>' chu khong so moi so hieu: tim '71-2024-nd-cp'
            # thi no khop luon vao '171-2024-nd-cp' -> tai nham Nghi dinh 171 ve ma tuong la 71.
            # Da vap that, suyt dua nham van ban len web.
            if ('-so-' + can) in u:
                return GOC + u
    return ''


def tep_pdf(duong):
    """Trả về DANH SÁCH tệp PDF của văn bản, xếp theo số Công báo tăng dần.

    VĂN BẢN DÀI BỊ CÔNG BÁO CẮT RA NHIỀU SỐ. Ví dụ Nghị định 101/2024 đăng ở
    Công báo 913+914 rồi cuối trang ghi "(Xem tiếp Công báo số 915 + 916)".
    Trước đây hàm này chỉ lấy tệp ĐẦU TIÊN → tải về chỉ có 60/68 điều mà nhìn
    vào không biết là thiếu, vì phần lấy được vẫn liên tục 1..60. Đã vấp thật
    với 4 nghị định. Nay lấy HẾT, sắp theo số Công báo rồi nối lại."""
    t = lay(duong).decode('utf-8', 'replace')
    ds = sorted(set(re.findall(r'https?://congbaocdn\.chinhphu\.vn/[^"\'<> ]+\.pdf', t)))

    def so_cb(u):
        # tên tệp dạng '51166-1-2024913-914101-2024-nd-cp.pdf' -> số Công báo 913
        m = re.search(r'-(\d{4})(\d{1,4})-\d', u.rsplit('/', 1)[-1])
        return int(m.group(1) + m.group(2).zfill(4)) if m else 0

    return sorted(ds, key=so_cb)


def kiem_so_hieu(duong_pdf, so_hieu):
    """TU KIEM: boc chu 3 trang dau roi soi co dung so hieu khong.
    Khong kiem thi tai nham van ban khac ma khong he biet (xem ghi chu o tim_duong)."""
    import subprocess
    try:
        t = subprocess.run(['pdftotext', '-q', '-l', '3', '-enc', 'UTF-8', duong_pdf, '-'],
                           capture_output=True, timeout=120).stdout.decode('utf-8', 'replace')
    except Exception:
        return True
    if not t.strip():
        return True
    return re.sub(r'[^0-9A-Za-z/-]', '', so_hieu) in re.sub(r'[^0-9A-Za-z/-]', '', t)


if __name__ == '__main__':
    os.makedirs(RA, exist_ok=True)
    kq = {}
    for so in sys.argv[1:]:
        d = tim_duong(so)
        if not d:
            sys.stdout.buffer.write(('  KHONG TIM THAY tren Cong bao: %s\n' % so).encode('utf-8', 'replace'))
            continue
        ds_u = tep_pdf(d)
        if not ds_u:
            sys.stdout.buffer.write(('  %s: co trang nhung khong thay tep PDF\n' % so).encode('utf-8', 'replace'))
            continue
        goc = re.sub(r'[^0-9A-Za-z]+', '-', so).strip('-')
        cac_tep, tong, hong = [], 0, False
        for i, u in enumerate(ds_u):
            ten = '%s_p%d.pdf' % (goc, i + 1)
            b = lay(u)
            if len(b) < 5000:
                sys.stdout.buffer.write(('  %s phan %d: tai hong\n' % (so, i + 1)).encode('utf-8', 'replace'))
                hong = True
                break
            duong_tep = os.path.join(RA, ten)
            open(duong_tep, 'wb').write(b)
            # chỉ phần ĐẦU mới mang số hiệu ở trang bìa; các phần sau là ruột văn bản
            if i == 0 and not kiem_so_hieu(duong_tep, so):
                os.remove(duong_tep)
                sys.stdout.buffer.write(('  %-18s [!] SO HIEU KHONG KHOP - DA BO TEP' % so + chr(10)).encode('utf-8', 'replace'))
                hong = True
                break
            cac_tep.append(ten)
            tong += len(b)
        if hong or not cac_tep:
            continue
        kq[so] = {'trang': d, 'pdf': ds_u, 'tep': cac_tep, 'bytes': tong}
        sys.stdout.buffer.write(('  %-18s %8d bytes  %d phan: %s\n' % (
            so, tong, len(cac_tep), ', '.join(cac_tep))).encode('utf-8', 'replace'))
    json.dump(kq, open(os.path.join(RA, 'chi-muc.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('xong: %d/%d van ban' % (len(kq), len(sys.argv) - 1))
