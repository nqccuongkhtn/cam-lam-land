# -*- coding: utf-8 -*-
"""
DỰNG TỪ ĐIỂN THUẬT NGỮ — lấy thẳng từ điều "Giải thích từ ngữ" của chính các văn bản.

Trước đây khi viết chữ cho thẻ học và tình huống, tôi tự chọn chữ theo cảm tính, nên lọt
đủ thứ chữ lóng tự nghĩ ra ("vắt qua mốc", "còn cửa", "mất trắng"). Cách chắc chắn là
KHÔNG TỰ CHỌN NỮA: lấy đúng bộ từ ngữ mà luật đã định nghĩa rồi bám vào đó.

Nguồn: mỗi văn bản đều có một điều "Giải thích từ ngữ", viết theo đúng một khuôn:
    "<Từ ngữ> là <định nghĩa>."
Luật Đất đai 2024 Điều 3 có 50 từ, Luật 2013 Điều 3 có 30 từ, Luật 2003 Điều 4 có 29 từ,
các nghị định/thông tư có thêm vài từ chuyên môn.

Làm ra hai thứ:
  1. tu-ngu.json — từ điển để tra và để học (mỗi từ kèm định nghĩa nguyên văn + dẫn tới điều gốc).
  2. Bộ SOÁT: quét chữ mình tự viết (thẻ học, tình huống, sơ đồ), chỗ nào dùng chữ dân gian
     trong khi luật đã có từ chính thức thì báo ra.

Chạy:  python dung-tu-dien.py <thu-muc-json>
"""
import sys, os, re, json

# Chữ dân gian -> từ ngữ luật dùng. Chỉ khai những cặp mà LUẬT CÓ ĐỊNH NGHĨA thật,
# để bộ soát không bắt vạ những chữ đời thường vô hại.
DAN_GIAN = {
    'sổ đỏ': 'Giấy chứng nhận quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất',
    'sổ hồng': 'Giấy chứng nhận quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất',
    'đền bù': 'bồi thường về đất',
    'sang tên': 'đăng ký biến động',
    'lên thổ cư': 'chuyển mục đích sử dụng đất sang đất ở',
    'tách sổ': 'tách thửa đất',
    'giấy tay': 'giấy tờ về quyền sử dụng đất',
    'cắm sổ': 'thế chấp quyền sử dụng đất',
    'bìa đỏ': 'Giấy chứng nhận quyền sử dụng đất',
    'nhà nước lấy đất': 'Nhà nước thu hồi đất',
    'giá đền bù': 'giá đất cụ thể',
}

RE_DINH_NGHIA = re.compile(r'^\s*(.{2,70}?)\s+là\s+(.+)$', re.S)


def rut_tu(thu_muc):
    kho = json.load(open(os.path.join(thu_muc, '_kho.json'), encoding='utf-8'))
    ra, thay = [], set()
    for x in kho:
        p = os.path.join(thu_muc, x['ma'] + '.json')
        if not os.path.exists(p):
            continue
        v = json.load(open(p, encoding='utf-8'))
        for d in v['dieu']:
            t = (d.get('tieuDe') or '').lower()
            if 'giải thích từ ngữ' not in t and 'giải thích thuật ngữ' not in t:
                continue
            for k in d['khoan']:
                chu = re.sub(r'\s+', ' ', k['chu']).strip()
                if not chu or chu.endswith(':'):
                    continue              # câu dẫn "các từ ngữ dưới đây được hiểu như sau:"
                m = RE_DINH_NGHIA.match(chu)
                if not m:
                    continue
                tu = m.group(1).strip().rstrip(',')
                # "Nhà nước cho thuê quyền sử dụng đất (sau đây gọi là ...) là ...":
                # chữ "là" đầu tiên nằm TRONG ngoặc nên cắt hụt. Mở ngoặc mà chưa đóng
                # thì cắt bỏ từ dấu mở ngoặc trở đi.
                if tu.count('(') > tu.count(')'):
                    tu = tu[:tu.rfind('(')].strip()
                # bỏ mấy câu dài bắt nhầm (từ ngữ không bao giờ dài quá 12 chữ)
                if len(tu.split()) > 12 or len(tu) < 3:
                    continue
                khoa = tu.lower()
                if khoa in thay:
                    continue
                thay.add(khoa)
                nghia = m.group(2).strip()
                # cùng lý do trên: phần định nghĩa còn dính đuôi ngoặc
                # "Nhà nước cho thuê đất) là việc…" -> cắt tới sau ") là "
                mn = re.match(r'^[^()]{0,60}\)\s*là\s+(.+)$', nghia, re.S)
                if mn:
                    nghia = mn.group(1).strip()
                ra.append({'tu': tu, 'nghia': nghia,
                           'ma': x['ma'], 'soHieu': x['soHieu'], 'dieu': d['so'], 'khoan': k['so']})
    ra.sort(key=lambda z: z['tu'].lower())
    return ra


def soat_chu_minh(thu_muc, tu_dien):
    """Quét chữ mình tự viết xem còn dùng chữ dân gian không."""
    co = {}
    for f in ['the-so.json', 'giai-thich.json', 'tinh-huong.json', 'so-do.json']:
        p = os.path.join(thu_muc, f)
        if not os.path.exists(p):
            continue
        s = json.dumps(json.load(open(p, encoding='utf-8')), ensure_ascii=False)
        for dg, dung in DAN_GIAN.items():
            n = len(re.findall(re.escape(dg), s, re.I))
            if n:
                co.setdefault(f, []).append((dg, dung, n))
    return co


def lam(thu_muc):
    td = rut_tu(thu_muc)
    ra = os.path.join(thu_muc, 'tu-ngu.json')
    json.dump({'tu': td, 'danGian': DAN_GIAN},
              open(ra, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('Da rut %d tu ngu -> %s' % (len(td), ra))
    theo_vb = {}
    for t in td:
        theo_vb[t['soHieu']] = theo_vb.get(t['soHieu'], 0) + 1
    for k, n in sorted(theo_vb.items(), key=lambda z: -z[1]):
        print('   %-18s %d tu' % (k, n))

    co = soat_chu_minh(thu_muc, td)
    print('\n=== SOAT CHU MINH TU VIET ===')
    if not co:
        print('Khong con cho nao dung chu dan gian.')
    for f, ds in co.items():
        for dg, dung, n in ds:
            sys.stdout.buffer.write(
                ('  %-17s "%s" x%d  -> nen dung: %s\n' % (f, dg, n, dung)).encode('utf-8', 'replace'))


if __name__ == '__main__':
    lam(sys.argv[1] if len(sys.argv) > 1 else 'apps/frontend/public/luat')
