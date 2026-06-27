import { Router } from 'express';
import { query } from '../lib/db.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { broadcastChat } from '../lib/ws.ts';

export const chatRouter = Router();

function canAccess(room: string, user: { id: number; role: string }): boolean {
  if (room === 'community') return true;
  if (room.startsWith('support:')) {
    const uid = Number(room.slice(8));
    return user.role === 'admin' || user.id === uid;
  }
  return false;
}

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
    if (!canAccess(room, req.user!)) return res.status(403).json({ error: 'Không có quyền' });
    const after = Number(req.query.after ?? 0) || 0;
    const rows = await query(
      `SELECT m.id, m.room, m.user_id AS "userId", m.name, m.body, m.created_at AS "createdAt", u.avatar
         FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id
         WHERE m.room=$1 AND m.id > $2 ORDER BY m.id ASC LIMIT 300`, [room, after]);
    let ack: { received: number; read: number } | null = null;
    if (req.user!.role === 'admin' && room.startsWith('support:')) {
      const uid = Number(room.slice(8));
      const [a] = await query('SELECT received_id AS "received", read_id AS "read" FROM chat_reads WHERE room=$1 AND user_id=$2', [room, uid]);
      ack = { received: a?.received ?? 0, read: a?.read ?? 0 };
    }
    res.json({ messages: rows, ack });
  } catch (e) { next(e); }
});

// POST /api/chat/ack — đánh dấu đã nhận / đã xem (để admin thấy trạng thái)
chatRouter.post('/ack', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const room = String(req.body?.room ?? '');
    if (!canAccess(room, req.user!)) return res.status(403).json({ error: 'Không có quyền' });
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
    if (!canAccess(room, req.user!)) return res.status(403).json({ error: 'Không có quyền' });
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
    res.status(201).json({ id: row.id, createdAt: row.createdAt, name, avatar: u?.avatar ?? null });
  } catch (e) { next(e); }
});

// GET /api/chat/rooms — admin: danh sách hội thoại hỗ trợ
chatRouter.get('/rooms', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const rows = await query(
      `SELECT m.room,
              COALESCE(NULLIF(u.full_name, ''), u.email, 'Khách') AS name,
              u.phone AS phone,
              (u.last_seen_at > now() - interval '2 minutes') AS online,
              (SELECT body FROM chat_messages WHERE room=m.room ORDER BY id DESC LIMIT 1) AS "lastBody",
              max(m.created_at) AS "lastAt", count(*)::int AS count
         FROM chat_messages m
         LEFT JOIN users u ON u.id = NULLIF(split_part(m.room, ':', 2), '')::int
         WHERE m.room LIKE 'support:%'
         GROUP BY m.room, u.full_name, u.email, u.phone, u.last_seen_at
         ORDER BY max(m.created_at) DESC`);
    res.json({ rooms: rows });
  } catch (e) { next(e); }
});

// GET /api/chat/users?q= — admin tìm khách (kể cả chưa từng nhắn) để mở hội thoại mới
chatRouter.get('/users', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const q = String(req.query.q ?? '').trim();
    const like = `%${q.replace(/[%_\\]/g, (m) => '\\' + m)}%`;
    const rows = await query(
      `SELECT id, COALESCE(NULLIF(full_name,''), email) AS name, email, phone, avatar,
              (last_seen_at > now() - interval '2 minutes') AS online
         FROM users
        WHERE role <> 'admin' AND (full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
        ORDER BY (last_seen_at > now() - interval '2 minutes') DESC, full_name NULLS LAST, id LIMIT 300`, [like]);
    res.json({ users: rows });
  } catch (e) { next(e); }
});
