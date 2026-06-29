import { NextResponse } from 'next/server';

// Lấy tin BĐS từ nguồn uy tín, AI viết lại thành nội dung riêng, lưu 7 ngày, làm mới mỗi 2 giờ.
export const dynamic = 'force-dynamic';

const SOURCES = [
  { name: 'VnExpress', url: 'https://vnexpress.net/rss/bat-dong-san.rss' },
  { name: 'CafeF', url: 'https://cafef.vn/bat-dong-san.rss' },
  { name: 'Báo Xây dựng', url: 'https://baoxaydung.com.vn/rss/bat-dong-san.rss' },
];
const BAD = /(lừa đảo|vỡ nợ|phá sản|siết nợ|tranh chấp|khởi tố|khởi kiện|kiện tụng|bắt giam|lao dốc|bán tháo|nợ xấu|đóng băng|ế ẩm|sụt giảm|giảm mạnh|thổi giá|bong bóng|chiếm đoạt|cảnh báo sốt|trục lợi)/i;

const decode = (s: string): string => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").trim();
const strip = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const vnSlug = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
const shortHash = (s: string): string => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(36); };

// ── AI viết lại: ưu tiên Gemini (MIỄN PHÍ - GEMINI_API_KEY), nếu không thì dùng Claude (ANTHROPIC_API_KEY). Không có key nào thì để tóm tắt nguồn. ──
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const AI_KEY = process.env.ANTHROPIC_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';
const newsPrompt = (title: string, summary: string): string => `Bạn là biên tập viên bất động sản của Cam Lâm Land. Viết MỘT BÀI tổng hợp - phân tích 3-4 đoạn (khoảng 250-400 chữ) bằng tiếng Việt, văn phong báo chí riêng, mạch lạc, KHÔNG sao chép nguyên văn nguồn. Đoạn đầu nêu thông tin/sự kiện chính. Các đoạn sau phân tích ý nghĩa, bối cảnh thị trường bất động sản, và nếu phù hợp thì liên hệ khu vực Cam Lâm - Khánh Hòa. TUYỆT ĐỐI KHÔNG bịa thêm số liệu hay sự kiện cụ thể không có trong nguồn; phần phân tích chỉ mang tính nhận định chung. Cách các đoạn bằng MỘT DÒNG TRỐNG. Không thêm tiêu đề, không mở đầu kiểu "Tóm tắt:".\n\nTiêu đề: ${title}\nThông tin nguồn: ${summary}`;

async function rewrite(title: string, summary: string): Promise<string | null> {
  const prompt = newsPrompt(title, summary);
  // 1) Gemini (miễn phí)
  if (GEMINI_KEY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1024, temperature: 0.7 } }),
        signal: AbortSignal.timeout(18000),
      });
      if (res.ok) { const j: any = await res.json(); const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim(); if (txt) return txt; }
    } catch { /* lỗi -> thử Claude / bỏ qua */ }
  }
  // 2) Claude (trả phí)
  if (AI_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: AI_MODEL, max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(18000),
      });
      if (res.ok) { const j: any = await res.json(); const txt = j?.content?.[0]?.text?.trim(); if (txt) return txt; }
    } catch { /* bỏ qua */ }
  }
  return null;
}

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
    out.push({ title, url: link, source: src.name, image, summary: strip(desc).slice(0, 600), publishedAt: d.toISOString() });
  }
  return out;
}

// Kho lưu trong tiến trình: tích luỹ & giữ 7 ngày
let store: any[] = [];
let lastSlot = -1;

// Mốc làm mới: mỗi 2 giờ trong khung 6h–22h (giờ VN). Ngoài khung đó giữ bản 22h, không cập nhật.
function slotStart(): number {
  const vn = new Date(Date.now() + 7 * 3600 * 1000);
  let h = vn.getUTCHours();
  let dayOffset = 0;
  if (h < 6) { h = 22; dayOffset = -1; }
  else if (h >= 22) { h = 22; }
  else { h = h - (h % 2); }
  return Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + dayOffset, h) - 7 * 3600 * 1000;
}

export async function GET() {
  const slot = slotStart();
  if (store.length && lastSlot === slot) return NextResponse.json({ news: store });

  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const fetched: any[] = [];
  for (const r of results) if (r.status === 'fulfilled') fetched.push(...r.value);

  const byUrl = new Map<string, any>(store.map((a) => [a.url, a]));
  const fresh = fetched.filter((a) => !byUrl.has(a.url));
  await Promise.allSettled(fresh.map(async (a) => {
    a.body = (await rewrite(a.title, a.summary)) || a.summary;
    a.slug = `${vnSlug(a.title) || 'tin'}-${shortHash(a.url)}`;
  }));
  for (const a of fresh) byUrl.set(a.url, a);

  const weekAgo = Date.now() - 7 * 86400000;
  store = [...byUrl.values()]
    .filter((a) => a.slug && +new Date(a.publishedAt) >= weekAgo)
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .slice(0, 60);
  if (fetched.length) lastSlot = slot;

  return NextResponse.json({ news: store });
}
