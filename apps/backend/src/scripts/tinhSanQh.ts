// ── TÍNH SẴN QUY HOẠCH CHO THỬA LỚN — chạy như TIẾN TRÌNH RIÊNG (index.ts tự gọi lúc khởi động, 10/10/2026) ──
// Thửa ≥ 2.000 m² trong vùng có quy hoạch (~32.500 thửa), theo thứ tự mã thửa. Thửa đã lưu đúng phiên bản thì bỏ qua → chạy lại
// nhiều lần vẫn nhanh. Khoá tư vấn Postgres bảo đảm chỉ một tiến trình chạy. Chạy tay: npx tsx src/scripts/tinhSanQh.ts
import { query, pool } from '../lib/db.ts';
import { qhReady, qhPhienBan, outerRing, chuanToaDoDiaChinh, ngoaiVungQh } from '../lib/qhCompute.ts';
import { tinhQh, dauThua, luuQh } from '../lib/qhLuu.ts';

const NGUONG = Number(process.env.QH_TINH_SAN_M2 || 2000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (let i = 0; i < 120 && !qhReady(); i++) await sleep(1000);
  const pb = qhPhienBan();
  if (!pb) { console.log('[tinh-san-qh] chưa nạp được dữ liệu quy hoạch — thôi'); return; }
  const [k] = await query<{ ok: boolean }>('SELECT pg_try_advisory_lock(7420251) AS ok');
  if (!k?.ok) { console.log('[tinh-san-qh] đã có tiến trình khác đang chạy — thôi'); return; }
  const t0 = Date.now(); let lam = 0, bo = 0, sau = 0;
  for (;;) {
    // lấy từng lô 300 thửa CHƯA có kết quả đúng phiên bản
    const ds = await query<any>(`
      SELECT d.id, ST_AsGeoJSON(d.geom)::json AS g, ROUND(ST_Area(d.geom::geography)::numeric, 1) AS dt
      FROM dia_chinh d LEFT JOIN qh_luu l ON l.id = d.id AND l.pb = $1
      WHERE l.id IS NULL AND d.geom && ST_MakeEnvelope(108.9401, 11.9335, 109.2471, 12.2142, 4326)
        AND d.dien_tich >= $2 AND d.id > $3
      ORDER BY d.id LIMIT 300`, [pb, NGUONG, sau]);
    if (!ds.length) break;
    for (const r of ds) {
      sau = r.id;
      const ring = chuanToaDoDiaChinh(outerRing(r.g) || []);
      const dt = Number(r.dt) || 0;
      if (ring.length < 3 || !(dt > 0) || ngoaiVungQh(ring)) { bo++; continue; }
      await luuQh(r.id, pb, dauThua(ring, dt), tinhQh(ring, dt)).catch(() => {});
      lam++;
      if (lam % 1000 === 0) console.log(`[tinh-san-qh] đã tính ${lam} thửa (${Math.round((Date.now() - t0) / 1000)} giây)`);
      await sleep(5);   // nhường CPU cho máy chủ web
    }
  }
  console.log(`[tinh-san-qh] xong: tính ${lam} thửa, bỏ ${bo} thửa ngoài vùng, ${Math.round((Date.now() - t0) / 1000)} giây`);
}

main().catch((e) => console.error('[tinh-san-qh] lỗi:', e?.message || e)).finally(() => pool.end().then(() => process.exit(0)));
