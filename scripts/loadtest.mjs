#!/usr/bin/env node
// ĐO TẢI API Cam Lâm Land — KHÔNG cần cài thêm gói (chỉ cần Node 18+).
//   node scripts/loadtest.mjs [BASE_URL] [CONCURRENCY] [DURATION_SEC]
//   Ví dụ:  node scripts/loadtest.mjs http://localhost 50 20
//
// LƯU Ý: backend có giới hạn chống lụt (rate-limit) mặc định 600 req/phút → khi đo tải hãy
// đặt biến môi trường RATE_LIMIT_GLOBAL cao (vd 5000000) rồi khởi động lại backend, nếu không
// phần lớn request sẽ bị trả 429 (không đo được hiệu năng thật).

const BASE = (process.argv[2] || process.env.BASE_URL || 'http://localhost').replace(/\/+$/, '');
const CONC = Number(process.argv[3] || 50);
const DUR = Number(process.argv[4] || 20) * 1000;

const ENDPOINTS = [
  '/api/listings?limit=30',
  '/api/listings?deal=sale&limit=30',
  '/api/listings/areas',
  '/api/listings/gia-khu-vuc',
  '/api/health',
  '/api/listings?q=dat&limit=20',
];

const r = { total: 0, ok: 0, http429: 0, err: 0, lat: [] };
let stop = false;

async function worker() {
  while (!stop) {
    const url = BASE + ENDPOINTS[(Math.random() * ENDPOINTS.length) | 0];
    const t0 = performance.now();
    try {
      const res = await fetch(url);
      await res.arrayBuffer();
      r.total++; r.lat.push(performance.now() - t0);
      if (res.ok) r.ok++;
      else if (res.status === 429) r.http429++;
      else r.err++;
    } catch { r.total++; r.err++; }
  }
}

function pct(a, p) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; }

(async () => {
  console.log(`\n⏱  Đo tải ${BASE}  ·  ${CONC} luồng  ·  ${DUR / 1000}s ...`);
  const start = performance.now();
  setTimeout(() => { stop = true; }, DUR);
  await Promise.all(Array.from({ length: CONC }, worker));
  const secs = (performance.now() - start) / 1000;
  const { total, ok, http429, err, lat } = r;
  console.log('\n──────────────── KẾT QUẢ ────────────────');
  console.log('Tổng request  :', total, `  (~${(total / secs).toFixed(0)} req/s)`);
  console.log('Thành công 2xx:', ok, total ? `(${((ok / total) * 100).toFixed(1)}%)` : '');
  if (http429) console.log('Bị chặn 429   :', http429, '  → NÂNG RATE_LIMIT_GLOBAL rồi đo lại');
  console.log('Lỗi/timeout   :', err);
  if (lat.length) console.log('Độ trễ (ms)   : p50', pct(lat, 50).toFixed(0), '· p95', pct(lat, 95).toFixed(0), '· p99', pct(lat, 99).toFixed(0), '· max', Math.max(...lat).toFixed(0));
  console.log('──────────────────────────────────────────');
  if (pct(lat, 95) > 800) console.log('⚠ p95 > 800ms → cân nhắc thêm cache/index hoặc tăng tài nguyên máy chủ.');
  if (total && err / total > 0.01) console.log('⚠ Lỗi > 1% → xem logs/error-*.log của backend.');
  console.log('');
})();
