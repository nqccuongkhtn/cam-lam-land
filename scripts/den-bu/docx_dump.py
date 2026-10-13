# -*- coding: utf-8 -*-
"""
Doc file .docx (zip + XML), in ra theo DUNG THU TU trong van ban:
  - doan van:  'P| <chu>'
  - bang:      moi dong 1 hang, cac o cach nhau ' || ', o gop ngang (gridSpan) lap lai noi dung
               o gop doc (vMerge) ghi '^' (= giong o phia tren)
Dung:  python -I docx_dump.py <file.docx> <out.txt> [<out.json>]
JSON:  danh sach khoi {"loai":"p","chu":...} hoac {"loai":"bang","hang":[[o,...],...]}
Chi doc du lieu, khong chay gi trong file.
"""
import sys, io, json, zipfile, unicodedata
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def chu_cua(el):
    """Lay chu cua 1 doan/o: noi cac w:t, doi w:tab -> ' ', w:br -> ' '."""
    out = []
    for p in el.iter(W + 'p'):
        buf = []
        for node in p.iter():
            if node.tag == W + 't' and node.text:
                buf.append(node.text)
            elif node.tag in (W + 'tab',):
                buf.append(' ')
            elif node.tag in (W + 'br', W + 'cr'):
                buf.append(' ')
        out.append(''.join(buf))
    s = '\n'.join(x for x in out)
    s = unicodedata.normalize('NFC', s)
    return s


def doc_bang(tbl):
    hang = []
    for tr in tbl.findall(W + 'tr'):
        dong = []
        for tc in tr.findall(W + 'tc'):
            pr = tc.find(W + 'tcPr')
            span = 1
            vm = None
            if pr is not None:
                gs = pr.find(W + 'gridSpan')
                if gs is not None:
                    span = int(gs.get(W + 'val', '1'))
                v = pr.find(W + 'vMerge')
                if v is not None:
                    vm = v.get(W + 'val', 'continue')
            # chu trong o (bo bang long nhau neu co -> van lay chu)
            t = ' '.join(x.strip() for x in chu_cua(tc).split('\n') if x.strip())
            if vm == 'continue':
                t = '^'
            for _ in range(span):
                dong.append(t)
        hang.append(dong)
    return hang


def main(src, out_txt, out_json=None):
    z = zipfile.ZipFile(src)
    root = ET.fromstring(z.read('word/document.xml'))
    body = root.find(W + 'body')
    khoi = []
    for el in body:
        if el.tag == W + 'p':
            t = chu_cua(el).strip()
            if t:
                khoi.append({'loai': 'p', 'chu': t})
        elif el.tag == W + 'tbl':
            khoi.append({'loai': 'bang', 'hang': doc_bang(el)})
    with io.open(out_txt, 'w', encoding='utf-8', newline='\n') as f:
        nb = 0
        for k in khoi:
            if k['loai'] == 'p':
                f.write('P| ' + k['chu'] + '\n')
            else:
                nb += 1
                f.write('=== BANG %d (%d hang) ===\n' % (nb, len(k['hang'])))
                for i, h in enumerate(k['hang']):
                    f.write('%3d: ' % i + ' || '.join(h) + '\n')
                f.write('=== HET BANG %d ===\n' % nb)
    if out_json:
        with io.open(out_json, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(khoi, f, ensure_ascii=False, indent=0)
    print('xong', src, len(khoi), 'khoi')


if __name__ == '__main__':
    main(*sys.argv[1:])
