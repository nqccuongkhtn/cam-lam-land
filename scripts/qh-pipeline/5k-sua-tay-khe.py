# SỬA TAY CÁC DẢI TRẮNG HẸP CHỦ DỰ ÁN ĐÃ XÁC NHẬN (12/10/2026).
#
# Bản vẽ quy hoạch có chỗ ĐƠN VỊ TƯ VẤN TÔ MÀU SÓT: để lại dải trắng hẹp (vd 1,4 m) giữa hai vùng tô. Web theo luật
# "trong ranh mà không tô = lòng đường" nên tính dải đó thành ĐẤT GIAO THÔNG. Chỗ đầu tiên chủ dự án bắt được: Thửa 95 · Tờ 15
# Xã Cam Lâm, QĐ205 — dải 1,4 m giữa hồ và cây xanh; soi trên MicroStation thấy ký hiệu cây xanh nằm ngay trong dải → là CÂY XANH.
#
# Danh sách chỗ đã xác nhận nằm ở sua-tay-khe.json (cùng thư mục): mỗi dòng một dải — bản quy hoạch, loại đất đúng, ai xác
# nhận / soi ở đâu, và HÌNH dải (WGS84). Bước này thêm từng dải vào file ô đất của bản đó thành MỘT Ô ĐẤT đúng loại (mượn
# bậc của ô liền kề cùng loại). Dải được dò bằng scratchpad quet_khe.py / trang "Dải trắng hẹp cần soi" (cùng mã dải).
#
# ⚠️ Chạy SAU 5h (QĐ205) / 5g + 7-lo-trong-ranh.py (phân khu): dựng lại ô đất mà quên bước này là MẤT các chỗ đã sửa.
#    Chạy lại nhiều lần vẫn an toàn: dải đã thêm (cùng hình) thì bỏ bản cũ trước khi thêm lại.
# Dùng: python scripts/qh-pipeline/5k-sua-tay-khe.py
import io, json, math, os, sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'apps', 'backend', 'data')
TEP = {'205': 'qh_zones.json', '2076': 'qh_zones_2076.json', '2101': 'qh_zones_2101.json', '2222': 'qh_zones_2222.json',
       '918': 'qh_zones_918.json', 'cuhin': 'qh_zones_cuhin.json', 'taynam': 'qh_zones_taynam.json', 'taybac': 'qh_zones_taybac.json'}

ds = json.load(io.open(os.path.join(HERE, 'sua-tay-khe.json'), encoding='utf-8'))
kx, ky = 111320 * math.cos(math.radians(12.08)), 110574.0


def vong(hinh):
    """Vòng ngoài của dải (WGS84, 8 số lẻ ~1 mm như mọi ô đất), khép kín."""
    v = [[round(x, 8), round(y, 8)] for x, y in hinh['coordinates'][0]]
    if v[0] != v[-1]: v.append(v[0])
    return v


def dien_tich_m2(v):
    s = 0.0
    for (x1, y1), (x2, y2) in zip(v, v[1:]): s += (x1 * kx) * (y2 * ky) - (x2 * kx) * (y1 * ky)
    return abs(s) / 2


for ma in sorted({d['ma'] for d in ds}):
    duong = os.path.join(DATA, TEP[ma])
    Z = json.load(io.open(duong, encoding='utf-8'))
    cua_ban = [d for d in ds if d['ma'] == ma]
    vong_sua = {json.dumps(vong(d['hinh'])) for d in cua_ban}
    truoc = len(Z)
    Z = [z for z in Z if json.dumps(z[4]) not in vong_sua]          # bỏ bản đã thêm lần trước (chạy lại an toàn)
    da_bo = truoc - len(Z)
    for d in cua_ban:
        v = vong(d['hinh'])
        xs, ys = [p[0] for p in v], [p[1] for p in v]
        # Bậc (thứ tự xếp lớp) mượn của ô LIỀN KỀ cùng loại — ô nằm trong khung 30 m quanh dải.
        e = 30 / kx
        gan = [z for z in Z if z[5] == d['loai'] and z[0] <= max(xs) + e and z[2] >= min(xs) - e and z[1] <= max(ys) + e and z[3] >= min(ys) - e]
        if not gan:
            sys.exit('❌ %s: không có ô "%s" nào sát dải — kiểm lại tên loại đất (phải ĐÚNG chữ của ô bên cạnh).' % (d['id'], d['loai']))
        bac = Counter(z[7] for z in gan).most_common(1)[0][0]
        Z.append([min(xs), min(ys), max(xs), max(ys), v, d['loai'], 0.0 if ma == '205' else round(dien_tich_m2(v), 2), bac])
        print('  %-9s → %s · %.1f m² (bậc %s)' % (d['id'], d['loai'], dien_tich_m2(v), bac))
    with io.open(duong, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(Z, f, ensure_ascii=False, separators=(',', ':'))
    print('%s: thêm %d dải sửa tay (bỏ %d bản cũ) → %s' % (ma, len(cua_ban), da_bo, TEP[ma]))
