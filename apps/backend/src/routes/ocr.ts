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
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'; // tên ĐÚNG của Gemini 3 Flash (free ~1.500 lượt/ngày); "gemini-3-flash" (thiếu -preview) sẽ 404. Nếu tài khoản chưa có sẽ tự lùi về gemini-2.5-flash bên dưới.
const GEMINI_PROMPT = `Bạn là công cụ trích xuất toạ độ từ ảnh bảng toạ độ địa chính VN-2000 (Khánh Hòa, Việt Nam). Đọc TẤT CẢ các điểm ranh thửa trong ảnh. Mỗi điểm gồm 2 số: X = toạ độ Bắc (Northing) 7 chữ số phần nguyên, thường bắt đầu bằng 1 (khoảng 1200000-1480000); Y = toạ độ Đông (Easting) 6 chữ số phần nguyên (khoảng 380000-720000). CHỈ in kết quả, MỖI DÒNG MỘT ĐIỂM đúng định dạng: X Y (X trước, Y sau, cách nhau một dấu cách; giữ nguyên phần thập phân nếu có; TUYỆT ĐỐI không kèm số thứ tự, chữ, đơn vị hay ký tự nào khác). Không đọc được điểm nào thì để trống.`;
async function geminiCall(model: string, buffer: Buffer, mime: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
  const body = {
    contents: [{ parts: [{ text: GEMINI_PROMPT }, { inline_data: { mime_type: mime || 'image/png', data: buffer.toString('base64') } }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 4096 }, // nới rộng: Gemini 3 dùng "thinking" tốn thêm token, tránh cụt bảng toạ độ
  };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('Gemini HTTP ' + r.status + ' (' + model + '): ' + (await r.text().catch(() => '')).slice(0, 200));
  const j: any = await r.json();
  return String(j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') || '');
}
// Dùng model cấu hình (mặc định gemini-2.5-flash). Nếu đặt GEMINI_MODEL sang model khác mà API từ chối (4xx: sai tên/chưa có quyền) thì TỰ LÙI về gemini-2.5-flash để Gemini vẫn chạy, không rơi xuống OCR.space vì lỗi tên model.
const GEMINI_FALLBACK = 'gemini-2.5-flash';
async function geminiOcr(buffer: Buffer, mime: string): Promise<string> {
  try { return await geminiCall(GEMINI_MODEL, buffer, mime); }
  catch (e: any) {
    const msg = String(e?.message || e);
    if (GEMINI_MODEL !== GEMINI_FALLBACK && /HTTP 4(00|03|04)/.test(msg)) {
      console.error(`[ocr] Gemini model "${GEMINI_MODEL}" bị từ chối → lùi về ${GEMINI_FALLBACK}:`, msg);
      return await geminiCall(GEMINI_FALLBACK, buffer, mime);
    }
    throw e;
  }
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

// POST /api/ocr — Gemini → OCR.space → Máy nội bộ → Tesseract (server)
ocrRouter.post('/', authRequired, upload.single('file'), async (req: any, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu ảnh' });
    // 1) Gemini — ƯU TIÊN CHÍNH (vision AI, đọc được cả ảnh có nền hoa văn bảo an của sổ đỏ; free).
    if (GEMINI_KEY) {
      try {
        const gtext = await geminiOcr(req.file.buffer, req.file.mimetype);
        const nnum = (gtext.match(/\d{5,}/g) || []).length;
        console.log(`[ocr] Gemini (${GEMINI_MODEL}) đọc ${nnum} số cỡ toạ độ:`, JSON.stringify(gtext).slice(0, 240));
        if (nnum > 0) { bumpOcr('gemini'); return res.json({ text: gtext, engine: 'gemini' }); }
      } catch (e: any) { console.error('[ocr] Gemini LỖI (thử tiếp):', e?.message || e); }
    }
    // 2) OCR.space — dự phòng khi Gemini chưa ra số/hết quota (miễn phí ~500/ngày, không cần thẻ).
    if (OCRSPACE_KEY) {
      try {
        const stext = await ocrSpace(req.file.buffer, req.file.mimetype);
        const nnum = (stext.match(/\d{5,}/g) || []).length;
        console.log(`[ocr] OCR.space đọc ${nnum} số cỡ toạ độ:`, JSON.stringify(stext).slice(0, 240));
        if (nnum > 0) { bumpOcr('ocrspace'); return res.json({ text: stext, engine: 'ocrspace' }); }
      } catch (e: any) { console.error('[ocr] OCR.space LỖI (thử tiếp):', e?.message || e); }
    }
    // 3) Máy OCR nội bộ (self-host) — LỚP DỰ PHÒNG SÂU, chỉ chạy khi cloud lỗi/hết quota + PC đang bật.
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
