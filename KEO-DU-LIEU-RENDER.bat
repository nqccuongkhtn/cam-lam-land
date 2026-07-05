@echo off
setlocal
cd /d "%~dp0"
echo ================================================================
echo   KEO du lieu THAT tu Render ve may (thay the du lieu local)
echo ================================================================
docker info >nul 2>nul
if errorlevel 1 ( echo [X] Docker Desktop chua chay. Mo len roi chay lai. & pause & exit /b 1 )
docker ps --format "{{.Names}}" | findstr /C:"camlam_postgis" >nul
if errorlevel 1 ( echo [X] Chua chay server o may. Bam CHAY-SERVER.bat truoc, doi hien http://localhost roi quay lai. & pause & exit /b 1 )
echo.
echo [i] Lay chuoi ket noi tren Render:
echo     Dashboard  -^>  camlam-db  -^>  Connect  -^>  "External Database URL"
echo     (dang: postgresql://user:matkhau@dpg-xxxx.singapore-postgres.render.com/tendb)
echo.
set /p RURL=Dan External Database URL vao day roi Enter:
if "%RURL%"=="" ( echo Da huy. & pause & exit /b 0 )
echo.
echo [!] CANH BAO: se GHI DE toan bo du lieu local bang du lieu tu Render.
set /p OK=Go "yes" de tiep tuc:
if /I not "%OK%"=="yes" ( echo Da huy. & pause & exit /b 0 )

if not exist "backup" mkdir backup
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set TS=%%i
set DUMP=backup\render_%TS%.sql

echo.
echo [1/5] Tai du lieu tu Render (vai phut neu nhieu anh)...
docker exec camlam_postgis pg_dump --no-owner --no-privileges "%RURL%" > "%DUMP%"
if errorlevel 1 ( echo [X] Loi tai tu Render. Kiem tra lai chuoi ket noi ^(neu bao SSL, them ?sslmode=require vao cuoi URL^). & pause & exit /b 1 )
for %%A in ("%DUMP%") do if %%~zA LSS 1000 ( echo [X] File tai ve qua nho -^> co the sai URL. Xem file "%DUMP%". & pause & exit /b 1 )

echo [2/5] Tam dung backend va worker...
docker stop camlam_backend camlam_gis_worker >nul 2>nul

echo [3/5] Tao lai database o may...
docker exec camlam_postgis psql -U camlam -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='camlam_gis' AND pid<>pg_backend_pid();" >nul 2>nul
docker exec camlam_postgis psql -U camlam -d postgres -c "DROP DATABASE IF EXISTS camlam_gis;"
docker exec camlam_postgis psql -U camlam -d postgres -c "CREATE DATABASE camlam_gis;"

echo [4/5] Nap du lieu Render vao may...
docker exec -i camlam_postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=0 < "%DUMP%" >nul

echo [5/5] Khoi dong lai backend va worker...
docker start camlam_backend camlam_gis_worker >nul

echo.
echo [OK] XONG! Du lieu that tu Render da ve may.
echo      Ban sao luu file: %DUMP%
echo      Mo http://localhost de kiem tra du lieu.
pause
