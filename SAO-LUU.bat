@echo off
cd /d "%~dp0"
echo ================================================================
echo   SAO LUU du lieu Cam Lam Land (database + anh tin)
echo ================================================================
docker info >nul 2>nul
if errorlevel 1 ( echo [X] Docker Desktop chua chay. Mo len roi chay lai. & goto :end )
if not exist "backup" mkdir backup
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set TS=%%i
echo [i] Dang xuat database ra file...
docker exec camlam_postgis pg_dump -U camlam camlam_gis > "backup\camlam_%TS%.sql"
if errorlevel 1 ( echo [X] Loi. Server co dang chay khong? & goto :end )
copy /y "backup\camlam_%TS%.sql" "backup\camlam_moi-nhat.sql" >nul
echo [OK] Da luu: backup\camlam_%TS%.sql

REM --- Don bot ban cu: chi giu 14 ban moi nhat ---
powershell -NoProfile -Command "Get-ChildItem 'backup\camlam_2*.sql' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force -ErrorAction SilentlyContinue"

REM --- Copy RA NGOAI MAY (may phu LAN / USB / cloud) de phong may hu ---
REM Uu tien: dich trong file backup-dich.txt (vd \\MAY-PHU\CamLamBackup); khong thi tu do cloud.
set "DEST="
if exist "backup-dich.txt" set /p DEST=<backup-dich.txt
if defined DEST if "%DEST:~0,1%"=="#" set "DEST="
if not defined DEST set "DEST=%CLOUD_BACKUP%"
if not defined DEST if defined OneDrive if exist "%OneDrive%\" set "DEST=%OneDrive%"
if not defined DEST if exist "%UserProfile%\OneDrive\" set "DEST=%UserProfile%\OneDrive"
if not defined DEST if exist "%UserProfile%\Proton Drive\" set "DEST=%UserProfile%\Proton Drive"
if not defined DEST if exist "%UserProfile%\Google Drive\" set "DEST=%UserProfile%\Google Drive"
if defined DEST (
  powershell -NoProfile -Command "try { $d='%DEST%\CamLamLand-Backup'; New-Item -ItemType Directory -Force -Path $d | Out-Null; Compress-Archive -Path 'backup\camlam_moi-nhat.sql' -DestinationPath ($d+'\camlam_moi-nhat.zip') -Force; exit 0 } catch { exit 1 }"
  if errorlevel 1 ( echo [!] Copy ra "%DEST%" THAT BAI - may phu tat / mat mang / khong co quyen? Ban tren may van con o backup\. ) else ( echo [OK] Da copy ban sao luu RA NGOAI MAY: %DEST%\CamLamLand-Backup )
) else (
  echo [!] CHUA dat noi backup ngoai may. Sua file "backup-dich.txt" tro toi may phu / USB / cloud,
  echo     neu khong hien chi luu tren may nay (chua an toan khi may hu).
)
echo.
echo Cac ban sao luu hien co (moi nhat tren cung):
dir /b /o-d backup\camlam_2*.sql 2>nul
echo.
:end
if /I not "%~1"=="/auto" pause
