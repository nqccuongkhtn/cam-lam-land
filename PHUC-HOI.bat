@echo off
cd /d "%~dp0"
echo ================================================================
echo   PHUC HOI du lieu tu ban sao luu (backup\camlam_moi-nhat.sql)
echo ================================================================
docker info >nul 2>nul
if errorlevel 1 ( echo [X] Docker Desktop chua chay. & pause & exit /b 1 )
if not exist "backup\camlam_moi-nhat.sql" ( echo [X] Chua co file backup\camlam_moi-nhat.sql. Chay SAO-LUU.bat truoc. & pause & exit /b 1 )
echo [!] CANH BAO: se ghi du lieu tu ban sao luu vao database dang chay.
set /p OK=Go "yes" de tiep tuc:
if /I not "%OK%"=="yes" ( echo Da huy. & pause & exit /b 0 )
echo [i] Dang phuc hoi...
docker exec -i camlam_postgis psql -U camlam camlam_gis < "backup\camlam_moi-nhat.sql"
echo [OK] Xong. Neu can, chay lai CHAY-SERVER.bat.
pause
