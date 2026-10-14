# -*- coding: utf-8 -*-
# IN BẢN VẼ QUY HOẠCH 1/500 (DGN V8) RA PDF BẰNG CHÍNH MICROSTATION — 14/10/2026.
# Vì sao: bản vẽ 1/500 chính thức (QĐ 2043–2048/QĐ-UBND ngày 25/9/2026 của UBND xã Cam Lâm) là file DGN V8 — GDAL không đọc được,
# còn tự vẽ lại từ DXF thì sai kiểu nét / mẫu tô / ký hiệu. MicroStation V8i có sẵn trên máy chủ nhà → điều khiển nó qua COM
# (MicroStationDGN.Application) để IN ĐÚNG Y NHƯ MicroStation hiển thị, ra PDF nét vector; rồi cắt ô bằng tiler3.py như bản PDF tỉnh.
# Toạ độ KHÔNG đoán: trên một BẢN SAO của file DGN (không đụng file gốc) vẽ thêm 4 DẤU CỘNG ở 4 góc vùng in, toạ độ VN-2000 biết trước;
# tìm lại 4 dấu đó trong PDF → phép affine trang PDF ↔ VN-2000 (ghi <pdf>.nan.json kiểu "afin", nan2.py đọc được) + báo sai số.
# Dùng: python -P in_1_500_dgn.py <file.dgn> <thu_muc_ra> <ten_ngan> [--ty-le=1000] [--le=30]
#   vùng in = khung các vùng "ranh giới lập quy hoạch" (level BV_Rg_lapquyhoach, kiểu nét QH_Ranh…) nới thêm --le mét.
import sys, os, re, time, shutil, json
import numpy as np
import win32com.client, win32com.client.dynamic
sys.stdout.reconfigure(encoding='utf-8')
co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
dgn, ra_dir, ten = os.path.abspath(ts[0]), os.path.abspath(ts[1]), ts[2]
TY_LE = float(next((a.split('=', 1)[1] for a in co if a.startswith('--ty-le=')), 1000))
LE = float(next((a.split('=', 1)[1] for a in co if a.startswith('--le=')), 30))
DPI = int(next((a.split('=', 1)[1] for a in co if a.startswith('--dpi=')), 600))   # 4800 làm MicroStation (32 bit) ngốn > 3 GB với bản 1,7 km
os.makedirs(ra_dir, exist_ok=True)
ban = os.path.join(ra_dir, f'{ten}-{time.strftime("%H%M%S")}.dgn'); pdf = os.path.join(ra_dir, ten + '.pdf')
shutil.copyfile(dgn, ban)                                  # luôn làm trên BẢN SAO (tên mới mỗi lần: bản cũ có thể còn mở trong MicroStation)
if os.path.exists(pdf): os.remove(pdf)

# MicroStation vừa bật (hoặc vừa bị tắt) chưa sẵn sàng thì báo đủ kiểu: "File not found", "RPC server is unavailable",
# thiếu hàm OpenDesignFile… → gọi lại từ đầu, chờ tối đa 2 phút
loi = None
for i in range(60):
    try:
        ms = win32com.client.dynamic.Dispatch('MicroStationDGN.Application'); ms.OpenDesignFile(ban, False); break
    except Exception as ex:
        loi = ex; time.sleep(2)
else: sys.exit(f'LOI: MicroStation khong mo duoc {ban}: {loi}')
m = ms.ActiveModelReference
sc = win32com.client.dynamic.Dispatch('MicroStationDGN.ElementScanCriteria'); ee = m.Scan(sc)
xs, ys = [], []
while ee.MoveNext():
    e = ee.Current
    try:
        if e.Level.Name == 'BV_Rg_lapquyhoach' and e.Type in (6, 14) and e.LineStyle and 'QH_Ranh' in (e.LineStyle.Name or ''):
            r = e.Range; xs += [r.Low.X, r.High.X]; ys += [r.Low.Y, r.High.Y]
    except Exception: pass
if not xs: sys.exit('LOI: khong thay vung ranh lap quy hoach (level BV_Rg_lapquyhoach, kieu net QH_Ranh...)')
x0, y0, x1, y1 = min(xs) - LE, min(ys) - LE, max(xs) + LE, max(ys) + LE
print(f'{ten}: khung ranh {min(xs):.2f},{min(ys):.2f} -> {max(xs):.2f},{max(ys):.2f}; vung in {x1 - x0:.1f} x {y1 - y0:.1f} m')
# 4 dấu cộng hiệu chuẩn (2 nét dài 4 m, màu 3) cách mép vùng in 5 m
DAU = [(x0 + 5, y0 + 5), (x1 - 5, y0 + 5), (x1 - 5, y1 - 5), (x0 + 5, y1 - 5)]
for (x, y) in DAU:
    for (a, b, c, d) in [(x - 2, y, x + 2, y), (x, y - 2, x, y + 2)]:
        el = ms.CreateLineElement2(None, ms.Point3dFromXY(a, b), ms.Point3dFromXY(c, d))
        if isinstance(el, tuple): el = el[0]
        el.Color = 3; el.LineWeight = 0
        # (phần tử mới lấy KIỂU NÉT đang chọn của file — Cam Tân đang chọn nét đứt nên dấu in thành nhiều gạch: bộ dò bên dưới tự nối
        #  gạch lại. Đã thử đặt el.LineStyle = LineStyles.Find('0') qua COM → MicroStation V8i sập "RPC server is unavailable".)
        m.AddElement(el)
# cấu hình máy in PDF riêng: khổ giấy đúng tỉ lệ 1:TY_LE, độ phân giải cao, KHÔNG bỏ chi tiết nhỏ (level of detail)
goc = r'C:\ProgramData\Bentley\MicroStation V8i (SELECTseries)\WorkSpace\System\pltcfg\pdf.pltcfg'
x = open(goc, encoding='utf-16').read()
rong, cao = (x1 - x0) * 1000 / TY_LE + 20, (y1 - y0) * 1000 / TY_LE + 20      # mm (+ lề 10 mm mỗi bên)
x = re.sub(r'<Forms>.*?</Forms>', f'<Forms>\n        <Form>\n            <DisplayName>CL{ten}</DisplayName>\n'
           f'            <Size>{rong:.1f},{cao:.1f},0</Size>\n            <Units>4</Units>\n        </Form>\n    </Forms>', x, flags=re.S)
# (đã thử: thiếu <Units>4</Units> (mm) ở khổ giấy, hoặc đổi LevelOfDetailMode / MinimumLevelOfDetail / CurveTolerance →
#  MicroStation báo "Invalid Printer Driver Configuration File" và KHÔNG in)
for k, v in [('ResolutionDotsPerUnit', f'{DPI},{DPI},0'), ('PDFPrecision', '3'), ('PDFEnableOptionalContent', '0'),
             ('PDFEnableProvenance', '0'), ('PDFEngineeringLinks', '0')]:
    x, n = re.subn(f'<{k}>[^<]*</{k}>', f'<{k}>{v}</{k}>', x)
    if not n: print('  (canh bao) khong thay muc', k)
plt = os.path.join(ra_dir, ten + '.pltcfg')
with open(plt, 'w', encoding='utf-16', newline='') as f: f.write(x)
q = ms.CadInputQueue
q.SendKeyin('FIT VIEW EXTENDED 1')
q.SendKeyin('PLACE FENCE BLOCK')
q.SendDataPoint(ms.Point3dFromXY(x0, y0), 1)
q.SendDataPoint(ms.Point3dFromXY(x1, y1), 1)
q.SendReset()
import win32gui, win32con
def hop_thoai_loi():                                       # MicroStation báo lỗi bằng hộp thoại → đóng nó và dừng (không để treo)
    hs = []
    win32gui.EnumWindows(lambda h, l: hs.append(h) if win32gui.IsWindowVisible(h) and win32gui.GetClassName(h) == 'MStnChild'
                         and win32gui.GetWindowText(h) in ('Information', 'Alert', 'Error', 'Warning') else None, 0)
    for h in hs:
        win32gui.PostMessage(h, win32con.WM_KEYDOWN, win32con.VK_RETURN, 0); win32gui.PostMessage(h, win32con.WM_KEYUP, win32con.VK_RETURN, 0)
    return bool(hs)
for k in ['PRINT DRIVER ' + plt, f'PRINT PAPERNAME CL{ten}', 'PRINT ORIENTATION ' + ('LANDSCAPE' if rong >= cao else 'PORTRAIT'),
          'PRINT ATTRIBUTES FENCEBOUNDARY OFF', 'PRINT ATTRIBUTES PLOTBORDER OFF', 'PRINT MAXIMIZE', 'PRINT EXECUTE ' + pdf]:
    q.SendKeyin(k); time.sleep(1)
    if hop_thoai_loi(): sys.exit(f'LOI: MicroStation bao loi (hop thoai) sau lenh "{k}"')
co_file = 0
for i in range(600):                                       # chờ file PDF ghi xong (kích thước đứng yên 6 giây)
    if hop_thoai_loi(): sys.exit('LOI: MicroStation bao loi (hop thoai) khi dang in')
    if os.path.exists(pdf):
        s = os.path.getsize(pdf)
        if s > 0 and s == co_file: break
        co_file = s
    time.sleep(3)
else: sys.exit('LOI: khong thay PDF sau 30 phut')
time.sleep(2)
try: ms.ActiveDesignFile.Close()
except Exception: pass

# ---- tìm 4 dấu cộng trong PDF → phép affine
import pymupdf
p = pymupdf.open(pdf)[0]
import collections
L_ky_vong = 4000 / TY_LE / 25.4 * 72                       # 4 m ở tỉ lệ 1:TY_LE, theo điểm in (MAXIMIZE có thể co chút)
hz, vt = collections.defaultdict(list), collections.defaultdict(list)   # y → [(x đầu, x cuối)] · x → [(y đầu, y cuối)]
for dr in p.get_drawings():
    c = dr.get('color')
    if c is None or abs(c[0]) > 0.02 or abs(c[1] - 1) > 0.02 or abs(c[2]) > 0.02: continue
    for it in dr['items']:
        if it[0] != 'l': continue
        a, b = it[1], it[2]
        if abs(a.y - b.y) < 0.02 and abs(a.x - b.x) > 0.05: hz[round(a.y, 2)].append((min(a.x, b.x), max(a.x, b.x)))
        elif abs(a.x - b.x) < 0.02 and abs(a.y - b.y) > 0.05: vt[round(a.x, 2)].append((min(a.y, b.y), max(a.y, b.y)))
def gom(ds):
    # nét có thể bị in thành NHIỀU GẠCH (kiểu nét đứt) → nối các gạch cách nhau < nửa độ dài dấu thành một đoạn
    ds = sorted(ds); ra = []
    for d0, d1 in ds:
        if ra and d0 - ra[-1][1] < 0.5 * L_ky_vong: ra[-1][1] = max(ra[-1][1], d1)
        else: ra.append([d0, d1])
    return ra
ngang = [((d0 + d1) / 2, y, d1 - d0) for y, ds in hz.items() for d0, d1 in gom(ds)]
doc_ = [(x, (d0 + d1) / 2, d1 - d0) for x, ds in vt.items() for d0, d1 in gom(ds)]
cong = []
for (x_, y_, L) in ngang:
    for (x2, y2, L2) in doc_:
        if abs(x_ - x2) < 0.2 and abs(y_ - y2) < 0.2 and abs(L - L2) < 0.05 * L and 0.5 * L_ky_vong < L < 1.5 * L_ky_vong:
            cong.append((x2, y_))                          # tâm = x của nét dọc, y của nét ngang (không phụ thuộc làm tròn đầu nét)
if len(cong) != 4: sys.exit(f'LOI: tim duoc {len(cong)} dau cong (can 4): {cong}')
# ghép dấu ↔ toạ độ: trang PDF trục y hướng xuống → góc dưới-trái bản vẽ = (x nhỏ, y lớn) trên trang
cong.sort(key=lambda t: (t[1], t[0]))                      # 2 dấu trên (y nhỏ) trước
tren = sorted(cong[:2]); duoi = sorted(cong[2:])
cap = [(duoi[0], DAU[0]), (duoi[1], DAU[1]), (tren[1], DAU[2]), (tren[0], DAU[3])]
A = np.array([[px, py, 1] for (px, py), _ in cap]); E = np.array([e for _, (e, n) in cap]); N = np.array([n for _, (e, n) in cap])
ae, *_ = np.linalg.lstsq(A, E, rcond=None); an, *_ = np.linalg.lstsq(A, N, rcond=None)
sai = np.hypot(A @ ae - E, A @ an - N)
tl_x, tl_y = np.hypot(ae[0], an[0]), np.hypot(ae[1], an[1])
if abs(tl_x / tl_y - 1) > 1e-4 or sai.max() > 0.02:       # 2 chiều phải cùng tỉ lệ, 4 dấu phải khớp ≤ 2 cm — sai là in nhầm vùng
    sys.exit(f'LOI: phep doi khong deu (ti le 2 chieu {tl_x:.6f} / {tl_y:.6f} m/diem in, sai so {sai.max() * 1000:.1f} mm) — '
             f'co the MicroStation khong in dung vung rao')
m_pt = float(np.hypot(ae[0], an[0]))
print(f'{ten}: PDF {p.rect.width:.0f} x {p.rect.height:.0f} diem in, {m_pt * 1000:.2f} mm ngoai thuc dia / diem in '
      f'(ty le 1:{m_pt / (0.0254 / 72):.0f}); 4 dau cong khop, sai so lon nhat {sai.max() * 1000:.2f} mm; '
      f'xoay {np.degrees(np.arctan2(an[0], ae[0])):.6f} do')
json.dump({'cach': 'in_1_500_dgn.py — MicroStation in PDF, 4 dau cong hieu chuan', 'afin': [float(ae[0]), float(ae[1]), float(ae[2]),
           float(an[0]), float(an[1]), float(an[2])], 'sai_so_mm': float(sai.max() * 1000), 'vung_in': [x0, y0, x1, y1],
           'dgn': os.path.basename(dgn)}, open(pdf + '.nan.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('da ghi', pdf, '+ .nan.json')
