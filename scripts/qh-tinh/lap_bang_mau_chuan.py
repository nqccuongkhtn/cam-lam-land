# -*- coding: utf-8 -*-
# LẬP BẢNG MÀU CHUẨN của tỉnh từ chú giải các bản QHSDĐ đọc được (file <ban>-loai-dat.chu-giai.json do boc_loai_dat.py ghi).
# Mọi bản đồ QHSDĐ của Sở dùng CHUNG bảng màu loại đất (Cam Ranh, Nha Trang, Vạn Ninh đọc ra y hệt: #ffaa32 = DGT, #ffa0ff = ODT…)
# → bản nào đọc chú giải thiếu (Ninh Hòa) thì lấy bổ sung ở đây (boc_loai_dat.py --mau-chuan=…).
# Chỉ nhận màu có mặt ở ≥ 2 bản; mã = HỢP các mã các bản ghi cho màu đó (bản nào ghi thêm mã → màu thành "dùng chung", không đoán).
# Dùng: python -P lap_bang_mau_chuan.py <ra.json> <a.chu-giai.json> <b.chu-giai.json> …
import sys, json, os, collections
sys.stdout.reconfigure(encoding='utf-8')
ra, ds = sys.argv[1], sys.argv[2:]
mau = collections.defaultdict(lambda: {'ma': set(), 'ban': []})
for f in ds:
    ten = os.path.basename(f).split('-loai-dat')[0]
    for hx, mas in json.load(open(f, encoding='utf-8')).items():
        mau[hx]['ma'] |= set(mas); mau[hx]['ban'].append(ten)
kq = {hx: {'ma': sorted(v['ma']), 'ban': sorted(v['ban'])} for hx, v in sorted(mau.items()) if len(v['ban']) >= 2}
json.dump({'_doc': 'Bảng màu loại đất CHUNG của các bản đồ QHSDĐ 2030 Khánh Hòa (Sở NN&MT), gom từ chú giải đọc được trên PDF '
           '(lap_bang_mau_chuan.py). ma = các mã chú giải ghi cho màu đó (1 mã = màu riêng; nhiều mã = màu dùng chung); ban = các bản có màu này.',
           'mau': kq}, open(ra, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for hx, v in kq.items(): print(hx, '/'.join(v['ma']), '<-', ', '.join(v['ban']))
