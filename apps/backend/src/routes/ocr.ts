import { Router } from 'express';
import multer from 'multer';
import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { authRequired } from '../middleware/auth.ts';

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
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_PROMPT = `Bạn là công cụ trích xuất toạ độ từ ảnh bảng toạ độ địa chính VN-2000 (Khánh Hòa, Việt Nam). Đọc TẤT CẢ các điểm ranh thửa trong ảnh. Mỗi điểm gồm 2 số: X = toạ độ Bắc (Northing) 7 chữ số phần nguyên, thường bắt đầu bằng 1 (khoảng 1200000-1480000); Y = toạ độ Đông (Easting) 6 chữ số phần nguyên (khoảng 380000-720000). CHỈ in kết quả, MỖI DÒNG MỘT ĐIỂM đúng định dạng: X Y (X trước, Y sau, cách nhau một dấu cách; giữ nguyên phần thập phân nếu có; TUYỆT ĐỐI không kèm số thứ tự, chữ, đơn vị hay ký tự nào khác). Không đọc được điểm nào thì để trống.`;
async function geminiOcr(buffer: Buffer, mime: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
  const body = {
    contents: [{ parts: [{ text: GEMINI_PROMPT }, { inline_data: { mime_type: mime || 'image/png', data: buffer.toString('base64') } }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 2048 },
  };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('Gemini HTTP ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 200));
  const j: any = await r.json();
  return String(j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') || '');
}

// POST /api/ocr — Gemini (nếu có GEMINI_API_KEY) → Tesseract (server)
ocrRouter.post('/', authRequired, upload.single('file'), async (req: any, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu ảnh' });
    // Ưu tiên Gemini nếu đã cấu hình key (mạnh hơn Tesseract nhiều); lỗi/thiếu key thì tự chuyển Tesseract.
    if (GEMINI_KEY) {
      try {
        const gtext = await geminiOcr(req.file.buffer, req.file.mimetype);
        if (/\d{5,}/.test(gtext)) return res.json({ text: gtext, engine: 'gemini' });
      } catch (e: any) { console.error('[ocr] Gemini lỗi, chuyển Tesseract:', e?.message || e); }
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
    res.json({ text, engine: 'tesseract' });
  } catch (e: any) {
    if (/ENOENT/.test(String(e?.message || e))) return res.status(503).json({ error: 'Máy chủ chưa cài Tesseract OCR' });
    next(e);
  }
});
