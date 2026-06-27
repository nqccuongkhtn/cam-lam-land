import http from 'node:http';
import { WebSocketServer } from 'ws';
import { verifyToken } from './auth.ts';

let wss: WebSocketServer | null = null;

export function initWs(server: http.Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url || '', 'http://x');
      const token = url.searchParams.get('token');
      const payload = token ? verifyToken(token) : null;
      if (payload) (ws as any).user = payload;
    } catch {}
    try { ws.send(JSON.stringify({ type: 'hello', region: 'Cam Lâm' })); } catch {}
  });
}

// Gửi tin nhắn chat tới đúng các socket có quyền xem phòng (community: tất cả; support:<id>: chủ + admin).
export function broadcastChat(room: string, message: any): void {
  if (!wss) return;
  const data = JSON.stringify({ type: 'chat', room, message });
  wss.clients.forEach((c: any) => {
    if (c.readyState !== 1 || !c.user) return;
    const u = c.user;
    const ok = room === 'community' || (room.startsWith('support:') && (u.role === 'admin' || u.id === Number(room.slice(8))));
    if (ok) { try { c.send(data); } catch {} }
  });
}
