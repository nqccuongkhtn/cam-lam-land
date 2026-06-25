import { Router } from 'express';

export const qrRouter = Router();

// Only allow proxying the official VBĐLIS lookup domain
const ALLOW = ['vbdlis.vn'];

// GET /api/qr/proxy?url=...  — server-side fetch of a vbdlis QR result (avoids browser CORS)
qrRouter.get('/proxy', async (req, res, next) => {
  try {
    const url = String(req.query.url || '');
    let u: URL;
    try { u = new URL(url); } catch { return res.status(400).json({ error: 'URL không hợp lệ' }); }
    if (!ALLOW.some((d) => u.hostname === d || u.hostname.endsWith('.' + d)))
      return res.status(400).json({ error: 'Chỉ cho phép tra cứu trên vbdlis.vn' });
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CamLamLand/1.0)' },
      signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(15000) : undefined,
    });
    const html = await r.text();
    res.json({ ok: r.ok, status: r.status, url, html: html.slice(0, 400000) });
  } catch (e: any) {
    res.status(502).json({ error: 'Không truy cập được vbdlis: ' + (e?.message || String(e)) });
  }
});
