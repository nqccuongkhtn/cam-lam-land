# -*- coding: utf-8 -*-
"""
DỰNG CHUỖI DỌC LUẬT → NGHỊ ĐỊNH → THÔNG TƯ, và chấm ĐIỂM TRỤC cho từng điều.

Hai thứ người làm nghề cần mà cả kho chưa dạy:

1. CHUỖI DỌC. Đọc Điều 137 Luật Đất đai 2024 xong vẫn chưa làm được hồ sơ, vì trình tự
   nằm ở Nghị định 101/2024, mẫu giấy nằm ở Thông tư 10/2024, tiền nằm ở Nghị định 103/2024.
   Đo thật trên kho: Điều 137 được 5 văn bản dưới luật hướng dẫn ở 13 điều khác nhau.
   Không có bảng này thì đọc luật xong vẫn phải mò.

2. ĐIỂM TRỤC. Điều nào bị nhiều điều khác dẫn tới thì là TRỤC của cả mảng, phải học trước.
   Đo thật: Điều 9 (Phân loại đất) bị dẫn tới 36 lần, trong đó 32 lần từ văn bản khác —
   nó là trục lớn nhất của cả hệ thống. Học trục trước rồi mới học chi tiết thì mới có chỗ
   mà móc kiến thức vào; học lộn ngược là học vẹt.

Chạy:  python dung-chuoi-doc.py <thu-muc-json>
"""
import sys, os, json, collections


def nhan(ma, so_hieu):
    if ma.startswith('ldd'):
        return 'Luật Đất đai ' + ma[3:]
    if ma.startswith('lsd'):
        return 'Luật sửa đổi ' + ma[3:]
    if ma.startswith('nd'):
        return 'Nghị định ' + '/'.join(so_hieu.split('/')[:2])
    if ma.startswith('tt'):
        return 'Thông tư ' + '/'.join(so_hieu.split('/')[:2])
    return so_hieu


def lam(thu_muc):
    kho = json.load(open(os.path.join(thu_muc, '_kho.json'), encoding='utf-8'))
    K = {x['ma']: x for x in kho}
    vb = {}
    for x in kho:
        p = os.path.join(thu_muc, x['ma'] + '.json')
        if os.path.exists(p):
            vb[x['ma']] = json.load(open(p, encoding='utf-8'))

    con_hl = {ma for ma in vb if not K[ma].get('biThayTheBoi')}

    # ── Điểm trục: đếm số lần bị dẫn tới ─────────────────────────────────────
    truc = collections.Counter()
    truc_ngoai = collections.Counter()      # chỉ đếm dẫn từ văn bản KHÁC (nặng ký hơn)
    for ma, v in vb.items():
        if ma not in con_hl:
            continue
        for d in v['dieu']:
            for z in (d.get('dan') or []):
                if not z.get('so') or z['ma'] not in con_hl:
                    continue
                k = '%s:%s' % (z['ma'], z['so'])
                truc[k] += 1
                if z['ma'] != ma:
                    truc_ngoai[k] += 1

    # ── Chuỗi dọc: điều dưới luật nào hướng dẫn điều luật nào ────────────────
    chuoi = collections.defaultdict(lambda: collections.defaultdict(set))
    for ma, v in vb.items():
        if ma not in con_hl or ma == 'ldd2024':
            continue
        for d in v['dieu']:
            if (d.get('tinhTrang') or {}).get('loai') == 'het-hieu-luc':
                continue          # điều đã bãi bỏ thì không phải chỗ hướng dẫn nữa
            for z in (d.get('dan') or []):
                if z.get('ma') == 'ldd2024' and z.get('so'):
                    chuoi['ldd2024:%s' % z['so']][ma].add(d['so'])

    ra_chuoi = {}
    for k, theo_vb in chuoi.items():
        ds = []
        for ma, so in sorted(theo_vb.items()):
            ds.append({'ma': ma, 'nhan': nhan(ma, K[ma]['soHieu']),
                       'dieu': sorted(so, key=lambda z: int(z) if str(z).isdigit() else 0)})
        ds.sort(key=lambda z: -len(z['dieu']))
        ra_chuoi[k] = ds

    ra = os.path.join(thu_muc, 'chuoi-doc.json')
    json.dump({'chuoi': ra_chuoi,
               'truc': {k: [truc[k], truc_ngoai[k]] for k in truc if truc[k] >= 2}},
              open(ra, 'w', encoding='utf-8'), ensure_ascii=False)

    print('Da dung %s' % ra)
    print('  %d dieu cua Luat Dat dai 2024 co van ban duoi luat huong dan' % len(ra_chuoi))
    print('  %d dieu co diem truc (bi dan toi tu 2 lan tro len)' % len([k for k in truc if truc[k] >= 2]))
    tie = {'%s:%s' % (ma, d['so']): (d.get('tieuDe') or '')
           for ma, v in vb.items() for d in v['dieu']}
    print('\n  10 dieu duoc HUONG DAN nhieu nhat:')
    for k, ds in sorted(ra_chuoi.items(), key=lambda z: -sum(len(y['dieu']) for y in z[1]))[:10]:
        n = sum(len(y['dieu']) for y in ds)
        sys.stdout.buffer.write(('    %-8s %-46s %d van ban, %d dieu huong dan\n'
                                 % ('Đ' + k.split(':')[1], tie.get(k, '')[:46], len(ds), n))
                                .encode('utf-8', 'replace'))


if __name__ == '__main__':
    lam(sys.argv[1] if len(sys.argv) > 1 else 'apps/frontend/public/luat')
