# -*- coding: utf-8 -*-
"""
GẮN "ĐIỀU NÀY ĐƯỢC SỬA ĐỔI BỞI…" KÈM NGUYÊN VĂN PHẦN MỚI — làm giống Thư viện pháp luật.

Thư viện pháp luật, khi mở một điều đã bị sửa, hiện ngay trên đầu điều đó một dòng kiểu:
    "Khoản 2 Điều 251 được sửa đổi bởi khoản 1 Điều 1 Luật số 43/2024/QH15"
và bấm vào là bung ra NGUYÊN VĂN đoạn mới. Đó là thứ quý nhất: đọc điều cũ mà không thấy
đoạn mới là hiểu sai hẳn.

Mình LẤY ĐƯỢC nguyên văn đoạn mới, vì luật sửa đổi luôn viết theo đúng một khuôn:
    Sửa đổi, bổ sung khoản 2 Điều 251 như sau:
    "2. Bãi bỏ Nghị quyết số 132/2020/QH14 …"
Phần trong ngoặc kép chính là chữ mới. Chỉ việc cắt ra rồi gắn vào đúng điều bị sửa.

HAI KHUÔN VIẾT phải đọc được cả hai:
  • Kiểu MỚI (từ 2013 trở đi):  "Sửa đổi, bổ sung <phạm vi> như sau: “…”"
       phạm vi có thể là "khoản 2 Điều 251", "khổ đầu khoản 4 Điều 260", "Điều 22a".
  • Kiểu CŨ (Luật sửa đổi 1998, 2001): "Điều 19 được sửa đổi, bổ sung như sau: "…""
       tên điều đứng TRƯỚC, động từ đứng sau — bắt bằng khuôn mới thì trượt sạch.

VĂN BẢN SỬA ĐỔI NHẮM VÀO AI:
  • Có số hiệu trong tiêu đề điều ("… của Luật Quy hoạch số 21/2017/QH14") thì tra thẳng.
  • Luật sửa đổi đời cũ chỉ ghi "Luật đất đai" trống trơn → lấy đời luật ĐANG CÓ HIỆU LỰC
    vào NGÀY BAN HÀNH của luật sửa đổi (giống cách làm trong dung-lien-ket.py).

Kết quả ghi vào tệp JSON của văn bản BỊ SỬA:
    dieu[].suaDoi = [ { loai, boi, boiDieu, boiKhoan, tuNgay, phamVi, khoan, noiDungMoi } ]
và vào văn bản ĐI SỬA:
    dieu[].suaDoiCho = [ { ma|soHieu, ten, phamVi } ]   ← để bên kia cũng thấy mình sửa ai.

Chạy:  python dung-sua-doi-dieu.py <thu-muc-json>
"""
import sys, os, re, json

# ── Các mốc đời Luật Đất đai, xét theo NGÀY BAN HÀNH của văn bản đi sửa ──────────
DOI_LUAT = [('2024-01-18', 'ldd2024'), ('2013-11-29', 'ldd2013'), ('2003-11-26', 'ldd2003'),
            ('1993-07-14', 'ldd1993'), ('0000-00-00', 'ldd1987')]

RE_SO_HIEU = re.compile(r'(\d{1,4}/\d{4}/[A-ZĐ][A-ZĐ0-9\-]*)')

# Kiểu MỚI: động từ đứng đầu khoản, phạm vi theo sau, rồi "như sau:"
RE_MOI = re.compile(r'^(Sửa đổi, bổ sung|Bổ sung|Bãi bỏ|Thay thế|Sửa đổi)\s+'
                    r'(.{0,200}?)\s*(?:như sau\s*:)', re.S)
# Kiểu CŨ: "Điều 19 được sửa đổi, bổ sung như sau:"
RE_CU = re.compile(r'^(Điều\s+\d{1,3}[a-zđ]?[^"“]{0,90}?)\s+được\s+'
                   r'(sửa đổi, bổ sung|bổ sung|sửa đổi|bãi bỏ)[^"“]{0,40}?(?:như sau\s*:|:)', re.S)
# Thay cụm từ: "Cụm từ "X" tại Điều 63 và khoản 2 Điều 81 … được thay bằng cụm từ "Y""
RE_CUM = re.compile(r'^Cụm từ\s+["“](.{1,120}?)["”]\s+tại\s+(.{0,200}?)\s+được thay'
                    r'(?:\s+bằng)?\s+(?:bằng\s+)?cụm từ\s+["“](.{1,120}?)["”]', re.S)

# Số điều trong phạm vi — lấy CẢ dãy "Điều 21, 22, 28" và cả điều có chữ "22a"
RE_DIEU = re.compile(r'Điều\s+(\d{1,3}[a-zđ]?)')
RE_KHOAN_TRONG = re.compile(r'khoản\s+(\d{1,2})', re.I)

VERB = {'Sửa đổi, bổ sung': 'sua-doi', 'Sửa đổi': 'sua-doi', 'sửa đổi, bổ sung': 'sua-doi',
        'sửa đổi': 'sua-doi', 'Bổ sung': 'bo-sung', 'bổ sung': 'bo-sung',
        'Bãi bỏ': 'bai-bo', 'bãi bỏ': 'bai-bo', 'Thay thế': 'thay-the'}


def chu_moi(c):
    """Cắt NGUYÊN VĂN đoạn mới — phần nằm trong ngoặc kép sau chữ 'như sau:'."""
    i = c.find('như sau')
    if i < 0:
        i = 0
    m = re.search(r'["“](.+)["”]\s*\.?\s*$', c[i:], re.S)
    if not m:
        m = re.search(r'["“](.+)', c[i:], re.S)
    if not m:
        return ''
    return re.sub(r'[ \t]+', ' ', m.group(1)).strip().rstrip('”"').strip()


def doi_luat_theo_ngay(ngay):
    for moc, ma in DOI_LUAT:
        if ngay >= moc:
            return ma
    return None


def dich_cua_dieu(d, ma_tu, ngay_tu, theo_so):
    """Điều này của văn bản đi sửa đang nhắm vào văn bản nào?"""
    tie = (d.get('tieuDe') or '') + ' ' + ' '.join(k['chu'][:200] for k in d['khoan'][:1])
    m = RE_SO_HIEU.search(tie)
    if m:
        return theo_so.get(m.group(1)), m.group(1)
    if re.search(r'Luật\s+đất đai', tie, re.I):
        return doi_luat_theo_ngay(ngay_tu), None
    return None, None


def pham_vi(txt):
    """Đọc phạm vi: trả (danh sách số điều, số khoản nếu chỉ động tới 1 khoản)."""
    ds = [x for x in RE_DIEU.findall(txt)]
    mk = RE_KHOAN_TRONG.search(txt)
    khoan = int(mk.group(1)) if mk and len(ds) == 1 else None
    return ds, khoan


def lam(thu_muc):
    kho = json.load(open(os.path.join(thu_muc, '_kho.json'), encoding='utf-8'))
    theo_so = {x['soHieu']: x['ma'] for x in kho}
    ngay_ban = {x['ma']: x['ngay'] for x in kho}
    ngay_hl = {x['ma']: (x.get('ngayHieuLuc') or x['ngay']) for x in kho}
    ten_vb = {x['ma']: x for x in kho}

    vb = {}
    for x in kho:
        p = os.path.join(thu_muc, x['ma'] + '.json')
        if os.path.exists(p):
            vb[x['ma']] = json.load(open(p, encoding='utf-8'))
            vb[x['ma']].pop('boSungThem', None)
            for d in vb[x['ma']]['dieu']:
                d.pop('suaDoi', None)
                d.pop('suaDoiCho', None)

    dem = {'sua-doi': 0, 'bo-sung': 0, 'bai-bo': 0, 'thay-the': 0}
    ngoai_kho, khong_doc_duoc = [], []

    for ma, v in vb.items():
        for d in v['dieu']:
            ma_dich, so_hieu_dich = dich_cua_dieu(d, ma, ngay_ban.get(ma, ''), theo_so)
            if not ma_dich and not so_hieu_dich:
                continue
            if ma_dich == ma:
                continue
            for k in d['khoan']:
                c = re.sub(r'\s*\n\s*', '\n', k['chu'].strip())
                loai = pv = None
                m1, m2, m3 = RE_MOI.match(c), RE_CU.match(c), RE_CUM.match(c)
                if m2:
                    loai, pv = VERB.get(m2.group(2), 'sua-doi'), m2.group(1)
                elif m1:
                    loai, pv = VERB.get(m1.group(1), 'sua-doi'), m1.group(2)
                    if not RE_DIEU.search(pv):          # "một số điều của Luật …" — câu dẫn
                        continue
                elif m3:
                    loai, pv = 'thay-the', m3.group(2)
                else:
                    continue

                ds_dieu, so_khoan = pham_vi(pv)
                if not ds_dieu:
                    continue
                moi = chu_moi(c) if loai != 'thay-the' else (
                    'Cụm từ “%s” được thay bằng cụm từ “%s”.' % (m3.group(1), m3.group(3)))

                ghi = {'loai': loai, 'boi': ma, 'boiDieu': d['so'], 'boiKhoan': k['so'],
                       'tuNgay': ngay_hl.get(ma, ''), 'phamVi': re.sub(r'\s+', ' ', pv).strip()}
                if so_khoan:
                    ghi['khoan'] = so_khoan
                if moi:
                    ghi['noiDungMoi'] = moi

                # ghi sang bên BỊ SỬA (nếu văn bản đó có trong kho)
                gan_duoc = False
                if ma_dich and ma_dich in vb:
                    for so in ds_dieu:
                        dich = next((z for z in vb[ma_dich]['dieu'] if str(z['so']) == str(so)), None)
                        if dich is None:
                            continue
                        dich.setdefault('suaDoi', []).append(dict(ghi))
                        gan_duoc = True
                if gan_duoc:
                    dem[loai] = dem.get(loai, 0) + 1
                elif ma_dich in vb and loai == 'bo-sung' and len(ds_dieu) == 1:
                    # ĐIỀU THÊM MỚI (Điều 22a, 78a…): bản gốc năm 1993 không có điều này,
                    # nó do luật sửa đổi đẻ ra. Không chèn vào giữa nguyên văn (làm thế là
                    # sửa chữ luật gốc) — ghi riêng ở mức văn bản, giao diện hiện thành dòng
                    # nối sau điều liền trước, bấm ra đọc nguyên văn kèm tên luật đã thêm nó.
                    truoc = re.match(r'(\d{1,3})', ds_dieu[0])
                    vb[ma_dich].setdefault('boSungThem', []).append({
                        'so': ds_dieu[0], 'sauDieu': int(truoc.group(1)) if truoc else 0,
                        'boi': ma, 'boiDieu': d['so'], 'boiKhoan': k['so'],
                        'tuNgay': ngay_hl.get(ma, ''), 'noiDungMoi': moi})
                    dem['bo-sung'] = dem.get('bo-sung', 0) + 1
                else:
                    ngoai_kho.append((ma, d['so'], k['so'], so_hieu_dich or ma_dich or '?', pv[:60]))

                # ghi sang bên ĐI SỬA để đọc điều đó cũng thấy mình sửa ai
                nhan = (ten_vb.get(ma_dich, {}) or {}).get('soHieu') or so_hieu_dich or ''
                d.setdefault('suaDoiCho', []).append(
                    {'ma': ma_dich or '', 'soHieu': nhan, 'loai': loai,
                     'phamVi': re.sub(r'\s+', ' ', pv).strip()})

    for ma, v in vb.items():
        json.dump(v, open(os.path.join(thu_muc, ma + '.json'), 'w', encoding='utf-8'),
                  ensure_ascii=False)

    print('Da gan: %d sua doi, %d bo sung, %d bai bo, %d thay cum tu'
          % (dem.get('sua-doi', 0), dem.get('bo-sung', 0), dem.get('bai-bo', 0), dem.get('thay-the', 0)))
    co_moi = sum(1 for v in vb.values() for d in v['dieu'] for s in d.get('suaDoi', []) if s.get('noiDungMoi'))
    tong = sum(len(d.get('suaDoi', [])) for v in vb.values() for d in v['dieu'])
    print('  %d/%d muc co NGUYEN VAN doan moi' % (co_moi, tong))
    for ma, v in vb.items():
        ds = [d for d in v['dieu'] if d.get('suaDoi')]
        if ds:
            sys.stdout.buffer.write(('  %-16s %d dieu bi sua: %s\n' % (
                v['soHieu'], len(ds), ', '.join(str(d['so']) for d in ds[:25]))).encode('utf-8', 'replace'))
    for ma, v in vb.items():
        if v.get('boSungThem'):
            # xep theo bang chu cai TIENG VIET (a b c d d- e...), khong phai bang chu cai may tinh
            BCC = 'abcdđefghiklmnopqrstuvxy'
            v['boSungThem'].sort(key=lambda z: (z['sauDieu'],
                                                BCC.find(z['so'][-1]) if z['so'][-1] in BCC else 99))
            sys.stdout.buffer.write(('  %-16s %d dieu duoc BO SUNG THEM: %s\n' % (
                v['soHieu'], len(v['boSungThem']),
                ', '.join('Dieu ' + z['so'] for z in v['boSungThem']))).encode('utf-8', 'replace'))
    if ngoai_kho:
        print('  (%d muc sua van ban NGOAI kho - chi ghi o ben di sua)' % len(ngoai_kho))


if __name__ == '__main__':
    lam(sys.argv[1] if len(sys.argv) > 1 else 'apps/frontend/public/luat')
