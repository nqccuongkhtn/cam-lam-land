# Phần mềm Chuẩn hóa bản đồ DGN → GeoJSON (Cam Lâm Land)

Đọc **DGN (v7/v8) / DXF / DWG** → sửa lỗi hình học → **tạo vùng (polygonize)** → dựng topology → **giữ nguyên level + màu gốc** → xuất **GeoJSON (WGS84)** để nạp lên web (Quản trị → Lớp bản đồ).

Cách này là **chuẩn ngành**: lõi xử lý dùng **GDAL/OGR** — đúng thứ mà QGIS, ArcGIS Pro, FME và các trình chuyển online đều dùng bên trong.

---

## ⚡ Dùng nhanh — chỉ mấy nút bấm

> Cần cài **Python 3.9+** trước (python.org, nhớ tick *"Add Python to PATH"*).

1. Bấm đúp **`1_CaiDat.bat`** → tự cài thư viện (Shapely + GDAL). Làm **1 lần**.
2. Bấm đúp **`ChuanHoaDGN.bat`** → mở **giao diện**, chọn file DGN → CHẠY.
3. *(Tuỳ chọn)* Muốn có **file .exe bấm-là-chạy** để copy sang máy khác: bấm **`2_TaoFileEXE.bat`** → tạo ra `dist\ChuanHoaDGN.exe`.

> **DGN V8** cần cài thêm **ODA File Converter** (miễn phí) — xem mục 1c.

---

## 1. Cài đặt chi tiết (nếu nút bấm gặp lỗi)

### a) Python 3.9+  
Tải tại python.org — khi cài **tick "Add Python to PATH"**.

### b) GDAL + Shapely (lõi GIS)

> ⛔ **ĐỪNG dùng `pip install gdal`** — trên Windows nó build từ mã nguồn và **luôn báo lỗi** `Cannot open include file 'gdal.h'`. Đừng mất công.

**Shapely** thì cài bằng pip bình thường (có sẵn bản precompiled):
```bat
pip install shapely
```

**GDAL** — chọn **1 trong 2** cách chắc ăn (không compile):

- **Cách A · OSGeo4W (dễ nhất, có giao diện):** tải ở https://trac.osgeo.org/osgeo4w/ → cài gói **gdal**. Phần mềm này chỉ cần **lệnh `ogr2ogr`** (bản binary) là chạy, **không cần** gói python `gdal`.
- **Cách B · Miniconda:** cài Miniconda → mở *Anaconda Prompt* →
  ```bat
  conda install -c conda-forge gdal shapely
  ```
  (conda kèm luôn binding python — đọc được cả **màu** của element.)

> Phần mềm tự dò: có **binding osgeo** thì dùng (giữ màu tốt nhất); không có thì tự dùng **ogr2ogr binary**. Chỉ cần một trong hai là chạy.

### c) File **DGN V8** (MicroStation V8) — cần đổi sang DXF/DGN V7 trước
⚠ **Quan trọng:** GDAL (và ODA File Converter miễn phí) **KHÔNG đọc được DGN V8**.
ODA File Converter chỉ đổi **DWG ↔ DXF**, không đọc DGN. Không có công cụ **miễn phí, dòng lệnh** nào tự đổi DGN V8.

Nhận biết: phần mềm tự kiểm tra — nếu file là DGN V8 sẽ báo rõ ngay.

Cách xử lý file DGN V8 (chọn 1):
1. **Đổi qua mạng NGAY trong phần mềm (tự động):** ở mục **④ Đổi DGN V8 qua mạng**, nhập **Client ID + Secret** miễn phí của **GroupDocs** (lấy tại https://dashboard.groupdocs.cloud/applications). Sau đó cứ chọn file V8 và bấm CHẠY — phần mềm tự tải lên, đổi V8→DXF rồi chuẩn hóa. ⚠ *File được gửi lên máy chủ GroupDocs; gói miễn phí giới hạn số lần/tháng.*
2. Mở file trong **MicroStation** → **File → Save As** → **DXF** hoặc **DGN V7** → thả file mới vào phần mềm (offline, riêng tư nhất).
3. Xin lại nguồn dữ liệu ở định dạng **DXF** hoặc **DGN V7**.

*(DGN V7 / DXF thì GDAL đọc trực tiếp — không cần bước này. DWG thì phần mềm nhờ ODA File Converter đổi DWG→DXF tự động.)*

---

## 2. Chạy

- **Bấm đúp `ChuanHoaDGN.bat`** → mở giao diện.
- Chọn file DGN/DXF → chọn **Kinh tuyến trục** đúng tỉnh (Khánh Hòa = 108°15') → bật **Tạo vùng** → **CHẠY**.
- Kết quả: file `*_chuanhoa.geojson` cạnh file gốc.

**Hoặc dòng lệnh:**
```bat
python ChuanHoaDGN.py "D:\...\QD205.dgn" --out ketqua.geojson --lon0 108.25
```

---

## 3. Kiểm tra & nạp lên web

1. Mở file `*_chuanhoa.geojson` bằng **QGIS**, chồng lên nền vệ tinh → ranh phải **trùng** ảnh quy hoạch.  
   - Nếu **lệch/xoay** → chọn lại **Kinh tuyến trục** tỉnh khác rồi chạy lại.
2. Vào **Quản trị → Lớp bản đồ → Thêm lớp** → chọn file GeoJSON, đặt loại lớp phù hợp.

Mỗi vùng xuất ra có thuộc tính `{ lo = level gốc, c = màu gốc #hex }` — đúng định dạng lớp của web.

---

## 4. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| 🔴 GDAL/Shapely | Chưa cài — làm bước 1b. |
| 🔴 ODA + file là DGN V8 | Cài ODA File Converter (bước 1c) hoặc tự export DXF từ MicroStation. |
| Ra **0 vùng** | File chỉ toàn line hở → bật **Tạo vùng**; hoặc tăng **snap** (vd `0.000002`) để nối ranh hở. |
| Ranh **lệch** nền vệ tinh | Sai kinh tuyến trục → chọn đúng tỉnh; hoặc file vẽ ở hệ khác (báo lại để chỉnh `-s_srs`). |
| Màu không đúng | GDAL đọc màu từ style CAD; nếu file không nhúng màu theo element, cần bảng ánh xạ level→màu (báo mình bổ sung). |

---

---

## 5. Tạo file `.exe` (bấm-là-chạy)

Muốn có 1 file `.exe` để bấm đúp mà không cần gõ lệnh:

1. Làm xong **BƯỚC 1** (đã `pip install shapely`, đã có GDAL/OSGeo4W).
2. Bấm đúp **`2_TaoFileEXE.bat`** → tự cài PyInstaller và đóng gói.
3. Xong → file ở **`dist\ChuanHoaDGN.exe`**. Bấm đúp để chạy.

Ghi chú:
- Nếu Python của bạn có **osgeo** (cài bằng conda) → EXE **gói luôn GDAL**, chạy trên máy khác được.
- Nếu chỉ có OSGeo4W (như máy đang dùng) → EXE **mượn `ogr2ogr` của OSGeo4W**, nên máy chạy EXE cần **đã cài OSGeo4W**.
- **DGN V8** luôn cần **ODA File Converter** cài rời (bản quyền, không nhồi vào EXE được).

---

*Bản v1 — cần chạy thử trên file DGN thật rồi tinh chỉnh (snap, kinh tuyến trục, ánh xạ màu). Gửi 1 file mẫu + ảnh kết quả QGIS để canh cho khớp.*

**Phát triển bởi Nguyễn Quốc Cường · ĐT: 0357235365**
