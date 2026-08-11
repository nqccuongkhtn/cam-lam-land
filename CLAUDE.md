# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **NGÔN NGỮ — bắt buộc:** Chủ dự án chỉ đọc hiểu tiếng Việt và **không quen thuật ngữ lập trình**.
> Mọi câu trả lời, giải thích, tài liệu, comment mới, và cả phần **mô tả lệnh khi chạy công cụ**
> → viết bằng **tiếng Việt, lời lẽ đời thường**. Tên file/lệnh/biến giữ nguyên nhưng phải nói rõ nó làm gì.
> Toàn bộ code hiện có đã comment tiếng Việt — giữ đúng phong cách đó.

---

## Dự án này là gì

**Cam Lâm Land** — web bất động sản + bản đồ quy hoạch cho **huyện Cam Lâm, Khánh Hoà**.
Neo cứng vào Cam Lâm: tâm bản đồ `109.0917, 12.0771`, hệ toạ độ **EPSG:4326 (WGS84)**,
khung bao `[108.95, 11.95, 109.27, 12.25]` (`packages/shared/src/index.ts`).

Chạy thật tại `https://batdongsancamlam.dpdns.org` — **máy tính cá nhân ở nhà** + Cloudflare Tunnel.
Bản dự phòng trên Render (`render.yaml`).

> ⚠️ **README.md đã cũ**, mô tả bản MVP đầu tiên (8 tin mẫu, 4 lớp bản đồ, nền OpenStreetMap).
> Thực tế hiện nay: ~30 nhóm chức năng, nền bản đồ là **Google tiles**. Tin CLAUDE.md này, đừng tin README.

---

## Lệnh hay dùng

### Chạy cả hệ thống (bằng Docker)
```bash
cp .env.example .env
docker compose up --build            # hoặc: make up  /  ./start.sh  /  CHAY-SERVER.bat
```
Mở `http://localhost`.

| Bản | Lệnh |
|---|---|
| Dev (frontend sửa là thấy ngay) | `docker compose up -d` — tự gộp `docker-compose.override.yml` |
| **Chạy thật (production)** | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` |
| Mở ra Internet | thêm `-f docker-compose.tunnel.yml` (cần `TUNNEL_TOKEN` trong `.env`) |
| Tắt | `docker compose down` · Xoá sạch cả database: `docker compose down -v` |
| Build lại 1 phần | `docker compose up -d --build backend` |

**Chủ dự án dùng bảng điều khiển Windows:** nháy đúp `QUAN-LY-SERVER.vbs` → chạy `QUAN-LY-SERVER.ps1`
(cửa sổ có nút Bật/Tắt/Xem log/Bảo trì/Sao lưu, thu nhỏ xuống khay đồng hồ).
Script tự chọn file compose: luôn `docker-compose.yml + docker-compose.prod.yml`,
thêm `docker-compose.tunnel.yml` nếu `.env` có `TUNNEL_TOKEN`.

Các script `.bat` khác ở thư mục gốc: `SAO-LUU.bat` (sao lưu DB), `PHUC-HOI.bat` (khôi phục),
`TAO-TAI-KHOAN.bat`, `KIEM-TRA-IP.bat`, `KHOI-DONG-CUNG-MAY.ps1` (tự chạy khi bật máy).

### Chạy từng phần không cần Docker
```bash
pnpm install
pnpm dev:backend    # tsx watch — cần ogr2ogr (GDAL) trong PATH nếu muốn upload file GIS
pnpm dev:worker
pnpm dev:frontend   # cổng 3000
```
Phải tự dựng PostgreSQL + PostGIS và chạy `db/init/*.sql` trước.

### Kiểm tra code
```bash
pnpm -r build                                   # build tất cả
pnpm --filter @camlam/backend  typecheck        # tsc --noEmit
pnpm --filter @camlam/frontend typecheck
```
**Chưa có bộ test tự động nào** trong repo — đừng bịa lệnh chạy test.
`next.config.js` đặt `ignoreBuildErrors: true` + `eslint.ignoreDuringBuilds: true`
→ **build Next.js vẫn qua dù code sai kiểu**. Muốn thấy lỗi thật phải chạy `typecheck` riêng.

### Xem log / kiểm tra sức khoẻ
```bash
docker compose ps                       # cột STATUS: healthy / unhealthy
docker compose logs -f backend
curl -s localhost/api/health            # 200 = ổn, 503 = database hỏng
curl -s localhost/api/ping              # siêu nhẹ, không đụng database
docker compose exec backend sh -lc 'tail -n 100 logs/error-$(date +%F).log'
```
Chi tiết: `docs/VAN-HANH-GIAM-SAT.md`. Đo tải: `node scripts/loadtest.mjs http://localhost 50 20`.

---

## Kiến trúc — bức tranh lớn

```
Trình duyệt → nginx (cổng 80) ┬─ /       → frontend  Next.js 14 (App Router) + MapLibre GL
                              ├─ /api/   → backend   Express + JWT   (có cache của nginx)
                              └─ /ws     → WebSocket (cùng tiến trình backend, dùng cho chat)
                                              │
                                   PostgreSQL 16 + PostGIS
                                              │
                                   gis-worker (Node + GDAL/ogr2ogr)
```

Monorepo **pnpm workspaces**, 4 gói:

| Thư mục | Tên gói | Vai trò |
|---|---|---|
| `apps/backend` | `@camlam/backend` | API REST + WebSocket. **Chạy thẳng TypeScript bằng `tsx`, KHÔNG build ra JS** |
| `apps/frontend` | `@camlam/frontend` | Next.js 14 App Router, giao diện tiếng Việt, là PWA |
| `apps/gis-worker` | `@camlam/gis-worker` | Vòng lặp hỏi hàng đợi, đổi file CAD/shape → GeoJSON → nạp vào PostGIS |
| `packages/shared` | `@camlam/shared` | Kiểu dữ liệu dùng chung + hằng số Cam Lâm |

### 6 điều phải nắm trước khi sửa

**1. Database tự vá lúc khởi động — không có công cụ migration riêng.**
`db/init/*.sql` chỉ chạy **một lần duy nhất** khi container PostGIS được tạo mới.
Mọi thay đổi bảng về sau nằm trong **`apps/backend/src/lib/migrate.ts`** (374 dòng), chạy **mỗi lần backend khởi động**.
Quy tắc bắt buộc: câu lệnh phải **chạy lại nhiều lần vẫn an toàn** (`ADD COLUMN IF NOT EXISTS`,
`CREATE TABLE IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` rồi tạo lại), và **mỗi câu bọc `.catch()` riêng**
để một câu lỗi không kéo đổ cả loạt.
→ **Thêm cột/bảng mới thì viết vào cuối `migrate.ts`**, đừng sửa `db/init/`.
Trên Render (database quản lý sẵn, không có hook init) thì `BOOTSTRAP_DB=true` để `lib/bootstrap.ts` tự chạy
`db-init/*.sql` + nạp lớp GIS mẫu.

**2. Backend cố tình "không chết".** Trong `index.ts`: `bootstrap`/`migrate`/`ensureAdmin` lỗi thì chỉ ghi log
rồi server vẫn chạy; `unhandledRejection` và `uncaughtException` bị bắt lại; lỗi kết nối rảnh của pool Postgres
cũng bị nuốt (`db.ts`). Đây là **chủ ý** — máy chủ chạy trên máy nhà / gói miễn phí, chết tiến trình là web sập.
**Đừng "dọn dẹp" mấy chỗ bắt lỗi này.**

**3. Đường đi của một file GIS được tải lên.**
```
Admin upload (.dgn/.shp/.zip/.geojson)
  → backend lưu file + thêm 1 dòng vào bảng import_jobs (status='pending')
  → gis-worker hỏi hàng đợi mỗi 4 giây (WORKER_POLL_MS)
      → ogr2ogr -t_srs EPSG:4326 -f GeoJSON
      → tạo/cập nhật dòng gis_layers, chèn từng đối tượng vào gis_features
      → đánh dấu job xong, ghi nhật ký vào chính cột log của job
  → lớp dùng được ngay ở GET /api/layers/:slug/features
```
Không có message broker, chỉ là vòng `while(true)` + `setTimeout` (`apps/gis-worker/src/index.ts`).

**4. Frontend gọi backend theo BA đường khác nhau — hay nhầm chỗ này.**
- **Trình duyệt (client):** `NEXT_PUBLIC_API_BASE` (mặc định `/api`) → `src/lib/api.ts`.
- **Máy chủ Next.js (server component, sitemap, `/nha-dat/[slug]`, `/listings/[id]`):** gọi **thẳng**
  `process.env.BACKEND_HOST` (`http://backend:4000`).
  **Thiếu `BACKEND_HOST` → các trang render sẵn trả RỖNG dù web vẫn chạy bình thường.**
- **`src/middleware.ts`:** nếu có `BACKEND_HOST` thì rewrite mọi `/api/*` sang backend
  (dùng khi chạy trên Render, nơi không có nginx).

**5. Quy tắc bỏ dấu tiếng Việt chỉ định nghĩa Ở MỘT NƠI.**
Nơi đó là `vnNoAccent()` trong `apps/backend/src/lib/vn.ts`. Hàm SQL `vn_unaccent()` bên
`migrate.ts` **được sinh tự động** từ đó qua `vnTranslateTable()` → hai bên không thể lệch nhau.
Xử lý được cả chữ gõ liền dấu lẫn **gõ tách dấu** (dữ liệu xuất từ CAD/QGIS/máy Mac hay ở dạng này),
cả chữ hoa lẫn thường.
Quan trọng khi sửa `vnNoAccent()`: hai index `listings_ward_noaccent_idx` và
`listings_search_trgm_idx` dựng **theo** hàm SQL này, mà Postgres **không tự dựng lại**.
`migrate.ts` đã lo sẵn: lưu "vân tay" bảng đổi chữ vào `app_config` (key `vn_unaccent_fp`),
khác lần trước thì tự `REINDEX` rồi lưu lại — nên **cứ sửa `vn.ts` rồi khởi động lại backend là xong**.
Lúc khởi động còn có bước tự kiểm: SQL và JS lệch nhau thì log in cảnh báo rõ ràng
(trước đây lệch là tìm kiếm sai mà không báo gì).

**6. Ảnh tin đăng lưu thẳng trong Postgres** (bảng `listing_images`, kiểu `BYTEA`) — không dùng ổ đĩa/S3.
Trình duyệt nén ảnh + **nung dấu mờ "Cam Lâm Land"** vào giữa ảnh **trước khi gửi lên** (`src/lib/api.ts`),
kèm bản thu nhỏ riêng. Ảnh phục vụ qua `/api/images/:id` (thêm đuôi `.webp`/`.pdf` để Cloudflare cache biên).

---

## Phần khó nhất: tính quy hoạch trên từng thửa

`GET /api/parcels/at?lng=&lat=` (`routes/parcels.ts` + `lib/qhCompute.ts`) là **tính năng lõi & tinh vi nhất**.
Nó trả về: thửa tại điểm bấm, loại quy hoạch, **diện tích từng loại đất chồng lên thửa**, thửa liền kề, tin rao gần đó.

Có **ba cách tính, xếp theo thứ tự ưu tiên**:

1. **Cách C (đang dùng, khớp app tham chiếu ±3%)** — `lib/qhCompute.ts`.
   Lấy mẫu lưới 44×44 điểm bên trong thửa; mỗi điểm tra:
   - `road_mask.bin` (ảnh mặt nạ đường dạng bit, dựng từ mép đường DXF nên **giữ được đường cong thật**)
     → nằm trong lòng đường ⇒ **Đất giao thông**;
   - `qh_zones.json` (danh sách ô đất quy hoạch, có chỉ mục lưới ~55m) → ô chứa điểm ⇒ loại đất đó;
   - nếu không rơi vào ô nào thì lấy **ô gần nhất trong 50m** (bù chỗ vector vẽ thiếu vài mét).
2. **Cách B (dự phòng)** — SQL PostGIS: `ST_Intersection` giữa thửa và các ô quy hoạch, phần thửa trống
   còn lại coi là "Đất giao thông".
3. Nếu dữ liệu vector **đã có ô "Đất giao thông" thật** thì dùng thẳng, không bịa phần trống.

**Dữ liệu bắt buộc phải có:** `apps/backend/data/qh_zones.json`, `road_mask.bin`, `road_mask.json`
(đường dẫn đọc theo `QH_DATA_DIR`, mặc định `<thư mục chạy>/data`; trong container là `/app/apps/backend/data`).
Các file này **có trong git** (~1.9MB + 1.6MB). Thiếu chúng thì backend vẫn chạy nhưng tự tụt xuống cách B —
kết quả diện tích sẽ lệch. Log lúc khởi động sẽ báo `[qhCompute] nạp N ô đất QH`.

Tệp `lib/vn2000.ts` (cả bên backend lẫn frontend) đổi toạ độ **VN-2000 Khánh Hoà**
(kinh tuyến trục 108°15', múi 3°, k=0.9999) ↔ WGS84 bằng phép Helmert 7 tham số. Đây là số liệu chuẩn —
**đừng chỉnh các hằng số trong file này**.

---

## Backend có gì (`apps/backend/src`)

- **`index.ts`** — gắn ~30 router + các việc chạy nền theo giờ: lấy tin BĐS mỗi 6 tiếng; quét Công báo mỗi giờ
  và cổng thông tin mỗi 6 giờ; **tự đẩy tin VIP nổi lại** (kim cương 6h / vàng 12h / bạc 24h);
  nhắc lịch công chứng qua SMS mỗi 5 phút; tự ping `/api/health` mỗi 10 phút để Render không "ngủ".
- **`routes/`** — ngoài phần lõi (`auth`, `listings`, `layers`, `parcels`, `imports`, `images`, `admin`)
  còn nhiều tính năng phụ **được đánh dấu "dùng tạm — dễ gỡ"** trong comment:
  `hotlist`, `pdftools`, `danhMuc`, `aiScript` → tháo ra = xoá 1 dòng `app.use` + 1 file.
- **`lib/`** — `db` (pool), `env`, `migrate`, `auth` (JWT), `qhCompute`, `vn2000`, `vn` (bỏ dấu),
  `cache` (cache trong bộ nhớ, TTL ngắn), `flags`, `packages` (bảng giá gói), `ws`, `push`, `sms`, `mailer`, `logger`.
- **`middleware/security.ts`** — header bảo mật tự viết (không dùng helmet) + bộ hạn chế số lần gọi
  (sliding window trong bộ nhớ, không cần Redis). Mỗi nhóm route nặng có mức riêng: đăng nhập 60 lần/10 phút,
  OCR 60, công cụ PDF 40, lập danh mục 20, AI 30; toàn cục 600 lần/phút.
  **`/api/tiles` được đặt TRƯỚC bộ hạn chế toàn cục** vì một phiên xem bản đồ tải rất nhiều ô ảnh.

**Vai trò tài khoản:** `user` · `admin` · `gis` (quản lý lớp bản đồ) · `vanban` (quản lý văn bản) · `hotlist`.
Hàm chặn tương ứng trong `middleware/auth.ts`.

**Cờ bật/tắt tính năng:** bảng `app_flags`, cờ công khai duy nhất hiện nay là `services_live` —
bật thì mới áp dụng giới hạn gói/thu phí đăng tin & đẩy tin.

**Gói bán riêng cho công cụ:** ngoài gói đăng tin và gói đẩy tin, còn có **gói `video`**
(`lib/packages.ts`, `kind: 'video'`) mở khoá trang `/tao-video-ban-do`. Hạn dùng nằm ở cột
`users.video_expires_at`. **Giá & thời hạn đặt ở MỘT chỗ duy nhất**: hằng số `VIDEO_PRICE`/`VIDEO_DAYS`
đầu `lib/packages.ts`, hoặc biến `VIDEO_PKG_PRICE`/`VIDEO_PKG_DAYS` trong `.env`.
Giá = 0 nghĩa là **chưa công bố giá**: trang `/dichvu` hiện "Liên hệ", backend từ chối tạo đơn,
admin cấp tay qua `POST /api/admin/users/:id/video` (`{ videoDays: 30 }` cấp, `{ videoDays: 0 }` thu hồi).
Trang video tự chặn ở lớp bọc ngoài (`MapVideoPage` → `MapVideoTool`) nên khi chưa có quyền thì
**công cụ không chạy chút nào** — không dựng bản đồ, không tải ảnh vệ tinh.
Lưu ý: video dựng **hoàn toàn trên máy khách**, không có endpoint máy chủ → đây là chặn ở giao diện.

**Quy tắc tin đăng** (`routes/listings.ts`): tài khoản miễn phí `FREE_POST_LIMIT = 1` tin/tháng;
gói trả phí trừ hạn mức **atomic** (`UPDATE ... WHERE post_used < post_quota`) để không vượt khi bấm nhiều tab;
tin thường **tự ẩn khỏi danh sách sau 7 ngày** nếu không được đẩy; thứ tự hiển thị = hạng VIP trước,
trong nhóm tin thường thì **đăng trước hiện trước**. Số điện thoại bị che bớt, phải bấm "Hiện số"
(`POST /:id/reveal`) mới thấy đủ và việc đó **ghi lại lead**.
Mọi thao tác ghi phải gọi `cacheDrop('listings:')` để xoá cache.

**Cache 2 tầng:** `lib/cache.ts` trong bộ nhớ (15–120 giây) + nginx `proxy_cache`
(bỏ qua khi request có `Authorization` → dữ liệu riêng tư không bao giờ bị cache).

---

## Frontend có gì (`apps/frontend/src`)

- **`app/`** — App Router, đường dẫn **đặt tên tiếng Việt** cho SEO: `/nha-dat`, `/tra-cuu`, `/gia-dat`,
  `/tin-tuc`, `/van-ban`, `/quan-tri`, `/doc-so-do`, `/tao-video-ban-do`, `/lap-danh-muc`…
  Trang `/design-system` là bảng mẫu giao diện.
- **`components/MapView.tsx`** (440 dòng) — **lõi bản đồ MapLibre, phần nhạy cảm nhất dự án.**
  `MODERNIZATION.md` ghi rõ nguyên tắc: chỉ chỉnh phần "vỏ" quanh bản đồ, **không đụng lõi maplibre**
  nếu chưa chạy thử được trên máy thật. Nền bản đồ dùng **tile Google** (`mt0.google.com`, lyrs m/s/p/h),
  có sẵn: đo khoảng cách & diện tích, tô sáng thửa kèm **độ dài từng cạnh + diện tích** kiểu Guland,
  ghim giá tin đăng theo hạng VIP, huy hiệu quảng cáo tròn, lớp chữ mờ chống sao chép.
- **`app/map/page.tsx`** (1362 dòng) — trang bản đồ chính: chồng ảnh quy hoạch, tra cứu số tờ/số thửa,
  vẽ thửa từ bảng toạ độ VN-2000 (có **OCR ảnh bảng toạ độ**), lưu điểm, mini-CRM.
- **`lib/phieuQh.ts`** (525 dòng) — dựng **phiếu trích lục quy hoạch** (SVG/HTML) để in.
- **`components/ui/`** — 7 thành phần dùng chung: `Button`, `Card`, `Badge`, `Chip`, `Skeleton`, `EmptyState`.
  Màu thương hiệu trong `tailwind.config.js`: `navy` `#0A2540`, `gold` `#C8A14B` → dùng `bg-navy`, `text-gold`.
- **`public/`** — dữ liệu bản đồ **tĩnh**: `qh_vector.geojson` (bản đang dùng), `ranh-xa.geojson`,
  `roadnet_camlam.json`, `danh-sach-nong.json`, thư mục `tiles/`, `overlays/`.
  Đây là lý do nginx có luật cache riêng cho `.geojson`, `.pmtiles`, `/tiles/`, `/overlays/`.
- Là **PWA**: `public/sw.js`, `manifest.webmanifest`, `offline.html`, thông báo đẩy (VAPID).

---

## Dịch vụ ngoài & khoá bí mật

| Việc | Nhà cung cấp | Cấu hình |
|---|---|---|
| Đọc ảnh sổ đỏ / bảng toạ độ (OCR) | **Gemini** trước, rồi Groq → OpenRouter → OCR.space → máy OCR nội bộ → Tesseract trong container | `GEMINI_API_KEYS` (nhiều khoá, cách nhau dấu phẩy), `GEMINI_MODELS`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `OCRSPACE_API_KEY`, `SELF_OCR_URL/TOKEN` |
| Lập danh mục hồ sơ | **Anthropic Claude** (mặc định `claude-sonnet-5`) | Khoá do admin nhập trong web (bảng `app_config`, key `danhmuc_ai`, **mã hoá AES**); dự phòng `ANTHROPIC_API_KEY` / `AI_MODEL` |
| Đổi DGN V8 → DXF qua mạng | GroupDocs Cloud | `GROUPDOCS_CLIENT_ID/SECRET` (worker) |
| Thông báo đẩy | Web Push (VAPID) | `VAPID_PUBLIC/PRIVATE/SUBJECT` |
| Thanh toán | Chuyển khoản + QR VietQR | `BANK_ID`, `BANK_ACCOUNT`, `BANK_NAME`, `PAYMENT_WEBHOOK_KEY` |
| Mở ra Internet | Cloudflare Tunnel | `TUNNEL_TOKEN` |

Gemini được gọi theo kiểu **thử mọi tổ hợp khoá × model** để vắt kiệt quota miễn phí trước khi rơi sang engine khác.
Tất cả khoá nằm trong `.env` (**không lên git**); `.env.example` là mẫu.

Khi làm việc gì đụng tới **Claude/Anthropic API** (route `danhMuc`, `aiScript`, `chat`), hãy nạp kỹ năng
`claude-api` trước để lấy đúng tên model, giá và tham số — đừng nhớ theo trí nhớ.

---

## Đóng gói Docker — mấy điểm bất ngờ

- **Ảnh backend rất nặng (~1.5GB) và đó là chủ ý**: cài sẵn `tesseract-ocr` (có tiếng Việt),
  `libreoffice`, `ocrmypdf`, `ghostscript`, `qpdf`, `poppler-utils` để chạy bộ công cụ PDF phía máy chủ.
- **Trong container dùng `npm install`, không dùng pnpm workspace.** Mỗi Dockerfile copy riêng
  `package.json` của app đó. `packages/shared` được copy kèm và import theo đường dẫn tương đối.
- **3 Dockerfile cho frontend**: `Dockerfile` (dev), `Dockerfile.prod` (build tối ưu, có cache BuildKit),
  `Dockerfile.render` (build xong **tải sẵn file `qd205.pmtiles` ~148MB từ GitHub Releases** vào ảnh;
  build sẽ **thất bại nếu file < 140MB** để không bao giờ ship file tải dở).
- Trang bảo trì: nginx `error_page 502/503/504` → `nginx/maintenance.html` (có mini-game), nên khi frontend
  sập vẫn không ra trang trắng.

---

## Quy ước cần tôn trọng

- **Comment và chữ hiện ra cho người dùng: tiếng Việt** — kể cả thông báo lỗi API.
- **Backend không có bước build.** Import trong backend/worker **phải ghi kèm đuôi `.ts`**
  (`import { env } from './lib/env.ts'`) vì `tsx` chạy thẳng ESM. Viết thiếu đuôi là lỗi lúc chạy.
- **File dữ liệu lớn không đưa vào git** (`.gitignore`): `*.geojson`/`*.pmtiles`/`*.mbtiles`/`tiles/`
  trong `quyhoach2025/`, `apps/frontend/public/tiles/`, các bản nháp `qh_vector_v*.geojson`,
  ảnh `.png` ở thư mục gốc, cả thư mục `ocr-server/` (chứa token bí mật) và `backup/`.
- **Thư mục `backup/` là bản lui về**, không phải code đang chạy — đừng sửa, đừng đọc nhầm.
- Danh sách cho phép gọi chéo tên miền (CORS) là **allowlist cứng** trong `index.ts`:
  chỉ `localhost`, `*.onrender.com` và tên miền khai trong `CORS_ORIGINS`.
- `JWT_SECRET` để trống thì backend **tự sinh khoá ngẫu nhiên mỗi lần khởi động** → mọi người bị đăng xuất
  sau mỗi lần deploy. Trên máy chủ thật phải đặt cố định.

---

## Xưởng xử lý dữ liệu quy hoạch (không nằm trong web)

- `quyhoach2025/` — file gốc `.dgn` từ đơn vị lập quy hoạch (QĐ205, QĐ893, QĐ507, QĐ2222…) + `rebuild_qh.py`.
- `scripts/qh-pipeline/` — quy trình đổi CAD → GeoJSON đúng toạ độ: `1-convert-dgn.sh` (gán VN-2000
  Khánh Hoà rồi đổi sang WGS84) → `2-map-levels.mjs` (ánh xạ mỗi *level* trong CAD thành một loại đất + màu).
  Kèm `build_road_mask.py`, `polygonize_roads.py`, `polygonize_pavement.py` — chính là nơi sinh ra
  `road_mask.bin` và `qh_zones.json` mà backend dùng. Đọc `scripts/qh-pipeline/README.md`.
- `HD-lam-tile-quyhoach/`, `quyhoach2025/HUONG_DAN_z18_PMTiles_R2.md` — hướng dẫn xuất tile bằng QGIS.
- `ocr-server/` — máy OCR chạy riêng trên PC (bị `.gitignore` chặn).
- `TOOL-CHUANHOA-DGN/` — công cụ chuẩn hoá file DGN.

---

## Những chỗ hay vấp

- **Bản đồ trống / tin "đang tải" mãi** → backend chưa lên: `docker compose logs backend`.
- **Không thấy lớp GIS nào** → xem worker: `docker compose logs gis-worker`, tìm dòng `imported ... features`.
- **⚠️ Clone mới không có ảnh quy hoạch.** Trang bản đồ dùng `/tiles/qd205v11/{z}/{x}/{y}.png`, nhưng
  `apps/frontend/public/tiles/` **bị `.gitignore` chặn** → bộ `qd205v11` **không có trong git**
  (chỉ bộ cũ `qd205v3` còn nằm lại từ trước khi có luật chặn). Máy mới phải chép bộ tile sang bằng tay,
  hoặc dựng lại từ `.dgn` theo hướng dẫn trong `HD-lam-tile-quyhoach/`.
- **Diện tích quy hoạch ra sai/lệch** → kiểm tra log `[qhCompute]` lúc khởi động; nhiều khả năng thiếu
  `apps/backend/data/qh_zones.json` hoặc `road_mask.bin` nên đã tụt xuống cách tính dự phòng.
- **Upload shapefile lỗi** → phải nén chung `.shp` + `.shx` + `.dbf` + `.prj` vào một file `.zip`.
- **File DGN bản V8** ogr2ogr không đọc được → đổi sang V7 hoặc DXF trước (hoặc đặt `GROUPDOCS_*` để worker tự đổi).
- **Build lại backend xong bị lỗi 502 ở /api** → nginx ghi nhớ địa chỉ mạng của backend từ lúc nó
  khởi động, mà `up -d --build backend` thì tạo container MỚI với địa chỉ khác → nginx còn trỏ chỗ cũ.
  Khắc phục: `docker compose ... restart nginx`. Nhớ làm mỗi khi container backend bị tạo lại
  (trang web vẫn hiện bình thường, chỉ phần /api chết → rất dễ tưởng nhầm là lỗi backend).
- **Bật/tắt trang bảo trì** (chỉ ảnh hưởng tên miền thật, `localhost` vẫn vào được):
  `docker exec camlam_nginx touch /etc/nginx/maintenance.on` · tắt: `rm -f` đường dẫn đó.
  Nút trên bảng điều khiển làm sẵn 2 lệnh này.
- **Vector quy hoạch lệch so với ảnh nền** → dựng lại từ file CAD gốc theo `scripts/qh-pipeline/README.md`,
  **đừng chỉnh tay GeoJSON**.
- **Bị chặn 429 khi đo tải** → tạm đặt `RATE_LIMIT_GLOBAL` rất cao trong `.env`, đo xong nhớ gỡ.
