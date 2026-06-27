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

// GET /api/chat/messages?room=...&after=<id>
chatRouter.get('/messages', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const room = String(req.query.room ?? '');
    if (!canAccess(room, req.user!)) return res.status(403).json({ error: 'Không có quyền' });
    const after = Number(req.query.after ?? 0) || 0;
    const rows = await query(
      `SELECT id, room, user_id AS "userId", name, body, created_at AS "createdAt"
         FROM chat_messages WHERE room=$1 AND id > $2 ORDER BY id ASC LIMIT 300`, [room, after]);
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
    const [u] = await query('SELECT full_name, email FROM users WHERE id=$1', [req.user!.id]);
    const name = u?.full_name || (u?.email ? String(u.email).split('@')[0] : 'Người dùng');
    const [row] = await query(
      `INSERT INTO chat_messages (room, user_id, name, body) VALUES ($1,$2,$3,$4) RETURNING id, created_at AS "createdAt"`,
      [room, req.user!.id, name, body]);
    const message = { id: row.id, room, userId: req.user!.id, name, body, createdAt: row.createdAt };
    broadcastChat(room, message);
    res.status(201).json({ id: row.id, createdAt: row.createdAt, name });
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
