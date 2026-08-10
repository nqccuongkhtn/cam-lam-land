# -*- coding: utf-8 -*-
# POLYGONIZE MÉP ĐƯỜNG ĐẦY ĐỦ (roads_signed → road_pavement_lines.geojson, WGS84) -> các Ô ĐẤT (block).
# Đường = phần KHÔNG thuộc block nào (bù). Dữ liệu này ĐẦY ĐỦ (từ full DXF) nên phủ hết thửa, kể cả 624.
# Mép đường đã densify cung nên block GIỮ NGUYÊN đường cong.
# Chạy trong QGIS: Plugins -> Python Console -> gõ:
#   exec(open(r'D:\Cam Lam gis\scripts\qh-pipeline\polygonize_pavement.py', encoding='utf-8').read())
# Xuất: apps/backend/data/road_faces.geojson (WGS84) — Claude dùng để tính đường = bù(block).
from qgis.core import QgsVectorLayer, QgsCoordinateReferenceSystem
import processing, traceback

INP = r'D:\Cam Lam gis\apps\backend\data\road_pavement_lines.geojson'
OUT = r'D:\Cam Lam gis\apps\backend\data\road_faces.geojson'
LOG = r'D:\hau\PHONGKINHTE\quyhoach2025\polygonize_pavement_done.txt'

try:
    from processing.core.ProcessingConfig import ProcessingConfig
    ProcessingConfig.setSettingValue(ProcessingConfig.FILTER_INVALID_GEOMETRIES, 1)
except Exception:
    pass

def log(s):
    try:
        open(LOG, 'a', encoding='utf-8').write(str(s) + '\n')
    except Exception: pass
    print(s)

try:
    open(LOG, 'w', encoding='utf-8').write('BAT DAU\n')
    lines = QgsVectorLayer(INP, 'pave', 'ogr')
    if not lines.isValid():
        log('LOI: khong mo duoc ' + INP); raise SystemExit
    log('0) nap mep duong: %d feature (multiline)' % lines.featureCount())

    # 1) SNAP khép khe hở tại NGÃ (mép các đường khác nhau không trùng đỉnh do lỗi CAD). ~2m ≈ 0.00002 độ.
    fixed = processing.run('native:fixgeometries', {'INPUT': lines, 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    try:
        snapped = processing.run('native:snapgeometries',
            {'INPUT': fixed, 'REFERENCE_LAYER': fixed, 'TOLERANCE': 0.00002, 'BEHAVIOR': 0, 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
        log('1) snap khep khe: xong')
    except Exception as _e:
        snapped = fixed; log('1) snap loi (bo qua): ' + repr(_e))

    # 2) Polygonize -> block (có thể mất 1-5 phút vì ~300k đoạn; cứ chờ)
    poly = processing.run('native:polygonize', {'INPUT': snapped, 'KEEP_FIELDS': False, 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    log('2) polygonize: %d block' % poly.featureCount())

    # 3) Xuat (da la WGS84)
    processing.run('native:savefeatures', {'INPUT': poly, 'OUTPUT': OUT})
    log('3) XUAT -> %s' % OUT)
    log('DONE_OK')
except SystemExit:
    pass
except Exception as e:
    log('LOI: ' + repr(e)); log(traceback.format_exc())
