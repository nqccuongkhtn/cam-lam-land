@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal enabledelayedexpansion
echo ================================================================
echo   MO PHAN MEM CHUAN HOA DGN (qua moi truong OSGeo4W)
echo ================================================================

set "O4W="

rem --- 1) Thu cac duong dan pho bien ---
for %%D in ("C:\OSGeo4W" "C:\OSGeo4W64" "C:\Program Files\OSGeo4W" "D:\OSGeo4W" "E:\OSGeo4W") do (
  if exist "%%~D\bin\o4w_env.bat" set "O4W=%%~D"
)

rem --- 2) Neu chua thay: DO TU DONG qua shortcut "OSGeo4W Shell" trong Start Menu ---
if "!O4W!"=="" (
  echo -- Dang tu dong do vi tri cai OSGeo4W...
  for %%L in (
    "%APPDATA%\Microsoft\Windows\Start Menu\Programs\OSGeo4W\OSGeo4W Shell.lnk"
    "%ProgramData%\Microsoft\Windows\Start Menu\Programs\OSGeo4W\OSGeo4W Shell.lnk"
  ) do (
    if exist "%%~L" (
      for /f "usebackq delims=" %%R in (`powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%%~L'); $d=Split-Path $s.TargetPath; if(-not $d){$d=$s.WorkingDirectory}; while($d -and -not (Test-Path (Join-Path $d 'bin\o4w_env.bat'))){$p=Split-Path $d; if($p -eq $d){break}; $d=$p}; if($d){Write-Output $d}"`) do set "O4W=%%R"
    )
  )
)

if "!O4W!"=="" (
  echo.
  echo [!] Van khong tim thay OSGeo4W tu dong.
  echo     Cach chac chan: mo "OSGeo4W Shell" tu Start Menu roi go 3 dong:
  echo        cd /d "%~dp0"
  echo        python3 -m pip install shapely
  echo        python3 ChuanHoaDGN.py
  echo.
  pause & exit /b 1
)
echo Dung OSGeo4W tai: !O4W!
echo.

call "!O4W!\bin\o4w_env.bat"

echo -- Kiem tra/cai Shapely...
python3 -c "import shapely" 1>nul 2>nul
if errorlevel 1 ( python3 -m pip install shapely )

echo.
echo -- Mo phan mem...
python3 "%~dp0ChuanHoaDGN.py"
if errorlevel 1 (
  echo.
  echo === Co loi. Chup man hinh gui lai de duoc ho tro. ===
  pause
)
endlocal
