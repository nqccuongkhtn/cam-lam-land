# Render quy hoach QD205 (vector, tô màu theo thuộc tính) -> tile PNG XYZ. Chạy trong QGIS Python Console.
from qgis.core import (QgsVectorLayer, QgsProject, QgsFillSymbol, QgsSingleSymbolRenderer,
                       QgsSymbolLayer, QgsProperty)
from qgis.PyQt.QtGui import QColor
import processing, os

SRC = r'D:\Cam Lam gis\apps\frontend\public\qh_vector.geojson'   # dữ liệu QD205 đã tô màu (từ DGN)
OUT = r'D:\Cam Lam gis\apps\frontend\public\tiles\qd205v5'
ZMIN, ZMAX = 10, 16   # phủ kín; z17-18 web tự phóng to

lyr = QgsVectorLayer(SRC, 'qd205', 'ogr')
print('Layer hop le:', lyr.isValid(), '| so doi tuong:', lyr.featureCount())
QgsProject.instance().addMapLayer(lyr)

# Tô màu mỗi thửa theo thuộc tính 'c' (mã màu hex), bỏ viền
sym = QgsFillSymbol.createSimple({'color': '200,200,200', 'outline_style': 'no'})
sl = sym.symbolLayer(0)
try:
    sl.setDataDefinedProperty(QgsSymbolLayer.PropertyFillColor, QgsProperty.fromField('c'))
except Exception:
    sl.setDataDefinedProperty(QgsSymbolLayer.Property.PropertyFillColor, QgsProperty.fromField('c'))
lyr.setRenderer(QgsSingleSymbolRenderer(sym))
lyr.triggerRepaint()

e = lyr.extent()
extstr = '%f,%f,%f,%f [EPSG:4326]' % (e.xMinimum(), e.xMaximum(), e.yMinimum(), e.yMaximum())
os.makedirs(OUT, exist_ok=True)
params = {'EXTENT': extstr, 'ZOOM_MIN': ZMIN, 'ZOOM_MAX': ZMAX, 'DPI': 96,
          'BACKGROUND_COLOR': QColor(0, 0, 0, 0), 'TILE_FORMAT': 0,
          'TILE_WIDTH': 256, 'TILE_HEIGHT': 256, 'OUTPUT_DIRECTORY': OUT}
print('Bat dau cat tile z%d-%d ...' % (ZMIN, ZMAX))
processing.run('native:tilesxyzdirectory', params)
print('>>> XONG TILE ->', OUT)
