# -*- coding: utf-8 -*-
# BẢNG ĐỔI SỐ TỜ BẢN ĐỒ — 8 XÃ/PHƯỜNG THỊ XÃ NINH HÒA CŨ
# ─────────────────────────────────────────────────────────────────────────────
# NGUỒN: file Excel "Phụ lục 1.10 – 1.17: Số thứ tự các tờ bản đồ" của Văn phòng
# Đăng ký đất đai (chủ dự án gửi 3/9/2026), lưu bản gốc tại
# scripts/dia-chinh/anh-bang-goc/ninh-hoa-phu-luc.xlsx — 8 sheet, mỗi sheet một xã mới.
# Cột C = tên xã mới · D = tờ bản đồ MỚI · E = tên xã cũ · F = tờ bản đồ CŨ.
#
# ⚠️ BẪY 1 — CHỮ TIẾNG VIỆT GÕ TÁCH DẤU: vài sheet lưu chữ kiểu "tách dấu" (NFD),
#    so tên xã kiểu thường sẽ trượt và MẤT TRẮNG khối đầu tiên của sheet đó
#    (đã vấp: đọc lần đầu mất 168 dòng). Phải normalize NFC trước khi so.
#
# ⚠️ BẪY 2 — DỮ LIỆU NINH HÒA KHÁC NHA TRANG. Ở Nha Trang mỗi xã cũ còn một file
#    riêng mang số tờ cũ, nên bảng đổi "tờ mới → (xã cũ, tờ cũ)" dùng được thẳng.
#    Ở Ninh Hòa thì hầu hết xã cũ KHÔNG có file riêng: dữ liệu nằm trong file của
#    xã GỐC, phần lớn là số tờ cũ của chính xã gốc (đổi 1:1), kèm một ít thửa đã
#    được đo vẽ lại và MANG SẴN SỐ TỜ MỚI. Nạp bảng nguyên xi = tra ra 0 kết quả.
#    → Với TỪNG số tờ mới, script tự đếm xem thửa thật nằm ở đâu rồi mới chọn đích:
#         · ở file xã cũ (số tờ cũ)      → ghi đích là (xã cũ, tờ cũ)
#         · ở file xã mới (số tờ mới)    → ghi đích là (xã mới, chính số tờ mới)
#       Chỗ nào cả hai đều không có thửa thì mặc định ghi đích là file xã mới.
#    Khi nào xin được dữ liệu địa chính của các xã cũ thì chạy lại script này.
#
# CHẠY:  python scripts/dia-chinh/bang-so-to-ninh-hoa.py <file.xlsx> <ra.csv>
import sys, subprocess, unicodedata as ud
from collections import defaultdict
import openpyxl

XLSX = sys.argv[1] if len(sys.argv) > 1 else 'scripts/dia-chinh/anh-bang-goc/ninh-hoa-phu-luc.xlsx'
RA   = sys.argv[2] if len(sys.argv) > 2 else 'scripts/dia-chinh/bang-so-to-ninh-hoa.csv'

def nfc(s): return ud.normalize('NFC', str(s)).replace('\xa0', ' ').strip()
def bodau(s):
    s = ud.normalize('NFD', nfc(s))
    s = ''.join(c for c in s if not ud.combining(c)).replace('đ', 'd').replace('Đ', 'D').lower()
    s = s.replace('(cu)', ' ')
    for p in ('xa ', 'phuong ', 'thi tran ', 'dac khu '):
        if s.startswith(p): s = s[len(p):]
    return ''.join(c for c in s if c.isalnum())
def num(v):
    if isinstance(v, bool): return None
    if isinstance(v, int): return v
    if isinstance(v, float) and v == int(v): return int(v)
    if isinstance(v, str) and nfc(v).isdigit(): return int(nfc(v))
    return None
def psql(sql):
    return subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam',
                           '-d', 'camlam_gis', '-tAF|', '-c', sql],
                          capture_output=True, text=True, encoding='utf-8').stdout

# ── 1. Đọc Excel thành các dòng (tên xã mới, tờ mới, tên xã cũ, tờ cũ) ────────
wb = openpyxl.load_workbook(XLSX, data_only=True)
dong = []
for ws in wb.worksheets:
    xaMoi = xaCu = None
    for r in ws.iter_rows(min_row=1, max_row=ws.max_row, values_only=True):
        c, d, e, f = (tuple(r) + (None,) * 6)[2:6]
        if isinstance(c, str) and nfc(c) and 'xã mới' not in nfc(c) and 'Tên ĐVHC' not in nfc(c):
            xaMoi = nfc(c)
        if isinstance(e, str) and nfc(e):
            t = nfc(e)
            if t.lower().startswith(('xã ', 'phường ', 'thị trấn ')) and 'thị xã' not in t.lower():
                xaCu = t
        tm, tc = num(d), num(f)
        if tm is not None and tc is not None and xaMoi and xaCu:
            dong.append((xaMoi, tm, xaCu, tc))
print(f'Đọc được {len(dong)} dòng từ {len(wb.worksheets)} sheet')

# ── 2. Đổi tên xã → mã xã ────────────────────────────────────────────────────
dsXa = [l.split('|') for l in psql('SELECT xa_id, ten, cap, coalesce(xa_moi_id, %s) FROM dia_chinh_xa;'
                                   % "''").strip().splitlines() if l]
theoTen = defaultdict(list)
for ma, ten, cap, xm in dsXa: theoTen[bodau(ten)].append((ma, ten, int(cap), xm))

def maXaMoi(ten):
    hop = [h for h in theoTen[bodau(ten)] if h[2] == 2]
    if len(hop) != 1: raise SystemExit(f'Không nhận ra xã mới "{ten}" ({len(hop)} kết quả)')
    return hop[0][0]
def maXaCu(ten, maMoi):
    # Trùng tên toàn tỉnh rất nhiều (vd "Ninh Phước" ở cả Ninh Hòa lẫn Ninh Thuận)
    # → chỉ nhận xã cấp 3 ĐANG THUỘC đúng xã mới đó.
    hop = [h for h in theoTen[bodau(ten)] if h[2] == 3 and h[3] == maMoi]
    return hop[0][0] if len(hop) == 1 else None

# ── 3. Đếm thửa để chọn đích cho từng số tờ ──────────────────────────────────
dem = defaultdict(int)
for l in psql('SELECT xa_id, to_num, count(*) FROM dia_chinh GROUP BY 1,2;').strip().splitlines():
    if l: p = l.split('|'); dem[(p[0], int(p[1]))] = int(p[2])

ra, thongKe = [], defaultdict(int)
for tenMoi, tm, tenCu, tc in dong:
    mm = maXaMoi(tenMoi)
    mc = maXaCu(tenCu, mm)
    nCu  = dem.get((mc, tc), 0) if mc else 0
    nMoi = dem.get((mm, tm), 0)
    if nCu and nCu >= nMoi:
        ra.append((mm, tm, mc, tc)); thongKe['theo file xã cũ'] += 1; thongKe['thửa tra được'] += nCu
    else:
        ra.append((mm, tm, mm, tm)); thongKe['theo file xã mới (giữ số)'] += 1; thongKe['thửa tra được'] += nMoi
        if not nMoi: thongKe['tờ chưa có thửa nào'] += 1

# newline='\n': ép xuống dòng kiểu Unix. Để mặc định thì trên Windows ra kiểu \r\n,
# psql \copy báo "unquoted newline found in data" và KHÔNG nạp được dòng nào (đã vấp).
with open(RA, 'w', encoding='utf-8', newline='\n') as fh:
    for r in ra: fh.write(','.join(map(str, r)) + '\n')
for k, v in thongKe.items(): print(f'   {k}: {v:,}'.replace(',', '.'))
print(f'Ghi {len(ra)} dòng → {RA}')
