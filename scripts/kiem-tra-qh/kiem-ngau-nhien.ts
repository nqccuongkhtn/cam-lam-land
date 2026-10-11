// KIỂM NGẪU NHIÊN (12/10/2026) — cho máy tính quy hoạch của N thửa thật y như web (tinhQhHinh + nắn toạ độ địa chính),
// ghi kèm hình thửa ĐÃ NẮN (mọi vòng) để bên ngoài cắt hình thẳng trên ô đất làm đáp án. Ghi thêm số QĐ205 "thuần" (chưa hoà hợp
// với bản chi tiết) để đo luật hoaHop205. Ra: /tmp/kiem-ngau-nhien.jsonl
// Chạy: docker cp scripts/kiem-tra-qh/kiem-ngau-nhien.ts camlam_backend:/app/apps/backend/src/scripts/ rồi
//   docker exec -w /app/apps/backend camlam_backend node_modules/.bin/tsx src/scripts/kiem-ngau-nhien.ts 3500
// (thử code mới chưa đưa lên: chép thư mục lib sang libmoi trong container, sửa đường dẫn import bên dưới thành ../libmoi/…)
import fs from 'node:fs';
import { query, pool } from '../lib/db.ts';
import { qhReady, outerRing, chuanToaDoDiaChinh, ngoaiVungQh, computeQhAreas, computeQhTheoBan, hoaHop205 } from '../lib/qhCompute.ts';
import { tinhQhHinh } from '../lib/qhLuu.ts';
import { sqlDienTichPhang } from '../lib/dienTichPhang.ts';

for (let i = 0; i < 180 && !qhReady(); i++) await new Promise((r) => setTimeout(r, 1000));
const N = Number(process.argv[2] || 3000);
const ds = await query<any>(`SELECT d.id, d.so_to, d.so_thua, x.ten xa, ST_AsGeoJSON(d.geom)::json g,
    ROUND(${sqlDienTichPhang('d.geom')}::numeric, 1) dt
  FROM dia_chinh d LEFT JOIN dia_chinh_xa x ON x.xa_id = d.xa_id
  WHERE d.geom && ST_MakeEnvelope(108.9401, 11.9335, 109.2471, 12.2142, 4326) AND d.dien_tich BETWEEN 50 AND 50000
  ORDER BY md5(d.id::text || 'kiem12') LIMIT $1`, [N]);
const nan = (g: any) => g.type === 'Polygon' ? g.coordinates.map((r: number[][]) => chuanToaDoDiaChinh(r))
  : g.coordinates.map((p: number[][][]) => p.map((r) => chuanToaDoDiaChinh(r)));
const out = fs.createWriteStream('/tmp/kiem-ngau-nhien.jsonl');
let n = 0, bo = 0; const t0 = Date.now();
for (const p of ds) {
  const ring = chuanToaDoDiaChinh(outerRing(p.g) || []); const dt = Number(p.dt);
  if (ring.length < 4 || !(dt > 0) || ngoaiVungQh(ring)) { bo++; continue; }
  const web = tinhQhHinh(p.g, dt, chuanToaDoDiaChinh);
  const ban: Record<string, Record<string, number>> = {};
  if (web.pre) { ban['205'] = {}; for (const o of web.pre) ban['205'][o.type] = (ban['205'][o.type] || 0) + o.areaM2; }
  for (const b of web.cacBan) { ban[b.ma] = {}; for (const o of b.areas) ban[b.ma][o.type] = (ban[b.ma][o.type] || 0) + o.areaM2; }
  // QĐ205 thuần + bản được hoà hợp theo (chỉ thửa một vòng — đa số)
  let thuan: Record<string, number> | null = null, theo: string | null = null;
  const motVong = (p.g.type === 'Polygon' && p.g.coordinates.length === 1) || (p.g.type === 'MultiPolygon' && p.g.coordinates.length === 1 && p.g.coordinates[0].length === 1);
  if (motVong) {
    const pre0 = computeQhAreas(ring, dt);
    if (pre0) {
      thuan = {}; for (const o of pre0) thuan[o.type] = (thuan[o.type] || 0) + o.areaM2;
      theo = hoaHop205(ring, dt, pre0, computeQhTheoBan(ring, dt)).theo;
    }
  }
  out.write(JSON.stringify({ id: p.id, to: p.so_to, thua: p.so_thua, xa: p.xa, dt, kieu: p.g.type, hinh: nan(p.g), ban, thuan, theo }) + '\n');
  if (++n % 500 === 0) console.log('da tinh', n, 'thua,', Math.round((Date.now() - t0) / 1000), 'giay');
}
out.end();
console.log('XONG', n, 'thua (bo', bo, 'thua ngoai vung QH)', Math.round((Date.now() - t0) / 1000), 'giay');
await pool.end();
