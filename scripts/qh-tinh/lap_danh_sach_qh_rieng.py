# -*- coding: utf-8 -*-
# LẬP danh-sach.json cho LỚP QUY HOẠCH CHỈ ADMIN XEM (máy chủ routes/qhRieng.ts đọc, gửi cho admin qua /api/qh-rieng/ve) — 14/10/2026.
# Lớp 1/500 chính thức Cam Lâm: 6 đồ án, QĐ 2043–2048/QĐ-UBND ngày 25/9/2026 của UBND xã Cam Lâm (số, ngày, tên đọc từ trang đầu
# bản quét quyết định). Khung bao lấy từ ranh lập quy hoạch của chính 6 bản vẽ (ranh_1_500_dxf.py).
# Dùng: python -P lap_danh_sach_qh_rieng.py <thu_muc_ranh> <ra danh-sach.json>
import sys, os, json
sys.stdout.reconfigure(encoding='utf-8')
from shapely.geometry import shape
from shapely.ops import unary_union
ranh_d, ra = sys.argv[1], sys.argv[2]
DO_AN = [   # (tên ranh, số QĐ, tên đồ án, tệp bản quét trong tai-lieu/)
    ('gdqd', '2043/QĐ-UBND', 'Khu Gia đình Quân đội thuộc một phần Tiểu khu G, phân khu đô thị Trung tâm', 'QD-2043-2026-QHCT-1-500-khu-gia-dinh-quan-doi-TK-G-trung-tam.pdf'),
    ('camduc', '2044/QĐ-UBND', 'Một phần Tiểu khu B, phân khu đô thị Trung tâm', 'QD-2044-2026-QHCT-1-500-tieu-khu-B-trung-tam.pdf'),
    ('camhiepbac', '2048/QĐ-UBND', 'Một phần Tiểu khu C, phân khu đô thị Trung tâm', 'QD-2048-2026-QHCT-1-500-tieu-khu-C-trung-tam.pdf'),
    ('camtan', '2047/QĐ-UBND', 'Một phần Tiểu khu B, phân khu đô thị phía Bắc', 'QD-2047-2026-QHCT-1-500-tieu-khu-B-phia-Bac.pdf'),
    ('camhoa', '2045/QĐ-UBND', 'Một phần Tiểu khu D, phân khu đô thị phía Bắc', 'QD-2045-2026-QHCT-1-500-tieu-khu-D-phia-Bac.pdf'),
    ('camhaitay', '2046/QĐ-UBND', 'Một phần Tiểu khu E, phân khu đô thị phía Bắc', 'QD-2046-2026-QHCT-1-500-tieu-khu-E-phia-Bac.pdf'),
]
gs = [shape(json.load(open(os.path.join(ranh_d, f'ranh-{t}.json'), encoding='utf-8'))) for t, *_ in DO_AN]
x0, y0, x1, y1 = unary_union(gs).bounds
lop = [{
    'id': 'qh-ct500', 'thuMuc': 'qhct500-v1',
    # 15/10/2026 chủ dự án: "bỏ chữ đã duyệt đi, vẫn hiện ra chỗ chọn nhưng chỉ tài khoản admin được chọn, còn lại hiện popup
    # liên hệ admin" → `congKhai` = tên hiện cho MỌI NGƯỜI (máy chủ GET /api/qh-rieng/gioi-thieu, chỉ tên — ô ảnh vẫn chỉ admin).
    'ten': 'QH chi tiết 1/500 · 6 đồ án (chỉ quản trị viên)', 'tenNgan': 'Chi tiết 1/500', 'tenApp': 'QH chi tiết 1/500',
    'congKhai': {'ten': 'QH chi tiết 1/500 · 6 đồ án', 'tenNgan': 'Chi tiết 1/500', 'tenApp': 'QH chi tiết 1/500'},
    'vung': 'cam-lam', 'zBay': 12, 'minzoom': 12, 'maxzoom': 20,
    'khung': [round(x0 - 0.001, 5), round(y0 - 0.001, 5), round(x1 + 0.001, 5), round(y1 + 0.001, 5)],
    'canCu': {'so': '2043–2048/QĐ-UBND', 'ngay': '25/9/2026', 'coQuan': 'UBND xã Cam Lâm',
              'ten': 'Phê duyệt Quy hoạch chi tiết (tỷ lệ 1/500) — 6 đồ án thuộc quy hoạch phân khu đô thị Trung tâm và phía Bắc, xã Cam Lâm',
              'tep': DO_AN[0][3],
              'cac': [{'so': so, 'ngay': '25/9/2026', 'ten': ten, 'tep': tep} for _, so, ten, tep in DO_AN]},
}]
json.dump({'lop': lop}, open(ra, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('da ghi', ra, '| khung', lop[0]['khung'])
