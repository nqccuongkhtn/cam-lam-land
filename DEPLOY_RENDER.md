# 🚀 Deploy Cam Lâm Land lên Render (miễn phí)

Toàn bộ cấu hình đã viết sẵn (`render.yaml`, Dockerfile production, backend tự tạo
bảng + nạp dữ liệu mẫu). Bạn chỉ cần làm theo các bước bấm dưới đây
(mình không thể tự đăng nhập/đăng ký hộ bạn vì lý do bảo mật).

Kết quả: web chạy tại `https://camlam-web.onrender.com` (tên miền + server miễn phí).

---

## ⚠️ Bước 0 — Xoá thư mục `.git` lỗi (làm trước)
Mình có thử khởi tạo git nhưng ổ đĩa chặn nên để lại 1 thư mục `.git` hỏng. Xoá nó:
- Mở PowerShell, chạy:  `cmd /c rmdir /s /q "D:\Cam Lam gis\.git"`
- (Hoặc bật "Hiện mục ẩn" trong File Explorer rồi xoá thư mục `.git`.)

## Bước 1 — Cài Git (nếu chưa có)
Tải tại https://git-scm.com/download/win → cài để mặc định. Kiểm tra: `git --version`.

## Bước 2 — Lấy lại tài khoản GitHub
- Vào https://github.com/login → **Forgot password?** → nhập **nguyenthanhhauqg12@gmail.com** → đặt lại mật khẩu qua email.
- Nếu không vào được → tạo tài khoản mới: https://github.com/signup

## Bước 3 — Tạo "mật khẩu đẩy code" (Personal Access Token)
GitHub → avatar góc phải → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**:
- Note: `camlam` · Expiration: 90 days · tích ô **`repo`** → **Generate token** → **COPY** chuỗi token (chỉ hiện 1 lần!).

## Bước 4 — Tạo repo trống
https://github.com/new → Repository name: **`cam-lam-land`** → chọn **Private** → **KHÔNG** tích README/.gitignore/license → **Create repository**.

## Bước 5 — Đẩy code lên GitHub
Mở PowerShell, chạy lần lượt (thay `<TÊN_GITHUB>` bằng tên đăng nhập GitHub của bạn):
```powershell
cd "D:\Cam Lam gis"
git init
git add .
git commit -m "Cam Lam Land"
git branch -M main
git remote add origin https://github.com/<TÊN_GITHUB>/cam-lam-land.git
git push -u origin main
```
Khi cửa sổ đăng nhập hiện ra: **Username** = tên GitHub, **Password** = **DÁN TOKEN** ở Bước 3.

## Bước 6 — Deploy trên Render
1. https://render.com → **Get Started** → đăng nhập bằng **GitHub** → **Authorize Render**.
2. Dashboard → **New +** → **Blueprint**.
3. Chọn repo **`cam-lam-land`** → **Connect**.
4. Render đọc `render.yaml`, hiện 3 mục: **camlam-db** (PostGIS), **camlam-api**, **camlam-web** → đặt tên Blueprint → **Apply**.
5. Đợi build ~5–10 phút (lần đầu). Mở log **camlam-api** đến khi thấy `[bootstrap] done` và `API + WS listening`.
6. Mở dịch vụ **camlam-web** → bấm URL `https://camlam-web.onrender.com`. 🎉

---

## Sau khi chạy
- **Quản trị:** `admin@camlam.local` / `admin12345` (đổi qua biến `ADMIN_PASSWORD` trên Render → Environment nếu muốn).
- **Cập nhật web về sau:** chỉ cần `git add . && git commit -m "..." && git push` → Render tự build lại.

## Lưu ý bản miễn phí
- Dịch vụ **"ngủ" sau ~15 phút** không ai dùng → lần mở kế tiếp chờ ~30–50 giây (bình thường, không phải lỗi).
- **Postgres free hết hạn sau ~30 ngày** → hợp để deploy thử. Lâu dài: nâng gói Render, hoặc dùng DB ngoài miễn phí (Supabase/Neon — chỉ cần đổi `DATABASE_URL`).
- Tính năng **tải DGN→GeoJSON trực tiếp** (cần worker GDAL chạy nền — gói trả phí) tạm tắt trên cloud free; chạy **local `start.bat`** vẫn đầy đủ. Lớp quy hoạch mẫu + ảnh QĐ205 + bản đồ vệ tinh vẫn hiển thị bình thường trên cloud.
- Khu vực server đang đặt **Singapore** (gần VN nhất). Đổi trong `render.yaml` nếu cần.

---
*Phát triển bởi Nguyễn Quốc Cường — Cam Lâm Land.*
