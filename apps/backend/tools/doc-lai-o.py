# -*- coding: utf-8 -*-
"""
ĐỌC LẠI RIÊNG MẤY Ô SỐ ĐÁNG NGỜ.

Vì sao: đọc cả trang một lượt thì máy hay lẫn 5 thành 3, 1 thành dấu ngoặc... Nhưng nếu CẮT RIÊNG
một ô ra, phóng to lên, và BẮT máy chỉ được phép đọc ra chữ số (không được ra chữ cái), thì nó
chính xác hơn hẳn. Làm cho cả trang thì quá chậm, nên chỉ làm với mấy ô mà bên Node thấy khả nghi
(ô có giá trị lẻ loi trong khi cả cột đều là một giá trị khác, lệch đúng một chữ số).

Chạy:  python3 doc-lai-o.py <tep.pdf> '<json cac o>' [dpi]
  json các ô: [{"trang":1,"x1":..,"y1":..,"x2":..,"y2":..}, ...]   (toạ độ ĐIỂM IN, gốc góc trên trái)
In ra:  {"doc": ["811.000", "", ...]}   — cùng thứ tự, rỗng nghĩa là đọc không ra
"""
import sys, os, json, glob, tempfile, subprocess

try:
    from PIL import Image
except Exception:
    print(json.dumps({"doc": [], "loi": "thieu PIL"})); sys.exit(0)

DPI = int(sys.argv[3]) if len(sys.argv) > 3 else 300      # cắt ô nhỏ nên phóng to hẳn cho nét
LE = 3                                                     # chừa mép vài điểm ảnh cho khỏi cụt chữ


def main():
    pdf = sys.argv[1]
    o = json.loads(sys.argv[2])
    if not o:
        print(json.dumps({"doc": []})); return
    tam = tempfile.mkdtemp(prefix='ocro_')
    ra = ['' for _ in o]
    try:
        trangCan = sorted({int(x['trang']) for x in o})
        anh = {}
        for t in trangCan:
            subprocess.run(['gs', '-q', '-dNOPAUSE', '-dBATCH', '-sDEVICE=pnggray', '-r%d' % DPI,
                            '-dFirstPage=%d' % t, '-dLastPage=%d' % t,
                            '-o', os.path.join(tam, 'p%d.png' % t), pdf],
                           capture_output=True, timeout=120)
            p = os.path.join(tam, 'p%d.png' % t)
            if os.path.exists(p):
                anh[t] = Image.open(p).convert('L')
        quy = DPI / 72.0
        for i, x in enumerate(o):
            im = anh.get(int(x['trang']))
            if im is None:
                continue
            W, H = im.size
            a = (max(0, int(x['x1'] * quy) - LE), max(0, int(x['y1'] * quy) - LE),
                 min(W, int(x['x2'] * quy) + LE), min(H, int(x['y2'] * quy) + LE))
            if a[2] - a[0] < 10 or a[3] - a[1] < 8:
                continue
            c = im.crop(a)
            # Phóng to gấp đôi + viền trắng: Tesseract đọc chữ to, thoáng thì đúng hơn.
            c = c.resize((c.width * 2, c.height * 2), Image.LANCZOS)
            nen = Image.new('L', (c.width + 40, c.height + 40), 255)
            nen.paste(c, (20, 20))
            f = os.path.join(tam, 'o%d.png' % i)
            nen.save(f)
            r = subprocess.run(['tesseract', f, 'stdout', '--psm', '7', '-l', 'eng',
                                '-c', 'tessedit_char_whitelist=0123456789.'],
                               capture_output=True, timeout=60)
            ra[i] = r.stdout.decode('utf-8', 'replace').strip().replace(' ', '')
        print(json.dumps({"doc": ra}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"doc": ra, "loi": str(e)[:200]}))
    finally:
        for f in glob.glob(os.path.join(tam, '*')):
            try: os.remove(f)
            except Exception: pass
        try: os.rmdir(tam)
        except Exception: pass


main()
