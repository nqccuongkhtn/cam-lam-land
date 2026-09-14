# -*- coding: utf-8 -*-
"""
CẮT BỎ PHẦN NẰM NGOÀI RANH GIỚI LẬP QUY HOẠCH — chạy SAU bước 2, TRƯỚC bước cắt tile.

Vì sao cần bước này
-------------------
File CAD gốc là một TỜ BẢN VẼ để in ra giấy, không phải một lớp bản đồ. Ngoài phần đất
được quy hoạch, tờ vẽ còn chứa:

  · Ô CHÚ GIẢI — bảng mẫu màu + mẫu ký hiệu đặt ở khoảng trống cạnh bản vẽ. Mỗi ô mẫu
    mang đúng tên level thật (vd 'QHDD_DAT_O_Nhomnhao') nên KHÔNG thể lọc theo tên level.
    Riêng QĐ2101 có 80 ô màu mẫu như vậy, lên bản đồ thành một mảng sọc màu lơ lửng
    giữa đầm Thuỷ Triều.
  · NÉT VẼ LAN RA NGOÀI — mạng đường, vỉa hè, ký hiệu vẽ nối dài ra vùng lân cận cho
    dễ nhìn. Lên web thì thành ra: vùng Cam Đức (ngoài phạm vi quy hoạch) hiện đầy
    đường trắng + vòng tròn ký hiệu mà KHÔNG có ô đất nào — nhìn y như "dữ liệu bị thiếu".
    QĐ2101 có 1.920 nét và 1.878 ký hiệu kiểu này.

Cách làm: chính bản vẽ đã có sẵn đường ranh giới lập quy hoạch (level `BV_Rg_lapquyhoach`).
Lấy vòng khép kín LỚN NHẤT của level đó làm hàng rào, đối tượng nào KHÔNG có điểm nào
nằm trong hàng rào thì bỏ. Giữ theo kiểu "có một điểm ở trong là giữ" nên con đường chạy
vắt qua ranh vẫn còn nguyên, chỉ mất những thứ nằm trọn bên ngoài.

Cách gọi:
    python 4-cat-theo-ranh.py <net.geojson> [file khác...] [--ranh-tu <net.geojson>] [--level <tên>]

Ví dụ (làm cả lớp vùng lẫn lớp nét của QĐ2101):
    python 4-cat-theo-ranh.py quyhoach2025/qd2101_net.geojson quyhoach2025/qd2101_qh.geojson

File ra đặt cạnh file vào, thêm đuôi `_sach`:  qd2101_net_sach.geojson, qd2101_qh_sach.geojson
Ranh giới mặc định lấy từ file ĐẦU TIÊN trong danh sách.
"""
import io
import json
import os
import sys

LEVEL_RANH_MAC_DINH = 'BV_Rg_lapquyhoach'


def diem_cua(geom):
    """Gom mọi cặp toạ độ của một hình, bất kể hình lồng sâu mấy tầng."""
    ra = []

    def di(o):
        if isinstance(o, list):
            if o and isinstance(o[0], (int, float)):
                ra.append(o)
            else:
                for i in o:
                    di(i)
    di(geom.get('coordinates'))
    return ra


def nam_trong(x, y, vong):
    """Điểm có nằm trong vòng khép kín không — phép bắn tia kinh điển."""
    n = len(vong)
    trong = False
    j = n - 1
    for i in range(n):
        xi, yi = vong[i][0], vong[i][1]
        xj, yj = vong[j][0], vong[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            trong = not trong
        j = i
    return trong


def tim_ranh(tep, ten_level, tep_vung=()):
    """Chọn vòng ranh CHỨA NHIỀU ĐỐI TƯỢNG NHẤT của các file cần lọc (hoà thì lấy vòng rộng hơn).

    Đã vấp hai kiểu bản vẽ có NHIỀU vòng ranh giống hệt nhau:
      · Cù Hin: hai vòng 1.250 điểm — ranh thật (~12×10 km) và SƠ ĐỒ VỊ TRÍ thu nhỏ (~200 m).
        Chọn theo "nhiều điểm nhất" → vớ cái nhỏ.
      · Tây Nam: hai vòng 2.529 điểm cùng CỠ, một vòng là bản sao dịch sang tận kinh độ 108,6
        (chứa 2 vùng tô) còn vòng thật chứa 388. Chọn theo "rộng nhất" → vớ bản sao.
    Đếm xem vòng nào ôm được nhiều tâm đối tượng nhất thì không nhầm được cả hai kiểu.
    """
    d = json.load(open(tep, encoding='utf-8'))
    ung = []
    for f in d['features']:
        if (f.get('properties') or {}).get('lo') != ten_level:
            continue
        dd = diem_cua(f['geometry'])
        if len(dd) < 4:
            continue                      # mẩu ranh trong ô chú giải, bỏ
        ung.append(dd)
    if not ung:
        return None
    tam = []
    for t in tep_vung:
        if os.path.isfile(t):
            for f in json.load(open(t, encoding='utf-8')).get('features', []):
                p = diem_cua(f.get('geometry') or {})
                if p:
                    tam.append((sum(a[0] for a in p) / len(p), sum(a[1] for a in p) / len(p)))

    def diem_so(dd):
        X = [p[0] for p in dd]; Y = [p[1] for p in dd]
        x0, x1, y0, y1 = min(X), max(X), min(Y), max(Y)
        n = sum(1 for x, y in tam if x0 <= x <= x1 and y0 <= y <= y1 and nam_trong(x, y, dd))
        return (n, (x1 - x0) * (y1 - y0))
    return max(ung, key=diem_so)


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    ten_level = LEVEL_RANH_MAC_DINH
    tep_ranh = None
    tep_vao = []
    i = 0
    while i < len(args):
        if args[i] == '--level':
            ten_level = args[i + 1]; i += 2
        elif args[i] == '--ranh-tu':
            tep_ranh = args[i + 1]; i += 2
        else:
            tep_vao.append(args[i]); i += 1

    if not tep_vao:
        print('LỖI: chưa cho file nào để lọc.')
        sys.exit(1)
    tep_ranh = tep_ranh or tep_vao[0]

    vong = tim_ranh(tep_ranh, ten_level, tep_vao)
    if not vong:
        print('LỖI: không thấy level ranh giới "%s" trong %s' % (ten_level, tep_ranh))
        print('     Mở file ra xem tên level ranh giới là gì rồi truyền qua --level.')
        sys.exit(1)
    X = [p[0] for p in vong]; Y = [p[1] for p in vong]
    print('Ranh giới "%s": %d điểm, khung bao %.4f %.4f .. %.4f %.4f'
          % (ten_level, len(vong), min(X), min(Y), max(X), max(Y)))

    for tep in tep_vao:
        if not os.path.isfile(tep):
            print('LỖI: không thấy file', tep); sys.exit(1)
        d = json.load(open(tep, encoding='utf-8'))
        giu = []
        for f in d['features']:
            if any(nam_trong(p[0], p[1], vong) for p in diem_cua(f['geometry'])):
                giu.append(f)
        bo = len(d['features']) - len(giu)
        d['features'] = giu
        goc, duoi = os.path.splitext(tep)
        ra = goc + '_sach' + duoi
        with open(ra, 'w', encoding='utf-8') as fh:
            json.dump(d, fh, ensure_ascii=False)
        print('%-42s giữ %6d, bỏ %5d  →  %s'
              % (os.path.basename(tep), len(giu), bo, os.path.basename(ra)))


if __name__ == '__main__':
    main()
