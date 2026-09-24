# Việc còn nợ — công cụ Tạo video bản đồ

*Ghi lại để lần làm việc sau bắt tay vào là chạy được ngay, khỏi mất công dò lại từ đầu.*

---

## Việc 1 — LÀM ĐẸP GIAO DIỆN DỰNG (ưu tiên cao nhất)

Phần **video xuất ra** đã làm xong (nhìn điện ảnh, chữ tiêu đề, thẻ thương hiệu, biểu đồ, mẫu chữ động).
Còn lại là **thứ người dựng nhìn thấy khi làm việc**. Mục tiêu: cả công cụ dùng **một ngôn ngữ thiết kế
duy nhất**, giống bộ sưu tập ghim và bảng biểu đồ đã làm.

Ngôn ngữ thiết kế đã chốt (bám theo, đừng bịa kiểu mới):

| Thứ | Cách làm |
|---|---|
| Thẻ đang chọn | `linear-gradient(180deg, rgba(200,161,75,.16), rgba(200,161,75,.03))` + viền vàng 1.5px + quầng `0 10px 26px -14px rgba(200,161,75,.7)` |
| Thẻ thường | nền `#0b1826` + viền tóc `0 0 0 1px #223c58` |
| Rê chuột | `transition hover:-translate-y-px` |
| Bo góc | thẻ lớn `rounded-2xl`, ô nhỏ `rounded-xl`, chip `rounded-full` |
| Chữ | tên 13px đậm, mô tả 11px `text-slate-400`, nhãn nhóm 10px in hoa `tracking-wide text-slate-500` |
| Bệ trưng bày | nền `radial-gradient(115% 85% at 50% 0%, #23486f, #12283f 52%, #0a1727)` + lưới mờ + bóng dưới chân |

Danh sách việc, xếp theo mức đáng làm:

1. **Đầu mỗi bảng cài đặt** — hiện mỗi bảng tự viết một kiểu. Làm một mẫu chung:
   huy hiệu biểu tượng + tên bảng + một dòng mô tả + gạch phân cách.
   (Các bảng: `panel === 'duan' | 'chu' | 'lodat' | 'the' | 'vung' | 'ghim' | 'bankinh' | 'manhinh' |
   'amthanh' | 'bieudo' | 'media' | 'xuat' | 'mau' | 'camera' | 'tuyen'`)
2. **Cột công cụ bên trái** — ô đang chọn: nền chuyển sắc vàng + thanh chỉ báo dọc bên trái;
   rê chuột thì nhấc 1px; nhãn nhóm mảnh hơn, có đường kẻ phân cách.
3. **Thanh kịch bản** (hàng `01 · Vị trí`, `02 · Hạ tầng`…) — đổi thành chip bo tròn,
   chip đang mở dùng nền vàng chuyển sắc.
4. **Nút chính** — `▶ Chạy thử`, `🎥 Quay & xuất MP4`, `⬇ Xuất video`, `📦 Xuất cả bộ`:
   nền chuyển sắc + bóng đổ + nhấc khi rê chuột. Nút phụ dùng nền kính mờ `rgba(255,255,255,.08)`.
5. **Dòng thời gian** — hàng track bo góc có viền tóc; clip có chuyển sắc + bóng nhẹ;
   rê chuột thì sáng lên; tên track căn đều.
6. **Ô nhập liệu** trong `.cl-card` — đã có nền tối, thêm trạng thái rê chuột và bo góc đều tay.

Sửa ở đâu:
- CSS dùng chung: `apps/frontend/src/app/globals.css` (mục `.cl-video-tool .cl-card` và khu điện thoại).
- Giao diện: `apps/frontend/src/app/tao-video-ban-do/page.tsx`.

---

## Việc 2 — GHIM ĐẸP HƠN NỮA (làm nếu còn thời gian)

Hiện có 15 kiểu ghim tự vẽ bằng canvas (`makePinImage`, `makeNeonPin`, `makeBadgePin`) + 24 biểu tượng
nét vẽ kiểu Lucide (`GLYPHS`).

Hướng nâng cấp, xếp theo mức đáng làm:

1. **Tìm bộ biểu tượng đẹp hơn cho 24 tiện ích** — ưu tiên bộ có giấy phép thoáng, dùng được thương mại,
   dạng đường dẫn SVG để dán thẳng vào `GLYPHS` (Lucide MIT · Tabler MIT · Phosphor MIT · Material Symbols Apache-2.0).
   Chú ý: chỉ lấy **đường dẫn path**, không thêm thư viện ngoài — cả bộ ghim đang vẽ bằng canvas,
   thêm thư viện là gánh nặng vô ích.
2. **Thêm dáng ghim mới**: giọt nước kính trong (glassmorphism), huy hiệu men sứ, ghim có ảnh thật
   bên trong (dùng ảnh tiện ích), ghim kèm khoảng cách ("Biển 1,2km").
3. **Bóng đổ theo mặt đất** — bóng hình elip nghiêng theo góc camera, ghim sẽ "đứng" trên đất thật hơn.
4. **Ghim gom nhóm** khi thu nhỏ bản đồ (nhiều ghim sát nhau gom thành một, hiện số lượng).

---

## Việc 3 — BUILD LẠI MÁY CHỦ (chủ dự án đã đồng ý sẵn)

Làm xong hai việc trên thì build lại và báo kết quả:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.tunnel.yml up -d --build frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.tunnel.yml restart nginx
```

*(Nhớ `restart nginx` — container frontend tạo mới thì nginx còn trỏ địa chỉ cũ, `/api` sẽ lỗi 502.)*

---

## Cách kiểm tra (đã dùng suốt các lượt trước, cứ theo)

```bash
# 1. Cú pháp nhanh
"C:/Users/ADMIN/AppData/Local/npm-cache/_npx/ff97892ce172d9e9/node_modules/@esbuild/win32-x64/esbuild.exe" \
  "apps/frontend/src/app/tao-video-ban-do/page.tsx" --jsx=automatic --outfile=/tmp/out.js

# 2. Kiểm tra kiểu đầy đủ (cần server đang bật)
docker cp "apps/frontend/src/app/tao-video-ban-do/page.tsx" camlam_frontend:/app/src/app/tao-video-ban-do/page.tsx
docker exec camlam_frontend sh -lc './node_modules/.bin/tsc --noEmit'
```

**Lỗi kiểu có sẵn từ trước** (KHÔNG phải do mình gây ra, đừng hoảng):
`page.tsx(~2930,56): TS2345 ... 'any[]' is not assignable to '[number, number]'` — ở chỗ gọi `bearingToParcel`.

**Xem bằng mắt:** cắt phần hàm vẽ ra file riêng, dịch bằng esbuild, dựng trang HTML thử rồi chụp màn hình
bằng công cụ Chrome (đã làm vậy cho biểu đồ, thẻ thương hiệu, mẫu chữ — script mẫu nằm ở thư mục scratchpad
của phiên làm việc).

**Xuống dòng:** `page.tsx` và `globals.css` dùng **CRLF**; `QUAN-LY-SERVER.ps1` và mấy file PDF dùng **LF**.
Ghi file nhớ giữ đúng kiểu, không thì cả file hiện thành "đã đổi" trong git.

---

## Việc 4 — RÀ SOÁT BẢO MẬT TOÀN WEB (làm nếu còn thời gian sau việc 1–3)

Mục tiêu: tìm và **vá** lỗ hổng để không bị hack. Đây là rà soát trên chính dự án của mình, làm
theo hướng phòng thủ. Có sẵn kỹ năng `/security-review` — dùng nó cho phần thay đổi gần đây,
nhưng vẫn phải soi thủ công những chỗ dưới đây vì chúng là điểm yếu đặc thù của dự án này.

### Chỗ cần soi, xếp theo mức nguy hiểm

| # | Chỗ | Soi cái gì |
|---|---|---|
| 1 | `apps/backend/src/routes/imports.ts` + `apps/gis-worker` | Nhận file GIS rồi gọi `ogr2ogr`. Tên file có bị nhét lệnh vào được không (command injection)? Đường dẫn có thoát ra ngoài thư mục được không (`../`)? Có giới hạn dung lượng, đuôi file, số lần tải lên? |
| 2 | Mọi câu SQL trong `apps/backend/src` | Có chỗ nào **ghép chuỗi** vào SQL thay vì dùng tham số `$1` không → tìm `query(` kèm dấu `+` hoặc backtick |
| 3 | `middleware/auth.ts` + mọi route `admin`, `gis`, `vanban`, `hotlist` | Route nào **quên** gắn hàm chặn quyền? Đối chiếu từng `app.use` trong `index.ts` với hàm chặn tương ứng |
| 4 | `lib/auth.ts` | JWT: thời hạn, thuật toán (cấm `none`), `JWT_SECRET` rỗng thì sao; mật khẩu băm bằng gì, số vòng |
| 5 | Route công cụ PDF/OCR (`pdftools`, `ocr`) | Gọi `libreoffice`, `ocrmypdf`, `qpdf`, `ghostscript` — tham số có lấy thẳng từ người dùng không? Có tải file từ URL do người dùng đưa không (SSRF)? Dọn file tạm chưa? |
| 6 | `routes/danhMuc.ts`, `aiScript`, `chat` | Khoá Anthropic lưu mã hoá AES trong `app_config` — khoá giải mã lấy từ đâu, có lộ ra API không? Nội dung người dùng nhét vào prompt có bị lợi dụng để moi khoá/dữ liệu không? |
| 7 | `routes/images.ts` | Phục vụ ảnh từ Postgres. Có chặn được việc dò ID để lấy ảnh của người khác không? Kiểu MIME có bị giả mạo để chạy script không? |
| 8 | Thanh toán | `PAYMENT_WEBHOOK_KEY` — webhook có kiểm chữ ký/khoá không, có chống phát lại (replay) không? Có ai tự gọi để cộng gói cho mình được không? |
| 9 | `index.ts` — CORS + `middleware/security.ts` | Allowlist có chặt không; header bảo mật đủ chưa (CSP, X-Frame-Options, HSTS, Referrer-Policy); bộ hạn chế số lần gọi có che được các route nặng và route đăng nhập chưa |
| 10 | `nginx/nginx.conf` | `proxy_cache` có **chắc chắn** bỏ qua request có `Authorization` không (kẻo lộ dữ liệu riêng tư sang người khác); có giới hạn dung lượng tải lên không |
| 11 | Frontend | Tìm `dangerouslySetInnerHTML` — nội dung đưa vào có từ người dùng không (XSS). Token lưu ở đâu (localStorage vs cookie HttpOnly) |
| 12 | Kho mã nguồn | `git log -p` tìm khoá bí mật lỡ commit; kiểm `.gitignore` còn chặn `.env`, `ocr-server/`, `backup/` không |
| 13 | Thư viện | `npm audit` cho từng app, xem lỗ hổng mức cao/nghiêm trọng |

### Cách làm
- **Vá luôn** những lỗi rõ ràng và ít rủi ro (thiếu hàm chặn quyền, thiếu tham số hoá SQL, thiếu giới hạn dung lượng).
- Lỗi cần đổi kiến trúc hoặc có thể làm gãy tính năng đang chạy → **ghi ra danh sách kèm mức nguy hiểm**
  và hỏi chủ dự án trước khi đụng vào.
- Viết kết quả vào `docs/BAO-CAO-BAO-MAT.md`: mỗi lỗi ghi *chỗ nào · kẻ xấu làm được gì · đã vá thế nào*.
  Viết tiếng Việt đời thường, chủ dự án không rành thuật ngữ.
- **Đừng** vá kiểu tắt bớt tính năng cho an toàn (vd tắt upload) — phải giữ web chạy đúng như cũ.
