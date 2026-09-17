# -*- coding: utf-8 -*-
"""
DÒ KHUNG KẺ CỦA BẢNG TRONG TỆP PDF.

Vì sao cần: với bản quét, cách đoán hàng/cột theo vị trí chữ luôn có chỗ sai — hai hàng sát nhau
là chữ dính vào nhau, cột thì phải "bỏ phiếu" mới đoán ra. Nhưng mấy bảng trong văn bản nhà nước
đều CÓ KẺ KHUNG. Nét kẻ nằm ngay trên ảnh, dò ra là biết chính xác hàng nào tới đâu, cột nào tới đâu
— không phải đoán nữa.

Cách làm: đổi từng trang ra ảnh xám, chỗ nào đậm thì tính là có mực. Một DÒNG ảnh mà gần như
toàn bộ bề ngang đều có mực thì đó là nét kẻ ngang. Cột cũng vậy. Dùng phép thu nhỏ ảnh của thư viện
PIL để tính (một lệnh, chạy bằng mã máy) nên nhanh, không phải quét từng điểm ảnh bằng Python.

Một trang có thể có NHIỀU BẢNG, cột của chúng khác nhau — nên sau khi có nét ngang thì cắt trang
thành từng KHỐI (mấy nét ngang liền nhau, cách đều), rồi dò nét dọc RIÊNG trong từng khối.

Chạy:  python3 luoi-bang.py <tep.pdf> [dpi]     -> in ra JSON
JSON:  {"trang": [ {"rongPt":..., "caoPt":..., "hang":[ {"y1Pt","y2Pt","docPt":[...]} ]} ]}
Toạ độ trả về tính bằng ĐIỂM IN (pt, 72 điểm = 1 inch), gốc ở góc trên bên trái — đúng hệ toạ độ
mà `pdftotext -bbox-layout` dùng, để bên Node ghép thẳng vào không phải quy đổi.
"""
import sys, os, json, glob, tempfile, subprocess

try:
    from PIL import Image
except Exception:
    print(json.dumps({"trang": [], "loi": "thieu PIL"})); sys.exit(0)

DPI = int(sys.argv[2]) if len(sys.argv) > 2 else 150
NGUONG_MUC = 170        # điểm ảnh tối hơn mức này thì coi là có mực
# HAI NGƯỠNG KHÁC NHAU, và đây là chỗ ăn thua:
# · Nét NGANG đo trên cả bề ngang trang, mà bảng thường hẹp hơn trang nên độ đậm trung bình thấp
#   -> phải để ngưỡng THẤP (110). Đo thật trang 7 Thông báo 306: để 140 là sót 2 nét, 3 hàng dính
#   làm một; để 110 thì hàng nào cũng cao đúng 22 điểm. Thấp hơn nữa (90) bắt đầu nhận nhầm
#   dòng chữ đậm thành nét kẻ.
# · Nét DỌC đo trong lòng MỘT hàng, nét kẻ thật chạy suốt chiều cao hàng nên độ đậm gần như tối đa
#   -> phải để ngưỡng CAO (180). Để 110 là nét sổ của chữ (chữ "l", "đ", "T") cũng thành "cột",
#   đo thật một hàng ra tới 21 cột, tên thôn bị băm vụn. Để 180 thì hàng nào cũng đúng 7 nét = 6 cột.
NGUONG_NGANG = 110
NGUONG_DOC = 180


def cac_net(day, nguong):
    """Dãy độ đậm -> vị trí giữa của từng vệt liên tục vượt ngưỡng."""
    ra, i, n = [], 0, len(day)
    while i < n:
        if day[i] >= nguong:
            j = i
            while j < n and day[j] >= nguong:
                j += 1
            ra.append((i + j) // 2)
            i = j
        else:
            i += 1
    return ra


def trung_vi(a):
    if not a:
        return 0
    b = sorted(a)
    return b[len(b) // 2]


def doc_trang(duong):
    im = Image.open(duong).convert('L')
    W, H = im.size
    den = im.point(lambda p: 255 if p < NGUONG_MUC else 0)
    dam_hang = list(den.resize((1, H), Image.BOX).getdata())
    ngang = cac_net(dam_hang, NGUONG_NGANG)
    quy = 72.0 / DPI

    hang = []
    if len(ngang) >= 4:
        # Nét dọc phải dò RIÊNG CHO TỪNG HÀNG, không dò chung cả trang.
        # Lý do: một trang hay có hai bảng khác số cột (vd trang 7 của Thông báo 306: bảng đất nông
        # nghiệp 6 cột, ngay dưới là bảng đất rừng 4 cột). Dò chung thì chỉ mấy nét chạy suốt từ trên
        # xuống dưới mới hiện ra — đo thật chỉ còn 2 nét, mất sạch cột. Dò từng hàng thì hàng nào ra
        # cột của hàng đó, bảng nào cũng đúng, kể cả ô gộp.
        for i in range(len(ngang) - 1):
            y1, y2 = ngang[i], ngang[i + 1]
            if y2 - y1 < 6:                 # hai nét sát nhau (nét kẻ đôi) -> bỏ
                continue
            phan = den.crop((0, y1 + 1, W, y2))
            dam_cot = list(phan.resize((W, 1), Image.BOX).getdata())
            doc = cac_net(dam_cot, NGUONG_DOC)
            hang.append({
                'y1Pt': round(y1 * quy, 2), 'y2Pt': round(y2 * quy, 2),
                'docPt': [round(v * quy, 2) for v in doc],
            })
    return {'rongPt': round(W * quy, 2), 'caoPt': round(H * quy, 2), 'hang': hang}


def main():
    pdf = sys.argv[1]
    tam = tempfile.mkdtemp(prefix='luoi_')
    try:
        subprocess.run(['gs', '-q', '-dNOPAUSE', '-dBATCH', '-sDEVICE=pnggray', '-r%d' % DPI,
                        '-o', os.path.join(tam, 'pg%04d.png'), pdf],
                       capture_output=True, timeout=180)
        anh = sorted(glob.glob(os.path.join(tam, 'pg*.png')))
        print(json.dumps({'trang': [doc_trang(a) for a in anh]}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'trang': [], 'loi': str(e)[:200]}))
    finally:
        for f in glob.glob(os.path.join(tam, '*')):
            try: os.remove(f)
            except Exception: pass
        try: os.rmdir(tam)
        except Exception: pass


main()
