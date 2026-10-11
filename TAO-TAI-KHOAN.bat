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
rem 11/10/2026: DAT LAI mat khau = THU HOI moi quyen vao cu cua tai khoan nay
rem   1. xoa moi khoa van tay / khuon mat - Face ID tren may cu khong dang nhap thay mat khau moi duoc nua
rem   2. tang doi phien dang nhap - moi the dang nhap cu tren dien thoai / may tinh khac bi tu choi ngay
rem   Chay rieng tung lenh, loi thi bo qua: tai khoan van da tao / doi mat khau xong o tren.
docker exec camlam_postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 -c "DELETE FROM webauthn_credentials WHERE user_id IN (SELECT id FROM users WHERE email='%UEMAIL%');" >nul 2>&1
if errorlevel 1 ( echo   [!] Chua tat duoc dang nhap bang van tay - khuon mat cua tai khoan nay ) else ( echo   [OK] Da tat dang nhap bang van tay / khuon mat cu cua tai khoan nay )
docker exec camlam_postgis psql -U camlam -d camlam_gis -v ON_ERROR_STOP=1 -c "UPDATE users SET phien_dang_nhap = phien_dang_nhap + 1, doi_mat_khau_luc = now() WHERE email='%UEMAIL%';" >nul 2>&1
if errorlevel 1 ( echo   [!] Chua dang xuat duoc cac thiet bi cu - can cap nhat backend roi chay lai ) else ( echo   [OK] Da dang xuat tai khoan nay khoi moi thiet bi cu - trong vong 30 giay )
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
