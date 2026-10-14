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

## QUY HOẠCH THEO TỪNG THỬA TỪ PDF (14/10/2026 — chờ chủ dự án duyệt, MẶC ĐỊNH TẮT)
Chủ dự án chọn 14/10/2026: tự bóc từ PDF (chưa chờ file gốc của Sở). Ba bước, chạy lại bao nhiêu lần cũng được:
```bash
# 1) BÓC vùng loại đất (2 lượt: lượt 1 quyết định loại đất từng MẢNG tô, lượt 2 vẽ lại từng ô 2048 điểm ảnh ở ~2 m/điểm ảnh)
python -P boc_loai_dat.py <pdf> <lng> <lat> nan/ranh-<huyen>.json 1.5 ra/<huyen>-loai-dat.geojson ra/<huyen>-thu.png --mau-chuan=bang-mau-chuan.json
#    in ra: số mảng theo nhãn / theo màu một mã / NHÓM / còn trống + 6 màu còn trống nhiều nhất (soi màu nào chưa có trong chú giải)
# 2) (khi thêm bản mới) LẬP LẠI BẢNG MÀU CHUẨN từ chú giải các bản đọc được đầy đủ (file .chu-giai.json do bước 1 ghi)
python -P lap_bang_mau_chuan.py bang-mau-chuan.json ra/*-loai-dat.chu-giai.json
# 3) NẠP vào cơ sở dữ liệu (xoá sạch bản đó rồi nạp lại trong một giao dịch)
python -P nap_qh_pdf.py <ban> "QHSDĐ 2030 · TP Cam Ranh" ra/<huyen>-loai-dat.geojson nan/ranh-<huyen>.json "<nguồn>" > nap.sql
docker compose exec -T postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 < nap.sql
```
`<ban>` phải trùng trường `pdf` của mục trong `MUC_QH` (`app/map/page.tsx`): camranh2030, nhatrang2030, ninhhoa2030, vanninh2030,
khanhson2030 (đã nạp) · dienkhanh2030, khanhvinh2030 (chưa nạp — chờ lớp bản đồ hai huyện được duyệt; nạp mà giao diện chưa có
mục thì thửa ở đó hiện khung quy hoạch trống).

Các luật đã chốt (mỗi luật sửa một lỗi thấy trên thửa thật, xem mô tả đầu `boc_loai_dat.py`):
- Gán theo TỪNG MẢNG tô (đúng ranh khu như bản vẽ) — bỏ cách "mỗi màu một loại + chia theo nhãn gần nhất" (cả vịnh Cam Ranh
  thành thuỷ sản, rừng chia mảnh cạnh thẳng) và bỏ "kế thừa mảng cùng màu gần nhất" (đoán).
- Nhãn PHÂN SỐ "CLN / TMD": hai mã xếp chồng thẳng hàng CÓ VẠCH NGANG ở giữa → lấy mã DƯỚI (quy hoạch). Nhận theo vị trí,
  không theo màu (Cam Ranh in mã đỏ nhưng PDF báo màu đen).
- KHUNG CHÚ GIẢI: mã ngoài ranh cỡ chữ to hơn nhãn (Cam Ranh 5,1–5,5 so với 4,1–4,5); bản in chữ cùng cỡ (Khánh Vĩnh) thì lấy mọi
  mã ngoài ranh. Màu bản vẽ lệch ô mẫu vài đơn vị → "gần nhất rõ ràng" (lệch ≤ 25, màu mã khác xa gấp ≥ 1,8 lần).
- BẢNG MÀU CHUẨN (`bang-mau-chuan.json`, 22 màu, mỗi màu ghi các bản xác nhận): bổ sung cho bản đọc chú giải thiếu — Ninh Hòa
  89,4 → 96,7 %, Diên Khánh (không có chữ nào) 0 → 94,8 %.
- Màu dùng chung nhiều mã → "NHÓM" đặt tên theo họ (đất trồng lúa / đất rừng / mặt nước / công trình công cộng…), không chọn bừa.
- NÉT DÀY chỉ là đất khi là đường hoặc nước (DGT, DTL, SON, MNC); ranh giới hành chính (hồng dày, gần màu ODT) trong suốt.
- Khe do nét viền ≤ 12 m lấy loại kề bên; mỗi vùng nới NỬA điểm ảnh (góc vuông) cho hai vùng kề nhau khít mép (trước hở 1 điểm
  ảnh, thửa sát ranh vùng hụt 5–10 % "chưa xác định"). Chồng nhẹ ở góc thì máy chủ chia lại theo tỷ lệ.
Kết quả 14/10: Cam Ranh 95,7 % · Nha Trang 94,8 % · Ninh Hòa 96,7 % · Vạn Ninh 96,7 % · Khánh Sơn 95,9 % · Diên Khánh 94,8 % ·
Khánh Vĩnh 97,8 % diện tích trong ranh có loại đất. Phần còn lại: mặt nước biển/vịnh, màu không có trong chú giải.
CHƯA LÀM: lô màu hồng cam công cộng (21 mã) không nhãn chỉ ra "nhóm"; thử thêm thửa ở Ninh Hòa (bản nhiều nét dày nhất: 17.847 nét
trong suốt).

### Thử trên thửa thật mà KHÔNG đụng web
Máy chủ thật có việc nền (nhắc lịch qua SMS, cào tin…) nên ĐỪNG chạy thêm một bản `index.ts`. Chạy riêng phần tra thửa trong
container tạm, gắn mã mới chỉ-đọc, mọi đường khác chuyển sang nginx (`thu/thu-server.mts`):
```bash
docker inspect camlam_backend --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^PATH=' > env.txt; echo QH_PDF_THU=1 >> env.txt
MSYS_NO_PATHCONV=1 docker run -d --name thu_api --network camlamgis_default -p 4001:4001 --env-file env.txt -w /app/apps/backend   -v "D:/Cam Lam gis/apps/backend/src:/app/apps/backend/src_moi:ro" -v "D:/Cam Lam gis/scripts/qh-tinh/thu/thu-server.mts:/app/apps/backend/thu-server.mts:ro"   camlamgis-backend node_modules/.bin/tsx thu-server.mts ; rm env.txt
cd apps/frontend && BACKEND_HOST=http://localhost:4001 npx next dev -p 3000      # bản thử giao diện
# xong: docker rm -f thu_api
```
Chụp ảnh tự động: `thu/chup.mjs` (cửa sổ Chrome bị che thì công cụ trình duyệt chụp ra hình đứng — dùng cái này, Chrome chạy ngầm). Soi một thửa trên PDF gốc: `thu/thu_thua.py` (diện tích + cắt PDF quanh thửa), `thu/soi_thua.py` (vẽ vùng đã bóc quanh thửa).

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

## QUY HOẠCH CHI TIẾT 1/500 CAM LÂM — BẢN CHÍNH THỨC, CHỈ ADMIN XEM (14/10/2026 tối)
6 đồ án, QĐ 2043–2048/QĐ-UBND ngày 25/9/2026 của UBND xã Cam Lâm. Nguồn: `quyhoach2025/1.500/` (6 file DGN V8 + 6 quyết định quét;
DXF: chủ dự án tự xuất 5 bản, Cam Hiệp Bắc xuất bằng `dgn_sang_dxf.py`). Bản DỰ THẢO 9 khu lấy ý kiến cùng mọi công cụ nắn của nó
(nan_1_500*.py, ranh_1_500.py, tinh_goc_1_500.py, tinh_ranh_net.py, kiem_nan_*.py, nan/1-500/) ĐÃ XOÁ theo lời chủ dự án.
- **Đổi DGN V8 → DXF:** `python -P dgn_sang_dxf.py <file.dgn> <thư mục tạm>` — MicroStation V8i trên máy (COM, File ▸ Save As ▸ DXF),
  làm trên BẢN SAO; file có model TRANG IN (sheet) thì Save As DXF qua COM lỗi → bỏ model trang in trên bản sao trước khi lưu.
- **In PDF:** `python -P in_1_500_dgn.py <file.dgn> <thư mục ra> <tên>` — MicroStation IN THẲNG PDF nét vector (y hệt MicroStation hiển
  thị: mẫu tô, kiểu nét, ký hiệu, chữ), vùng in = khung ranh lập quy hoạch (level `BV_Rg_lapquyhoach`, kiểu nét `QH_Ranh…`) nới 30 m,
  khổ giấy tự đặt cho tỷ lệ ~1:1000 (600 dpi, PDFPrecision 3 — toạ độ PDF 4 số lẻ). TOẠ ĐỘ KHÔNG ĐOÁN: trên bản sao DGN vẽ 4 DẤU CỘNG
  (4 m, màu 3) ở 4 góc vùng in, toạ độ VN-2000 biết trước → tìm lại trong PDF (nét đứt cũng nối lại được) → affine `<pdf>.nan.json`
  (`"afin"`), báo sai số: cả 6 bản < 0,01 mm, tỷ lệ 2 chiều bằng nhau.
- **Ranh cắt ô:** `python -P ranh_1_500_dxf.py <file.dxf> <ra>` — đa giác khép kín trên `BV_Rg_lapquyhoach` kiểu nét QH_Ranh (cung tròn
  tính đúng bằng `cung_chinh_xac.py`) → `<ra>.json` (ranh đúng) + `<ra>-cat.json` (nới 4 m để giữ trọn nét ranh in đậm).
- **Ô ảnh:** `tiler3.py <pdf> … <ra>-cat.json … qh500-<tên> 12 20` → `gop_tile.py` gộp 6 bộ thành `qhct500-v1`.
  Kiểm: `kiem_o_1_500.py <thư mục ô> <z> <ranh.json> <ảnh> --dc` — ghép ô, vẽ ranh DXF + ranh thửa địa chính, ĐO nét ranh in đỏ cách
  ranh DXF (Gia đình Quân đội: trung vị −1,3 cm, Cam Đức −1,4 cm ở mức 18–19).
- **Lên web (CHỈ ADMIN):** `lap_danh_sach_qh_rieng.py` → `D:\KhoQH\qh-rieng\danh-sach.json`; ô ở `D:\KhoQH\qh-rieng\tiles\qhct500-v1\`,
  quyết định ở `tai-lieu\`. `dua-len-web-14-10.sh` chép vào volume riêng `camlamgis_qh_rieng`; máy chủ `routes/qhRieng.ts` kiểm vé admin
  từng ô. ⚠️ MicroStation qua COM: không chạy 2 kịch bản cùng lúc; dùng `win32com.client.dynamic.Dispatch`.

- **ẢNH NÉT GẤP ĐÔI — `tiler3.py` (thay tiler2):** ô 512 điểm ảnh WebP (web vẫn khai tileSize 256 → điện thoại nét gấp đôi), MỖI MỨC
  PHÓNG VẼ LẠI TỪ PDF theo khối 4×4 ô bằng DisplayList (tiler2 lấy mẫu một ảnh lớn cho mọi mức → mức xa lấm tấm, mất nét mảnh),
  siêu lấy mẫu ×2 + gộp điểm ảnh với alpha nhân trước, toạ độ lưới 9×9 điểm chính xác mỗi ô (đúng cả nắn "luoi" gãy khúc).
  WebP 512 còn NHẸ HƠN PNG 256 cũ (Nha Trang 43 so với 66 MB). QHSDĐ 2030: z9–17; 1/500: z12–20. `gop_tile.py` nay gộp được .webp
  và chồng alpha đúng công thức. Đưa lên web: `dua-len-web-14-10.sh` (một lệnh: chép ô vào volume, nạp qh_pdf Diên Khánh/Khánh Vĩnh,
  dựng lại web, bật cờ qh_pdf_bat, kiểm thử, xoá bộ ô cũ). Kho: PDF ở `D:\KhoQH\qhsdd-2030\`, ô ảnh `D:\KhoQH\tiles-qh\`,
  file nạp `D:\KhoQH\qh-pdf\`.

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
