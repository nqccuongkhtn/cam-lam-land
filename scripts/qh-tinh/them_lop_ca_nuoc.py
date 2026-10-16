# -*- coding: utf-8 -*-
# GHI DANH MỤC LỚP QHSDĐ 2030 CÁC TỈNH KHÁC cho trang bản đồ (16/10/2026) → apps/frontend/src/data/qhCaNuoc.json
# (trang bản đồ nạp tệp này: thêm vào ô Địa giới (tỉnh → huyện), danh sách lớp, thẻ căn cứ — xem đầu app/map/page.tsx).
# Đầu vào: một tệp KHAI BÁO theo tỉnh (vd scripts/qh-tinh/ca-nuoc/binh-thuan.json) — mỗi lớp: id, bo (thư mục ô trong kho ổ D),
#   vung {id, ten, tenNgan, tinh}, ten, tenNgan, ranh (đường ranh .json để tính khung + điểm bay tới), canCu {so, ngay, coQuan, ten, tep, cac}.
# CHỈ GHI lớp có bộ ô ĐÃ CẮT XONG (thư mục <KHO>/<bo>/xong.txt) — lớp chưa có ô thì bỏ qua, chạy lại sau là thêm. Ghi tệp tạm rồi đổi tên.
# Dùng: python -P them_lop_ca_nuoc.py <khai_bao.json> [--kho=D:/KhoQH/tiles-qg] [--ca-chua-cat]
import sys, os, json, math, io
sys.stdout.reconfigure(encoding='utf-8')
co = [a for a in sys.argv[1:] if a.startswith('--')]; ts = [a for a in sys.argv[1:] if not a.startswith('--')]
KHO = next((a.split('=', 1)[1] for a in co if a.startswith('--kho=')), 'D:/KhoQH/tiles-qg')
CA_CHUA_CAT = '--ca-chua-cat' in co
GOC = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'src', 'data', 'qhCaNuoc.json')

def khung_ranh(p):
    g = json.load(io.open(p, encoding='utf-8'))
    pts = [c for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]) for ring in poly for c in ring]
    xs, ys = [c[0] for c in pts], [c[1] for c in pts]
    return [round(min(xs), 4), round(min(ys), 4), round(max(xs), 4), round(max(ys), 4)]

def tam_xem(k):
    # mức phóng nhìn trọn khung trên khung bản đồ ~700 điểm ảnh (điện thoại hẹp hơn thì vẫn thấy phần lớn), kẹp 9–13
    rong = max(k[2] - k[0], (k[3] - k[1]) * 1.05, 1e-4)
    z = max(9, min(13, round(math.log2(360 * 700 / (256 * rong)) - 0.3, 1)))
    return [round((k[0] + k[2]) / 2, 4), round((k[1] + k[3]) / 2, 4), z]

kb = json.load(io.open(ts[0], encoding='utf-8'))
cu = json.load(io.open(RA, encoding='utf-8')) if os.path.exists(RA) else {}
vung = {v['id']: v for v in cu.get('vung', [])}
lop = {l['id']: l for l in cu.get('lop', [])}
them = bo_qua = 0
for l in kb['lop']:
    if not CA_CHUA_CAT and not os.path.exists(os.path.join(KHO, l['bo'], 'xong.txt')):
        print(f"  bo qua {l['id']}: bo o {l['bo']} chua cat xong"); bo_qua += 1; continue
    k = khung_ranh(l['ranh'])
    v = dict(l['vung']); v.setdefault('tamXem', tam_xem(k)); vung[v['id']] = v
    lop[l['id']] = {'id': l['id'], 'ten': l['ten'], 'tenNgan': l['tenNgan'], 'tenApp': l.get('tenApp', 'QH Sử dụng đất 2030'),
                    'vung': v['id'], 'zBay': l.get('zBay', max(9, min(13, int(v['tamXem'][2])))),
                    'tiles': f"/tiles-qg/{l['bo']}/{{z}}/{{x}}/{{y}}.webp", 'minzoom': l.get('minzoom', 9), 'maxzoom': l.get('maxzoom', 16),
                    'khung': k, 'canCu': l['canCu']}
    them += 1
ra = {'_ghiChu': 'Lớp QHSDĐ 2030 các tỉnh khác — GHI BẰNG scripts/qh-tinh/them_lop_ca_nuoc.py, đừng sửa tay. Ô ảnh ở kho ổ D của máy chủ '
                 '(nginx /tiles-qg/, TILES_QG_DIR). `vung.tinh` = mã tỉnh hiện hành trong TINH_VN (app/map/page.tsx).',
      'vung': sorted(vung.values(), key=lambda v: (v['tinh'], v['ten'])), 'lop': sorted(lop.values(), key=lambda l: (vung[l['vung']]['tinh'], l['ten']))}
os.makedirs(os.path.dirname(RA), exist_ok=True)
with io.open(RA + '.tam', 'w', encoding='utf-8', newline='\n') as w:
    json.dump(ra, w, ensure_ascii=False, indent=1)
os.replace(RA + '.tam', RA)
print(f'ghi {RA}: them/cap nhat {them} lop, bo qua {bo_qua}; tong {len(ra["lop"])} lop, {len(ra["vung"])} huyen')
