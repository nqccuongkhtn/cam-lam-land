# -*- coding: utf-8 -*-
"""
TÁCH CĂN BIỆT THỰ THẬT RA KHỎI ẢNH — MẪU BANNER 15
===================================================
Chủ dự án muốn mẫu 15 ("Hình dung ngôi nhà trên đất của bạn") đặt **ảnh thật**
của một căn biệt thự tân cổ điển lên lô đất, thay cho hình vẽ.

Script này cắt căn biệt thự ra khỏi tấm ảnh phối cảnh (bỏ cây cối, bãi cỏ, nhà
hàng xóm, mặt đường) thành một ảnh nền trong suốt:

  apps/frontend/public/banner11/m15-bietthu.webp

CÁCH LÀM: cắt theo ĐƯỜNG RANH của khu đất (hàng rào + mép mái), không cắt kiểu
hình chữ nhật — xem biến RANH và ghi chú trong main().

⚠️ ĐỔI ẢNH thì phải chỉnh lại KHUNG bên dưới và chạy lại script.

Chạy:  python scripts/banner11/tach-biet-thu-mau15.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')
ANH = os.path.join(RA, 'h3-villa-tan-co-dien.webp')





# ĐƯỜNG RANH KHU ĐẤT — dò trên ảnh gốc 800×615 bằng cách phóng to từng góc
# rồi kẻ lưới 20–25 điểm ảnh để đọc toạ độ (xem lại bằng scripts ở thư mục tạm).
#
# Đi theo đúng những thứ CÓ THẬT trên ảnh, không cắt bừa:
#   · mái nhà để xe    (22,325) → (127,272) → (222,356)
#   · bãi cỏ sau nhà xe, cắt ngay dưới hàng cây  (245,330) → (340,296)
#   · bóng đứng của căn biệt thự, bám sát mép tường và mái
#   · mép tường rào phía phải, dừng ở TRỤ CỔNG (x ≈ 640) — bên kia trụ là
#     cổng và tường của nhà HÀNG XÓM, lấy sang là thành nhà người ta
#   · chân tường rào mặt trước, chừa thêm ~20 điểm ảnh vỉa hè
#   · chân tường rào bên trái, chừa thêm ~12 điểm ảnh
#
# ⚠️ CỐ Ý BỎ RA NGOÀI, đừng thêm lại:
#   · rặng cây + cột điện góc trên trái (ngoài đất, nhìn như vệt xanh đen);
#   · căn nhà hàng xóm và cổng của họ bên phải;
#   · LÒNG ĐƯỜNG nhựa, kèm theo đó là chiếc ô tô và cô gái đạp xe. Trước đây
#     cắt cả lòng đường nên trên banner có một chiếc ô tô cụt nửa và một người
#     đạp xe lơ lửng giữa bãi cỏ — chính chỗ này chủ dự án bảo "cắt chưa chuẩn".
#     Vẫn còn dải vỉa hè trước nhà nên vẫn thấy "có đường trước nhà".
#
# ⚠️ Viền cắt rơi vào ĐÂU MỚI QUAN TRỌNG: hai mép trái và mép sau cố tình cắt
#    giữa BÃI CỎ, vì nền banner cũng là bãi cỏ nên chỗ nối không nhìn ra.
RANH = [
    # ── mái nhà để xe ──
    (20, 332), (60, 300), (127, 272), (175, 315), (222, 356),
    # ── bãi cỏ sau nhà xe, dưới hàng cây ──
    (245, 330), (300, 305), (344, 296),
    # ── bóng đứng căn biệt thự: tường trái → mái ──
    # ⚠️ BÁM SÁT MÉP TƯỜNG. Lần trước đặt lệch ra ngoài ~12 điểm ảnh nên dính
    #    một dải cây xanh đen chạy dọc sườn trái nhà — nhìn như vệt bẩn.
    (350, 250), (354, 200), (356, 150), (363, 118), (387, 85),
    (500, 84), (615, 91),
    # ── sườn phải: DỪNG Ở MÉP NHÀ (x ≈ 632). Bên kia là ống khói, tường và
    #    cửa sổ của nhà HÀNG XÓM — lần trước lấn sang nên banner có một mảnh
    #    nhà lạ dính bên phải.
    (634, 125), (635, 170), (633, 205), (630, 262), (630, 305),
    (634, 360), (640, 420),
    # ── RA TỚI MÉP ĐƯỜNG: lấy trọn vỉa hè, dải cỏ và viên bó vỉa ───────────
    # ⚠️ Cắt sát chân tường thì mất hết vỉa hè lẫn mặt đường — chủ dự án xem
    #    xong bảo "cắt thiếu hàng rào sân vườn và đường". Nay đi theo VIÊN BÓ
    #    VỈA (mép đường), nên nhìn ra ngay là căn nhà có đường chạy trước mặt.
    # ⚠️ Vẫn dừng ở x ≈ 642: bên phải đó có cô gái đạp xe ngồi ngay mép đường,
    #    lấy sang là banner có người đạp xe lơ lửng giữa bãi cỏ.
    #    Lòng đường nhựa (cùng chiếc ô tô trên đó) nằm DƯỚI đường cắt này.
    (642, 492), (540, 530), (415, 587), (350, 615), (190, 615), (168, 592),
    # ── chân tường rào bên trái (chừa ~12 điểm ảnh) ──
    (150, 565), (118, 513), (95, 486), (63, 448), (25, 408), (-10, 370),
    (-10, 340),
]
MEM = 4.0            # độ mềm của viền cắt (điểm ảnh) — nhỏ hơn trước để mép
                     # tường rào còn sắc, không bị nhoè thành vệt trắng

# ── BA GÓC LÔ ĐẤT, đọc trên CHÍNH tấm ảnh gốc này (toạ độ 800×615) ──────────
# Dùng để vẽ nét phác thảo lô đất trong ve-nha-mau15.py cho KHỚP hàng rào thật.
# ⚠️ Ghi ở đây chứ không ghi bên kia, vì hai bên phải cùng đọc một tấm ảnh.
#    Script này tự quy đổi sang toạ độ bản vẽ rồi ghi ra m15-khung.json —
#    bên kia chỉ việc đọc. Trước đây chép tay con số sang, đổi cách cắt ảnh
#    một cái là nét vẽ lệch khỏi hàng rào mà không ai biết.
# ── ĐƯỜNG HÀNG RÀO THẬT, đọc trên ảnh gốc (toạ độ 800×615) ─────────────────
# Đây là CHÂN TƯỜNG RÀO nhìn thấy trong ảnh: từ chỗ tường bên trái chạy ra khỏi
# khung, xuống góc gần người xem nhất, rồi vòng theo tường mặt trước sang phải.
#
# ⚠️ VÌ SAO PHẢI CÓ DANH SÁCH NÀY. Trước đây nét phác thảo lô đất vẽ bằng một
#    HÌNH BÌNH HÀNH suy ra từ ba góc. Nhưng lô đất nhìn chéo trong ảnh KHÔNG
#    phải hình bình hành phẳng: góc thứ tư nằm khuất sau căn nhà. Hệ quả là
#    cạnh xa của hình bình hành cắt ngang qua căn biệt thự — nhìn đúng như
#    "căn nhà bị cắt cụt ngủn" mà chủ dự án nhận xét.
#    Bám theo đúng chân tường thật thì nét không bao giờ đi qua nhà nữa.
VIEN_LO = [
    (0, 352), (25, 408), (63, 448), (95, 486), (118, 513), (150, 565),
    (178, 592),                     # góc tường gần người xem nhất
    (307, 552), (407, 495), (512, 457), (625, 417), (640, 420),
]

GOC_LO = {
    'truoc': (172, 585),   # góc tường rào gần người xem nhất (góc trái phía dưới)
    'phai':  (640, 420),   # góc phải, chỗ tường rào mặt trước gặp ranh bên phải
    'trai':  (0, 352),     # góc trái, chỗ tường rào bên trái chạy ra khỏi khung ảnh
}


def main():
    """Cắt khu đất theo đúng đường ranh, không cắt kiểu hình chữ nhật.

    ⚠️ ĐÃ ĐỔI CÁCH LÀM HAI LẦN:
       · lần 1 — mẹo "cây cỏ thì xanh lá": tách được riêng căn nhà nhưng XOÁ
         mất cả sân vườn, mà chủ dự án lại muốn có sân vườn;
       · lần 2 — cắt hình chữ nhật rồi làm mờ bốn mép: giữ được sân vườn nhưng
         lôi theo rặng cây, cột điện và căn nhà hàng xóm ở hai góc trên;
       · lần này — cắt theo ĐƯỜNG RANH khu đất (biến RANH ở trên), viền làm mềm
         để tấm ảnh chìm vào bãi cỏ của banner.
    """
    im = Image.open(ANH).convert('RGB')
    w, h = im.size

    mat_na = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mat_na).polygon(RANH, fill=255)
    mat_na = mat_na.filter(ImageFilter.GaussianBlur(MEM))

    out = Image.merge('RGBA', (*im.split(), mat_na))
    # cắt sát phần còn nhìn thấy cho file nhẹ
    khung = out.getbbox()
    out = out.crop(khung)
    p = os.path.join(RA, 'm15-bietthu.webp')
    out.save(p, 'WEBP', quality=90, method=6)
    print('Khung sau khi cat sat:', khung)

    # Ghi lại khung cắt + ba góc lô (đổi sang toạ độ TRONG ảnh đã cắt) để
    # ve-nha-mau15.py đặt nét phác thảo đúng chỗ.
    import json
    goc = {k: [v[0] - khung[0], v[1] - khung[1]] for k, v in GOC_LO.items()}
    vien = [[x - khung[0], y - khung[1]] for x, y in VIEN_LO]
    with open(os.path.join(RA, 'm15-khung.json'), 'w', encoding='utf-8') as f:
        json.dump({'rong': out.width, 'cao': out.height, 'goc': goc, 'vien': vien}, f,
                  ensure_ascii=False, indent=1)
    print('Ba goc lo trong anh da cat:', goc)
    print('OK %s  %d KB  %dx%d' % (os.path.basename(p), os.path.getsize(p) // 1024,
                                   out.width, out.height))
    print('TI LE ngang/doc = %.4f' % (out.width / out.height))

    thu = Image.new('RGB', out.size, (110, 150, 70))    # nền cỏ giống ảnh banner
    thu.paste(out, (0, 0), out)
    thu.save(os.path.join(RA, '_xem-m15-bietthu.png'))


if __name__ == '__main__':
    main()
