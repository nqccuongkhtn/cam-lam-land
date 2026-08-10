// ============================================================================
//  BƯỚC 2 — Ánh xạ LEVEL (layer CAD) → LOẠI ĐẤT + MÀU + KỊCH BẢN, xuất GeoJSON
//  chuẩn để upload làm lớp "Quy hoạch (zoning)" trên web.
//
//  CÁCH DÙNG:
//    node 2-map-levels.mjs qd205_raw.geojson qd205-levels.json [qd205_zoning.geojson]
//
//  LẦN ĐẦU: chưa có bảng map → cứ chạy, script sẽ LIỆT KÊ mọi level trong file
//  (kèm số polygon). Copy các level đó vào qd205-levels.json (theo mẫu .example),
//  điền loại đất + màu theo BẢNG CHÚ GIẢI của QĐ205, rồi chạy lại.
//
//  Mỗi feature xuất ra có: { lo (loại đất), c (màu #hex), hz (kịch bản, vd "2045") }
//  → đúng thuộc tính lớp zoning hiện tại của web (tô màu + tính diện tích).
// ============================================================================
import fs from 'node:fs';

const [, , inFile, mapFile, outFile = 'qd205_zoning.geojson'] = process.argv;
if (!inFile) { console.error('Dùng: node 2-map-levels.mjs <raw.geojson> <levels.json> [out.geojson]'); process.exit(1); }

const gj = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const feats = gj.features || [];

// Đếm level (chỉ tính polygon) để biết cần map những gì.
const levelCount = {};
const levelOf = (f) => String(f.properties?.Layer ?? f.properties?.level ?? f.properties?.layer ?? f.properties?.LAYER ?? '').trim();
let polys = 0;
for (const f of feats) {
  if (!f.geometry || !/Polygon/i.test(f.geometry.type)) continue;
  polys++; const lv = levelOf(f); levelCount[lv] = (levelCount[lv] || 0) + 1;
}
const levels = Object.entries(levelCount).sort((a, b) => b[1] - a[1]);

// Chưa có bảng map → chỉ liệt kê level rồi dừng.
if (!mapFile || !fs.existsSync(mapFile)) {
  console.log(`Tổng ${polys} polygon, ${levels.length} level.\nCÁC LEVEL (copy vào file map, điền lo/c/hz):\n`);
  const tpl = {};
  for (const [lv, n] of levels) { console.log(`   "${lv}"  — ${n} polygon`); tpl[lv] = { lo: '', c: '#cccccc', hz: '2045' }; }
  fs.writeFileSync('qd205-levels.auto.json', JSON.stringify(tpl, null, 2));
  console.log(`\n→ Đã tạo mẫu 'qd205-levels.auto.json' (điền lo/c cho từng level rồi chạy lại với file này).`);
  process.exit(0);
}

const MAP = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
const out = { type: 'FeatureCollection', features: [] };
const unmapped = {};
let done = 0;
for (const f of feats) {
  if (!f.geometry || !/Polygon/i.test(f.geometry.type)) continue;
  const lv = levelOf(f); const m = MAP[lv];
  if (!m || !m.lo) { unmapped[lv] = (unmapped[lv] || 0) + 1; continue; }   // level chưa gán loại đất → bỏ qua
  out.features.push({ type: 'Feature', geometry: f.geometry, properties: { lo: m.lo, c: m.c || '#cccccc', hz: String(m.hz || '2045') } });
  done++;
}
fs.writeFileSync(outFile, JSON.stringify(out));
console.log(`✓ ${done} polygon đã gán loại đất → ${outFile}`);
const un = Object.entries(unmapped).filter(([k]) => k !== '' || true).sort((a, b) => b[1] - a[1]);
if (un.length) {
  console.log(`\n⚠ ${un.length} level CHƯA map (bổ sung vào ${mapFile} rồi chạy lại):`);
  for (const [k, n] of un) console.log(`   "${k}"  — ${n} polygon`);
}
console.log(`\n→ Bước 3: Upload ${outFile} lên web (Quản trị → Lớp bản đồ → thêm lớp, chọn loại "Quy hoạch").`);
