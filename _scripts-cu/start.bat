@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo ================================================
echo   Cam Lam Land - GIS + Bat dong san (tu dong)
echo ================================================

where docker >nul 2>nul
if errorlevel 1 (
  echo [X] Chua cai Docker Desktop.
  echo     Tai tai: https://www.docker.com/products/docker-desktop/
  echo     Cai xong, mo Docker Desktop roi chay lai file nay.
  pause & exit /b 1
)
docker info >nul 2>nul
if errorlevel 1 (
  echo [X] Docker Desktop chua chay. Hay mo Docker Desktop, doi bao "Engine running" roi chay lai.
  pause & exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo [i] Da tao file .env tu .env.example
)

echo [i] Dang build va khoi dong (lan dau se tai image, vui long doi vai phut)...
docker compose up --build -d
if errorlevel 1 ( echo [X] Loi khi khoi dong. Xem log o tren. & pause & exit /b 1 )

echo [i] Cho cac dich vu san sang...
powershell -NoProfile -Command "for($i=0;$i -lt 90;$i++){try{if((Invoke-WebRequest -UseBasicParsing http://localhost/api/health -TimeoutSec 2).StatusCode -eq 200){exit 0}}catch{} Start-Sleep -Seconds 3}; exit 1"
if errorlevel 1 (
  echo [!] Cho hoi lau hon binh thuong. Cu mo http://localhost va doi them chut.
) else (
  echo [OK] San sang!
)

start "" http://localhost
echo.
echo ================================================
echo   Web:   http://localhost
echo   Ban do quy hoach: http://localhost/map
echo   Quan tri:         http://localhost/admin  (admin@camlam.local / admin12345)
echo ================================================
echo Dang hien log. Nhan Ctrl+C de thoat log (he thong VAN chay nen).
echo De TAT han: chay file stop.bat
echo.
docker compose logs -f
