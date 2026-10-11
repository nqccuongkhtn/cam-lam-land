# -*- coding: utf-8 -*-
"""
BẢNG TÊN LOẠI ĐẤT THEO ĐÚNG CHỮ KHUNG CHÚ GIẢI (11/10/2026) — từ chu-giai-ban-ve.json (8b-doc-chu-giai.py) → ten-theo-chu-giai.json.

Chủ dự án so với app tham chiếu: app ghi tên ĐÚNG CHỮ chú giải của bản vẽ ("Đất hỗn hợp (40% ĐVƠ + 60% DVDL, mật độ cao)",
"Đất hỗn hợp nhóm nhà ở và dịch vụ"), web ghi tên gọn tự đặt ("Đất hỗn hợp", "Đất hỗn hợp – nhóm nhà ở"). Bảng này cho 5g (phân khu)
và 5h (QĐ205) đặt tên theo chú giải.
Nhận cặp (level, màu) khớp CHẮC CHẮN với ĐÚNG MỘT dòng chú giải:
  · "cùng level + cùng màu";
  · "chỉ trùng màu + kiểu tô (level khác tên)" — màu VÀ mẫu tô y hệt ô mẫu chú giải: trên MicroStation người xem thấy giống hệt dòng
    chú giải đó, tên level chỉ là chỗ người vẽ cất hình (vd QĐ205 lớp "0" màu + mẫu tô của "điểm dân cư nông thôn hiện hữu" — web
    từng ghi "Rừng phòng hộ"; Cù Hin lớp "0" màu + mẫu tô "cây xanh sử dụng công cộng" — web từng ghi "Loại đất khác");
  · "cùng level, KHÁC màu" — người vẽ đặt ô mẫu chú giải đúng level đó (vd QĐ2222 HT_DAT_KHAC_Honuoc → "Đất hồ, ao, đầm").
Chỗ không có trong chú giải / gợi ý nhiều tên thì KHÔNG đổi (giữ tên cũ), ghi ra danh sách "chua_doi" để chủ dự án xem.
Khoá: "level||màu" (màu #rrggbb như 1b.mau_va_so) và "level" (khi mọi cặp chắc chắn của level đó cùng một tên). QĐ893 không ở đây
(tên theo mã chữ trong 5b đã đúng chữ chú dẫn).
Cách gọi: python 8c-ten-theo-chu-giai.py
"""
import io, json, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
CACH_NHAN = ('cùng level + cùng màu', 'chỉ trùng màu + kiểu tô (level khác tên)', 'cùng level, KHÁC màu')


def sua_chu(s):
    try: return s.encode('cp1252').decode('utf-8')
    except Exception: return s


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    B = json.load(io.open(os.path.join(HERE, 'chu-giai-ban-ve.json'), encoding='utf-8'))['ban']
    out = collections.OrderedDict()
    out['_doc'] = __doc__.strip().split('\n')[0] + ' — sinh bởi 8c-ten-theo-chu-giai.py, đừng sửa tay.'
    for ma, b in B.items():
        if ma == '893': continue
        lm, theo_lv, chua = {}, collections.defaultdict(set), []
        for x in b.get('lop_ban_do') or []:
            lop, mau, ten = sua_chu(x.get('lop') or ''), (x.get('mau') or '').lower(), x.get('ten_hien_thi') or []
            if x.get('cach_khop') in CACH_NHAN and len(ten) == 1:
                lm['%s||%s' % (lop, mau)] = ten[0]; theo_lv[lop].add(ten[0])
            else:
                chua.append({'lop': lop, 'mau': mau, 'ten_web': x.get('ten_web'), 'goi_y': ten, 'cach_khop': x.get('cach_khop'),
                             'ha': x.get('dien_tich_trong_ranh_ha')})
        out[ma] = {'theo_level_mau': lm, 'theo_level': {k: next(iter(v)) for k, v in theo_lv.items() if len(v) == 1},
                   'chua_doi': chua}
        print('%-7s %3d cặp chắc chắn, %3d level một tên, %2d chỗ chưa đổi' % (ma, len(lm), len(out[ma]['theo_level']), len(chua)))
    io.open(os.path.join(HERE, 'ten-theo-chu-giai.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')


if __name__ == '__main__':
    main()
