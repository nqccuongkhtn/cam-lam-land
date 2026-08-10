# Hướng dẫn: Bản đồ quy hoạch nét tới z18 — MIỄN PHÍ (PMTiles + Cloudflare R2)

> Mục tiêu: hiển thị bản đồ quy hoạch **nét tới mức z18** (từng thửa cực rõ), **màu chuẩn QGIS**, **hoàn toàn miễn phí**, và **không còn cảnh 79.000 file** làm nghẽn git/Render.

---

## Vì sao cách này chạy được (đọc 30 giây)

- **PMTiles** = gộp TẤT CẢ ô tile (z1→z18) vào **1 file duy nhất**. Trình duyệt chỉ tải đúng "khúc" tile đang xem (HTTP range request) → nhanh, nhẹ, **không còn hàng chục nghìn file**.
- **Cloudflare R2** = kho lưu trữ: **10GB miễn phí, băng thông (egress) MIỄN PHÍ vĩnh viễn**, 10 triệu lượt đọc/tháng free. Thừa cho web của bạn.
- File PMTiles nằm trên R2, **không đụng git/Render** → repo nhẹ, build nhanh như cũ.

**Ai làm gì:**
| Việc | Ai làm |
|---|---|
| Xuất MBTiles z18 từ QGIS | Bạn (1 thao tác, ra 1 file) |
| Đổi MBTiles → PMTiles | Bạn chạy 1 lệnh (hoặc tôi làm nếu file gửi được) |
| **Tạo tài khoản Cloudflare** | **Bạn** (tôi không được tạo tài khoản/nhập mật khẩu giúp) |
| Tạo bucket + upload + cấu hình | Bạn, HOẶC tôi điều khiển trình duyệt làm giúp sau khi bạn đăng nhập |
| Sửa code web đọc PMTiles | **Tôi** làm hết |

---

## PHẦN 1 — Xuất 1 file MBTiles z18 từ QGIS

Giống hệt lần trước, chỉ khác **2 điểm**: chọn bản **MBTiles** (ra 1 file) và **Maximum zoom = 18**.

1. Mở lại project QGIS (các lớp quy hoạch đang đúng màu).
2. **Tắt** các lớp khung/chữ/ký hiệu như lần trước (Khung A0, text, kyhieu…).
3. **View → Zoom Full**, rồi zoom cho **bó sát vùng Cam Lâm** (đừng để dư khung rộng — dư sẽ làm file to vô ích).
4. Processing → Toolbox → gõ `xyz` → chọn **Generate XYZ tiles (MBTiles)** *(chú ý: bản MBTiles, KHÔNG phải Directory)*.
5. Thiết lập:
   - **Extent**: Use Current Map Canvas Extent (đã zoom bó sát).
   - **Minimum zoom**: `10`
   - **Maximum zoom**: `18`
   - **DPI**: `96` · **Background color**: để trống (trong suốt) · **Tile format**: **PNG**
   - **Output file**: chọn nơi lưu, đặt tên `qd205.mbtiles`
6. **Run**. Ra **1 file `qd205.mbtiles`** duy nhất (không phải thư mục — nên không lo số file).

> Nếu file mbtiles > vài trăm MB: quay lại bó extent sát hơn, hoặc hạ Max zoom xuống 17. Mục tiêu file gọn (< ~500MB).

---

## PHẦN 2 — Đổi MBTiles → PMTiles

**Cách A — dùng plugin ngay trong QGIS (dễ nhất):**
1. QGIS → menu **Plugins → Manage and Install Plugins**.
2. Tìm **"PMTiles"** → **Install**.
3. Dùng chức năng của plugin để **Convert MBTiles → PMTiles** → ra file `qd205.pmtiles`.

**Cách B — dùng công cụ dòng lệnh `pmtiles`:**
1. Tải `pmtiles` cho Windows: https://github.com/protomaps/go-pmtiles/releases (chọn file `..._Windows_x86_64.zip`), giải nén ra `pmtiles.exe`.
2. Để `pmtiles.exe` cùng thư mục với `qd205.mbtiles`.
3. Mở **PowerShell** tại thư mục đó, chạy:
   ```
   .\pmtiles convert qd205.mbtiles qd205.pmtiles
   ```
4. Ra file **`qd205.pmtiles`**.

---

## PHẦN 3 — Tạo tài khoản Cloudflare + kho R2 *(phần bắt buộc là bạn)*

> Tôi không được phép tạo tài khoản/nhập mật khẩu thay bạn. Bạn làm bước này (~2 phút), sau đó tôi giúp phần còn lại.

1. Vào **https://dash.cloudflare.com/sign-up** → đăng ký bằng email + mật khẩu (miễn phí).
2. Xác minh email.
3. Trong dashboard, cột trái chọn **R2**. (Cloudflare có thể hỏi thêm thẻ để xác minh — **không trừ tiền** khi còn dưới 10GB; nếu ngại thẻ, xem "Phương án B" cuối file.)
4. Bấm **Create bucket** → đặt tên, ví dụ `camlam-tiles` → **Create**.

---

## PHẦN 4 — Upload file + bật public + CORS

*(Sau khi bạn đăng nhập xong, báo tôi — tôi có thể điều khiển trình duyệt làm hết 3 mục dưới đây giúp bạn. Hoặc bạn tự làm theo:)*

1. Vào bucket `camlam-tiles` → **Upload** → chọn file **`qd205.pmtiles`** → chờ upload xong.
2. **Bật truy cập công khai**: bucket → **Settings** → mục **Public access** → bật **R2.dev subdomain** (Allow Access) → copy đường link công khai, dạng:
   `https://pub-xxxxxxxx.r2.dev`
3. **Bật CORS** (để trình duyệt tải được): bucket → **Settings** → **CORS Policy** → **Add** → dán:
   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["range", "if-match"],
       "ExposeHeaders": ["etag", "content-length", "content-range"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. Link cuối cùng của file sẽ là:
   `https://pub-xxxxxxxx.r2.dev/qd205.pmtiles`
   → **gửi link này cho tôi.**

---

## PHẦN 5 — Sửa code web đọc PMTiles *(tôi làm hết)*

Khi có link `.pmtiles`, tôi sẽ:
1. Thêm thư viện `pmtiles` vào frontend (đăng ký protocol cho MapLibre).
2. Đổi nguồn overlay từ tiles thư mục sang:
   ```
   type: 'raster', url: 'pmtiles://https://pub-xxxx.r2.dev/qd205.pmtiles', maxzoom: 18
   ```
3. Xoá các thư mục tile cũ (qd205v3/qd205v4) cho repo nhẹ.
4. Bạn chỉ cần **Commit + Push** một lần cuối → Live → **nét tới z18, màu chuẩn, miễn phí**.

---

## Phương án B — KHÔNG cần thẻ (dùng GitHub Releases)

Nếu bạn không muốn thêm thẻ vào Cloudflare, có thể host file `.pmtiles` trên **GitHub Releases** (bạn đã có tài khoản GitHub):
1. Vào repo `cam-lam-land` trên github.com → **Releases** → **Draft a new release**.
2. Kéo-thả file `qd205.pmtiles` vào phần **Attach binaries** → **Publish release**.
3. Copy link tải của file (dạng `https://github.com/.../releases/download/.../qd205.pmtiles`) → gửi tôi.

*(Cách này free, không cần thẻ, dùng tới 2GB/file. Nhược điểm: đôi khi CORS/tốc độ không ổn định bằng R2 — nếu gặp lỗi tải, ta chuyển sang R2.)*

---

## Tóm tắt việc BẠN cần làm
1. QGIS: xuất `qd205.mbtiles` (Max zoom 18) → đổi ra `qd205.pmtiles`.
2. Tạo tài khoản Cloudflare (hoặc dùng GitHub Releases).
3. Upload file + lấy link (mục này tôi làm giúp qua điều khiển trình duyệt được).
4. Gửi tôi cái link → tôi sửa code → bạn Push 1 lần → xong.
