# -*- coding: utf-8 -*-
# CẮT TILE quy hoạch từ dữ liệu vector (đã tách từ QD205.dgn).
# Chạy trong QGIS: Plugins -> Python Console -> nút "Show Editor" -> mở file này -> Run.
# Kết quả: thư mục tile PNG {z}/{x}/{y}, nền trong suốt, tô KÍN theo màu -> không thủng.

from qgis.core import (QgsVectorLayer, QgsProject, QgsFillSymbol,
                       QgsSingleSymbolRenderer, QgsSymbolLayer, QgsProperty)
from qgis.PyQt.QtGui import QColor
import processing, os

# ==== SỬA 3 DÒNG NÀY ====
SRC   = r'D:\Cam Lam gis\apps\frontend\public\qh_smooth.geojson'  # bản MƯỢT (cong 0,25°, dựng lại từ DXF) — có trường màu 'c'
OUT   = r'D:\Cam Lam gis\apps\frontend\public\tiles\qd205v12'     # thư mục tile xuất ra (đặt tên MỚI mỗi lần)
COLOR_FIELD = 'c'          # trường màu hex; file QD205_quyhoach_mau_4326.geojson thì đổi thành 'color'
ZMIN, ZMAX = 10, 18        # TÔ ĐẶC render thẳng tới z18 -> nét từng thửa, không vỡ (vector). Nhẹ vì màu đồng nhất.
# ========================

lyr = QgsVectorLayer(SRC, 'quyhoach', 'ogr')
print('Layer hợp lệ:', lyr.isValid(), '| số polygon:', lyr.featureCount())

# Tô mỗi thửa theo màu trong trường, BỎ VIỀN, phủ kín
sym = QgsFillSymbol.createSimple({'color': '200,200,200', 'outline_style': 'no'})
sl = sym.symbolLayer(0)
try:
    sl.setDataDefinedProperty(QgsSymbolLayer.PropertyFillColor, QgsProperty.fromField(COLOR_FIELD))
except Exception:
    sl.setDataDefinedProperty(QgsSymbolLayer.Property.PropertyFillColor, QgsProperty.fromField(COLOR_FIELD))
lyr.setRenderer(QgsSingleSymbolRenderer(sym))
lyr.triggerRepaint()
QgsProject.instance().addMapLayer(lyr)

# CHỈ hiện lớp quy hoạch khi cắt (tự ẩn DGN + nền) -> tile ra SẠCH, không dính gạch.
_root = QgsProject.instance().layerTreeRoot()
for _c in _root.findLayers():
    _lay = _c.layer()
    if _lay is not None:
        _c.setItemVisibilityChecked(_lay.id() == lyr.id())

e = lyr.extent()
ext = '%f,%f,%f,%f [EPSG:4326]' % (e.xMinimum(), e.xMaximum(), e.yMinimum(), e.yMaximum())
os.makedirs(OUT, exist_ok=True)
params = {'EXTENT': ext, 'ZOOM_MIN': ZMIN, 'ZOOM_MAX': ZMAX, 'DPI': 96,
          'BACKGROUND_COLOR': QColor(0, 0, 0, 0),   # trong suốt ngoài vùng có màu
          'TILE_FORMAT': 0,                          # 0 = PNG
          'TILE_WIDTH': 256, 'TILE_HEIGHT': 256, 'OUTPUT_DIRECTORY': OUT}
print('Bắt đầu cắt tile z%d-%d ...' % (ZMIN, ZMAX))
processing.run('native:tilesxyzdirectory', params)
print('>>> XONG. Tile ở:', OUT)
print('Sau do: bao Claude doi config -> /tiles/qd205v12/{z}/{x}/{y}.png, maxzoom=%d.' % ZMAX)
