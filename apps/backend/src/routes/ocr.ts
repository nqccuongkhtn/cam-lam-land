import { Router } from 'express';
import multer from 'multer';
import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { authRequired, adminRequired } from '../middleware/auth.ts';
import { query } from '../lib/db.ts';

export const ocrRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

function runTesseract(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('tesseract', [file, 'stdout', ...args], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(String(stdout || ''));
    });
  });
}

// ── Gemini (miễn phí) — đọc bảng toạ độ mạnh hơn Tesseract nhiều; tự bỏ qua nếu chưa cấu hình GEMINI_API_KEY ──
// NHIỀU API key (nhiều tài khoản Google) — mỗi key có quota free RIÊNG. Xâu vào để "chạy Gemini bằng mọi giá": hết quota key này tự sang key khác. Đặt GEMINI_API_KEYS="key1,key2,key3" (hoặc vẫn 1 key qua GEMINI_API_KEY).
const GEMINI_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_KEY || '').split(',').map((s) => s.trim()).filter(Boolean);
// Model Gemini — mỗi model có quota riêng trên MỖI key. Thử KEY × MODEL để vắt kiệt quota Gemini trước khi rơi sang engine khác. Ưu tiên gemini-2.5-flash (chính xác + nhanh). Bỏ gemini-3-flash-preview khỏi mặc định (hay timeout); muốn dùng thì đặt GEMINI_MODELS.
const GEMINI_MODELS = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash,gemini-2.0-flash-lite').split(',').map((s) => s.trim()).filter(Boolean);
const GEMINI_PROMPT = `Bạn là công cụ trích xuất toạ độ từ ảnh bảng toạ độ địa chính VN-2000 (Khánh Hòa, Việt Nam). Đọc TẤT CẢ các điểm ranh thửa trong ảnh. Mỗi điểm gồm 2 số: X = toạ độ Bắc (Northing) 7 chữ số phần nguyên, thường bắt đầu bằng 1 (khoảng 1200000-1480000); Y = toạ độ Đông (Easting) 6 chữ số phần nguyên (khoảng 380000-720000). CHỈ in kết quả, MỖI DÒNG MỘT ĐIỂM đúng định dạng: X Y (X trước, Y sau, cách nhau một dấu cách; giữ nguyên phần thập phân nếu có; TUYỆT ĐỐI không kèm số thứ tự, chữ, đơn vị hay ký tự nào khác). Không đọc được điểm nào thì để trống.`;
// Prompt đọc TOÀN BỘ thông tin trên Giấy chứng nhận (sổ đỏ) từ ảnh — dùng cho /api/ocr/info.
const CERT_INFO_PROMPT = `Bạn là công cụ đọc Giấy chứng nhận quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất (sổ đỏ/sổ hồng) Việt Nam từ ảnh. Hãy trích xuất các trường có trên ảnh, MỖI TRƯỜNG MỘT DÒNG đúng định dạng "Nhãn: giá trị". Các nhãn cần lấy (bỏ qua dòng nào không đọc được, KHÔNG bịa):
Người sử dụng đất/chủ sở hữu
Số CCCD/CMND
Thửa đất số
Tờ bản đồ số
Diện tích
Loại đất (mục đích sử dụng)
Thời hạn sử dụng
Hình thức sử dụng
Địa chỉ thửa đất
Nguồn gốc sử dụng
Số phát hành (seri)
Số vào sổ cấp GCN
CHỈ in các dòng "Nhãn: giá trị", tuyệt đối không thêm lời giải thích. Chỉ đọc đúng những gì nhìn thấy trên ảnh.`;
async function geminiCall(model: string, key: string, buffer: Buffer, mime: string, prompt: string = GEMINI_PROMPT): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  // TẮT bớt "thinking" cho phản hồi NHANH (đọc bảng số không cần suy luận, tránh timeout): Gemini 3 → thinkingLevel=MINIMAL; Gemini 2.5 → thinkingBudget=0. Model 2.0/cũ hơn KHÔNG hỗ trợ thinking nên bỏ qua (gửi vào sẽ lỗi 400).
  const generationConfig: any = { temperature: 0, maxOutputTokens: 4096 };
  if (/gemini-3/.test(model)) generationConfig.thinkingConfig = { thinkingLevel: 'MINIMAL' };
  else if (/gemini-2\.5/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime || 'image/png', data: buffer.toString('base64') } }] }],
    generationConfig,
  };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('Gemini HTTP ' + r.status + ' (' + model + '): ' + (await r.text().catch(() => '')).slice(0, 200));
  const j: any = await r.json();
  return String(j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') || '');
}
// Ưu tiên Gemini BẰNG MỌI GIÁ: thử mọi tổ hợp KEY × MODEL (mỗi key×model là 1 quota free riêng). Cái nào ra số thì nhận luôn; lỗi/hết quota/không ra số thì thử tiếp. Vắt kiệt hết mới ném lỗi để rơi sang Groq/OpenRouter/OCR.space.
async function geminiOcr(buffer: Buffer, mime: string, prompt: string = GEMINI_PROMPT, accept: (t: string) => boolean = (t) => (t.match(/\d{5,}/g) || []).length > 0): Promise<{ text: string; model: string }> {
  let lastErr: any = null;
  for (let ki = 0; ki < GEMINI_KEYS.length; ki++) {
    const key = GEMINI_KEYS[ki];
    for (const model of GEMINI_MODELS) {
      try {
        const t = await geminiCall(model, key, buffer, mime, prompt);
        if (accept(t)) return { text: t, model: `${model}#key${ki + 1}` };
        lastErr = new Error('không đạt'); console.error(`[ocr] Gemini "${model}" (key${ki + 1}) không đạt → thử tiếp`);
      } catch (e: any) { lastErr = e; console.error(`[ocr] Gemini "${model}" (key${ki + 1}) lỗi (${String(e?.message || e).slice(0, 120)}) → thử tiếp`); }
    }
  }
  throw lastErr || new Error('Gemini không đọc được');
}

// ── Provider tương thích OpenAI (Groq, OpenRouter…) — đọc ảnh qua chat/completions; đều FREE, KHÔNG cần thẻ. Bỏ qua nếu chưa đặt key. ──
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'; // Groq free ~1.000 lượt/ngày cho model vision này (không cần thẻ)
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-11b-vision-instruct:free'; // đổi sang model đuôi :free khác ở openrouter.ai/models nếu muốn
async function openaiVisionOcr(baseUrl: string, apiKey: string, model: string, buffer: Buffer, mime: string, prompt: string = GEMINI_PROMPT): Promise<string> {
  const dataUri = `data:${mime || 'image/png'};base64,${buffer.toString('base64')}`;
  const body = {
    model, temperature: 0, max_tokens: 2048,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUri } }] }],
  };
  const r = await fetch(baseUrl.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error('AI HTTP ' + r.status + ' (' + model + '): ' + (await r.text().catch(() => '')).slice(0, 200));
  const j: any = await r.json();
  return String(j?.choices?.[0]?.message?.content || '');
}

// ── OCR.space (miễn phí ~500 lượt/ngày, không cần thẻ) — đọc bảng số tốt (isTable); bỏ qua nếu chưa có OCRSPACE_API_KEY ──
const OCRSPACE_KEY = process.env.OCRSPACE_API_KEY || '';
async function ocrSpace(buffer: Buffer, mime: string): Promise<string> {
  const fd = new FormData();
  fd.append('base64Image', `data:${mime || 'image/png'};base64,${buffer.toString('base64')}`);
  fd.append('OCREngine', '2');
  fd.append('isTable', 'true');
  fd.append('scale', 'true');
  fd.append('language', 'eng');
  const r = await fetch('https://api.ocr.space/parse/image', { method: 'POST', headers: { apikey: OCRSPACE_KEY }, body: fd, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('OCR.space HTTP ' + r.status);
  const j: any = await r.json();
  if (j.IsErroredOnProcessing) throw new Error('OCR.space: ' + (Array.isArray(j.ErrorMessage) ? j.ErrorMessage.join('; ') : (j.ErrorMessage || 'lỗi')));
  return String((j?.ParsedResults || []).map((p: any) => p?.ParsedText).filter(Boolean).join('\n') || '');
}

// ── OCR nội bộ (self-host EasyOCR/PaddleOCR trên máy văn phòng) — mạnh, KHÔNG giới hạn lượt; bỏ qua nếu chưa đặt SELF_OCR_URL ──
const SELF_OCR_URL = process.env.SELF_OCR_URL || '';
const SELF_OCR_TOKEN = process.env.SELF_OCR_TOKEN || '';
async function selfOcr(buffer: Buffer, mime: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', new Blob([buffer], { type: mime || 'image/png' }), 'coords.png');
  const r = await fetch(SELF_OCR_URL.replace(/\/+$/, '') + '/ocr', { method: 'POST', headers: SELF_OCR_TOKEN ? { 'x-token': SELF_OCR_TOKEN } : {}, body: fd, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('Self-OCR HTTP ' + r.status);
  const j: any = await r.json();
  return String(j?.text || '');
}

// Đếm lượt OCR theo nguồn + ngày (giờ VN) để admin theo dõi hạn free.
function ymdVN(): string { return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); }
function bumpOcr(engine: string): void {
  query(`INSERT INTO ocr_usage (engine, ymd, count) VALUES ($1, $2, 1) ON CONFLICT (engine, ymd) DO UPDATE SET count = ocr_usage.count + 1`, [engine, ymdVN()]).catch(() => {});
}

// POST /api/ocr — Gemini(nhiều model) → Groq → OpenRouter → OCR.space → Máy nội bộ → Tesseract (server)
ocrRouter.post('/', authRequired, upload.single('file'), async (req: any, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu ảnh' });
    // 1) Gemini — ƯU TIÊN CHÍNH (thử lần lượt nhiều model, mỗi model quota riêng). Đọc được ảnh nền hoa văn sổ đỏ; free.
    if (GEMINI_KEYS.length) {
      try {
        const g = await geminiOcr(req.file.buffer, req.file.mimetype);
        const nnum = (g.text.match(/\d{5,}/g) || []).length;
        console.log(`[ocr] Gemini (${g.model}) đọc ${nnum} số cỡ toạ độ:`, JSON.stringify(g.text).slice(0, 240));
        bumpOcr('gemini'); return res.json({ text: g.text, engine: 'gemini' });
      } catch (e: any) { console.error('[ocr] Gemini LỖI (thử tiếp):', e?.message || e); }
    }
    // 2) Groq — Llama 4 Scout vision (free ~1.000 lượt/ngày, KHÔNG cần thẻ).
    if (GROQ_KEY) {
      try {
        const t = await openaiVisionOcr('https://api.groq.com/openai/v1', GROQ_KEY, GROQ_MODEL, req.file.buffer, req.file.mimetype);
        const nnum = (t.match(/\d{5,}/g) || []).length;
        console.log(`[ocr] Groq (${GROQ_MODEL}) đọc ${nnum} số:`, JSON.stringify(t).slice(0, 240));
        if (nnum > 0) { bumpOcr('groq'); return res.json({ text: t, engine: 'groq' }); }
      } catch (e: any) { console.error('[ocr] Groq LỖI (thử tiếp):', e?.message || e); }
    }
    // 3) OpenRouter — nhiều model vision đuôi :free (KHÔNG cần thẻ).
    if (OPENROUTER_KEY) {
      try {
        const t = await openaiVisionOcr('https://openrouter.ai/api/v1', OPENROUTER_KEY, OPENROUTER_MODEL, req.file.buffer, req.file.mimetype);
        const nnum = (t.match(/\d{5,}/g) || []).length;
        console.log(`[ocr] OpenRouter (${OPENROUTER_MODEL}) đọc ${nnum} số:`, JSON.stringify(t).slice(0, 240));
        if (nnum > 0) { bumpOcr('openrouter'); return res.json({ text: t, engine: 'openrouter' }); }
      } catch (e: any) { console.error('[ocr] OpenRouter LỖI (thử tiếp):', e?.message || e); }
    }
    // 4) OCR.space — dự phòng khi AI chưa ra số/hết quota (miễn phí ~500/ngày, không cần thẻ).
    if (OCRSPACE_KEY) {
      try {
        const stext = await ocrSpace(req.file.buffer, req.file.mimetype);
        const nnum = (stext.match(/\d{5,}/g) || []).length;
        console.log(`[ocr] OCR.space đọc ${nnum} số cỡ toạ độ:`, JSON.stringify(stext).slice(0, 240));
        if (nnum > 0) { bumpOcr('ocrspace'); return res.json({ text: stext, engine: 'ocrspace' }); }
      } catch (e: any) { console.error('[ocr] OCR.space LỖI (thử tiếp):', e?.message || e); }
    }
    // 5) Máy OCR nội bộ (self-host) — LỚP DỰ PHÒNG SÂU, chỉ chạy khi cloud lỗi/hết quota + PC đang bật.
    if (SELF_OCR_URL) {
      try {
        const t = await selfOcr(req.file.buffer, req.file.mimetype);
        const nnum = (t.match(/\d{5,}/g) || []).length;
        console.log(`[ocr] Máy nội bộ đọc ${nnum} số:`, JSON.stringify(t).slice(0, 240));
        if (nnum > 0) { bumpOcr('self'); return res.json({ text: t, engine: 'self' }); }
      } catch (e: any) { console.error('[ocr] Máy nội bộ LỖI (chuyển Tesseract):', e?.message || e); }
    }
    const tmp = join(tmpdir(), 'ocr_' + randomBytes(6).toString('hex'));
    await writeFile(tmp, req.file.buffer);
    let text = '';
    try {
      // Ưu tiên whitelist chỉ số + dấu (bảng toạ độ) với LSTM, rồi mới thử không whitelist; chọn kết quả nhiều số cỡ toạ độ nhất.
      let bestScore = -1;
      const WL = '0123456789.,-: ';
      const attempts: string[][] = [
        ['--oem', '1', '--psm', '6', '-c', `tessedit_char_whitelist=${WL}`],
        ['--oem', '1', '--psm', '4', '-c', `tessedit_char_whitelist=${WL}`],
        ['--oem', '1', '--psm', '6'],
        ['--oem', '1', '--psm', '11'],
      ];
      for (const args of attempts) {
        let t = '';
        try { t = await runTesseract(tmp, args); } catch {}
        const score = (t.match(/\d{5,7}/g) || []).length;
        if (score > bestScore) { bestScore = score; text = t; }
        if (bestScore >= 6) break;
      }
    } finally { unlink(tmp).catch(() => {}); }
    bumpOcr('tesseract');
    res.json({ text, engine: 'tesseract' });
  } catch (e: any) {
    if (/ENOENT/.test(String(e?.message || e))) return res.status(503).json({ error: 'Máy chủ chưa cài Tesseract OCR' });
    next(e);
  }
});

// POST /api/ocr/info — đọc THÔNG TIN Giấy chứng nhận từ ảnh (chỉ AI vision: Gemini → Groq → OpenRouter). Trả về text các dòng "Nhãn: giá trị".
ocrRouter.post('/info', authRequired, upload.single('file'), async (req: any, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu ảnh' });
    const buf = req.file.buffer, mime = req.file.mimetype;
    const okInfo = (t: string) => t.trim().length > 15 && /[:：]/.test(t);
    if (GEMINI_KEYS.length) {
      try {
        const g = await geminiOcr(buf, mime, CERT_INFO_PROMPT, okInfo);
        console.log(`[ocr-info] Gemini (${g.model}) đọc thông tin sổ`);
        bumpOcr('gemini'); return res.json({ text: g.text, engine: 'gemini' });
      } catch (e: any) { console.error('[ocr-info] Gemini lỗi (thử tiếp):', e?.message || e); }
    }
    if (GROQ_KEY) {
      try {
        const t = await openaiVisionOcr('https://api.groq.com/openai/v1', GROQ_KEY, GROQ_MODEL, buf, mime, CERT_INFO_PROMPT);
        if (okInfo(t)) { bumpOcr('groq'); return res.json({ text: t, engine: 'groq' }); }
      } catch (e: any) { console.error('[ocr-info] Groq lỗi (thử tiếp):', e?.message || e); }
    }
    if (OPENROUTER_KEY) {
      try {
        const t = await openaiVisionOcr('https://openrouter.ai/api/v1', OPENROUTER_KEY, OPENROUTER_MODEL, buf, mime, CERT_INFO_PROMPT);
        if (okInfo(t)) { bumpOcr('openrouter'); return res.json({ text: t, engine: 'openrouter' }); }
      } catch (e: any) { console.error('[ocr-info] OpenRouter lỗi:', e?.message || e); }
    }
    return res.status(422).json({ error: 'AI chưa đọc được thông tin. Hãy chụp/tải ảnh sổ rõ nét, đủ sáng, thẳng mặt sổ rồi thử lại.' });
  } catch (e) { next(e); }
});

// GET /api/ocr/usage — thống kê lượt OCR theo nguồn/ngày (chỉ admin).
ocrRouter.get('/usage', adminRequired, async (_req, res, next) => {
  try {
    const ymd = ymdVN();
    const start7 = new Date(Date.now() + 7 * 3600 * 1000 - 6 * 86400000).toISOString().slice(0, 10);
    const today = await query(`SELECT engine, count FROM ocr_usage WHERE ymd=$1 ORDER BY count DESC`, [ymd]);
    const last7 = await query(`SELECT ymd, SUM(count)::int AS total FROM ocr_usage WHERE ymd >= $1 GROUP BY ymd ORDER BY ymd DESC`, [start7]);
    res.json({ ymd, today, last7 });
  } catch (e) { next(e); }
});
