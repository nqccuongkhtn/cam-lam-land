# Dựng lớp QUY HOẠCH SỬ DỤNG ĐẤT 2030 cho cả tỉnh từ PDF chính thức của Sở

Bộ công cụ biến **bản đồ QHSDĐ 2030 dạng PDF** (Sở Nông nghiệp & Môi trường Khánh Hòa công bố)
thành **lớp tile ảnh** chồng lên bản đồ web — y như cách Cam Lâm làm, nhưng nguồn là PDF thay vì CAD.
Làm 13/10/2026.

## Vì sao làm được chính xác
Các bản PDF này là **bản vẽ NÉT VECTOR** (không phải ảnh scan), có **lưới km VN-2000 in sẵn** và
**bảng chú giải màu**. Nên tách được vùng loại đất + nắn toạ độ theo đúng lưới → sai số ~vài mét.

## Quy trình (mỗi bản chạy 4 bước)
```bash
# Máy cần: Python 3 + pymupdf + pyproj + opencv-python + numpy + shapely
#   pip install pymupdf pyproj opencv-python numpy shapely
# Chạy với python -P (chặn nạp nhầm module cạnh file PDF); PDF là dữ liệu, truyền qua tham số.

cd scripts/qh-tinh
TAM_LNG=109.18; TAM_LAT=12.245     # toạ độ gần đúng giữa khu vực (chỉ để chọn "hàng trăm km")

# 1) KIỂM NẮN TOẠ ĐỘ (phải ra R2≈1,0 và toạ độ góc đúng vị trí thật)
python -P nan2.py  ban-do.pdf  $TAM_LNG $TAM_LAT

# 2) TÁCH RANH (lấy vùng màu lớn nhất = thân bản đồ, tự bỏ chú giải/sơ đồ/chữ ký ở góc)
python -P ranh_tu_pdf.py  ban-do.pdf  $TAM_LNG $TAM_LAT  ra/ranh.json  ra/ranh-viz.png
#   → MỞ ranh-viz.png xem đường đỏ có ôm đúng khu vực không.

# 3) ẢNH THỬ chồng vệ tinh (xác nhận khớp vị trí thật TRƯỚC khi cắt đủ)
python -P proof.py  ban-do.pdf  $TAM_LNG $TAM_LAT  <lng0> <lat0> <lng1> <lat1>  14  ra/thu.png

# 4) CẮT TILE (z9–16, cắt gọn theo ranh, nền trong suốt, khớp AFFINE mỗi ô)
python -P tiler2.py  ban-do.pdf  $TAM_LNG $TAM_LAT  ra/ranh.json  ra/tiles  tenlopv1  9 16  1.8
#   (số cuối = độ nét ảnh nguồn; 1.8 cho bản ~1:25.000)
```

## Đưa lên web
1. Chép thư mục tile vào volume `camlamgis_camlam_tiles`:
   ```bash
   docker create --name t -v camlamgis_camlam_tiles:/dest camlamgis-frontend:latest true
   docker cp ra/tiles/tenlopv1 t:/dest/ ; docker rm t
   ```
2. Thêm lớp trong `apps/frontend/src/app/map/page.tsx` (4 chỗ, xem lớp `qh-ninhhoa2030` làm mẫu):
   `RASTER_OVERLAYS` (tiles+coordinates) · `MUC_QH` (menu) · `CAN_CU_QH` (căn cứ) · `ovOn` (mặc định tắt).
3. Dựng lại + xoá đệm:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.tunnel.yml up -d --no-deps --build frontend
   docker compose ... restart nginx
   docker exec camlam_nginx sh -c 'rm -rf /var/cache/nginx/[0-9a-f]'
   ```
   ⚠️ Đổi tile mà GIỮ tên thư mục cũ thì nginx/Cloudflare giữ ảnh cũ 1 năm → PHẢI tăng số (v1→v2).
   ⚠️ Trình duyệt là PWA: thử trên máy mình phải xoá Service Worker + cache mới thấy bản mới.

## Đã làm xong (lên web, kiểm trên trình duyệt)
| Khu vực | Tên lớp | Nguồn PDF (Sở) | Ghi chú |
|---|---|---|---|
| Thị xã Ninh Hòa | ninhhoa2030**v2** | `Portals/0/2b_ Ban do DCQHSD dat den nam 2030 Tx Ninh Hoa.pdf` | 1:25.000 |
| TP Nha Trang | nhatrang2030v1 | `Portals/0/2022/Dat-dai/NhaTrang2030.pdf` | 1:27.000 |
| Huyện Khánh Sơn | khanhson2030v1 | `Portals/0/2022/Dat-dai/KhanhSon2030.pdf` | 1:25.000 |
| Huyện Vạn Ninh | vanninh2030v1 | `Portals/0/DCQH2030 VAN NINH.pdf` | 1:25.000 |
| TP Cam Ranh | camranh2030v1 | `Portals/0/2022/Dat-dai/CamRanh2030.pdf` | 1:25.000 (nắn bằng dò lưới vector) |

(Cam Lâm đã có sẵn QĐ205/893 + phân khu dựng từ CAD — không làm lại.)

## CÁCH NẮN KHI NHÃN LƯỚI VẼ THÀNH NÉT (không đọc được chữ) — ĐÃ CHẠY ĐƯỢC cho Cam Ranh
Vài bản (Cam Ranh, Diên Khánh, Khánh Vĩnh) in nhãn lưới dạng NÉT VẼ nên `nan2.py` không tự đọc được.
Cách làm được (Cam Ranh thành công, R²=1,0, đúng 113,38 pt/km):
1. **Render bản đồ, đọc BẰNG MẮT 1 nhãn lưới** ở góc (vd Cam Ranh đông 582.0 @ góc trái; Diên Khánh đông
   574000, bắc 1372000) → suy phép nắn THÔ: `se=1000/113.386`, neo 1 điểm.
2. `proof_manual.py <pdf> <se> <ie> <sn> <inn> <bbox> <z> <ra>` — ảnh thử THÔ. Nếu đã gần đúng (lệch < 1 km) → bước 3.
3. `grid_vec.py <pdf> <se0> <ie0> <sn0> <inn0> <bước_km>` — dò **đường lưới trong NÉT VECTOR** (nét dài thẳng,
   TRÁNH được nước biển vì nước là vùng tô, không phải nét), làm tròn về đúng giá trị lưới → **khớp chính xác**.
4. Lưu kết quả vào file kèm `<pdf>.nan.json` `{"se":..,"ie":..,"sn":..,"inn":..}` → `nan2.py` tự đọc, cả
   `ranh_tu_pdf.py` / `tiler2.py` / `proof.py` chạy như thường.

**✅ DIÊN KHÁNH + KHÁNH VĨNH ĐÃ NẮN CHUẨN (14/10/2026) — `nan_luoi_dut.py`.** Hai bản này vẽ đường lưới thành
NHIỀU ĐOẠN NGẮN nối nhau (không phải 1 nét dài) nên `grid_vec.py` ra rỗng. Cách làm: gom MỌI đoạn thẳng ngang/dọc theo toạ độ,
đường nào tổng dài > 1/4 khung là đường lưới; dò NỐI TIẾP (đường sau tìm quanh đường trước + 1 ô) → khớp bình phương nhỏ nhất.
Chỉ cần đọc bằng mắt NHÃN của 1 đường dọc + 1 đường ngang:
```bash
python -P nan_luoi_dut.py <pdf> <x_duong_doc_dau_pt> <E> <y_duong_ngang_dau_pt> <N> <buoc_pt> <buoc_m> <pdf>.nan.json
# Diên Khánh: 164.5 574000 249.0 1372000 173.5 2000  → sai số TB 0,4 m (Đông) / 1,2 m (Bắc), 13 + 17 đường
#   (bản in KHÔNG đúng 1:25.000: 86,75 pt/km — phép "khớp tâm" cũ giả định 113,4 pt/km nên lệch ~100 m)
# Khánh Vĩnh: 526.4 548000 548.8 1382000 226.5 2000   (nhãn ghi tắt km: "46.0" = 546.000, "82.0" = 1.382.000;
#   đường 297,8 là KHUNG, không phải lưới) → 19 + 21 đường
```
⚠️ **Khánh Vĩnh in lưới KHÔNG ĐỀU** (phía tây ô 226,5 pt, phía đông 227,0 pt) → một phép thẳng lệch tới 10 m ở mép đông.
Nên file nắn có thêm `"luoi": {"x":[…],"E":[…],"y":[…],"N":[…]}` = vị trí từng đường lưới; `nan2.lap_phep_doi` thấy mục này thì
NẮN THEO TỪNG Ô LƯỚI (nội suy giữa các đường, đúng tại mọi đường lưới) và trả thêm `p2en` / `en2p`; `tiler2.py`, `proof.py`,
`ranh_tu_pdf.py` dùng chung hai hàm đó (file nắn KHÔNG có "luoi" thì y như cũ — 5 bản đã lên web không đổi).
Bản sao file nắn + ranh: `scripts/qh-tinh/nan/` (PDF gốc nằm trong kho tài liệu, xem sổ KHO-QH.md).
Ảnh thử (chồng vệ tinh): `bao-cao-qh/anh-thu-qh/dien-khanh-2030-THU-*.png`, `khanh-vinh-2030-THU-*.png` — CHỜ CHỦ DỰ ÁN DUYỆT
rồi mới chép tile (`dienkhanh2030v1`, `khanhvinh2030v1`, đã cắt sẵn z9–16 ở thư mục nháp) + thêm lớp vào `app/map/page.tsx`.

**BÓC LOẠI ĐẤT THEO THỬA TỪ PDF — `boc_loai_dat.py` (ĐANG LÀM, CHƯA DÙNG CHO WEB).** Mục tiêu: tính diện tích từng loại đất trên
từng thửa cho các huyện ngoài Cam Lâm (chủ dự án chọn 14/10/2026: tự bóc từ PDF, chưa chờ file gốc của Sở).
Cách: vẽ lại mọi mảng tô theo đúng thứ tự vẽ của PDF → mỗi MẢNG lấy mã theo nhãn nằm trong nó; nhãn PHÂN SỐ "CLN / TMD" lấy mã
DƯỚI (quy hoạch); mảng không nhãn thì theo KHUNG CHÚ GIẢI (màu chỉ in cho đúng 1 mã) hoặc ghi "NHÓM … chưa rõ loại"; xuất GeoJSON
WGS84 cắt theo ranh. Thử Cam Ranh (S=1,5 → 5,9 m/điểm ảnh): phủ 94 % trong ranh; thửa 246 tờ 8 Cam Phúc Nam ra TMD 831,4 m² (đúng
bản vẽ "CLN/TMD"). CÒN PHẢI SỬA trước khi đưa lên web: (1) đọc chú giải đôi khi ghép màu với mã của dòng bên cạnh (ruộng lúa vàng ra
nhóm "DTL/NTS"); (2) nhận phân số theo vị trí đôi khi bắt nhầm 2 nhãn của 2 thửa liền nhau (2.767 mã bị bỏ — cần kiểm thêm vạch
ngang phân số); (3) màu hồng cam công cộng dùng chung 22 mã → nhiều lô chỉ ra "nhóm"; (4) nối vào `/api/parcels/at` (bảng PostGIS
riêng + trang "Quy hoạch sử dụng đất 2030" trong bảng thông tin thửa; phiếu trích lục vẫn chỉ cho Cam Lâm).

**(CŨ, giữ để tham khảo) CÒN LẠI Diên Khánh + Khánh Vĩnh:** đường lưới KHÔNG phải nét dài đơn (grid_vec ra rỗng), dò cyan thì lẫn
sông → tự động chưa chuẩn. **Nắn tay QGIS** (mở PDF, chọn 3–4 giao điểm lưới) là nhanh nhất. Số lưới đã biết:
- Diên Khánh (1:25.000): đông 574000/576000/578000/580000/582000; bắc 1372000/1370000/1368000 (bước 2 km).
- Khánh Vĩnh: còn lẫn nhãn bình độ 1100/1200 + ảnh JPEG nhúng — xem kỹ khi nắn.
Nắn tay xong thì ghi `se/ie/sn/inn` vào `<pdf>.nan.json` rồi chạy `ranh_tu_pdf.py` + `tiler2.py` như Cam Ranh.

**ĐÃ THỬ KHỚP TÂM (nan_tam.py) cho Diên Khánh — GẦN ĐÚNG ~100m, CHƯA đủ chuẩn để đưa lên:**
Ý tưởng: bản 1:25.000 nên BIẾT độ phóng (113,386 pt/km), bắc-lên không xoay → chỉ cần tịnh tiến; lấy ranh
hành chính OSM (Nominatim relation "historic" của đơn vị cũ) → khớp TÂM vùng màu QH với tâm ranh = ra ie/inn.
`python nan_tam.py <pdf> <osm_ranh.json> 113.386 <ra.nan.json>`. Diên Khánh ra lệch tâm ~100m vì vùng màu bị
tách mảnh (largest-CC chỉ bắt 213/341 km²) → tâm lệch. Dùng được làm ĐIỂM KHỞI ĐẦU cho QGIS (đã gần), nhưng
phải tinh chỉnh bằng điểm mốc lưới mới chính xác bằng 5 bản kia. Phép nắn thô Diên Khánh (tham khảo):
`se=8.819431 ie=575449.13 sn=-8.819431 inn=1370776.59`. Lấy ranh OSM: 
`curl -H "User-Agent: x" "https://nominatim.openstreetmap.org/lookup?osm_ids=R<id>&format=json&polygon_geojson=1"`
(Cam Ranh R7081247, Diên Khánh R7081531; tìm id bằng /search ...&featuretype=settlement).

## Ninh Thuận cũ (nay thuộc Khánh Hòa) + cấp tỉnh
Tên miền `ninhthuan.gov.vn` đã ngừng sau sáp nhập 1/7/2025, cổng Khánh Hòa chưa chuyển dữ liệu về.
Bản đồ QHSDĐ cấp tỉnh không đăng PDF công khai (nằm trong phụ lục hồ sơ QH tỉnh). → Chờ nguồn.

## Nắn toạ độ — chi tiết kỹ thuật
- `vn2000.py` = bản chuyển Python của `apps/backend/src/lib/vn2000.ts` (VN-2000 Khánh Hòa, KTT 108°15',
  k=0.9999, Helmert 7 tham số) → lớp mới khớp 100% lớp Cam Lâm + địa chính. ĐỪNG sửa hằng số.
- `nan2.py` tự nhận 3 kiểu ghi nhãn lưới: viết tắt 2 số (Ninh Hòa, Khánh Sơn), đủ mét tách "595 000"
  (Nha Trang), km 3-4 số kèm .0/.5. Mỗi "đường" nhãn tự khớp riêng, chỉ nhận đường khớp tốt
  (R²>0,995, 80<pt/km<320) → loại nhãn rải trong thân bản đồ.
- `tiler2.py`: render PDF 1 lần, mỗi ô tile KHỚP AFFINE từ lưới 4×4 điểm rồi áp cả ô. ⚠️ KHÔNG dùng
  `cv2.resize` lưới thô để phóng bản đồ toạ độ — nó kẹp mép làm **nhoè một dải** giữa bản đồ (đã vấp).
