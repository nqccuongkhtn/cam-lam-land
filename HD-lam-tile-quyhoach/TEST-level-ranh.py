# Tự dựng vùng từ mỗi nét khép kín (không cần thuật toán) — tìm level thửa.
from qgis.core import QgsVectorLayer, QgsGeometry, QgsFeature
import processing
dgn = r'D:\CUONG\LINH VUC DAT DAI\DATA LINH VUC DAT DAI\Hau Dulieu\Ban do 7-2025\Cam Duc\dc51.dgn'
pts = QgsVectorLayer(dgn + '|geometrytype=Point', 'p', 'ogr'); pts.setSubsetString('"Level" = 4')
print('So diem so thua (Level 4):', pts.featureCount())

def lines_to_polys(lv):
    l = QgsVectorLayer(dgn + '|geometrytype=LineString', 'l', 'ogr')
    l.setSubsetString('"Level" = %d' % lv)
    mem = QgsVectorLayer('Polygon', 'poly', 'memory')
    dp = mem.dataProvider(); feats = []
    for f in l.getFeatures():
        g = f.geometry()
        pl = g.asPolyline()
        if not pl:
            ml = g.asMultiPolyline(); pl = ml[0] if ml else None
        if pl and len(pl) >= 3:
            nf = QgsFeature(); nf.setGeometry(QgsGeometry.fromPolygonXY([pl])); feats.append(nf)
    dp.addFeatures(feats); mem.updateExtents()
    return l.featureCount(), mem

def test(lv):
    n, mem = lines_to_polys(lv)
    if n == 0: return
    j = processing.run('native:joinattributesbylocation',
        {'INPUT': mem, 'JOIN': pts, 'PREDICATE': [0], 'JOIN_FIELDS': ['Text'],
         'METHOD': 1, 'DISCARD_NONMATCHING': True, 'PREFIX': '', 'OUTPUT': 'TEMPORARY_OUTPUT'})['OUTPUT']
    print('  Level %2d: %4d net -> %4d vung | %3d CO so thua' % (lv, n, mem.featureCount(), j.featureCount()))

print('=== Moi net khep -> 1 vung; join so thua (mong ~41) ===')
for lv in [13, 11, 14, 10, 50, 23, 8, 22, 46]:
    test(lv)
print('=== Level nao ~41 CO so thua = THUA. Gui Claude. ===')
