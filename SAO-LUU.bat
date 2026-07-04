@echo off
cd /d "%~dp0"
echo ================================================================
echo   SAO LUU du lieu web ra file (o D:\Cam Lam gis\backup)
echo ================================================================
docker info >nul 2>nul
if errorlevel 1 ( echo [X] Docker Desktop chua chay. Mo len roi chay lai. & pause & exit /b 1 )
if not exist "backup" mkdir backup
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set TS=%%i
echo [i] Dang xuat database (ke ca anh tin) ra file...
docker exec camlam_postgis pg_dump -U camlam camlam_gis > "backup\camlam_%TS%.sql"
if errorlevel 1 ( echo [X] Loi. Server co dang chay khong ^(start.bat / CHAY-SERVER.bat^)? & pause & exit /b 1 )
copy /y "backup\camlam_%TS%.sql" "backup\camlam_moi-nhat.sql" >nul
echo [OK] Da luu: backup\camlam_%TS%.sql
echo      ^(va ban moi nhat: backup\camlam_moi-nhat.sql^)
echo.
echo Cac ban sao luu hien co:
dir /b /o-d backup\*.sql
echo.
echo [!] Nen copy thu muc "backup" ra USB / cloud dinh ky cho chac.
pause
