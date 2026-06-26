import express from 'express';
import cors from 'cors';
import compression from 'compression';
import http from 'node:http';
import { WebSocketServer } from 'ws';
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
import { notFound, errorHandler } from './middleware/error.ts';

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', region: 'Cam Lâm, Khánh Hòa', ts: Date.now() }));
app.use('/api/auth', authRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/layers', layersRouter);
app.use('/api/parcels', parcelsRouter);
app.use('/api/imports', importsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/qr', qrRouter);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);

// Optional: WebSocket channel for live map updates (broadcast hook).
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', region: 'Cam Lâm' }));
});
export const broadcast = (msg: unknown) => {
  const data = JSON.stringify(msg);
  wss.clients.forEach((c) => c.readyState === 1 && c.send(data));
};

async function main() {
  await waitForDb();
  if (process.env.BOOTSTRAP_DB === 'true') await bootstrap();
  await migrate();
  await ensureAdmin();
  server.listen(env.port, () => console.log(`[backend] API + WS listening on :${env.port}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
