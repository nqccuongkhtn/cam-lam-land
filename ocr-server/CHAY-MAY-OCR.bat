@echo off
chcp 65001 >nul
title May OCR noi bo - Cam Lam Land
cd /d "%~dp0"

echo ============================================
echo    MAY OCR NOI BO - Cam Lam Land
echo ============================================
echo.

REM ---- 1) Kiem tra Python ----
where python >nul 2>nul
if errorlevel 1 (
  echo [X] May chua co Python.
  echo     Dang mo trang tai Python...
  start "" https://www.python.org/downloads/
  echo.
  echo     Hay cai Python 3.10 hoac 3.11
  echo     ^(NHO TICK o "Add Python to PATH"^),
  echo     roi bam lai file nay.
  echo.
  pause
  exit /b
)

REM ---- 2) Cai thu vien lan dau ----
if not exist ".deps_ok" (
  echo [*] Lan dau: dang cai thu vien OCR ^(hoi lau, cho chut^)...
  python -m pip install --upgrade pip
  python -m pip install easyocr fastapi "uvicorn[standard]" pillow python-multipart numpy
  if errorlevel 1 (
    echo [X] Cai thu vien bi loi. Xem thong bao ben tren.
    pause
    exit /b
  )
  echo ok> .deps_ok
) else (
  echo [*] Thu vien da san sang.
)

REM ---- 3) Tai cloudflared neu chua co ----
if not exist "cloudflared.exe" (
  echo [*] Dang tai cloudflared...
  powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
  if not exist "cloudflared.exe" (
    echo [X] Tai cloudflared that bai. Kiem tra mang roi thu lai.
    pause
    exit /b
  )
)

REM ---- 4) Bat may OCR ----
echo [*] Dang khoi dong may OCR ^(cua so 1^)...
start "MAY OCR (giu mo)" cmd /k python ocr_server.py

REM ---- 5) Cho server len roi mo duong ham ----
echo [*] Cho may OCR san sang...
timeout /t 12 /nobreak >nul
echo [*] Dang mo duong ham ra Internet ^(cua so 2^)...
start "DUONG HAM INTERNET (giu mo)" cmd /k cloudflared.exe tunnel --url http://localhost:8000

echo.
echo ============================================
echo   XONG!
echo   1) Nhin cua so "DUONG HAM INTERNET"
echo   2) Copy dong URL:  https://....trycloudflare.com
echo   3) Dan vao bien SELF_OCR_URL tren Render, Save.
echo.
echo   * Giu 2 cua so kia MO thi may OCR moi chay.
echo   * Tat may OCR: chi can dong 2 cua so do.
echo ============================================
echo.
pause
