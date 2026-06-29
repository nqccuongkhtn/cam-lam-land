import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';
import { cached, cachePut, cacheDrop } from '../lib/cache.ts';

// Kho cấu hình key-value đơn giản (quảng cáo trang tin tức, v.v.). Chỉ cho phép các key trong danh sách.
const KEYS = ['tintuc_ad'];
export const configRouter = Router();

configRouter.get('/:key', async (req, res) => {
  const key = req.params.key;
  if (!KEYS.includes(key)) return res.status(404).json({ value: null });
  const ck = 'config:' + key;
  const hit = cached<any>(ck);
  if (hit !== undefined) { res.set('Cache-Control', 'public, max-age=60'); return res.json({ value: hit }); }
  try {
    const rows = await query<{ value: any }>('SELECT value FROM app_config WHERE key=$1', [key]);
    const value = rows[0]?.value ?? null;
    cachePut(ck, value, 60000);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ value });
  } catch { res.json({ value: null }); }
});

configRouter.post('/:key', adminRequired, async (req, res) => {
  const key = req.params.key;
  if (!KEYS.includes(key)) return res.status(400).json({ error: 'Key không hợp lệ' });
  const value = req.body?.value ?? {};
  await query(
    `INSERT INTO app_config (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)]);
  cacheDrop('config:' + key);
  res.json({ ok: true });
});
