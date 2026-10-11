import { Router } from 'express';
import multer from 'multer';
import { laAdmin } from '../lib/auth.ts';
import { cached, cachePut } from '../lib/cache.ts';
import { query } from '../lib/db.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { broadcastChat, broadcastRecall } from '../lib/ws.ts';
import { pushToUsers, pushAllExcept } from '../lib/push.ts';
import { loaiThat, datLoaiAnToan } from '../lib/loaiTep.ts';

export const chatRouter = Router();

// Tệp đính kèm: tối đa 10MB, mỗi lượt 1 tệp. Ảnh đã được trình duyệt nén nhỏ trước khi gửi,
// nên 10MB thực chất là chừa chỗ cho bản PDF scan.
const TEP_TOI_DA = 10 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: TEP_TOI_DA, files: 1 } });
// Multer báo lỗi bằng cách gọi next(err) nên phải bắt tại chỗ, nếu không người dùng chỉ thấy "lỗi 500".
const nhanTep = (req: any, res: any, next: any) => upload.single('file')(req, res, (e: any) => {
  if (e) return res.status(400).json({ error: e?.code === 'LIMIT_FILE_SIZE' ? 'Tệp quá lớn — tối đa 10MB.' : 'Không nhận được tệp.' });
  next();
});

async function isAdvisor(user: { id: number; role: string }): Promise<boolean> {
  if (laAdmin(user)) return true;
  try {
    const [u] = await query('SELECT is_advisor FROM users WHERE id=$1', [user.id]);
    return !!u?.is_advisor;
  } catch { return false; } // thiếu cột is_advisor -> coi như chưa phải tư vấn viên (không chặn khách)
}

async function canAccess(room: string, user: { id: number; role: string }): Promise<boolean> {
  if (room === 'community') return true;
  if (room.startsWith('support:')) {
    const uid = Number(room.slice(8));
    return laAdmin(user) || user.id === uid;
  }
  if (room.startsWith('advisory:')) {
    const uid = Number(room.slice(9));
    return user.id === uid || (await isAdvisor(user));
  }
  return false;
}

// Chỉ cho gửi ảnh/PDF trong phòng NHẮN RIÊNG. Nhóm cộng đồng thì không: bộ lọc chặn số điện thoại
// và từ tục bên dưới chỉ đọc được CHỮ, mở cho gửi ảnh là mở đường đăng ảnh bậy/quảng cáo.
function laPhongRieng(room: string): boolean {
  return room.startsWith('support:') || room.startsWith('advisory:');
}
// Phòng riêng của ai — support:12 và advisory:12 đều là của tài khoản số 12.
function chuPhong(room: string): number {
  return Number(room.slice(room.startsWith('support:') ? 8 : 9));
}
// Người này có được gửi tệp trong phòng này không?
// Admin & tư vấn viên: luôn được. Khách: phải được admin mở khoá (cột users.chat_upload).
async function duocGuiTep(room: string, user: { id: number; role: string }): Promise<boolean> {
  if (!laPhongRieng(room)) return false;
  if (laAdmin(user)) return true;
  try {
    // Hỏi MỘT lần cả hai cột — đường /messages gọi hàm này mỗi 8 giây.
    const [u] = await query('SELECT chat_upload, is_advisor FROM users WHERE id=$1', [user.id]);
    return !!u?.is_advisor || !!u?.chat_upload;
  } catch { return false; }
}
// Dòng chữ hiện ở danh sách hội thoại: tin đã thu hồi / tin có tệp thì body rỗng nên phải thay chữ.
const TOM_TAT_SQL = `CASE WHEN deleted_at IS NOT NULL THEN 'Tin nhắn đã thu hồi'
                          WHEN kind = 'image' THEN '📷 Hình ảnh'
                          WHEN kind = 'file'  THEN '📕 Tệp PDF'
                          ELSE body END`;

// Lọc nội dung gửi lên nhóm cộng đồng: chặn số điện thoại & từ ngữ tục.
const NUM_WORDS = new Set(['khong','không','linh','le','lẻ','mot','một','mốt','hai','ba','bon','bốn','tu','tư','nam','năm','lam','lăm','sau','sáu','bay','bảy','bẩy','tam','tám','chin','chín']);
const BAD_DIA = ['địt','cặc','cặk','lồn','buồi','đụmá','đụmẹ','đụmày','địtmẹ','địtmày','concặc','cáilồn','vãilồn','súcvật','ócchó','đồchó','thằngchó','conchó','chếtmẹ','đĩđiếm','đjt','đệt'];
const BAD_NODIA = ['ditme','ditmemay','dmm','dcm','dkm','vcl','vkl','vloz','concac','cailon','dume','dumay','dumevl','ditcon','ocho','sucvat','thangcho','concho','clmm','cmnr','ditmaday','vclmm','vkldm'];
const BAD_TOKEN = new Set(['đụ','đéo','đếch','đách','đĩ','cứt','cặc','lồn','buồi','địt','vl','dm','đm','vcl','vkl','clm','cmm','đmm','dmm','đcm','dcm','đjt','djt','loz','wtf','fuck','fck','shit','bitch']);
function stripDia(x: string): string { return x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); }
function isPhone(body: string): boolean {
  const re = /\d(?:[\s.\-_]?\d){8,}/;
  if (re.test(body)) return true;
  if (re.test(body.toLowerCase().replace(/[oóòỏõọôồổỗộơờởỡợ]/g, '0'))) return true;
  const words = body.toLowerCase().split(/[^a-zà-ỹ]+/i).filter(Boolean);
  let run = 0, max = 0, total = 0;
  for (const w of words) { if (NUM_WORDS.has(w) || NUM_WORDS.has(stripDia(w))) { run++; total++; if (run > max) max = run; } else run = 0; }
  return max >= 6 || total >= 9;
}
function isProfane(body: string): boolean {
  const low = body.toLowerCase();
  const colDia = low.replace(/[^a-zà-ỹ]/gi, '');
  if (BAD_DIA.some((w) => colDia.includes(w))) return true;
  const colNo = stripDia(low).replace(/[^a-z]/g, '');
  if (BAD_NODIA.some((w) => colNo.includes(w))) return true;
  const toks = low.split(/[^a-zà-ỹ0-9]+/i).filter(Boolean);
  if (toks.some((t) => BAD_TOKEN.has(t))) return true;
  return false;
}
function badContent(body: string): 'phone' | 'word' | null {
  if (isPhone(body)) return 'phone';
  if (isProfane(body)) return 'word';
  return null;
}

// GET /api/chat/messages?room=...&after=<id>
chatRouter.get('/messages', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const room = String(req.query.room ?? '');
    if (!(await canAccess(room, req.user!))) return res.status(403).json({ error: 'Không có quyền' });
    const after = Number(req.query.after ?? 0) || 0;
    const rows = await query(
      `SELECT m.id, m.room, m.user_id AS "userId", m.name, m.body, m.created_at AS "createdAt", u.avatar,
              m.kind, m.file_id AS "fileId", m.file_name AS "fileName", m.file_mime AS "fileMime",
              m.file_size AS "fileSize", m.deleted_at AS "deletedAt"
         FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id
         WHERE m.room=$1 AND m.id > $2 ORDER BY m.id ASC LIMIT 300`, [room, after]);
    let ack: { received: number; read: number } | null = null;
    let peerUpload: boolean | null = null;
    if (laAdmin(req.user) && laPhongRieng(room)) {
      const uid = chuPhong(room);
      if (room.startsWith('support:')) {
        const [a] = await query('SELECT received_id AS "received", read_id AS "read" FROM chat_reads WHERE room=$1 AND user_id=$2', [room, uid]);
        ack = { received: a?.received ?? 0, read: a?.read ?? 0 };
      }
      const [p] = await query('SELECT chat_upload FROM users WHERE id=$1', [uid]);
      peerUpload = !!p?.chat_upload;
    }
    // Tin BỊ THU HỒI phải gửi riêng: vòng hỏi lại dùng after=<id lớn nhất> nên KHÔNG BAO GIỜ
    // thấy lại một tin CŨ vừa bị gỡ → thiếu mảng này là máy bên kia vẫn hiện nguyên tin cũ.
    const thuHoi = await query(
      `SELECT id FROM chat_messages
        WHERE room=$1 AND deleted_at IS NOT NULL AND deleted_at > now() - interval '7 days'
        ORDER BY id DESC LIMIT 200`, [room]);
    res.json({
      messages: rows,
      ack,
      peerUpload,
      canUpload: await duocGuiTep(room, req.user!),
      recalled: thuHoi.map((r: any) => Number(r.id)),
    });
  } catch (e) { next(e); }
});

// POST /api/chat/ack — đánh dấu đã nhận / đã xem (để admin thấy trạng thái)
chatRouter.post('/ack', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const room = String(req.body?.room ?? '');
    if (!(await canAccess(room, req.user!))) return res.status(403).json({ error: 'Không có quyền' });
    const received = Math.max(0, Number(req.body?.received ?? 0) || 0);
    const read = Math.max(0, Number(req.body?.read ?? 0) || 0);
    await query(
      `INSERT INTO chat_reads (room, user_id, received_id, read_id, updated_at) VALUES ($1,$2,$3,$4, now())
       ON CONFLICT (room, user_id) DO UPDATE SET
         received_id = GREATEST(chat_reads.received_id, EXCLUDED.received_id),
         read_id = GREATEST(chat_reads.read_id, EXCLUDED.read_id), updated_at = now()`,
      [room, req.user!.id, received, read]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/chat/messages { room, body }
chatRouter.post('/messages', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const room = String(req.body?.room ?? '');
    const body = String(req.body?.body ?? '').trim().slice(0, 2000);
    if (!(await canAccess(room, req.user!))) return res.status(403).json({ error: 'Không có quyền' });
    // Chặn admin/tư vấn viên tự nhắn vào phòng hỗ trợ/tư vấn của CHÍNH MÌNH.
    if ((room === `support:${req.user!.id}` || room === `advisory:${req.user!.id}`) && (laAdmin(req.user) || (await isAdvisor(req.user!))))
      return res.status(400).json({ error: 'Admin/tư vấn viên không thể tự nhắn cho chính mình.' });
    if (!body) return res.status(400).json({ error: 'Tin nhắn trống' });
    if (room === 'community') {
      const bad = badContent(body);
      if (bad === 'phone') return res.status(400).json({ error: 'Không được gửi số điện thoại lên nhóm cộng đồng. Vui lòng nhắn riêng.', blocked: 'phone' });
      if (bad === 'word') return res.status(400).json({ error: 'Tin nhắn có từ ngữ không phù hợp nên không được gửi lên nhóm.', blocked: 'word' });
    }
    const [u] = await query('SELECT full_name, email, avatar FROM users WHERE id=$1', [req.user!.id]);
    const name = u?.full_name || (u?.email ? String(u.email).split('@')[0] : 'Người dùng');
    const [row] = await query(
      `INSERT INTO chat_messages (room, user_id, name, body) VALUES ($1,$2,$3,$4) RETURNING id, created_at AS "createdAt"`,
      [room, req.user!.id, name, body]);
    const message = { id: row.id, room, userId: req.user!.id, name, avatar: u?.avatar ?? null, body, createdAt: row.createdAt };
    broadcastChat(room, message);
    // Web Push chạy ngầm (kể cả khi không mở web)
    const payload = { title: name, body: body.length > 60 ? body.slice(0, 60) + '…' : body, room, url: '/', tag: room };
    if (room === 'community') { pushAllExcept(req.user!.id, payload).catch(() => {}); }
    else if (room.startsWith('support:')) {
      const ownerId = Number(room.slice(8));
      const admins = await query("SELECT id FROM users WHERE 'admin' = ANY(roles)");
      pushToUsers([ownerId, ...admins.map((a: any) => a.id)], payload, req.user!.id).catch(() => {});
    }
    else if (room.startsWith('advisory:')) {
      const ownerId = Number(room.slice(9));
      const staff = await query("SELECT id FROM users WHERE 'admin' = ANY(roles) OR is_advisor=true");
      pushToUsers([ownerId, ...staff.map((a: any) => a.id)], payload, req.user!.id).catch(() => {});
    }
    res.status(201).json({ id: row.id, createdAt: row.createdAt, name, avatar: u?.avatar ?? null });
  } catch (e) { next(e); }
});

// GET /api/chat/rooms — admin: danh sách hội thoại hỗ trợ
chatRouter.get('/rooms', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    if (!laAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
    const rows = await query(
      `SELECT m.room,
              COALESCE(NULLIF(u.full_name, ''), u.email, 'Khách') AS name,
              u.phone AS phone,
              (u.last_seen_at > now() - interval '2 minutes') AS online,
              (SELECT ${TOM_TAT_SQL} FROM chat_messages WHERE room=m.room ORDER BY id DESC LIMIT 1) AS "lastBody",
              max(m.created_at) AS "lastAt", count(*)::int AS count
         FROM chat_messages m
         LEFT JOIN users u ON u.id = NULLIF(split_part(m.room, ':', 2), '')::int
         WHERE m.room LIKE 'support:%'
         GROUP BY m.room, u.full_name, u.email, u.phone, u.last_seen_at
         ORDER BY max(m.created_at) DESC`);
    res.json({ rooms: rows });
  } catch (e) { next(e); }
});

// GET /api/chat/mention — danh sách TÊN mọi người dùng (để @nhắc trong chat), chỉ tên, không lộ liên hệ
chatRouter.get('/mention', authRequired, async (_req: AuthedRequest, res, next) => {
  try {
    const mhit = cached<any>('chat:mention');
    if (mhit) { res.set('Cache-Control', 'private, max-age=120'); return res.json(mhit); }
    const rows = await query(
      `SELECT id, COALESCE(NULLIF(full_name,''), split_part(email,'@',1)) AS name
         FROM users
        WHERE COALESCE(NULLIF(full_name,''), email) IS NOT NULL
        ORDER BY full_name NULLS LAST, id LIMIT 500`);
    const mpayload = { users: rows };
    cachePut('chat:mention', mpayload, 120000);
    res.set('Cache-Control', 'private, max-age=120');
    res.json(mpayload);
  } catch (e) { next(e); }
});

// GET /api/chat/users?q= — admin tìm khách (kể cả chưa từng nhắn) để mở hội thoại mới
chatRouter.get('/users', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    if (!laAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
    const q = String(req.query.q ?? '').trim();
    const like = `%${q.replace(/[%_\\]/g, (m) => '\\' + m)}%`;
    const rows = await query(
      `SELECT id, COALESCE(NULLIF(full_name,''), email) AS name, email, phone, avatar,
              (last_seen_at > now() - interval '2 minutes') AS online
         FROM users
        WHERE NOT ('admin' = ANY(roles)) AND (full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
        ORDER BY (last_seen_at > now() - interval '2 minutes') DESC, full_name NULLS LAST, id LIMIT 300`, [like]);
    res.json({ users: rows });
  } catch (e) { next(e); }
});


// GET /api/chat/advisory-access — người dùng hiện tại có quyền tư vấn đầu tư không
chatRouter.get('/advisory-access', authRequired, async (req: AuthedRequest, res, next) => {
  try { res.json({ advisor: await isAdvisor(req.user!) }); } catch (e) { next(e); }
});

// GET /api/chat/advisory-rooms — hội thoại "Tư vấn đầu tư" + SỐ TIN CHƯA ĐỌC tính RIÊNG cho người xem
chatRouter.get('/advisory-rooms', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    if (!(await isAdvisor(req.user!))) return res.status(403).json({ error: 'Không có quyền tư vấn' });
    const rows = await query(
      `SELECT r.room,
              COALESCE(NULLIF(u.full_name, ''), u.email, 'Khách') AS name,
              u.phone AS phone,
              (u.last_seen_at > now() - interval '2 minutes') AS online,
              (SELECT ${TOM_TAT_SQL} FROM chat_messages WHERE room=r.room ORDER BY id DESC LIMIT 1) AS "lastBody",
              r."lastAt", r.count,
              (SELECT count(*) FROM chat_messages cm
                 WHERE cm.room = r.room
                   AND cm.user_id = NULLIF(split_part(r.room, ':', 2), '')::int
                   AND cm.id > COALESCE(cr.read_id, 0))::int AS unread,
              (SELECT (m.user_id IS NOT DISTINCT FROM NULLIF(split_part(r.room, ':', 2), '')::int)
                 FROM chat_messages m WHERE m.room = r.room ORDER BY m.id DESC LIMIT 1) AS waiting,
              (SELECT min(m.created_at) FROM chat_messages m
                 WHERE m.room = r.room
                   AND m.user_id = NULLIF(split_part(r.room, ':', 2), '')::int
                   AND m.id > COALESCE((SELECT max(m2.id) FROM chat_messages m2
                                          WHERE m2.room = r.room AND m2.user_id <> NULLIF(split_part(r.room, ':', 2), '')::int), 0)) AS "waitingSince"
         FROM (SELECT room, max(created_at) AS "lastAt", count(*)::int AS count
                 FROM chat_messages WHERE room LIKE 'advisory:%' GROUP BY room) r
         LEFT JOIN users u ON u.id = NULLIF(split_part(r.room, ':', 2), '')::int
         LEFT JOIN chat_reads cr ON cr.room = r.room AND cr.user_id = $1
        ORDER BY r."lastAt" DESC`, [req.user!.id]);
    res.json({ rooms: rows });
  } catch (e) { next(e); }
});

// ── GỬI ẢNH / PDF ─────────────────────────────────────────────────────────────
// Làm CẢ HAI việc trong một lượt: cất tệp + tạo dòng tin nhắn → không bao giờ có tệp mồ côi.
chatRouter.post('/file', authRequired, nhanTep, async (req: AuthedRequest, res, next) => {
  try {
    const room = String(req.body?.room ?? '');
    const f = (req as any).file;
    if (!f) return res.status(400).json({ error: 'Chưa chọn tệp' });
    if (!(await canAccess(room, req.user!))) return res.status(403).json({ error: 'Không có quyền' });
    if (!laPhongRieng(room)) return res.status(400).json({ error: 'Chỉ gửi được ảnh/tệp trong tin nhắn riêng.' });
    if (!(await duocGuiTep(room, req.user!)))
      return res.status(403).json({ error: 'Tài khoản của bạn chưa được mở quyền gửi ảnh/tệp. Vui lòng nhắn cho admin.' });
    // ⚠️ 11/10/2026 (rà soát bảo mật): xét loại tệp theo CHỮ KÝ NHỊ PHÂN, không tin loại trình duyệt khai.
    //    Trước đây khai "image/svg+xml" là gửi được SVG chứa mã <script>; admin bấm mở ảnh ở thẻ mới là mã chạy
    //    trên tên miền của web → lấy được thẻ đăng nhập admin. Nay chỉ nhận JPG/PNG/GIF/WebP/PDF thật.
    const mime = loaiThat(f.buffer);
    if (!mime) return res.status(400).json({ error: 'Chỉ nhận ảnh (JPG, PNG, WebP, GIF) hoặc tệp PDF.' });
    const laAnh = mime.startsWith('image/');
    const ten = String(f.originalname || (laAnh ? 'hinh-anh' : 'tai-lieu.pdf')).slice(0, 200);

    const [tep] = await query(
      `INSERT INTO chat_files (room, user_id, ten, mime, co_bytes, du_lieu) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [room, req.user!.id, ten, mime, f.size, f.buffer]);
    const [u] = await query('SELECT full_name, email, avatar FROM users WHERE id=$1', [req.user!.id]);
    const name = u?.full_name || (u?.email ? String(u.email).split('@')[0] : 'Người dùng');
    const kind = laAnh ? 'image' : 'file';
    const [row] = await query(
      `INSERT INTO chat_messages (room, user_id, name, body, kind, file_id, file_name, file_mime, file_size)
       VALUES ($1,$2,$3,'',$4,$5,$6,$7,$8) RETURNING id, created_at AS "createdAt"`,
      [room, req.user!.id, name, kind, tep.id, ten, mime, f.size]);
    const message = {
      id: row.id, room, userId: req.user!.id, name, avatar: u?.avatar ?? null, body: '',
      createdAt: row.createdAt, kind, fileId: Number(tep.id), fileName: ten, fileMime: mime, fileSize: f.size,
    };
    broadcastChat(room, message);
    // Web Push chạy ngầm — tin có tệp thì body rỗng nên phải ghi chữ mô tả, không thì báo trống trơn.
    const payload = { title: name, body: laAnh ? '📷 Đã gửi một hình ảnh' : `📕 Đã gửi tệp: ${ten}`, room, url: '/', tag: room };
    const staff = await query(room.startsWith('support:')
      ? "SELECT id FROM users WHERE 'admin' = ANY(roles)"
      : "SELECT id FROM users WHERE 'admin' = ANY(roles) OR is_advisor=true");
    pushToUsers([chuPhong(room), ...staff.map((a: any) => a.id)], payload, req.user!.id).catch(() => {});
    res.status(201).json(message);
  } catch (e) { next(e); }
});

// ── XEM / TẢI TỆP ĐÍNH KÈM ───────────────────────────────────────────────────
// Bắt buộc đăng nhập VÀ phải có quyền xem đúng phòng chat đó — khác hẳn /api/images/:id
// (đường đó không kiểm gì, ai đoán được số là tải về được). Thêm ?tai=1 để tải về máy.
async function guiTep(req: AuthedRequest, res: any, cot: 'du_lieu' | 'thumb') {
  const [row] = await query('SELECT room, ten, mime, du_lieu, thumb FROM chat_files WHERE id=$1', [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy tệp' });
  if (!(await canAccess(row.room, req.user!))) return res.status(403).json({ error: 'Không có quyền' });
  // Loại lạ còn sót từ trước (vd SVG) → trả dạng tải về, không cho trình duyệt hiển thị trên tên miền của web.
  datLoaiAnToan(res, row.mime, 'application/octet-stream');
  res.set('Cache-Control', 'private, no-store'); // tệp riêng tư: nginx & trình duyệt đều không được giữ lại
  if (String(req.query.tai ?? '') === '1')
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.ten || 'tep')}`);
  res.send((cot === 'thumb' ? row.thumb : null) || row.du_lieu);
}
chatRouter.get('/file/:id/thumb', authRequired, async (req: AuthedRequest, res, next) => { try { await guiTep(req, res, 'thumb'); } catch (e) { next(e); } });
chatRouter.get('/file/:id', authRequired, async (req: AuthedRequest, res, next) => { try { await guiTep(req, res, 'du_lieu'); } catch (e) { next(e); } });

// ── THU HỒI TIN NHẮN ─────────────────────────────────────────────────────────
// Chỉ gỡ được tin của CHÍNH MÌNH, và chỉ admin / tư vấn viên mới có quyền này.
// Gỡ xong: body xoá trắng, tệp bị XOÁ HẲN khỏi máy chủ, giữ lại dòng tin để hiện chữ mờ.
chatRouter.delete('/messages/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id) || 0;
    const [m] = await query('SELECT room, user_id AS "userId", file_id AS "fileId", deleted_at AS "deletedAt" FROM chat_messages WHERE id=$1', [id]);
    if (!m) return res.status(404).json({ error: 'Không tìm thấy tin nhắn' });
    if (m.userId !== req.user!.id) return res.status(403).json({ error: 'Chỉ thu hồi được tin của chính mình.' });
    if (!(await isAdvisor(req.user!))) return res.status(403).json({ error: 'Không có quyền thu hồi tin nhắn.' });
    if (!m.deletedAt) {
      await query(`UPDATE chat_messages SET body='', kind='text', deleted_at=now(),
                     file_id=NULL, file_name=NULL, file_mime=NULL, file_size=NULL WHERE id=$1`, [id]);
      if (m.fileId) await query('DELETE FROM chat_files WHERE id=$1', [m.fileId]).catch(() => {});
    }
    broadcastRecall(m.room, id); // phát lại kể cả khi đã gỡ trước đó → máy nào lỡ chưa nhận vẫn cập nhật
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── ADMIN MỞ / KHOÁ quyền gửi ảnh-PDF của một khách ───────────────────────────
chatRouter.post('/quyen-gui-file', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    if (!laAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
    const userId = Number(req.body?.userId) || 0;
    const cho = !!req.body?.cho;
    if (!userId) return res.status(400).json({ error: 'Thiếu tài khoản' });
    const [u] = await query('UPDATE users SET chat_upload=$2 WHERE id=$1 RETURNING chat_upload', [userId, cho]);
    if (!u) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    res.json({ ok: true, cho: !!u.chat_upload });
  } catch (e) { next(e); }
});
