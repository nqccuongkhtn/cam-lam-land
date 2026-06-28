import { NextResponse } from 'next/server';

// Lấy tin BĐS từ nguồn uy tín NGAY TRONG FRONTEND (server-side) — không cần backend.
export const dynamic = 'force-dynamic';

const SOURCES = [
  { name: 'VnExpress', url: 'https://vnexpress.net/rss/bat-dong-san.rss' },
  { name: 'CafeF', url: 'https://cafef.vn/bat-dong-san.rss' },
  { name: 'Báo Xây dựng', url: 'https://baoxaydung.com.vn/rss/bat-dong-san.rss' },
];
// Bỏ tin tiêu cực — chỉ giữ tin tích cực / trung lập
const BAD = /(lừa đảo|vỡ nợ|phá sản|siết nợ|tranh chấp|khởi tố|khởi kiện|kiện tụng|bắt giam|lao dốc|bán tháo|nợ xấu|đóng băng|ế ẩm|sụt giảm|giảm mạnh|thổi giá|bong bóng|chiếm đoạt|cảnh báo sốt|trục lợi)/i;

const decode = (s: string): string => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").trim();
const strip = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

async function fetchSource(src: { name: string; url: string }): Promise<any[]> {
  const res = await fetch(src.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CamLamLand/1.0)' }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
  if (!res.ok) return [];
  const xml = await res.text();
  const out: any[] = [];
  for (const m of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15)) {
    const b = m[1];
    const title = decode((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const link = decode((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
    const desc = decode((b.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '');
    const pub = decode((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '');
    const image = (desc.match(/<img[^>]+src=["']?([^"' >]+)/) || [])[1] || null;
    const d = pub ? new Date(pub) : new Date();
    if (!title || !link || isNaN(d.getTime()) || BAD.test(title)) continue;
    const item = { title, url: link, source: src.name, image, summary: strip(desc).slice(0, 240), publishedAt: d.toISOString() };
    out.push({ ...item, slug: Buffer.from(JSON.stringify(item), 'utf8').toString('base64url') });
  }
  return out;
}

let cache: { at: number; items: any[] } = { at: 0, items: [] };

export async function GET() {
  if (cache.items.length && Date.now() - cache.at < 30 * 60 * 1000)
    return NextResponse.json({ news: cache.items });
  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const all: any[] = [];
  for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
  const seen = new Set<string>();
  const items = all
    .filter((a) => { if (seen.has(a.url)) return false; seen.add(a.url); return true; })
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .slice(0, 12);
  if (items.length) cache = { at: Date.now(), items };
  return NextResponse.json({ news: items.length ? items : cache.items });
}
