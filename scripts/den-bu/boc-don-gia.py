# -*- coding: utf-8 -*-
"""
BÓC BẢNG ĐƠN GIÁ BỒI THƯỜNG (QĐ 08/2026 và QĐ 12/2026 của UBND tỉnh Khánh Hòa) → JSON cho web.

Nguồn: BẢN WORD ĐĂNG TRÊN CÔNG BÁO TỈNH (chuẩn, không phải scan, không qua OCR):
    https://congbao.khanhhoa.gov.vn/Portals/0/FileVanBans/08_2026_Q%C4%90_UBND.doc
    https://congbao.khanhhoa.gov.vn/Portals/0/FileVanBans/12_2026_Q%C4%90_UBND.doc
    (bản 12/2026 chủ dự án gửi là file scan, tra trên mạng mới có bản Word — 16/9/2026)

Đổi .doc → .txt bằng LibreOffice trong container backend:
    docker cp qd12.doc camlam_backend:/tmp/ && docker exec camlam_backend sh -lc \
      'cd /tmp && soffice --headless --convert-to "txt:Text (encoded):UTF8" --outdir /tmp qd12.doc'

Bảng trong file Word xuất ra chữ theo kiểu MỖI Ô MỘT DÒNG, nên nhận ra hạng mục rất chắc:
ba dòng liên tiếp = [tên] + [đơn vị tính] + [số tiền]. Dòng chữ in hoa phía trên là NHÓM,
dòng "Kết cấu: …" là mô tả kết cấu, dòng ngắn khác là tên nhóm nhỏ.

Chạy:  python boc-don-gia.py <qd08.txt> <qd12.txt>
Ghi ra: apps/frontend/public/den-bu-nha-qd08.json · den-bu-chi-phi-qd12.json
"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RA_DIR = os.path.abspath(os.path.join(HERE, '..', '..', 'apps', 'frontend', 'public'))

DV = re.compile(r'^\s*(m2\s*XD|m2|m3|m dài|md|cái|bộ|trụ|cây|con|kg|tấn|ha|hầm|giếng|mộ|bể|cột|tấm|m|đồng|hộ|khẩu|người)\s*$', re.I)
GIA = re.compile(r'^\s*(\d{1,3}(?:\.\d{3})+)\s*$')
MA_PL = re.compile(r'^\s*Phụ lục\s+([IV]+)\s*$')


def boc(tep, bat_dau):
    L = [x.rstrip() for x in io.open(tep, encoding='utf-8').read().splitlines()]
    i0 = next(i for i, x in enumerate(L) if bat_dau in x)
    L = L[i0:]
    ra, nhom, ket_cau, phu, pl = [], '', '', '', ''
    for i, x in enumerate(L):
        t = x.strip()
        if not t:
            continue
        m = MA_PL.match(t)
        if m:
            pl, nhom, ket_cau, phu = m.group(1), '', '', ''
            continue
        if i + 2 < len(L) and DV.match(L[i + 1].strip()) and GIA.match(L[i + 2].strip()):
            ra.append({'pl': pl, 'nhom': nhom, 'phu': phu, 'ketCau': ket_cau,
                       'ten': '' if GIA.match(t) else t, 'dv': L[i + 1].strip(),
                       'gia': int(L[i + 2].strip().replace('.', ''))})
            continue
        # bỏ dòng tiêu đề cột của bảng, không thì nó bị hiểu là tên nhóm nhỏ ("Giá trị (VNĐ) · Mộ xây")
        if re.fullmatch(r'(STT|Loại công trình.*|Đơn vị.*|Giá trị \(VNĐ\)|Nội dung.*|Đơn giá.*)', t):
            continue
        if DV.match(t) or GIA.match(t) or re.fullmatch(r'[A-ZĐIVX]{1,4}|\d+(?:\.\d+)*', t):
            continue
        if t.startswith('Kết cấu'):
            ket_cau = t
        elif t.isupper() and len(t) > 8:
            nhom, ket_cau, phu = t, '', ''
        elif len(t) < 70:
            phu, ket_cau = t, ''
        else:
            ket_cau = t
    return ra


def main(tep08, tep12):
    for tep, bat, ra_ten in ((tep08, 'Phụ lục', 'den-bu-nha-qd08.json'), (tep12, 'Phụ lục I', 'den-bu-chi-phi-qd12.json')):
        ds = boc(tep, bat)
        duong = os.path.join(RA_DIR, ra_ten)
        with io.open(duong + '.tmp', 'w', encoding='utf-8', newline='\n') as f:
            json.dump(ds, f, ensure_ascii=False)
        os.replace(duong + '.tmp', duong)
        print('%s: %d dòng đơn giá → %s (%.0f KB)' % (os.path.basename(tep), len(ds), duong, os.path.getsize(duong) / 1024))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    main(sys.argv[1], sys.argv[2])
