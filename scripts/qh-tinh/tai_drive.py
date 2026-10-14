# -*- coding: utf-8 -*-
# TẢI MỘT THƯ MỤC GOOGLE DRIVE CÔNG KHAI do VĂN BẢN NHÀ NƯỚC dẫn tới (vd thông báo công bố quy hoạch ghi "đường dẫn tải hồ sơ:
# drive.google.com/drive/folders/…"). Chủ dự án đồng ý 14/10/2026: file nhà nước để trên Drive thì được tải. 14/10/2026 khuya.
# Liệt kê ĐỆ QUY qua trang embeddedfolderview (không cần đăng nhập / khoá API), tải từng file, giữ cây thư mục; file đã có đủ thì bỏ qua.
# Kiểm: chữ ký đầu file (PDF / ảnh / nén / DWG / DGN) — Drive trả trang HTML (hết lượt, file riêng tư…) thì báo lỗi, không lưu nhầm.
# Dùng: python -P tai_drive.py <id thư mục> <thư mục lưu> [--chi-liet-ke]
import re, os, sys, json, html, time, urllib.request
sys.stdout.reconfigure(encoding='utf-8')
UA = {'User-Agent': 'Mozilla/5.0'}
co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
GOC_ID, RA = ts[0], ts[1]

def lay(url, nhi_phan=False):
    loi = None
    for lan in range(4):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600).read()
            return r if nhi_phan else r.decode('utf-8', 'replace')
        except Exception as e:
            loi = e; time.sleep(5 * (lan + 1))
    raise loi

def liet_ke(fid, duong=''):
    s = lay('https://drive.google.com/embeddedfolderview?id=' + fid)
    ra = []
    for m in re.finditer(r'<div class="flip-entry" id="entry-([^"]+)".*?<a href="([^"]+)".*?<div class="flip-entry-title">(.*?)</div>', s, re.S):
        id_, href, ten = m.group(1), html.unescape(m.group(2)), html.unescape(m.group(3)).strip()
        if '/folders/' in href: ra += liet_ke(id_, duong + ten + '/')
        else: ra.append({'id': id_, 'ten': ten, 'duong': duong + ten})
        time.sleep(0.5)
    return ra

CHU_KY = [b'%PDF', b'\xff\xd8\xff', b'\x89PNG', b'PK\x03\x04', b'Rar!', b'AC10', b'\xd0\xcf\x11\xe0', b'7z\xbc\xaf', b'II*\x00', b'MM\x00*']
def hop_le(b):
    return any(b.startswith(k) for k in CHU_KY) or (len(b) > 4 and b[:2] in (b'\x08\x09', b'\xc8\x09'))   # DGN V7 / V8 hay bắt đầu kiểu này

ds = liet_ke(GOC_ID)
os.makedirs(RA, exist_ok=True)
json.dump(ds, open(os.path.join(RA, '_danh-sach-drive.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(ds)} file trong thu muc Drive {GOC_ID}')
for f in ds: print('   ', f['duong'])
if '--chi-liet-ke' in co: sys.exit()
tong = 0
for f in ds:
    dich = os.path.join(RA, *[re.sub(r'[<>:"\\|?*]', '_', p) for p in f['duong'].split('/')])
    os.makedirs(os.path.dirname(dich), exist_ok=True)
    if os.path.exists(dich) and os.path.getsize(dich) > 0: print('  da co:', f['duong']); continue
    b = lay(f"https://drive.usercontent.google.com/download?id={f['id']}&export=download&confirm=t", nhi_phan=True)
    if not hop_le(b[:8]):
        print(f"  LOI (khong phai file tai lieu, {len(b)} byte, dau: {b[:40]!r}): {f['duong']}"); continue
    open(dich, 'wb').write(b); tong += len(b)
    print(f"  tai: {f['duong']} ({len(b) / 1048576:.1f} MB)", flush=True)
    time.sleep(1)
print(f'XONG, tai them {tong / 1048576:.1f} MB -> {RA}')
