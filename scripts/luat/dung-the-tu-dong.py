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

# Chỉ sinh thẻ tiêu đề điều cho những văn bản người dùng thật sự tra hằng ngày.
# Sinh cho cả 1.468 điều thì loãng, mà phần lớn là điều kỹ thuật không ai tra tới.
VB_CHINH = ['ldd2024', 'nd101-2024', 'nd102-2024', 'nd88-2024', 'nd103-2024', 'nd71-2024']

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
    for ma in VB_CHINH:
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
            the.append({
                'khoa': 'dieu-o-dau:%s:%s' % (ma, d['so']), 'loai': 'Tra điều',
                'chuDe': (chuong[:44] if chuong else nhan),
                'hoi': 'Quy định về “%s” nằm ở điều nào của %s?' % (tie, nhan),
                'dap': 'Điều %s %s.%s' % (d['so'], nhan, (' Thuộc %s.' % chuong) if chuong else ''),
                'nho': 'Điều %s' % d['so'],
                'dan': [{'ma': ma, 'so': d['so']}],
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
