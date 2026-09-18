# -*- coding: utf-8 -*-
"""
DỰNG BẢN ĐỒ LIÊN KẾT GIỮA CÁC ĐIỀU LUẬT (chạy sau khi đã có các tệp JSON của kho).

Vì sao cần: luật đất đai nhắc chéo nhau chằng chịt — Luật nói một câu rồi "Chính phủ quy
định chi tiết", chữ thật nằm ở nghị định; nghị định lại viện dẫn ngược về "khoản 3 Điều 96
của Luật Đất đai". Người học không thấy được sợi dây đó thì học mãi vẫn rời rạc.

Ở đây đọc chữ của TỪNG ĐIỀU, tìm mọi chỗ dẫn chiếu, ghi thành hai chiều:
  · dan     = điều này TRỎ TỚI những điều/văn bản nào
  · duocDan = những điều nào TRỎ TỚI điều này  (tính ngược, đây mới là cái quý:
              mở Điều 96 Luật Đất đai là thấy ngay nghị định nào hướng dẫn nó)

Ba dạng dẫn chiếu nhận ra (giống hệt bộ nối chữ ngoài giao diện, để hai bên không lệch):
  1. "Điều 5 của Nghị định số 88/2024/NĐ-CP"   -> (văn bản đó, điều 5)
  2. "Điều 137 của Luật này / Nghị định này"    -> (chính văn bản đang đọc, điều 137)
  3. "88/2024/NĐ-CP" đứng một mình               -> (văn bản đó, không rõ điều)

Chạy:  python dung-lien-ket.py <thu-muc-json>
"""
import sys, os, re, json, glob

RE_DAN = re.compile(
    r'Điều\s+(\d{1,3})\s+(?:của\s+)?(?:Luật|Nghị định|Thông tư)\s+(?:số\s+)?(\d{1,4}/\d{4}/[A-ZĐ][A-ZĐ0-9\-]*)'
    r'|Điều\s+(\d{1,3})(?:\s+của)?\s+(?:Luật|Nghị định|Thông tư)\s+này'
    r'|(\d{1,4}/\d{4}/[A-ZĐ][A-ZĐ0-9\-]*)'
    # DẠNG PHỔ BIẾN NHẤT mà lúc đầu bỏ sót: nghị định trỏ về luật nhưng GỌI TÊN CHỨ KHÔNG
    # GHI SỐ HIỆU — "theo quy định tại khoản 3 Điều 96 của Luật Đất đai". Đã đo: 762 chỗ
    # kiểu này trong kho, tức là gần 2/3 số mối nối nghị định → luật bị mất trắng.
    r'|Điều\s+(\d{1,3})\s+(?:của\s+)?Luật Đất đai(?:\s+năm\s+(\d{4}))?(?!\s*(?:số|\d))')

# "Luật Đất đai" không ghi số hiệu thì hiểu là luật của ĐỜI ĐÓ. Mốc lấy theo NGÀY BAN HÀNH
# của từng đạo luật, KHÔNG lấy ngày có hiệu lực: các nghị định hướng dẫn Luật 2024 đều ký
# tháng 6-7/2024, tức là TRƯỚC ngày luật có hiệu lực 01/8/2024 — lấy theo ngày hiệu lực thì
# cả loạt nghị định 71, 88, 101, 102, 103, 104 bị nối nhầm về Luật 2013.
DOI_LUAT = [('2024-01-18', 'ldd2024'), ('2013-11-29', 'ldd2013'),
            ('2003-11-26', 'ldd2003'), ('1993-07-14', 'ldd1993'), ('0000-00-00', 'ldd1987')]


def luat_dat_dai_luc_do(ngay, nam=None):
    if nam:
        return {'2024': 'ldd2024', '2013': 'ldd2013', '2003': 'ldd2003',
                '1993': 'ldd1993', '1987': 'ldd1987'}.get(nam)
    for moc, ma in DOI_LUAT:
        if (ngay or '9999') >= moc:
            return ma
    return 'ldd2024'


# DÃY ĐIỀU LIỆT KÊ: "quy định chi tiết khoản 3 Điều 87, Điều 92, Điều 94, Điều 95, Điều 96,
# Điều 98 … và Điều 111 của Luật Đất đai". Chỉ có điều CUỐI dính chữ "của Luật Đất đai", nên
# bộ nối thường chỉ bắt được mỗi điều cuối — mất trắng cả dãy. Mà đây lại đúng là chỗ quý
# nhất: điều "Phạm vi điều chỉnh" của nghị định nói thẳng nó hướng dẫn những điều nào của luật.
RE_DAY = re.compile(
    r'((?:Điều\s+\d{1,3}\s*(?:,|và)\s*)+Điều\s+\d{1,3})\s+(?:của\s+)?'
    r'(Luật Đất đai|Luật này|Nghị định này|Thông tư này)')
RE_SO_DIEU = re.compile(r'Điều\s+(\d{1,3})')


def chu_cua_dieu(d):
    return d['tieuDe'] + ' ' + ' '.join(
        k['chu'] + ' ' + ' '.join(x['chu'] for x in k['diem']) for k in d['khoan'])


def lam(thu_muc):
    duong = {os.path.splitext(os.path.basename(f))[0]: f
             for f in glob.glob(os.path.join(thu_muc, '*.json'))
             if not os.path.basename(f).startswith(('_', 'danh-muc', 'giai-thich', 'doi-chieu', 'so-do', 'tinh-huong'))}
    kho = {ma: json.load(open(f, encoding='utf-8')) for ma, f in duong.items()}
    theo_so = {v['soHieu']: ma for ma, v in kho.items()}
    co_dieu = {ma: set(d['so'] for d in v['dieu']) for ma, v in kho.items()}

    nguoc = {}          # (ma, so) -> tập nguồn trỏ tới
    tong = 0
    for ma, v in kho.items():
        for d in v['dieu']:
            ra, thay = [], set()
            chu = chu_cua_dieu(d)
            # Lượt riêng cho dãy điều liệt kê: mở dãy ra thành từng mối nối một.
            cap_day = []
            for m in RE_DAY.finditer(chu):
                dich = (luat_dat_dai_luc_do(v.get('ngay')) if m.group(2) == 'Luật Đất đai' else ma)
                for so in RE_SO_DIEU.findall(m.group(1)):
                    cap_day.append((dich, int(so)))
            for ma2, so2 in cap_day:
                if not ma2 or so2 not in co_dieu.get(ma2, ()) or (ma2, so2) == (ma, d['so']):
                    continue
                khoa = '%s:%s' % (ma2, so2)
                if khoa in thay:
                    continue
                thay.add(khoa)
                ra.append({'ma': ma2, 'so': so2})
                nguoc.setdefault(khoa, set()).add('%s:%d' % (ma, d['so']))
            for m in RE_DAN.finditer(chu):
                if m.group(1) and m.group(2):
                    ma2, so2 = theo_so.get(m.group(2)), int(m.group(1))
                elif m.group(3):
                    ma2, so2 = ma, int(m.group(3))
                elif m.group(5):
                    ma2 = luat_dat_dai_luc_do(v.get('ngay'), m.group(6))
                    so2 = int(m.group(5))
                    if ma2 == ma:                     # chính nó tự gọi tên mình
                        continue
                else:
                    ma2, so2 = theo_so.get(m.group(4)), None
                if not ma2:
                    continue                              # văn bản ngoài kho -> bỏ
                if so2 is not None and so2 not in co_dieu[ma2]:
                    continue                              # điều không có thật -> bỏ
                if (ma2, so2) == (ma, d['so']):
                    continue                              # tự trỏ vào mình -> bỏ
                khoa = '%s:%s' % (ma2, so2 or '')
                if khoa in thay:
                    continue
                thay.add(khoa)
                ra.append({'ma': ma2, 'so': so2} if so2 else {'ma': ma2})
                if so2:
                    nguoc.setdefault('%s:%d' % (ma2, so2), set()).add('%s:%d' % (ma, d['so']))
            d['dan'] = ra
            tong += len(ra)

    for ma, v in kho.items():
        for d in v['dieu']:
            ds = sorted(nguoc.get('%s:%d' % (ma, d['so']), set()))
            d['duocDan'] = [{'ma': x.split(':')[0], 'so': int(x.split(':')[1])} for x in ds]

    for ma, v in kho.items():
        json.dump(v, open(duong[ma], 'w', encoding='utf-8'), ensure_ascii=False)

    # tự kiểm: in ra vài điều được nhắc tới nhiều nhất — đó phải là những điều lõi
    dem = sorted(((len(d['duocDan']), ma, d['so'], d['tieuDe']) for ma, v in kho.items() for d in v['dieu']),
                 reverse=True)[:12]
    print('tong %d moi noi giua cac dieu' % tong)
    print('nhung dieu duoc nhac toi nhieu nhat:')
    for n, ma, so, te in dem:
        sys.stdout.buffer.write(('   %3d lan  %-11s Dieu %-4d %s\n' % (n, ma, so, te[:52])).encode('utf-8', 'replace'))


if __name__ == '__main__':
    lam(sys.argv[1])
