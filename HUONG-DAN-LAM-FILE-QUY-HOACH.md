# Hướng dẫn làm file bản đồ quy hoạch CHUẨN (căn đúng, phủ màu kín, không "thủng")

## A. Vì sao bản hiện tại bị "thủng" (lòi ảnh vệ tinh ở khu dân cư)

Đã kiểm chứng: ảnh gốc `QD205.png` **và** tile đều để khu dân cư hiện hữu **trong suốt**
(không gán màu quy hoạch). Khi chồng lên nền vệ tinh thì chỗ trong suốt lòi vệ tinh ra.
Đây **không phải lỗi file hỏng** — đó là dữ liệu gốc thiếu màu ở vùng đó.

➡ Muốn hết "thủng": **file nguồn phải TÔ MÀU KÍN mọi khu** (kể cả đất ở hiện hữu),
và phải được **nắn đúng toạ độ** rồi cắt tile bằng công cụ GIS (không nắn tay được — tôi đã
thử tự cắt, sai lệch tới 80% vì thiếu thông tin toạ độ chuẩn trong ảnh).

---

## B. Chuẩn bị NGUỒN dữ liệu (chọn 1 trong 2)

**Cách 1 — Vector (TỐT NHẤT): shapefile `.shp` hoặc GeoJSON** bản đồ quy hoạch sử dụng đất,
có cột thuộc tính "loại đất".
- Xin từ Phòng/Sở TN&MT, hoặc tải từ cổng công khai quy hoạch của tỉnh.
- Ưu điểm: nét ở mọi zoom, tô màu theo loại đất, **phủ kín**, toạ độ chuẩn sẵn.

**Cách 2 — Ảnh quy hoạch màu (scan/ảnh):**
- Nếu ảnh còn vùng trắng/không màu (đất ở hiện hữu) mà bạn muốn hết thủng → **tô thêm màu**
  cho kín (vd Photoshop/GIMP tô vàng nhạt cho đất ở) trước khi nắn.

---

## C. Cài công cụ: QGIS (miễn phí)

Tải bản mới tại **qgis.org** → cài. (QGIS kèm sẵn GDAL để nắn toạ độ + cắt tile.)

---

## D. NẮN TOẠ ĐỘ ảnh (Georeference) — chỉ làm nếu nguồn là ẢNH

1. Mở QGIS. Thêm nền đối chiếu: bảng **Browser → XYZ Tiles → OpenStreetMap** (kéo vào).
2. Menu **Raster → Georeferencer**.
3. Bấm **Open Raster** → chọn ảnh quy hoạch.
4. **Add Point**: bấm 1 điểm rõ trên ảnh (ngã tư, góc hồ…) → chọn **From Map Canvas** →
   bấm đúng điểm đó trên bản đồ nền. Làm **≥ 6–10 điểm** rải đều (4 góc + giữa).
5. **Transformation settings**:
   - Transformation type: **Thin Plate Spline** (khớp ảnh lệch/cong tốt) hoặc Polynomial 2
   - Target CRS: **EPSG:4326**
   - Output raster: đặt tên `quyhoach_georef.tif`
   - Resampling: **Cubic**
6. Bấm **Start Georeferencing** → ra file `.tif` đã đúng toạ độ.

> Nếu nguồn là **shapefile/GeoJSON**: kéo thẳng vào QGIS, vào **Properties → Symbology →
> Categorized**, chọn cột "loại đất", **Classify** để mỗi loại 1 màu. Bỏ qua bước nắn.

---

## E. CẮT TILE (XYZ PNG) — để web tải nhanh & Cloudflare cache biên

1. Menu **Processing → Toolbox** → gõ **"Generate XYZ tiles (Directory)"**.
2. **Input layer**: lớp `.tif` đã nắn (hoặc lớp vector đã tô màu).
3. **Minimum zoom = 10**, **Maximum zoom = 18** (nếu ảnh độ phân giải vừa thì 16 là đủ).
4. **Extent**: bấm **… → Use Layer Extent** (chọn vùng Cam Lâm).
5. **Tile format = PNG**.
6. **Output directory**: chọn 1 thư mục trống, đặt tên `qd205v4`.
7. Bấm **Run** → ra cấu trúc thư mục `{z}/{x}/{y}.png`.

> Dòng lệnh tương đương (nếu quen GDAL): `gdal2tiles.py -p mercator -z 10-18 -w none quyhoach_georef.tif qd205v4/`

---

## F. Đưa vào web

1. Copy thư mục vừa cắt vào: `apps\frontend\public\tiles\qd205v4`
2. Sửa **2 file**, đổi đường dẫn tile (và `maxzoom` = mức zoom lớn nhất đã cắt):
   - `apps\frontend\src\app\map\page.tsx` → biến `RASTER_OVERLAYS`
   - `apps\frontend\src\app\listings\page.tsx` → biến `QH`

   Đổi dòng:
   ```
   tiles: ['/tiles/qd205v3/{z}/{x}/{y}.png'], minzoom: 10, maxzoom: 17,
   ```
   thành (ví dụ cắt tới z18):
   ```
   tiles: ['/tiles/qd205v4/{z}/{x}/{y}.png'], minzoom: 10, maxzoom: 18,
   ```
3. Mở app Quản lý server → **Khởi động lại**.

*(Muốn mình sửa 2 dòng config này giúp sau khi bạn đã có thư mục `qd205v4` thì báo mình.)*

---

## G. Kiểm tra

- Zoom vào khu dân cư (chỗ trước bị thủng) — đã có màu kín chưa.
- Mở thử 1 file `.png` trong thư mục tile xem có màu (không trong suốt).

---

## Nguyên tắc để KHÔNG bị thủng nữa

1. **Nguồn phải phủ màu KÍN**. Vùng nào không có màu trong nguồn → sẽ trong suốt trên web.
2. Luôn cắt từ file đã **nắn toạ độ (GeoTIFF)** hoặc **vector có CRS** → tile mới căn đúng bản đồ.
3. Nếu **cố ý** để đất ở hiện hữu trong suốt (để thấy nhà thật dưới vệ tinh) thì đó là bình
   thường, không phải lỗi.
4. Đặt tên thư mục tile mới (`qd205v4`, `v5`…) mỗi lần cập nhật để không đè lên bản cũ và
   để trình duyệt/Cloudflare nhận bản mới.

---

## Phương án nhanh (nếu chưa có nguồn màu kín)

Nếu chưa kịp làm file chuẩn mà chỉ muốn **hết cảm giác "thủng"**: mình có thể thêm trong code
một **lớp nền sáng mờ** dưới lớp quy hoạch (vùng chưa có màu sẽ thành nền sáng dịu thay vì lòi
vệ tinh lởm chởm) — chỉ mất vài phút, không cần dữ liệu mới. Báo mình nếu muốn dùng tạm.
