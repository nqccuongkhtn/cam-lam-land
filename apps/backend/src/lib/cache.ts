// Cache phản hồi trong bộ nhớ (TTL ngắn) — dồn nhiều lượt đọc giống nhau thành 1 truy vấn DB.
type Entry = { exp: number; val: any };
const store = new Map<string, Entry>();

export function cached<T = any>(key: string): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (e.exp < Date.now()) { store.delete(key); return undefined; }
  return e.val as T;
}
export function cachePut(key: string, val: any, ttlMs: number): void {
  store.set(key, { exp: Date.now() + ttlMs, val });
  if (store.size > 1000) { const now = Date.now(); for (const [k, v] of store) if (v.exp < now) store.delete(k); }
}
export function cacheDrop(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
