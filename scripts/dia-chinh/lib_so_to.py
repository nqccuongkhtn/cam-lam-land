# -*- coding: utf-8 -*-
# PHẦN DÙNG CHUNG cho các script dựng bảng đổi số tờ bản đồ (mỗi huyện một script riêng
# vì bảng của mỗi nơi trình bày một kiểu, nhưng đoạn xử lý phía sau thì giống hệt nhau).
#
# Việc của file này: nhận danh sách dòng (tên xã mới, tờ mới, tên xã cũ, tờ cũ) đọc từ bảng
# của Văn phòng Đăng ký, đổi tên xã → mã xã, rồi CHỌN ĐÍCH cho từng số tờ và ghi ra CSV.
#
# ⚠️ VÌ SAO PHẢI "CHỌN ĐÍCH" (bài học từ Ninh Hoà, xem CLAUDE.md):
#   Nơi thì mỗi xã cũ còn một file dữ liệu riêng mang số tờ cũ (Nha Trang) — nạp bảng nguyên xi
#   là dùng được. Nơi thì xã cũ KHÔNG có file riêng, dữ liệu nằm chung trong file của xã gốc và
#   phần lớn đã mang sẵn số tờ MỚI (Ninh Hoà, Vạn Ninh) — nạp nguyên xi thì tra ra 0 kết quả.
#   Nên với từng số tờ, script tự đếm xem thửa thật nằm ở đâu rồi mới ghi đích.
import subprocess, json, os, unicodedata as ud
from collections import defaultdict

DANH_MUC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dvhc', 'khanh-hoa-2cap.json')

def nfc(s):
    """Chuẩn hoá chữ tiếng Việt về kiểu GÕ LIỀN DẤU. Bảng của Sở có file gõ TÁCH DẤU,
    không chuẩn hoá là so tên xã trượt hết mà không báo lỗi gì."""
    return ud.normalize('NFC', str(s)).replace('\xa0', ' ').strip()

def bodau(s):
    """Bỏ dấu + bỏ chữ 'xã/phường/thị trấn' để so tên cho dễ."""
    t = ud.normalize('NFD', nfc(s))
    t = ''.join(c for c in t if not ud.combining(c)).replace('đ', 'd').replace('Đ', 'D').lower()
    t = t.replace('(cu)', ' ')
    for p in ('xa ', 'phuong ', 'thi tran ', 'dac khu '):
        if t.startswith(p): t = t[len(p):]
    return ''.join(c for c in t if c.isalnum())

def num(v):
    """Lấy số nguyên từ ô Excel; ô chữ hoặc ô ngày tháng thì bỏ qua."""
    if isinstance(v, bool): return None
    if isinstance(v, int): return v
    if isinstance(v, float) and v == int(v): return int(v)
    if isinstance(v, str) and nfc(v).isdigit(): return int(nfc(v))
    return None

def psql(sql):
    return subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam',
                           '-d', 'camlam_gis', '-tAF|', '-c', sql],
                          capture_output=True, text=True, encoding='utf-8').stdout

def tao_bang(dong, ra_csv):
    """dong = [(tên xã mới, tờ mới, tên xã cũ, tờ cũ), …] → ghi file CSV 4 cột dùng mã xã."""
    dsXa = [l.split('|') for l in psql("SELECT xa_id, ten, cap, coalesce(xa_moi_id,'') FROM dia_chinh_xa;")
            .strip().splitlines() if l]
    theoTen = defaultdict(list)
    for ma, ten, cap, xm in dsXa: theoTen[bodau(ten)].append((ma, ten, int(cap), xm))

    def maXaMoi(ten):
        hop = [h for h in theoTen[bodau(ten)] if h[2] == 2]
        if len(hop) != 1: raise SystemExit(f'Không nhận ra xã mới "{ten}" ({len(hop)} kết quả)')
        return hop[0][0]

    def maXaCu(ten, maMoi):
        # Toàn tỉnh trùng tên rất nhiều (vd "Vạn Phước" ở Vạn Ninh, "Ninh Phước" ở cả Ninh Hoà
        # lẫn Ninh Thuận) → chỉ nhận xã cấp 3 ĐANG THUỘC đúng xã mới đó.
        hop = [h for h in theoTen[bodau(ten)] if h[2] == 3 and h[3] == maMoi]
        return hop[0][0] if len(hop) == 1 else None

    dem = defaultdict(int)
    for l in psql('SELECT xa_id, to_num, count(*) FROM dia_chinh GROUP BY 1,2;').strip().splitlines():
        if l: p = l.split('|'); dem[(p[0], int(p[1]))] = int(p[2])

    # Bảng của Sở có nơi ghi tên trống ("Đại Lãnh", "Vạn Giã"), có nơi ghi đủ ("phường Ninh Diêm").
    # Tra danh mục chính thức để lấy tên ĐẦY ĐỦ ĐÚNG loại đơn vị — đoán bừa "xã " đằng trước là
    # sai với thị trấn Vạn Giã. Trùng tên giữa các huyện thì lọc theo huyện cũ của xã mới.
    dm = json.load(open(DANH_MUC, encoding='utf-8'))
    huyenCua = {str(x['xaId']): x.get('huyenIdCu') for x in dm['xaMoi']}
    tenDayDu = defaultdict(set)
    for x in dm['xaCu']:                       # xã cũ đã mất mã (bị xoá khi sáp nhập)
        if x.get('ten'): tenDayDu[(x.get('huyenIdCu'), bodau(x['ten']))].add(x['ten'])
    for x in dm['xaMoi']:                      # xã cũ ĐƯỢC KẾ THỪA MÃ thì nằm ở trường donViGoc
        if x.get('donViGoc'): tenDayDu[(x.get('huyenIdCu'), bodau(x['donViGoc']))].add(x['donViGoc'])
        elif x.get('ten'): tenDayDu[(x.get('huyenIdCu'), bodau(x['ten']))].add(x['ten'])
    def tenChuan(ten, maMoi):
        hop = tenDayDu.get((huyenCua.get(maMoi), bodau(ten)), set())
        return next(iter(hop)) if len(hop) == 1 else nfc(ten)

    ra, tk = [], defaultdict(int)
    for tenMoi, tm, tenCu, tc in dong:
        mm = maXaMoi(tenMoi)
        mc = maXaCu(tenCu, mm)
        nCu = dem.get((mc, tc), 0) if mc else 0
        nMoi = dem.get((mm, tm), 0)
        # Hai cột cuối luôn ghi ĐIỀU BẢNG GIẤY GHI (xã cũ thật + tờ cũ thật), bất kể tìm ở đâu
        # → web hiện đúng "Trước sáp nhập: xã Đại Lãnh · tờ cũ 1" thay vì tên xã gốc của cả file.
        that = (tenChuan(tenCu, mm), tc)
        if nCu and nCu >= nMoi:
            ra.append((mm, tm, mc, tc) + that); tk['theo file xã cũ'] += 1; tk['thửa tra được'] += nCu
        else:
            ra.append((mm, tm, mm, tm) + that); tk['theo file xã mới (giữ số)'] += 1; tk['thửa tra được'] += nMoi
            if not nMoi: tk['tờ chưa có thửa nào'] += 1
    # newline='\n': ép xuống dòng kiểu Unix. Để mặc định thì trên Windows ra \r\n,
    # psql \copy báo "unquoted newline found in data" và KHÔNG nạp được dòng nào (đã vấp).
    with open(ra_csv, 'w', encoding='utf-8', newline='\n') as fh:
        for r in ra: fh.write(','.join(map(str, r)) + '\n')
    for k, v in tk.items(): print(f'   {k}: {v:,}'.replace(',', '.'))
    print(f'Ghi {len(ra)} dòng → {ra_csv}')
    return ra
