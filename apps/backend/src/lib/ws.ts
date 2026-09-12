import http from 'node:http';
import { WebSocketServer } from 'ws';
import { verifyToken, laAdmin } from './auth.ts';

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

// Ai được xem phòng này (community: tất cả; support:<id>/advisory:<id>: chủ phòng + admin).
function coQuyenXem(room: string, u: any): boolean {
  if (!u) return false;
  return room === 'community'
    || (room.startsWith('support:') && (laAdmin(u) || u.id === Number(room.slice(8))))
    || (room.startsWith('advisory:') && (laAdmin(u) || u.id === Number(room.slice(9))));
}

// Gửi một gói tin tới đúng các socket có quyền xem phòng.
function phatToiPhong(room: string, goi: any): void {
  if (!wss) return;
  const data = JSON.stringify(goi);
  wss.clients.forEach((c: any) => {
    if (c.readyState !== 1 || !coQuyenXem(room, c.user)) return;
    try { c.send(data); } catch {}
  });
}

// Tin nhắn mới (chữ hoặc có tệp đính kèm).
export function broadcastChat(room: string, message: any): void {
  phatToiPhong(room, { type: 'chat', room, message });
}

// Báo một tin vừa bị THU HỒI → máy bên kia đổi ngay thành dòng chữ mờ, không phải chờ hỏi lại.
export function broadcastRecall(room: string, id: number): void {
  phatToiPhong(room, { type: 'chat-recall', room, id });
}
