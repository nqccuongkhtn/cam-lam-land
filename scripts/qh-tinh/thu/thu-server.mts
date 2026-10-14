// MÁY CHỦ THỬ (chỉ để chụp ảnh chờ duyệt, KHÔNG phải web thật): /api/parcels chạy MÃ MỚI (src_moi gắn từ máy),
// mọi yêu cầu khác chuyển nguyên sang web thật qua nginx. Không chạy việc nền nào (không nhắc lịch, không cào tin…).
import express from 'express';
import { parcelsRouter } from '/app/apps/backend/src_moi/routes/parcels.ts';
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));
app.use('/api/parcels', parcelsRouter);
app.use(async (req, res) => {
  try {
    const h: Record<string, string> = {};
    for (const k of ['authorization', 'cookie', 'user-agent', 'accept', 'content-type']) if (req.headers[k]) h[k] = String(req.headers[k]);
    const r = await fetch('http://nginx' + req.originalUrl, { method: req.method, headers: h,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}) });
    res.status(r.status);
    r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'connection', 'content-length'].includes(k)) res.setHeader(k, v); });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e: any) { res.status(502).end(String(e?.message || e)); }
});
app.listen(4001, () => console.log('thu-api :4001'));
