# -*- coding: utf-8 -*-
# THÊM / THAY một lớp vào danh-sach.json của LỚP CHỈ ADMIN XEM (routes/qhRieng.ts) — 14/10/2026.
# Dùng cho bản quy hoạch CHƯA XÁC MINH được số quyết định phê duyệt (vd hồ sơ điều chỉnh phân khu Tây Nha Trang tiểu phân khu 2.2:
# thuyết minh ghi "Kèm theo Quyết định số …… năm 2025" để trống): chỉ admin thấy để chủ dự án tự kiểm, chưa công khai cho người dùng.
# Dùng: python -P them_lop_rieng.py <danh-sach.json> <lop.json>     (lop.json = một mục đủ trường như mục 1/500; trùng id thì thay)
import sys, json
ds_p, lop_p = sys.argv[1], sys.argv[2]
ds = json.load(open(ds_p, encoding='utf-8'))
lop = json.load(open(lop_p, encoding='utf-8'))
for k in ('id', 'thuMuc', 'ten', 'tenNgan', 'tenApp', 'vung', 'minzoom', 'maxzoom', 'khung'):
    if k not in lop: sys.exit(f'LOI: lop thieu truong {k}')
ds['lop'] = [l for l in ds.get('lop', []) if l.get('id') != lop['id']] + [lop]
json.dump(ds, open(ds_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('danh sach lop rieng:', [l['id'] for l in ds['lop']])
