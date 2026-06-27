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
const BAD = new Set(['địt','đụ','đéo','đếch','đách','cặc','lồn','buồi','đĩ','cứt','đmm','dmm','đcm','dcm','vcl','vkl','clmm','cmnr','cml','đméo','fuck','shit','đjt','djt']);
function badContent(body: string): 'phone' | 'word' | null {
  const d = body.replace(/[\s.\-_()+]+/g, '');
  if (/\d{9,}/.test(d)) return 'phone';
  const toks = body.toLowerCase().split(/[^a-zà-ỹ0-9]+/i);
  if (toks.some((t) => BAD.has(t))) return 'word';
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
    res.json({ messages: rows });
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
              (SELECT name FROM chat_messages WHERE room=m.room ORDER BY id DESC LIMIT 1) AS name,
              (SELECT body FROM chat_messages WHERE room=m.room ORDER BY id DESC LIMIT 1) AS "lastBody",
              max(m.created_at) AS "lastAt", count(*)::int AS count
         FROM chat_messages m WHERE m.room LIKE 'support:%'
         GROUP BY m.room ORDER BY max(m.created_at) DESC`);
    res.json({ rooms: rows });
  } catch (e) { next(e); }
});
