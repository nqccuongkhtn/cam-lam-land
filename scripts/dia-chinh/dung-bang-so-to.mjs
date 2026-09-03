// DỰNG BẢNG TRA SỐ TỜ BẢN ĐỒ ĐỊA CHÍNH: số tờ MỚI (theo xã mới) ↔ số tờ CŨ (theo xã cũ).
// ─────────────────────────────────────────────────────────────────────────────
// VÌ SAO CẦN: dữ liệu địa chính đang giữ SỐ TỜ CŨ theo từng xã cũ. Sau sáp nhập,
// mỗi xã mới đánh LẠI số tờ liên tục từ 1. Nên người dân cầm giấy tờ mới đọc ra
// "tờ 250" của Xã Cam Lâm, mà trong dữ liệu nó là "tờ 5 của xã Cam Hoà".
// Không có bảng này thì tra "tờ 5" ở Xã Cam Lâm sẽ ra 5 thửa của 5 xã cũ khác nhau — sai.
//
// QUY TẮC ĐÁNH SỐ (rút ra từ chính bảng tra của địa phương, khớp cả 4 xã):
//   1. Xã mới đánh lại số tờ liên tục từ 1.
//   2. Xã cũ "GỐC" — cũng chính là xã cũ mà xã mới KẾ THỪA MÃ SỐ — GIỮ NGUYÊN số tờ.
//        Cam Đức → Xã Cam Lâm (22453) · Suối Cát → Xã Suối Dầu (22708)
//        Cam Tân → Xã Cam Hiệp (22435) · Cam An Bắc → Xã Cam An (22465)
//   3. Các xã cũ còn lại đánh TIẾP theo từng khối, trong khối giữ thứ tự số tờ cũ tăng dần.
//   4. Xã cũ bị chia thì chỉ mang sang những tờ thuộc phần đất của mình; tờ nào bị ranh
//      xã mới cắt qua thì xuất hiện ở CẢ HAI xã mới với hai số tờ mới khác nhau.
//
// Nguồn số liệu: bảng tra của địa phương, đã có sẵn trong apps/frontend/src/lib/traSoBanDo.ts
// Hiện chỉ có 4 xã của huyện Cam Lâm cũ. Xã khác có bảng thì bổ sung theo đúng cách này.
//
// Chạy:  node scripts/dia-chinh/dung-bang-so-to.mjs | docker compose exec -T postgis psql -U camlam -d camlam_gis
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Mã viết tắt xã cũ trong bảng tra  →  mã xã trong dữ liệu địa chính.
// Bốn xã "gốc" dùng chính mã mà xã mới kế thừa (Cam Đức = 22453, Suối Cát = 22708, ...)
// vì thửa của các xã đó nằm dưới đúng mã ấy trong dữ liệu.
const MA_XA_CU = {
  'CĐ': '22453',   // thị trấn Cam Đức  (gốc của Xã Cam Lâm)
  'CHĐ': '22441',  // xã Cam Hải Đông
  'CHT': '22444',  // xã Cam Hải Tây
  'CTB': '22462',  // xã Cam Thành Bắc
  'CHB': '22450',  // xã Cam Hiệp Bắc
  'CHN': '22456',  // xã Cam Hiệp Nam
  'CH': '22438',   // xã Cam Hòa
  'CT': '22435',   // xã Cam Tân       (gốc của Xã Cam Hiệp)
  'ST': '22711',   // xã Suối Tân
  'CAN': '22471',  // xã Cam An Nam
  'CAB': '22465',  // xã Cam An Bắc    (gốc của Xã Cam An)
  'SC': '22708',   // xã Suối Cát      (gốc của Xã Suối Dầu)
  'CPT': '22459',  // xã Cam Phước Tây
};
const MA_XA_MOI = { 'Cam Lâm': '22453', 'Suối Dầu': '22708', 'Cam Hiệp': '22435', 'Cam An': '22465' };

const nguon = fs.readFileSync(path.join(GOC, 'apps/frontend/src/lib/traSoBanDo.ts'), 'utf8');
const khop = nguon.match(/export const SHEET_MAP[^=]*=\s*(\{[\s\S]*?\n\};)/);
if (!khop) { console.error('Không đọc được SHEET_MAP trong traSoBanDo.ts'); process.exit(1); }
// eslint-disable-next-line no-eval
const BANG = eval('(' + khop[1].replace(/;$/, '') + ')');

const dong = [];
let thieuMa = new Set();
for (const [tenXaMoi, ds] of Object.entries(BANG)) {
  const maMoi = MA_XA_MOI[tenXaMoi];
  if (!maMoi) { thieuMa.add('xã mới: ' + tenXaMoi); continue; }
  for (const [toMoi, maTat, toCu] of ds) {
    const maCu = MA_XA_CU[maTat];
    if (!maCu) { thieuMa.add('xã cũ: ' + maTat); continue; }
    dong.push(`('${maMoi}', ${Number(toMoi)}, '${maCu}', ${Number(toCu)})`);
  }
}
if (thieuMa.size) console.error('! Chưa biết mã cho: ' + [...thieuMa].join(', '));

console.log(`
CREATE TABLE IF NOT EXISTS dia_chinh_to (
  xa_moi_id TEXT NOT NULL,   -- mã xã/phường MỚI
  to_moi    INT  NOT NULL,   -- số tờ theo bản đồ MỚI của xã đó
  xa_cu_id  TEXT NOT NULL,   -- mã xã CŨ chứa tờ đó trong dữ liệu
  to_cu     INT  NOT NULL,   -- số tờ CŨ
  PRIMARY KEY (xa_moi_id, to_moi)
);
DELETE FROM dia_chinh_to WHERE xa_moi_id IN (${Object.values(MA_XA_MOI).map((m) => `'${m}'`).join(',')});
INSERT INTO dia_chinh_to (xa_moi_id, to_moi, xa_cu_id, to_cu) VALUES
${dong.join(',\n')};
CREATE INDEX IF NOT EXISTS dia_chinh_to_nguoc_idx ON dia_chinh_to (xa_cu_id, to_cu);
SELECT xa_moi_id, count(*) AS so_to_moi FROM dia_chinh_to GROUP BY xa_moi_id ORDER BY xa_moi_id;
`);
console.error(`${dong.length} dòng tra số tờ`);
