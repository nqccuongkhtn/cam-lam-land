// LẬP DANH MỤC HỒ SƠ LƯU TRỮ (dùng tạm — dễ gỡ: xoá file này + 1 dòng đăng ký ở index.ts).
// Nhận PDF scan hồ sơ đất đai → render từng trang → AI đọc & phân tách văn bản → xuất Excel đúng mẫu danh mục.
// Khoá AI do ADMIN quản lý trong app_config (key 'danhmuc_ai'); nếu trống thì fallback biến môi trường.
import { Router } from 'express';
import multer from 'multer';
import { execFile } from 'node:child_process';
import { writeFile, readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { query } from '../lib/db.ts';
import { adminRequired, authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { BANK } from '../lib/packages.ts';

export const danhMucRouter = Router();
const DEFAULT_PRICE = Number(process.env.DANHMUC_PRICE || 568);   // giá mặc định mỗi trang (đồng)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 80 * 1024 * 1024 } });

const MAX_PAGES = Number(process.env.DANHMUC_MAX_PAGES || 60);      // trần số trang gửi AI (kiểm soát chi phí/thời gian)
const SCALE_TO = Number(process.env.DANHMUC_SCALE || 1500);        // cạnh dài mỗi ảnh trang (px) — đủ nét, gọn token

function run(cmd: string, args: string[], opts: any = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: opts.timeout || 180000, maxBuffer: 64 * 1024 * 1024 }, (err: any, stdout, stderr) => {
      if (err) { err.stderr = String(stderr || ''); return reject(err); }
      resolve(String(stdout || ''));
    });
  });
}
const enoent = (e: any) => /ENOENT/.test(String(e?.message || e));

// ── Cấu hình AI (khoá + model) — ưu tiên app_config (admin đặt), sau đó biến môi trường ──
type AiCfg = { apiKey: string; model: string; effort: string; enabled: boolean; pricePerPage: number; servicePricePerPage: number };
async function getAiCfg(): Promise<AiCfg> {
  let v: any = {};
  try { const r = await query<{ value: any }>('SELECT value FROM app_config WHERE key=$1', ['danhmuc_ai']); v = r[0]?.value || {}; } catch {}
  const apiKey = String(v.apiKey || process.env.ANTHROPIC_API_KEY || '');
  const model = String(v.model || process.env.AI_MODEL || 'claude-sonnet-5');
  const effort = String(v.effort || process.env.AI_EFFORT || 'low');   // low = nhanh, tiết kiệm token
  const enabled = v.enabled === undefined ? true : !!v.enabled;
  const pricePerPage = Number(v.pricePerPage ?? DEFAULT_PRICE);        // đồng/trang khi dùng KHOÁ CHUNG
  const servicePricePerPage = Number(v.servicePricePerPage ?? process.env.DANHMUC_SERVICE_PRICE ?? 200); // đồng/trang khi khách dùng KHOÁ RIÊNG (token khách tự trả)
  return { apiKey, model, effort, enabled, pricePerPage, servicePricePerPage };
}

// ── Khoá API RIÊNG theo user (mã hoá AES-256-GCM khi lưu; không bao giờ trả khoá gốc ra ngoài) ──
const ENC_KEY = createHash('sha256').update(String(process.env.KEY_SECRET || process.env.JWT_SECRET || 'camlam-danhmuc')).digest();
function encSecret(plain: string): string {
  const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function decSecret(b64: string): string {
  try {
    const raw = Buffer.from(b64, 'base64');
    const d = createDecipheriv('aes-256-gcm', ENC_KEY, raw.subarray(0, 12)); d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch { return ''; }
}
async function getUserKey(userId: number): Promise<string> {
  try { const r = await query<{ enc: string }>('SELECT enc FROM user_ai_keys WHERE user_id=$1', [userId]); return r[0]?.enc ? decSecret(r[0].enc) : ''; } catch { return ''; }
}

// ── Ví trả phí: số dư của người dùng (đồng) ──
async function getBalance(userId: number): Promise<number> {
  try { const r = await query<{ balance: string }>('SELECT balance FROM danhmuc_credits WHERE user_id=$1', [userId]); return Number(r[0]?.balance || 0); } catch { return 0; }
}
// Đếm số trang PDF nhanh bằng pdfinfo (không render).
async function pdfPageCount(buf: Buffer): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), 'dmc_'));
  try {
    const p = join(dir, 'in.pdf'); await writeFile(p, buf);
    const out = await run('pdfinfo', [p], { timeout: 30000 });
    const m = out.match(/Pages:\s*(\d+)/i); return m ? Number(m[1]) : 0;
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

// Đếm lượt dùng theo ngày (giờ VN) cho admin theo dõi — tái dùng bảng ocr_usage.
function ymdVN(): string { return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); }
function bump(): void { query(`INSERT INTO ocr_usage (engine, ymd, count) VALUES ('danhmuc', $1, 1) ON CONFLICT (engine, ymd) DO UPDATE SET count = ocr_usage.count + 1`, [ymdVN()]).catch(() => {}); }

// ── Chỉ dẫn nghiệp vụ cho AI (đóng vai cán bộ lưu trữ) — quy trình 3 lớp, kiểm tra chéo, không bỏ sót trang ──
const SYSTEM_PROMPT = `Bạn là cán bộ lưu trữ nhà nước, chuyên lập danh mục (mục lục) văn bản từ hồ sơ scan hành chính về đất đai của Việt Nam, độ chính xác cao.
NGUYÊN TẮC:
- Xử lý theo 3 lớp: (1) nhận diện ranh giới văn bản qua dấu hiệu thị giác (tiêu đề, quốc hiệu, số/ký hiệu, con dấu, chữ ký); (2) đọc kỹ trang đầu/trang có tiêu đề/số/ngày/chữ ký/con dấu/trang cuối; (3) kiểm tra chéo mỗi văn bản bằng ÍT NHẤT 2 tín hiệu độc lập trước khi chốt.
- Ranh giới MỚI khi: đổi số/ký hiệu HOẶC đổi tiêu đề/cơ quan HOẶC có khối chữ ký-con dấu kết thúc rồi sang trang định dạng khác.
- MỌI trang phải được gán vào một văn bản; không bỏ trang; không chồng lấn khoảng trang; phụ lục gộp vào văn bản mẹ; bản trùng chỉ giữ 1.
- Không chấp nhận số/ký hiệu, ngày, tiêu đề nếu mờ/không chắc — đối chiếu trang khác. Không bịa; không đọc được thì để trống.
- Trích yếu NGẮN GỌN 1–2 dòng (chủ thể + hành động + đối tượng), KHÔNG chép nguyên văn.
CHỈ TRẢ VỀ JSON hợp lệ (không giải thích, không markdown) theo schema:
{"nguoiSuDung": string, "soTo": string, "soThua": string, "hoSoTitle": string,
 "documents": [{"stt": number, "soKyHieu": string, "ngay": string (dd/mm/yyyy), "tacGia": string, "trichYeu": string, "toSo": string (vd "1" hoặc "13-15"), "ghiChu": string ("Bản chính"/"Bản photo")}]}
Trong đó nguoiSuDung = người sử dụng đất/chủ hồ sơ; soTo = số tờ bản đồ; soThua = số thửa (đọc từ mảnh trích đo/đơn đăng ký/giấy chứng nhận). hoSoTitle mặc định "Hồ sơ số 01 tập số ".`;

// VÍ DỤ THAM KHẢO (một hồ sơ cấp GCN điển hình ở xã Cam An Nam, huyện Cam Lâm) — trích từ danh mục mẫu đã lập.
// Dạy Claude VĂN PHONG trích yếu, cách ghi tên cơ quan/số & ký hiệu, thứ tự tài liệu thường gặp, cách gộp tờ (vd "13-15") và ghi chú (Bản chính/Bản photo).
// TUYỆT ĐỐI không chép nội dung ví dụ này vào kết quả — phải đọc đúng theo ảnh hồ sơ thực tế.
const FEWSHOT = `
VÍ DỤ THAM KHẢO (chỉ học văn phong & cách trình bày, KHÔNG sao chép nội dung — số liệu phải đọc từ ảnh thực tế):
Người sử dụng: Trịnh Quý — thửa 259, tờ bản đồ 18, xã Cam An Nam.
STT | Số, ký hiệu | Ngày | Tác giả | Trích yếu | Tờ số | Ghi chú
1 | 1012402373 | 10/12/2024 | Bộ phận TN và TKQ | Giấy tiếp nhận hồ sơ và hẹn trả KQ | 1 | Bản chính
2 | 1012402373 | 10/01/2025 | Bộ phận TN và TKQ | Giấy tiếp nhận hồ sơ và hẹn trả KQ | 2 | Bản chính
3 | 19/TTr-TNMT | 14/01/2025 | Phòng TN&MT huyện Cam Lâm | Tờ trình v/v cấp GCNQSDĐ, quyền sở hữu tài sản gắn liền với đất cho ông Trịnh Quý và bà Thái Thị Bích Phượng đối với thửa đất số 259, tờ bản đồ số 18 tại xã Cam An Nam | 3 | Bản chính
4 | 04/TB-ĐKĐĐ | 06/01/2025 | Phòng TN&MT huyện Cam Lâm | Thông báo xác nhận kết quả đăng ký đất đai | 4 | Bản chính
5 | Phụ lục số 13-TT25 | 06/01/2025 | Phòng TN&MT huyện Cam Lâm | Trích lục bản đồ địa chính | 5 | Bản chính
6 | 02/PCTTĐC | 07/01/2025 | Phòng TN&MT huyện Cam Lâm | Phiếu chuyển thông tin để xác định NVTC về đất đai | 6 | Bản chính
7 | Mẫu số 04/ĐK | 26/11/2024 | Trịnh Quý | Đơn đăng ký đất đai, tài sản gắn liền với đất | 7 | Bản chính
8 | 206 QS01-SCT/CK,ĐC | 02/12/2024 | UBND xã Cam An Nam | Giấy ủy quyền | 8 | Bản chính
9 | Mẫu số 04a/ĐK | 26/11/2024 | Thái Thị Bích Phượng | Danh sách những người sử dụng chung thửa đất, sở hữu chung tài sản gắn liền với đất | 9 | Bản chính
10 |  | 09/01/2024 |  | Bản mô tả ranh giới, mốc giới thửa đất | 10 | Bản photo
11 |  | 13/05/2024 | CN VPĐKĐĐ huyện Cam Lâm | Phiếu xác nhận kết quả đo đạc hiện trạng thửa đất | 11 | Bản chính
12 |  | 30/05/2024 | CN VPĐKĐĐ huyện Cam Lâm | Mảnh trích đo địa chính số 41-2024 | 12 | Bản chính
13 |  | 28/12/2024 | UBND xã Cam An Nam | Biên bản kết thúc niêm yết hồ sơ đăng ký, cấp GCN (kèm danh sách) | 13-15 | Bản photo
14 | 1380/TTr-UBND | 28/12/2024 | UBND xã Cam An Nam | Tờ trình v/v đăng ký đất đai, tài sản gắn liền với đất cho ông Trịnh Quý đối với thửa đất số 259, tờ bản đồ số 18, diện tích 124,3m2 | 16-18 | Bản photo
15 | 14/BB-HĐĐK | 12/12/2024 | UBND xã Cam An Nam | Biên bản của Hội đồng ĐKĐĐ lần đầu đối với hồ sơ ĐKĐĐ, tài sản gắn liền với đất của ông Trịnh Quý | 19-20 | Bản photo
16 | LTB2551117-TK0000436/TB-CCT | 08/01/2025 | Chi cục thuế KV Nam Khánh Hòa | Thông báo nộp tiền về lệ phí trước bạ nhà đất | 21 | Bản photo
Nhận xét: giữ nguyên số & ký hiệu gốc kể cả dạng lạ; một số giấy tờ (bản mô tả ranh giới, phiếu đo đạc, mảnh trích đo) không có số ký hiệu thì để trống; tài liệu nhiều trang thì gộp tờ (13-15, 16-18); bản sao ghi "Bản photo".`;

// ── Hàng đợi giới hạn số job chạy đồng thời (tránh vượt hạn mức token/phút của 1 khoá → 429) ──
const MAX_CONCURRENT = Number(process.env.DANHMUC_CONCURRENCY || 2); // số job gọi AI cùng lúc tối đa
const MAX_QUEUE = Number(process.env.DANHMUC_QUEUE || 10);          // số job xếp hàng chờ tối đa
let active = 0; const waiters: Array<() => void> = [];
function acquireSlot(): Promise<boolean> {
  if (active < MAX_CONCURRENT) { active++; return Promise.resolve(true); }
  if (waiters.length >= MAX_QUEUE) return Promise.resolve(false);   // hàng đợi đầy → báo bận
  return new Promise((resolve) => waiters.push(() => { active++; resolve(true); }));
}
function releaseSlot(): void { active = Math.max(0, active - 1); const n = waiters.shift(); if (n) n(); }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Gọi AI vision với TẤT CẢ trang trong 1 lượt; tự thử lại khi quá tải (429/529/5xx) ──
async function callClaudeVision(cfg: AiCfg, pages: Buffer[], apiKey: string): Promise<any> {
  const content: any[] = [{ type: 'text', text: `Hồ sơ gồm ${pages.length} trang (đánh số 1..${pages.length}). Hãy lập danh mục theo yêu cầu và chỉ trả JSON.` }];
  pages.forEach((buf, i) => {
    content.push({ type: 'text', text: `Trang ${i + 1}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: buf.toString('base64') } });
  });
  const body = JSON.stringify({ model: cfg.model, max_tokens: 8000, output_config: { effort: cfg.effort }, system: SYSTEM_PROMPT + '\n' + FEWSHOT, messages: [{ role: 'user', content }] });
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: any;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body, signal: AbortSignal.timeout(Number(process.env.DANHMUC_TIMEOUT_MS || 240000)),
      });
    } catch (e) { lastErr = e; throw e; } // lỗi mạng / hết giờ: không thử lại (có thể đã tính token)
    if (res.ok) {
      const j: any = await res.json();
      const text = String(j?.content?.map((p: any) => p?.text).filter(Boolean).join('\n') || '');
      const mm = text.match(/\{[\s\S]*\}/); // gỡ rào ```json nếu có
      if (!mm) throw new Error('NO_DOCS');
      return JSON.parse(mm[0]);
    }
    const status = res.status;
    const txt = await res.text().catch(() => '');
    // Quá tải / lỗi tạm thời phía AI → CHỜ rồi thử lại (chưa tốn token). Hết lần thử mới ném lỗi.
    if ((status === 429 || status === 529 || status >= 500) && attempt < 2) { lastErr = new Error('UPSTREAM ' + status); await sleep(1500 * (attempt + 1)); continue; }
    throw new Error('UPSTREAM ' + status + ': ' + txt.slice(0, 200));
  }
  throw lastErr || new Error('UPSTREAM fail');
}

// ── Dựng Excel đúng mẫu danh mục (Times New Roman, 7 cột, viền mảnh) ──
const thin = { style: 'thin' as const };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
async function buildXlsx(data: any): Promise<Buffer> {
  // Nạp "lười" exceljs: thiếu thư viện KHÔNG làm sập server lúc khởi động, chỉ tính năng này báo lỗi.
  let ExcelJS: any;
  try { ExcelJS = (await import('exceljs')).default; }
  catch { throw new Error('MISSING_EXCELJS'); }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Nhi');
  const widths = [5.43, 30.57, 14.14, 28.14, 60, 8.86, 12];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const F = (size: number, bold = false, italic = false) => ({ name: 'Times New Roman', size, bold, italic });
  // Tiêu đề hồ sơ + người sử dụng (gộp ô A:G)
  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = String(data.hoSoTitle || 'Hồ sơ số 01 tập số ');
  ws.getCell('A2').font = F(10, true); ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'center' };
  ws.mergeCells('A3:G3');
  ws.getCell('A3').value = `(Người sử dụng: ${data.nguoiSuDung || ''})`;
  ws.getCell('A3').font = F(10, true); ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'center' };
  // Hàng tiêu đề cột
  const hdr = ['Số TT', 'Số, ký hiệu', 'Ngày tháng văn bản', 'Tác giả văn bản', 'Trích yếu ND văn bản', 'Tờ số', 'Ghi chú'];
  hdr.forEach((t, i) => { const c = ws.getCell(4, i + 1); c.value = t; c.font = F(10, true); c.alignment = { horizontal: 'center', vertical: 'center', wrapText: true }; c.border = BORDER; });
  // Hàng phân loại "Văn bản"
  for (let i = 1; i <= 7; i++) ws.getCell(5, i).border = BORDER;
  ws.getCell(5, 2).value = 'Văn bản'; ws.getCell(5, 2).font = F(10, true); ws.getCell(5, 2).alignment = { horizontal: 'center', vertical: 'center' };
  // Hàng đánh số cột 1..7
  for (let i = 1; i <= 7; i++) { const c = ws.getCell(6, i); c.value = i; c.font = F(10); c.alignment = { horizontal: 'center', vertical: 'center' }; c.border = BORDER; }
  // Dữ liệu văn bản
  let r = 7;
  const docs: any[] = Array.isArray(data.documents) ? data.documents : [];
  docs.forEach((d, idx) => {
    const vals = [d.stt ?? idx + 1, d.soKyHieu ?? '', d.ngay ?? '', d.tacGia ?? '', d.trichYeu ?? '', d.toSo ?? '', d.ghiChu ?? ''];
    for (let c = 1; c <= 7; c++) {
      const cell = ws.getCell(r, c); cell.value = vals[c - 1] as any; cell.font = F(11); cell.border = BORDER;
      const left = c === 4 || c === 5;
      cell.alignment = { horizontal: left ? 'left' : 'center', vertical: 'center', wrapText: left };
    }
    r++;
  });
  // Chân trang: Người lập hồ sơ
  r += 1;
  const fc = ws.getCell(r, 6); fc.value = 'Người lập hồ sơ'; fc.font = F(11, true, true); fc.alignment = { horizontal: 'center' };
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as any);
}

const safe = (n: string) => String(n || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

// GET /api/danh-muc/wallet — số dư + giá/trang + có phải admin (admin miễn phí).
danhMucRouter.get('/wallet', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const cfg = await getAiCfg();
    const isAdmin = req.user?.role === 'admin';
    const unit = isAdmin ? 0 : cfg.pricePerPage;
    res.json({ balance: await getBalance(req.user!.id), pricePerPage: unit, isAdmin, enabled: cfg.enabled, hasKey: !!cfg.apiKey });
  } catch (e) { next(e); }
});

// GET /api/danh-muc/mykey — trạng thái khoá RIÊNG của user (che khoá).
danhMucRouter.get('/mykey', authRequired, async (req: AuthedRequest, res, next) => {
  try { const k = await getUserKey(req.user!.id); res.json({ hasKey: !!k, keyHint: k ? '••••' + k.slice(-4) : '' }); } catch (e) { next(e); }
});
// POST /api/danh-muc/mykey — lưu/xoá khoá RIÊNG. {apiKey} để lưu; {clear:true} để xoá.
danhMucRouter.post('/mykey', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const uid = req.user!.id;
    if (req.body?.clear === true) { await query('DELETE FROM user_ai_keys WHERE user_id=$1', [uid]); return res.json({ ok: true, cleared: true }); }
    const k = String(req.body?.apiKey || '').trim();
    if (!k.startsWith('sk-ant-') || k.length < 20) return res.status(400).json({ error: 'Khoá API không hợp lệ (phải bắt đầu bằng sk-ant-).' });
    await query(`INSERT INTO user_ai_keys (user_id, enc, updated_at) VALUES ($1,$2,now()) ON CONFLICT (user_id) DO UPDATE SET enc=EXCLUDED.enc, updated_at=now()`, [uid, encSecret(k)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/danh-muc/topup — tạo đơn NẠP VÍ, trả nội dung chuyển khoản (VietQR). Tự cộng tiền qua webhook/admin xác nhận.
danhMucRouter.post('/topup', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const amount = Math.round(Number(req.body?.amount || 0));
    if (!Number.isFinite(amount) || amount < 10000) return res.status(400).json({ error: 'Số tiền nạp tối thiểu 10.000đ' });
    if (amount > 50000000) return res.status(400).json({ error: 'Số tiền nạp quá lớn' });
    const [o] = await query(`INSERT INTO payments (user_id, package_id, amount, status) VALUES ($1,'wallet',$2,'pending') RETURNING id`, [req.user!.id, amount]);
    const note = `CLL${o.id}`;
    await query(`UPDATE payments SET note=$2 WHERE id=$1`, [o.id, note]);
    res.status(201).json({ orderId: o.id, amount, note, bank: BANK });
  } catch (e) { next(e); }
});

// POST /api/danh-muc/quote — đếm trang & tính phí (KHÔNG chạy AI, KHÔNG trừ tiền) để hiển thị trước.
danhMucRouter.post('/quote', authRequired, upload.single('file'), async (req: any, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu tệp PDF' });
    const cfg = await getAiCfg();
    const isAdmin = req.user?.role === 'admin';
    const pages = await pdfPageCount(req.file.buffer);
    if (!pages) return res.status(422).json({ error: 'Không đọc được số trang (tệp hỏng hoặc không phải PDF).' });
    if (pages > MAX_PAGES) return res.status(413).json({ error: `Hồ sơ ${pages} trang vượt giới hạn ${MAX_PAGES} trang/lần. Hãy tách nhỏ rồi thử lại.`, pages });
    const unit = isAdmin ? 0 : cfg.pricePerPage;
    const cost = pages * unit;
    const balance = await getBalance(req.user!.id);
    res.json({ pages, pricePerPage: unit, cost, balance, isAdmin, enough: isAdmin || balance >= cost });
  } catch (e: any) {
    if (enoent(e)) return res.status(503).json({ error: 'Máy chủ chưa cài poppler-utils (pdfinfo) — hãy rebuild backend.' });
    next(e);
  }
});

// POST /api/danh-muc/run — nhận PDF, TRỪ PHÍ theo trang (admin miễn phí) rồi lập danh mục, trả file Excel.
danhMucRouter.post('/run', authRequired, upload.single('file'), async (req: any, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu tệp PDF' });
  const cfg = await getAiCfg();
  if (!cfg.enabled) return res.status(503).json({ error: 'Tính năng đang tạm tắt (liên hệ quản trị).' });
  const uid = req.user!.id;
  const isAdmin = req.user?.role === 'admin';
  const ownKey = isAdmin ? '' : await getUserKey(uid); // khách được admin GÁN khoá riêng → chạy bằng khoá đó (để theo dõi/thu hồi riêng)
  const effKey = ownKey || cfg.apiKey;                 // chưa gán → dùng khoá chung
  if (!effKey) return res.status(503).json({ error: 'Dịch vụ chưa sẵn sàng. Vui lòng liên hệ quản trị viên.' });
  const dir = await mkdtemp(join(tmpdir(), 'dm_'));
  let cost = 0, deducted = false, slotHeld = false;
  try {
    const inPath = join(dir, 'in.pdf');
    await writeFile(inPath, req.file.buffer);
    // Render mỗi trang PDF -> PNG (poppler), giới hạn cạnh dài để gọn token.
    await run('pdftoppm', ['-png', '-scale-to', String(SCALE_TO), inPath, join(dir, 'page')], { timeout: 180000 });
    const files = (await readdir(dir)).filter((f) => /^page-?\d+\.png$/.test(f))
      .sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10)));
    if (!files.length) return res.status(422).json({ error: 'Không đọc được trang nào từ PDF (tệp hỏng hoặc không phải PDF).' });
    if (files.length > MAX_PAGES) return res.status(413).json({ error: `Hồ sơ ${files.length} trang vượt giới hạn ${MAX_PAGES} trang/lần. Hãy tách nhỏ rồi thử lại.` });
    const nPages = files.length;
    // XẾP HÀNG: giới hạn số job gọi AI đồng thời để không vượt hạn mức khoá. Hàng đợi đầy → báo bận (chưa trừ tiền).
    slotHeld = await acquireSlot();
    if (!slotHeld) return res.status(503).json({ error: 'Hệ thống đang bận (nhiều người dùng cùng lúc). Vui lòng thử lại sau ít phút.' });
    // TRỪ TIỀN TRƯỚC KHI CHẠY (admin miễn phí). Khoá do NỀN TẢNG cấp (bạn trả token) → luôn thu giá đầy đủ.
    cost = isAdmin ? 0 : nPages * cfg.pricePerPage;
    if (!isAdmin && cost > 0) {
      const rows = await query<{ balance: string }>(`UPDATE danhmuc_credits SET balance = balance - $2, updated_at=now() WHERE user_id=$1 AND balance >= $2 RETURNING balance`, [uid, cost]);
      if (!rows.length) return res.status(402).json({ error: 'Số dư không đủ. Vui lòng nạp thêm tiền vào ví.', pages: nPages, cost, balance: await getBalance(uid) });
      deducted = true;
    }
    const pages = await Promise.all(files.map((f) => readFile(join(dir, f))));
    const data = await callClaudeVision(cfg, pages, effKey);
    if (!Array.isArray(data?.documents) || !data.documents.length) throw new Error('NO_DOCS');
    const buf = await buildXlsx(data);
    bump();
    query(`INSERT INTO danhmuc_jobs (user_id, pages, cost, doc_count) VALUES ($1,$2,$3,$4)`, [uid, nPages, cost, data.documents.length]).catch(() => {});
    const name = `${safe(data.nguoiSuDung) || 'Ho so'} - Sheet ${safe(data.soTo) || 'x'} - Parcel ${safe(data.soThua) || 'x'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    res.setHeader('X-Doc-Count', String(data.documents.length));
    res.setHeader('X-Cost', String(cost));
    res.send(buf);
  } catch (e: any) {
    const m = String(e?.message || e);
    // CHỈ HOÀN TIỀN khi CHƯA tốn token của AI (lỗi trước khi gọi Claude, sai khoá bị từ chối, thiếu thư viện xuất file).
    // Nếu AI ĐÃ chạy (không ra kết quả / quá giờ / lỗi giữa chừng) → token đã bị tính → KHÔNG hoàn (không để chủ dịch vụ lỗ).
    // Lỗi phía AI (sai khoá / quá tải / lỗi máy chủ AI) đều CHƯA tính token → hoàn tiền. Chỉ NO_DOCS & hết-giờ là đã tốn token.
    const noTokenSpent = enoent(e) || /UPSTREAM (401|429|5\d\d)|overloaded|invalid x-api-key|MISSING_EXCELJS/i.test(m);
    if (deducted && cost > 0 && noTokenSpent) { await query(`UPDATE danhmuc_credits SET balance = balance + $2, updated_at=now() WHERE user_id=$1`, [uid, cost]).catch(() => {}); }
    if (/NO_DOCS/.test(m)) return res.status(422).json({ error: 'Chưa nhận diện được văn bản nào. Bản scan có thể quá mờ hoặc thiếu trang — hãy chụp/scan rõ hơn rồi thử lại.' });
    if (/MISSING_EXCELJS/.test(m)) return res.status(503).json({ error: 'Dịch vụ chưa sẵn sàng (đã hoàn tiền). Vui lòng liên hệ quản trị.' });
    if (enoent(e)) return res.status(503).json({ error: 'Dịch vụ chưa sẵn sàng. Vui lòng liên hệ quản trị.' });
    if (/UPSTREAM (429|529)|overloaded/i.test(m)) return res.status(503).json({ error: 'Hệ thống đang bận (đã hoàn tiền). Vui lòng thử lại sau ít phút.' });
    if (/UPSTREAM 401|invalid x-api-key/i.test(m)) return res.status(502).json({ error: 'Dịch vụ tạm gián đoạn (đã hoàn tiền). Vui lòng thử lại sau hoặc liên hệ quản trị.' });
    if (/aborted|timeout/i.test(m)) return res.status(504).json({ error: 'Xử lý quá lâu, hồ sơ chưa xong. Hãy tách nhỏ số trang rồi thử lại.' });
    console.error('[danhmuc] run lỗi:', m);
    return res.status(500).json({ error: 'Lập danh mục thất bại, vui lòng thử lại sau.' });
  } finally { if (slotHeld) releaseSlot(); rm(dir, { recursive: true, force: true }).catch(() => {}); }
});

// GET /api/danh-muc/config — (admin) lấy cấu hình, KHÔNG lộ khoá (chỉ báo đã đặt + 4 ký tự cuối).
danhMucRouter.get('/config', adminRequired, async (_req, res, next) => {
  try {
    const cfg = await getAiCfg();
    const envKey = !!process.env.ANTHROPIC_API_KEY;
    res.json({ enabled: cfg.enabled, model: cfg.model, effort: cfg.effort, pricePerPage: cfg.pricePerPage, servicePricePerPage: cfg.servicePricePerPage, hasKey: !!cfg.apiKey, keyHint: cfg.apiKey ? '••••' + cfg.apiKey.slice(-4) : '', usingEnvKey: envKey });
  } catch (e) { next(e); }
});

// POST /api/danh-muc/config — (admin) lưu khoá + model + bật/tắt. Bỏ trống apiKey = giữ khoá cũ; 'apiKey'==='' + clear=true để xoá.
danhMucRouter.post('/config', adminRequired, async (req, res, next) => {
  try {
    const body = req.body || {};
    const cur = (await query<{ value: any }>('SELECT value FROM app_config WHERE key=$1', ['danhmuc_ai']))[0]?.value || {};
    const nv: any = { ...cur };
    if (typeof body.model === 'string' && body.model.trim()) nv.model = body.model.trim();
    if (typeof body.effort === 'string' && ['low', 'medium', 'high', 'xhigh', 'max'].includes(body.effort)) nv.effort = body.effort;
    if (body.pricePerPage !== undefined && Number.isFinite(Number(body.pricePerPage)) && Number(body.pricePerPage) >= 0) nv.pricePerPage = Math.round(Number(body.pricePerPage));
    if (body.servicePricePerPage !== undefined && Number.isFinite(Number(body.servicePricePerPage)) && Number(body.servicePricePerPage) >= 0) nv.servicePricePerPage = Math.round(Number(body.servicePricePerPage));
    if (typeof body.enabled === 'boolean') nv.enabled = body.enabled;
    if (body.clearKey === true) nv.apiKey = '';
    else if (typeof body.apiKey === 'string' && body.apiKey.trim()) nv.apiKey = body.apiKey.trim();
    await query(`INSERT INTO app_config (key, value, updated_at) VALUES ('danhmuc_ai', $1::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [JSON.stringify(nv)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
