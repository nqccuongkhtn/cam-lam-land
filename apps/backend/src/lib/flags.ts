import { query } from './db.ts';

// gioi_han_thiet_bi: lib/thietBi.ts · tat_tu_tao_khoa: CÔNG TẮC TẮT NHANH việc tự tạo khoá Face ID sau đăng nhập mật khẩu
// (routes/passkey.ts mục 1b) — bật cờ này = TẮT tự tạo (mặc định không có cờ = đang chạy).
export const PUBLIC_FLAGS = ['services_live', 'gioi_han_thiet_bi', 'tat_tu_tao_khoa'];

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
