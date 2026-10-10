# Bộ kiểm tra phần tính quy hoạch bằng phiếu chính thức

Đối chiếu kết quả `computeQhTheoBan()` (apps/backend/src/lib/qhCompute.ts) với **phiếu kiểm tra quy hoạch /
bản trích đo của Văn phòng Đăng ký đất đai và Phòng Kinh tế xã Cam Lâm** (file `.dgn` đời V7).
Dựng 9/10/2026 với 78 phiếu (151 cặp phiếu × bản quy hoạch, 144.446 m²).

⚠️ Phiếu chứa họ tên người dân → **thư mục `du-lieu/` không đưa lên git**. Phiếu gốc để ở `Downloads\da`.

## Cách chạy
```bash
# 1. Đổi DGN V7 → GeoJSON (QGIS có sẵn ogr2ogr). DGN V8 thì phải lưu lại bằng MicroStation trước.
for f in *.dgn; do ogr2ogr -f GeoJSON -skipfailures "du-lieu/${f%.dgn}.geojson" "$f"; done
# 2. Đọc phiếu: bảng toạ độ VN-2000 + số liệu QH từng quyết định (+ số QHGT của từng thửa con nếu là phiếu tách thửa)
python doc_phieu2.py du-lieu/*.geojson | grep -v '"ban": {}' > mau_all.jsonl
# 3. Cho web tính (chạy trong container backend, sửa đường dẫn module trong tinh-bang-web.ts nếu cần)
# 4. Chấm điểm: python cham.py   (cần kq_cu.json + kq_moi.json để so code cũ với code mới)
```
Trên Windows Git Bash nhớ đặt `MSYS_NO_PATHCONV=1` trước `docker exec -w /app/...`, không thì đường dẫn bị đổi
sai **mà không báo lỗi** (đã vấp: tưởng chạy thử nghiệm nhưng thật ra đọc lại kết quả cũ).

## Kết quả 9/10/2026 (sau khi sửa)
- Chặt cả tên lẫn diện tích: đúng **93,5 %**. Bỏ qua khác biệt tên gọi nhóm chung của QĐ893: đúng **98,4 %**.
- 130/151 cặp khớp trong ±1 %. Code cũ → mới: tổng m² sai 10.000 → 9.410, **0 phiếu tệ đi**.

## Bổ sung 10/10/2026
- Đợt 2 (42 file): chỉ 1 file là phiếu kiểm tra QH (`bt (1)`, Cam Phước Tây, 16.586 m² rừng sản xuất) → web khớp 100 % cả QĐ205 lẫn QĐ893.
  Còn lại là trích lục / nguyên tờ bản đồ địa chính / hình thửa không chữ → không dùng để chấm.
- Bộ mẫu đầy đủ (79 phiếu) cất ở `du-lieu/mau_all.jsonl` (không lên git vì có họ tên).
- Lớp 23 (đỏ) trong tờ địa chính KHÔNG phải toàn bộ là chỉ giới QHGT — chỉ có 1 nhãn "Chỉ giới QHGT theo QĐ 507, 1180"; so thử chỉ khớp ~6 % → đừng dùng lớp này làm chuẩn lòng đường.

## Lớp địa chính trượt 0,55 m (10/10/2026)
Bộ chấm ở trên dùng HÌNH THỬA CỦA PHIẾU → không thấy lỗi này. Trên web thật, hình thửa lấy từ `dia_chinh`.
Cách đo: nạp ring phiếu (WGS84) vào bảng tạm, lấy thửa `dia_chinh` chồng nhiều nhất, chỉ giữ cặp có diện tích lệch
< 0,3 % (cùng một thửa), so tâm hai hình → 9/9 cặp lệch +0,533 m đông, +0,141 m bắc (độ lệch chuẩn ~1 cm).
Chạy lại phép so QH trên hình web (gốc / đã dịch) với hình phiếu: tổng lệch 60,7 → 4,4 m².
Phiếu có thửa web "trùng 0 %" là thửa mới tách / bản đồ chưa chỉnh lý — không dùng để đo độ trượt.

## Bẫy khi đọc phiếu
1. Chữ TCVN3 (ABC) — đổi bằng `tcvn3.py`.
2. Hai mẫu phiếu: mẫu cũ (Phòng Kinh tế, dòng "179.5 m thuộc…") và mẫu mới (VPĐK, dòng "+ Toàn bộ / + Diện tích còn lại…").
3. **Phiếu tách thửa**: con số ở "Thông tin quy hoạch" là TỔNG của thửa gốc; mỗi thửa con có ghi chú riêng
   "Tổng diện tích đất / Diện tích QHGT" — phải so với đúng thửa con.
4. Dòng "theo bản đồ QH kiến trúc cảnh quan" — web không dùng bản đồ này, bỏ qua.
5. Khung mẫu bỏ trống (dòng "+ m² thuộc…" không có số) — bỏ qua.
6. Cán bộ cũng sai: phiếu 3606 ghi tráo loại đất giữa QĐ893 và QĐ2076; ODT/ONT ghi không thống nhất.

## Những gì còn lệch (chưa sửa — cần chủ dự án quyết)
- QĐ893: ô không ghi mã → web ghi tên nhóm chung "Đất công cộng, dịch vụ, sản xuất" / "Đất ở"; phiếu ghi cụ thể
  (khu vui chơi, thể thao, ODT/ONT). Bản vẽ không có căn cứ (màu đã bị gộp số 11), quy tắc dự án: KHÔNG đoán.
  Cán bộ nhất quán: phân khu "cây xanh" ⇔ QĐ893 "khu vui chơi, giải trí công cộng" (6/7 phiếu).
  → ĐÃ CHỐT (chủ dự án 10/10/2026): KHÔNG suy 893 từ phân khu — mỗi bản xử lý theo đúng dữ liệu của bản đó.
  Ô 893 không có mã bên trong giữ tên nhóm chung. Đây là khác biệt CÓ CHỦ Ý, không phải lỗi.
- QĐ920 (Tây Nam): ô "Đất chưa sử dụng" (lớp HT, hoa văn CORK đúng chú giải) — phiếu ghi "sản xuất nông nghiệp".
  Bản web dùng là bản đã sửa; cần DXF của bản gốc để so.
- Ranh khác hẳn bản vẽ (Nguyễn Văn Đặng, Vũ Thị Lan, Trần Thị Niệm) — chủ dự án nhận định 10/10/2026: WEB dùng bản đồ
  MỚI HƠN, file của cán bộ có thể vẽ trên bản đồ CHƯA CHỈNH LÝ → không tính là lỗi của web, không chỉnh web theo 3 phiếu này.
- "Hành lang an toàn lưới điện" (phiếu 5644) — web chưa có lớp này.
