# BÁO CÁO KHẢO SÁT & ĐỐI CHIẾU V2 — công cụ "Tạo video bản đồ" của Cam Lâm Land

> Thực hiện theo **mục 10.1** của `docs/CAMLAMGIS_MAPEFFECT_BRIEF_V2.md`
> (brief ghi tên file là `docs/mapeffect-brief-v2.md` — trong kho thực tế tên là
> `CAMLAMGIS_MAPEFFECT_BRIEF_V2.md`, cùng một tài liệu).
>
> **Ngày khảo sát:** 23/08/2026 · **Phạm vi:** đọc mã nguồn, KHÔNG sửa một dòng code nào.
> **Bản mã nguồn:** `apps/frontend/src/app/tao-video-ban-do/page.tsx` — **10.087 dòng**
> (đã gồm các thay đổi ngày 23/08/2026: chờ khung hai đợt, dò sức máy, ưu tiên nén bằng card).

---

## 0. Tóm tắt cho người bận

- Brief **mô tả đúng phần lớn** hiện trạng. Trong 7 chẩn đoán ở mục 4.2: **4 đúng hoàn toàn**,
  **3 đúng một phần** (có chi tiết brief nói "không có" nhưng thực tế **đã có**).
- Ba chỗ brief nói thiếu mà **code đã có**: (a) **thanh % tiến độ** khi render kỹ;
  (b) **nạp ảnh trước khi quay** (có, nhưng chỉ đủ cho kiểu bay "Dẫn đường");
  (c) vòng chờ khung **không chạy bằng `requestAnimationFrame`** mà bằng `MessageChannel`.
- Chỗ brief nói đúng và **nghiêm trọng nhất**: chờ khung bằng **so sánh điểm ảnh**, trần chờ
  **3 → 12 giây** mỗi khung, **không có nút Dừng lúc đang quay**, **không có ETA**, âm thanh
  **ép quay thời gian thật**, phụ thuộc **esm.sh/unpkg** lúc chạy.
- **Chưa đo được** thời gian render 8 giây · 1080p30 (2D và 3D) — lý do và cách đo ở **mục 3.8**.

---

## 1. Bản đồ mã nguồn (yêu cầu 10.1 — ý 1)

### 1.1 File chính

| Vai trò | File | Ghi chú |
|---|---|---|
| Toàn bộ công cụ video | `apps/frontend/src/app/tao-video-ban-do/page.tsx` | 10.087 dòng — một file duy nhất, chưa tách module |
| Nạp ảnh trước (prefetch) | `apps/frontend/src/lib/tilePrefetch.ts` | 369 dòng — hàng đợi có ưu tiên, giới hạn số ảnh cùng lúc |
| Tìm đường (routing) | `apps/frontend/src/lib/chiDuong.ts` | gọi backend `/api/chi-duong` (không gọi thẳng dịch vụ ngoài) |
| Hoàng Sa · Trường Sa | `apps/frontend/src/lib/bienDao.ts` | `themLopBienDao(map)` — bắt buộc với mọi bản đồ |

### 1.2 Các thành phần bên trong `page.tsx`

| Thành phần | Dòng | Ghi chú |
|---|---|---|
| Khởi tạo bản đồ | 2837 | `new maplibregl.Map` · `maxTileCacheSize: soOAnhNenGiu(1)` (2912) · `fadeDuration: 0` (2913) |
| Nguồn ảnh nền | 24–28, 152–154, 2852–2861 | Esri (`World_Imagery`, `World_Street_Map`, `Canvas/World_Dark_Gray_Base`) + EOX Sentinel-2 (`SAT_OPEN`) |
| Nguồn độ cao (DEM) | 139, 2841 | `/api/do-cao/tile/{z}/{x}/{y}.png` · `raster-dem` · `tileSize: 256` · `maxzoom: 13` · `terrarium` |
| Địa hình 3D | 4183 `can3d()` · 4249 `chuanBiDiaHinh()` · 4345 `traLai3d()` | 3 chế độ: Tự động / 2D / 3D |
| **Hàm chờ khung (pixel-diff)** | **3991 `choKhungVeXong()`** · 64 `vanTayKhung()` · 76 `khacNhauBaoNhieu()` · `phanTrong()` | đúng hàm `ch`/`cu` brief mô tả |
| Chờ khung — lớp bọc 2 đợt | 4022 `choKhungThatXong()` | thêm ngày 23/08: 3 s → thêm 9 s → mới đành chụp |
| Dò sức máy (GPU tier) | ~8700 `doSucMay()` | đọc `WEBGL_debug_renderer_info`; nút "Hợp máy này" ở 6706 |
| Vòng render — dẫn đường | 5643–5726 | render kỹ: `elMs = soKhung*1000/FPS`, gọi `step()` đệ quy |
| Vòng render — keyframe/flycam | 4773–4826 | cùng cơ chế |
| Máy ghi WebCodecs | 8681 `taoMayGhiChuan()` · 8639 `chonKieuNen()` | `avc1.4D0032 → 640032 → 42E032` × (`prefer-hardware` → `no-preference`) |
| Muxer | 8782–8787 | `mp4-muxer@5.2.1` **nạp từ esm.sh lúc chạy**; `FileSystemWritableFileStreamTarget` khi có `showSaveFilePicker`, không thì `ArrayBufferTarget` |
| Backpressure | 8856 | `encodeQueueSize > 2` → chờ (brief mục 6.1.4 khuyên nới lên 8) |
| Keyframe (chốt 2 s) | 8821 | `keyFrame` mỗi `fps × 2` khung |
| Đổi sang MP4 khi máy không nén được | 8674–8678 | `@ffmpeg/ffmpeg` + `@ffmpeg/util` từ **esm.sh**, core từ **unpkg** |
| Giọng đọc | 2326–2351 | `speechSynthesis` — chỉ nghe thử |
| Tiếng động | 1926, 6094, 9204 | `AudioContext` thời gian thật (chưa dùng `OfflineAudioContext`) |
| Nhánh ép quay thời gian thật | 6001 | render kỹ bị tắt khi có giọng đọc hoặc có tiếng động |
| Tra địa danh | 3717, 3730 | **gọi thẳng** `nominatim.openstreetmap.org` từ trình duyệt |
| Nạp trước theo lịch đường bay | 4543–4554 | `taiTheoLich(lapLichBay(...))` — **chỉ khi** `laDanDuong(kieuBay)` |
| Nạp trước theo hướng camera | 4781 `napTruocTheoHuong()` | dùng cho kiểu bay không theo tuyến |
| Thanh % tiến độ | 6561–6568 | có thật; cập nhật mỗi 45 khung |
| Preset camera | 287–412 | 6 kiểu dẫn đường + 20 kịch bản ôm cua |
| Timeline / keyframe camera | 1919 `camKeys` | chỉ keyframe **camera**, chưa có keyframe cho từng thuộc tính |
| Lưu trữ dự án | 1955–1961, 2242 | `localStorage` (Brand Kit, "Lưu mốc", nháp) + xuất/nhập file JSON |

---

## 2. Đối chiếu bảng mục 7 với code thật (yêu cầu 10.1 — ý 2)

| # | Hạng mục | Kết luận | Bằng chứng trong code |
|---|---|---|---|
| 1 | Chờ khung khi xuất | **KHÁC MÔ TẢ** | Đúng là pixel-diff, trần **3 s → +9 s** (×2 khi máy không card) = tối đa **12–24 s/khung** (`choKhungThatXong` 4022). NHƯNG vòng chờ dùng `MessageChannel` (`nhip0` 95–103), **không phải `rAF`** → khẳng định "treo vì rAF" cần đo lại (mục 3.1) |
| 2 | Prefetch camera | **CÓ MỘT PHẦN** | Có `taiTheoLich(lapLichBay(...))` (4552) nhưng **chỉ cho kiểu "Dẫn đường"**; kiểu toàn cảnh/flycam chỉ có `napTruocTheoHuong` (4781) chạy **trong lúc** bay. DEM có nạp trước dọc tuyến 16 mốc + chờ tối đa 30 s (4317–4323) |
| 3 | Tiến độ / huỷ / ETA | **CÓ MỘT PHẦN** | **Có %** (6561–6568) — brief ghi "không" là **sai**. **Không có nút Dừng lúc quay**: nút ⏹ chỉ hiện khi đang xem trước (6693); lúc đang quay chỉ có nhãn "ĐANG QUAY…" (6681). **Không có ETA**, không có "khung m/N" |
| 4 | Âm thanh offline | **CHƯA CÓ** | `speechSynthesis` chỉ nghe thử (2337); có giọng đọc hoặc tiếng động là **bỏ render kỹ** (6001). Không có `OfflineAudioContext` trong toàn file |
| 5 | Ranh giới VN mới + nhấp chọn | **CHƯA CÓ** | Nominatim `polygon_geojson=1` gọi từ trình duyệt (3730); không có GeoJSON ranh giới nội bộ |
| 6 | Geocode / routing proxy | **CÓ MỘT PHẦN — KHÁC MÔ TẢ** | **Routing đã qua backend**: `chiDuong.ts` gọi `/api/chi-duong` (brief ghi "engine chưa xác định" — nay xác định: qua máy chủ nhà). **Geocode thì chưa**: vẫn Nominatim client (3717) |
| 7 | Vector basemap + nhãn `name:vi` | **CHƯA CÓ** | 4 nguồn đều là **raster** (2852–2861); không có style vector nào |
| 8 | Đổi bản đồ giữa video | **CHƯA CÓ** | `base` là một giá trị cho cả video (`Settings.base`), không gắn theo keyframe |
| 9 | Chính sách 3D | **KHÁC MÔ TẢ** | Có 3 chế độ Tự động/2D/3D (`can3d` 4183) + ngưỡng zoom 11–15,3 (giữ tới 15,9) + nâng độ nổi dần từng bước. **Chưa có**: maxZoom riêng khi 3D, đổi sang nguồn ảnh nhẹ khi 3D, DEM `tileSize 512`/`maxzoom 12` (đang 256/13) |
| 10 | Kho hiệu ứng | **CÓ MỘT PHẦN** | Đúng như brief: 43 mẫu chữ · 27×24 ghim · 8 thẻ thương hiệu · 10 phương tiện · 7 tiếng động. Còn xa danh mục mapeffect (75 callout, ~800 SFX…) |
| 11 | Vẽ nâng cao | **CÓ MỘT PHẦN** | Lô đất 4 kiểu + 8 hiệu ứng viền; **chưa có** pen-tool điểm cong, dasharray chạy, neon 2 lớp GPU, bóng viewport-translate |
| 12 | Keyframe thuộc tính | **CHƯA CÓ** | Chỉ `camKeys` (1919) — keyframe camera |
| 13 | Dự án đám mây | **CHƯA CÓ** | `localStorage` + file JSON (1955–1961, 2242) |
| 14 | Phím tắt tuỳ chỉnh, tiếng Anh, editor điện thoại | **CÓ MỘT PHẦN** | Có phím tắt cố định (phím cách, Esc, Shift + mũi tên — 2398); **chưa có** tuỳ chỉnh, chưa có tiếng Anh |
| 15 | Gói cước / quota | **CÓ MỘT PHẦN** | Có gói `video` (`lib/packages.ts`, `users.video_expires_at`, `/payments/my` ở 8588); **chưa có** mua lẻ theo giây, hoàn tiền 72 h |
| 16 | Kịch bản đa cảnh + AI lời thoại + đa khổ ZIP + Brand Kit… | **ĐÃ CÓ — điểm mạnh riêng** | Xuất cả bộ (6214, 6245), đa khổ (6186), Brand Kit (1956), preset camera (287–412) |

**Tổng kết bảng mục 7:** ĐÃ CÓ **1** · CÓ MỘT PHẦN **7** · CHƯA CÓ **5** · KHÁC MÔ TẢ **3**.

---

## 3. Xác nhận các chẩn đoán mục 4.2 (yêu cầu 10.1 — ý 3)

### 3.1 Chẩn đoán 1 — render chậm, treo khi tab ẩn, không tiến độ/huỷ/ETA → **ĐÚNG MỘT PHẦN**

| Ý trong brief | Kết luận | Bằng chứng |
|---|---|---|
| Render rất chậm | **Chưa kiểm chứng lại** (xem 3.8) | — |
| Treo khi tab bị che, **do vòng chờ chạy bằng rAF** | **Nguyên nhân nêu SAI** | Vòng chờ khung dùng `MessageChannel` (`nhip0`, dòng 95–103) — Chrome **không** hạ nhịp cái này khi tab ẩn. Vòng render kỹ cũng gọi `step()` đệ quy, **không** qua `rAF` (5723, 4823). `rAF` chỉ dùng ở chế độ **không** render kỹ (5726) và ở xem trước |
| | **Nhưng vẫn có thể treo, vì lý do khác** | Tab ẩn thì WebGL của MapLibre gần như không vẽ lại → vân tay khung không đổi và `areTilesLoaded` chưa đủ → mỗi khung ăn trọn 12 s trần rồi mới qua. Với 240 khung là **48 phút**. Người dùng thấy y như "treo" |
| Không có % tiến độ | **SAI** | Có thanh % (6561–6568), nhưng chỉ cập nhật **mỗi 45 khung** — ở 30 hình/giây là 1,5 giây video/lần, trên máy chậm có thể **vài phút mới nhích một lần** → nhìn như đứng im |
| Không có nút huỷ | **ĐÚNG** | Nút ⏹ Dừng chỉ hiện khi đang xem trước (6693); khi đang quay không có nút nào (6681, 6694) |
| Không có ETA | **ĐÚNG** | Không có bất kỳ ước lượng thời gian còn lại nào trong file |

### 3.2 Chẩn đoán 2 — pixel-diff mỗi khung, trần dài, không prefetch → **ĐÚNG, TRỪ Ý CUỐI**

- **Đúng từng con số**: `vanTayKhung` thu nhỏ canvas xuống **48×27** rồi `getImageData` (64–75) — đây là
  **đọc ngược từ card đồ hoạ về CPU**, ép đồng bộ GPU, lặp **hàng chục lần mỗi khung**.
  Ngưỡng **0,0015** (đang dựng núi) / **0,004** (cảnh phẳng), cần **1–2 lượt đứng yên liên tiếp**;
  trần **3 s** (khung thường) / **8 s** (khung đầu), thất bại thử tiếp **9 s**, **nhân đôi** khi máy
  không có card (`choKhungThatXong` 4022–4034). `areTilesLoaded` chỉ là điều kiện phụ (3993).
- **Ý "không có prefetch dọc camera trước khi quay" là SAI**: có `taiTheoLich(lapLichBay(...))`
  (4552) — nhưng **chỉ chạy cho kiểu bay "Dẫn đường"**. Các kiểu toàn cảnh/flycam/keyframe **không**
  có bước nạp theo lịch, chỉ nạp **trong lúc** bay (`napTruocTheoHuong` 4781). DEM có nạp trước
  16 mốc dọc tuyến + chờ tối đa 30 s (4317–4323).
- **Kết luận thực dụng:** đúng như brief nhận định — đây là **chỗ nghẽn số một**, và cách chữa
  (đổi sang chờ bằng sự kiện, trần 0,9 s) là hợp lý.

### 3.3 Chẩn đoán 3 — giọng đọc/tiếng động ép quay thời gian thật → **ĐÚNG HOÀN TOÀN**

Ở dòng 6001, render kỹ chỉ bật khi **không có giọng đọc và không có tiếng động nào**. Chỉ cần **một**
tiếng động là cả video rơi về quay theo đồng hồ thật. `speechSynthesis` chỉ để nghe thử (2337).
Không có `OfflineAudioContext` ở bất kỳ đâu. Tiếng động do máy tự tạo bằng WebAudio (9204)
→ **hoàn toàn có thể** render offline, chỉ là chưa làm.

### 3.4 Chẩn đoán 4 — Nominatim gọi từ trình duyệt → **ĐÚNG (geocode), SAI (routing)**

- Geocode: gọi thẳng `nominatim.openstreetmap.org/search` ngay trong trình duyệt
  (3717 và 3730), không User-Agent riêng, không proxy → **đúng như brief**.
- Routing: **đã qua máy chủ nhà** — `chiDuong.ts` gọi `/api/chi-duong`. Brief ghi "engine chưa xác
  định trong bundle"; nay xác định rõ: **không** gọi thẳng dịch vụ ngoài từ trình duyệt.

### 3.5 Chẩn đoán 5 — chỉ raster Esri + EOX, không vector nhãn tiếng Việt → **ĐÚNG HOÀN TOÀN**

4 nguồn ở 2852–2861 đều là raster. Không có style vector, không có nhãn `name:vi`,
không đổi kiểu bản đồ giữa video.

### 3.6 Chẩn đoán 6 — phụ thuộc CDN lúc chạy → **ĐÚNG HOÀN TOÀN, và nhiều hơn brief liệt kê**

| Thư viện | Nguồn | Dòng | Mất CDN thì mất gì |
|---|---|---|---|
| `mp4-muxer@5.2.1` | esm.sh | 8782 | **Mất hẳn xuất MP4 chuẩn** |
| `@ffmpeg/ffmpeg`, `@ffmpeg/util` | esm.sh | 8674–8675 | Mất đường đổi WebM sang MP4 |
| `@ffmpeg/core@0.12.6` | **unpkg** | 8678 | như trên |
| `jszip@3.10.1` | esm.sh | 3677, 6214, 6245 | Mất "Xuất cả bộ" và xuất đa khổ |
| `qrcode@1.5.3` | esm.sh | 2220 | Mất QR liên hệ |

### 3.7 Chẩn đoán 7 — giới hạn 120 s, không dự án đám mây, không ổn định hoá khi tile lỗi → **ĐÚNG**

- Giới hạn 120 giây: thanh trượt `min={3} max={120}` (7943).
- Dự án: `localStorage` + file JSON (1955–1961, 2242) — không có đám mây.
- Tile lỗi: **không có** custom protocol, **không có** thử lại, **không có** Cache API.
  Có ghi log lỗi ảnh (3012) nhưng chỉ để báo, không thử lại → tile 5xx là khung thủng.

### 3.8 Phần "đo lại 8 s · 1080p30 · 2D và 3D" — **CHƯA ĐO ĐƯỢC**

**Lý do:** trang `/tao-video-ban-do` chặn ở lớp ngoài (`MapVideoPage` 8579–8598): phải **đăng nhập**
tài khoản admin hoặc có gói `video` còn hạn. Tôi không được phép nhập mật khẩu thay chủ tài khoản,
và phép đo còn cần thao tác tay (vẽ lô, chọn kịch bản, bấm Quay) — nên **không tự chạy được**.

**Cách đo (mất chừng 5 phút):**

1. Mở `http://localhost/tao-video-ban-do`, đăng nhập admin, vẽ một lô bất kỳ.
2. Đặt: thời lượng **8 giây** · **1080p** · **30 hình/giây** · **Render kỹ BẬT**.
3. Chạy **hai lượt**: lượt 1 chọn **2D**, lượt 2 chọn **3D**.
4. Mở `F12` → tab **Console**. Dán dòng này **trước** khi bấm Quay:

   ```js
   window.__t0 = performance.now();
   ```

   Quay xong thì dán tiếp:

   ```js
   console.log('Tổng:', ((performance.now() - window.__t0) / 1000).toFixed(1), 'giây');
   ```

5. Chụp thêm dòng bắt đầu bằng `[chất lượng]` (in ra ở 6097) — dòng đó cho biết tổng số khung,
   bao nhiêu khung phải chờ lâu, bao nhiêu khung chưa kịp hoàn hảo.

**Bảng số liệu (để trống chờ đo):**

| Phép đo | 2D | 3D |
|---|---|---|
| Tổng thời gian dựng 8 s · 1080p30 | ⬜ | ⬜ |
| Số giây thực cho 1 khung (240 khung) | ⬜ | ⬜ |
| Khung phải chờ lâu (`choLau`) | ⬜ | ⬜ |
| Khung chưa kịp hoàn hảo (`chuaXong`) | ⬜ | ⬜ |

---

## 4. Kế hoạch WP-1 chi tiết (yêu cầu 10.1 — ý 4)

Theo mục 6 của brief, chia đúng 3 PR như mục 10.2. **Ước lượng công tính theo giờ làm việc thật.**

### PR1 — "settle + warm + protocol" (chỗ nghẽn số một)

| Việc | File | Thêm/Sửa | Công |
|---|---|---|---|
| Chờ khung bằng **sự kiện** thay pixel-diff (Phụ lục B.1) | `lib/video/settle.ts` | **thêm mới** (~90 dòng) | 3 h |
| Nạp ảnh trước dọc đường camera cho **mọi kiểu bay** (B.2) | `lib/video/warm.ts` | **thêm mới** (~120 dòng) | 4 h |
| Protocol tile có **thử lại + Cache API** (B.3) | `lib/video/tileProtocol.ts` | **thêm mới** (~110 dòng) | 4 h |
| Thay lời gọi trong 2 vòng render; giữ pixel-diff sau cờ `debugStability` | `page.tsx` 4022, 4811, 5711 | sửa ~40 dòng | 3 h |
| Đăng ký protocol + nâng `maxTileCacheSize` khi xuất | `page.tsx` 2837–2913 | sửa ~10 dòng | 1 h |
| Đo trước/sau cùng một job 8 s·1080p30·3D, ghi số vào PR | — | — | 2 h |
| **Cộng PR1** | | | **~17 h (2–2,5 ngày)** |

**Rủi ro cần lường trước:** `areTilesLoaded()` của MapLibre 4.7 **chỉ duyệt `style.sourceCaches`**
(đã kiểm chứng trực tiếp trong `maplibre-gl.js` của container) — phải xác minh nguồn `dem` có nằm
trong đó không khi terrain bật; nếu không thì hàm chờ mới phải kiểm tra thêm `map.terrain`.
**Giữ pixel-diff sau cờ debug** đúng như brief yêu cầu, để còn đối chứng khi nghi ngờ.

### PR2 — "muxer đĩa + tiến độ + huỷ + tab ẩn"

| Việc | File | Thêm/Sửa | Công |
|---|---|---|---|
| `FileSystemWritableFileStreamTarget` + `fastStart` biết trước số khung (B.6) | `page.tsx` 8782–8790 | sửa ~50 dòng | 3 h |
| Fallback `StreamTarget` gom 4 MB cho máy không có `showSaveFilePicker` | `page.tsx` | thêm ~60 dòng | 3 h |
| Bảng tiến độ: **khung m/N · giây/khung · còn ~mm:ss** + nút **Dừng** | `page.tsx` 6561–6568 | sửa ~80 dòng | 4 h |
| Nghe `visibilitychange` → cảnh báo + tạm dừng an toàn | `page.tsx` | thêm ~40 dòng | 2 h |
| Bắt `webglcontextlost` → tạm dừng, khôi phục, hoặc kết file sạch (B.7) | `page.tsx` | thêm ~50 dòng | 3 h |
| **Bỏ esm.sh/unpkg**, cài npm: `mp4-muxer`, `jszip`, `qrcode`, `@ffmpeg/*` | `package.json` + 5 chỗ import | sửa ~20 dòng | 3 h |
| Nới backpressure từ `> 2` lên `> 8` | `page.tsx` 8856 | sửa 1 dòng | 0,5 h |
| **Cộng PR2** | | | **~18,5 h (2,5 ngày)** |

### PR3 — "âm thanh offline"

| Việc | File | Thêm/Sửa | Công |
|---|---|---|---|
| Trộn nhạc + giọng + tiếng động bằng `OfflineAudioContext` 48 kHz | `lib/video/audioMix.ts` | **thêm mới** (~150 dòng) | 5 h |
| Dùng lại đúng code tạo tiếng động, chỉ đổi context | `page.tsx` 9204+ | sửa ~30 dòng | 2 h |
| `AudioEncoder` AAC (lui về Opus nếu máy không có AAC) + mux chung | `page.tsx` 8681+ | thêm ~80 dòng | 4 h |
| **Xoá nhánh** "có giọng đọc thì quay thời gian thật" | `page.tsx` 6001 | sửa ~15 dòng | 2 h |
| Giữ thu mic (file thu xong đi đường offline) | `page.tsx` 5769+ | sửa ~20 dòng | 2 h |
| **Cộng PR3** | | | **~15 h (2 ngày)** |

> **Tổng WP-1: khoảng 50 giờ ≈ 7 ngày làm việc.**
> PR3 phụ thuộc **WP-6** (máy chủ đọc giọng trả file) nếu muốn bỏ hẳn `speechSynthesis`;
> chưa có WP-6 thì PR3 vẫn làm được cho **nhạc + tiếng động + file giọng tự thu**.

### Thứ tự đề nghị

1. **PR1 trước** — đây là chỗ ăn thời gian nhất, và cũng là thứ chủ dự án cảm nhận rõ nhất.
2. **PR2** — sau PR1 thì render đã nhanh, lúc đó tiến độ/ETA mới có ý nghĩa; đồng thời gỡ được
   rủi ro CDN (esm.sh hỏng là mất tính năng xuất).
3. **PR3** — làm cuối, vì phải bỏ nhánh quay thời gian thật, mà nhánh đó đang là đường lui an toàn.

---

## 5. Ba việc "nhặt được ngay" (ngoài WP-1, mỗi việc dưới 1 giờ)

1. **Thanh % nhích quá thưa** — cập nhật mỗi 45 khung (5721); trên máy chậm là vài phút mới đổi số
   một lần. Đổi sang mỗi khung (hoặc mỗi 5 khung) là hết cảm giác "đứng im".
2. **Chưa có nút Dừng lúc quay** — đã có sẵn cơ chế `stopRef` dùng cho xem trước; chỉ cần cho nút
   ⏹ hiện cả khi đang quay.
3. **Backpressure `> 2`** quá chặt (8856), brief khuyên `> 8` — sửa một con số.

---

## 6. Điều cần nói rõ với chủ dự án

- Báo cáo này **chỉ đọc code**, **không sửa một dòng nào** — đúng như yêu cầu ở mục 10.1.
- Ba chỗ brief nói "thiếu" mà thực tế **đã có** (thanh %, nạp ảnh trước, không dùng rAF) không làm
  brief mất giá trị: **hướng chữa của brief vẫn đúng**, chỉ là điểm xuất phát khá hơn một chút.
- Phần **đo thời gian render** còn để trống vì cần đăng nhập và thao tác tay. Cách đo đã ghi ở
  **mục 3.8**, làm mất chừng 5 phút; có số rồi mới chốt được PR1 giúp nhanh lên bao nhiêu lần.

---

## 7. Nhật ký thi công (cập nhật sau khi báo cáo)

### PR1 — "settle + warm + protocol" · **ĐÃ LÀM** (23/08/2026)

| Việc | Kết quả |
|---|---|
| `lib/video/settle.ts` | **mới** — `choBanDoYen()` chờ bằng sự kiện `render`/`idle` + `areTilesLoaded()`, trần **0,9 s**; `choMotKhung()` thử lại 1 lần 2,5 s rồi ghi sổ |
| `lib/video/warm.ts` | **mới** — `nayAnhDocDuongBay()` ghé camera qua tối đa 60 mốc dọc đường bay, nghe được nút Dừng |
| `lib/video/tileProtocol.ts` | **mới** — đường tải `cached://` thử lại 4 lần (0,25→2 s) + kho riêng qua Cache API; `taiVaoKho()` để bộ nạp trước dùng chung kho |
| `page.tsx` — chờ khung | `choKhungThatXong` nay gọi `choMotKhung`; **giữ pixel-diff** sau cờ `?debugStability=1` |
| `page.tsx` — nạp trước | `animateCamera` và `animateDirections` đều nạp sẵn cả đường bay trước khi quay (log `[nạp trước đường bay] N%`) |
| `page.tsx` — nguồn ảnh | Esri + EOX bọc qua `cached://` (DEM giữ nguyên để giảm rủi ro) |
| `tilePrefetch.ts` | hiểu địa chỉ `cached://` → tải bằng `fetch` và cất đúng kho |

**Đã kiểm chứng:** dựng một trang thử riêng chạy MapLibre 4.7.1 với đúng đường tải `cached://` trong
Chrome — kết quả: đăng ký thành công, **15/15 tấm ảnh về, 0 lỗi**, `areTilesLoaded()` = true, ảnh vệ
tinh Cam Lâm hiện đầy đủ. Ba nguồn ảnh đều cho phép tải chéo miền (đã kiểm bằng `curl`:
Esri `*`, EOX `http://localhost`, máy chủ nhà `*`).

**Trần chờ mỗi khung: 3 s → 0,9 s** (máy không card: 6 s → 1,8 s). Đây là chỗ dự kiến rút ngắn
thời gian dựng nhiều nhất.

### PR2 — "muxer + tiến độ + huỷ + tab ẩn" · **ĐÃ LÀM PHẦN LỚN** (23/08/2026)

| Việc | Kết quả |
|---|---|
| Tiến độ chi tiết | **khung m/N · giây/khung · còn ~mm:ss**, cập nhật mỗi 5 khung (trước: mỗi 45 khung, chỉ có %) |
| Nút Dừng khi đang quay | **có** — bấm là dừng, phần đã dựng vẫn xuất thành video |
| Tab ẩn | nghe `visibilitychange` → nhắc để trang hiện trên màn hình |
| Card đồ hoạ rớt | bắt `webglcontextlost` → dừng gọn + nói rõ nên hạ 720p hoặc để 2D; `webglcontextrestored` báo lại |
| Backpressure | `encodeQueueSize > 2` → **`> 8`** |
| Kho ảnh | `maxTileCacheSize` tối thiểu **512** |
| Bỏ CDN | `mp4-muxer`, `jszip`, `qrcode` **cài npm** (5 chỗ import) |
| **Còn nợ** | `FileSystemWritableFileStreamTarget` + `fastStart` (mới dùng target sẵn có), `StreamTarget` gom 4 MB, và `@ffmpeg/*` vẫn nạp từ esm.sh/unpkg (bản wasm ~25 MB — cần cân nhắc riêng vì đóng vào ảnh Docker sẽ nặng) |

### PR3 — "âm thanh offline" · **CHƯA LÀM**

Chưa động tới. Đây là phần rủi ro nhất vì phải bỏ nhánh "có giọng đọc thì quay thời gian thật" —
nhánh đang là đường lui an toàn. Nên chỉ làm sau khi PR1/PR2 được chạy thử thật.

### Việc cần chủ dự án làm

Dựng thử một video **8 giây · 1080p · 30 hình/giây · Render kỹ BẬT**, một lượt **2D** một lượt **3D**,
rồi điền vào bảng ở **mục 3.8**. Có số trước/sau mới biết PR1 rút ngắn được bao nhiêu.

### Nhóm A — chép công thức vẽ của mapeffect · **ĐỢT 1 ĐÃ LÀM** (23/08/2026)

Phát hiện quan trọng khi đọc code: **ta đã dùng đúng kiến trúc vẽ của họ** — mọi thứ "dính vào đất"
đều là lớp bản đồ thật chồng nhau (`parcel-glow2`/`parcel-glow`/`parcel-line`/`parcel-fill`,
`route-glow2`/`route-glow`/`route-line`, `arrow-glow`/`arrow-line`/`arrow-dash`/`arrow-head`),
KHÔNG phải vẽ đè lên màn hình. Nên phần lớn việc còn lại chỉ là **nạp đúng bộ số**, không phải xây lại.

| Hạng mục | Công thức của họ (mục 2.3 / 2.5) | Đã áp vào |
|---|---|---|
| Viền neon 2 lớp | ngoài `nét×(5+5k)`, mờ `0,3k`, nhoè `8+10k` · trong `nét×(2,2+1,6k)`, mờ `0,7k`, nhoè `2,5+2k` · nét chính đè trên · nhân theo tỉ lệ khung xuất | `neonHaiLop()` + kiểu **"Neon 2 lớp"** trong bảng hiệu ứng lô (8 kiểu cũ giữ nguyên) |
| Dựng núi thì dùng ảnh nhẹ | khi 3D chỉ một nguồn ảnh nhẹ, **tắt hẳn ảnh HD** | tự chuyển `sat` (Esri) → `sat2` (Sentinel) khi chế độ 3D; nút **"3D nét (chậm)"** để giữ ảnh nét |
| maxZoom riêng khi 3D | giới hạn + toast lùi ra | chặn mức **16** + lời nhắc; trả lại 18 khi về 2D |
| Bóng đổ mũi tên | `line-translate [16,22]`, `anchor: viewport`, nhoè | lớp mới `arrow-shadow` đặt dưới `arrow-glow` |

**Chưa làm trong nhóm A:** vạch chạy trên tuyến (bảng pha `[0,4,3] → [.5,4,2.5] → [1,4,2]`),
hiệu ứng vẽ dần + kiểu kết thúc (fade/xoá ngược/co lại/loé + `easeOutBack`), nội suy camera kiểu
điện ảnh (tâm trượt trong Mercator theo tiến độ zoom).

**Không làm — có lý do:** ~800 tiếng động, ~85 vật thể, model 3D của mapeffect là **tài sản có bản
quyền**; không sao chép. Hướng thay thế: mở cho người dùng thả file âm thanh/model của mình vào.

### 24/08 — Tự vẽ 7 phương tiện thay cho emoji

Trước đó mấy món Kenney không có (xe máy, xe đạp, người, máy bay, trực thăng, thuyền buồm) tôi lấy tạm
emoji 3D. Sai: emoji vẽ **nhìn ngang và phẳng**, đặt cạnh xe Kenney nhìn chéo từ trên xuống thì lạc hẳn,
như hai bộ đồ hoạ khác nhau ghép vào.

Đã tự dựng 7 món bằng khối hình (three.js), render bằng **đúng ánh sáng, đúng góc máy, đúng bóng đổ**
như bộ xe Kenney — nên đặt cạnh nhau nhìn cùng một nhà:

| Món | Chỗ đáng nói |
|---|---|
| Xe máy giao hàng | Thùng hàng vàng sau yên — đúng cảnh shipper mà app tham chiếu có |
| Xe máy · Người đi bộ | Người ngồi/đứng có mũ, tay, chân bước |
| Xe đạp | Khung xe dựng bằng ống nối hai điểm (hai tam giác thật), người ngồi đúng trên yên |
| Máy bay | Thân viên nang + hai cánh + đuôi đứng |
| Trực thăng | Hai lá cánh quạt bắt chéo, cánh quạt đuôi, càng đáp, kính buồng lái |
| Thuyền buồm | Buồm là **tam giác** căng theo cột (bản chữ nhật đầu tiên chắn ngang, che kín thuyền) |

Ảnh xuất 512px, cả 7 món nặng ~370KB. `napTruocAnhXe()` nay nạp sẵn cả bộ nhìn chéo 3/4 chứ không chỉ
bộ nhìn từ trên, nên kéo xe ra bản đồ là có hình ngay. Đã kiểm trên trang thật: 21/21 ảnh nạp đủ.

Emoji 3D **vẫn giữ** cho thư viện vật thể (`/vat3d/`) — chỗ đó app tham chiếu cũng dùng đúng bộ này.

### 24/08 — PR3: dựng tiếng offline, bỏ hẳn kiểu quay theo đồng hồ thật

**Bệnh cũ:** hễ kịch bản có giọng đọc hoặc tiếng động là `kyLuong` bị tắt
(`renderKyRef.current && !voice && !sfx.length`), máy phải quay theo đồng hồ thật vì hai thứ đó được
thu bằng cách cho loa phát rồi hứng lại. Máy yếu vẽ không kịp → **đứng hình vài nhịp rồi nhảy vọt**.
Đúng triệu chứng chủ dự án báo.

**Đã chữa tận gốc.** Nay `kyLuong = renderKyRef.current` — không kiêng gì nữa.

1. `dungTiengOffline()` trộn nhạc + giọng đọc + tiếng động bằng `OfflineAudioContext` — tính toàn bộ
   bản tiếng trong chớp mắt, không phát ra loa giây nào. Nhạc có vào êm/ra êm 0,4 giây; có giọng đọc
   thì nhạc tự hạ xuống 0.32. Tiếng động dùng lại `playSfx()` cũ (nó chỉ gọi mấy hàm mà bộ trộn ngầm
   cũng có), nên rơi **đúng giây đã đặt** thay vì lệch theo tốc độ máy như trước.
2. `nenTiengVaoMuxer()` nén bản tiếng thành AAC bằng `AudioEncoder` rồi nhét **thẳng vào cùng file**
   với hình qua `muxer.addAudioChunk`. Ra một MP4 hoàn chỉnh, **không nén lại lần hai, không cần tới
   ffmpeg**. Rãnh tiếng phải khai lúc tạo muxer nên bản tiếng được dựng **trước** khi quay.
3. Máy nào không nén được tiếng kiểu đó → đóng bản tiếng thành WAV rồi ghép bằng `ghepTiengVaoMp4()`
   (`-c:v copy`, hình giữ nguyên nên rất nhanh). Đường lui, không phải đường chính.

**Đã chạy thử thật trong trình duyệt** (không phải đọc code): trộn ngầm 2 giây → 96 000 mẫu 2 kênh →
nén AAC 94 miếng, không lỗi. Dựng trọn một MP4 320×240 1 giây có cả hình lẫn tiếng: file 27 450 byte,
trong đó có hộp `avc1` (hình), hộp `mp4a` (tiếng) và `moov` nằm ở đầu file.

Kèm theo:
- Xin chỗ lưu (ghi thẳng ra đĩa) nay chỉ hỏi khi video **không có tiếng nào** — có tiếng thì còn bước
  ghép, phải giữ bản hình trong bộ nhớ. Trong `taoMayGhiChuan` chốt thêm `!raDia`.
- Bộ chuyển đổi ffmpeg trước chỉ tải từ **một** kho; kho chậm hoặc bị chặn là hỏng cả bước xuất, mà
  lỗi báo ra khó hiểu. Nay thử lần lượt **ba kho** (esm.sh → jsDelivr → unpkg), hỏng hết mới báo, và
  báo bằng lời dễ hiểu.
- Chữ giải thích nút "Render kỹ" đã sửa lại cho khớp (trước ghi "có giọng đọc thì máy tự quay kiểu thường").

**Cố ý KHÔNG làm:** đặt mục lục ở đầu file khi ghi thẳng ra đĩa (`fastStart: {expectedVideoChunks}`).
Cách đó bắt phải khai trước **đúng** số khung; lệch là hỏng cả bản render dài cả tiếng đồng hồ. Đổi
lại chỉ được cái phát trực tuyến ngay — mà file lưu trên máy rồi tải lên mạng xã hội thì không cần.
Không đáng đánh đổi.

### 25/08 — Giật ở cảnh núi: tìm ra ba nguyên nhân, sửa cả ba

Chủ dự án báo: video xuất ra **giật một khung, hình nhảy qua nhảy lại**, nặng nhất ở **chỗ đồi núi**.

**Vì sao.** Bản đồ dựng núi bằng "ảnh độ cao" tải riêng, về chậm hơn ảnh vệ tinh. Chưa có nó thì mặt
đất coi như phẳng — camera đứng ở cao độ 0. Ảnh về, mặt đất nhô lên, camera bị đẩy theo → khung sau
lệch hẳn khung trước. Bay sang vùng chưa có ảnh thì lại tụt xuống. Đúng kiểu "nhảy qua nhảy lại".

Đo thật trên bản đồ (nhảy tới vùng núi rồi đọc cao độ mỗi 0,1 giây):

```
ms    0 · ảnh đủ: true  · cao độ 1525.6 m   ← số cũ còn sót
ms  100 · ảnh đủ: false · cao độ     0 m    ← mặt đất tụt về phẳng
ms 1600 · ảnh đủ: true  · cao độ     0 m    ← 1,6 giây sau mới yên
```

**Ba chỗ hở, sửa cả ba:**

1. **Cách chờ khung không hỏi gì về địa hình.** Hai câu hỏi cũ ("ảnh tải đủ chưa", "kiểu vẽ xong chưa")
   chỉ tính ảnh vệ tinh. Thêm `choNuiXong()` hỏi thêm: cao độ mặt đất ngay dưới camera còn nhảy không.
   Gọi ở **cả hai** đường chờ (đường nhanh và đường soi điểm ảnh).

2. **Câu "kho ảnh độ cao tải xong chưa" NHẤP NHÁY liên tục** true/false — đo được 53 lần đổi trong 10
   giây, vì bản đồ vừa vẽ vừa xin thêm ảnh. Tin mình nó thì lúc chờ hụt lúc chờ thừa. Nên lấy **cao độ
   đứng yên ba lượt liền** làm điều kiện chính, câu hỏi kia chỉ xác nhận thêm; đứng yên tám lượt thì
   chấp nhận luôn dù câu kia còn nhấp nháy. Cũng giục vẽ thưa lại (3 vòng một lần) — giục mỗi vòng
   chính là thứ làm nó nhấp nháy.

3. **Kho ảnh độ cao ở máy chủ chỉ giữ 300 ô** — đây là chỗ nặng nhất và khó ngờ nhất.
   Trước lúc quay, máy nạp sẵn ảnh cho cả đường bay; video 60 giây ngốn bảy tám trăm ô. Nạp tới ô thứ
   301 là ô đầu bị đẩy ra. Lúc quay thật camera quay lại chỗ đó → phải xin lại từ kho bên Mỹ, **đo được
   1,02 giây/ô**, trong khi ô đã có sẵn chỉ mất **0,003 giây**. Một giây đó chính là lúc mặt đất tụt về
   phẳng. Nâng lên **3000 ô (~90 MB)**, thêm chốt theo dung lượng. Đã thử: nạp 40 ô rồi lấy lại ô đầu
   tiên — 0,002 giây, không bị đẩy ra nữa. Đổi được qua `DEM_CACHE_TILES` / `DEM_CACHE_MB`.

Thêm sổ ghi `nuiTre` vào dòng `[chất lượng]` cuối mỗi lần render, và báo cho người dùng khi quá 2% số
khung — để lần sau chẩn đoán được ngay thay vì phải đoán.
