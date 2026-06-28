import { query } from './db.ts';

export const PUBLIC_FLAGS = ['services_live'];

export async function isFlagOn(key: string): Promise<boolean> {
  try { const rows = await query('SELECT 1 FROM app_flags WHERE key=$1', [key]); return rows.length > 0; }
  catch { return false; }
}

export async function allFlags(): Promise<Record<string, boolean>> {
  try {
    const rows = await query<{ key: string }>('SELECT key FROM app_flags');
    const set = new Set(rows.map((r) => r.key));
    const f: Record<string, boolean> = {};
    for (const k of PUBLIC_FLAGS) f[k] = set.has(k);
    return f;
  } catch { return {}; }
}
