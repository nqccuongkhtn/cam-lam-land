# -*- coding: utf-8 -*-
"""
VÁ LƯỢC ĐỒ CHO CÁC ĐỜI LUẬT CŨ.

Bộ soát (soat-lien-ket.py) chỉ ra 4 văn bản nằm trong kho mà KHÔNG có một quan hệ nào:
Luật Đất đai 1987, Luật Đất đai 1993, Luật sửa đổi 1998, Luật sửa đổi 2001. Nghĩa là mở
Luật 1993 ra thì không thấy nó thay thế luật nào, bị luật nào thay, ai sửa nó — đứt hẳn
dây chuyền các đời luật mà chủ dự án muốn giữ để tra cứu.

VÌ SAO SÓT: bộ dựng lược đồ tra theo SỐ HIỆU. Mà luật đời cũ tuyên bố thay thế nhau bằng
TÊN + NĂM, không kèm số hiệu:
    Luật 2003 Điều 145: "Luật này thay thế Luật đất đai năm 1993; Luật sửa đổi, bổ sung
                         một số điều của Luật đất đai năm 1998; … năm 2001."
    Luật 1993 Điều 88 : "Luật này thay thế Luật đất đai … thông qua ngày 29 tháng 12 năm 1987."
Tra theo số hiệu thì không khớp chữ nào, nên bỏ qua sạch.

CÁCH VÁ: nhận diện theo TÊN + NĂM, rồi ghi quan hệ cho cả hai chiều. Thêm hai quan hệ mới
mà lược đồ chưa có: "sửa đổi" và "bị sửa đổi bởi" — lấy thẳng từ kết quả của
dung-sua-doi-dieu.py, nên không đoán mò.

Chạy SAU dung-luoc-do.py và dung-sua-doi-dieu.py:
    python va-luoc-do-doi-cu.py <thu-muc-json>
"""
import sys, os, re, json

# Nhận diện "Luật đất đai năm 1993" / "thông qua ngày 29 tháng 12 năm 1987"
NAM_LUAT = {'1987': 'ldd1987', '1993': 'ldd1993', '2003': 'ldd2003',
            '2013': 'ldd2013', '2024': 'ldd2024'}
NAM_SUA = {'1998': 'lsd1998', '2001': 'lsd2001'}


def nhan_dien(cau):
    """Trả danh sách mã văn bản mà câu này nhắc tới bằng tên + năm."""
    ra = []
    for m in re.finditer(r'Luật\s+sửa đổi[^.;]{0,90}?Luật\s+đất đai\s+năm\s+(\d{4})', cau, re.I):
        if m.group(1) in NAM_SUA:
            ra.append(NAM_SUA[m.group(1)])
    cau2 = re.sub(r'Luật\s+sửa đổi[^.;]{0,90}?Luật\s+đất đai\s+năm\s+\d{4}', ' ', cau, flags=re.I)
    for m in re.finditer(r'Luật\s+đất đai[^.;]{0,120}?(?:năm|ngày[^.;]{0,30}?năm)\s+(\d{4})', cau2, re.I):
        if m.group(1) in NAM_LUAT:
            ra.append(NAM_LUAT[m.group(1)])
    return ra


def them(k, truong, ma):
    if ma and ma not in k.setdefault(truong, []):
        k[truong].append(ma)
        return True
    return False


def lam(thu_muc):
    p_kho = os.path.join(thu_muc, '_kho.json')
    kho = json.load(open(p_kho, encoding='utf-8'))
    K = {x['ma']: x for x in kho}
    dem = 0

    # ── 1. "Luật này thay thế …" ở điều hiệu lực ──────────────────────────────
    for ma in list(K):
        p = os.path.join(thu_muc, ma + '.json')
        if not os.path.exists(p):
            continue
        v = json.load(open(p, encoding='utf-8'))
        for d in v['dieu']:
            chu = ' '.join(k['chu'] for k in d['khoan'])
            for m in re.finditer(r'Luật này thay thế([^.]{0,400})', chu, re.I):
                for ma2 in nhan_dien(m.group(1)):
                    if ma2 == ma or ma2 not in K:
                        continue
                    dem += them(K[ma], 'thayThe', ma2)
                    dem += them(K[ma2], 'biThayTheBoi', ma)

    # ── 2. "sửa đổi / bị sửa đổi bởi" — lấy từ kết quả tách sửa đổi từng điều ──
    for ma in list(K):
        p = os.path.join(thu_muc, ma + '.json')
        if not os.path.exists(p):
            continue
        v = json.load(open(p, encoding='utf-8'))
        for d in v['dieu']:
            for z in (d.get('suaDoiCho') or []):
                ma2 = z.get('ma')
                if not ma2 or ma2 not in K or ma2 == ma:
                    continue
                dem += them(K[ma], 'suaDoi', ma2)
                dem += them(K[ma2], 'biSuaDoiBoi', ma)
        if v.get('boSungThem'):
            for z in v['boSungThem']:
                if z['boi'] in K and z['boi'] != ma:
                    dem += them(K[z['boi']], 'suaDoi', ma)
                    dem += them(K[ma], 'biSuaDoiBoi', z['boi'])

    json.dump(kho, open(p_kho, 'w', encoding='utf-8'), ensure_ascii=False)

    print('Da them %d quan he vao luoc do.' % dem)
    for ma in ['ldd1987', 'ldd1993', 'lsd1998', 'lsd2001', 'ldd2003', 'ldd2013', 'ldd2024']:
        if ma not in K:
            continue
        k = K[ma]
        dong = []
        for t, nhan in [('thayThe', 'thay the'), ('biThayTheBoi', 'bi thay the boi'),
                        ('suaDoi', 'sua doi'), ('biSuaDoiBoi', 'bi sua doi boi')]:
            if k.get(t):
                dong.append('%s: %s' % (nhan, ', '.join(k[t])))
        sys.stdout.buffer.write(('  %-9s %-16s %s\n' % (
            ma, k['soHieu'], ' | '.join(dong) or '(van chua co quan he nao)')).encode('utf-8', 'replace'))


if __name__ == '__main__':
    lam(sys.argv[1] if len(sys.argv) > 1 else 'apps/frontend/public/luat')
