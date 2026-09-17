# -*- coding: utf-8 -*-
"""
NÉN CÁC TỆP PDF VĂN BẢN ĐÍNH KÈM TRÊN WEB (thư mục public/tai-lieu).

Vì sao cần: mấy quyết định quy hoạch quét ra nặng 9 MB/tệp, mở trên điện thoại rất lâu.
Ảnh bên trong đã là JPEG 200 dpi nhưng nén cực nhẹ — 430 KB cho MỘT trang chữ đen trắng.

Cách làm (đã ĐO chứ không đoán — xem bảng số ở cuối tệp này):
  · Trang nào có MÀU THẬT (con dấu đỏ, chữ ký, hình màu) -> GIỮ NGUYÊN MÀU, chỉ nén JPEG.
    Chủ dự án chốt 17/9/2026: "con dấu đỏ thì đừng cho về đen trắng, giữ nguyên".
  · Trang chữ đen trắng -> chuyển ảnh xám rồi nén JPEG (KHÔNG chuyển 1 bit: đo thấy 1 bit
    nhỏ hơn thật nhưng chữ mất nét, máy đọc lại chỉ đúng 89-93% so với 95-96% của ảnh xám).
  · Giữ 150 dpi: đủ nét để đọc A4, mà nhẹ hơn hẳn 200 dpi.

Chạy:  python scripts/pdf/nen-pdf-tai-lieu.py <tep-vao.pdf> <tep-ra.pdf> [dpi] [chat-luong]
(Chạy trong container backend vì cần pdftoppm + PIL + img2pdf:
   docker compose exec backend python3 tools/... )

BẢNG SỐ ĐÃ ĐO trên QĐ 2076 (8.764 KB, 20 trang), chất lượng = tỉ lệ chữ máy đọc lại KHỚP
với bản gốc (OCR hai bên rồi so từng chữ, trang 5 và trang 9):
    giữ 200 dpi, JPEG q70        6.645 KB (75%)   96,9% | 97,4%
    xám 150 dpi, JPEG q50        3.653 KB (41%)   94,3% | 93,9%
    xám 120 dpi, JPEG q50        2.684 KB (30%)   96,0% | 95,2%
    1 bit ngưỡng thích nghi 200  2.382 KB (27%)   93,1% | 89,7%   <- nhỏ nhưng CHỮ MẤT NÉT
Chọn xám 150 dpi q60: nhẹ còn ~38%, chữ vẫn đọc tốt, con dấu đỏ vẫn còn màu.
"""
import sys, os, glob, shutil, subprocess, warnings, logging

warnings.filterwarnings('ignore')
logging.getLogger('img2pdf').setLevel(logging.ERROR)
from PIL import Image
import img2pdf

NGUONG_MAU = 0.0005       # trên 0,05% điểm ảnh có màu thì coi trang đó là trang màu


def co_mau(im):
    """Trang này có màu thật không (con dấu đỏ, hình màu) — xét trên ảnh thu nhỏ cho nhanh."""
    w, h = im.size
    px = list(im.resize((max(1, w // 4), max(1, h // 4))).getdata())
    n = sum(1 for r, g, b in px if max(r, g, b) - min(r, g, b) > 40)
    return n / len(px) >= NGUONG_MAU


def nen(vao, ra, dpi=150, q_xam=60, q_mau=78):
    tam = os.path.join(os.path.dirname(os.path.abspath(ra)) or '.', '_nen_tam')
    shutil.rmtree(tam, ignore_errors=True)
    os.makedirs(tam)
    try:
        subprocess.run(['pdftoppm', '-r', str(dpi), '-png', vao, os.path.join(tam, 'p')],
                       capture_output=True, timeout=1800)
        anh, so_mau = [], 0
        for p in sorted(glob.glob(os.path.join(tam, 'p*.png'))):
            im = Image.open(p).convert('RGB')
            f = os.path.splitext(p)[0] + '.jpg'
            if co_mau(im):
                im.save(f, 'JPEG', quality=q_mau, optimize=True, progressive=True)
                so_mau += 1
            else:
                im.convert('L').save(f, 'JPEG', quality=q_xam, optimize=True, progressive=True)
            anh.append(f)
        if not anh:
            return None
        with open(ra, 'wb') as f:
            f.write(img2pdf.convert(anh))
        return len(anh), so_mau
    finally:
        shutil.rmtree(tam, ignore_errors=True)


if __name__ == '__main__':
    vao, ra = sys.argv[1], sys.argv[2]
    dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 150
    q = int(sys.argv[4]) if len(sys.argv) > 4 else 60
    truoc = os.path.getsize(vao) // 1024
    kq = nen(vao, ra, dpi=dpi, q_xam=q)
    if not kq:
        print('LOI: khong doc duoc trang nao'); sys.exit(1)
    n, so_mau = kq
    sau = os.path.getsize(ra) // 1024
    # KHOÁ AN TOÀN: tệp nào bản gốc đã nén tối ưu sẵn (ảnh 1 bit CCITT/JBIG2, hoặc chữ thật
    # không phải ảnh) thì nén lại kiểu này sẽ TO HƠN. Đo thật: QĐ 205 phình từ 1.376 KB lên
    # 7.774 KB, QĐ 30 từ 1.345 KB lên 3.915 KB. Gặp vậy thì BỎ bản nén, giữ bản gốc.
    if sau >= truoc:
        os.remove(ra)
        print('%s: %d KB -> %d KB = TO HON, giu nguyen ban goc (khong nen)'
              % (os.path.basename(vao), truoc, sau))
        sys.exit(2)
    print('%s: %d KB -> %d KB (%d%%) · %d trang, giu mau %d trang'
          % (os.path.basename(vao), truoc, sau, 100 * sau // max(1, truoc), n, so_mau))
