@echo off
cd /d "%~dp0"
echo ================================================================
echo   KEO TAI KHOAN tu Render QUA RENDER CLI (cong 443 - khong bi chan)
echo   - Chi THEM email chua co o local, GIU NGUYEN du lieu local
echo ================================================================
docker ps --format "{{.Names}}" | findstr /I "camlam_postgis" >nul
if errorlevel 1 ( echo [X] Server local chua chay. Bat QUAN-LY-SERVER truoc roi chay lai. & goto :end )

set "RENDER="
where render >nul 2>nul && set "RENDER=render"
if not defined RENDER if exist "render.exe" set "RENDER=render.exe"
if not defined RENDER (
  echo [X] Chua co Render CLI ^(render.exe^). Lam 1 lan:
  echo     1^) Tai tai: https://github.com/render-oss/cli/releases
  echo        - chon file ten dang: cli_..._windows_amd64.zip
  echo     2^) Giai nen -^> copy "render.exe" vao THU MUC NAY: %~dp0
  echo     3^) Mo CMD o thu muc nay, chay:   render.exe login
  echo        -^> trinh duyet mo ra, bam "Authorize CLI"
  echo     4^) Chay lai file nay.
  goto :end
)

echo [1/4] Xuat tai khoan tu Render (qua CLI)...
%RENDER% psql camlam-db -c "SELECT email,password_hash,role,full_name,phone,email_verified FROM users" -o text -- --csv -t > "%~dp0render_users.csv" 2>"%~dp0render_err.txt"
if errorlevel 1 (
  echo [X] Loi khi chay render psql. Kiem tra:
  echo     - Da chay "%RENDER% login" chua?
  echo     - Ten database co phai "camlam-db" khong? Neu khong, mo file bat sua lai.
  echo --- chi tiet loi ---
  type "%~dp0render_err.txt"
  goto :end
)

echo [2/4] Nap vao vung tam...
docker cp "%~dp0render_users.csv" camlam_postgis:/tmp/render_users.csv >nul
docker exec camlam_postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS _render_users_stage; CREATE TABLE _render_users_stage (email text, password_hash text, role text, full_name text, phone text, email_verified boolean);"
docker exec camlam_postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 -c "\copy _render_users_stage FROM '/tmp/render_users.csv' WITH CSV"
if errorlevel 1 ( echo [X] Loi nap file. Mo render_users.csv xem co du lieu khong. & goto :end )

for /f %%n in ('docker exec camlam_postgis psql -U camlam -d camlam_gis -t -A -c "SELECT count(*) FROM users;"') do set BEFORE=%%n
for /f %%n in ('docker exec camlam_postgis psql -U camlam -d camlam_gis -t -A -c "SELECT count(*) FROM _render_users_stage;"') do set FROMR=%%n

echo [3/4] Gop vao web (chi them email chua co)...
docker exec camlam_postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 -c "INSERT INTO users (email,password_hash,role,full_name,phone,email_verified) SELECT s.email,s.password_hash,s.role,s.full_name,s.phone,COALESCE(s.email_verified,true) FROM _render_users_stage s WHERE NOT EXISTS (SELECT 1 FROM users u WHERE lower(u.email)=lower(s.email));"

for /f %%n in ('docker exec camlam_postgis psql -U camlam -d camlam_gis -t -A -c "SELECT count(*) FROM users;"') do set AFTER=%%n
echo [4/4] Don dep...
docker exec camlam_postgis psql -U camlam -d camlam_gis -c "DROP TABLE IF EXISTS _render_users_stage;" >nul 2>nul
del "%~dp0render_users.csv" "%~dp0render_err.txt" >nul 2>nul

set /a ADDED=%AFTER%-%BEFORE%
echo.
echo ================================================================
echo   [OK] XONG!  Tai khoan tu Render: %FROMR%
echo        Da THEM MOI vao web local: %ADDED%   -   Tong local: %AFTER%
echo ================================================================
:end
echo.
pause
