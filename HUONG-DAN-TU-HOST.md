# Tự host Cam Lâm Land trên máy của bạn (Windows) + Cloudflare Tunnel

Biến máy tính của bạn thành **server chính** cho website — không còn giới hạn 512MB RAM hay ngủ 15 phút của Render. Máy bạn ra Internet qua **Cloudflare Tunnel** (miễn phí, HTTPS tự động, chạy được sau CGNAT, không cần mở port modem).

---

## 0. Chuẩn bị (làm 1 lần)

1. **Cài Docker Desktop**: https://www.docker.com/products/docker-desktop/ → cài xong mở lên, đợi báo **"Engine running"**.
   - Trong Docker Desktop → Settings → General → bật **"Start Docker Desktop when you log in"** (để server tự chạy lại khi mở máy).
2. **Máy phải bật 24/7**: Control Panel → Power Options → đặt **Sleep = Never**. (Máy tắt / mất điện / mất mạng là web sập → nên có UPS nếu hay cúp điện.)
3. **Tài khoản Cloudflare** (miễn phí): https://dash.cloudflare.com/sign-up

> Muốn **test nhanh chưa cần domain**? Bỏ qua phần domain, xem thẳng **Mục 3**.

---

## 1. Đặt mật khẩu (bắt buộc khi chạy thật)

Mở file **`.env`** trong thư mục này (nếu chưa có, chạy `CHAY-SERVER.bat` một lần để nó tự tạo), sửa các dòng:

```
JWT_SECRET=<chuỗi-dài-ngẫu-nhiên>          # vd bấm tạo mật khẩu 40+ ký tự
ADMIN_PASSWORD=<mật-khẩu-admin-mạnh>
POSTGRES_PASSWORD=<mật-khẩu-DB-mạnh>
NEXT_PUBLIC_SITE_URL=https://<domain-cua-ban>
```

---

## 2. Lấy Cloudflare Tunnel (chạy chính thức, có domain)

1. Có sẵn 1 **domain** (mua ở đâu cũng được) → thêm vào Cloudflare (Add site → đổi 2 nameserver theo hướng dẫn của Cloudflare).
2. Vào **Cloudflare → Zero Trust → Networks → Tunnels → Create a tunnel** → chọn loại **Cloudflared** → đặt tên (vd `camlam`).
3. Ở bước cài đặt, chọn tab **Docker** → copy **chuỗi token dài** đứng sau `--token`.
4. Dán token đó vào `.env`:
   ```
   TUNNEL_TOKEN=<chuỗi-token-vừa-copy>
   ```
5. Vẫn trong tunnel → tab **Public Hostname → Add a public hostname**:
   - **Subdomain / Domain**: chọn domain của bạn (vd `nhadatcamlam.com` hoặc `www`).
   - **Service**: Type = **HTTP**, URL = **`nginx:80`**  ← (gõ đúng `nginx:80`).
   - Save.

> Cần WebSocket cho bản đồ trực tiếp? Cloudflare Tunnel hỗ trợ sẵn, không cần cấu hình thêm.

---

## 3. Chạy server

- **Chạy chính thức (production + domain):** bấm đúp **`CHAY-SERVER.bat`**.
  - Lần đầu build vài phút. Xong: web ở `http://localhost` (tại máy) và ở **domain** của bạn (qua Internet).
- **Tắt server:** bấm đúp **`TAT-SERVER.bat`** (dữ liệu DB + ảnh vẫn giữ nguyên).

- **Test nhanh KHÔNG cần domain:** chạy `start.bat` (bản thường) → rồi bấm **`CHAY-THU-NHANH.bat`**. Nó in ra 1 link tạm `https://...trycloudflare.com` để gửi người khác xem thử (link đổi mỗi lần chạy, chỉ để test).

---

## 4. Tự chạy khi mở máy

Các dịch vụ đặt `restart: unless-stopped` nên **Docker sẽ tự bật lại chúng** mỗi khi Docker Desktop khởi động. Chỉ cần bật **"Start Docker Desktop when you log in"** (Mục 0) là xong — mở máy là server tự lên, gồm cả tunnel.

---

## 5. Render làm "server phụ"

- Render vẫn giữ nguyên như hiện tại. Khi máy nhà **nghỉ dài** (bảo trì, đi vắng), bạn vào **Cloudflare → DNS/Tunnel** trỏ domain tạm về bản Render để web không chết.
- Lưu ý: DB ở máy và DB ở Render **không tự đồng bộ** — coi Render là bản dự phòng bật tay, không phải bản sao thời gian thực.

---

## 6. Sao lưu dữ liệu (nên làm định kỳ)

Dữ liệu nằm trong Docker volume `pgdata`. Sao lưu ra file:
```
docker exec camlam_postgis pg_dump -U camlam camlam_gis > backup_camlam.sql
```
Phục hồi:
```
docker exec -i camlam_postgis psql -U camlam camlam_gis < backup_camlam.sql
```

---

## Xử lý sự cố nhanh

| Hiện tượng | Cách xử lý |
|---|---|
| Web không lên | Mở Docker Desktop xem container nào đỏ; hoặc `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f` |
| Domain chưa ra | Kiểm tra `TUNNEL_TOKEN` trong `.env`, và Public hostname trỏ `nginx:80`; xem `docker logs camlam_tunnel` |
| Đổi giao diện xong không thấy | Chạy lại `CHAY-SERVER.bat` (build lại frontend production) |
| Máy yếu / muốn nhẹ | Đóng bớt app; hoặc để Render lo phần công khai, máy chỉ chạy nội bộ |
