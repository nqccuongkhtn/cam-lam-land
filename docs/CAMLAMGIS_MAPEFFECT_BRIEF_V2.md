# BRIEF V2 CHO CLAUDE CODE — Mổ xẻ toàn diện mapeffect.app (đã đăng nhập + xuất thử thật) và đối chiếu công cụ "Tạo video bản đồ" của Cam Lâm Land

> **Cách dùng:** lưu file này vào repo camlamgis tại `docs/mapeffect-brief-v2.md` (thay cho bản v1 nếu đã có). Mở Claude Code trong thư mục dự án và chạy prompt ở **mục 10.1** trước, rồi làm từng Work Package.
> **Nguồn dữ kiện:** khảo sát trực tiếp ngày 23/08/2026 trên tài khoản đã đăng nhập của cả hai bên; đã **xuất thử 1 video thật trên mapeffect** (dùng 1 lượt miễn phí, có phân tích file MP4 đầu ra) và **chạy thử "Quay & xuất MP4" trên chính Cam Lâm Land** để đo tốc độ; đã đọc bundle JS của cả hai (số liệu, công thức, tên hàm bên dưới lấy nguyên văn từ code đã minify). Những chỗ suy đoán đều ghi rõ "(suy đoán)".
> Quy tắc cho Claude Code: đọc code hiện có trước khi sửa; **không viết lại những phần đang là thế mạnh** (kịch bản, AI viết lời, preset camera, ghim 27×24, Brand Kit, xuất đa khổ ZIP); mỗi WP một branch, build + lint + tự test theo tiêu chí nghiệm thu.

---

## 1. Tóm tắt điều hành

1. Hai sản phẩm **cùng lõi công nghệ** (MapLibre GL + WebCodecs + mp4-muxer, render từng khung). Cam Lâm Land **không thua về ý tưởng tính năng** — thậm chí hơn ở: bộ kịch bản nhiều cảnh + AI viết lời, preset camera dẫn đường/flycam rất phong phú, 27 kiểu ghim × 24 tiện ích, cắm ghim hàng loạt từ Excel/CSV, thẻ chú thích tự ghi khoảng cách, chỉnh màu điện ảnh + khung an toàn TikTok, Brand Kit, xuất một lần ra nhiều khổ (ZIP), phụ đề SRT, lưu mốc phiên bản.
2. Khoảng cách thật nằm ở **chất lượng nền tảng**: (a) **pipeline render chậm và không có tiến độ** — đo thực tế 8 s/1080p30 mất **>3,5 phút** trên máy có GPU, do cơ chế chờ từng khung bằng **so sánh điểm ảnh** với timeout 3–12 s/khung (hàm `ch`/`cu` trong bundle), trong khi mapeffect chờ bằng **sự kiện tile** (`areTilesLoaded` + `idle`, trần 0,9 s) nên 5 s/720p24 chỉ mất ~15 s; (b) **TTS bằng `speechSynthesis` không ghi được vào file** nên hễ có giọng đọc/tiếng động là rơi về quay thời gian thật; (c) **địa danh dựa Nominatim** — gõ "Cam Lâm" báo *"Không tìm thấy ranh giới"* ngay trên sân nhà, trong khi mapeffect trả "Xã Cam Lâm — Khánh Hòa" tức thì từ GeoJSON nội bộ; (d) chưa có **bản đồ vector nhãn tiếng Việt** và chuyển bản đồ giữa video; (e) phụ thuộc **esm.sh/unpkg lúc runtime**.
3. mapeffect ăn tiền ở **độ chắc của lõi** + **kho hiệu ứng đồ sộ có preview động** (75 callout, 64 hiệu ứng chữ, 27 font, 9 kiểu tiện ích, ~85 vật thể + 195 cờ, ~800 SFX) + **đóng gói sản phẩm** (3 lượt free 720p có logo → PRO/PRO MAX/Nhóm, mua lẻ theo giây, VietQR SePay tự kích hoạt, hoàn tiền 72 h, authorize/commit hạn mức phía server).
4. Ưu tiên hành động: **WP-1 (viết lại lõi render — mục 6)** → WP-3 (geodata nội bộ) → WP-6 (TTS server, bỏ fallback thời gian thật) → WP-2 (basemap vector + crossfade) → WP-4/5 (mở rộng mẫu) → WP-7 (UX) → WP-8 (gói cước).

---

## 2. mapeffect.app — kiến trúc đã xác minh

### 2.1 Nền tảng
| Hạng mục | Chi tiết đã xác minh |
|---|---|
| Build | esbuild, hash 8 ký tự; chunk lazy: export (`c-TRAEDDWD`), 3D (`c-SPHAYVMT`+three.js `c-5MMQW34A`), TTS (`c-PXGYYBSD`); `mobile-*.js` riêng cho điện thoại. |
| Map init | MapLibre GL JS **4.7.1**: `{style, center, zoom, attributionControl:{compact:true}, preserveDrawingBuffer:true, fadeDuration:0, maxPitch:85, maxZoom, maxTileCacheSize:512}`; Shift+←→/↑↓ xoay-nghiêng, Shift+kéo chuột xoay tự do; `boxZoom` tắt. |
| State | Một store `project` (event-bus emit "time/duration/aspect/camera/change"), `snapshot()` cho undo/redo, autosave hiển thị "✓ Đã lưu HH:MM", thời gian nhớ riêng từng scene (map / media). |
| File dự án | `.mapeffect` = **ZIP chứa `project.json`** (store method 0). Cấu trúc mục 2.6. |
| Đăng nhập | Google Identity Services + email/mật khẩu. Quota: `GET /api/me`; xuất video: `POST /api/export/authorize` **trước render** và `POST /api/export/commit` sau khi xong (chống lách hạn mức). Dự án đám mây `GET/POST /api/projects` — free: **2 dự án, tổng 60 MB, mỗi dự án ≤30 MB**. |

### 2.2 Nguồn bản đồ & xử lý nhãn
- Vệ tinh 2 tầng: `satfar` = VersaTiles Sentinel-2 (`tileSize:256, maxzoom:12`, paint `raster-saturation:.2, raster-contrast:.34, raster-brightness-max:.86, raster-resampling:"nearest"`), `sat` = Esri World_Imagery (12→19, `raster-saturation:.38, raster-contrast:.16`); cấu hình còn dự phòng Mapbox raster nếu có key và Esri World_Street_Map cho chế độ đường.
- Vector: OpenFreeMap styles `liberty|bright|positron|dark|fiord` fetch từ `tiles.openfreemap.org/styles/<id>` (cache Map), "Bản đồ cổ" = liberty + hàm "nhuộm" đổi màu paint; glyph Noto Sans của OpenFreeMap.
- **Nhãn**: mọi layer symbol bị ghi đè `text-field` bằng expression: `["let","n",["coalesce",["get","name:vi"],["get","name:latin"],["get","name"],""], …]` rồi **cắt tiền tố** "Thị trấn ", "Thị xã ", "Xã "… (bằng `index-of`+`slice`) và cắt hậu tố " Ward"/" Commune"/" Township" → nhãn gọn ("Cam Đức" thay vì "Thị trấn Cam Đức"). Nguồn nhãn tỉnh riêng `vnlbl` từ `vn-province-labels.geojson`. Nút "Tên địa danh: Hiện/Ẩn" theo **từng keyframe camera**.
- Địa hình: source `dem3d` `{type:'raster-dem', tiles:[VersaTiles elevation], encoding:'terrarium', tileSize:512, maxzoom:12}`, `setTerrain({exaggeration:1.4})` (hằng `Hd=1.4`).
- Ranh giới hành chính: file tĩnh `/assets/world-countries.geojson`, `vn-provinces.geojson`, `vn-province-labels.geojson`, chỉ mục `vn-diadanh-index.json`, và **từng tỉnh** `vn-xa-<slug>.geojson` (đã theo đơn vị sau sáp nhập — "Xã Cam Lâm" có ngay, polygon MultiPolygon ~6,6 KB đã simplify). Chọn bằng gõ tên (không dấu) **hoặc nhấp thẳng lên bản đồ** (zoom thấp = tỉnh, cao = xã).
- Geocode `/api/geocode?q&lat&lon` (bias theo tâm màn hình, kết quả dạng Photon); routing `/api/route` → Valhalla công cộng (`valhalla1.openstreetmap.de`, `routing.openstreetmap.de`), 3 chế độ ô tô/xe máy/đi bộ; kết quả thành layer Tuyến đường bình thường, tên tự đặt "Đường đi (Ô tô) 360.3km", toast "~437 phút ô tô".

### 2.3 Kiến trúc vẽ 2 tầng (điểm mấu chốt)
**Tầng MapLibre** — mọi thứ "dính vào đất" là GeoJSON source + layer thật, cập nhật mỗi khung (chỉ `setData` khi chữ ký dữ liệu đổi):
```text
sources: plots, plots3d, plotlines, roads, roadglow, arrows, arrowglow, arrowshadow, arrowheads, elements, objects, draft
layers:  mapdim (background đen opacity 0→x để "Làm tối bản đồ" theo keyframe)
         plots(-fill), plots3d / plots3d-duc (fill-extrusion: color/height theo property, opacity .85/1, vertical-gradient)
         plotlines-glow (line: width=glowWidth, opacity=glowOpacity, blur=blur — data-driven)
         plotlines / plotlines-dash (line-dasharray động)
         roads / roads-dash (dasharray [0,4,3] + bảng pha [[0,4,3],[.5,4,2.5],[1,4,2]…] đổi mỗi khung → vạch "chạy")
         arrowshadow (line-translate [16,22] anchor viewport + blur → bóng "bay trên bản đồ")
         arrowglow, arrows, arrowheads (fill tam giác đầu mũi)
         elements/objects (symbol: icon-image/icon-size/icon-rotate data-driven, rotation-alignment:'map', allow-overlap + ignore-placement → không bao giờ bị ẩn do va chạm nhãn)
```
Công thức **viền neon 2 lớp** (đúng số trong code, k = neonStrength mặc định 1, scale = tỉ lệ xuất/preview):
`glow ngoài: width = stroke×scale×(5+5k), opacity = min(1,.3k)×tiếnĐộ, blur = (8+10k)×scale` · `glow trong: width = stroke×scale×(2.2+1.6k), opacity = min(1,.7k)×tiếnĐộ, blur = (2.5+2k)×scale` · nét chính vẽ đè lên trên. Hiệu ứng "vẽ dần" = cắt LineString theo tổng độ dài (đo mét bbox `_c()`), hiệu ứng ra `Hr()`: none/fade/erase (rút ngược, ngưỡng (i−.5)/.5)/shrink/flash (loé `sin(π(1−a))`); easeOutBack `1+2.70158(t−1)³+1.70158(t−1)²` cho pop.
**Tầng Canvas 2D overlay** (`#overlay`, `#textLayerHost`) — callout/chữ/hiệu ứng chữ/icon động vẽ bằng ctx 2D (gradient, shadowBlur, composite 'lighter'), toạ độ `map.project()`; khi export vẽ **thẳng lên canvas xuất** (không copy màn hình).
**Media ghim vào bản đồ** — ảnh/video đổ vào vùng dùng **canvas source của MapLibre** (`type:'canvas', coordinates 4 góc, animate:false`) + layer raster `raster-fade-duration:0`, canvas đó được vẽ lại theo thời gian video.
**3D model** — three.js qua custom layer `renderingMode:'3d'`, dùng chung GL context (`WebGLRenderer({canvas: map.getCanvas(), context})`, `autoClear=false`, PMREM env, chờ `cho3DSanSang()` trước khi render/export.

### 2.4 Camera & keyframe
- Keyframe: `{t, center, zoom, bearing, pitch, hold?, transDur?, ease?, dim?(làm tối 0..1), mapBase?, vectorTheme?, labels?, transition?('fade'|'ink'), zoomDelay?("Bắt đầu zoom sau"), zoomDur?("Thời gian zoom")}` — panel hiện: Thời điểm, Zoom hiện tại, Kiểu chuyển (Đều/Mượt 2 đầu/Chậm cuối/Điện ảnh), Bản đồ theo keyframe (giữ tới khi đổi; 2 keyframe khác loại thì chuyển mượt lúc bay qua), Tên địa danh Hiện/Ẩn, Kiểu chuyển map (Hoà tan/Loang mực — mặt trận mực đen loang bằng noise có seed + destination-out), Làm tối bản đồ.
- Nội suy (đã kiểm chứng bằng Node): trong đoạn k0→k1: giữ `hold` giây → transition `transDur` (mặc định phần còn lại) với easing; zoom lerp; **tâm lerp trong Mercator với tham số `s=(2^(z0−z)−1)/(2^(z0−z1)−1)`** (tốc độ trượt màn hình đều — cùng ý flyTo nhưng deterministic); bearing cung ngắn; pitch lerp; **mỗi khung `map.jumpTo(...)` rồi `xr()`** (cập nhật 3D). Không bao giờ dùng easeTo/flyTo trong render.
- Nút "Đưa camera tới" ở mọi layer; "Chụp keyframe (K)"; kéo thả keyframe trên track Camera; camera-shake API có sẵn (translate + scale 1.06 toàn khung) nhưng đang tắt.

### 2.5 Chính sách 3D (rất đáng học)
- Bật 3D (`By`): pitch 55° cho mọi keyframe (hoặc easeTo 450 ms nếu chưa có keyframe), `dia3D=true`.
- `xr()` chạy **sau mỗi jumpTo**: `t = dia3D && zoom < 13.5` → `bh(t)`: add/remove terrain; `mh(t)`: khi 3D bật, lớp Sentinel phủ 0–24 (`resampling:'linear'`), lớp Esri đẩy ra 23.9–24 (coi như tắt); khi 2D trả lại 0–12/12–24, 'nearest'. ⇒ **Trong 3D chỉ dùng ảnh nhẹ một nguồn, tắt hẳn ảnh HD** — đổi độ nét lấy tốc độ + ổn định.
- 3D giới hạn `maxZoom` riêng (hằng `ld` < `eh` của 2D) + cộng zoomOffset khi export; đang zoom sâu hơn thì lùi ra với toast "Chế độ 3D giới hạn zoom — đã lùi ra mức gần nhất còn dựng được địa hình".
- DEM terrarium 512 px maxzoom 12, exaggeration cố định 1.4; không sky layer.

### 2.6 File dự án `.mapeffect` (ZIP → `project.json`)
```jsonc
{ "name":"Dự án mới", "aspect":"16:9", "duration":5, "mode":"map",          // map | media
  "bgColor":"#000000", "bgAnim":null, "mapBase":"openfreemap",             // satellite | openfreemap …
  "vectorTheme":"dark", "dia3D":true,
  "camera":{ "keyframes":[ /* mục 2.4 */ ] },
  "layers":[
    {"id":"ly_x","name":"Khoanh vùng 1","visible":true,"start":0,"end":5,"scene":"map","track":0,
     "type":"plot","coords":[[lng,lat]…] /* hoặc "geometry": MultiPolygon (ranh xã) */,
     "color":"#f5b942","fillOpacity":.28,"strokeWidth":3,"neon":true,
     "anim":"draw","animDur":1.2,"animOut":"erase","animOutDur":0.8},
    {"type":"object","img":"mi:vi-tri","lng":…,"lat":…,"pin":true,"pinZoom":4.22,"size":1,"glow":1,"fxIn":"fade","fxOut":"fade"},
    {"type":"object","img":"scooter","coords":[[…],[…]],"speed":1,…}        // chạy theo tuyến
  ] }
```
Layer keyframe theo thuộc tính: mặc định `[w,pos,opacity,rotate]`; object `[pos,co,rotate,tien]`; model3d `[pos,co,rotate,caoM,caoTyLe,opacity]` — lưu `layer.keys[prop]=[{t,v}…]` (suy đoán tên trường).

### 2.7 Pipeline XUẤT VIDEO (đọc từ code + đo thật)
**Chuẩn bị:** tách `#map` sang container W×H thật (1280×720/1920×1080/2560×1440) → `map.resize()` → `zoomOffset=log2(W/previewW)` cộng vào camera, hệ số scale cho overlay → `cho3DSanSang()` → ngủ 1500 ms → preload font (`document.fonts.load` từng font của layer + Sora, Be Vietnam Pro) → nếu keyframe nào dùng vector thì preload style → **prefetch tile dọc camera**: n = clamp(duration×2, 4, 40) mốc, mỗi mốc đặt camera rồi chờ idle ≤600 ms ("Đang tải bản đồ… X%") → preload ảnh/media/objects theo cỡ xuất → canvas xuất 2D `{alpha:false}`.
**Mỗi khung `drawFrame(T)`:** seek project (camera jumpTo + `xr()` + cập nhật mọi source/overlay) → **`oo(900)`**: nghe `render` và resolve ngay khi `map.areTilesLoaded()`, kèm `once('idle')`, trần 900 ms, kích `triggerRepaint()` → chờ video-media seek đúng T → tô nền → (rung camera nếu có) → `drawImage(map.getCanvas())` → vẽ overlay trực tiếp → watermark.
**Mã hoá:** chọn codec bằng `isConfigSupported` theo thứ tự MP4 `avc1.640033→avc1.4d0032→avc1.42001f`, WebM `vp09.00.10.08→vp8`; `bitrate = W×H×fps×0.09 + 2e6`; muxer (mp4-muxer/webm-muxer) `ArrayBufferTarget` + `fastStart:'in-memory'`; encode với `keyFrame mỗi 2 s`, backpressure `encodeQueueSize>8 → ngủ 4 ms`; audio: OfflineAudioContext 48 kHz trộn layer audio + video-không-mute (gain=volume, trim, không fade/loop) → AudioEncoder AAC 128k (hoặc Opus) từng khối 4800 mẫu `f32-planar` → finalize.
**Fallback không WebCodecs:** MediaRecorder + `canvas.captureStream(fps)`, mimeType `video/mp4;codecs=avc1→video/mp4→video/webm;codecs=vp9→video/webm`, `videoBitsPerSecond = W×H×fps×0.12`, vòng drawFrame + sleep 1000/fps (thời gian thật).
**Lưu file:** đã chọn thư mục (File System Access, ghi `createWritable`) hoặc `<a download>`; tên `<slug>-<res>p.mp4` (slug bỏ ký tự cấm, tối đa 80). Huỷ giữa chừng: "Dừng xuất video? Phần đã kết xuất sẽ bị đổ đi…".
**Đo thật (máy user, Intel UHD 730):** 5 s · 720p · 24 fps · dự án 4 layer 2D → **~15 s render**. File: 852.600 B; `ftyp isom(avc1,mp41)` → `moov`(1166 B) → `mdat` ⇒ **moov trước mdat**; 1 track avc1 1280×720 **High@4.1**, 120 mẫu, 3 keyframe (0/48/96), **~1,36 Mbps** (encoder tự hạ dưới mục tiêu 4 Mbps vì cảnh tối); **không track audio khi không có lớp âm thanh**; watermark giữa khung (chữ "MapEffect.app / TẠO VIDEO BẢN ĐỒ THẬT DỄ", alpha .3, cỡ = round(H×0.042), bóng mờ) + logo nhỏ góc.

### 2.8 Sản phẩm & giá (đã thấy sau đăng nhập)
- Dialog Xuất = paywall + cấu hình: trạng thái "Dùng thử — còn 3/3 lượt xuất · HD 720p, có logo"; thẻ gói (tháng/năm, badge -50 %/-64 %/-21 %): PRO ~~299k~~ **149k** (30 video/tháng, 1080p, không logo); PRO MAX ~~699k~~ **249k** (60 video, 2K 1440p, Biểu đồ + Templates + Đọc chữ); NHÓM PRO MAX slider 2–10 người (5 người: ~~1.245k~~ **988k**/tháng, "300 video/tháng dùng chung", "197.600đ/người"); **mua lẻ**: "Video đang dựng dài 5s → 10.000đ" (tối thiểu 10k tới 10 s, +1k/giây; tính theo dự án hiện tại!).
- Thanh toán VietQR (SePay), tự kích hoạt, không tự gia hạn; hoàn tiền 100 % trong 72 h không cần lý do (vẫn dùng đủ tính năng trong lúc đó); trang /dieu-khoan /thanh-toan /hoan-tien; hoá đơn qua email.
- Cấu hình xuất: tên file; nơi lưu (chọn thư mục / Tải xuống); độ phân giải 1080p("cần trả phí")/720p/1440p("cần PRO MAX"); fps **24 (điện ảnh, mặc định)/30/60**; định dạng MP4/WebM.
- TTS: Piper `piper-vais1000` miễn phí + Google `vi-VN-Wavenet-A/B/C/D`, `Neural2-A/D` (SSML, ~2000 ký tự/lần) — free chỉ thấy toast "chỉ có ở gói PRO MAX".
- Miễn phí bị chặn: 1080p+, bỏ logo, Biểu đồ (xem được dialog, không chèn), Templates (xem được), TTS (toast), 3D model (im lặng).
- Hỗ trợ: playlist YouTube "Hướng dẫn sử dụng Map Effect từ A-Z" (4 video), nhóm Facebook, Telegram @mapeffect. Landing một trang (hero → 6 tính năng → 3 video mẫu → 6 đối tượng → 4 bước → so sánh cách cũ → giá → chốt).

---

## 3. Kho mẫu mapeffect (đầy đủ, đã trích tên từng mẫu)

*(Dùng làm danh mục đặt hàng cho WP-4/5; tên tiếng Việt giữ nguyên để làm tên hiệu ứng.)*

- **Call out — 75 mẫu / 8 nhóm**: Bất động sản 10 (Thẻ thông số BĐS · Thẻ môi giới · Huy hiệu + tên công ty · Hộp viền + icon nhà · Ngoặc góc + logo · Thanh ngang + icon · Chữ trên nền vàng · Khung giá nổi bật · Logo khu nhà · Hai vạch vàng + chữ); Biển rao bán 9 (Bảng vát góc chân xiên · Bảng gáy màu cột bên · Bảng lệch ô logo · Bảng lệch + dải ĐÃ BÁN · Biển treo xích · Biển treo một vòng · Bảng đỉnh vòm · Mũi tên đuôi én · Thẻ vòm công ty); Nhãn địa điểm 10 (Viên thuốc · Thẻ vuông · Thẻ + địa chỉ · Kính mờ tối · Thẻ + ô ảnh · Chip trên · Thanh dưới · Ghim trên giữa · Ghim giữa tên · Chữ trần); Đường chỉ dẫn 10 (Gấp khúc cơ bản · Gạch chân dưới chữ · Ngoặc vuông bao chữ · Thanh viên thuốc · Nét đứt chạy · Sóng lan tại điểm neo · Đường cong mềm · Khung ngắm bốn góc · Hai bậc thang · Chấm nhấn ở cuối); Callout nét mảnh 10 (Ring neo + tấm kính · Tấm kính lệch theo đường dẫn · Ô vuông nghiêng · Chỉ chữ gạch chân dày · Nhãn mono + gạch ngang · Ô logo vuông ticks góc · Logo trong ring mảnh · Khung ảnh hairline + nhãn · Ảnh trên tấm kính dưới · Ảnh trái + chữ phải); Logo mở đầu 10 (Nét vẽ chạy dần · Hai mái khớp vào · Trồi lên sau khe · Biển hiệu đung đưa · Vạch kẻ tách đôi · Khung vuông vẽ dần · Zoom lớn thu về · Thanh sáng quét ngang · Gõ từng ký tự · Trượt ngược chiều); Thanh mạng xã hội 8 (YouTube · Facebook · TikTok · Telegram · Số điện thoại · Gmail · Google · Discord); Chú thích địa điểm 8 (Thanh bung ngang · Thẻ trắng bo góc · Nét đứt kéo tới nhãn · Hai dải xếp chồng · Ghim rơi nảy · Sóng radar lan · Dải mở ra hai bên · Thẻ viền ngoặc góc). Panel callout: Ghim vào bản đồ Bật/Tắt; các ô nội dung theo mẫu (Dòng trên/Tên chính/Thông số từng dòng/Giá); đổi mẫu cùng nhóm ngay trong panel; Mở về phía Trái/Phải; 3 màu (nhấn/nền/chữ); Tốc độ; "Giữ nguyên (giây)"; "Có hiệu ứng thoát"; tổng thời gian mẫu (vd 4.3 s) + nút "↔ Khớp độ dài lớp với mẫu"; keyframe ◇ cỡ chữ/x %/y %/xoay; Đưa camera tới.
- **Hiệu ứng chữ — 64 mẫu** (ô tìm kiếm): Dự án hot · Căn hộ cao cấp · Định vị ghim bản đồ · Chữ vàng kim · Neon xanh lơ · Thẻ kính mờ · Hai dòng tạp chí · Vàng 24K · Đồng cổ · Ngọc lục bảo · Vàng khung góc · Bạch kim thẻ kính · Đỏ viền trắng 3D · Đổ bóng khối · Vàng kim ánh sáng · Kim loại crôm · Bút dạ quang · Nhiễu glitch · Neon lắc màu · Nảy từng chữ · Sóng nhấp nhô · Hiện từng từ · Nước dâng · Nét mảnh mờ tan · Mờ dần giãn chữ · Chồng chữ nét viền · Đậm + viết tay · Nhãn xanh bật ra · Serif cổ điển · Cam bóng nước · Gạch ngang đỏ · Pin vàng bật lên · Nhãn bản đồ cong · Khung callout kẻ · Màn che trượt lên · Đèn neon nhấp nháy · Đóng dấu mộc · Tách đôi khép lại · Lật 3D từng chữ · Số tự nhảy lên · Viết viền rồi tô · Bóng đổ dài · Sọc ngang lật mở · Vàng lấp lánh · Trượt ra từ khe · Đập vào + nhãn · Hai dòng đổi chỗ · Băng chữ chạy · Nhãn băng dính · Băng VHS nhiễu · Khung bung ra · Zoom lệch nhịp · Bảng lật sân bay · Ngoặc bung hai bên · Hologram 3D · Chrome lỏng · Chữ mây bồng bềnh · Khối 3D viền vàng · Viền neon kẻ vạch · Bóng kem nền tròn · Chrome chảy giọt · Viết tay đè lên · Ép nhũ vàng · Chrome hoàng hôn 80s. Panel: nội dung, font, giãn cách, đậm ×5, nghiêng, **uốn cong (cả khung/băng/vạch cong theo)**, HOA/thường, 3 màu, tốc độ (1 = khít lớp), keyframe, đếm số, kéo-thả + 4 chấm góc scale + chấm xoay (Shift hút 15°).
- **Chữ thường (T)**: 20 preset kiểu, Một màu/Gradient, 3D nổi khối, viền, neon, đổ bóng, **Chữ 3D đứng trên bản đồ**, kiểu hiển thị Thường/Khung callout, hiệu ứng vào (Mờ dần/Trượt lên/Trượt ngang/Phóng to/Máy chữ/Nước tràn), nền chữ, đếm số, uốn cong nửa vòng tròn.
- **Font 27**: Be Vietnam Pro · Manrope · Montserrat · Roboto · Roboto Slab · Oswald · Anton · Fjalla One · Playfair Display · Merriweather · Nunito · Lobster · Pacifico · Dancing Script · Young Bold · Vina Sans · Dela Gothic One · Bungee · Alfa Slab One · Yeseva One · Fruktur · Baloo 2 · Hurricane · Inter · Kanit · Plus Jakarta Sans · Quicksand (+ đánh dấu ★ ưa thích, ô tìm).
- **Mũi tên (W)**: A→B; 3 kiểu (cong liền/nét đứt/cong chấm cuối); màu; dày; cỡ đầu; **độ cong**; hiệu ứng Bay tới/Dòng chảy/Đứng yên + thời gian; "Nổi lên trên ảnh/video" (z-order); "Bay trên bản đồ (đổ bóng)" (bóng translate viewport).
- **Tiện ích (E) — 9 kiểu**: Icon động 21 (Vị trí của bạn → La bàn, đủ POI kèm Ga tàu/Khu du lịch/Công trường/Thời tiết); Huy hiệu có tên 12; Giọt nước sang 19 icon × 4 tông; Radar 4 kiểu (quét nan/sóng lan/quầng thở/cung xoay); Ghim ô kính 14 × 4 tông; Callout vàng 17 icon; Ghim giọt nước; Nền đen viền vàng; Huy hiệu lục giác.
- **Đối tượng (D)**: 195 cờ + ~85 sprite PNG top-down 11 nhóm (Xe cộ 18 · Con người 9 · BĐS 7 · Dầu khí 7 · Du lịch 8 · Lịch sử 5 · Thể thao 2 · Tiền & kinh doanh 9 · Rau củ quả/Dàn điện thoại · Thiên tai & cảnh báo 9 · Hiệu ứng & tiện ích 4). Panel: pinned hoặc %-màn-hình; "Cho chạy theo đường"; tốc độ (1 = hết tuyến đúng lúc lớp kết thúc); keyframe tiến độ %/size/xoay; tự xoay theo hướng; hiệu ứng vào/ra.
- **Tuyến đường (R)**: pen tool (nhấp = điểm gãy, **nhấp-kéo = điểm cong có tay nắm**, Enter/đúp = xong); màu/dày/liền-đứt; hiệu ứng Chạy dần/Dòng chảy/Hiện dần + thời gian; **Đầu đường** (vật gắn sẵn: Ô tô/Xe máy/Xe khách/Người/Chữ); hiệu ứng kết thúc (Mờ dần/Xoá dần/**Rút về đích**/Loé rồi tắt); neon + màu + độ sáng; **hiệu ứng đặc biệt Lửa/Tia lửa/Khói + cường độ**.
- **Biểu đồ (PRO MAX)** 9 mẫu: Cột nhấn · Cột ngang · Cột chồng · Đường · Tròn/Vành · Vòng tỉ lệ · Sơ đồ tổ chức · Lịch tháng · Đường phát triển; bảng số liệu + "Dán từ Excel"; chủ đề/nền/màu; preview có thanh tua đồng bộ thời gian.
- **Templates (PRO MAX)** 7+: Nhân khẩu hình người (4 kiểu) · Thông báo iOS gọn · Thông báo điện thoại (màn khoá) · Khung chat điện thoại · Trang cá nhân Instagram · TikTok · Kênh YouTube — preview động + "Chỉnh sửa ↓".
- **Âm thanh (A)**: thư viện **~800 SFX 20 nhóm** (whoosh 176 · Glitch 111 · UI 66 · Technology 66 · Swipe & Swish 62 · Spin 34 · Futuristic 27 · Sine 25 · Bell 23 · Click digital 20 · Pop 19 · Highlight 15 · GLEAM 12 · Paper 12 · Robot 11 · Riser 7 · Transition strong 5 · Magic 3 · Appear & Disappear 81 · Wrong 28) từ `/api/sfx`, nghe thử từng cái, "+ Tải lên âm thanh của bạn".
- **Media mode** ("Dựng bằng video/ảnh trên nền màu"): ẩn bản đồ, Nền màu + **Nền động 8 kiểu** (Màu trơn · Giấy dó trôi · Bình độ · Lụa gấp · Lưới neon đỏ ∞ · Lưới neon xanh ∞ · Mưa tàn lửa ∞ · Báo cũ) — làm intro/outro cùng timeline.
- **Phím tắt** (dialog, gán lại được, "Khôi phục mặc định"): V P G R W T E M A D · Space/Home/End · K · S + Ctrl+B · **Q (xén trước playhead)** · Ctrl+D · Ctrl+C/V · Ctrl+A · Delete/Backspace · Ctrl+Z · Ctrl+Shift+Z/Ctrl+Y. Timeline: "Hút clip" bật/tắt, "＋ hàng mới (kéo lên đây)", Alt+click lật lớp chồng nhau, thước căn chỉnh, đổi khung Ngang/Dọc/Vuông là reflow container thật.

---

## 4. Cam Lâm Land — hiện trạng chi tiết (đã đăng nhập, đã đọc bundle, đã chạy thử export)

### 4.1 Những thứ ĐÃ TỐT (giữ nguyên, chỉ đánh bóng)
- **Kịch bản nhiều cảnh** 01 Vị trí · 02 Hạ tầng · 03 Tiện ích · 04 Đầu tư · 05 Bán hàng · 06 Dẫn đường (4 biến thể) + thêm/nhân bản/dời/xoá + "Tạo bộ kịch bản khác nhau" + **AI viết lời thoại** (áp 1 hoặc tất cả) + mẫu nhanh (Vị trí/Gần sân bay/Gần biển/…9 mẫu) + **Xuất cả bộ (ZIP)** và **xuất một lần nhiều khổ** (tích 16:9/9:16/4:5/1:1 → đủ file từng nơi đăng).
- **Preset camera** rất giàu: 6 kiểu toàn cảnh (Toàn cảnh/Định vị xa→gần/Quét ngang/Xoay quanh/Đẩy sát điện ảnh/Bám sát nhanh), 7 kiểu dẫn đường (chuẩn/sát mặt đường/sát cực thấp nghiêng kịch trần/nhìn từ trên như Google Maps/kết ở thửa đất/điện ảnh chậm/bay cao đường dài), 8 kiểu flycam (Xoay 360°/Xoáy ốc bay vào/Cần cẩu nâng/Lướt thấp sát mặt/Lộ diện trên→3D/Điện ảnh chậm/Sôi động bùng nổ/Vòng cung boomerang), "Luôn ngoái nhìn về lô đất", "Ngắm thửa đất N giây", cờ cảnh ven biển/đèo núi; + keyframe tự đặt ("Chốt khung", cần ≥2 khung).
- **Ghim tiện ích**: 27 kiểu × 24 tiện ích, 8 chuyển động (Nhún nhẹ/Nhịp tim/Sóng lan/Rơi xuống/Toả sáng/Lắc lư/Nhấp nháy/Đứng yên), màu tự theo loại tiện ích, **cắm hàng loạt từ Excel/CSV**, ngưỡng zoom hiện ghim ("lấy mức hiện tại"), ghim dính đất/không, chuột phải đổi tên-dời-nhân bản-xoá.
- **Thẻ chú thích** có dây nối + **tự ghi khoảng cách tới lô**; **mũi tên "bắn" từ lô ra địa danh** kèm khoảng cách, 3 kiểu vạch; vòng bán kính 500 m–5 km; đo khoảng cách.
- **Lô đất**: đa giác/chữ nhật/vuông/tròn; hiệu ứng Phát sáng/Viền kép sáng/Vệt sáng chạy/Thở nhẹ/Nét mảnh/Viền chạy/Chớp nháy/Tĩnh + đốm sáng chạy viền + **số đo cạnh & diện tích** + 3D nổi khối + ảnh trong lô + đưa camera tới.
- **Màu bản đồ**: 7 tông vệ tinh (Tươi/Ảnh gốc/Rực rỡ/Điện ảnh/Nắng ấm/Biển xanh/Sáng nhẹ) + **color grade "Nhìn điện ảnh"** (Nguyên bản/Điện ảnh/Hoàng hôn/Xanh biển/Đậm nét/Hoài cổ) + tối 4 góc % + fade mở/đóng màn 0,5 s + **khung an toàn TikTok/Reels** + tự chỉnh (rực/tương phản/nâng tối/ngả màu); **đổ bóng đồi núi (hillshade)**; **địa hình 3D thật** với "Độ nổi của núi" chỉnh được (cảnh báo méo >1×); GPU tier hiển thị ngay trên nút ("Hợp máy này (có card)").
- **Chữ & lời**: 43 mẫu chữ động; **thẻ thương hiệu 8 kiểu** (watermark khéo — "Dấu chìm" mờ to giữa khung) + 4 góc + "tự né chỗ có chữ"; **phụ đề tự viết hoặc nhập SRT**; phân cảnh mẫu 5 cảnh.
- **Brand Kit** (logo riêng thay watermark, lưu dùng mọi dự án), **Phiên bản (Lưu mốc)**, file dự án JSON đầy đủ, thư viện media "Đã dùng gần đây" (ảnh/video/nhạc, ★), QR liên hệ góc video, 10 phương tiện chạy tuyến (tự bật "chạy theo tuyến + quay theo hướng đi"), 7 tiếng động máy tự tạo, thu âm mic, nhạc nền từ file/trích từ video.
- **Render kỹ** (đúng triết lý dựng phim từng khung) + chọn 30/24 fps + "Tự động/2D/3D" + hợp máy yếu; xuất `showSaveFilePicker`; kiểm tra khổ chẵn; thử codec `avc1.4D0032→640032→42E032` × (prefer-hardware→no-preference), `latencyMode:'quality'`, keyframe 2 s, backpressure `encodeQueueSize>2`; `fadeDuration:0` và `raster-fade-duration:0` đã đặt đủ (14 chỗ).

### 4.2 Những thứ ĐANG YẾU (bằng chứng đo được)
1. **Tốc độ render & độ tin cậy** *(nghiêm trọng nhất — xem mục 5–6)*: 8 s · 1080p30 · "Render kỹ BẬT" · 3D Tự động trên máy Intel UHD 730 → **hơn 3,5 phút chưa xong**; khi tab bị che/nền → **treo vô hạn** (vòng chờ chạy bằng rAF), **không có % tiến độ, không có nút huỷ, không có ETA** ("Đang quay…" là hết). mapeffect cùng máy: 5 s · 720p24 → ~15 s, có "Đang kết xuất khung m/r" và nút Dừng.
2. **Nguyên nhân trong code** (hàm `ch`/`cu` trong `app/tao-video-ban-do/page-*.js`): mỗi khung chờ ổn định bằng **so sánh điểm ảnh canvas** (đọc pixel mỗi vòng rAF, đếm điểm |ΔR|+|ΔG|+|ΔB|>26, ngưỡng 0,0015–0,004, cần 1–2 lần ổn định liên tiếp) với timeout **3 s (khung thường) / 8 s (khung đầu), thất bại thử tiếp 9 s, nhân đôi nếu GPU "yếu"** → vừa chậm (readback GPU đồng bộ hàng chục lần/khung) vừa dài. `areTilesLoaded` chỉ là điều kiện phụ. Không có prefetch dọc camera trước khi quay.
3. **TTS/tiếng động ép quay thời gian thật**: giọng `speechSynthesis` "chỉ nghe thử được, trình duyệt không cho ghi thẳng vào video" (danh sách giọng phụ thuộc máy, thường **không có giọng Việt**); có giọng đọc/tiếng động là bỏ Render kỹ → rớt khung trên máy yếu. Tiếng động là WebAudio tự tạo — hoàn toàn render offline được nhưng chưa làm.
4. **Địa danh**: gọi thẳng `nominatim.openstreetmap.org/search?polygon_geojson=1` từ trình duyệt; "Cam Lâm" → *"Không tìm thấy ranh giới"*; dữ liệu đơn vị hành chính mới sau 1/7/2025 không đảm bảo; vi phạm khuyến nghị usage policy (không User-Agent riêng, gọi từ client).
5. **Nguồn ảnh & nhãn**: chỉ raster Esri (nhãn tiếng Anh, không tuỳ chỉnh) + EOX; không có bản đồ vector nhãn `name:vi`, không đổi kiểu bản đồ giữa video.
6. **Phụ thuộc CDN runtime**: `esm.sh/mp4-muxer@5.2.1`, `esm.sh/jszip`, `esm.sh/qrcode`, `unpkg`… nạp lúc chạy — esm.sh trục trặc là mất tính năng xuất.
7. Giới hạn 120 s; không có dự án đám mây (chỉ file + localStorage?); UI mật độ cao, chữ nhỏ (scale 80 %), preview nhỏ; không có ổn định hoá layer khi export lỗi tile (503 của tile server → khung thiếu ảnh).

---

## 5. Đối chiếu hiệu năng render (đo cùng máy, cùng ngày)

| Phép đo | mapeffect | Cam Lâm Land |
|---|---|---|
| Job thử | 5 s · 720p · 24 fps · 4 layer 2D (map tối) | 8 s · 1080p · 30 fps · 1 polygon · Render kỹ BẬT · 3D Tự động (vệ tinh Esri) |
| Kết quả | **~15 s** (~8 fps render) | **>210 s chưa xong, sau đó treo khi tab mất focus** (~<1,1 fps render) |
| Chờ mỗi khung | sự kiện `render`+`areTilesLoaded()`, `idle`, trần **0,9 s**, thường thoát sau 1–2 vòng | vòng rAF + đọc pixel so sánh; trần 3→9 s (×2 nếu GPU yếu) |
| Prefetch trước quay | có (≤40 mốc dọc camera, mỗi mốc ≤0,6 s) | không thấy |
| Tiến độ/huỷ | "Đang kết xuất khung m/r" + Dừng (+cảnh báo bỏ dở) | không có |
| Tab nền | (chưa thử; cùng cơ chế rAF nên cũng cần xử lý) | treo vô hạn |
| Codec đầu ra đo được | avc1 High@4.1, moov trước mdat, KF 2 s, 1,36 Mbps thực | (chưa lấy được file vì chưa render xong) |

Kết luận: khoảng cách không nằm ở WebCodecs (hai bên giống nhau) mà ở **chiến lược chờ khung + chuẩn bị tile + nguồn ảnh khi 3D**.

---

## 6. CHƯƠNG TRỌNG TÂM — Render video 3D DÀI cho MƯỢT (thiết kế lại lõi render của camlamgis)

"Mượt" gồm 4 việc độc lập: (A) **không rớt/kẹt khung khi xuất** (deterministic offline render); (B) **không nhấp nháy giữa các khung** (tile/nhãn/terrain nhất quán); (C) **chuyển động camera đẹp** (nội suy + easing đúng); (D) **xuất nhanh, dài không chết** (bộ nhớ, tiến độ, phục hồi). Dưới đây là thiết kế đầy đủ; mã tham chiếu ở Phụ lục B (đã type-check với maplibre-gl@4.7.1 + mp4-muxer@5.2.2).

### 6.1 (A) Vòng render offline chuẩn
1. **Mọi trạng thái là hàm của t**: `renderAt(t)` = `map.jumpTo(cameraAt(t))` → cập nhật mọi source/overlay theo t → chờ ổn định → composite → encode. Tuyệt đối không easeTo/flyTo/CSS transition/`Date.now()` trong lúc xuất (kể cả hiệu ứng ghim "nhún" phải tính theo t, không theo đồng hồ thật).
2. **Thay pixel-diff bằng chờ sự kiện** (fix lớn nhất): dùng `waitMapSettled` (Phụ lục B.1) — nghe `render`, thoát ngay khi `map.areTilesLoaded() && map.isStyleLoaded()`, kèm `once('idle')`, trần 900 ms; khung nào quá trần thì thử lại 1 lần 2,5 s rồi ghi nhận "khung thiếu tile" (đếm và báo cuối phiên). Điều kiện để tin được sự kiện: `fadeDuration:0` + `raster-fade-duration:0` (đã có) + **không dùng animate trong setData** + icon `allow-overlap/ignore-placement` như mapeffect để placement không nhảy. Pixel-diff hạ xuống vai trò **chẩn đoán tuỳ chọn** (bật khi debug, so 1 lần/khung ở kích thước thu nhỏ 64×36, không phải mỗi vòng rAF).
3. **Không phụ thuộc rAF khi tab ẩn**: vòng lặp dùng `await waitMapSettled()` (event/timeout-based); giữa các khung nếu cần nhịp thì `setTimeout(0)`; lắng nghe `visibilitychange` → hiện cảnh báo "Giữ tab hiển thị khi đang xuất" và **pause/resume an toàn** (encoder giữ nguyên, tiếp tục từ khung m). Tuỳ chọn nâng cao: `document.pictureInPicture` một canvas nhỏ để tab luôn "visible" — chỉ làm nếu thực sự cần.
4. **Backpressure & bộ đếm**: `encodeQueueSize > 8` → chờ 4 ms (2 là quá chặt, throughput thấp); `keyFrame` mỗi 2 s; `latencyMode:'quality'`; thử codec như hiện tại (thêm `avc1.640033` cho 1440p, thêm cấp High trước Main để ưu tiên chất lượng).
5. **Âm thanh offline 100 %** (bỏ hẳn nhánh "có giọng đọc thì quay thời gian thật"): giọng đọc lấy từ **TTS server trả file** (WP-6); tiếng động WebAudio tự tạo → render bằng **OfflineAudioContext** (cùng code tạo dao động, chỉ đổi context); trộn tất cả (nhạc + giọng + SFX, gain/trim/fade) trong OfflineAudioContext 48 kHz → AAC (fallback Opus khi máy không có AAC encoder — một số Chromium/Linux) → mux. Thu mic vẫn giữ như tính năng phụ (file thu xong cũng là file → offline được).

### 6.2 (B) Nhất quán giữa các khung (hết "khựng/nháy")
1. **Prefetch dọc camera trước khi quay** (mapeffect: duration×2 mốc, trần 40, mỗi mốc chờ idle ≤600 ms + hiện %). Với 3D thêm: prefetch cả **tile DEM** (chúng đi qua areTilesLoaded như mọi source).
2. **Tile cache**: `maxTileCacheSize: 512+`; và bọc mọi nguồn tile bằng **custom protocol có retry + Cache API** (Phụ lục B.3) — tile lỗi 5xx được thử lại 4 lần lùi dần thay vì để MapLibre đánh dấu lỗi và bỏ trống khung; render lần 2 gần như tức thời. (Đã thấy tile server công cộng trả 503 giữa phiên.)
3. **Chính sách 3D kiểu mapeffect, có cải tiến**: giữ nguyên option "Núi nổi khối SUỐT video" của camlamgis làm mặc định khi có 3D (đúng chỗ camlamgis đã nghĩ tốt hơn: không bật/tắt terrain theo zoom giữa video → không "pop"). Kèm: (a) **maxZoom khi 3D** (~15,5–16) + toast lùi zoom như mapeffect; (b) khi 3D dùng **một nguồn ảnh nhẹ** (EOX Sentinel, maxzoom 14) thay cho Esri z16+ để giảm tải và hết cảnh tile HD nhảy — cho người dùng chọn "3D nét (chậm)" nếu muốn giữ Esri; (c) DEM `tileSize 512`, `maxzoom 12`, exaggeration mặc định 1,0–1,2 (camlamgis đã có slider + cảnh báo méo — giữ); (d) pitch mặc định 55–60°, `maxPitch` 70 khi 3D (85 chỉ cho 2D nghiêng nhẹ).
4. **Nhãn không nhấp nháy**: symbol quan trọng (nhãn xã, ghim, nhãn tuyến) đặt `text-allow-overlap`/`icon-allow-overlap` + `ignore-placement` (mapeffect làm vậy với mọi icon/object) hoặc vẽ ở tầng overlay theo `map.project()`; nhãn basemap để mặc định nhưng `fadeDuration:0` (đã có) để trạng thái nhảy dứt khoát, xác định.
5. **DPR cố định**: render xuất ở pixelRatio 1 với canvas đúng W×H (container thật hoặc `map.setPixelRatio(W/previewW)`); mọi kích thước overlay nhân hệ số scale (mapeffect: `Wt(W/previewW)` + zoomOffset `log2`).

### 6.3 (C) Camera 3D đẹp
1. Giữ toàn bộ preset hiện có; chuẩn hoá phần lõi bằng **nội suy keyframe kiểu mapeffect** (Phụ lục B.4): hold → transition(easing per-keyframe: Đều/Mượt 2 đầu/Chậm cuối/Điện ảnh) + **tâm lerp Mercator theo tiến độ zoom `s=(2^(z0−z)−1)/(2^(z0−z1)−1)`** (pan+zoom không bị cảm giác trôi nhanh-chậm) + bearing cung ngắn + "Bắt đầu zoom sau"/"Thời gian zoom" (zoom lệch pha với pan — trick "Điện ảnh" của mapeffect).
2. **Bay quanh/flycam trên địa hình**: dùng `map.calculateCameraOptionsFromTo(from, altFrom, to, altTo)` (có sẵn MapLibre 4) — đặt "vị trí camera vật lý" (lng, lat, cao độ m) nhìn về mục tiêu; quỹ đạo orbit/crane/spiral chỉ là tham số hoá vị trí đó theo t; **kẹp cao độ camera ≥ mặt đất + 50 m** bằng `map.queryTerrainElevation` (camlamgis đang lấy elevation qua API `/do-cao?p=` — chuyển sang query tại client khi terrain bật, đỡ round-trip) (Phụ lục B.5).
3. Bezier/curve cho đường bay dài: giữ cách hiện tại nếu đã đẹp; nếu thấy gãy ở khớp keyframe, chèn **Catmull-Rom qua các keyframe center** chỉ cho đoạn dẫn đường dài.

### 6.4 (D) Dài không chết: bộ nhớ, tiến độ, phục hồi
1. **Muxer ghi ra đĩa**: 120 s+ ở 1080–1440p đừng giữ cả file trong RAM. Ưu tiên `FileSystemWritableFileStreamTarget` (đã dùng `showSaveFilePicker` rồi — thêm target này là xong) với `fastStart:{expectedVideoChunks: totalFrames, expectedAudioChunks}` (biết trước số khung → moov vẫn nằm đầu file, phát ngay được); fallback `StreamTarget` chunked 4 MB gom Blob parts; `ArrayBufferTarget` chỉ cho video ngắn (Phụ lục B.6). Nhớ `frame.close()` ngay, không tạo canvas mới mỗi khung, tái dùng buffer.
2. **Tiến độ + ETA + huỷ + tổng kết**: "Khung m/N · x s/khung · còn ~mm:ss" cập nhật mỗi khung; nút Dừng (flush encoder, đóng writable, xoá file dở nếu người dùng chọn); cuối phiên báo "N khung, trong đó k khung phải chờ >0,9 s, j khung thiếu tile" — đúng bộ đếm `tong/choLau/chuaXong/conTrong` đã có, nhưng **hiển thị ra** thay vì chỉ đếm ngầm.
3. **Ước lượng trước khi quay**: đo 10 khung đầu → ETA; nếu >15 phút thì gợi ý hạ 24 fps/720p/tắt 3D nét.
4. **Phục hồi ngữ cảnh WebGL**: bắt `webglcontextlost` trên `map.getCanvas()` → pause, thông báo; nếu restore được thì render lại từ khung kế (encoder còn sống thì ép keyFrame rồi đi tiếp); không thì kết thúc file ở khung đã có + báo rõ (Phụ lục B.7).
5. **Video rất dài (>3–5 phút)**: xuất **theo đoạn theo kịch bản** (mỗi kịch bản một file — camlamgis đã có ZIP đa kịch bản, chỉ cần thêm "ghép nối tiếp thành 1 file" bằng cách mux chung một muxer nhiều đoạn, hoặc để người dùng ghép); cân nhắc về sau: render trên server (Puppeteer + GPU) bán như tính năng PRO — không bắt buộc bây giờ.
6. **Điểm nhanh dễ ăn**: bỏ import esm.sh (npm bundle — WP-1.4 cũ); prefetch + event-wait dự kiến đưa 8 s/1080p30 từ >210 s về **~30–60 s** trên cùng máy; giữ "Hợp máy yếu" như hệ số trần chờ (×2) chứ không nhân đôi mọi timeout dài.

---

## 7. Bảng khoảng cách (v2 — sau khi xem kỹ cả hai)

| # | Hạng mục | mapeffect | Cam Lâm Land | Việc cần làm |
|---|---|---|---|---|
| 1 | Chờ khung khi xuất | sự kiện tile, trần 0,9 s | pixel-diff, trần 3–12 s, treo tab nền | **WP-1 (mục 6.1–6.2)** |
| 2 | Prefetch camera | có (≤40 mốc) | không | WP-1 |
| 3 | Tiến độ/huỷ/ETA | có/có/không | không/không/không | WP-1 |
| 4 | Âm thanh offline | OfflineAudioContext + file TTS server | speechSynthesis (không ghi được) → quay realtime | **WP-6** |
| 5 | Ranh giới VN mới + nhấp chọn trên map | GeoJSON nội bộ theo tỉnh + index không dấu | Nominatim client (fail "Cam Lâm") | **WP-3** |
| 6 | Geocode/routing proxy | /api/geocode (bias), /api/route (Valhalla, 3 chế độ) | Nominatim client; routing có (engine chưa xác định trong bundle) | WP-3 |
| 7 | Vector basemap + nhãn name:vi + cắt "Xã/Phường" | 5 style OpenFreeMap + nhuộm màu + labels per-keyframe | chưa có | WP-2 |
| 8 | Đổi bản đồ giữa video (crossfade/ink) | có, theo keyframe | chưa | WP-2 |
| 9 | 3D policy | terrain theo zoom<13,5, một nguồn ảnh, maxZoom riêng, DEM 512 z12, exagg 1.4 | terrain luôn/tự động, Esri HD cả trong 3D, exagg chỉnh được | WP-1/2 (mục 6.2.3) |
| 10 | Kho hiệu ứng | 75 callout · 64 chữ · 27 font · 9 tiện ích · ~85 vật thể+cờ · ~800 SFX · preview động | 43 chữ · 27×24 ghim · 8 thẻ thương hiệu · 10 phương tiện · 7 SFX máy tạo | WP-4/5 (port dần theo danh mục mục 3) |
| 11 | Vẽ nâng cao | pen-tool điểm cong, dasharray chạy, neon 2 lớp GPU, extrude duc/mờ, bóng viewport-translate, lửa/khói trên tuyến | polygon 4 kiểu + hiệu ứng viền canvas | WP-4 |
| 12 | Keyframe thuộc tính (◇ mọi slider) | có (size/x/y/xoay/tiến độ…) | chỉ camera keyframe | WP-7 |
| 13 | Dự án đám mây | 2 dự án/60 MB free, .mapeffect zip | file JSON + Lưu mốc cục bộ | WP-7 |
| 14 | Phím tắt tuỳ chỉnh, i18n EN, mobile editor | có | chưa | WP-7 (thấp) |
| 15 | Gói cước/quota server, mua lẻ theo giây, VietQR tự kích hoạt, hoàn tiền 72 h | đủ, authorize/commit | đăng nhập mới xuất; chưa gói | WP-8 |
| 16 | Kịch bản đa cảnh + AI lời thoại + đa khổ ZIP + Brand Kit + preset camera + SRT + Excel ghim | **không có** | **có** | GIỮ & khuếch đại (marketing!) |


---

## 8. Work Packages (v2 — thứ tự thi công)

### WP-1 — Viết lại lõi render/export (theo toàn bộ mục 6)
Việc: `lib/video/` mới gồm `camera.ts` (B.4), `settle.ts` (B.1), `warm.ts` (B.2), `tileProtocol.ts` (B.3), `exportVideo.ts` (B.8 + muxer đĩa B.6), `audioMix.ts` (offline SFX + file giọng đọc), `guard.ts` (B.7); gỡ pixel-diff khỏi đường chính (giữ sau cờ `debugStability`); thay `esm.sh`/`unpkg` bằng npm (`mp4-muxer`, `webm-muxer`, `jszip`, `qrcode`); modal tiến độ (khung m/N, s/khung, ETA, Dừng, cảnh báo tab ẩn, tổng kết khung chậm/thiếu); đo 10 khung đầu để ETA; giữ nguyên UI "Render kỹ/Hợp máy yếu/30-24 fps/Tự động-2D-3D" (chỉ đổi ruột).
Nghiệm thu: 8 s·1080p30·3D trên máy Intel UHD ≤60 s; 120 s·1080p30 chạy hết không tràn RAM (ghi thẳng đĩa), huỷ được, tab ẩn không treo (pause + cảnh báo); có giọng đọc/tiếng động vẫn render từng khung (offline mix); MP4 ra: moov đầu file, KF 2 s, phát được Zalo/Messenger/iPhone.

### WP-2 — Basemap vector + nhãn Việt + đổi bản đồ giữa video + chính sách 3D
OpenFreeMap 5 style + "nhuộm" thêm tông (giữ 7 tông vệ tinh + grade hiện có); expression nhãn `name:vi→name:latin→name` + cắt "Xã /Phường /Thị trấn " (công thức mục 2.2); nguồn nhãn xã Khánh Hòa riêng; vệ tinh 2 tầng (EOX z≤14 + Esri 14→19) với lựa chọn nguồn khi 3D (mục 6.2.3); crossfade opacity theo loại layer + hiệu ứng "Loang mực" (noise seed + destination-out) làm transition đổi bản đồ theo keyframe; mapdim ("Làm tối bản đồ" theo keyframe).

### WP-3 — Geodata nội bộ + proxy
`public/geo/`: vn-provinces (34), vn-xa-khanh-hoa (đơn vị mới, simplify 5–10 m, thuộc tính ma/ten/khong_dau/bbox), index tìm không dấu; script `scripts/build-geo.ts` (nhận SHP/GeoJSON nguồn công tác của Hậu, `ogr2ogr` + simplify + bỏ dấu); công cụ "Tìm vùng" đọc index local (fallback Nominatim **qua proxy server** có User-Agent + cache); nhấp bản đồ chọn tỉnh/xã theo zoom; `/api/geocode` (Photon proxy, bias tâm map), `/api/route` (Valhalla proxy, cache, ô tô/xe máy/đi bộ) — thẻ chú thích/mũi tên dùng km + phút thật.

### WP-4 — Kho hiệu ứng (port theo danh mục mục 3)
Nền tảng: registry `FxModule {id, nhom, ten, defaults, draw(ctx,p,t,helpers), preview}` + hộp chọn mẫu thumbnail-canvas động dùng chung; chuyển hiệu ứng lô đất sang cặp layer MapLibre glow (công thức neon 2 lớp) + giữ canvas cho callout/chữ. Port theo đợt 8–10 mẫu: callout BĐS → biển rao bán → nhãn địa điểm → đường chỉ dẫn → hairline → logo mở đầu → social (thêm **Zalo**) → chú thích địa điểm; hiệu ứng chữ nâng 43 → 60+ (ưu tiên: Vàng 24K nâng cấp, Kim loại crôm, Nhiễu glitch, Nảy từng chữ, Đếm số, Bảng lật sân bay, Đóng dấu mộc, Uốn cong); dasharray "vạch chạy", đầu mũi tên fill, bóng viewport-translate, lửa/tia lửa/khói cho tuyến.

### WP-5 — Vật thể & media
PNG top-down bổ sung theo nhóm mapeffect (xe cộ đủ 18, người, BĐS, du lịch, cờ VN + quốc kỳ chọn lọc), `icon-rotate` theo bearing, tốc độ = 1 ⇒ hết tuyến cuối lớp, keyframe tiến độ; media đổ vào vùng bằng **canvas source + raster-fade-duration 0**; "Đầu đường" gắn vật ngay trong panel tuyến; 3D model GLB (three custom layer, chờ sẵn sàng trước export) — để sau cùng.

### WP-6 — Giọng đọc server + tự động hoá
`/api/tts`: Piper self-host giọng `vi_VN-vais1000-medium` (mặc định, miễn phí) + Google TTS `vi-VN-Neural2/Wavenet` (gói trả phí), cache theo hash, trả mp3 + duration → thành layer audio đúng chỗ lời thoại; bỏ nhánh realtime; tiếng động tự tạo render qua OfflineAudioContext; nút **"Tạo video từ tin đăng"** ở `/listings/[id]` (polygon thửa + giá/diện tích + tiện ích quanh + kịch bản + AI lời + TTS → mở editor đã dựng sẵn) — đây là vũ khí mapeffect không có.

### WP-7 — UX editor
Keyframe ◇ cho size/x/y/xoay/opacity của chữ-ghim-ảnh (như mapeffect); "Đưa camera tới" mọi layer; phím tắt + dialog gán lại; Hút clip; Alt+click lật lớp chồng; track "＋ hàng mới (kéo lên đây)"; dự án đám mây (2–3 dự án free, giới hạn MB, `.camlam` = zip json) + autosave "✓ Đã lưu HH:MM"; phóng preview to hơn (thu panel trái thành icon-rail như mapeffect); tooltip giữ giọng bình dân hiện có.

### WP-8 — Gói cước & vận hành
Cờ tính năng theo gói (free 3 video 720p watermark "Cam Lâm Land" 60 s · PRO 1080p 120 s · PRO MAX 1440p + TTS xịn + template); quota server authorize/commit; mua lẻ theo giây (tính theo dự án đang mở như mapeffect); VietQR SePay/Casso webhook tự kích hoạt; trang /thanh-toan /hoan-tien (hoàn 72 h) /dieu-khoan; đo telemetry export (codec, thời gian, khung chậm, GPU tier); landing SEO "tạo video bản đồ bất động sản" nhấn khác biệt dữ liệu Cam Lâm + video mẫu thật.

---

## 9. Bản quyền & vận hành (tự kiểm tra điều khoản — không phải tư vấn pháp lý)
OpenFreeMap/OpenMapTiles/OSM: miễn phí, cần attribution (giữ dòng attribution trong video xuất). VersaTiles + Mapterhorn: miễn phí cộng đồng, có attribution. EOX Sentinel-2 cloudless: CC-BY 4.0 (ghi "Sentinel-2 cloudless by EOX"). Esri World_Imagery: đẹp nhất nhưng điều khoản dùng ngoài nền tảng Esri phải xem kỹ — camlamgis đã có lựa chọn "nguồn mở yên tâm bản quyền", nên đặt nguồn mở làm mặc định khi xuất video thương mại. Valhalla/Photon/Nominatim công cộng: fair-use, luôn qua proxy + cache, có kế hoạch self-host khi >vài nghìn req/ngày. Google Fonts: tự host trong `public/fonts`. Piper: MIT, giọng vais1000 dùng tự do; Google TTS tính phí theo ký tự (16 USD/1M). mp4-muxer/webm-muxer MIT (tác giả có thư viện kế nhiệm `mediabunny` — cân nhắc sau, không bắt buộc).

---

## 10. Prompt dán vào Claude Code

### 10.1 Khởi động (chạy trước)
```text
Đọc kỹ docs/mapeffect-brief-v2.md (đặc biệt mục 5 và 6). Khảo sát mã nguồn công cụ "Tạo video bản đồ":
1) Liệt kê file/component: map init, overlay, timeline, camera preset, hàm chờ khung (tìm pixel-diff giống mô tả hàm `ch`/`cu` mục 4.2), pipeline export (VideoEncoder/mp4-muxer/MediaRecorder), audio (speechSynthesis, tiếng động WebAudio), geocode/routing (nominatim), nguồn tile, terrain.
2) Đối chiếu từng dòng của bảng mục 7 với code thật: ĐÃ CÓ / CÓ MỘT PHẦN / CHƯA CÓ / KHÁC MÔ TẢ (ghi rõ khác chỗ nào).
3) Xác nhận các chẩn đoán mục 4.2 (đúng/sai ở code nào), đo lại: thời gian render 8 s·1080p30 2D và 3D trên máy dev.
4) Đề xuất kế hoạch WP-1 chi tiết theo mục 6 (file nào sửa, file nào thêm), ước lượng công.
Chưa sửa code. Ghi kết quả vào docs/mapeffect-gap-report-v2.md.
```

### 10.2 WP-1 (lõi render — làm thành 3 PR nhỏ)
```text
PR1 — "settle + warm + protocol": thêm lib/video/settle.ts, warm.ts, tileProtocol.ts đúng Phụ lục B.1–B.3 của docs/mapeffect-brief-v2.md; thay hàm chờ pixel-diff bằng settleFrame trong đường render chính (giữ pixel-diff sau cờ debugStability); thêm prefetch dọc camera trước khi quay (log %). Đo trước/sau trên cùng job 8 s·1080p30·3D và ghi số liệu vào PR.
PR2 — "muxer đĩa + tiến độ + huỷ + tab ẩn": exportVideo theo B.6/B.8 (FileSystemWritableFileStreamTarget + fastStart expected chunks; fallback StreamTarget; ArrayBufferTarget cho <30 s); modal tiến độ khung m/N + s/khung + ETA + nút Dừng; visibilitychange → pause/cảnh báo; webglcontextlost theo B.7; bỏ import esm.sh/unpkg, cài npm.
PR3 — "audio offline": audioMix.ts trộn nhạc + file giọng đọc + SFX tự tạo bằng OfflineAudioContext → AudioEncoder AAC/Opus; xoá nhánh 'có giọng đọc thì quay thời gian thật'; giữ thu mic (file thu được cũng đi đường offline).
```

### 10.3 WP-2 → WP-8
```text
Thực hiện lần lượt WP-2, WP-3, WP-4 (từng đợt 8–10 mẫu), WP-5, WP-6, WP-7, WP-8 theo docs/mapeffect-brief-v2.md mục 8, mỗi WP một branch + PR có checklist nghiệm thu. Khi port hiệu ứng, dùng đúng thông số trong mục 2.3 (công thức neon 2 lớp, dasharray [0,4,3] + bảng pha, bóng line-translate [16,22] viewport). Khi làm WP-3, hỏi tôi để lấy file ranh giới xã Khánh Hòa nguồn công tác trước khi fallback OSM.
```

---

## Phụ lục A — Nội suy camera keyframe (đã chạy thử Node, khớp hành vi mapeffect)

```ts
// lib/video/camera.ts
export type CamKey = { t:number; center:[number,number]; zoom:number; bearing:number; pitch:number;
  hold?:number; transDur?:number; ease?:keyof typeof EASE };
export const EASE = {
  linear:(t:number)=>t, easeIn:(t:number)=>t*t, easeOut:(t:number)=>1-(1-t)*(1-t),
  easeInOut:(t:number)=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,
};
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const lngToX=(lng:number)=>(lng+180)/360;
const latToY=(lat:number)=>{const s=Math.sin(lat*Math.PI/180);return .5-Math.log((1+s)/(1-s))/(4*Math.PI);};
const xToLng=(x:number)=>x*360-180;
const yToLat=(y:number)=>{const n=Math.PI-2*Math.PI*y;return 180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n)));};
const lerpAngle=(a:number,b:number,t:number)=>a+(((b-a+540)%360)-180)*t;
const zoomProgress=(z0:number,z1:number,z:number)=>{const dz=z0-z1;return Math.abs(dz)<1e-6?null:(Math.pow(2,z0-z)-1)/(Math.pow(2,dz)-1);};
function segProgress(k0:CamKey,k1:CamKey,t:number){
  const len=k1.t-k0.t||1, a=t-k0.t;
  const hold=clamp(k1.hold??0,0,Math.max(0,len-.1));
  const trans=k1.transDur!=null?clamp(k1.transDur,.1,Math.max(.1,len-hold)):Math.max(.1,len-hold);
  const p=a<=hold?0:a>=hold+trans?1:(a-hold)/trans;
  return (EASE[k1.ease??'easeInOut']||EASE.easeInOut)(p);
}
export function cameraAt(keys:CamKey[],t:number,zoomOffset=0){
  if(!keys.length) return null;
  const last=keys[keys.length-1];
  let n:{center:[number,number];zoom:number;bearing:number;pitch:number};
  if(t<=keys[0].t) n=keys[0]; else if(t>=last.t) n=last; else {
    let k0=keys[0],k1=keys[1];
    for(let i=0;i<keys.length-1;i++){ if(t>=keys[i].t&&t<=keys[i+1].t){k0=keys[i];k1=keys[i+1];break;} }
    const p=segProgress(k0,k1,t);
    const zoom=lerp(k0.zoom,k1.zoom,p);
    const s=zoomProgress(k0.zoom,k1.zoom,zoom)??p;   // tâm chạy theo tiến độ zoom → tốc độ màn hình đều
    n={ center:[xToLng(lerp(lngToX(k0.center[0]),lngToX(k1.center[0]),s)),
                yToLat(lerp(latToY(k0.center[1]),latToY(k1.center[1]),s))],
        zoom, bearing:lerpAngle(k0.bearing,k1.bearing,p), pitch:lerp(k0.pitch,k1.pitch,p) };
  }
  return { center:n.center, zoom:n.zoom+zoomOffset, bearing:n.bearing, pitch:n.pitch };
}
// dùng khi render: map.jumpTo(cameraAt(kf, t, isExporting ? Math.log2(exportW/previewW) : 0)); rồi cập nhật 3D-theo-zoom
```

## Phụ lục B — Bộ mã lõi render 3D dài (đã type-check với maplibre-gl@4.7.1 + mp4-muxer@5.2.2 + webm-muxer@5.1.4)

### B.1 Chờ khung bằng sự kiện (thay pixel-diff)
```ts
// ---------- 1. Chờ bản đồ "ổn định" cho một khung (deterministic) ----------
export function waitMapSettled(map: MLMap, maxWaitMs = 900): Promise<boolean> {
  return new Promise(resolve => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return; done = true;
      clearTimeout(timer); map.off('render', onRender); map.off('idle', onIdle); resolve(ok);
    };
    const onRender = () => { if (map.areTilesLoaded() && map.isStyleLoaded()) finish(true); };
    const onIdle = () => finish(map.areTilesLoaded());
    const timer = setTimeout(() => finish(false), maxWaitMs);
    map.on('render', onRender);
    map.once('idle', onIdle);
    map.triggerRepaint();
  });
}

// ---------- 2. Render một khung với retry thích ứng ----------
export type FrameStats = { slow: number; missing: number };
export async function settleFrame(map: MLMap, stats: FrameStats, firstWait = 900, retryWait = 2500) {
  let ok = await waitMapSettled(map, firstWait);
  if (!ok) { stats.slow++; ok = await waitMapSettled(map, retryWait); }
  if (!ok) stats.missing++;
  return ok;
}

```

### B.2 Prefetch dọc đường camera (kể cả DEM)
```ts
// ---------- 3. Prefetch tile (kể cả DEM) dọc đường camera ----------
export async function warmTiles(map: MLMap, applyCamera: (t: number) => void, duration: number, onStatus?: (s: string) => void) {
  const n = Math.min(60, Math.max(8, Math.round(duration * 2)));
  for (let i = 0; i <= n; i++) {
    applyCamera((i / n) * duration);
    await waitMapSettled(map, 800);
    onStatus?.(`Đang tải bản đồ… ${Math.round((i / n) * 100)}%`);
  }
}

```

### B.3 Protocol tile có retry + Cache API (chống tile 5xx làm thủng khung, render lại tức thời)
```ts
// ---------- 4. Protocol tile có retry + cache (Cache API) ----------
export function registerCachedProtocol(cacheName = 'tiles-v1') {
  addProtocol('cached', async (params, abortController) => {
    const url = params.url.replace(/^cached:\/\//, '');
    const cache = typeof caches !== 'undefined' ? await caches.open(cacheName) : null;
    const hit = cache ? await cache.match(url) : null;
    if (hit) return { data: await hit.arrayBuffer() };
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(url, { signal: abortController.signal });
        if (res.status === 204 || res.status === 404) return { data: new ArrayBuffer(0) };
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (cache) cache.put(url, res.clone()).catch(() => {});
        return { data: await res.arrayBuffer() };
      } catch (e) {
        lastErr = e;
        if (abortController.signal.aborted) throw e;
        await new Promise(r => setTimeout(r, 250 * Math.pow(2, attempt)));
      }
    }
    throw lastErr;
  });
}
// dùng: tiles: ['cached://https://tiles.versatiles.org/tiles/satellite/{z}/{x}/{y}']

```

### B.4 — xem Phụ lục A (camera.ts)

### B.5 Địa hình + camera "vật lý" bay quanh lô trên địa hình
```ts
// ---------- 5. Địa hình 3D ----------
export function enableTerrain(map: MLMap, demTiles: string[], exaggeration = 1.3) {
  if (!map.getSource('dem')) {
    map.addSource('dem', { type: 'raster-dem', tiles: demTiles, encoding: 'terrarium', tileSize: 256, maxzoom: 12 });
  }
  map.setTerrain({ source: 'dem', exaggeration });
  map.setMaxPitch(70);
}
export function disableTerrain(map: MLMap) { map.setTerrain(null); }

// ---------- 6. Camera 3D "vật lý": đặt vị trí camera (lng, lat, cao độ m) nhìn về mục tiêu ----------
export function cameraFromTo(map: MLMap, from: LngLatLike, altitudeM: number, to: LngLatLike, targetAltitudeM?: number): CameraOptions {
  const f = maplibregl.LngLat.convert(from), t = maplibregl.LngLat.convert(to);
  return map.calculateCameraOptionsFromTo(f, altitudeM, t, targetAltitudeM);
}
// Quỹ đạo bay vòng quanh lô đất: góc theta (độ) quay đều, bán kính r (m), cao h (m)
export function orbitCamera(map: MLMap, center: [number, number], radiusM: number, heightM: number, thetaDeg: number): CameraOptions {
  const R = 6378137;
  const dLat = (radiusM * Math.cos((thetaDeg * Math.PI) / 180)) / R * (180 / Math.PI);
  const dLng = (radiusM * Math.sin((thetaDeg * Math.PI) / 180)) / (R * Math.cos((center[1] * Math.PI) / 180)) * (180 / Math.PI);
  const groundAtTarget = map.queryTerrainElevation(center) ?? 0;
  const from: [number, number] = [center[0] + dLng, center[1] + dLat];
  const groundAtCam = map.queryTerrainElevation(from) ?? 0;
  const camAlt = Math.max(groundAtCam + 50, groundAtTarget + heightM); // không bao giờ chui xuống đất
  return cameraFromTo(map, from, camAlt, center, groundAtTarget);
}

```

### B.6 Muxer cho video dài (ghi thẳng đĩa / stream, không ôm cả file trong RAM)
```ts
// ---------- 7. Muxer ghi thẳng ra ổ đĩa cho video dài ----------
export async function makeDiskMuxer(dirHandle: FileSystemDirectoryHandle, fileName: string, opts: { w: number; h: number; fps: number; totalFrames: number; audioChunks?: number; audio?: boolean }) {
  const fh = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  const target = new FileSystemWritableFileStreamTarget(writable);
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: opts.w, height: opts.h, frameRate: opts.fps },
    ...(opts.audio ? { audio: { codec: 'aac', sampleRate: 48000, numberOfChannels: 2 } } : {}),
    // biết trước số chunk ⇒ chừa chỗ cho moov ở đầu file, không cần giữ cả video trong RAM
    fastStart: { expectedVideoChunks: opts.totalFrames, expectedAudioChunks: opts.audioChunks ?? 0 },
  });
  return { muxer, finish: async () => { muxer.finalize(); await writable.close(); } };
}
// Fallback không có thư mục: StreamTarget chunked → gom Blob parts (vẫn ít RAM hơn ArrayBufferTarget)
export function makeStreamMuxer(opts: { w: number; h: number; fps: number; audio?: boolean }) {
  const parts: { pos: number; data: Uint8Array }[] = [];
  const target = new StreamTarget({ onData: (data, position) => { parts.push({ pos: position, data: new Uint8Array(data) }); }, chunked: true, chunkSize: 4 * 1024 * 1024 });
  const muxer = new Muxer({ target, video: { codec: 'avc', width: opts.w, height: opts.h, frameRate: opts.fps }, ...(opts.audio ? { audio: { codec: 'aac', sampleRate: 48000, numberOfChannels: 2 } } : {}), fastStart: 'fragmented' });
  return { muxer, parts };
}
export function unusedAB() { return new ArrayBufferTarget(); }

```

### B.7 Mất WebGL context
```ts
// ---------- 8. Mất WebGL context ----------
export function guardContextLoss(map: MLMap, onLost: () => void, onRestored: () => void) {
  const c = map.getCanvas();
  c.addEventListener('webglcontextlost', e => { e.preventDefault(); onLost(); });
  c.addEventListener('webglcontextrestored', () => onRestored());
}
```

### B.8 Khung xuất WebCodecs chuẩn (chọn codec → vòng khung → audio → finalize)
```ts
import * as MP4 from 'mp4-muxer';
import * as WEBM from 'webm-muxer';

const H264 = ['avc1.640033','avc1.64002A','avc1.640028','avc1.4D0028','avc1.42E01E'];
const VP9  = ['vp09.00.51.08','vp09.00.41.08','vp09.00.31.08'];
export async function pickCodec(w:number,h:number,fps:number){
  const bitrate = Math.round(w*h*fps*0.09) + 2_000_000;
  for (const codec of H264){
    const r = await VideoEncoder.isConfigSupported({codec,width:w,height:h,bitrate,framerate:fps}).catch(()=>null);
    if (r?.supported) return {container:'mp4' as const, codec, bitrate};
  }
  for (const codec of VP9){
    const r = await VideoEncoder.isConfigSupported({codec,width:w,height:h,bitrate,framerate:fps}).catch(()=>null);
    if (r?.supported) return {container:'webm' as const, codec, bitrate};
  }
  return null;
}
export async function pickAudioCodec(container:'mp4'|'webm'){
  if (container==='mp4'){
    const r = await AudioEncoder.isConfigSupported({codec:'mp4a.40.2',sampleRate:48000,numberOfChannels:2,bitrate:128_000}).catch(()=>null);
    if (r?.supported) return {codec:'mp4a.40.2', muxCodec:'aac' as const};
  }
  return {codec:'opus', muxCodec:'opus' as const};
}
async function muxAudio(muxer:any, audio:AudioBuffer, codec:string, onProgress?:(p:number,msg:string)=>void){
  let err:Error|null=null;
  const enc = new AudioEncoder({ output:(c,m)=>muxer.addAudioChunk(c,m), error:e=>{err=e} });
  enc.configure({codec, sampleRate:48000, numberOfChannels:2, bitrate:128_000});
  const N=1024, ch=2, total=audio.length;
  for (let i=0;i<total;i+=N){
    const n=Math.min(N,total-i);
    const data=new Float32Array(n*ch);
    for (let c=0;c<ch;c++) data.set(audio.getChannelData(Math.min(c,audio.numberOfChannels-1)).subarray(i,i+n), c*n);
    const ad=new AudioData({format:'f32-planar', sampleRate:48000, numberOfFrames:n, numberOfChannels:ch, timestamp:Math.round(i/48000*1e6), data});
    enc.encode(ad); ad.close();
    if (err) throw err;
    onProgress?.(i/total, 'Đang ghép âm thanh…');
  }
  await enc.flush(); enc.close();
}
export async function exportVideo(opts:{w:number;h:number;fps:number;duration:number;renderAt:(t:number)=>Promise<HTMLCanvasElement>;audio?:AudioBuffer;onProgress?:(p:number,msg:string)=>void}){
  const {w,h,fps,duration,renderAt,audio,onProgress} = opts;
  const cfg = await pickCodec(w,h,fps); if(!cfg) throw new Error('NO_WEBCODECS');
  const aud = audio ? await pickAudioCodec(cfg.container) : null;
  const isMp4 = cfg.container==='mp4';
  const target = isMp4 ? new MP4.ArrayBufferTarget() : new WEBM.ArrayBufferTarget();
  const muxer:any = isMp4
    ? new MP4.Muxer({ target: target as MP4.ArrayBufferTarget, video:{codec:'avc', width:w, height:h, frameRate:fps},
        ...(aud ? {audio:{codec:aud.muxCodec, sampleRate:48000, numberOfChannels:2}} : {}), fastStart:'in-memory' })
    : new WEBM.Muxer({ target: target as WEBM.ArrayBufferTarget, video:{codec:'V_VP9', width:w, height:h, frameRate:fps},
        ...(aud ? {audio:{codec:'A_OPUS', sampleRate:48000, numberOfChannels:2}} : {}) });
  let err:Error|null=null;
  const enc = new VideoEncoder({ output:(c,m)=>muxer.addVideoChunk(c,m), error:e=>{err=e} });
  enc.configure({codec:cfg.codec,width:w,height:h,bitrate:cfg.bitrate,framerate:fps,latencyMode:'quality'});
  const frames = Math.round(duration*fps), us = 1e6/fps;
  for (let m=0;m<frames;m++){
    if (err) throw err;
    const canvas = await renderAt(m/fps);
    const frame = new VideoFrame(canvas,{timestamp:Math.round(m*us),duration:Math.round(us)});
    enc.encode(frame,{keyFrame: m % (fps*2) === 0}); frame.close();
    while (enc.encodeQueueSize > 8) await new Promise(r=>setTimeout(r,4));
    onProgress?.((m+1)/frames, `Đang kết xuất khung ${m+1}/${frames}`);
  }
  await enc.flush(); enc.close();
  if (audio && aud) await muxAudio(muxer, audio, aud.codec, onProgress);
  muxer.finalize();
  return new Blob([(target as any).buffer],{type: isMp4 ? 'video/mp4' : 'video/webm'});
}
```

## Phụ lục C — Nhật ký bằng chứng
- mapeffect: `/edit` (đăng nhập cuonganh365, gói MIỄN PHÍ); xuất thử 1 lượt 23/08/2026 (Dự-án-mới-720p.mp4, 852.600 B — phân tích box MP4 trong trang, KHÔNG tải file về máy); `/api/config`, `/api/me`, `/api/export/authorize|commit`, `/api/projects`, `/api/geocode`, `/api/route`, `/api/sfx`; bundle `/js/main-O43QJZ2N.js`, `/js/c-CMBJXHNY.js` (editor 414 KB — layer defs, neon, nhãn, 3D, camera), `/js/c-TRAEDDWD.js` (export 60 KB — `uo/co/ho/oo/ao/io/fo/so`), `/vendor/maplibre-gl.js` (4.7.1), `/vendor/{mp4,webm}-muxer.js`, 20 module `*-canvas-*.js`, `mobile-QY5KWPII.js`; assets `vn-xa-khanh-hoa.geojson`, `vn-diadanh-index.json`, `objects/*.png`; tiles: versatiles satellite/elevation, openfreemap styles/planet/fonts/natural_earth, arcgisonline World_Imagery; trang /thanh-toan /hoan-tien /dieu-khoan; playlist YouTube "Hướng dẫn sử dụng Map Effect từ A-Z" (4 video); Telegram @mapeffect.
- Cam Lâm Land: `/tao-video-ban-do` (đăng nhập Admin); đã đọc toàn bộ panel trái (20 mục); chạy thử "Quay & xuất MP4" 8 s·1080p30·Render kỹ·3D Tự động → >210 s rồi treo khi tab mất focus (không tiến độ/không huỷ) — chặn blob sẵn nhưng chưa nhận được file; bundle `app/tao-video-ban-do/page-*.js` (488 KB — hàm chờ `ch`/`cu` pixel-diff timeout 3/8/9 s ×2, GPU tier "manh/vua/yeu", codec avc1.4D0032/640032/42E032 × prefer-hardware, latencyMode quality, keyFrame 2 s, encodeQueueSize>2, import esm.sh/mp4-muxer@5.2.1, showSaveFilePicker, kiểm khổ chẵn, fadeDuration:0 + raster-fade-duration:0 ×14, elevation qua `/api/do-cao`); network: nominatim polygon_geojson trực tiếp, arcgisonline World_Imagery + Reference labels, EOX s2cloudless-2024.
- Số chưa xác minh (ghi để kiểm sau): giá trị `ld`/`eh` (maxZoom 3D/2D của mapeffect); engine routing của camlamgis; bitrate formula của camlamgis.
