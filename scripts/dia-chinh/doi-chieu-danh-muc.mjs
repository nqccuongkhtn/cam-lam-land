// ĐỐI CHIẾU DỮ LIỆU ĐỊA CHÍNH TRONG DATABASE VỚI DANH MỤC HÀNH CHÍNH CHÍNH THỨC
// ─────────────────────────────────────────────────────────────────────────────
// Danh mục lấy thẳng từ hệ thống của Sở (khh.mplis.gov.vn) — xem thư mục dvhc/.
// Công cụ này kiểm tra 4 điều, cái nào lệch là báo ra ngay:
//   1. Mọi mã xã trong dữ liệu đều có thật trong danh mục.
//   2. Cấp hành chính (2 cấp / 3 cấp) khớp với cờ trangThai của danh mục.
//   3. Tên xã khớp.
//   4. Huyện/TP cũ khớp.
//   5. Xã cũ được xếp vào xã mới CÙNG HUYỆN CŨ (trừ ngoại lệ chuyển huyện, sẽ liệt kê riêng).
//
// Cách chạy (từ thư mục gốc dự án):
//   docker compose exec -T postgis psql -U camlam -d camlam_gis -tAF'|' \
//     -c "SELECT xa_id, ten, cap, huyen, coalesce(xa_moi_id,'') FROM dia_chinh_xa ORDER BY xa_id;" > /tmp/db-xa.txt
//   node scripts/dia-chinh/doi-chieu-danh-muc.mjs /tmp/db-xa.txt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THU_MUC = path.dirname(fileURLToPath(import.meta.url));
const kh = JSON.parse(fs.readFileSync(path.join(THU_MUC, 'dvhc', 'khanh-hoa-2cap.json'), 'utf8'));

const duongDan = process.argv[2];
if (!duongDan) { console.error('Thiếu đường dẫn file danh mục xuất từ database'); process.exit(1); }

const db = fs.readFileSync(duongDan, 'utf8').trim().split(/\r?\n/).map((l) => {
  const p = l.split('|');
  return { ma: p[0], ten: p[1], cap: Number(p[2]), huyen: p[3], xaMoi: p[4] || '' };
});

const tenHuyen = {};
kh.huyenCu.forEach((h) => { tenHuyen[h.huyenId] = h.ten; });
const chinhThuc = {};
kh.xaMoi.forEach((x) => { chinhThuc[x.xaId] = { ten: x.ten, cap: 2, huyen: tenHuyen[x.huyenIdCu], huyenId: x.huyenIdCu }; });
kh.xaCu.forEach((x) => { chinhThuc[x.xaId] = { ten: x.ten, cap: 3, huyen: tenHuyen[x.huyenIdCu], huyenId: x.huyenIdCu }; });

const chuanTen = (t) => String(t).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const chuanHuyen = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  .toLowerCase().replace(/^(tp\.|thanh pho|thi xa|huyen|dac khu)\s*/, '').replace(/[^a-z ]/g, '').trim();

const loi = { thieu: [], cap: [], ten: [], huyen: [] };
const chuyenHuyen = [];

for (const d of db) {
  const c = chinhThuc[d.ma];
  if (!c) { loi.thieu.push(`${d.ma} ${d.ten}`); continue; }
  if (c.cap !== d.cap) loi.cap.push(`${d.ma} ${d.ten} — ta ghi cấp ${d.cap}, danh mục ghi cấp ${c.cap}`);
  if (chuanTen(c.ten) !== chuanTen(d.ten)) loi.ten.push(`${d.ma} — ta: "${d.ten}" | danh mục: "${c.ten}"`);
  if (d.cap === 3 && chuanHuyen(c.huyen) !== chuanHuyen(d.huyen))
    loi.huyen.push(`${d.ma} ${d.ten} — ta xếp ${d.huyen}, danh mục ${c.huyen}`);
  // Xã cũ phải được xếp vào xã mới cùng huyện cũ; khác huyện là ngoại lệ, phải xem lại bằng mắt.
  if (d.cap === 3 && d.xaMoi && chinhThuc[d.xaMoi] && chinhThuc[d.xaMoi].huyenId !== c.huyenId)
    chuyenHuyen.push(`${d.ma} ${d.ten} (${c.huyen}) → ${chinhThuc[d.xaMoi].ten} (${chinhThuc[d.xaMoi].huyen})`);
}

const in_ = (nhan, ds) => {
  console.log(`${ds.length === 0 ? 'ĐẠT ' : 'LỆCH'}  ${nhan}: ${ds.length}`);
  ds.forEach((x) => console.log('        ' + x));
};
console.log(`Đối chiếu ${db.length} xã trong database với danh mục chính thức (${kh.xaMoi.length} xã mới + ${kh.xaCu.length} xã cũ)\n`);
in_('Mã xã không có trong danh mục', loi.thieu);
in_('Lệch cấp hành chính', loi.cap);
in_('Lệch tên xã', loi.ten);
in_('Lệch huyện/TP cũ', loi.huyen);
console.log(`\nGHI CHÚ  Xã cũ nhập sang huyện cũ KHÁC (hợp lệ nếu đúng nghị quyết): ${chuyenHuyen.length}`);
chuyenHuyen.forEach((x) => console.log('        ' + x));

const hong = loi.thieu.length + loi.cap.length + loi.ten.length + loi.huyen.length;
console.log('\n' + (hong === 0 ? '✔ TOÀN BỘ KHỚP DANH MỤC CHÍNH THỨC' : `✘ CÓ ${hong} CHỖ LỆCH — xem ở trên`));
process.exit(hong === 0 ? 0 : 1);
