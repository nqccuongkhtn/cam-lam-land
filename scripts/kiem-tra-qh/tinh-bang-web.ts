import fs from 'node:fs';
import { computeQhTheoBan } from '/app/apps/backend/src/lib/qhCompute_moi.ts';
import { vn2000ToWgs84 } from '/app/apps/backend/src/lib/vn2000.ts';
const out: any[] = [];
for (const l of fs.readFileSync('/tmp/mau.jsonl', 'utf8').split('\n').filter(Boolean)) {
  const d = JSON.parse(l); if (d.ring.length < 3) continue;
  const r = [...d.ring, d.ring[0]];
  let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][1] * r[i + 1][0] - r[i + 1][1] * r[i][0];
  const dt = Math.abs(a) / 2;
  const ring = r.map(([N, E]: number[]) => { const p = vn2000ToWgs84(E, N); return [p.lng, p.lat]; });
  out.push({ file: d.file, dt: +dt.toFixed(1), ring, ban: d.ban, tach: d.tach || [], web: computeQhTheoBan(ring, dt).map((b) => ({ ma: b.ma, areas: b.areas })) });
}
fs.writeFileSync('/tmp/kq_moi.json', JSON.stringify(out));
