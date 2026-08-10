# -*- coding: utf-8 -*-
# POLYGONIZE MÉP ĐƯỜNG (giữ cung) -> đa giác đường vector CHÍNH XÁC (khớp CAD Flood 100%).
# Bản QD205_smooth đã STROKE cung (0.25°) nên polygonize GIỮ NGUYÊN đường cong, KHÔNG bẻ thẳng.
# Chạy trong QGIS: Plugins -> Python Console -> gõ:
#   exec(open(r'D:\Cam Lam gis\scripts\qh-pipeline\polygonize_roads.py', encoding='utf-8').read())
#
# Xuất (WGS84) vào apps/backend/data:
#   road_faces.geojson       — TẤT CẢ mảnh kín từ mép đường (Claude lọc mảnh-đường bằng mask ở sandbox)
#   road_centerlines.geojson — tim đường (để đối chiếu phân loại)
from qgis.core import QgsVectorLayer, QgsCoordinateReferenceSystem
import processing, traceback

SMOOTH = r'D:\hau\PHONGKINHTE\quyhoach2025\camlamland\QD205_smooth.geojson'
OUT_F  = r'D:\Cam Lam gis\apps\backend\data\road_faces.geojson'
OUT_C  = r'D:\Cam Lam gis\apps\backend\data\road_centerlines.geojson'
LOG    = r'D:\hau\PHONGKINHTE\quyhoach2025\polygonize_roads_done.txt'
VN2000 = ('+proj=tmerc +lat_0=0 +lon_0=108.25 +k=0.9999 +x_0=500000 +y_0=0 '
          '+a=6378137 +rf=298.257223563 '
          '+towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 '
          '+units=m +no_defs')

try:
    from processing.core.ProcessingConfig import ProcessingConfig
    ProcessingConfig.setSettingValue(ProcessingConfig.FILTER_INVALID_GEOMETRIES, 1)  # bỏ qua net lỗi (không crash)
except Exception:
    pass

def log(s):
    try:
        with open(LOG, 'a', encoding='utf-8') as f: f.write(str(s) + '\n')
    except Exception: pass
    print(s)

try:
    open(LOG, 'w', encoding='utf-8').write('BAT DAU\n')

    # 1) Nạp MÉP ĐƯỜNG (chỉ TRAFFIC-PAVEMENT) + gán CRS VN2000
    lines = QgsVectorLayer(SMOOTH, 'net', 'ogr')
    if not lines.isValid():
        log('LOI: khong mo duoc QD205_smooth.geojson'); raise SystemExit
    lines.setCrs(QgsCoordinateReferenceSystem.fromProj(VN2000))
    # ĐỦ lớp RANH để khép kín toàn bộ không gian (đất + đường): mép đường + ranh sử dụng đất + ranh phân khu.
    # KHÔNG đưa tim đường vào polygonize (để lòng đường là 1 mảnh liền, không bị xẻ đôi).
    lines.setSubsetString('"Layer" LIKE \'%TRAFFIC-PAVEMENT%\' '
                          'OR "Layer" LIKE \'%BO SU DUNG DAT%\' '
                          'OR "Layer" LIKE \'%RANH PHAN KHU%\' '
                          'OR "Layer" LIKE \'%NET SU DUNG DAT%\'')
    log('1) ranh (mep duong + su dung dat + phan khu): %d duong' % lines.featureCount())

    # 1b) Sửa geometry lỗi + snap khép khe hở đầu nét (lỗi CAD) — tolerance 1.5m (đang ở VN2000 mét)
    fixed = processing.run('native:fixgeometries', {'INPUT': lines, 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    try:
        snapped = processing.run('native:snapgeometries',
            {'INPUT': fixed, 'REFERENCE_LAYER': fixed, 'TOLERANCE': 1.5, 'BEHAVIOR': 0, 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
        log('1b) snap khep khe: %d duong' % snapped.featureCount())
    except Exception as _e:
        snapped = fixed; log('1b) snap loi (bo qua): ' + repr(_e))

    # 2) Polygonize -> mảnh kín (GIỮ CUNG: đỉnh cung từ bản smooth được bảo toàn)
    poly = processing.run('native:polygonize', {'INPUT': snapped, 'KEEP_FIELDS': False, 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    log('2) polygonize: %d manh kin' % poly.featureCount())

    # 3) Reproject WGS84 + xuất faces
    poly4326 = processing.run('native:reprojectlayer',
        {'INPUT': poly, 'TARGET_CRS': QgsCoordinateReferenceSystem('EPSG:4326'), 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    processing.run('native:savefeatures', {'INPUT': poly4326, 'OUTPUT': OUT_F})
    log('3) XUAT faces -> %s' % OUT_F)

    # 4) Tim đường -> WGS84 (đối chiếu phân loại)
    cl = QgsVectorLayer(SMOOTH, 'tim', 'ogr')
    cl.setCrs(QgsCoordinateReferenceSystem.fromProj(VN2000))
    cl.setSubsetString('"Layer" LIKE \'%NET TIM DUONG%\'')
    cl4326 = processing.run('native:reprojectlayer',
        {'INPUT': cl, 'TARGET_CRS': QgsCoordinateReferenceSystem('EPSG:4326'), 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    processing.run('native:savefeatures', {'INPUT': cl4326, 'OUTPUT': OUT_C})
    log('4) XUAT tim duong -> %s' % OUT_C)
    log('DONE_OK')
except SystemExit:
    pass
except Exception as e:
    log('LOI: ' + repr(e)); log(traceback.format_exc())
