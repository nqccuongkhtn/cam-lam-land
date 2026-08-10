# Vận hành · Giám sát · Đo tải — Cam Lâm Land

Hướng dẫn để **biết ngay khi web sập/lỗi** và **đo sức chịu tải** trước khi phát hành.

---

## 1) Kiểm tra sức khoẻ (health check)

Backend có sẵn 2 endpoint:

| Endpoint | Mục đích | Trả về |
|---|---|---|
| `GET /api/ping` | Siêu nhẹ, không đụng DB — dùng cho uptime monitor & Docker | `200 ok` |
| `GET /api/health` | Kiểm tra **cả kết nối database** | `200` `{status:"ok",db:"up",dbMs,uptimeSec}` — hoặc `503` `{db:"down"}` nếu DB hỏng |

Thử nhanh: `curl https://batdongsancamlam.dpdns.org/api/health`

**Docker tự canh:** backend đã có `healthcheck`. Xem trạng thái:
```bash
docker compose ps          # cột STATUS hiện "healthy" / "unhealthy"
```

---

## 2) Giám sát uptime + cảnh báo (báo ngay khi sập)

### Cách nhanh nhất — UptimeRobot (miễn phí)
1. Tạo tài khoản tại **uptimerobot.com**.
2. **Add New Monitor** → *HTTP(s)* → URL: `https://batdongsancamlam.dpdns.org/api/health`
3. *Monitoring interval*: 1–5 phút. Bật *Alert Contacts*: **Email** và/hoặc **Telegram**.
4. (Nên) Thêm điều kiện coi là "down" khi mã trả về **khác 200** → khi DB hỏng (`503`) cũng được cảnh báo.

> Gợi ý khác cùng loại: **BetterStack (Better Uptime)**, **Pingdom**, **Cronitor** — đều có gói free và cảnh báo Telegram/SMS.

### Tự host (không phụ thuộc bên thứ ba) — cron + Telegram
Tạo bot Telegram (@BotFather) lấy `TOKEN`, và `CHAT_ID` của bạn. Rồi đặt cron mỗi 2 phút:
```bash
*/2 * * * * curl -fsS https://batdongsancamlam.dpdns.org/api/health >/dev/null || \
  curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage" \
    -d chat_id=<CHAT_ID> -d text="🔴 Cam Lâm Land DOWN lúc $(date '+%H:%M %d/%m')"
```

---

## 3) Ghi log lỗi (rà khi có sự cố)

Backend ghi log ra **file theo ngày**, tự xoay vòng, tự xoá sau 30 ngày (đổi bằng `LOG_RETAIN_DAYS`):

- `logs/error-YYYY-MM-DD.log` — lỗi hệ thống (5xx), unhandled/uncaught, DB không phản hồi.
- `logs/access-YYYY-MM-DD.log` — request bị lỗi **hoặc chậm > 2s** (để soi hiệu năng).

Log được lưu trong **volume `logs`** (không mất khi build lại). Xem log:
```bash
docker compose exec backend sh -lc 'tail -n 100 logs/error-$(date +%F).log'
docker compose exec backend sh -lc 'tail -n 100 logs/access-$(date +%F).log'
```
Đổi thư mục log bằng biến `LOG_DIR`.

---

## 4) Đo tải với dữ liệu thật

### Bước 1 — Nạp nhiều tin để giống thật (staging)
```bash
# 5.000 tin (mặc định). Đổi số: thêm -v n=20000
docker compose exec -T postgis psql -U camlam -d camlam_gis -f - < db/seed-load.sql
```
Xoá sau khi xong:
```bash
docker compose exec -T postgis psql -U camlam -d camlam_gis \
  -c "DELETE FROM listings WHERE title LIKE '%LOADTEST%';"
```

### Bước 2 — Tạm nới giới hạn chống lụt (nếu không sẽ bị 429)
Đặt trong `.env` rồi `docker compose up -d backend`:
```
RATE_LIMIT_GLOBAL=5000000
```
> Nhớ **gỡ lại** (hoặc để trống → mặc định 600/phút) sau khi đo xong.

### Bước 3 — Chạy đo tải (không cần cài gói, Node 18+)
```bash
node scripts/loadtest.mjs http://localhost 50 20
#                          <url>            <luồng> <giây>
```
Hoặc chạy thẳng vào tên miền thật (cẩn thận, sẽ tạo tải thật):
```bash
node scripts/loadtest.mjs https://batdongsancamlam.dpdns.org 30 15
```

### Đọc kết quả
- **req/s**: số request phục vụ mỗi giây (càng cao càng khoẻ).
- **p95 / p99 (ms)**: 95%/99% request nhanh hơn mức này. Mục tiêu **p95 < 500–800ms**.
- **Lỗi/timeout**: nên **< 1%**. Nếu cao → xem `logs/error-*.log`.

**Nếu p95 cao / req/s thấp:** kiểm tra index DB (đã có sẵn), tăng `PG_POOL_MAX`, tăng RAM cho Postgres (`shared_buffers`, `effective_cache_size` trong docker-compose), hoặc thêm cache. Với lưu lượng lớn hơn nữa: đặt CDN trước ảnh, tách đọc/ghi DB.

---

## 5) Tham chiếu nhanh

```bash
docker compose ps                    # trạng thái + healthy/unhealthy
docker compose logs -f backend       # log realtime
curl -s localhost/api/health | jq    # sức khoẻ + độ trễ DB
```
