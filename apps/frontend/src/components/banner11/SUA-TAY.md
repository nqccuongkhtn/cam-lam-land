# NHỮNG CHỖ ĐÃ SỬA TAY SAU KHI TÁCH TỪ BẢN THIẾT KẾ GỐC

`banner11.css` và `mauBanner.ts` được **tách tự động** từ file thiết kế gốc của chủ dự án
(`banner-anh-cam-lam.html`). Nếu sau này tách lại từ bản gốc thì **những sửa dưới đây sẽ mất**,
phải làm lại cho đủ.

---

## 1. Ảnh: không gọi sang máy chủ người khác nữa
Bản gốc lấy 17 tấm ảnh thẳng từ `images.unsplash.com` và `images.pexels.com`.
Đã tải hết về `public/banner11/`, nén lại thành WebP (8,0 MB → 3,2 MB, nhẹ đi 60%)
và đổi mọi đường dẫn sang đường dẫn nội bộ.

**Vì sao phải làm:** web thật không được phụ thuộc máy chủ của người khác — họ đổi đường dẫn,
chặn gọi từ ngoài, hoặc mạng nhà chậm là banner trắng trơn. Ảnh nặng cũng tốn tiền mạng của
người xem, mà 90% người xem đang dùng điện thoại.

## 2. Mẫu 9 (`st-ui` — Thẻ kính UI): thay bản đồ vẽ tay bằng BẢN ĐỒ THẬT
Bản gốc vẽ một bản đồ giả bằng SVG (mấy ô vuông xanh lá + vệt nước). Chủ dự án yêu cầu
thay bằng ảnh thật giữ nguyên bố cục đó.

Nay dùng `public/banner11/qh-cam-lam.webp` — **ghép từ chính lớp quy hoạch QĐ205 của web mình**
(bộ ô `public/tiles/qd205v11`, mức phóng 14, vùng ven biển Cam Hải Đông – Bãi Dài), nền màu
sáng tự đặt. Ghim vị trí vẫn giữ nguyên, chỉ dời cho đúng chỗ đất liền sát biển.

⚠️ **KHÔNG chụp màn hình bản đồ trên web rồi cắt ra dùng.** Nền bản đồ đó là ảnh của Google;
xem trực tiếp trên web (có dòng ghi nguồn) thì được, nhưng cắt ảnh Google nướng vào một tấm
banner quảng cáo là dùng sai phép. Ghép từ lớp quy hoạch của mình thì hoàn toàn sạch —
đó là dữ liệu do chính dự án dựng từ file CAD gốc của tỉnh.

Dựng lại tấm này khi cần: xem lại cách ghép ô ở `scripts/` hoặc ghép tay 20 ô
`tiles/qd205v11/14/13159..13163/7635..7638.png` rồi cắt vùng có bờ biển.
