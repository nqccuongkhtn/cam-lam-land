# -*- coding: utf-8 -*-
# CHẠY NHIỀU VIỆC CẮT Ô (tiler3.py) SONG SONG, ưu tiên THẤP hơn web (máy chủ web chạy trên cùng máy) — 14/10/2026.
# Mỗi dòng việc: pdf|lng|lat|ranh|ten_lop|zmin|zmax|phan   (ranh = tên sau "ranh-" trong thư mục ranh)
# Dùng: python -P cat_nhieu.py <viec.txt> <thu_muc_pdf> <thu_muc_ranh> <thu_muc_ra> [--song-song=8]
import sys, os, subprocess, time
from concurrent.futures import ThreadPoolExecutor
sys.stdout.reconfigure(encoding='utf-8')
co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
viec_p, pdf_d, ranh_d, ra_d = ts[:4]
SS = int(next((a.split('=', 1)[1] for a in co if a.startswith('--song-song=')), 8))
TILER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tiler3.py')
viec = [l.strip().split('|') for l in open(viec_p, encoding='utf-8') if l.strip() and not l.startswith('#')]
t0 = time.time()
def chay(v):
    pdf, lng, lat, ranh, ten, z0, z1, phan = v
    log = os.path.join(ra_d, f'log-{ten}-z{z0}-{z1}-{phan.replace("/", "of")}.txt')
    cmd = [sys.executable, '-X', 'utf8', '-P', TILER, os.path.join(pdf_d, pdf), lng, lat, os.path.join(ranh_d, f'ranh-{ranh}.json'), ra_d, ten,
           z0, z1, '--dinh=webp', '--cl=90', f'--phan={phan}', '--bo-qua-co']
    with open(log, 'w', encoding='utf-8') as f:
        r = subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, creationflags=0x00004000)   # BELOW_NORMAL
    cuoi = open(log, encoding='utf-8').read().strip().splitlines()[-1:] or ['(rong)']
    print(f'[{time.time() - t0:5.0f}s] {ten} z{z0}-{z1} phan {phan}: ma thoat {r.returncode} | {cuoi[0][:90]}', flush=True)
    return r.returncode
with ThreadPoolExecutor(SS) as ex: kq = list(ex.map(chay, viec))
print(f'XONG {len(viec)} viec, {sum(1 for k in kq if k)} viec loi, {time.time() - t0:.0f}s')
