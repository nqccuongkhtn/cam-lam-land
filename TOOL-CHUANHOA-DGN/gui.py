# -*- coding: utf-8 -*-
"""Giao diện (Tkinter) cho ChuanHoaDGN — trực quan, đầy đủ.
Không cần cài thêm gì (Tkinter có sẵn trong Python)."""
import os, json, threading, traceback, webbrowser, subprocess
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

try:
    import tkintermapview  # bản đồ vệ tinh NHÚNG ngay trong phần mềm (pip install tkintermapview)
    HAS_MAPVIEW = True
except Exception:
    HAS_MAPVIEW = False

try:
    from tkinterdnd2 import TkinterDnD, DND_FILES  # kéo-thả file từ Windows (pip install tkinterdnd2)
    HAS_DND = True
except Exception:
    HAS_DND = False

NAVY = "#0A2540"; GOLD = "#C8A14B"; GREEN = "#059669"
ODA_URL = "https://www.opendesign.com/guestfiles/oda_file_converter"
GDAL_URL = "https://www.osgeo.org/projects/gdal/"

def launch_gui(run_pipeline, KTT_TINH, find_ogr2ogr, find_oda, HAS_GDAL, HAS_SHAPELY,
               make_map_html=None, reexport=None, last_clusters=None):
    global HAS_DND
    if HAS_DND:
        try: root = TkinterDnD.Tk()
        except Exception: root = tk.Tk(); HAS_DND = False
    else:
        root = tk.Tk()
    root.title("Chuẩn hóa bản đồ DGN → GeoJSON  v1.1 · Cam Lâm Land")
    root.geometry("980x720"); root.minsize(900, 640); root.configure(bg="#eef2f7")

    style = ttk.Style()
    try: style.theme_use("clam")
    except Exception: pass
    style.configure("TProgressbar", troughcolor="#dbe3ec", background=GREEN, thickness=10)

    sel_files = []                       # danh sách file đã chọn (xử lý hàng loạt)
    out_dir_var = tk.StringVar()         # thư mục xuất (trống = cạnh file gốc)
    ktt_var = tk.StringVar(value=list(KTT_TINH.keys())[0])
    poly_var = tk.BooleanVar(value=True)
    snap_var = tk.StringVar(value="0")
    webcol_var = tk.BooleanVar(value=True)    # màu ranh thửa đồng bộ web (xanh dương)
    # Cấu hình đổi DGN V8 qua mạng (GroupDocs) — lưu để khỏi gõ lại
    CFG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chuanhoa_config.json")
    _cfg = {}
    try:
        if os.path.isfile(CFG_PATH):
            with open(CFG_PATH, encoding="utf-8") as _f: _cfg = json.load(_f)
    except Exception: _cfg = {}
    gid_var = tk.StringVar(value=_cfg.get("gd_id", ""))
    gsecret_var = tk.StringVar(value=_cfg.get("gd_secret", ""))
    def save_cfg():
        try:
            with open(CFG_PATH, "w", encoding="utf-8") as _f:
                json.dump({"gd_id": gid_var.get().strip(), "gd_secret": gsecret_var.get().strip()}, _f)
        except Exception: pass

    # ================= HEADER =================
    hd = tk.Frame(root, bg=NAVY); hd.pack(fill="x")
    # Trái: tiêu đề + mô tả
    hl = tk.Frame(hd, bg=NAVY); hl.pack(side="left", padx=16, pady=10)
    tk.Label(hl, text="🗺  Chuẩn hóa bản đồ DGN → GeoJSON", bg=NAVY, fg="white",
             font=("Segoe UI", 16, "bold")).pack(anchor="w")
    tk.Label(hl, text="Đọc DGN/DXF · sửa lỗi · tạo vùng · giữ màu gốc · xuất GeoJSON cho web",
             bg=NAVY, fg="#9fb3c8", font=("Segoe UI", 9)).pack(anchor="w")
    # Phải: thương hiệu + NGƯỜI PHÁT TRIỂN ngay dưới chữ Cam Lâm Land
    hr = tk.Frame(hd, bg=NAVY); hr.pack(side="right", padx=16, pady=10)
    tk.Label(hr, text="Cam Lâm Land", bg=NAVY, fg=GOLD, font=("Segoe UI", 13, "bold")).pack(anchor="e")
    tk.Label(hr, text="Phát triển bởi Nguyễn Quốc Cường · ĐT: 0357235365",
             bg=NAVY, fg="#9fb3c8", font=("Segoe UI", 8)).pack(anchor="e")

    # ================= 2 CỘT =================
    main = tk.Frame(root, bg="#eef2f7"); main.pack(fill="both", expand=True, padx=12, pady=10)
    left = tk.Frame(main, bg="#eef2f7"); left.pack(side="left", fill="both", expand=True)
    right = tk.Frame(main, bg="#eef2f7", width=380); right.pack(side="right", fill="both"); right.pack_propagate(False)

    def card(parent, title):
        c = tk.Frame(parent, bg="white", highlightbackground="#dbe3ec", highlightthickness=1)
        c.pack(fill="x", pady=(0, 10))
        if title:
            tk.Label(c, text=title, bg="white", fg=NAVY, font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=12, pady=(10, 2))
        return c

    # ---- Card 1: Trạng thái công cụ ----
    oda = find_oda()
    c0 = card(left, "① Công cụ (kiểm tra trước khi chạy)")
    row = tk.Frame(c0, bg="white"); row.pack(fill="x", padx=12, pady=(0, 4))
    def badge(parent, ok, label, opt=False):
        f = tk.Frame(parent, bg="white"); f.pack(side="left", padx=(0, 18))
        d = tk.Canvas(f, width=13, height=13, bg="white", highlightthickness=0); d.pack(side="left")
        col = "#22c55e" if ok else ("#f59e0b" if opt else "#ef4444")
        d.create_oval(2, 2, 12, 12, fill=col, outline="")
        tk.Label(f, text=" " + label, bg="white", font=("Segoe UI", 9)).pack(side="left")
    badge(row, HAS_GDAL, "GDAL / ogr2ogr"); badge(row, HAS_SHAPELY, "Shapely")
    badge(row, bool(oda), "ODA (chỉ cho DGN V8)", opt=True)
    ready = HAS_GDAL and HAS_SHAPELY
    tk.Label(c0, text=("✔ Sẵn sàng chạy." if ready else "⚠ Thiếu thư viện — bấm 1_CaiDat.bat rồi mở lại."),
             bg="white", fg=(GREEN if ready else "#b45309"), font=("Segoe UI", 9, "bold")).pack(anchor="w", padx=12)
    fixrow = tk.Frame(c0, bg="white"); fixrow.pack(fill="x", padx=12, pady=(4, 10))
    def link_btn(txt, url):
        tk.Button(fixrow, text=txt, font=("Segoe UI", 8), fg=NAVY, bg="#eef2f7", relief="flat",
                  cursor="hand2", command=lambda: webbrowser.open(url)).pack(side="left", padx=(0, 6))
    if not HAS_GDAL: link_btn("↗ Cài GDAL (OSGeo4W)", GDAL_URL)
    if not oda: link_btn("↗ Tải ODA File Converter", ODA_URL)

    # ---- Card 2: Chọn NHIỀU file ----
    c1 = card(left, "② Chọn file bản đồ CAD (chọn / thả NHIỀU file)")
    DROP_HINT = "Bấm để chọn  hoặc  KÉO-THẢ NHIỀU file  .dgn / .dxf / .dwg  vào đây"
    def refresh_list():
        flist.delete(0, "end")
        for p in sel_files: flist.insert("end", "  " + os.path.basename(p))
        cnt_lbl.config(text=(f"✅ {len(sel_files)} file đã chọn" if sel_files else "Chưa chọn file nào"))
        if sel_files:
            drop_icon.config(text="✅")
            drop_txt.config(text=f"{len(sel_files)} file đã chọn — thả/bấm để thêm nữa",
                            fg=NAVY, font=("Segoe UI", 10, "bold"))
        else:
            drop_icon.config(text="📁")
            drop_txt.config(text=(DROP_HINT if HAS_DND else "Bấm để chọn nhiều file  .dgn / .dxf / .dwg"),
                            fg="#64748b", font=("Segoe UI", 10))
    def add_files(paths):
        for f in paths:
            f = (f or "").strip().strip("{}").strip('"')
            if not f or not os.path.isfile(f): continue
            if os.path.splitext(f)[1].lower() not in (".dgn", ".dxf", ".dwg"): continue
            if f not in sel_files: sel_files.append(f)
        refresh_list()
    def pick_src():
        fs = filedialog.askopenfilenames(title="Chọn file CAD (giữ Ctrl/Shift để chọn nhiều)",
              filetypes=[("CAD", "*.dgn *.dxf *.dwg"), ("Tất cả", "*.*")])
        if fs: add_files(list(fs))
    def on_drop(event):
        import re
        paths = re.findall(r"\{([^}]*)\}", event.data) or event.data.split()
        add_files(paths)
    drop = tk.Frame(c1, bg="#f7fafc", highlightbackground="#cbd5e1", highlightthickness=1, cursor="hand2")
    drop.pack(fill="x", padx=12, pady=(0, 8)); drop.bind("<Button-1>", lambda e: pick_src())
    drop_icon = tk.Label(drop, text="📁", bg="#f7fafc", font=("Segoe UI", 22)); drop_icon.pack(pady=(10, 0))
    drop_icon.bind("<Button-1>", lambda e: pick_src())
    drop_txt = tk.Label(drop, text=(DROP_HINT if HAS_DND else "Bấm để chọn nhiều file  .dgn / .dxf / .dwg"),
                        bg="#f7fafc", fg="#64748b", font=("Segoe UI", 10)); drop_txt.pack(pady=(0, 10))
    drop_txt.bind("<Button-1>", lambda e: pick_src())
    if HAS_DND:
        try:
            for w in (drop, drop_icon, drop_txt):
                w.drop_target_register(DND_FILES); w.dnd_bind("<<Drop>>", on_drop)
            def _enter(e): drop.config(bg="#e0f2fe", highlightbackground=NAVY)
            def _leave(e): drop.config(bg="#f7fafc", highlightbackground="#cbd5e1")
            for w in (drop, drop_icon, drop_txt):
                w.dnd_bind("<<DropEnter>>", _enter); w.dnd_bind("<<DropLeave>>", _leave)
        except Exception: pass
    lf = tk.Frame(c1, bg="white"); lf.pack(fill="x", padx=12, pady=(0, 2))
    flist = tk.Listbox(lf, height=4, font=("Segoe UI", 9), activestyle="none", selectmode="extended",
                       highlightthickness=1, highlightbackground="#cbd5e1")
    flist.pack(side="left", fill="both", expand=True)
    sb = ttk.Scrollbar(lf, orient="vertical", command=flist.yview); sb.pack(side="right", fill="y")
    flist.config(yscrollcommand=sb.set)
    btnf = tk.Frame(c1, bg="white"); btnf.pack(fill="x", padx=12, pady=(2, 2))
    def del_sel():
        for i in sorted(flist.curselection(), reverse=True):
            if 0 <= i < len(sel_files): del sel_files[i]
        refresh_list()
    def del_all(): sel_files.clear(); refresh_list()
    tk.Button(btnf, text="✕ Bỏ mục chọn", command=del_sel, relief="flat", bg="#eef2f7", cursor="hand2").pack(side="left")
    tk.Button(btnf, text="🗑 Xoá hết", command=del_all, relief="flat", bg="#eef2f7", cursor="hand2").pack(side="left", padx=(6, 0))
    cnt_lbl = tk.Label(c1, text="Chưa chọn file nào", bg="white", fg="#64748b", font=("Segoe UI", 8)); cnt_lbl.pack(anchor="w", padx=12, pady=(0, 8))

    # ---- Card 3: Tuỳ chọn ----
    c2 = card(left, "③ Tuỳ chọn chuẩn hóa")
    r3 = tk.Frame(c2, bg="white"); r3.pack(fill="x", padx=12, pady=(0, 6))
    tk.Label(r3, text="Kinh tuyến trục (tỉnh):", bg="white", width=20, anchor="w").pack(side="left")
    ttk.Combobox(r3, textvariable=ktt_var, values=list(KTT_TINH.keys()), state="readonly", width=34).pack(side="left")
    r4 = tk.Frame(c2, bg="white"); r4.pack(fill="x", padx=12, pady=(0, 6))
    tk.Checkbutton(r4, text="Tạo vùng từ đường ranh (polygonize)", variable=poly_var, bg="white").pack(side="left")
    tk.Label(r4, text="   Bắt điểm (snap):", bg="white").pack(side="left")
    tk.Entry(r4, textvariable=snap_var, width=10).pack(side="left")
    r4c = tk.Frame(c2, bg="white"); r4c.pack(fill="x", padx=12, pady=(0, 6))
    tk.Checkbutton(r4c, text="Màu ranh thửa đồng bộ web (xanh dương)", variable=webcol_var, bg="white").pack(side="left")
    r5 = tk.Frame(c2, bg="white"); r5.pack(fill="x", padx=12, pady=(0, 10))
    tk.Label(r5, text="Thư mục xuất:", bg="white", anchor="w").pack(side="left")
    tk.Entry(r5, textvariable=out_dir_var, font=("Segoe UI", 9)).pack(side="left", fill="x", expand=True, padx=(6, 0))
    def pick_out():
        d = filedialog.askdirectory(title="Chọn thư mục xuất GeoJSON")
        if d: out_dir_var.set(d)
    tk.Button(r5, text="📁 Chọn…", command=pick_out, relief="flat", bg="#eef2f7", cursor="hand2").pack(side="left", padx=(6, 0))
    tk.Label(c2, text="(Để trống = xuất cạnh mỗi file gốc. Mỗi file → 1 GeoJSON riêng.)",
             bg="white", fg="#94a3b8", font=("Segoe UI", 8)).pack(anchor="w", padx=12, pady=(0, 8))

    # ---- Card 4: Đổi DGN V8 qua mạng (tuỳ chọn) ----
    c3 = card(left, "④ Đổi DGN V8 qua mạng (GroupDocs — cho file V8)")
    tk.Label(c3, text="File DGN V8 không đọc được offline. Nhập Client ID/Secret (GroupDocs miễn phí) "
                      "để tự đổi V8→DXF qua mạng. ⚠ File sẽ được gửi lên máy chủ GroupDocs.",
             bg="white", fg="#64748b", font=("Segoe UI", 8), wraplength=520, justify="left").pack(anchor="w", padx=12, pady=(0, 4))
    g1 = tk.Frame(c3, bg="white"); g1.pack(fill="x", padx=12, pady=(0, 4))
    tk.Label(g1, text="Client ID:", bg="white", width=10, anchor="w").pack(side="left")
    tk.Entry(g1, textvariable=gid_var, font=("Segoe UI", 9)).pack(side="left", fill="x", expand=True)
    g2 = tk.Frame(c3, bg="white"); g2.pack(fill="x", padx=12, pady=(0, 4))
    tk.Label(g2, text="Secret:", bg="white", width=10, anchor="w").pack(side="left")
    tk.Entry(g2, textvariable=gsecret_var, font=("Segoe UI", 9), show="•").pack(side="left", fill="x", expand=True)
    g3 = tk.Frame(c3, bg="white"); g3.pack(fill="x", padx=12, pady=(0, 10))
    tk.Button(g3, text="↗ Lấy key miễn phí (dashboard.groupdocs.cloud)", font=("Segoe UI", 8),
              fg=NAVY, bg="#eef2f7", relief="flat", cursor="hand2",
              command=lambda: webbrowser.open("https://dashboard.groupdocs.cloud/applications")).pack(side="left")

    # ---- Nút chạy + progress ----
    run_btn = tk.Button(left, text="▶  CHẠY CHUẨN HÓA", bg=GREEN, fg="white",
                        font=("Segoe UI", 13, "bold"), height=2, relief="flat", cursor="hand2")
    run_btn.pack(fill="x", pady=(2, 6))
    prog = ttk.Progressbar(left, mode="indeterminate", style="TProgressbar"); prog.pack(fill="x")

    # ---- Log ----
    tk.Label(left, text="Nhật ký:", bg="#eef2f7", anchor="w").pack(fill="x", pady=(8, 2))
    logbox = tk.Text(left, height=9, font=("Consolas", 9), wrap="word",
                     bg="#0f1b2d", fg="#d6e2f0", insertbackground="white", relief="flat")
    logbox.pack(fill="both", expand=True)
    def log(m): logbox.insert("end", str(m) + "\n"); logbox.see("end"); logbox.update_idletasks()
    def log_ts(m): root.after(0, lambda: log(m))

    # ================= CỘT PHẢI: XEM TRƯỚC =================
    cp = tk.Frame(right, bg="white", highlightbackground="#dbe3ec", highlightthickness=1)
    cp.pack(fill="both", expand=True)
    tk.Label(cp, text="👁  Xem trước kết quả", bg="white", fg=NAVY, font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=12, pady=(10, 4))
    stat_lbl = tk.Label(cp, text="Chưa có kết quả.", bg="white", fg="#64748b", font=("Segoe UI", 9)); stat_lbl.pack(anchor="w", padx=12)
    mapview = None; canvas = None
    if HAS_MAPVIEW:
        mapview = tkintermapview.TkinterMapView(cp, height=340, corner_radius=0)
        try: mapview.set_tile_server("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", max_zoom=22)
        except Exception: pass
        mapview.set_position(12.9, 109.1); mapview.set_zoom(10)
        mapview.pack(fill="x", padx=12, pady=8)
    else:
        canvas = tk.Canvas(cp, bg="#0f1b2d", height=330, highlightthickness=0); canvas.pack(fill="x", padx=12, pady=8)
        canvas.create_text(175, 160, text="Kết quả sẽ hiện ở đây\nsau khi bấm CHẠY", fill="#3f5570", justify="center", font=("Segoe UI", 10))
    tk.Label(cp, text="Chú giải level → màu:", bg="white", fg=NAVY, font=("Segoe UI", 9, "bold")).pack(anchor="w", padx=12)
    legend = tk.Frame(cp, bg="white"); legend.pack(fill="both", expand=True, padx=12, pady=(2, 8))

    def draw_preview(path):
        if canvas is not None: canvas.delete("all")
        [w.destroy() for w in legend.winfo_children()]
        try:
            with open(path, encoding="utf-8", errors="replace") as fp: fc = json.load(fp)
        except Exception: return
        feats = fc.get("features", [])
        xs, ys, polys, colors = [], [], [], {}
        def rings(geom):
            t = geom.get("type"); c = geom.get("coordinates", [])
            if t == "Polygon": return [c[0]] if c else []
            if t == "MultiPolygon": return [p[0] for p in c if p]
            return []
        for f in feats:
            col = (f.get("properties") or {}).get("c") or "#7aa2c8"
            lvl = (f.get("properties") or {}).get("lo") or "0"
            colors[lvl] = col
            for ring in rings(f.get("geometry") or {}):
                pr = [(pt[0], pt[1]) for pt in ring if len(pt) >= 2]  # (lon,lat)
                if len(pr) >= 3:
                    polys.append((pr, col))
                    for x, y in pr: xs.append(x); ys.append(y)
        stat_lbl.config(text=f"✅ {len(feats)} vùng · {len(colors)} level")
        if not xs:
            if canvas is not None: canvas.create_text(150, 160, text="(Không có vùng để xem)", fill="#94a3b8")
            return
        # KHUNG ROBUST: bỏ điểm ngoại lai (percentile 1–99) để phóng đúng vùng
        sx_, sy_ = sorted(xs), sorted(ys)
        def pct(a, p): return a[min(len(a) - 1, max(0, int(len(a) * p)))]
        minx, maxx, miny, maxy = pct(sx_, 0.01), pct(sx_, 0.99), pct(sy_, 0.01), pct(sy_, 0.99)
        if HAS_MAPVIEW and mapview is not None:
            try: mapview.delete_all_polygon()
            except Exception: pass
            for pr, col in polys[:2000]:
                try: mapview.set_polygon([(y, x) for (x, y) in pr], outline_color=col, border_width=2, fill_color=None)
                except Exception: pass
            try: mapview.fit_bounding_box((maxy, minx), (miny, maxx))
            except Exception:
                try: mapview.set_position((miny + maxy) / 2, (minx + maxx) / 2); mapview.set_zoom(14)
                except Exception: pass
        else:
            canvas.update_idletasks()
            W = canvas.winfo_width()
            if W < 50: W = 340
            H = 330; pad = 12
            s = min((W - 2 * pad) / (maxx - minx or 1e-9), (H - 2 * pad) / (maxy - miny or 1e-9))
            def T(x, y): return (pad + (x - minx) * s, H - pad - (y - miny) * s)
            for pr, col in polys[:6000]:
                pts = []
                for x, y in pr: X, Y = T(x, y); pts += [X, Y]
                try: canvas.create_polygon(pts, fill="", outline=col, width=1)
                except Exception: pass
        # chú giải
        for i, (lvl, col) in enumerate(list(colors.items())[:14]):
            rowf = tk.Frame(legend, bg="white"); rowf.pack(anchor="w", pady=1)
            sw = tk.Canvas(rowf, width=16, height=12, highlightthickness=1, highlightbackground="#cbd5e1")
            sw.pack(side="left"); sw.create_rectangle(0, 0, 16, 12, fill=col, outline="")
            tk.Label(rowf, text=f" {lvl}", bg="white", font=("Segoe UI", 8)).pack(side="left")

    # ================= CHẠY (hàng loạt) =================
    def worker():
        files = list(sel_files)
        odir = out_dir_var.get().strip()
        gid = gid_var.get().strip(); gsec = gsecret_var.get().strip()
        save_cfg()
        try:
            lon0 = KTT_TINH[ktt_var.get()]; snap = float(snap_var.get() or 0)
        except Exception:
            snap = 0.0; lon0 = KTT_TINH[ktt_var.get()]
        ok, fail, last_out = 0, 0, None
        total = len(files)
        for i, src in enumerate(files, 1):
            base = os.path.splitext(os.path.basename(src))[0] + "_chuanhoa.geojson"
            out = os.path.join(odir, base) if odir else (os.path.splitext(src)[0] + "_chuanhoa.geojson")
            log_ts(f"━━ [{i}/{total}] {os.path.basename(src)}")
            try:
                run_pipeline(src, out, lon0, poly_var.get(), snap, False, None, webcol_var.get(),
                             log_ts, gid, gsec)
                ok += 1; last_out = out
                root.after(0, lambda o=out: draw_preview(o))
            except Exception as e:
                fail += 1
                log_ts(f"  ❌ LỖI ({os.path.basename(src)}): {e}")
        log_ts(f"\n█ HOÀN TẤT: {ok} file thành công, {fail} lỗi / tổng {total}.")
        def done():
            prog.stop(); run_btn.config(state="normal", text="▶  CHẠY CHUẨN HÓA")
            if total:
                messagebox.showinfo("Xong", f"Đã xử lý {total} file:\n✅ {ok} thành công · ❌ {fail} lỗi"
                                    + (f"\n\nXem trước: {os.path.basename(last_out)}" if last_out else ""))
        root.after(0, done)

    def on_run():
        if not sel_files:
            messagebox.showwarning("Thiếu file", "Hãy chọn (hoặc kéo-thả) ít nhất 1 file DGN/DXF."); return
        if not (HAS_GDAL and HAS_SHAPELY):
            messagebox.showwarning("Thiếu thư viện", "Chưa cài GDAL/Shapely. Bấm 1_CaiDat.bat rồi mở lại."); return
        logbox.delete("1.0", "end"); prog.start(12)
        run_btn.config(state="disabled", text="Đang xử lý…")
        threading.Thread(target=worker, daemon=True).start()
    run_btn.config(command=on_run)

    root.mainloop()
