@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal enabledelayedexpansion
echo ================================================================
echo   TAO FILE ChuanHoaDGN.exe (bam-la-chay)
echo   Chay sau khi da: pip install shapely (BUOC 1) thanh cong.
echo ================================================================
echo.
where py >nul 2>nul && (set PY=py) || (set PY=python)

echo -- Cai PyInstaller...
%PY% -m pip install pyinstaller
echo.

set "COLLECT=--collect-all shapely"
%PY% -c "import osgeo" 1>nul 2>nul
if not errorlevel 1 (
  set "COLLECT=!COLLECT! --collect-all osgeo"
  echo    [i] Co osgeo binding  -^>  goi ca GDAL vao EXE ^(chay tren may khac duoc^).
) else (
  echo    [i] Khong co osgeo  -^>  EXE se dung ogr2ogr cua OSGeo4W tren may co cai OSGeo4W.
)
echo.
echo -- Dong goi... ^(mat 2-5 phut^)
%PY% -m PyInstaller --noconfirm --onefile --console --name ChuanHoaDGN --paths . --hidden-import gui !COLLECT! ChuanHoaDGN.py
echo.
if exist "dist\ChuanHoaDGN.exe" (
  echo ================================================================
  echo   XONG!  File EXE o:   %~dp0dist\ChuanHoaDGN.exe
  echo   -^> Bam dup de chay. Co the copy CA THU MUC "dist" sang may khac.
  echo   -^> DGN V8 van can cai ODA File Converter rieng.
  echo ================================================================
) else (
  echo !! Chua tao duoc EXE. Kiem tra BUOC 1 ^(pip install shapely^) va loi ben tren.
)
pause
endlocal
