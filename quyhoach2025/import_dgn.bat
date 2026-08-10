@echo off
chcp 65001 >nul

echo ===================================
echo  Import DGN Khanh Hoa vao PostGIS
echo ===================================
echo.

:: Tìm ogr2ogr
set OGR=
if exist "C:\OSGeo4W\bin\ogr2ogr.exe" set OGR=C:\OSGeo4W\bin\ogr2ogr.exe
if exist "C:\OSGeo4W64\bin\ogr2ogr.exe" set OGR=C:\OSGeo4W64\bin\ogr2ogr.exe
if exist "C:\Program Files\QGIS 3.36\bin\ogr2ogr.exe" set OGR=C:\Program Files\QGIS 3.36\bin\ogr2ogr.exe

if "%OGR%"=="" (
    echo [LOI] Khong tim thay ogr2ogr!
    echo Cai OSGeo4W tai: https://download.osgeo.org/osgeo4w/v2/osgeo4w-setup.exe
    echo.
    pause
    exit /b 1
)
echo [OK] Tim thay ogr2ogr: %OGR%
echo.

set PG=PG:host=localhost port=5432 dbname=bds_platform user=bds password=bds_secret
set SRS=EPSG:3148

echo [INFO] Thu muc hien tai: %CD%
echo [INFO] Cac file DGN tim thay:
dir /b *.dgn 2>nul
echo.

:: Convert quy hoach
for %%F in (QD205.dgn QD507.dgn QD893_QHSDD2030.dgn QD2076PKPB_1_2000.dgn QD2101_TT_1_2000.dgn QD2222.dgn) do (
    if exist "%%F" (
        echo [QH] Dang convert: %%F ...
        "%OGR%" -f PostgreSQL "%PG%" "%%F" -nln quy_hoach_raw -t_srs EPSG:4326 -s_srs %SRS% -skipfailures -append -nlt MULTIPOLYGON 2>&1
        echo     Xong: %%F
        echo.
    )
)

:: Convert dia chinh
for %%F in (dc1.dgn dc2.dgn dc3.dgn) do (
    if exist "%%F" (
        echo [DC] Dang convert: %%F ...
        "%OGR%" -f PostgreSQL "%PG%" "%%F" -nln dia_chinh_raw -t_srs EPSG:4326 -s_srs %SRS% -skipfailures -append -nlt MULTIPOLYGON 2>&1
        echo     Xong: %%F
        echo.
    )
)

echo.
echo ===================================
echo  HOAN THANH! Kiem tra database...
echo ===================================
docker exec bds_db psql -U bds -d bds_platform -c "SELECT 'quy_hoach_raw: ' || COUNT(*) FROM quy_hoach_raw UNION ALL SELECT 'dia_chinh_raw: ' || COUNT(*) FROM dia_chinh_raw;" 2>&1

echo.
echo Nhan phim bat ky de dong...
pause
