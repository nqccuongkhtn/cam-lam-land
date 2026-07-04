@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo ================================================================
echo   Cam Lam Land - SERVER THAT (Production)
echo ================================================================

where docker >nul 2>nul
if errorlevel 1 ( echo [X] Chua cai Docker Desktop. Tai: https://www.docker.com/products/docker-desktop/ & pause & exit /b 1 )
docker info >nul 2>nul
if errorlevel 1 ( echo [X] Docker Desktop chua chay. Mo len, doi "Engine running" roi chay lai. & pause & exit /b 1 )

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo [i] Da tao .env. HAY dat JWT_SECRET, ADMIN_PASSWORD, POSTGRES_PASSWORD, (va TUNNEL_TOKEN neu co domain).
  notepad .env
  pause & exit /b 0
)

REM Co TUNNEL_TOKEN (khac rong) thi bat luon tunnel ra domain.
set FILES=-f docker-compose.yml -f docker-compose.prod.yml
set TOK=
for /f "tokens=1,* delims==" %%a in ('findstr /B /C:"TUNNEL_TOKEN=" ".env" 2^>nul') do set TOK=%%b
if defined TOK (
  set FILES=!FILES! -f docker-compose.tunnel.yml
  echo [i] Co TUNNEL_TOKEN -^> se bat tunnel ra domain cua ban.
) else (
  echo [i] Chua co TUNNEL_TOKEN -^> chi chay o may. Muon test qua Internet ngay: dung CHAY-THU-NHANH.bat
)

echo [i] Build + khoi dong PRODUCTION (lan dau build vai phut)...
docker compose !FILES! up -d --build
if errorlevel 1 ( echo [X] Loi khi khoi dong. Xem log o tren. & pause & exit /b 1 )

echo [i] Cho cac dich vu san sang...
powershell -NoProfile -Command "for($i=0;$i -lt 150;$i++){try{if((Invoke-WebRequest -UseBasicParsing http://localhost/api/health -TimeoutSec 2).StatusCode -eq 200){exit 0}}catch{} Start-Sleep -Seconds 3}; exit 1"
if errorlevel 1 ( echo [!] Cho hoi lau. Mo http://localhost va doi them chut. ) else ( echo [OK] San sang! )

start "" http://localhost
echo.
echo ================================================================
echo   Local:    http://localhost      Quan tri: http://localhost/admin
echo   Internet: domain cua ban ^(neu da dat TUNNEL_TOKEN^)
echo ================================================================
echo Server chay nen 24/7 ^(Docker tu bat lai khi mo may^). TAT: chay TAT-SERVER.bat
echo.
pause
