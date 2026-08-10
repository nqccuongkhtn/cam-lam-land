# -*- coding: utf-8 -*-
"""
CHUẨN HÓA BẢN ĐỒ DGN → GeoJSON (cho web Cam Lâm Land)
=====================================================
Phần mềm desktop: đọc DGN (v7/v8) / DXF / DWG → sửa lỗi hình học → tạo vùng (polygonize)
→ dựng topology → GIỮ NGUYÊN level + màu gốc → xuất GeoJSON (WGS84) để nạp lên web.

• DGN V8 (định dạng đóng của Bentley): tự gọi ODA File Converter (miễn phí) chuyển sang DXF trước.
• Toạ độ: gán hệ VN-2000 theo kinh tuyến trục tỉnh (mặc định Khánh Hòa 108°15', k=0.9999) rồi reproject WGS84.
• Chạy: bấm đúp ChuanHoaDGN.bat (mở giao diện) — hoặc:  python ChuanHoaDGN.py <file> [--out out.geojson]

Yêu cầu cài (một lần): Python 3.9+, GDAL (osgeo), Shapely. Xem README.md.
"""
import os, sys, re, json, glob, shutil, tempfile, subprocess, traceback

# ---- Thư viện GIS (báo lỗi rõ ràng nếu thiếu) --------------------------------
try:
    from osgeo import ogr, osr
    ogr.UseExceptions()
    HAS_GDAL = True
except Exception:
    HAS_GDAL = False

try:
    from shapely.geometry import shape, mapping
    from shapely.ops import polygonize, unary_union, transform as shp_transform
    from shapely import make_valid as _make_valid
    from shapely.strtree import STRtree
    HAS_SHAPELY = True
except Exception:
    HAS_SHAPELY = False

# ---- Hệ toạ độ VN-2000 theo tỉnh (kinh tuyến trục, múi 3°, k=0.9999) ----------
# towgs84: 7 tham số chuyển VN-2000 → WGS84 (dùng toàn quốc).
VN2000_TOWGS84 = "-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278"
def vn2000_proj(lon0=108.25, k=0.9999):
    return (f"+proj=tmerc +lat_0=0 +lon_0={lon0} +k={k} +x_0=500000 +y_0=0 "
            f"+ellps=WGS84 +towgs84={VN2000_TOWGS84} +units=m +no_defs")

# Kinh tuyến trục một số tỉnh hay dùng (có thể chọn trong giao diện)
KTT_TINH = {
    "Khánh Hòa (108°15')": 108.25,
    "Ninh Thuận / Bình Thuận (108°30')": 108.5,
    "Đắk Lắk / Lâm Đồng (108°30')": 108.5,
    "TP.HCM / Đồng Nai (105°45')": 105.75,
    "Hà Nội (105°00')": 105.0,
    "Đà Nẵng / Quảng Nam (107°45')": 107.75,
}

def log_default(msg): print(msg, flush=True)

# ============================================================================
#  1) TÌM CÔNG CỤ NGOÀI: ogr2ogr (GDAL) và ODA File Converter (cho DGN v8)
# ============================================================================
def find_exe(names, extra_dirs=()):
    for n in names:
        p = shutil.which(n)
        if p: return p
    for d in extra_dirs:
        for n in names:
            for hit in glob.glob(os.path.join(d, n)):
                if os.path.isfile(hit): return hit
    return None

def find_ogr2ogr():
    return find_exe(["ogr2ogr", "ogr2ogr.exe"], [
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\OSGeo4W\bin"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\OSGeo4W64\bin"),
        r"C:\OSGeo4W\bin", r"C:\OSGeo4W64\bin", r"C:\Program Files\OSGeo4W\bin", r"D:\OSGeo4W\bin",
        r"C:\OSGeo4W\apps\gdal*\bin", r"C:\Program Files\QGIS*\bin", r"C:\Program Files\GDAL",
        r"C:\ProgramData\anaconda3\Library\bin", os.path.expanduser(r"~\anaconda3\Library\bin"),
        os.path.expanduser(r"~\miniconda3\Library\bin"), os.path.expanduser(r"~\anaconda3\envs\*\Library\bin"),
    ])

def _ogr_env(ogr_path):
    """Môi trường để ogr2ogr của OSGeo4W chạy được TỪ NGOÀI shell: thêm bin vào PATH + trỏ GDAL_DATA/PROJ_LIB."""
    env = os.environ.copy()
    if not ogr_path: return env
    bindir = os.path.dirname(ogr_path); root = os.path.dirname(bindir)
    env["PATH"] = bindir + os.pathsep + env.get("PATH", "")
    def firstdir(cands):
        for c in cands:
            for h in glob.glob(c):
                if os.path.isdir(h): return h
        return None
    gd = firstdir([os.path.join(root, "share", "gdal"), os.path.join(root, "apps", "gdal*", "share", "gdal")])
    pj = firstdir([os.path.join(root, "share", "proj"), os.path.join(root, "apps", "proj*", "share", "proj")])
    if gd: env["GDAL_DATA"] = gd
    if pj: env["PROJ_LIB"] = pj; env["PROJ_DATA"] = pj
    return env

def find_oda():
    return find_exe(["ODAFileConverter.exe", "ODAFileConverter"], [
        r"C:\Program Files\ODA\*", r"C:\Program Files (x86)\ODA\*",
        r"/usr/bin", r"/opt/*",
    ])

# ============================================================================
#  2) DGN V8 → DXF bằng ODA File Converter (miễn phí)
# ============================================================================
def oda_convert_to_dxf(src, log=log_default):
    """Trả về đường dẫn DXF nếu chuyển được, else None."""
    oda = find_oda()
    if not oda:
        log("  ⚠ Không thấy ODA File Converter. Nếu file là DGN V8, hãy cài ODA (miễn phí) "
            "hoặc tự export DXF. Xem README.")
        return None
    in_dir = tempfile.mkdtemp(prefix="oda_in_"); out_dir = tempfile.mkdtemp(prefix="oda_out_")
    name = os.path.basename(src)
    shutil.copy(src, os.path.join(in_dir, name))
    real_ext = os.path.splitext(name)[1]            # giữ nguyên hoa/thường: '.dgn'
    log(f"  → Gọi ODA File Converter: {name} → DXF …")

    def _found_dxf():
        got = []
        for r, _d, fs in os.walk(out_dir):
            for f in fs:
                if f.lower().endswith(".dxf"): got.append(os.path.join(r, f))
        return got

    # Thử lần lượt nhiều BỘ LỌC (ODA lọc phân biệt hoa/thường trên vài bản) + có/không audit
    filters = []
    for flt in (f"*{real_ext}", f"*{real_ext.upper()}", f"*{real_ext.lower()}", "*.DGN", "*.dgn", "*.*"):
        if flt not in filters: filters.append(flt)
    last_out = ""
    for flt in filters:
        # ODAFileConverter <in> <out> <outVer> <outType> <recurse> <audit> <filter>
        cmd = [oda, in_dir, out_dir, "ACAD2018", "DXF", "0", "0", flt]
        try:
            p = subprocess.run(cmd, timeout=600, check=False,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            last_out = (p.stdout or "").strip()
        except Exception as e:
            log(f"  ⚠ ODA lỗi khi chạy: {e}"); return None
        dxfs = _found_dxf()
        if dxfs:
            return dxfs[0]
    # Không ra DXF sau mọi bộ lọc → báo chẩn đoán
    if last_out:
        log("  ⚠ ODA chạy nhưng KHÔNG xuất DXF. Thông báo từ ODA: " + last_out[-200:])
    log("  ⚠ Mẹo: MỞ 'ODA File Converter' 1 lần bằng tay, bấm đồng ý (Agree) giấy phép rồi đóng lại, "
        "sau đó chạy lại phần mềm. (Lần đầu ODA cần chấp nhận giấy phép mới chạy được chế độ dòng lệnh.)")
    return None

# ============================================================================
#  2b) ĐỔI DGN V8 → DXF QUA MẠNG (GroupDocs.Conversion Cloud, có gói miễn phí)
#      Dùng khi máy không có công cụ đọc DGN V8. Cần Client ID + Client Secret.
# ============================================================================
GD_BASE = "https://api.groupdocs.cloud"

def online_convert_to_dxf(src, client_id, client_secret, log=log_default):
    """Tải file lên GroupDocs Cloud, đổi sang DXF, tải DXF về. Trả path DXF cục bộ hoặc None."""
    try:
        import requests
    except Exception:
        log("  ⚠ Thiếu thư viện 'requests' (chạy 1_CaiDat.bat)."); return None
    from urllib.parse import quote
    if not client_id or not client_secret:
        log("  ⚠ Chưa nhập Client ID / Secret của GroupDocs để đổi V8 online."); return None
    try:
        log("  ☁ Đổi DGN V8 qua mạng (GroupDocs)… lấy mã truy cập…")
        tk = requests.post(GD_BASE + "/connect/token",
                           data={"grant_type": "client_credentials",
                                 "client_id": client_id, "client_secret": client_secret},
                           headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=60)
        if tk.status_code != 200:
            log(f"  ⚠ Sai Client ID/Secret? (HTTP {tk.status_code})"); return None
        token = tk.json().get("access_token")
        H = {"Authorization": "Bearer " + token}
        name = os.path.basename(src)
        stem = os.path.splitext(name)[0]
        remote_in = "input/" + name
        # tải file lên storage
        log(f"  ☁ Tải lên: {name} …")
        with open(src, "rb") as fp:
            up = requests.put(GD_BASE + "/v2.0/conversion/storage/file/" + quote(remote_in),
                              headers=H, data=fp, timeout=600)
        if up.status_code not in (200, 201):
            log(f"  ⚠ Tải lên lỗi (HTTP {up.status_code})."); return None
        # yêu cầu chuyển đổi
        log("  ☁ Đang chuyển đổi V8 → DXF trên máy chủ …")
        body = {"FilePath": remote_in, "Format": "dxf", "OutputPath": "output"}
        cv = requests.post(GD_BASE + "/v2.0/conversion", json=body, headers=H, timeout=900)
        if cv.status_code != 200:
            log(f"  ⚠ Chuyển đổi lỗi (HTTP {cv.status_code}): {cv.text[:180]}"); return None
        res = cv.json()
        rpath = None
        if isinstance(res, list) and res: rpath = res[0].get("path")
        rpath = rpath or ("output/" + stem + ".dxf")
        # tải DXF về
        log("  ☁ Tải DXF kết quả về …")
        dl = requests.get(GD_BASE + "/v2.0/conversion/storage/file/" + quote(rpath),
                          headers=H, timeout=600)
        if dl.status_code != 200 or len(dl.content) < 60:
            log(f"  ⚠ Tải DXF về lỗi (HTTP {dl.status_code})."); return None
        local = os.path.join(tempfile.gettempdir(), stem + "_online.dxf")
        with open(local, "wb") as fp: fp.write(dl.content)
        log(f"  ✅ Đã đổi V8 → DXF qua mạng ({len(dl.content)//1024} KB).")
        return local
    except Exception as e:
        log(f"  ⚠ Lỗi đổi online: {e}"); return None

# ============================================================================
#  3) ĐỌC CAD → danh sách feature (geom WGS84 + level + màu) bằng GDAL/OGR
# ============================================================================
def _parse_style_color(style):
    """OGR style 'PEN(c:#RRGGBB..)' / 'BRUSH(fc:#RRGGBB..)' → '#RRGGBB'."""
    if not style: return None
    m = re.search(r'(?:fc|c):#([0-9A-Fa-f]{6})', style)
    return ("#" + m.group(1).upper()) if m else None

def read_cad_binding(path, lon0, log=log_default):
    """Đọc bằng OGR Python binding (osgeo); nếu là DGN v8 (OGR mở lỗi) → ODA convert DXF rồi đọc lại."""
    ds = None
    try:
        ds = ogr.Open(path, 0)
    except Exception:
        ds = None
    if ds is None:
        log("  • OGR không mở trực tiếp được (thường do DGN V8) → thử ODA convert.")
        dxf = oda_convert_to_dxf(path, log)
        if not dxf: raise RuntimeError("Không đọc được file. DGN V8 cần ODA File Converter (xem README).")
        path = dxf; ds = ogr.Open(path, 0)
        if ds is None: raise RuntimeError("Vẫn không đọc được sau khi convert DXF.")

    # Nguồn = VN-2000 tỉnh; đích = WGS84
    src_srs = osr.SpatialReference(); src_srs.ImportFromProj4(vn2000_proj(lon0))
    dst_srs = osr.SpatialReference(); dst_srs.ImportFromEPSG(4326)
    try:
        src_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        dst_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    except Exception: pass
    ct = osr.CoordinateTransformation(src_srs, dst_srs)

    feats = []  # {geom(shapely, WGS84), level, color, gtype}
    n_read = 0
    for li in range(ds.GetLayerCount()):
        lyr = ds.GetLayer(li)
        for f in lyr:
            g = f.GetGeometryRef()
            if g is None: continue
            try: g = g.Clone(); g.Transform(ct)
            except Exception: continue
            try: sh = shape(json.loads(g.ExportToJson()))
            except Exception: continue
            if sh.is_empty: continue
            level = None
            for key in ("Level", "Layer", "layer", "LAYER"):
                if f.GetFieldIndex(key) >= 0:
                    level = f.GetField(key); break
            color = _parse_style_color(f.GetStyleString() if hasattr(f, "GetStyleString") else None)
            feats.append({"geom": sh, "level": str(level) if level is not None else "0",
                          "color": color, "gtype": sh.geom_type})
            n_read += 1
    log(f"  • Đọc được {n_read} đối tượng từ {ds.GetLayerCount()} lớp CAD.")
    return feats

def read_cad_cli(path, lon0, log=log_default, gd_id="", gd_secret=""):
    """Đọc bằng ogr2ogr (binary GDAL) — KHÔNG cần Python binding 'gdal' (khỏi phải compile).
    ogr2ogr tự gán VN-2000 → WGS84; ta đọc GeoJSON kết quả bằng shapely."""
    ogr2ogr = find_ogr2ogr()
    if not ogr2ogr:
        raise RuntimeError("Không thấy GDAL. Cài OSGeo4W hoặc conda (xem README) rồi thử lại.")
    _env = _ogr_env(ogr2ogr)  # nạp môi trường OSGeo4W để ogr2ogr chạy ngoài shell
    tmp = os.path.join(tempfile.gettempdir(), "chuanhoa_tmp.geojson")
    if os.path.exists(tmp):
        try: os.remove(tmp)
        except Exception: pass
    def run_ogr(inp):
        cmd = [ogr2ogr, "-f", "GeoJSON", "-skipfailures",
               "-s_srs", vn2000_proj(lon0), "-t_srs", "EPSG:4326",
               "-nlt", "CONVERT_TO_LINEAR", tmp, inp]
        return subprocess.run(cmd, capture_output=True, text=True, env=_env)
    r = run_ogr(path)
    if (not os.path.exists(tmp)) or os.path.getsize(tmp) < 60:
        ext = os.path.splitext(path)[1].lower()
        # Nhận diện DGN V8: file V8 là dạng OLE2 (magic D0CF11E0). GDAL chỉ đọc DGN V7.
        try:
            with open(path, "rb") as _fp: head = _fp.read(8)
        except Exception: head = b""
        is_v8 = ext == ".dgn" and head[:4] == b"\xD0\xCF\x11\xE0"
        if is_v8:
            if gd_id and gd_secret:                 # ĐỔI V8 QUA MẠNG (đã bật + có key)
                dxf = online_convert_to_dxf(path, gd_id, gd_secret, log)
                if dxf: r = run_ogr(dxf)
            else:
                raise RuntimeError(
                    "File là DGN V8 (MicroStation V8) — GDAL/ODA miễn phí KHÔNG đọc được offline. "
                    "Bật 'Đổi DGN V8 qua mạng' và nhập Client ID/Secret (GroupDocs, miễn phí) để tự đổi; "
                    "hoặc Save As DXF/DGN V7 từ MicroStation rồi thả .dxf vào.")
        if ext == ".dwg":                       # DWG: nhờ ODA đổi DWG→DXF (ODA làm được DWG/DXF)
            log("  • ogr2ogr chưa đọc DWG trực tiếp → thử ODA đổi DWG→DXF.")
            dxf = oda_convert_to_dxf(path, log)
            if dxf: r = run_ogr(dxf)
    if not os.path.exists(tmp) or os.path.getsize(tmp) < 60:
        raise RuntimeError("Không đọc được dữ liệu từ file. Nếu là DGN V8 → xuất ra DXF/DGN V7 trước. "
                           "Nếu là file rỗng/hỏng → kiểm tra lại nguồn.")
    # DGN/DXF hay có text mã hoá không phải UTF-8 (tiếng Việt Latin/CP1258) → đọc chịu lỗi.
    with open(tmp, "rb") as fp: raw = fp.read()
    try: txt = raw.decode("utf-8")
    except UnicodeDecodeError: txt = raw.decode("utf-8", errors="replace")
    gj = json.loads(txt)
    feats = []
    for f in gj.get("features", []):
        geom = f.get("geometry")
        if not geom: continue
        try: sh = shape(geom)
        except Exception: continue
        if sh.is_empty: continue
        p = f.get("properties") or {}
        level = p.get("Level") or p.get("Layer") or p.get("layer") or "0"
        color = _parse_style_color(p.get("OGR_STYLE") or p.get("PenColor") or "")
        feats.append({"geom": sh, "level": str(level), "color": color, "gtype": sh.geom_type})
    try: os.remove(tmp)
    except Exception: pass
    log(f"  • (ogr2ogr) Đọc {len(feats)} đối tượng.")
    return feats

def read_cad(path, lon0, log=log_default, gd_id="", gd_secret=""):
    """Ưu tiên Python binding (đọc được cả màu element); không có thì dùng ogr2ogr binary."""
    if HAS_GDAL:
        try:
            return read_cad_binding(path, lon0, log)
        except Exception as e:
            log(f"  • Binding lỗi ({e}) → thử ogr2ogr.")
    return read_cad_cli(path, lon0, log, gd_id, gd_secret)

# ============================================================================
#  4) SỬA LỖI HÌNH HỌC + TẠO VÙNG (polygonize) + GIỮ level/màu gốc
# ============================================================================
def fix_geom(sh):
    try:
        if not sh.is_valid: sh = _make_valid(sh)
    except Exception:
        try: sh = sh.buffer(0)
        except Exception: pass
    return sh

def build_regions(feats, do_polygonize=True, snap=0.0, log=log_default):
    polys, lines = [], []
    for ft in feats:
        g = fix_geom(ft["geom"])
        t = g.geom_type
        if t in ("Polygon", "MultiPolygon"):
            polys.append(ft | {"geom": g})
        elif t in ("LineString", "MultiLineString", "LinearRing"):
            lines.append(ft | {"geom": g})

    out = list(polys)  # polygon sẵn có → giữ nguyên (kèm level/màu gốc)
    log(f"  • Có sẵn {len(polys)} vùng; {len(lines)} đường ranh.")

    if do_polygonize and lines:
        try:
            merged = unary_union([l["geom"] for l in lines])
            if snap and snap > 0:
                from shapely import set_precision
                merged = set_precision(merged, snap)
            new_polys = list(polygonize(merged))
            log(f"  • Tạo vùng từ đường ranh: +{len(new_polys)} vùng mới (polygonize).")
            # Gán level/màu cho vùng mới theo đường ranh GẦN NHẤT (giữ nguyên phân loại gốc)
            if new_polys:
                geoms = [l["geom"] for l in lines]
                tree = STRtree(geoms)
                for p in new_polys:
                    lvl, col = "0", None
                    try:
                        idx = tree.nearest(p.exterior)
                        j = idx if isinstance(idx, int) else int(idx)
                        lvl = lines[j]["level"]; col = lines[j]["color"]
                    except Exception: pass
                    out.append({"geom": fix_geom(p), "level": lvl, "color": col, "gtype": "Polygon"})
        except Exception as e:
            log(f"  ⚠ Bỏ qua polygonize (lỗi: {e}).")
    return out

# ============================================================================
#  5) XUẤT GeoJSON cho web ({lo=level, c=màu})
# ============================================================================
# Bảng màu phân biệt theo level khi file KHÔNG nhúng màu element (nhìn rõ + web hiển thị đẹp).
PALETTE = ["#e6194B", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6",
           "#bfef45", "#fabed4", "#469990", "#9A6324", "#800000", "#808000", "#000075",
           "#e6beff", "#aaffc3", "#ffd8b1", "#a9a9a9", "#fb7185", "#14b8a6"]

# Màu ranh thửa CHUẨN của web (đồng bộ 1 mẫu) — trùng lớp thửa trên bản đồ web.
WEB_PARCEL_COLOR = "#1565c0"

def write_geojson(feats, out_path, web_style=True, log=log_default):
    features = []
    lvl_color = {}
    for ft in feats:
        g = ft["geom"]
        if g is None or g.is_empty: continue
        if g.geom_type not in ("Polygon", "MultiPolygon"): continue
        lv = str(ft.get("level") or "0")
        if web_style:                      # đồng bộ màu ranh thửa như web đang hiển thị
            col = WEB_PARCEL_COLOR
        else:
            col = ft.get("color")
            if not col:                    # file không có màu element → gán màu phân biệt theo level
                if lv not in lvl_color: lvl_color[lv] = PALETTE[len(lvl_color) % len(PALETTE)]
                col = lvl_color[lv]
        features.append({"type": "Feature", "properties": {"lo": lv, "c": col}, "geometry": mapping(g)})
    fc = {"type": "FeatureCollection", "features": features}
    with open(out_path, "w", encoding="utf-8") as fp:
        json.dump(fc, fp, ensure_ascii=False)
    log(f"✅ Xuất {len(features)} vùng → {out_path}")
    return len(features)

# ============================================================================
#  Tạo trang XEM BẢN ĐỒ (Leaflet + ảnh vệ tinh Esri) để kiểm tra ngay, không cần QGIS.
# ============================================================================
def _robust_bounds(gj):
    """Khung [[s,w],[n,e]] theo percentile 1–99 để BỎ điểm ngoại lai (khung phụ, gốc toạ độ…)."""
    xs, ys = [], []
    def walk(c):
        if not c: return
        if isinstance(c[0], (int, float)):
            if len(c) >= 2: xs.append(c[0]); ys.append(c[1])
        else:
            for k in c: walk(k)
    for f in gj.get("features", []):
        walk((f.get("geometry") or {}).get("coordinates"))
    if not xs: return None
    xs.sort(); ys.sort()
    def pct(a, p): return a[min(len(a) - 1, max(0, int(len(a) * p)))]
    return [[pct(ys, 0.01), pct(xs, 0.01)], [pct(ys, 0.99), pct(xs, 0.99)]]

def make_map_html(geojson_path, log=log_default):
    with open(geojson_path, encoding="utf-8", errors="replace") as fp:
        gj = json.load(fp)
    bounds = _robust_bounds(gj)
    data = json.dumps(gj, ensure_ascii=False)
    bounds_js = json.dumps(bounds) if bounds else "null"
    html = r"""<!doctype html><html><head><meta charset="utf-8">
<title>Xem bản đồ chuẩn hóa · Cam Lâm Land</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0}.info{position:absolute;z-index:1000;top:10px;left:50px;background:#0A2540;color:#fff;padding:6px 12px;border-radius:8px;font:13px system-ui}</style>
</head><body>
<div class="info">Bản đồ chuẩn hóa · Cam Lâm Land — chồng trên ảnh vệ tinh để kiểm tra khớp toạ độ</div>
<div id="map"></div><script>
var gj = __DATA__; var B = __BOUNDS__;
var map = L.map('map');
var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:21,attribution:'Esri World Imagery'}).addTo(map);
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'OSM'});
var layer = L.geoJSON(gj,{style:function(f){var c=(f.properties&&f.properties.c)||'#3388ff';return{color:c,weight:1.3,opacity:1,fill:true,fillColor:c,fillOpacity:0};},
 onEachFeature:function(f,l){if(f.properties)l.bindPopup('Level: '+(f.properties.lo||'?'));
   l.on('mouseover',function(){l.setStyle({fillOpacity:0.25,weight:2});});
   l.on('mouseout',function(){l.setStyle({fillOpacity:0,weight:1.3});});}}).addTo(map);
if(B){ map.fitBounds(B); } else { try{ map.fitBounds(layer.getBounds()); }catch(e){ map.setView([12.9,109.1],13); } }
L.control.layers({'Ảnh vệ tinh':sat,'Bản đồ đường':osm},{'Vùng chuẩn hóa':layer}).addTo(map);
</script></body></html>"""
    html = html.replace("__DATA__", data).replace("__BOUNDS__", bounds_js)
    out = os.path.splitext(geojson_path)[0] + "_xem-ban-do.html"
    with open(out, "w", encoding="utf-8") as fp:
        fp.write(html)
    log(f"🌍 Đã tạo bản đồ xem trước: {out}")
    return out

# ============================================================================
#  DỌN TOPOLOGY + TÁCH CỤM (chống trùng lặp tờ bản đồ)
# ============================================================================
def _centroid_xy(g):
    try:
        c = g.centroid
        if c.is_empty: raise ValueError
        return (c.x, c.y)
    except Exception:
        b = g.bounds
        return ((b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0)

def dedup_and_clean(regions, log=log_default):
    """Sửa hợp lệ + bỏ vùng rỗng + bỏ vùng TRÙNG + bỏ mảnh vụn (sliver)."""
    clean, areas = [], []
    for ft in regions:
        g = fix_geom(ft["geom"])
        if g is None or g.is_empty: continue
        if g.geom_type not in ("Polygon", "MultiPolygon"): continue
        clean.append(ft | {"geom": g}); areas.append(g.area)
    thr = 0.0
    if areas:
        s = sorted(areas); med = s[len(s) // 2]; thr = med * 1e-4  # sliver = < 0.01% trung vị
    out, seen, dup, sliv = [], set(), 0, 0
    for ft in clean:
        g = ft["geom"]
        if thr and g.area < thr: sliv += 1; continue
        try: key = (round(g.centroid.x, 7), round(g.centroid.y, 7), round(g.area, 4))
        except Exception: key = None
        if key is not None:
            if key in seen: dup += 1; continue
            seen.add(key)
        out.append(ft)
    if dup or sliv: log(f"  • Dọn topology: bỏ {dup} vùng trùng lặp, {sliv} mảnh vụn.")
    return out

def split_clusters(regions):
    """Tách các vùng thành CỤM rời nhau (mỗi tờ bản đồ = 1 cụm). Trả list các list-chỉ-số."""
    n = len(regions)
    if n <= 1: return [list(range(n))] if n else []
    cents = [_centroid_xy(r["geom"]) for r in regions]
    xs = [c[0] for c in cents]; ys = [c[1] for c in cents]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    span = max(maxx - minx, maxy - miny)
    if span <= 0: return [list(range(n))]
    cell = span / 40.0  # ô lưới ~1/40 chiều lớn nhất: nối vùng gần nhau, tách khoảng trống lớn
    from collections import defaultdict
    grid = defaultdict(list)
    for i, (x, y) in enumerate(cents):
        grid[(int((x - minx) // cell), int((y - miny) // cell))].append(i)
    parent = list(range(n))
    def find(a):
        while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
        return a
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb: parent[ra] = rb
    for (gx, gy), idxs in grid.items():
        base = idxs[0]
        for k in idxs[1:]: union(base, k)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0: continue
                nb = grid.get((gx + dx, gy + dy))
                if nb: union(base, nb[0])
    groups = defaultdict(list)
    for i in range(n): groups[find(i)].append(i)
    return sorted(groups.values(), key=len, reverse=True)

def cluster_infos(regions, clusters):
    infos = []
    for cl in clusters:
        if not cl: continue
        xs = ys = 0.0
        for j in cl:
            x, y = _centroid_xy(regions[j]["geom"]); xs += x; ys += y
        infos.append({"n": len(cl), "lat": ys / len(cl), "lon": xs / len(cl)})
    return infos

def _qa_report(regions, log):
    if not regions: return
    invalid = sum(0 if r["geom"].is_valid else 1 for r in regions)
    log(f"  ✔ Kiểm tra chất lượng: {len(regions)} vùng · {invalid} vùng còn lỗi hình học.")

# Bộ nhớ tạm để GUI đổi cụm & xuất lại KHÔNG cần xử lý lại từ đầu
_LAST = {"src": None, "regions": None, "clusters": None, "lon0": None, "selected": 0}

def last_clusters():
    regions = _LAST.get("regions"); clusters = _LAST.get("clusters")
    if not regions or not clusters:
        return {"count": 0, "selected": 0, "infos": []}
    return {"count": len(clusters), "selected": _LAST.get("selected", 0),
            "infos": cluster_infos(regions, clusters)}

def reexport(out_path, keep_cluster=None, log=log_default):
    """Xuất lại GeoJSON từ dữ liệu đã xử lý, chọn cụm khác (không đọc lại file CAD)."""
    regions = _LAST.get("regions"); clusters = _LAST.get("clusters")
    if not regions: raise RuntimeError("Chưa có dữ liệu đã xử lý. Hãy bấm CHẠY trước.")
    if clusters and len(clusters) > 1 and str(keep_cluster) not in ("None", "all", "auto", ""):
        sel = max(0, min(int(keep_cluster), len(clusters) - 1))
        sel_regions = [regions[j] for j in clusters[sel]]; _LAST["selected"] = sel
        log(f"  ✂ Đã đổi sang GIỮ Cụm #{sel + 1} ({len(sel_regions)} vùng).")
    elif keep_cluster == "all":
        sel_regions = regions
    else:
        sel_regions = [regions[j] for j in clusters[0]] if clusters else regions
    write_geojson(sel_regions, out_path, web_style=_LAST.get("web_style", True), log=log)
    return out_path

# ============================================================================
#  PIPELINE tổng
# ============================================================================
def run_pipeline(src, out_path=None, lon0=108.25, do_polygonize=True, snap=0.0,
                 dedup=True, keep_cluster=None, web_style=True, log=log_default,
                 gd_id="", gd_secret=""):
    if not HAS_GDAL and not find_ogr2ogr():
        raise RuntimeError("Chua co GDAL. Cai OSGeo4W hoac conda gdal (xem README). Dung 'pip install gdal' vi se loi tren Windows.")
    if not HAS_SHAPELY: raise RuntimeError("Chưa cài Shapely.  pip install shapely")
    if not os.path.isfile(src): raise RuntimeError(f"Không thấy file: {src}")
    out_path = out_path or (os.path.splitext(src)[0] + "_chuanhoa.geojson")
    log(f"▶ Bắt đầu chuẩn hóa: {os.path.basename(src)}")
    log(f"  • Kinh tuyến trục VN-2000: {lon0}° (k=0.9999)")
    feats = read_cad(src, lon0, log, gd_id, gd_secret)
    if not feats: raise RuntimeError("Không có đối tượng nào đọc được (file rỗng hoặc sai định dạng).")
    regions = build_regions(feats, do_polygonize=do_polygonize, snap=snap, log=log)
    regions = dedup_and_clean(regions, log)              # dọn topology: bỏ trùng + mảnh vụn
    sel_regions = regions
    if dedup:                                            # (tuỳ chọn) tách cụm & giữ 1 cụm
        clusters = split_clusters(regions)
        _LAST.update(src=src, regions=regions, clusters=clusters, lon0=lon0, selected=0, web_style=web_style)
        if len(clusters) > 1:
            infos = cluster_infos(regions, clusters)
            log(f"  ⚑ Phát hiện {len(clusters)} cụm rời nhau (có thể là tờ bản đồ TRÙNG LẶP):")
            for i, inf in enumerate(infos):
                log(f"      Cụm #{i + 1}: {inf['n']} vùng · tâm ({inf['lat']:.5f}, {inf['lon']:.5f})")
            sel = 0 if str(keep_cluster) in ("None", "auto", "") else max(0, min(int(keep_cluster), len(clusters) - 1))
            sel_regions = [regions[j] for j in clusters[sel]]; _LAST["selected"] = sel
            log(f"  ✂ Khử trùng lặp: GIỮ Cụm #{sel + 1} ({len(sel_regions)} vùng), bỏ {len(regions) - len(sel_regions)} vùng cụm khác.")
    n = write_geojson(sel_regions, out_path, web_style=web_style, log=log)
    _qa_report(sel_regions, log)
    if n == 0: log("  ⚠ 0 vùng — có thể file chỉ toàn line hở: bật 'Tạo vùng' hoặc kiểm tra ranh khép kín.")
    log("▶ HOÀN TẤT. Kiểm tra chồng nền vệ tinh; nếu lệch → chọn lại kinh tuyến trục tỉnh.")
    return out_path

# ============================================================================
#  CLI
# ============================================================================
def main_cli(argv):
    import argparse
    ap = argparse.ArgumentParser(description="Chuẩn hóa DGN/DXF → GeoJSON (WGS84) cho web.")
    ap.add_argument("input", help="File DGN/DXF/DWG")
    ap.add_argument("--out", help="File GeoJSON xuất ra")
    ap.add_argument("--lon0", type=float, default=108.25, help="Kinh tuyến trục VN-2000 (mặc định 108.25 = Khánh Hòa)")
    ap.add_argument("--no-polygonize", action="store_true", help="KHÔNG tạo vùng từ đường ranh")
    ap.add_argument("--snap", type=float, default=0.0, help="Bắt điểm (độ, vd 0.000001) để nối ranh hở")
    a = ap.parse_args(argv)
    run_pipeline(a.input, a.out, a.lon0, not a.no_polygonize, a.snap)

if __name__ == "__main__":
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--gui"):
        try: main_cli(sys.argv[1:])
        except Exception as e:
            print("LỖI:", e); traceback.print_exc(); sys.exit(1)
    else:
        try:
            from gui import launch_gui  # giao diện ở gui.py
            gdal_ok = HAS_GDAL or bool(find_ogr2ogr())  # có binding HOẶC có ogr2ogr binary là chạy được
            launch_gui(run_pipeline, KTT_TINH, find_ogr2ogr, find_oda, gdal_ok, HAS_SHAPELY,
                       make_map_html, reexport, last_clusters)
        except Exception as e:
            print("Không mở được giao diện:", e)
            print("Dùng dòng lệnh:  python ChuanHoaDGN.py <file.dgn> --out ketqua.geojson")
