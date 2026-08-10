@echo off
cd /d "%~dp0"
echo ================================================================
echo   KEO TAI KHOAN nguoi dung tu RENDER ve (gop vao web local)
echo   - Chi THEM tai khoan co email CHUA co o local
echo   - GIU NGUYEN moi du lieu local (khong xoa, khong ghi de)
echo ================================================================
docker info >nul 2>nul
if errorlevel 1 ( echo [X] Docker Desktop chua chay. Mo len roi chay lai. & goto :end )
docker ps --format "{{.Names}}" | findstr /I "camlam_postgis" >nul
if errorlevel 1 ( echo [X] Server chua chay. Bam CHAY-SERVER / QUAN-LY-SERVER truoc roi chay lai. & goto :end )
echo.
echo Lay chuoi ket noi tren Render:
echo    Dashboard -^> camlam-db -^> Connect -^> "External Database URL"
echo    (dang: postgresql://user:matkhau@dpg-xxxx.singapore-postgres.render.com/tendb)
echo.
set /p RURL=Dan External Database URL vao day roi Enter:
if "%RURL%"=="" ( echo Da huy. & goto :end )
echo.
set TRY=0
:retry_export
set /a TRY+=1
echo [1/4] Xuat tai khoan tu Render (lan %TRY%/5, ep SSL)...
docker exec -e PGSSLMODE=require -e PGCONNECT_TIMEOUT=30 camlam_postgis psql "%RURL%" -v ON_ERROR_STOP=1 -c "\copy (SELECT email, password_hash, role, full_name, phone, email_verified FROM users) TO '/tmp/render_users.csv' WITH CSV"
if not errorlevel 1 goto export_ok
if %TRY% LSS 5 ( echo     [!] Chua duoc, thu lai sau 3 giay... & timeout /t 3 /nobreak >nul & goto retry_export )
echo [X] Ket noi Render that bai sau 5 lan (mang toi Render chap chon hoac bi chan cong 5432).
echo     -^> Bao lai cho toi, minh chuyen sang Render CLI (di qua cong 443, khong bi chan).
goto :end
:export_ok
echo [OK] Xuat tai khoan thanh cong.

echo [2/4] Nap vao vung tam...
docker exec camlam_postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS _render_users_stage; CREATE TABLE _render_users_stage (email text, password_hash text, role text, full_name text, phone text, email_verified boolean);"
if errorlevel 1 ( echo [X] Loi tao bang tam. & goto :end )
docker exec camlam_postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 -c "\copy _render_users_stage FROM '/tmp/render_users.csv' WITH CSV"
if errorlevel 1 ( echo [X] Loi nap file tam. & goto :end )

for /f %%n in ('docker exec camlam_postgis psql -U camlam -d camlam_gis -t -A -c "SELECT count(*) FROM users;"') do set BEFORE=%%n
for /f %%n in ('docker exec camlam_postgis psql -U camlam -d camlam_gis -t -A -c "SELECT count(*) FROM _render_users_stage;"') do set FROMR=%%n

echo [3/4] Gop vao web (chi them email chua co)...
docker exec camlam_postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 -c "INSERT INTO users (email, password_hash, role, full_name, phone, email_verified) SELECT s.email, s.password_hash, s.role, s.full_name, s.phone, COALESCE(s.email_verified,true) FROM _render_users_stage s WHERE NOT EXISTS (SELECT 1 FROM users u WHERE lower(u.email)=lower(s.email));"
if errorlevel 1 ( echo [X] Loi khi gop. & goto :end )

for /f %%n in ('docker exec camlam_postgis psql -U camlam -d camlam_gis -t -A -c "SELECT count(*) FROM users;"') do set AFTER=%%n
echo [4/4] Don dep...
docker exec camlam_postgis psql -U camlam -d camlam_gis -c "DROP TABLE IF EXISTS _render_users_stage;" >nul 2>nul

set /a ADDED=%AFTER%-%BEFORE%
echo.
echo ================================================================
echo   [OK] XONG!
echo   - Tai khoan co tren Render : %FROMR%
echo   - Da THEM MOI vao web local: %ADDED%
echo   - Tong tai khoan local bay gio: %AFTER%
echo   (Email trung voi local duoc giu nguyen, khong ghi de.)
echo ================================================================
echo Nguoi dung tu Render gio dang nhap duoc o web local bang dung mat khau cu.
:end
echo.
pause
