# Báo cáo rà soát bảo mật — 13/08/2026

Rà toàn bộ web theo 13 điểm đã liệt kê trong `docs/CONG-VIEC-CON-NO.md`.
Viết lời thường, không dùng thuật ngữ nếu không cần.

---

## 🔴 ĐÃ TÌM RA VÀ ĐÃ VÁ

### 1. Kẻ xấu chèn mã độc qua TIÊU ĐỀ TIN ĐĂNG (nguy hiểm nhất)

**Chỗ:** trang tin đăng, trang nhà đất, tin tức, cẩm nang — 6 file có thẻ
`<script type="application/ld+json">` (thẻ này để Google hiểu nội dung trang).

**Kẻ xấu làm được gì:** đăng một tin có tiêu đề kiểu

```
Bán đất Cam Đức </script><script>...mã độc...</script>
```

Chuỗi `</script>` được nhét NGUYÊN VĂN vào trang. Trình duyệt hiểu là thẻ script đã đóng,
rồi **chạy mã của kẻ xấu trên máy của MỌI khách vào xem tin đó** — đánh cắp phiên đăng nhập
(kể cả phiên admin nếu admin bấm vào xem tin), chuyển hướng khách sang trang lừa đảo, hoặc
âm thầm đăng/sửa dữ liệu thay mặt người đang đăng nhập.

Đây là lỗi kinh điển, dân bảo mật gọi là *stored XSS*. Nguy hiểm vì tiêu đề tin là do
**người ngoài tự gõ** và tin hiện công khai cho mọi người.

**Đã vá thế nào:** thêm `apps/frontend/src/lib/jsonld.ts` — hàm `ldJson()` đổi các ký tự
nguy hiểm (`<` `>` `&` và hai ký tự xuống dòng lạ) sang dạng `\u…`. Trình duyệt đọc ra vẫn
**đúng chữ cũ**, hiển thị không đổi, Google vẫn đọc được, nhưng **không còn ký tự nào đóng
được thẻ script**. Đã thay ở cả 6 chỗ.

---

## 🟡 ĐÃ XEM KỸ — KHÔNG PHẢI LỖI (ghi lại để lần sau khỏi soi lại)

| Chỗ | Kết luận |
|---|---|
| **Câu lệnh cơ sở dữ liệu** | Rà toàn bộ chỗ ghép chuỗi vào SQL. Tất cả đều ghép **hằng số cố định** (danh sách cột, tên bảng viết cứng trong code), dữ liệu người dùng luôn đi qua tham số `$1`. **Không có lỗ SQL injection.** |
| **Kho cấu hình `/api/config/:key`** | Đọc công khai nhưng có **danh sách trắng chỉ 1 khoá** (`tintuc_ad`). Khoá API Anthropic nằm trong cùng bảng **không lấy ra được**. Làm đúng. |
| **Công cụ PDF máy chủ** | Gọi LibreOffice/ocrmypdf/qpdf bằng `execFile` với tham số dạng mảng — **không chèn lệnh vào được**. Tên tệp có lọc ký tự lạ. |
| **Tải file GIS lên** | Có chặn quyền `gisRequired`, tên tệp lọc `[^\w.\-]`, giới hạn 200MB. Không thoát ra ngoài thư mục được. |
| **Webhook thanh toán** | Bắt buộc header `x-webhook-key`; thiếu khoá thì **từ chối** (fail closed). Cộng gói bằng câu UPDATE có điều kiện nên **gọi lặp không cộng gói hai lần**. |
| **Chặn quyền các route** | Đối chiếu từng route: `admin` chặn ở cấp router; `imports`, `layers` (xoá), `mapAds`, `config` (ghi), `hotlist`, `danh-muc`, `van-ban` đều có chặn đúng chỗ. **Không thấy route quản trị nào bị hở.** |
| **Bộ nhớ đệm nginx** | `proxy_cache_bypass` và `proxy_no_cache` đều theo `$http_authorization` → **dữ liệu của người đăng nhập không bị lưu rồi trả nhầm cho người khác.** |
| **Header bảo mật** | Có `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`. |
| **Khoá bí mật trong mã nguồn** | Kho git chỉ có `.env.example` (file mẫu). **Không có `.env` thật, không có file khoá nào bị commit.** |
| **Chặn số lần gọi** | Toàn cục 600 lần/phút; đăng nhập 60/10 phút; OCR 60; PDF 40; danh mục 20; AI 30. |

---

## 🟠 KHUYẾN NGHỊ — cần chủ dự án quyết, CHƯA tự ý sửa

Ba việc dưới đây đều **có thể làm gãy tính năng đang chạy** nên tôi không tự đụng vào.

### A. Công cụ PDF máy chủ đang cho dùng KHÔNG CẦN ĐĂNG NHẬP
Bất kỳ ai trên Internet cũng gọi được `/api/pdftools/*`. Mỗi lần gọi là một lần máy chủ chạy
LibreOffice hoặc OCR — **rất nặng máy**, riêng OCR cho phép chạy tới 280 giây một file 60MB.
Kẻ xấu chỉ cần gọi liên tục là **máy ở nhà đơ, cả web sập** (không mất dữ liệu, chỉ sập dịch vụ).

Ba mức chọn, nhẹ → nặng:
1. Giữ công khai nhưng **siết**: giảm còn 10 lần/10 phút, file tối đa 20MB, OCR tối đa 90 giây.
2. **Bắt đăng nhập** mới dùng được (mất khách vãng lai, nhưng an toàn nhất).
3. Giữ nguyên, chấp nhận rủi ro.

### B. Chưa có Content-Security-Policy
Đây là "lưới an toàn" cuối cùng: kể cả lỡ có lỗ XSS khác thì mã lạ vẫn không chạy được.
Chưa bật vì web đang tải nhiều thứ từ bên ngoài (bản đồ Google, thư viện PDF, ffmpeg…),
bật ẩu là **vỡ giao diện ngay**. Cách làm đúng: bật ở chế độ *chỉ ghi nhận* trước một tuần,
xem cái gì bị chặn rồi mới bật thật.

### C. Vé đăng nhập lưu trong bộ nhớ trình duyệt (localStorage)
Cách an toàn hơn là để trong cookie mà JavaScript không đọc được. Nhưng đổi thì phải sửa cả
backend lẫn frontend và mọi người **bị đăng xuất một lượt**. Lỗ XSS ở mục 1 đã vá nên rủi ro
hiện tại thấp hẳn; để dành làm sau cùng đợt nâng cấp lớn.

---

## Chưa kịp làm
- `npm audit` cho từng gói (cần máy chủ đang bật để chạy trong container).
- Soi kỹ route `chat` xem người này có đọc được phòng chat của người khác không.
