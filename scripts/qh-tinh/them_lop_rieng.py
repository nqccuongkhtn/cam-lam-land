# -*- coding: utf-8 -*-
# THÊM / THAY một lớp vào danh-sach.json của LỚP CHỈ ADMIN XEM (routes/qhRieng.ts) — 14/10/2026.
# Dùng cho bản quy hoạch CHƯA XÁC MINH được số quyết định phê duyệt (vd hồ sơ điều chỉnh phân khu Tây Nha Trang tiểu phân khu 2.2:
# thuyết minh ghi "Kèm theo Quyết định số …… năm 2025" để trống): chỉ admin thấy để chủ dự án tự kiểm, chưa công khai cho người dùng.
# Dùng: python -P them_lop_rieng.py <danh-sach.json> <lop.json> [--truoc=<id>]
#   lop.json = một mục đủ trường như mục 1/500; trùng id thì thay (giữ chỗ cũ trong danh sách).
#   --truoc=<id> (15/10/2026): lớp MỚI đặt ngay trước lớp <id> (thứ tự trong danh sách = thứ tự trên bảng chọn bản đồ).
# Ghi ra tệp tạm rồi mới đổi tên — lỗi giữa chừng không làm hỏng danh-sach.json đang dùng.
import sys, os, json
ts = [a for a in sys.argv[1:] if not a.startswith('--')]
truoc = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--truoc=')), None)
ds_p, lop_p = ts[0], ts[1]
ds = json.load(open(ds_p, encoding='utf-8'))
lop = json.load(open(lop_p, encoding='utf-8'))
for k in ('id', 'thuMuc', 'ten', 'tenNgan', 'tenApp', 'vung', 'minzoom', 'maxzoom', 'khung'):
    if k not in lop: sys.exit(f'LOI: lop thieu truong {k}')
cu = ds.get('lop', [])
ids = [l.get('id') for l in cu]
if lop['id'] in ids:
    cu[ids.index(lop['id'])] = lop
elif truoc and truoc in ids:
    cu.insert(ids.index(truoc), lop)
else:
    cu.append(lop)
ds['lop'] = cu
tam = ds_p + '.tmp'
with open(tam, 'w', encoding='utf-8', newline='\n') as f: json.dump(ds, f, ensure_ascii=False, indent=1)
os.replace(tam, ds_p)
print('danh sach lop rieng:', [l['id'] for l in ds['lop']])
