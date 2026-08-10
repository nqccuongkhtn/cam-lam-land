# Hướng dẫn: PDF quy hoạch (vector) → PNG tile cho web — KHÔNG trống ở z17

Tài liệu này chỉ cách tự biến **PDF quy hoạch QĐ205** thành **bộ tile PNG XYZ** khớp đúng
kiến trúc web Cam Lâm Land hiện tại, tô kín (không "thủng") và **không bị ô trống khi zoom z17/z18**.

> Kèm sẵn trong thư mục này (đã nắn toạ độ giúp bạn, khỏi phải chấm điểm khống chế):
> - `QD205_georef_200dpi.png` — ảnh PDF đã render 200 DPI
> - `QD205_georef_200dpi.pgw` — **world file** (toạ độ VN2000) đi kèm ảnh trên
> - `VN2000-KhanhHoa-proj4.txt` — chuỗi CRS VN2000 Khánh Hòa để gán cho layer

---

## 0. Hiểu kiến trúc web (để làm cho khớp)

Web dùng **tile XYZ** đặt tại: `apps/frontend/public/tiles/qd205vX/{z}/{x}/{y}.png`
Hai file cấu hình trỏ tới nó:

- `apps/frontend/src/app/map/page.tsx` — biến `RASTER_OVERLAYS`, dòng `tiles: [...]`
- `apps/frontend/src/app/listings/page.tsx` — biến `QH`, dòng `tiles: [...]`

Mỗi dòng có `minzoom` và `maxzoom`. **Đây là chỗ quyết định z17 có bị trống hay không.**

### ⭐ Vì sao trước bị "trống ở z17" và cách cho hết
MapLibre (thư viện bản đồ của web) khi bạn zoom **vượt quá `maxzoom`** của nguồn tile thì
**tự phóng to** tile ở mức `maxzoom` (gọi là *overzoom*) để lấp z17, z18… → **không bao giờ trống**.

- Lỗi cũ: đặt `maxzoom: 17` nhưng **chưa cắt đủ** tile z17 → ô nào thiếu file thì hiện trống.
- ✅ Quy tắc vàng: **`maxzoom` = mức zoom cao nhất bạn đã cắt ĐẦY ĐỦ.**
  - Cắt tới z16 → để `maxzoom: 16`. z17/z18 web tự phóng to từ z16 (hơi mềm nhưng KHÔNG trống).
  - Muốn z17 **nét thật**: render PDF ở DPI cao (300–400) rồi cắt tới z17 — nhưng phải cắt **đủ mọi ô**.
- Đừng bao giờ đặt `maxzoom` **lớn hơn** mức đã cắt.

---

## 1. Cách NHANH NHẤT — dùng ảnh đã nắn sẵn (QGIS, không cần chấm điểm)

Bạn đã có sẵn `QD205_georef_200dpi.png` + `.pgw` + CRS. Chỉ việc cắt tile.

1. Mở **QGIS 3.44**.
2. Tạo CRS VN2000 Khánh Hòa (làm 1 lần): **Settings → Custom Projections… → +**,
   Name: `VN2000-KhanhHoa`, Format: **Proj String**, dán nội dung file `VN2000-KhanhHoa-proj4.txt` → OK.
3. Kéo `QD205_georef_200dpi.png` vào QGIS. Nhờ có file `.pgw` cùng tên, ảnh vào **đúng vị trí** (theo mét).
   - Chuột phải layer → **Properties → Source → Assigned CRS** → chọn `VN2000-KhanhHoa` → OK.
4. Kiểm tra nhanh: Browser → **XYZ Tiles → OpenStreetMap** kéo vào làm nền. Ảnh quy hoạch phải chồng đúng lên đường/ranh thật.
5. Cắt tile: **Processing → Toolbox** → gõ **"Generate XYZ tiles (Directory)"** → mở, đặt:
   - **Input layer**: layer ảnh quy hoạch
   - **Minimum zoom = 10**, **Maximum zoom = 16**  *(z17/18 để web tự phóng to)*
   - **Extent** → nút `…` → **Use Layer Extent**
   - **Tile format = PNG**
   - **Background color**: bấm mũi tên → **Transparent** (để ngoài vùng trong suốt, không che vệ tinh)
   - **Output directory**: chọn thư mục trống, ví dụ đặt tên `qd205v7`
   - **Run**
6. Kết quả ra cây thư mục `qd205v7/{z}/{x}/{y}.png`. → Sang **mục 4** để đưa lên web.

> Muốn z17 nét hơn: render lại PDF 300–400 DPI (mục 2), sửa world file theo DPI (mục 2, bước 3),
> rồi cắt **Maximum zoom = 17** và đặt `maxzoom: 17` trong config.

---

## 2. Tự render PDF → PNG (nếu muốn làm lại từ đầu / DPI khác)

**Render PDF ra ảnh** (chọn 1 trong 3):
- **QGIS/OSGeo4W Shell** (có sẵn `pdftoppm`):
  `pdftoppm -png -r 300 -x 614 -y 0 -W 7572 -H 6800 QD205-Default-000.pdf QD205_300`
  *(các số -x/-W… là vùng bản đồ, bỏ khung chú giải; xem chú thích cuối bài)*
- **Foxit Reader / trình đọc PDF**: Export → PNG, chọn **300 DPI**.
- **GIMP**: mở PDF, chọn resolution 300, Export As PNG.

**Gán world file cho ảnh vừa render** (để QGIS biết toạ độ):
Tạo file `.pgw` **cùng tên ảnh** (vd `QD205_300.png` → `QD205_300.pgw`), 6 dòng:
```
<mpp>            ← m/px = 13.3392 * 72 / DPI   (DPI 300 → 3.2014 ; 400 → 2.4011)
0
0
-<mpp>
574407.147839    ← giữ nguyên với 200 DPI; DPI khác: 574404.747 + 0.5*mpp
1351761.093250   ← giữ nguyên với 200 DPI; DPI khác: 1351763.494 - 0.5*mpp
```
Góc trên-trái ảnh (cố định mọi DPI): **E0 = 574404.747 ; N_top = 1351763.494** (mét VN2000).
Sau đó gán CRS `VN2000-KhanhHoa` cho layer như mục 1 → cắt tile như mục 1 bước 5.

---

## 3. Cách TỔNG QUÁT — tự nắn 1 PDF MỚI bằng điểm khống chế (khi không có world file)

1. Render PDF → PNG (mục 2).
2. **Raster → Georeferencer**.
3. **Open Raster** → chọn ảnh PNG.
4. Kéo nền **OpenStreetMap** (Browser → XYZ Tiles) vào bản đồ chính để làm mốc.
5. **Add Point**: bấm 1 điểm rõ trên ảnh (ngã tư, bùng binh, mép hồ) → **From Map Canvas** → bấm đúng
   điểm đó trên nền OSM. Làm **5–8 điểm** rải đều (4 góc + giữa).
6. **Transformation settings**:
   - Type: **Linear** (bản đồ không xoay) hoặc **Polynomial 1** ; Resampling: **Cubic**
   - Target CRS: **VN2000-KhanhHoa** (hoặc EPSG:4326 nếu chấm theo OSM)
   - Output: `QD205_georef.tif`
7. **Start Georeferencing** → ra GeoTIFF đã đúng toạ độ → cắt tile như mục 1 bước 5.

> 💡 **Gọn nhất nếu có file gốc `QD205.dgn`**: kéo thẳng DGN vào QGIS (chọn lớp polygon) →
> gán CRS VN2000 → **Symbology** tô màu theo cột loại đất (tô KÍN) → cắt tile. Không cần nắn, toạ độ có sẵn.

---

## 4. Đưa tile lên web + cấu hình để KHÔNG trống z17

1. Copy thư mục tile vào: `apps\frontend\public\tiles\qd205v7`
2. Sửa **2 file**, đổi đường dẫn + `maxzoom` = mức zoom cao nhất **đã cắt đủ**:

   `apps/frontend/src/app/map/page.tsx` (biến `RASTER_OVERLAYS`):
   ```
   tiles: ['/tiles/qd205v7/{z}/{x}/{y}.png'], minzoom: 10, maxzoom: 16,
   ```
   `apps/frontend/src/app/listings/page.tsx` (biến `QH`): sửa y hệt dòng trên.

   - Cắt tới z16 → `maxzoom: 16` (z17/18 tự phóng to, **không trống**).
   - Cắt tới z17 → `maxzoom: 17`.
3. Mở app **Quản lý server → Khởi động lại** (build lại để nhúng tile mới vào image).

> Đổi tên thư mục mới mỗi lần (`qd205v7`, `v8`…) để trình duyệt/Cloudflare nhận bản mới, không dính cache cũ.

---

## 5. (Nên) Nén PNG → WebP cho nhẹ

Tile PNG từ ảnh chi tiết rất nặng (vài trăm MB). WebP nhẹ hơn ~6 lần, MapLibre đọc được, giữ trong suốt.
Chạy trong **OSGeo4W Shell** (có Python + Pillow) tại thư mục tile:
```
python -c "from PIL import Image;import glob,os;[ (Image.open(f).convert('RGBA').save(f[:-4]+'.webp','WEBP',quality=82), os.remove(f)) for f in glob.glob('qd205v7/**/*.png',recursive=True)]"
```
Rồi đổi đuôi trong 2 file config: `.../{z}/{x}/{y}.webp`.

---

## 6. Chống "thủng" (lòi vệ tinh ở khu dân cư)

"Thủng" = vùng đó trong **nguồn** không có màu (trong suốt) nên lòi nền vệ tinh.
- Nếu muốn hết thủng: nguồn phải **tô màu kín** mọi khu (kể cả đất ở hiện hữu).
- Với ảnh PDF: chỉ những vùng **trắng** mới thành trong suốt. Bản QĐ205 đã tô gần kín nên hầu như không thủng.
- Khi cắt tile: **Background = Transparent** để **ngoài ranh** trong suốt (đúng), còn **trong ranh** giữ nguyên màu PDF (kín).

---

## Chú thích: vùng cắt bản đồ (bỏ khung chú giải)

PDF gốc rộng 3168×2448 pt; **vùng bản đồ** nằm ở x = 220.95 … 2947.05 pt (phần bên phải là khung chú giải).
Khi render bằng `pdftoppm -r DPI`, đổi ra pixel: nhân `DPI/72`.
- 200 DPI → `-x 614 -W 7572 -H 6800`
- 300 DPI → `-x 921 -W 11358 -H 10200`
Cắt đúng vùng này thì tile không dính khung chú giải trôi nổi trên bản đồ. (Khung chú giải để riêng làm ảnh chú giải trong giao diện.)

---

### Tóm tắt 1 câu
Nắn PDF về **VN2000 Khánh Hòa** (dùng world file kèm sẵn) → **Generate XYZ tiles** z10–16 PNG nền trong suốt →
copy vào `public/tiles/qd205v7` → sửa 2 dòng config (`maxzoom = mức đã cắt`) → Khởi động lại. z17/18 web tự phóng to nên **không trống**.
