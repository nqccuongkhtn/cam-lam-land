# -*- coding: utf-8 -*-
"""
ĐỔI MÀU CHỦ ĐẠO CỦA WEB: XANH NAVY → XANH CỔ VỊT (25/9/2026)
=============================================================
Chủ dự án gửi ô màu mẫu, đo ra #0B4045 (11, 64, 69). Đổi CẢ HỌ màu navy (màu
chính + các sắc đậm/nhạt đi kèm cho nền tối, di chuột, bóng đổ) sang họ xanh
cổ vịt có cùng độ sáng tương ứng, để chỗ nào đậm vẫn đậm, chỗ nào nhạt vẫn nhạt.

Chỉ đổi chữ trong file mã (màu viết dạng #xxxxxx hoặc rgba(r,g,b,…)). Ảnh đã
vẽ sẵn (logo, biểu tượng ứng dụng) KHÔNG đổi theo — phải dựng lại riêng.

Chạy lại nhiều lần vẫn an toàn (màu đã đổi thì không còn khớp nữa).
Muốn lùi: git revert lần lưu có tên "Doi mau chu dao".

Chạy:  python scripts/doi-mau-chu-dao.py
"""
import io
import os
import re

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FE = os.path.join(GOC, 'apps', 'frontend')

# (màu navy cũ, màu cổ vịt mới) — viết thường, không dấu #
DOI_HEX = {
    '0a2540': '0b4045',   # màu chính
    '0d2f54': '0e5157',   # nhạt hơn một nấc (di chuột, viền)
    '0d3a6b': '10585e',   # nhạt hơn nữa
    '08243c': '083338',
    '0b1d36': '0a3034',   # nền banner (--navy của 19 mẫu)
    '0d2033': '082f33',   # nền tối
    '0b1826': '072a2d',
    '0f1e30': '0c2a2d',
    '0b1220': '06201f',
    '04101c': '041a1c',   # gần đen
}
DOI_RGB = {
    (10, 37, 64): (11, 64, 69),
    (11, 29, 54): (10, 48, 52),
    (13, 47, 84): (14, 81, 87),
}

DUOI = ('.tsx', '.ts', '.css', '.js', '.json', '.webmanifest', '.html')
BO_QUA = ('node_modules', '.next', 'tiles', 'overlays')


def doi(txt):
    n = 0
    def hx(m):
        nonlocal n
        cu = m.group(1)
        moi = DOI_HEX.get(cu.lower())
        if not moi:
            return m.group(0)
        n += 1
        return '#' + (moi.upper() if cu.isupper() or cu[1:].isupper() else moi)
    txt = re.sub(r'#([0-9a-fA-F]{6})\b', hx, txt)
    def rg3(m):
        nonlocal n
        k = (int(m.group(2)), int(m.group(4)), int(m.group(6)))
        if k not in DOI_RGB:
            return m.group(0)
        n += 1
        r, g, b = DOI_RGB[k]
        return '%s(%d%s%d%s%d' % (m.group(1), r, m.group(3), g, m.group(5), b)
    txt = re.sub(r'(rgba?)\((\d+)(\s*,\s*)(\d+)(\s*,\s*)(\d+)', rg3, txt)
    return txt, n


def main():
    import sys
    # `--nguoc`: đổi NGƯỢC về navy (chủ dự án thử màu cổ vịt rồi bảo trả lại
    # navy, 25/9/2026). Đảo bảng rồi chạy như thường.
    if '--nguoc' in sys.argv:
        global DOI_HEX, DOI_RGB
        DOI_HEX = {v: k for k, v in DOI_HEX.items()}
        DOI_RGB = {v: k for k, v in DOI_RGB.items()}
    tong = so_file = 0
    for goc, thu_muc, tep in os.walk(FE):
        thu_muc[:] = [t for t in thu_muc if t not in BO_QUA]
        for t in tep:
            if not t.endswith(DUOI) or t == 'package-lock.json':
                continue
            p = os.path.join(goc, t)
            s = io.open(p, encoding='utf-8', newline='').read()   # giữ nguyên kiểu xuống dòng của file
            moi, n = doi(s)
            if n:
                io.open(p, 'w', encoding='utf-8', newline='').write(moi)
                tong += n
                so_file += 1
    print('Đã đổi %d chỗ trong %d file' % (tong, so_file))


if __name__ == '__main__':
    main()
