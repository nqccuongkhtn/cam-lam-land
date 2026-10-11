import http from 'node:http';
import { WebSocketServer } from 'ws';
import { laAdmin } from './auth.ts';
import { xacMinhThe } from '../middleware/auth.ts';

let wss: WebSocketServer | null = null;

// ── CHỐNG LẠM DỤNG KÊNH TRÒ CHUYỆN TỨC THỜI (11/10/2026 — rà soát) ──
//  · Trình duyệt KHÔNG BAO GIỜ gửi gì lên kênh này (chỉ nhận tin) → mỗi gói gửi lên tối đa 4 KB. Mặc định của thư
//    viện là 100 MB/gói: kẻ xấu mở vài kết nối rồi đẩy gói khổng lồ là máy chủ cạn bộ nhớ.
//  · Kết nối "chết" (mất mạng giữa chừng, không đóng đàng hoàng) trước đây nằm lại mãi trong bộ nhớ → mỗi 30 giây
//    hỏi thăm (ping), lần sau không thấy trả lời (pong) thì cắt. Trình duyệt tự trả lời, không cần sửa giao diện.
//  · Tối đa 5.000 kết nối cùng lúc.
const GOI_TOI_DA = 4 * 1024;
const KET_NOI_TOI_DA = 5000;

export function initWs(server: http.Server): void {
  wss = new WebSocketServer({ server, path: '/ws', maxPayload: GOI_TOI_DA });
  wss.on('error', () => {});                                   // lỗi lắng nghe → không làm sập tiến trình
  wss.on('connection', (ws, req) => {
    ws.on('error', () => {});                                  // gói quá cỡ / mạng lỗi → thư viện tự đóng kết nối, chỉ cần không ném lỗi
    if (wss && wss.clients.size > KET_NOI_TOI_DA) { try { ws.close(1013, 'busy'); } catch {} return; }
    (ws as any).conSong = true;
    ws.on('pong', () => { (ws as any).conSong = true; });
    try {
      const url = new URL(req.url || '', 'http://x');
      const token = url.searchParams.get('token');
      // Kiểm thẻ ĐẦY ĐỦ (11/10/2026): tài khoản còn, không bị khoá, thẻ chưa bị thu hồi do đổi mật khẩu.
      if (token) {
        (ws as any).the = token;
        xacMinhThe(token).then((p) => { if (p) (ws as any).user = p; }).catch(() => {});
      }
    } catch {}
    try { ws.send(JSON.stringify({ type: 'hello', region: 'Cam Lâm' })); } catch {}
  });
  const nhip = setInterval(() => {
    wss?.clients.forEach((c: any) => {
      if (c.conSong === false) { try { c.terminate(); } catch {} return; }   // lần trước hỏi không thấy trả lời → cắt
      c.conSong = false;
      try { c.ping(); } catch {}
      // Thẻ đã bị thu hồi (đổi mật khẩu + đăng xuất máy khác, tài khoản bị khoá / xoá) → thôi nhận tin, cắt kết nối.
      if (c.the && c.user) xacMinhThe(c.the).then((p) => { if (!p) { c.user = null; try { c.terminate(); } catch {} } }).catch(() => {});
    });
  }, 30_000);
  nhip.unref?.();
  wss.on('close', () => clearInterval(nhip));
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
