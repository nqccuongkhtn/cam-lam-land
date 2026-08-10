# Cam Lâm Land — Tốc độ & Mở rộng (như web lớn)

Tài liệu này ghi lại: (1) các đòn tăng tốc **đã áp dụng**, (2) cách **sao lưu / phòng máy hư**, và (3) **lộ trình mở rộng** khi lượng truy cập & dữ liệu tăng — theo cách các web lớn xử lý.

---

## 1. Đã áp dụng (tăng tốc ngay)

| Đòn | Làm gì | Lợi ích |
|---|---|---|
| **Nén gzip** (nginx) | Nén HTML/JS/CSS/JSON/GeoJSON trước khi gửi | Dữ liệu bản đồ & trang nhẹ đi **80–90%** → tải nhanh hơn nhiều |
| **Cache nginx** | Lưu lại **ảnh tin** + **lớp bản đồ** (theo Cache-Control của backend); phần đăng nhập/no-store thì bỏ qua | Không phải hỏi lại database mỗi lần → ảnh & bản đồ ra tức thì ở lần sau |
| **Tinh chỉnh PostgreSQL** | Tăng `shared_buffers`, `effective_cache_size`, tối ưu cho SSD (`random_page_cost=1.1`) | Truy vấn bản đồ/tin nhanh hơn |
| **Bản đồ đã tối ưu sẵn** | Toạ độ 6 chữ số + đơn giản hoá hình theo mức zoom + cache 120s | GeoJSON nhẹ, ít tải |

> Áp dụng: mở **QUAN-LY-SERVER → Khởi động lại** (build lại + nạp cấu hình mới).

---

## 2. Sao lưu & phòng máy hư (dữ liệu KHÔNG bao giờ mất)

Nguyên tắc web lớn: **dữ liệu quan trọng luôn ở ≥ 2 nơi**.

- **SAO-LUU.bat** — xuất toàn bộ database (kèm ảnh) ra `backup\`, giữ **14 bản gần nhất**, và **tự copy bản mới nhất ra cloud** (OneDrive/Proton/Google Drive) → máy hư vẫn còn dữ liệu.
- **CAI-DAT-BACKUP-TU-DONG.bat** — chạy 1 lần để **tự sao lưu mỗi ngày lúc 2h sáng** (Windows Task Scheduler).
- **PHUC-HOI.bat** — khôi phục lại từ bản sao lưu.
- **Render vẫn là bản dự phòng** — có thể đẩy code + dữ liệu lên Render bất cứ lúc nào (KEO-DU-LIEU-RENDER.bat kéo về, hoặc đẩy ngược lên).

**Nếu máy hư hoàn toàn:** cài lại máy mới → cài Docker → lấy file `.zip` trong CamLamLand-Backup trên cloud → giải nén → PHUC-HOI.bat. Dữ liệu trở lại như cũ.

> Khuyên: cứ để backup tự động; thỉnh thoảng kiểm tra thư mục CamLamLand-Backup trên cloud có file mới.

---

## 3. Lộ trình mở rộng (khi tải & dữ liệu tăng)

Làm theo thứ tự — chỉ nâng khi thật sự cần, không phải làm hết ngay.

### Bước 1 — Bật CDN Cloudflare (gần như miễn phí, hiệu quả nhất)
Đã đi qua Cloudflare Tunnel rồi, nên chỉ cần bật **cache ở biên**: khách tải ảnh/JS/CSS từ máy chủ Cloudflare gần họ, **không đụng máy bạn** → chịu được lượng truy cập lớn.
- Cloudflare Dashboard → domain → **Caching → Cache Rules** → tạo rule cache cho `/_next/static/*` và `/api/images/*` (Eligible for cache, Edge TTL dài).
- Bật **Tiered Cache** + **Brotli** trong Cloudflare (Speed → Optimization).

### Bước 2 — Ảnh chuyển sang Object Storage (khi nhiều ảnh)
Hiện ảnh lưu trong database (BYTEA) — tiện nhưng **không mở rộng tốt** khi nhiều. Web lớn để ảnh ở **object storage + CDN**:
- Dùng **Cloudflare R2** (cùng tài khoản Cloudflare, rẻ, băng thông ra CDN miễn phí).
- Ảnh mới upload → R2; phục vụ qua CDN. Database nhẹ đi, backup nhanh hơn.
- Đây là thay đổi kiến trúc vừa; làm khi ảnh > vài GB hoặc thấy chậm vì ảnh.

### Bước 3 — Database dễ mở rộng
Kiến trúc hiện tại **đã dễ đổi**: app kết nối DB qua biến môi trường (`POSTGRES_HOST`...). Khi cần:
- Chuyển sang **Postgres managed**: Render Postgres, **Supabase**, hoặc **Neon** (có bản miễn phí/rẻ, tự backup, tự mở rộng). Chỉ đổi mấy biến trong `.env` là xong, không sửa code.
- Khi đọc nhiều: thêm **read replica** (bản sao chỉ đọc) để chia tải truy vấn.
- Bật **PgBouncer** (gộp kết nối) nếu nhiều kết nối đồng thời.

### Bước 4 — Nhiều bản backend + cân bằng tải
Khi 1 máy không đủ: chạy **nhiều container backend**, nginx/Cloudflare **cân bằng tải** giữa chúng. App đã tách backend/frontend/db nên nhân bản dễ.

### Bước 5 — Giám sát
- **Uptime**: dùng Cloudflare/UptimeRobot báo khi web sập.
- **Log & lỗi**: xem `docker logs`, hoặc gắn Sentry để bắt lỗi.
- Thanh trạng thái nổi + trang **Lượt truy cập** (đã có) giúp theo dõi nhanh.

---

## Tóm tắt "khi nào làm gì"

- **Bây giờ (tải nhỏ):** đã đủ nhanh + an toàn. Chỉ cần bật backup tự động + Cache Rule Cloudflare.
- **Tải tăng vừa:** bật CDN mạnh hơn, cân nhắc chuyển ảnh sang R2.
- **Tải lớn:** DB managed + replica, nhiều backend, giám sát.

Máy tự host phù hợp cho giai đoạn đầu (rẻ, chủ động). Khi lớn, từng phần "tháo ra" đưa lên dịch vụ managed mà **không phải viết lại** — vì hệ thống đã tách lớp sẵn.
