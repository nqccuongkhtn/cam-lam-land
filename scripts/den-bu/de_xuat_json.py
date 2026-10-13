# -*- coding: utf-8 -*-
"""
DUNG FILE JSON DE XUAT (cung khuon voi file web: {pl?, nhom, phu, ketCau, ten, dv, gia}) tu ban boc CHINH THUC
(qd12-chinh-thuc.json / qd08-chinh-thuc.json do doi_chieu.py sinh ra). KHONG ghi vao du an — chi de xuat.

Dung: python -I de_xuat_json.py <qd12-chinh-thuc.json> <qd08-chinh-thuc.json> <thu_muc_ra>
"""
import sys, io, json, re, collections

sys.stdout.reconfigure(encoding='utf-8')


def ghi(p, ds):
    io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(ds, ensure_ascii=False, indent=1) + '\n')


def qd12(ct):
    ra, bo = [], []
    for x in ct:
        if x['gia'] is None:
            bo.append(x)
            continue
        nhom = x['nhom']
        if x['pl'] == 'II':
            nhom = re.sub(r'\s*\(mộ được xây dựng.*\)$', '', nhom)  # rut gon tieu de muc A
        phu = x['cha'] or x['nhomPhu'].rstrip(':')
        ra.append({'pl': x['pl'], 'nhom': nhom, 'phu': phu, 'ketCau': '', 'ten': x['ten'], 'dv': x['dv'], 'gia': x['gia']})
    # 5 khoan cong them ghi trong muc "Luu y" cua Phu luc II (khong nam trong cot gia nen boc tay tu cau chu)
    them = [
        ('Quách gỗ 30x60, vàng bạc, trà lót đáy, vải bao cốt', 'cốt (cái)', 664800),
        ('Quách gỗ 40x80, vàng bạc, trà lót đáy, vải bao cốt', 'cốt (cái)', 886400),
        ('Chi phí mua bia mộ, vật tư, lễ cúng, thuê người cúng', 'mộ (cái)', 2500000),
        ('Chi phí công đào + bốc hài cốt', 'mộ (cái)', 1800000),
        ('Chi phí lắp hoàn thổ', 'mộ (cái)', 700000),
    ]
    vt = max(i for i, x in enumerate(ra) if x['pl'] == 'II') + 1
    for k, (ten, dv, gia) in enumerate(them):
        ra.insert(vt + k, {'pl': 'II', 'nhom': 'Chi phí cộng thêm nếu có thực hiện (mục "Lưu ý" Phụ lục II)', 'phu': '',
                           'ketCau': 'Đơn giá mộ ở trên CHƯA gồm khoản này', 'ten': ten, 'dv': dv, 'gia': gia})
    return ra, bo


# QD 08: pham vi dong tieu de nho theo STT (van ban chi dat 1 dong tieu de roi viet tiep, khong dong lai)
def pham_vi_08(stt):
    m = re.match(r'^(\d+)', stt or '')
    if not m:
        return None
    n = int(m.group(1))
    for a, b, ten in ((21, 36, 'GIẾNG NƯỚC'), (37, 47, 'HỒ CHỨA, BỂ CHỨA NƯỚC'), (48, 53, 'KHỐI XÂY, KHỐI BÊ TÔNG'),
                      (54, 58, 'SÀN GỖ'), (76, 78, 'CHÒI'), (87, 87, 'CHUỒNG TRẠI'), (88, 88, 'MƯƠNG')):
        if a <= n <= b:
            return ten
    return ''


def qd08(ct):
    ra = []
    stt_cha = ''
    for x in ct:
        nhom = x['nhom']
        if nhom == 'HẠNG MỤC CÔNG TRÌNH':
            stt = x['stt'] or stt_cha
            pv = pham_vi_08(stt)
            if pv:
                nhom = 'HẠNG MỤC CÔNG TRÌNH — ' + pv
        if x['stt'] and re.match(r'^\d', x['stt']):
            stt_cha = x['stt']
        if nhom.startswith('CÔNG TRÌNH, NHÀ Ở') :
            phu = x['nhomPhu'] if x['nhomPhu'] not in ('Nhà ở',) else ''
            if x['cha'] == 'Nhà tiền chế' or (x['cha'] and not x['ketCau']):
                phu = x['cha']
            elif not x['ketCau'] and x['nhomPhu'] == 'Các loại nhà ở khác':
                phu = 'Các loại nhà ở khác'
        else:
            phu = x['cha']
        ra.append({'nhom': nhom, 'phu': phu, 'ketCau': x['ketCau'], 'ten': x['ten'], 'dv': x['dv'], 'gia': x['gia']})
    return ra


def main(f12, f08, ra_dir):
    ct12 = json.load(io.open(f12, encoding='utf-8'))
    ct08 = json.load(io.open(f08, encoding='utf-8'))
    # QD 08: can biet STT cha cho hang con (stt rong) -> lay tu hang truoc trong ban boc
    r12, bo12 = qd12(ct12)
    r08 = qd08(ct08)
    ghi(ra_dir + '/de-xuat-den-bu-chi-phi-qd12.json', r12)
    ghi(ra_dir + '/de-xuat-den-bu-nha-qd08.json', r08)
    print('QD12 de xuat:', len(r12), dict(collections.Counter(x['pl'] for x in r12)), '| bo ra (gia viet sai):', [(b['ten'], b['giaGoc']) for b in bo12])
    print('QD08 de xuat:', len(r08), dict(collections.Counter(x['nhom'] for x in r08)))


if __name__ == '__main__':
    main(*sys.argv[1:])
