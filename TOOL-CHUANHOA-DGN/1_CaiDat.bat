@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================================
echo   BUOC 1 - CAI DAT cho phan mem Chuan Hoa DGN
echo ================================================================
echo.
where py >nul 2>nul && (set PY=py) || (set PY=python)
%PY% --version
echo.
echo -- Cai Shapely + tkintermapview (ban do NHUNG) + tkinterdnd2 (keo-tha file)...
%PY% -m pip install --upgrade pip
%PY% -m pip install shapely
%PY% -m pip install tkintermapview
%PY% -m pip install tkinterdnd2
%PY% -m pip install requests
echo.
echo -- Kiem tra GDAL (ogr2ogr)...
where ogr2ogr >nul 2>nul
if %errorlevel%==0 (
  echo    [OK] Da co GDAL ^(ogr2ogr^) tren may. San sang chay!
  echo.
  echo ================================================================
  echo   XONG! Bam  ChuanHoaDGN.bat  de mo phan mem.
  echo ================================================================
) else (
  echo    [!] CHUA co GDAL binary. LUU Y: KHONG dung "pip install gdal"
  echo        vi no build tu source va SE LOI tren Windows.
  echo.
  echo   Chon MOT trong 2 cach cai GDAL ^(chac an, khong loi^):
  echo.
  echo   CACH A - OSGeo4W ^(de nhat, co giao dien^):
  echo     1^) Tai OSGeo4W tai:  https://trac.osgeo.org/osgeo4w/
  echo     2^) Cai goi "gdal". Xong mo lai cua so nay.
  echo.
  echo   CACH B - Miniconda ^(gon^):
  echo     1^) Cai Miniconda:  https://docs.conda.io/en/latest/miniconda.html
  echo     2^) Mo "Anaconda Prompt" go:
  echo          conda install -c conda-forge gdal shapely
  echo     3^) Chay phan mem bang chinh python cua conda do.
  echo.
  echo   Sau khi cai xong, chay lai file nay de kiem tra.
)
echo.
pause
