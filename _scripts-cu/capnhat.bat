@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Cap nhat - Cam Lam Land
echo ============================================
echo   Ap dung thay doi (hot-reload, khong build)
echo ============================================
docker compose up -d
if errorlevel 1 (
  echo [X] Loi. Thu chay start.bat thay the.
  pause & exit /b 1
)
echo.
echo [OK] Da ap dung. Doi ~30 giay roi mo trinh duyet.
echo Tu lan sau, minh sua giao dien thi ban chi can F5 (khong can chay lai).
timeout /t 3 >nul
start "" http://localhost
echo.
pause
