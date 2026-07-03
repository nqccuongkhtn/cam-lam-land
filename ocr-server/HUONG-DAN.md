# Hướng dẫn dựng "Máy OCR nội bộ" trên PC văn phòng

Mục tiêu: PC của bạn chạy một server OCR mạnh (EasyOCR). App Cam Lâm Land trên Render sẽ gọi sang máy này **đầu tiên**. Khi PC bật → dùng nó (miễn phí, không giới hạn). Khi PC/tunnel tắt → app **tự động** quay về OCR.space → Gemini → Tesseract. Không bao giờ kẹt.

---

## ⚡ CÁCH NHANH NHẤT — bấm đúp là chạy

Chỉ cần **bấm đúp vào file `CHAY-MAY-OCR.bat`**. Nó tự làm hết: cài thư viện (lần đầu), tải cloudflared, bật máy OCR + đường hầm.

- **Lần đầu:** nếu máy chưa có Python, nó sẽ mở trang tải → cài **Python 3.10/3.11** (nhớ **tick "Add Python to PATH"**) → bấm đúp lại file `.bat`.
- Khi chạy xong, mở cửa sổ **"DUONG HAM INTERNET"** → copy dòng URL `https://….trycloudflare.com` → dán vào biến **`SELF_OCR_URL`** trên Render (Environment) → Save.
- Muốn tắt máy OCR: đóng 2 cửa sổ đen vừa hiện.

> Nếu muốn tìm hiểu từng bước thủ công, xem tiếp bên dưới.

---

## Bước 1 — Cài Python

1. Tải **Python 3.10** (hoặc 3.11) tại https://www.python.org/downloads/
2. Khi cài, **TICK ô "Add Python to PATH"** rồi Install.

## Bước 2 — Cài thư viện OCR

Mở **CMD** (hoặc PowerShell) tại thư mục `ocr-server` này, chạy:

```
pip install easyocr fastapi "uvicorn[standard]" pillow python-multipart numpy
```

(Tải hơi lâu vì có thư viện học sâu — chờ tới khi xong.)

## Bước 3 — Chạy máy OCR

```
python ocr_server.py
```

- Lần đầu sẽ **tải model ~vài trăm MB** — chờ.
- Khi thấy dòng `Uvicorn running on http://0.0.0.0:8000` là chạy rồi.
- Kiểm tra: mở trình duyệt vào **http://localhost:8000/health** → thấy `{"status":"ok"}` là ổn.

> Để bảo vệ (khuyến nghị): chạy kèm mật khẩu
> - CMD: `set OCR_TOKEN=matkhau-bi-mat && python ocr_server.py`
> - PowerShell: `$env:OCR_TOKEN="matkhau-bi-mat"; python ocr_server.py`

## Bước 4 — Mở máy ra Internet (để Render gọi được)

PC nằm sau router nên cần "đường hầm". Dùng **Cloudflare Tunnel** (miễn phí, nhanh):

1. Tải `cloudflared` cho Windows: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/  (file `cloudflared-windows-amd64.exe`, đổi tên thành `cloudflared.exe`).
2. Mở CMD **thứ hai** (giữ CMD chạy `ocr_server.py` ở trên), chạy:

```
cloudflared tunnel --url http://localhost:8000
```

3. Nó in ra một URL dạng: `https://abcd-xyz.trycloudflare.com` → **copy URL này**.

## Bước 5 — Khai báo trên Render (backend)

Vào **Render → service backend (camlam-api) → Environment → Add Variable**:

| Key | Value |
|-----|-------|
| `SELF_OCR_URL` | URL cloudflared vừa copy (vd `https://abcd-xyz.trycloudflare.com`) |
| `SELF_OCR_TOKEN` | (nếu Bước 3 có đặt) đúng chuỗi `matkhau-bi-mat` |

Save → Render deploy lại. **Xong!**

## Bước 6 — Kiểm tra

Đăng nhập web → Bản đồ → chụp bảng toạ độ. Ô xanh sẽ ghi **"nguồn: máy OCR nội bộ"**. Log Render có dòng `[ocr] Máy nội bộ đọc N số`.

---

## Lưu ý quan trọng

- **Muốn dùng máy nội bộ thì PC phải BẬT** + cả 2 cửa sổ (`ocr_server.py` và `cloudflared`) đang chạy. Tắt máy → app tự về OCR.space/Gemini (không lỗi).
- **URL `trycloudflare` đổi mỗi lần chạy lại `cloudflared`** → phải cập nhật lại `SELF_OCR_URL` trên Render. Muốn URL **cố định** (không đổi) thì dùng "named tunnel" của Cloudflare (cần tài khoản Cloudflare miễn phí + 1 domain) — bảo mình hướng dẫn thêm khi cần.
- Máy càng khoẻ (RAM ≥ 4GB, có card NVIDIA càng tốt) đọc càng nhanh. Có card NVIDIA thì đặt `OCR_GPU=1` để chạy GPU.
- Ảnh gửi lên đã nhị phân hoá + nhẹ, và kết quả vẫn qua bộ dựng số + kiểm biên vùng Khánh Hòa trong app.

## Mẹo chạy gọn (tuỳ chọn)

Tạo file `chay.bat` cùng thư mục với nội dung sau, sau này chỉ cần bấm đúp:

```
@echo off
start "OCR server" cmd /k python ocr_server.py
timeout /t 8
start "Tunnel" cmd /k cloudflared tunnel --url http://localhost:8000
```
