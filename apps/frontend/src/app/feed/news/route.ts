import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Lấy tin BĐS từ nguồn uy tín, tải NGUYÊN bài gốc + ảnh, AI viết lại thành bài đầy đủ (độ dài ~ bài gốc), lưu 30 ngày (tin Khánh Hòa 60 ngày), làm mới mỗi 2 giờ.
export const dynamic = 'force-dynamic';

// Ảnh Bãi Dài Cam Lâm chủ site thả vào public/bai-dai/. Tên có 'hero'/'cam-lam' → TIN ĐẦU TIÊN (luôn trên cùng); còn lại XOAY VÒNG theo ngày.
function baiDaiPool(): { hero: string | null; rest: string[] } {
  try {
    const files = fs.readdirSync(path.join(process.cwd(), 'public', 'bai-dai')).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
    if (!files.length) return { hero: null, rest: [] };
    const heroF = files.find((f) => /hero|cam.?l[aâ]m/i.test(f)) || null;
    return { hero: heroF ? '/bai-dai/' + heroF : null, rest: files.filter((f) => f !== heroF).map((f) => '/bai-dai/' + f) };
  } catch { return { hero: null, rest: [] }; }
}
function applyBaiDai() {
  const { hero, rest } = baiDaiPool();
  const day = Math.floor(Date.now() / 86400000); // xoay vòng theo NGÀY
  PINNED.forEach((a: any, i: number) => {
    if (i === 0 && hero) { a.image = hero; a.images = [hero]; return; }
    if (rest.length) { const img = rest[(i + day) % rest.length]; a.image = img; a.images = [img]; }
  });
}

const SOURCES = [
  // ── Khánh Hòa (địa phương) — ưu tiên "Tin nổi bật"; lọc theo từ khoá BĐS/quy hoạch (re) ──
  { name: 'Báo Khánh Hòa', url: 'https://baokhanhhoa.vn/rss/kinh-te.rss', local: true, re: true },
  { name: 'Báo Khánh Hòa', url: 'https://baokhanhhoa.vn/rss/xa-hoi.rss', local: true, re: true },
  { name: 'Báo Khánh Hòa', url: 'https://baokhanhhoa.vn/rss/cam-lam.rss', local: true, re: true },
  { name: 'Báo Khánh Hòa', url: 'https://baokhanhhoa.vn/rss/quy-hoach-tinh-khanh-hoa.rss', local: true, re: true },
  { name: 'Báo Khánh Hòa', url: 'https://baokhanhhoa.vn/rss/nha-trang.rss', local: true, re: true },
  // ── Bất động sản & xây dựng toàn quốc (bắt tin nhắc Khánh Hòa + tin thị trường) ──
  { name: 'VnExpress', url: 'https://vnexpress.net/rss/bat-dong-san.rss' },
  { name: 'CafeF', url: 'https://cafef.vn/bat-dong-san.rss' },
  { name: 'Báo Xây dựng', url: 'https://baoxaydung.com.vn/rss/bat-dong-san.rss' },
  { name: 'Reatimes', url: 'https://reatimes.vn/rss' },
  { name: 'Dân trí', url: 'https://dantri.com.vn/bat-dong-san.rss' },
  { name: 'Vietnamnet', url: 'https://vietnamnet.vn/rss/bat-dong-san.rss' },
  { name: 'Người Lao Động', url: 'https://nld.com.vn/bat-dong-san.rss' },
  { name: 'Tuổi Trẻ', url: 'https://tuoitre.vn/rss/nha-dat.rss' },
  { name: 'Thanh Niên', url: 'https://thanhnien.vn/rss/dia-oc.rss' },
  { name: 'Tiền Phong', url: 'https://tienphong.vn/rss/dia-oc-142.rss' },
];
const BAD = /(lừa đảo|vỡ nợ|phá sản|siết nợ|tranh chấp|khởi tố|khởi kiện|kiện tụng|bắt giam|lao dốc|bán tháo|nợ xấu|đóng băng|ế ẩm|sụt giảm|giảm mạnh|thổi giá|bong bóng|chiếm đoạt|cảnh báo sốt|trục lợi)/i;
// Lọc tin liên quan BĐS (áp dụng cho nguồn báo địa phương tổng hợp như Báo Khánh Hòa)
const RE = /(bất động sản|nhà đất|đất nền|đất ở|căn hộ|chung cư|biệt thự|nhà phố|liền kề|quy hoạch|dự án|đô thị|hạ tầng|khu công nghiệp|đấu giá|sổ đỏ|mặt bằng|thổ cư|ven biển|sân bay|cao tốc|tái định cư|đầu tư|giải phóng mặt bằng)/i;
// Phân HẠNG ưu tiên vị trí cho mục "Tin nổi bật": Cam Lâm(3) > Cam Ranh/Nha Trang/Ninh Hòa(2) > Khánh Hòa(1) > khác(0).
const T_CAMLAM = /(Cam\s*Lâm|Cam\s*Lam|Cam\s*Đức|Cam\s*Duc|Cam\s*Hải|Cam\s*Hai|Bãi\s*Dài|Bai\s*Dai|Suối\s*Tân|Suoi\s*Tan|Suối\s*Dầu|Cam\s*Hiệp|Cam\s*An|Cam\s*Thành|Cam\s*Phước|Cam\s*Tân|Sơn\s*Tân|Thủy\s*Triều)/i;
const T_NEAR = /(Cam\s*Ranh|Nha\s*Trang|Ninh\s*Hòa|Ninh\s*Hoa)/i;
const T_KH = /(Khánh\s*Hòa|Khanh\s*Hoa|Diên\s*Khánh|Vạn\s*Ninh|Trường\s*Sa|Khánh\s*Sơn|Khánh\s*Vĩnh)/i;
const tierOf = (t: string): number => (T_CAMLAM.test(t) ? 3 : T_NEAR.test(t) ? 2 : T_KH.test(t) ? 1 : 0);

/* ⚠️ PHẢI GIẢI MÃ CẢ KÝ TỰ DẠNG SỐ (&#xE1; &#225;). Báo hay viết tiếng Việt
   kiểu này trong thẻ meta; thiếu bước đó thì bài đăng lên đầy "Ph&#xE1;p
   lu&#x1EAD;t" — đã thấy tận mắt một lần. */
const decode = (s: string): string => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').trim();
const strip = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const vnSlug = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
const shortHash = (s: string): string => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(); }; // đuôi slug = SỐ

// ── AI viết lại: ưu tiên Gemini (MIỄN PHÍ - GEMINI_API_KEY), nếu không thì Claude (ANTHROPIC_API_KEY). Không có key nào thì để tóm tắt nguồn. ──
/* ── Khoá và model của Gemini ────────────────────────────────────────────────
   ⚠️ ĐÃ VẤP: một tấm bài đăng lên chỉ có đúng câu tóm tắt, tưởng lỗi prompt.
   Thật ra là hai chuyện khác:
     1. khoá Gemini chỉ khai cho container BACKEND, còn trang tin chạy trong
        container FRONTEND nên không thấy khoá → bỏ hẳn bước biên tập (đã sửa
        trong docker-compose.yml);
     2. chỉ thử ĐÚNG MỘT model. Gemini hay trả 503 "đang quá tải" — gặp đúng
        lúc đó là bài nào cũng trượt.
   Nay gom mọi khoá khai được và thử LẦN LƯỢT từng model cho tới khi có bài.
   Biến `GEMINI_MODELS` trong .env của dự án đang chứa MỘT KHOÁ chứ không phải
   danh sách model (khai nhầm ô), nên ở đây tự phân loại: giá trị nào có chữ
   "gemini" thì coi là model, còn lại coi là khoá. */
const tachDS = (v?: string): string[] =>
  (v || '').split(',').map((x) => x.trim()).filter(Boolean);

const GEMINI_KEYS: string[] = [...new Set([
  ...tachDS(process.env.GEMINI_API_KEYS),
  ...tachDS(process.env.GEMINI_API_KEY),
  ...tachDS(process.env.GEMINI_MODELS).filter((x) => !/gemini/i.test(x)),
])];
const GEMINI_MODELS: string[] = [...new Set([
  ...tachDS(process.env.GEMINI_MODEL).filter((x) => /gemini/i.test(x)),
  ...tachDS(process.env.GEMINI_MODELS).filter((x) => /gemini/i.test(x)),
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
])];
const GEMINI_KEY = GEMINI_KEYS[0];
const GEMINI_MODEL = GEMINI_MODELS[0];
const AI_KEY = process.env.ANTHROPIC_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const NO_THINK = /(^|[^0-9])(2\.5|3\.)/.test(GEMINI_MODEL) || GEMINI_MODEL.includes('flash-latest') || GEMINI_MODEL.includes('pro-latest');
let lastErr: string | null = null;
/* ── CÂU LỆNH BIÊN TẬP TIN ─────────────────────────────────────────────────
 * Viết theo đúng nghiệp vụ một biên tập viên toà soạn, không phải "viết lại cho
 * khác chữ". Mỗi quy tắc dưới đây đều có lý do, ghi luôn để sau khỏi sửa bừa:
 *
 *  · THÁP NGƯỢC + SAPO: tin tức đọc trên điện thoại, phần lớn người đọc chỉ đọc
 *    đoạn đầu. Đoạn đầu phải trả lời được: chuyện gì, ở đâu, khi nào, ai quyết.
 *  · GIỮ NGUỒN CỦA TỪNG SỐ LIỆU: đây là trang bất động sản, người đọc đem số
 *    liệu đi ra quyết định mua bán. Số không có nguồn là số vô giá trị.
 *  · KHÔNG BIẾN ĐỀ XUẤT THÀNH ĐÃ DUYỆT: lỗi kinh điển và nguy hiểm nhất khi
 *    viết về quy hoạch. "đề xuất", "dự kiến", "trình", "lấy ý kiến" phải giữ
 *    nguyên, tuyệt đối không rút gọn thành "đã có", "sẽ làm".
 *  · GIỮ NGUYÊN SỐ HIỆU VĂN BẢN: Nghị định 101/2024, Quyết định 205/QĐ-TTg…
 *    sai một ký tự là tra cứu ra văn bản khác.
 *  · DÙNG TỪ NGỮ CỦA LUẬT: "Giấy chứng nhận quyền sử dụng đất" chứ không phải
 *    "sổ đỏ", "đăng ký biến động" chứ không phải "sang tên", khi bài gốc dùng
 *    từ pháp lý. Đây là yêu cầu xuyên suốt của cả trang web.
 *  · KHÔNG KHEN CHÊ, KHÔNG KHUYÊN ĐẦU TƯ: tin là tin. Khuyên mua bán trên trang
 *    bất động sản là tự rước trách nhiệm pháp lý.
 */

const newsPrompt = (title: string, full: string): string => `Bạn là biên tập viên một toà soạn tin tức bất động sản. Biên tập lại bài dưới đây thành một bài hoàn chỉnh bằng tiếng Việt, đúng chuẩn báo chí.

TRƯỚC TIÊN — KIỂM TRA ĐẦU VÀO  (bước này làm trước, đừng bỏ)
- Đọc phần NỘI DUNG BÀI GỐC. Nếu nó KHÔNG phải một bài báo hoàn chỉnh — chỉ là thực đơn trang web, danh sách chuyên mục, dòng "Đăng nhập / Quảng cáo / Xem thêm", hoặc có dưới 3 đoạn văn thật — thì TRẢ VỀ ĐÚNG MỘT DÒNG: KHÔNG ĐỦ
  (Viết bài từ mớ đó là ra một bài vô nghĩa. Thà không có bài còn hơn có bài rác.)
- Nếu bài gốc còn sót thực đơn, tên chuyên mục, dòng giờ đăng, tên tác giả, dòng "Ảnh: …" ở đầu hay cuối thì BỎ HẲN mấy thứ đó, chỉ lấy phần nội dung thật.

CÁCH DỰNG BÀI
- GIỮ ĐỦ Ý: mỗi đoạn có nội dung của bài gốc đều phải có mặt trong bản biên tập. Được gộp hai đoạn cùng ý làm một, nhưng KHÔNG được bỏ mất một ý nào. Bài gốc có 8 đoạn mà bản biên tập còn 2 đoạn là hỏng.
- Đoạn đầu là SAPO: 2–3 câu, trả lời ngay chuyện gì xảy ra, ở đâu, khi nào, cơ quan/đơn vị nào quyết định. Đừng mở bài vòng vo.
- Các đoạn sau xếp theo mức quan trọng giảm dần (tháp ngược): cắt đoạn cuối đi bài vẫn đọc được.
- Mỗi đoạn 2–4 câu, cách nhau MỘT DÒNG TRỐNG. Câu trung bình dưới 25 chữ.
- Độ dài khoảng 80% bài gốc. Bài gốc ngắn hoặc sơ sài thì viết ngắn, KHÔNG kéo dài bằng cách nói vòng.
- KHÔNG giật tít trong sapo, KHÔNG mở bài bằng câu hỏi tu từ, không dùng dấu chấm than.
- Có lời phát biểu thì để trong ngoặc kép, ghi rõ AI NÓI. Lần đầu nhắc một người thì ghi đủ chức danh và họ tên như bài gốc, các lần sau rút gọn.

ĐỘ CHÍNH XÁC — QUAN TRỌNG NHẤT
- Mỗi số liệu phải đi kèm NGUỒN như bài gốc nêu (theo cơ quan nào, ai phát biểu, văn bản nào). Bài gốc không nói nguồn thì cũng không được tự gán.
- Giữ NGUYÊN VĂN số hiệu văn bản, tên cơ quan, tên địa danh, ngày tháng. Không viết tắt lại, không làm tròn số.
- PHÂN BIỆT RÕ việc đã xong và việc mới đề xuất. Bài gốc viết "đề xuất", "dự kiến", "trình", "đang lấy ý kiến" thì bản biên tập phải giữ đúng mức độ đó. Tuyệt đối không nâng thành "đã được duyệt" hay "sẽ triển khai".
- Bài gốc nói mập mờ thì viết mập mờ y vậy, KHÔNG tự đoán thêm cho rõ.
- TUYỆT ĐỐI không thêm số liệu, sự kiện, mốc thời gian, tên người nào không có trong bài gốc.
- TÊN ĐƠN VỊ HÀNH CHÍNH giữ y như bài gốc. Không tự đổi "huyện" thành "xã", không tự ghép hay tách tên sau sáp nhập, không tự thêm tên tỉnh. Đây là lỗi dễ mắc nhất và làm sai hẳn địa bàn.
- Bài gốc dẫn lại nguồn khác ("theo báo…", "theo đại diện…") thì bản biên tập phải giữ đúng chỗ dẫn đó, không biến thành lời khẳng định của mình.
- Số liệu là ƯỚC TÍNH, DỰ KIẾN, KHÁI TOÁN thì phải giữ nguyên mấy chữ đó, không bỏ đi cho câu gọn.
- Mốc thời gian mơ hồ ("mới đây", "thời gian tới") chỉ được dùng khi CHÍNH bài gốc dùng. Bài gốc có ngày tháng cụ thể thì bắt buộc giữ ngày tháng.
- Bài gốc có nhiều bên (cơ quan, doanh nghiệp, người dân) thì giữ đủ các bên, KHÔNG cắt bỏ ý kiến trái chiều cho bài gọn.

VĂN PHONG
- Câu chủ động, gọn. Bỏ chữ thừa, bỏ tính từ quảng cáo ("đắc địa", "vàng", "sốt", "bùng nổ").
- Dùng ĐÚNG THUẬT NGỮ PHÁP LÝ khi bài gốc dùng: "Giấy chứng nhận quyền sử dụng đất", "đăng ký biến động", "thu hồi đất", "bồi thường, hỗ trợ, tái định cư"… Không thay bằng tiếng lóng thị trường.
- Số theo kiểu Việt Nam: 1.250 m², 12,5 tỷ đồng, ngày 22/9/2026.
- KHÔNG bình luận, KHÔNG dự đoán giá, KHÔNG khuyên nên mua hay nên bán. Không xưng "chúng tôi".
- KHÔNG suy diễn nhân quả kiểu "nhờ vậy giá đất sẽ tăng", "điều này cho thấy…" nếu bài gốc không nói.
- KHÔNG quảng cáo cho một dự án hay một chủ đầu tư cụ thể, kể cả khi bài gốc viết theo hướng đó.
- Không nêu thông tin riêng tư của người dân (số nhà, số điện thoại, số căn cước) dù bài gốc có.
- DIỄN ĐẠT LẠI bằng câu chữ của mình, không chép nguyên câu của bài gốc.

RÀ SOÁT LẠI TRƯỚC KHI TRẢ VỀ  (đây là bước của thư ký toà soạn, không được bỏ)
Đọc lại bản vừa viết và tự kiểm 5 điều. Chỗ nào không đạt thì SỬA rồi mới trả về:
1. Từng con số, từng ngày tháng, từng số hiệu văn bản trong bản biên tập có tìm thấy đúng như vậy trong bài gốc không?
2. Từng tên người, tên cơ quan, tên xã/phường/huyện/tỉnh có đúng y bài gốc không?
3. Có câu nào biến việc "đề xuất / dự kiến / đang lấy ý kiến" thành việc đã xong không?
4. Có câu nào là nhận định của mình mà bài gốc không hề có không?
5. Có câu nào chép gần như nguyên văn bài gốc không?
6. Câu CUỐI CÙNG của bài có trọn vẹn, có dấu chấm, khép lại được câu chuyện không?

KẾT BÀI TRỌN VẸN  (bắt buộc)
- Bài phải KẾT THÚC TRỌN VẸN: câu cuối là một câu đầy đủ, có dấu chấm. TUYỆT ĐỐI không dừng giữa câu, không dừng sau dấu hai chấm, không để ngoặc kép mở mà chưa đóng.
- Đoạn cuối phải khép lại câu chuyện bằng ý cuối cùng của bài gốc (bước tiếp theo, thời hạn, ý kiến của cơ quan có thẩm quyền…). Không kết bằng một câu lửng lơ kiểu "Đại diện ngân hàng cho biết:" rồi hết.
- Nếu phần cuối NỘI DUNG BÀI GỐC bị đứt giữa chừng (câu cuối cụt, trích dẫn chưa hết) thì BỎ câu cụt đó, kết bài ở ý trọn vẹn cuối cùng. Không tự bịa phần còn thiếu.
- Bài dài thì viết gọn các đoạn giữa cho đủ chỗ, nhưng vẫn phải đi tới câu kết — thà ngắn mà trọn còn hơn dài mà cụt.

TRẢ VỀ
- Chỉ phần thân bài. Không thêm tiêu đề, không viết "Tóm tắt:", "Bài viết:", không chú thích cuối bài.
- Không mở đầu bằng tên chuyên mục, ngày giờ đăng hay tên tác giả.
- Nếu đã kết luận ở bước KIỂM TRA ĐẦU VÀO là không đủ, chỉ trả về đúng: KHÔNG ĐỦ

TIÊU ĐỀ BÀI GỐC: ${title}

NỘI DUNG BÀI GỐC:
${full}`;

async function rewrite(title: string, full: string): Promise<string | null> {
  const prompt = newsPrompt(title, full);
  for (const khoa of GEMINI_KEYS) {
    for (const model of GEMINI_MODELS) {
      try {
        const genCfg: any = { maxOutputTokens: 8192, temperature: 0.7 };
        if (NO_THINK) genCfg.thinkingConfig = { thinkingBudget: 0 };
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': khoa },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: genCfg }),
          signal: AbortSignal.timeout(28000),
        });
        if (res.ok) {
          const j: any = await res.json();
          const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          /* ⚠️ finishReason = MAX_TOKENS: AI bị CẮT giữa chừng vì hết độ dài cho phép → bài dừng
             lửng giữa câu. Trước đây vẫn nhận và đăng → bài cụt vô nghĩa (chủ dự án bắt 28/9/2026).
             Nay coi như hỏng, thử model/khoá khác. */
          if (txt && j?.candidates?.[0]?.finishReason === 'MAX_TOKENS') { lastErr = `Gemini ${model} viết chưa xong đã hết độ dài (MAX_TOKENS)`; continue; }
          if (txt) { lastErr = null; return txt; }
          lastErr = `Gemini ${model} trả rỗng (finishReason=${j?.candidates?.[0]?.finishReason || '?'})`;
        } else {
          lastErr = `Gemini ${model} HTTP ${res.status}: ` + (await res.text().catch(() => '')).slice(0, 160);
          /* 400/403/404 là sai khoá hoặc sai tên model → thử model khác cũng vô
             ích với khoá này; 429/503 là quá tải → thử model khác thì lại có cửa. */
          if (res.status === 400 || res.status === 403 || res.status === 404) continue;
        }
      } catch (e: any) { lastErr = `Gemini ${model} lỗi: ` + (e?.message || String(e)); }
    }
  }
  if (!GEMINI_KEYS.length) lastErr = 'Chưa cấu hình GEMINI_API_KEY';
  if (AI_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: AI_MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(28000),
      });
      if (res.ok) {
        const j: any = await res.json();
        const txt = j?.content?.find((b: any) => b?.type === 'text')?.text?.trim();
        // stop_reason = 'max_tokens' → bị cắt giữa chừng, KHÔNG nhận (lý do như Gemini ở trên).
        if (txt && j?.stop_reason !== 'max_tokens') { lastErr = null; return txt; }
        lastErr = j?.stop_reason === 'max_tokens' ? 'Claude viết chưa xong đã hết độ dài (max_tokens)' : 'Claude trả rỗng';
      }
      else { lastErr = 'Claude HTTP ' + res.status; }
    } catch (e: any) { lastErr = 'Claude lỗi: ' + (e?.message || String(e)); }
  }
  return null;
}

// Lọc ảnh sạch (bỏ logo/icon/quảng cáo/ảnh "vận hành bởi"...).
const cleanImg = (u: string): boolean => /^https?:\/\//i.test(u) && /\.(jpe?g|png|webp)(\?|$)/i.test(u) && !/(logo|icon|avatar|sprite|banner|advert|quang-?cao|vccorp|operate|share|placeholder|default|blank|pixel|1x1|skin|template|thumb-?fb)/i.test(u);
/* ── LƯỚI AN TOÀN: KHÔNG BAO GIỜ ĐĂNG BÀI DỪNG GIỮA CÂU ─────────────────────
   Dù bài do AI viết hay đăng nguyên văn bài gốc (khi AI hết lượt), nếu chữ cuối
   không phải dấu kết câu thì CẮT LÙI về câu trọn vẹn cuối cùng. Chỉ thêm "…" khi
   cắt lùi sẽ mất quá nửa bài.
   Ví dụ đã gặp (28/9/2026): bài dừng ở «Đại diện SHB cho biết: "Doa» — bài gốc bị
   cắt cứng 7.000 ký tự trong lúc khoá AI hết lượt. */
const KY_TU_AN = /[​-‏‪-‮⁠﻿]/g; // ký tự vô hình hay dính cuối bài báo
const catTronCau = (text: string): string => {
  const t = (text || '').replace(KY_TU_AN, '').trim();
  if (!t || /[.!?…]["'”»)\]]*$/.test(t)) return t;
  let cuoi = -1;
  for (const m of t.matchAll(/[.!?…]["'”»)\]]*(?=\s)/g)) cuoi = (m.index ?? 0) + m[0].length;
  if (cuoi > t.length * 0.5) return t.slice(0, cuoi).trim();
  return t.replace(/[\s,;:–-]+$/, '') + '…';
};
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
    // ẢNH ĐẠI DIỆN CHUẨN của bài: og:image / twitter:image trong <head> — đáng tin & ĐÚNG bài, ưu tiên hơn ảnh bới trong thân.
    const metaImgs: string[] = [];
    for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
      if (!/\b(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["']/i.test(m[0])) continue;
      const c0 = (m[0].match(/\bcontent=["']([^"']+)["']/i) || [])[1]; if (!c0) continue;
      let c = decode(c0); if (c.startsWith('//')) c = 'https:' + c;
      if (cleanImg(c)) metaImgs.push(c);
    }
    html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<header[\s\S]*?<\/header>/gi, ' ').replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
    /* ⚠️ CHỌN ĐÚNG KHỐI NỘI DUNG — chỗ này từng làm hỏng cả loạt bài.
       Trước đây lấy THẺ <article> ĐẦU TIÊN. Nhiều báo (tuoitre.vn là một) đặt
       mấy thẻ <article> nhỏ cho "tin liên quan" NẰM TRƯỚC thân bài → lấy trúng
       cái rỗng, trích ra 0 đoạn, bài đăng lên chỉ còn đúng câu tóm tắt lặp lại.
       Nay gom TẤT CẢ ứng viên rồi chọn cái nào trích ra được NHIỀU CHỮ NHẤT. */
    /* Một ĐOẠN VĂN THẬT khác một dòng menu ở chỗ nào?
       ⚠️ Đã vấp: chỉ đếm số chữ thì cả trang báo (kể cả thực đơn "Podcast /
          YouTube / Cần biết / Quảng cáo / Tất cả chuyên mục…") lại nhiều chữ
          hơn thân bài → bài đăng lên mở đầu bằng nguyên cái thực đơn.
       Nên đoạn văn phải thoả:
         · có câu hoàn chỉnh (có dấu chấm/hỏi/than ở giữa hoặc ở cuối);
         · không phải kiểu menu — menu thì chữ nào cũng viết hoa. */
    const laDoanVan = (t: string): boolean => {
      if (t.length < 45) return false;
      if (!/[.!?…]["»)\]]?\s*$/.test(t) && !/[.!?]\s/.test(t)) return false;
      const tu = t.split(/\s+/);
      if (tu.length < 8) return false;
      const hoa = tu.filter((w) => /^[A-ZÀ-Ỹ]/.test(w)).length;
      if (hoa / tu.length > 0.42) return false;
      return true;
    };
    const doanTu = (kh: string): string[] => {
      const ra: string[] = [];
      for (const m of kh.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
        const t = strip(decode(m[1]));
        if (!laDoanVan(t)) continue;
        if (/^(theo |nguồn|ảnh\s*:|video\s*:|xem thêm|đọc thêm|>>)/i.test(t)) continue;
        if (/[Ảả]nh\s*:\s*\S/.test(t) || /^[Nn]guồn\s*:\s*\S/.test(t)) continue;
        ra.push(t);
      }
      return ra;
    };
    /* Cắt phần đuôi (tin liên quan, thẻ, chia sẻ, bình luận).
       ⚠️ BẪY ĐÃ VẤP: nhiều báo CHÈN hộp "tin liên quan" vào GIỮA thân bài
       (tuoitre.vn chèn ngay sau đoạn đầu). Cắt ngay ở lần khớp đầu tiên là mất
       gần hết bài — bài đăng lên chỉ còn 1–2 đoạn.
       Nay: chỉ cắt theo tên lớp khi nó nằm ở PHẦN CUỐI (sau 60% độ dài); còn
       "Vận hành bởi"/"VCCorp" là chân trang thật nên cắt ở đâu cũng được. */
    const catDuoi = (kh: string): string => {
      const chan = kh.search(/Vận hành bởi|VCCorp/i);
      let cat = chan > 600 ? chan : kh.length;
      const re = /class=["'][^"']*(relate|relation|footer|tag-list|share|box-category|comment|widget)/gi;
      for (const m of kh.matchAll(re)) {
        if (m.index !== undefined && m.index > kh.length * 0.6) { cat = Math.min(cat, m.index); break; }
      }
      return cat < kh.length ? kh.slice(0, cat) : kh;
    };
    /* Gom ứng viên theo THỨ TỰ ƯU TIÊN, cả trang là hạng bét.
       Trong cùng một hạng thì cái nào ra nhiều đoạn văn thật hơn thì thắng. */
    const hang: string[][] = [[], [], []];
    for (const m of html.matchAll(/<div[^>]+(?:id|class)=["'][^"']*(?:detail-content|detail-cmain|afcbc-body|article-body|fck_detail|contentdetail|news-content|entry-content|the-article-body|content_detail|singular-content)[^"']*["'][\s\S]*$/gi)) hang[0].push(m[0]);
    for (const m of html.matchAll(/<article[\s\S]*?<\/article>/gi)) hang[1].push(m[0]);
    hang[2].push(html);
    let scope = '';
    let paras: string[] = [];
    for (const nhom of hang) {
      let tot: string[] = [];
      let totKh = '';
      for (const uv of nhom) {
        const c = catDuoi(uv);
        const ds = doanTu(c);
        if (ds.join(' ').length > tot.join(' ').length) { tot = ds; totKh = c; }
      }
      if (tot.length >= 2) { paras = tot; scope = totKh; break; }
    }
    if (!paras.length) { scope = catDuoi(html); paras = doanTu(scope); }
    const bodyImgs: string[] = [];
    for (const m of scope.matchAll(/<img[^>]+>/gi)) {
      const src = (m[0].match(/(?:data-src|data-original|src)=["']([^"' ]+)/i) || [])[1];
      if (src && cleanImg(src)) bodyImgs.push(src);
    }
    // og:image (đại diện chuẩn) LÊN ĐẦU, rồi mới đến ảnh trong thân bài.
    /* Gửi AI tối đa ~9.000 ký tự nhưng LẤY TRỌN TỪNG ĐOẠN. Trước đây cắt cứng .slice(0, 7000)
       nên đoạn cuối đứt giữa câu, và bản biên tập (hoặc bản đăng nguyên văn) cũng đứt theo. */
    const lay: string[] = []; let dai = 0;
    for (const d of paras) { if (lay.length && dai + d.length > 9000) break; lay.push(d); dai += d.length + 2; }
    return { text: lay.join('\n\n'), images: Array.from(new Set([...metaImgs, ...bodyImgs])).slice(0, 6) };
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
    const tier = tierOf(title + ' ' + sm);
    out.push({ title, url: link, source: src.name, image, summary: sm.length > 600 ? catTronCau(sm.slice(0, 600)) : sm, publishedAt: d.toISOString(), local: !!src.local || tier >= 1, tier });
  }
  return out;
}

// ── GHIM: bài về ĐÔ THỊ MỚI CAM LÂM — luôn hiện ở "Tin nổi bật", KHÔNG hết hạn (tin cũ vẫn giữ) ──
const PIMG = (id: string): string => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;
const PINNED: any[] = [
  {
    title: 'Thủ tướng phê duyệt Quy hoạch chung đô thị mới Cam Lâm đến năm 2045',
    url: 'https://baochinhphu.vn/cam-lam-tro-thanh-cuc-tang-truong-vung-nam-trung-bo-102240228164301983.htm',
    source: 'Báo Chính phủ', publishedAt: '2024-02-28T08:00:00+07:00', image: PIMG('1696857144141-97ad5cae0172'),
    summary: 'Ngày 28/2/2024, Thủ tướng Chính phủ ban hành Quyết định 205/QĐ-TTg phê duyệt Quy hoạch chung đô thị mới Cam Lâm, tỉnh Khánh Hòa đến năm 2045 — định hướng phát triển toàn huyện Cam Lâm thành đô thị sân bay tầm quốc tế.',
    body: 'Phạm vi lập quy hoạch gồm toàn bộ ranh giới hành chính huyện Cam Lâm, tổng diện tích tự nhiên khoảng 54.719 ha (không bao gồm mặt nước đầm Thủy Triều).\n\nĐịnh hướng đưa Cam Lâm trở thành cực tăng trưởng phía Nam tỉnh Khánh Hòa và vùng Nam Trung Bộ, góp phần giúp Khánh Hòa sớm trở thành thành phố trực thuộc Trung ương.\n\nĐô thị mới Cam Lâm phát triển theo mô hình đô thị sân bay hiện đại, sinh thái đẳng cấp quốc tế; chú trọng du lịch biển, logistics, dịch vụ tài chính và trung tâm đổi mới sáng tạo.',
  },
  {
    title: 'Đô thị mới Cam Lâm — mô hình đô thị sân bay sinh thái đẳng cấp quốc tế',
    url: 'https://quyhoach.xaydung.gov.vn/vn/quy-hoach/18260/quy-hoach-chung-do-thi-moi-cam-lam--tinh-khanh-hoa-den-nam-2045.aspx',
    source: 'Cổng Quy hoạch Xây dựng', publishedAt: '2024-03-02T08:00:00+07:00', image: PIMG('1596178060727-1f6885ee334d'),
    summary: 'Đô thị mới Cam Lâm được quy hoạch theo mô hình đô thị sân bay quy mô quốc tế, gắn với sân bay Cam Ranh, phát triển du lịch, logistics và đổi mới sáng tạo.',
    body: 'Đô thị mới Cam Lâm có tính chất là đô thị sân bay quy mô quốc tế, kết nối với sân bay quốc tế Cam Ranh và các trục giao thông trọng điểm của vùng.\n\nQuy hoạch hướng tới một đô thị thông minh, phát triển hài hòa giữa khu vực ven biển, vùng đồng bằng và vùng đồi núi phía Tây.\n\nCác lĩnh vực ưu tiên gồm du lịch nghỉ dưỡng, logistics hàng không, tài chính và giáo dục - y tế chất lượng cao mang tầm khu vực.',
  },
  {
    title: 'Dân số đô thị mới Cam Lâm dự kiến đạt khoảng 770.000 người vào năm 2045',
    url: 'https://nld.com.vn/quy-hoach-chung-do-thi-moi-cam-lam-duoc-phe-duyet-19624022818180863.htm',
    source: 'Người Lao Động', publishedAt: '2024-02-29T08:00:00+07:00', image: PIMG('1696857174061-6f0c3a685040'),
    summary: 'Theo quy hoạch, dân số đô thị mới Cam Lâm dự kiến khoảng 320.000 người vào năm 2030 và khoảng 770.000 người vào năm 2045.',
    body: 'Theo dự báo trong quy hoạch, đến năm 2030 dân số toàn đô thị khoảng 320.000 người, trong đó dân số đô thị khoảng 224.000 người, tỷ lệ đô thị hóa khoảng 70%.\n\nĐến năm 2045, dân số dự kiến khoảng 770.000 người, dân số đô thị khoảng 639.780 người, tỷ lệ đô thị hóa khoảng 83%.\n\nĐây là cơ sở để bố trí hạ tầng kỹ thuật, hạ tầng xã hội và các khu chức năng cho một đô thị sân bay quy mô lớn.',
  },
  {
    title: 'Cam Lâm — cực tăng trưởng mới phía Nam Khánh Hòa và vùng Nam Trung Bộ',
    url: 'https://kinhtedothi.vn/phe-duyet-quy-hoach-chung-do-thi-moi-cam-lam-tinh-khanh-hoa-den-nam-2045',
    source: 'Kinh tế & Đô thị', publishedAt: '2024-03-01T08:00:00+07:00', image: PIMG('1696857144077-9dca1f0e66bc'),
    summary: 'Quy hoạch chung được phê duyệt mở đường để Cam Lâm trở thành cực tăng trưởng phía Nam Khánh Hòa, liên kết Nha Trang và vịnh Cam Ranh.',
    body: 'Việc phê duyệt quy hoạch chung tạo hành lang pháp lý để Cam Lâm thu hút đầu tư, phát triển hạ tầng và trở thành động lực tăng trưởng mới của Khánh Hòa.\n\nĐô thị mới Cam Lâm được kỳ vọng liên kết chặt chẽ với thành phố Nha Trang và khu vực vịnh Cam Ranh, hình thành chuỗi đô thị - du lịch ven biển Nam Trung Bộ.\n\nĐịnh hướng phát triển gắn với bảo tồn cảnh quan đầm Thủy Triều, vùng ven biển Bãi Dài và các không gian sinh thái đặc trưng.',
  },
  {
    title: 'Toàn văn Quyết định 205/QĐ-TTg về quy hoạch đô thị mới Cam Lâm',
    url: 'https://thuvienphapluat.vn/van-ban/Xay-dung-Do-thi/Quyet-dinh-205-QD-TTg-2024-phe-duyet-Quy-hoach-chung-do-thi-moi-Cam-Lam-Khanh-Hoa-den-2045-600262.aspx',
    source: 'Thư viện Pháp luật', publishedAt: '2024-02-28T10:00:00+07:00', image: PIMG('1630471300276-e454cff47e02'),
    summary: 'Toàn văn Quyết định 205/QĐ-TTg nêu chi tiết mục tiêu, phạm vi và định hướng phát triển không gian đô thị mới Cam Lâm đến năm 2045.',
    body: 'Quyết định 205/QĐ-TTg ngày 28/2/2024 quy định chi tiết về mục tiêu, phạm vi, tính chất, quy mô và định hướng tổ chức không gian của đô thị mới Cam Lâm đến năm 2045.\n\nQuy hoạch là căn cứ để lập các quy hoạch phân khu, quy hoạch chi tiết và triển khai các dự án đầu tư trên địa bàn.\n\nNgười dân và nhà đầu tư có thể tra cứu ranh giới, định hướng sử dụng đất và hạ tầng khung để chuẩn bị kế hoạch phù hợp.',
  },
].map((a, i) => ({ ...a, order: i, tier: 3, local: true, pin: true, images: [a.image], slug: `${vnSlug(a.title) || 'tin'}-${shortHash(a.url)}` }));

// ══ KHO TIN GIỮ LẠI NGOÀI BỘ NHỚ ══
// Trước đây kho tin chỉ nằm trong bộ nhớ tiến trình. Máy chủ dựng lại (hoặc container khởi động lại)
// là mất sạch, chỉ còn mấy bài ghim. Ai đang mở dở một bài tin sẽ bị báo "Bài viết không còn được lưu"
// dù bài mới đăng hôm qua — bấm F5 thì lại thấy, vì lần gọi đầu đã kích hoạt tải mới ở nền.
// Nay kho được ghi ra một file trên đĩa, khởi động lại là nạp lại ngay, không mất bài nào.
const KHO = path.join(process.cwd(), '.kho-tin', 'tin.json');
function napKho(): any[] {
  try {
    const d = JSON.parse(fs.readFileSync(KHO, 'utf8'));
    // Bài cũ trong kho cũng qua lưới an toàn → sửa luôn những bài đã lỡ lưu ở dạng cụt câu.
    if (Array.isArray(d?.news) && d.news.length) return d.news.map((a: any) => (a?.body ? { ...a, body: catTronCau(a.body) } : a));
  } catch { /* chưa có file, hoặc file hỏng — coi như kho rỗng */ }
  return [];
}
function luuKho(ds: any[]): void {
  try {
    fs.mkdirSync(path.dirname(KHO), { recursive: true });
    fs.writeFileSync(KHO, JSON.stringify({ luc: Date.now(), news: ds }));
  } catch (e) { console.warn('[tin tức] không ghi được kho:', e); }
}
// Bài ghim luôn lấy bản mới nhất trong mã nguồn; tin xoay vòng lấy từ kho đã lưu.
let store: any[] = [...PINNED, ...napKho().filter((a: any) => !a.pin)];
let lastSlot = -1;
let refreshing = false; // đang làm mới RSS ở nền
const FRESH_CAP = 18; // số bài mới tải+viết lại mỗi lần làm mới (kiểm soát chi phí/độ trễ)

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
  // ⚠️ 29/9/2026 (rà soát bảo mật): chế độ tự kiểm GỌI AI THẬT (tốn lượt/tiền) — trước đây ai gõ ?diag=1
  //    cũng gọi được. Nay phải kèm đúng khoá NEWS_DIAG_KEY đặt trong .env (không đặt = tắt hẳn).
  const khoaDiag = process.env.NEWS_DIAG_KEY || '';
  if (khoaDiag && new URL(req.url).searchParams.get('diag') === khoaDiag) {
    const sample = await rewrite('Kiểm tra hệ thống tin tức', 'Hạ tầng giao thông khu vực Cam Lâm, Khánh Hòa đang được đầu tư phát triển mạnh, với nhiều dự án đường ven biển và kết nối sân bay Cam Ranh.');
    return NextResponse.json({
      hasGeminiKey: !!GEMINI_KEY, geminiModel: GEMINI_MODEL, disableThinking: NO_THINK, hasClaudeKey: !!AI_KEY,
      stored: store.length, chuaBienTap: store.filter((a: any) => a.aiOk === false).length, testRewriteOk: !!sample, testRewriteLen: sample ? sample.length : 0,
      testRewritePreview: sample ? sample.slice(0, 300) : null, lastError: lastErr,
    });
  }

  applyBaiDai(); // cập nhật ảnh Bãi Dài cho bài ghim mỗi request (thả ảnh vào là hiện ngay)
  const slot = slotStart();
  // Trả DỮ LIỆU HIỆN CÓ ngay (bài ghim + tin đã lưu) → KHÔNG "nháy" tin cũ/link ngoài. RSS làm mới CHẠY NỀN.
  if (lastSlot !== slot && !refreshing) {
    refreshing = true;
    refreshFeed(slot).catch(() => {}).finally(() => { refreshing = false; });
  }
  // Kho chưa có tin xoay vòng nào (máy chủ vừa dựng lại, kho trên đĩa cũng trống) thì CHỜ mẻ đầu
  // tối đa 15 giây rồi hãy trả. Trả ngay lúc này là trả danh sách cụt — ai đang mở một bài tin sẽ
  // bị báo nhầm là bài đã hết hạn.
  if (store.length <= PINNED.length && refreshing) {
    for (let i = 0; i < 60 && refreshing && store.length <= PINNED.length; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  // ?gon=1: BỎ TOÀN VĂN (body) + dãy ảnh — trang chủ và trang danh sách tin chỉ cần tiêu đề/tóm tắt/ảnh
  // đại diện. Trước đây mỗi lần mở trang chủ tải ~290 KB (toàn văn mọi bài) trên điện thoại (đo 29/9/2026).
  // Trang ĐỌC BÀI (/tin-tuc/[id]) vẫn gọi không kèm tham số để lấy đủ toàn văn.
  if (new URL(req.url).searchParams.get('gon') === '1') {
    return NextResponse.json({ news: store.map(({ body, images, ...gon }: any) => gon) });
  }
  return NextResponse.json({ news: store });
}

async function refreshFeed(slot: number): Promise<void> {
  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const fetched: any[] = [];
  for (const r of results) if (r.status === 'fulfilled') fetched.push(...r.value);
  const byUrl = new Map<string, any>(store.map((a) => [a.url, a]));
  // Ưu tiên xử lý (tải bài + viết lại) tin Cam Lâm/Khánh Hòa TRƯỚC để "Tin nổi bật" luôn có tin thật.
  fetched.sort((a, b) => (b.tier || 0) - (a.tier || 0) || +new Date(b.publishedAt) - +new Date(a.publishedAt));
  const fresh = fetched.filter((a) => !byUrl.has(a.url)).slice(0, FRESH_CAP);
  await Promise.allSettled(fresh.map(async (a) => {
    const art = await fetchArticle(a.url);
    const full = art.text && art.text.length > 200 ? art.text : (a.summary || a.title);
    /* AI trả "KHÔNG ĐỦ" nghĩa là phần bóc được từ bài gốc không phải bài báo
       thật (thực đơn trang web, trang chặn…). Lúc đó ĐỪNG đăng mớ đó lên —
       lấy câu tóm tắt của RSS còn hơn. */
    const viet = await rewrite(a.title, full);
    const hong = !viet || /^KHÔNG ĐỦ\s*$/i.test(viet.trim());
    a.body = catTronCau(dropCaptions(hong ? (art.text && art.text.length > 200 ? art.text : (a.summary || a.title)) : viet));
    a.aiOk = !hong;   // false = chưa biên tập được (hết lượt AI, AI báo lỗi…)
    const imgs = dedupeImages([...art.images, a.image].filter((u): u is string => !!u && cleanImg(u))).slice(0, 3); // og:image (đại diện chuẩn) LÊN ĐẦU, ảnh RSS làm dự phòng
    a.images = imgs;
    a.image = imgs[0] || null;
    a.slug = `${vnSlug(a.title) || 'tin'}-${shortHash(a.url)}`; // mô tả + đuôi SỐ
  }));
  for (const a of fresh) byUrl.set(a.url, a);

  /* ── BIÊN TẬP LẠI NHỮNG BÀI LẦN TRƯỚC CHƯA QUA ĐƯỢC AI ──────────────────
     ⚠️ Vì sao cần: khoá Gemini bản miễn phí có hạn mức theo ngày. Hết lượt thì
     bài lấy về lúc đó chỉ đăng lại NGUYÊN VĂN bài gốc. Trước đây mỗi bài chỉ
     được xử lý ĐÚNG MỘT LẦN (lúc mới về), nên bài đó nằm nguyên văn mãi mãi dù
     hôm sau hạn mức đã được cấp lại.
     Nay mỗi lượt làm mới sẽ thử biên tập lại vài bài còn thiếu. Làm ít một
     (RA_SOAT bài) cho khỏi đốt hết hạn mức vào việc cũ. */
  const RA_SOAT = 5;
  const canSua = [...byUrl.values()]
    .filter((a) => !a.pin && a.slug && a.aiOk === false)
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .slice(0, RA_SOAT);
  if (canSua.length) {
    await Promise.allSettled(canSua.map(async (a) => {
      const art = await fetchArticle(a.url);
      const full = art.text && art.text.length > 200 ? art.text : (a.summary || a.title);
      const viet = await rewrite(a.title, full);
      if (viet && !/^KHÔNG ĐỦ\s*$/i.test(viet.trim())) {
        a.body = catTronCau(dropCaptions(viet));
        a.aiOk = true;
      }
    }));
  }

  /* ⚠️ GIỮ TIN 30 NGÀY rồi mới xoá (chủ dự án dặn 25/9/2026; trước chỉ 7 ngày).
     Tin Khánh Hòa (tier≥1) giữ lâu hơn: 60 ngày.
     Trần số bài phải ĐỦ LỚN cho 30 ngày tin: mỗi ngày vào khoảng 10–15 bài,
     để trần 75 như trước là kho đầy sau ~1 tuần, tin cũ bị đẩy ra sớm dù
     chưa tới 30 ngày. */
  const thangTruoc = Date.now() - 30 * 86400000;
  const localKeep = Date.now() - 60 * 86400000;
  const rotating = [...byUrl.values()]
    .filter((a) => !a.pin && a.slug && +new Date(a.publishedAt) >= ((a.tier || 0) >= 1 ? localKeep : thangTruoc))
    .sort((a, b) => (b.local ? 1 : 0) - (a.local ? 1 : 0) || +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .slice(0, 600);
  store = [...PINNED, ...rotating]; // bài GHIM luôn đứng đầu
  luuKho(rotating);                  // ghi ra đĩa để lần khởi động sau còn nguyên
  if (fetched.length) lastSlot = slot;
}
