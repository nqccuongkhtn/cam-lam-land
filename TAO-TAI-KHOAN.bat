@echo off
cd /d "%~dp0"
echo ================================================================
echo   TAO TAI KHOAN tren local (ghi thang vao database)
echo   Se tao lan luot: 1 tai khoan ADMIN + 1 tai khoan KHACH
echo   (Bo qua 1 loai: cu Enter khong nhap email)
echo ================================================================
docker ps --format "{{.Names}}" | findstr /I "camlam_backend" >nul
if errorlevel 1 ( echo [X] Server chua chay. Mo QUAN-LY-SERVER cho den xanh roi chay lai. & goto :end )

echo.
echo ====== 1) TAI KHOAN ADMIN (quan tri) ======
call :make_user admin
echo.
echo ====== 2) TAI KHOAN KHACH (nguoi dung thuong) ======
call :make_user user
goto :fin

:make_user
set "UROLE=%~1"
set "UEMAIL="
set "UPASS="
set "UNAME="
set /p UEMAIL=  Email:
if "%UEMAIL%"=="" ( echo   ^> bo qua & goto :eof )
set /p UPASS=  Mat khau (nen dung chu va so, tranh ky tu dac biet):
if "%UPASS%"=="" ( echo   ^> bo qua & goto :eof )
set /p UNAME=  Ten hien thi (Enter de bo qua):
echo   [*] Ma hoa mat khau (bcrypt)...
set "UHASH="
for /f "delims=" %%h in ('docker exec camlam_backend node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" "%UPASS%"') do set "UHASH=%%h"
if not defined UHASH ( echo   [X] Loi ma hoa mat khau. & goto :eof )
echo   [*] Ghi vao database...
docker exec camlam_postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 -c "INSERT INTO users (email, password_hash, role, full_name, email_verified) VALUES ('%UEMAIL%','%UHASH%','%UROLE%', NULLIF('%UNAME%',''), true) ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role=EXCLUDED.role, email_verified=true, full_name=COALESCE(EXCLUDED.full_name, users.full_name);"
if errorlevel 1 ( echo   [X] Loi ghi database. & goto :eof )
echo   [OK] Xong: %UEMAIL%   (role: %UROLE%)
goto :eof

:fin
echo.
echo ================================================================
echo   HOAN TAT. Dang nhap tai:
echo     http://localhost/login
echo     https://batdongsancamlam.dpdns.org/login
echo ================================================================
:end
echo.
pause
