// Dựng DANH MỤC XÃ/PHƯỜNG cho ô "Chọn xã" trên trang bản đồ.
// Tên xã lấy từ chính tên ghi trong file geojson gốc (chỉ đọc 1 khúc đầu file, rất nhanh).
// Khung bao + tâm + số thửa thì lấy từ database (đã nạp xong).
// In ra lệnh SQL, đem đổ vào psql là xong.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Bảng xếp xã cũ vào huyện/TP cũ — sửa file huyen-cu.json là đổi được, không phải sửa code.
const THU_MUC_SCRIPT = path.dirname(fileURLToPath(import.meta.url));
const BANG_HUYEN = JSON.parse(fs.readFileSync(path.join(THU_MUC_SCRIPT, 'huyen-cu.json'), 'utf8'));
// Bảng xã cũ → xã mới, lập theo Nghị quyết 1667 (2025) + 1196/1198 (2024). Xem xa-moi.json.
const BANG_MOI = JSON.parse(fs.readFileSync(path.join(THU_MUC_SCRIPT, 'xa-moi.json'), 'utf8'));
const LA_2CAP = new Set(BANG_MOI.cap2.ma);

const THU_MUC = process.argv[2] || 'D:/Cam Lam gis/gis khanh hoa';

// Bỏ dấu tiếng Việt để gõ tìm không cần dấu ("cam lam" ra "Cam Lâm")
const boDau = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

const nhay = (s) => "'" + String(s).split("'").join("''") + "'";
const dong = [];

for (const f of fs.readdirSync(THU_MUC).sort()) {
  if (!f.endsWith('.geojson')) continue;
  const fd = fs.openSync(path.join(THU_MUC, f), 'r');
  const buf = Buffer.alloc(400);
  fs.readSync(fd, buf, 0, 400, 0);
  fs.closeSync(fd);
  const m = buf.toString('utf8').match(/"name"\s*:\s*"([^"]*)"/);
  const ten = m ? m[1] : f.replace(/\.geojson$/, '');
  const maXa = (f.match(/_(\d+)\.geojson$/) || [, ''])[1];
  if (!maXa) continue;
  // CẤP HÀNH CHÍNH lấy theo VĂN BẢN SÁP NHẬP, không đoán theo chữ hoa/thường nữa —
  // quy ước hoa/thường của bên lập dữ liệu sai ở 17 xã (vd "xã Đại Lãnh", "xã Vạn Ninh"
  // viết thường nhưng thực chất đã là xã MỚI rồi).
  const cap = LA_2CAP.has(maXa) ? 2 : 3;
  // Huyện/TP cũ: đơn vị CŨ tra bảng; đơn vị MỚI thì xếp theo tỉnh cũ (không còn thuộc huyện nào).
  const c2 = BANG_HUYEN.cap2_theo_ma;
  const huyen = BANG_MOI.sua_huyen[maXa] || (cap === 3
    ? (BANG_HUYEN.cap3[maXa] || 'Chưa xếp huyện')
    : (Number(maXa) < c2.nguong ? c2.duoi : c2.tren));
  if (cap === 3 && !BANG_HUYEN.cap3[maXa] && !BANG_MOI.sua_huyen[maXa]) console.error(`  ! chưa xếp huyện: ${maXa} ${ten}`);
  // Xã MỚI tiếp nhận: đơn vị 2 cấp trỏ về chính nó; xã bị CHIA để trống (xét từng thửa sau).
  const xaMoi = cap === 2 ? maXa : (BANG_MOI.cu_thanh_moi[maXa] || null);
  if (cap === 3 && !xaMoi && !BANG_MOI.bi_chia[maXa]) console.error(`  ! chưa biết xã mới: ${maXa} ${ten}`);
  dong.push(`(${nhay(maXa)}, ${nhay(ten)}, ${nhay(boDau(ten))}, ${cap}, ${nhay(huyen)}, ${xaMoi ? nhay(xaMoi) : 'NULL'})`);
}

// Gộp danh mục (tên + cấp) với số liệu tính từ bảng thửa (khung bao, tâm, số thửa).
console.log(`
INSERT INTO dia_chinh_xa (xa_id, ten, ten_kd, cap, huyen, xa_moi_id, so_thua, minx, miny, maxx, maxy, cx, cy, updated_at)
SELECT v.xa_id, v.ten, v.ten_kd, v.cap, v.huyen, v.xa_moi_id,
       COALESCE(t.n, 0),
       ST_XMin(t.bb), ST_YMin(t.bb), ST_XMax(t.bb), ST_YMax(t.bb),
       ST_X(ST_Centroid(t.bb)), ST_Y(ST_Centroid(t.bb)), now()
FROM (VALUES\n${dong.join(',\n')}\n) AS v(xa_id, ten, ten_kd, cap, huyen, xa_moi_id)
-- Khung bao CHỈ tính trên thửa nằm trong phạm vi tỉnh. Dữ liệu gốc có vài thửa bị sai toạ độ
-- (rơi tận Đắk Lắk); nếu tính cả thì nút "bay tới xã" sẽ zoom ra tận nửa nước.
--
-- HAI CÁCH ĐẾM, TUỲ CẤP:
--  · Xã CŨ  → đếm thửa mang đúng mã đó (tc).
--  · Xã MỚI → đếm TOÀN BỘ thửa nay thuộc xã đó (tm), gồm cả thửa còn mang mã xã cũ.
--    Vì hệ thống địa chính KHÔNG dời thửa sang mã mới. Nếu đếm theo mã thì "Xã Cam Lâm"
--    chỉ ra 14.683 thửa trong khi thật ra có 54.263 — và nút bay tới cũng chỉ zoom được 1 góc xã.
LEFT JOIN (
  SELECT xa_id AS k, count(*)::int AS n, ST_Extent(geom)::geometry AS bb
  FROM dia_chinh WHERE geom && ST_MakeEnvelope(108.0, 11.0, 109.8, 13.2, 4326)
  GROUP BY xa_id
) tc ON tc.k = v.xa_id
LEFT JOIN (
  SELECT xa_moi_id AS k, count(*)::int AS n, ST_Extent(geom)::geometry AS bb
  FROM dia_chinh WHERE xa_moi_id IS NOT NULL AND geom && ST_MakeEnvelope(108.0, 11.0, 109.8, 13.2, 4326)
  GROUP BY xa_moi_id
) tm ON tm.k = v.xa_id
CROSS JOIN LATERAL (SELECT CASE WHEN v.cap = 2 THEN tm.n  ELSE tc.n  END AS n,
                           CASE WHEN v.cap = 2 THEN tm.bb ELSE tc.bb END AS bb) t
ON CONFLICT (xa_id) DO UPDATE SET
  ten = EXCLUDED.ten, ten_kd = EXCLUDED.ten_kd, cap = EXCLUDED.cap, huyen = EXCLUDED.huyen,
  xa_moi_id = EXCLUDED.xa_moi_id, so_thua = EXCLUDED.so_thua,
  minx = EXCLUDED.minx, miny = EXCLUDED.miny, maxx = EXCLUDED.maxx, maxy = EXCLUDED.maxy,
  cx = EXCLUDED.cx, cy = EXCLUDED.cy, updated_at = now();
`);
// Ghi chú: giờ cột "cap" LẤY THEO VĂN BẢN SÁP NHẬP nên chạy lại là cập nhật luôn.
// Muốn sửa thì sửa file xa-moi.json rồi chạy lại script này.
console.error(`${dong.length} xã`);
