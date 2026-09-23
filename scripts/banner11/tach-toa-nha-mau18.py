# -*- coding: utf-8 -*-
"""
TÁCH TOÀ NHÀ CAO TẦNG RA KHỎI ẢNH — MẪU BANNER 18 "CHỦ THỂ VƯỢT KHUNG"
======================================================================
Mẫu 18 muốn một toà nhà cao tầng VƯƠN RA KHỎI khung ảnh — kiểu ảnh quảng cáo
hay thấy với toà Landmark 81. Chủ dự án nhận xét bản đang chạy "chưa thực sự
làm nổi bật được hiệu ứng", và dặn rõ: **không vẽ đồ hoạ, cắt từ ảnh toà nhà
thật**.

Hai việc script này lo:

1. **Cắt toà nhà ra thành ảnh nền trong suốt** (`m18-toanha.webp`).
   Trước đây chỗ này dùng một MẶT NẠ HÌNH CHỮ NHẬT đè lên ảnh — nghĩa là mảng
   trời đêm quanh toà nhà cũng bị lôi ra theo, thành một khối chữ nhật tối trên
   nền banner. Nay cắt theo đúng bóng toà nhà: trời đêm rất tối, toà nhà sáng
   đèn → chênh màu lớn, cắt ra rất sạch.

2. **In ra đúng toạ độ để dán vào bản thiết kế.** Ảnh cắt phải đặt KHÍT lên tấm
   ảnh trong khung, nếu lệch một chút là lộ ngay.

⚠️ ĐỔI ẢNH NỀN CỦA MẪU 18 THÌ PHẢI CHẠY LẠI SCRIPT NÀY và sửa lại KHUNG, vì
   toạ độ toà nhà là của riêng tấm ảnh hiện tại.

Chạy:  python scripts/banner11/tach-toa-nha-mau18.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

GOC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RA = os.path.join(GOC, 'apps', 'frontend', 'public', 'banner11')
ANH = os.path.join(RA, 'mia-goldcoast-800.webp')

# Khung dò: toà nhà kính nằm giữa, hai mép trái/phải chỉ có trời.
# ⚠️ Cắt ngang ở y=1050 vì xuống thấp hơn là núi (trái) và dãy nhà (phải) lấn
#    vào mép — hết trời để đo thì phép tách sai ngay. Chỗ cắt này vẫn nằm SÂU
#    DƯỚI mép trên khung ảnh nên không lộ đường cắt.
KHUNG = (110, 95, 700, 440)
MEP = 80
NGUONG_TRONG, NGUONG_DUC = 26.0, 62.0
LOC_XANH = True     # xem ghi chú ở bước lọc màu xanh trời bên dưới

# Cách đặt tấm ảnh trong bản thiết kế (phải khớp với THAY_DOAN[18] của
# tach-banner.py): ảnh 800×1200 vẽ vào ô 1000×1500 rồi translate(tx ty) scale(s)
TX, TY, S = 1228.0, 30.6, 0.448


def main():
    im = Image.open(ANH).convert('RGB')
    patch = np.asarray(im.crop(KHUNG), dtype=np.float32)
    h, w, _ = patch.shape

    # ── Dựng "bản đồ màu trời" ───────────────────────────────────────────────
    # ⚠️ Cách cũ (mỗi hàng nội suy thẳng từ mép trái sang mép phải) chỉ đúng khi
    #    trời chuyển màu theo CHIỀU NGANG. Trời trong ảnh mới chuyển màu theo
    #    đường chéo (góc trên trái xanh đậm, góc dưới phải nhạt) nên nội suy
    #    thẳng sai tới 30–40 đơn vị → mảng trời bị tính nhầm thành toà nhà, cắt
    #    ra dính cả một vầng trời quanh nhà.
    #    Nay khớp một mặt cong bậc hai theo cả x và y, chỉ dùng điểm ở HAI MÉP và
    #    DẢI TRÊN CÙNG (những chỗ chắc chắn là trời) để khớp.
    ys_, xs_ = np.mgrid[0:h, 0:w].astype(np.float32)
    xn, yn = xs_ / w, ys_ / h
    A_full = np.stack([np.ones_like(xn), xn, yn, xn * xn, xn * yn, yn * yn], axis=-1)
    chac_troi = np.zeros((h, w), dtype=bool)
    # ⚠️ Chỉ coi hai mép là trời ở PHẦN TRÊN. Xuống thấp là có nhà bên cạnh lấn
    #    vào mép, lấy cả vào thì mặt cong khớp sai, cắt hỏng ngay.
    cao_troi = int(h * 0.55)
    chac_troi[:cao_troi, :MEP] = True
    chac_troi[:cao_troi, -MEP:] = True
    chac_troi[:max(6, h // 14), :] = True
    A = A_full[chac_troi]                      # (n, 6)
    troi = np.empty_like(patch)
    for c in range(3):
        he_so, *_ = np.linalg.lstsq(A, patch[:, :, c][chac_troi], rcond=None)
        troi[:, :, c] = A_full @ he_so

    lech = np.sqrt(((patch - troi) ** 2).sum(axis=2))
    a = np.clip((lech - NGUONG_TRONG) / (NGUONG_DUC - NGUONG_TRONG), 0.0, 1.0)

    # ── Chốt chặn thứ hai: LOẠI MÀU XANH TRỜI ────────────────────────────────
    # Chỉ so với "bản đồ màu trời" là chưa đủ: ở góc trên bên phải, trời nhạt
    # gần bằng màu tường toà nhà nên máy không tách được, cắt ra dính một vầng
    # trời quanh nhà (đã nhìn thấy tận mắt).
    # Nhưng có một thứ phân biệt rất chắc: TRỜI THÌ XANH, tức kênh Lam cao hơn
    # kênh Đỏ nhiều; còn tường nhà gần như trung tính (Đỏ ≈ Lam).
    #   · trời đậm:  Đỏ − Lam ≈ −65     · trời nhạt: Đỏ − Lam ≈ −55
    #   · tường sáng: Đỏ − Lam ≈ −5     · tường khuất: ≈ −10
    # Nhân thêm hệ số này thì mọi mảng còn ra màu trời đều bị xoá sạch.
    # ⚠️ Chỉ dùng được khi chủ thể KHÔNG phải kính xanh. Toà nhà kính xanh thì
    #    tắt chốt này đi (đặt LOC_XANH = False), nếu không cắt mất cả mặt kính.
    if LOC_XANH:
        do_tru_lam = patch[:, :, 0] - patch[:, :, 2]
        a = a * np.clip((do_tru_lam + 35.0) / 20.0, 0.0, 1.0)

    # giữ mảng liền lớn nhất — bỏ mấy vệt mây sáng và ngôi sao lẻ
    dac = a > 0.55
    nhan = np.zeros(dac.shape, dtype=np.int32)
    so, tot, to_nhat = 0, None, 0
    for y in range(h):
        for x in range(w):
            if dac[y, x] and nhan[y, x] == 0:
                so += 1
                ngan, dem = [(y, x)], 0
                nhan[y, x] = so
                while ngan:
                    cy, cx = ngan.pop()
                    dem += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and dac[ny, nx] and nhan[ny, nx] == 0:
                            nhan[ny, nx] = so
                            ngan.append((ny, nx))
                if dem > to_nhat:
                    to_nhat, tot = dem, so
    print('Mang lien lon nhat: %d diem anh' % to_nhat)

    giu = Image.fromarray(((nhan == tot) * 255).astype(np.uint8))
    giu = giu.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.0))
    a = a * (np.asarray(giu, dtype=np.float32) / 255.0)

    # Mép DƯỚI phải đặc hoàn toàn: toà nhà còn tiếp tục xuống dưới, cắt mềm ở đó
    # là lộ ra một vệt mờ ngay chỗ nối với phần ảnh trong khung.
    a[-6:, :] = np.maximum(a[-6:, :], a[-7:-6, :])

    ys, xs = np.nonzero(a > 0.06)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    u0, v0 = KHUNG[0] + x0, KHUNG[1] + y0
    u1, v1 = KHUNG[0] + x1, KHUNG[1] + y1
    print('Toa nha trong anh goc: (%d,%d)-(%d,%d)  %dx%d' % (u0, v0, u1, v1, x1 - x0, y1 - y0))

    rgb = patch[y0:y1, x0:x1].astype(np.uint8)
    alp = (a[y0:y1, x0:x1] * 255).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb, alp]), 'RGBA')
    out = out.resize((out.width * 2, out.height * 2), Image.LANCZOS)
    p = os.path.join(RA, 'm18-toanha.webp')
    out.save(p, 'WEBP', quality=92, method=6)
    print('OK %s  %d KB  %dx%d' % (os.path.basename(p), os.path.getsize(p) // 1024,
                                   out.width, out.height))

    # ── Toạ độ để dán vào bản thiết kế ───────────────────────────────────────
    k2 = S * 1000.0 / 800.0   # ảnh 800 điểm ảnh ngang vẽ vào ô rộng 1000
    X, Y = TX + k2 * u0, TY + k2 * v0
    W, H = k2 * (u1 - u0), k2 * (v1 - v0)
    print('')
    print('== DAN VAO tach-banner.py ==')
    print('<image href="/banner11/m18-toanha.webp" x="%.1f" y="%.1f" width="%.1f" height="%.1f"/>'
          % (X, Y, W, H))
    print('Dinh toa nha o y=%.1f (mep tren khung anh la y=260) => nho ra %.0f don vi'
          % (Y, 260 - Y))

    thu = Image.new('RGB', out.size, (11, 36, 71))
    thu.paste(out, (0, 0), out)
    thu.save(os.path.join(RA, '_xem-m18-toanha.png'))


if __name__ == '__main__':
    main()
