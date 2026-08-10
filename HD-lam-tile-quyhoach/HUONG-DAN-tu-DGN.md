# Hướng dẫn: Từ `QD205.dgn` → tile PNG cho web (QGIS)

DGN là **nguồn tốt nhất**: toạ độ VN2000 thật, vector thật → **không cần nắn toạ độ**.
Nhưng DGN là file **CAD thô**: lẫn text, khung bản vẽ, nét ranh, nhiều "level" rác. Muốn ra tile đẹp,
không thủng, phải **lọc + tạo vùng kín + tô màu** rồi cắt tile.

> ✅ Tin tốt: file `apps/frontend/public/qh_vector.geojson` **chính là bản đã tách sạch từ DGN này**
> (đã bỏ text/khung/nét rác; có sẵn: `lo` = loại đất, `hz` = kịch bản HT/QH, `c` = màu hex).
> Dùng nó để cắt tile là **nhanh và sạch nhất** (Cách A). Cách B là làm lại từ DGN thô khi có bản mới.

---

## CÁCH A — Nhanh & sạch: cắt tile từ `qh_vector.geojson` (đã tách từ DGN)

### A1. Tự động bằng script (khuyên dùng)
1. Mở **QGIS 3.44**.
2. **Plugins → Python Console** → bấm biểu tượng **Show Editor** → mở file `cat-tile-tu-dgn.py` (kèm trong thư mục này).
3. Sửa 3 dòng đầu nếu cần (`SRC`, `OUT`, `ZMAX`) → bấm **Run** ▶.
4. Xong: ra thư mục tile `qd205v7/{z}/{x}/{y}.png`, tô kín, nền trong suốt. → sang **mục ĐƯA LÊN WEB**.

### A2. Làm tay trong QGIS (không dùng script)
1. Tạo CRS VN2000 Khánh Hòa (1 lần): **Settings → Custom Projections → +**, Format **Proj String**,
   dán nội dung `VN2000-KhanhHoa-proj4.txt` → OK. *(qh_vector.geojson đã ở EPSG:4326 nên bước này chỉ cần khi mở DGN thô ở Cách B.)*
2. Kéo `qh_vector.geojson` vào QGIS.
3. Chuột phải layer → **Properties → Symbology**:
   - Loại: **Single Symbol** → **Simple fill**.
   - **Fill color** → bấm nút ô vuông cạnh nó → **Edit…** (data-defined) → **Field type → `c`**
     (mỗi thửa tự tô đúng màu hex của nó).
   - **Stroke style → No Pen** (bỏ viền cho phủ kín).
4. *(Tùy chọn)* lọc kịch bản: chuột phải layer → **Filter…** →
   `"hz" = 'QH'` (chỉ quy hoạch) hoặc `"hz" = 'HT'` (hiện trạng).
5. **Processing → Toolbox** → **"Generate XYZ tiles (Directory)"**:
   - Input: layer `qh_vector`
   - **Min zoom 10 / Max zoom 16**  *(z17/18 web tự phóng to → không trống)*
   - **Extent** → Use Layer Extent
   - **Tile format PNG**, **Background color → Transparent**
   - **Output directory**: thư mục trống, đặt tên `qd205v7` → **Run**

---

## CÁCH B — Làm lại từ DGN THÔ (khi có bản DGN mới chưa tách)

1. **Mở DGN**: Layer → **Add Vector Layer** → chọn `QD205.dgn` → khi hỏi sub-layer, chọn **Polygon**
   (thêm **LineString** nếu vùng đất vẽ bằng nét).
   - Nếu QGIS **không mở được DGN V8**: trong **MicroStation V8i**: File → Save As → chọn **DGN V7**;
     hoặc **Export → DXF**. Rồi mở file DXF trong QGIS. *(Bạn đã có sẵn `QD205.dxf`.)*
2. **Gán CRS**: Properties → **Source → Assigned CRS → VN2000-KhanhHoa**.
3. **Tạo vùng kín** (nếu chỉ có nét, chưa phải polygon): **Processing → Polygonize**
   → ra polygon kín (đây là bước **chống thủng**).
4. **Lọc bỏ level rác**: mở bảng thuộc tính, chỉ giữ các level loại đất; **bỏ** các level:
   `TEXT KY HIEU`, `Khung A0`, `NET-BO SU DUNG DAT`, `NET-RANH PHAN KHU`, `bo dat`, `L- bo dat`, `-1-TRAFFIC-...`.
   (Dùng **Filter** hoặc **Select by Expression** rồi xóa/ẩn.)
5. **Tô màu theo loại đất**: Properties → Symbology → **Categorized** → Value **`Layer`** → **Classify**
   → chỉnh màu từng nhóm (xem bảng dưới). Bỏ viền.
6. Cắt tile như **A2 bước 5**.

---

## Bảng LEVEL → LOẠI ĐẤT → MÀU (rút từ file của bạn)

Tiền tố: `HT_` = hiện trạng · `QH2030_` / `QH2045_` = quy hoạch · `DAT_NNK` = nông nghiệp · `DAT_NDD`/`DAT_DD` = đất đô thị/ngoài đô thị.

| Màu | Loại đất |
|-----|----------|
| `#84843b` | Dân cư nông thôn (DancuNT) |
| `#dbff72` | Đơn vị ở mật độ thấp |
| `#eec810` | Đơn vị ở mới (ĐVO mới) |
| `#3b844d` | Rừng sản xuất |
| `#00445b` | Rừng đặc dụng |
| `#72b8ff` `#00bfff` | Sông suối / mặt nước |
| `#00d6d6` | Đầm Thủy Triều |
| `#00ad00` | Cây xanh SDHC / Văn hóa–TDTT |
| `#9aa0a6` | Cây xanh CD / mặc định |
| `#846300` | Cơ quan ngoài đô thị |
| `#ad5600` | Cơ quan đô thị |
| `#82ad00` | An ninh |
| `#840000` | Di tích – tôn giáo |
| `#5c5c5c` | Nghĩa trang |
| `#42295b` | HTKT ngoài đô thị |
| `#a9b34b` | Làng xóm đô thị hóa |

---

## ĐƯA LÊN WEB + KHÔNG trống z17

1. Copy thư mục tile vào `apps\frontend\public\tiles\qd205v7`.
2. Sửa **2 file**, đổi đường dẫn + `maxzoom` = **mức zoom cao nhất đã cắt đủ**:
   - `apps/frontend/src/app/map/page.tsx` (biến `RASTER_OVERLAYS`)
   - `apps/frontend/src/app/listings/page.tsx` (biến `QH`)
   ```
   tiles: ['/tiles/qd205v7/{z}/{x}/{y}.png'], minzoom: 10, maxzoom: 16,
   ```
3. App **Quản lý server → Khởi động lại**.

**Chìa khoá không trống z17:** cắt tới z16 → đặt `maxzoom: 16`. MapLibre **tự phóng to** z16 để lấp z17/z18
→ không bao giờ trống. Lỗi cũ là đặt `maxzoom: 17` nhưng chưa cắt đủ tile z17. **Đừng đặt maxzoom > mức đã cắt.**
Muốn z17 nét thật: đặt `ZMAX=17` trong script (cắt đủ z17) rồi để `maxzoom: 17`.

---

## Chống "thủng" (lòi vệ tinh)
- Chỉ vùng **có polygon + màu** mới hiện; vùng trống → trong suốt → lòi vệ tinh.
- Vì vậy: polygon phải **phủ kín** + **fill solid** (bỏ viền). `qh_vector.geojson` đã phủ kín nên không thủng.

## (Nên) nén PNG → WebP cho nhẹ
Trong **OSGeo4W Shell**, tại thư mục chứa `qd205v7`:
```
python -c "from PIL import Image;import glob,os;[ (Image.open(f).convert('RGBA').save(f[:-4]+'.webp','WEBP',quality=82), os.remove(f)) for f in glob.glob('qd205v7/**/*.png',recursive=True)]"
```
Rồi đổi đuôi trong 2 file config thành `.webp`.

---

### Tóm tắt
DGN → (đã tách sẵn) `qh_vector.geojson` → QGIS tô màu theo trường `c`, phủ kín → **Generate XYZ tiles** z10–16 PNG nền trong suốt
→ copy vào `public/tiles/qd205v7` → sửa 2 dòng config (`maxzoom = mức đã cắt`) → Khởi động lại. z17/18 tự phóng to nên **không trống**.
