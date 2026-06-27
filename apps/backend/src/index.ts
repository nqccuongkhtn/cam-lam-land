import express from 'express';
import cors from 'cors';
import compression from 'compression';
import http from 'node:http';
import { initWs } from './lib/ws.ts';
import { env } from './lib/env.ts';
import { waitForDb } from './lib/db.ts';
import { ensureAdmin } from './lib/ensureAdmin.ts';
import { bootstrap } from './lib/bootstrap.ts';
import { migrate } from './lib/migrate.ts';
import { authRouter } from './routes/auth.ts';
import { listingsRouter } from './routes/listings.ts';
import { layersRouter } from './routes/layers.ts';
import { parcelsRouter } from './routes/parcels.ts';
import { importsRouter } from './routes/imports.ts';
import { imagesRouter } from './routes/images.ts';
import { adminRouter } from './routes/admin.ts';
import { qrRouter } from './routes/qr.ts';
import { mapAdsRouter } from './routes/mapAds.ts';
import { consignmentsRouter } from './routes/consignments.ts';
import { chatRouter } from './routes/chat.ts';
import { notFound, errorHandler } from './middleware/error.ts';

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', region: 'Cam Lâm, Khánh Hòa', ts: Date.now() }));
app.get('/api/config', (_req, res) => {
  const ext = process.env.RENDER_EXTERNAL_URL || '';
  const host = ext.replace(/^https?:\/\//, '');
  res.json({ wsUrl: host ? `wss://${host}/ws` : '' });
});
app.use('/api/auth', authRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/layers', layersRouter);
app.use('/api/parcels', parcelsRouter);
app.use('/api/imports', importsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/qr', qrRouter);
app.use('/api/map-ads', mapAdsRouter);
app.use('/api/consignments', consignmentsRouter);
app.use('/api/chat', chatRouter);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
initWs(server);

async function main() {
  await waitForDb();
  if (process.env.BOOTSTRAP_DB === 'true') await bootstrap();
  await migrate();
  await ensureAdmin();
  server.listen(env.port, () => console.log(`[backend] API + WS listening on :${env.port}`));

  // Keep-warm: tự ping để Render (gói free) không "ngủ" → tránh cold-start 500 khi đăng nhập.
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    const ping = () => fetch(`${selfUrl.replace(/\/+$/, '')}/api/health`).then(() => {}).catch(() => {});
    setInterval(ping, 10 * 60 * 1000); // mỗi 10 phút (< 15 phút Render mới cho ngủ)
    console.log(`[keepwarm] tự ping ${selfUrl}/api/health mỗi 10 phút (chống ngủ)`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
