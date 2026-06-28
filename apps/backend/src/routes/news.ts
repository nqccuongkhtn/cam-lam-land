import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';

export const newsRouter = Router();

// Nguồn uy tín — chuyên mục Bất động sản (RSS)
const SOURCES = [
  { name: 'VnExpress', url: 'https://vnexpress.net/rss/bat-dong-san.rss' },
  { name: 'CafeF', url: 'https://cafef.vn/bat-dong-san.rss' },
  { name: 'Báo Xây dựng', url: 'https://baoxaydung.com.vn/rss/bat-dong-san.rss' },
];
// Bỏ tin tiêu cực — chỉ giữ tin tích cực / trung lập
const BAD = /(lừa đảo|vỡ nợ|phá sản|siết nợ|tranh chấp|khởi tố|bắt giam|lao dốc|bán tháo|nợ xấu|đóng băng|ế ẩm|sụt giảm|giảm mạnh|thổi giá|bong bóng|chiếm đoạt|cảnh báo|kiện|tù|án)/i;

const decode = (s: string): string => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").trim();
const strip = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

async function fetchSource(src: { name: string; url: string }): Promise<any[]> {
  const res = await fetch(src.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CamLamLand/1.0)' }, signal: AbortSignal.timeout(9000) });
  if (!res.ok) return [];
  const xml = await res.text();
  const out: any[] = [];
  for (const m of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15)) {
    const b = m[1];
    const title = decode((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const link = decode((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
    const desc = decode((b.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '');
    const pub = decode((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '');
    const img = (desc.match(/<img[^>]+src=["']?([^"' >]+)/) || [])[1] || null;
    const d = pub ? new Date(pub) : new Date();
    if (!title || !link || isNaN(d.getTime())) continue;
    if (BAD.test(title)) continue;
    out.push({ title, url: link, source: src.name, image: img, summary: strip(desc).slice(0, 220), published_at: d });
  }
  return out;
}

let lastRefresh = 0;
export async function refreshNews(force = false): Promise<number> {
  if (!force && Date.now() - lastRefresh < 60 * 60 * 1000) return 0;
  lastRefresh = Date.now();
  let n = 0;
  for (const src of SOURCES) {
    try {
      for (const it of await fetchSource(src)) {
        await query(
          `INSERT INTO news (title, url, source, image, summary, published_at) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (url) DO UPDATE SET title=EXCLUDED.title, image=COALESCE(EXCLUDED.image, news.image), summary=EXCLUDED.summary`,
          [it.title, it.url, it.source, it.image, it.summary, it.published_at]);
        n++;
      }
    } catch { /* nguồn lỗi -> bỏ qua, dùng nguồn khác */ }
  }
  await query(`DELETE FROM news WHERE id NOT IN (SELECT id FROM news ORDER BY published_at DESC LIMIT 80)`).catch(() => {});
  return n;
}

newsRouter.get('/', async (_req, res) => {
  try {
    const rows = await query(`SELECT title, url, source, image, summary, published_at AS "publishedAt" FROM news ORDER BY published_at DESC LIMIT 12`);
    res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=1800');
    res.json({ news: rows });
  } catch { res.json({ news: [] }); }
});

newsRouter.post('/refresh', adminRequired, async (_req, res) => {
  try { const n = await refreshNews(true); res.json({ ok: true, count: n }); }
  catch (e: any) { res.status(500).json({ error: e?.message || 'Lỗi' }); }
});
