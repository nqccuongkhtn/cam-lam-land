# -*- coding: utf-8 -*-
"""
NÂNG SƠ ĐỒ TƯ DUY CHO KHỚP LỘ TRÌNH HỌC.

Trước đây sơ đồ 8 nhánh, lộ trình học 11 chặng — hai thứ rời nhau, học xong một chặng mở
sơ đồ ra không biết mình vừa học nhánh nào. Nay tách cho khớp một-một:

  Nhánh "Đăng ký đất đai · Cấp Giấy chứng nhận"  ->  tách 2: Cấp Giấy chứng nhận | Đăng ký biến động
  Nhánh "Thu hồi đất · Bồi thường..."            ->  tách 2: Thu hồi đất | Bồi thường, hỗ trợ, tái định cư
Đúng bốn việc chủ dự án nói là trọng tâm.

Và mỗi ô được BỔ SUNG CHUỖI DỌC: ngoài điều luật, thêm nút dẫn tới đúng điều của nghị định,
thông tư hướng dẫn điều đó (lấy từ chuoi-doc.json). Vì đọc Điều 137 xong vẫn chưa làm được
hồ sơ — trình tự ở Nghị định 101/2024, mẫu giấy ở Thông tư 10/2024, tiền ở Nghị định 103/2024.

KHÔNG viết lại nội dung cũ. Chữ trong các ô là chữ đã soạn và đã soát kỹ, script chỉ tách
nhánh, thêm ô mới và nối thêm nút dẫn.

Chạy:  python nang-so-do.py <thu-muc-json>
"""
import sys, os, json


def o(ten, y, chiTiet, *dan):
    ds = [{'ma': d[0], 'so': d[1]} if isinstance(d, tuple) else {'ma': d} for d in dan]
    x = {'ten': ten, 'y': y, 'dan': ds}
    if chiTiet:
        x['chiTiet'] = chiTiet
    return x


# Các ô mới cho nhánh Đăng ký biến động — nội dung bám nguyên văn Điều 133.
O_BIEN_DONG = [
    o('Đăng ký biến động — 16 trường hợp',
      'Khoản 1 Điều 133 liệt kê 16 điểm (a → q). Thửa đã có Giấy chứng nhận, về sau có thay đổi gì là đăng ký biến động.',
      'Hay gặp nhất: thực hiện quyền chuyển đổi, chuyển nhượng, thừa kế, tặng cho, thế chấp, góp vốn (điểm a) · '
      'đổi tên (điểm b) · thay đổi thông tin người sử dụng đất (điểm c) · thay đổi ranh giới, kích thước, diện '
      'tích, số hiệu, địa chỉ thửa đất (điểm d) · đăng ký quyền sở hữu tài sản gắn liền với đất (điểm đ) · '
      'chuyển mục đích sử dụng đất (điểm e) · thay đổi thời hạn sử dụng đất (điểm g) · cấp đổi, cấp lại Giấy '
      'chứng nhận (điểm n) · thế chấp (điểm p).',
      ('ldd2024', 133)),
    o('Bảy trường hợp BẮT BUỘC trong 30 ngày',
      '🔑 Khoản 3 Điều 133: chỉ 7 điểm a, b, i, k, l, m, q phải đăng ký trong 30 ngày kể từ ngày có biến động.',
      'Bảy chữ cái này phải thuộc lòng — quá hạn bị xử phạt theo Nghị định 123/2024. Chín trường hợp còn lại '
      'không bị ràng thời hạn 30 ngày, nhưng chưa đăng ký thì chưa thực hiện được quyền.',
      ('ldd2024', 133), 'nd123-2024'),
    o('Giấy chứng nhận đã cấp thì xử lý thế nào',
      'Điều 134: xác nhận thay đổi trên giấy đã cấp, hoặc cấp mới Giấy chứng nhận — tuỳ trường hợp.',
      'Cách ghi từng mục khi xác nhận biến động nằm ở Thông tư 10/2024.',
      ('ldd2024', 134), 'tt10-2024'),
    o('Trình tự, hồ sơ, thời hạn giải quyết',
      'Nghị định 101/2024 quy định trình tự đăng ký biến động, cấp đổi, cấp lại.',
      '⚠️ Nghị định 151/2025 (hiệu lực 01/7/2025) đã bãi bỏ một loạt điều của Nghị định 101/2024 về nơi nộp '
      'hồ sơ, thời hạn giải quyết và toàn bộ Mẫu 01/ĐK → 14/ĐK. Thời hạn và mẫu đơn hiện hành phải lấy ở Phụ '
      'lục Nghị định 151/2025, đừng dùng bản cũ.',
      'nd101-2024', 'nd151-2025'),
]


def lam(thu_muc):
    p_sd = os.path.join(thu_muc, 'so-do.json')
    sd = json.load(open(p_sd, encoding='utf-8'))
    nhanh = sd['nhanh']
    if len(nhanh) >= 10:
        print('So do da tach roi, khong lam lai.')
        return

    ten = [n['ten'] for n in nhanh]
    i_dk = next(i for i, t in enumerate(ten) if t.startswith('Đăng ký đất đai'))
    i_th = next(i for i, t in enumerate(ten) if t.startswith('Thu hồi đất'))

    # ── Tách nhánh Đăng ký / Cấp Giấy chứng nhận ─────────────────────────────
    cu = nhanh[i_dk]
    cap = {
        'ten': 'Cấp Giấy chứng nhận', 'icon': '📗', 'mau': 'emerald', 'neo': '4 trường hợp · 3 mốc',
        'y': cu['y'],
        'con': [c for c in cu['con'] if not c['ten'].startswith('Nguyên tắc đăng ký')],
    }
    bd = {
        'ten': 'Đăng ký biến động', 'icon': '🔄', 'mau': 'sky', 'neo': '16 trường hợp · 7 cái bắt buộc 30 ngày',
        'y': 'Thửa đã có Giấy chứng nhận rồi, về sau có thay đổi gì thì phải đăng ký biến động. '
             'Nhớ kỹ 7 trường hợp bắt buộc làm trong 30 ngày.',
        'con': [c for c in cu['con'] if c['ten'].startswith('Nguyên tắc đăng ký')] + O_BIEN_DONG,
    }

    # ── Tách nhánh Thu hồi / Bồi thường ──────────────────────────────────────
    cu2 = nhanh[i_th]
    th = {
        'ten': 'Thu hồi đất', 'icon': '🚧', 'mau': 'rose', 'neo': '3 nhóm căn cứ',
        'y': 'Nhà nước lấy lại đất trong những trường hợp nào, theo trình tự nào.',
        'con': [c for c in cu2['con'] if c['ten'].startswith('1.')],
    }
    bt = {
        'ten': 'Bồi thường, hỗ trợ, tái định cư', 'icon': '💰', 'mau': 'amber', 'neo': '6 bước',
        'y': cu2['y'],
        'con': [c for c in cu2['con'] if not c['ten'].startswith('1.')],
    }

    moi = []
    for i, n in enumerate(nhanh):
        if i == i_dk:
            moi += [cap, bd]
        elif i == i_th:
            moi += [th, bt]
        else:
            moi.append(n)

    # ── Bổ sung CHUỖI DỌC vào từng ô ─────────────────────────────────────────
    p_cd = os.path.join(thu_muc, 'chuoi-doc.json')
    them = 0
    if os.path.exists(p_cd):
        chuoi = json.load(open(p_cd, encoding='utf-8'))['chuoi']
        for n in moi:
            for c in n['con']:
                co = {(d['ma'], d.get('so')) for d in c['dan']}
                for d in list(c['dan']):
                    if d['ma'] != 'ldd2024' or not d.get('so'):
                        continue
                    for y in (chuoi.get('ldd2024:%s' % d['so']) or [])[:2]:
                        for so in y['dieu'][:1]:
                            if (y['ma'], so) in co or len(c['dan']) >= 8:
                                continue
                            c['dan'].append({'ma': y['ma'], 'so': so})
                            co.add((y['ma'], so))
                            them += 1

    sd['nhanh'] = moi
    json.dump(sd, open(p_sd, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('So do: %d nhanh -> %d nhanh, them %d nut dan toi van ban huong dan'
          % (len(nhanh), len(moi), them))
    for i, n in enumerate(moi):
        sys.stdout.buffer.write(('  %2d. %-52s %d o, %d nut dan\n'
                                 % (i + 1, n['ten'][:52], len(n['con']),
                                    sum(len(c['dan']) for c in n['con'])))
                                .encode('utf-8', 'replace'))


if __name__ == '__main__':
    lam(sys.argv[1] if len(sys.argv) > 1 else 'apps/frontend/public/luat')
