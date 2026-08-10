# -*- coding: utf-8 -*-
# BẢN ĐỒ ĐỊA CHÍNH: DGN -> geojson THỬA (SoThua + SoTo + Xa) — chạy HÀNG LOẠT nhiều tờ.
# Chạy: QGIS -> Plugins -> Python Console -> nút "Show Editor" -> mở file này -> sửa phần SỬA -> Run.
#
# Nguyên lý: mỗi tờ .dgn ->
#   - Lấy RANH THỬA (LineString, Level 10) -> Polygonize -> ra polygon từng thửa (giữ đỉnh chính xác).
#   - Lấy SỐ THỬA (Point/Text, Level 4) -> gán vào thửa chứa nó.
#   - Thêm SoTo (số trong tên file: dc51 -> 51) + Xa (bạn khai báo).
# Gộp mọi tờ -> 1 file geojson (toạ độ VN2000 gốc; khi upload web tự quy đổi WGS84).

from qgis.core import QgsVectorLayer, QgsField, QgsProject, edit
from qgis.PyQt.QtCore import QVariant
from osgeo import gdal
import processing, os, re, glob

# ================== SỬA CHỖ NÀY ==================
FOLDER = r'D:\CUONG\LINH VUC DAT DAI\DATA LINH VUC DAT DAI\Hau Dulieu\Ban do 7-2025\Cam Duc'  # thư mục 1 xã
XA     = 'Cam Đức'                                   # tên xã (sẽ gán cho mọi thửa trong thư mục)
ONLY   = 'dc51'    # để 'dc51' = CHỈ chạy tờ này (thử trước). Để '' = chạy HẾT mọi tờ trong thư mục.
LV_RANH, LV_SOTHUA = [10, 11], 4                     # level ranh thửa (khung 10 + ranh trong 11) / số thửa
OUT    = os.path.join(FOLDER, 'thua_' + re.sub(r'[^a-z0-9]+','', XA.lower().replace('đ','d')) + '.geojson')
# =================================================

gdal.SetConfigOption('OGR_ARC_STEPSIZE', '0.2')      # cắt cung mịn -> KHÔNG bẻ thẳng cạnh cong
results = []
files = sorted(glob.glob(os.path.join(FOLDER, '*.[dD][gG][nN]')))
for dgn in files:
    base = os.path.splitext(os.path.basename(dgn))[0]
    if ONLY and base.lower() != ONLY.lower():
        continue
    mm = re.search(r'(\d+)', base)
    soto = mm.group(1) if mm else base                # số tờ từ tên file
    lines = QgsVectorLayer(dgn + '|geometrytype=LineString', 'l', 'ogr')
    pts   = QgsVectorLayer(dgn + '|geometrytype=Point', 'p', 'ogr')
    if not lines.isValid() or not pts.isValid():
        print('  BỎ (không đọc được sub-layer):', base); continue
    lines.setSubsetString('"Level" IN (%s)' % ','.join(str(x) for x in LV_RANH))
    pts.setSubsetString('"Level" = %d' % LV_SOTHUA)
    print('Tờ %s: ranh=%d nét, số thửa=%d điểm' % (soto, lines.featureCount(), pts.featureCount()))
    if lines.featureCount() == 0:
        print('  BỎ: không có ranh ở Level %d' % LV_RANH); continue
    # 1) ranh -> polygon thửa
    poly = processing.run('native:polygonize',
        {'INPUT': lines, 'KEEP_FIELDS': False, 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    # 2) gán số thửa (điểm nằm trong thửa)
    joined = processing.run('native:joinattributesbylocation',
        {'INPUT': poly, 'JOIN': pts, 'PREDICATE': [1],  # 1 = thửa CHỨA điểm
         'JOIN_FIELDS': ['Text'], 'METHOD': 1, 'DISCARD_NONMATCHING': False,
         'PREFIX': '', 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    # 3) thêm cột SoThua / SoTo / Xa
    joined.dataProvider().addAttributes(
        [QgsField('SoThua', QVariant.String), QgsField('SoTo', QVariant.String), QgsField('Xa', QVariant.String)])
    joined.updateFields()
    si = joined.fields().indexOf('SoThua'); oi = joined.fields().indexOf('SoTo'); xi = joined.fields().indexOf('Xa')
    ti = joined.fields().indexOf('Text')
    with edit(joined):
        for f in joined.getFeatures():
            joined.changeAttributeValue(f.id(), si, f['Text'] if ti >= 0 else None)
            joined.changeAttributeValue(f.id(), oi, soto)
            joined.changeAttributeValue(f.id(), xi, XA)
    results.append(joined)
    print('  -> %d thửa (có số thửa: %d)' %
          (joined.featureCount(), sum(1 for f in joined.getFeatures() if f['SoThua'])))

if not results:
    print('!!! KHÔNG tạo được thửa nào — kiểm lại Level (ranh/số thửa) hoặc tên thư mục.')
else:
    merged = processing.run('native:mergevectorlayers',
        {'LAYERS': results, 'CRS': None, 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    processing.run('native:savefeatures', {'INPUT': merged, 'OUTPUT': OUT})
    print('>>> XONG. File:', OUT)
    print('    Tổng thửa:', merged.featureCount(), '| Kiểm: mở file này trong QGIS xem thửa + cột SoThua/SoTo/Xa.')
    print('    Ổn thì đổi ONLY = "" để chạy HẾT các tờ, rồi báo Claude để hướng dẫn upload.')
