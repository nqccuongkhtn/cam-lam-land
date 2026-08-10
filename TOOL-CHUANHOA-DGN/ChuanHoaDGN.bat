@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Dang mo phan mem Chuan hoa DGN...
where py >nul 2>nul
if %errorlevel%==0 ( py ChuanHoaDGN.py ) else ( python ChuanHoaDGN.py )
if errorlevel 1 (
  echo.
  echo === Co loi. Kiem tra: da cai Python + GDAL + Shapely chua? Xem README.md ===
  pause
)
