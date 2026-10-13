# Dựng lớp QUY HOẠCH SỬ DỤNG ĐẤT 2030 cho cả tỉnh từ PDF chính thức của Sở

Bộ công cụ biến **bản đồ QHSDĐ 2030 dạng PDF** (Sở Nông nghiệp & Môi trường Khánh Hòa công bố)
thành **lớp tile ảnh** chồng lên bản đồ web — y như cách Cam Lâm làm, nhưng nguồn là PDF thay vì CAD.
Làm 13/10/2026.

## Vì sao làm được chính xác
Các bản PDF này là **bản vẽ NÉT VECTOR** (không phải ảnh scan), có **lưới km VN-2000 in sẵn** và
**bảng chú giải màu**. Nên tách được vùng loại đất + nắn toạ độ theo đúng lưới → sai số ~vài mét.

## Quy trình (mỗi bản chạy 4 bước)
```bash
# Máy cần: Python 3 + pymupdf + pyproj + opencv-python + numpy + shapely
#   pip install pymupdf pyproj opencv-python numpy shapely
# Chạy với python -P (chặn nạp nhầm module cạnh file PDF); PDF là dữ liệu, truyền qua tham số.

cd scripts/qh-tinh
TAM_LNG=109.18; TAM_LAT=12.245     # toạ độ gần đúng giữa khu vực (chỉ để chọn "hàng trăm km")

# 1) KIỂM NẮN TOẠ ĐỘ (phải ra R2≈1,0 và toạ độ góc đúng vị trí thật)
python -P nan2.py  ban-do.pdf  $TAM_LNG $TAM_LAT

# 2) TÁCH RANH (lấy vùng màu lớn nhất = thân bản đồ, tự bỏ chú giải/sơ đồ/chữ ký ở góc)
python -P ranh_tu_pdf.py  ban-do.pdf  $TAM_LNG $TAM_LAT  ra/ranh.json  ra/ranh-viz.png
#   → MỞ ranh-viz.png xem đường đỏ có ôm đúng khu vực không.

# 3) ẢNH THỬ chồng vệ tinh (xác nhận khớp vị trí thật TRƯỚC khi cắt đủ)
python -P proof.py  ban-do.pdf  $TAM_LNG $TAM_LAT  <lng0> <lat0> <lng1> <lat1>  14  ra/thu.png

# 4) CẮT TILE (z9–16, cắt gọn theo ranh, nền trong suốt, khớp AFFINE mỗi ô)
python -P tiler2.py  ban-do.pdf  $TAM_LNG $TAM_LAT  ra/ranh.json  ra/tiles  tenlopv1  9 16  1.8
#   (số cuối = độ nét ảnh nguồn; 1.8 cho bản ~1:25.000)
```

## Đưa lên web
1. Chép thư mục tile vào volume `camlamgis_camlam_tiles`:
   ```bash
   docker create --name t -v camlamgis_camlam_tiles:/dest camlamgis-frontend:latest true
   docker cp ra/tiles/tenlopv1 t:/dest/ ; docker rm t
   ```
2. Thêm lớp trong `apps/frontend/src/app/map/page.tsx` (4 chỗ, xem lớp `qh-ninhhoa2030` làm mẫu):
   `RASTER_OVERLAYS` (tiles+coordinates) · `MUC_QH` (menu) · `CAN_CU_QH` (căn cứ) · `ovOn` (mặc định tắt).
3. Dựng lại + xoá đệm:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.tunnel.yml up -d --no-deps --build frontend
   docker compose ... restart nginx
   docker exec camlam_nginx sh -c 'rm -rf /var/cache/nginx/[0-9a-f]'
   ```
   ⚠️ Đổi tile mà GIỮ tên thư mục cũ thì nginx/Cloudflare giữ ảnh cũ 1 năm → PHẢI tăng số (v1→v2).
   ⚠️ Trình duyệt là PWA: thử trên máy mình phải xoá Service Worker + cache mới thấy bản mới.

## Đã làm xong (lên web, kiểm trên trình duyệt)
| Khu vực | Tên lớp | Nguồn PDF (Sở) | Ghi chú |
|---|---|---|---|
| Thị xã Ninh Hòa | ninhhoa2030**v2** | `Portals/0/2b_ Ban do DCQHSD dat den nam 2030 Tx Ninh Hoa.pdf` | 1:25.000 |
| TP Nha Trang | nhatrang2030v1 | `Portals/0/2022/Dat-dai/NhaTrang2030.pdf` | 1:27.000 |
| Huyện Khánh Sơn | khanhson2030v1 | `Portals/0/2022/Dat-dai/KhanhSon2030.pdf` | 1:25.000 |
| Huyện Vạn Ninh | vanninh2030v1 | `Portals/0/DCQH2030 VAN NINH.pdf` | 1:25.000 |

(Cam Lâm đã có sẵn QĐ205/893 + phân khu dựng từ CAD — không làm lại.)

## CÒN VƯỚNG — 3 bản "nhãn lưới vẽ thành nét, không đọc được chữ"
**Cam Ranh, Diên Khánh, Khánh Vĩnh** — `nan2.py` không nắn được vì:
- Diên Khánh: toàn bộ chữ vẽ thành đường path (`get_text` ra 0 chữ).
- Cam Ranh: chỉ còn vài nhãn là chữ, số bắc in XOAY DỌC.
- Khánh Vĩnh: lẫn nhãn đường bình độ (1100/1200) + có ảnh JPEG nhúng.
→ Cần nắn kiểu khác: **(a)** OCR nhãn lưới có xử lý xoay (tesseract có trong container backend, có `vie`),
hoặc **(b)** nắn tay bằng QGIS (georeferencer, chọn điểm mốc trên lưới), hoặc **(c)** khớp hình thị xã
trên bản đồ với ranh hành chính thật. PDF đã tải ở `scratchpad .../nguon/them/`.

**ĐÃ THỬ TỰ ĐỘNG CHO CAM RANH (đều hỏng, ghi lại để khỏi thử lại):**
- OCR dải nhãn: nét quá mảnh + lẫn chữ "SƠ ĐỒ VỊ TRÍ…" của ô sơ đồ góc → đọc ra "40/860/900" thay vì "84.0/86.0/88.0".
- Dò đường lưới cyan (`nan_luoi.py`): **NƯỚC BIỂN cũng màu cyan** như lưới → lẫn, ra 200 pt/km (sai, phải ~114,5).
- **Số lưới Cam Ranh đọc bằng mắt (giúp nắn tay QGIS):** tỉ lệ **1:25.000** (~114,5 pt/km);
  ĐÔNG (mép trên): `582.0 · 584.0 · 586.0 · 588.0 …` bước 2 km; BẮC (mép trái): `1330.0 …` bước 2 km.
  Đường lưới dọc 582 km nằm quanh PDF x≈500 pt; đường ngang 1330 km quanh PDF y≈466 pt (ước lượng).
  → Mở PDF trong QGIS, chọn 3–4 giao điểm lưới làm điểm mốc (vd (582000,1330000)…) là nắn xong.
- `nan_luoi.py` dùng được khi dò được đúng đường lưới (không lẫn nước) — cần lọc nét mảnh/dài trước.

## Ninh Thuận cũ (nay thuộc Khánh Hòa) + cấp tỉnh
Tên miền `ninhthuan.gov.vn` đã ngừng sau sáp nhập 1/7/2025, cổng Khánh Hòa chưa chuyển dữ liệu về.
Bản đồ QHSDĐ cấp tỉnh không đăng PDF công khai (nằm trong phụ lục hồ sơ QH tỉnh). → Chờ nguồn.

## Nắn toạ độ — chi tiết kỹ thuật
- `vn2000.py` = bản chuyển Python của `apps/backend/src/lib/vn2000.ts` (VN-2000 Khánh Hòa, KTT 108°15',
  k=0.9999, Helmert 7 tham số) → lớp mới khớp 100% lớp Cam Lâm + địa chính. ĐỪNG sửa hằng số.
- `nan2.py` tự nhận 3 kiểu ghi nhãn lưới: viết tắt 2 số (Ninh Hòa, Khánh Sơn), đủ mét tách "595 000"
  (Nha Trang), km 3-4 số kèm .0/.5. Mỗi "đường" nhãn tự khớp riêng, chỉ nhận đường khớp tốt
  (R²>0,995, 80<pt/km<320) → loại nhãn rải trong thân bản đồ.
- `tiler2.py`: render PDF 1 lần, mỗi ô tile KHỚP AFFINE từ lưới 4×4 điểm rồi áp cả ô. ⚠️ KHÔNG dùng
  `cv2.resize` lưới thô để phóng bản đồ toạ độ — nó kẹp mép làm **nhoè một dải** giữa bản đồ (đã vấp).
