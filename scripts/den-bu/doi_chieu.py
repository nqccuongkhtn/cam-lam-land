# -*- coding: utf-8 -*-
"""
DOI CHIEU bang don gia CHINH THUC (ban .docx doi tu ban Word tren Cong bao) voi file JSON dang dung tren web.

Dung:  python -I doi_chieu.py <dump.json cua QD> <file JSON web> <ten QD> <out_chinh_thuc.json> <out_bao_cao.txt>

- dump.json: tu docx_dump.py (danh sach khoi doan van / bang theo thu tu).
- Moi BANG 4 cot: STT | Ten | Don vi | Gia. Hang co gia = 1 hang muc.
- Theo doi CAY CHA: nhom (A/B/C...), nhom phu (I, II hay dong gop ngang), muc cha (hang co STT ma khong co gia).
"""
import sys, io, json, re, unicodedata, collections

sys.stdout.reconfigure(encoding='utf-8')


def nfc(s):
    return unicodedata.normalize('NFC', s or '')


def gon(s):
    s = nfc(s).replace(' ', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def khoa(s):
    """chuoi so khop: bo dau cach, chu thuong, bo dau cau o cuoi"""
    s = gon(s).lower()
    s = s.replace('–', '-').replace('—', '-')
    s = re.sub(r'\s*([,;:()\-+/])\s*', r'\1', s)
    return s.strip(' .;:')


GIA = re.compile(r'^\d{1,3}(?:\.\d{3})+$|^\d{1,3}$')


def so(s):
    s = gon(s)
    if GIA.match(s):
        return int(s.replace('.', ''))
    return None


def boc_chinh_thuc(dump):
    """Tra ve danh sach hang muc co gia, kem duong dan nhom."""
    ra = []
    pl = ''
    for k in dump:
        if k['loai'] == 'p':
            m = re.match(r'^Phụ lục\s+([IVX]+)\b', k['chu'])
            if m:
                pl = m.group(1)
            continue
        hang = k['hang']
        if not hang or len(hang[0]) < 4:
            continue
        tieu_de = ' '.join(hang[0]).lower()
        if 'giá trị' not in tieu_de and 'đơn giá' not in tieu_de:
            continue
        nhom = ''      # A, B, C ...
        nhom_phu = ''  # I, II hoac dong gop ngang (Nha o 1 tang, GIENG NUOC ...)
        ket_cau = ''   # dong 'Ket cau: ...' gop ngang
        cha = ''       # muc cha (co STT, khong co gia)
        cha_dv = ''
        cha_stt = ''
        for h in hang[1:]:
            h = [gon(x) for x in h[:4]] + [''] * (4 - len(h[:4]))
            stt, ten, dv, gia = h[0], h[1], h[2], h[3]
            if stt == '^':
                continue
            gop_ngang = (ten and ten == dv == gia) or (stt and stt == ten == dv)
            if gop_ngang:
                t = ten if ten else stt
                if t.startswith('Kết cấu'):
                    ket_cau = t
                    cha, cha_dv, cha_stt = '', '', stt
                elif t.startswith('*') or t.startswith('-') or t.startswith('+'):
                    pass  # dong ghi chu
                elif re.fullmatch(r'[A-Z]', stt or ''):
                    nhom, nhom_phu, ket_cau, cha, cha_dv, cha_stt = t, '', '', '', '', ''
                else:
                    if stt and re.fullmatch(r'\d+(\.\d+)*', stt):
                        cha, cha_dv, cha_stt = t, '', stt
                    else:
                        nhom_phu, ket_cau, cha, cha_dv, cha_stt = t, '', '', '', ''
                continue
            g = so(gia)
            if g is None and gia and not gia.startswith('Tính'):
                # gia viet la so nhung sai dinh dang (vd 899.00) -> van ghi lai de bao
                if re.match(r'^[\d.,]+$', gia):
                    ra.append({'pl': pl, 'nhom': nhom, 'nhomPhu': nhom_phu, 'ketCau': ket_cau, 'cha': cha,
                               'stt': stt, 'ten': ten, 'dv': dv or cha_dv, 'gia': None, 'giaGoc': gia})
                continue
            if g is None:
                # hang tieu de: nhom chu cai / so La Ma / muc cha
                if re.fullmatch(r'[IVX]+', stt) and ten and nhom:
                    nhom_phu, ket_cau, cha, cha_dv, cha_stt = ten, '', '', '', ''
                elif re.fullmatch(r'[A-Z]', stt) and ten:
                    nhom, nhom_phu, ket_cau, cha, cha_dv, cha_stt = ten, '', '', '', '', ''
                elif re.fullmatch(r'[IVX]+', stt) and ten:
                    nhom_phu, ket_cau, cha, cha_dv, cha_stt = ten, '', '', '', ''
                elif not stt and ten and ten.endswith(':') and ten.upper() == ten:
                    nhom_phu, ket_cau, cha, cha_dv, cha_stt = ten, '', '', '', ''
                elif ten:
                    cha, cha_dv, cha_stt = ten, dv, stt
                continue
            # hang co gia
            con = (not stt) or stt in ('-', '+') or re.fullmatch(r'[a-z]', stt) or (cha_stt and stt.startswith(cha_stt + '.'))
            ra.append({'pl': pl, 'nhom': nhom, 'nhomPhu': nhom_phu, 'ketCau': ket_cau,
                       'cha': cha if con else '', 'stt': stt, 'ten': ten, 'dv': dv or (cha_dv if con else ''),
                       'gia': g, 'giaGoc': gia})
            if not con:
                cha, cha_dv, cha_stt = '', '', ''
    return ra


def main(dump_json, web_json, ten_qd, out_ct, out_bc):
    dump = json.load(io.open(dump_json, encoding='utf-8'))
    ct = boc_chinh_thuc(dump)
    web = json.load(io.open(web_json, encoding='utf-8'))
    io.open(out_ct, 'w', encoding='utf-8', newline='\n').write(json.dumps(ct, ensure_ascii=False, indent=1))

    L = []
    p = L.append
    p('=== %s ===' % ten_qd)
    dem_ct = collections.Counter(x['pl'] for x in ct)
    dem_web = collections.Counter(x.get('pl', '') for x in web)
    p('So hang muc CO GIA trong van ban chinh thuc: %d  %s' % (len(ct), dict(dem_ct)))
    p('So hang muc trong JSON web: %d  %s' % (len(web), dict(dem_web)))

    # ghep: theo (gia, dv) + ten
    con_web = list(range(len(web)))
    da_ghep = {}
    def ghep(dk):
        for i, x in enumerate(ct):
            if i in da_ghep or x['gia'] is None:
                continue
            for j in con_web:
                w = web[j]
                if dk(x, w):
                    da_ghep[i] = j
                    con_web.remove(j)
                    break
    # luot 1: dung gia + dung ten + dung pl
    ghep(lambda x, w: w['gia'] == x['gia'] and khoa(w['ten']) == khoa(x['ten']) and (not w.get('pl') or w.get('pl') == x['pl']))
    # luot 2: dung gia + ten chua nhau
    ghep(lambda x, w: w['gia'] == x['gia'] and (khoa(x['ten']) in khoa(w['ten']) or khoa(w['ten']) in khoa(x['ten'])) and khoa(w['ten']))
    # luot 3: dung gia (ten khac) - ghi lai de soi
    ghep(lambda x, w: w['gia'] == x['gia'])

    p('')
    p('--- A. HANG MUC CO TRONG VAN BAN NHUNG THIEU TREN WEB ---')
    thieu = [x for i, x in enumerate(ct) if i not in da_ghep]
    for x in thieu:
        p('  [PL %s] %s | %s | %s | STT %s | %s | %s | %s' % (x['pl'], x['nhom'], x['nhomPhu'] or x['ketCau'][:40], x['cha'][:70], x['stt'], x['ten'][:110], x['dv'], x['giaGoc']))
    p('  => tong thieu: %d (theo phu luc: %s)' % (len(thieu), dict(collections.Counter(x['pl'] for x in thieu))))

    p('')
    p('--- B. HANG MUC TREN WEB KHONG KHOP VAN BAN (gia/ten khong co trong van ban) ---')
    for j in con_web:
        w = web[j]
        p('  [web #%d] %s | %s | %s | %s' % (j, w.get('pl', ''), w['ten'][:110], w['dv'], w['gia']))

    p('')
    p('--- C. GHEP DUOC NHUNG KHAC TEN / DON VI ---')
    for i, j in sorted(da_ghep.items()):
        x, w = ct[i], web[j]
        if khoa(x['ten']) != khoa(w['ten']):
            p('  TEN: van ban "%s" <> web "%s" (gia %s)' % (x['ten'][:120], w['ten'][:120], x['gia']))
        if khoa(x['dv']) != khoa(w['dv']):
            p('  DON VI: "%s" | van ban "%s" <> web "%s"' % (x['ten'][:80], x['dv'], w['dv']))

    p('')
    p('--- D. NHAN HIEN RA CHO NGUOI DUNG BI SAI (web ghi "phu"/"ketCau" khong thuoc duong dan cua hang muc trong van ban) ---')
    nhan_sai = 0
    thieu_nc = []
    for i, j in sorted(da_ghep.items()):
        x, w = ct[i], web[j]
        duong = [x['nhom'], x['nhomPhu'], x['ketCau'], x['cha']]
        duong_k = [khoa(d) for d in duong if d]
        loi = []
        for truong in ('phu', 'ketCau'):
            v = w.get(truong, '')
            if not v:
                continue
            kv = khoa(v)
            if kv in khoa(x['ten']):
                continue
            if not any(kv[:35] == d[:35] or kv in d or d in kv for d in duong_k):
                loi.append('%s="%s"' % (truong, v[:70]))
        if loi:
            nhan_sai += 1
            p('  web #%d "%s · %s" (%s đ/%s): %s  | dung ra: %s' % (j, w.get('phu', '')[:40], w['ten'][:60], w['gia'], w['dv'], '; '.join(loi), ' > '.join(d[:50] for d in duong if d)))
        # thieu ngu canh: muc cha cua van ban khong hien o dau tren web
        hien = khoa(' '.join([w.get('nhom', ''), w.get('phu', ''), w.get('ketCau', ''), w['ten']]))
        if x['cha'] and khoa(x['cha'])[:30] not in hien:
            thieu_nc.append((j, w, x))
    p('  => so hang muc hien NHAN SAI: %d / %d' % (nhan_sai, len(da_ghep)))
    p('')
    p('--- E. THIEU NGU CANH (van ban co muc cha, web khong hien muc cha) ---')
    for j, w, x in thieu_nc:
        p('  web #%d "%s" (%s đ/%s): thieu "%s"' % (j, w['ten'][:70], w['gia'], w['dv'], x['cha'][:80]))
    p('  => %d hang muc' % len(thieu_nc))
    io.open(out_bc, 'w', encoding='utf-8', newline='\n').write('\n'.join(L) + '\n')
    print('\n'.join(L[:3]))
    print('thieu', len(thieu), '| web thua', len(con_web), '| nhan sai', nhan_sai, '| thieu ngu canh', len(thieu_nc))


if __name__ == '__main__':
    main(*sys.argv[1:])
