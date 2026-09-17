# -*- coding: utf-8 -*-
# THƯỚC ĐO ĐỘ CHÍNH XÁC khi máy đọc bảng trong PDF ra Excel.
#
# Dùng để làm gì: mỗi lần sửa phần đọc bảng (apps/backend/src/routes/pdftools.ts) thì chạy cái này
# để biết sửa xong TỐT LÊN hay TỆ ĐI, thay vì nhìn bằng mắt rồi đoán.
#
# Lấy gì làm chuẩn: bảng giá 46 dòng đã gõ tay trong apps/frontend/src/lib/denBuCamLam.ts
# (chủ dự án đã đối chiếu 2 nguồn: chữ trong PDF và ảnh chụp từng trang).
# Đem so với kết quả máy đọc từ chính tệp PDF gốc TB-306 (bản quét, chữ bị lỗi phông — ca khó nhất).
#
# Chạy (máy chủ phải đang chạy ở http://127.0.0.1):
#     cd "D:/Cam Lam gis"
#     python scripts/pdf/cham-diem-doc-bang.py 4-7
#
# Hai cách đo:
#   1. "dung het 4 so"  — ghép dòng theo tên thôn rồi so cả 4 con số. Khắt khe, tên bị đọc lệch là trượt.
#   2. "theo BO SO"     — chỉ hỏi bảng có đủ các dòng số đúng không. Sát với việc dùng thật hơn.
#
# Mốc đã đo (17/9/2026, bản cuối): cách 1 = 86,8% · cách 2 = 100,0% (53/53 dòng).
# Tức là MỌI dòng giá đều ra đúng cả 4 con số. Phần thiếu ở cách 1 chỉ là TÊN THÔN bị đọc lỗi
# chính tả ("jhôn", "I3") nên bộ chấm ghép hụt, không phải sai số tiền.
#
# Đường đi của điểm số (để sau này biết cái nào đáng giá):
#   28,3% -> dựng hàng theo dòng pdftotext cắt sẵn thay vì tự gom từng chữ
#   43,4% -> cho các hàng bỏ phiếu ranh giới cột
#   71,7% -> bỏ cột rỗng theo tỉ lệ, sửa lỗi nhìn nhầm chữ số
#   88,7% -> DÒ CHÍNH NÉT KẺ KHUNG trên ảnh (tools/luoi-bang.py) thay cho mọi cách đoán
#   92,5% -> soi lại cả cột, ô nào lệch khuôn thì CẮT RIÊNG ĐỌC LẠI (tools/doc-lai-o.py)
#   96,2% -> tách ô bị gộp do sót nét kẻ dọc
#  100,0% -> xếp đúng thứ tự tin cậy khi chọn giữa bản đọc đầu và bản đọc lại


import io, re, sys, subprocess, unicodedata
from difflib import SequenceMatcher

TS = r'apps/frontend/src/lib/denBuCamLam.ts'
PDF = r'apps/frontend/public/tai-lieu/TB-306-gia-dat-boi-thuong-Cam-Lam-07-5-2026.pdf'
TRANG = sys.argv[1] if len(sys.argv) > 1 else ''

def kd(s):
    s = unicodedata.normalize('NFD', s.replace('đ', 'd').replace('Đ', 'D'))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '', s.lower())

# ---- 1. Bảng CHUẨN ----
src = io.open(TS, encoding='utf-8').read()
k1 = src[src.index('GIA_NONG_NGHIEP'):src.index('GIA_RUNG_SAN_XUAT')]
chuan = []
for m in re.finditer(r"\['([^']+)',\s*(\d+|null),\s*(\d+|null),\s*(\d+|null),\s*(\d+|null)\]", k1):
    so = [None if g == 'null' else int(g) for g in m.groups()[1:]]
    chuan.append((m.group(1), [x for x in so if x is not None]))
k2 = src[src.index('GIA_RUNG_SAN_XUAT'):src.index('export type LoaiDat')]
rung = [(m.group(1), [int(m.group(2)), int(m.group(3))])
        for m in re.finditer(r"\['([^']+)',\s*(\d+),\s*(\d+)\]", k2)]

# ---- 2. Gọi máy chủ ----
url = 'http://127.0.0.1/api/pdftools/convert?to=csv&ocr=auto'
if TRANG: url += '&pages=' + TRANG
csv = subprocess.run(['curl', '-s', '-m', '280', '-4', '-F', 'file=@' + PDF, url],
                     capture_output=True).stdout.decode('utf-8-sig', 'replace')
dong = [d for d in csv.split('\r\n') if d.strip()]

def so_trong(s):
    # tách theo dấu phẩy/khoảng trắng rồi mới đọc số, để "581.293 415.209" ra HAI số chứ không dính làm một
    ra = []
    for tok in re.split(r'[,\s]+', s.replace('|', ' ')):
        t = tok.strip('.').strip()
        v = None
        if re.fullmatch(r'\d{1,3}(?:\.\d{3})+', t): v = int(t.replace('.', ''))
        elif re.fullmatch(r'\d{5,7}', t): v = int(t)
        if v is not None and v >= 50000: ra.append(v)
    return ra

# ---- 3. Ghép theo tên ----
def cham(bang, nhan):
    ket = {}
    for d in dong:
        so = so_trong(d)
        if len(so) < 2: continue
        m = re.search(r'\d{1,3}(?:\.\d{3})+|\d{5,7}', d)
        chu = kd(d[:m.start()] if m else d)
        if len(chu) < 6: continue
        tot, diem = None, 0.0
        for i, (ten, mong) in enumerate(bang):
            if len(so) != len(mong): continue   # bảng rừng chỉ 2 số, bảng nông nghiệp 4 số
            # so theo TẬP KÝ TỰ (đã sắp xếp) nên chữ trong ô bị đảo thứ tự vẫn ghép đúng dòng
            t = SequenceMatcher(None, ''.join(sorted(chu)), ''.join(sorted(kd(ten)))).ratio()
            if t > diem: tot, diem = i, t
        if tot is None or diem < 0.62: continue
        cu = ket.get(tot)
        if cu is None or diem > cu[0]: ket[tot] = (diem, so)
    dung = [i for i, (_, so) in ket.items() if so == bang[i][1]]
    print('')
    print('%s: ghep duoc %d/%d dong, DUNG SO %d  (%.1f%%)'
          % (nhan, len(ket), len(bang), len(dung), 100.0 * len(dung) / len(bang)))
    for i, (ten, mong) in enumerate(bang):
        if i in dung: continue
        got = ket.get(i)
        sys.stdout.buffer.write((u'  [%02d] %-44s mong %s\n        thuc %s\n'
            % (i + 1, ten[:44], mong, got[1] if got else 'KHONG TIM THAY DONG')).encode('utf-8', 'replace'))
    return len(dung), len(bang)

a, b = cham(chuan, 'DAT NONG NGHIEP')
c, d = cham(rung, 'DAT RUNG SAN XUAT')
print('')
print('=== TONG: %d/%d dong dung het 4 so  (%.1f%%) ===' % (a + c, b + d, 100.0 * (a + c) / (b + d)))

# ---- 4. Cách đo THỨ HAI: chỉ so BỘ SỐ của từng dòng, không cần ghép tên ----
# Trả lời đúng câu hỏi thực tế: "bảng tải về có đủ các dòng số đúng không".
from collections import Counter
def cham_bo_so(bang, nhan):
    mong = Counter(tuple(x[1]) for x in bang)
    thuc = Counter()
    for d in dong:
        s = so_trong(d)
        for n in (4, 2):
            if len(s) == n: thuc[tuple(s)] += 1
    trung = sum(min(v, thuc[k]) for k, v in mong.items())
    print('%s theo BO SO: %d/%d dong (%.1f%%)' % (nhan, trung, sum(mong.values()), 100.0 * trung / sum(mong.values())))
    return trung, sum(mong.values())
x1, y1 = cham_bo_so(chuan, 'DAT NONG NGHIEP')
x2, y2 = cham_bo_so(rung, 'DAT RUNG')
print('=== TONG theo BO SO: %d/%d (%.1f%%) ===' % (x1 + x2, y1 + y2, 100.0 * (x1 + x2) / (y1 + y2)))
