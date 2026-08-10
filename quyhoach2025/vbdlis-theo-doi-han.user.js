// ==UserScript==
// @name         VBDLIS – Báo cáo nội bộ theo dõi hạn hồ sơ
// @namespace    vbdlis.noibo
// @version      1.0.9
// @author       Nguyễn Quốc Cường
// @match        https://khh.mplis.gov.vn/dc/Home/XuLyCongViec*
// @match        https://khh.mplis.gov.vn/dc/quanlydieuhanh/quanlyhoso*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  // Heartbeat: nếu thấy dòng này trong Console (F12) tức là script ĐÃ chạy trong trang.
  try { console.log('%c[VBDLIS] userscript đã nạp: ' + location.href, 'color:#0a0;font-weight:700'); } catch (e) {}

  /* =======================================================================
   * (1) CONFIG – toàn bộ hằng số cấu hình, đặt ở đầu file để dễ sửa 1 chỗ.
   *     Khi VBDLIS đổi giao diện, chỉ cần cập nhật khối SEL_* bên dưới.
   * ===================================================================== */
  const CFG = {
    SYNC_MS: 300000,             // chu kỳ tự đồng bộ, mặc định 5 phút
    TICK_MS: 1000,               // nhịp đồng hồ 1 giây
    SOON_MS: 86400000,           // ngưỡng "sắp hết hạn" = 24 giờ
    MAX_PAGES: 10,               // số trang tối đa mỗi lần quét (0 = hết). Danh sách lớn: nên LỌC trước (tab Quá hạn…) rồi mở báo cáo
    STOP_KEYWORDS: ['đã kết iso', 'dừng tính', 'tạm dừng'], // từ khóa hồ sơ đã dừng tính thời gian (so khớp KHÔNG dấu, KHÔNG phân biệt hoa/thường)
    SEL_SEARCH_INPUT: '#txtTraCuuHoSoTiepNhan',  // ô tìm nhanh theo số biên nhận
    SEL_SEARCH_BTN:   '#btnTraCuuHoSoTiepNhan',  // nút tìm
    SEL_TABLE:        '#tblTraCuuHoSoTiepNhan',   // bảng danh sách hồ sơ thụ lý
    SEL_INFO:         '#tblTraCuuHoSoTiepNhan_info',    // dòng "Hiển thị từ … trong tổng số … hồ sơ"
    SEL_PAGER:        '#tblTraCuuHoSoTiepNhan_wrapper .paginate_button', // các nút phân trang
    STORAGE_PREFIX:   'vbdlis_theodoihan_'       // khóa localStorage, ghép thêm tên tài khoản
  };

  // Bảng nhãn chế độ ưu tiên (dùng cho MODE_LABEL và hậu tố tiêu đề nhóm).
  const MODES = { both: 'Cả hai mốc (bước xử lý + hồ sơ)', buoc: 'Chỉ hạn bước xử lý', hoso: 'Chỉ hạn hồ sơ (hẹn trả)' };
  const SUFFIX = { both: '(xét cả 2 mốc)', buoc: '(chỉ bước xử lý)', hoso: '(chỉ hồ sơ)' };

  /* =======================================================================
   * (2) UTIL – chuẩn hoá chuỗi, bỏ dấu, parse ngày giờ, format thời lượng.
   * ===================================================================== */
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  // Bỏ dấu tiếng Việt + đ→d + thường hoá (dùng cho so khớp/tìm kiếm không dấu).
  function noAccent(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd');
  }

  // Parse ngày giờ: chấp nhận dd/MM/yyyy [HH:mm[:ss]] và yyyy-MM-dd [HH:mm[:ss]]. Trả epoch ms hoặc null.
  function parseDT(s) {
    if (!s) return null;
    const t = String(s).trim();
    let m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)); return isNaN(+d) ? null : +d; }
    m = t.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)); return isNaN(+d) ? null : +d; }
    return null;
  }
  const fmtDate = (ms) => { if (!ms) return '—'; const d = new Date(ms); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear(); };
  const fmtDT = (ms) => { if (!ms) return '—'; const d = new Date(ms); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const fmtClock = (ms) => { const d = new Date(ms); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); };
  const fmtDMY = (ms) => { const d = new Date(ms); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear(); };

  // Format thời lượng: "Còn/Quá hạn X ngày Y giờ Z phút"; nếu |chênh| < 24h thì hiển thị tới giây; bỏ đơn vị bằng 0.
  function fmtDur(diff) {
    const over = diff < 0, absOrig = Math.abs(diff);
    let a = absOrig;
    const day = Math.floor(a / 86400000); a -= day * 86400000;
    const hr = Math.floor(a / 3600000); a -= hr * 3600000;
    const mi = Math.floor(a / 60000); a -= mi * 60000;
    const se = Math.floor(a / 1000);
    const pre = over ? 'Quá hạn' : 'Còn', parts = [];
    if (absOrig < 86400000) { // dưới 24 giờ → hiển thị tới giây
      if (hr) parts.push(hr + ' giờ'); if (mi) parts.push(mi + ' phút'); parts.push(se + ' giây');
    } else { // từ 24 giờ trở lên → ngày / giờ / phút
      if (day) parts.push(day + ' ngày'); if (hr) parts.push(hr + ' giờ'); if (mi) parts.push(mi + ' phút');
      if (!parts.length) parts.push('0 phút');
    }
    return pre + ' ' + parts.join(' ');
  }

  /* =======================================================================
   * (8-STORAGE) – ẩn dòng lưu localStorage theo TÀI KHOẢN đang đăng nhập.
   * ===================================================================== */
  const storeKey = () => CFG.STORAGE_PREFIX + noAccent(VB.account || '');
  function loadHidden() { try { return JSON.parse(localStorage.getItem(storeKey()) || '[]') || []; } catch (e) { return []; } }
  function saveHidden(arr) { try { localStorage.setItem(storeKey(), JSON.stringify(arr || [])); } catch (e) {} }

  /* =======================================================================
   * (3) CRAWL – đọc dữ liệu bảng VBDLIS, duyệt phân trang, đọc ACCOUNT/TOTAL/PAGES.
   *     Chỉ ĐỌC dữ liệu đang hiển thị, không bấm nút nghiệp vụ.
   * ===================================================================== */
  // Đọc tên tài khoản từ thanh điều hướng trên cùng (.nav_menu, cạnh avatar chữ cái đầu).
  function readAccount() {
    try {
      const box = document.querySelector('.nav_menu') || document.querySelector('.top_nav') || document.querySelector('header') || document;
      const txt = Array.from(box.querySelectorAll('a,span,b,strong')).filter((el) => !el.children.length).map((el) => norm(el.textContent));
      const uname = /^[A-Za-z][A-Za-z0-9_.]{2,29}$/;
      for (const t of txt) if (uname.test(t) && /[_.]/.test(t)) return t;              // 1) token có _ hoặc . = tên đăng nhập
      for (const t of txt) if (uname.test(t) && !/^(menu|home|logout)$/i.test(t)) return t; // 2) token 1 từ
      let best = '';                                                                    // 3) họ tên 2+ từ
      for (const t of txt) if (t.length >= 4 && t.length <= 40 && !/[0-9@]/.test(t) && t.split(' ').length >= 2 && t.length > best.length) best = t;
      return best || '—';
    } catch (e) { return '—'; }
  }

  // Đọc TOTAL từ dòng info ("… trong tổng số M hồ sơ …").
  function readInfoTotal() {
    const el = document.querySelector(CFG.SEL_INFO);
    if (!el) return null;
    const m = noAccent(el.textContent).match(/tong so\s+([\d.,]+)/);
    return m ? parseInt(m[1].replace(/[.,]/g, ''), 10) : null;
  }

  // Đọc số trang lớn nhất từ các nút phân trang, tôn trọng MAX_PAGES.
  function readMaxPage() {
    let mx = 1;
    document.querySelectorAll(CFG.SEL_PAGER).forEach((b) => { const n = parseInt(norm(b.textContent), 10); if (!isNaN(n) && n > mx) mx = n; });
    if (CFG.MAX_PAGES > 0) mx = Math.min(mx, CFG.MAX_PAGES);
    return mx;
  }

  // Đọc 1 hồ sơ từ ô gộp "Thông tin hồ sơ": mã trong <b>, nhãn ở một dòng, giá trị ở dòng kế.
  function readPage(table, out) {
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((tr) => {
      if (tr.querySelector('td.dataTables_empty')) return;
      const cell = tr.cells[tr.cells.length - 1]; // ô cuối = khối thông tin hồ sơ
      if (!cell) return;
      const bEl = cell.querySelector('b');
      const ma = bEl ? norm(bEl.textContent) : '';
      if (!ma) return;
      const lines = (cell.innerText || '').split('\n').map((s) => norm(s)).filter(Boolean);
      // Trả giá trị của nhãn: "Nhãn:" nằm 1 dòng, giá trị ở dòng kế (hoặc "Nhãn: giá trị" cùng dòng).
      const after = (lbl) => {
        const e = lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i] === lbl + ':' || lines[i] === lbl) return lines[i + 1] || '';
          const m = lines[i].match(new RegExp('^' + e + ':\\s*(.+)$'));
          if (m) return m[1];
        }
        return '';
      };
      // Các dòng đầu (trước nhãn có ':') = mã, thủ tục, đơn vị/địa danh.
      const head = [];
      for (let i = 0; i < lines.length; i++) { if (/^(Tiếp nhận|Hẹn trả|Bước XL|Còn|CB chuyển|Vào lúc|Ghi chú|Người nộp|Thửa đất|Địa chỉ)\b/.test(lines[i])) break; head.push(lines[i]); }
      const thuTuc = head.slice(1).sort((a, b) => b.length - a.length)[0] || '';
      const thuaRaw = after('Thửa đất');                 // dạng "365(53)" = thửa(tờ)
      const tm = thuaRaw.match(/(\d+)\s*\(([^)]*)\)/);
      const thua = tm ? tm[1] : thuaRaw;
      const to = tm ? tm[2] : '';
      const ghiChu = after('Ghi chú');
      const trangThai = after('Trạng thái');
      // Mốc "Chuyển trước: dd/MM/yyyy HH:mm" = Hạn bước xử lý (phải chuyển trước).
      const ctMatch = lines.join(' ').match(/Chuyển trước:\s*(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2})?)/);
      const dueBuoc = ctMatch ? parseDT(ctMatch[1]) : null;
      const stt = trangThai || ghiChu;                 // "Đã kết ISO" nằm ở Trạng thái
      const stop = CFG.STOP_KEYWORDS.some((k) => noAccent(stt).indexOf(noAccent(k)) >= 0);
      out.push({
        ma: ma,
        donVi: head[1] || '',
        thuTuc: thuTuc,
        thua: thua,
        to: to,
        buoc: after('Bước XL'),
        vaoLuc: parseDT(after('Vào lúc')),
        cb: after('CB chuyển') || after('CB thụ lý') || '—',
        tiepNhan: parseDT(after('Tiếp nhận')),
        henTraRaw: after('Hẹn trả'),
        dueHoso: parseDT(after('Hẹn trả')),   // Hạn hồ sơ = Hẹn trả
        dueBuoc: dueBuoc,                       // Hạn bước xử lý = mốc "Chuyển trước"
        nguoiNop: after('Người nộp'),
        trangThai: stt,
        stop: stop,
        stopText: stop ? stt : ''
      });
    });
  }

  // Chờ bảng vẽ lại xong (chữ ký = info + mã dòng đầu đổi), tối đa ~6 giây.
  function tableSignature(table) {
    const info = document.querySelector(CFG.SEL_INFO);
    const first = table.querySelector('tbody tr');
    return (info ? norm(info.textContent) : '') + '|' + (first ? norm(first.innerText).slice(0, 40) : '');
  }
  function waitChange(table, oldSig) {
    return new Promise((res) => {
      let n = 0;
      const iv = setInterval(() => {
        n++;
        if (tableSignature(table) !== oldSig || n > 40) { clearInterval(iv); setTimeout(res, 120); }
      }, 150);
    });
  }
  // Tìm nút "trang kế" còn dùng được (không disabled).
  function nextBtn() {
    const wrap = document.querySelector(CFG.SEL_PAGER + '.next') || document.querySelector('#' + CFG.SEL_TABLE.slice(1) + '_next');
    const b = document.querySelector('#' + CFG.SEL_TABLE.slice(1) + '_next') || wrap;
    if (b && !/disabled/.test(b.className)) return b;
    return null;
  }
  async function goToPage1() {
    const first = document.querySelector('#' + CFG.SEL_TABLE.slice(1) + '_first');
    const table = document.querySelector(CFG.SEL_TABLE);
    if (first && !/disabled/.test(first.className) && table) { const s = tableSignature(table); first.click(); await waitChange(table, s); }
  }

  // Quét hết các trang → trả { rows, pages }. Cuối cùng đưa bảng về trang 1.
  async function crawl() {
    const table = document.querySelector(CFG.SEL_TABLE);
    if (!table) return { error: 'Không tìm thấy bảng danh sách hồ sơ (SEL_TABLE). Kiểm tra lại selector trong CONFIG.', rows: [], pages: 0 };
    await goToPage1();
    const rows = []; let page = 1;
    const maxPage = readMaxPage();
    while (true) {
      readPage(table, rows);
      if ((CFG.MAX_PAGES > 0 && page >= CFG.MAX_PAGES) || page >= maxPage) break;
      const nb = nextBtn();
      if (!nb) break;
      const sig = tableSignature(table);
      nb.click();
      await waitChange(table, sig);
      page++;
      if (page > 500) break; // chặn an toàn
    }
    await goToPage1();
    return { rows: rows, pages: page };
  }

  /* =======================================================================
   * (4) DEADLINE – tính hạn hồ sơ / hạn bước xử lý, phân nhóm 1–4, sắp xếp.
   * ===================================================================== */
  // Mốc hiệu lực dùng để phân nhóm theo chế độ ưu tiên.
  function effectiveDue(it, mode) {
    if (mode === 'hoso') return it.dueHoso;
    if (mode === 'buoc') return it.dueBuoc;
    const a = it.dueHoso, b = it.dueBuoc;
    if (a != null && b != null) return Math.min(a, b);
    return a != null ? a : b;
  }
  function groupOf(it, mode, now) {
    if (it.stop) return 'stop';
    const d = effectiveDue(it, mode);
    if (d == null) return 'ok';
    if (d < now) return 'over';
    if (d - now < CFG.SOON_MS) return 'soon';
    return 'ok';
  }
  // Sắp xếp + phân nhóm. Trả mảng đã xếp + số đếm.
  function organize(data, mode) {
    const now = Date.now();
    const g = { over: [], soon: [], ok: [], stop: [] };
    data.forEach((it) => { it._grp = groupOf(it, mode, now); it._due = effectiveDue(it, mode); g[it._grp].push(it); });
    const byDue = (x, y) => (x._due == null ? Infinity : x._due) - (y._due == null ? Infinity : y._due);
    g.over.sort(byDue); // quá hạn nhiều nhất (mốc xa nhất trong quá khứ) lên trước
    g.soon.sort(byDue); // còn ít thời gian nhất lên trước
    g.ok.sort(byDue);   // còn ít thời gian nhất lên trước
    // stop: giữ nguyên thứ tự quét
    return { over: g.over, soon: g.soon, ok: g.ok, stop: g.stop,
      n: { all: data.length, over: g.over.length, soon: g.soon.length, ok: g.ok.length, stop: g.stop.length } };
  }

  /* =======================================================================
   * (6-HEADER + 5-RENDER) – CSS + HTML báo cáo (nạp vào iframe qua srcdoc).
   * ===================================================================== */
  const CSS = `
  *{box-sizing:border-box}
  html,body{margin:0}
  body{font:13px/1.45 "Segoe UI",Arial,sans-serif;color:#222;background:#fff}
  .wrap{padding:10px 14px}
  /* ---- HEADER (giống hệt đặc tả) ---- */
  #nhdr{display:flex;justify-content:space-between;align-items:center;gap:18px;background:linear-gradient(120deg,#0b2d55,#134b86 55%,#1668ad);color:#fff;border-radius:14px;padding:14px 18px;margin:0 0 12px;box-shadow:0 6px 18px rgba(11,45,85,.25);font-family:"Segoe UI",Roboto,Arial,sans-serif}
  #nhdr *{box-sizing:border-box}
  #nhdr .nh-l{display:flex;gap:14px;align-items:center;min-width:0}
  #nhdr .nlogo{width:52px;height:52px;flex:0 0 52px;border-radius:12px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;letter-spacing:.5px}
  #nhdr h1{margin:0 0 3px;font-size:19px;line-height:1.2;letter-spacing:.3px;text-transform:uppercase;color:#fff}
  #nhdr .nmeta{font-size:11.5px;line-height:1.5;color:#cfe2f6}
  #nhdr .nmeta b{color:#fff}
  #nhdr .nh-r{display:flex;gap:12px;align-items:stretch;flex:0 0 auto}
  #nhdr .nclock{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:8px 14px;text-align:center;min-width:132px}
  #nhdr .nclock .t{font:700 24px/1 Consolas,monospace;letter-spacing:1px}
  #nhdr .nclock .d{font-size:11px;color:#cfe2f6;margin-top:3px}
  #nhdr .nsync{background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:8px 12px;font-size:11.5px;display:flex;flex-direction:column;justify-content:center;gap:4px;min-width:196px}
  #nhdr .nsync b{font-family:Consolas,monospace;font-size:13px}
  #nhdr .ndot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#4ade80;margin-right:5px;animation:nbl 1.4s infinite}
  @keyframes nbl{50%{opacity:.25}}
  @media(max-width:900px){#nhdr{flex-direction:column;align-items:flex-start}}
  /* ---- Ghi chú, thẻ, toolbar ---- */
  .note{color:#777;font-size:11px;margin:0 0 10px}
  .cards{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
  .card{background:#E3F2FD;border-left:5px solid #64B5F6;border-radius:8px;padding:7px 14px;cursor:pointer;min-width:120px;user-select:none}
  .card .cn{font-size:20px;font-weight:800;color:#0B3D63;line-height:1}
  .card .cl{font-size:11px;color:#37474f;margin-top:2px}
  .card.on{background:#0B3D63;border-left-color:#0B3D63}
  .card.on .cn,.card.on .cl{color:#fff}
  .tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px}
  .btn{background:#1565C0;color:#fff;border:0;border-radius:5px;font-size:12px;padding:6px 12px;cursor:pointer}
  .tools label{font-size:12px;color:#333;display:inline-flex;align-items:center;gap:4px}
  .tools select,.tools input[type=text]{font-size:12px;padding:5px 8px;border:1px solid #cfd8dc;border-radius:5px;background:#fff}
  .tools input[type=text]{min-width:220px}
  .shown{font-size:12px;color:#555;margin-left:auto}
  /* ---- Bảng ---- */
  .tb{overflow:auto;border:1px solid #E0E0E0;border-radius:8px}
  table.vt{border-collapse:collapse;width:100%;font-size:12px}
  table.vt thead th{background:#0B3D63;color:#fff;font-size:11.5px;font-weight:700;padding:7px 8px;text-align:left;position:sticky;top:0;z-index:2;white-space:nowrap}
  table.vt td{border-bottom:1px solid #eceff1;padding:6px 8px;vertical-align:top}
  tr.r-over{background:#FDECEB} tr.r-soon{background:#FFF8E1} tr.r-ok{background:#fff} tr.r-stop{background:#fafafa}
  .mahs{font-weight:700;font-size:12px;color:#0B3D63;cursor:pointer}
  .mahs:hover{text-decoration:underline;background:#e8f1fb}
  .sub{color:#777;font-size:10.5px;line-height:1.35;margin-top:2px}
  .v-over{color:#C62828;font-weight:700} .v-soon{color:#EF6C00;font-weight:700} .v-ok{color:#2E7D32}
  .v-stop{color:#616161;font-weight:700}
  .oldval{color:#9E9E9E;text-decoration:line-through}
  .star{color:#1565C0;font-weight:700}
  .del{background:#d32f2f;color:#fff;border:0;border-radius:4px;font-size:11px;padding:4px 9px;cursor:pointer}
  tr.grp td{color:#fff;font-size:11.5px;font-weight:700;padding:6px 8px;cursor:pointer;user-select:none}
  .gtog{display:inline-block;width:14px;text-align:center;font-size:10px}
  .gcnt{font-weight:400;opacity:.85;margin-left:4px}
  tr.g1 td{background:#1B3C5B} tr.g2 td{background:#8D5A00} tr.g3 td{background:#2E5B34} tr.g4 td{background:#6D6D6D}
  .foot{border-top:1px solid #E0E0E0;color:#666;font-size:11px;padding:10px 2px;margin-top:10px}
  .foot div{margin-bottom:3px}
  .empty{padding:24px;text-align:center;color:#777}
  .err{background:#fdecea;border:1px solid #f5c6cb;color:#b71c1c;border-radius:8px;padding:12px 14px;margin:10px 0}
  @media print{
    .tools,.del,.cards{display:none!important}
    table.vt thead th{position:static}
    #nhdr{box-shadow:none}
    .mahs{color:#0B3D63}
  }`;

  // Dựng 1 ô hạn (cột "Hạn hồ sơ" hoặc "Hạn bước xử lý"): giá trị + dòng phụ + data-* cho đồng hồ.
  function buildDueCell(due, star, subLabel, subMs, it, kind) {
    const sub = '<div class="sub">' + subLabel + ': ' + (subMs ? esc(fmtDT(subMs)) : '—') + '</div>';
    if (it.stop) {
      const old = due != null ? '<span class="oldval">' + esc(fmtDur(due - it._syncTs)) + '</span>' : '<span class="oldval">—</span>';
      return '<td>' + old + ' <span class="sub">Đồng hồ đã dừng – chỉ tham khảo</span>' +
        '<div class="sub">Mốc chuyển trước: ' + (it.dueBuoc ? esc(fmtDT(it.dueBuoc)) : '—') + '</div></td>';
    }
    if (due == null) return '<td><span class="v-ok">—</span>' + (kind === 'buoc' ? sub : '') + '</td>';
    const starTxt = star ? ' <span class="star" title="Mốc tự tính từ Hẹn trả / Chuyển trước">(*)</span>' : '';
    return '<td><span class="tval" data-due="' + due + '" data-kind="' + kind + '" data-grp="' + it._grp + '"></span>' + starTxt + (kind === 'buoc' ? sub : '') + '</td>';
  }

  function rowHtml(it, idx) {
    const rc = it.stop ? 'r-stop' : (it._grp === 'over' ? 'r-over' : it._grp === 'soon' ? 'r-soon' : 'r-ok');
    // data-* để đồng hồ cập nhật + để lọc + xuất CSV (tất cả giá trị đều động).
    const da = 'data-row="1" data-ma="' + esc(it.ma) + '" data-grp="' + it._grp + '"' +
      ' data-stop="' + (it.stop ? '1' : '0') + '"' +
      ' data-search="' + esc(noAccent([it.ma, it.thua, it.to, it.buoc, it.cb, it.nguoiNop, it.thuTuc, it.donVi].join(' '))) + '"' +
      ' data-cb="' + esc(it.cb) + '"';
    const stepSub = it.vaoLuc ? '<div class="sub">Vào lúc: ' + esc(fmtDT(it.vaoLuc)) + '</div>' : '<div class="sub">Vào lúc: —</div>';
    const stopBadge = it.stop ? '<div class="sub" style="color:#616161;font-weight:700">Đã dừng tính<br><span style="font-weight:400">' + esc(it.stopText || '') + '</span></div>' : '';
    return '<tr class="' + rc + '" ' + da + '>' +
      '<td class="idx">' + idx + '</td>' +
      '<td><span class="mahs">' + esc(it.ma) + '</span>' +
        '<div class="sub">' + esc(it.donVi) + (it.thuTuc ? ' · ' + esc(it.thuTuc) : '') + '</div>' + stopBadge + '</td>' +
      '<td>' + esc(it.thua || '—') + '</td>' +
      '<td>' + esc(it.to || '—') + '</td>' +
      '<td>' + esc(it.buoc || '—') + stepSub + '</td>' +
      '<td>' + esc(it.cb || '—') + '</td>' +
      '<td>' + esc(it.tiepNhan ? fmtDate(it.tiepNhan) : '—') + '</td>' +
      '<td>' + esc(it.dueHoso ? fmtDate(it.dueHoso) : (it.henTraRaw || '—')) + '</td>' +
      buildDueCell(it.dueHoso, false, 'Hẹn trả', it.dueHoso, it, 'hoso') +
      buildDueCell(it.dueBuoc, !!it.dueBuoc, 'Phải chuyển trước', it.dueBuoc, it, 'buoc') +
      '<td>' + esc(it.nguoiNop || '—') + '</td>' +
      '<td><button class="del" data-del="' + esc(it.ma) + '">Xóa</button></td>' +
      '</tr>';
  }

  function groupHeaderHtml(cls, txt) { return '<tr class="grp ' + cls + '" data-gkey="' + cls + '"><td colspan="12"><span class="gtog">\u25BC</span> ' + esc(txt) + ' <span class="gcnt"></span></td></tr>'; }

  // Dựng danh sách cán bộ động: gom theo tên, đếm, sắp giảm dần.
  function staffOptions(data) {
    const m = {};
    data.forEach((it) => { const k = it.cb || '—'; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).sort((a, b) => m[b] - m[a]).map((k) => '<option value="' + esc(noAccent(k)) + '">' + esc(k) + ' (' + m[k] + ')</option>').join('');
  }

  // Dựng toàn bộ HTML báo cáo (thân srcdoc).
  function buildBody() {
    const now = Date.now();
    const shownData = VB.data.filter((it) => VB.hidden.indexOf(it.ma) < 0);
    shownData.forEach((it) => { it._syncTs = VB.dataTs || now; });
    const org = organize(shownData, VB.mode);
    const nHidden = VB.hidden.length;
    const modeLabel = MODES[VB.mode];
    const suffix = SUFFIX[VB.mode];
    const card2Label = VB.mode === 'both' ? 'QUÁ HẠN (cả 2 mốc)' : VB.mode === 'buoc' ? 'QUÁ HẠN (bước xử lý)' : 'QUÁ HẠN (hồ sơ)';
    const pagesTxt = (VB.pages ? VB.pages : '—') + ' trang / ' + (VB.total ? VB.total : '—') + ' hồ sơ';

    // Header
    let h = '<div class="wrap">';
    h += '<header id="nhdr"><div class="nh-l"><div class="nlogo">VBDLIS</div><div>' +
      '<h1>Báo cáo nội bộ – Theo dõi hạn hồ sơ</h1>' +
      '<div class="nmeta">Tác giả: <b>Nguyễn Quốc Cường – phát triển</b> · ĐT: <b>0357235365</b><br>' +
      'Nguồn: Danh sách hồ sơ thụ lý · tài khoản: <b id="nacc">' + esc(VB.account) + '</b> · đã quét <b id="npg">' + esc(pagesTxt) + '</b> · Ưu tiên: <b id="nmd">' + esc(modeLabel) + '</b></div></div></div>' +
      '<div class="nh-r"><div class="nclock"><div class="t" id="nclk">--:--:--</div><div class="d" id="ncdt">--/--/----</div></div>' +
      '<div class="nsync"><div><span class="ndot"></span>Đồng bộ VBDLIS lần cuối: <b id="nlsync">--:--:--</b></div>' +
      '<div>Tự đồng bộ sau: <b id="ncdw">--:--</b></div><div id="nssta" style="color:#cfe2f6">' + esc(VB.autoOn ? 'Đang theo dõi thời gian thực' : 'Tự đồng bộ đang tắt') + '</div></div></div></header>';

    // Ghi chú (a)
    const perMin = Math.round(CFG.SYNC_MS / 60000);
    h += '<div class="note">Số liệu gốc lấy từ VBDLIS tại thời điểm đồng bộ, sau đó đồng hồ trong báo cáo chạy tiếp theo thời gian thực (từng giây) và tự đồng bộ lại với VBDLIS mỗi ' + perMin + ' phút. Thứ tự: (1) QUÁ HẠN (xét cả 2 mốc), quá hạn nhiều nhất lên đầu; (2) SẮP HẾT HẠN dưới 24 giờ; (3) CÒN HẠN, còn ít thời gian nhất lên trước; (4) ĐÃ DỪNG TÍNH THỜI GIAN xếp cuối, không chạy đồng hồ, không tính trễ. Dòng đổi sang "Quá hạn (mới)" là vừa hết hạn trong lúc theo dõi, sẽ được xếp lại nhóm ở lần đồng bộ kế tiếp. Dấu (*) = mốc tự tính từ Hẹn trả / Chuyển trước.</div>';

    // Nếu có lỗi crawl
    if (VB.error) h += '<div class="err">' + esc(VB.error) + '</div>';

    // 6 thẻ (b) kiêm tab
    const card = (tab, n, label) => '<div class="card' + (VB.tab === tab ? ' on' : '') + '" data-tab="' + tab + '"><div class="cn">' + n + '</div><div class="cl">' + esc(label) + '</div></div>';
    h += '<div class="cards">' +
      card('all', org.n.all, 'Tất cả (đang theo dõi)') +
      card('over', org.n.over, card2Label) +
      card('soon', org.n.soon, 'Sắp hết hạn (< 24 giờ)') +
      card('ok', org.n.ok, 'Còn hạn (> 24 giờ)') +
      card('stop', org.n.stop, 'Đã dừng tính thời gian') +
      card('hidden', nHidden, 'Đã xử lý xong (đã ẩn)') +
      '</div>';

    // Toolbar (c)
    h += '<div class="tools">' +
      '<button class="btn" data-act="sync">⟳ Đồng bộ ngay</button>' +
      '<label><input type="checkbox" id="chkAuto"' + (VB.autoOn ? ' checked' : '') + '> Tự đồng bộ ' + perMin + ' phút</label>' +
      '<button class="btn" data-act="undo">↶ Hoàn tác xóa</button>' +
      '<button class="btn" data-act="showhidden">Hiện lại đã ẩn (' + nHidden + ')</button>' +
      '<label>Ưu tiên theo: <select id="selMode">' +
        '<option value="both"' + (VB.mode === 'both' ? ' selected' : '') + '>' + esc(MODES.both) + '</option>' +
        '<option value="buoc"' + (VB.mode === 'buoc' ? ' selected' : '') + '>' + esc(MODES.buoc) + '</option>' +
        '<option value="hoso"' + (VB.mode === 'hoso' ? ' selected' : '') + '>' + esc(MODES.hoso) + '</option>' +
      '</select></label>' +
      '<input type="text" id="txtFilter" placeholder="Tìm mã hồ sơ / thửa / tờ / bước / người">' +
      '<select id="selStaff"><option value="">— Tất cả cán bộ chuyển (' + (VB.total || org.n.all) + ') —</option>' + staffOptions(shownData) + '</select>' +
      '<button class="btn" data-act="csv">Xuất CSV</button>' +
      '<button class="btn" data-act="print">In / PDF</button>' +
      '<span class="shown" id="lblShown">Hiển thị ' + org.n.all + '/' + (VB.total || org.n.all) + ' hồ sơ</span>' +
      '</div>';

    // Bảng (d)+(e)
    h += '<div class="tb"><table class="vt"><thead><tr>' +
      '<th>#</th><th>Mã hồ sơ / Đơn vị / Thủ tục</th><th>Thửa đất</th><th>Tờ BĐ</th><th>Bước xử lý</th><th>CB chuyển</th><th>Tiếp nhận</th><th>Hẹn trả</th><th>Hạn hồ sơ (hẹn trả)</th><th>Hạn bước xử lý</th><th>Người nộp</th><th>Xong</th>' +
      '</tr></thead><tbody>';

    if (org.n.all === 0) {
      h += '<tr><td colspan="12" class="empty">Chưa có hồ sơ nào trong danh sách theo dõi.</td></tr>';
    } else {
      let idx = 0;
      if (org.over.length) { h += groupHeaderHtml('g1', 'NHÓM 1 – QUÁ HẠN ' + suffix + ' – quá hạn nhiều nhất lên trước'); org.over.forEach((it) => h += rowHtml(it, ++idx)); }
      if (org.soon.length) { h += groupHeaderHtml('g2', 'NHÓM 2 – SẮP HẾT HẠN (còn dưới 24 giờ) ' + suffix); org.soon.forEach((it) => h += rowHtml(it, ++idx)); }
      if (org.ok.length) { h += groupHeaderHtml('g3', 'NHÓM 3 – CÒN HẠN ' + suffix + ' – còn ít thời gian nhất lên trước'); org.ok.forEach((it) => h += rowHtml(it, ++idx)); }
      if (org.stop.length) { h += groupHeaderHtml('g4', 'NHÓM 4 – ĐÃ DỪNG TÍNH THỜI GIAN (không tính trễ, chỉ để theo dõi)'); org.stop.forEach((it) => h += rowHtml(it, ++idx)); }
    }
    h += '</tbody></table></div>';

    // Chân trang (f)
    h += '<div class="foot"><div>Tác giả: Nguyễn Quốc Cường – phát triển · ĐT: 0357235365 · Nguồn: Danh sách hồ sơ thụ lý (VBDLIS) – tài khoản ' + esc(VB.account) + ' · Ưu tiên theo: ' + esc(modeLabel) + '</div>' +
      '<div>Đồng hồ trong báo cáo chạy theo thời gian thực từ số liệu VBDLIS và tự đồng bộ lại mỗi ' + perMin + ' phút (chỉ đọc dữ liệu, không tác động hồ sơ). "Hạn hồ sơ" = Còn/Quá hạn theo ngày hẹn trả; "Hạn bước xử lý" = hạn của bước đang thực hiện kèm mốc phải chuyển trước. Hồ sơ đã dừng tính thời gian xếp nhóm cuối, đồng hồ dừng, KHÔNG bị coi là trễ. Nút "Xóa" chỉ ẩn dòng khỏi bảng theo dõi (lưu tại máy, có thể hoàn tác) – KHÔNG tác động dữ liệu VBDLIS.</div></div>';

    h += '</div>';
    return h;
  }

  // Toàn bộ srcdoc = CSS + thân + script điều khiển trong iframe (đồng hồ, lọc, xuất, in).
  function buildSrcdoc() {
    return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>' + CSS + '</style></head><body>' +
      buildBody() +
      '<script>(' + iframeMain.toString() + ')();<\/script></body></html>';
  }

  /* =======================================================================
   * (SCRIPT TRONG IFRAME) – đồng hồ 1 giây, lọc, xuất CSV, in; gọi cha __VB
   *   cho các thao tác cần trang VBDLIS (đồng bộ / tra cứu / ẩn / chế độ).
   *   Hàm này được serialize (không dùng biến closure ngoài).
   * ===================================================================== */
  function iframeMain() {
    var P = window.parent.__VB, CFG = P.CFG, MODES = P.MODES;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    function fmtDur(diff) {
      var over = diff < 0, absO = Math.abs(diff), a = absO;
      var day = Math.floor(a / 86400000); a -= day * 86400000;
      var hr = Math.floor(a / 3600000); a -= hr * 3600000;
      var mi = Math.floor(a / 60000); a -= mi * 60000;
      var se = Math.floor(a / 1000);
      var pre = over ? 'Quá hạn' : 'Còn', p = [];
      if (absO < 86400000) { if (hr) p.push(hr + ' giờ'); if (mi) p.push(mi + ' phút'); p.push(se + ' giây'); }
      else { if (day) p.push(day + ' ngày'); if (hr) p.push(hr + ' giờ'); if (mi) p.push(mi + ' phút'); if (!p.length) p.push('0 phút'); }
      return pre + ' ' + p.join(' ');
    }
    // ---- Đồng hồ + cập nhật từng dòng mỗi giây ----
    function tick() {
      var now = Date.now(), d = new Date(now);
      var el;
      if (el = document.getElementById('nclk')) el.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      if (el = document.getElementById('ncdt')) el.textContent = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
      if (el = document.getElementById('nlsync')) el.textContent = P.dataTs ? (pad(new Date(P.dataTs).getHours()) + ':' + pad(new Date(P.dataTs).getMinutes()) + ':' + pad(new Date(P.dataTs).getSeconds())) : '--:--:--';
      if (el = document.getElementById('ncdw')) {
        if (!P.autoOn) el.textContent = 'đã tắt';
        else { var r = Math.max(0, Math.floor((P.nextAt - now) / 1000)); el.textContent = pad(Math.floor(r / 60)) + ':' + pad(r % 60); }
      }
      if (el = document.getElementById('nssta')) el.textContent = P.busy ? 'Đang đồng bộ dữ liệu…' : (P.autoOn ? 'Đang theo dõi thời gian thực' : 'Tự đồng bộ đang tắt');
      // từng ô hạn
      var cells = document.querySelectorAll('.tval');
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i], due = +c.getAttribute('data-due'), grp = c.getAttribute('data-grp');
        var diff = due - now, cls = diff < 0 ? 'v-over' : (diff < CFG.SOON_MS ? 'v-soon' : 'v-ok');
        var txt = fmtDur(diff);
        if (diff < 0 && grp !== 'over') txt = 'Quá hạn (mới) ' + txt.replace(/^Quá hạn /, '');
        c.className = 'tval ' + cls; c.textContent = txt;
      }
    }
    // ---- Lọc theo tab + ô tìm + cán bộ ----
    function applyFilter() {
      var tab = P.tab, kw = P.norm(document.getElementById('txtFilter') ? document.getElementById('txtFilter').value : ''),
        staff = document.getElementById('selStaff') ? document.getElementById('selStaff').value : '';
      var rows = document.querySelectorAll('tr[data-row]'), shown = 0;
      var grpCount = { g1: 0, g2: 0, g3: 0, g4: 0 };
      var col = P.collapsed || (P.collapsed = {});
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i], g = r.getAttribute('data-grp'), stop = r.getAttribute('data-stop') === '1';
        var gkey = g === 'over' ? 'g1' : g === 'soon' ? 'g2' : (stop ? 'g4' : 'g3');
        var okTab = tab === 'all' || (tab === 'stop' && stop) || (tab === g && !stop) || (tab === 'over' && g === 'over') || (tab === 'soon' && g === 'soon') || (tab === 'ok' && g === 'ok');
        if (tab === 'hidden') okTab = false;
        var okKw = !kw || r.getAttribute('data-search').indexOf(kw) >= 0;
        var okStaff = !staff || P.noAccent(r.getAttribute('data-cb')) === staff;
        var matches = okTab && okKw && okStaff;
        if (matches) grpCount[gkey]++;
        var vis = matches && !col[gkey];
        r.style.display = vis ? '' : 'none';
        if (vis) shown++;
      }
      // Tiêu đề nhóm: ẩn nếu không có dòng khớp; cập nhật số đếm + mũi tên thu gọn.
      ['g1', 'g2', 'g3', 'g4'].forEach(function (k) {
        var hd = document.querySelector('tr.grp.' + k);
        if (!hd) return;
        hd.style.display = grpCount[k] ? '' : 'none';
        var cnt = hd.querySelector('.gcnt'); if (cnt) cnt.textContent = '(' + grpCount[k] + ')';
        var tog = hd.querySelector('.gtog'); if (tog) tog.textContent = col[k] ? '\u25B6' : '\u25BC';
      });
      var l = document.getElementById('lblShown'); if (l) l.textContent = 'Hiển thị ' + shown + '/' + (P.total || rows.length) + ' hồ sơ';
    }
    // ---- Xuất CSV (UTF-8 BOM, dấu ; , mọi ô bọc ngoặc kép, chỉ dòng đang hiển thị) ----
    function exportCsv() {
      var head = ['#', 'Mã hồ sơ', 'Đơn vị', 'Thủ tục', 'Thửa', 'Tờ BĐ', 'Bước xử lý', 'Vào lúc', 'CB chuyển', 'Tiếp nhận', 'Hẹn trả', 'Hạn hồ sơ', 'Hạn bước xử lý', 'Người nộp', 'Trạng thái'];
      var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
      var lines = [head.map(q).join(';')];
      var data = P.data.filter(function (it) { return P.hidden.indexOf(it.ma) < 0; });
      var visMa = {}; document.querySelectorAll('tr[data-row]').forEach(function (r) { if (r.style.display !== 'none') visMa[r.getAttribute('data-ma')] = 1; });
      var idx = 0;
      data.forEach(function (it) {
        if (!visMa[it.ma]) return; idx++;
        var now = Date.now();
        var hoso = it.dueHoso ? (it.stop ? 'Đã dừng' : fmtDur(it.dueHoso - now)) : '—';
        var buoc = it.dueBuoc ? (it.stop ? 'Đã dừng' : fmtDur(it.dueBuoc - now)) : '—';
        lines.push([idx, it.ma, it.donVi, it.thuTuc, it.thua, it.to, it.buoc,
          it.vaoLuc ? P.fmtDT(it.vaoLuc) : '', it.cb, it.tiepNhan ? P.fmtDate(it.tiepNhan) : '',
          it.dueHoso ? P.fmtDate(it.dueHoso) : '', hoso, buoc, it.nguoiNop, it.trangThai].map(q).join(';'));
      });
      var d = new Date(), nm = 'bao-cao-han-ho-so_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.csv';
      var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nm; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    // ---- Gắn sự kiện (event delegation cấp document, sống sau mỗi lần render) ----
    document.addEventListener('click', function (e) {
      var t = e.target;
      var grp = t.closest ? t.closest('tr.grp') : null;
      if (grp) { var gk = grp.getAttribute('data-gkey'); P.collapsed = P.collapsed || {}; P.collapsed[gk] = !P.collapsed[gk]; applyFilter(); return; }
      var ma = t.closest ? t.closest('.mahs') : null;
      if (ma) { var tr = ma.closest('tr'); if (tr) P.lookup(tr.getAttribute('data-ma')); return; }
      var del = t.getAttribute && t.getAttribute('data-del');
      if (del) { var row = t.closest('tr'); if (row) row.remove(); P.markHidden(del); recount(); applyFilter(); return; }
      var cd = t.closest ? t.closest('.card') : null;
      if (cd) { P.tab = cd.getAttribute('data-tab'); document.querySelectorAll('.card').forEach(function (x) { x.classList.remove('on'); }); cd.classList.add('on'); if (P.tab === 'hidden') { P.showHidden(); return; } applyFilter(); return; }
      var act = t.getAttribute && t.getAttribute('data-act');
      if (act === 'sync') P.syncNow();
      else if (act === 'undo') P.undoHide();
      else if (act === 'showhidden') P.showHidden();
      else if (act === 'csv') exportCsv();
      else if (act === 'print') window.print();
    });
    document.addEventListener('mouseover', function (e) { var m = e.target.closest ? e.target.closest('.mahs') : null; if (m && !m.title) m.title = 'Bấm để tìm hồ sơ này trên VBDLIS theo số biên nhận'; });
    var ti = document.getElementById('txtFilter'); if (ti) ti.addEventListener('input', applyFilter);
    var ss = document.getElementById('selStaff'); if (ss) ss.addEventListener('change', applyFilter);
    var sm = document.getElementById('selMode'); if (sm) sm.addEventListener('change', function () { P.setMode(sm.value); });
    var ck = document.getElementById('chkAuto'); if (ck) ck.addEventListener('change', function () { P.toggleAuto(ck.checked); });
    // Đếm lại số thẻ sau khi xóa dòng.
    function recount() {
      var rows = document.querySelectorAll('tr[data-row]'), c = { all: 0, over: 0, soon: 0, ok: 0, stop: 0 };
      rows.forEach(function (r) { c.all++; if (r.getAttribute('data-stop') === '1') c.stop++; else c[r.getAttribute('data-grp')]++; });
      var set = function (tab, n) { var cd = document.querySelector('.card[data-tab="' + tab + '"] .cn'); if (cd) cd.textContent = n; };
      set('all', c.all); set('over', c.over); set('soon', c.soon); set('ok', c.ok); set('stop', c.stop); set('hidden', P.hidden.length);
      var sh = document.querySelector('.tools [data-act="showhidden"]'); if (sh) sh.textContent = 'Hiện lại đã ẩn (' + P.hidden.length + ')';
    }
    tick(); setInterval(tick, CFG.TICK_MS); applyFilter();
  }

  /* =======================================================================
   * (7) LOOKUP – click mã hồ sơ → điền số biên nhận + tìm; nút quay lại.
   * (10) SCHEDULER + đối tượng điều khiển VB (đặt ở trang chính).
   * ===================================================================== */
  const VB = {
    CFG: CFG, MODES: MODES,
    // các UTIL mà iframe cần gọi lại
    norm: noAccent, noAccent: noAccent, fmtDT: fmtDT, fmtDate: fmtDate,
    data: [], hidden: [], undoLast: null, total: 0, pages: 0, account: '—', error: '',
    mode: 'both', tab: 'all', collapsed: {}, dataTs: 0, autoOn: true, nextAt: 0, busy: false, looking: false, lookingMa: '', savedSearch: '',
    frame: null,

    open: async function () {
      if (!this.frame) {
        const f = document.createElement('iframe');
        f.id = '__vbframe';
        f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483646;border:0;background:#fff';
        document.body.appendChild(f); this.frame = f;
      }
      this.frame.style.display = 'block';
      this._showClose();
      // Có dữ liệu còn mới (trong chu kỳ đồng bộ) → hiện ngay; nếu không → hiện màn hình TẢI rồi quét ĐẦY ĐỦ, xong mới hiện (không hiện dở dang).
      if (this.data && this.data.length && (Date.now() - this.dataTs) < CFG.SYNC_MS) { this.render(); }
      else { this.renderLoading(); await this.crawlAndRender(); }
    },
    close: function () {
      if (this.frame) this.frame.style.display = 'none';
      const bk = document.getElementById('__vbback'); if (bk) bk.remove();
      const cl = document.getElementById('__vbclose'); if (cl) cl.remove();
      if (this.savedSearch != null && this.looking) this._restoreSearch();
      this.looking = false;
    },
    render: function () { if (this.frame) this.frame.srcdoc = buildSrcdoc(); },
    // Màn hình "đang tải" hiển thị trong lúc quét đầy đủ (không hiện dữ liệu dở dang).
    renderLoading: function () {
      if (!this.frame) return;
      this.frame.srcdoc = '<!doctype html><meta charset="utf-8"><body style="margin:0;font:14px Arial,sans-serif">' +
        '<div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#fff;color:#0b2d55">' +
        '<div style="width:46px;height:46px;border:5px solid #dbe5f1;border-top-color:#1668ad;border-radius:50%;animation:sp 1s linear infinite"></div>' +
        '<div style="font-weight:700;font-size:16px">Đang tải dữ liệu từ VBDLIS…</div>' +
        '<div style="color:#777;font-size:12.5px">Đang quét toàn bộ danh sách, vui lòng đợi giây lát</div>' +
        '</div><style>@keyframes sp{to{transform:rotate(360deg)}}</style></body>';
    },
    // Nút nổi "Đóng báo cáo → về trang gốc VBDLIS" (hiện khi đang xem báo cáo, nằm trên iframe).
    _showClose: function () {
      let b = document.getElementById('__vbclose');
      if (!b) {
        b = document.createElement('div'); b.id = '__vbclose';
        b.title = 'Bấm để đóng · kéo để di chuyển';
        b.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;background:linear-gradient(120deg,#0b2d55,#1668ad);color:#fff;font:600 13px/1.35 "Segoe UI",Arial,sans-serif;padding:10px 16px;border-radius:24px;box-shadow:0 6px 18px rgba(11,45,85,.35)';
        b.innerHTML = '\u2715 Đóng báo cáo<div style="font-size:11px;font-weight:400;opacity:.85">về trang gốc VBDLIS</div>';
        document.body.appendChild(b);
        makeDraggable(b, 'closepos', () => this.close());
      }
      b.style.display = 'block';
    },

    crawlAndRender: async function () {
      if (this.busy) return; this.busy = true; this.error = '';
      this.account = readAccount(); this.hidden = loadHidden();
      try {
        const r = await crawl();
        if (r.error) { this.error = r.error; this.data = []; this.total = 0; this.pages = 0; }
        else {
          this.data = r.rows; this.pages = r.pages;
          const infoTotal = readInfoTotal();
          this.total = infoTotal != null ? infoTotal : r.rows.length;
        }
      } catch (e) { this.error = 'Lỗi khi đọc dữ liệu: ' + (e && e.message ? e.message : e); this.data = []; }
      this.dataTs = Date.now(); this.nextAt = this.dataTs + CFG.SYNC_MS; this.busy = false;
      this.render();
    },

    syncNow: function () { this.crawlAndRender(); },
    setMode: function (m) { if (MODES[m]) { this.mode = m; this.render(); } },
    toggleAuto: function (on) { this.autoOn = !!on; if (this.autoOn) this.nextAt = Date.now() + CFG.SYNC_MS; },

    // Ẩn dòng (lưu localStorage theo tài khoản, có hoàn tác). KHÔNG tác động VBDLIS.
    markHidden: function (ma) { if (this.hidden.indexOf(ma) < 0) { this.hidden.push(ma); this.undoLast = ma; saveHidden(this.hidden); } },
    undoHide: function () { if (this.undoLast) { const i = this.hidden.indexOf(this.undoLast); if (i >= 0) this.hidden.splice(i, 1); this.undoLast = null; saveHidden(this.hidden); this.render(); } },
    showHidden: function () { this.hidden = []; this.undoLast = null; saveHidden(this.hidden); this.tab = 'all'; this.render(); },

    // Tra cứu: điền số biên nhận + bấm tìm; tạm dừng tự đồng bộ; hiện nút quay lại.
    lookup: function (ma) {
      const inp = document.querySelector(CFG.SEL_SEARCH_INPUT), btn = document.querySelector(CFG.SEL_SEARCH_BTN);
      if (!inp || !btn) { alert('Không tìm thấy ô tìm kiếm nhanh trên VBDLIS (kiểm tra SEL_SEARCH_INPUT / SEL_SEARCH_BTN trong CONFIG).'); return; }
      this.savedSearch = inp.value; this.looking = true; this.lookingMa = ma;
      if (this.frame) this.frame.style.display = 'none';
      const cl = document.getElementById('__vbclose'); if (cl) cl.remove();
      inp.value = ma;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      if (window.jQuery) { try { window.jQuery(inp).trigger('input').trigger('change'); } catch (e) {} }
      btn.click();
      window.scrollTo(0, 0);
      this._showBack(ma);
    },
    _showBack: function (ma) {
      const lb = document.getElementById('__vblaunch'); if (lb) lb.style.display = 'none'; // ẩn nút mở khi đang tra cứu (ưu tiên nút quay lại)
      let b = document.getElementById('__vbback');
      if (!b) { b = document.createElement('div'); b.id = '__vbback'; b.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;background:linear-gradient(120deg,#0b2d55,#1668ad);color:#fff;font:600 13px/1.35 "Segoe UI",Arial,sans-serif;padding:10px 16px;border-radius:24px;box-shadow:0 6px 18px rgba(11,45,85,.35);cursor:pointer'; document.body.appendChild(b); }
      b.innerHTML = '← Mở lại báo cáo theo dõi hạn<div style="font-size:11px;font-weight:400;opacity:.85">đang tra cứu ' + esc(ma) + ' · đã tạm dừng tự đồng bộ</div>';
      b.onclick = () => this.back();
    },
    _restoreSearch: function () {
      const inp = document.querySelector(CFG.SEL_SEARCH_INPUT), btn = document.querySelector(CFG.SEL_SEARCH_BTN);
      if (inp) { inp.value = this.savedSearch || ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); if (window.jQuery) { try { window.jQuery(inp).trigger('input').trigger('change'); } catch (e) {} } }
      if (btn) btn.click();
    },
    // Quay lại: bỏ lọc, hiện báo cáo, ~3s sau bật lại tự đồng bộ + quét lại đủ trang.
    back: function () {
      const b = document.getElementById('__vbback'); if (b) b.remove();
      this._restoreSearch();
      this.looking = false; this.lookingMa = '';
      if (this.frame) this.frame.style.display = 'block';
      this._showClose();
      setTimeout(() => { this.nextAt = Date.now() + CFG.SYNC_MS; this.crawlAndRender(); }, 3000);
    }
  };
  window.__VB = VB;

  /* =======================================================================
   * (SCHEDULER) – đồng hồ 1 giây ở trang chính: đến hạn thì tự đồng bộ,
   *   nhưng TẠM DỪNG khi đang tra cứu (looking) để không quét danh sách đã lọc.
   * ===================================================================== */
  setInterval(() => {
    if (!VB.frame || VB.frame.style.display === 'none') return;
    if (!VB.autoOn || VB.busy || VB.looking) return;
    if (Date.now() >= VB.nextAt) VB.crawlAndRender();
  }, 1000);

  /* =======================================================================
   * (KÍCH HOẠT) – nút nổi "Báo cáo hạn hồ sơ" + phím Esc. Không tự mở overlay.
   *   Nút được bảo đảm luôn tồn tại (VBDLIS render lại vẫn không mất nút).
   * ===================================================================== */
  // Vị trí nút (lưu tại máy theo khoá) để kéo thả xong vẫn giữ nguyên qua các lần tải trang.
  function loadPos(key) { try { return JSON.parse(localStorage.getItem(CFG.STORAGE_PREFIX + key) || 'null'); } catch (e) { return null; } }
  function savePos(key, pp) { try { localStorage.setItem(CFG.STORAGE_PREFIX + key, JSON.stringify(pp)); } catch (e) {} }
  function clampPos(x, y, w, h) {
    const W = window.innerWidth || 1200, H = window.innerHeight || 800;
    return { x: Math.max(2, Math.min(W - w - 2, x)), y: Math.max(2, Math.min(H - h - 2, y)) };
  }
  // Cho một nút nổi kéo–thả được: khôi phục vị trí đã lưu, phân biệt BẤM (onClick) với KÉO (di chuyển + lưu).
  function makeDraggable(el, key, onClick) {
    el.style.cursor = 'grab'; el.style.touchAction = 'none'; el.style.userSelect = 'none';
    const pos = loadPos(key);
    if (pos && typeof pos.x === 'number') {
      const c = clampPos(pos.x, pos.y, el.offsetWidth, el.offsetHeight);
      el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
    }
    let drag = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    el.addEventListener('pointerdown', function (e) {
      drag = true; moved = false;
      const r = el.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      el.style.cursor = 'grabbing';
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (!drag) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      const c = clampPos(ox + dx, oy + dy, el.offsetWidth, el.offsetHeight);
      el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
    });
    el.addEventListener('pointerup', function (e) {
      if (!drag) return;
      drag = false; el.style.cursor = 'grab';
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      if (moved) { const r = el.getBoundingClientRect(); savePos(key, { x: Math.round(r.left), y: Math.round(r.top) }); }
      else if (onClick) onClick();   // bấm (không kéo) → hành động
    });
  }
  function ensureLaunch() {
    if (!document.body) return;
    if (!document.querySelector(CFG.SEL_TABLE)) return; // chỉ hiện nút ở trang có bảng hồ sơ
    const ex = document.getElementById('__vblaunch');
    if (VB.looking) { if (ex) ex.style.display = 'none'; return; } // đang tra cứu → ưu tiên nút quay lại, ẩn nút mở
    if (ex) { if (ex.style.display === 'none') ex.style.display = ''; return; }
    const b = document.createElement('div');
    b.id = '__vblaunch';
    b.textContent = 'Báo cáo hạn hồ sơ';
    b.title = 'Bấm để mở báo cáo · kéo để di chuyển';
    b.style.cssText = 'position:fixed;right:18px;bottom:66px;z-index:2147483645;background:linear-gradient(120deg,#0b2d55,#1668ad);color:#fff;font:600 13px/1 "Segoe UI",Arial,sans-serif;padding:11px 16px;border-radius:24px;box-shadow:0 6px 18px rgba(11,45,85,.35)';
    document.body.appendChild(b);
    makeDraggable(b, 'launchpos', function () { VB.open(); });
  }
  setInterval(ensureLaunch, 1500);
  ensureLaunch();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && VB.frame && VB.frame.style.display !== 'none' && !VB.looking) VB.close(); });
})();
