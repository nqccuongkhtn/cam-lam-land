import fs from 'node:fs';
import path from 'node:path';

// Ghi log ra FILE theo NGÀY (tự xoay vòng) + console. Tự xoá log cũ hơn LOG_RETAIN_DAYS.
// Đặt LOG_DIR để đổi thư mục (khuyến nghị trỏ vào volume để KHÔNG mất khi build lại container).
const DIR = process.env.LOG_DIR || path.resolve(process.cwd(), 'logs');
const RETAIN_DAYS = Number(process.env.LOG_RETAIN_DAYS || 30);
try { fs.mkdirSync(DIR, { recursive: true }); } catch { /* ignore */ }
// Dọn log cũ khi khởi động (không chặn tiến trình).
try {
  const cutoff = Date.now() - RETAIN_DAYS * 86400_000;
  for (const f of fs.readdirSync(DIR)) {
    if (!/\.log$/.test(f)) continue;
    try { if (fs.statSync(path.join(DIR, f)).mtimeMs < cutoff) fs.unlinkSync(path.join(DIR, f)); } catch { /* ignore */ }
  }
} catch { /* ignore */ }

const day = () => new Date().toISOString().slice(0, 10);
const stamp = () => new Date().toISOString();
function append(file: string, text: string) { try { fs.appendFile(path.join(DIR, file), text, () => { }); } catch { /* ignore */ } }
function safe(v: any): string { if (v == null) return ''; try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); } }

/** Ghi LỖI: ra stderr + file error-YYYY-MM-DD.log */
export function logError(msg: string, extra?: any) {
  const l = `${stamp()} [ERROR] ${msg}${extra ? ' | ' + safe(extra) : ''}\n`;
  try { process.stderr.write(l); } catch { /* ignore */ }
  append(`error-${day()}.log`, l);
}
/** Ghi request 5xx / CHẬM: file access-YYYY-MM-DD.log */
export function logAccess(msg: string) { append(`access-${day()}.log`, `${stamp()} [INFO] ${msg}\n`); }

/** Middleware: chỉ ghi request bị lỗi (>=500) hoặc CHẬM (>2s) để soi hiệu năng & sự cố, không làm phình log. */
export function requestLogger(req: any, res: any, next: any) {
  const t0 = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - t0;
    if (res.statusCode >= 500 || ms > 2000) logAccess(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms ip=${req.ip || '-'}`);
  });
  next();
}

export const LOG_DIR = DIR;
