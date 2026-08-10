# Tô ĐẶC màu quy hoạch — TÔ THẲNG TỪ DGN (không dùng geojson) → cắt `qd205v11`

> Mục tiêu: z18 **đặc màu, rõ zone** (không kẻ sọc), nhẹ hơn (~5–7 lần).
> Đã xác nhận: các lớp đất trong dự án là **VÙNG (polygon)** — bản đồ đã tô màu → **không cần geojson, không cần Polygonize**. Chỉ đổi lớp đang **kẻ sọc** sang **tô đặc**.

---

## Việc cần làm: đổi lớp KẺ SỌC → TÔ ĐẶC

Với **mỗi lớp đang hiển thị kiểu gạch/sọc** (trên bản đồ là mảng hồng chéo, vàng chéo…):

1. **Double-click** lớp đó (trong bảng Layers) → tab **Symbology**.
2. Bấm vào dòng symbol con → ô **Symbol layer type** đang là **“Line pattern fill”** (hoặc *SVG fill* / *Point pattern fill*) → đổi thành **“Simple fill”**.
3. **Fill color**: giữ đúng **màu loại đất** của lớp đó.
4. **Stroke → No Pen** (bỏ viền, phủ kín) → **Apply → OK**.

> **Nhân nhanh:** chỉnh xong 1 lớp → chuột phải lớp → **Styles → Copy Style**;
> sang lớp sọc khác → **Styles → Paste Style**, rồi chỉ sửa lại **Fill color** cho đúng màu.

- Lớp nào **đã đặc màu sẵn** (teal nước, xanh rừng, kem, đỏ…) → **để yên**.
- Giữ nguyên các lớp **ranh / đường / ký hiệu / chữ** (nét mảnh) — chúng vẽ đè lên nền đặc cho có chi tiết.

## Nếu lớp là ĐƯỜNG (line), không phải vùng
Dấu hiệu: double-click lớp mà Symbology **không có** “Simple fill”, chỉ có kiểu đường.
→ Chọn lớp ranh đó: **Processing → Toolbox → “Lines to polygons”** → Input = lớp line → **Run**
→ ra lớp polygon (giữ nguyên cột thuộc tính) → rồi tô như trên (Simple fill, No Pen).
*(Vẫn không cần geojson.)*

## Cắt lại XYZ Tiles → `qd205v11`
**Processing → Generate XYZ Tiles (Directory)** — thông số **y hệt lần trước**, CHỈ đổi:
| Mục | Giá trị |
|---|---|
| Extent | `108.935,109.250,11.925,12.220 [EPSG:4326]` |
| Min / Max zoom | **10 / 18** |
| DPI 96 · PNG · Background **None** · Metatile 4 · 256×256 · Antialias ✓ |
| **Output directory** | `D:\Cam Lam gis\apps\frontend\public\tiles\`**`qd205v11`** ← thư mục MỚI |

→ **Run** → đợi **xong 100%** → nhắn **“xong v11”**.

## Sau đó
Mình đổi config 2 file (`map/page.tsx`, `listings/page.tsx`) sang `qd205v11` + kiểm tra tile đặc/đủ.

---

### Lưu ý về kịch bản
Các lớp đang bật đều tên **`HT_...`** = **HIỆN TRẠNG** sử dụng đất.
- Nếu muốn overlay là **QUY HOẠCH tương lai** → tắt nhóm `HT_`, bật nhóm **`QH_`** (QH2030 / QH2045) rồi mới cắt.
- Nếu chủ ý hiển thị hiện trạng → giữ nguyên.

### Vì sao tô đặc lại NHẸ hơn
PNG nén khối màu đồng nhất rất tốt: 1 tile đặc ~**0,9 KB** vs 1 tile gạch ~**11 KB**. Cả bộ có thể từ **739 MB → ~100–150 MB**, mà z18 lại đặc/rõ hơn.
