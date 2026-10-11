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
| Build lại 1 phần | `docker compose ... up -d --no-deps --build frontend` rồi `restart nginx` |

⚠️ **Luôn kèm `--no-deps`** khi dựng lại một phần: `frontend` khai `depends_on: backend`, thiếu `--no-deps`
thì dựng frontend là backend cũng bị tạo lại → web lỗi 502 ~10 giây mỗi lần (đo 29/9/2026: 22 lỗi 502
trong 48 giờ, trùng đúng các lần dựng). Sửa cả hai thì ghi cả hai: `up -d --no-deps --build backend frontend`.

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
**21 xã đã có** (4 xã Cam Lâm cũ + 4 phường Nha Trang + 8 xã/phường Ninh Hoà cũ + 5 xã Vạn Ninh cũ),
**29 xã còn thiếu** (194.684 thửa — nhóm Vạn Ninh vốn nằm ở nhóm "không cần" vì mỗi xã mới chỉ có 1 file dữ liệu).
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

**Tám xã/phường Ninh Hòa (116.273 thửa) — nạp 3/9/2026 từ file Excel phụ lục 1.10–1.17 của Văn phòng
Đăng ký** (bản gốc: `scripts/dia-chinh/anh-bang-goc/ninh-hoa-phu-luc.xlsx`, mỗi sheet một xã mới,
cột C/D/E/F = tên xã mới / tờ mới / tên xã cũ / tờ cũ). Dựng bằng
`python scripts/dia-chinh/bang-so-to-ninh-hoa.py` → `bang-so-to-ninh-hoa.csv` (1.289 dòng).
Quy tắc "đơn vị gốc giữ nguyên số tờ" khớp **8/8** với danh mục Sở → tính cả Cam Lâm và Nha Trang là **16/16**.

⚠️ **NINH HOÀ KHÁC NHA TRANG — chỗ dễ làm hỏng nhất.** Ở Nha Trang mỗi xã cũ còn một file riêng mang số
tờ cũ nên nạp bảng nguyên xi là dùng được. Ở Ninh Hoà thì **hầu hết xã cũ KHÔNG có file riêng**: dữ liệu
nằm trong file của xã GỐC (số tờ cũ của chính xã gốc, đổi 1:1), kèm một ít thửa đã đo vẽ lại **mang sẵn
số tờ MỚI**. Nạp bảng nguyên xi ⇒ tra ra **0 kết quả**. Nên script tự đếm với TỪNG số tờ xem thửa thật
nằm đâu rồi mới chọn đích: có ở file xã cũ thì trỏ (xã cũ, tờ cũ), không thì trỏ (xã mới, chính số tờ đó).
Kết quả: 26 dòng trỏ file xã cũ (Ninh Phước cũ), 1.263 dòng giữ nguyên số. **Xin được dữ liệu địa chính
của các xã cũ Ninh Hoà thì chạy lại script là bảng tự chỉnh.**
Cái lợi thấy ngay: 6.961 thửa của Ninh Phước cũ giờ tra được bằng số tờ mới (72–120), và 11.927 thửa của
Đông Ninh Hoà hết bị tra lẫn với Ninh Phước (18 số tờ trùng nhau giữa hai file).
Ngoài bảng: **Tây Ninh Hoà tờ 1–3** (43 thửa) — bảng bắt đầu từ tờ 4.

⚠️ **HAI BẪY KHI ĐỌC FILE EXCEL CỦA SỞ** (đã vấp cả hai):
1. **Chữ tiếng Việt gõ tách dấu (NFD)** — vài sheet lưu kiểu này, so tên xã kiểu thường sẽ trượt và
   **mất trắng khối đầu tiên** của sheet đó (lần đầu mất 168 dòng mà không có lỗi gì). Phải `normalize('NFC')`.
2. **Xuống dòng kiểu Windows (CRLF)** — file CSV ghi bằng Python trên Windows mặc định ra `

`,
   `psql \copy` báo `unquoted newline found in data` và **không nạp dòng nào**, nhưng câu kiểm tra sau đó
   vẫn chạy nên nhìn như "thiếu hàng loạt". Phải ghi `newline='
'`.
3. Ô gộp dải số như "1-95" bị Excel hiểu thành **ngày tháng** (`1995-01-01`) — chỉ ở dòng tiêu đề khối,
   bỏ qua được vì các dòng chi tiết bên dưới mới là dữ liệu.

**Năm xã Vạn Ninh (52.146 thửa) — nạp 4/9/2026** từ `anh-bang-goc/van-ninh-to-ban-do.xlsx`, dựng bằng
`python scripts/dia-chinh/bang-so-to-van-ninh.py` → 638 dòng, **phủ 100% thửa**.
File này trình bày kiểu **KHỐI CỘT nằm cạnh nhau** trong MỘT sheet (dòng 1 = xã mới, dòng 2 = xã cũ,
dòng 3 = cặp cột "Tờ BĐ cũ | Tờ BĐ mới"), khác hẳn Ninh Hoà xếp theo sheet → mỗi nơi phải viết bộ đọc riêng.
Xã gốc để **trống cột "Tờ BĐ cũ"** = giữ nguyên số tờ; khớp 5/5 danh mục Sở ⇒ quy tắc đúng **21/21**.
Dữ liệu Vạn Ninh giống Ninh Hoà (xã cũ không có file riêng) nên bảng ra toàn dòng "giữ nguyên số".

**BẢNG TRA GHI HAI THỨ KHÁC NHAU — đừng lẫn lộn** (thêm 4/9/2026):
- `xa_cu_id, to_cu` = **CHỖ ĐI TÌM** dữ liệu, tức thửa đang nằm ở file nào, số tờ mấy trong kho.
- `ten_xa_cu, to_cu_that` = **ĐIỀU BẢNG GIẤY GHI**, tức xã cũ nào, tờ cũ mấy. Rỗng = hai cái trùng nhau.

Hai cái này khác nhau ở **Ninh Hoà và Vạn Ninh**: mấy xã cũ dùng chung MỘT file mang tên xã gốc và
số tờ trong file đã là số tờ MỚI. Chỉ có cặp đầu thì web ghi "Trước sáp nhập: **xã Vạn Thọ**" cho cả
thửa vốn là đất Đại Lãnh cũ — sai tên xã, ảnh hưởng ~168.000 thửa. Có cặp sau thì hiện đúng
"Trước sáp nhập: **xã Đại Lãnh** · tờ cũ 1". `/api/parcels/at` trả thêm `soToCu`.
Tên xã cũ lấy **tên đầy đủ đúng loại đơn vị** từ danh mục Sở (đừng tự chắp "xã " — Vạn Giã là **thị trấn**);
xã cũ đã bị nuốt mã thì tên nằm ở trường `donViGoc` của xã mới chứ không có trong danh sách `xaCu`.

**Phần dùng chung của mọi bảng nằm ở `scripts/dia-chinh/lib_so_to.py`** (chuẩn hoá chữ, đổi tên xã → mã,
chọn đích theo nơi có dữ liệu, ghi CSV đúng kiểu xuống dòng). Thêm huyện mới thì chỉ viết đoạn ĐỌC FILE
rồi gọi `tao_bang(dong, ra_csv)`.
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
- **Mặc định 2 cấp + TỰ CHỌN địa giới theo chỗ đang xem** (11/10/2026): phóng tới mức thấy thửa (≥ 16) thì ô xã/huyện tự
  điền theo thửa ở GIỮA MÀN HÌNH (`GET /api/dc/xa-tai`, KNN trên chỉ mục, ~1 ms) — 2 cấp lấy xã mới, người dùng chuyển 3 cấp
  thì lấy xã cũ. Chỉ điền ô, KHÔNG dọn kết quả, KHÔNG bay bản đồ. Nhóm 3 cấp có thêm dòng **đơn vị gốc** (mã `g` + mã xã,
  vd `g22453` = thị trấn Cam Đức): `/api/dc/tim` hiểu là lọc đúng thửa của file đó theo `xa_id`; huyện cũ lấy ở
  `apps/backend/data/huyen-goc.json` (sinh từ danh mục Sở).
- **Phiếu trích lục có PHỤ LỤC** (11/10/2026, `lib/phieuQh.ts` `phuLuc`): mỗi bản quy hoạch khác đè lên thửa (QĐ893, phân khu)
  in thêm một trang: sơ đồ trên ảnh của chính bản đó + bảng toạ độ + căn cứ đầy đủ + loại đất/diện tích (màu theo bảng màu web).
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
- **Lướt bản đồ trên điện thoại KHÔNG được tính là bấm chọn thửa** (`MapView.tsx`). Thư viện bản đồ
  tự lo phần chuột (kéo quá 3 điểm ảnh là bỏ qua cú bấm), nhưng với NGÓN TAY thì hỏng: lướt xong
  nhả tay ra, trình duyệt còn bắn thêm một bộ **"chuột giả"** (mousedown + mouseup + click) **ngay tại
  chỗ nhả tay** — thư viện chỉ so chỗ bấm với chỗ nhả, hai chỗ trùng nhau nên tưởng người dùng bấm
  đứng yên → mở bảng thông tin thửa. Cách chặn: nhớ chỗ ĐẶT NGÓN TAY lúc `touchstart`, và **bỏ qua mọi
  sự kiện chuột trong 800ms sau khi chạm** (nếu không, chuột giả ghi đè mất chỗ đặt tay). Ngưỡng:
  chuột 5 điểm ảnh, ngón tay 12. **Lớp chặn ăn chắc nhất** là nhìn vào chính bản đồ: hễ bản đồ vừa bị
  NGƯỜI DÙNG làm xê dịch trong vòng 350ms (sự kiện `move` có `originalEvent`), hoặc đang trôi theo đà
  (`isMoving()`), thì cú bấm ngay sau đó là đuôi của động tác kéo. Lớp này không phụ thuộc việc thư viện
  có ghi được chỗ đặt chuột hay không — bấm trúng ghim giá / lớp chữ mờ rồi kéo là thư viện KHÔNG ghi được.
  Chuyển động do máy tự chạy (bay tới thửa, khớp khung) không có `originalEvent` nên không bị tính nhầm.
  Đã thử bằng chuột thật qua trình duyệt: kéo 280px làm bản đồ chạy ~800m → **0 lần** chọn thửa;
  bấm đứng yên → **1 lần**, bảng thông tin thửa mở đúng.
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

### ⚠️ QUY HOẠCH CHỈ CÓ Ở HUYỆN CAM LÂM CŨ — ngoài vùng phải nói "chưa có", không được đoán
Dữ liệu QH duy nhất đang có là **QĐ205 (huyện Cam Lâm cũ)**. Nhưng cách C có một nhánh
"điểm xa mọi ô đất ⇒ **Đất giao thông**" (đúng khi ở trong huyện, vì khoảng trống giữa các ô là lòng đường).
Khi bấm vào thửa ở **Nha Trang, Cam Ranh, Ninh Hoà…** thì MỌI điểm đều rơi vào nhánh đó
→ web hiện **"Đất giao thông" phủ kín cả thửa**, nhìn y như kết quả thật. Đã sửa 4/9/2026:
- `qhCompute.ts` có hàm **`ngoaiVungQh(ring)`**: quanh thửa trong bán kính **~550m** không có ô đất QH nào
  ⇒ ngoài vùng ⇒ `computeQhAreas` trả `null` ngay, không tính gì.
  Lấy 550m chứ không phải 50m vì trong huyện Cam Lâm có khoảng trống rộng hơn trăm mét (hành lang đường
  lớn, mặt nước) — ngưỡng hẹp là mấy thửa đó bị hiểu nhầm thành "chưa có dữ liệu". Đo thử: thửa Nha Trang
  và Cam Ranh cách ô QH gần nhất **hơn 1 km**, nên hai bên vẫn tách bạch rõ.
- `/api/parcels/at` trả thêm cờ **`qhNgoaiVung`**; trang bản đồ hiện dòng "Khu vực này **chưa có dữ liệu
  quy hoạch**…" và **ẩn nút xuất phiếu trích lục** (phiếu ghi sẵn tên QĐ205 nên in ra là phiếu sai).
- **Kiểm tra khi sửa phần này:** 60 thửa Cam Lâm ngẫu nhiên phải ra QH **y như trước** (0 thửa bị gắn
  "ngoài vùng"), còn thửa Nha Trang / Cam Ranh phải ra rỗng + `qhNgoaiVung=true`.
- Nhân tiện sửa luôn một lỗi cũ: hai câu SQL tính QH dự phòng đọc cứng `gis_features WHERE id=$1`, trong
  khi thửa địa chính nằm ở bảng `dia_chinh` → **nhầm bảng**, mã trùng nhau là lấy phải hình thửa khác.

**Cách cất ô đất trong RAM (29/9/2026):** `qhCompute.ts` dồn 1,17 triệu đỉnh của mọi bản QH vào
**mảng số liền (`KhoO`: Float64Array + chỉ mục lưới CSR 2 byte + mã loại đất dùng chung)** thay vì
mảng lồng nhau → 310 MB còn 58 MB, backend 474 → 177 MB. **Giữ Float64, đừng hạ Float32** (lệch diện
tích). Sửa phần này thì so kết quả cũ/mới trên vài trăm thửa thật, phải trùng từng chữ số.

**Đối chiếu với phiếu chính thức (9/10/2026) — `scripts/kiem-tra-qh/`.** 78 phiếu kiểm tra QH / trích đo của
VPĐK + Phòng Kinh tế (151 cặp phiếu × bản QH): đúng 98,4 % diện tích (93,5 % nếu tính cả tên gọi), 130/151 cặp
khớp ±1 %. Sửa 2 lỗi trong `computeQhTheoBan` (bản phân khu): (1) **khe hở giữa các ô đất** (mặt nạ đường chỉ là
nét mép đường nới 8 m nên đường rộng / nét đứt còn hở) bị ghi "ngoài phạm vi" → nay điểm bị ô đất bao quanh ≥6/8
hướng trong 60 m (`biBaoQuanh`) = đất giao thông; thửa nằm trọn trong đường không còn mất cả dòng QH;
(2) **"ô trùm"** — vùng tô vẽ trùm qua nhiều lô LẪN đường (vd QĐ2076 'Nhà ở chung cư' 5,7 ha) → điểm trong
mặt nạ đường + chỉ thuộc ô trùm + bị lô thật bao quanh = đất giao thông. Sông/suối/mặt nước KHÔNG bao giờ là
ô trùm. Kiểm 1.000 thửa ngẫu nhiên: 77 thửa đổi, soi 17 thửa trên nét CAD gốc đều đúng. Sửa phần này thì chạy
lại bộ kiểm, không được có phiếu nào tệ đi.

**⚠️ Lớp địa chính `dia_chinh` bị TRƯỢT 0,533 m đông / 0,141 m bắc (đo 10/10/2026).** So 9 thửa có phiếu chính thức
(cùng tờ/số thửa, diện tích trùng 0,1 %) ở 7 xã: lệch đều nhau tới ~1 cm → đơn vị cung cấp đổi VN-2000 → WGS84 bằng
tham số khác bộ 7 tham số Khánh Hoà mà lớp quy hoạch + `vn2000.ts` dùng. `parcels.ts` gọi `chuanToaDoDiaChinh()`
(qhCompute.ts) dịch hình thửa về đúng chỗ TRƯỚC khi chồng lên quy hoạch: tổng lệch 9 thửa 60,7 → 4,4 m².
Diện tích thửa không đổi (chỉ tịnh tiến). **Đừng dịch** hình thửa của phiếu / toạ độ người dùng nhập — đã đúng chỗ.
Nạp lại bản đồ địa chính từ nguồn khác thì đo lại độ trượt (cách đo: `scripts/kiem-tra-qh/README.md`).

**⚠️ CUNG TRÒN PHẢI TÍNH ĐÚNG CÔNG THỨC (11/10/2026) — `scripts/qh-pipeline/cung_chinh_xac.py`.** Chủ dự án đo tay trên
MicroStation thửa 1297 tờ 15 Cam Đức (sát vòng xoay): web lệch 0,5–1,9 m². Nguyên nhân đúng như chủ dự án nghi "thuật toán
đổi DXF → web bị sai": ezdxf đổi cung tròn/bulge thành đường cong Bézier (lệch tới 0,027 % bán kính) rồi bẻ võng 5 cm; QĐ205 qua
ogr2ogr `CONVERT_TO_LINEAR` bẻ 4° một đoạn. Dây cung luôn nằm TRONG cung → hụt dọc mọi đường cong (QĐ2101: trung bình 2,7 m²
mỗi vùng tô cong, có vùng 38,8 m²; thửa 95 tờ 15 thiếu 33,5 m² đất đơn vị ở). Nay: cung tính từ tâm + bán kính + góc, đỉnh giữa
đặt ở bán kính R' để diện tích hình gấp khúc = diện tích cung thật (khớp công thức giải tích tới 10⁻¹⁶); elip = đường tròn kéo
giãn; spline bẻ kiểu Simpson. 5g / 1d dùng `duong_bao_hatch(e)`, 5h đọc THẲNG `QD205.gpkg` (`vong_gpkg`, cung 3 điểm) — đừng
quay lại `ezpath.from_hatch` hay ogr2ogr cho phần TÍNH. Dữ liệu tăng 1,44 → 2,6 triệu đỉnh (~72 MB JSON).

**⚠️ DIỆN TÍCH THỬA ĐO TRÊN MẶT PHẲNG VN-2000 (11/10/2026) — `apps/backend/src/lib/dienTichPhang.ts`.** Sổ đỏ / MicroStation đo
trên mặt phẳng chiếu VN-2000; `ST_Area(geography)` đo trên elipxoit — lệch hệ số k² (Cam Lâm +0,0044 %, Vạn Ninh +0,02 %). Thửa
1297: sổ 3.788,5 — phẳng 3.788,50 — elipxoit 3.788,33. Đo 21.000 thửa: trùng khít sổ từ 31–74 % lên 61–88 %. `parcels.ts` và
`tinhSanQh.ts` PHẢI cùng biểu thức (`sqlDienTichPhang`) vì diện tích nằm trong "dấu" kết quả lưu sẵn.
**Thửa có LỖ THỦNG / NHIỀU MẢNH** (1.350 + 10 thửa trong vùng QH) tính đủ từng vòng, trừ lỗ đúng loại đất (`qhLuu.tinhQhHinh`);
trước chỉ tính vòng ngoài lớn nhất rồi chia đều.
**Phần còn lệch với đo tay là HÌNH THỬA**: thửa 1297 trong `dc15.dgn` của chủ dự án (D:\BandoCamLam\Ban do chep xa Cam Lam\bddc,
DGN V8 — GDAL không đọc được) cộng 8 lần đo = 3.787,44 m², trong khi nhãn bản vẽ + sổ + web = 3.788,5.

**QĐ205 — đối chiếu bản vẽ gốc (10/10/2026).** Nguồn chuẩn nhất: `quyhoach2025/QD205.gpkg` lớp `hatches` (1.947 vùng tô
còn nguyên đường bao + màu + tên lớp có giai đoạn HT/QH2030/QH2045). `QD205.dxf` (788 MB) thì vùng tô đã bị phá thành nét
đứt 15 m, MẤT vùng tô đặc, và **tên lớp KHÔNG phản ánh loại đất** (người vẽ đặt lớp theo kiểu nét) → muốn biết nghĩa lớp phải
xem KHUNG CHÚ GIẢI (lớp `T-cmt 28-02-2023`, góc phải ~X 608.000 Y 1.334.000; 3 cột Hiện trạng / QH 2030 / QH 2045).
Rải 13.910 điểm trong vùng tô gpkg: web khớp 95–100 % mọi lớp, trừ 2 lớp bị SÓT → đã bổ sung bằng
`scripts/qh-pipeline/5c-bo-sung-205-tu-gpkg.py` (đơn vị ở mới mật độ TB 2030 — 857 ha; làng xóm đô thị hoá QH — 56 ha).
⚠️ GDAL đọc vùng tô nhiều vòng sai (vòng đầu = ngoài, còn lại = lỗ) → phải dựng theo LUẬT CHẴN–LẺ; qhCompute không hỗ
trợ ô có lỗ → cắt thành mảnh không lỗ. QĐ205 không có ô "đất giao thông": đường = khe giữa các ô (xem `bao205`).
Web CHƯA phân biệt giai đoạn (hiện trạng / 2030 / 2045) — mọi loại đất QĐ205 đang ghi "2045".

**Đối chiếu với ĐÁP ÁN ĐO THẲNG TRÊN BẢN VẼ (10/10/2026, 8.114 thửa).** Đáp án = cắt hình thửa trên vùng tô gốc + RANH LẬP QUY
HOẠCH của chính bản vẽ (`apps/backend/data/ranh_qh.json`: 7 phân khu + QĐ205, lấy từ level ranh lập QH của DXF/gpkg).
Kết quả sau sửa: phân khu lệch 0,00–0,31 % (phần còn lại = luật ô trùm, đã soi trên bản vẽ: web đúng), QĐ893 0,27 % (khe không
ghi loại → "ngoài phạm vi", đúng nguyên tắc), QĐ205 2,46 % → < 1 %. Những gì đã sửa:
- **Phân khu:** khe hở NGOÀI ranh = ngoài phạm vi; TRONG ranh = đường (bản phân khu để trắng lòng đường); dò 8 hướng chạm mép
  ranh tính như chạm ô đất (đường sát mép ranh).
- **QĐ205 khe hở ≥ 5 m trong ranh = đường** (thay luật "bao 6/8 hướng" trượt ở đường lớn chạy dài); phần ngoài ranh QĐ205 = ngoài
  phạm vi, thửa trọn ngoài ranh không hiện dòng QĐ205 (trước: thửa Phước Đồng / Cam Ranh sát ranh bị ghi "Đất giao thông" cả thửa).
  Thửa không bản nào phủ → `qhNgoaiVung=true`.
- **QĐ205 THIẾU VÙNG TÔ:** vùng tô nhiều vòng lồng nhau phải dựng theo LUẬT CHẴN–LẺ; dựng đúng thì 640 mảnh (158 ha) chưa có ô
  nào phủ → web tính thành đường (thửa 4 tờ 22 Cam Hiệp giữa khối "đơn vị ở" bị ghi đường; lòng quảng trường tròn Cam Đức là cây
  xanh). Bổ sung bằng `scripts/qh-pipeline/5e-bo-sung-phan-sot-205.py` (loại = loại chiếm nhiều nhất của ô web cùng vùng tô) và
  `5d-bo-sung-mat-nuoc-205.py` (mặt nước / sông suối). Nạp lại qh_zones từ đầu thì PHẢI chạy lại 5c → 5d → 5e.
- **QĐ893 thiếu 82 ha vùng tô** (so toàn bộ 12.987 vùng tô gốc với web, 11/10/2026): 4 vùng HỎNG VIỀN (đường bao là chuỗi đoạn
  rời → không dựng được vùng; lớn nhất Điện mặt trời Miền Trung DNL 68 ha Cam An), 1 vùng lẫn VÒNG HỎNG < 4 điểm làm đọc lỗi cả
  vùng (đất quốc phòng 2,2 ha Cam Hòa), và phần còn lại của vùng tô "chỉ có màu" khi bị ô có mã đè một phần (thửa 187 tờ 1 /
  221 tờ 3 Suối Dầu). Web từng ghi "ngoài phạm vi". Bổ sung bằng `scripts/qh-pipeline/5f-bo-sung-vung-to-hong-893.py`
  — chạy lại 5b thì PHẢI chạy lại 5f. Còn lại chỉ là khung chú dẫn (Level 56) và khe không tô màu thật. Ô trùm: mẩu vẽ thừa < 50 m² không tính là "lô con" (dải cây xanh QĐ2222).
- **7 BẢN PHÂN KHU DỰNG LẠI THẲNG TỪ DXF (11/10/2026) — `scripts/qh-pipeline/5g-dung-o-phan-khu.py` thay chuỗi 1b → 4 → 5 cho
  phần TÍNH.** Chủ dự án kiểm nhiều thửa thấy sai; so thẳng bản vẽ với web (rải điểm 10 m khắp ranh 7 bản) ra 3 lỗi của chuỗi cũ:
  (1) **lỗ trong vùng tô bị lấp** — 1b xuất MỖI đường bao thành hình đặc nên cái lỗ thành ô cùng loại vùng ngoài, lô thật trong lỗ
  trùng khít "lỗ giả" → ai thắng là hú hoạ: ~75 ha sai loại (Tây Bắc 36,8 ha đất quốc phòng → nông nghiệp, QĐ2101 7,1 ha nghĩa
  trang → cây xanh, QĐ2222 7 ha hồ nước → du lịch…); (2) **vùng tô NGOÀI ranh** (phần khớp nối vẽ tham khảo) vẫn tính — QĐ2222
  1.742 ha ("Hatch_Khop" 946 ha), Tây Nam 804 ha; thửa 4 tờ 39 xã Cam Lâm trong đầm từng hiện dòng QĐ2222 "Hatch_Khop";
  (3) **thứ tự lớp khác ảnh bản đồ** — ảnh/MicroStation để lớp có mốc năm (QH2030_/QH2045_/QHDD_) trên lớp DAT_, phần tính lại coi
  ngang hàng → QĐ2076 ~250 ha ghi "Nhóm nhà ở thấp tầng" thay vì "Đơn vị ở…". Nay: tô chẵn–lẻ, cắt theo ranh, bậc HT=1 · DAT=2 ·
  có mốc năm=3. Sau sửa: web khác bản vẽ 0,00–0,01 % (sai số lưới rải điểm), 79 phiếu giữ nguyên. Đổi bản vẽ / ranh thì chạy lại
  5g rồi `7-lo-trong-ranh.py` (vùng trắng > 300 m trong ranh = ngoài phạm vi, vd Na Tia ~1.020 ha của Tây Nam — chủ dự án mở DGN
  xác nhận trống thật; thêm lượt 2: vùng "TRẮNG TRƠN" > 60 m không ô đất, không một nét vẽ nào trong file nét
  `quyhoach2025/qd<ma>_net.geojson` lẫn DXF → 10 vùng ~20 ha, Tây Nam 4 vùng rừng — cần cả hai file, thiếu thì bỏ lượt 2 bản đó).
  `qhPhienBan()` băm cả `ranh_qh.json` nên sửa ranh / lỗ là bảng nhớ `qh_luu` tự tính lại. ⚠️ ẢNH TILE phân khu vẫn vẽ từ chuỗi cũ (1b) nên chỗ lỗ có thể còn sai màu — sửa ảnh phải gửi ảnh thử chờ duyệt.
  Vùng tô 'Hatch_Khop' (QĐ2222) = VÙNG KHỚP NỐI với quy hoạch bên cạnh, không phải loại đất: 5g không cho thành ô, phần lọt trong
  ranh ghi vào ranh_qh.json "_khop" = lỗ của ranh (ngoài phạm vi). QĐ918 'DAT_KXD_DulichRung_qh' (lô DLST-01, 31,97 ha, "Khu du lịch
  sinh thái ven hồ Cam Ranh") KHÔNG có trong chú giải — giữ tên level, chờ chủ dự án xác nhận tên.
  **Level TẮT / ĐÓNG BĂNG phải bỏ** (5g, 11/10/2026): QĐ2076 có 290 vùng tô 'DAT_O_Nhomnhao Thaptang' (905 ha, "Nhóm nhà ở thấp
  tầng") + 30 vùng 'DAT_NO_Nhaochungcu' (178 ha, "Nhà ở chung cư") trên level đóng băng — MicroStation không hiện, chú giải không có.
  Web từng ghi ~57,6 ha ĐƯỜNG NỘI BỘ (dải 7–17 m) thành nhà ở; "ô trùm" QĐ2076 từ 52 còn 4 (phần lớn ô trùm chính là lớp đóng băng).
  Toạ độ ô đất mọi bản nay 8 số lẻ (~1 mm) — 6 số lẻ (~10 cm) lệch tới 1,3 m² ở thửa có mép dài; 79 phiếu 9.315 → 9.239 m².
- **QĐ893 DỰNG LẠI (11/10/2026), chuỗi mới: `1d-vung-to-893-chan-le.py` → `5b` → `5f`.** So toàn bản với bản vẽ (lưới 20 m khắp huyện)
  96,6 % → 99,98 %. Đã sửa: (1) **khung chú dẫn Level 56 lọt vào dữ liệu** — 94 ô màu mẫu 11 ha, sơ đồ vị trí góc tây bắc, 2 ô 108 +
  68 ha sát Cam Ranh = 336 ô 2.031 ha "đất" bịa đè lên đất thật Khánh Vĩnh / Cam Ranh (5b nay bỏ Level 56); (2) file vùng tô cũ dựng
  bằng GDAL hiểu sai vùng tô có ĐẢO TRONG LỖ → 1d đọc bằng ezdxf từng hình (nhẹ RAM), chẵn–lẻ đủ vòng, có cả 532 hình SOLID; (3) màu
  xanh nước #7fffff chú dẫn dùng chung cho NTS/SON/MNC/DTL/DCT → vùng ghi mã nhóm nước lấy theo mã (856 ha hồ chứa MNC từng ghi "sông
  ngòi"); (4) màu chú dẫn chỉ dùng cho MỘT mã (bảng `mau_mot_ma_qd893`: xám = NTD, #ffbf7f = CLN, #ffdf7f = HNK, #bfff00 = RPH,
  #dfff7f = NKH, #ffaaaa = DPC) → vùng không ghi mã gọi đúng tên mã; (5) "lọt trong ô có mã" phải PHỦ ≥ 95 % và CÙNG MÀU mới bỏ;
  (6) xếp lớp như bản vẽ hiển thị: mọi ô ngang bậc, ô có vùng tô gốc nhỏ hơn nằm trên (diện tích xếp = vòng ngoài vùng tô gốc, không
  phải mảnh). 79 phiếu: 9.315 → 9.269 m² (8 phiếu tốt lên, 4 phiếu đổi 0,1 m² do làm tròn cung). Còn để nguyên chờ chủ dự án: 714 vùng
  xanh nước KHÔNG ghi mã (4.585 ha) đang gọi "Đất sông, ngòi, kênh, rạch" dù chú dẫn dùng màu này cho cả hồ / thuỷ lợi / ao nuôi.
  (7) NHÃN GHÉP "+" ("TMD+ODT", "NKH+TMD", "DTT+DKV+TMD"… 119 nhãn) = một loại "Đất hỗn hợp (TMD + ODT)" — trước tách mã rồi bỏ mã trái
  màu (thửa 326 tờ 7 Cam Đức: app tham chiếu ghi đất hỗn hợp, web ghi thương mại dịch vụ). Chữ "%%u…%%U" (gạch chân CAD) bỏ trước khi đọc mã.
- **QĐ205 DỰNG LẠI THẲNG TỪ QD205.gpkg (11/10/2026): `5h-dung-o-205-tu-gpkg.py` (+ bảng `lop-205.json` lớp → tên), toạ độ 8 số lẻ (~1 mm).
  Thay hẳn ô cũ (DGN qua GDAL) + 5c / 5d / 5e (không cần chạy nữa).** Ô cũ khác nguồn hình với vùng tô gốc: so cả bản lệch 593 ha khác tên
  (261 ha đất nông nghiệp ghi "Đất đồi núi" — vùng tô bị lấp lỗ), 111 ô tự cắt nhau; thửa 326 tờ 7 Cam Đức dư 33 m² đường so với app tham
  chiếu. Nay chẵn–lẻ, cắt theo ranh (2.036 ha vẽ ra ngoài ranh), so cả bản với gpkg 99,99 %. **Ba luật chia phần KHÔNG TÔ đổi theo:**
  (1) ngoài khung mặt nạ: trong ranh mà không tô = lòng đường, đúng bản vẽ (bỏ luật "cách ô ≥ 2,5 m mới là đường" — nó cắt mỗi bên đường
  2,5 m giao cho ô cạnh; bản thử "khe ≥ 3 m" cũng bỏ vì dư 1,3 m² ở mép cong); (2) trong khung mặt nạ (ảnh điểm 1,8 m, răng cưa): chỗ
  trắng SÁT MÉP ô đã tô (< 2 m, `SAT_MEP_205`) = đường; mặt nạ chỉ quyết phần trắng sâu trong khối không tô; (3) TẮT gộp "mẩu lẻ sát mép
  thửa < 1,5 m" (chủ dự án cần đúng 100 % như bản vẽ; bật lại bằng QH205_GOP_MEP=1). 2.000 thửa ngẫu nhiên: lệch so với gpkg 2,84 % →
  0,00 % (12 m², không thửa nào lệch quá 0,3 m² — toạ độ 8 số lẻ; 6 số lẻ lệch tới 1,3 m², 7 số lẻ 0,45 m²); thửa 326 = 1.218,0 hỗn hợp + 469,0 đường (gpkg 1.217,9 + 469,1; app tham chiếu
  1.218,7 + 468,3).
  **THỬA MỐC 70 TỜ 25 CAM ĐỨC — số ĐÚNG THEO BẢN VẼ (đo phẳng VN-2000 như MicroStation, 11/10/2026):** QĐ205 = 395,2 đơn vị ở +
  116,7 đường; QĐ893 = 395,09 đất ở đô thị + 116,80 đường; QĐ2101 = 395,09 nhóm nhà ở + 116,80 đường. Số mốc cũ 395,5 + 116,4 là do
  ô đất làm tròn 6 số lẻ (~10 cm) — đừng dùng nữa. Chủ dự án đo tay QĐ205 trên dc25.dgn: đường 116,57 m² (web 116,67 — khớp 0,1 m²);
  phần còn lại 392,06 vì thửa 70 trong dc25.dgn chỉ 508,63 m² còn lớp địa chính web 511,89 m² (= diện tích sổ 511,9): chênh do HÌNH THỬA.
  Bẫy đã vấp: (a) sau khi đổi toạ độ, make_valid có lúc trả "hộp chứa" (MultiPolygon + nét thừa) — phải nhặt MỌI đa giác ở mọi tầng
  (`cac_da_giac` trong 5g / 5h / 1d), không thì sót cả nhóm (QĐ205 từng mất 76,8 ha); (b) ogr2ogr `-spat` trên gpkg có lúc BỎ SÓT vùng
  tô (đường cong) — soi một thửa thì xuất toàn bộ vùng tô rồi lọc bằng shapely, đừng tin ảnh soi dùng -spat.
- Đã thử và BỎ: đáp án "giữa 2 nét mép đường -1-TRAFFIC-PAVEMENT trong 35 m = đường" — nét mép đường QĐ205 vẽ không đủ, đường
  rộng bị hụt. Dòng `CACH_O_GAN_M` trong nearestLand nay chạy thật (trước nằm sau return).
Công cụ: scratchpad của phiên (audit*.ts quét thửa thật trong container, dap_an_all.py, ve_thua205.py vẽ thửa lên bản vẽ) — chưa
đưa vào repo; cách làm ghi ở `scripts/kiem-tra-qh/README.md`.

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

**Môi giới chuyên nghiệp** (`routes/moiGioiCn.ts`, 5/10/2026) — giống batdongsan.com.vn: trang xem tin hiện khung
xanh ngọc "Môi giới chuyên nghiệp" CHỈ cho người admin đã duyệt (`users.cn_trang_thai='duyet'`), còn lại khung trắng.
Người dùng bấm "Xin duyệt" ở `/account` khi đủ điều kiện (máy chủ tự kiểm): tài khoản > 3 tháng · ≥ 30 tin ·
đã từng mua gói (điều kiện "đã xác minh SĐT" đang TẠM TẮT — cờ `CAN_XAC_MINH_SDT` trong `moiGioiCn.ts`). Admin duyệt ở `/quan-tri/moi-gioi-chuyen-nghiep`. Chưa có cổng SMS nên xác minh SĐT
là admin gọi điện rồi bấm tay; lưu SỐ đã xác minh (`sdt_da_xac_minh`) nên đổi số là tự mất xác minh.
Cờ `pro` trả ở `/api/listings/agent/:id` (cache 30 giây → duyệt xong ~30 giây mới đổi khung).

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
- **`app/tra-cuu-luat/page.tsx`** — học & tra cứu luật (dữ liệu `public/luat/*.json`, cần đăng nhập). Bộ TÌM (11/10/2026):
  khớp theo **TIẾNG trọn vẹn** ("thu" không dính "thuộc"); gõ **có dấu thì so có dấu**, không dấu thì so không dấu;
  `thuongDau()` quy **hai kiểu đặt dấu thanh** về một (`chuanDau`: "ủy/uỷ", "hòa/hoà" — chính kho luật dùng lẫn: "ủy" 1.909 chỗ,
  "uỷ" 313 chỗ; thiếu bước này gõ một kiểu là sót kiểu kia); `CACH_GOI` đổi **cách gọi đời thường → chữ của luật**
  ("sổ đỏ" → "giấy chứng nhận", "đền bù" → "bồi thường", "UBND"…) để tìm THÊM, xếp sau kết quả đúng chữ đã gõ.
  Tô vàng: điều có nguyên cụm thì chỉ tô cụm, tiếng có mặt > 25 % số điều (vd "đất") không tô lẻ. Mọi chuỗi so khớp phải giữ
  **cùng độ dài** với chữ gốc NFC (`kd`, `thuongDau`) vì vị trí cắt trích đoạn / tô vàng dùng chung.

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

**⚠️ GỐC RỄ đã tìm ra (18/9/2026): bộ tile bản đồ 1,8 GB bị nướng vào ảnh Docker.**
`Dockerfile.prod` làm `COPY apps/frontend ./` — chép cả `public/tiles`. Nên **sửa một dòng mã
là Docker chép lại nguyên 1,9 GB thành lớp mới**, mỗi lần dựng ăn ~5 GB ổ C. Đo thật: ảnh
frontend 3,83 GB, trong đó `/app/public` chiếm 1,9 GB mà riêng `tiles` đã 1,8 GB.
→ Đã vá: `.dockerignore` loại `apps/frontend/public/tiles`, và `docker-compose.yml` gắn thẳng
thư mục đó vào container bằng volume chỉ-đọc. Phục vụ y hệt (nginx vẫn chuyển `/tiles/` sang
frontend), ảnh nhẹ đi 1,8 GB, mỗi lần dựng lại chỉ còn tốn vài trăm MB.
**Thư mục `apps/frontend/public/tiles` phải có sẵn trên ổ đĩa** — không có thì bản đồ mất ảnh
quy hoạch (volume sẽ gắn vào một thư mục rỗng).

**Bộ tile do NGINX phục vụ thẳng, không qua Next.js nữa.** `location /tiles/` dùng `alias`
đọc file từ volume `camlam_tiles` gắn vào nginx. Đo thật 3 lần trên cùng máy:
**nằm trong ảnh Docker 5–7 ms/ô · gắn volume rồi chuyển tiếp qua Next.js 12–16 ms · nginx đọc
thẳng 1,4–2,4 ms** — nhanh gấp 3 lần cả bản gốc, vì bớt hẳn một chặng và một tiến trình Node.
⚠️ Tên volume trong Docker có **tiền tố tên dự án**: khai `camlam_tiles` trong compose thì
volume thật tên `camlamgis_camlam_tiles`. Nạp nhầm vào `camlam_tiles` là nginx trả 404 hết.
Nạp lại bộ tile:
```bash
docker run --rm -v camlamgis_camlam_tiles:/dest camlamgis-frontend:latest sh -c 'cp -a /app/public/tiles/. /dest/'
```

**⚠️ `.wslconfig`: KHÔNG đặt `swap=0`.** Đã đặt nhầm và trả giá ngay — hai lần dựng lại web bị
giết giữa chừng vì "máy hết bộ nhớ" (máy 15,7 GB RAM, `next build` ăn rất nhiều). Nay để
`swap=6GB` và đặt file tràn ở `D:\wsl-swap` cho đỡ ăn vào ổ C.

**Chế độ tự co của WSL (`sparseVhd`) KHÔNG dùng được.** WSL 2.7.8 trả lời thẳng:
*"Sparse VHD support is currently disabled due to potential data corruption"*, muốn bật phải ép
bằng `--allow-unsafe`. Kho này chứa database thật nên **không ép**.
Cũng đã xét và loại: dời kho sang ổ F (3,6 TB trống) — F là **ổ cứng rời cắm USB, định dạng
exFAT**, rút nhầm dây là hỏng database; dời sang ổ D — D chỉ còn 15 GB và nằm chung một SSD
238 GB với ổ C nên không giải quyết được gì.

**Khắc phục: bấm nút `Nen kho Docker (lay lai cho trong o C)`** trên bảng điều khiển `QUAN-LY-SERVER.vbs`
(hoặc nháy đúp `NEN-KHO-DOCKER.bat`). Cả hai chạy chung `NEN-KHO-DOCKER.ps1`, tự xin quyền quản trị.
Sáu bước: dừng web cho PostgreSQL đóng sạch → tắt Docker Desktop → tắt WSL → nén file kho
(`Optimize-VHD`, không có thì `diskpart compact vdisk`) → bật lại Docker → bật lại web + khởi động lại nginx. **Không xoá gì bên trong** — database, ảnh máy, dữ liệu
địa chính nguyên vẹn. Lần chạy thật: **38,46 GB → lấy lại ~21,6 GB cho ổ C**, mất khoảng 5–10 phút.

**ĐÃ ĐẶT LỊCH TỰ ĐỘNG: 2h sáng mỗi ngày.** Công việc Windows tên
`CamLamLand - Nen kho Docker 2h sang` gọi `NEN-KHO-DOCKER.ps1 -TuDong` (chạy ẩn, quyền quản trị,
máy đang ngủ thì tự đánh thức). Nhật ký ghi ra `logs/nen-kho-docker.log`.
Đặt lại / xem lại bằng cách nháy đúp `DAT-LICH-NEN-KHO.bat`. Bỏ lịch:
`Unregister-ScheduledTask -TaskName 'CamLamLand - Nen kho Docker 2h sang' -Confirm:$false`.
Chạy tự động có thêm **bước [0/6] `docker builder prune -af`** — đây mới là thứ làm kho phình ra.

Trước khi nén nhớ `docker compose ... stop` cho PostgreSQL đóng sạch (exit 0). Dọn thêm:
`docker builder prune -af` (đệm build) và `docker image prune -a` (ảnh không dùng) — **TUYỆT ĐỐI KHÔNG**
chạy `docker volume prune`: volume chứa database, lúc container đang tắt nó hiện là "không dùng".

## Tin đăng mẫu (dữ liệu để xem thử giao diện)

58 tin Cam Lâm **sát giá thị trường thật**, nằm ở `scripts/tin-mau/` — đọc
`scripts/tin-mau/README.md`. Nạp lại bất cứ lúc nào:

```bash
node scripts/tin-mau/nap-tin-mau.mjs > nap-tin.sql
docker compose exec -T postgis psql -U camlam -d camlam_gis < nap-tin.sql
```

Giá đặt theo giá rao **thật** đo trên batdongsan.com.vn ngày 22/9/2026, chia theo từng xã,
và tôn trọng quy luật **lô càng to giá mỗi m² càng rẻ** (Cam Hải Đông: lô 194m² = 47,9 tr/m²
nhưng lô 9.000m² chỉ 3 tr/m²). Trước đó database có 347 tin sinh ngẫu nhiên từ lúc đo tải,
giá vô lý (biệt thự Suối Cát 71m² giá 15,9 tỷ = 224 tr/m²) và **cả 355 tin chỉ dùng chung
5 tấm ảnh Unsplash** nên mọi thẻ tin nhìn y hệt nhau.

Script **giữ nguyên tin thật**, chỉ xoá tin của tài khoản `demo-agent-*@camlam.local`.
Trang `/gia-dat` tính mặt bằng giá **từ chính tin đăng**, nên tin sai thì trang giá cũng sai —
sửa tin là trang giá tự đúng theo.

⚠️ **Ba chỗ dễ vấp** (đã vấp cả ba):
1. **Tin hạng `normal` tự ẩn sau 7 ngày** nếu không được đẩy (`routes/listings.ts`). Rải ngày
   đăng trong 45 ngày ⇒ nạp 58 tin mà ngoài web chỉ thấy 27. Tin thường phải đăng trong 6 ngày trở lại.
2. **Thêm ảnh vào `apps/frontend/public/` xong phải dựng lại frontend** (`up -d --build frontend`
   rồi `restart nginx`), vì bản chạy thật đóng gói `public/` vào ảnh Docker — chép file vào thôi thì vẫn 404.
3. **Đổi nội dung ảnh mà giữ nguyên tên file** ⇒ trình duyệt vẫn hiện ảnh cũ (web là PWA,
   Service Worker giữ ảnh). Phải xoá cache hoặc Ctrl+Shift+R.

Ảnh: `public/bai-dai/` là ảnh Bãi Dài **thật** của Cam Lâm; `public/tin-mau/` là ảnh minh hoạ
theo loại hình (nguồn + giấy phép ghi ở `tin-mau/NGUON-ANH.txt`). Có ảnh chụp thật thì thay
thẳng vào, giữ nguyên tên file.

## Độ bo tròn góc — CHỈ CÓ MỘT THANG

Khai ở **`apps/frontend/tailwind.config.js`**, mục `borderRadius`. Đo thật trên
batdongsan.com.vn (22/9/2026) thấy họ chỉ dùng **4 mức: 0 · 4px · 8px · tròn hẳn**
(4px cho thẻ tin, ảnh trong thẻ và nút — đây là mức chủ đạo). Giao diện mình trước
đó dùng **13 mức khác nhau trên 2065 chỗ** nên nhìn lộn xộn.

Cách gom: **không sửa tay 2065 chỗ** (dễ sót, dễ làm hỏng) mà đổi ý nghĩa các mức
ngay trong `tailwind.config.js` → `rounded-md` và `rounded` = 4px, `rounded-lg`,
`rounded-xl`, `rounded-2xl` = 8px, `rounded-full` = tròn. Tên class giữ nguyên hết.
⚠️ **Ở dự án này `rounded-xl` KHÔNG phải 12px và `rounded-2xl` KHÔNG phải 16px**
như mặc định của Tailwind. Muốn trả về như cũ thì xoá khối `borderRadius` đó.
Mấy chỗ ghi thẳng số (`rounded-[11px]`…) đã đổi hết, **đừng viết kiểu đó nữa**
vì nó không đi qua cấu hình nên lại lệch thang.

## Bảo mật & IP thật (rà soát 29/9/2026)

**Tiện ích bảo mật 2 lớp (30/9/2026).** Lớp 1: MỌI công cụ tiện ích phải đăng nhập — mỗi thư mục công cụ
có `layout.tsx` bọc `components/CanDangNhap.tsx`, khung `/tien-ich` (`HubShell`) cũng bọc khung nhúng bằng nó.
Máy chủ chặn thêm: `/api/pdftools`, `/api/qr`, `GET /api/van-ban` cần đăng nhập (401). Lớp 2 giữ nguyên
(danh sách nóng, mã xác thực, tra cứu luật theo vai trò). ⚠️ Chặn ở giao diện KHÔNG giấu được chữ viết
cứng trong trang (cẩm nang, bảng giá đất vẫn nằm trong mã HTML) — dữ liệu thật sự cần giấu phải để sau API
có `authRequired`. Thêm công cụ mới thì nhớ tạo `layout.tsx` y hệt.
**Bốn trang BÀI ĐỌC dùng "khoá mềm"** (`components/KhoaMem.tsx`): `/cam-nang`, `/bang-gia-dat`, `/gia-dat`, `/den-bu`.
Toàn bài vẫn nằm trong trang (Google đọc được, kéo khách), người chưa đăng nhập chỉ thấy phần đầu + ô mời
đăng nhập. Kèm dữ liệu cấu trúc `isAccessibleForFree:false` trỏ vào `.cl-noi-dung-khoa` (`lib/ldKhoaMem.ts`)
— **đừng bỏ khai báo này**, thiếu nó Google coi là che giấu nội dung (cloaking) và phạt. Trong khung
`/tien-ich` bốn trang này vẫn khoá cứng.

**Tối ưu Google (30/9/2026):**
- Layout gốc khai `canonical: '/'` → **trang nào không tự khai canonical sẽ bị coi là bản sao trang chủ**
  và Google bỏ qua. Đã dính ở `/listings`, `/tin-tuc`, `/map`, `/dau-tu`, `/dichvu` (trang 'use client' →
  khai trong `layout.tsx` cạnh nó) và 6 trang pháp lý. **Trang mới nào cũng phải có `alternates.canonical`.**
- Tên trang KHÔNG tự ghi đuôi "| Cam Lâm Land" — khuôn ở layout gốc tự thêm.
- `sitemap.ts`: có bài cẩm nang, bài tin tức, tin đăng (thử `BACKEND_HOST` rồi tên miền thật — lúc đóng gói
  máy chủ dữ liệu chưa chạy). `lib/seoLanding.ts` có thêm 4 trang xã MỚI (`xa-cam-lam`, `suoi-dau`, `cam-hiep`,
  `cam-an`); hướng/toạ độ các xã đo lại từ bảng `dia_chinh` (bản cũ ghi Suối Cát/Suối Tân ở phía nam — sai).
  `WARD_EXPAND` (routes/listings.ts) sửa đúng theo NQ 1667.

- **IP thật của khách:** tunnel nằm trong mạng riêng `duong_ham` với địa chỉ CỐ ĐỊNH `172.31.253.2`
  (`docker-compose.tunnel.yml`); nginx chỉ tin `CF-Connecting-IP` từ đúng địa chỉ đó (`set_real_ip_from`)
  rồi GHI ĐÈ `X-Forwarded-For`/`X-Real-IP`/`CF-Connecting-IP` bằng `$remote_addr`. Trước đó backend thấy
  mọi khách cùng IP của tunnel → giới hạn tốc độ tính chung cả web.
- **Kiểm cấu hình nginx:** dùng `docker exec camlam_nginx nginx -t`, KHÔNG dùng `docker compose run nginx`
  (container tạm xin trùng địa chỉ cố định → "Address already in use").
- `/api/auth/verify-email` và `/resend-code` ĐÃ TẮT (410): từng trả mã trong phản hồi + cấp thẻ đăng nhập
  → chiếm được tài khoản admin không cần mật khẩu. Bật lại thì phải gửi mã qua email thật.
- Ảnh tải lên nhận diện bằng **chữ ký nhị phân** (JPEG/PNG/GIF/WebP/PDF), không tin mimetype.
- Chữ người dùng ghép vào `popupHtml` của MapView PHẢI qua `escHtml()` (`lib/escHtml.ts`).
- Lỗi ≥500 không trả nguyên văn lỗi DB cho người ngoài (`middleware/error.ts`).
- Kho tin tức `/app/.kho-tin` gắn volume `tin_kho` (trước mất mỗi lần dựng lại).
- Trang bảo trì trả **503** (`error_page … =503`), đừng đổi lại 200.
- **Danh sách nóng** (có CMND/CCCD người dân): file gốc nằm ở `apps/backend/du-lieu-rieng/danh-sach-nong.json`
  (**đã loại khỏi git**, không còn ở `public/`), chỉ phục vụ qua `GET /api/hotlist/goc` cho **admin hoặc vai
  trò `hotlist`** — đúng quyền "🔥 Tra cứu danh sách nóng" cấp trong trang quản trị. Mọi đường `/api/hotlist`
  đều kiểm quyền đó ở MÁY CHỦ (trước chỉ che ở giao diện). Máy mới clone về phải chép tay file này vào.
- **Mật khẩu:** bcrypt độ khó 12; hash cũ (độ khó 10) vẫn đăng nhập được và **tự băm lại** khi đăng nhập đúng.
  Mật khẩu MỚI: ≥ 8 ký tự, có chữ và số, không thuộc danh sách dễ đoán (`kiemMatKhauMoi` trong `lib/auth.ts`).
  Sai 8 lần/15 phút → khoá tạm tài khoản 15 phút. Email không tồn tại vẫn so với hash giả (thời gian như nhau).
- **Theo dõi tài khoản (TẠM, 1/10/2026 — chủ dự án sẽ xoá sau):** `routes/theoDoiTk.ts` ghi mọi lần gọi máy chủ +
  đăng nhập của các tài khoản trong bảng `theo_doi_tai_khoan` (2 email ghi trong file) vào `theo_doi_hoat_dong`;
  admin xem ở `/quan-tri/theo-doi-tai-khoan` (`GET /api/theo-doi/bao-cao`, chỉ admin). Trang đã mở do
  `components/TheoDoiTrang.tsx` báo về (`POST /api/theo-doi/trang`, chỉ lưu nếu là tài khoản đang theo dõi).
  Cách gỡ ghi ở đầu `theoDoiTk.ts`.
- **SĐT người đăng** (`/api/listings/agent/:id`) trả số ĐÃ CHE; số đủ qua `POST /agent/:id/reveal` (phải đăng nhập).

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
- **⚠️ Đừng dùng `grep` chữ tiếng Việt để kiểm tra code đã lên web chưa.** Gói JS sau khi nén lưu chữ
  **nửa nguyên nửa mã hoá**: `"\uD83D\uDCD6 Đọc bên cạnh \xb7 "` — biểu tượng và vài chữ như `ê`, `·`, `à`
  bị đổi thành mã `\uXXXX`, các chữ khác giữ nguyên. Tìm bằng chữ thường ra **0** dù code có thật
  → tưởng chưa build, dựng lại web mấy lần vô ích (mỗi lần ăn vài GB ổ C, đã từng làm sập web vì hết chỗ).
  **Cách đúng:** tìm bằng phần ASCII chắc chắn không đổi — tên biến/hàm (`docBen`, `moDieuHopLy`),
  hoặc mã escape của biểu tượng. Chắc nhất là mở trình duyệt bấm thử.
  (Cùng gốc với bẫy NFD ở phần đọc Excel của Sở: chữ Việt có nhiều cách lưu khác nhau.)
- **Vector quy hoạch lệch so với ảnh nền** → dựng lại từ file CAD gốc theo `scripts/qh-pipeline/README.md`,
  **đừng chỉnh tay GeoJSON**.
- **Bị chặn 429 khi đo tải** → tạm đặt `RATE_LIMIT_GLOBAL` rất cao trong `.env`, đo xong nhớ gỡ.
