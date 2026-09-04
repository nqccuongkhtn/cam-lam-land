// NẠP BẢNG TRA SỐ TỜ BẢN ĐỒ (số tờ MỚI ↔ số tờ CŨ) CHO BẤT KỲ XÃ NÀO TRONG TỈNH
// ─────────────────────────────────────────────────────────────────────────────
// Sau sáp nhập, mỗi xã mới đánh lại số tờ bản đồ địa chính liên tục từ 1, trong khi dữ liệu
// địa chính vẫn giữ số tờ CŨ theo từng xã cũ. Không có bảng đối chiếu thì tra "tờ 250" của
// Xã Cam Lâm sẽ không ra, hoặc ra nhầm nhiều thửa của nhiều xã cũ khác nhau.
//
// KHÔNG có công thức nào suy ra được bảng này — thứ tự ghép các xã cũ do từng địa phương
// quyết định khi biên tập lại bộ bản đồ. Phải xin bảng đối chiếu của Chi nhánh Văn phòng
// Đăng ký đất đai nơi đó. Có bảng rồi thì nạp bằng công cụ này.
//
// ĐỊNH DẠNG FILE (CSV hoặc TSV, có hoặc không có dòng tiêu đề — 4 cột theo thứ tự):
//     xã mới , số tờ mới , xã cũ , số tờ cũ
// Ví dụ:
//     Xã Cam Lâm,58,xã Cam Hải Đông,1
//     22453,59,22441,2
// Cột xã ghi TÊN (không cần dấu, không cần chữ "xã/phường") hoặc ghi thẳng MÃ XÃ — cách nào cũng được.
//
// Có thể thêm 2 CỘT NỮA (không bắt buộc):
//     … , tên xã cũ THẬT theo bảng giấy , số tờ cũ THẬT
// Dùng khi CHỖ ĐI TÌM dữ liệu khác với ĐIỀU BẢNG GIẤY GHI — đúng cảnh Ninh Hoà và Vạn Ninh:
// xã cũ không có file riêng nên phải tìm trong file xã mới theo số tờ mới, nhưng khi hiện lên
// web vẫn phải ghi đúng "Trước sáp nhập: xã Đại Lãnh · tờ cũ 1". Bỏ trống = hai cái trùng nhau.
//
// CHẠY:
//     node scripts/dia-chinh/nap-bang-so-to.mjs bang-cua-xa.csv > nap.sql
//     docker compose exec -T postgis psql -U camlam -d camlam_gis < nap.sql
//
// XEM ĐÃ PHỦ ĐƯỢC BAO NHIÊU XÃ:
//     node scripts/dia-chinh/nap-bang-so-to.mjs --bao-cao
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const boDau = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
  .replace(/^(xa|phuong|thi tran|dac khu)\s+/, '').replace(/[^a-z0-9]/g, '');

// Hỏi database lấy danh mục xã để đối chiếu tên → mã
function hoiDatabase(sql) {
  return execFileSync('docker', ['compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam',
    '-d', 'camlam_gis', '-tAF|', '-c', sql], { cwd: GOC, encoding: 'utf8' });
}

const dsXa = hoiDatabase('SELECT xa_id, ten, cap FROM dia_chinh_xa ORDER BY xa_id;')
  .trim().split(/\r?\n/).filter(Boolean)
  .map((l) => { const p = l.split('|'); return { ma: p[0], ten: p[1], cap: Number(p[2]) }; });

// ── Chế độ BÁO CÁO: xã nào cần bảng tra, xã nào đã có ────────────────────────
if (process.argv[2] === '--bao-cao') {
  const bc = hoiDatabase(`
    WITH g AS (SELECT xa_moi_id, count(DISTINCT xa_id) n, count(*) thua
               FROM dia_chinh WHERE xa_moi_id IS NOT NULL GROUP BY xa_moi_id)
    SELECT x.ten, g.n, g.thua, COALESCE(t.co, 0)
    FROM g JOIN dia_chinh_xa x ON x.xa_id = g.xa_moi_id
    LEFT JOIN (SELECT xa_moi_id, count(*) co FROM dia_chinh_to GROUP BY xa_moi_id) t ON t.xa_moi_id = g.xa_moi_id
    ORDER BY (g.n > 1 AND COALESCE(t.co,0) = 0) DESC, g.thua DESC;`)
    .trim().split(/\r?\n/).filter(Boolean).map((l) => l.split('|'));
  const can = bc.filter((r) => Number(r[1]) > 1 && Number(r[3]) === 0);
  const daCo = bc.filter((r) => Number(r[3]) > 0);
  const khongCan = bc.filter((r) => Number(r[1]) === 1);
  console.log(`ĐÃ CÓ bảng tra:            ${daCo.length} xã`);
  daCo.forEach((r) => console.log(`   ${r[0]}  (${r[3]} tờ)`));
  console.log(`\nKHÔNG CẦN (chỉ 1 xã cũ):   ${khongCan.length} xã · ${khongCan.reduce((s, r) => s + Number(r[2]), 0).toLocaleString('vi-VN')} thửa`);
  console.log(`\nCÒN THIẾU bảng tra:        ${can.length} xã · ${can.reduce((s, r) => s + Number(r[2]), 0).toLocaleString('vi-VN')} thửa`);
  can.forEach((r) => console.log(`   ${r[0].padEnd(24)} gộp từ ${r[1]} xã cũ · ${Number(r[2]).toLocaleString('vi-VN')} thửa`));
  process.exit(0);
}

// ── Chế độ NẠP ───────────────────────────────────────────────────────────────
const duongDan = process.argv[2];
if (!duongDan) { console.error('Thiếu đường dẫn file bảng tra. Xem hướng dẫn ở đầu file này.'); process.exit(1); }

const timXa = (o, mongDoiCap) => {
  const s = String(o).trim();
  if (/^\d{4,6}$/.test(s)) return dsXa.find((x) => x.ma === s) || null;
  const k = boDau(s);
  const hop = dsXa.filter((x) => boDau(x.ten) === k);
  if (hop.length === 1) return hop[0];
  // Trùng tên (toàn tỉnh có 10 cặp) → chọn theo cấp mong đợi
  const theoCap = hop.filter((x) => x.cap === mongDoiCap);
  return theoCap.length === 1 ? theoCap[0] : null;
};

const dong = [];
const loi = [];
const xaMoiGap = new Set();
const noiDung = fs.readFileSync(duongDan, 'utf8').replace(/^﻿/, '');
noiDung.trim().split(/\r?\n/).forEach((l, i) => {
  if (!l.trim()) return;
  const c = l.split(/\t|,|;/).map((x) => x.trim().replace(/^"|"$/g, ''));
  if (c.length < 4) { loi.push(`dòng ${i + 1}: cần 4 cột, thấy ${c.length}`); return; }
  const [aXaMoi, aToMoi, aXaCu, aToCu, aTenCu, aToCuThat] = c;
  if (!/^\d+$/.test(aToMoi) || !/^\d+$/.test(aToCu)) return;   // bỏ qua dòng tiêu đề
  const xm = timXa(aXaMoi, 2), xc = timXa(aXaCu, 3);
  if (!xm) { loi.push(`dòng ${i + 1}: không nhận ra xã mới "${aXaMoi}"`); return; }
  if (!xc) { loi.push(`dòng ${i + 1}: không nhận ra xã cũ "${aXaCu}"`); return; }
  xaMoiGap.add(xm.ma);
  const nhay = (v) => `'${String(v).replace(/'/g, "''")}'`;
  const tenCu = (aTenCu || '').trim() ? nhay(aTenCu.trim()) : 'NULL';
  const toCuThat = /^\d+$/.test(String(aToCuThat || '').trim()) ? Number(aToCuThat) : 'NULL';
  dong.push(`('${xm.ma}', ${Number(aToMoi)}, '${xc.ma}', ${Number(aToCu)}, ${tenCu}, ${toCuThat})`);
});

if (loi.length) { loi.slice(0, 20).forEach((x) => console.error('! ' + x)); if (loi.length > 20) console.error(`! …và ${loi.length - 20} dòng nữa`); }
if (!dong.length) { console.error('Không đọc được dòng nào hợp lệ.'); process.exit(1); }

console.log(`-- Nạp ${dong.length} dòng tra số tờ cho ${xaMoiGap.size} xã: ${[...xaMoiGap].join(', ')}
CREATE TABLE IF NOT EXISTS dia_chinh_to (
  xa_moi_id TEXT NOT NULL, to_moi INT NOT NULL,
  xa_cu_id TEXT NOT NULL,  to_cu  INT NOT NULL,
  PRIMARY KEY (xa_moi_id, to_moi));
-- Hai cột "sự thật theo giấy tờ" (xem migrate.ts). Chạy trên database cũ chưa có cột thì thêm vào.
ALTER TABLE dia_chinh_to ADD COLUMN IF NOT EXISTS ten_xa_cu TEXT;
ALTER TABLE dia_chinh_to ADD COLUMN IF NOT EXISTS to_cu_that INT;
-- Nạp lại xã nào thì xoá sạch xã đó trước → chạy lại nhiều lần vẫn không nhân đôi.
DELETE FROM dia_chinh_to WHERE xa_moi_id IN (${[...xaMoiGap].map((m) => `'${m}'`).join(',')});
INSERT INTO dia_chinh_to (xa_moi_id, to_moi, xa_cu_id, to_cu, ten_xa_cu, to_cu_that) VALUES
${dong.join(',\n')};
CREATE INDEX IF NOT EXISTS dia_chinh_to_nguoc_idx ON dia_chinh_to (xa_cu_id, to_cu);

-- Bảng tra cũng là CĂN CỨ CHÍNH THỨC để chia thửa của xã cũ bị cắt cho đúng xã mới.
WITH ro_rang AS (
  SELECT xa_cu_id, to_cu, min(xa_moi_id) AS xa_moi
  FROM dia_chinh_to GROUP BY xa_cu_id, to_cu HAVING count(DISTINCT xa_moi_id) = 1)
UPDATE dia_chinh d SET xa_moi_id = r.xa_moi
FROM ro_rang r
WHERE r.xa_cu_id = d.xa_id AND r.to_cu = d.to_num AND d.xa_moi_id IS DISTINCT FROM r.xa_moi;

SELECT xa_moi_id, count(*) AS so_to FROM dia_chinh_to GROUP BY xa_moi_id ORDER BY xa_moi_id;`);
console.error(`${dong.length} dòng · ${xaMoiGap.size} xã`);
