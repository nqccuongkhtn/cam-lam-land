# -*- coding: utf-8 -*-
# Soi cau truc file PDF ban do quy hoach: trang, kich thuoc, vector hay anh scan.
import sys, pymupdf

path = sys.argv[1]
doc = pymupdf.open(path)
print(f"File: {path}")
print(f"So trang: {doc.page_count}")
for i, page in enumerate(doc):
    r = page.rect
    draws = page.get_drawings()
    imgs = page.get_images(full=True)
    txt = page.get_text("text")
    # tong kich thuoc anh raster
    img_px = 0
    for im in imgs:
        xref = im[0]
        try:
            d = doc.extract_image(xref)
            img_px += d.get("width",0)*d.get("height",0)
        except Exception:
            pass
    print(f"\n--- Trang {i+1} ---")
    print(f"  Kich thuoc (point): {r.width:.0f} x {r.height:.0f}  (1 point = 1/72 inch)")
    print(f"  Xoay: {page.rotation} do")
    print(f"  So net ve vector (drawings): {len(draws)}")
    print(f"  So anh raster nhung: {len(imgs)}  (tong diem anh ~ {img_px/1e6:.1f} trieu px)")
    print(f"  So ky tu chu: {len(txt)}")
    # dem mau cac net ve -> doan co phai ban do loai dat nhieu mau khong
    if draws:
        mau = {}
        for dr in draws:
            c = dr.get("fill") or dr.get("color")
            if c:
                key = tuple(round(x,2) for x in c)
                mau[key] = mau.get(key,0)+1
        top = sorted(mau.items(), key=lambda kv:-kv[1])[:8]
        print(f"  So mau khac nhau trong net ve: {len(mau)}; 8 mau nhieu nhat:")
        for k,v in top:
            print(f"     {k} : {v}")
doc.close()
