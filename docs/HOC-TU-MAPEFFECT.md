# Học từ MapEffect.app — áp dụng cho trang "Tạo video bản đồ"

*Ghi lại sau khi vào tận nơi bấm thử toàn bộ trình chỉnh sửa của họ (mapeffect.app/edit), đọc hết trang
hướng dẫn (mapeffect.app/huong-dan) và soi các file dữ liệu mà trang web của họ tải về.*

---

## 1. Họ là ai, làm gì

Cùng một nghề với mình: **web tạo video bản đồ cho môi giới bất động sản Việt Nam**, chạy hoàn toàn trong
trình duyệt, không cài phần mềm. Giao diện tiếng Việt, khách hàng chính là môi giới đất nền + người làm
nội dung TikTok.

**Cách bán:** 3 video miễn phí (720p, đóng dấu logo giữa khung) → gói PRO 149k/tháng (30 video, Full HD,
không logo) → PRO MAX 249k/tháng (60 video, 2K) → gói Nhóm 2–10 người. Ngoài ra **bán lượt lẻ từ 10.000đ
cho video ≤10 giây, quá 10 giây cộng 1.000đ mỗi giây**.

Ba điểm về cách bán đáng học ngay:

- **Không bắt đăng nhập khi dựng.** Chỉ tới lúc bấm Xuất mới hỏi tài khoản. Người ta nghịch thoải mái,
  làm xong mới thấy tiếc mà trả tiền.
- **Chỉ trừ lượt khi video đã tải về xong.** Huỷ giữa chừng, mất mạng, lỗi — không mất lượt. Ghi rõ điều
  này ở nhiều chỗ để người dùng yên tâm bấm.
- **Gói không tự động gia hạn.** Nói thẳng ra là điểm bán hàng.

---

## 2. Bố cục màn hình của họ (và tại sao nó dễ hiểu)

Chia đúng **5 khu**, không hơn:

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Thanh trên: khổ ngang/dọc/vuông · Bản đồ|Media|Nền ·      │
│    Mới · Lưu · Đám mây · Mở · [Xuất video]                   │
├──────┬──────────────────────────────┬────────────────────────┤
│ 2.   │ 3. Bảng thuộc tính của lớp   │ 4. Khung xem trước     │
│ Cột  │    đang chọn                 │    (đúng bằng khung    │
│ công │    (rỗng thì hiện: "Chọn một │     video sẽ xuất ra)  │
│ cụ   │     lớp để chỉnh thuộc tính")│                        │
├──────┴──────────────────────────────┤                        │
│ 5. Timeline & Lớp                   │  ▶ 0.0 / 12.0s         │
└─────────────────────────────────────┴────────────────────────┘
```

Khác mình chỗ nào: **khung xem trước của họ nằm bên phải và luôn cố định**, còn bảng thuộc tính chiếm
cả vùng giữa. Họ tuyên bố trong hướng dẫn: *"Khung xem trước là bản thật. App được làm để bản xuất ra
trùng khít với cái bạn đang nhìn. Nếu thấy khác, đó là lỗi, hãy báo cho chúng tôi."* — Đây là lời hứa
rất mạnh và là thứ người dùng sợ nhất khi dựng video.

Một chi tiết nhỏ mà hay: khi chưa chọn lớp nào, vùng thuộc tính không để trống mà hiện dòng chỉ dẫn
**"Chọn một lớp để chỉnh thuộc tính — hoặc chọn công cụ bên trái để thêm mới"**.

---

## 3. Bộ công cụ của họ — 13 nút, mỗi nút một phím tắt

| Công cụ | Phím | Làm gì |
|---|---|---|
| Chọn | V | Chọn, di chuyển, đổi cỡ |
| **Khoanh vùng** | P | Khoanh lô đất. Có **6 kiểu**: Đa giác, Chữ nhật, Vuông, Tròn, Vẽ tay, Pen tool |
| **Tìm vùng** | | **Gõ tên xã/phường/tỉnh → tự khoanh đúng ranh giới hành chính.** Hoặc nhấp thẳng lên bản đồ: zoom xa thì chọn tỉnh, zoom gần thì chọn xã/phường |
| Vùng | G | Làm sáng cả một khu rộng |
| Đường | R | Vẽ tuyến chạy dần, đặt được tốc độ + hiện số km |
| **Chọn đường** | | **Nhấp điểm A rồi điểm B → tự tìm đường đi thật** theo Ô tô / Xe máy / Đi bộ (dữ liệu OpenStreetMap) |
| **Thêm File** | | Nhập **KML / GeoJSON** |
| Mũi tên | W | Chỉ hướng |
| Chữ | T | Chữ thường, đổi phông/cỡ/màu/viền/bóng |
| **Hiệu ứng chữ** | | **Hơn 50 mẫu chữ động dựng sẵn**, có ô tìm kiếm |
| **Call out** | | Thẻ chú thích **có đường dẫn nối tới một điểm trên bản đồ**, hiện được khoảng cách |
| Tiện ích | E | Thư viện ghim/huy hiệu/radar |
| Media | M | Chèn ảnh, video flycam |
| Âm thanh | A | Nhạc nền + hiệu ứng tiếng |
| Đối tượng | D | Xe, tàu, máy bay… chạy trên bản đồ |
| Biểu đồ | | 8 kiểu biểu đồ động (PRO MAX) |
| Đọc chữ | | Đọc chữ thành giọng nói (PRO MAX) |
| Templates | | Khối giả lập giao diện điện thoại (PRO MAX) |

---

## 4. Những thứ họ có mà mình **chưa có** — xếp theo mức đáng làm

### ⭐⭐⭐ Nhóm 1 — làm được ngay, giá trị cao nhất

**1. "Tìm vùng" — gõ tên xã là tự khoanh ranh giới.**
Đây là thứ ấn tượng nhất của họ. Gõ "Cam Đức" → ranh giới xã tự hiện lên, sáng dần, không phải vẽ tay
một nét nào. Họ tải sẵn 3 file tĩnh: `world-countries.geojson`, `vn-provinces.geojson`,
`vn-province-labels.geojson`.
**Mình có lợi thế hơn họ:** đã có sẵn `apps/frontend/public/ranh-xa.geojson` (ranh giới xã Cam Lâm) —
tức là mình làm được **chi tiết tới cấp xã của Cam Lâm**, còn họ chỉ tới cấp tỉnh cho cả nước. Chỉ cần
thêm ô tìm kiếm + hàm bỏ dấu (đã có sẵn `vnNoAccent()` bên backend) là xong.
Ghi chú của họ đáng chép: *"Không cần gõ chữ 'Phường' hay 'Xã', và không dấu cũng tìm được."*

**2. Chỉ đường A→B thật theo đường bộ.**
Hiện tại mình chỉ vẽ tuyến bằng tay (nhấp từng điểm). Họ cho nhấp 2 điểm rồi tự tìm lộ trình thật theo
Ô tô / Xe máy / Đi bộ. Với video "từ trung tâm Nha Trang tới dự án" thì tuyến thật đẹp và đáng tin hơn
hẳn tuyến vẽ tay. Mình đã có sẵn `roadnet_camlam.json` trong `public/` — hoặc gọi dịch vụ chỉ đường
miễn phí của OSM.

**3. Thư viện hiệu ứng chữ.**
Mình đang có **4** kiểu (mờ dần, trượt lên, đánh máy, không). Họ có **hơn 50**, mỗi mẫu là một ô xem
trước **chạy động ngay trong bảng chọn**, có ô tìm kiếm ("vd: vàng, neon, 3D"), và tên đặt theo đúng
ngữ cảnh bất động sản chứ không phải tên kỹ thuật:
> Dự án hot · Căn hộ cao cấp · Định vị ghim bản đồ · Chữ vàng kim · Neon xanh lơ · Thẻ kính mờ ·
> Hai dòng tạp chí · Vàng 24K · Mở Bán…

Đây là thứ khách hàng nhìn thấy đầu tiên và cảm nhận "app này xịn". Không cần 50 — làm 15–20 mẫu tốt là
đã hơn hẳn hiện tại.

**4. Call out (thẻ chú thích có dây nối).**
Thẻ chữ đặt ở chỗ trống, có **một sợi dây nối tới đúng điểm trên bản đồ**, kèm khoảng cách ("500m").
Đây chính là thứ mọi video BĐS đều cần: "Trường tiểu học — 500m", "Bãi biển — 1,2km". Họ có sẵn nhiều
kiểu dây: Gấp khúc cơ bản, Gạch chân dưới chữ, Ngoặc vuông bao chữ, Thanh viên thuốc, Nét đứt chạy,
Sóng lan tại điểm neo.
Mình đã có "điểm nhấn (POI)" và có hàm đo khoảng cách rồi — chỉ thiếu phần vẽ dây + thẻ.

**5. Bảng thuộc tính của lớp phải giàu hơn.**
Đây là bảng thuộc tính của **một lớp khoanh vùng** bên họ:

```
Tên lớp
Bắt đầu (s)          Kết thúc (s)
Màu nền              [10 ô màu bấm nhanh]
Độ đậm nền           ━━━━●━━━━━━ 0.28
Độ dày viền          ━━●━━━━━━━━ 3
Kiểu viền            [Liền] [Nét đứt]
Màu viền             [10 ô màu bấm nhanh]
Hiệu ứng             [Vẽ viền] [Nhấp nháy] [Hiện dần] [3D nổi khối]
Thời gian hiệu ứng   ━━━●━━━━━━━ 1.2
Hiệu ứng kết thúc    [Không] [Mờ dần] [Xoá dần] [Thu nhỏ] [Loé rồi tắt]
Thời gian kết thúc   ━━●━━━━━━━━ 0.8
Viền phát sáng (neon)                          [Tắt]
Đốm sáng chạy viền                             [Tắt]
Hiệu ứng đặc biệt    [Không] [🔥 Lửa] [✨ Tia lửa] [💨 Khói]
Cường độ hiệu ứng    ━━━━●━━━━━━ 1
        [ + Thêm ảnh / video vào vùng ]
        [ Đưa camera tới ]
        [ Xoá lớp ]
```

Ba dòng đáng chú ý nhất:
- **"Thêm ảnh/video vào vùng"** — dán ảnh phối cảnh dự án vào **bên trong ranh lô đất**. Rất mạnh cho BĐS.
- **"Đưa camera tới"** — một nút, camera tự bay tới lớp này. Người mới đỡ phải vật lộn với keyframe.
- **"3D nổi khối"** — dựng lô đất thành khối 3D nổi lên khỏi mặt đất.

### ⭐⭐ Nhóm 2 — đáng làm sau

**6. Thư viện ghim & tiện ích.** Bên họ chia nhóm rõ ràng:
> Icon động (21 icon có chuyển động) · Huy hiệu có tên (12 icon kèm khung chữ, tự chạy) ·
> Giọt nước sang (19 icon trong vỏ giọt kim loại, 4 tông màu) · Radar (4 kiểu vùng phủ, ghim vào bản đồ) ·
> Ghim ô kính (14 ghim bất động sản, 4 tông màu) · Callout vàng · Ghim giọt nước · Nền đen viền vàng

**7. Đối tượng chuyển động.** Xe con, xe khách, xe máy giao hàng, máy xúc, tàu cao tốc, tàu hoả, tàu
container, du thuyền, máy bay, cờ quốc gia, con người… chạy dọc theo tuyến đường đã vẽ.

**8. Chế độ "Media" và "Nền động".** Ngoài chế độ Bản đồ, họ có 2 chế độ nữa:
- **Media** — đoạn không có bản đồ: ảnh phối cảnh, video flycam, bảng giá, thông tin pháp lý. Dùng làm
  mở đầu/kết thúc.
- **Nền** — nền cho các đoạn Media: Màu trơn, Giấy đỏ trời, **Bình độ** (đường đồng mức), Lụa gấp,
  Lưới neon đỏ ∞, Lưới neon xanh ∞, Mưa tàn lửa ∞, Báo cũ.

**9. Thư viện âm thanh phân loại sẵn.** Họ có sẵn hàng trăm hiệu ứng tiếng, chia nhóm và **đếm số lượng
ngay trên nhãn**: Appear & Disappear 81 · Bell 23 · Click digital 20 · Futuristic 27 · GLEAM 12 ·
Glitch 111 · Highlight 15 · Magic 3 · Paper 12 · Pop 19 · Riser 7 · Robot Máy móc 11 · Sine 25 ·
Spin 34 · Swipe & Swish 62. Có ô tìm kiếm + nút "Tải lên âm thanh của bạn".
Mình mới có "chọn 1 file nhạc nền" + thu giọng đọc.

**10. Menu chuột phải trên clip timeline:**
> Cắt tại playhead · Đưa clip về playhead · Bắt đầu tại playhead · Kết thúc tại playhead ·
> Đưa lên trên · Đưa xuống dưới · Sao chép · Dán · Nhân đôi lớp · **Khoá lớp** · Xoá lớp

**11. Bảng điều khiển bản đồ gọn:** Vệ tinh / Đường / Chi tiết · **2D / 3D** · Tên địa danh Bật/Tắt ·
thanh trượt **Xoay** và **Nghiêng** (hiện số độ) · nút **"Đặt lại góc nhìn"**.
Cái nút "Đặt lại góc nhìn" nhỏ xíu nhưng cứu người dùng rất nhiều lần.

**12. ~~Nhập file KML/GeoJSON~~ — mình ĐÃ CÓ SẴN** (nút “📂 Nhập KML/KMZ”, đọc được cả .kmz nén). Bỏ qua.

### ⭐ Nhóm 3 — làm nếu rảnh

**13. Biểu đồ động.** 8 kiểu: Cột nhấn, Cột chồng, Đường, Tròn/Vành, Vòng tỉ lệ, Sơ đồ tổ chức, Lịch
tháng, Đường phát triển. Có bảng nhập số liệu + nút **"Dán từ Excel"**, chọn chủ đề Tối/Sáng, nền Mờ.
Điểm tinh tế: **ô xem trước trong hộp thoại chạy đúng như khi đã nằm trên dòng thời gian**, có thanh
trượt thời gian riêng và ghi rõ "Giây 0,4 — chạy đúng như khi đã nằm trên dòng thời gian".

**14. Templates giả lập điện thoại.** Thông báo iOS, Thông báo điện thoại (màn khoá), Khung chat điện
thoại (hội thoại hiện dần từng câu), Trang cá nhân Instagram. Hợp trend TikTok.

**15. Đọc chữ thành giọng nói.** Gõ lời thoại → máy đọc, khỏi thu âm.

**16. Lưu / Mở dự án.** Hai đường: **tải file dự án về máy** (không cần tài khoản) và **lưu lên đám mây**
(cần đăng nhập). Họ nói rõ: *"Tệp dự án chỉ ghi lại cách dựng, không ghi video. Nên tệp rất nhẹ."*

**17. Giao diện điện thoại riêng.** Công cụ gom xuống thanh dưới, bảng thuộc tính và timeline thành hai
thẻ bấm qua lại.

---

## 5. Mấy thứ mình đang làm **tốt hơn** họ

Đừng copy mù. Những chỗ này giữ nguyên:

| Mình | Họ |
|---|---|
| **Ảnh vệ tinh Esri World Imagery** — nét hơn ở zoom cao | **Sentinel-2 Global Mosaic** — độ phân giải 10m, phóng gần là mờ |
| **6 kịch bản dựng sẵn** (Vị trí · Hạ tầng · Tiện ích · Đầu tư · Bán hàng · Dẫn đường) — 1 dự án ra 6 video | Không có. Người dùng phải tự nghĩ kịch bản |
| **17 kiểu chuyển động camera đặt tên sẵn** (Flycam xoay 360°, Xoáy ốc bay vào, Cần cẩu nâng, Lướt thấp sát mặt, Điện ảnh chậm, Sôi động bùng nổ, Boomerang…) | Chỉ có keyframe thủ công. Hướng dẫn của họ phải viết cả một mục dài dạy cách đặt keyframe |
| **Tự sinh lời thoại theo kịch bản** + nhập phụ đề SRT/VTT | Không có |
| **9 mẫu BĐS 1 chạm** — bấm 1 cái là set xong bố cục + khổ + hiệu ứng + camera + lời thoại | Không có |
| **Xuất cả bộ ra ZIP** | Xuất từng video |
| **Thu giọng đọc ngay trong app** + tự trộn nhạc nền (hạ nhạc khi có giọng) | Chỉ có nhạc nền |
| **Dữ liệu quy hoạch thật của Cam Lâm** (qh_zones, tile QĐ205, ranh xã) | Không có |
| Xuất MP4 **hoàn toàn trên máy khách** | Cũng vậy |

Nói cách khác: **mình mạnh về "biết trước người dùng muốn gì" (kịch bản, mẫu, camera đặt tên sẵn), họ
mạnh về "kho vật liệu" (chữ động, ghim, âm thanh, đối tượng) và độ trau chuốt của bảng thuộc tính.**

---

## 6. Đề xuất thứ tự làm

**Đợt 1 — 5 việc, đổi đời trang video:**
1. Tìm vùng theo tên xã/phường (dùng `ranh-xa.geojson` sẵn có)
2. Call out có dây nối + khoảng cách
3. Thư viện hiệu ứng chữ 15–20 mẫu, có ô xem trước chạy động
4. Bảng thuộc tính lớp giàu hơn: viền neon, đốm sáng chạy viền, hiệu ứng kết thúc, nút "Đưa camera tới"
5. Chỉ đường A→B thật theo đường bộ

**Đợt 2:**
6. Thư viện ghim/huy hiệu/radar chia nhóm
7. Thêm ảnh/video vào trong ranh vùng
8. Chế độ Media + nền động (mở đầu / kết thúc video)
9. Thư viện hiệu ứng tiếng phân loại
10. Menu chuột phải trên clip + khoá lớp

**Đợt 3:**
11. Đối tượng chuyển động chạy theo tuyến
12. Lưu/mở file dự án
13. Nhập KML/GeoJSON
14. Giao diện điện thoại

---

## 7. Ba câu chữ của họ đáng chép nguyên văn về dùng

Cách họ viết cho người không rành máy tính rất tốt, nên học:

> **Về keyframe:** "Keyframe là một cái ảnh chụp góc nhìn. Nó ghi lại: bản đồ đang ở đâu, phóng to cỡ
> nào, xoay bao nhiêu, nghiêng bao nhiêu — tại đúng một mốc thời gian. Đặt hai keyframe khác nhau, app
> tự tính toàn bộ đoạn chuyển động ở giữa."
>
> "Muốn dừng lại ngắm một chỗ? Đặt hai keyframe giống hệt nhau cách nhau vài giây."
>
> "Đừng đặt quá nhiều keyframe. Ba tới năm mốc cho một video là đủ. Nhiều quá thì camera giật cục,
> người xem chóng mặt."

> **Về chọn khổ:** "Làm việc này đầu tiên, trước khi thêm bất cứ thứ gì. Đổi tỉ lệ giữa chừng thì chữ
> và đối tượng phải xếp lại từ đầu."

> **Về xem trước:** "Khung xem trước là bản thật. Nếu thấy khác, đó là lỗi, hãy báo cho chúng tôi."

---

## 8. Ghi chú kỹ thuật

- Nền bản đồ của họ: **VersaTiles** (bản đồ đường mã nguồn mở) + **Sentinel-2 Global Mosaic** (ảnh vệ
  tinh miễn phí của châu Âu). Chọn nguồn mở là để **quay video không vướng điều khoản sử dụng**. Mình
  dùng Esri World Imagery — đẹp hơn nhưng nên đọc lại điều khoản của Esri về việc dùng ảnh trong video
  thương mại, kẻo về sau rắc rối. Đây là rủi ro nên kiểm tra sớm.
- Dữ liệu ranh giới họ để dạng file tĩnh trong `/assets/` — nhẹ, tải một lần, không cần máy chủ.
- Icon/đối tượng: ảnh PNG thu nhỏ cho bảng chọn, bản chạy động tải riêng khi dùng.
- Trang hướng dẫn của họ đặt tại `/huong-dan`, viết theo 12 mục, có mục lục nhảy nhanh, kèm video
  YouTube. Mình cũng nên có một trang như vậy cho `/tao-video-ban-do`.
