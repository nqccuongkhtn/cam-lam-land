# Từ file gốc `.DGN` → KHÔNG mất tile khi zoom cận (z17/z18/z19)

## Sự thật cốt lõi (đọc kỹ trước khi làm)

- **Raster** (ảnh cắt sẵn) có **độ phân giải hữu hạn**. Zoom cận buộc phải chọn:
  (a) phóng to ô có sẵn → **mờ**, hoặc (b) cắt sâu hơn → **file nặng**.
  → Có thể **chặn mất/trắng tile**, nhưng **không thể nét vô hạn**.
- **Vector** vẽ lại theo toạ độ ở **mọi** mức zoom → **nét tuyệt đối, KHÔNG BAO GIỜ mất tile**.
- **File DGN của bạn vốn là VECTOR** → dùng đúng bản chất của nó là hết lỗi zoom cận.

---

## ✅ CÁCH 1 — VECTOR (chắc chắn hết mất tile ở zoom cận) — KHUYÊN DÙNG

Từ `QD205.dgn` đã tách sẵn thành `apps/frontend/public/qh_vector.geojson` (3.174 polygon, có màu `c`).
Web của bạn **đã có sẵn** lớp vector này (MapLibre GL = WebGL), chỉ **đang tắt**.

**Bật lên là xong — không cắt tile, nên không có ô nào để "mất":**
1. Mở `apps/frontend/src/app/map/page.tsx`, tìm dòng:
   `const [qhFillOn, setQhFillOn] = useState(false);`
   → đổi thành `useState(true);` (bật lớp vector mặc định).
2. Làm tương tự cho trang danh sách nếu muốn.
3. Khởi động lại.
→ Quy hoạch **nét ở z17, z18, z19…**, nhẹ, bấm tra cứu ô đất được. Hết hẳn "mất tile khi zoom cận".

> Muốn dạng "tile vector" để CDN cache (chỉ cần khi dữ liệu rất lớn): QGIS →
> Processing → **"Write Vector Tiles (Directory)"** → ra `.pbf`. Nhưng dữ liệu bạn chỉ ~2MB nên
> **nạp thẳng GeoJSON là đủ và đơn giản hơn** — khỏi cần MVT.

**Nhược điểm:** màu phẳng, **không có chữ/ký hiệu/nét như bản gốc PDF**. Nếu cần bản gốc → Cách 2 hoặc Hybrid.

---

## CÁCH 2 — RASTER từ DGN (giữ y bản gốc) — chặn tối đa mất tile

Nếu vẫn muốn hình ảnh **giống hệt bản quy hoạch gốc**, dùng raster nhưng làm đúng để không mất/trắng tile:

1. **DGN → tô màu**: chạy `cat-tile-tu-dgn.py` (QGIS Python Console) hoặc style tay theo `HUONG-DAN-tu-DGN.md`.
2. **Cắt sâu hơn 1 mức**: Generate XYZ Tiles **z10 → z17** (không dừng ở z16) để zoom cận nét hơn.
   Để tool **chạy xong 100%** (đứt giữa chừng = thiếu ô = mất tile).
3. **Cắt theo ranh + nền trong suốt** (chống ô trắng ngoài xã): xem `XUAT-TILE-QGIS-CHUAN.md` bước 2.
4. **Config đúng** (2 file `map/page.tsx`, `listings/page.tsx`):
   ```
   tiles: ['/tiles/qd205v7/{z}/{x}/{y}.webp'], minzoom: 10, maxzoom: 17,
   bounds: [108.935, 11.925, 109.270, 12.223],
   ```
   - `maxzoom` = **đúng mức đã cắt (17)**. z18+ web tự phóng to. **Đừng đặt cao hơn mức đã cắt** → đây là nguyên nhân mất tile z17 trước đây.
5. **nginx** (chống ảnh vỡ nếu lỡ thiếu ô): trong `location /tiles/` thêm `try_files $uri =204;`

→ Không mất tile, không ô trắng. Chỉ là z18+ hơi mềm (bản chất raster). Muốn nét hơn nữa: render PDF 300–400 DPI rồi cắt z18.

---

## 🎯 Chốt lựa chọn

| Bạn ưu tiên | Chọn |
|---|---|
| **Nét tuyệt đối + không bao giờ mất tile khi zoom cận** | **Cách 1 (Vector)** |
| **Giống hệt bản gốc PDF** (chữ, ký hiệu, nét) | **Cách 2 (Raster)**, cắt z17, maxzoom=17 |
| **Cả hai** | **Hybrid**: vector làm nền nét ở zoom cận + nút "Xem bản gốc" bật raster |

**Khuyên:** Hybrid. Nền vector (hết mất tile, nhẹ, nét) + bật raster `qd205v6` khi cần xem chi tiết bản gốc.
Code của bạn đã có sẵn cả 2 lớp — chỉ cần đặt vector mặc định `true` và giữ nút bật raster.
