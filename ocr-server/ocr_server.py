# -*- coding: utf-8 -*-
# ============================================================================
#  MÁY OCR NỘI BỘ cho Cam Lâm Land  —  EasyOCR + FastAPI
#  Đọc bảng toạ độ VN-2000 mạnh, miễn phí, KHÔNG giới hạn lượt, chạy trên PC của bạn.
#
#  CÀI (mở CMD/PowerShell trong thư mục này, chạy 1 lần):
#     pip install easyocr fastapi "uvicorn[standard]" pillow python-multipart numpy
#
#  CHẠY:
#     python ocr_server.py
#  (Lần đầu sẽ tải model ~vài trăm MB — chờ tới khi thấy "Uvicorn running on ...".)
#
#  KIỂM TRA: mở trình duyệt vào  http://localhost:8000/health  -> {"status":"ok"}
#
#  (Tuỳ chọn) đặt mật khẩu bảo vệ trước khi chạy:
#     Windows CMD:        set OCR_TOKEN=chuoi-bi-mat-cua-ban && python ocr_server.py
#     Windows PowerShell: $env:OCR_TOKEN="chuoi-bi-mat-cua-ban"; python ocr_server.py
#     -> rồi đặt biến SELF_OCR_TOKEN trên Render TRÙNG với chuỗi này.
# ============================================================================
import io
import os
import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File, Header, HTTPException
import easyocr
import uvicorn

TOKEN = os.environ.get("OCR_TOKEN", "")          # để trống = không cần mật khẩu
USE_GPU = os.environ.get("OCR_GPU", "0") == "1"  # đặt OCR_GPU=1 nếu máy có card NVIDIA + CUDA

print("[ocr] Đang nạp model EasyOCR (lần đầu sẽ tải về, chờ chút)...")
reader = easyocr.Reader(["en"], gpu=USE_GPU)     # 'en' đọc số/latin rất tốt cho bảng toạ độ
print("[ocr] Model sẵn sàng. Server sắp chạy ở cổng 8000.")

app = FastAPI(title="Cam Lam Land - Máy OCR nội bộ")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def do_ocr(file: UploadFile = File(...), x_token: str = Header(default="")):
    if TOKEN and x_token != TOKEN:
        raise HTTPException(status_code=401, detail="Sai token")
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    arr = np.array(img)
    # Chỉ nhận số + dấu (bảng toạ độ) -> bớt đọc nhầm chữ.
    lines = reader.readtext(
        arr,
        detail=0,
        allowlist="0123456789.,-: ",
        decoder="beamsearch",   # chính xác hơn greedy
        text_threshold=0.6,
        low_text=0.3,
        mag_ratio=1.5,          # phóng to để bắt chữ số nhỏ rõ hơn
    )
    text = "\n".join(str(x) for x in lines if str(x).strip())
    print(f"[ocr] Đọc được {len(lines)} vùng số.")
    return {"text": text}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
