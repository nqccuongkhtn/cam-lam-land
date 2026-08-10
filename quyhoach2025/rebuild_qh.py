# -*- coding: utf-8 -*-
# DUNG LAI lop QH GIU DUONG CONG tu QD205_smooth.geojson -> xuat qh_vector_v2.geojson (WGS84).
# Chay trong QGIS: Plugins -> Python Console -> go:
#   exec(open(r'D:\hau\PHONGKINHTE\quyhoach2025\rebuild_qh.py', encoding='utf-8').read())
from qgis.core import QgsVectorLayer, QgsCoordinateReferenceSystem
import processing, traceback
# Bo qua kiem tra geometry loi (co 1 vai net loi) de polygonize khong dung.
try:
    from processing.core.ProcessingConfig import ProcessingConfig
    ProcessingConfig.setSettingValue(ProcessingConfig.FILTER_INVALID_GEOMETRIES, 1)  # 1 = BO QUA net loi (khong crash)
except Exception:
    pass

SMOOTH = r'D:\hau\PHONGKINHTE\quyhoach2025\camlamland\QD205_smooth.geojson'
QHVEC  = r'D:\Cam Lam gis\apps\frontend\public\qh_vector.geojson'
OUT    = r'D:\Cam Lam gis\apps\frontend\public\qh_vector_v5.geojson'
LOG    = r'D:\hau\PHONGKINHTE\quyhoach2025\rebuild_done.txt'
VN2000 = ('+proj=tmerc +lat_0=0 +lon_0=108.25 +k=0.9999 +x_0=500000 +y_0=0 '
          '+a=6378137 +rf=298.257223563 '
          '+towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 '
          '+units=m +no_defs')

def log(s):
    try:
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write(str(s) + '\n')
    except Exception:
        pass
    print(s)

try:
    with open(LOG, 'w', encoding='utf-8') as f:
        f.write('BAT DAU\n')

    # 1) Nap ranh (LineString) + gan CRS VN2000 + loc level dat (co chua 'DAT')
    lines = QgsVectorLayer(SMOOTH, 'ranh', 'ogr')
    if not lines.isValid():
        log('LOI: khong mo duoc QD205_smooth.geojson'); raise SystemExit
    lines.setCrs(QgsCoordinateReferenceSystem.fromProj(VN2000))
    # CHI lay lop QUY HOACH (QH*/DAT*) + duong (TRAFFIC), BO lop Hien trang (HT_*) de HT khong che doi o QH.
    lines.setSubsetString('"Layer" LIKE \'QH%\' OR "Layer" LIKE \'DAT%\' OR "Layer" LIKE \'%TRAFFIC%\'')
    log('1) ranh QH+duong (bo HT): %d duong' % lines.featureCount())

    # 1b) SUA geometry loi truoc (tranh crash polygonize). Vat hoa ranh ve 1 lop sach.
    fixed = processing.run('native:fixgeometries',
        {'INPUT': lines, 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    log('1b) fixgeometries: %d duong sach' % fixed.featureCount())

    # 1c) SNAP khep khe ho dau net (loi CAD) — dung nhu gCadas 'sua loi + tao vung'. Tolerance 2m (dang o VN2000).
    try:
        snapped = processing.run('native:snapgeometries',
            {'INPUT': fixed, 'REFERENCE_LAYER': fixed, 'TOLERANCE': 2.0, 'BEHAVIOR': 0,
             'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
        log('1c) snap khep khe: %d duong' % snapped.featureCount())
    except Exception as _e:
        snapped = fixed; log('1c) snap loi (bo qua): ' + repr(_e))

    # 2) Polygonize -> vung kin (QD205_smooth da stroke cung 0.25 do nen GIU DUONG CONG)
    poly = processing.run('native:polygonize',
        {'INPUT': snapped, 'KEEP_FIELDS': False, 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    log('2) polygonize: %d vung' % poly.featureCount())

    # 3) Reproject sang WGS84 (de join voi qh_vector 4326 + dung cho web)
    poly4326 = processing.run('native:reprojectlayer',
        {'INPUT': poly, 'TARGET_CRS': QgsCoordinateReferenceSystem('EPSG:4326'),
         'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']

    # 4) Xuat mang THO (khong join) — Claude tu gan loai o sandbox cho chinh xac (tranh mask nuot loai)
    processing.run('native:savefeatures', {'INPUT': poly4326, 'OUTPUT': OUT})
    log('4) XONG (mang tho) -> %s' % OUT)
    log('DONE_OK')
except SystemExit:
    pass
except Exception as e:
    log('LOI: ' + repr(e))
    log(traceback.format_exc())
