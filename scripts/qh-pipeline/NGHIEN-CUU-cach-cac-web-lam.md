# Các web quy hoạch khác đang làm thế nào — Tổng hợp & khuyến nghị cho Cam Lâm Land

*Cập nhật: 07/2026. Dựa trên khảo sát Guland, Meey Map, các cổng WebGIS nhà nước (TP.HCM, Hải Phòng, Huế) và quy trình chuẩn ngành địa chính VN.*

---

## 1. Có ĐÚNG 2 trường phái

### Nhóm A — "Nắn ảnh" raster overlay (Guland, đa số app thương mại)
- **Dữ liệu**: lấy bản đồ QH gốc (ảnh scan / bản in / xuất từ CAD) → **nắn ảnh (georeference)** cho khớp toạ độ thật → cắt thành **tile raster** chồng lên nền vệ tinh/Google. Guland để người dùng *"vẽ ranh theo ảnh vệ tinh và kéo lớp quy hoạch"* — tức nhìn ảnh, không có vùng vector.
- **Ưu**: triển khai **cực nhanh, phủ toàn quốc** (chỉ cần ảnh + nắn). Không cần số hoá từng thửa.
- **Nhược**: **KHÔNG tính được diện tích/loại đất theo thửa** một cách chính xác — người dùng phải **tự nhìn màu mà đoán**. Không có con số m²/loại.
- 👉 Đây chính là lớp **`qd205.pmtiles`** app bạn đang hiển thị: đẹp, khớp, nhưng chỉ để *nhìn*.

### Nhóm B — Số hoá vector đầy đủ (cổng nhà nước, Meey ở tỉnh đã làm kỹ)
- **Dữ liệu**: **số hoá QH thành polygon vector** (mỗi vùng = 1 loại đất, có thuộc tính), lưu trong **CSDL không gian (PostGIS)**.
- Các cổng chính thức (gisxaydung.tphcm.gov.vn, hph.mplis.gov.vn, thongtinquyhoach.hochiminhcity.gov.vn, quyhoach.hue.gov.vn) trả về theo thửa: **mã mục đích sử dụng đất, diện tích (m²), tầng cao, mật độ xây dựng (%)** — tức có vector thật mới ra được.
- **Ưu**: **tính chính xác diện tích từng loại**, tra cứu tự động, phân tích chồng lớp, xuất số liệu.
- **Nhược**: tốn công **số hoá + chuẩn hoá topology**. Đây là phần khó.
- 👉 Đây là thứ bạn cần cho **phiếu cung cấp thông tin** (phải ra m² từng loại đất).

> **Kết luận cốt lõi:** muốn phiếu ghi đúng "loại đất + diện tích", **bắt buộc đi Nhóm B** (vector). Raster chỉ để hiển thị nền. Không có đường tắt bằng raster cho con số diện tích.

---

## 2. Quy trình chuẩn ngành để ra vector ĐÚNG (DGN → GIS)

Các đơn vị đo đạc VN làm chuẩn theo chuỗi này (Đất Sạch, gCadas, và cổng nhà nước đều vậy):

```
QD205.dgn (MicroStation, VN2000)
   │  mở bằng gCadas
   ▼
① Kết nối / thiết lập CSDL + đơn vị hành chính
② SỬA LỖI TỰ ĐỘNG + TẠO VÙNG   ← BƯỚC QUYẾT ĐỊNH (đóng kín polygon)
③ Gán thuộc tính (loại đất) cho từng vùng
   ▼
Xuất Shapefile  →  QGIS (sửa font TCVN3→Unicode, dọn field)  →  GeoJSON (WGS84)
   ▼
Nạp vào PostGIS  →  web tính diện tích bằng overlay
```

**Vì sao app bạn đang sai "đất giao thông ảo":** lớp `qh_vector.geojson` được tách từ DGN **nhưng thiếu bước ② "tạo vùng / đóng kín topology"** cho đầy đủ. Chỗ nào polygon hở → thửa có khoảng trống → backend hiểu nhầm thành "đất giao thông". Các web nhóm B không dính lỗi này vì họ **build topology (tạo vùng) khép kín phủ 100% diện tích**, không còn khe hở.

**Điểm mới cần lưu ý:** đã có **Thông tư 16/2025** chuẩn hoá ký hiệu/màu bản vẽ địa chính–QH; công cụ (QGIS 4.0, ArcMap, LisCAD) đang cập nhật theo. Khi số hoá lại nên theo bảng ký hiệu này để màu/loại đất thống nhất.

---

## 3. Cách tính diện tích từng loại đất (Nhóm B làm)

Chuẩn là **overlay analysis trong PostGIS** — đúng như backend bạn đang có, chỉ cần vector đầu vào sạch:

```sql
-- Diện tích mỗi loại đất QH nằm trong thửa:
SELECT qh.loai_dat,
       ST_Area(ST_Intersection(thua.geom, qh.geom)::geography) AS m2
FROM quy_hoach qh
JOIN thua ON ST_Intersects(qh.geom, thua.geom)
WHERE thua.id = :id
GROUP BY qh.loai_dat;
```
- Vector QH **phủ kín** (không hở) ⇒ tổng các loại = đúng diện tích thửa ⇒ **không cần bịa "giao thông = phần trống"**.
- "Đất giao thông" phải là **1 loại đất có polygon thật** trong lớp QH (không phải phần còn thừa).
- Tỉ lệ % = m² mỗi loại ÷ diện tích thửa. (Chính là tính năng "% thửa nằm trong loại QH" mà các web quảng cáo.)

---

## 4. Chẩn đoán Cam Lâm Land & khuyến nghị

| Thành phần | Hiện tại | Chuẩn (nhóm B) | Việc cần làm |
|---|---|---|---|
| **Hiển thị nền QH** | `qd205.pmtiles` (raster, khớp) ✅ | raster overlay | GIỮ NGUYÊN — đang tốt |
| **Vector tính diện tích** | `qh_vector.geojson` (tách DGN, **còn hở**) ⚠️ | vector topology phủ kín | **Làm lại "tạo vùng" từ `QD205.dgn`** |
| **Tính diện tích** | PostGIS overlay + "giao thông = phần trống" ❌ | overlay thuần, giao thông là polygon thật | Đã sửa backend: ưu tiên ô giao thông thật; sau khi có vector kín sẽ bỏ hẳn phần bịa |

**Khuyến nghị (đúng theo cách nhóm B):**
1. **Giữ raster** `qd205.pmtiles` làm nền hiển thị (đẹp, khớp — không đổi).
2. **Dựng lại lớp vector từ `QD205.dgn`** bằng đúng bước ②③: **tạo vùng khép kín + gán loại đất cho MỌI vùng, kể cả giao thông** (bằng gCadas trên máy bạn, hoặc QGIS Polygonize). Kết quả: polygon phủ 100%, khớp raster.
3. **Thay** `qh_vector.geojson` bằng lớp mới, nạp PostGIS. Backend đã sẵn sàng dùng "ô giao thông thật".
4. Khi vector đã kín, **bỏ hoàn toàn** cơ chế "đất giao thông = phần trống".

**Lưu ý thực thi:** `QD205.dxf` (778MB) và `QD205.dgn` (67MB) quá lớn + máy chủ ảo không cài được GDAL → **khâu "tạo vùng" nên chạy bằng gCadas/QGIS trên máy bạn** (nơi có sẵn phần mềm và file), không nên làm trên server. Đây cũng là lý do các đơn vị đo đạc VN đều xử lý ở máy trạm rồi mới đẩy GeoJSON lên web.

---

## Nguồn
- Guland — soi quy hoạch: https://guland.vn/soi-quy-hoach · https://guland.vn/
- Meey Map: https://meeymap.com/ · VnExpress giới thiệu Meey Map: https://vnexpress.net/ung-dung-meey-map-giup-tra-cuu-quy-hoach-truc-tuyen-4986405.html
- Quy trình DGN→Shapefile (gCadas): https://datsach.net/quy-trinh-chuyen-doi-file-dgn-sang-shapefile.html
- Số hoá bản đồ trên QGIS (địa chính): https://viet-thanh.vn/so-hoa-ban-do-tren-qgis/
- Cổng WebGIS QH nhà nước: https://gisxaydung.tphcm.gov.vn/quy-hoach-xd-pk/ · https://hph.mplis.gov.vn/og/KhaiThacBanDo · https://thongtinquyhoach.hochiminhcity.gov.vn/ · https://quyhoach.hue.gov.vn/tong-hop-quy-hoach
