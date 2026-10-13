#!/usr/bin/env node
// ============================================================================
// DỰNG DỮ LIỆU TRANG ĐỊA DANH → apps/frontend/src/data/diaDanh.json  (13/10/2026)
//
// Trang /ban-do/<địa danh>: MỖI xã/phường MỚI, MỖI xã CŨ, MỖI huyện CŨ một trang, nối HAI CHIỀU cũ ↔ mới để bắt cả cách
// tìm trước và sau sáp nhập (chủ dự án: "SEO theo địa danh học từ qhviet.com"). qhviet chỉ có trang xã mới + huyện cũ, tên xã
// cũ giấu trong khối chữ ẩn — mình làm trang thật cho từng xã cũ, liên kết hiện rõ.
//
// Nguồn — theo VĂN BẢN, không đoán:
//   · dvhc/khanh-hoa-2cap.json — danh mục của Sở: 65 xã mới (kèm ĐƠN VỊ GỐC giữ mã), 139 xã cũ, 16 huyện cũ.
//   · nq1667.json — Nghị quyết 1667/NQ-UBTVQH15: xã mới gồm những xã cũ nào, TOÀN BỘ hay MỘT PHẦN.
//     Thiếu file này thì lùi về xa-moi.json (chỉ đủ cho xã cũ có file bản đồ riêng).
//   · cơ sở dữ liệu: tâm + khung từng xã (nút mở bản đồ), bảng đổi số tờ mới ↔ cũ (dia_chinh_to).
// KHÔNG đưa SỐ THỬA từng xã ra (thông tin nội bộ — xem CLAUDE.md "SỐ THỬA CỦA TỪNG XÃ CHỈ QUẢN TRỊ VIÊN THẤY").
//
// Chạy lại (Docker phải đang chạy để hỏi cơ sở dữ liệu):
//   node scripts/dia-chinh/dung-dia-danh.mjs
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = dirname(fileURLToPath(import.meta.url));
const GOC = join(DAY, '..', '..');
const RA = join(GOC, 'apps', 'frontend', 'src', 'data', 'diaDanh.json');
const doc = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ── chữ ────────────────────────────────────────────────────────────────────
const boDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const khoa = (s) => boDau(s).toLowerCase().replace(/\s+/g, ' ').trim();
const slugOf = (...ps) => ps.map((p) => boDau(p).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).filter(Boolean).join('-');
const hoaDau = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const thuongDau = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const LOAI = ['đặc khu', 'thị trấn', 'thị xã', 'thành phố', 'phường', 'huyện', 'xã'];
function tach(ten) {   // "Phường Bắc Nha Trang" → { loai: 'phường', ten: 'Bắc Nha Trang' }
  const t = String(ten || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const l = LOAI.find((x) => t.toLowerCase().startsWith(x + ' '));
  return l ? { loai: l, rieng: t.slice(l.length + 1).trim() } : { loai: '', rieng: t };
}
const tenDu = (loai, rieng) => (loai ? `${loai} ${rieng}` : rieng);

// ── nguồn ──────────────────────────────────────────────────────────────────
const DM = doc(join(DAY, 'dvhc', 'khanh-hoa-2cap.json'));
const XM = doc(join(DAY, 'xa-moi.json'));
const NQ_FILE = join(DAY, 'nq1667.json');
const NQ = existsSync(NQ_FILE) ? doc(NQ_FILE) : null;

function hoiDb(sql) {
  const ra = execSync('docker compose exec -T postgis psql -U camlam -d camlam_gis -tA', { cwd: GOC, input: sql, encoding: 'utf8', maxBuffer: 64 << 20 });
  const s = ra.trim();
  return s ? JSON.parse(s) : [];
}
const XA_DB = hoiDb(`SELECT json_agg(json_build_object('xaId', xa_id, 'cap', cap, 'tam', json_build_array(round(cx::numeric, 5), round(cy::numeric, 5)),
  'bbox', json_build_array(round(minx::numeric, 5), round(miny::numeric, 5), round(maxx::numeric, 5), round(maxy::numeric, 5)))) FROM dia_chinh_xa WHERE so_thua > 0;`) || [];
const SO_TO = hoiDb(`SELECT json_agg(r) FROM (SELECT t.xa_moi_id AS "xaMoiId", t.xa_cu_id AS "xaCuId", t.ten_xa_cu AS "tenXaCu",
  min(t.to_moi) AS "toMoiTu", max(t.to_moi) AS "toMoiDen", min(coalesce(t.to_cu_that, t.to_cu)) AS "toCuTu", max(coalesce(t.to_cu_that, t.to_cu)) AS "toCuDen",
  count(*)::int AS "soTo" FROM dia_chinh_to t GROUP BY 1, 2, 3) r;`) || [];
const dbTheoMa = new Map(XA_DB.map((x) => [String(x.xaId), x]));

// ── HUYỆN CŨ ───────────────────────────────────────────────────────────────
const TINH_CU = { 56: 'Khánh Hòa', 58: 'Ninh Thuận' };
const huyenCu = DM.huyenCu.map((h) => {
  const { loai, rieng } = tach(h.ten);
  return { id: h.huyenId, slug: slugOf(loai, rieng, TINH_CU[h.tinhIdCu]), loai: thuongDau(loai), ten: rieng, tinhCu: TINH_CU[h.tinhIdCu], xaCu: [], xaMoi: [] };
});
const huyenTheoId = new Map(huyenCu.map((h) => [h.id, h]));

// ── XÃ MỚI ─────────────────────────────────────────────────────────────────
const xaMoi = DM.xaMoi.map((x) => {
  const { loai, rieng } = tach(x.ten);
  const db = dbTheoMa.get(String(x.xaId));
  return { id: String(x.xaId), slug: slugOf(loai, rieng, 'khanh-hoa'), loai: thuongDau(loai), ten: rieng, huyenGocId: x.huyenIdCu,
           donViGoc: x.donViGoc ? x.donViGoc.normalize('NFC') : '', gom: [], nguyenVan: '', tam: db?.tam || null, bbox: db?.bbox || null,
           coBanDo: !!db, soTo: [] };
});
const xaMoiTheoMa = new Map(xaMoi.map((x) => [x.id, x]));

// ── XÃ CŨ: 139 xã trong danh mục + các ĐƠN VỊ GỐC (xã cũ mà xã mới kế thừa mã, tên khác tên mới) ──
const xaCu = [];
const themXaCu = (o) => { xaCu.push(o); return o; };
for (const x of DM.xaCu) {
  if (/\(cũ\)/.test(x.ten)) continue;   // 22579 "xã Ninh Phước (cũ)": bản ghi trùng của danh mục (xã Ninh Phước sau 2024 là 22606) — không làm trang riêng
  const { loai, rieng } = tach(x.ten);
  const db = dbTheoMa.get(String(x.xaId));
  themXaCu({ id: String(x.xaId), loai: thuongDau(loai), ten: rieng, huyenId: x.huyenIdCu, laGoc: false, vao: [],
             tam: db?.tam || null, bbox: db?.bbox || null, coBanDo: !!db, maBanDo: db ? String(x.xaId) : '', soTo: [] });
}
for (const m of xaMoi) {
  if (!m.donViGoc) continue;   // xã mới giữ nguyên tên đơn vị gốc → trang xã mới đã gánh cả tên cũ
  const { loai, rieng } = tach(m.donViGoc);
  if (khoa(tenDu(loai, rieng)) === khoa(tenDu(m.loai, m.ten))) continue;
  themXaCu({ id: m.id, loai: thuongDau(loai), ten: rieng, huyenId: m.huyenGocId, laGoc: true, vao: [],
             tam: m.tam, bbox: null, coBanDo: m.coBanDo, maBanDo: m.coBanDo ? 'g' + m.id : '', soTo: [] });
}
for (const c of xaCu) {
  const h = huyenTheoId.get(c.huyenId);
  c.slug = slugOf(c.loai, c.ten, h ? h.loai : '', h ? h.ten : '');
}
// xã cũ tìm theo (huyện, tên) — trùng tên ở hai huyện là chuyện thường (10 cặp)
const xaCuTheoTen = new Map();
for (const c of xaCu) {
  const k = khoa(c.ten);
  if (!xaCuTheoTen.has(k)) xaCuTheoTen.set(k, []);
  xaCuTheoTen.get(k).push(c);
}
const xaCuTheoMa = new Map(xaCu.map((c) => [c.id + (c.laGoc ? 'g' : ''), c]));
const timXaCu = (ma, laGoc) => xaCuTheoMa.get(String(ma) + (laGoc ? 'g' : '')) || null;

// ── XÃ MỚI GỒM NHỮNG XÃ CŨ NÀO ─────────────────────────────────────────────
function gan(m, c, phan) {
  if (!c || m.gom.some((g) => g.xa === c)) return;
  m.gom.push({ xa: c, phan });
  if (!c.vao.some((v) => v.id === m.id)) c.vao.push({ id: m.id, phan });
}
const canhBao = [];
if (NQ) {
  for (const n of NQ.xaMoi || []) {
    const m = xaMoiTheoMa.get(String(n.xaId)) || xaMoi.find((x) => khoa(tenDu(x.loai, x.ten)) === khoa(n.ten));
    if (!m) { canhBao.push(`NQ: không thấy xã mới "${n.ten}"`); continue; }
    m.nguyenVan = n.nguyenVan || '';
    for (const g of n.gom || []) {
      let c = null;
      if (g.xaId != null) c = timXaCu(g.xaId, String(g.xaId) === m.id) || timXaCu(g.xaId, false) || timXaCu(g.xaId, true);
      if (!c) {
        const { rieng } = tach(g.ten);
        const ds = (xaCuTheoTen.get(khoa(rieng)) || []).filter((x) => !g.huyenIdCu || x.huyenId === g.huyenIdCu);
        if (ds.length === 1) c = ds[0];
      }
      if (!c) {
        // đơn vị gốc mang đúng tên xã mới (không có trang xã cũ riêng) → ghi chú trên trang xã mới, không phải lỗi
        if (khoa(tach(g.ten).rieng) === khoa(m.ten)) { m.gomCungTen = { ten: g.ten, phan: g.phan === 'mot-phan' ? 'mot-phan' : 'toan-bo' }; continue; }
        canhBao.push(`NQ: "${m.ten}" ← không khớp xã cũ "${g.ten}" (${g.huyenCu || '?'})`);
        continue;
      }
      gan(m, c, g.phan === 'mot-phan' ? 'mot-phan' : 'toan-bo');
    }
  }
  // ĐƠN VỊ ĐÃ NHẬP TỪ NĂM 2024 (Nghị quyết 1196/NQ-UBTVQH15 Khánh Hòa, 1198/NQ-UBTVQH15 Ninh Thuận, hiệu lực 1/11/2024): không có tên
  // trong NQ 1667 → bắc cầu qua đơn vị năm 2024 (nguồn: nq1667.json mục kiemTra; CLAUDE.md "phải bắc cầu qua đây").
  const NAM_2024 = [
    ['22342', 'phường Vạn Thạnh', '1196'], ['22345', 'phường Vạn Thạnh', '1196'], ['22354', 'phường Phương Sài', '1196'],
    ['22360', 'phường Tân Tiến', '1196'], ['22369', 'phường Tân Tiến', '1196'], ['22666', 'xã Xuân Đồng', '1196'],
    ['22750', 'phường Phủ Hà', '1198'], ['22753', 'phường Kinh Dinh', '1198'], ['22756', 'phường Kinh Dinh', '1198'],
  ];
  for (const [ma, trungGian, nq] of NAM_2024) {
    const c = timXaCu(ma, false);
    if (!c || c.vao.length) continue;
    const rieng = khoa(tach(trungGian).rieng);
    let m = null, phan = 'toan-bo';
    for (const x of xaMoi) {
      const g = x.gom.find((y) => khoa(y.xa.ten) === rieng && y.xa.huyenId === c.huyenId);
      if (g) { m = x; phan = g.phan; break; }
    }
    if (!m) m = xaMoi.find((x) => khoa(x.ten) === rieng && x.gomCungTen) || null;   // đơn vị năm 2024 giữ nguyên tên thành xã mới
    if (!m) { canhBao.push(`2024: không tìm được nơi nhập của ${c.ten} (qua ${trungGian})`); continue; }
    c.vao.push({ id: m.id, phan, qua: `${trungGian} (năm 2024, Nghị quyết ${nq}/NQ-UBTVQH15)` });
  }
} else {
  canhBao.push('CHƯA CÓ nq1667.json — danh sách xã cũ chỉ gồm các xã có file bản đồ riêng (xa-moi.json), có thể THIẾU.');
  for (const m of xaMoi) { const g = timXaCu(m.id, true); if (g) gan(m, g, 'toan-bo'); }
  for (const [cu, moi] of Object.entries(XM.cu_thanh_moi)) { if (/^\d+$/.test(cu)) gan(xaMoiTheoMa.get(String(moi)), timXaCu(cu, false), 'toan-bo'); }
  for (const [cu, ds] of Object.entries(XM.bi_chia)) { if (/^\d+$/.test(cu)) for (const moi of ds) gan(xaMoiTheoMa.get(String(moi)), timXaCu(cu, false), 'mot-phan'); }
}

// ── BẢNG ĐỔI SỐ TỜ (tóm tắt theo từng xã cũ) ───────────────────────────────
for (const r of SO_TO) {
  const m = xaMoiTheoMa.get(String(r.xaMoiId));
  if (!m) continue;
  let c = null;
  if (r.tenXaCu) {   // Ninh Hoà / Vạn Ninh: bảng ghi TÊN xã cũ thật (dữ liệu nằm chung file xã gốc)
    const { rieng } = tach(r.tenXaCu);
    c = m.gom.map((g) => g.xa).find((x) => khoa(x.ten) === khoa(rieng)) || null;
  } else if (String(r.xaCuId) === m.id) c = timXaCu(m.id, true);
  else c = timXaCu(r.xaCuId, false) || timXaCu(r.xaCuId, true);   // vd khối tờ của file Cam Tân (mã 22435 = đơn vị gốc của Xã Cam Hiệp) nằm trong Xã Cam Lâm
  const dong = { toMoiTu: r.toMoiTu, toMoiDen: r.toMoiDen, toCuTu: r.toCuTu, toCuDen: r.toCuDen, soTo: r.soTo };
  const tenCu = c ? tenDu(c.loai, c.ten) : (String(r.xaCuId) === m.id ? tenDu(m.loai, m.ten) : (r.tenXaCu || ''));
  m.soTo.push({ ...dong, xaCu: c ? c.slug : '', tenXaCu: tenCu, giuSo: r.toMoiTu === r.toCuTu && r.toMoiDen === r.toCuDen });
  if (c) c.soTo.push({ ...dong, xaMoi: m.id });
}
for (const m of xaMoi) m.soTo.sort((a, b) => a.toMoiTu - b.toMoiTu);

// ── quan hệ huyện cũ ↔ xã ──────────────────────────────────────────────────
for (const c of xaCu) {
  const h = huyenTheoId.get(c.huyenId);
  if (!h) continue;
  h.xaCu.push(c.slug);
  for (const v of c.vao) if (!h.xaMoi.includes(v.id)) h.xaMoi.push(v.id);
}
// huyện cũ CHỨA đơn vị gốc của xã mới giữ nguyên tên (không có trang xã cũ riêng) → vẫn phải nối huyện ↔ xã mới
for (const m of xaMoi) { const h = huyenTheoId.get(m.huyenGocId); if (h && !h.xaMoi.includes(m.id)) h.xaMoi.push(m.id); }

// QUY HOẠCH chỉ có ở huyện Cam Lâm cũ (QĐ205 + phân khu + QĐ893) — xem CLAUDE.md "QUY HOẠCH CHỈ CÓ Ở HUYỆN CAM LÂM CŨ"
const HUYEN_CO_QH = huyenCu.find((h) => khoa(h.ten) === 'cam lam')?.id;
for (const m of xaMoi) {
  const hs = new Set([m.huyenGocId, ...m.gom.map((g) => g.xa.huyenId)]);
  m.huyenCu = [...hs].filter((x) => huyenTheoId.has(x));
  m.coQh = hs.has(HUYEN_CO_QH);
}
for (const c of xaCu) c.coQh = c.huyenId === HUYEN_CO_QH;

// ── ghi file ───────────────────────────────────────────────────────────────
const out = {
  _ghiChu: 'SINH TỰ ĐỘNG bằng scripts/dia-chinh/dung-dia-danh.mjs — đừng sửa tay. Không chứa số thửa (thông tin nội bộ).',
  canCu: 'Nghị quyết 1667/NQ-UBTVQH15 (sắp xếp đơn vị hành chính cấp xã tỉnh Khánh Hòa năm 2025, hiệu lực 1/7/2025); danh mục đơn vị hành chính của Sở Nông nghiệp và Môi trường Khánh Hòa.',
  duNq: !!NQ,
  huyenCu: huyenCu.map((h) => ({ ...h, xaMoi: h.xaMoi.sort() })),
  xaMoi: xaMoi.map((m) => ({
    id: m.id, slug: m.slug, loai: m.loai, ten: m.ten, donViGoc: m.donViGoc, huyenGoc: m.huyenGocId, huyenCu: m.huyenCu, coQh: m.coQh, coBanDo: m.coBanDo,
    tam: m.tam, bbox: m.bbox, nguyenVan: m.nguyenVan, gomCungTen: m.gomCungTen || null,
    gom: m.gom.map((g) => ({ xa: g.xa.slug, phan: g.phan })), soTo: m.soTo,
  })),
  xaCu: xaCu.map((c) => ({
    id: c.id, slug: c.slug, loai: c.loai, ten: c.ten, huyenId: c.huyenId, laGoc: c.laGoc, coQh: c.coQh, coBanDo: c.coBanDo,
    maBanDo: c.maBanDo, tam: c.tam, vao: c.vao, soTo: c.soTo,
  })),
};
writeFileSync(RA, JSON.stringify(out, null, 1) + '\n', 'utf8');

// ── tự kiểm ────────────────────────────────────────────────────────────────
const slugs = [...out.huyenCu, ...out.xaMoi, ...out.xaCu].map((x) => x.slug);
const trung = slugs.filter((s, i) => slugs.indexOf(s) !== i);
const khongVao = out.xaCu.filter((c) => !c.vao.length);
const moiRong = out.xaMoi.filter((m) => !m.gom.length && !m.gomCungTen);
console.log(`huyện cũ ${out.huyenCu.length} · xã mới ${out.xaMoi.length} · xã cũ ${out.xaCu.length} · đủ NQ ${out.duNq}`);
console.log(`đường dẫn trùng: ${trung.length ? trung.join(', ') : 'không'}`);
console.log(`xã cũ chưa biết nhập vào đâu: ${khongVao.length}${khongVao.length ? ' — ' + khongVao.slice(0, 12).map((c) => c.slug).join(', ') : ''}`);
console.log(`xã mới chưa có danh sách xã cũ: ${moiRong.length}${moiRong.length ? ' — ' + moiRong.map((m) => m.slug).join(', ') : ''}`);
for (const c of canhBao) console.log('⚠', c);
if (trung.length) process.exit(1);
