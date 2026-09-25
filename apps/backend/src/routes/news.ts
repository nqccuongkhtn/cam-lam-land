import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';

export const newsRouter = Router();

// Nguồn uy tín — chuyên mục Bất động sản (RSS)
const SOURCES = [
  { name: 'VnExpress', url: 'https://vnexpress.net/rss/bat-dong-san.rss' },
  { name: 'CafeF', url: 'https://cafef.vn/bat-dong-san.rss' },
  { name: 'Báo Xây dựng', url: 'https://baoxaydung.com.vn/rss/bat-dong-san.rss' },
  { name: 'Reatimes', url: 'https://reatimes.vn/rss' },
];
// Bỏ tin tiêu cực — chỉ giữ tin tích cực / trung lập
const BAD = /(lừa đảo|vỡ nợ|phá sản|siết nợ|tranh chấp|khởi tố|khởi kiện|kiện tụng|bắt giam|lao dốc|bán tháo|nợ xấu|đóng băng|ế ẩm|sụt giảm|giảm mạnh|thổi giá|bong bóng|chiếm đoạt|cảnh báo sốt|trục lợi)/i;

// Bảng entity TÊN hay gặp ở RSS báo tiếng Việt (entity SỐ thập phân/hex xử lý bằng regex bên dưới).
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', deg: '°', middot: '·', bull: '•', euro: '€', times: '×', divide: '÷', agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý', yuml: 'ÿ', ntilde: 'ñ', ccedil: 'ç', Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Igrave: 'Ì', Iacute: 'Í', Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ugrave: 'Ù', Uacute: 'Ú', Yacute: 'Ý', Ntilde: 'Ñ', Ccedil: 'Ç' };
// Giải mã ĐẦY ĐỦ: CDATA + entity SỐ (thập phân & hex — gồm ký tự tiếng Việt như &#7879;) + entity TÊN (&aacute; ...).
const decode = (s: string): string => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => { const n = parseInt(h, 16); return n > 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : m; })
  .replace(/&#(\d+);/g, (m, d) => { const n = parseInt(d, 10); return n > 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : m; })
  .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (m, name) => (Object.prototype.hasOwnProperty.call(NAMED, name) ? NAMED[name] : m))
  .trim();
const strip = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// Ảnh RÁC/không phải ảnh bài: logo, icon, avatar, pixel theo dõi, spacer, quảng cáo…
const JUNK_IMG = /(logo|icon|avatar|sprite|spacer|blank|pixel|1x1|beacon|tracking|placeholder|gravatar|doubleclick|\/ads?[\/_.]|\.svg(\?|$))/i;
const goodImg = (u?: string | null): string | null => {
  if (!u) return null;
  const url = decode(String(u)).trim();
  if (!/^https?:\/\//i.test(url)) return null; // bỏ data: và đường dẫn tương đối
  if (JUNK_IMG.test(url)) return null;
  return url;
};
// Chọn ảnh ĐẠI DIỆN: ưu tiên ảnh feed CHỈ ĐỊNH (media:content lớn nhất → thumbnail → enclosure),
// vì <img> đầu trong mô tả hay là logo/ảnh bài liên quan/quảng cáo → để CUỐI. Lấy ứng viên "sạch" đầu tiên.
function pickImage(item: string, desc: string): string | null {
  const cands: (string | undefined)[] = [];
  const media = [...item.matchAll(/<media:content\b[^>]*\burl=["']([^"']+)["'][^>]*>/gi)]
    .map((m) => ({ url: m[1], w: Number((m[0].match(/\bwidth=["']?(\d+)/) || [])[1] || 0) }))
    .sort((a, b) => b.w - a.w);
  for (const m of media) cands.push(m.url);
  cands.push((item.match(/<media:thumbnail\b[^>]*\burl=["']([^"']+)["']/i) || [])[1]);
  cands.push((item.match(/<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*type=["']image/i) || [])[1]);
  for (const m of desc.matchAll(/<img[^>]+src=["']?([^"' >]+)/gi)) cands.push(m[1]); // kém tin cậy nhất
  for (const c of cands) { const g = goodImg(c); if (g) return g; }
  return null;
}

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
    const img = pickImage(b, desc);
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
  // Giữ tin 30 ngày rồi mới xoá (chủ dự án dặn 25/9/2026; trước giữ 80 bài mới nhất bất kể ngày).
  await query(`DELETE FROM news WHERE published_at < now() - interval '30 days'`).catch(() => {});
  return n;
}

newsRouter.get('/', async (_req, res) => {
  try {
    const rows = await query(`SELECT id, title, url, source, image, summary, published_at AS "publishedAt" FROM news ORDER BY published_at DESC LIMIT 12`);
    res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=1800');
    res.json({ news: rows });
  } catch { res.json({ news: [] }); }
});

newsRouter.post('/refresh', adminRequired, async (_req, res) => {
  try { const n = await refreshNews(true); res.json({ ok: true, count: n }); }
  catch (e: any) { res.status(500).json({ error: e?.message || 'Lỗi' }); }
});

newsRouter.get('/:id', async (req, res) => {
  try {
    const [row] = await query(`SELECT id, title, url, source, image, summary, published_at AS "publishedAt" FROM news WHERE id=$1`, [Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    res.set('Cache-Control', 'public, max-age=600');
    res.json(row);
  } catch { res.status(404).json({ error: 'Không tìm thấy bài viết' }); }
});
