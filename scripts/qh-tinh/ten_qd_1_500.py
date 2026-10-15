# -*- coding: utf-8 -*-
# GHI TÊN NGUYÊN VĂN của 6 quyết định phê duyệt QH chi tiết 1/500 xã Cam Lâm vào danh-sach.json của lớp riêng (15/10/2026).
# Phiếu kiểm tra quy hoạch in dòng "Căn cứ: Quyết định số … về việc phê duyệt …" cho bản 1/500 (chủ dự án: "xuất phiếu kiểm tra quy
# hoạch đang thiếu quy hoạch" — bảng thông tin thửa có 1/500 mà phiếu không in). Trường `ten` cũ chỉ là tên khu rút gọn ("Một phần
# Tiểu khu B, phân khu đô thị Trung tâm") → thêm trường `tenQd` = TRÍCH YẾU chép đúng từng chữ ở trang đầu bản quét quyết định
# (tai-lieu/QD-204x-….pdf, đọc 15/10/2026; QĐ 2048 viết thường "tiểu khu C" — giữ nguyên như bản gốc).
# Trang bản đồ (app/map/page.tsx, nút "Xuất phiếu kiểm tra quy hoạch") đọc `tenQd` từ vé xem (/api/qh-rieng/ve) — tên quyết định
# không ghi cứng trong mã giao diện.
# Dùng: python -P ten_qd_1_500.py <danh-sach.json hoặc lop.json> [...]   — chạy lại nhiều lần vẫn an toàn (ghi đè đúng trường tenQd).
# Đưa lên web: chép danh-sach.json vào volume camlamgis_qh_rieng (máy chủ đọc lại tệp mỗi lần cấp vé, không cần dựng lại).
import sys, os, json

TEN_QD = {
    '2043/QĐ-UBND': 'Phê duyệt Quy hoạch chi tiết (tỷ lệ 1/500) Khu Gia đình Quân đội thuộc một phần Tiểu khu G Quy hoạch phân khu đô thị Trung tâm, xã Cam Lâm, tỉnh Khánh Hòa',
    '2044/QĐ-UBND': 'Phê duyệt Quy hoạch chi tiết (tỷ lệ 1/500) một phần Tiểu khu B Quy hoạch phân khu đô thị Trung tâm, xã Cam Lâm, tỉnh Khánh Hòa',
    '2045/QĐ-UBND': 'Phê duyệt Quy hoạch chi tiết (tỷ lệ 1/500) một phần Tiểu khu D Quy hoạch phân khu đô thị phía Bắc, xã Cam Lâm, tỉnh Khánh Hòa',
    '2046/QĐ-UBND': 'Phê duyệt Quy hoạch chi tiết (tỷ lệ 1/500) một phần Tiểu khu E Quy hoạch phân khu đô thị phía Bắc, xã Cam Lâm, tỉnh Khánh Hòa',
    '2047/QĐ-UBND': 'Phê duyệt Quy hoạch chi tiết (tỷ lệ 1/500) một phần Tiểu khu B Quy hoạch phân khu đô thị phía Bắc, xã Cam Lâm, tỉnh Khánh Hòa',
    '2048/QĐ-UBND': 'Phê duyệt Quy hoạch chi tiết (tỷ lệ 1/500) một phần tiểu khu C Quy hoạch phân khu đô thị Trung tâm, xã Cam Lâm, tỉnh Khánh Hòa',
}


def ghi_ten(muc):
    """Thêm tenQd cho mọi văn bản 1/500 trong canCu.cac của một lớp. Trả về số văn bản đã ghi."""
    n = 0
    for v in ((muc or {}).get('canCu') or {}).get('cac') or []:
        if v.get('so') in TEN_QD:
            v['tenQd'] = TEN_QD[v['so']]
            n += 1
    return n


for p in sys.argv[1:]:
    d = json.load(open(p, encoding='utf-8'))
    n = sum(ghi_ten(l) for l in d['lop']) if isinstance(d.get('lop'), list) else ghi_ten(d)
    tam = p + '.tmp'
    with open(tam, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    os.replace(tam, p)
    print(p, '— ghi ten quyet dinh cho', n, 'van ban')
