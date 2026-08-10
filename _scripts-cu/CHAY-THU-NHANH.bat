@echo off
setlocal
cd /d "%~dp0"
echo ================================================================
echo   Tao LINK TAM THOI de test tu Internet - KHONG can domain
echo ================================================================
echo.

REM 1) Docker da cai chua?
where docker >nul 2>nul
if errorlevel 1 (
  echo [X] Chua cai Docker Desktop.
  echo     Tai: https://www.docker.com/products/docker-desktop/
  goto :end
)

REM 2) Docker Desktop dang chay chua?
docker info >nul 2>nul
if errorlevel 1 (
  echo [X] Docker Desktop CHUA chay.
  echo     Mo Docker Desktop, doi bao "Engine running" roi chay lai file nay.
  goto :end
)

REM 3) Web o may da bat chua? (can chay start.bat hoac CHAY-SERVER.bat truoc)
echo [i] Kiem tra web o may (http://localhost)...
powershell -NoProfile -Command "try{if((Invoke-WebRequest -UseBasicParsing http://localhost/api/health -TimeoutSec 3).StatusCode -eq 200){exit 0}}catch{}; exit 1"
if errorlevel 1 (
  echo [X] Web o may CHUA chay. Hay chay start.bat ^(hoac CHAY-SERVER.bat^) truoc,
  echo     doi hien http://localhost roi quay lai chay file nay.
  goto :end
)
echo [OK] Web o may dang chay.
echo.

REM 4) Tai truoc image cloudflared (lan dau)
echo [i] Tai cloudflared (lan dau vai giay)...
docker pull cloudflare/cloudflared:latest

echo.
echo ================================================================
echo   GIU CUA SO NAY MO. Ben duoi se hien 1 dong dang:
echo     ^|  https://ten-ngau-nhien.trycloudflare.com  ^|
echo   Copy link do gui cho nguoi khac xem thu.
echo   ^(Link doi moi lan chay, chi de TEST. Dong cua so = tat link.^)
echo ================================================================
echo.
powershell -NoProfile -Command "docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:80 2>&1 | ForEach-Object { if($_ -match 'https://[-a-z0-9]+\.trycloudflare\.com'){ Write-Host ''; Write-Host '==================== LINK WEB CUA BAN ====================' -ForegroundColor Green; Write-Host ('   ' + $Matches[0]) -ForegroundColor Yellow; Write-Host '=========================================================' -ForegroundColor Green; Write-Host '' } else { Write-Host $_ } }"

echo.
echo [i] Tunnel da dung.
:end
echo.
pause
