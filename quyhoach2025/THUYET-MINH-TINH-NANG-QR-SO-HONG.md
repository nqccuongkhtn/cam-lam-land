# Thuyết minh nghiệm thu — Tính năng "Tra cứu QR Giấy chứng nhận (sổ hồng)"

**Sản phẩm:** Cam Lâm Land — trang `/qr`
**Trạng thái:** Hoàn thành, đúng chuẩn nghiệp vụ.

## 1. Tính năng đã làm được

1. **Quét mã QR bằng camera** (toàn màn hình, kiểu iPhone): tự nhận diện liên tục, có khung ngắm, vạch quét phát sáng và **khung xanh ôm đúng vị trí mã QR** khi bắt được (hiệu ứng như Google Lens). Hỗ trợ đèn flash, thu phóng, chạm lấy nét, đổi camera trước/sau, chụp thủ công cho ca khó.
2. **Đọc mã QR từ ảnh tải lên** (cho máy không tiện mở camera).
3. **Bóc tách & hiển thị đầy đủ dữ liệu trong mã QR** ngay trên web: ngày giờ tạo mã, mã đơn vị cấp, hệ thống, mã hồ sơ / GCN, số phát hành (seri), ngày giờ cấp GCN, mã xác thực. Tự định dạng ngày giờ cho dễ đọc, có nút **copy từng trường**.
4. **Chuyển sang Cổng thông tin đất đai VBĐLIS chính thức** bằng một chạm, kèm **tự động copy mã tra cứu** để người dùng chỉ cần dán vào và tìm.

## 2. Vì sao KHÔNG hiển thị chi tiết thửa (chủ, diện tích, ranh giới) ngay trong web

Thông tin chi tiết của thửa đất **nằm trong Cơ sở dữ liệu đất đai quốc gia**, chỉ được **Cổng VBĐLIS chính thức** (`tracuuqr.vbdlis.vn`) trả về. Việc nhúng/hiển thị trực tiếp kết quả này vào web bên thứ ba là **không khả thi về mặt kỹ thuật và không được phép**, vì:

- **Cổng bắt buộc bước xác thực "Vui lòng xác nhận bạn không phải là người máy" (CAPTCHA)** trước khi trả kết quả. Đây là lớp bảo vệ để chỉ **con người thật** mới tra được dữ liệu sổ — không hệ thống tự động nào được phép vượt qua.
- **Cổng chặn nhúng iframe** (X-Frame-Options / CSP) từ phía máy chủ.
- **Không có API công khai** cho bên thứ ba lấy dữ liệu về tự hiển thị.

Đây là **giới hạn chung** áp dụng cho mọi nền tảng, kể cả các trang lớn — tất cả đều chỉ **dẫn người dùng sang cổng chính thức**, giống hệt cách sản phẩm này làm.

## 3. Kết luận

Luồng "quét/đọc QR → bóc tách dữ liệu trong mã → chuyển sang cổng chính thức để tra kết quả pháp lý" là **cách triển khai đúng chuẩn, an toàn và hợp quy định**. Bước xác thực cuối do **người dùng tự thực hiện** trên cổng nhà nước là **thiết kế bắt buộc**, không phải thiếu sót của sản phẩm.

*Căn cứ: Mã QR trên Giấy chứng nhận tạo theo chuẩn TCVN 7322:2009; bắt buộc in trên sổ cấp mới từ 01/01/2025 theo Thông tư 10/2024/TT-BTNMT. Kết quả tra cứu do Cổng thông tin đất đai VBĐLIS cung cấp.*
