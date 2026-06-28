import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';

// Cờ công khai (mặc định TẮT = tính năng chưa triển khai)
const PUBLIC_FLAGS = ['services_live'];
export const flagsRouter = Router();

flagsRouter.get('/', async (_req, res) => {
  try {
    const { rows } = await query('SELECT key FROM app_flags');
    const set = new Set((rows as any[]).map((r) => r.key));
    const flags: Record<string, boolean> = {};
    for (const k of PUBLIC_FLAGS) flags[k] = set.has(k);
    res.json({ flags });
  } catch { res.json({ flags: {} }); }
});

flagsRouter.post('/', adminRequired, async (req, res) => {
  const { key, on } = req.body || {};
  if (!PUBLIC_FLAGS.includes(key)) return res.status(400).json({ error: 'Cờ không hợp lệ' });
  if (on) await query('INSERT INTO app_flags (key) VALUES ($1) ON CONFLICT DO NOTHING', [key]);
  else await query('DELETE FROM app_flags WHERE key=$1', [key]);
  res.json({ ok: true, key, on: !!on });
});
