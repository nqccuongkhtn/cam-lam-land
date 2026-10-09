import express from 'express';
import cors from 'cors';
import compression from 'compression';
import http from 'node:http';
import { initWs } from './lib/ws.ts';
import { env } from './lib/env.ts';
import { waitForDb, query } from './lib/db.ts';
import { ensureAdmin } from './lib/ensureAdmin.ts';
import { bootstrap } from './lib/bootstrap.ts';
import { migrate } from './lib/migrate.ts';
import { authRequired } from './middleware/auth.ts';
import { moiGioiCnRouter } from './routes/moiGioiCn.ts';
import { theoDoiRouter, ghiHoatDong, khoiTaoTheoDoi } from './routes/theoDoiTk.ts'; // THEO DÕI TÀI KHOẢN (tạm — dễ gỡ)
import { authRouter } from './routes/auth.ts';
import { passkeyRouter } from './routes/passkey.ts';
import { listingsRouter } from './routes/listings.ts';
import { layersRouter } from './routes/layers.ts';
import { parcelsRouter } from './routes/parcels.ts';
import { diaChinhRouter } from './routes/diaChinh.ts'; // BẢN ĐỒ ĐỊA CHÍNH toàn tỉnh (ô vector + chống cào)
import { importsRouter } from './routes/imports.ts';
import { imagesRouter } from './routes/images.ts';
import { adminRouter } from './routes/admin.ts';
import { qrRouter } from './routes/qr.ts';
import { mapAdsRouter } from './routes/mapAds.ts';
import { partnersRouter } from './routes/partners.ts';
import { logoLeRouter } from './routes/logoLe.ts';
import { projectsRouter } from './routes/projects.ts';
import { consignmentsRouter } from './routes/consignments.ts';
import { investRouter } from './routes/invest.ts';
import { gameRouter } from './routes/game.ts';
import { pushRouter } from './routes/push.ts';
import { paymentsRouter } from './routes/payments.ts';
import { flagsRouter } from './routes/flags.ts';
import { newsRouter, refreshNews } from './routes/news.ts';
import { newsletterRouter } from './routes/newsletter.ts';
import { vanBanRouter, seedVanBan, crawlCongBao, crawlPortals, crawlCamhomes, crawlSheets, timFileThieu, taiSanFile } from './routes/vanBan.ts';
import { configRouter } from './routes/config.ts';
import { savedPlacesRouter } from './routes/savedPlaces.ts';
import { crmRouter } from './routes/crm.ts';
import { sendSms, smsConfigured } from './lib/sms.ts';
import { trafficRouter } from './routes/traffic.ts';
import { vapidPublicKey } from './lib/push.ts';
import { chatRouter } from './routes/chat.ts';
import { ocrRouter } from './routes/ocr.ts';
import { hotlistRouter } from './routes/hotlist.ts'; // ĐẤT NÓNG (dùng tạm — dễ gỡ)
import { chiDuongRouter } from './routes/chiDuong.ts'; // CHỈ ĐƯỜNG NHIỀU TUYẾN (dùng tạm — dễ gỡ)
import { doCaoRouter } from './routes/doCao.ts'; // TRA ĐỘ CAO MẶT ĐẤT — biết chỗ nào là biển (dùng tạm — dễ gỡ)
import { pdftoolsRouter } from './routes/pdftools.ts'; // CÔNG CỤ PDF máy chủ (dùng tạm — dễ gỡ)
import { danhMucRouter } from './routes/danhMuc.ts'; // LẬP DANH MỤC HỒ SƠ (dùng tạm — dễ gỡ)
import { totpRouter } from './routes/totp.ts'; // TRA MÃ XÁC THỰC 2 LỚP (dùng tạm — dễ gỡ)
import { khoHoSoRouter, khoUploadRouter } from './routes/khoHoSo.ts'; // KHO HỒ SƠ — thư mục cất file danh mục (dùng tạm — dễ gỡ)
import { aiScriptRouter } from './routes/aiScript.ts'; // AI VIẾT KỊCH BẢN VIDEO (dùng chung khoá AI, dễ gỡ)
// TẠO VIDEO BẢN ĐỒ: xử lý HOÀN TOÀN trên máy khách (ffmpeg.wasm) — KHÔNG có endpoint máy chủ (không nhận/không lưu video).
import { tilesRouter } from './routes/tiles.ts'; // PROXY tile ảnh vệ tinh (sạch CORS để quay được video)
import { notFound, errorHandler } from './middleware/error.ts';
import { securityHeaders, rateLimit } from './middleware/security.ts';
import { logError, requestLogger } from './lib/logger.ts';

// CHỐNG RỚT TIẾN TRÌNH: GHI LOG (file + console) lỗi không bắt được thay vì để Node thoát.
process.on('unhandledRejection', (reason: any) => logError('[unhandledRejection] ' + ((reason && (reason.stack || reason.message)) || reason)));
process.on('uncaughtException', (err: any) => logError('[uncaughtException] ' + ((err && (err.stack || err.message)) || err)));

const app = express();
app.disable('x-powered-by'); // không lộ "Express"
app.set('trust proxy', 1);   // Render đứng sau proxy → lấy đúng IP khách cho rate-limit
app.use(compression());
// CORS allowlist: chỉ cho phép frontend (onrender.com), localhost dev, và origin cấu hình qua CORS_ORIGINS.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin, app di động, health-check
    try {
      const host = new URL(origin).hostname;
      if (CORS_ORIGINS.includes(origin) || host === 'localhost' || host === '127.0.0.1' || /\.onrender\.com$/.test(host)) return cb(null, true);
    } catch { /* origin lạ, bỏ qua */ }
    return cb(null, false); // ngoài allowlist → trình duyệt chặn
  },
  credentials: true,
  // Cho trình duyệt ĐỌC được hai tiêu đề này khi web và API khác tên miền (Render):
  // Content-Disposition = tên tệp tải về · X-Da-OCR = đã phải nhận dạng chữ trước khi chuyển đổi.
  exposedHeaders: ['Content-Disposition', 'X-Da-OCR', 'X-O-Ngo', 'X-Da-Sua'],
}));
app.use(securityHeaders);
app.use(requestLogger); // ghi log request LỖI (5xx) hoặc CHẬM (>2s) ra file access-*.log
app.use(express.json({ limit: '5mb' }));
// PROXY TILE ẢNH VỆ TINH — đặt TRƯỚC rate-limit toàn cục (1 phiên bản đồ tải rất nhiều tile, không được tính vào giới hạn).
app.use('/api', ghiHoatDong); // THEO DÕI TÀI KHOẢN (tạm — dễ gỡ): đặt TRƯỚC /api/dc để ghi được cả tra số tờ/thửa; chỉ ghi tài khoản trong danh sách
app.use('/api/tiles', tilesRouter);
// BẢN ĐỒ ĐỊA CHÍNH — cũng đặt TRƯỚC giới hạn toàn cục vì một phiên xem bản đồ tải rất nhiều ô.
// Đường này TỰ CÓ bộ khoá chống cào riêng bên trong (vé xem + hạn mức + đo độ phủ),
// chặt hơn giới hạn toàn cục rất nhiều nên không cần cộng dồn vào đó.
// Ba đường /ve, /danh-muc, /tim là đường "hỏi đáp" nên siết vừa phải; còn đường lấy Ô BẢN ĐỒ
// (/api/dc/16/x/y) thì bỏ qua ở đây vì một phiên xem tải rất nhiều ô — ô đã có bộ khoá riêng bên trong.
app.use('/api/dc', rateLimit({ windowMs: 60 * 1000, max: 90, key: 'dc-hoi',
  skip: (req) => /^\/\d+\/\d+\/\d+/.test(req.path),
  message: 'Bạn tra cứu quá nhanh. Vui lòng chậm lại một chút.' }), diaChinhRouter);
// Chống lụt yêu cầu toàn cục (rộng rãi, không cản người dùng thật).
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: Number(process.env.RATE_LIMIT_GLOBAL) || 600, key: 'global' })); // đặt RATE_LIMIT_GLOBAL cao khi ĐO TẢI
app.use('/api/theo-doi', theoDoiRouter);   // báo cáo cho admin (THEO DÕI TÀI KHOẢN — tạm, dễ gỡ)

// /api/ping — siêu nhẹ cho uptime monitor (KHÔNG đụng DB, trả 200 tức thì).
app.get('/api/ping', (_req, res) => res.status(200).type('text/plain').send('ok'));
// /api/health — kiểm tra CẢ DB (SELECT 1, timeout 3s): 200 nếu khoẻ, 503 nếu DB lỗi → giám sát bắt được sự cố.
app.get('/api/health', async (_req, res) => {
  const t0 = Date.now();
  try {
    await Promise.race([query('SELECT 1'), new Promise((_r, rej) => setTimeout(() => rej(new Error('db timeout 3s')), 3000))]);
    res.json({ status: 'ok', db: 'up', dbMs: Date.now() - t0, uptimeSec: Math.round(process.uptime()), region: 'Cam Lâm, Khánh Hòa', ts: Date.now() });
  } catch (e: any) {
    logError('[health] DB không phản hồi: ' + (e?.message || e));
    res.status(503).json({ status: 'degraded', db: 'down', error: e?.message || String(e), uptimeSec: Math.round(process.uptime()), ts: Date.now() });
  }
});
app.get('/api/config', (_req, res) => {
  const ext = process.env.RENDER_EXTERNAL_URL || '';
  const host = ext.replace(/^https?:\/\//, '');
  res.json({ wsUrl: host ? `wss://${host}/ws` : '', vapidPublic: vapidPublicKey });
});
// Chống brute-force: CHỈ tính POST (đăng nhập/đăng ký). GET /auth/me (kiểm tra phiên mỗi lần tải trang) KHÔNG bị tính → refresh nhiều không bị khoá. Email admin luôn được bỏ qua.
// ⛔ 29/9/2026 (rà soát bảo mật): BỎ email admin khỏi danh sách miễn đếm. Miễn đếm cho admin nghĩa là
//    kẻ xấu được THỬ MẬT KHẨU ADMIN KHÔNG GIỚI HẠN — đúng tài khoản cần bảo vệ nhất. Cần miễn cho ai thì
//    khai rõ trong RATE_LIMIT_SKIP_EMAILS.
const AUTH_SKIP_EMAILS = new Set([...((process.env.RATE_LIMIT_SKIP_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))]);
// 9/10/2026: CHỈ đếm lượt ĐĂNG NHẬP / ĐĂNG KÝ thật. Trước đây đếm mọi POST, nên tín hiệu "đang mở web"
// (POST /auth/ping, mỗi 45 giây/tab) ăn hết hạn mức → người chung mạng (gia đình, công ty) bấm Đăng nhập bị chặn oan
// (48 giờ có 153 lần). Ping cần đăng nhập sẵn nên không dùng để đoán mật khẩu được.
const DEM_AUTH = /^\/(login|register)\/?$/;
app.use('/api/auth', rateLimit({ windowMs: 10 * 60 * 1000, max: 60, key: 'auth', skip: (req) => req.method !== 'POST' || !DEM_AUTH.test(req.path) || AUTH_SKIP_EMAILS.has(String((req.body as any)?.email || '').trim().toLowerCase()), message: 'Quá nhiều lần thử đăng nhập/đăng ký. Vui lòng đợi vài phút rồi thử lại.' }), authRouter);
// Đăng nhập bằng vân tay / khuôn mặt (passkey). Đặt TRƯỚC /api/auth để không dính
// bộ đếm số lần thử của đăng nhập mật khẩu — mỗi lần chạm vân tay là một lượt gọi,
// mà thao tác này không đoán mò được nên không cần siết như mật khẩu.
app.use('/api/passkey', rateLimit({ windowMs: 10 * 60 * 1000, max: 120, key: 'passkey',
  message: 'Thử vân tay quá nhiều lần. Đợi vài phút rồi thử lại.' }), passkeyRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/moi-gioi-cn', moiGioiCnRouter); // xin / duyệt MÔI GIỚI CHUYÊN NGHIỆP
app.use('/api/layers', layersRouter);
// Bấm vào thửa để xem thông tin: người thật bấm nhiều lắm cũng vài lần mỗi giây, còn máy cào
// thì gọi liên tục. 150 lần/phút là rất rộng rãi với người dùng nhưng chặn đứng kiểu quét tự động.
app.use('/api/parcels', rateLimit({ windowMs: 60 * 1000, max: 150, key: 'thua',
  message: 'Bạn xem thửa quá nhanh. Vui lòng chậm lại một chút.' }), parcelsRouter);
app.use('/api/imports', importsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/qr', authRequired, qrRouter); // Tiện ích — lớp bảo mật 1: phải đăng nhập
app.use('/api/map-ads', mapAdsRouter);
app.use('/api/partners', partnersRouter);
app.use('/api/logo-le', logoLeRouter); // LỊCH ĐỔI LOGO NGÀY LỄ (dùng tạm — dễ gỡ)
app.use('/api/projects', projectsRouter);
app.use('/api/consignments', consignmentsRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/invest', investRouter);
app.use('/api/game', gameRouter);
// Gửi ảnh/PDF trong chat: 30 tệp/10 phút mỗi máy — đủ cho trao đổi giấy tờ bình thường,
// chặn được kiểu nhồi file cho phình database. ĐẶT TRƯỚC router chat mới ăn.
app.use('/api/chat/file', rateLimit({ windowMs: 10 * 60 * 1000, max: 30, key: 'chatfile', message: 'Bạn gửi tệp quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.',
  skip: (req) => req.method !== 'POST' })); // chỉ đếm lượt GỬI — xem lại ảnh cũ không được tính
app.use('/api/chat', chatRouter);
app.use('/api/ocr', rateLimit({ windowMs: 10 * 60 * 1000, max: 60, key: 'ocr', message: 'Bạn quét ảnh quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.' }), ocrRouter);
app.use('/api/push', pushRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/flags', flagsRouter);
app.use('/api/news', newsRouter);
app.use('/api/van-ban', vanBanRouter);
app.use('/api/config', configRouter);
app.use('/api/saved-places', savedPlacesRouter);
app.use('/api/crm', crmRouter);
app.use('/api/hotlist', hotlistRouter); // ĐẤT NÓNG (dùng tạm — dễ gỡ)
// Chỉ đường: 120 lượt/10 phút cho mỗi máy — đủ dùng thoải mái, chặn kẻ quét hàng loạt làm máy tìm đường miễn phí chặn IP của ta.
app.use('/api/do-cao', doCaoRouter); // TRA ĐỘ CAO MẶT ĐẤT (dùng tạm — dễ gỡ)
app.use('/api/chi-duong', rateLimit({ windowMs: 10 * 60 * 1000, max: 120, key: 'chiduong', message: 'Bạn tìm đường quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.' }), chiDuongRouter); // CHỈ ĐƯỜNG NHIỀU TUYẾN (dùng tạm — dễ gỡ)
app.use('/api/pdftools', rateLimit({ windowMs: 10 * 60 * 1000, max: 12, key: 'pdftools', message: 'Bạn dùng công cụ PDF máy chủ quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.' }), authRequired, pdftoolsRouter); // 12 lần/10 phút + PHẢI ĐĂNG NHẬP (tiện ích lớp 1, 30/9/2026) vì rất nặng máy // CÔNG CỤ PDF máy chủ (dùng tạm — dễ gỡ)
// ĐẶT TRƯỚC bộ hạn chế của /api/danh-muc: đường /api/danh-muc/upload là chỗ MÁY tự đẩy file lên kho,
// đẩy vài chục file một lượt là chuyện thường — dùng chung mức 20 lần/10 phút của việc chạy AI thì tắc ngay.
app.use('/api/danh-muc', rateLimit({ windowMs: 10 * 60 * 1000, max: 300, key: 'khoupload', message: 'Tải file lên kho quá nhiều lần. Đợi ít phút rồi thử lại.' }), khoUploadRouter);
app.use('/api/kho-ho-so', rateLimit({ windowMs: 10 * 60 * 1000, max: 300, key: 'khohoso' }), khoHoSoRouter); // KHO HỒ SƠ (dùng tạm — dễ gỡ)
app.use('/api/danh-muc', rateLimit({ windowMs: 10 * 60 * 1000, max: 20, key: 'danhmuc', message: 'Bạn lập danh mục quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.' }), danhMucRouter); // LẬP DANH MỤC HỒ SƠ (dùng tạm — dễ gỡ)
app.use('/api/ai', rateLimit({ windowMs: 10 * 60 * 1000, max: 30, key: 'aiscript', message: 'Bạn dùng AI viết kịch bản quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.' }), aiScriptRouter); // AI VIẾT KỊCH BẢN VIDEO (dùng chung khoá AI)
// TRA MÃ XÁC THỰC 2 LỚP của các tài khoản dùng chung (VBDLIS…). Mã đổi 30 giây/lần nên trang web
// hỏi khá thường xuyên → để mức thoáng, nhưng vẫn có trần phòng khi tài khoản bị chiếm rồi quét mò.
app.use('/api/totp', rateLimit({ windowMs: 10 * 60 * 1000, max: 400, key: 'totp', message: 'Bạn tra mã quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.' }), totpRouter); // TRA MÃ XÁC THỰC (dùng tạm — dễ gỡ)
app.use('/api', trafficRouter);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
initWs(server);

async function main() {
  await waitForDb();
  // Các bước khởi tạo DB: nếu lỗi thì GHI LOG rõ nhưng VẪN cho server chạy (tránh deploy fail vì 1 câu lệnh).
  if (process.env.BOOTSTRAP_DB === 'true') { try { await bootstrap(); } catch (e: any) { console.error('[boot] bootstrap lỗi (bỏ qua):', e?.stack || e?.message || e); } }
  try { await migrate(); } catch (e: any) { console.error('[boot] migrate lỗi (bỏ qua, server vẫn chạy):', e?.stack || e?.message || e); }
  try { await ensureAdmin(); } catch (e: any) { console.error('[boot] ensureAdmin lỗi (bỏ qua):', e?.stack || e?.message || e); }
  try { await khoiTaoTheoDoi(); } catch (e: any) { console.error('[boot] theo dõi tài khoản lỗi (bỏ qua):', e?.message || e); } // tạm — dễ gỡ
  refreshNews(true).catch(() => {}); // lấy tin ngay khi khởi động
  // Văn bản: seed → crawl Công báo (kho đầy đủ) → quét các cổng TTĐT → camhomes.vn (bổ sung, 6/10/2026); sau đó TỰ LÀM MỚI: Công báo mỗi GIỜ, cổng TTĐT mỗi 6 giờ.
  setTimeout(() => { taiSanFile().catch(() => {}); }, 20000); // dọn file văn bản của phiên xử lý cũ (KHÔNG tải sẵn — file chỉ lưu khi có người mở)
  seedVanBan().then(() => crawlCongBao(true, true)).then(() => crawlPortals()).then(() => crawlCamhomes(true)).then(() => crawlSheets(true)).then(() => timFileThieu()).then(() => taiSanFile()).catch(() => {}); // khởi động: backfill SÂU toàn kho (2005→nay, ~853 trang, chạy nền ~15') + quét cổng
  setInterval(() => crawlCongBao().catch(() => {}), 60 * 60 * 1000);   // Công báo (nguồn chính): tự làm mới MỖI GIỜ — crawl "gần đây" (15 trang, nhẹ)
  setInterval(() => crawlPortals(undefined, true).then(() => crawlCamhomes()).then(() => crawlSheets()).then(() => timFileThieu()).then(() => taiSanFile()).catch(() => {}), 6 * 3600 * 1000);  // cổng TTĐT + camhomes.vn (bổ sung): mỗi 6 giờ cho đỡ tải nguồn ngoài
  // Tự cập nhật tin BĐS mỗi 6 giờ từ 6h sáng (giờ VN): 06:00, 12:00, 18:00, 00:00
  let lastNewsSlot = '';
  setInterval(() => {
    const d = new Date(Date.now() + 7 * 3600 * 1000); // giờ VN
    const h = d.getUTCHours();
    if (h % 6 === 0) {
      const slot = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${h}`;
      if (slot !== lastNewsSlot) { lastNewsSlot = slot; refreshNews(true).catch(() => {}); }
    }
  }, 60 * 1000);
  server.listen(env.port, () => console.log(`[backend] API + WS listening on :${env.port}`));

  // Keep-warm: tự ping để Render (gói free) không "ngủ" → tránh cold-start 500 khi đăng nhập.
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    const ping = () => fetch(`${selfUrl.replace(/\/+$/, '')}/api/health`).then(() => {}).catch(() => {});
    setInterval(ping, 10 * 60 * 1000); // mỗi 10 phút (< 15 phút Render mới cho ngủ)
    console.log(`[keepwarm] tự ping ${selfUrl}/api/health mỗi 10 phút (chống ngủ)`);
  }

  // Thuật toán đẩy tin: VIP tự nổi lại định kỳ (perk theo hạng, KHÔNG trừ lượt khách)
  // Kim cương mỗi 6h · Vàng 12h · Bạc 24h — giữ tin VIP luôn tươi ở đầu hạng.
  const autoBump = () => query(
    `UPDATE listings SET bumped_at = now()
       WHERE status NOT IN ('hidden','pending','sold') AND (
         (tier='diamond' AND COALESCE(bumped_at, created_at) < now() - interval '6 hours') OR
         (tier='gold'    AND COALESCE(bumped_at, created_at) < now() - interval '12 hours') OR
         (tier='silver'  AND COALESCE(bumped_at, created_at) < now() - interval '24 hours'))`).then(() => {}).catch(() => {});
  setInterval(autoBump, 30 * 60 * 1000); // soát mỗi 30 phút
  autoBump();

  // Nhắc CÔNG CHỨNG tự động qua SMS: quét hẹn trong 24h tới (bật SMS, chưa gửi) → gửi rồi đánh dấu.
  // Chỉ chạy khi đã cấu hình cổng SMS (env SMS_*). Nhắc trong app luôn hoạt động độc lập.
  const notaryReminder = async () => {
    if (!smsConfigured()) return;
    try {
      const rows = await query(
        `SELECT a.id, a.appoint_at, a.location, c.phone AS cust_phone
           FROM notary_appointments a JOIN customers c ON c.id=a.customer_id
          WHERE a.sms_reminder=true AND a.sms_sent_at IS NULL AND a.status='Chờ'
            AND a.appoint_at > now() AND a.appoint_at <= now() + interval '24 hours'
            AND c.phone IS NOT NULL AND c.phone <> '' LIMIT 50`);
      for (const a of rows) {
        const s = new Date(a.appoint_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
        const msg = `Nhac lich cong chung luc ${s}${a.location ? ' tai ' + a.location : ''}. Vui long co mat dung gio. - Cam Lam Land`;
        const rs = await sendSms(a.cust_phone, msg);
        if (rs.ok) await query(`UPDATE notary_appointments SET sms_sent_at=now() WHERE id=$1`, [a.id]);
        else console.warn('[sms] hen', a.id, 'khong gui:', rs.reason);
      }
    } catch (e: any) { console.error('[notaryReminder]', e?.message || e); }
  };
  setInterval(notaryReminder, 5 * 60 * 1000); // soát mỗi 5 phút
  notaryReminder();
}
main().catch((e) => { console.error('[BOOT FATAL]', (e && (e.stack || e.message)) || e); setTimeout(() => process.exit(1), 400); });
