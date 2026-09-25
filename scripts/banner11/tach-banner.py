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
import importlib.util as _iu

# Nạp bộ vẽ căn nhà 3 tầng của mẫu 15 (file có dấu gạch ngang nên phải nạp kiểu này)
_spec = _iu.spec_from_file_location('ve_nha_mau15',
                                    os.path.join(os.path.dirname(os.path.abspath(__file__)), 've-nha-mau15.py'))
_ve_nha = _iu.module_from_spec(_spec); _spec.loader.exec_module(_ve_nha)
NHA15_MAT, NHA15_NET = _ve_nha.sinh()
# Hình lô đất của mẫu 15 — LẤY THẲNG từ bộ vẽ, không chép tay.
# (Bộ vẽ lại đọc hàng rào thật từ banner11/m15-khung.json do lúc cắt ảnh sinh ra.)
LO15 = 'd="%s"' % _ve_nha.duong_lo()

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
    # Đã thử ảnh flycam khu Golden Bay nhưng ảnh gốc chỉ 1200×600, phóng lên khổ
    # banner là vỡ nhoè — chủ dự án nói "rất tệ".
    # Nay dùng ảnh LÔ ĐẤT CỎ XANH TRÊN GÒ NHÌN RA BIỂN (1920×2692, rất nét):
    # sang, đúng chất đất ven biển, lại có khoảng cỏ trống để đặt hình phác thảo
    # căn nhà lên. Có ảnh flycam THẬT độ phân giải cao của Cam Lâm thì thay vào.
    # ⚠️ MẪU 15 KHÔNG CÒN DÙNG ẢNH CÁNH ĐỒNG NỮA. Nền của mẫu này nay là
    #    CHÍNH TẤM ẢNH PHỐI CẢNH BIỆT THỰ, do nhóm b5-face vẽ ra (xem
    #    ve-nha-mau15.py). Ảnh nền gốc của bản thiết kế bị đẩy xuống dưới và
    #    không nhìn thấy, nên để trỏ vào ảnh nào cũng được — giữ nguyên cho
    #    khỏi phải sửa chỗ khác, nhưng ĐỪNG tưởng nó là ảnh đang hiện.
    15: {'37114048': '/banner11/un-1760016400107-2000.webp'},
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

# ── THỨ TỰ HIỆN RA WEB: [số mẫu, số mẫu, ...] ───────────────────────────────
#    Bản thiết kế xếp 19 mẫu theo thứ tự nào thì đánh số theo đúng thứ tự đó.
#    Muốn đổi chỗ trên web thì SỬA DANH SÁCH NÀY, đừng sửa bản thiết kế —
#    số mẫu còn được dùng ở BO_MAU, SUA_CHU, DOI_ANH… sửa bản thiết kế là
#    lệch hết mấy chỗ kia.
#    25/9/2026 — chủ dự án: "dời banner số 4 lên vị trí 2, dời 15 lên vị trí 4".
THU_TU = [1, 4, 2, 15, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19]

# ── SỬA CHỮ: {số thứ tự mẫu: [(chữ cũ, chữ mới), ...]} ───────────────────────
SUA_CHU = {
    # Mẫu 18 nay nói về ĐÔ THỊ MỚI (toà nhà cao tầng vượt khung), không còn nói
    # về sân bay nữa — phần sân bay đã có mẫu 7 lo rồi, để cả hai là trùng ý.
    18: [
        ('Cửa ngõ hàng không', 'Đô thị mới'),
        ('Bay xa hơn', 'Vươn cao'),
        ('từ Cam Lâm', 'giữa lòng Cam Lâm'),
        ('Sân bay quốc tế chỉ cách một quãng ngắn, đi công tác, du lịch hay đón người thân đều thuận tiện.',
         'Nhà cao tầng, hạ tầng mới đang hình thành trên vùng đất quy hoạch thành đô thị.'),
        ('Máy bay bay ra khỏi khung ảnh', 'Toà nhà cao tầng vươn ra khỏi khung ảnh'),
    ],
    # Mẫu 19: nền nay là bản đồ quy hoạch THẬT và ranh thửa THẬT của web, nên
    # phần chú giải phải nói đúng thứ đang hiện, không còn "LUC · Đất trồng lúa"
    # vẽ tay nữa.
    # ⚠️ Thứ tự các dòng ở đây CÓ QUAN TRỌNG: thay xong dòng trên thì dòng dưới
    #    sẽ chạy trên kết quả đã thay. Trước đây để "Cây xanh"→"Ranh thửa thật"
    #    rồi "Ranh thửa"→"Ảnh vệ tinh" nên nó thay chồng thành "Ảnh vệ tinh thật".
    19: [
        ('LUC · Đất trồng lúa', 'Bản đồ quy hoạch'),
        ('Cây xanh', 'Ảnh vệ tinh'),
        ('Ranh thửa', 'Ranh thửa thật'),
        ('Ảnh đồng lúa Cam Lâm chuyển thành bản đồ quy hoạch',
         'Ảnh thật chuyển thành bản đồ quy hoạch Cam Lâm'),
    ],
    # Mẫu 17: câu giới thiệu cũ đi giải thích CÁCH LÀM ("dự án được đánh dấu
    # ngay trên ảnh thật…") — khách đọc chẳng để làm gì. Đổi thành nói cái khách
    # quan tâm: chỗ đó có gì quanh mình.
    17: [('Dự án được đánh dấu ngay trên ảnh thật, thấy rõ sông, cầu và phố phường xung quanh.',
          'Sát mặt sông, cạnh cầu lớn, xung quanh là phố đã có người ở — đi lại, mua bán đều thuận.')],
    # Chủ dự án khoanh đỏ dòng "ẢNH FLYCAM · CAM LÂM" và dặn đổi thành ảnh quy
    # hoạch. Chỉ đổi CHỮ, giữ nguyên tấm ảnh flycam — vì ranh thửa của mẫu này
    # vẽ tay bám theo đúng bờ ruộng trong ảnh, đổi ảnh là nét trỏ vào chỗ trống
    # (đã thử bản nền bản đồ quy hoạch, chủ dự án không dùng).
    10: [('Ảnh flycam · Cam Lâm', 'Ảnh quy hoạch · Cam Lâm')],
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

# ── THAY BẰNG BIỂU THỨC: {số mẫu: [(mẫu tìm, đoạn thay), ...]} ──────────────
#    Dùng khi đoạn cần thay quá dài để chép nguyên văn vào đây (vd mặt nạ hình
#    chiếc máy bay của mẫu 18 dài gần 3.000 ký tự).
THAY_BIEU_THUC = {
    # Xoá nhóm `c18-patch` của mẫu 18 (xem lý do ở THAY_DOAN[18])
    18: [(r'<g class="c18-patch[^>]*>.*?</g></g>', ''),
         (r'<mask id="c18PlaneMask".*?</mask>', '__MAT_NA_MOI__')],
    # Mẫu 15: thay căn nhà 1 trệt của bản thiết kế bằng NHÀ 3 TẦNG CÓ SÂN VƯỜN.
    # Hình do scripts/banner11/ve-nha-mau15.py tính ra từ chính hình bình hành
    # của lô đất, nên nhà đứng khít trên đất chứ không lệch.
    15: [(r'<g class="b5-face".*?</g>', '__NHA15_MAT__'),
         (r'<g class="grp b5-wire c15-wire".*?</g>', '__NHA15_NET__')],
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
# Bọc bản đồ + ranh thửa vào một nhóm để PHÓNG DẦN vào thửa đất (xem CSS
# `m19-phong` trong banner11-them.css). Thửa được chọn: Thửa 132 · Tờ 19 ·
# 2.967 m² · CLN, nằm ở 55% ngang / 44% dọc của khung — đó cũng là tâm phóng.
ANH_BAN_DO_THAT = ('<g class="m19-phong">'
                   '<g class="m19-l1"><image href="/banner11/m19-qh1.webp" '
                   'x="0" y="40" width="1000" height="323" '
                   'preserveAspectRatio="none"/></g>'
                   '<g class="m19-l2" transform="translate(500 201.5) scale(0.125) '
                   'translate(-500 -201.5)"><image href="/banner11/m19-qh2.webp" '
                   'x="0" y="40" width="1000" height="323" '
                   'preserveAspectRatio="none"/></g>'
                   '<g class="m19-l3" transform="translate(500 201.5) scale(0.03125) '
                   'translate(-500 -201.5)"><image href="/banner11/m19-qh3.webp" '
                   'x="0" y="40" width="1000" height="323" '
                   'preserveAspectRatio="none"/></g>')
#    Mẫu 19 còn một chỗ giả nữa: RANH THỬA và mấy chữ "LUC" là VẼ TAY men theo
#    bờ ruộng trong tấm ảnh gốc. Nay nền đã là bản đồ quy hoạch thật nên mấy nét
#    đó nằm lạc lõng, cắt ngang bản đồ, nhìn rất sai.
#    Thay bằng RANH THỬA THẬT: lớp ảnh dựng từ bảng `dia_chinh` (900 thửa ở vùng
#    Cam Hải Đông – Bãi Dài), chồng khít với bản đồ quy hoạch vì cùng một khung
#    toạ độ. Xem scripts/banner11/dung-anh-mau19.py.
RANH_VE_TAY = ''' <g fill="none" stroke="#7a3e12" stroke-width="2.6" stroke-linejoin="round" opacity=".9"><path d="M700 108L750 148L800 181L850 214L900 247L950 284L1000 318L1000 420L950 437L900 453L850 469L800 486L760 506L710 524L650 502L600 486L560 474L500 458L460 444L400 430L370 421L346 390L362 366L378 330L434 292L500 254L550 226L600 185L650 150Z"/><path d="M258 8L320 26L407 50L500 70L580 82L640 92L700 108L650 150L600 185L550 226L500 254L434 292L378 330L321 298L258 264L201 236L150 198L148 150L140 120L134 101L158 72L205 40Z"/><path d="M700 108L730 86L760 72L800 60L850 50L900 45L1000 38L1000 318L950 284L900 247L850 214L800 181L750 148Z"/><path d="M370 421L400 430L460 444L500 458L560 474L600 486L650 502L710 524L722 550L740 598L760 635L790 675L820 715L840 750L350 750L330 675L312 625L300 580L285 524L282 475L300 455L330 430Z"/><path d="M710 524L760 506L800 486L850 469L900 453L950 437L1000 420L1000 750L840 750L820 715L790 675L760 635L740 598L722 550Z"/><path d="M0 207L60 203L100 202L150 198L201 236L258 264L321 298L378 330L362 366L346 390L300 412L250 432L202 452L150 457L100 467L50 482L0 497Z"/><path d="M0 497L50 482L100 467L150 457L202 452L230 520L254 600L275 680L290 750L0 750Z"/></g>
        <g font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="800" fill="#7a3e12" text-anchor="middle" style="paint-order:stroke;stroke:rgba(255,250,220,.85);stroke-width:4px"><text x="692" y="340">LUC</text><text x="376" y="157">LUC</text><text x="892" y="146">LUC</text><text x="148" y="341">LUC</text></g> '''.strip()
# Ranh thửa nay đã được VẼ SẴN vào tầng ảnh gần nhất (m19-qh3) nên ở đây chỉ
# cần đóng nhóm phóng lại.
RANH_THAT = '</g>'

#    Mẫu 18 "Chủ thể vượt khung": ảnh trong khung đổi sang ảnh ĐÔ THỊ VEN BIỂN
#    Nha Trang (Gold Coast), chụp ngước lên nên toà tháp vươn cao và thon —
#    đúng thứ cần cho hiệu ứng vượt khung. Chính chủ dự án chọn tấm này.
#    Trước đó đã thử hai tấm khác: tấm đầu toà nhà lùn, nhô ra có 18 đơn vị
#    ("chưa thực sự làm nổi bật được hiệu ứng"); tấm thứ hai khá hơn nhưng chủ
#    dự án vẫn muốn đổi.
#    Ảnh là ảnh DỌC 800×1200 nên phải tính lại toàn bộ chỗ đặt — để nguyên
#    thông số cũ là ảnh bị kéo dãn méo mó.
#    Cách chọn ba số translate/scale (đừng sửa bừa, tính lại theo lối này):
#      · muốn ảnh phủ kín khung rộng 700 ⇒ scale ≥ 0,70;
#      · chọn 0,72, đặt tx = 1050 ⇒ ảnh trải X 1050–1770, phủ khung 1060–1760;
#      · đỉnh toà tháp trong ảnh ở v ≈ 124 ⇒ ty ≈ −106,6 thì đỉnh rơi sát mép
#        trên khung nhìn, nhô ra khỏi mép khung ảnh (y = 110) khoảng 96 đơn vị.
_A18_CU = ('https://images.unsplash.com/photo-1580698872460-261e00561f35'
           '?w=1600&q=80&auto=format&fit=crop" width="1000" height="1472.5" '
           'preserveAspectRatio="none" transform="translate({t} -471.5) scale(1.0769)"')
# Khung ảnh mới: phóng to hơn (1,05 thay vì 0,85) và kéo ảnh LÊN (ty = −42,4)
# để đỉnh toà nhà nhô hẳn ra ngoài mép khung. Trước đây toà nhà chỉ nhô ra 18
# đơn vị — chủ dự án nói "chưa thực sự làm nổi bật được hiệu ứng". Nay nhô ra
# 93 đơn vị, gấp hơn 5 lần.
# ⚠️ Ba con số tx/ty/scale này phải KHỚP với TX/TY/S trong
#    scripts/banner11/tach-toa-nha-mau18.py — đổi một bên thì chạy lại bên kia,
#    lệch là ảnh cắt rời không nằm khít lên ảnh trong khung.
_A18_MOI = ('/banner11/mia-goldcoast-800.webp" width="1000" height="1500" '
            'preserveAspectRatio="none" transform="translate({t} 30.6) scale(0.448)"')
_MAY_BAY = ('<g class="c18-plane" data-at="1500"><g mask="url(#c18PlaneMask)">'
            '<image href="https://images.unsplash.com/photo-1580698872460-261e00561f35'
            '?w=1600&q=80&auto=format&fit=crop" width="1000" height="1472.5" '
            'preserveAspectRatio="none" transform="translate(736.9 -471.5) scale(1.0769)"/></g></g>')
# ── MẪU 18: TOÀ NHÀ VƯỢT KHUNG, BÁM ĐÚNG TOÀ NHÀ CÓ THẬT TRONG ẢNH ──────────
# ⚠️ Đã thử VẼ toà nhà bằng vector và bị chủ dự án bắt lỗi ngay: hình vẽ không
#    trùng với toà nhà trong ảnh nên nhìn lệch hẳn.
#    Cách đúng — cũng là cách bản thiết kế dùng cho chiếc máy bay: KHÔNG vẽ gì
#    cả, mà dùng MẶT NẠ có hình đúng cái chủ thể trong ảnh, rồi cho nó lộ ra
#    phần ảnh NẰM NGOÀI khung. Chủ thể thành ra "vượt khung" mà vẫn là ảnh thật.
#    Đã soi ảnh trong đúng hệ toạ độ của banner: toà nhà khách sạn cao nhất nằm
#    ở x 1691–1768, phần thân vươn lên trên mép khung (mép khung ở y = 110).
# Mặt nạ c18PlaneMask của bản thiết kế nay không ai dùng nữa (xem _TOA_NHA),
# nên bỏ hẳn cho gọn.
_MAT_NA_MOI = ''
# ⚠️ PHẦN NHÔ RA DÙNG CHÍNH TẤM ẢNH TRONG KHUNG, CHỈ KHOÉT THEO MẶT NẠ
#    Đây là chỗ đã sửa ba lần mới xong. Hai cách trước đều lộ vết ghép:
#      · cách 1: mặt nạ hình chữ nhật → lôi theo cả mảng trời, thành ô vuông tối;
#      · cách 2: cắt toà nhà ra thành ẢNH RIÊNG rồi đặt đè lên → hai lớp là hai
#        tấm ảnh khác nhau (một cái đã cắt rồi phóng to lại), lệch nhau vài phần
#        trăm là mắt thấy ngay chỗ nối.
#    Cách đang dùng: vẫn là MỘT tấm ảnh duy nhất, đặt đúng một phép
#    translate/scale, chỉ khác là bản nhô ra bị khoét theo mặt nạ hình toà nhà.
#    Hai phần vốn là một ảnh nên KHÔNG THỂ lệch.
#    Lớp ngoài `c18Tren` cắt ngang ở mép khung ảnh và ĐỨNG YÊN; lớp trong mới là
#    lớp chạy hiệu ứng vươn lên — nhìn như toà nhà mọc dần ra khỏi khung, xong
#    thì khít tuyệt đối.
_TOA_NHA = ('<g clip-path="url(#c18Tren)">'
            '<g class="c18-plane" data-at="1500" mask="url(#c18Toa)">'
            '<image href="/banner11/mia-goldcoast-800.webp" width="1000" height="1500" '
            'preserveAspectRatio="none" transform="translate(1228 30.6) scale(0.448)"/>'
            '</g></g>')

#    Mẫu 15: hình phác thảo căn nhà nằm sát ĐÁY khổ thiết kế (y 693–746 trong
#    khung nhìn 524–750). Banner nay thấp hơn khổ gốc, lại có khung tìm kiếm ở
#    đáy → căn nhà bị che mất. Dời khung nhìn xuống 48 đơn vị, tức là đẩy căn nhà
#    LÊN CAO hơn trong banner, thoát khỏi chỗ khung tìm kiếm.
NET_CU_1 = '<path d="M80 0L83 5L85.8 10L88.3 15L90.5 20L92.2 25L93.4 30L94 35L94.1 40L93.8 45L93 50L91.9 55L90.6 60L89.2 65L87.7 70L86.2 75L84.8 80L83.5 85L82.3 90L81.1 95L80 100" fill="none" stroke="#fff" stroke-width="3" vector-effect="non-scaling-stroke"/>'
NET_MOI_1 = '<path d="M80.00 0C80.50 0.83 82.03 3.33 83.00 5C83.97 6.67 84.92 8.33 85.80 10C86.68 11.67 87.52 13.33 88.30 15C89.08 16.67 89.85 18.33 90.50 20C91.15 21.67 91.72 23.33 92.20 25C92.68 26.67 93.10 28.33 93.40 30C93.70 31.67 93.88 33.33 94.00 35C94.12 36.67 94.13 38.33 94.10 40C94.07 41.67 93.98 43.33 93.80 45C93.62 46.67 93.32 48.33 93.00 50C92.68 51.67 92.30 53.33 91.90 55C91.50 56.67 91.05 58.33 90.60 60C90.15 61.67 89.68 63.33 89.20 65C88.72 66.67 88.20 68.33 87.70 70C87.20 71.67 86.68 73.33 86.20 75C85.72 76.67 85.25 78.33 84.80 80C84.35 81.67 83.92 83.33 83.50 85C83.08 86.67 82.70 88.33 82.30 90C81.90 91.67 81.48 93.33 81.10 95C80.72 96.67 80.18 99.17 80.00 100" fill="none" stroke="#fff" stroke-width="3" vector-effect="non-scaling-stroke"/>'

NET_CU_12 = '<path d="M12 0L8.4 10L5.4 20L3 30L1.3 40L.3 50L1.3 60L3 70L5.4 80L8.4 90L12 100" fill="none" stroke="#5eead4" stroke-width="2.5" vector-effect="non-scaling-stroke"/>'
NET_MOI_12 = '<path d="M12.00 0C11.41 1.67 9.58 6.67 8.49 10.00C7.40 13.33 6.38 16.67 5.47 20.00C4.55 23.33 3.71 26.67 3.00 30.00C2.29 33.33 1.64 36.67 1.19 40.00C0.74 43.33 0.30 46.67 0.30 50.00C0.30 53.33 0.74 56.67 1.19 60.00C1.64 63.33 2.29 66.67 3.00 70.00C3.71 73.33 4.55 76.67 5.47 80.00C6.38 83.33 7.40 86.67 8.49 90.00C9.58 93.33 11.41 98.33 12.00 100.00" fill="none" stroke="#5eead4" stroke-width="2.5" vector-effect="non-scaling-stroke"/>'

NEN_MAU7_CU = '<div class="bb-circle bb-big" data-at="200" data-once style="--f:6s"><i class="bgimg" style="background-image:url(\'https://images.unsplash.com/photo-1580698872460-261e00561f35?w=1200&q=75&auto=format&fit=crop\')"></i></div>'
NEN_MAU7_MOI = '<div class="bb-circle bb-big" data-at="200" data-once style="--f:6s"><i class="bgimg" style="background-image:url(\'/banner11/m7-troi.webp\')"></i></div>\n    <img class="c7-maybay" src="/banner11/m7-maybay.webp" alt="" aria-hidden="true">'

# Mẫu 19, lớp "ảnh thật": bản gốc dùng ảnh đồng lúa mua ở kho ảnh — chẳng liên
# quan gì tới vùng đất của bản đồ quy hoạch bên cạnh, chủ dự án nhìn phát ra
# ngay "không khớp". Nay là ẢNH VỆ TINH ĐÚNG VÙNG ĐÓ, do
# scripts/banner11/dung-anh-mau19.py dựng cùng lượt với bản đồ và ranh thửa.
ANH_THAT_MAU19_CU = '<image href="https://images.pexels.com/photos/35995788/pexels-photo-35995788.jpeg?auto=compress&cs=tinysrgb&w=2000" width="1000" height="750" preserveAspectRatio="none"/>'
ANH_THAT_MAU19_MOI = '<image href="/banner11/m19-vetinh.webp" x="0" y="40" width="1000" height="323" preserveAspectRatio="none"/>'

# ── MẪU 10: GIỮ NGUYÊN BẢN THIẾT KẾ (ảnh flycam + ranh vẽ tay) ─────────────
# ⛔ ĐỪNG BẬT LẠI BẢN "BẢN ĐỒ QUY HOẠCH". Đã dựng xong, đưa lên xem, và CHỦ DỰ
#    ÁN TỪ CHỐI HAI LẦN: lần đầu "cái này giữ như cũ", lần sau "lại đưa qua mẫu
#    này, tôi bảo giữ mẫu cũ mà". Mã dựng vẫn để lại đây và ở
#    scripts/banner11/dung-anh-mau10.py phòng khi sau này cần, nhưng KHÔNG được
#    tự ý thêm lại vào THAY_BIEU_THUC/SUA_CHU nếu chủ dự án chưa yêu cầu.
# ── (mô tả bản đã dựng, hiện KHÔNG dùng) ───────────────────────────────────
# Bản thiết kế vẽ ranh thửa BẰNG TAY lên một tấm ảnh flycam đồng lúa. Chủ dự án
# muốn "ảnh quy hoạch chứ không phải ảnh flycam", và "zoom nhỏ ảnh để thấy thửa
# đầy đủ hơn" (ảnh cũ phóng quá to nên thửa nào cũng bị mép banner cắt cụt).
# Nay cả khối SVG được dựng lại bằng scripts/banner11/dung-anh-mau10.py:
#   · nền là tile quy hoạch QĐ205 của chính web, phủ trên ảnh vệ tinh đã làm
#     nhạt như giấy in bản đồ;
#   · ranh thửa là RANH THẬT lấy từ bảng `dia_chinh`, và chỉ lấy những thửa nằm
#     TRỌN trong khung — đúng ý "thấy thửa đầy đủ";
#   · số tờ, số thửa, loại đất, diện tích, số mét cạnh đều là số thật.
# Script ghi sẵn kết quả ra `mau10-noidung.html` để chỗ này chỉ việc đọc — nhờ
# vậy dựng banner không cần mở database.
_F_MAU10 = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mau10-noidung.html')
SVG_MAU10 = io.open(_F_MAU10, encoding='utf-8').read().strip() if os.path.exists(_F_MAU10) else ''

# ── MẪU 4 "TỰA SƠN · HƯỚNG HẢI": thêm MÂY TRÔI ─────────────────────────────
# Bản thiết kế chỉ cho riêng phần TRỜI dịch qua dịch lại 10 điểm ảnh (lớp
# .dp-sky) — gọi là "cinemagraph" nhưng nhìn thật ra chỉ thấy ảnh hơi rung,
# không ai nhận ra là mây đang trôi. Chủ dự án muốn "mây di chuyển một cách
# hữu tình".
#
# Nên vẽ thêm mấy đám mây RIÊNG, thả trôi ngang trên nền trời:
#   · mỗi đám là 4–5 hình bầu dục chồng nhau cho ra dáng mây, làm nhoè đi
#     (feGaussianBlur) nên mép mây mềm như mây thật, không ra hình bầu dục;
#   · bốn đám ở bốn độ cao và bốn cỡ khác nhau, trôi với bốn tốc độ khác nhau
#     (đám ở xa nhỏ và chậm, đám gần to và nhanh hơn) → có chiều sâu;
#   · tốc độ 38–66 giây một vòng (đi hết bề ngang banner trong 19–33 giây). Lần đầu để 62–126 giây cho "thật", chủ dự án
#     xem xong bảo "chưa đủ để thấy" — banner chỉ hiện vài giây rồi chuyển mẫu,
#     mây nhích mấy chấm thì không ai nhận ra;
#   · mỗi đám còn bồng bềnh lên xuống rất nhẹ, lệch nhịp nhau.
#
# ⚠️ PHẢI CẮT THEO #skyClip. Không cắt thì mây trôi đè cả lên dãy núi và lên
#    chữ CAM LÂM — hỏng hẳn ý "chữ nằm sau núi".
# ⚠️ ĐẶT TRƯỚC nhóm .dp-text trong mã, tức mây nằm DƯỚI chữ.
def _may(rx, ry, ds):
    """Một đám mây = mấy hình bầu dục chồng nhau."""
    return ''.join('<ellipse cx="%d" cy="%d" rx="%d" ry="%d"/>' % (x, y, rx * a, ry * b)
                   for x, y, a, b in ds)


# ⚠️ MÂY PHẢI MỎNG. Lần đầu vẽ dày, chủ dự án bảo "phần mây đang hơi dày, bạn
#    giảm bớt" — mây dày đè lên cả dãy núi phía sau, nhìn như vệt sơn trắng.
#    Nay bề dày (bán kính đứng) chỉ còn chừng hai phần ba, và bớt một hình bầu
#    dục ở mỗi đám cho thưa ra.
_MAY_1 = _may(1, 1, [(0, 0, 80, 12), (-54, 4, 52, 9), (48, 5, 58, 8)])
_MAY_2 = _may(1, 1, [(0, 0, 64, 10), (-42, 3, 40, 7), (40, 3, 44, 6)])
_MAY_3 = _may(1, 1, [(0, 0, 98, 14), (-66, 5, 62, 10), (60, 5, 68, 9)])
_MAY_4 = _may(1, 1, [(0, 0, 48, 8), (-31, 3, 30, 6), (29, 3, 32, 5)])

MAY_MAU4 = (
    '<g class="dp-may" clip-path="url(#skyClip)" filter="url(#dpMayMo)" aria-hidden="true">'
    '<g class="may m1" style="--y:34px;--s:1;--d:44s;--k:.05"><g class="bong">' + _MAY_1 + '</g></g>'
    '<g class="may m2" style="--y:58px;--s:.72;--d:54s;--k:.46"><g class="bong">' + _MAY_2 + '</g></g>'
    '<g class="may m3" style="--y:18px;--s:1.25;--d:66s;--k:.72"><g class="bong">' + _MAY_3 + '</g></g>'
    '<g class="may m4" style="--y:80px;--s:.6;--d:38s;--k:.28"><g class="bong">' + _MAY_4 + '</g></g>'
    '</g>')

MAY_LOC_MAU4 = ('<filter id="dpMayMo" x="-40%" y="-120%" width="180%" height="340%">'
                '<feGaussianBlur stdDeviation="6.5"/></filter>')

THAY_DOAN = {
    # Mẫu 1: mép cong của tấm ảnh — bản gốc vẽ bằng 21 đoạn thẳng nên nhìn ra
    # khớp nối. Đổi sang một đường cong Bézier thật, cùng hình dáng.
    1: [(NET_CU_1, NET_MOI_1)],
    # ── MẪU 10 ─────────────────────────────────────────────────────────────
    # Thẻ thông tin thửa: bản thiết kế để 240×104 ở góc trên phải (x 748, y 248
    # trong khung nhìn 1000×750). Trên web, chỗ đó đúng vào nút "Đăng tin" và
    # "Admin" của thanh menu → chữ chồng lên nhau. Thu nhỏ còn 186×80 và hạ
    # xuống dưới cho thoáng.
    10: [
        # ⚠️ DẢI NHÌN THẤY CỦA MẪU NÀY RẤT HẸP — tính ra mới biết, nhìn bản thiết
        #    kế không thấy: khung nhìn là 1000×750 nhưng cắt kiểu "slice" trên
        #    banner 1905×554 nên chỉ THẤY dải y ≈ 229…521, lại còn bị khung tìm
        #    kiếm che từ y ≈ 466 xuống. Tức mọi thứ phải nằm gọn trong y 240…460.
        #    Bản thiết kế đặt thẻ và mấy nhãn ở y 250, 510, 515 → rơi ra ngoài
        #    dải đó, cái thì chui sau thanh menu, cái thì nấp sau khung tìm kiếm.
        # Thẻ thông tin: thu nhỏ và đưa về y 300 (dưới dòng "REC · ALT", trên
        # khung tìm kiếm).
        ('<rect x="748" y="248" width="240" height="104" rx="14"',
         '<rect x="742" y="300" width="186" height="80" rx="11"'),
        ('<text x="766" y="281" fill="#fde68a" font-size="21"',
         '<text x="756" y="327" fill="#fde68a" font-size="16"'),
        ('<text x="766" y="310" fill="#e2e8f0" font-size="16">Đất trồng lúa (LUC)</text>',
         '<text x="756" y="349" fill="#e2e8f0" font-size="12.5">Đất trồng lúa (LUC)</text>'),
        ('<text x="766" y="336" fill="#e2e8f0" font-size="16">Diện tích ~600 m²</text>',
         '<text x="756" y="369" fill="#e2e8f0" font-size="12.5">Diện tích ~600 m²</text>'),
        # Ba nhãn số thửa: dời vào giữa ba thửa CÒN NHÌN THẤY được
        ('<text x="440" y="250">Thửa 126</text><text x="560" y="515">Thửa 134</text>'
         '<text x="900" y="510">Thửa 135</text>',
         '<text x="300" y="272">Thửa 126</text><text x="170" y="352">Thửa 134</text>'
         '<text x="872" y="268">Thửa 135</text>'),
        # ⚠️ NÉT ĐO "≈ 14 m" GIỮ NGUYÊN CHỖ CỦA BẢN THIẾT KẾ (cạnh dưới bên phải
        #    của thửa được tô sáng). Đã có lần dời nó lên cạnh trên cho khỏi bị
        #    khung tìm kiếm che bớt, nhưng chủ dự án khoanh đỏ đúng chỗ cũ và
        #    dặn để lại như cũ. Đừng dời nữa.
    ],
    # ── MẪU 7: CHIẾC MÁY BAY THẬT TRONG ẢNH PHẢI BAY ĐƯỢC ───────────────────
    # Chủ dự án chỉ thẳng vào chiếc máy bay trong ảnh: "vẫn chưa làm cho nó bay".
    # Chiếc máy bay vector nhỏ vẫn chạy vòng quanh viền nét đứt (đó là thứ khác,
    # chủ dự án cũng muốn giữ) — nhưng chiếc máy bay THẬT thì phải bay vượt ra
    # khỏi khung tròn, giống hiệu ứng "chủ thể vượt khung".
    # Cách làm: scripts/banner11/tach-may-bay-mau7.py tách chiếc máy bay ra thành
    # ảnh nền trong suốt (m7-maybay.webp) VÀ dựng lại tấm ảnh nền đã xoá máy bay
    # (m7-troi.webp). Không xoá thì lúc máy bay cắt rời bay lên sẽ lòi ra chiếc
    # máy bay gốc nằm im → thành hai chiếc.
    # Chỗ đặt (1356, 285) trong khổ thiết kế là tính ra chứ không ướm mắt:
    #   ảnh 1200×1767 đặt kiểu cover vào ô tròn 510×510 ⇒ tỉ lệ 0,425;
    #   background-position: center 30% ⇒ lệch dọc −72,3;
    #   máy bay trong ảnh ở (567, 712) ⇒ trong ô tròn là (241,0 ; 230,3);
    #   ô tròn đặt ở (1115, 55) ⇒ cộng lại ra (1356 ; 285).
    4: [('<linearGradient id="dpG"', MAY_LOC_MAU4 + '<linearGradient id="dpG"'),
        ('<g class="dp-text" data-at="500"', MAY_MAU4 + '<g class="dp-text" data-at="500"')],
    7: [(NEN_MAU7_CU, NEN_MAU7_MOI)],
    9: [(BAN_DO_VE_TAY, BAN_DO_THAT)],
    # ⚠️ Đổi khung nhìn thì PHẢI kéo ảnh cao theo. Ảnh đặt bằng height="750",
    #    mà khung nhìn mới chạy tới y=792 → phần 750–792 là khoảng TRỐNG, banner
    #    hở một dải ở đáy. Nên đổi luôn height thành 820.
    15: [('viewBox="250 524 700 226"', 'viewBox="250 566 700 226"'),
         # Lô đất dời lên khoảng cỏ trống ở giữa ảnh (chủ dự án khoanh đỏ) và to
         # hơn bản gốc. Bốn góc lấy THẲNG từ ve-nha-mau15.py (biến LO15 ở đầu
         # file) nên không bao giờ lệch với căn nhà nữa.
         ('d="M601.8 745.9L651 723.6L621.7 699.4L572.5 721.6Z"', LO15),
         ('width="1000" height="750" preserveAspectRatio="none"',
          'width="1000" height="820" preserveAspectRatio="none"'),
         ('Nhà 1 trệt, mái thái', 'Nhà 3 tầng · có sân vườn'),
         ('Phác thảo ngôi nhà trên lô đất trống cạnh đầm nuôi',
          'Phác thảo căn nhà 3 tầng có sân vườn trên lô đất trống')],
    18: [
    # ── KHUNG ẢNH ĐỔI THÀNH KHUNG ĐỨNG ─────────────────────────────────────
    # Bản thiết kế để khung NẰM NGANG (700×470). Toà nhà trong ảnh lại cao và
    # thon (cao gấp đôi bề ngang) nên khung ngang chỉ lọt được một khúc thân
    # nhà — chủ dự án muốn "thấy từ nền đường lên đỉnh toà nhà".
    # Nay khung 443×325 đặt bên phải, mép trên hạ xuống y = 260.
    # Vì sao hạ thấp thế: KHÔNG cần nhét cả toà nhà vào trong khung — toà nhà
    # vẫn thấy trọn vẹn, chỉ là PHẦN TRÊN nằm ngoài khung. Cắt thấp thì phần nhô
    # ra tới 160 đơn vị (trước chỉ 33–59), hiệu ứng mới đã mắt.
    # ⚠️ Mép trên khung không được cao hơn ~y = 250: banner nằm dưới thanh menu,
    #    phần trên y ≈ 91 bị menu che, phải chừa đủ chỗ cho phần nhô ra.
    ('<rect x="1060" y="110" width="700" height="470" rx="48"/>',
     '<rect x="1230" y="260" width="443" height="325" rx="34"/>'
     '</clipPath><clipPath id="c18Tren"><rect x="1150" y="0" width="700" height="261"/></clipPath>'
     '<mask id="c18Toa" maskUnits="userSpaceOnUse" x="1330" y="85" width="230" height="215">'
     '<image href="/banner11/m18-matna.webp" x="1228.0" y="105.6" width="448.0" height="152.3"/></mask>'
     '<clipPath id="c18Bo">'),
    ('<rect x="1060" y="110" width="700" height="470" rx="48" fill="none"',
     '<rect x="1230" y="260" width="443" height="325" rx="34" fill="none"'),
    ('<rect class="r3" x="988" y="38" width="844" height="614" rx="120"',
     '<rect class="r3" x="1180" y="210" width="543" height="425" rx="70"'),
    ('<rect class="r2" x="1012" y="62" width="796" height="566" rx="96"',
     '<rect class="r2" x="1197" y="227" width="509" height="391" rx="58"'),
    ('<rect class="r1" x="1036" y="86" width="748" height="518" rx="72"',
     '<rect class="r1" x="1214" y="244" width="475" height="357" rx="46"'),
    # ⛔ Bỏ hẳn nhóm `c18-patch`: bản thiết kế chồng hai bản sao ảnh lệch nhau
    #    qua một mặt nạ bo tròn để tạo cảm giác "phố nhân đôi". Với tấm ảnh này
    #    nó hiện ra đúng một ô chữ nhật lệch hàng giữa thân toà nhà, nhìn như
    #    lỗi hiển thị (chủ dự án đã bắt lỗi).
        (_MAY_BAY, _TOA_NHA),
        (_A18_CU.format(t='736.9'), _A18_MOI.format(t='1228')),
        # (Hai bản sao ảnh của nhóm `c18-patch` đã bị xoá nên không còn gì để
        #  thay — xem THAY_BIEU_THUC[18].)
    ],
    19: [(ANH_THAT_MAU19_CU, ANH_THAT_MAU19_MOI),
         (ANH_GIA_BAN_DO, ANH_BAN_DO_THAT), (RANH_VE_TAY, RANH_THAT)],
    12: [
        ('scale="10"', 'scale="4"'),                       # gợn nhẹ hẳn đi
        # Mép lượn: bản gốc vẽ bằng 11 đoạn thẳng nên nhìn ra khớp nối. Đổi sang
        # một đường cong Bézier thật, cùng hình dáng nhưng liền mạch.
        (NET_CU_12, NET_MOI_12),
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
                # ⚠️ Lớp "static" (chế độ đứng yên) phải nằm trên CHÍNH THẺ BANNER,
                #    không nằm trên thẻ bọc ngoài. Lý do: thẻ bọc ngoài do React
                #    dựng, mỗi lần React vẽ lại là nó GHI ĐÈ toàn bộ class của thẻ
                #    đó — mọi lớp mình gắn thêm bằng mã chạy đều bay mất. Thẻ
                #    banner thì nằm trong phần HTML dựng thẳng, React không đụng.
                con = x[len('.static'):].strip()
                if con.startswith('.banner'):
                    con = con[len('.banner'):]
                ra.append('.cl-b11 .banner.static ' + con if con else '.cl-b11 .banner.static')
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

    can_tai, mau, so_mau = {}, [], []
    for so, html in enumerate(khoi, 1):
        if so in BO_MAU:
            print(f'  · bỏ mẫu {so} ({ten[so - 1]}) — trùng với mẫu khác')
            continue
        for mau_tim, doan in THAY_BIEU_THUC.get(so, []):
            if doan == '__SVG_MAU10__':
                if not SVG_MAU10:
                    raise SystemExit('Thiếu scripts/banner11/mau10-noidung.html — '
                                     'chạy: python scripts/banner11/dung-anh-mau10.py')
                doan = SVG_MAU10
            elif doan == '__MAT_NA_MOI__':
                doan = _MAT_NA_MOI
            elif doan == '__NHA15_MAT__':
                doan = NHA15_MAT
            elif doan == '__NHA15_NET__':
                doan = NHA15_NET
            html, n = re.subn(mau_tim, lambda _m: doan, html, flags=re.S)
            if not n:
                print(f'  ⚠ mẫu {so}: biểu thức "{mau_tim[:40]}" không khớp chỗ nào')
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
        so_mau.append(so)

    # ── Xếp lại theo THU_TU ──────────────────────────────────────────────────
    if THU_TU:
        if sorted(THU_TU) != sorted(so_mau):
            raise SystemExit('THU_TU phải liệt kê đúng %d mẫu đang giữ: %s'
                             % (len(so_mau), sorted(so_mau)))
        cho = {s: i for i, s in enumerate(so_mau)}
        mau = [mau[cho[s]] for s in THU_TU]
        print('  · xếp lại thứ tự: ' + ' → '.join(str(s) for s in THU_TU))

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
