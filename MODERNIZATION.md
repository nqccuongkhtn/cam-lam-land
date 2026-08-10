# Hiện đại hoá UI/UX — Cam Lâm Land (bản ghi chương trình)

> Toàn bộ thay đổi là **additive, không đụng backend/API/logic nghiệp vụ**, có **backup** để lui.
> Môi trường làm việc **không chạy được build/thiết bị**, nên mỗi thay đổi được rà bằng đọc kỹ + giữ rủi ro thấp,
> và phần **lõi maplibre không bị chạm** (chỉ sửa "chrome" quanh bản đồ).

## 1. Nền hệ thiết kế
- Token thương hiệu vào `tailwind.config.js`: `navy` (#0A2540), `gold` (#C8A14B) → dùng `bg-navy` / `text-gold` / `bg-navy/5`… (giá trị `bg-[#0A2540]` cũ vẫn chạy).
- 7 primitive dùng chung — `apps/frontend/src/components/ui/`:
  `Button` (+ `buttonClass` cho `<Link>`), `Card`, `Badge`, `Chip`, `Skeleton`, `EmptyState`, barrel `index.ts`.
- Trang gallery đối chiếu: **`/design-system`**.

## 2. Cảm giác nhanh (perceived performance)
- Skeleton **khớp hình dạng thật** (giảm giật layout / CLS): feed danh sách, trang chi tiết, lưới "tin tương tự".
- **14 route-level `loading.tsx`** (trước đó app có 0) — phủ HẾT route dữ liệu tải-khi-mở user-facing: listings, listings/[id], map, account, cam-nang, sales, tin-tuc, gia-dat, dau-tu, consignments, dichvu, moi-gioi/[id], sales/edit/[id], sales/leads/[id] → phản hồi tức thì khi bấm chuyển trang.
- Empty/error chuẩn hoá bằng `EmptyState` (feed: không kết quả / tin lưu / giỏ của tôi; chi tiết: không tìm thấy).
- **Vòng focus bàn phím (a11y WCAG)** toàn app: `:focus-visible` cho a/button/[role=button]/summary/[tabindex] — chỉ hiện khi Tab, không ảnh hưởng chuột/chạm.
- **Phản hồi chạm phủ 100% CTA + thẻ user-facing** (auth, tạo/sửa tin, hồ sơ, bán, tư vấn, chat, so sánh, nav, trang chủ, tin tức, marketplace, bản đồ) — nguyên tắc: có `transition`→`active:scale`, không có→`cl-press`.

## 3. Vi-tương-tác & độ mượt
- Ảnh hiện dần (an toàn với ảnh đã cache): ảnh bìa thẻ feed (mobile), ảnh hero trang chi tiết.
- Phản hồi chạm nhất quán (`cl-press` / `cl-tap` / `active:scale`) — chọn kỹ để **không mất hiệu ứng hover**:
  marketplace (feed + chi tiết + CTA "Hiện số"), trang chủ (thẻ khu vực, chip loại hình, 2 CTA lớn, nút Bản đồ/QR), tin tức (5 loại thẻ).
- Menu trên/thanh tìm kiếm: sửa khe hở trên iOS bằng cách bỏ `transform` trên `position:sticky` → đặt vị trí theo biến `--cl-nav-h` (không còn lộ dải feed).

## 4. Bản đồ — CHỈ chrome, không đụng lõi maplibre
- Panel "Lớp bản đồ": trạng thái "Đang tải…" → **skeleton 3 hàng** khớp dạng.
- Thanh công cụ mobile: 4 icon **emoji → SVG nét mảnh** + lún nhẹ khi chạm.
- Nút "Vẽ thửa từ toạ độ" và "Tra cứu": chuẩn hoá **navy + phản hồi chạm** (nút Tra cứu trước là blue lệch thương hiệu).
- Cụm control maplibre (zoom/định vị): bo góc, viền mảnh, shadow dịu (CSS thuần trong `globals.css`).

## Cách kiểm chứng (mở app → hard refresh Ctrl+Shift+R)
| Khu vực | Liếc gì |
|---|---|
| `/design-system` | Toàn bộ primitive ở mọi biến thể render đúng |
| `/listings`, `/listings/[id]` | Bấm chuyển trang thấy skeleton tức thì; kéo xuống "tin tương tự" thấy thẻ xám trước |
| Trang chủ, `/tin-tuc` | Chạm thẻ/CTA thấy lún nhẹ |
| `/map` | Panel "Lớp" có skeleton; 4 nút icon SVG + lún; **bản đồ pan/zoom/bấm-thửa vẫn chạy** |

## Còn lại (giá trị cao nhưng cần thiết bị / độ sâu → làm theo lát testable)
- **Tương tác lõi bản đồ**: chọn thửa mượt hơn, clustering đẹp, đo đạc — nằm trong `MapView`/maplibre, không sửa mù được.
- **Tìm kiếm hợp nhất**: một ô cho địa chỉ / thửa / toạ độ / quy hoạch / khu hành chính.
- **Migrate toàn bộ** nút/thẻ sang primitive: an toàn về code nhưng dễ đổi sắc thái đã tinh chỉnh → nên làm khi có mắt xác nhận.

## Lui về (rollback)
```
cp -r backup/frontend-before-modernization/src apps/frontend/
```
Khuyến nghị: tạo mốc git `pre-modernization` (branch + tag) để lui từng bước thay vì một cục.

## Quy ước cho các bước sau
- Phần tử ĐÃ có `transition` → thêm `active:scale-[.9x]` (mượt qua transition sẵn có, giữ hover).
- Phần tử KHÔNG có `transition` → dùng `cl-press` / `cl-tap`.
- Card lặp `bg-white rounded-2xl border` → thay bằng `<Card>` (output y hệt, giảm trùng lặp).
- Trạng thái tải/rỗng → `Skeleton` / `EmptyState`.
