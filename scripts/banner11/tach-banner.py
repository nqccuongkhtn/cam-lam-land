# -*- coding: utf-8 -*-
"""
TÁCH BANNER TỪ BẢN THIẾT KẾ GỐC RA THÀNH MÃ CỦA WEB
====================================================
Chủ dự án thiết kế banner trong MỘT file HTML trưng bày
(`docs/thiet-ke/banner-anh-cam-lam.html`). Script này cắt file đó ra thành:

    apps/frontend/src/components/banner11/banner11.css   — phần hình thức
    apps/frontend/src/components/banner11/mauBanner.ts   — mã HTML từng mẫu
    apps/frontend/src/components/banner11/hinhDungChung.ts — hình dùng chung

Chạy:  python scripts/banner11/tach-banner.py

VÌ SAO PHẢI CÓ SCRIPT, KHÔNG CHÉP TAY:
  · Bản thiết kế còn sửa nhiều lần. Chép tay thì lần sau phải làm lại từ đầu và
    chắc chắn sót chỗ này chỗ kia.
  · Mọi chỗ mình sửa khác bản gốc đều khai ở mục `DOI_ANH` và `SUA_CHU` bên dưới
    — nhìn một chỗ là biết web khác bản thiết kế những gì.

BA VIỆC SCRIPT LÀM KHÁC BẢN GỐC:
  1. BỌC CSS trong `.cl-b11`. Bản gốc dùng tên lớp rất chung (.banner, .cta,
     .layer, .static) mà web mình đã có .cta và .static ở chỗ khác → để nguyên
     là hai bên phá nhau.
  2. ĐỔI ẢNH sang ảnh của chính Cam Lâm (thư mục public/bai-dai, public/tin-mau)
     thay cho ảnh minh hoạ nước ngoài, và đổi đường dẫn về máy chủ mình chứ
     không gọi thẳng sang Unsplash/Pexels.
  3. SỬA VÀI CHỮ cho đúng sự thật (vd mẫu 10 đổi "Ảnh flycam" thành "Bản đồ
     quy hoạch" vì ảnh nền đã đổi thành bản đồ quy hoạch thật).
"""
import io
import json
import os
import re
import sys

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FILE_THIET_KE = os.path.join(GOC, 'docs', 'thiet-ke', 'banner-anh-cam-lam.html')
THU_MUC_RA = os.path.join(GOC, 'apps', 'frontend', 'src', 'components', 'banner11')
THU_MUC_ANH = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')

# ── ĐỔI ẢNH: {số thứ tự mẫu: {mã ảnh trong bản gốc: đường dẫn ảnh của mình}} ──
#    Mã ảnh = phần nhận dạng trong địa chỉ Unsplash/Pexels.
#    Để trống một mẫu = giữ nguyên ảnh của bản thiết kế (sẽ tải về máy chủ mình).
DOI_ANH = {
    # Mẫu 14 "Nét xưa": bản gốc là cổng thành mái ngói (không rõ ở đâu). Chủ dự
    # án muốn nói về di tích Chăm → đổi sang ảnh THÁP GẠCH KIỂU CHĂM.
    # ⚠️ Ảnh lấy từ kho ảnh miễn phí, KHÔNG xác minh được chụp ở đâu, nên chữ
    #    trên banner viết chung chung, tuyệt đối không ghi tên di tích cụ thể.
    14: {'19439393': '/banner11/un-1662514737720-2000.webp'},
    # Mẫu 15 "Phác thảo nhà trên đất trống": bản gốc là ảnh xóm làng nhìn từ cao.
    # Đã thử 2 ảnh kho miễn phí, chủ dự án chê "phèn quá, không sang".
    # Nay dùng ẢNH FLYCAM THẬT khu Golden Bay (Bãi Dài) — đất đã phân lô, đường
    # đã làm, biển phía sau: đúng cảnh "đất trống chờ xây nhà" của chính vùng này.
    # ⚠️ Ảnh lấy từ trang duancamranh.vn, KHÔNG phải ảnh kho miễn phí. Chủ dự án
    #    xác nhận có quyền dùng ("có quyền dùng cứ lấy đi"). Nếu sau này đổi ý
    #    hoặc bên giữ bản quyền có ý kiến thì thay lại bằng ảnh kho miễn phí.
    15: {'37114048': '/banner11/golden-bay-lo-dat.webp'},
}
# ⚠️ ĐỪNG ĐỔI ẢNH CỦA CÁC MẪU NÀY. Đã thử và hỏng nặng.
#    Rất nhiều mẫu có NÉT VẼ TAY BÁM THEO ĐÚNG TẤM ẢNH GỐC:
#      · mẫu 10 vẽ ranh thửa men theo bờ ruộng trong ảnh flycam;
#      · mẫu 16 vẽ tuyến đường men theo con đường thật trong ảnh;
#      · mẫu 15 đặt hình phác thảo căn nhà đúng vào khoảng đất trống;
#      · mẫu 12 làm gợn sóng đúng dải mặt nước, đốm sáng đặt đúng chỗ;
#      · mẫu 17 rọi đèn đúng vào toà nhà;
#      · mẫu 19 dùng bộ lọc chỉnh riêng cho ảnh ruộng lúa.
#    Thay ảnh khác là mấy nét vẽ đó trỏ vào chỗ trống, nhìn loạn hết.
#    Muốn dùng ảnh thật của Cam Lâm thì phải VẼ LẠI nét cho khớp từng tấm ảnh
#    mới — làm được nhưng là việc riêng cho từng mẫu, không đổi một dòng là xong.

# ── BỎ HẲN MỘT SỐ MẪU: [số thứ tự mẫu, ...] ─────────────────────────────────
#    Chủ dự án yêu cầu "banner nào hiệu ứng trùng thì gộp lại".
BO_MAU = [
    # (đang để trống — chủ dự án muốn giữ đủ 19 mẫu)
    # Đã từng bỏ mẫu 8 "Cung đường ven biển" vì trùng nội dung với mẫu 16, nhưng
    # chủ dự án dặn giữ nguyên đủ 19 mẫu, giống bản thiết kế nhất có thể.
]

# ── SỬA CHỮ: {số thứ tự mẫu: [(chữ cũ, chữ mới), ...]} ───────────────────────
SUA_CHU = {
    # Mẫu 14 đã đổi sang ảnh tháp gạch, không còn mái ngói nào → sửa chữ cho
    # khớp ảnh. Vẫn viết chung chung, không nêu tên di tích (xem ghi chú DOI_ANH).
    14: [
        ('trong từng mái ngói', 'trong từng viên gạch'),
        ('Những công trình mang dấu ấn thời gian, đẹp như tranh vẽ tay.',
         'Tháp cổ rêu phong, dấu tích người xưa còn in trên từng lớp gạch.'),
        ('Cổng thành cổ mái ngói hiện ra qua những nét cọ',
         'Tháp gạch cổ hiện ra qua những nét cọ'),
    ],
}

# ── THAY CẢ MỘT ĐOẠN MÃ (dùng khi đổi ảnh không đủ) ─────────────────────────
#    Mẫu 9 vẽ một bản đồ GIẢ bằng SVG. Chủ dự án yêu cầu thay bằng bản đồ thật.
BAN_DO_VE_TAY = ('<rect width="276" height="150" fill="#e0f2fe"/>'
                 '<path d="M0 110C60 96 120 120 180 100S250 70 276 76V150H0Z" fill="#7dd3fc"/>'
                 '<path d="M0 70H276M90 0V150M190 0V150" stroke="#fff" stroke-width="6"/>'
                 '<path d="M30 20h40v34H30zM110 16h60v38h-60zM200 20h56v34h-56z" fill="#bbf7d0"/>'
                 '<g transform="translate(140 76)">')
BAN_DO_THAT = ('<image href="/banner11/qh-cam-lam.webp" x="0" y="0" width="276" height="150" '
               'preserveAspectRatio="xMidYMid slice"/><g transform="translate(126 82)">')
#    Mẫu 12 làm gợn sóng cả dải nước — mà mấy chiếc thuyền cũng nằm trong dải đó
#    nên bị uốn éo theo, chủ dự án nói nhìn khó chịu. Hạ độ gợn xuống và cho gợn
#    chỉ bắt đầu ở nửa dưới của dải (chỗ mặt nước trống, không có thuyền).
#    Mẫu 19 "Ảnh thật → bản đồ quy hoạch": bản gốc GIẢ bản đồ bằng cách chạy một
#    bộ lọc màu lên chính tấm ảnh. Mà web mình CÓ BẢN ĐỒ QUY HOẠCH THẬT (dựng từ
#    file CAD gốc của tỉnh, đang chạy ở trang bản đồ) — dùng chính nó thì vừa
#    đúng sự thật, vừa khoe được sản phẩm, lại sạch bản quyền.
#    Nên: lớp ảnh thứ hai đổi thành BẢN ĐỒ THẬT và bỏ bộ lọc giả đi.
#    ⚠️ Phải viết theo ĐỊA CHỈ ẢNH GỐC, vì bước thay đoạn chạy TRƯỚC bước đổi
#       đường dẫn ảnh về máy chủ mình.
ANH_GIA_BAN_DO = ('<image href="https://images.pexels.com/photos/35995788/pexels-photo-35995788.jpeg'
                  '?auto=compress&cs=tinysrgb&w=2000" width="1000" height="750" '
                  'preserveAspectRatio="none" filter="url(#c19Plan)"/>')
ANH_BAN_DO_THAT = ('<image href="/banner11/qh-cam-lam-rong.webp" x="0" y="40" width="1000" height="323" '
                   'preserveAspectRatio="xMidYMid slice"/>')
THAY_DOAN = {
    9: [(BAN_DO_VE_TAY, BAN_DO_THAT)],
    19: [(ANH_GIA_BAN_DO, ANH_BAN_DO_THAT)],
    12: [
        ('scale="10"', 'scale="4"'),                       # gợn nhẹ hẳn đi
        ('offset=".15" stop-color="#fff"', 'offset=".58" stop-color="#fff"'),  # chừa phần có thuyền
    ],
}


def ten_anh_tai_ve(u: str) -> str:
    """Đặt tên file cho ảnh tải từ Unsplash/Pexels: nguồn + mã + bề ngang."""
    if 'unsplash' in u:
        ma, ng = re.search(r'photo-([0-9a-f-]+)', u).group(1)[:12], 'un'
    else:
        ma, ng = re.search(r'pexels-photo-(\d+)', u).group(1), 'px'
    w = re.search(r'[?&]w=(\d+)', u)
    return f'{ng}-{ma}-{w.group(1) if w else "x"}.webp'


def cat_the_div(txt: str, i: int) -> str:
    """Cắt trọn một thẻ <div> kể cả các thẻ lồng bên trong."""
    sau = 0
    for m in re.finditer(r'<div\b|</div>', txt[i:]):
        sau += 1 if m.group(0) == '<div' else -1
        if sau == 0:
            return txt[i:i + m.end()]
    raise SystemExit('Không tìm thấy thẻ đóng của banner')


def boc_css(css: str) -> str:
    """Bọc mọi luật CSS vào trong .cl-b11 cho khỏi đụng tên lớp với web."""
    chuthich = []

    def cat(m):
        chuthich.append(m.group(0))
        return f'/*__C{len(chuthich) - 1}__*/'

    css = re.sub(r'/\*.*?\*/', cat, css, flags=re.S)

    def doi_selector(sel: str) -> str:
        ra = []
        for x in sel.split(','):
            x = x.strip()
            if not x:
                continue
            if x == ':root':
                ra.append('.cl-b11')
            elif x.startswith('.static'):
                ra.append('.cl-b11.static' + x[len('.static'):])
            else:
                ra.append('.cl-b11 ' + x)
        return ', '.join(ra)

    def di(txt: str) -> str:
        ra, i, n = [], 0, len(txt)
        while i < n:
            j = txt.find('{', i)
            if j < 0:
                ra.append(txt[i:])
                break
            truoc = txt[i:j]
            # "*/" dài 2 ký tự — cắt thiếu 1 là xé đôi chú thích (đã vấp)
            ket = 0
            for dh in ('*/', '}', ';'):
                p = truoc.rfind(dh)
                if p >= 0:
                    ket = max(ket, p + len(dh))
            dau, sel = truoc[:ket], truoc[ket:]
            d, e = 0, j
            while e < n:
                if txt[e] == '{':
                    d += 1
                elif txt[e] == '}':
                    d -= 1
                    if d == 0:
                        break
                e += 1
            than, s = txt[j + 1:e], sel.strip()
            # ⚠️ @property PHẢI ĐỂ NGUYÊN. Bọc nó thành ".cl-b11 @property --wx"
            #    là CSS sai, trình duyệt bỏ qua → biến --wx không được khai báo
            #    kiểu → hiệu ứng nào chạy bằng cách biến đổi biến đó sẽ NHẢY
            #    GIẬT từng nấc chứ không trượt mượt (mẫu 5 "đen trắng → màu thật"
            #    đứng im một chỗ, đã vấp đúng lỗi này).
            if s.startswith(('@keyframes', '@-webkit-keyframes', '@font-face',
                             '@property', '@counter-style', '@page')):
                ra.append(dau + sel + '{' + than + '}')
            elif s.startswith('@media') or s.startswith('@supports'):
                ra.append(dau + sel + '{' + di(than) + '}')
            else:
                ra.append(dau + re.match(r'\s*', sel).group(0) + doi_selector(sel) + '{' + than + '}')
            i = e + 1
        return ''.join(ra)

    ra = di(css)
    return re.sub(r'/\*__C(\d+)__\*/', lambda m: chuthich[int(m.group(1))], ra)



def luat_chua_dai(css: str) -> str:
    """
    Sinh luật CSS chừa một DẢI TRỐNG Ở ĐÁY banner, dùng chung cho cả 19 mẫu, để
    đặt khung tìm kiếm mà không đè lên chữ và che ảnh ít nhất có thể.

    VÌ SAO CHỪA Ở ĐÁY CHỨ KHÔNG PHẢI Ở TRÊN:
    Gần như mọi mẫu đều neo chữ theo MÉP TRÊN (tiêu đề, mô tả, nút bấm đều tính
    từ trên xuống). Nên đáy là chỗ trống nhất, và chừa ở đáy thì KHÔNG PHẢI ĐỘNG
    vào bố cục phía trên — giữ được thiết kế gốc sát nhất.
    (Đã thử chừa ở TRÊN: phải đẩy 47 khối chữ xuống, mẫu nào cũng lệch đi một
    chút so với bản thiết kế, có mẫu lệch hẳn.)

    CÁCH LÀM: banner cao thêm `--thanh` px (xem banner11-them.css). Phần cao
    thêm rơi xuống đáy; ảnh nền tự phủ xuống theo vì chúng dùng `inset: 0`.
    Chỉ còn vài khối chữ neo theo MÉP DƯỚI là bị tụt vào dải đó → nâng chúng lên
    đúng bấy nhiêu.

    CÁCH DÒ khối cần nâng: `position:absolute` + có `bottom:` + KHÔNG có `top:`
    (có cả hai nghĩa là lớp chạy suốt chiều cao — ảnh nền, viền — phải để yên).
    Bỏ qua selector lồng sâu (vd `.pol b`): đó là chữ nằm trong một thẻ con của
    mẫu, nâng lên là vỡ chính thẻ đó chứ không liên quan đáy banner.
    Phần dành cho điện thoại để yên: màn nhỏ đặt khung tìm kiếm hẳn dưới banner.
    """
    khong = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    khong = re.sub(r'@media \(max-width:760px\)\{.*?\n\}', '', khong, flags=re.S)
    ten = []
    for m in re.finditer(r'(\.cl-b11 [^{@]*)\{([^}]*)\}', khong):
        sel, than = m.group(1).strip(), m.group(2)
        if 'position:absolute' not in than:
            continue
        if not re.search(r'(?:^|;)bottom:', than):
            continue
        if re.search(r'(?:^|;)top:', than):          # lớp chạy suốt chiều cao
            continue
        for x in sel.split(','):
            x = x.strip()
            if not x or x in ten:
                continue
            if len(x.split()) > 2:                   # lồng sâu, vd ".cl-b11 .pol b"
                continue
            ten.append(x)
    if not ten:
        return ''
    ds = ',\n'.join(ten)
    dau = (
        '\n\n/* ══ CHỪA DẢI TRỐNG Ở ĐÁY BANNER CHO KHUNG TÌM KIẾM ══════════════════════\n'
        ' * SINH TỰ ĐỘNG — xem hàm luat_chua_dai() trong scripts/banner11/tach-banner.py\n'
        ' * Banner được kéo cao thêm `--thanh` px; phần cao thêm rơi xuống đáy và thành\n'
        ' * chỗ đặt khung tìm kiếm, dùng chung cho cả 19 mẫu.\n'
        ' * Ảnh nền tự phủ xuống dải đó (chúng dùng inset:0) nên banner vẫn là một tấm\n'
        ' * ảnh liền. Chỉ vài khối chữ neo theo MÉP DƯỚI là phải nâng lên bấy nhiêu.\n'
        ' * ═════════════════════════════════════════════════════════════════════════ */\n'
    )
    return dau + ds + ' { margin-bottom: var(--thanh, 0px) }\n'


def main():
    if not os.path.exists(FILE_THIET_KE):
        raise SystemExit(f'Không thấy bản thiết kế: {FILE_THIET_KE}')
    goc = io.open(FILE_THIET_KE, encoding='utf-8').read().replace('&amp;', '&')

    # ── Tên tiếng Việt + mã HTML từng mẫu ────────────────────────────────────
    ten = [re.sub('<[^>]+>', '', t).strip()
           for _, t in re.findall(r'<h2[^>]*><span class="num">(\d+)</span>\s*·\s*(.*?)</h2>', goc, re.S)]
    khoi = [cat_the_div(goc, m.start()) for m in re.finditer(r'<div class="banner[^"]*"[^>]*>', goc)]
    if len(khoi) != len(ten):
        raise SystemExit(f'Số mẫu ({len(khoi)}) khác số tiêu đề ({len(ten)}) — bản thiết kế có gì lạ')

    can_tai, mau = {}, []
    for so, html in enumerate(khoi, 1):
        if so in BO_MAU:
            print(f'  · bỏ mẫu {so} ({ten[so - 1]}) — trùng với mẫu khác')
            continue
        for cu, moi in THAY_DOAN.get(so, []):
            if cu not in html:
                print(f'  ⚠ mẫu {so}: không tìm thấy đoạn cần thay (bản thiết kế đã đổi?)')
            html = html.replace(cu, moi)
        for cu, moi in SUA_CHU.get(so, []):
            if cu not in html:
                print(f'  ⚠ mẫu {so}: không tìm thấy chữ "{cu}"')
            html = html.replace(cu, moi)
        for u in sorted(set(re.findall(r'https://(?:images\.unsplash\.com|images\.pexels\.com)[^\s"\')<>]+', html))):
            thay = None
            for ma, duong in DOI_ANH.get(so, {}).items():
                if ma in u:
                    thay = duong
                    break
            if thay is None:                       # giữ ảnh gốc → tải về máy chủ mình
                thay = '/banner11/' + ten_anh_tai_ve(u)
                can_tai[u] = ten_anh_tai_ve(u)
            html = html.replace(u, thay)
        lop = re.search(r'class="banner ([^"]*)"', html).group(1)
        mau.append({'lop': lop, 'ten': ten[so - 1], 'html': html})

    # ── Ảnh còn thiếu trên máy chủ mình ──────────────────────────────────────
    thieu = {u: f for u, f in can_tai.items() if not os.path.exists(os.path.join(THU_MUC_ANH, f))}
    if thieu:
        print('\nCÒN THIẾU ẢNH, tải bằng mấy lệnh này rồi chạy lại script:')
        for u, f in thieu.items():
            print(f'  curl -sS --retry 3 --max-time 300 -o "apps/frontend/public/banner11/{f}" "{u}"')
    # Ảnh của mình khai trong DOI_ANH cũng phải có thật
    for so, doi in DOI_ANH.items():
        for _, duong in doi.items():
            p = os.path.join(GOC, 'apps', 'frontend', 'public', duong.lstrip('/'))
            if not os.path.exists(p):
                print(f'  ⚠ mẫu {so}: thiếu file ảnh {duong}')

    # ── Hình dùng chung (symbol #star, gradient #sg…) ────────────────────────
    m = re.search(r'(<svg width="0" height="0"[^>]*>.*?</svg>)', goc, re.S)
    dung_chung = m.group(1) if m else ''

    # ── CSS ──────────────────────────────────────────────────────────────────
    css = re.findall(r'<style>(.*?)</style>', goc, re.S)[0]
    root = re.search(r'(:root\{[^}]*\})', css).group(1)
    than = css[css.index('/* ============ Khung banner chung ============ */'):]
    ra_css = boc_css(root + '\n' + than)

    os.makedirs(THU_MUC_RA, exist_ok=True)
    dau_de = '''/* ============================================================================
 *  %d MẪU BANNER ĐỘNG CHO TRANG CHỦ  —  phần hình thức (CSS)
 * ----------------------------------------------------------------------------
 *  ⚠️ FILE NÀY SINH TỰ ĐỘNG, ĐỪNG SỬA TAY.
 *     Sửa bản thiết kế `docs/thiet-ke/banner-anh-cam-lam.html` rồi chạy:
 *         python scripts/banner11/tach-banner.py
 *     Phần viết thêm của dự án nằm ở `banner11-them.css` (không bị ghi đè).
 *
 *  Mọi luật đã được bọc trong `.cl-b11` cho khỏi đụng tên lớp với phần còn lại
 *  của web (bản gốc dùng .banner, .cta, .layer, .static — web đã có .cta,
 *  .static ở chỗ khác).
 * ========================================================================== */

''' % len(mau)
    io.open(os.path.join(THU_MUC_RA, 'banner11.css'), 'w', encoding='utf-8', newline='\n').write(
        dau_de + ra_css.strip() + luat_chua_dai(ra_css) + '\n')

    dau_ts = '''/* ============================================================================
 *  %d MẪU BANNER ĐỘNG — phần nội dung (mã HTML của từng mẫu)
 * ----------------------------------------------------------------------------
 *  ⚠️ FILE NÀY SINH TỰ ĐỘNG, ĐỪNG SỬA TAY. Sửa bản thiết kế rồi chạy:
 *         python scripts/banner11/tach-banner.py
 *  Mọi chỗ web khác bản thiết kế (đổi ảnh, sửa chữ) khai trong chính script đó.
 * ========================================================================== */

export interface MauBanner {
  /** tên lớp kiểu của mẫu, vd "st-rib" */
  lop: string;
  /** tên tiếng Việt, dùng cho nút chọn mẫu và phần đọc màn hình */
  ten: string;
  /** mã HTML nguyên văn của mẫu */
  html: string;
}

export const MAU_BANNER: MauBanner[] = ''' % len(mau)
    io.open(os.path.join(THU_MUC_RA, 'mauBanner.ts'), 'w', encoding='utf-8', newline='\n').write(
        dau_ts + json.dumps(mau, ensure_ascii=False, indent=2) + ';\n')

    io.open(os.path.join(THU_MUC_RA, 'hinhDungChung.ts'), 'w', encoding='utf-8', newline='\n').write(
        '''/* ============================================================================
 *  HÌNH DÙNG CHUNG CHO MỌI MẪU BANNER  (sinh tự động — đừng sửa tay)
 * ----------------------------------------------------------------------------
 *  Mấy mẫu banner gọi tới hình dùng chung bằng `<use href="#star">`. Thiếu khối
 *  này thì đốm sáng, ngôi sao… mất sạch mà KHÔNG báo lỗi gì.
 *  Khối svg này rộng 0 cao 0, không hiện gì, chỉ để chứa hình dùng chung.
 * ========================================================================== */

export const HINH_DUNG_CHUNG = ''' + json.dumps(dung_chung, ensure_ascii=False) + ';\n')

    print(f'\nXong: {len(mau)} mẫu · CSS {len(ra_css) // 1024} KB · hình dùng chung {len(dung_chung)} ký tự')
    for i, m in enumerate(mau, 1):
        print(f'  {i:>2}. {m["ten"]}  ({m["lop"]})')


if __name__ == '__main__':
    main()
