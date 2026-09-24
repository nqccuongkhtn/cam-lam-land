# Báo cáo bản quyền — trang "Tạo video bản đồ" (và bản đồ chung của web)

*Rà soát ngày 14/08/2026. Đã đọc điều khoản gốc của từng nhà cung cấp, không nói theo trí nhớ.*

Vì sao phải xét kỹ: video làm ra ở đây là **video bán hàng có thu tiền** (web có gói `video`).
Rất nhiều nguồn ảnh bản đồ cho dùng **miễn phí nhưng cấm thương mại** — dùng nhầm là vi phạm,
dù mình không cố ý.

---

## BẢNG TÓM TẮT

| # | Thứ đang dùng | Dùng ở đâu | Tình trạng |
|---|---|---|---|
| 1 | Ảnh vệ tinh **Google** (mt0.google.com) | Bản đồ chính cả web | 🔴 Vi phạm điều khoản Google |
| 2 | Ảnh vệ tinh **Esri World Imagery** | Nền video (**mặc định**) | 🔴 Cấm dùng thương mại nếu không mua |
| 3 | **Sentinel-2 cloudless 2024 (EOX)** | Nút "Vệ tinh (mở)" | 🔴 Là CC BY-**NC**-SA = **cấm thương mại**. Code đang ghi chú SAI |
| 4 | **Không hiện dòng ghi nguồn** | Trang video + video xuất ra | 🟠 Thiếu ghi nguồn = vi phạm mọi giấy phép trên |
| 5 | **OSRM demo** (chỉ đường A→B) | Nút 🚗 Chỉ đường | 🟠 Chỉ cho phi thương mại, có thể bị cắt bất cứ lúc nào |
| 6 | **Nominatim** (tìm địa điểm/ranh xã) | Ô tìm kiếm | 🟠 Được dùng, nhưng phải ghi nguồn OSM |
| 7 | **AWS Terrain Tiles** (đồi núi 3D) | Đổ bóng, địa hình | 🟡 Miễn phí nhưng **bắt buộc ghi nguồn** |
| 8 | **Emoji** nung vào video | Ghim, thẻ, chữ | 🟡 Emoji của Apple có bản quyền |
| 9 | Thư viện nạp từ CDN (jszip, qrcode) | Xuất ZIP, mã QR | 🟡 Giấy phép MIT — sạch, nhưng rủi ro an toàn |
| 10 | **Học từ MapEffect** | Ý tưởng giao diện | 🟡 Học ý tưởng không phạm luật — chỉ cần tránh chép nguyên văn |
| 11 | **Nhạc & tiếng động** | Video | 🟢 Máy tự tổng hợp — hoàn toàn sạch |
| 12 | **Phông Noto Sans** | Chữ trên bản đồ | 🟢 Giấy phép OFL — thương mại thoải mái |
| 13 | **MapLibre GL JS** | Lõi bản đồ | 🟢 BSD-3 — thương mại thoải mái |

---

## CHI TIẾT TỪNG MỤC

### 1. 🔴 Ảnh vệ tinh Google — `apps/frontend/src/components/MapView.tsx` dòng 37–45

Web đang lấy ảnh thẳng từ `mt0.google.com/vt/lyrs=s...`. Đây là **cửa sau không công bố**
của Google, không phải API chính thức, không có khoá.

Điều khoản Google nói thẳng hai điều mình đang phạm:

- Cấm lấy ô ảnh bản đồ qua "giao diện hoặc kênh khác ngoài Maps API", kể cả **giao diện không công bố**.
- Cấm tải hàng loạt / trích xuất ô ảnh bản đồ ra dùng ngoài dịch vụ của Google.

Đây là **vi phạm hợp đồng, không phải vi phạm hình sự** — nghĩa là không ai đi tù, nhưng Google
có quyền chặn thẳng, và nếu web có tiếng thì họ gửi thư yêu cầu gỡ.

Đường thoát hợp lệ: **Google Map Tiles API** (có khoá, trả tiền theo lượt tải, được phép làm video
quảng cáo nếu giữ chữ "Google" trong khung hình).

### 2. 🔴 Ảnh Esri World Imagery — `tao-video-ban-do/page.tsx` dòng 20–25, đang là **lớp mặc định**

Điều khoản Esri: dịch vụ **không được sao chép hay truyền đi vì mục đích thương mại** dưới bất kỳ
hình thức nào, trừ khi Esri cho phép **bằng văn bản**. Họ định nghĩa "phi thương mại" là:
mình cung cấp cho người khác **không thu tiền**, và cả mình lẫn khách của mình **không sinh lợi**
từ việc đó.

Web mình bán gói `video`, và video làm ra là để bán đất → **đúng là thương mại**.
Quay ảnh Esri vào file MP4 rồi đăng bán hàng là dạng "sao chép và truyền đi" mà điều khoản cấm.

### 3. 🔴 Sentinel-2 cloudless (EOX) — chỗ này đang **hiểu sai và ghi sai trong code**

Dòng 40–41 của `page.tsx` ghi: *"giấy phép CC BY … dùng cho video bán hàng thì yên tâm về bản quyền"*.
Tooltip nút bấm (dòng 3744) cũng hiện cho người dùng: *"Ảnh nguồn mở — yên tâm bản quyền khi làm
video bán hàng"*.

**Sai.** Bản `s2cloudless-2024` mà code đang gọi có giấy phép **CC BY-NC-SA 4.0**:

- **NC = NonCommercial = CẤM dùng cho mục đích thương mại.**
- **SA = ShareAlike** = sản phẩm phái sinh phải mở lại cùng giấy phép.

Chỉ **bản năm 2016** mới là CC BY 4.0 (được thương mại). Các bản 2018→2024 đều là NC.

Đây là mục nguy hiểm nhất vì mình đang **quảng cáo với người dùng rằng nó an toàn**, trong khi
nó là lựa chọn bị cấm rõ ràng nhất.

Ba đường thoát:

- (a) Đổi sang bản **2016** (CC BY 4.0) — ảnh cũ hơn, mờ hơn, nhưng hợp pháp và miễn phí.
- (b) Mua giấy phép "EOX Commercial Attribution-RestrictedUse 1.1" của chính EOX.
- (c) **Tự ghép ảnh vệ tinh riêng cho Cam Lâm từ dữ liệu gốc Copernicus Sentinel-2** — xem mục dưới.

### 3b. ✅ Đường sạch nhất và miễn phí: dữ liệu gốc Copernicus

Ảnh Sentinel-2 **gốc** của châu Âu là dữ liệu **mở toàn phần**, chính sách của họ cho phép
**dùng thương mại**, chỉ cần ghi: *"Contains modified Copernicus Sentinel data 2025"*.
Cái bị cấm thương mại là **bản ghép sẵn của EOX**, chứ không phải dữ liệu gốc.

Nghĩa là: nếu mình tự tải ảnh Sentinel-2 vùng Cam Lâm rồi tự ghép thành bộ tile (đúng như đã
làm với tile quy hoạch trong `apps/frontend/public/tiles/`) thì **hoàn toàn hợp pháp, miễn phí,
vĩnh viễn, không phụ thuộc máy chủ ai cả**. Nhược điểm: độ nét ~10m mỗi điểm ảnh — nhìn được ranh
đất lớn, không nét bằng Google/Esri; và tốn một buổi dựng.

### 4. 🟠 Video xuất ra không có dòng ghi nguồn nào

`page.tsx` dòng 2271 đặt `attributionControl: false` — tắt hẳn ô ghi nguồn của bản đồ.
Trong style có khai `attribution: '© Esri'` và `'© Sentinel-2 cloudless (EOX)'` (dòng 2243–2244)
nhưng **không bao giờ hiện ra**, và **không được nung vào video xuất ra**.

Kể cả khi đổi sang nguồn hợp lệ, **thiếu dòng ghi nguồn vẫn là vi phạm giấy phép** — CC BY,
ODbL (OpenStreetMap), AWS Terrain và Esri đều bắt buộc ghi nguồn.

Cách mọi app bản đồ làm: in một dòng chữ nhỏ, mờ, ở góc dưới khung hình. Không xấu video.

### 5. 🟠 Chỉ đường A→B dùng máy chủ demo của OSRM

`router.project-osrm.org` — chính sách của họ:

- Chỉ dành cho **mục đích phi thương mại hợp lý**, tối đa **1 lệnh/giây**.
- Nếu dùng trong sản phẩm thương mại thì sản phẩm phải **công khai** và **ghi nguồn đầy đủ**.
- **Cấm bán quyền truy cập** vào máy chủ demo.
- Họ **cắt bất cứ lúc nào, không cần lý do** — cảnh báo riêng cho dịch vụ thu tiền:
  *"bạn có thể không phục vụ được khách đang trả tiền nữa"*.

Số lần gọi của mình rất ít (mỗi lần người dùng bấm 2 điểm = 1 lệnh) nên không phá luật tần suất,
nhưng đang **dùng trong tính năng bán tiền**, và **có ngày sẽ chết giữa lúc khách dùng**.

Đường thoát: dựng OSRM riêng bằng Docker ngay trên máy ở nhà (đã có sẵn Docker) — miễn phí,
nhanh hơn, không ai cắt được.

### 6. 🟠 Tìm địa điểm / ranh giới xã bằng Nominatim

Chính sách của Quỹ OpenStreetMap: tối đa 1 lệnh/giây, phải có Referer nhận diện được (trình duyệt tự
gửi → đạt), **cấm quét hàng loạt**, và **phải ghi nguồn**.

Code chỉ gọi khi người dùng **bấm nút** (không gọi theo từng phím gõ) → tần suất đạt yêu cầu.
Thiếu duy nhất: **dòng ghi nguồn OpenStreetMap** — ranh giới xã lấy từ OSM được vẽ thẳng vào video.

### 7. 🟡 Địa hình 3D / đổ bóng đồi núi (AWS Terrain Tiles)

Miễn phí, không cần đăng ký, nhưng nhà cung cấp ghi rõ: **dùng để phân tích hay để hiển thị đều
bắt buộc ghi nguồn** (dữ liệu gốc từ NASA SRTM, USGS…).

### 8. 🟡 Emoji nung vào video

Ghim, thẻ chú thích, nút bấm dùng emoji. Emoji được vẽ bằng **phông của hệ điều hành người dùng**:

- Windows → Segoe UI Emoji (Microsoft)
- Mac/iPhone → **Apple Color Emoji — có bản quyền, Apple cấm nhúng vào sản phẩm phát hành**

Vì video được dựng **trên máy khách**, khách dùng Mac sẽ nung hình emoji Apple vào file MP4 bán hàng.
Rủi ro thực tế thấp (chưa nghe ai bị kiện vì việc này) nhưng về nguyên tắc là không sạch.
Muốn sạch tuyệt đối: vẽ emoji bằng bộ **Noto Emoji (OFL)** hoặc **Twemoji (CC BY 4.0)** tự chứa trong web.

### 9. 🟡 Thư viện nạp thẳng từ CDN

`esm.sh/jszip`, `esm.sh/qrcode`, `unpkg.com/...`. Giấy phép MIT → **không vướng bản quyền**.
Nhưng đây là **mã của bên thứ ba nạp vào trang lúc chạy**: CDN bị chiếm là mã lạ chạy trong web mình,
CDN chết là tính năng chết. Nên đóng gói vào web thay vì gọi ra ngoài.

### 10. 🟡 Chuyện "học từ MapEffect"

Luật bản quyền **không bảo hộ ý tưởng và chức năng** — làm một công cụ video bản đồ giống họ,
có timeline, có thẻ chú thích, có ghim… là **hoàn toàn hợp pháp**. Cái được bảo hộ là **cách diễn đạt cụ thể**.

Cần tránh (hiện chưa thấy vi phạm trong code, chỉ có ghi chú "học từ MapEffect" trong comment):

- Chép **nguyên văn** câu chữ giao diện / trang hướng dẫn của họ.
- Dùng lại **hình ảnh, biểu tượng, mẫu dựng sẵn** lấy từ web của họ.
- Đặt tên "MapEffect" trong sản phẩm hoặc quảng cáo của mình.

### 11–13. 🟢 Ba thứ đang sạch, không phải lo

- **Nhạc & tiếng động**: máy tự tổng hợp bằng bộ âm thanh của trình duyệt, không tải file nào →
  không dính bản quyền âm nhạc. Đây là điểm làm rất đúng.
- **Phông Noto Sans**: giấy phép SIL Open Font License — dùng thương mại thoải mái.
  *Việc nhỏ nên làm*: thư mục `apps/frontend/public/fonts/` chưa có file giấy phép → nên thêm bản OFL vào.
- **MapLibre GL JS**: BSD 3 điều khoản — thương mại thoải mái.

---

## ĐỀ XUẤT LÀM GÌ, THEO THỨ TỰ

### Mức A — sửa ngay, ít công, hết phần lớn rủi ro

1. Sửa **ghi chú sai** ở dòng 40–41 và **tooltip sai** ở dòng 3744 (đang nói với người dùng rằng
   lớp NC là "yên tâm bản quyền").
2. **Nung dòng ghi nguồn nhỏ** vào góc video xuất ra, đổi theo lớp nền đang dùng.
3. Hiện lại ô ghi nguồn trên bản đồ lúc đang chỉnh (vẫn ẩn lúc quay để không lọt hai lần).
4. Thêm file giấy phép OFL vào thư mục phông chữ.
5. Ghi thêm cảnh báo ngay tại chỗ chọn lớp nền: lớp nào được bán hàng, lớp nào không.

### Mức B — làm để sạch thật sự (tốn công hơn)

6. **Tự dựng bộ tile vệ tinh Cam Lâm từ Copernicus Sentinel-2** → miễn phí, được thương mại,
   không phụ thuộc ai. Đặt làm **lớp mặc định** của trang video.
7. Dựng **OSRM riêng** bằng Docker thay máy chủ demo.
8. Đóng gói jszip/qrcode vào web thay vì nạp từ CDN.

### Mức C — nếu muốn ảnh nét như Google

9. Mua **Google Map Tiles API** hoặc **Mapbox Satellite** hoặc gói Esri. Có phí theo lượt tải ô ảnh.
   Đây là cách duy nhất vừa nét vừa hợp pháp.

### Mức D — giấy tờ

10. Thêm trang **"Nguồn dữ liệu & bản quyền"** trên web liệt kê đủ các nguồn trên.
11. Trong điều khoản dịch vụ: nói rõ người dùng chịu trách nhiệm về nội dung họ đưa vào video.

---

## Nguồn đã tra

- Google Maps Platform Terms of Service — https://cloud.google.com/maps-platform/terms
- Google Maps APIs Terms (điều cấm dùng giao diện không công bố) — https://developers.google.com/maps/terms-20180207
- Esri Web Site and Service Terms of Use — https://www.esri.com/en-us/legal/terms/web-site-service
- Sentinel-2 cloudless 2024 (EOX) — https://eox.at/2025/03/sentinel-2-cloudless-2024/
- Chính sách bản quyền Copernicus — https://www.copernicus.eu/en/access-data/copyright-and-licences
- OSRM API Usage Policy — https://github.com/Project-OSRM/osrm-backend/wiki/API-Usage-Policy
- Nominatim Usage Policy — https://operations.osmfoundation.org/policies/nominatim/
- AWS Terrain Tiles (Registry of Open Data) — https://registry.opendata.aws/terrain-tiles/
