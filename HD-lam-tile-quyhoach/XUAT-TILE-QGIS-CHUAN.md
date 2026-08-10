# Xuất lại tile RASTER trong QGIS cho CHUẨN
### (căn đúng toạ độ · trong suốt ngoài xã · không mất tile z17/18)

Nguồn dùng: `QD205_georef_200dpi.png` (+ `.pgw` + CRS VN2000) — bản gốc chi tiết đã nắn sẵn (kèm trong thư mục này).

---

## Bước 1 — Nạp ảnh đúng toạ độ
1. Mở QGIS. Tạo CRS **VN2000-KhanhHoa** (1 lần): Settings → Custom Projections → +, Format **Proj String**, dán nội dung `VN2000-KhanhHoa-proj4.txt`.
2. Kéo `QD205_georef_200dpi.png` vào QGIS (nhờ `.pgw` cùng tên → vào **đúng vị trí**).
3. Chuột phải layer → Properties → **Source → Assigned CRS → VN2000-KhanhHoa** → OK.
4. Kéo nền đối chiếu: Browser → XYZ Tiles → **OpenStreetMap**. Ảnh quy hoạch phải chồng khớp đường/ranh thật.

## Bước 2 — CẮT theo ranh xã (⭐ chống viền trắng ngoài xã)
> Bỏ bước này thì ngoài xã thành **ô trắng che vệ tinh** — đây chính là "mất/hỏng tile" hay gặp ở raster.

1. Nạp vùng ranh: kéo `apps/frontend/public/qh_vector.geojson` vào (nó phủ đúng vùng xã).
2. Gộp thành 1 vùng: **Vector → Geoprocessing Tools → Dissolve** (Dissolve all) → ra 1 polygon ranh.
3. **Raster → Extraction → Clip Raster by Mask Layer**:
   - Input layer: ảnh `QD205_georef_200dpi`
   - Mask layer: polygon Dissolve vừa tạo
   - ✔ **Create an output alpha band** (để ngoài ranh **trong suốt**)
   - ✔ Match the extent of the clipped raster to the mask layer
   - Output: `QD205_clip.tif` → **Run**
   → Trong ranh giữ nguyên bản gốc PDF (kín), ngoài ranh trong suốt.

## Bước 3 — Generate XYZ Tiles (Directory) — thiết lập CHUẨN
**Processing → Toolbox** → gõ **"Generate XYZ tiles (Directory)"**:

| Mục | Giá trị |
|---|---|
| Input layer | `QD205_clip` (raster đã cắt ranh) |
| Minimum zoom | **10** |
| Maximum zoom | **16**  *(z17/18 web tự phóng to → không mất tile)* |
| Extent | `…` → **Use Layer Extent** (lớp QD205_clip) |
| Tile format | **PNG** |
| DPI | 96 (mặc định) |
| Background color | **Transparent** (bấm mũi tên → Transparent) |
| Tile width/height | 256 |
| Output directory | thư mục trống, tên **`qd205v7`** |

Bấm **Run** → **ĐỢI CHẠY XONG 100%** (đừng đóng QGIS giữa chừng, kẻo thiếu ô → mất tile).

> Muốn z17 **nét thật**: đặt Maximum zoom = **17** (và ở web để `maxzoom: 17`). Nét hơn nữa thì render lại PDF 300–400 DPI (xem `HUONG-DAN.md` mục 2) rồi cắt.

## Bước 4 — Kiểm tra ĐỦ tile
- Mở thư mục `qd205v7`: số thư mục/ô mỗi mức zoom phải **tăng đều ~×3–4**.
- Mở thử vài file `.png` ở z16: phải có màu (trong ranh), trong suốt (ngoài ranh).

## Bước 5 — Đưa lên web (không mất tile z17)
1. Copy `qd205v7` vào `apps\frontend\public\tiles\qd205v7`.
2. Sửa **2 file** (`map/page.tsx` biến `RASTER_OVERLAYS`, `listings/page.tsx` biến `QH`):
   ```
   tiles: ['/tiles/qd205v7/{z}/{x}/{y}.png'], minzoom: 10, maxzoom: 16,
   bounds: [108.935, 11.925, 109.270, 12.223],
   ```
   - `maxzoom` = **đúng mức zoom cao nhất đã cắt** (cắt z16 → 16). **Đừng đặt cao hơn** → đó là nguyên nhân mất tile z17.
   - `bounds` giúp không đi xin tile ngoài vùng.
3. App **Quản lý server → Khởi động lại**.

## (Nên) Nén PNG → WebP cho nhẹ
Trong **OSGeo4W Shell**, tại thư mục chứa `qd205v7`:
```
python -c "from PIL import Image;import glob,os;[ (Image.open(f).convert('RGBA').save(f[:-4]+'.webp','WEBP',quality=82), os.remove(f)) for f in glob.glob('qd205v7/**/*.png',recursive=True)]"
```
Rồi đổi đuôi trong 2 file config thành `.webp`.

---

## 3 nguyên nhân "mất tile" ở raster & cách chặn
1. **z17/18 trắng** → `maxzoom` = mức đã cắt (không đặt cao hơn). MapLibre tự phóng to → hết trắng.
2. **Viền trắng ngoài xã** → Bước 2 cắt theo ranh + alpha band.
3. **Thiếu ô rải rác** → để Generate XYZ Tiles chạy xong hẳn; kiểm số ô tăng đều.

---
### Tóm tắt
Nạp PNG đã nắn → **Clip theo ranh (alpha)** → **Generate XYZ Tiles z10–16, PNG, Transparent** → copy vào `public/tiles/qd205v7` → sửa config `maxzoom: 16` + `bounds` → Khởi động lại.
