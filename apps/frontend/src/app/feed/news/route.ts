import { NextResponse } from 'next/server';

// Lấy tin BĐS từ nguồn uy tín, tải NGUYÊN bài gốc + ảnh, AI viết lại thành bài đầy đủ (độ dài ~ bài gốc), lưu 7 ngày, làm mới mỗi 2 giờ.
export const dynamic = 'force-dynamic';

const SOURCES = [
  { name: 'Báo Khánh Hòa', url: 'https://baokhanhhoa.vn/rss/kinh-te.rss', local: true, re: true },
  { name: 'VnExpress', url: 'https://vnexpress.net/rss/bat-dong-san.rss' },
  { name: 'CafeF', url: 'https://cafef.vn/bat-dong-san.rss' },
  { name: 'Báo Xây dựng', url: 'https://baoxaydung.com.vn/rss/bat-dong-san.rss' },
];
const BAD = /(lừa đảo|vỡ nợ|phá sản|siết nợ|tranh chấp|khởi tố|khởi kiện|kiện tụng|bắt giam|lao dốc|bán tháo|nợ xấu|đóng băng|ế ẩm|sụt giảm|giảm mạnh|thổi giá|bong bóng|chiếm đoạt|cảnh báo sốt|trục lợi)/i;
// Tin thuộc thị trường Khánh Hòa -> ưu tiên hiển thị trước
const LOCAL = /(Khánh\s*Hòa|Khanh\s*Hoa|Cam\s*Lâm|Cam\s*Lam|Nha\s*Trang|Cam\s*Ranh|Bãi\s*Dài|Bai\s*Dai|Vạn\s*Ninh|Ninh\s*Hòa|Diên\s*Khánh|Cam\s*Đức|Cam\s*Hải)/i;
// Lọc tin liên quan BĐS (áp dụng cho nguồn báo địa phương tổng hợp như Báo Khánh Hòa)
const RE = /(bất động sản|nhà đất|đất nền|đất ở|căn hộ|chung cư|biệt thự|nhà phố|liền kề|quy hoạch|dự án|đô thị|hạ tầng|khu công nghiệp|đấu giá|sổ đỏ|mặt bằng|thổ cư|ven biển|sân bay|cao tốc|tái định cư|đầu tư|giải phóng mặt bằng)/i;

const decode = (s: string): string => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').trim();
const strip = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const vnSlug = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
const shortHash = (s: string): string => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(36); };

// ── AI viết lại: ưu tiên Gemini (MIỄN PHÍ - GEMINI_API_KEY), nếu không thì Claude (ANTHROPIC_API_KEY). Không có key nào thì để tóm tắt nguồn. ──
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const AI_KEY = process.env.ANTHROPIC_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';
const NO_THINK = /(^|[^0-9])(2\.5|3\.)/.test(GEMINI_MODEL) || GEMINI_MODEL.includes('flash-latest') || GEMINI_MODEL.includes('pro-latest');
let lastErr: string | null = null;

const newsPrompt = (title: string, full: string): string => `Bạn là biên tập viên bất động sản của Cam Lâm Land. Hãy viết lại bài báo dưới đây thành MỘT BÀI HOÀN CHỈNH bằng tiếng Việt, văn phong báo chí, mạch lạc.

YÊU CẦU:
- Độ dài tương đương khoảng 80% bài gốc, chia thành NHIỀU đoạn (mỗi đoạn cách nhau MỘT DÒNG TRỐNG).
- Giữ ĐẦY ĐỦ các ý chính, sự kiện, địa danh và SỐ LIỆU CÓ THẬT trong bài gốc.
- DIỄN ĐẠT LẠI bằng câu chữ riêng, KHÔNG sao chép nguyên văn từng câu của bài gốc.
- TUYỆT ĐỐI KHÔNG bịa thêm số liệu/sự kiện không có trong bài gốc.
- Không thêm tiêu đề, không mở đầu kiểu "Tóm tắt:" hay "Bài viết:".

Tiêu đề: ${title}

NỘI DUNG BÀI GỐC:
${full}`;

async function rewrite(title: string, full: string): Promise<string | null> {
  const prompt = newsPrompt(title, full);
  if (GEMINI_KEY) {
    try {
      const genCfg: any = { maxOutputTokens: 4096, temperature: 0.7 };
      if (NO_THINK) genCfg.thinkingConfig = { thinkingBudget: 0 };
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: genCfg }),
        signal: AbortSignal.timeout(28000),
      });
      if (res.ok) {
        const j: any = await res.json();
        const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (txt) { lastErr = null; return txt; }
        lastErr = 'Gemini trả rỗng (finishReason=' + (j?.candidates?.[0]?.finishReason || '?') + ')';
      } else {
        lastErr = 'Gemini HTTP ' + res.status + ': ' + (await res.text().catch(() => '')).slice(0, 200);
      }
    } catch (e: any) { lastErr = 'Gemini lỗi: ' + (e?.message || String(e)); }
  } else {
    lastErr = 'Chưa cấu hình GEMINI_API_KEY';
  }
  if (AI_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: AI_MODEL, max_tokens: 2200, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(28000),
      });
      if (res.ok) { const j: any = await res.json(); const txt = j?.content?.[0]?.text?.trim(); if (txt) { lastErr = null; return txt; } }
      else { lastErr = 'Claude HTTP ' + res.status; }
    } catch (e: any) { lastErr = 'Claude lỗi: ' + (e?.message || String(e)); }
  }
  return null;
}

// Lọc ảnh sạch (bỏ logo/icon/quảng cáo/ảnh "vận hành bởi"...).
const cleanImg = (u: string): boolean => /^https?:\/\//i.test(u) && /\.(jpe?g|png|webp)(\?|$)/i.test(u) && !/(logo|icon|avatar|sprite|banner|advert|quang-?cao|vccorp|operate|share|placeholder|default|blank|pixel|1x1|skin|template|thumb-?fb)/i.test(u);
// Bỏ dòng chú thích ảnh ("... Ảnh: Vinhomes", "Nguồn: ...") còn sót trong nội dung.
const dropCaptions = (text: string): string => text.split(/\n{2,}/).map((p) => p.trim()).filter((t) => t && !/[Ảả]nh\s*:\s*\S/.test(t) && !/^\(?\s*[Ảả]nh\b/.test(t) && !/^[Nn]guồn\s*:\s*\S/.test(t)).join('\n\n');
// Bỏ ảnh TRÙNG (cùng tấm khác kích thước) bằng tên ảnh đã chuẩn hoá.
const imgKey = (u: string): string => {
  let x = u.split('?')[0].split('#')[0].toLowerCase();
  x = x.substring(x.lastIndexOf('/') + 1).replace(/\.(jpe?g|png|webp)$/i, '');
  x = x.replace(/[-_](w|h|r|s)?\d{2,4}(x\d{2,4})?$/i, '').replace(/[-_]\d{2,4}x\d{2,4}/i, '');
  return x || u;
};
const dedupeImages = (urls: string[]): string[] => {
  const seen = new Set<string>(); const out: string[] = [];
  for (const u of urls) { const k = imgKey(u); if (!seen.has(k)) { seen.add(k); out.push(u); } }
  return out;
};

// Tải nguyên trang bài gốc: khoanh vùng nội dung, cắt chân trang, trích các đoạn <p> + 1 ảnh sạch.
async function fetchArticle(url: string): Promise<{ text: string; images: string[] }> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CamLamLand/1.0)' }, signal: AbortSignal.timeout(9000), cache: 'no-store' });
    if (!res.ok) return { text: '', images: [] };
    let html = await res.text();
    html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<header[\s\S]*?<\/header>/gi, ' ').replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
    let scope = (html.match(/<article[\s\S]*?<\/article>/i) || [])[0];
    if (!scope) { const m = html.match(/<div[^>]+(?:id|class)=["'][^"']*(detail-content|article-body|fck_detail|contentdetail|news-content|main-?content|entry-content|the-article-body|content_detail)[^"']*["'][\s\S]*$/i); scope = m ? m[0] : html; }
    const cut = scope.search(/Vận hành bởi|VCCorp|class=["'][^"']*(relate|relation|footer|tag-list|share|box-category|comment|widget)/i);
    if (cut > 600) scope = scope.slice(0, cut);
    const images: string[] = [];
    for (const m of scope.matchAll(/<img[^>]+>/gi)) {
      const src = (m[0].match(/(?:data-src|data-original|src)=["']([^"' ]+)/i) || [])[1];
      if (src && cleanImg(src)) images.push(src);
    }
    const paras: string[] = [];
    for (const m of scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const t = strip(decode(m[1]));
      if (t.length >= 45 && !/^(theo |nguồn|ảnh\s*:|video\s*:|xem thêm|đọc thêm|>>)/i.test(t) && !/[Ảả]nh\s*:\s*\S/.test(t) && !/^[Nn]guồn\s*:\s*\S/.test(t)) paras.push(t);
    }
    return { text: paras.join('\n\n').slice(0, 7000), images: Array.from(new Set(images)).slice(0, 6) };
  } catch { return { text: '', images: [] }; }
}

async function fetchSource(src: { name: string; url: string; local?: boolean; re?: boolean }): Promise<any[]> {
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
    const sm = strip(desc);
    if (src.re && !RE.test(title + ' ' + sm)) continue; // nguồn tổng hợp -> chỉ lấy tin BĐS
    out.push({ title, url: link, source: src.name, image, summary: sm.slice(0, 600), publishedAt: d.toISOString(), local: !!src.local || LOCAL.test(title + ' ' + sm) });
  }
  return out;
}

// Kho lưu trong tiến trình: tích luỹ & giữ 7 ngày
let store: any[] = [];
let lastSlot = -1;
const FRESH_CAP = 14; // số bài mới tải+viết lại mỗi lần làm mới (kiểm soát chi phí/độ trễ)

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

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('diag') === '1') {
    const sample = await rewrite('Kiểm tra hệ thống tin tức', 'Hạ tầng giao thông khu vực Cam Lâm, Khánh Hòa đang được đầu tư phát triển mạnh, với nhiều dự án đường ven biển và kết nối sân bay Cam Ranh.');
    return NextResponse.json({
      hasGeminiKey: !!GEMINI_KEY, geminiModel: GEMINI_MODEL, disableThinking: NO_THINK, hasClaudeKey: !!AI_KEY,
      stored: store.length, testRewriteOk: !!sample, testRewriteLen: sample ? sample.length : 0,
      testRewritePreview: sample ? sample.slice(0, 300) : null, lastError: lastErr,
    });
  }

  const slot = slotStart();
  if (store.length && lastSlot === slot) return NextResponse.json({ news: store });

  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const fetched: any[] = [];
  for (const r of results) if (r.status === 'fulfilled') fetched.push(...r.value);

  const byUrl = new Map<string, any>(store.map((a) => [a.url, a]));
  const fresh = fetched.filter((a) => !byUrl.has(a.url)).slice(0, FRESH_CAP);
  await Promise.allSettled(fresh.map(async (a) => {
    const art = await fetchArticle(a.url);
    const full = art.text && art.text.length > 200 ? art.text : (a.summary || a.title);
    a.body = dropCaptions((await rewrite(a.title, full)) || full);
    const imgs = dedupeImages([a.image, ...art.images].filter((u): u is string => !!u && cleanImg(u))).slice(0, 3);
    a.images = imgs;
    a.image = imgs[0] || null;
    a.slug = `${vnSlug(a.title) || 'tin'}-${shortHash(a.url)}`;
  }));
  for (const a of fresh) byUrl.set(a.url, a);

  const weekAgo = Date.now() - 7 * 86400000;
  store = [...byUrl.values()]
    .filter((a) => a.slug && +new Date(a.publishedAt) >= weekAgo)
    .sort((a, b) => (b.local ? 1 : 0) - (a.local ? 1 : 0) || +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .slice(0, 60);
  if (fetched.length) lastSlot = slot;

  return NextResponse.json({ news: store });
}
