# Trang “Tạo video bản đồ” — 11 thứ mới vừa thêm

*Học từ mapeffect.app (xem `docs/HOC-TU-MAPEFFECT.md`). Tất cả nằm trong một file:
`apps/frontend/src/app/tao-video-ban-do/page.tsx`. Không đụng tới phần nào khác của web.*

---

## Cách dùng — theo thứ tự bạn sẽ cần

### 1. 🗺 Khoanh vùng xã/phường chỉ bằng cách gõ tên
Gõ **Cam Đức** vào ô tìm kiếm rồi bấm nút xanh **🗺 Khoanh vùng**.
Ranh giới xã tự hiện lên, không phải vẽ tay nét nào. Không cần gõ chữ “Xã”, không dấu cũng được.
Khoanh được nhiều vùng một lúc. Chỉnh độ đậm và xoá ở bảng bên phải, mục **🗺 Vùng đã khoanh**.

> Lấy ranh giới thật từ OpenStreetMap nên phủ cả nước, không riêng Cam Lâm.

### 2. 🚗 Chỉ đường A→B theo đường bộ thật
Bấm nút **🚗 Chỉ đường A→B**, rồi bấm **điểm đi**, bấm **điểm đến**.
Máy tự lấy lộ trình thật (đúng theo đường sá), báo luôn *bao nhiêu km, chạy xe mất mấy phút*.
Tuyến này chạy dần trong video y như tuyến vẽ tay.

### 3. 💬 Thẻ chú thích có dây nối + khoảng cách
Bấm **💬 Thẻ chú thích**, chọn sẵn nội dung (Trường học, Chợ, Bãi biển…), rồi nhấp vào đúng chỗ đó trên
bản đồ. Thẻ hiện ra kèm **một sợi dây nối tới điểm** và **khoảng cách tính từ lô đất** — ví dụ
“Trường học · 500m”.

- Đổi màu thẻ: Vàng / Trắng / Xanh / Đỏ.
- Dời thẻ: chuyển sang **✎ Sửa đỉnh** rồi kéo thẻ, hoặc dùng 4 nút mũi tên trong bảng bên phải.
- Bỏ tích “kèm khoảng cách” nếu chỉ muốn chữ.

### 4. ✨ 12 hiệu ứng chữ (trước chỉ có 4)
Ở mục **✨ Chữ hiện** chọn:
Mờ dần · Trượt lên · **Trượt từ trái** · Đánh máy · **Lộ dần từ trái** · **Phóng vào** · **Đóng dấu** ·
**✨ Chữ vàng kim** · **💡 Neon phát sáng** · **🧊 Thẻ kính mờ** · **🌟 Quét sáng ngang** · Không.

Bốn kiểu chạy chậm (đánh máy, lộ dần, quét sáng, đóng dấu) tự kéo dài 1,4 giây cho nhìn rõ.

### 5. 📍 Ghim đẹp hơn: ghim giọt nước & radar
Khi bấm **📍 Điểm nhấn**, chọn thêm **Kiểu ghim**:
- **📍 Ghim** — ghim giọt nước cắm xuống đúng điểm (đẹp nhất, mặc định).
- **● Chấm** — như cũ.
- **(( )) Radar** — ba vòng sóng lan toả, hợp để nhấn mạnh cả một khu vực.

Chọn được 5 màu ghim.

### 6. 🖼 Dán ảnh phối cảnh vào trong lô đất
Bảng bên phải → **✨ Hiệu ứng lô đất** → **🖼 Thêm ảnh vào lô**.
Ảnh phối cảnh / mặt bằng phân lô phủ đúng khu vực lô đất, chỉnh được độ rõ.
Cắt ảnh cho vuông vắn trước khi tải lên thì khớp đẹp hơn.

### 7. 🧊 3D nổi khối + ✨ đốm sáng chạy viền
Cùng mục **✨ Hiệu ứng lô đất**:
- **Đốm sáng chạy viền** — một chấm sáng chạy vòng quanh ranh lô, 3 giây một vòng.
- **3D nổi khối** — dựng lô đất thành khối nổi lên. Chỉ thấy rõ khi camera nghiêng, nên chọn kiểu
  camera có nghiêng (vd “🎬 Flycam xoay 360°”).
- **🎯 Đưa camera tới lô đất** — một nút, camera bay thẳng tới lô.

### 8. 🎬 Màn mở đầu & màn kết thúc (không có bản đồ)
Bảng bên phải → **🎬 Mở đầu & Kết thúc**. Bật lên, đặt số giây, gõ chữ, chọn nền:
**Xanh đêm · Vàng sang · Lưới neon · Bình độ · Giấy cũ · Đen trơn** — các nền đều **chuyển động**.
Thêm được ảnh nền. Dùng để mở màn bằng tên dự án và chốt bằng số điện thoại.

> Hai đoạn này nằm *trong* tổng thời lượng. Web tự tính và ghi rõ phần bản đồ còn lại bao nhiêu giây.

### 9. 🔊 Tiếng động — máy tự tạo, không lo bản quyền
Bảng bên phải → **🔊 Tiếng động**. Bấm vào tên tiếng để **nghe thử** (💨 Vút, 🫧 Bụp, 🔘 Tách,
🔔 Leng keng, 📈 Dâng lên, 💥 Uỵch, ✨ Lấp lánh), kéo vạch đứng tới giây muốn có tiếng rồi bấm
**＋ Đặt tiếng tại …s**. Tiếng được trộn thẳng vào video khi xuất.

Không tải file nhạc nào về nên **không dính bản quyền** — máy tự tổng hợp ra âm.

### 10. 🛰 Nền “Vệ tinh (mở)”
Cạnh nút **Vệ tinh** có thêm **Vệ tinh (mở)** — ảnh Sentinel-2 nguồn mở (giống MapEffect dùng).
Không nét bằng ảnh Esri nhưng **yên tâm về bản quyền** khi làm video bán hàng.
Cách chọn: ảnh Esri để xem/tư vấn, ảnh mở khi xuất video chạy quảng cáo.

### 11. Bấm chuột phải trên chữ/ảnh — có thêm 5 lệnh
✂ Cắt tại vạch đứng · → Đưa clip về vạch đứng · ⊢ Bắt đầu tại vạch đứng ·
⊣ Kết thúc tại vạch đứng · 📋 Sao chép (ngoài các lệnh cũ: nhân bản, lên/xuống, khoá, ẩn, xoá).

---

## Bật lên để dùng (làm khi vắng khách, mất khoảng 3–6 phút)

Code mới nằm sẵn trong máy rồi, nhưng web đang chạy **bản đã đóng gói** nên phải đóng gói lại thì mới
thấy. Cách làm:

**Cách dễ:** nháy đúp `QUAN-LY-SERVER.vbs` → bấm **Bảo trì** (bật) → bấm **Bật/Khởi động lại** →
đợi chạy xong → bấm **Bảo trì** (tắt).

**Cách gõ lệnh** (mở PowerShell tại thư mục dự án):

```
docker exec camlam_nginx touch /etc/nginx/maintenance.on
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
docker exec camlam_nginx rm -f /etc/nginx/maintenance.on
```

> Dòng `restart nginx` **đừng bỏ**: mỗi lần dựng lại frontend là nó có địa chỉ mạng mới, nginx còn nhớ
> địa chỉ cũ nên web sẽ lỗi 502 dù frontend vẫn sống.

Xong thì mở `http://localhost/tao-video-ban-do` và thử lần lượt 11 mục ở trên.
**Lưu ý:** các tính năng này chưa được chạy thử trên trình duyệt lần nào — nếu chỗ nào chưa đúng,
cứ chụp màn hình gửi lại.

---

## Ghi chú kỹ thuật (cho lần sau đọc lại code)

- **Mọi thứ vẽ trên bản đồ đều tự vào video.** Vì lúc quay, web chụp thẳng khung bản đồ
  (`ctx.drawImage(mapCanvas, …)`). Nên thẻ chú thích, ghim, vùng, ảnh trong lô… đều làm bằng **lớp
  MapLibre** chứ không vẽ đè bằng HTML — HTML sẽ không vào video.
- **Màn mở đầu/kết thúc** chặn ngay đầu hàm `frame()`: nếu thời điểm đang nằm trong đoạn đó thì vẽ
  nền động + chữ rồi `return` luôn, không vẽ bản đồ.
- **Tiếng động** tạo bằng bộ tổng hợp của trình duyệt (`playSfx`), bắn vào chung đường trộn âm với
  nhạc nền + giọng đọc nên nằm sẵn trong file MP4.
- **Ghim giọt nước** là ảnh do `pinImage()` vẽ bằng canvas rồi nạp vào bản đồ — không cần file ảnh.
- **Ranh giới xã** lấy từ Nominatim (OpenStreetMap) kèm `polygon_geojson=1`.
  File `public/ranh-xa.geojson` sẵn có KHÔNG dùng được cho việc này vì chỉ là các đường ranh, không
  kèm tên xã.
- **Chỉ đường** gọi OSRM công cộng (`router.project-osrm.org`), chỉ có hồ sơ ô tô.
- Mọi thứ mới đều **lưu theo từng kịch bản** và nằm trong tự lưu + hoàn tác (Ctrl+Z) như cũ.

## Còn thiếu so với MapEffect (đợt sau)

Đối tượng chuyển động chạy theo tuyến (xe, máy bay) · Lưu/mở file dự án · Biểu đồ nhiều kiểu +
dán từ Excel · Khối giả lập giao diện điện thoại · Đọc chữ thành giọng nói · Giao diện điện thoại riêng.

---

# ĐỢT 3 — Làm lại giao diện & nâng cấp cho bằng/hơn MapEffect

## A. Giao diện chia 3 khu (trước đây rối nhất chỗ này)

**Trước:** 15 nút dồn một hàng + 16 thẻ trắng xếp chồng ở cột phải, cuộn mãi không hết.
**Giờ:**

| Khu | Nội dung |
|---|---|
| ① Cột trái | 18 ô công cụ chia 5 nhóm: *Vẽ trên bản đồ · Lấy sẵn khỏi vẽ · Đánh dấu tiện ích · Nội dung video · Làm đẹp* |
| ② Cột giữa | **Mỗi lúc chỉ hiện đúng MỘT bảng** — bảng của việc đang làm. Chưa chọn gì thì hiện dòng chỉ dẫn |
| ③ Bên phải | Bản đồ, giờ rộng hơn hẳn vì không còn bị hàng nút chiếm chỗ |

Thanh trên bản đồ rút còn: ↶ ↷ · ⛶ Vừa khung · ↺ Xoá · chọn nền · Nhãn/Khung an toàn/Logo.

## B. 26 mẫu chữ động (trước có 4) — xem trước **chạy thật**

Bấm **✏️ Chữ & lời** → ô xem trước → mở thư viện. Chia 3 nhóm:
- **Xuất hiện:** Mờ dần · Trượt lên · Trượt từ trái · Đánh máy · Lộ dần · Phóng vào · Nảy vào · Xoay vào · Mờ nhoè→nét · Đóng dấu · Nháy rồi đứng
- **Chữ sang:** Vàng kim · Vàng 24K · Bạc kim loại · Neon · **Dự án HOT (lửa)** · **Gần biển (xanh)** · Quét sáng · Chữ nổi khối · Chữ rỗng viền
- **Có khung:** Thẻ kính mờ · Dải băng vàng · Thẻ gạch vàng · Nền đen viền vàng · Ngoặc vuông · Gạch chân chạy

> **Hơn họ ở chỗ:** ô xem trước của mình vẽ bằng **đúng hàm dựng video**, nên thấy sao video ra y vậy.
> Bên họ xem trước là hình minh hoạ riêng.

## C. Thẻ chú thích — 8 kiểu (trước 1)

Gấp khúc · Gạch chân dưới chữ · Thanh viên thuốc · Ngoặc vuông bao chữ · Khung ngắm bốn góc ·
**Nét đứt chạy** · Đường cong mềm · **Sóng lan tại điểm neo**.

Khung thẻ dùng ảnh co giãn của bản đồ nên **luôn ôm khít chữ** dù chữ dài ngắn hay phóng to thu nhỏ.

## D. Ghim — 8 kiểu × 12 biểu tượng × 6 màu

Ghim giọt nước · Ô kính · Huy hiệu tròn · Khiên · Thẻ treo · Giọt nước kim loại · Chấm · Radar lan toả.
Bên trong ghim **cắm được biểu tượng tiện ích**: 🏫 trường · 🏬 chợ · 🏖 biển · 🏥 bệnh viện · ✈️ sân bay ·
🏛 UBND · 🛣 cao tốc · 🏦 ngân hàng · ⛽ cây xăng · 🏠 dự án · ⭐ điểm nhấn.

> Bên họ ghim chỉ có hình, **không cắm được biểu tượng tiện ích** — đây là chỗ mình hơn.

## E. Keyframe như app dựng phim

- Mốc camera hiện thành **hình thoi ◆ tím ngay trên dòng thời gian**
- **Kéo** để đổi thời điểm · **bấm** để xem lại khung đó · **chuột phải** để xoá
- Nút **＋ Chốt** ngay trên track
- Mỗi đoạn chọn được **kiểu chuyển động**: Mượt · Đều · Tăng tốc · Giảm tốc · **Đứng yên** (giữ khung để người xem kịp nhìn)
- Nút **ghi đè** — chỉnh bản đồ rồi ghi đè lên mốc cũ, khỏi xoá đi làm lại

## F. Khoanh lô 4 kiểu + phím tắt chuẩn

**Đa giác · Chữ nhật · Vuông · Tròn.**
Đang vẽ: **Enter** hoặc **nhấp đúp** = xong · **Esc** = bỏ điểm vừa vẽ.

## Còn thiếu so với họ (đợt sau)

Đối tượng chuyển động chạy theo tuyến (xe, máy bay, tàu) · Đọc chữ thành giọng nói ·
Khối giả lập giao diện điện thoại · Lưu/mở file dự án · Mỗi lớp một hàng riêng trên dòng thời gian
(hiện là các hàng cố định: Camera · Tuyến · Chữ · Biểu đồ · Nhạc + hàng cho từng chữ/ảnh).


---

# ĐỢT 4 — Ghim sang trọng, tuyến chuyên nghiệp, đồi núi

## 1. Ghim tiện ích vẽ lại hoàn toàn

**Trước:** khối màu phẳng, viền đen dày, biểu tượng dùng emoji nên nhiều máy hiện ra **ô vuông đen**.

**Giờ:** mỗi con ghim là một khối **kim loại chuyển sắc** — sáng ở trên, đậm dần xuống dưới, viền mảnh
ánh sáng, có **vệt sáng** phía trên và **bóng đổ mềm** bên dưới. Giữa ghim là một đĩa tối cho biểu tượng nổi lên.

**Biểu tượng giờ được vẽ bằng nét**, không dùng emoji nữa nên máy nào cũng hiện đúng và nhìn tinh tế:
Trường học · Chợ/TTTM · Biển · Bệnh viện · Sân bay · UBND · Cao tốc · Ngân hàng · Cây xăng · Dự án · Điểm nhấn · Chấm tròn.

**Ghim biết chuyển động:** nảy nhẹ lên xuống, kèm **hai quầng sáng lan ra** dưới chân — nhìn “sống”
chứ không đứng chết. Thẻ chú thích kiểu *Sóng lan* cũng đã chạy.

## 2. Tuyến đường như phần mềm dựng phim

Ô công cụ **➛ Vẽ tuyến** giờ có bảng riêng:
- **Chiều chạy:** Xuôi (đầu → cuối) hoặc Ngược lại
- **Kiểu chạy:** Đều · Mượt · Tăng tốc · Giảm tốc
- **Màu tuyến:** 5 màu
- **✨ Chấm sáng chạy ở đầu tuyến** — như đầu mũi tên đang tiến tới
- Tốc độ = độ dài thanh *Tuyến* dưới dòng thời gian (kéo dài = chạy chậm)

## 3. Cắm hàng loạt ghim từ Excel

Bảng **📍 Ghim** → **📋 Dán danh sách** hoặc **📂 Mở file CSV**.
Mỗi dòng: `Tên, vĩ độ, kinh độ`. Copy thẳng 3 cột từ Excel dán vào cũng được.
Máy **tự đoán biểu tượng theo tên** (có chữ “trường” → biểu tượng trường học, “chợ” → giỏ hàng…),
tự nhận ra vĩ độ/kinh độ dù đảo thứ tự, và bỏ qua dòng sai mà không làm hỏng dòng khác.

## 4. Đồi núi

Bảng **🎨 Màu bản đồ** có thêm:
- **⛰ Đổ bóng đồi núi** — đồi núi Cam Lâm hiện rõ khối, ảnh có chiều sâu hẳn
- **🏔 Địa hình 3D thật** — đồi nhô lên thật, thấy rõ nhất khi camera nghiêng

Dùng dữ liệu độ cao mở của AWS, không tốn phí, không cần khoá.

## 5. Sửa giao diện

- **Cột công cụ hết vỡ chữ:** đổi sang mỗi dòng một ô (biểu tượng trái, tên phải), rộng 158px
- **🎥 Camera tách thành ô công cụ riêng** — trước bị giấu trong bảng “Chữ & lời” nên không ai thấy
- **Dòng thời gian:** hàng Camera ghi rõ *“· N khung”*, khi chưa có khung thì hiện lời nhắc
  *“chỉnh bản đồ tới góc đẹp rồi bấm ＋ Chốt khung →”*, nút Chốt to và rõ hơn
