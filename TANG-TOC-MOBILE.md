# Tăng tốc bản đồ + ảnh trên điện thoại

Nút thắt lớn nhất: ảnh và dữ liệu bản đồ đi từ **máy nhà → qua tunnel → tới điện thoại**,
nên bị giới hạn bởi tốc độ **UPLOAD mạng nhà**. Cách xử lý như các web lớn: cho **Cloudflare
cache ở biên** (gần người dùng) để lần sau tải thẳng từ Cloudflare, không đụng tới máy nhà.

## Đã sửa trong code (chỉ cần Khởi động lại để áp dụng)

1. **Ảnh có đuôi `.webp`** → Cloudflare TỰ ĐỘNG cache ảnh ở biên (không cần cấu hình gì thêm).
   - Thẻ tin / danh sách: dùng ảnh thu nhỏ ~40KB.
   - Trang chi tiết: dải ảnh nhỏ cũng dùng thumbnail (trước đây tải ảnh gốc 280KB — rất phí).
2. **Quy hoạch tải nhanh vượt trội (quan trọng nhất)**: đổi nền quy hoạch từ **pmtiles 147MB**
   (range-request động, không cache được — self-host còn phải tải file 147MB lúc chạy) sang
   **tile PNG rời** `/tiles/qd205v3/{z}/{x}/{y}.png`. Vì là file `.png`, **Cloudflare tự cache ở biên**
   → mở quy hoạch trên điện thoại nhanh hơn nhiều. Dữ liệu tra khi bấm (2.1MB) nạp trễ để tile hiện trước.
3. **Bản đồ nhẹ hơn**: lớp "ranh xã" (384KB) chỉ tải khi bật (mặc định tắt).
4. **nginx cache lâu** cho geojson / tiles / overlay → trình duyệt chỉ tải 1 lần.
5. **Chấm tròn tin thường** hiện giá từ zoom **16** (trước là 17) — dễ đạt trên điện thoại.
6. **Thanh dưới kiểu Facebook**: tối giản (chỉ icon, tô đặc khi đang ở tab), tự ẩn khi lướt xuống / hiện khi lướt lên.

## Cần làm 1 lần trên Cloudflare (để cache dữ liệu bản đồ `.geojson`)

Ảnh đã tự cache, nhưng file bản đồ `.geojson` và `/tiles` thì Cloudflare chưa cache mặc định.
Thêm 1 **Cache Rule** (miễn phí):

1. Vào https://dash.cloudflare.com → chọn domain **batdongsancamlam.dpdns.org**.
2. Menu trái: **Caching → Cache Rules → Create rule**.
3. Đặt tên: `Cache ban do & anh`.
4. Điều kiện (When incoming requests match): chọn **Custom filter expression**, dán:

   ```
   (http.request.uri.path contains "/api/images/") or
   (ends_with(http.request.uri.path, ".geojson")) or
   (ends_with(http.request.uri.path, ".pmtiles")) or
   (http.request.uri.path contains "/tiles/") or
   (http.request.uri.path contains "/overlays/")
   ```

5. Then (Cache eligibility): chọn **Eligible for cache**.
6. Mục **Edge TTL**: chọn **Use cache-control header if present, use default of ...** → đặt default **1 month**.
   (Hoặc "Ignore cache-control header and use this TTL" = 1 month.)
7. Bấm **Deploy**.

Sau đó mở web trên điện thoại vài lần — lần đầu vẫn tải từ máy nhà, những lần sau (và với
người dùng khác ở cùng khu vực) sẽ tải từ Cloudflare → nhanh hơn nhiều.

## Kiểm tra có cache chưa

Mở web trên máy tính → F12 → tab **Network** → tải lại → bấm vào 1 ảnh (`.webp`) hoặc file
`.geojson` → xem cột **Response Headers**:
- `cf-cache-status: HIT` = đã cache ở Cloudflare (đạt).
- `MISS` lần đầu là bình thường; tải lại vài lần sẽ thành `HIT`.

## Nếu vẫn thấy chậm (tuỳ chọn nâng cao)

- Trên bản đồ **danh sách nhà đất**, lớp "quy hoạch" đang bật sẵn — có thể để **tắt mặc định**
  cho gọn (chỉ bật khi cần) nếu muốn nhẹ hơn nữa. Báo mình nếu muốn đổi.
- Về lâu dài: chuyển ảnh sang **Cloudflare R2** (kho ảnh trên mây) để không phụ thuộc mạng nhà.
