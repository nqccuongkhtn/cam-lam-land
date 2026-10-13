# -*- coding: utf-8 -*-
# Ve 1 trang PDF ra PNG o ti le cho truoc (hoac cat 1 vung).
# Dung: ve_png.py <pdf> <out.png> <scale> [x0 y0 x1 y1]  (toa do point)
import sys, pymupdf
pdf, out = sys.argv[1], sys.argv[2]
scale = float(sys.argv[3])
doc = pymupdf.open(pdf)
page = doc[0]
mat = pymupdf.Matrix(scale, scale)
clip = None
if len(sys.argv) >= 8:
    clip = pymupdf.Rect(float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6]), float(sys.argv[7]))
pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
pix.save(out)
print(f"Da ve: {out}  ({pix.width} x {pix.height} px)")
doc.close()
