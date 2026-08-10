# QGIS chi tiết — từ DXF → thửa GeoJSON → web

Dùng file DXF ở: `D:\hau\PHONGKINHTE\quyhoach2025\dxf_diachinh\` (đã có 38 tờ V7).
Làm mẫu với **dc51.dxf**, các tờ khác lặp lại y hệt.

---

## A. Mở DXF + gán hệ tọa độ (quan trọng nhất)

A1. Mở QGIS → **kéo `dc51.dxf` thả thẳng vào** khung bản đồ.
   (Hoặc menu **Layer ▸ Add Layer ▸ Add Vector Layer…** → nút `…` chọn dc51.dxf → **Add**.)
A2. Nếu hiện bảng "Select Vector Layers to Add" → tick **entities** → **OK**.
A3. Lớp `dc51 entities` hiện ra (gồm đường + điểm chữ). Có thể chưa đúng vị trí vì thiếu CRS — làm tiếp A4.

A4. **Tạo CRS VN2000 (chỉ làm 1 lần):** menu **Settings ▸ Custom Projections… ▸ nút `+`**
   - Name: `VN2000 CamLam 108-15`
   - Definition (dán nguyên dòng):
```
+proj=tmerc +lat_0=0 +lon_0=108.25 +k=0.9999 +x_0=500000 +y_0=0 +a=6378137 +rf=298.257222101 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs
```
   - **OK**.

A5. **Gán CRS cho lớp:** chuột phải lớp `dc51 entities` ▸ **Set CRS ▸ Set Layer CRS…** → ô tìm gõ `VN2000 CamLam` → chọn → **OK**.

A6. **Kiểm tra vị trí:** panel **Browser ▸ XYZ Tiles ▸ (Google Satellite / OpenStreetMap)** kéo vào làm nền (chưa có thì cài plugin **QuickMapServices**). Chuột phải lớp thửa ▸ **Zoom to Layer** — thửa phải nằm đúng Cam Đức, sát nền. Lệch nhiều = sai CRS, xem lại A4/A5.

---

## B. Tách RANH và SỐ THỬA thành 2 lớp sạch

B1. Chuột phải `dc51 entities` ▸ **Filter…** → nhập rồi **OK**:
```
"Layer" IN ('L10','L50','L23')
```
   → chỉ còn ranh thửa (đường).

B2. Chuột phải lớp ▸ **Export ▸ Save Features As…**
   - Format: **GeoPackage**
   - File name: `ranh.gpkg`
   - CRS: giữ **VN2000 CamLam 108-15**
   - **OK** → thêm lớp `ranh`.

B3. Lấy số thửa: chuột phải `dc51 entities` ▸ **Filter…** → đổi thành → **OK**:
```
"Layer" = 'L4'
```
B4. **Export ▸ Save Features As…** → `sothua.gpkg` (điểm; có trường **Text** = số thửa) → **OK**.
B5. Xóa filter lớp gốc: **Filter… ▸ Clear ▸ OK**.

---

## C. Đóng khe hở + tạo VÙNG thửa

C1. Mở **Processing Toolbox** (menu **Processing ▸ Toolbox**, hoặc Ctrl+Alt+T).
C2. Ô tìm gõ `v.clean` → mở **GRASS ▸ v.clean**:
   - Input vector layer: `ranh`
   - Cleaning tool(s): chọn `break`, thêm `snap`, thêm `rmdangle`
   - Threshold: `0.5` (mét). Còn hở nhiều → tăng `0.8`; dính thửa nhỏ → giảm `0.3`.
   - **Run** → lớp `Cleaned`.
C3. Ô tìm gõ `Polygonize` → **Vector geometry ▸ Polygonize**:
   - Input layer: `Cleaned`
   - **Run** → lớp `Polygons` = các thửa.

---

## D. Gán Số tờ / Số thửa / Xã vào từng thửa

D1. Ô tìm `Join attributes by location` → **Vector general ▸ Join attributes by location**:
   - Base layer: `Polygons`
   - Join layer: `sothua`
   - Geometric predicate: tick **contains**
   - Fields to add: tick `Text`
   - **Run** → lớp `Joined layer` (mỗi thửa có `Text` = số thửa).

D2. Chuột phải `Joined layer` ▸ **Open Attribute Table** → bật **Toggle Editing** (bút chì) → mở **Field Calculator** (biểu tượng bàn tính), tạo lần lượt:
   - `SoThua` (Text, 10) = `"Text"`
   - `SoTo`  (Text)      = `'51'`   ← số tờ theo tên file
   - `Xa`    (Text)      = `'Cam Đức'`
   - `Huyen` (Text)      = `'Cam Lâm'`
   - `Cap`   (Text)      = `'3'`
   - `DienTich` (Decimal)= `round($area, 1)`
   Xong tắt **Toggle Editing** → **Save**.

D3. Dọn rác: chuột phải lớp ▸ **Filter…**:
```
"SoThua" IS NOT NULL AND $area > 5 AND $area < 20000
```

---

## E. Xuất GeoJSON (WGS84) rồi lên web

E1. Chuột phải `Joined layer` ▸ **Export ▸ Save Features As…**
   - Format: **GeoJSON**
   - File name: `thua_dc51.geojson`
   - CRS: **EPSG:4326 - WGS 84**  ← đổi sang 4326 (bắt buộc cho web)
   - Select fields to export: chỉ giữ `SoTo, SoThua, Xa, Huyen, Cap, DienTich`
   - **OK**.

E2. Vào trang **Admin** của web → quản lý lớp GIS → **Upload GeoJSON** → chọn kiểu lớp **parcel** (thửa) → xong tra cứu được.

---

## Ghi chú nhanh
- Trường `Layer` trong DXF: `L10/L50/L23` = ranh, `L4` = số thửa (chữ ở trường `Text`).
- Nhiều tờ: chỉ đổi `SoTo` và tên file; các bước y hệt. Có thể merge nhiều `thua_*.geojson` rồi upload 1 lần.
- 19 tờ V8: chạy **ODA File Converter** (V8→DXF) trên máy trước, rồi vào từ Bước A.
- Diện tích tính đúng vì bước C/D đang ở CRS mét (VN2000); chỉ đổi sang 4326 lúc xuất (Bước E).
