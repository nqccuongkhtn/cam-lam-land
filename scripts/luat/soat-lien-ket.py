# -*- coding: utf-8 -*-
"""
SOÁT LỖ HỔNG LIÊN KẾT — tự kiểm kho, không cần mạng.

Vì sao làm cái này thay vì chép lược đồ của trang khác: chữ luật mình có là bản PDF ký số
của Công báo, tức là NGUỒN GỐC. Lược đồ của các trang tra cứu cũng chỉ là người ta đọc
chính mấy chữ đó rồi lập ra. Nên thay vì chép lại chỉ mục của người khác, mình soát chính
mình — và soát được những thứ chỉ máy mới thấy:

  1. QUAN HỆ MỘT CHIỀU — A ghi "thay thế B" mà B không ghi "bị thay thế bởi A" (hoặc ngược
     lại). Lược đồ thật luôn đối xứng; lệch là một bên đọc sót.
  2. DẪN CHIẾU CHẾT — điều này dẫn tới Điều N của văn bản kia mà bên đó không có Điều N.
  3. SỬA ĐỔI KHÔNG NGƯỜI NHẬN — văn bản sửa đổi nói sửa cái gì đó mà không gắn được vào đâu.
  4. VĂN BẢN CÔ ĐỘC — nằm trong kho mà không có một quan hệ nào, thường là dấu hiệu đọc sót.
  5. ĐIỀU HẾT HIỆU LỰC MÀ VẪN ĐƯỢC DẪN — chỗ này nguy: đọc theo là làm sai hồ sơ.

Chạy:  python soat-lien-ket.py <thu-muc-json>
"""
import sys, os, json, collections


def lam(thu_muc):
    kho = json.load(open(os.path.join(thu_muc, '_kho.json'), encoding='utf-8'))
    K = {x['ma']: x for x in kho}
    vb = {}
    for x in kho:
        p = os.path.join(thu_muc, x['ma'] + '.json')
        if os.path.exists(p):
            vb[x['ma']] = json.load(open(p, encoding='utf-8'))

    def dieu_co(ma):
        return set(str(d['so']) for d in vb[ma]['dieu']) if ma in vb else set()

    loi = collections.defaultdict(list)

    # 1. Quan hệ phải đối xứng
    CAP = [('thayThe', 'biThayTheBoi'), ('canCu', 'laCanCuCho')]
    for ma, k in K.items():
        for xuoi, nguoc in CAP:
            for m2 in (k.get(xuoi) or []):
                if m2 in K and ma not in (K[m2].get(nguoc) or []):
                    loi['1. Quan he mot chieu'].append(
                        '%s ghi "%s: %s" nhung %s khong ghi nguoc lai' % (k['soHieu'], xuoi, m2, m2))
        for m2 in (k.get('biBaiBoMotPhanBoi') or []):
            if m2 in K and ma not in [z['ma'] for z in (K[m2].get('baiBoMotPhan') or [])]:
                loi['1. Quan he mot chieu'].append(
                    '%s bi %s bai bo mot phan nhung ben kia khong ghi' % (k['soHieu'], m2))

    # 2. Dẫn chiếu chết
    for ma, v in vb.items():
        for d in v['dieu']:
            for z in (d.get('dan') or []):
                if z.get('ma') in vb and z.get('so') and str(z['so']) not in dieu_co(z['ma']):
                    loi['2. Dan chieu chet'].append(
                        '%s Dieu %s -> %s Dieu %s (khong ton tai)' % (K[ma]['soHieu'], d['so'],
                                                                      K[z['ma']]['soHieu'], z['so']))

    # 3. Sửa đổi không người nhận
    for ma, v in vb.items():
        for d in v['dieu']:
            for z in (d.get('suaDoiCho') or []):
                if not z.get('ma'):
                    loi['3. Sua doi van ban ngoai kho'].append(
                        '%s Dieu %s sua %s (%s) - van ban do khong co trong kho'
                        % (K[ma]['soHieu'], d['so'], z.get('soHieu') or '?', z.get('phamVi', '')[:40]))

    # 4. Văn bản cô độc
    for ma, k in K.items():
        n = sum(len(k.get(t) or []) for t in ('canCu', 'laCanCuCho', 'thayThe', 'biThayTheBoi',
                                              'baiBoMotPhan', 'biBaiBoMotPhanBoi', 'dan', 'duocDan'))
        if n == 0:
            loi['4. Van ban co doc'].append('%s (%s)' % (k['soHieu'], k['ten'][:50]))

    # 5. Điều đã hết hiệu lực mà vẫn được văn bản khác dẫn tới
    for ma, v in vb.items():
        for d in v['dieu']:
            if (d.get('tinhTrang') or {}).get('loai') != 'het-hieu-luc':
                continue
            if d.get('duocDan'):
                loi['5. Dieu het hieu luc van bi dan toi'].append(
                    '%s Dieu %s (het hieu luc %s) van duoc %d cho dan toi'
                    % (K[ma]['soHieu'], d['so'], (d['tinhTrang'].get('tuNgay') or '')[:10],
                       len(d['duocDan'])))

    tong = sum(len(v) for v in loi.values())
    print('=== SOAT LIEN KET: %d van ban, %d dieu ==='
          % (len(vb), sum(len(v['dieu']) for v in vb.values())))
    if not tong:
        print('Khong thay lo hong nao.')
    for nhom in sorted(loi):
        ds = loi[nhom]
        print('\n%s -- %d cho:' % (nhom, len(ds)))
        for x in ds[:12]:
            sys.stdout.buffer.write(('   - %s\n' % x).encode('utf-8', 'replace'))
        if len(ds) > 12:
            print('   ... va %d cho nua' % (len(ds) - 12))
    return tong


if __name__ == '__main__':
    lam(sys.argv[1] if len(sys.argv) > 1 else 'apps/frontend/public/luat')
