# -*- coding: utf-8 -*-
"""
DỰNG LỘ TRÌNH HỌC — thôi học chắp vá, và bám ĐÚNG SỰ LIÊN KẾT THẬT giữa các điều.

BA ĐIỀU CHỦ DỰ ÁN CHỈ RA, đều đúng:
 1. "Học chắp vá chỗ này một ít chỗ kia một ít" — 744 thẻ trộn ngẫu nhiên qua 33 chủ đề rời rạc.
 2. "Điều chương này nhưng liên kết tới chương khác, chúng nó đều liên kết với nhau" — xếp thẻ
    theo chương là THÔ. Ví dụ thật: học bồi thường (Chương VII) mà không kéo theo Điều 45
    (Chương III, điều kiện thực hiện quyền) và Nghị định 88/2024 thì hiểu cụt.
 3. "Trọng tâm: cấp Giấy chứng nhận, đăng ký biến động, thu hồi đất, bồi thường - hỗ trợ -
    tái định cư" — bốn việc này phải thành bốn chặng RIÊNG, không gộp chung.

CÁCH LÀM — mỗi chặng dựng bằng 2 lớp:
  LỚP LÕI  : các điều thuộc đúng việc đó (khai theo chương + khai tay vài điều đặc biệt).
  LỚP LIÊN KẾT: đi theo BẢN ĐỒ DẪN CHIẾU có sẵn (1.520 liên kết, dựng bởi dung-lien-ket.py)
              — điều nào được lõi dẫn tới thì kéo vào chặng đó luôn, KỂ CẢ khi nó nằm ở
              chương khác hoặc ở nghị định, thông tư khác.
Nhờ vậy một điều có thể thuộc NHIỀU chặng — đúng như thực tế, vì chúng liên kết với nhau.

Chạy:  python dung-lo-trinh.py <thu-muc-json>
"""
import sys, os, json

# ── 11 chặng. Bốn chặng ★ là trọng tâm, xếp ngay sau phần nền ────────────────
CHANG = [
    {'so': 0, 'ten': 'Nền: từ ngữ · loại đất · thời hạn · hạn mức', 'icon': '🗂️', 'mau': 'slate',
     'trongTam': False,
     'moTa': 'Học trước tiên. Chưa nắm từ ngữ và loại đất thì mọi điều sau đọc đều lơ mơ.'},
    {'so': 1, 'ten': 'Cấp Giấy chứng nhận', 'icon': '📗', 'mau': 'emerald', 'trongTam': True,
     'moTa': 'Bốn trường hợp được xét cấp, ba mốc thời gian, hồ sơ và mẫu giấy.'},
    {'so': 2, 'ten': 'Đăng ký biến động', 'icon': '🔄', 'mau': 'sky', 'trongTam': True,
     'moTa': 'Trường hợp nào phải đăng ký, cái nào bắt buộc trong 30 ngày, hồ sơ và thời hạn.'},
    {'so': 3, 'ten': 'Thu hồi đất', 'icon': '🚧', 'mau': 'rose', 'trongTam': True,
     'moTa': 'Vì sao được thu hồi, trình tự, thẩm quyền, trưng dụng đất.'},
    {'so': 4, 'ten': 'Bồi thường, hỗ trợ, tái định cư', 'icon': '💰', 'mau': 'amber',
     'trongTam': True,
     'moTa': 'Điều kiện được bồi thường, bồi thường về đất và tài sản, các khoản hỗ trợ, tái định cư.'},
    {'so': 5, 'ten': 'Chuyển mục đích · Tách, hợp thửa', 'icon': '🔁', 'mau': 'orange',
     'trongTam': False, 'moTa': 'Các việc làm thay đổi thửa đất, phải xin phép hoặc đủ điều kiện.'},
    {'so': 6, 'ten': 'Quyền của người sử dụng đất khi giao dịch', 'icon': '🤝', 'mau': 'violet',
     'trongTam': False, 'moTa': 'Một bộ điều kiện dùng chung cho mọi giao dịch.'},
    {'so': 7, 'ten': 'Tài chính về đất đai · Giá đất', 'icon': '🏷️', 'mau': 'violet',
     'trongTam': False, 'moTa': 'Hai loại giá và các khoản phải nộp.'},
    {'so': 8, 'ten': 'Giải quyết tranh chấp · Xử phạt', 'icon': '⚖️', 'mau': 'orange',
     'trongTam': False, 'moTa': 'Khi có bất đồng thì đi đâu, theo trình tự nào.'},
    {'so': 9, 'ten': 'Quy hoạch · Kỹ thuật, dữ liệu đất đai', 'icon': '🗺️', 'mau': 'teal',
     'trongTam': False, 'moTa': 'Phần chuyên môn: quy hoạch, đo đạc, cơ sở dữ liệu, thẩm quyền.'},
    {'so': 10, 'ten': 'Hiệu lực · Chuyển tiếp · Các đời luật', 'icon': '📅', 'mau': 'slate',
     'trongTam': False,
     'moTa': 'Học cuối: điều nào đã bãi bỏ, bị sửa ra sao, hồ sơ vắt qua mốc thì theo luật nào.'},
]

# ── LỚP LÕI ──────────────────────────────────────────────────────────────────
# Chương của Luật Đất đai 2024 -> chặng lõi
CHUONG = {'I': 0, 'II': 9, 'III': 6, 'IV': 9, 'V': 9, 'VI': 3, 'VII': 4, 'VIII': 9,
          'IX': 5, 'X': 1, 'XI': 7, 'XII': 9, 'XIII': 0, 'XIV': 1, 'XV': 8, 'XVI': 10}

# Điều nằm ở chương này nhưng thuộc về việc khác — khai tay
NGOAI_LE = {
    'ldd2024:133': 2, 'ldd2024:134': 2,          # Đăng ký biến động (nằm trong chương X)
    'ldd2024:131': 1, 'ldd2024:132': 1, 'ldd2024:135': 1,
    'ldd2024:190': 9,                            # Hoạt động lấn biển
    'ldd2024:218': 5, 'ldd2024:219': 5, 'ldd2024:220': 5,
    'ldd2024:176': 0, 'ldd2024:177': 0, 'ldd2024:195': 0, 'ldd2024:196': 0,
    'ldd2024:235': 8, 'ldd2024:236': 8, 'ldd2024:237': 8,
}

# Văn bản dưới luật -> chặng lõi. Thông tư về hồ sơ địa chính, mẫu Giấy chứng nhận
# thuộc thẳng vào chặng cấp Giấy chứng nhận, không phải "phần kỹ thuật".
VAN_BAN = {
    'nd101-2024': 1, 'tt10-2024': 1, 'tt12-2024': 1, 'nd104-2024': 1,
    'nd102-2024': 0,
    'nd103-2024': 7, 'nd71-2024': 7,
    'nd88-2024': 4,
    'nd123-2024': 8,
    'nd151-2025': 9, 'tt25-2024': 9, 'tt26-2024': 9, 'tt29-2024': 9,
    'ldd1987': 10, 'ldd1993': 10, 'ldd2003': 10, 'ldd2013': 10,
    'lsd1998': 10, 'lsd2001': 10, 'l43-2024': 10, 'nd42-2024': 10,
}

# Nghị định 101/2024 có hẳn một mảng về đăng ký biến động — tách ra chặng 2.
# (Các điều về trình tự đăng ký biến động, cấp đổi, cấp lại.)
ND101_BIEN_DONG = set(range(37, 47)) | set(range(20, 28))


def lam(thu_muc):
    kho = json.load(open(os.path.join(thu_muc, '_kho.json'), encoding='utf-8'))
    vb = {}
    for x in kho:
        p = os.path.join(thu_muc, x['ma'] + '.json')
        if os.path.exists(p):
            vb[x['ma']] = json.load(open(p, encoding='utf-8'))

    # ── Lớp lõi ──
    loi = {}
    for ma, v in vb.items():
        for d in v['dieu']:
            khoa = '%s:%s' % (ma, d['so'])
            if khoa in NGOAI_LE:
                c = NGOAI_LE[khoa]
            elif ma == 'nd101-2024' and str(d['so']).isdigit() and int(d['so']) in ND101_BIEN_DONG:
                c = 2
            elif ma == 'ldd2024' and d.get('chuong') in CHUONG:
                c = CHUONG[d['chuong']]
            elif ma in VAN_BAN:
                c = VAN_BAN[ma]
            else:
                continue
            loi[khoa] = c

    # ── Lớp liên kết: đi theo bản đồ dẫn chiếu, MỘT BƯỚC ──
    # Điều nào được một điều lõi của chặng C dẫn tới thì cũng thuộc chặng C.
    # Chỉ đi một bước: đi nhiều bước là cả kho dính vào nhau, mất hết ý nghĩa phân chặng.
    thuoc = {k: {c} for k, c in loi.items()}
    them = 0
    for ma, v in vb.items():
        for d in v['dieu']:
            khoa = '%s:%s' % (ma, d['so'])
            c = loi.get(khoa)
            if c is None:
                continue
            for z in (d.get('dan') or []):
                if not z.get('so'):
                    continue
                k2 = '%s:%s' % (z['ma'], z['so'])
                if k2 not in vb.get(z['ma'], {}) and z['ma'] not in vb:
                    continue
                if k2 == khoa:
                    continue
                s = thuoc.setdefault(k2, set())
                if c not in s:
                    s.add(c)
                    them += 1

    ra_dieu = {k: sorted(v) for k, v in thuoc.items() if v}
    ra = os.path.join(thu_muc, 'lo-trinh.json')
    json.dump({'chang': CHANG, 'theoDieu': ra_dieu, 'theoVanBan': VAN_BAN},
              open(ra, 'w', encoding='utf-8'), ensure_ascii=False)

    print('Da xep %d dieu vao %d chang (%d lien ket keo them) -> %s'
          % (len(ra_dieu), len(CHANG), them, ra))
    for c in CHANG:
        n_loi = sum(1 for k, x in loi.items() if x == c['so'])
        n_tong = sum(1 for k, x in ra_dieu.items() if c['so'] in x)
        sao = ' ★' if c['trongTam'] else '  '
        sys.stdout.buffer.write(
            ('%s Chang %-2d %-44s loi %4d -> ca lien ket %4d\n'
             % (sao, c['so'] + 1, c['ten'][:44], n_loi, n_tong)).encode('utf-8', 'replace'))


if __name__ == '__main__':
    lam(sys.argv[1] if len(sys.argv) > 1 else 'apps/frontend/public/luat')
