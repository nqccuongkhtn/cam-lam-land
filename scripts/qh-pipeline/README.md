# Nạp dữ liệu QH ĐÚNG từ file gốc CAD (DGN/DWG) — QĐ205

Mục tiêu: thay lớp vector "số hoá thô" (đang lệch với ảnh QĐ205) bằng **vector convert TRỰC TIẾP từ file CAD gốc** — cùng nguồn với ảnh raster nên **khớp 100%**, và **diện tích tính thẳng từ vector** (chính xác tuyệt đối, không cần đọc pixel).

Vì sao đúng: ảnh tile QĐ205 của bạn đã **render từ file DGN**. Convert CHÍNH file đó sang vector ⇒ hai lớp trùng khít. Mỗi **level trong CAD = 1 loại đất** (kể cả **giao thông** ⇒ có polygon đường thật, hết "đất giao thông ảo").

---

## Chuẩn bị
- **GDAL** (có lệnh `ogr2ogr`): `conda install -c conda-forge gdal` · hoặc `apt install gdal-bin` · hoặc cài **QGIS/OSGeo4W** (đã kèm).
- **Node.js** (đã có sẵn trong dự án) cho bước 2.
- **File gốc QĐ205**: `.dgn` (MicroStation) hoặc `.dwg` (AutoCAD) — file mà đơn vị lập QH bàn giao / bạn đã dùng để render tile.
  - **DGN V8** → mở MicroStation, *Save As* ra **V7**, hoặc export **DXF**.
  - **DWG** → export **DXF** (AutoCAD hoặc ODA File Converter).
- **Bảng chú giải QĐ205** (trong thuyết minh QH): để biết level nào là loại đất nào + màu chuẩn.

---

## Các bước

### Bước 1 — Convert CAD → GeoJSON (WGS84), giữ level
```bash
cd scripts/qh-pipeline
chmod +x 1-convert-dgn.sh          # (Linux/Mac)
./1-convert-dgn.sh  QD205.dgn      # → qd205_raw.geojson
```
Script gán sẵn **hệ toạ độ VN-2000 Khánh Hoà (KTT 108°15', múi 3°, k=0.9999)** rồi reproject sang WGS84.
> Kiểm tra: mở `qd205_raw.geojson` bằng **QGIS** chồng lên nền vệ tinh — ranh phải **trùng** ảnh QĐ205. Nếu **lệch/xoay** ⇒ sai kinh tuyến trục hoặc file vẽ ở hệ khác (báo lại để chỉnh `-s_srs`).

### Bước 2 — Ánh xạ level → loại đất + màu
Chạy **lần đầu** (không có bảng map) để liệt kê level:
```bash
node 2-map-levels.mjs qd205_raw.geojson
```
→ In ra danh sách level + sinh mẫu `qd205-levels.auto.json`. Mở file này (hoặc copy từ `qd205-levels.example.json`), điền `lo` (loại đất) + `c` (màu #hex theo chú giải QĐ205) cho từng level, lưu thành `qd205-levels.json`.

Chạy lại với bảng đã điền:
```bash
node 2-map-levels.mjs qd205_raw.geojson qd205-levels.json   # → qd205_zoning.geojson
```
Mỗi polygon xuất ra có `{ lo, c, hz }` — đúng thuộc tính lớp zoning của web.

### Bước 3 — Upload lên web
**Quản trị → Lớp bản đồ → Thêm lớp** → chọn file `qd205_zoning.geojson`, đặt **loại lớp = "Quy hoạch"**. (Có thể xoá/ẩn lớp vector cũ.)

---

## Sau khi nạp — hệ thống tự đúng
- **Backend đã cập nhật**: nếu dữ liệu có ô **"Đất giao thông"** thật ⇒ dùng trực tiếp, **bỏ leftover ảo**; diện tích từng loại = `ST_Area(ST_Intersection(thửa, ô QH))` — chính xác.
- **Sơ đồ trích lục**: có thể quay lại **tô màu vector** (đã có sẵn trong `phieuQh.ts`, hàm `buildSvg`) vì vector giờ khớp ảnh; hoặc giữ nền ảnh QĐ205 — cả hai đều đúng. Báo tôi để bật lại cách bạn muốn.

## Kiểm tra nhanh
Mở vài thửa (vd 556, 326): loại đất + m² trên phiếu phải **khớp** những gì thấy trên ảnh QĐ205. Nếu 1 level bị gán nhầm loại/màu → sửa `qd205-levels.json` rồi chạy lại bước 2 + upload lại.

---
**Cần tôi hỗ trợ:** gửi tôi `qd205_raw.geojson` (sau bước 1) + ảnh **bảng chú giải QĐ205**, tôi sẽ **điền sẵn `qd205-levels.json`** và kiểm tra khớp toạ độ giúp bạn.
