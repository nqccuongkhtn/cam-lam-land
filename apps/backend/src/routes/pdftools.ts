// CÔNG CỤ PDF XỬ LÝ MÁY CHỦ (dùng tạm — sau tách web dễ gỡ: xoá file này + 1 dòng đăng ký index.ts).
// convert: Office↔PDF (LibreOffice) · ocr: PDF ảnh -> PDF tìm được chữ (ocrmypdf, tiếng Việt) · encrypt/decrypt: đặt/gỡ mật khẩu (qpdf).
import { Router } from 'express';
import multer from 'multer';
import { execFile } from 'node:child_process';
import { writeFile, readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, basename } from 'node:path';

export const pdftoolsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });

const CT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function run(cmd: string, args: string[], opts: any = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: opts.timeout || 150000, maxBuffer: 64 * 1024 * 1024 }, (err: any, stdout, stderr) => {
      if (err && !(opts.okCodes || []).includes(err.code)) { err.stderr = String(stderr || ''); return reject(err); }
      resolve(String(stdout || '') + String(stderr || ''));
    });
  });
}
function enoent(e: any) { return /ENOENT/.test(String(e?.message || e)); }
function sendDl(res: any, buf: Buffer, name: string, ext: string) {
  res.setHeader('Content-Type', CT[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
  res.setHeader('Content-Length', String(buf.length));
  res.send(buf);
}
const safeBase = (n: string) => (basename(n || 'file').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}\-_ ]/gu, '_').slice(0, 80) || 'file');

// POST /api/pdftools/convert?to=pdf|docx|xlsx|pptx — chuyển đổi Office↔PDF bằng LibreOffice.
pdftoolsRouter.post('/convert', upload.single('file'), async (req: any, res, next) => {
  const to = String(req.query.to || 'pdf').toLowerCase().replace(/[^a-z]/g, '');
  if (!req.file) return res.status(400).json({ error: 'Thiếu tệp' });
  if (!['pdf', 'docx', 'xlsx', 'pptx'].includes(to)) return res.status(400).json({ error: 'Định dạng đích không hỗ trợ' });
  const inExt = (extname(req.file.originalname || '').slice(1) || 'bin').toLowerCase();
  const dir = await mkdtemp(join(tmpdir(), 'lo_'));
  try {
    const inPath = join(dir, 'src.' + inExt);
    await writeFile(inPath, req.file.buffer);
    const args = ['--headless', '--norestore', '--nolockcheck', `-env:UserInstallation=file://${join(dir, 'profile')}`];
    if (inExt === 'pdf' && to === 'docx') args.push('--infilter=writer_pdf_import'); // ép PDF -> Writer để ra Word đọc/sửa được
    args.push('--convert-to', to, '--outdir', dir, inPath);
    await run('soffice', args, { timeout: 180000 });
    const files = await readdir(dir);
    const outName = files.find((f) => f.toLowerCase().endsWith('.' + to) && f !== 'src.' + inExt);
    if (!outName) return res.status(422).json({ error: 'Không chuyển đổi được tệp này (định dạng nguồn có thể không được hỗ trợ).' });
    const out = await readFile(join(dir, outName));
    sendDl(res, out, safeBase(req.file.originalname) + '.' + to, to);
  } catch (e: any) {
    if (enoent(e)) return res.status(503).json({ error: 'Máy chủ chưa cài LibreOffice — hãy rebuild backend.' });
    next(e);
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
});

// POST /api/pdftools/ocr — OCR PDF (ảnh scan) thành PDF tìm/copy được chữ, ưu tiên tiếng Việt.
pdftoolsRouter.post('/ocr', upload.single('file'), async (req: any, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu tệp PDF' });
  const dir = await mkdtemp(join(tmpdir(), 'ocr_'));
  try {
    const inPath = join(dir, 'in.pdf'), outPath = join(dir, 'out.pdf');
    await writeFile(inPath, req.file.buffer);
    // --skip-text: trang đã có chữ thì giữ nguyên, chỉ OCR trang ảnh. -l vie+eng: nhận cả tiếng Việt.
    await run('ocrmypdf', ['--skip-text', '-l', 'vie+eng', '--optimize', '0', inPath, outPath], { timeout: 280000, okCodes: [] });
    const out = await readFile(outPath);
    sendDl(res, out, safeBase(req.file.originalname) + '-ocr.pdf', 'pdf');
  } catch (e: any) {
    if (enoent(e)) return res.status(503).json({ error: 'Máy chủ chưa cài ocrmypdf — hãy rebuild backend.' });
    return res.status(422).json({ error: 'Không OCR được: ' + String(e?.stderr || e?.message || e).slice(0, 200) });
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
});

// POST /api/pdftools/encrypt?pw=... — đặt mật khẩu mở PDF (qpdf, AES-256).
pdftoolsRouter.post('/encrypt', upload.single('file'), async (req: any, res, next) => {
  const pw = String(req.query.pw || req.body?.pw || '');
  if (!req.file) return res.status(400).json({ error: 'Thiếu tệp PDF' });
  if (!pw) return res.status(400).json({ error: 'Thiếu mật khẩu' });
  const dir = await mkdtemp(join(tmpdir(), 'enc_'));
  try {
    const inPath = join(dir, 'in.pdf'), outPath = join(dir, 'out.pdf');
    await writeFile(inPath, req.file.buffer);
    await run('qpdf', ['--encrypt', pw, pw, '256', '--', inPath, outPath], { okCodes: [3] });
    const out = await readFile(outPath);
    sendDl(res, out, safeBase(req.file.originalname) + '-baomat.pdf', 'pdf');
  } catch (e: any) {
    if (enoent(e)) return res.status(503).json({ error: 'Máy chủ chưa cài qpdf — hãy rebuild backend.' });
    next(e);
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
});

// POST /api/pdftools/decrypt?pw=... — gỡ mật khẩu PDF (cần đúng mật khẩu hiện tại).
pdftoolsRouter.post('/decrypt', upload.single('file'), async (req: any, res, next) => {
  const pw = String(req.query.pw || req.body?.pw || '');
  if (!req.file) return res.status(400).json({ error: 'Thiếu tệp PDF' });
  const dir = await mkdtemp(join(tmpdir(), 'dec_'));
  try {
    const inPath = join(dir, 'in.pdf'), outPath = join(dir, 'out.pdf');
    await writeFile(inPath, req.file.buffer);
    await run('qpdf', ['--decrypt', `--password=${pw}`, inPath, outPath], { okCodes: [3] });
    const out = await readFile(outPath);
    sendDl(res, out, safeBase(req.file.originalname) + '-mo-khoa.pdf', 'pdf');
  } catch (e: any) {
    if (enoent(e)) return res.status(503).json({ error: 'Máy chủ chưa cài qpdf — hãy rebuild backend.' });
    return res.status(422).json({ error: 'Không gỡ được — sai mật khẩu hoặc tệp không mã hoá.' });
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
});
