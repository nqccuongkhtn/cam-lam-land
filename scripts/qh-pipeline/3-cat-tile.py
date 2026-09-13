# -*- coding: utf-8 -*-
"""
CẮT TILE PNG quy hoạch — chạy THẲNG BẰNG DÒNG LỆNH, không cần mở QGIS.

Bản trong HD-lam-tile-quyhoach/cat-tile-tu-dgn.py phải dán vào cửa sổ Python của QGIS
mới chạy được. Bản này tự dựng QGIS ở chế độ ẩn nên gọi được từ .bat / kịch bản tự động.

Cách gọi:
  "C:\\Program Files\\QGIS 3.44.11\\bin\\python-qgis-ltr.bat" 3-cat-tile.py ^
      <vùng.geojson> <thư-mục-tile-ra> [zmin] [zmax] [tên-trường-màu] [nét.geojson]

Ví dụ:
  ... 3-cat-tile.py "D:\\...\\qd2076_qh.geojson" "D:\\...\\tiles\\qd2076v2" 12 18 c "D:\\...\\qd2076_net.geojson"

Đầu vào phải là GeoJSON đã có TRƯỜNG MÀU (mặc định tên 'c', dạng #rrggbb).
Tile ra: PNG 256px, nền TRONG SUỐT, tô kín, không viền.

Ô cuối "nét.geojson" là TUỲ CHỌN nhưng nên có. Bản vẽ quy hoạch phần lớn là NÉT chứ không
phải vùng tô: riêng QĐ2076 có 1.909 vùng nhưng tới 48.487 nét (đường giao thông, chỉ giới,
lề đường, ranh phân khu). Chỉ vẽ vùng thôi thì bản đồ trông trống trải, thiếu hẳn mạng lưới
đường so với lúc mở file gốc. Lớp nét được vẽ ĐÈ LÊN TRÊN lớp vùng.
"""
import os
import sys

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(1)

SRC = os.path.abspath(sys.argv[1])
OUT = os.path.abspath(sys.argv[2])
ZMIN = int(sys.argv[3]) if len(sys.argv) > 3 else 12
ZMAX = int(sys.argv[4]) if len(sys.argv) > 4 else 17
COLOR_FIELD = sys.argv[5] if len(sys.argv) > 5 else 'c'
NET = os.path.abspath(sys.argv[6]) if len(sys.argv) > 6 else None

if not os.path.isfile(SRC):
    print('LỖI: không thấy file đầu vào:', SRC)
    sys.exit(1)

from qgis.core import (QgsApplication, QgsVectorLayer, QgsProject, QgsFillSymbol,
                       QgsLineSymbol, QgsSingleSymbolRenderer, QgsSymbolLayer, QgsProperty)
from qgis.PyQt.QtGui import QColor

# ── Dựng QGIS ở chế độ ẩn (không giao diện) ──────────────────────────────────
prefix = os.environ.get('QGIS_PREFIX_PATH') or os.path.dirname(os.path.dirname(sys.executable))
QgsApplication.setPrefixPath(prefix, True)
qgs = QgsApplication([], False)
qgs.initQgis()

# Bộ "Processing" nằm trong thư mục plugins, không phải lúc nào cũng sẵn trên đường tìm.
plugins = os.path.join(prefix, 'python', 'plugins')
if os.path.isdir(plugins) and plugins not in sys.path:
    sys.path.append(plugins)
import processing                                   # noqa: E402
from processing.core.Processing import Processing   # noqa: E402
Processing.initialize()

# ── Nạp lớp và tô màu theo trường ────────────────────────────────────────────
lyr = QgsVectorLayer(SRC, 'quyhoach', 'ogr')
if not lyr.isValid():
    print('LỖI: QGIS không đọc được file:', SRC)
    sys.exit(1)
ten_truong = [f.name() for f in lyr.fields()]
if COLOR_FIELD not in ten_truong:
    print('LỖI: không có trường màu "%s". Các trường đang có: %s' % (COLOR_FIELD, ', '.join(ten_truong)))
    sys.exit(1)
print('Đọc được %d vùng | các trường: %s' % (lyr.featureCount(), ', '.join(ten_truong)))

# Tô đặc theo màu của từng vùng, BỎ VIỀN — bỏ viền mới phủ kín, không bị hở nét trắng.
sym = QgsFillSymbol.createSimple({'color': '200,200,200', 'outline_style': 'no'})
sl = sym.symbolLayer(0)
try:
    sl.setDataDefinedProperty(QgsSymbolLayer.PropertyFillColor, QgsProperty.fromField(COLOR_FIELD))
except Exception:
    sl.setDataDefinedProperty(QgsSymbolLayer.Property.PropertyFillColor, QgsProperty.fromField(COLOR_FIELD))
lyr.setRenderer(QgsSingleSymbolRenderer(sym))
QgsProject.instance().addMapLayer(lyr)

# ── HOA VĂN vẽ đè lên nền (trường 'hoa', do bước 9-doi-bang-mau.py ghi) ───────
# 'cong' = lưới dấu "+" đen, giống app tham chiếu vẽ Cây xanh chuyên dụng (bản vẽ gốc: hoa văn CROSS).
# Tính bằng ĐIỂM ẢNH chứ không theo mét: app giữ dấu cùng cỡ ở mọi mức phóng.
# Bước lặp 8 điểm ảnh (app đo được ~6,5): 256 chia hết cho 8 nên dấu nối liền qua mép các ô ảnh.
if 'hoa' in ten_truong:
    from qgis.core import QgsPointPatternFillSymbolLayer, QgsMarkerSymbol
    lyr_hoa = QgsVectorLayer(SRC, 'hoavan', 'ogr')
    lyr_hoa.setSubsetString("\"hoa\" = 'cong'")
    so_hoa = lyr_hoa.featureCount()
    if so_hoa > 0:
        dau = QgsMarkerSymbol.createSimple({'name': 'cross', 'size': '5', 'size_unit': 'Pixel',
                                            'color': '0,0,0', 'outline_color': '0,0,0',
                                            'outline_width': '1', 'outline_width_unit': 'Pixel'})
        luoi = QgsPointPatternFillSymbolLayer.create({'distance_x': '8', 'distance_y': '8',
                                                     'distance_x_unit': 'Pixel', 'distance_y_unit': 'Pixel'})
        luoi.setSubSymbol(dau)
        sh = QgsFillSymbol()
        sh.changeSymbolLayer(0, luoi)
        lyr_hoa.setRenderer(QgsSingleSymbolRenderer(sh))
        QgsProject.instance().addMapLayer(lyr_hoa, False)
        QgsProject.instance().layerTreeRoot().insertLayer(0, lyr_hoa)   # trên lớp nền
        print('Hoa văn dấu +: %d vùng' % so_hoa)

# ── Lớp NÉT vẽ đè lên trên (đường, chỉ giới, lề đường…) ─────────────────────
lyr_net = None
if NET:
    if not os.path.isfile(NET):
        print('LỖI: không thấy file nét:', NET); sys.exit(1)
    lyr_net = QgsVectorLayer(NET, 'net', 'ogr')
    if not lyr_net.isValid():
        print('LỖI: QGIS không đọc được file nét:', NET); sys.exit(1)
    print('Lớp nét: %d đường' % lyr_net.featureCount())
    # 0.25mm: đủ mảnh để ở mức phóng gần không che mất ô đất, vẫn thấy rõ mạng đường.
    sn = QgsLineSymbol.createSimple({'color': '0,0,0', 'width': '0.25'})
    sln = sn.symbolLayer(0)
    try:
        sln.setDataDefinedProperty(QgsSymbolLayer.PropertyStrokeColor, QgsProperty.fromField(COLOR_FIELD))
    except Exception:
        sln.setDataDefinedProperty(QgsSymbolLayer.Property.PropertyStrokeColor, QgsProperty.fromField(COLOR_FIELD))
    lyr_net.setRenderer(QgsSingleSymbolRenderer(sn))
    QgsProject.instance().addMapLayer(lyr_net, False)
    # Chèn vào ĐẦU cây lớp = nằm TRÊN CÙNG khi vẽ.
    QgsProject.instance().layerTreeRoot().insertLayer(0, lyr_net)

# ── Cắt tile ─────────────────────────────────────────────────────────────────
e = lyr.extent()
ext = '%f,%f,%f,%f [EPSG:4326]' % (e.xMinimum(), e.xMaximum(), e.yMinimum(), e.yMaximum())
os.makedirs(OUT, exist_ok=True)
print('Khung bao: %s' % ext)
print('Bắt đầu cắt tile z%d–%d → %s' % (ZMIN, ZMAX, OUT))
processing.run('native:tilesxyzdirectory', {
    'EXTENT': ext, 'ZOOM_MIN': ZMIN, 'ZOOM_MAX': ZMAX, 'DPI': 96,
    'BACKGROUND_COLOR': QColor(0, 0, 0, 0),   # ngoài vùng có màu thì để trong suốt
    'TILE_FORMAT': 0,                         # 0 = PNG
    'TILE_WIDTH': 256, 'TILE_HEIGHT': 256,
    'OUTPUT_DIRECTORY': OUT,
})

n = sum(len(f) for _, _, f in os.walk(OUT))
print('>>> XONG. %d ô tile ở: %s' % (n, OUT))
print('>>> Nhớ khai maxzoom = %d trên web (ĐÚNG bằng mức đã cắt, khai cao hơn là trống).' % ZMAX)
qgs.exitQgis()
