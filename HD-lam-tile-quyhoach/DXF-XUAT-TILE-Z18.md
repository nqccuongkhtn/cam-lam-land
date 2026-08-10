# Từ file `.DXF` → cắt tile quy hoạch **tới z18** (QGIS) — hướng dẫn chuẩn

> Mục tiêu: nạp DXF (vector CAD) → tô màu loại đất → cắt XYZ tiles **z10→z18**, nền trong suốt,
> căn đúng toạ độ VN2000 → đưa lên web, **nét ở z17/z18, không vỡ**.

---

## ⚠️ ĐỌC TRƯỚC — z18 rất nặng
- z18 ≈ **0,6 m/px**. Vùng Cam Lâm cắt z10→z18 ra khoảng **60.000–90.000 ô** (vài trăm MB nếu nén WebP; ~1–2 GB nếu để PNG). QGIS cắt có thể mất **30–90 phút**.
- **Vector (DXF) render ở z18 VẪN NÉT** (khác ảnh PDF raster bị vỡ) → z18 xứng đáng nếu cần xem sát ranh thửa.
- Muốn nhẹ mà vẫn rất sát: cắt tới **z17** là đủ ~99% nhu cầu (chỉ đổi 1 số ở Bước 6).

> 💡 **Đường tắt:** nếu DXF này **chính là dữ liệu đã có** trong `apps/frontend/public/qh_vector.geojson`
> (đã tách sạch, có màu), thì **không cần xử lý lại DXF** — chỉ cần mở `cat-tile-tu-dgn.py`, sửa `ZMAX = 18`
> rồi Run (xem `HUONG-DAN-tu-DGN.md` Cách A). Chỉ làm từ DXF thô khi đây là **bản quy hoạch mới**.

---

## Bước 0 — Xuất DGN → DXF **chuẩn** trong MicroStation V8i
> Đây là chỗ dễ hỏng nhất: sai là **mất toạ độ / mất level / mất màu / thiếu lớp tham chiếu**.

**Trước khi xuất:**
1. **Gộp Reference (nếu bản vẽ có đính kèm):** menu **References** → chọn tất cả → **Tools → Merge Into Master**.
   → Không gộp thì DXF chỉ có model gốc, **thiếu các lớp tham chiếu**.
2. **Kiểm Working Units = MÉT:** **Settings → Design File → Working Units** → Master Unit = **Meters**.
   Rê chuột xem thanh toạ độ phải cỡ **E ≈ 57xxxx, N ≈ 135xxxx** (VN2000 mét). Nếu ra số lạ (feet/mm) → sửa cho đúng mét trước.
3. *(Nếu có nhiều Model)* chọn đúng **Model** chứa quy hoạch (thường là **Default**).

**Xuất DXF:**
4. **File → Save As…** → ô **Save as type** chọn **AutoCAD DXF Files (\*.dxf)** → bấm nút **Options**.
   *(Hoặc **File → Export → DGN, DWG, DXF…**.)*
5. Trong hộp **DWG/DXF Save Options**, đặt:
   - **Version / DXF version**: **AutoCAD 2013** (hoặc 2004/2010 — đều được).
   - **Units**: **1 đơn vị DWG = 1 mét** (Units = *Meters*) → giữ nguyên toạ độ thật, không co giãn.
   - **General → Global Origin**: **giữ mặc định** (đừng dời gốc) để toạ độ không lệch.
   - **Levels → Layers**: giữ **theo TÊN level** (level → layer by name) — QGIS đọc cột `Layer` này để tô màu.
   - **Colors / Fill**: giữ màu theo element/level; **bật Fill** cho shape kín.
   - **Cells**: nếu vùng đất nằm trong *cell* → tick **Drop/Explode cells** để ra hình học thật (không thì QGIS thấy block rỗng).
   - **Reference Files**: chọn **Merge** (nếu chưa gộp ở bước 1).
6. **Save** → ra `QD205.dxf`.

**Kiểm nhanh:** mở lại DXF ở QGIS (Bước 1–2 dưới), gán CRS **VN2000-KhanhHoa**, chồng nền OpenStreetMap → phải **khớp đường/bờ biển**; bấm 1 điểm bất kỳ toạ độ phải cỡ **E≈57xxxx / N≈135xxxx**.

> 💡 **Cách khác còn “sạch” hơn DXF:** trong V8i **File → Save As → MicroStation V7 DGN** — QGIS/OGR **mở thẳng DGN V7** (giữ nguyên level/màu/toạ độ, khỏi qua DXF). Nếu tiện thì ưu tiên cách này; không thì DXF như trên là chuẩn.

---

## Bước 1 — Tạo CRS VN2000 Khánh Hòa (làm 1 lần)
**Settings → Custom Projections → ➕** → Format **Proj String** → dán đúng dòng sau:
```
+proj=tmerc +lat_0=0 +lon_0=108.25 +k=0.9999 +x_0=500000 +y_0=0 +a=6378137 +rf=298.257223563 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs
```
Đặt tên **VN2000-KhanhHoa** → OK. *(Đây chính là nội dung file `VN2000-KhanhHoa-proj4.txt` trong thư mục này — kinh tuyến trục 108°15', k=0,9999.)*

## Bước 2 — Mở DXF + GÁN CRS (quan trọng nhất)
1. **Layer → Add Layer → Add Vector Layer** → chọn `QD205.dxf`.
   - Khi QGIS hỏi sub-layer: chọn **Polygon**. (Thêm **LineString** nếu vùng đất vẽ bằng nét chưa khép kín.)
2. Chuột phải layer → **Properties → Source → Assigned CRS → VN2000-KhanhHoa** → OK.
   - DXF **không mang toạ độ hệ nào cả** → bắt buộc gán tay, nếu không sẽ nằm sai chỗ.
3. **Đối chiếu:** Browser → XYZ Tiles → **OpenStreetMap** (kéo vào). Ranh quy hoạch phải **chồng khớp** đường/bờ biển thật.
   - Lệch → gán sai CRS (làm lại bước 2) hoặc DXF gốc ở hệ khác.

## Bước 3 — Tạo vùng KÍN (nếu DXF chỉ có nét, chưa phải polygon)
Nếu lớp Polygon trống, hoặc đất vẽ bằng đường: **Processing → Toolbox → “Polygonize”** (Vector geometry)
→ Input = lớp LineString → **Run** → ra polygon kín. *(Bước chống “thủng”/không tô được.)*

## Bước 4 — LỌC bỏ level rác
Mở **Attribute Table**, nhìn cột **`Layer`** (tên level CAD). Chỉ giữ các level **loại đất**; bỏ:
`TEXT KY HIEU`, `Khung A0`, `NET-BO SU DUNG DAT`, `NET-RANH PHAN KHU`, `bo dat`, `L- bo dat`, `-1-TRAFFIC-…`.
- Cách nhanh: chuột phải layer → **Filter…** → giữ đất bằng biểu thức, ví dụ:
  `"Layer" NOT IN ('TEXT KY HIEU','Khung A0','NET-BO SU DUNG DAT','NET-RANH PHAN KHU','bo dat')`

## Bước 5 — TÔ MÀU theo loại đất
Properties → **Symbology**:
- **Nếu DXF có field màu** (vd `Color`/`Entity color`): **Single Symbol → Simple fill → Fill color → nút data-defined (ô vuông) → Edit → Field type → chọn field màu**.
- **Nếu màu theo tên level:** **Categorized** → Value = **`Layer`** → **Classify** → chỉnh màu từng nhóm theo
  bảng LEVEL→LOẠI ĐẤT→MÀU trong `HUONG-DAN-tu-DGN.md` (vd `#eec810` đơn vị ở mới, `#3b844d` rừng sản xuất, `#72b8ff` mặt nước…).
- **Stroke → No Pen** (bỏ viền để phủ kín).
  - *Muốn có đường phân lô trắng như bản cũ:* để **Stroke = trắng, rộng ~0,2 mm** thay vì No Pen.

## Bước 6 — Generate XYZ Tiles **z10 → z18**
**Processing → Toolbox → “Generate XYZ tiles (Directory)”**:

| Mục | Giá trị |
|---|---|
| Input layer | lớp DXF đã tô màu |
| Minimum zoom | **10** |
| **Maximum zoom** | **18**  *(muốn nhẹ: 17)* |
| Extent | ▸ **Use Layer Extent** (lớp DXF) |
| Tile format | **PNG** |
| Background color | ▸ **Transparent** |
| Tile width / height | **256 / 256** |
| DPI | 96 |
| Output directory | thư mục TRỐNG, đặt tên **`qd205v8`** |

→ **Run** và **ĐỢI CHẠY XONG 100%** (đừng đóng QGIS giữa chừng — đứt = thiếu ô = mất tile).
> ⏳ z18 lâu. Máy yếu thì cắt **z10→17** trước cho nhanh, để z18 chạy riêng sau (cùng Output `qd205v8`, Min=18/Max=18).

## Bước 7 — Nén WebP (RẤT nên ở z18 — giảm ~3–4 lần dung lượng)
Mở **OSGeo4W Shell**, `cd` tới thư mục chứa `qd205v8`, chạy:
```
python -c "from PIL import Image;import glob,os;[ (Image.open(f).convert('RGBA').save(f[:-4]+'.webp','WEBP',quality=82), os.remove(f)) for f in glob.glob('qd205v8/**/*.png',recursive=True)]"
```

## Bước 8 — Đưa lên web
1. Copy thư mục `qd205v8` vào `apps\frontend\public\tiles\qd205v8`.
2. Sửa **2 file** — `src/app/map/page.tsx` (biến `RASTER_OVERLAYS`) và `src/app/listings/page.tsx` (biến `QH`):
   ```
   tiles: ['/tiles/qd205v8/{z}/{x}/{y}.webp'], minzoom: 10, maxzoom: 18,
   ```
   - `maxzoom` = **đúng mức cao nhất đã cắt (18)**. **Đừng đặt cao hơn** → đó chính là nguyên nhân vỡ/mất tile z17 trước đây.
   - Nếu để PNG (không nén) thì đổi đuôi `.webp` → `.png`.
3. **nginx** (chống ô thiếu biến thành ảnh vỡ) — trong khối phục vụ tile thêm:
   ```
   location /tiles/ { try_files $uri =204; }
   ```
4. **Khởi động lại** app/server.

> ✅ Copy tile xong, **báo mình** — mình sẽ **sửa 2 file config + maxzoom=18 giúp bạn** (khỏi sửa tay), và kiểm tra hộ.

## Kiểm tra cuối
- Thư mục `qd205v8`: số ô mỗi mức zoom **tăng đều ~×4** (z16→z17→z18).
- Mở thử vài `.webp` ở z18: **có màu trong ranh, trong suốt ngoài ranh**.
- Trên web kéo tới **z18**: quy hoạch **nét, không vỡ**, không ô trắng.

---

### Tóm tắt 1 dòng
Gán CRS **VN2000-KhanhHoa** cho DXF → Polygonize + lọc level rác → tô màu (bỏ viền) →
**Generate XYZ Tiles z10–18, PNG, Transparent → `qd205v8`** → nén WebP → copy vào `public/tiles/qd205v8`
→ config `maxzoom: 18` + `.webp` → khởi động lại.
