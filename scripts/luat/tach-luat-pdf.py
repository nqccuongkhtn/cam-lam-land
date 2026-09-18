# -*- coding: utf-8 -*-
"""
TÁCH VĂN BẢN LUẬT TỪ CHỮ BÓC RA CỦA BẢN PDF KÝ SỐ (Công báo) THÀNH CẤU TRÚC.

Vì sao dùng bản PDF ký số chứ không dùng bản HTML trên cổng: đã đo — bản HTML toàn văn của
cổng Chính phủ THIẾU HẲN 3 điều (67, 110, 119) của Luật Đất đai 2024 mà không báo gì.
Bản PDF ký số đăng Công báo là bản gốc, đếm ra ĐỦ 260/260 điều.

Ra: Chương → Mục → Điều → Khoản → Điểm, GIỮ NGUYÊN VĂN từng chữ (chỉ nối lại dòng bị
ngắt giữa chừng do trình bày trang, và bỏ dòng tiêu đề trang "CÔNG BÁO/Số ...").

Có bước TỰ KIỂM in ra: đủ số điều chưa, điều nào rỗng, khoản có đứt số không.

Chạy:  python tach-luat-pdf.py <chu.txt> <ma> <so-hieu> <ngay> "<ten>" <ra.json>
"""
import sys, os, re, json

RAC = re.compile(r'^\s*(CÔNG BÁO/Số.*|\d{1,4})\s*$')          # tiêu đề trang + số trang
# Dòng tiêu đề PHỤ LỤC đứng một mình ("Phụ lục", "Phụ lục I", "PHỤ LỤC II").
# Phải đứng MỘT MÌNH mới tính: trong thân bài có đầy câu "...tại Phụ lục I ban hành
# kèm theo Nghị định này" — cắt ở đó là mất nửa văn bản.
RE_PHULUC = re.compile(r'^(PHỤ LỤC|Phụ lục)(\s+[IVXLC]+|\s+\d+)?\s*$')
# Khối chữ ký cuối văn bản ("TM. CHÍNH PHỦ", "Nơi nhận:", "CHỦ TỊCH QUỐC HỘI"...).
# Hết văn bản ở đây; không cắt thì cả khối chữ ký + phụ lục chui vào điều cuối cùng.
RE_KY = re.compile(r'^(TM\.\s|KT\.\s|Nơi nhận\s*:|CHỦ TỊCH QUỐC HỘI|THỦ TƯỚNG CHÍNH PHỦ|BỘ TRƯỞNG)\b')
RE_DIEU = re.compile(r'^Điều\s+(\d{1,3})\s*\.\s*(.*)$')
RE_CHUONG = re.compile(r'^Chương\s+([IVXLC]+)\s*$')
RE_MUC = re.compile(r'^Mục\s+(\d+)\s*$')
RE_KHOAN = re.compile(r'^(\d{1,2})\s*\.\s+(.*)$')
RE_DIEM = re.compile(r'^([a-zđ])\s*\)\s+(.*)$')
RE_GACH = re.compile(r'^[-–]\s+(.*)$')
# ĐOẠN TRÍCH TRONG NGOẶC KÉP: các điều "sửa đổi, bổ sung ... như sau:" chép nguyên
# văn phần luật KHÁC vào trong ngoặc kép. Phần chép đó có số khoản, số điểm, thậm chí
# cả "Điều 129." của luật kia — đọc thẳng là đánh số loạn hết (đã đo: Luật Đất đai 2024
# Điều 245 ra khoản 0,1,2,3,4,5,1,2,3; Điều 244 thì cả thân chui vào tiêu đề).
# Nên: mở ngoặc kép -> chép nguyên xi vào khoản đang đứng, tới khi đóng ngoặc.
RE_MO_NGOAC = re.compile(r'^[“"]')
RE_DONG_NGOAC = re.compile(r'[”"]\s*[.;,]?\s*$')
# Từ nối đứng cuối dòng => câu chưa xong, dòng sau chắc chắn là phần nối tiếp
NOI_DO = re.compile(r'\b(theo|của|và|số|về|tại|cho|do|với|các|một|những|từ|đối|trong|khi|mà|hoặc)\s*$', re.I)
# Dòng MỞ ĐẦU một mục cấu trúc -> không được nối vào dòng trước
MOC = (RE_DIEU, RE_CHUONG, RE_MUC, RE_KHOAN, RE_DIEM, RE_GACH, RE_PHULUC, RE_KY, RE_MO_NGOAC)


def don(txt):
    """Bỏ rác trang, nối lại những dòng bị ngắt giữa câu."""
    dong = [d.rstrip() for d in txt.split('\n')]
    dong = [d for d in dong if d.strip() and not RAC.match(d)]
    ra = []
    for d in dong:
        d = d.strip()
        moi = any(r.match(d) for r in MOC) or d.isupper() or d.startswith('Chương') or d.startswith('Mục ')
        if ra and not moi:
            # dòng trước kết thúc bằng dấu chấm/;/: thì coi như hết đoạn, vẫn nối nếu dòng này
            # bắt đầu bằng chữ thường (bị ngắt giữa câu)
            truoc = ra[-1]
            # Dòng trước là dòng "Điều N. <tiêu đề>" mà dòng này bắt đầu bằng CHỮ HOA
            # -> đây là câu đầu của phần THÂN, không phải tiêu đề bị xuống dòng. Không nối.
            # (Thiếu luật này thì 14 điều không chia khoản bị nuốt cả thân vào tiêu đề.)
            # Trừ khi dòng trước KẾT THÚC BẰNG TỪ NỐI ("... bổ sung một số điều theo")
            # -> câu chưa xong, chắc chắn vẫn là tiêu đề bị xuống dòng, phải nối.
            # (Luật Đất đai 2024 Điều 245 dính đúng chỗ này: dòng sau là "Luật số
            # 21/2017/QH14..." viết hoa nên bị hiểu nhầm là câu mới.)
            if RE_DIEU.match(truoc) and d[:1].isupper() and not NOI_DO.search(truoc):
                ra.append(d)
            elif truoc.endswith(('.', ';', ':')) and d[:1].isupper():
                ra.append(d)
            else:
                ra[-1] = truoc + ' ' + d
        else:
            ra.append(d)
    return ra


def cat_phu_luc(dong):
    """Cắt phần PHỤ LỤC ra khỏi thân văn bản, trả về (thân, phụ lục).

    Vì sao phải cắt: phụ lục của nhiều nghị định là MẪU QUYẾT ĐỊNH, mà trong mẫu
    có sẵn "Điều 1.", "Điều 2.", "Điều 3." — bộ tách đọc nhầm thành điều của nghị
    định. Đã đo: Nghị định 42/2024 đếm ra 18 điều trong khi thật sự chỉ có 12,
    Nghị định 88/2024 ra 36 trong khi thật sự có 32.

    Hai dấu hiệu, lấy cái nào đến trước:
      · dòng tiêu đề "Phụ lục" đứng một mình;
      · số điều TỤT LÙI (đang Điều 12 lại quay về Điều 1) — chắc chắn đã ra khỏi thân.
    """
    cat, mx = None, 0
    for i, d in enumerate(dong):
        if RE_PHULUC.match(d.strip()) or RE_KY.match(d.strip()):
            cat = i
            break
        m = RE_DIEU.match(d)
        if m:
            s = int(m.group(1))
            if s <= mx:
                cat = i
                break
            mx = s
    if cat is None:
        return dong, []
    return dong[:cat], dong[cat:]


def them(hien, s):
    """Nối thêm chữ vào chỗ đang đứng: điểm cuối, không có thì khoản cuối, không có nữa
    thì mở một khoản số 0 (phần thân điều không chia khoản)."""
    if not hien['khoan']:
        hien['khoan'].append({'so': 0, 'chu': s.lstrip('\n'), 'diem': []})
        return
    k = hien['khoan'][-1]
    if k['diem']:
        k['diem'][-1]['chu'] += (s if s.startswith('\n') else ' ' + s)
    else:
        k['chu'] += (s if s.startswith('\n') else ' ' + s)


def tach(txt, ma, so_hieu, ngay, ten, nguon):
    dong, dong_pl = cat_phu_luc(don(txt))
    trong_ngoac = False
    dieu, chuong = [], []
    ch_hien = mu_hien = None
    ch_ten = mu_ten = ''
    i, n = 0, len(dong)
    hien = None
    while i < n:
        d = dong[i]
        m = RE_CHUONG.match(d)
        if m:
            ch_hien = m.group(1)
            # Tên chương IN HOA, dài thì xuống 2-3 dòng -> gộp hết các dòng IN HOA liền sau.
            j, ch_ten = i + 1, ''
            while j < n and dong[j].strip() and dong[j].strip() == dong[j].strip().upper()                     and not RE_DIEU.match(dong[j]) and not RE_MUC.match(dong[j]) and len(ch_ten) < 160:
                ch_ten = (ch_ten + ' ' + dong[j].strip()).strip()
                j += 1
            mu_hien, mu_ten = None, ''
            chuong.append({'so': ch_hien, 'ten': ch_ten})
            i = j
            continue
        m = RE_MUC.match(d)
        if m:
            mu_hien = m.group(1)
            j, mu_ten = i + 1, ''
            while j < n and dong[j].strip() and dong[j].strip() == dong[j].strip().upper()                     and not RE_DIEU.match(dong[j]) and len(mu_ten) < 160:
                mu_ten = (mu_ten + ' ' + dong[j].strip()).strip()
                j += 1
            i = j
            continue
        m = RE_DIEU.match(d)
        if m:
            tieu = m.group(2).strip()
            # Tiêu đề điều DÀI có thể bị xuống dòng. Phân biệt "tiêu đề xuống dòng" với "dòng đầu
            # của phần thân": phần thân luôn bắt đầu bằng CHỮ HOA (câu mới), còn tiêu đề bị ngắt
            # thì dòng sau bắt đầu bằng chữ thường / con số / dấu ngoặc.
            # Không có luật này thì điều nào KHÔNG CHIA KHOẢN (vd Điều 1, Điều 12) bị nuốt luôn
            # cả phần thân vào tiêu đề — đã đo: 14 điều bị vậy.
            j = i + 1
            while (j < n and not any(r.match(dong[j]) for r in MOC) and len(tieu) < 320
                   and dong[j][:1] and not dong[j][:1].isupper()):
                tieu = (tieu + ' ' + dong[j].strip()).strip()
                j += 1
            hien = {'so': int(m.group(1)), 'tieuDe': tieu, 'chuong': ch_hien, 'chuongTen': ch_ten,
                    'muc': mu_hien, 'mucTen': mu_ten, 'khoan': []}
            dieu.append(hien)
            i = j
            continue
        if hien is not None:
            # --- đang ở trong đoạn trích ngoặc kép: chép nguyên xi, không đọc số ---
            if trong_ngoac:
                them(hien, '\n' + d)
                if RE_DONG_NGOAC.search(d):
                    trong_ngoac = False
                i += 1
                continue
            if RE_MO_NGOAC.match(d):
                them(hien, '\n' + d)
                trong_ngoac = not bool(RE_DONG_NGOAC.search(d))
                i += 1
                continue
            mk = RE_KHOAN.match(d)
            md = RE_DIEM.match(d)
            mg = RE_GACH.match(d)
            if mk:
                hien['khoan'].append({'so': int(mk.group(1)), 'chu': mk.group(2).strip(), 'diem': []})
            elif md and hien['khoan']:
                hien['khoan'][-1]['diem'].append({'ky': md.group(1), 'chu': md.group(2).strip()})
            elif mg and hien['khoan']:
                k = hien['khoan'][-1]
                if k['diem']:
                    k['diem'][-1]['chu'] += '\n- ' + mg.group(1).strip()
                else:
                    k['chu'] += '\n- ' + mg.group(1).strip()
            else:
                if hien['khoan']:
                    k = hien['khoan'][-1]
                    if k['diem']:
                        k['diem'][-1]['chu'] += ' ' + d
                    else:
                        k['chu'] += ' ' + d
                else:
                    hien['khoan'].append({'so': 0, 'chu': d, 'diem': []})
        i += 1
    return {'ma': ma, 'soHieu': so_hieu, 'ngay': ngay, 'ten': ten, 'nguon': nguon,
            'chuong': chuong, 'dieu': dieu, 'phuLuc': '\n'.join(dong_pl)}


def tu_kiem(vb, mong=None):
    so = [d['so'] for d in vb['dieu']]
    print('  %s: %d dieu (1..%d), %d chuong' % (vb['soHieu'], len(so), max(so) if so else 0, len(vb['chuong'])))
    thieu = [i for i in range(1, (max(so) if so else 0) + 1) if i not in set(so)]
    if thieu:
        print('  [!] THIEU dieu:', thieu[:40])
    if mong and len(so) != mong:
        print('  [!] SO DIEU KHONG DUNG: lay duoc %d, mong doi %d' % (len(so), mong))
    rong = [d['so'] for d in vb['dieu'] if not d['khoan'] or sum(len(k['chu']) for k in d['khoan']) < 25]
    if rong:
        print('  [!] dieu than qua ngan:', rong[:20])
    dut = []
    for d in vb['dieu']:
        ks = [k['so'] for k in d['khoan'] if k['so'] > 0]
        if ks and ks != list(range(1, len(ks) + 1)):
            dut.append(d['so'])
    if dut:
        print('  [!] khoan dut so o dieu:', dut[:20])
    tong = sum(len(k['chu']) + sum(len(x['chu']) for x in k['diem']) for d in vb['dieu'] for k in d['khoan'])
    print('  tong chu giu duoc: %d ky tu' % tong)
    return not thieu and not rong


if __name__ == '__main__':
    txt = open(sys.argv[1], encoding='utf-8').read()
    ma, so_hieu, ngay, ten, ra = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6]
    nguon = sys.argv[7] if len(sys.argv) > 7 else 'Công báo (bản PDF ký số) — vanban.chinhphu.vn'
    mong = int(sys.argv[8]) if len(sys.argv) > 8 else None
    vb = tach(txt, ma, so_hieu, ngay, ten, nguon)
    tu_kiem(vb, mong)
    json.dump(vb, open(ra, 'w', encoding='utf-8'), ensure_ascii=False)
    print('  -> %s (%d KB)' % (ra, os.path.getsize(ra) // 1024))
