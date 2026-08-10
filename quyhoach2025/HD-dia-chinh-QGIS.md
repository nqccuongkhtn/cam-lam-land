# Hướng dẫn: Đưa bản đồ địa chính (DGN) lên web bằng QGIS

Mục tiêu: từ file `.dgn` địa chính → ra **polygon thửa** kèm **Số tờ / Số thửa / Xã** → xuất GeoJSON (WGS84) → upload lên web (lớp *parcel*).

Áp dụng cho: các tờ **V8** mà pipeline Python đọc không được, và các **xã mới** ngoài Cam Đức.

> 19 tờ V8 cần làm bằng QGIS (Python bỏ qua): dc1, dc3, dc8, dc9, dc15, dc16, DC17, DC19, dc20, dc21, dc25, dc29, dc30, dc32, dc34, dc36, dc43, dc45, dc47.

---

## Bước 0 — Nếu file DGN là V8 (mở trong QGIS không ra layer)

QGIS/GDAL chỉ đọc tốt **DGN V7**. File V8 (bản MicroStation mới) phải chuyển trước:

- **Cách A (khuyên dùng, miễn phí):** tải **ODA File Converter** (Open Design Alliance – opendesign.com/guestfiles/oda_file_converter).
  - Input Folder: thư mục chứa .dgn V8 → Output: chọn định dạng **DGN v7** (hoặc **DXF R2018**).
  - Convert → được file V7/DXF, mở trong QGIS bình thường.
- **Cách B:** mở trong MicroStation/Bentley → *File > Save As > DGN v7*.

Kiểm tra nhanh V7 hay V8: mở file bằng Notepad++, nếu **10 byte đầu bắt đầu bằng `D0 CF 11 E0`** thì là V8 (OLE), phải chuyển.

---

## Bước 1 — Mở DGN trong QGIS

1. `Layer > Add Layer > Add Vector Layer…` → chọn file `.dgn` (hoặc `.dxf`).
2. DGN được nạp thành nhiều lớp con theo kiểu hình học: **Point / LineString / Polygon**. Mỗi đối tượng có trường **Level** (số lớp CAD), **Type**, **Text**.
3. Kéo vào 2 lớp cần: **LineString** (ranh thửa) và **Point** (chữ số thửa).

---

## Bước 2 — Gán hệ tọa độ VN2000 (Khánh Hòa, KTT 108°15′)

Lớp DGN thường "vô danh" về CRS → phải gán đúng, nếu không sẽ lệch vị trí.

1. `Settings > Custom Projections… > +` tạo CRS mới, dán chuỗi PROJ:

```
+proj=tmerc +lat_0=0 +lon_0=108.25 +k=0.9999 +x_0=500000 +y_0=0 +a=6378137 +rf=298.257222101 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs
```

  (VN2000 múi 3°, kinh tuyến trục 108°15′ = 108.25°, hệ số 0.9999.)

2. Chọn lớp DGN → `Layer > Set CRS > Set Layer CRS…` → chọn CRS custom vừa tạo.
3. **Kiểm chứng:** một thửa Cam Đức phải nằm đúng ~[109.16, 12.05] khi xem trên nền vệ tinh. Nếu lệch một chút → thử **đổi dấu 3 giá trị xoay** trong `+towgs84` (…,-0.0092…,0.0197…,-0.0042…, → +,-,+).

---

## Bước 3 — Lọc đúng lớp CAD

Ranh thửa nằm ở Level 10, 50, 23; số thửa (chữ) ở Level 4.

- Lớp LineString → chuột phải > `Filter…` → nhập:  `"Level" IN (10, 50, 23)`
- Lớp Point (số thửa) → `Filter…` →  `"Level" = 4`

> Nếu tờ khác lớp: mở bảng thuộc tính, bật/tắt từng Level để xem Level nào là ranh, Level nào là số thửa. (Cam Đức: ranh = 10/50/23, số thửa = 4.)

---

## Bước 4 — Đóng khe hở + tạo VÙNG thửa (bước quan trọng nhất)

Bản CAD hay hở ở góc → nếu polygonize thẳng sẽ **thiếu/dính thửa**. Phải "dán" các đầu đường trước:

1. Gộp ranh về 1 lớp: `Processing > Vector general > Merge vector layers` (nếu ranh nằm nhiều lớp).
2. Làm sạch tôpô: `Processing Toolbox > GRASS > v.clean`
   - Input: lớp ranh.
   - **Cleanup tools:** chọn `break`, rồi `snap`, rồi `rmdangle`.
   - **Threshold:** `0.5` (đơn vị = mét) — đủ để dính khe hở CAD, không dính nhầm thửa nhỏ. (Thửa quá dày thì giảm còn 0.3.)
3. Tạo polygon: `Processing > Vector geometry > Polygonize` (input = lớp ranh đã v.clean) → ra lớp **polygon thửa**.

> Cách khác (nếu Polygonize thiếu): sau `v.clean` chạy `GRASS > v.type` (line→boundary) rồi `v.centroids` → cũng ra vùng có tôpô chuẩn.

---

## Bước 5 — Gán Số tờ / Số thửa / Xã

1. `Processing > Vector general > Join attributes by location`
   - Base = lớp **polygon thửa**; Join = lớp **điểm số thửa** (Level 4).
   - Geometric predicate: **contains** (polygon chứa điểm).
   - Fields to add: trường chữ số thửa (thường tên `Text`).
   - → mỗi polygon có thêm số thửa.
2. Mở bảng thuộc tính polygon → `Field Calculator`, tạo các trường:
   - `SoThua` = trường Text vừa join (đổi tên cho gọn).
   - `SoTo`  = số tờ (thường lấy từ tên file, ví dụ tờ 51 → nhập `'51'`).
   - `Xa`    = `'Cam Đức'` (đổi theo xã của tờ).
   - `Huyen` = `'Cam Lâm'` ; `Cap` = `'3'` (3 cấp) hoặc `'2'`.
   - `DienTich` = `round($area, 1)` (diện tích m², vì CRS là mét).
3. Bỏ polygon rác: lọc bỏ vùng không có số thửa, hoặc `DienTich` quá nhỏ (<5) / quá lớn (>20000).

---

## Bước 6 — Reproject WGS84 + xuất GeoJSON

1. Chuột phải lớp polygon > `Export > Save Features As…`
   - Format: **GeoJSON**
   - CRS: **EPSG:4326 - WGS 84**
   - Chỉ giữ các trường: SoTo, SoThua, Xa, Huyen, Cap, DienTich.
2. Lưu ví dụ: `thua_<ten_to>.geojson`.

---

## Bước 7 — Đưa lên web

- Vào trang **Admin** của web → mục quản lý lớp GIS → **Upload GeoJSON** → chọn kiểu lớp **parcel** (thửa).
- Web tự nhận Số tờ/Số thửa/Xã và cho tra cứu.
- Gộp nhiều tờ: có thể merge các `thua_*.geojson` thành 1 file rồi upload 1 lần (như file `thua_camduc_all.geojson`).

---

## Mẹo & lỗi thường gặp

- **Số thửa không dính vào polygon:** điểm số thửa nằm ngoài polygon do hở ranh → tăng threshold v.clean, hoặc kiểm tra Level.
- **Polygon "thủng" ở giữa (thửa lồng thửa):** bình thường với sân/nhà; giữ nguyên.
- **Lệch vị trí:** sai CRS/param VN2000 → xem lại Bước 2.
- **Nhiều tờ 1 xã:** làm 1 tờ chuẩn quy trình rồi lặp lại; đặt `SoTo` theo tên tờ.
- **Muốn tự động hàng loạt tờ V7:** pipeline Python (watershed) đã làm sẵn — chỉ QGIS cho tờ V8 hoặc khi cần kiểm tra tay.
