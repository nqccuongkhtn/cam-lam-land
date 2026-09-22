# Bộ tin đăng mẫu Cam Lâm

Dùng để **xem thử giao diện web cho giống thực tế**. Toàn bộ là tin GIẢ.

## Chạy

```bash
node scripts/tin-mau/nap-tin-mau.mjs > nap-tin.sql
docker compose exec -T postgis psql -U camlam -d camlam_gis < nap-tin.sql
```

Chạy lại bao nhiêu lần cũng được — mỗi lần nó xoá sạch tin mẫu cũ rồi nạp lại từ đầu.

**Nó KHÔNG đụng tới tin thật của anh.** Chỉ xoá tin của mấy tài khoản
`demo-agent-*@camlam.local` và mấy tin mẫu đời đầu (tin không có người đăng, không có ảnh
tải lên). Tin nào anh tự đăng thì vẫn nguyên.

## Hai file

| File | Việc |
|---|---|
| `tin-mau.mjs` | **Dữ liệu** — 58 tin, mỗi tin ghi xã, diện tích, giá, pháp lý, điểm nhấn. Sửa tin thì sửa ở đây. |
| `nap-tin-mau.mjs` | **Máy sinh** — ghép dữ liệu thành câu lệnh SQL, tự viết phần mô tả, rải ảnh, rải ngày đăng. |

## Giá lấy ở đâu ra

Ngày **22/9/2026** đã đo giá rao **thật** của Cam Lâm trên batdongsan.com.vn
(mục bán đất và bán nhà riêng của huyện, cộng thêm riêng xã Cam Hải Đông), tính ra
giá mỗi m² của từng xã rồi đặt giá tin mẫu nằm trong khoảng đó.

Giá mỗi m² đo được (triệu đồng/m², đất ở):

| Xã | Thấp | Cao |
|---|---|---|
| Cam Hải Đông (Bãi Dài) | 20 | 80 |
| Cam Đức | 7,6 | 35 |
| Suối Dầu | — | 9,6 |
| Suối Tân | 5 | 13,4 |
| Cam Hiệp Nam | 6,3 | 6,8 |
| Cam Tân | 5,2 | 7 |
| Cam Hòa | — | 8 |
| Cam An Nam | 1,8 | 6,7 |
| Suối Cát | — | 4 |
| Cam An Bắc | — | 3,2 |
| Cam Phước Tây | — | 0,16 (thửa lớn) |

**Quy luật quan trọng: lô càng to thì giá mỗi m² càng rẻ.**
Ví dụ thật ở Cam Hải Đông: lô 194 m² giá 47,9 tr/m² nhưng lô 9.000 m² chỉ 3 tr/m².
Tin mẫu có tôn trọng quy luật này, nếu không nhìn vào là biết ngay giá bịa.

**Không chép** nguyên văn tin, tên người bán, số điện thoại hay ảnh của ai.

## Ba cái bẫy đã vấp — nhớ để khỏi mất công lại

1. **Tin thường tự ẩn sau 7 ngày.** Web có luật: tin hạng `normal` mà không được đẩy thì
   sau 7 ngày biến mất khỏi danh sách (`apps/backend/src/routes/listings.ts`). Lần đầu
   rải ngày đăng trong 45 ngày → nạp 58 tin mà ngoài web chỉ thấy 27. Giờ tin thường
   luôn đăng trong vòng 6 ngày trở lại.

2. **Ảnh mới phải DỰNG LẠI frontend mới thấy.** Ảnh nằm ở `apps/frontend/public/`, mà bản
   chạy thật đóng gói sẵn vào ảnh Docker → chép file vào thôi là chưa đủ, ngoài web vẫn 404.
   Phải `docker compose ... up -d --build frontend` rồi `restart nginx`.

3. **Đổi ảnh mà giữ nguyên tên file thì trình duyệt vẫn hiện ảnh cũ.** Phải xoá bộ nhớ đệm
   (web này là PWA, có Service Worker giữ ảnh) hoặc tải lại bằng Ctrl+Shift+R.

## Ảnh

- `apps/frontend/public/bai-dai/` — ảnh biển Bãi Dài **thật** của Cam Lâm.
- `apps/frontend/public/tin-mau/` — ảnh minh hoạ theo loại hình (đất nền, vườn, nhà,
  biệt thự, mặt bằng). Nguồn và giấy phép ghi trong `tin-mau/NGUON-ANH.txt`.

Máy sinh tự **rải ảnh cho đều**: ảnh đầu của mỗi tin xoay vòng trong nhóm hợp với loại
bất động sản đó nên hai tin cạnh nhau không bao giờ trùng ảnh, và mỗi tin được bù cho
đủ 5 ảnh như tin rao thật.

Có ảnh chụp thật của Cam Lâm thì cứ thay thẳng vào `tin-mau/`, giữ nguyên tên file là xong.

## Muốn sửa gì

- **Thêm / bớt / sửa tin** → sửa `tin-mau.mjs`, chạy lại.
- **Thôn xếp sai xã** → tên thôn lấy từ danh sách 43 thôn chính thức của xã Cam Lâm và
  8 thôn của xã Suối Dầu, nhưng **thôn nào thuộc xã CŨ nào thì xếp theo hiểu biết địa phương**,
  chỗ này có thể sai. Thấy sai thì sửa trong `tin-mau.mjs`.
- **Xoá sạch tin mẫu, không nạp lại**:
  ```sql
  DELETE FROM listings WHERE created_by IN
    (SELECT id FROM users WHERE email LIKE 'demo-agent-%@camlam.local');
  ```
