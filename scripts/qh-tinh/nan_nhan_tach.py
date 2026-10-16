# -*- coding: utf-8 -*-
# NẮN THÔ THEO NHÃN LƯỚI IN TÁCH ĐÔI (16/10/2026) — bản đồ QHSDĐ 2030 xuất từ MicroStation (vd Bình Thuận) ghi nhãn toạ độ thành HAI
# chữ rời: số lớn + số nhỏ ("1260" + "000" = 1.260.000; "422" + "500" = 422.500), có khi ghi liền ("422500"). nan2.py không ghép được
# nên báo "khong khop du truc". Script này gom nhãn ở bốn MÉP khung, ghép số tách, khớp tuyến tính E = ie + se·x, N = inn + sn·y,
# ghi <pdf>.nan.json (kèm "ktt" — kinh tuyến trục của tỉnh). Sau đó chạy nan_vach_luoi.py để nắn CHÍNH XÁC theo vạch lưới thật.
# Dùng: python -P nan_nhan_tach.py <ban_do.pdf> <ktt_do> [--le=150]
#   ktt_do: kinh tuyến trục VN-2000 của tỉnh, vd Bình Thuận 108.5 (108°30'), Lâm Đồng 107.75, Khánh Hòa 108.25.
import sys, os, re, json
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np, pymupdf

co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
pdf, ktt = ts[0], float(ts[1])
LE = float(next((a.split('=', 1)[1] for a in co if a.startswith('--le=')), 150))   # bề rộng dải mép khung tìm nhãn (điểm in)
pg = pymupdf.open(pdf)[0]
if pg.rotation: sys.exit(f'LOI: trang xoay {pg.rotation} do')
ws = [(w[0], w[1], w[2], w[3], w[4].replace('.', '').replace(',', '')) for w in pg.get_text('words')]
so = [w for w in ws if re.fullmatch(r'\d{2,7}', w[4])]

# Khung bản đồ = vùng chứa các nhãn 6–7 chữ số hoặc số tách; lấy theo phân bố nhãn để biết mép.
def ghep(ds):
    """Ghép số tách: chữ đứng sau (3 chữ số) nằm sát bên phải / ngay dưới chữ đứng trước → một số."""
    ra, dung = [], set()
    for i, a in enumerate(ds):
        if i in dung: continue
        tot = None
        if len(a[4]) in (2, 3, 4):
            for j, b in enumerate(ds):
                if j == i or j in dung or len(b[4]) != 3: continue
                # b nằm ngay sau a (cùng dòng hoặc lệch xuống nửa chữ), cách < 1,5 chiều cao chữ
                h = a[3] - a[1]
                # số nhỏ hay chồm lên số lớn một chút (Hàm Thuận Bắc: "1260" kết thúc x 509,9, "000" bắt đầu 509,2) → cho phép chồm ≤ 1,6 chiều cao chữ (Bắc Bình chồm 4,5 / cao 3,8)
                if -1.6 * h <= b[0] - a[2] < 1.5 * h + 2 and abs(b[1] - a[1]) < 1.6 * h:
                    if tot is None or b[0] < tot[1][0]: tot = (j, b)
        if tot:
            j, b = tot; dung.add(j); dung.add(i)
            ra.append(((min(a[0], b[0]) + max(a[2], b[2])) / 2, (min(a[1], b[1]) + max(a[3], b[3])) / 2, int(a[4] + b[4]), (a[0], a[1], b[2], b[3])))
        elif len(a[4]) >= 6:
            dung.add(i); ra.append(((a[0] + a[2]) / 2, (a[1] + a[3]) / 2, int(a[4]), (a[0], a[1], a[2], a[3])))
    return ra

nhan = ghep(so)
# E (đông) ~ 300.000–700.000 (6 chữ số), N (bắc) ~ 1.000.000–2.600.000 (7 chữ số)
E0 = [(x, y, v) for x, y, v, bb in nhan if 200000 <= v <= 800000 and v % 100 == 0]
N0 = [(x, y, v) for x, y, v, bb in nhan if 900000 <= v <= 2700000 and v % 100 == 0]
# CHỈ LẤY NHÃN THẲNG HÀNG trên dải mép khung (Bắc Bình, Đức Linh: số trong bảng biểu / chú thích giữa bản đồ ghép nhầm thành "nhãn").
# Nhãn E nằm trên 1–2 dải NGANG (mép trên / dưới), nhãn N trên 1–2 dải DỌC (mép trái / phải): gom theo y (E) / x (N), giữ dải có
# ≥ 3 nhãn, mỗi dải phải có giá trị KHÁC NHAU tăng / giảm đều.
def dai(ds, k_vt):
    nhom = {}
    for d in ds: nhom.setdefault(round(d[k_vt] / 6), []).append(d)
    gop = {}
    for k in sorted(nhom):                              # gộp các dải sát nhau (lệch ≤ 1 bậc 6 điểm in)
        ke = next((g for g in gop if abs(g - k) <= 1), None)
        gop.setdefault(ke if ke is not None else k, []).extend(nhom[k])
    tot = [g for g in gop.values() if len({d[2] for d in g}) >= 3]
    return [d for g in sorted(tot, key=len, reverse=True)[:2] for d in g]
E = [(x, v) for x, y, v in dai(E0, 1)]
N = [(y, v) for x, y, v in dai(N0, 0)]
def khop(cap, ten):
    if len(cap) < 3: sys.exit(f'LOI: chi thay {len(cap)} nhan {ten}')
    a = np.array(cap, float)
    # bỏ nhãn lạc (số trùng giá trị ở hai mép thì giữ cả — cùng một đường lưới)
    k, b = np.polyfit(a[:, 0], a[:, 1], 1)
    du = a[:, 1] - (k * a[:, 0] + b)
    tot = np.abs(du) < max(50.0, 3 * np.median(np.abs(du)) + 1)
    k, b = np.polyfit(a[tot, 0], a[tot, 1], 1)
    du = a[tot, 1] - (k * a[tot, 0] + b)
    print(f'{ten}: {tot.sum()}/{len(a)} nhan, he so {k:.4f} m/diem in, lech TB {np.mean(np.abs(du)):.1f} m, lon nhat {np.max(np.abs(du)):.1f} m')
    return k, b
se, ie = khop(E, 'Dong (E)')
sn, inn = khop(N, 'Bac (N)')
if abs(abs(se) - abs(sn)) / abs(se) > 0.02: print(f'⚠️ ti le hai truc lech {abs(abs(se) - abs(sn)) / abs(se) * 100:.1f} % — kiem lai')
ra = pdf + '.nan.json'
cu = json.load(open(ra, encoding='utf-8')) if os.path.exists(ra) else {}
cu.update({'se': se, 'ie': ie, 'sn': sn, 'inn': inn, 'ktt': ktt, 'nguon_nan': 'nan_nhan_tach.py (tho, theo nhan) — chay tiep nan_vach_luoi.py'})
cu.pop('luoi', None)   # phép thô mới → bỏ lưới cũ (nan_vach_luoi.py dựng lại)
json.dump(cu, open(ra, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ghi', ra)
