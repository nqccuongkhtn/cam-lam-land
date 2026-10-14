// Sinh apps/backend/data/huyen-cu.json: MỌI mã xã (65 xã mới + 139 xã cũ của danh mục Sở) → tên HUYỆN/TP CŨ.
// Lấy thẳng trường huyenIdCu của danh mục Sở (scripts/dia-chinh/dvhc/khanh-hoa-2cap.json) — không đoán theo vị trí.
// Dùng cho lib/qhPdf.ts: QHSDĐ 2030 lập theo HUYỆN CŨ, nên thửa thuộc xã nào thì tra đúng bản đồ của huyện cũ chứa xã đó
// (ranh vẽ ra từ vùng màu PDF của hai huyện cạnh nhau chồng lên nhau tới vài nghìn ha, chọn theo ranh là có lúc lấy nhầm bản huyện bên).
// Khác data/huyen-goc.json (chỉ có 50 đơn vị gốc, dùng cho ô chọn xã "3 cấp") — file này đủ mọi mã, kể cả xã mới giữ nguyên tên gốc.
// Chạy: node scripts/dia-chinh/dung-huyen-cu.mjs   (danh mục đổi thì chạy lại)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const goc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dm = JSON.parse(fs.readFileSync(path.join(goc, 'scripts/dia-chinh/dvhc/khanh-hoa-2cap.json'), 'utf8'));

// Ghi tên huyện đúng kiểu web đang ghi ở bảng dia_chinh_xa: "TP. Nha Trang", "Thị xã Ninh Hòa", "Huyện Cam Lâm"…
const tenWeb = (t) => String(t).normalize('NFC').trim()
  .replace(/^thành phố\s+/i, 'TP. ')
  .replace(/^thị xã\s+/i, 'Thị xã ')
  .replace(/^huyện\s+/i, 'Huyện ');
const huyen = new Map(dm.huyenCu.map((h) => [h.huyenId, tenWeb(h.ten)]));

const ra = {
  _doc: 'Mã xã (65 xã mới + 139 xã cũ, danh mục Sở) → huyện/TP CŨ theo trường huyenIdCu. Sinh bằng scripts/dia-chinh/dung-huyen-cu.mjs — '
      + 'danh mục đổi thì chạy lại. Dùng cho lib/qhPdf.ts (thửa tra đúng bản QHSDĐ của huyện cũ chứa xã của nó).',
};
let thieu = 0;
for (const x of [...dm.xaMoi, ...dm.xaCu]) {
  const h = huyen.get(x.huyenIdCu);
  if (!h) { thieu++; console.error('Không rõ huyện cũ:', x.xaId, x.ten, x.huyenIdCu); continue; }
  ra[String(x.xaId)] = h;
}
const dich = path.join(goc, 'apps/backend/data/huyen-cu.json');
fs.writeFileSync(dich, JSON.stringify(ra, null, 0).replace(/,"/g, ',\n"') + '\n', 'utf8');
const dem = {};
for (const [k, v] of Object.entries(ra)) if (k !== '_doc') dem[v] = (dem[v] || 0) + 1;
console.log(`Đã ghi ${dich}: ${Object.keys(ra).length - 1} mã xã, thiếu huyện ${thieu}.`);
console.log(dem);
