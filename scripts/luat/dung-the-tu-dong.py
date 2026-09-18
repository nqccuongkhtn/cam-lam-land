# -*- coding: utf-8 -*-
"""
SINH THẺ ÔN TẬP TỰ ĐỘNG TỪ CHÍNH KHO LUẬT.

Trước đây thẻ chỉ có 200 cái, mà 127 trong đó là soạn tay — nên phủ được 19% Luật Đất đai
2024 là hết. Học 19% thì không thể "sâu rộng".

Kho đã có sẵn 4 thứ chưa dùng tới, đều là dữ liệu ĐÃ KIỂM CHỨNG chứ không phải bịa:
  1. Tiêu đề chính thức của 1.468 điều  -> thẻ "quy định này nằm ở điều nào"
  2. Tình trạng hiệu lực từng điều      -> thẻ "điều này còn dùng được không"  ← nguy nhất nếu không biết
  3. Nội dung sửa đổi kèm nguyên văn    -> thẻ "điều này bị sửa thế nào"
  4. Thuộc tính 22 văn bản              -> thẻ "văn bản này quy định gì, hiệu lực từ bao giờ"

Nguyên tắc: HỎI VÀ ĐÁP ĐỀU LÀ CHỮ CỦA LUẬT. Không tự diễn giải, không tự tóm tắt — chỗ nào
cần giải thích thì đã có bộ thẻ soạn tay lo.

Chạy:  python dung-the-tu-dong.py <thu-muc-json>
"""
import sys, os, re, json

# Sinh thẻ cho MỌI văn bản CÒN HIỆU LỰC. Trước đây chỉ lấy 6 văn bản nên Thông tư
# 10/2024 (45 điều: mẫu Giấy chứng nhận, cách ghi từng mục, hồ sơ địa chính) chỉ có
# đúng 1 thẻ — mà đó lại là thứ dùng hằng ngày khi làm hồ sơ cấp giấy.
# Văn bản đã hết hiệu lực thì không sinh thẻ tra điều (học chữ đã bỏ là học sai),
# chúng chỉ xuất hiện ở nhóm thẻ "điều này còn dùng được không".
def van_ban_chinh(kho):
    return [x['ma'] for x in kho if not x.get('biThayTheBoi')]

# Điều "thủ tục" của mọi văn bản — không có nội dung để học
BO_QUA = re.compile(r'^(Hiệu lực thi hành|Điều khoản thi hành|Trách nhiệm thi hành|'
                    r'Quy định chuyển tiếp|Tổ chức thực hiện|Phạm vi điều chỉnh|Đối tượng áp dụng)$', re.I)


def nhan_ngan(ma, so_hieu):
    if ma.startswith('ldd'):
        return 'Luật Đất đai ' + ma[3:]
    if ma.startswith('lsd'):
        return 'Luật sửa đổi ' + ma[3:]
    if re.match(r'^l\d', ma):                 # l43-2024 -> Luật 43/2024
        return 'Luật ' + so_hieu.split('/')[0] + '/' + so_hieu.split('/')[1]
    if ma.startswith('nd'):
        return 'Nghị định ' + so_hieu.split('/')[0] + '/' + so_hieu.split('/')[1]
    if ma.startswith('tt'):
        return 'Thông tư ' + so_hieu.split('/')[0] + '/' + so_hieu.split('/')[1]
    return so_hieu


def ngay_vn(s):
    if not s or len(s) < 10:
        return ''
    n, t, g = s[:4], s[5:7], s[8:10]
    return '%s/%s/%s' % (g, t, n)


def lam(thu_muc):
    kho = json.load(open(os.path.join(thu_muc, '_kho.json'), encoding='utf-8'))
    K = {x['ma']: x for x in kho}
    gt = json.load(open(os.path.join(thu_muc, 'giai-thich.json'), encoding='utf-8'))['muc']
    vb = {}
    for x in kho:
        p = os.path.join(thu_muc, x['ma'] + '.json')
        if os.path.exists(p):
            vb[x['ma']] = json.load(open(p, encoding='utf-8'))

    the = []

    # ── 1. Quy định này nằm ở điều nào ───────────────────────────────────────
    # Hỏi ngược từ NỘI DUNG sang SỐ ĐIỀU — đây mới là việc người làm nghề cần:
    # gặp một vướng mắc thì phải biết mở điều nào ra đọc.
    for ma in van_ban_chinh(kho):
        if ma not in vb:
            continue
        nhan = nhan_ngan(ma, K[ma]['soHieu'])
        for d in vb[ma]['dieu']:
            tie = (d.get('tieuDe') or '').strip()
            if not tie or BO_QUA.match(tie) or len(tie) < 12:
                continue
            if (d.get('tinhTrang') or {}).get('loai') == 'het-hieu-luc':
                continue                      # điều đã bỏ thì học ở nhóm 2, không học ở đây
            if gt.get('%s:%s' % (ma, d['so'])):
                continue                      # đã có thẻ soạn tay giải thích kỹ hơn
            chuong = (d.get('chuongTen') or '').strip()
            # ── HỌC KÈM ──
            # Chủ dự án nói đúng: "điều chương này nhưng liên kết tới chương khác, chúng nó
            # đều liên kết với nhau". Nên mỗi thẻ kéo theo tối đa 4 điều mà nó DẪN TỚI —
            # đọc Điều 95 (điều kiện được bồi thường) là thấy ngay nó ném sang Điều 101
            # (không được bồi thường) và Điều 107 (chi phí đầu tư còn lại).
            kem, dan = [], [{'ma': ma, 'so': d['so']}]
            for z in (d.get('dan') or []):
                if not z.get('so') or (z['ma'] == ma and z['so'] == d['so']):
                    continue
                if len(kem) >= 4:
                    break
                nh2 = nhan_ngan(z['ma'], K[z['ma']]['soHieu']) if z['ma'] in K else z['ma']
                nhan_kem = 'Điều %s' % z['so'] + ('' if z['ma'] == ma else ' %s' % nh2)
                if nhan_kem in kem:
                    continue
                kem.append(nhan_kem)
                dan.append({'ma': z['ma'], 'so': z['so']})
            the.append({
                'khoa': 'dieu-o-dau:%s:%s' % (ma, d['so']), 'loai': 'Tra điều',
                'chuDe': (chuong[:44] if chuong else nhan),
                'hoi': 'Quy định về “%s” nằm ở điều nào của %s?' % (tie, nhan),
                'dap': ('Điều %s %s.%s' % (d['so'], nhan, (' Thuộc %s.' % chuong) if chuong else ''))
                       + (' Điều này dẫn tới: %s — đọc kèm mới đủ.' % ', '.join(kem) if kem else ''),
                'nho': 'Điều %s' % d['so'],
                'dan': dan,
            })

    # ── 2. Điều này còn dùng được không ──────────────────────────────────────
    # Nhóm nguy hiểm nhất: đọc một điều đã bị bãi bỏ rồi làm theo là hỏng cả bộ hồ sơ.
    for ma, v in vb.items():
        for d in v['dieu']:
            tt = d.get('tinhTrang')
            if not tt:
                continue
            nhan = nhan_ngan(ma, K[ma]['soHieu'])
            boi = nhan_ngan(tt['boi'], K[tt['boi']]['soHieu']) if tt['boi'] in K else tt['boi']
            tie = (d.get('tieuDe') or '').strip()
            if tt['loai'] == 'het-hieu-luc':
                dap = ('KHÔNG. Điều này đã HẾT HIỆU LỰC từ %s, bị %s bãi bỏ. '
                       'Đọc để tra hồ sơ thời kỳ trước thì được, làm theo là sai.'
                       % (ngay_vn(tt.get('tuNgay')), boi))
                nho = 'Hết hiệu lực %s' % ngay_vn(tt.get('tuNgay'))
            elif tt['loai'] == 'bai-bo-mot-phan':
                dap = ('Còn, nhưng BỊ BÃI BỎ MỘT PHẦN từ %s bởi %s. Phần bị bãi bỏ: %s'
                       % (ngay_vn(tt.get('tuNgay')), boi, tt.get('phan') or '(xem văn bản đó)'))
                nho = 'Bãi bỏ một phần %s' % ngay_vn(tt.get('tuNgay'))
            else:
                dap = ('Còn, nhưng ĐÃ BỊ SỬA ĐỔI, BỔ SUNG từ %s bởi %s. Phải đọc kèm bản sửa đổi.'
                       % (ngay_vn(tt.get('tuNgay')), boi))
                nho = 'Đã bị sửa đổi %s' % ngay_vn(tt.get('tuNgay'))
            the.append({
                'khoa': 'hieu-luc:%s:%s' % (ma, d['so']), 'loai': 'Hiệu lực',
                'chuDe': 'Điều đã bị bãi bỏ / sửa đổi',
                'hoi': 'Điều %s %s%s — còn dùng được không?'
                       % (d['so'], nhan, (' (%s)' % tie) if tie else ''),
                'dap': dap, 'nho': nho,
                'dan': [{'ma': ma, 'so': d['so']}, {'ma': tt['boi']}],
            })

    # ── 3. Điều này bị sửa thế nào ───────────────────────────────────────────
    for ma, v in vb.items():
        for d in v['dieu']:
            for i, sd in enumerate(d.get('suaDoi') or []):
                if not sd.get('noiDungMoi'):
                    continue
                nhan = nhan_ngan(ma, K[ma]['soHieu'])
                boi = nhan_ngan(sd['boi'], K[sd['boi']]['soHieu']) if sd['boi'] in K else sd['boi']
                moi = re.sub(r'\s+', ' ', sd['noiDungMoi']).strip()
                the.append({
                    'khoa': 'sua-doi:%s:%s:%d' % (ma, d['so'], i), 'loai': 'Sửa đổi',
                    'chuDe': 'Nội dung đã bị sửa đổi',
                    'hoi': '%s của %s bị sửa đổi bởi văn bản nào, nội dung mới ra sao?'
                           % (sd.get('phamVi') or ('Điều %s' % d['so']), nhan),
                    'dap': 'Bởi khoản %s Điều %s %s, có hiệu lực từ %s. Nguyên văn đoạn mới: %s'
                           % (sd['boiKhoan'], sd['boiDieu'], boi, ngay_vn(sd.get('tuNgay')),
                              moi[:600] + ('…' if len(moi) > 600 else '')),
                    'nho': '%s sửa, từ %s' % (boi, ngay_vn(sd.get('tuNgay'))),
                    'dan': [{'ma': ma, 'so': d['so']}, {'ma': sd['boi'], 'so': sd['boiDieu']}],
                })

    # ── 4. Văn bản này là gì ─────────────────────────────────────────────────
    for x in kho:
        nhan = nhan_ngan(x['ma'], x['soHieu'])
        con = 'ĐÃ HẾT HIỆU LỰC' if x.get('biThayTheBoi') else 'còn hiệu lực'
        the.append({
            'khoa': 'van-ban:' + x['ma'], 'loai': 'Văn bản',
            'chuDe': 'Kho văn bản',
            'hoi': '%s quy định về việc gì, hiệu lực từ bao giờ?' % nhan,
            'dap': '%s. Số hiệu %s, ban hành %s, hiệu lực từ %s — hiện %s. Gồm %d điều.'
                   % (x['ten'], x['soHieu'], ngay_vn(x['ngay']),
                      ngay_vn(x.get('ngayHieuLuc') or x['ngay']), con, x['soDieu']),
            'nho': '%s · %s' % (x['soHieu'], ngay_vn(x.get('ngayHieuLuc') or x['ngay'])),
            'dan': [{'ma': x['ma']}],
        })

    ra = os.path.join(thu_muc, 'the-tu-dong.json')
    json.dump({'the': the}, open(ra, 'w', encoding='utf-8'), ensure_ascii=False)
    nhom = {}
    for t in the:
        nhom[t['loai']] = nhom.get(t['loai'], 0) + 1
    print('Da sinh %d the -> %s' % (len(the), ra))
    for k, n in sorted(nhom.items(), key=lambda z: -z[1]):
        print('   %-12s %4d the' % (k, n))
    cd = {}
    for t in the:
        cd[t['chuDe']] = cd.get(t['chuDe'], 0) + 1
    print('   %d chu de' % len(cd))


if __name__ == '__main__':
    lam(sys.argv[1] if len(sys.argv) > 1 else 'apps/frontend/public/luat')
