# -*- coding: utf-8 -*-
"""
BỔ SUNG MỘT VĂN BẢN VÀO CÔNG CỤ "HỌC VÀ TRA CỨU LUẬT ĐẤT ĐAI" — làm hộ phần việc MÁY MÓC.

Chủ dự án gửi một tệp ("bổ sung văn bản này vào học luật", "lưu trữ file này để học") rồi
XOÁ bản gốc. Nên thứ tự bắt buộc là: LƯU TRỮ TRƯỚC (đã nén, đã kiểm) → rồi mới đọc, xếp chỗ.
Cách làm đầy đủ (ai làm bước nào, soát gì): .claude/skills/bo-sung-van-ban-hoc-luat/SKILL.md

CÁC LỆNH
  luu-tru <tệp> --ma <mã> [--cong-khai] [--rieng] [--ghi-chu "..."]
        Nén + kiểm + cất vào scripts/luat/van-ban-goc/<mã>.pdf, ghi vào chi-muc.json.
        --cong-khai : chép thêm một bản ra apps/frontend/public/luat/tham-khao/ để web mở xem được.
        --rieng     : tệp có DỮ LIỆU CÁ NHÂN (họ tên + số CCCD, tiền bồi thường của người có tên…)
                      → cất vào van-ban-goc/_rieng/ (không lên git), không chép ra web.
  boc-chu --ma <mã> [--ra <tệp.txt>]
        In ra chữ của bản đã cất: lớp chữ thật của PDF, hoặc chữ máy đọc từ ảnh quét (đã lưu sẵn
        lúc cất, đọc từ bản gốc nét nhất).
  nhap-cong-van --ma <mã> [--tinh "<tỉnh>"] [--nhom huong-dan|dia-phuong]
        Soạn BẢN NHÁP apps/frontend/public/luat/tham-khao/<mã>.json từ chữ đã bóc. BẢN NHÁP — phải
        soát lại từng đoạn với bản gốc rồi mới bỏ dấu "nhap".
  kiem [--ma <mã>]
        Kiểm mọi văn bản tham khảo: đủ trường, dẫn chiếu trỏ đúng điều có thật trong kho, và
        NGUYÊN VĂN: từng đoạn chữ phải có trong chữ bóc từ bản gốc (bản quét thì liệt kê chỗ
        khác với chữ máy đọc để người soát nhìn lại ảnh).
  vao-kho <tệp-chữ.txt>... --ma <mã> --so-hieu <số hiệu> [--ten "..."] [--het-hieu-luc "..."]
        Văn bản có ĐIỀU (luật, nghị quyết QH, nghị định, thông tư): tách thành JSON bằng đúng bộ
        tách của kho (tach-luat-pdf.py qua dung-kho-luat.py) và thêm MỘT dòng vào _kho.json —
        không đụng văn bản nào khác. Sau đó chạy tiếp chuỗi script ghi trong SKILL.md.

Các công cụ PDF (gs, qpdf, ocrmypdf, tesseract tiếng Việt, pdftotext…) chạy TRONG container máy
chủ `camlam_backend` (đổi bằng biến MAY_XU_LY), trên BẢN SAO đặt ở /tmp — không đụng tệp gốc.
"""
import sys, os, re, json, glob, shutil, hashlib, subprocess, tempfile, unicodedata, difflib, datetime
import importlib.util

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

GOC = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
THU_MUC_LUU = os.path.join(GOC, 'scripts', 'luat', 'van-ban-goc')
THU_MUC_RIENG = os.path.join(THU_MUC_LUU, '_rieng')
CHI_MUC = os.path.join(THU_MUC_LUU, 'chi-muc.json')
THU_MUC_WEB = os.path.join(GOC, 'apps', 'frontend', 'public', 'luat')
THU_MUC_TK = os.path.join(THU_MUC_WEB, 'tham-khao')
NEN_ANH = os.path.join(GOC, 'scripts', 'pdf', 'nen-pdf-tai-lieu.py')
MAY = os.environ.get('MAY_XU_LY', 'camlam_backend')
TAM = '/tmp/them-vb'

# Nén kiểu A — GIỐNG HỆT nenPdf() trong apps/backend/src/routes/vanBan.ts (chỉ bỏ bước đóng dấu
# bản quyền, vì đây là bản lưu trữ). Sửa thông số bên đó thì sửa cả ở đây.
GS = ['gs', '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dNOPAUSE', '-dBATCH', '-dQUIET',
      '-dDetectDuplicateImages=true', '-dCompressFonts=true', '-dSubsetFonts=true',
      '-dDownsampleColorImages=true', '-dColorImageResolution=100', '-dDownsampleGrayImages=true',
      '-dGrayImageResolution=100', '-dDownsampleMonoImages=true', '-dMonoImageResolution=200',
      '-dColorImageDownsampleThreshold=1.0', '-dGrayImageDownsampleThreshold=1.0',
      '-dMonoImageDownsampleThreshold=1.0']
QPDF = ['qpdf', '--object-streams=generate', '--recompress-flate', '--compression-level=9']

# Bản nén phải nhỏ hơn bản gốc ÍT NHẤT 10% mới đáng lấy. Bớt được vài phần trăm mà phải ghi lại
# tệp (mất chữ ký số, đổi cấu trúc) thì không bõ — giữ nguyên bản gốc.
BOT_IT_NHAT = 0.10
# Bản quét: máy đọc lại bản nén phải ra ít nhất ngần này phần trăm số chữ so với khi đọc bản gốc.
# (Đo trên công văn 82/HKL-QLBVR: bản gốc 300 dpi 95,3% · nén kiểu A 93,7% · ảnh xám 150 dpi 92,9%
#  so với chữ đã soát bằng mắt — ba bản đều đọc tốt, nên lấy ngưỡng 92%.)
NGUONG_DOC_DUOC = 0.92


# ───────────────────────────── tiện ích chung ─────────────────────────────
def bao(*x):
    print(*x, flush=True)


def loi(thong_bao):
    print('LỖI: ' + thong_bao, file=sys.stderr, flush=True)
    sys.exit(1)


def chay(lenh, timeout=600, nuot=False):
    """Chạy một lệnh trên máy này, trả về (mã thoát, chữ in ra)."""
    r = subprocess.run(lenh, capture_output=True, timeout=timeout)
    ra = (r.stdout or b'').decode('utf-8', 'replace') + (r.stderr or b'').decode('utf-8', 'replace')
    if r.returncode != 0 and not nuot:
        raise RuntimeError('%s -> mã %d\n%s' % (' '.join(lenh[:6]), r.returncode, ra[-1500:]))
    return r.returncode, ra


def may(*lenh, timeout=900, nuot=False):
    """Chạy lệnh TRONG container máy chủ."""
    return chay(['docker', 'exec', MAY] + list(lenh), timeout=timeout, nuot=nuot)


def may_chu(lenh, timeout=600):
    """Chạy lệnh trong container, lấy phần chữ in ra (stdout) — dùng cho pdftotext."""
    r = subprocess.run(['docker', 'exec', MAY] + lenh, capture_output=True, timeout=timeout)
    return r.returncode, (r.stdout or b'').decode('utf-8', 'replace')


def dua_vao(tep, dich):
    chay(['docker', 'cp', tep, '%s:%s' % (MAY, dich)])


def lay_ra(nguon, tep):
    chay(['docker', 'cp', '%s:%s' % (MAY, nguon), tep])


def kiem_may():
    try:
        rc, ra = chay(['docker', 'exec', MAY, 'sh', '-c', 'which gs qpdf ocrmypdf tesseract pdftotext pdfsig'],
                      timeout=60, nuot=True)
    except Exception as e:
        loi('không gọi được Docker (%s). Máy chủ đang tắt? Đợi bật lại rồi chạy lại.' % e)
    if rc != 0 or ra.count('/') < 6:
        loi('container %s chưa chạy hoặc thiếu công cụ PDF. Đợi máy chủ bật lại rồi chạy lại.\n%s' % (MAY, ra))


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for k in iter(lambda: f.read(1 << 20), b''):
            h.update(k)
    return h.hexdigest()


def chuan(s):
    """Chuẩn hoá để SO chữ: dựng lại dấu tiếng Việt (NFC — bản gõ tách dấu vẫn khớp), số mũ ¹²³
    về số thường, gộp mọi khoảng trắng."""
    s = unicodedata.normalize('NFC', s or '')
    s = s.translate(str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹', '0123456789'))
    s = s.replace('­', '').replace('​', '').replace('\xa0', ' ')
    s = s.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
    return re.sub(r'\s+', ' ', s).strip()


def tu(s):
    return re.findall(r'\w+', chuan(s).lower())


def ty_le_tieng_viet(chu):
    """Tỉ lệ chữ mang dấu tiếng Việt. Văn bản tiếng Việt thật ~40–60%; lớp chữ rác do máy quét
    tự đọc (vd 'Hat Ki6m 16m khu v.uc Lpc Y€n') gần như không có dấu."""
    ds = re.findall(r'[^\W\d_]{2,}', unicodedata.normalize('NFC', chu))
    if not ds:
        return 0.0
    co_dau = sum(1 for w in ds if re.search(r'[à-ỹđÀ-ỸĐăâêôơư]', w, re.I) and not re.fullmatch(r'[a-zA-Z]+', w))
    return co_dau / len(ds)


def doc_chi_muc():
    if os.path.exists(CHI_MUC):
        return json.load(open(CHI_MUC, encoding='utf-8'))
    return {'ghiChu': '', 'tep': []}


def ghi_chi_muc(cm):
    cm['ghiChu'] = (
        'Mỗi tệp chủ dự án gửi để HỌC LUẬT đều được cất ở thư mục này TRƯỚC khi làm gì khác, vì chủ '
        'dự án sẽ xoá bản gốc. Ưu tiên bản đã nén; bản nén chỉ được lấy khi đã kiểm: mở được, đủ số '
        'trang, chữ bóc ra y hệt bản gốc (bản quét: máy đọc lại vẫn ra đủ chữ). Tệp có dữ liệu cá nhân '
        'thì nằm ở _rieng/ (không lên git). Cách làm: .claude/skills/bo-sung-van-ban-hoc-luat/SKILL.md')
    cm['tep'].sort(key=lambda x: x.get('ngayNhan', '') + x['ma'])
    os.makedirs(THU_MUC_LUU, exist_ok=True)
    with open(CHI_MUC, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(cm, f, ensure_ascii=False, indent=1)
        f.write('\n')


def kiem_ma(ma):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{2,80}', ma or ''):
        loi('mã "%s" không hợp lệ — chỉ dùng chữ thường không dấu, số và gạch ngang, '
            'vd cv-1857-snnmt-qldd-2026-quang-ngai' % ma)


# ───────────────────────────── 1. LƯU TRỮ ─────────────────────────────
def thong_tin(duong):
    """Số trang + chữ ký số của một tệp PDF trong container."""
    _, ra = may('pdfinfo', duong, nuot=True)
    m = re.search(r'Pages:\s+(\d+)', ra)
    trang = int(m.group(1)) if m else 0
    _, sig = may('pdfsig', duong, nuot=True)
    chu_ky = []
    for khoi in re.split(r'\nSignature #\d+:', '\n' + sig)[1:]:
        ten = re.search(r'Signer Certificate Common Name:\s*(.+)', khoi)
        luc = re.search(r'Signing Time:\s*(.+)', khoi)
        hl = re.search(r'Signature Validation:\s*(.+)', khoi)
        chu_ky.append({'nguoiKy': ten.group(1).strip() if ten else '',
                       'luc': gio_ky(luc.group(1).strip()) if luc else '',
                       'hopLe': bool(hl and 'is Valid' in hl.group(1))})
    return trang, chu_ky


def gio_ky(s):
    """'Mar 04 2026 04:24:35' (pdfsig in theo giờ của container = giờ quốc tế) -> '2026-03-04 11:24:35 giờ VN'."""
    try:
        t = datetime.datetime.strptime(s, '%b %d %Y %H:%M:%S') + datetime.timedelta(hours=7)
        return t.strftime('%Y-%m-%d %H:%M:%S') + ' giờ Việt Nam'
    except Exception:
        return s


def chu_cua(duong):
    rc, t = may_chu(['pdftotext', '-enc', 'UTF-8', duong, '-'])
    return t if rc == 0 else ''


def ocr_trang(duong, thu_muc, toi_da_trang=0):
    """Máy đọc chữ ở 300 dpi (tesseract tiếng Việt). toi_da_trang > 0: chỉ đọc mấy trang đầu
    (đủ để đo bản nén còn đọc được không, khỏi chờ đọc cả tệp dày). Trả về chữ."""
    gioi_han = '-f 1 -l %d ' % toi_da_trang if toi_da_trang else ''
    may('sh', '-c', 'rm -rf %s && mkdir -p %s && pdftoppm -r 300 %s-png %s %s/p' % (thu_muc, thu_muc, gioi_han, duong, thu_muc))
    _, ds = may('sh', '-c', 'ls %s/p*.png' % thu_muc)
    ra = []
    for p in sorted(x for x in ds.split() if x.endswith('.png')):
        _, t = may_chu(['tesseract', p, '-', '-l', 'vie', '--psm', '4'], timeout=900)
        ra.append(t)
    may('rm', '-rf', thu_muc)
    return '\n'.join(ra)


def khop_chu(chuan_tu, thu_tu):
    if not chuan_tu:
        return 0.0
    sm = difflib.SequenceMatcher(None, chuan_tu, thu_tu, autojunk=False)
    return sum(b.size for b in sm.get_matching_blocks()) / len(chuan_tu)


def kich_thuoc(duong):
    _, ra = may('stat', '-c', '%s', duong, nuot=True)
    try:
        return int(ra.strip().split()[0])
    except Exception:
        return 0


def thanh_pdf(vao_may, duoi, thu_muc):
    """Ảnh chụp / tệp Word → PDF (trong container). Trả đường dẫn PDF."""
    ra = thu_muc + '/goc.pdf'
    if duoi in ('.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp'):
        may('python3', '-c', 'import img2pdf,sys;open(sys.argv[2],"wb").write(img2pdf.convert(sys.argv[1]))',
            vao_may, ra)
    elif duoi in ('.doc', '.docx', '.odt', '.rtf'):
        may('sh', '-c', 'cd %s && soffice --headless --convert-to pdf --outdir %s %s >/dev/null 2>&1; '
            'mv %s/*.pdf %s' % (thu_muc, thu_muc + '/lo', vao_may, thu_muc + '/lo', ra), timeout=600)
    else:
        loi('chưa biết xử lý tệp đuôi "%s" — nhận PDF, ảnh (jpg/png/tif) hoặc Word (doc/docx).' % duoi)
    return ra


def luu_tru(tep, ma, cong_khai=False, rieng=False, ghi_chu='', ngay_nhan=''):
    kiem_ma(ma)
    if not os.path.isfile(tep):
        loi('không thấy tệp: %s' % tep)
    kiem_may()
    cm = doc_chi_muc()
    h_goc = sha256(tep)
    for x in cm['tep']:
        if x.get('sha256Goc') == h_goc:
            bao('Tệp này ĐÃ ĐƯỢC CẤT rồi (mã %s, nhận ngày %s) — không làm lại.' % (x['ma'], x.get('ngayNhan')))
            return x
        if x['ma'] == ma:
            loi('mã %s đã dùng cho một tệp KHÁC (%s). Chọn mã khác.' % (ma, x.get('tenGoc')))

    duoi = os.path.splitext(tep)[1].lower()
    tm = '%s/%s' % (TAM, ma)
    may('sh', '-c', 'rm -rf %s && mkdir -p %s/lo' % (tm, tm))
    with tempfile.TemporaryDirectory() as tmp:
        ban = os.path.join(tmp, 'vao' + (duoi or '.pdf'))
        shutil.copyfile(tep, ban)                         # tên ASCII cho docker cp khỏi vấp dấu
        dua_vao(ban, tm + '/vao' + (duoi or '.pdf'))
    if duoi == '.pdf':
        may('cp', tm + '/vao.pdf', tm + '/goc.pdf')
        goc = tm + '/goc.pdf'
        doi_dang = ''
    else:
        goc = thanh_pdf(tm + '/vao' + duoi, duoi, tm)
        doi_dang = 'đổi từ %s sang PDF' % duoi
    _, dau = may('head', '-c', '5', goc, nuot=True)
    if not dau.startswith('%PDF'):
        loi('tệp không phải PDF hợp lệ.')

    trang, chu_ky = thong_tin(goc)
    co_goc = kich_thuoc(goc)
    chu_goc = chu_cua(goc)
    tv = ty_le_tieng_viet(chu_goc)
    co_lop_chu = len(chuan(chu_goc)) >= 80 * max(trang, 1) and tv >= 0.25
    bao('Tệp: %s' % os.path.basename(tep))
    bao('  %d trang · %s byte · %s' % (trang, format(co_goc, ',').replace(',', '.'),
        'CÓ lớp chữ thật (chữ mang dấu %.0f%%)' % (tv * 100) if co_lop_chu else
        'ẢNH QUÉT (lớp chữ có sẵn: %d ký tự, chữ mang dấu %.0f%% → coi như không có)' % (len(chuan(chu_goc)), tv * 100)))
    if chu_ky:
        bao('  %d chữ ký số: %s' % (len(chu_ky), '; '.join('%s (%s)' % (c['nguoiKy'], 'hợp lệ' if c['hopLe'] else 'KHÔNG hợp lệ')
                                                          for c in chu_ky)))

    da_thu, ung_vien = [], []
    if co_lop_chu:
        # ── Có lớp chữ thật: chỉ nhận bản nén mà chữ bóc ra Y HỆT bản gốc ──
        mau = chuan(chu_goc)
        for ten, lenh in [('A: gs + qpdf (như nenPdf)', [
                              ['sh', '-c', ' '.join(GS) + ' -sOutputFile=%s/a1.pdf %s' % (tm, goc)],
                              ['sh', '-c', ' '.join(QPDF) + ' %s/a1.pdf %s/a.pdf; [ -s %s/a.pdf ]' % (tm, tm, tm)]]),
                          ('Q: chỉ qpdf (không đổi phông, không đổi ảnh)', [
                              ['sh', '-c', ' '.join(QPDF) + ' %s %s/q.pdf; [ -s %s/q.pdf ]' % (goc, tm, tm)]])]:
            ra = tm + ('/a.pdf' if ten.startswith('A') else '/q.pdf')
            try:
                for l in lenh:
                    may(*l, timeout=900)
            except Exception as e:
                da_thu.append({'cach': ten, 'ketQua': 'hỏng khi chạy: %s' % str(e)[:160]})
                continue
            co = kich_thuoc(ra)
            t2, _ = thong_tin(ra)
            giong = chuan(chu_cua(ra)) == mau
            kq = {'cach': ten, 'kichThuoc': co}
            if t2 != trang:
                kq['ketQua'] = 'SAI SỐ TRANG (%d thay vì %d) — bỏ' % (t2, trang)
            elif not giong:
                kq['ketQua'] = 'HỎNG LỚP CHỮ: chữ bóc ra khác bản gốc (thường là chữ có dấu bị đổi thành ký tự lạ) — bỏ'
            elif co > co_goc * (1 - BOT_IT_NHAT):
                kq['ketQua'] = 'chữ y hệt nhưng chỉ bớt %.0f%% (dưới %d%%) — không bõ' % (100 * (1 - co / co_goc), BOT_IT_NHAT * 100)
            else:
                kq['ketQua'] = 'ĐẠT: chữ y hệt, đủ trang, bớt %.0f%%' % (100 * (1 - co / co_goc))
                ung_vien.append((co, ra, ten))
            if chu_ky:
                kq['ketQua'] += ' · bản nén KHÔNG còn chữ ký số'
            da_thu.append(kq)
        chu_luu = chu_goc
    else:
        # ── Ảnh quét: đọc lại chữ cho đúng (thay lớp chữ rác) rồi mới nén ──
        bao('  Máy đang đọc chữ trên ảnh (tiếng Việt, 300 dpi)… việc này mất vài phút.')
        chu_luu = ocr_trang(goc, tm + '/ocr0')
        # Đo "còn đọc được không" trên 3 trang đầu là đủ — tệp dày khỏi phải chờ đọc lại cả tệp.
        mau_tu = tu(chu_luu) if trang <= 3 else tu(ocr_trang(goc, tm + '/ocr0b', 3))
        # O = bản gốc + lớp chữ tiếng Việt mới (ảnh giữ nguyên)
        may('sh', '-c', 'ocrmypdf --redo-ocr -l vie --output-type pdf --optimize 0 %s %s/o.pdf >/dev/null 2>&1 || '
            'ocrmypdf --force-ocr -l vie --output-type pdf --optimize 0 %s %s/o.pdf >/dev/null 2>&1; [ -s %s/o.pdf ]'
            % (goc, tm, goc, tm, tm), timeout=1800)
        cac = [('O: giữ ảnh gốc, chỉ thay lớp chữ bằng chữ máy đọc lại', tm + '/o.pdf', [])]
        # A = nén kiểu nenPdf trên bản O (Ghostscript giữ nguyên lớp chữ máy đọc — đã đo)
        cac.append(('A: gs + qpdf (như nenPdf) trên bản đã đọc lại chữ', tm + '/a.pdf', [
            ['sh', '-c', ' '.join(GS) + ' -sOutputFile=%s/a1.pdf %s/o.pdf' % (tm, tm)],
            ['sh', '-c', ' '.join(QPDF) + ' %s/a1.pdf %s/a.pdf; [ -s %s/a.pdf ]' % (tm, tm, tm)]]))
        # B = cách của scripts/pdf/nen-pdf-tai-lieu.py (ảnh xám 150 dpi, trang có màu giữ màu) + lớp chữ
        dua_vao(NEN_ANH, tm + '/nen-anh.py')
        cac.append(('B: ảnh xám 150 dpi, trang có màu giữ màu (nen-pdf-tai-lieu.py) + lớp chữ', tm + '/b.pdf', [
            ['sh', '-c', 'cd %s && python3 nen-anh.py %s %s/b0.pdf; [ -s %s/b0.pdf ]' % (tm, goc, tm, tm)],
            ['sh', '-c', 'ocrmypdf -l vie --output-type pdf --optimize 0 %s/b0.pdf %s/b.pdf >/dev/null 2>&1; [ -s %s/b.pdf ]'
             % (tm, tm, tm)]]))
        for ten, ra, lenh in cac:
            try:
                for l in lenh:
                    may(*l, timeout=1800)
            except Exception as e:
                da_thu.append({'cach': ten, 'ketQua': 'không làm được: %s' % str(e)[:160]})
                continue
            co = kich_thuoc(ra)
            t2, _ = thong_tin(ra)
            diem = khop_chu(mau_tu, tu(ocr_trang(ra, tm + '/ocr1', 3)))
            lop = ty_le_tieng_viet(chu_cua(ra))
            kq = {'cach': ten, 'kichThuoc': co, 'mayDocLai': round(diem * 100, 1)}
            if t2 != trang:
                kq['ketQua'] = 'SAI SỐ TRANG — bỏ'
            elif diem < NGUONG_DOC_DUOC:
                kq['ketQua'] = 'máy đọc lại chỉ ra %.1f%% số chữ (dưới %d%%) — ảnh mờ quá, bỏ' % (diem * 100, NGUONG_DOC_DUOC * 100)
            elif lop < 0.25:
                kq['ketQua'] = 'lớp chữ tiếng Việt không vào được — bỏ'
            else:
                kq['ketQua'] = 'ĐẠT: máy đọc lại ra %.1f%% số chữ' % (diem * 100)
                ung_vien.append((co, ra, ten))
            da_thu.append(kq)

    # ── Chọn: bản NHỎ NHẤT trong số bản đạt và bớt được từ 10% trở lên ──
    ung_vien.sort()
    dat = [u for u in ung_vien if u[0] <= co_goc * (1 - BOT_IT_NHAT)]
    ban_o = [u for u in ung_vien if u[2].startswith('O')]
    if dat:
        co_luu, chon, cach = dat[0]
    elif not co_lop_chu and ban_o:
        # Bản quét mà nén không bõ: vẫn lấy bản O — ảnh y nguyên bản gốc, chỉ thay lớp chữ rác
        # bằng lớp chữ tiếng Việt đọc lại (tìm chữ trong tệp mới ra đúng).
        co_luu, chon, cach = ban_o[0]
    else:
        chon, cach, co_luu = goc, 'giữ nguyên bản gốc', co_goc

    dich_dir = THU_MUC_RIENG if rieng else THU_MUC_LUU
    os.makedirs(dich_dir, exist_ok=True)
    dich = os.path.join(dich_dir, ma + '.pdf')
    lay_ra(chon, dich)
    t3, _ = thong_tin(chon)
    if t3 != trang or os.path.getsize(dich) != co_luu:
        loi('bản cất ra không khớp (số trang / kích thước) — dừng, không ghi chỉ mục.')
    duong_web = ''
    if cong_khai and not rieng:
        os.makedirs(THU_MUC_TK, exist_ok=True)
        duong_web = os.path.join(THU_MUC_TK, ma + '.pdf')
        shutil.copyfile(dich, duong_web)
    tep_chu = ''
    if not co_lop_chu:
        # Chữ máy đọc từ bản gốc NÉT NHẤT (300 dpi) — cất lại vì bản gốc sắp bị xoá, đọc lại từ bản
        # nén thì kém hơn. Đây là chữ MÁY ĐỌC, chưa soát.
        tep_chu = os.path.join(dich_dir, ma + '.ocr.txt')
        with open(tep_chu, 'w', encoding='utf-8', newline='\n') as f:
            f.write('# CHỮ DO MÁY ĐỌC TỪ ẢNH QUÉT (tesseract tiếng Việt, 300 dpi, đọc từ bản gốc) — CHƯA SOÁT.\n'
                    '# Muốn trích dẫn phải đối chiếu với ảnh trong %s.pdf\n\n' % ma)
            f.write(chu_luu.strip() + '\n')
    may('rm', '-rf', tm)

    rel = lambda p: os.path.relpath(p, GOC).replace('\\', '/') if p else ''
    muc = {
        'ma': ma, 'tep': rel(dich), 'tenGoc': os.path.basename(tep),
        'ngayNhan': ngay_nhan or datetime.date.today().isoformat(),
        'soTrang': trang, 'coLopChu': co_lop_chu,
        'kichThuocGoc': co_goc, 'kichThuocLuu': co_luu,
        'cachLuu': cach, 'daThu': da_thu,
        'sha256Goc': h_goc, 'sha256Luu': sha256(dich),
        'banWeb': rel(duong_web), 'chuMayDoc': rel(tep_chu),
        'coDuLieuCaNhan': bool(rieng),
    }
    if doi_dang:
        muc['doiDang'] = doi_dang
    if chu_ky:
        muc['chuKySoBanGoc'] = chu_ky
        if cach != 'giữ nguyên bản gốc':
            muc['luuYChuKy'] = 'Bản cất là bản nén nên KHÔNG còn chữ ký số; thông tin chữ ký của bản gốc ghi ở trên.'
    if ghi_chu:
        muc['ghiChu'] = ghi_chu
    cm['tep'] = [x for x in cm['tep'] if x['ma'] != ma] + [muc]
    ghi_chi_muc(cm)
    bao('\nĐÃ THỬ:')
    for x in da_thu:
        bao('  - %s: %s%s' % (x['cach'], x.get('ketQua'),
                              (' (%s byte)' % format(x['kichThuoc'], ',').replace(',', '.')) if x.get('kichThuoc') else ''))
    bao('CHỌN: %s → %s byte (bản gốc %s byte, còn %d%%)' % (
        cach, format(co_luu, ',').replace(',', '.'), format(co_goc, ',').replace(',', '.'), round(100 * co_luu / max(co_goc, 1))))
    bao('Đã cất: %s' % rel(dich))
    if duong_web:
        bao('Bản cho web xem: %s' % rel(duong_web))
    if tep_chu:
        bao('Chữ máy đọc (chưa soát): %s' % rel(tep_chu))
    return muc


# ───────────────────────────── 2. BÓC CHỮ ─────────────────────────────
def tim_muc(ma):
    for x in doc_chi_muc()['tep']:
        if x['ma'] == ma:
            return x
    loi('chưa có mã %s trong chi-muc.json — chạy "luu-tru" trước.' % ma)


def boc_chu(ma):
    x = tim_muc(ma)
    if x.get('chuMayDoc'):
        t = open(os.path.join(GOC, x['chuMayDoc']), encoding='utf-8').read()
        return re.sub(r'^#.*\n', '', t, flags=re.M).strip() + '\n'
    kiem_may()
    duong = os.path.join(GOC, x['tep'])
    tm = '%s/%s-boc' % (TAM, ma)
    may('sh', '-c', 'rm -rf %s && mkdir -p %s' % (tm, tm))
    dua_vao(duong, tm + '/v.pdf')
    t = chu_cua(tm + '/v.pdf')
    may('rm', '-rf', tm)
    return t


# ───────────────────────────── 3. SOẠN NHÁP CÔNG VĂN ─────────────────────────────
RE_QUOC_HIEU = re.compile(r'^CỘNG H[OÒ]A XÃ HỘI CHỦ NGHĨA VIỆT NAM$|^CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM$')
RE_TIEU_NGU = re.compile(r'^Độc lập\s*-\s*Tự do\s*-\s*Hạnh phúc$')
RE_SO = re.compile(r'^Số\s*:\s*(.+)$')
RE_NGAY = re.compile(r'^(.{2,40}?),\s*ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})')
RE_KY = re.compile(r'^(KT\.|TM\.|TL\.|TUQ\.|Q\.)?\s*[A-ZĐÀ-Ỹ .]{4,}$')
# Dẫn chiếu trong công văn: "khoản 3 Điều 8 Nghị định số 151/2025/NĐ-CP", "Điều 122 Luật Đất đai năm 2024"
RE_DAN_CV = re.compile(
    r'((?:tiết\s+\S+\s+)?(?:điểm\s+[a-zđ]\s+)?(?:khoản\s+(\d{1,2})\s+)?Điều\s+(\d{1,3})(?:\s+của)?\s+'
    r'(?:(Luật Đất đai)(?:\s+năm\s+(\d{4}))?|(?:Luật|Nghị định|Nghị quyết|Thông tư|Quyết định)(?:\s+số)?\s+'
    r'(\d{1,4}/\d{4}/[A-ZĐ][A-ZĐ0-9-]*)))')
RE_SO_HIEU = re.compile(r'\b(\d{1,4}/(?:\d{4}/)?[A-ZĐ][A-ZĐ0-9-]*)\b')


def kho_theo_so():
    kho = json.load(open(os.path.join(THU_MUC_WEB, '_kho.json'), encoding='utf-8'))
    return kho, {x['soHieu']: x['ma'] for x in kho}


def tim_dan_chieu(cac_doan):
    """Mọi chỗ công văn trích điều của văn bản khác. Có trong kho thì trỏ về đúng (mã, điều)."""
    kho, theo_so = kho_theo_so()
    ra, thay = [], set()
    for d in cac_doan:
        for m in RE_DAN_CV.finditer(chuan(d)):
            khoan, dieu, ldd, nam, so = m.group(2), int(m.group(3)), m.group(4), m.group(5), m.group(6)
            muc = {'chu': m.group(1)}
            if ldd:
                ma = 'ldd' + (nam or '2024')
                if any(x['ma'] == ma for x in kho):
                    muc.update({'ma': ma, 'so': dieu})
            elif so in theo_so:
                muc.update({'ma': theo_so[so], 'so': dieu})
            else:
                muc.update({'soHieu': so, 'ngoaiKho': True})
            if khoan:
                muc['khoan'] = int(khoan)
            k = json.dumps(muc, sort_keys=True, ensure_ascii=False)
            if k not in thay:
                thay.add(k)
                ra.append(muc)
    return ra


def tim_so_hieu(cac_doan, so_cua_minh=''):
    """Mọi số hiệu văn bản được nhắc trong bài (kể cả không kèm số điều). Có trong kho thì kèm mã."""
    _, theo_so = kho_theo_so()
    ra = []
    for d in cac_doan:
        for so in RE_SO_HIEU.findall(chuan(d)):
            if so == so_cua_minh or any(z['soHieu'] == so for z in ra):
                continue
            ra.append({'soHieu': so, 'ma': theo_so[so]} if so in theo_so else {'soHieu': so})
    return ra


def noi_doan(dong):
    """Nối các dòng bị ngắt giữa câu thành đoạn (giống cách don() của tach-luat-pdf.py)."""
    ra = []
    for d in dong:
        d = d.strip()
        if not d:
            continue
        moi = d.startswith(('- ', '+ ', '* ', '(')) or re.match(r'^\d{1,2}[.)]\s', d) or re.match(r'^[a-zđ]\)\s', d)
        if ra and not moi and not (ra[-1].endswith(('.', ';', ':', './.')) and d[:1].isupper()):
            ra[-1] += ' ' + d
        else:
            ra.append(d)
    return ra


def nhap_cong_van(ma, tinh='', nhom='huong-dan'):
    x = tim_muc(ma)
    chu = boc_chu(ma)
    dong = [d.strip() for d in chu.replace('\f', '\n').split('\n')]
    dong = [d for d in dong if d and not re.fullmatch(r'\d{1,3}', d)]      # bỏ số trang
    the = {'coQuan': [], 'soHieu': '', 'ngay': '', 'diaDanh': '', 'ten': [], 'kinhGui': [], 'doan': [],
           'noiNhan': [], 'chucVuKy': [], 'nguoiKy': ''}
    vung = 'dau'
    for d in dong:
        if vung == 'dau':
            if RE_QUOC_HIEU.match(d) or RE_TIEU_NGU.match(d):
                continue
            m = RE_SO.match(d)
            if m:
                the['soHieu'] = re.sub(r'\s+', '', m.group(1))
                continue
            m = RE_NGAY.match(d)
            if m:
                the['diaDanh'] = m.group(1).strip()
                the['ngay'] = '%s-%02d-%02d' % (m.group(4), int(m.group(3)), int(m.group(2)))
                continue
            if d.startswith(('V/v', 'Về việc', 'V/V')) or (the['ten'] and not d.startswith('Kính gửi')):
                the['ten'].append(d)
                continue
            if d.startswith('Kính gửi'):
                the['kinhGui'].append(re.sub(r'^Kính gửi\s*:\s*', '', d))
                vung = 'kinh-gui'
                continue
            if d.isupper():
                the['coQuan'].append(d)
                continue
            vung = 'than'
        if vung == 'kinh-gui':
            if d.startswith('- ') or (the['kinhGui'] and not the['kinhGui'][-1].endswith(('.', ';'))
                                      and d[:1].islower()):
                the['kinhGui'].append(d)
                continue
            vung = 'than'
        if vung == 'than':
            if re.match(r'^Nơi nhận\s*:?', d):
                vung = 'noi-nhan'
                continue
            the['doan'].append(d)
            continue
        if vung == 'noi-nhan':
            if d.startswith('- '):
                the['noiNhan'].append(d[2:].strip())
            elif RE_KY.match(d):
                the['chucVuKy'].append(d)
            else:
                the['nguoiKy'] = d
    doan = noi_doan(the['doan'])
    ten = re.sub(r'^(V/v|V/V)\s*', '', ' '.join(the['ten'])).strip()
    nhap = {
        'nhap': True,
        'ghiChuNhap': 'BẢN NHÁP do máy soạn — soát từng đoạn với bản gốc (bản quét: với ẢNH), tách chú thích '
                      'cuối trang, rồi xoá trường "nhap" và "ghiChuNhap".',
        'ma': ma, 'loai': 'Công văn', 'nhom': nhom,
        'soHieu': the['soHieu'], 'ngay': the['ngay'], 'diaDanh': the['diaDanh'],
        'coQuanChuQuan': the['coQuan'][0] if len(the['coQuan']) > 1 else '',
        'coQuan': the['coQuan'][-1] if the['coQuan'] else '',
        'coQuanNgan': '', 'tinh': tinh, 'phamVi': 'tinh-khac' if tinh and 'Khánh Hòa' not in tinh else 'khanh-hoa',
        'ten': ten, 'kinhGui': ' '.join(the['kinhGui']).strip(),
        'doan': doan, 'chuThich': [], 'noiNhan': the['noiNhan'],
        'chucVuKy': the['chucVuKy'], 'nguoiKy': the['nguoiKy'],
        'nguonChu': 'lop-chu-pdf' if x.get('coLopChu') else 'may-doc-anh-quet',
        'suaMayDoc': [],
        'banGoc': ('/luat/tham-khao/%s.pdf' % ma) if x.get('banWeb') else '',
        'luuTru': x['tep'],
        'danChieu': tim_dan_chieu(doan),
        'vanBanNhacToi': tim_so_hieu(doan, the['soHieu']),
        'lienQuan': [], 'chuDe': [], 'chang': [],
        'giaiThich': {'tom': '', 'y': [], 'luuY': ''},
    }
    os.makedirs(THU_MUC_TK, exist_ok=True)
    ra = os.path.join(THU_MUC_TK, ma + '.json')
    if os.path.exists(ra):
        ra = os.path.join(THU_MUC_TK, ma + '.nhap.json')
    with open(ra, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(nhap, f, ensure_ascii=False, indent=1)
        f.write('\n')
    bao('Đã soạn nháp: %s' % os.path.relpath(ra, GOC))
    bao('  số hiệu %s · ngày %s · %d đoạn · %d dẫn chiếu (%d trong kho)' % (
        nhap['soHieu'] or '?', nhap['ngay'] or '?', len(doan), len(nhap['danChieu']),
        sum(1 for z in nhap['danChieu'] if z.get('ma'))))


# ───────────────────────────── 4. KIỂM ─────────────────────────────
TRUONG_BAT_BUOC = ['ma', 'loai', 'nhom', 'soHieu', 'ngay', 'coQuan', 'coQuanNgan', 'ten', 'doan',
                   'nguonChu', 'luuTru', 'danChieu', 'chuDe', 'giaiThich', 'canhBao']


def kiem(chi_ma=None):
    kho, _ = kho_theo_so()
    dieu_co = {}
    for k in kho:
        p = os.path.join(THU_MUC_WEB, k['ma'] + '.json')
        if os.path.exists(p):
            dieu_co[k['ma']] = {d['so']: d for d in json.load(open(p, encoding='utf-8'))['dieu']}
    cm = {x['ma']: x for x in doc_chi_muc()['tep']}
    ds = sorted(glob.glob(os.path.join(THU_MUC_TK, '*.json')))
    if chi_ma:
        ds = [p for p in ds if os.path.basename(p) == chi_ma + '.json']
    tong_loi = 0
    for p in ds:
        if p.endswith('.nhap.json'):
            continue
        v = json.load(open(p, encoding='utf-8'))
        sai = []
        if v.get('nhap'):
            sai.append('vẫn còn là BẢN NHÁP (trường "nhap") — chưa soát xong')
        for t in TRUONG_BAT_BUOC:
            if v.get(t) in (None, '', [], {}) and not (t == 'danChieu' and v.get('danChieu') == []):
                sai.append('thiếu trường "%s"' % t)
        if os.path.basename(p) != v.get('ma', '') + '.json':
            sai.append('tên tệp không khớp mã')
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', v.get('ngay', '')):
            sai.append('ngày phải dạng YYYY-MM-DD')
        x = cm.get(v.get('ma'))
        if not x:
            sai.append('chưa có trong chi-muc.json (chưa lưu trữ bản gốc?)')
        elif not os.path.exists(os.path.join(GOC, x['tep'])):
            sai.append('mất tệp lưu trữ %s' % x['tep'])
        if v.get('banGoc') and not os.path.exists(os.path.join(THU_MUC_WEB, '..', v['banGoc'].lstrip('/'))):
            sai.append('đường dẫn banGoc trỏ tới tệp không có: %s' % v['banGoc'])
        for z in (v.get('danChieu') or []) + (v.get('lienQuan') or []):
            if z.get('ma'):
                if z['ma'] not in dieu_co:
                    sai.append('dẫn chiếu tới văn bản không có trong kho: %s' % z['ma'])
                elif z.get('so') and z['so'] not in dieu_co[z['ma']]:
                    sai.append('dẫn chiếu tới điều không có thật: %s Điều %s' % (z['ma'], z['so']))
                elif z.get('so') and z.get('khoan'):
                    ks = [k['so'] for k in dieu_co[z['ma']][z['so']]['khoan']]
                    if z['khoan'] not in ks:
                        sai.append('dẫn chiếu tới khoản không có thật: %s Điều %s khoản %s' % (z['ma'], z['so'], z['khoan']))
        # NGUYÊN VĂN
        if x and os.path.exists(os.path.join(GOC, x['tep'])):
            goc_chu = chuan(boc_chu(v['ma']))
            phan = [v.get('ten', ''), v.get('kinhGui', '')] + list(v.get('doan') or []) + \
                   [c.get('chu', '') for c in (v.get('chuThich') or [])] + list(v.get('noiNhan') or [])
            if v.get('nguonChu') == 'lop-chu-pdf':
                for s in phan:
                    if s and chuan(s) not in goc_chu:
                        # chú thích cuối trang có thể bị bóc xen giữa đoạn — so theo từng câu cho công bằng
                        cau = [c for c in re.split(r'(?<=[.;:])\s+', chuan(s)) if len(c) > 12]
                        thieu = [c for c in cau if c not in goc_chu]
                        if thieu or not cau:
                            sai.append('KHÔNG KHỚP NGUYÊN VĂN: "%s…"' % chuan(s)[:90])
            else:
                # bản quét: liệt kê chữ khác với chữ máy đọc để người soát nhìn lại ảnh
                a, b = tu(' '.join(phan)), tu(goc_chu)
                sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
                khac = [(' '.join(a[i1:i2]), ' '.join(b[j1:j2])) for op, i1, i2, j1, j2 in sm.get_opcodes() if op != 'equal']
                sua = [(' '.join(tu(s.get('may', ''))), ' '.join(tu(s.get('dung', ''))))
                       for s in (v.get('suaMayDoc') or [])]

                def da_giai_thich(ta, tb):
                    # chỗ khác này đã được ghi trong "suaMayDoc" (máy đọc X → đúng là Y theo ảnh) chưa
                    return any((not ta or ta in d) and (not tb or tb in m) for m, d in sua)
                chua = [(ta, tb) for ta, tb in khac if not da_giai_thich(ta, tb)]
                bao('  [%s] chữ đã soát khác chữ máy đọc %d chỗ, %d chỗ đã ghi lý do trong suaMayDoc (khớp %.1f%%):'
                    % (v['ma'], len(khac), len(khac) - len(chua), 100 * khop_chu(a, b)))
                for ta, tb in khac[:80]:
                    bao('      %s "%s"  ⟵ máy đọc "%s"' % ('✓' if da_giai_thich(ta, tb) else '?', ta, tb))
                if chua:
                    bao('      (dấu ? = chưa ghi lý do: nhìn lại ẢNH, đúng thì thêm vào suaMayDoc, sai thì sửa đoạn chữ)')
        tong_loi += len(sai)
        bao('%s %s%s' % ('OK ' if not sai else '[!]', v.get('ma'), ''.join('\n      - ' + s for s in sai)))
    for p in glob.glob(os.path.join(THU_MUC_TK, '*.nhap.json')):
        bao('[!] còn bản nháp chưa xử lý: %s' % os.path.relpath(p, GOC))
        tong_loi += 1
    if not ds:
        bao('(chưa có văn bản tham khảo nào)')
    return tong_loi


# ───────────────────────────── 5. VÀO KHO (văn bản có Điều) ─────────────────────────────
def nap_module(ten, tep):
    spec = importlib.util.spec_from_file_location(ten, os.path.join(os.path.dirname(os.path.abspath(__file__)), tep))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def vao_kho(cac_tep, ma, so_hieu, ten='', het_hieu_luc=''):
    """Tách MỘT văn bản bằng đúng bộ tách của kho rồi thêm/thay đúng một dòng trong _kho.json.

    KHÔNG chạy lại dung-kho-luat.py cho cả kho: nó dựng _kho.json từ thư mục tệp chữ, mà tệp chữ của
    các văn bản cũ không còn trên máy — chạy là mất sạch văn bản cũ khỏi kho."""
    kiem_ma(ma)
    dk = nap_module('dungkho', 'dung-kho-luat.py')
    if ten:
        dk.TEN_RIENG[ma] = ten
    if het_hieu_luc:
        dk.HET_HIEU_LUC[ma] = het_hieu_luc
    for t in cac_tep:
        if not os.path.isfile(t):
            loi('không thấy tệp chữ: %s' % t)
    muc = dk.lam(list(cac_tep), so_hieu, ma, THU_MUC_WEB)
    if not muc:
        loi('bộ tách báo lỗi (xem dòng [!] ở trên) — chưa ghi gì vào kho.')
    p_kho = os.path.join(THU_MUC_WEB, '_kho.json')
    kho = json.load(open(p_kho, encoding='utf-8'))
    cu = next((x for x in kho if x['ma'] == ma), None)
    if cu:
        cu.update(muc)                      # giữ các quan hệ đã tính, chỉ thay phần đọc từ văn bản
    else:
        kho.append(muc)
    # Thứ tự như dung-kho-luat.py: Luật Đất đai 2024 → văn bản còn hiệu lực theo ngày → đời cũ, mới trước.
    con = [x for x in kho if not x.get('hetHieuLuc')]
    cu_ = sorted([x for x in kho if x.get('hetHieuLuc')], key=lambda x: x['ngay'], reverse=True)
    con.sort(key=lambda x: (0 if x['ma'] == 'ldd2024' else 1, x['ngay']))
    kho = con + cu_
    # Lược đồ "nhắc tới" ở mức văn bản — tính lại cho cả kho vì văn bản mới có thể nhắc văn bản cũ.
    theo_so = {x['soHieu']: x['ma'] for x in kho}
    for x in kho:
        p = os.path.join(THU_MUC_WEB, x['ma'] + '.json')
        if not os.path.exists(p):
            continue
        v = json.load(open(p, encoding='utf-8'))
        chu = ' '.join(k['chu'] + ' ' + ' '.join(y['chu'] for y in k['diem']) for d in v['dieu'] for k in d['khoan'])
        x['dan'] = sorted({m for so, m in theo_so.items() if m != x['ma'] and so in chu})
    for x in kho:
        x['duocDan'] = sorted({y['ma'] for y in kho if x['ma'] in y.get('dan', [])})
    with open(p_kho, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(kho, f, ensure_ascii=False, indent=1)
    bao('Đã %s %s (%s) vào _kho.json — kho có %d văn bản.' % ('cập nhật' if cu else 'thêm', ma, so_hieu, len(kho)))
    bao('VIỆC TIẾP THEO (đúng thứ tự, xem SKILL.md): dung-luoc-do.py → dung-lien-ket.py → dung-tinh-trang-dieu.py '
        '→ dung-sua-doi-dieu.py → va-luoc-do-doi-cu.py → dung-tu-dien.py → dung-chuoi-doc.py → dung-lo-trinh.py '
        '→ dung-the-tu-dong.py → soat-lien-ket.py → dung-bo-tong-hop.py')


# ───────────────────────────── chạy ─────────────────────────────
def lay_co(ds, ten, mac_dinh=None, co_gia_tri=True):
    if ten not in ds:
        return mac_dinh
    i = ds.index(ten)
    if not co_gia_tri:
        ds.pop(i)
        return True
    if i + 1 >= len(ds):
        loi('thiếu giá trị sau %s' % ten)
    gt = ds[i + 1]
    del ds[i:i + 2]
    return gt


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help', 'giup'):
        print(__doc__)
        sys.exit(0)
    lenh = a.pop(0)
    if lenh == 'luu-tru':
        ma = lay_co(a, '--ma')
        cong = lay_co(a, '--cong-khai', False, False)
        rieng = lay_co(a, '--rieng', False, False)
        gc = lay_co(a, '--ghi-chu', '')
        nn = lay_co(a, '--ngay-nhan', '')
        if len(a) != 1 or not ma:
            loi('cách dùng: luu-tru <tệp> --ma <mã> [--cong-khai] [--rieng] [--ghi-chu "..."]')
        luu_tru(a[0], ma, cong_khai=cong, rieng=rieng, ghi_chu=gc, ngay_nhan=nn)
    elif lenh == 'boc-chu':
        ma = lay_co(a, '--ma')
        ra = lay_co(a, '--ra', '')
        t = boc_chu(ma)
        if ra:
            open(ra, 'w', encoding='utf-8', newline='\n').write(t)
            bao('Đã ghi %s (%d ký tự)' % (ra, len(t)))
        else:
            print(t)
    elif lenh == 'nhap-cong-van':
        ma = lay_co(a, '--ma')
        nhap_cong_van(ma, tinh=lay_co(a, '--tinh', ''), nhom=lay_co(a, '--nhom', 'huong-dan'))
    elif lenh == 'kiem':
        sys.exit(1 if kiem(lay_co(a, '--ma', None)) else 0)
    elif lenh == 'vao-kho':
        ma = lay_co(a, '--ma')
        so = lay_co(a, '--so-hieu')
        ten = lay_co(a, '--ten', '')
        hhl = lay_co(a, '--het-hieu-luc', '')
        if not a or not ma or not so:
            loi('cách dùng: vao-kho <tệp-chữ_p1.txt> [tệp_p2.txt…] --ma <mã> --so-hieu <số hiệu>')
        vao_kho(a, ma, so, ten=ten, het_hieu_luc=hhl)
    else:
        loi('không có lệnh "%s". Gõ: python scripts/luat/them-van-ban.py giup' % lenh)
