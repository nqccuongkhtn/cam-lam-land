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
`NEN-KHO-DOCKER.bat` (nén kho Docker lấy lại chỗ ổ C — xem mục cảnh báo bên dưới),
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

## Bản đồ địa chính toàn tỉnh (733.249 thửa) — LUÔN BẬT + CHỐNG CÀO

Nguồn: `D:\Cam Lam gis\gis khanh hoa\` — 147 file `.geojson` (~475 MB), mỗi file một xã/phường,
đã ở hệ WGS84, thuộc tính `{to, thua, xa, xaId, dienTich_m2, mucDichSuDung, nhan}`.
147 file ghép **khảm kín, không đè lên nhau** → tổng 733.249 thửa là con số thật, không đếm trùng.

**Bảng riêng, KHÔNG dùng chung `gis_features`.** Vì `gis_features` cất mọi thứ trong cột JSONB nên
không đánh chỉ mục theo số tờ/số thửa được — với 733 nghìn thửa là quét cả bảng, rất chậm.

| Bảng | Vai trò |
|---|---|
| `dia_chinh` | 733k thửa: `xa_id, cap, so_to, so_thua, to_num, thua_num, dien_tich, mdsd, geom(MultiPolygon,4326)` |
| `dia_chinh_xa` | Danh mục 147 xã: tên, **cấp**, **huyện/TP cũ**, số thửa, khung bao, tâm |

### Xã CŨ ↔ xã MỚI — lấy theo VĂN BẢN, không đoán
Dữ liệu gốc dùng tên xã ở **ba đời khác nhau** và **không hề ghi** xã cũ nay thuộc xã mới nào.
Bảng ánh xạ nằm ở **`scripts/dia-chinh/xa-moi.json`**, lập theo:
- **Nghị quyết 1667/NQ-UBTVQH15** — sắp xếp cấp xã Khánh Hoà 2025 (65 đơn vị mới, hiệu lực 1/7/2025);
- **Nghị quyết 1196/NQ-UBTVQH15** (Khánh Hoà) và **1198/NQ-UBTVQH15** (Ninh Thuận) — bước sắp xếp
  hiệu lực 1/11/2024, phải bắc cầu qua đây. Ví dụ: `phường Xương Huân` → (2024) `phường Vạn Thạnh`
  → (2025) `phường Nha Trang`.

`cap` = 2 (đơn vị hiện hành) hoặc 3 (đơn vị cũ) — **lấy từ danh sách 64 mã trong `xa-moi.json`**.
⚠️ **ĐỪNG suy từ chữ HOA/thường trong tên file** như bản đầu: quy ước đó của bên lập dữ liệu **sai ở 17 xã**
(vd `xã Đại Lãnh`, `xã Vạn Ninh`, `xã Diên Điền`, `xã Lâm Sơn` viết thường nhưng đã là xã MỚI).
Phép thử tự kiểm: dữ liệu phải ra **đúng 64 đơn vị 2 cấp** = 65 đơn vị của tỉnh − đặc khu Trường Sa
(không có bản đồ địa chính). Ra khác 64 là bảng ánh xạ sai.

### Danh mục hành chính CHÍNH THỨC + công cụ đối chiếu
`scripts/dia-chinh/dvhc/` giữ danh mục lấy thẳng từ hệ thống của Sở (`khh.mplis.gov.vn`, `DanhMucAjax`):
`khanh-hoa-2cap.json` (65 xã mới + 139 xã cũ + 16 huyện cũ), `dvhc-2cap.js` (bộ 5 quy tắc + hàm tra
hai chiều), `test-dvhc.js` (bộ kiểm). Năm quy tắc rút từ dữ liệu thật toàn quốc:
1. **Kế thừa mã** — xã mới KHÔNG có mã mới, nó lấy lại mã của đúng MỘT xã cũ trong nhóm ("đơn vị gốc").
2. **`trangThai`** = cờ phân cấp: true = 2 cấp đang hiệu lực, false = 3 cấp (lịch sử). Mọi huyện đều false.
3. **`tenCu`** = tên cũ của CHÍNH mã đó, KHÔNG phải danh sách sáp nhập.
4. **`tinhIdCu` / `huyenIdCu`** = tỉnh/huyện cũ — đường duy nhất dựng lại bản đồ sáp nhập.
5. **`maXaTrucThuocs`** = liên kết chéo, chỉ điền cho ngoại lệ chuyển huyện/tỉnh (cả tỉnh chỉ có 1 bản ghi).

⇒ Danh mục **KHÔNG chứa** danh sách "xã cũ nào nhập vào xã mới" — phải lấy từ nghị quyết. Đúng như
`xa-moi.json` đang làm.

**Kiểm tra lại bất cứ lúc nào:**
```bash
docker compose exec -T postgis psql -U camlam -d camlam_gis -tAF'|'   -c "SELECT xa_id, ten, cap, huyen, coalesce(xa_moi_id,'') FROM dia_chinh_xa ORDER BY xa_id;" > /tmp/db-xa.txt
node scripts/dia-chinh/doi-chieu-danh-muc.mjs /tmp/db-xa.txt
```
Hiện trạng: **147/147 xã khớp tuyệt đối** danh mục Sở — 0 lệch cấp, 0 lệch tên, 0 lệch huyện.

### Quy tắc ĐÁNH LẠI SỐ TỜ BẢN ĐỒ khi sáp nhập
Rút ra từ bảng tra chính thức của địa phương (`apps/frontend/src/lib/traSoBanDo.ts`), khớp cả 4 xã
của huyện Cam Lâm cũ:
1. Mỗi xã mới **đánh lại số tờ liên tục từ 1**.
2. **Xã cũ "gốc" GIỮ NGUYÊN số tờ** — và xã gốc chính là xã cũ mà xã mới **kế thừa mã số** (quy tắc R1
   của danh mục Sở). Cam Đức→Cam Lâm (22453) · Suối Cát→Suối Dầu (22708) · Cam Tân→Cam Hiệp (22435) ·
   Cam An Bắc→Cam An (22465). Hai nguồn độc lập cho cùng một kết luận.
3. Các xã cũ còn lại đánh **tiếp theo từng khối**, mỗi xã cũ một khối liên tục, trong khối giữ đúng
   thứ tự số tờ cũ tăng dần. Vd Xã Cam Lâm: Cam Đức 1–57 (giữ) → Cam Hải Đông 1–63 thành 58–120 →
   Cam Hải Tây 2–34 thành 121–153 → … → Cam An Bắc tờ 22 thành tờ 399.
4. Xã cũ bị chia chỉ mang sang những tờ thuộc phần đất của mình → dãy số cũ bị đứt quãng.
   Tờ nào bị ranh xã mới cắt qua thì **xuất hiện ở CẢ HAI xã mới** với hai số tờ mới khác nhau
   (toàn huyện Cam Lâm có 60/577 tờ như vậy).

**Dữ liệu địa chính hiện có VẪN DÙNG SỐ TỜ CŨ**, chưa đánh lại — kiểm chứng: file "Xã Cam Lâm" chỉ có
tờ 1–57 đúng bằng số tờ của thị trấn Cam Đức, không phải 1–399.
→ Bảng `dia_chinh_to (xa_moi_id, to_moi, xa_cu_id, to_cu)` đổi số tờ MỚI ↔ CŨ, dựng bằng
`node scripts/dia-chinh/dung-bang-so-to.mjs`. Hiện có 1.661 dòng (647 cho 4 xã Cam Lâm + 1.014 cho 4 phường Nha Trang); xã khác có bảng
thì bổ sung y hệt. `/api/dc/tim` tự đổi số tờ khi người dùng chọn xã mới → **ra đúng 1 kết quả**.
Chưa có bảng tra cho xã nào thì tìm rộng rồi hiện bảng cho chọn.

**Làm cho CẢ TỈNH:** 64 xã mới — **25 xã không cần** bảng tra (chỉ gồm 1 xã cũ nên không thể trùng số),
**8 xã đã có** (4 xã huyện Cam Lâm cũ + 4 phường Nha Trang), **31 xã còn thiếu** (225.079 thửa).
⚠️ **KHÔNG suy ra được bằng công thức.** Quy tắc "xã gốc giữ số, các xã còn lại nối tiếp theo thứ tự
nghị quyết" chỉ đúng 2/4 xã Cam Lâm; hai xã kia thứ tự khối khác hẳn (do địa phương tự quyết khi biên
tập bộ bản đồ). Đoán bừa = in sai số tờ lên phiếu trích lục → tuyệt đối không làm.

**Bốn phường Nha Trang (163.299 thửa) — nạp 3/9/2026 từ ảnh chụp bảng của Văn phòng Đăng ký.**
Bảng dựng bằng `scripts/dia-chinh/bang-so-to-nha-trang.mjs` (khai theo KHỐI, có ghi rõ căn cứ từng khối)
→ `bang-so-to-nha-trang.csv` (1.014 dòng). Ba điều rút ra, dùng lại được cho 31 xã còn thiếu:
1. **Quy tắc "đơn vị gốc giữ nguyên số tờ" giờ đúng 8/8** — và đơn vị gốc luôn là đơn vị **kế thừa mã số**
   theo danh mục Sở (Vĩnh Ngọc → Tây NT · Tân Tiến → NT · Vĩnh Phước → Bắc NT · Vĩnh Thái → Nam NT).
   Trong bảng in, khối của đơn vị gốc **để trống hàng số tờ cũ**.
2. **Bảng gọi xã cũ bằng TÊN ĐỜI 2024** (sau NQ 1196), không phải tên đời gốc mà dữ liệu địa chính đang dùng.
   Ví dụ khối "Vạn Thạnh" thật ra gồm Vạn Thạnh + Xương Huân + Vạn Thắng, đánh lại 1–41 theo thứ tự
   Vạn Thạnh 1–12 → 1–12, Xương Huân 1–17 → 13–29, Vạn Thắng 1–12 → 30–41. Tương tự "Tân Tiến" =
   Tân Tiến + Phước Tân + Tân Lập, "Phương Sài" = Phương Sài + Phương Sơn. **Phải tách khối ra** trước khi nạp.
3. **CÁCH TỰ KIỂM CHỨNG (rất mạnh, nên làm cho mọi bảng sau này):** trong dữ liệu đã có sẵn một ít thửa
   **mang số tờ MỚI** (do đo vẽ lại sau sáp nhập). Chồng hình chúng lên các tờ cũ bằng PostGIS
   (`ST_Intersection` trên `ST_Buffer(ST_Collect(geom),0)`) là ra thẳng cặp (tờ mới ↔ tờ cũ) — không cần đoán.
   Ở Nha Trang có **33 tờ kiểm được, cả 33 đều khớp bảng**; thêm phép cộng độ dài khối phải đúng bằng
   số tờ cuối cùng của phường (296 · 204 · 219 · 295) và các chỗ bảng bỏ trống đúng bằng những tờ
   không có trong dữ liệu. Ba chỗ "lệch" còn lại đều là thửa lẻ (1 thửa) hoặc tờ dư, xem dưới.

⚠️ **Bốn chỗ dữ liệu có thửa nhưng bảng KHÔNG cấp số tờ mới** (1.638 thửa, ~1%) — tra theo số tờ mới sẽ
không ra, cần hỏi lại Văn phòng Đăng ký: **Vĩnh Thái tờ 50–54** (1.561 thửa, đã đo khoảng cách xác nhận
nằm trong đất Vĩnh Thái chứ không phải Phước Hải), **Phước Hòa tờ 20** (47), **Vĩnh Hải tờ 63** (29),
**Phương Sơn tờ 21** (1).
→ Phải **xin bảng đối chiếu của Chi nhánh Văn phòng Đăng ký đất đai** từng nơi. Có bảng thì nạp bằng:
```bash
node scripts/dia-chinh/nap-bang-so-to.mjs bang-cua-xa.csv > nap.sql   # CSV 4 cột: xã mới, tờ mới, xã cũ, tờ cũ
docker compose exec -T postgis psql -U camlam -d camlam_gis < nap.sql # tên xã không cần dấu, hoặc ghi mã xã
node scripts/dia-chinh/nap-bang-so-to.mjs --bao-cao                   # xem còn thiếu xã nào
```
Nạp xong tự động sửa luôn phần chia thửa cho xã cũ bị cắt.

**Bảng tra số tờ còn là CĂN CỨ CHÍNH THỨC để chia 5 xã bị cắt** — chuẩn hơn hẳn cách ước lượng theo
vị trí. 517/577 cặp (xã cũ, tờ cũ) chỉ thuộc đúng một xã mới → gán thẳng; 60 cặp còn lại là tờ bị ranh
cắt qua nên vẫn dùng ước lượng. Áp bảng tra đã **sửa lại 26.380 thửa** (vd xã Cam Hoà: ước lượng cho
1.146 thửa về Cam Lâm, thực tế là 11.951).

`dia_chinh_xa.ten_goc` = tên xã cũ đã mang mã đó (trường `donViGoc` của danh mục Sở, có cho 50/65 xã mới).
Nhờ nó, bấm vào thửa trong file "Xã Cam Lâm" hiện đúng "Trước sáp nhập: thị trấn Cam Đức".

### ⚠️ CHỌN XÃ MỚI PHẢI TRA THEO `xa_moi_id`, KHÔNG PHẢI `xa_id`
Thửa đất **vẫn nằm nguyên dưới MÃ XÃ CŨ** — hệ thống địa chính không dời sang mã mới sau sáp nhập.
Chọn "Xã Cam Lâm" mà lọc `xa_id = '22453'` thì chỉ ra **14.683** thửa, trong khi xã đó thật ra có
**54.263** thửa — **sót 73%**. `/api/dc/tim` hỏi cấp của xã được chọn trước rồi mới quyết định lọc theo
cột nào; và **bỏ lọc theo cấp khi đã chọn xã** (lọc cấp lại sót đúng đám thửa còn mang mã cũ).
Cột `so_thua` + khung bao của xã 2 cấp trong `dia_chinh_xa` cũng tính theo `xa_moi_id` vì lý do này.
Hệ quả: tra theo xã mới hay ra **nhiều thửa trùng số tờ/số thửa** (mỗi xã cũ có bộ số riêng) → giao diện
có bảng "Tìm thấy N thửa trùng số" cho người dùng chọn, mỗi dòng ghi rõ xã cũ để phân biệt.

**6 xã bị CHIA** cho nhiều xã mới (văn bản chỉ ghi "một phần diện tích", không có ranh giới):
`Cam Hòa`, `Cam Hiệp Bắc`, `Cam Hiệp Nam`, `Cam An Nam`, `Suối Tân`, `phường Đông Hải` (Ninh Thuận).
Với 6 xã này phải xét **TỪNG THỬA**: thửa gần thửa của xã mới nào nhất thì thuộc xã đó, và **chỉ so với
danh sách xã mới được phép** (khai trong `bi_chia`) nên không gán nhảy lung tung. Đây là **ước lượng
theo vị trí**, không phải theo văn bản — chỗ duy nhất trong hệ thống không có căn cứ pháp lý tuyệt đối.

Kết quả lưu ở cột `dia_chinh.xa_moi_id` (từng thửa) và `dia_chinh_xa.xa_moi_id` (từng xã).
`GET /api/parcels/at` trả về `xa` = đơn vị **hiện hành**, `xaCu` + `huyenCu` = tên **trước sáp nhập**;
giao diện hiện "Khu vực mới: …" và dòng nhỏ "Trước sáp nhập: …".

### Nạp dữ liệu (chạy lại nhiều lần vẫn an toàn)
```bash
bash scripts/dia-chinh/nap-tat-ca.sh "D:/Cam Lam gis/gis khanh hoa"   # ~10 phút, tự tháo/dựng lại chỉ mục
node scripts/dia-chinh/dung-danh-muc.mjs "D:/Cam Lam gis/gis khanh hoa" | docker compose exec -T postgis psql -U camlam -d camlam_gis
```
Nạp xã nào thì **xoá sạch xã đó trước** rồi nạp mới → không bao giờ nhân đôi.
`scripts/dia-chinh/huyen-cu.json` là bảng xếp xã cũ vào **huyện/TP cũ** (dữ liệu gốc không có thông tin huyện);
sửa file này rồi chạy lại `dung-danh-muc.mjs` là xong.
Lưu ý: dữ liệu gốc có **6 thửa sai toạ độ** (rơi tận Đắk Lắk) — vẫn giữ trong bảng nhưng bị loại khỏi
phép tính khung bao, nếu không nút "bay tới xã" sẽ zoom sai.

### Phục vụ ra web — `apps/backend/src/routes/diaChinh.ts` (`/api/dc`)
Thửa **KHÔNG** còn đi qua `/api/layers/:slug/features` nữa. Giờ gửi theo **Ô VUÔNG NHỎ (vector tile)**:

| Đường | Việc |
|---|---|
| `GET /api/dc/ve` | cấp "vé xem bản đồ" ngắn hạn (45 phút), gắn với địa chỉ máy |
| `GET /api/dc/:z/:x/:y.mvt?v=<vé>` | **một ô bản đồ**, chỉ phục vụ đúng mức phóng **z=16** |
| `GET /api/dc/danh-muc` | 147 xã chia 2 nhóm cấp, kèm huyện cũ + khung bao (cho ô "Chọn xã") |
| `GET /api/dc/tim?to=&thua=&xaId=&cap=` | tra số tờ/số thửa (tối đa 40 kết quả, 12 kết quả đầu mới kèm hình) |

Chỉ dựng ô ở **z16**, gần hơn thì trình duyệt tự phóng to ô đó lên (`maxzoom: 16`) → không có ô nào
"nhìn cả tỉnh" để tải về, và số ô phải bảo vệ giảm hẳn. Ô dày nhất (491 thửa) chỉ **26 KB, dựng 21 ms**.

### Bốn lớp khoá chống cào (tính năng sống còn)
1. **Vé xem** — không có vé thì mọi ô đều bị từ chối (401). Vé ký bằng HMAC, gắn địa chỉ máy, hết hạn 45 phút.
2. **Hạn mức** — `DC_TILE_5P` ô/5 phút và `DC_TILE_NGAY` ô/ngày cho mỗi máy.
3. **Đo độ phủ** — đếm số ô **KHÁC NHAU** trong 1 giờ (`DC_PHU_GIO`); người xem thật quanh quẩn một vùng,
   máy cào phải quét đều khắp → vượt ngưỡng là khoá máy đó `DC_KHOA_GIO` giờ.
4. **Giấu phần giá trị nhất** — ô tile CHỈ có hình thửa + số tờ + số thửa. Diện tích, loại đất, quy hoạch
   phải bấm từng thửa (`/api/parcels/at`, giới hạn 150 lần/phút).

Kèm theo: `/api/layers/:slug/features` **bắt buộc có bbox** và bbox không quá 0,6° (trước đây gọi trần trụi
là lấy được 20.000 đối tượng một lượt); lớp `layer_type='parcel'` **không hiện trong danh sách lớp** với
người dùng thường. Nginx có luật riêng `location /api/dc/` với `proxy_cache off` — **nếu để nginx cache thì
mọi lớp khoá trên đều vô hiệu** (nginx trả ô đã lưu mà không hỏi backend); backend tự giữ ô trong bộ nhớ
(`DC_KHO_MB`, mặc định 64 MB) nên vẫn nhanh.

Địa chỉ máy lấy từ header `CF-Connecting-IP` của Cloudflare (người dùng không tự đặt được), không có thì lùi về `req.ip`.

Mọi con số chỉnh trong `.env` (`DC_*`) — xem `.env.example`. `DC_TAT_CHONG_CAO=true` tắt hết khoá, **chỉ dùng khi thử nghiệm**.

### ⚠️ Bẫy đã vấp: địa chỉ ô bản đồ PHẢI ghi đầy đủ
Bản đồ nạp ô vector ở **một luồng chạy nền riêng** (Web Worker sinh từ blob). Luồng đó không biết
trang web đang ở tên miền nào, nên đường dẫn ghi tắt `/api/dc/{z}/{x}/{y}.mvt` **hỏng hoàn toàn** —
mọi ô báo `errored`, ranh thửa mất sạch mà **không có lỗi nào hiện ra** (ảnh nền Google vẫn chạy vì
ảnh raster tải ở luồng chính). Phải ghi `window.location.origin + API_BASE + '/dc/...'`.
Kiểm tra nhanh trong Console: `Object.values(__banDo.style.sourceCaches['src-dia-chinh']._tiles).map(t=>t.state)`
— phải ra `loaded`, nếu ra `errored` là dính lỗi này.

### Trên giao diện
- Lớp thửa **LUÔN BẬT**, không có nút tắt và **không xuất hiện trong bảng "Lớp bản đồ"** — người dùng
  không tắt được, cũng không biết có bao nhiêu lớp/bao nhiêu thửa. Chỉ hiện từ mức phóng 16.
- Thứ tự ô tra cứu: **cấp → huyện/TP cũ → xã/phường → số tờ → số thửa** (chọn địa giới trước, vì
  số tờ/số thửa chỉ có nghĩa khi đã biết hỏi ở xã nào).
- Hai ô địa giới là kiểu **"sổ xuống + gõ tìm"** (`OChonCoGo` trong `app/map/page.tsx`): chọn huyện rồi
  thì ô xã chỉ sổ ra xã của huyện đó, chưa chọn thì sổ ra hết. Bấm vào ô là gõ tìm ngay, **gõ không dấu
  vẫn ra**. Mỗi dòng ghi kèm tên huyện để phân biệt **10 cặp xã trùng tên** (vd "xã Vĩnh Hải · Huyện Ninh Hải"
  khác "phường Vĩnh Hải · TP. Nha Trang"). Chọn xong bản đồ **bay tới đúng xã** và tự điền luôn ô huyện.
- Hai ô đó có **hai cách dùng**: bấm vào là sổ ra **danh sách đầy đủ** (ô vẫn hiện xã đang chọn, dòng
  đang chọn có dấu ✓ và tự cuộn tới), hoặc **gõ tên để lọc**. Ô `<input>` cần **cả `onFocus` lẫn `onClick`**:
  vừa chọn xong thì con trỏ còn nằm trong ô nên lần bấm sau không có sự kiện `focus` → không có `onClick`
  là bấm mãi không mở lại được danh sách.
- **Đổi huyện / đổi xã / đổi cấp là DỌN SẠCH kết quả cũ** (`donKetQuaCu()`): đóng bảng "Thông tin thửa",
  bỏ tô sáng ranh thửa, xoá ô số tờ/số thửa, gỡ ghim. Không dọn thì người dùng chọn xã khác mà vẫn thấy
  thửa của xã trước — rất dễ nhìn nhầm.
- **SỐ THỬA CỦA TỪNG XÃ CHỈ QUẢN TRỊ VIÊN THẤY.** `/api/dc/danh-muc` và `/api/parcels/dia-ban` **không gửi
  trường `soThua`/`count`** xuống nếu không phải admin/gis (giấu ở giao diện là vô nghĩa — mở trình duyệt ra
  vẫn đọc được). Bản admin cache riêng khoá `:admin` + trả `Cache-Control: private, no-store` để nginx
  không phát nhầm cho người khác. Biết xã nào bao nhiêu thửa là biết quy mô kho dữ liệu và biết nhắm vào đâu để cào.
- Diện tích ghi giữa thửa trên bản đồ lấy **đúng con số máy chủ đo** (`dienTichChinhThuc`), không tự tính lại
  — trước đây tự tính nên lệch vài mét vuông so với bảng "Thông tin thửa".
- Danh sách xã lấy từ database, **không còn ghi cứng** trong code như trước (trước chỉ có 4 xã mới + 14 xã cũ của Cam Lâm).
- Gõ `__banDo` trong Console trình duyệt để soi bản đồ khi cần tìm sự cố.

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

## ⚠️ Ổ C đầy → Docker sập → web chết

Kho Docker (`%LOCALAPPDATA%\Docker\wsl\disk\docker_data.vhdx`) **chỉ phình ra, không bao giờ tự co lại**.
Mỗi lần `docker compose build` là nở thêm vài GB dù bên trong đã xoá bớt. Đã từng phình tới **38,46 GB**
trong khi dữ liệu thật bên trong chỉ ~6 GB → ổ C còn 0,47 GB → **Docker Desktop không khởi động nổi
(lỗi WSL bootstrap), toàn bộ web sập**, mà nhìn qua tên miền vẫn thấy trang chủ vì Cloudflare còn cache
(chỉ `/api/*` trả 502).

**Khắc phục: bấm nút `Nen kho Docker (lay lai cho trong o C)`** trên bảng điều khiển `QUAN-LY-SERVER.vbs`
(hoặc nháy đúp `NEN-KHO-DOCKER.bat`). Cả hai chạy chung `NEN-KHO-DOCKER.ps1`, tự xin quyền quản trị.
Sáu bước: dừng web cho PostgreSQL đóng sạch → tắt Docker Desktop → tắt WSL → nén file kho
(`Optimize-VHD`, không có thì `diskpart compact vdisk`) → bật lại Docker → bật lại web + khởi động lại nginx. **Không xoá gì bên trong** — database, ảnh máy, dữ liệu
địa chính nguyên vẹn. Lần chạy thật: **38,46 GB → lấy lại ~21,6 GB cho ổ C**, mất khoảng 5–10 phút.

Trước khi nén nhớ `docker compose ... stop` cho PostgreSQL đóng sạch (exit 0). Dọn thêm:
`docker builder prune -af` (đệm build) và `docker image prune -a` (ảnh không dùng) — **TUYỆT ĐỐI KHÔNG**
chạy `docker volume prune`: volume chứa database, lúc container đang tắt nó hiện là "không dùng".

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
