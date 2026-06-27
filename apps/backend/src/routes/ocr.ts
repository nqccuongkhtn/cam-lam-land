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

// POST /api/ocr — đọc chữ trong ảnh bằng Tesseract bản gốc (server)
ocrRouter.post('/', authRequired, upload.single('file'), async (req: any, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu ảnh' });
    const tmp = join(tmpdir(), 'ocr_' + randomBytes(6).toString('hex'));
    await writeFile(tmp, req.file.buffer);
    let text = '';
    try {
      text = await runTesseract(tmp, ['--psm', '6', '-c', 'tessedit_char_whitelist=0123456789.,']);
      if (!/\d{5,}/.test(text)) {
        const t2 = await runTesseract(tmp, ['--psm', '4']);
        if (/\d/.test(t2)) text = t2;
      }
    } finally { unlink(tmp).catch(() => {}); }
    res.json({ text });
  } catch (e: any) {
    if (/ENOENT/.test(String(e?.message || e))) return res.status(503).json({ error: 'Máy chủ chưa cài Tesseract OCR' });
    next(e);
  }
});
