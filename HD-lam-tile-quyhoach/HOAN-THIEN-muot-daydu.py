# -*- coding: utf-8 -*-
# HOÀN THIỆN bản quy hoạch: MƯỢT + ĐẦY ĐỦ + ĐÚNG MÀU + có ĐƯỜNG -> cắt tile qd205v13
# Chạy: QGIS -> Plugins -> Python Console -> Show Editor -> mở file này -> Run.
# Nguồn: QD205_smooth.geojson (đã ogr2ogr cắt cung 0,25° = mượt) + qh_vector.geojson (bảng màu đúng).

from qgis.core import (QgsVectorLayer, QgsProject, QgsFillSymbol, QgsLineSymbol,
                       QgsSingleSymbolRenderer, QgsSymbolLayer, QgsProperty)
from qgis.PyQt.QtGui import QColor
import processing, os

SMOOTH = r'D:\hau\PHONGKINHTE\quyhoach2025\camlamland\QD205_smooth.geojson'
QHVEC  = r'D:\Cam Lam gis\apps\frontend\public\qh_vector.geojson'
OUT    = r'D:\Cam Lam gis\apps\frontend\public\tiles\qd205v13'

# ---- 1) NẠP ranh vùng (mượt) + lọc lớp đất ----
lines = QgsVectorLayer(SMOOTH, 'ranh_dat', 'ogr')
lines.setSubsetString('"Layer" LIKE \'%DAT%\'')
QgsProject.instance().addMapLayer(lines)
print('1) ranh đất:', lines.featureCount(), 'đường')

# ---- 2) POLYGONIZE -> ghép ĐỦ mọi vùng kín (kể cả vùng vẽ nhiều đoạn) ----
poly = processing.run('native:polygonize',
       {'INPUT': lines, 'KEEP_FIELDS': False, 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
print('2) polygonize ra:', poly.featureCount(), 'vùng kín')

# ---- 3) GÁN MÀU đúng: join với qh_vector theo vùng phủ lớn nhất ----
qh = QgsVectorLayer(QHVEC, 'qh_mau', 'ogr')
joined = processing.run('native:joinattributesbylocation',
       {'INPUT': poly, 'JOIN': qh, 'PREDICATE': [0],           # 0 = giao nhau
        'JOIN_FIELDS': ['c', 'lo'], 'METHOD': 2,               # 2 = lấy vùng phủ LỚN NHẤT
        'DISCARD_NONMATCHING': True,                            # bỏ mảnh không có màu (đường/khe)
        'PREFIX': '', 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
joined.setName('quyhoach_mau')
QgsProject.instance().addMapLayer(joined)
print('3) vùng có màu:', joined.featureCount())

# ---- 4) TÔ ĐẶC theo field c, bỏ viền ----
sym = QgsFillSymbol.createSimple({'color': '200,200,200', 'outline_style': 'no'})
sl = sym.symbolLayer(0)
try:
    sl.setDataDefinedProperty(QgsSymbolLayer.PropertyFillColor, QgsProperty.fromField('c'))
except Exception:
    sl.setDataDefinedProperty(QgsSymbolLayer.Property.PropertyFillColor, QgsProperty.fromField('c'))
joined.setRenderer(QgsSingleSymbolRenderer(sym)); joined.triggerRepaint()

# ---- 5) THÊM ĐƯỜNG giao thông (nét mảnh xám đậm, vẽ trên nền màu) ----
roads = QgsVectorLayer(SMOOTH, 'duong', 'ogr')
roads.setSubsetString('"Layer" LIKE \'%TRAFFIC%\' OR "Layer" LIKE \'%DUONG%\' OR "Layer" LIKE \'NET-%\'')
roads.setRenderer(QgsSingleSymbolRenderer(QgsLineSymbol.createSimple({'color': '70,70,70', 'width': '0.25'})))
QgsProject.instance().addMapLayer(roads)
print('5) đường:', roads.featureCount(), 'nét')

# ---- 6) CHỈ hiện 2 lớp này khi cắt (ẩn hết còn lại) ----
root = QgsProject.instance().layerTreeRoot()
show = {joined.id(), roads.id()}
for c in root.findLayers():
    lay = c.layer()
    if lay is not None:
        c.setItemVisibilityChecked(lay.id() in show)

# ---- 7) CẮT TILE z10-18, nền trong suốt -> qd205v13 ----
e = joined.extent()
ext = '%f,%f,%f,%f [EPSG:4326]' % (e.xMinimum(), e.xMaximum(), e.yMinimum(), e.yMaximum())
os.makedirs(OUT, exist_ok=True)
print('7) bắt đầu cắt tile z10-18 ... (z18 lâu, cứ để chạy)')
processing.run('native:tilesxyzdirectory',
       {'EXTENT': ext, 'ZOOM_MIN': 10, 'ZOOM_MAX': 18, 'DPI': 96,
        'BACKGROUND_COLOR': QColor(0, 0, 0, 0), 'TILE_FORMAT': 0,
        'TILE_WIDTH': 256, 'TILE_HEIGHT': 256, 'OUTPUT_DIRECTORY': OUT})
print('>>> XONG. Tile ở:', OUT, ' -> báo Claude "xong v13" để đổi config.')
