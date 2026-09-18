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
    r'|(\d{1,4}/\d{4}/[A-ZĐ][A-ZĐ0-9\-]*)')


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
            for m in RE_DAN.finditer(chu_cua_dieu(d)):
                if m.group(1) and m.group(2):
                    ma2, so2 = theo_so.get(m.group(2)), int(m.group(1))
                elif m.group(3):
                    ma2, so2 = ma, int(m.group(3))
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
