'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth, laAdmin } from '@/lib/auth';
import { api, uploadChatFile } from '@/lib/api';
import { getToken } from '@/lib/token';
import { WARDS_NEW, WARDS_OLD, PROPERTY_LABELS, type PropertyType } from '@/lib/types';
import FlappyMini from './FlappyMini';
import ChatDinhKem from './ChatDinhKem';
import { useLockBody } from '@/lib/useLockBody';
import { nhoViTri, ghiTuChoiViTri } from '@/lib/viTri';

interface Msg { id: number; userId: number | null; name: string; avatar?: string | null; body: string; createdAt: string;
  kind?: string; fileId?: number | null; fileName?: string | null; fileMime?: string | null; fileSize?: number | null; deletedAt?: string | null; }
interface Room { room: string; name: string; phone?: string | null; online?: boolean; lastBody: string; lastAt: string; count: number; unread?: number; }
const TYPES: PropertyType[] = ['land', 'house', 'apartment', 'villa', 'commercial', 'farm'];
type Tab = 'community' | 'support' | 'advisory' | 'sell';

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function renderWithMentions(body: string, names: string[], myName: string): any {
  if (!body || !names.length) return body;
  const sorted = Array.from(new Set(names)).filter(Boolean).sort((a, b) => b.length - a.length).map(escRe);
  if (!sorted.length) return body;
  let re: RegExp;
  try { re = new RegExp(`@(${sorted.join('|')})`, 'g'); } catch { return body; }
  const out: any[] = []; let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) out.push(body.slice(last, m.index));
    const isMe = !!myName && m[1].toLowerCase() === myName.toLowerCase();
    out.push(<span key={i++} className={`font-semibold rounded px-0.5 ${isMe ? 'bg-[#C8A14B] text-[#0A2540]' : 'text-blue-600'}`}>@{m[1]}</span>);
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

function urlB64ToUint8(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64); const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function ChatWidget() {
  const { user } = useAuth();
  const isAdmin = laAdmin(user);
  const [open, setOpen] = useState(false);
  useLockBody(open); // khoá cuộn nền khi khung chat đang mở → nền phía dưới không lướt được
  const [tab, setTab] = useState<Tab>('community');
  const [room, setRoom] = useState('community');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [warn, setWarn] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [wsUrl, setWsUrl] = useState('');
  const [live, setLive] = useState(false);
  const [unreadComm, setUnreadComm] = useState(0);
  const [unreadSupp, setUnreadSupp] = useState(0);
  const [unreadAdv, setUnreadAdv] = useState(0);
  const [isAdvisor, setIsAdvisor] = useState(false);
  const [advRooms, setAdvRooms] = useState<Room[]>([]);
  const [sf, setSf] = useState({ name: '', phone: '', propertyType: '', ward: '', address: '', area: '', priceExpect: '', description: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serr, setSerr] = useState('');
  const [hint, setHint] = useState(false);
  const hintShown = useRef(0);
  const hintStop = useRef(false);
  const [peerAck, setPeerAck] = useState<{ received: number; read: number } | null>(null);
  const [canUpload, setCanUpload] = useState(false);                  // MÌNH có được gửi ảnh/PDF ở phòng này không
  const [peerUpload, setPeerUpload] = useState<boolean | null>(null); // khách bên kia đang được mở hay khoá (chỉ admin biết)
  const [dangGuiTep, setDangGuiTep] = useState(false);
  const [menuTin, setMenuTin] = useState(0);                          // id tin đang mở menu "⋯"
  const [listOpen, setListOpen] = useState(true);
  const [gameOpen, setGameOpen] = useState(false);
  const [roomQ, setRoomQ] = useState('');
  const [userHits, setUserHits] = useState<{ id: number; name: string; email: string; phone: string | null; avatar: string | null; online?: boolean }[]>([]);
  const [pickedName, setPickedName] = useState('');
  const [pickedPhone, setPickedPhone] = useState('');
  const [notify, setNotify] = useState(true);
  const [vapid, setVapid] = useState('');
  const [toast, setToast] = useState<{ room: string; name: string; body: string; avatar?: string | null } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [allNames, setAllNames] = useState<string[]>([]);
  const dragStart = useRef<number | null>(null);
  const draggedRef = useRef(false);
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
  const bubbleDrag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean; lx: number; ly: number } | null>(null);
  const bubbleMoved = useRef(false);
  const acked = useRef(0);

  const lastId = useRef(0);
  const seen = useRef<Set<number>>(new Set());
  const roomRef = useRef(room); roomRef.current = room;
  const openRef = useRef(open); openRef.current = open;
  const tabRef = useRef(tab); tabRef.current = tab;
  const notifyRef = useRef(notify); notifyRef.current = notify;
  const vapidRef = useRef(''); vapidRef.current = vapid;
  const audioRef = useRef<any>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLInputElement>(null);
  const tepRef = useRef<HTMLInputElement>(null);
  const seenComm = useRef(0), seenSupp = useRef(0), seenAdv = useRef(0);
  const unread = unreadComm + unreadSupp + unreadAdv;
  const setS = (k: string, v: string) => setSf((s) => ({ ...s, [k]: v }));

  useEffect(() => { setTab('advisory'); }, [user]);
  // Nút "Chat tư vấn" ở nơi khác (CTA pháp lý, mục dịch vụ) phát 'cl-open-chat' → mở hộp chat & nhảy tới đúng tab (mặc định Tư vấn & Pháp lý).
  useEffect(() => {
    const openTo = (e: any) => { const t = e?.detail?.tab; primeAudio(); setTab((t === 'sell' || t === 'community' || t === 'support' || t === 'advisory') ? t : 'advisory'); setOpen(true); dismissHint(); };
    window.addEventListener('cl-open-chat', openTo);
    return () => window.removeEventListener('cl-open-chat', openTo);
  }, []);
  useEffect(() => { if (!user) { setAllNames([]); return; } api<{ users: { name: string }[] }>('/chat/mention').then((r) => setAllNames((r.users || []).map((u) => u.name).filter(Boolean))).catch(() => {}); }, [user]);
  useEffect(() => {
    try { seenComm.current = Number(localStorage.getItem('cl-seen-community') || 0); } catch {}
    if (user) { try { seenSupp.current = Number(localStorage.getItem(`cl-seen-support:${user.id}`) || 0); seenAdv.current = Number(localStorage.getItem(`cl-seen-advisory:${user.id}`) || 0); } catch {} }
  }, [user]);
  useEffect(() => { if (!user) { setIsAdvisor(false); return; } api<{ advisor: boolean }>('/chat/advisory-access').then((r) => setIsAdvisor(!!r.advisor)).catch(() => {}); }, [user]);
  useEffect(() => { if (user) api<{ wsUrl: string; vapidPublic?: string }>('/config').then((r) => { setWsUrl(r.wsUrl || ''); setVapid(r.vapidPublic || ''); }).catch(() => {}); }, [user]);
  useEffect(() => {
    if (!user) return;
    const ping = () => api('/auth/ping', { method: 'POST' }).catch(() => {});
    ping(); const iv = setInterval(ping, 45000); return () => clearInterval(iv);
  }, [user]);

  useEffect(() => {
    if (!user) { setRoom(''); return; }
    if (tab === 'community') setRoom('community');
    else if (tab === 'support') setRoom(isAdmin ? '' : `support:${user.id}`);
    else if (tab === 'advisory') setRoom(isAdvisor ? '' : `advisory:${user.id}`);
    else setRoom('');
  }, [tab, user, isAdmin, isAdvisor]);

  // Đếm tin chưa đọc (chạy nền kể cả khi đóng)
  useEffect(() => {
    if (!user) { setUnreadComm(0); setUnreadSupp(0); setUnreadAdv(0); return; }
    const poll = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return; // tab ẩn → KHÔNG poll nền (đỡ tốn mạng/pin); WebSocket vẫn nhận tin real-time khi cần
      try {
        const c = await api<{ messages: Msg[] }>(`/chat/messages?room=community&after=${seenComm.current}`);
        if (seenComm.current === 0 && c.messages.length) {
          // LẦN ĐẦU: đặt mốc = tin mới nhất → KHÔNG coi cả lịch sử (168 tin) là "chưa đọc" (hết badge 99+),
          // và các lần poll sau chỉ lấy tin MỚI (after=id lớn nhất → nhẹ, hết tải lại toàn bộ mỗi 12s).
          seenComm.current = Math.max(...c.messages.map((m) => m.id));
          try { localStorage.setItem('cl-seen-community', String(seenComm.current)); } catch {}
          setUnreadComm(0);
        } else {
          setUnreadComm(c.messages.filter((m) => m.userId !== user.id).length);
        }
      } catch {}
      if (!isAdmin) { try { const s = await api<{ messages: Msg[] }>(`/chat/messages?room=support:${user.id}&after=${seenSupp.current}`); setUnreadSupp(s.messages.filter((m) => m.userId !== user.id).length); if (s.messages.length) api('/chat/ack', { method: 'POST', body: JSON.stringify({ room: `support:${user.id}`, received: Math.max(...s.messages.map((m) => m.id)) }) }).catch(() => {}); } catch {} }
      if (isAdvisor) { try { const a = await api<{ rooms: Room[] }>('/chat/advisory-rooms'); setAdvRooms(a.rooms || []); } catch {} }
      else { try { const s = await api<{ messages: Msg[] }>(`/chat/messages?room=advisory:${user.id}&after=${seenAdv.current}`); setUnreadAdv(s.messages.filter((m) => m.userId !== user.id).length); if (s.messages.length) api('/chat/ack', { method: 'POST', body: JSON.stringify({ room: `advisory:${user.id}`, received: Math.max(...s.messages.map((m) => m.id)) }) }).catch(() => {}); } catch {} }
    };
    poll();
    const iv = setInterval(poll, 12000);
    const onVis = () => { if (document.visibilityState === 'visible') poll(); }; // quay lại tab → cập nhật ngay
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [user, isAdmin, isAdvisor]);

  // Phòng đang mở: nạp + polling dự phòng
  useEffect(() => {
    if (!open || !user || !room) { setMsgs([]); return; }
    seen.current = new Set(); lastId.current = 0; acked.current = 0; setMsgs([]); setWarn(''); setPeerAck(null);
    setCanUpload(false); setPeerUpload(null); setMenuTin(0);
    let alive = true;
    const tick = async () => {
      try {
        const r = await api<{ messages: Msg[]; ack?: { received: number; read: number } | null; recalled?: number[]; canUpload?: boolean; peerUpload?: boolean | null }>(`/chat/messages?room=${encodeURIComponent(room)}&after=${lastId.current}`);
        if (!alive) return;
        pushMsgs(r.messages);
        if (r.ack) setPeerAck(r.ack);
        setCanUpload(!!r.canUpload);
        setPeerUpload(r.peerUpload ?? null);
        danhDauThuHoi(r.recalled || []);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, [open, user, room]);

  // WebSocket real-time + thông báo tin nhắn (luôn bật khi đã đăng nhập)
  useEffect(() => {
    if (!user || !wsUrl) return;
    const token = getToken();
    let ws: WebSocket | null = null; let dead = false; let retry: any;
    const connect = () => {
      try { ws = new WebSocket(token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl); } catch { return; }
      ws.onopen = () => setLive(true);
      ws.onclose = () => { setLive(false); if (!dead) retry = setTimeout(connect, 4000); };
      ws.onerror = () => setLive(false);
      ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          // Tin vừa bị THU HỒI — phải nới điều kiện dưới, trước đây mọi loại khác 'chat' đều bị bỏ qua.
          if (d.type === 'chat-recall') { danhDauThuHoi([Number(d.id)]); return; }
          if (d.type !== 'chat' || !d.message) return;
          const m = d.message;
          if (openRef.current && d.room === roomRef.current) pushMsgs([m]);
          if (m.userId === user.id) return;
          const viewing = openRef.current && d.room === roomRef.current;
          if (viewing || !notifyRef.current) return;
          const raw = m.kind === 'image' ? '📷 Đã gửi một hình ảnh'
            : m.kind === 'file' ? `📕 ${m.fileName || 'Tệp PDF'}`
            : String(m.body || '').replace(/\s+/g, ' ').trim();
          const advMask = d.room.startsWith('advisory:') && Number(d.room.slice(9)) === user.id && m.userId !== user.id;
          setToast({ room: d.room, name: advMask ? 'Chuyên viên tư vấn' : (m.name || 'Tin nhắn'), body: raw.length > 42 ? raw.slice(0, 42) + '…' : raw, avatar: advMask ? '/icons/icon-192.png' : m.avatar });
          playDing();
        } catch {}
      };
    };
    connect();
    return () => { dead = true; clearTimeout(retry); try { ws && ws.close(); } catch {} setLive(false); };
  }, [user, wsUrl]);

  useEffect(() => {
    if (!open || !isAdmin || tab !== 'support') return;
    const load = () => api<{ rooms: Room[] }>('/chat/rooms').then((r) => setRooms(r.rooms || [])).catch(() => {});
    load(); const iv = setInterval(load, 6000); return () => clearInterval(iv);
  }, [open, isAdmin, tab]);

  useEffect(() => {
    if (!open || !isAdvisor || tab !== 'advisory') return;
    const load = () => api<{ rooms: Room[] }>('/chat/advisory-rooms').then((r) => setAdvRooms(r.rooms || [])).catch(() => {});
    load(); const iv = setInterval(load, 6000); return () => clearInterval(iv);
  }, [open, isAdvisor, tab]);
  useEffect(() => { if (isAdvisor) setUnreadAdv(advRooms.reduce((n, r) => n + (r.unread || 0), 0)); }, [advRooms, isAdvisor]);

  useEffect(() => {
    if (!open || !isAdmin || tab !== 'support') { setUserHits([]); return; }
    const load = () => api<{ users: any[] }>('/chat/users').then((r) => setUserHits(r.users || [])).catch(() => {});
    load(); const iv = setInterval(load, 20000); return () => clearInterval(iv);
  }, [open, isAdmin, tab]);

  // Đánh dấu đã đọc khi đang xem
  useEffect(() => {
    if (!open || !room || !lastId.current) return;
    if (room === 'community') { seenComm.current = lastId.current; try { localStorage.setItem('cl-seen-community', String(lastId.current)); } catch {} setUnreadComm(0); }
    else if (room.startsWith('support:') && user && !isAdmin) { seenSupp.current = lastId.current; try { localStorage.setItem(`cl-seen-support:${user.id}`, String(lastId.current)); } catch {} setUnreadSupp(0); }
    else if (room.startsWith('advisory:') && user && !isAdvisor) { seenAdv.current = lastId.current; try { localStorage.setItem(`cl-seen-advisory:${user.id}`, String(lastId.current)); } catch {} setUnreadAdv(0); }
    if ((room.startsWith('support:') || room.startsWith('advisory:')) && lastId.current > acked.current) {
      acked.current = lastId.current;
      api('/chat/ack', { method: 'POST', body: JSON.stringify({ room, received: lastId.current, read: lastId.current }) }).catch(() => {});
      if (room.startsWith('advisory:') && isAdvisor) setAdvRooms((rs) => rs.map((r) => (r.room === room ? { ...r, unread: 0 } : r)));
    }
  }, [msgs, open, room, user, isAdmin, isAdvisor]);

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }, [msgs, open, tab]);
  useEffect(() => { try { setNotify(localStorage.getItem('cl-notify') !== '0'); } catch {} }, []);
  useEffect(() => { if (user && vapid && notify && typeof Notification !== 'undefined' && Notification.permission === 'granted') subscribePush(); }, [user, vapid, notify]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let hideT: any;
    const show = () => {
      if (hintStop.current) return;
      setHint(true);
      const dur = hintShown.current === 0 ? 30000 : 15000; // lần đầu 30s, sau 15s
      hintShown.current++;
      clearTimeout(hideT);
      hideT = setTimeout(() => setHint(false), dur);
    };
    // Chỉ chào lần MỞ APP đầu (mỗi phiên) — không hiện lại mỗi lần chuyển trang.
    let already = false;
    try { already = !!sessionStorage.getItem('cl-hint-shown'); } catch {}
    // Lần đầu: CHỜ KHÁCH LƯỚT XUỐNG một đoạn (~60% chiều cao màn hình) rồi mới mời (chủ dự án duyệt 7/10/2026).
    // Trước đây hiện sau 2 giây → vừa mở web đã che banner + ô tìm kiếm, khách chưa kịp xem gì đã bị chào.
    // Lướt tức là khách đang thật sự xem trang → lúc đó mời gửi đất mới hợp. Trang không cuộn (bản đồ) thì không hiện.
    // Chỉ tính khi KHÁCH TỰ LƯỚT (lăn chuột / vuốt / phím) — trang tự nhảy (vd mở thẳng phần "Dịch vụ pháp lý"
    // ở /cam-nang?toi=dich-vu-phap-ly) cũng làm trang cuộn nhưng không phải khách lướt, không được bật bảng mời.
    let khachLuot = false;
    const coThaoTac = () => { khachLuot = true; };
    const THAO_TAC = ['wheel', 'touchmove', 'keydown'];
    const daLuot = () => {
      if (!khachLuot || window.scrollY < window.innerHeight * 0.6) return;
      window.removeEventListener('scroll', daLuot);
      show(); try { sessionStorage.setItem('cl-hint-shown', '1'); } catch {}
    };
    if (!already) {
      window.addEventListener('scroll', daLuot, { passive: true });
      THAO_TAC.forEach((s) => window.addEventListener(s, coThaoTac, { passive: true }));
    }
    const iv = setInterval(show, 240000); // hiện lại mỗi 4 phút (trong phiên)
    return () => { window.removeEventListener('scroll', daLuot); THAO_TAC.forEach((s) => window.removeEventListener(s, coThaoTac)); clearTimeout(hideT); clearInterval(iv); };
  }, []);
  function dismissHint() { setHint(false); hintStop.current = true; }
  // ===== Bong bóng chat kéo di chuyển tự do (chat head Android) — dính mép + nhớ vị trí =====
  // ⚠️ KHÔNG nhớ toạ độ điểm ảnh tuyệt đối. Toạ độ đó chỉ đúng với ĐÚNG cỡ cửa sổ và ĐÚNG mức
  // phóng lúc kéo; đổi zoom hay đổi cỡ cửa sổ là bong bóng nhảy ra giữa màn hình, thậm chí lọt
  // hẳn ra ngoài không gọi lại được. Thay vào đó chỉ nhớ HAI thứ không phụ thuộc kích thước:
  //   · mép nào  (bong bóng vốn luôn dính mép trái hoặc phải)
  //   · cao bao nhiêu phần trăm màn hình
  // Từ hai thứ đó tính lại toạ độ mỗi lần mở trang và mỗi lần đổi cỡ cửa sổ → luôn đúng chỗ.
  // Đổi tên khoá (30/9/2026): chủ dự án thấy bong bóng "hơi cao" — là vị trí KÉO CŨ đã nhớ trong máy.
  // Đổi khoá = mọi máy quay về góc dưới phải mặc định một lần; kéo lại thì vẫn nhớ như thường.
  const NEO_KEY = 'cl-bubble-neo2';
  const neo = useRef<{ mep: 'trai' | 'phai'; ty: number } | null>(null);
  const BUB = 56;
  // ⚠️ KHÔNG dùng window.innerWidth: con số đó TÍNH CẢ THANH CUỘN (~15px), nên đặt bong bóng
  // sát mép phải là nó nấp một phần sau thanh cuộn. clientWidth mới là bề rộng NHÌN THẤY.
  function khungNhin() {
    if (typeof document === 'undefined') return { W: 400, H: 800 };
    const e = document.documentElement;
    return { W: e.clientWidth || window.innerWidth, H: e.clientHeight || window.innerHeight };
  }
  function clampBubble(x: number, y: number) {
    const { W, H } = khungNhin();
    return { x: Math.max(6, Math.min(x, W - BUB - 6)), y: Math.max(6, Math.min(y, H - BUB - 6)) };
  }
  function tuNeo(n: { mep: 'trai' | 'phai'; ty: number }) {
    const { W, H } = khungNhin();
    return clampBubble(n.mep === 'trai' ? 8 : W - BUB - 8, n.ty * H);
  }
  useEffect(() => {
    try {
      localStorage.removeItem('cl-bubble-pos'); // bỏ hẳn kiểu nhớ cũ (toạ độ tuyệt đối)
      localStorage.removeItem('cl-bubble-neo'); // vị trí kéo cũ (trước 30/9/2026)
      const s = localStorage.getItem(NEO_KEY);
      if (!s) return;                            // chưa kéo bao giờ → để mặc định góc dưới phải
      const n = JSON.parse(s);
      if (n && (n.mep === 'trai' || n.mep === 'phai') && typeof n.ty === 'number') {
        neo.current = n; setBubblePos(tuNeo(n));
      }
    } catch {}
  }, []);
  // Đổi cỡ cửa sổ / đổi mức phóng → tính lại từ mép + tỉ lệ, không dùng toạ độ cũ.
  useEffect(() => {
    const doiCo = () => { if (neo.current) setBubblePos(tuNeo(neo.current)); };
    window.addEventListener('resize', doiCo);
    return () => window.removeEventListener('resize', doiCo);
  }, []);
  function bubbleDown(e: any) {
    const r = e.currentTarget.getBoundingClientRect();
    bubbleDrag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false, lx: r.left, ly: r.top };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function bubbleMove(e: any) {
    const d = bubbleDrag.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { d.moved = true; if (hint) setHint(false); }
    if (d.moved) { const p = clampBubble(d.ox + dx, d.oy + dy); d.lx = p.x; d.ly = p.y; setBubblePos(p); }
  }
  function bubbleUp() {
    const d = bubbleDrag.current; bubbleDrag.current = null; if (!d) return;
    if (d.moved) {
      bubbleMoved.current = true;
      const { W, H } = khungNhin();
      const mep: 'trai' | 'phai' = (d.lx + BUB / 2) < W / 2 ? 'trai' : 'phai'; // dính mép trái/phải
      const n = { mep, ty: Math.min(1, Math.max(0, d.ly / H)) };               // độ cao tính theo TỈ LỆ
      neo.current = n;
      setBubblePos(tuNeo(n));
      try { localStorage.setItem(NEO_KEY, JSON.stringify(n)); } catch {}
    }
  }

  function pushMsgs(arr: Msg[]) {
    const fresh = (arr || []).filter((m) => m && !seen.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => { seen.current.add(m.id); lastId.current = Math.max(lastId.current, m.id); });
    setMsgs((cur) => [...cur, ...fresh]);
  }
  function primeAudio() { try { if (!audioRef.current) audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)(); if (audioRef.current.state === 'suspended') audioRef.current.resume(); } catch {} }
  function playDing() {
    try {
      primeAudio(); const ctx = audioRef.current; if (!ctx) return; const t0 = ctx.currentTime;
      [880, 1245].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
        const t = t0 + i * 0.12; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26); o.start(t); o.stop(t + 0.3);
      });
    } catch {}
  }
  function toggleNotify() { primeAudio(); setNotify((v) => { const nv = !v; try { localStorage.setItem('cl-notify', nv ? '1' : '0'); } catch {} if (nv) subscribePush(); else unsubscribePush(); return nv; }); }
  function openFromToast(t: { room: string; name: string }) {
    primeAudio(); setOpen(true);
    if (t.room === 'community') setTab('community');
    else if (t.room.startsWith('support:')) { setTab('support'); if (isAdmin) { setRoom(t.room); setPickedName(t.name); } }
    else if (t.room.startsWith('advisory:')) { setTab('advisory'); if (isAdvisor) { setRoom(t.room); setPickedName(t.name); } }
    setToast(null);
  }
  async function subscribePush() {
    try {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || typeof window === 'undefined' || !('PushManager' in window) || !vapidRef.current) return;
      if (typeof Notification === 'undefined' || Notification.permission === 'denied') return;
      if (Notification.permission !== 'granted') { const perm = await Notification.requestPermission(); if (perm !== 'granted') return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(vapidRef.current) as BufferSource });
      await api('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) });
    } catch {}
  }
  async function unsubscribePush() {
    try {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await api('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
    } catch {}
  }
  // Đổi các tin có id trong danh sách thành "đã thu hồi" ngay trên màn hình.
  function danhDauThuHoi(ids: number[]) {
    if (!ids?.length) return;
    const bo = new Set(ids.map(Number));
    setMsgs((cur) => cur.some((m) => bo.has(m.id) && !m.deletedAt)
      ? cur.map((m) => (bo.has(m.id) ? { ...m, deletedAt: m.deletedAt || new Date().toISOString(), kind: 'text', body: '', fileId: null } : m))
      : cur);
  }
  // Kéo thả tệp vào khung chat cho nhanh (vẫn giữ nút kẹp cho ai quen bấm).
  const [dangKeoTep, setDangKeoTep] = useState(false);

  async function guiTep(f?: File | null) {
    if (!f || !room || !user) return;
    setWarn(''); setDangGuiTep(true);
    try { pushMsgs([await uploadChatFile(room, f)]); }
    catch (e: any) { setWarn(e.message || 'Không gửi được tệp.'); }
    finally { setDangGuiTep(false); }
  }
  async function thuHoi(id: number) {
    setMenuTin(0);
    if (!window.confirm('Thu hồi tin nhắn này?\n\nTệp đính kèm sẽ bị xoá khỏi máy chủ và KHÔNG lấy lại được.')) return;
    try { await api(`/chat/messages/${id}`, { method: 'DELETE' }); danhDauThuHoi([id]); }
    catch (e: any) { setWarn(e.message || 'Không thu hồi được.'); }
  }
  // Admin bật/tắt quyền gửi ảnh-PDF của đúng khách đang mở.
  async function doiQuyenTep() {
    const uid = Number(room.slice(room.startsWith('support:') ? 8 : 9));
    if (!uid) return;
    try {
      const r = await api<{ cho: boolean }>('/chat/quyen-gui-file', { method: 'POST', body: JSON.stringify({ userId: uid, cho: !peerUpload }) });
      setPeerUpload(!!r.cho);
    } catch (e: any) { setWarn(e.message || 'Không đổi được quyền.'); }
  }
  async function send() {
    const body = text.trim(); if (!body || !room || !user) return;
    setText(''); setWarn('');
    try {
      const r = await api<{ id: number; createdAt: string; name: string; avatar?: string | null }>('/chat/messages', { method: 'POST', body: JSON.stringify({ room, body }) });
      pushMsgs([{ id: r.id, userId: user.id, name: r.name, avatar: r.avatar, body, createdAt: r.createdAt }]);
    } catch (e: any) { setWarn(e.message || 'Không gửi được.'); setText(body); }
  }
  // ── GỬI ĐỊNH VỊ ───────────────────────────────────────────────────────────
  // Chỉ bật ở phòng HỖ TRỢ (support:) và KÝ GỬI & TƯ VẤN (advisory:) — hai bên biết nhau,
  // gửi chỗ đất cho nhau là việc bình thường. CHAT CỘNG ĐỒNG thì KHÔNG, vì ở đó ai cũng đọc
  // được, lộ vị trí nhà/đất của mình cho người lạ (chủ dự án dặn rõ).
  // Toạ độ gửi đi là WGS84 (vĩ độ, kinh độ) — dán vào Google Maps hay mở trên bản đồ của web
  // đều ra đúng chỗ.
  const [dangDinhVi, setDangDinhVi] = useState(false);
  const choGuiViTri = !!room && (room.startsWith('support:') || room.startsWith('advisory:'));

  async function guiViTri() {
    if (!room || !user || dangDinhVi) return;
    if (!navigator.geolocation) { setWarn('Máy này không hỗ trợ định vị.'); return; }
    setDangDinhVi(true); setWarn('');
    navigator.geolocation.getCurrentPosition(async (v) => {
      nhoViTri(v.coords.longitude, v.coords.latitude);   // lib/viTri.ts: chỗ khác dùng lại, khỏi xin thêm lần nữa
      const body = `📍 Vị trí: ${v.coords.latitude.toFixed(6)}, ${v.coords.longitude.toFixed(6)}`;
      try {
        const r = await api<{ id: number; createdAt: string; name: string; avatar?: string | null }>(
          '/chat/messages', { method: 'POST', body: JSON.stringify({ room, body }) });
        pushMsgs([{ id: r.id, userId: user.id, name: r.name, avatar: r.avatar, body, createdAt: r.createdAt }]);
      } catch (e: any) { setWarn(e.message || 'Không gửi được vị trí.'); }
      setDangDinhVi(false);
    }, (e) => {
      setDangDinhVi(false);
      if (e.code === 1) ghiTuChoiViTri();
      setWarn(e.code === 1 ? 'Bạn chưa cho phép truy cập vị trí. Hãy bật quyền vị trí cho trang này rồi thử lại.'
        : 'Không lấy được vị trí. Thử lại ở chỗ thoáng hoặc bật GPS.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }

  async function submitSell() {
    setSerr('');
    if (!sf.name.trim() || !sf.phone.trim()) return setSerr('Vui lòng nhập họ tên và số điện thoại.');
    setBusy(true);
    try { await api('/consignments', { method: 'POST', body: JSON.stringify(sf) }); setSent(true); }
    catch (e: any) { setSerr(e.message); } finally { setBusy(false); }
  }

  const adminSupport = isAdmin && tab === 'support';
  const staffAdvisory = isAdvisor && tab === 'advisory';
  const twoPane = adminSupport || staffAdvisory;
  const coTheThuHoi = isAdmin || isAdvisor; // chỉ admin & tư vấn viên gỡ được tin của chính mình
  const needPick = twoPane && !room;
  let lastMineId = 0; if (user) for (const m of msgs) if (m.userId === user.id) lastMineId = m.id;
  const roomList = (tab === 'advisory' ? advRooms : rooms).filter((r) => r.room !== `support:${user?.id}` && r.room !== `advisory:${user?.id}`).filter((r) => !roomQ.trim() || (r.name || '').toLowerCase().includes(roomQ.trim().toLowerCase()));
  const roomSet = new Set(rooms.map((r) => r.room));
  const nq = roomQ.trim().toLowerCase();
  const newUsers = adminSupport ? userHits.filter((u) => u.id !== user?.id && !roomSet.has(`support:${u.id}`) && (!nq || (u.name || '').toLowerCase().includes(nq) || (u.phone || '').toLowerCase().includes(nq))) : [];
  const activeRoom = (tab === 'advisory' ? advRooms : rooms).find((r) => r.room === room);
  const activeName = activeRoom?.name || pickedName || 'Khách hàng';
  const activePhone = activeRoom?.phone || pickedPhone || '';
  const activeOnline = activeRoom ? !!activeRoom.online : (userHits.find((u) => `support:${u.id}` === room)?.online ?? false);
  const canType = tab !== 'sell' && !!user && !!room && !needPick;
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm';
  const myName = (user as any)?.fullName || (user as any)?.email || '';
  const chatNames = Array.from(new Set(msgs.map((m) => m.name).filter(Boolean))) as string[];
  const allMentionNames = Array.from(new Set([...allNames, ...chatNames])) as string[];
  const mentionQ = (text.match(/(?:^|\s)@([^\s@]{0,24})$/) || [])[1];
  const mentionList = (room === 'community' && mentionQ !== undefined)
    ? allMentionNames.filter((n) => norm(n) !== norm(myName) && norm(n).includes(norm(mentionQ))).slice(0, 8)
    : [];
  const pickMention = (n: string) => { setText((t) => t.replace(/(^|\s)@[^\s@]{0,24}$/, (_f, pre) => `${pre}@${n} `)); setTimeout(() => msgInputRef.current?.focus(), 0); };

  return (
    <>
      {toast && (
        <div className="fixed top-4 left-3 right-3 sm:left-auto sm:right-5 sm:w-80 z-[60] select-none"
          style={{ transform: `translateX(${dragX}px)`, opacity: Math.max(0, 1 - Math.abs(dragX) / 170), touchAction: 'pan-y' }}
          onPointerDown={(e) => { dragStart.current = e.clientX; draggedRef.current = false; }}
          onPointerMove={(e) => { if (dragStart.current != null) { const dx = e.clientX - dragStart.current; if (Math.abs(dx) > 8) draggedRef.current = true; setDragX(dx); } }}
          onPointerUp={() => { if (Math.abs(dragX) > 70) setToast(null); dragStart.current = null; setDragX(0); }}
          onPointerCancel={() => { dragStart.current = null; setDragX(0); }}>
          <div onClick={() => { if (draggedRef.current) { draggedRef.current = false; return; } openFromToast(toast); }}
            className="cl-tb cursor-pointer">
            {/* Kiểu thông báo iPhone dùng chung (.cl-tb, globals.css) */}
            <span className="cl-tb-icon">{toast.avatar ? <img src={toast.avatar} alt="" /> : (toast.name || '?').charAt(0).toUpperCase()}</span>
            <div className="cl-tb-than">
              <p className="cl-tb-dau"><span>Tin nhắn</span><span className="gio">bây giờ</span></p>
              <p className="cl-tb-tieu-de truncate">{toast.name}</p>
              <p className="cl-tb-noi-dung truncate">{toast.body}</p>
            </div>
          </div>
        </div>
      )}
      {/* Popup MỜI GỌI gửi bán (ĐIỆN THOẠI dọc) — mobile không có bong bóng nên hiện lời mời độc lập ở góc dưới. Bấm → mở form Gửi bán. */}
      {!open && hint && (
        <div className="fixed z-[55] cl-fab right-4 md:right-5 pointer-events-none sm:hidden">
          <div className="relative pointer-events-auto cl-tb !block w-[230px] animate-bounce" style={{ animationDuration: '1.5s' }}>
            <button onClick={dismissHint} aria-label="Đóng" className="absolute -top-2 -right-2 w-5 h-5 bg-slate-700 hover:bg-slate-900 text-white rounded-full text-xs grid place-items-center">×</button>
            <button onClick={() => { primeAudio(); setTab('sell'); setOpen(true); dismissHint(); }} className="text-left w-full">
              <p className="cl-tb-dau"><span>Cam Lâm Land</span><span className="gio">bây giờ</span></p>
              <p className="cl-tb-tieu-de">Có nhà đất cần bán / ký gửi?</p>
              <p className="cl-tb-noi-dung">Bấm vào đây để gửi bán, miễn phí.</p>
            </button>
          </div>
        </div>
      )}
      {/* Bong bóng chat NỔI — hiện trên web & tablet/iPad (sm+, ≥640px); điện thoại (dọc) dùng icon chat trên header. Kèm lời mời gửi bán phía trên. */}
      {/* Bong bóng đã kéo: dính mép PHẢI thì neo bằng `right` (khung lời mời rộng 210px mọc sang TRÁI), dính mép
          TRÁI thì neo `left` + canh trái. Trước đây luôn neo `left` theo toạ độ bong bóng 56px → lời mời tràn mất
          ra ngoài mép phải màn hình. Neo `bottom` để lời mời mọc LÊN trên, bong bóng giữ đúng chỗ đã kéo. */}
      <div className={`fixed z-[55] hidden sm:flex flex-col gap-2 select-none pointer-events-none ${neo.current?.mep === 'trai' && bubblePos ? 'items-start' : 'items-end'} ${bubblePos ? '' : 'cl-fab right-4 md:right-5'}`}
        style={bubblePos ? {
          ...(neo.current?.mep === 'trai' || !neo.current ? { left: bubblePos.x } : { right: khungNhin().W - bubblePos.x - BUB }),
          bottom: khungNhin().H - bubblePos.y - BUB,
        } : undefined}>
        {!open && hint && (
          <div className="relative pointer-events-auto cl-tb !block w-[230px] animate-bounce" style={{ animationDuration: '1.5s' }}>
            <button onClick={dismissHint} aria-label="Đóng" className="absolute -top-2 -right-2 w-5 h-5 bg-slate-700 hover:bg-slate-900 text-white rounded-full text-xs grid place-items-center">×</button>
            <button onClick={() => { primeAudio(); setTab('sell'); setOpen(true); dismissHint(); }} className="text-left w-full">
              <p className="cl-tb-dau"><span>Cam Lâm Land</span><span className="gio">bây giờ</span></p>
              <p className="cl-tb-tieu-de">Có nhà đất cần bán / ký gửi?</p>
              <p className="cl-tb-noi-dung">Bấm vào đây để gửi bán, miễn phí.</p>
            </button>
          </div>
        )}
        <button onPointerDown={bubbleDown} onPointerMove={bubbleMove} onPointerUp={bubbleUp} onPointerCancel={() => { bubbleDrag.current = null; }} style={{ touchAction: 'none' }}
          onClick={() => { if (bubbleMoved.current) { bubbleMoved.current = false; return; } primeAudio(); if (!open) setTab('advisory'); setOpen((o) => !o); }} aria-label="Tin nhắn & gửi bán" title="Bấm để mở · Giữ và kéo để di chuyển"
          className="relative pointer-events-auto w-14 h-14 grid place-items-center bg-[#0A2540] hover:bg-[#0d2f54] text-white rounded-full shadow-2xl shadow-black/40 ring-2 ring-white/40 transition hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing">
          {open ? <span className="text-2xl leading-none">×</span> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" /></svg>}
          {!open && unread > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 grid place-items-center bg-red-600 text-white text-[11px] font-bold rounded-full ring-2 ring-white">{unread > 99 ? '99+' : unread}</span>}
        </button>
      </div>

      {open && (
        <>
        {/* Lớp phủ CHỈ chặn thao tác lớp dưới (trang + thanh dưới) khi chat mở; đóng chat bằng nút ✕ (bấm ra ngoài KHÔNG đóng). */}
        <div className="fixed inset-0 z-[55] bg-black/30" aria-hidden="true" />
        <div className={`fixed z-[56] bg-white shadow-2xl flex flex-col overflow-hidden inset-0 pt-[env(safe-area-inset-top)] sm:inset-auto sm:pt-0 sm:bottom-5 sm:right-5 sm:w-[94vw] ${twoPane ? 'sm:max-w-[680px]' : 'sm:max-w-sm'} sm:h-[70vh] sm:max-h-[580px] sm:rounded-2xl sm:border sm:border-slate-200`}>
          <div className="bg-gradient-to-r from-[#0A2540] to-[#10355f] text-white shrink-0">
            <div className="flex items-center justify-between px-4 pt-3">
              <b className="flex items-center gap-2">Cam Lâm Land {tab !== 'sell' && <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-slate-400'}`} />}</b>
              <div className="flex items-center gap-3">
                <button onClick={toggleNotify} title={notify ? 'Tắt báo tin nhắn' : 'Bật báo tin nhắn'} className={`grid h-8 w-8 place-items-center rounded-[9px] border border-white/25 transition ${notify ? 'bg-white/15 text-[#E2C275]' : 'bg-white/5 text-white/45'} hover:bg-white/25`}>
                  {/* Chuông kiểu biểu tượng ứng dụng, khớp thẻ thông báo iPhone (.cl-tb). Tắt báo thì có gạch chéo. */}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />{!notify && <path d="M3 3l18 18" />}</svg>
                </button>
                <button onClick={() => setOpen(false)} aria-label="Đóng" title="Đóng" className="text-white/80 hover:text-white text-xl leading-none">✕</button>
              </div>
            </div>
            <div className="flex mt-2 text-[13px] font-bold">
              <button onClick={() => setTab('community')} className={`relative flex-1 py-2 border-b-2 ${tab === 'community' ? 'border-[#C8A14B] text-white' : 'border-transparent text-white/55'}`}>
                Cộng đồng{unreadComm > 0 && tab !== 'community' && <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
              </button>
              <button onClick={() => setTab('support')} className={`relative flex-1 py-2 border-b-2 ${tab === 'support' ? 'border-[#C8A14B] text-white' : 'border-transparent text-white/55'}`}>
                Liên hệ admin{unreadSupp > 0 && tab !== 'support' && <span className="absolute top-0.5 right-1 min-w-[16px] h-4 px-1 grid place-items-center bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-[#0A2540]">{unreadSupp > 99 ? '99+' : unreadSupp}</span>}
              </button>
              <button onClick={() => setTab((t) => (t === 'sell' || t === 'advisory') ? t : 'sell')} className={`relative flex-1 py-2 border-b-2 ${(tab === 'sell' || tab === 'advisory') ? 'border-[#C8A14B] text-white' : 'border-transparent text-white/55'}`}>
                Ký gửi & Tư vấn{unreadAdv > 0 && tab !== 'advisory' && <span className="absolute top-0.5 right-1 min-w-[16px] h-4 px-1 grid place-items-center bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-[#0A2540]">{unreadAdv > 99 ? '99+' : unreadAdv}</span>}
              </button>
            </div>
            {(tab === 'sell' || tab === 'advisory') && (
              <div className="flex gap-2 px-2 pb-2">
                <button onClick={() => setTab('sell')} className={`relative flex-1 py-1.5 rounded-full text-[12px] font-bold transition ${tab === 'sell' ? 'bg-white text-[#0A2540]' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                  Gửi bán
                </button>
                <button onClick={() => setTab('advisory')} className={`relative flex-1 py-1.5 rounded-full text-[12px] font-bold transition ${tab === 'advisory' ? 'bg-white text-[#0A2540]' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                  Tư vấn đầu tư & Pháp lý{unreadAdv > 0 && tab !== 'advisory' && <span className="absolute -top-0.5 right-1.5 min-w-[15px] h-[15px] px-1 grid place-items-center bg-red-500 text-white text-[9px] font-bold rounded-full">{unreadAdv > 99 ? '99+' : unreadAdv}</span>}
                </button>
              </div>
            )}
          </div>

          {tab === 'sell' ? (
            <div className="flex-1 overflow-y-auto scroll-soft p-4">
              {sent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto text-3xl font-bold">✓</div>
                  <p className="font-bold text-[#0A2540] mt-4 text-lg">Đã gửi thông tin!</p>
                  <p className="text-sm text-slate-500 mt-1">Cam Lâm Land sẽ liên hệ bạn sớm nhất.</p>
                  <button onClick={() => { setSent(false); setSf({ name: '', phone: '', propertyType: '', ward: '', address: '', area: '', priceExpect: '', description: '' }); }} className="mt-5 bg-[#0A2540] text-white font-bold px-6 py-2.5 rounded-xl">Gửi tin khác</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">Ký gửi miễn phí — để lại thông tin, chúng tôi định giá & bán giúp bạn.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input className={inp} value={sf.name} onChange={(e) => setS('name', e.target.value)} placeholder="Họ tên *" />
                    <input className={inp} value={sf.phone} onChange={(e) => setS('phone', e.target.value.replace(/[^\d+]/g, ''))} placeholder="SĐT *" inputMode="tel" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select className={inp} value={sf.propertyType} onChange={(e) => setS('propertyType', e.target.value)}><option value="">Loại hình</option>{TYPES.map((t) => <option key={t} value={t}>{PROPERTY_LABELS[t]}</option>)}</select>
                    <select className={inp} value={sf.ward} onChange={(e) => setS('ward', e.target.value)}><option value="">Xã / phường</option><optgroup label="Xã hiện nay (sau sáp nhập)">{WARDS_NEW.map((w) => <option key={w} value={w}>{w}</option>)}</optgroup><optgroup label="Xã/thị trấn cũ">{WARDS_OLD.map((w) => <option key={w} value={w}>{w}</option>)}</optgroup></select>
                  </div>
                  <input className={inp} value={sf.address} onChange={(e) => setS('address', e.target.value)} placeholder="Địa chỉ (đường, thôn…)" />
                  <div className="grid grid-cols-2 gap-3">
                    <input className={inp} type="number" min="0" value={sf.area} onChange={(e) => setS('area', e.target.value)} placeholder="Diện tích (m²)" />
                    <input className={inp} value={sf.priceExpect} onChange={(e) => setS('priceExpect', e.target.value)} placeholder="Giá mong muốn" />
                  </div>
                  <textarea className={`${inp} min-h-[70px]`} value={sf.description} onChange={(e) => setS('description', e.target.value)} placeholder="Mô tả thêm (hướng, pháp lý…)" />
                  {serr && <p className="text-sm text-red-600 font-semibold">{serr}</p>}
                  <button disabled={busy} onClick={submitSell} className="cl-press w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl">{busy ? 'Đang gửi…' : 'Gửi thông tin'}</button>
                  <p className="text-[11px] text-slate-400 text-center">Hoặc gọi <a href="tel:0988888888" className="font-bold text-[#0A2540]">0988 888 888</a></p>
                </div>
              )}
            </div>
          ) : !user ? (
            <div className="flex-1 grid place-items-center p-6 text-center">
              <div>
                <p className="text-slate-500 text-sm">Đăng nhập để chat cộng đồng & nhắn admin.</p>
                <Link href="/login" className="inline-block mt-3 bg-[#0A2540] text-white font-bold px-5 py-2.5 rounded-xl text-sm">Đăng nhập</Link>
              </div>
            </div>
          ) : (
            <div className={`flex-1 min-h-0 flex ${twoPane ? 'flex-row' : 'flex-col'}`}>
              {twoPane && (
                <aside className={`${room ? 'hidden sm:flex' : 'flex'} sm:order-2 flex-col shrink-0 sm:border-l border-slate-100 bg-white w-full ${(!room || listOpen) ? 'sm:w-52' : 'sm:w-0 sm:overflow-hidden sm:border-l-0'} transition-all`}>
                  <div className="px-2 py-2 border-b border-slate-100 shrink-0 space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] font-bold text-slate-500">{tab === 'advisory' ? '💰 Tư vấn đầu tư & Pháp lý' : '💬 Hội thoại'} ({(tab === 'advisory' ? advRooms : rooms).length})</p>
                      {tab === 'advisory' && <a href="/tu-van" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-red-600 hover:underline shrink-0">Trang quản trị ↗</a>}
                    </div>
                    <input value={roomQ} onChange={(e) => setRoomQ(e.target.value)} placeholder="🔍 Tìm khách…" className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-[#0A2540]" />
                  </div>
                  <div className="flex-1 overflow-y-auto scroll-soft">
                    {roomList.length === 0 && newUsers.length === 0 ? <p className="p-3 text-xs text-slate-400">{roomQ ? 'Không tìm thấy khách.' : 'Chưa có khách nhắn.'}</p> : (
                      <>
                        {roomList.map((r) => {
                          const active = room === r.room;
                          return (
                            <button key={r.room} onClick={() => { setRoom(r.room); setPickedName(r.name); setPickedPhone(r.phone || ''); }} className={`w-full flex items-center gap-2 px-2.5 py-2 text-left border-b border-slate-50 hover:bg-slate-50 ${active ? 'bg-slate-100' : ''}`}>
                              <span className="relative shrink-0">
                                <span className="w-9 h-9 rounded-full bg-[#0A2540] text-[#C8A14B] grid place-items-center text-sm font-bold">{(r.name || '?').charAt(0).toUpperCase()}</span>
                                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${r.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-[#0A2540] truncate">{r.name}</span>
                                <span className="block text-[11px] text-slate-400 truncate">{r.lastBody || '—'}</span>
                              </span>
                              {(r.unread || 0) > 0 && <span className="shrink-0 min-w-[18px] h-[18px] px-1 grid place-items-center bg-red-500 text-white text-[10px] font-bold rounded-full">{(r.unread || 0) > 99 ? '99+' : r.unread}</span>}
                            </button>
                          );
                        })}
                        {newUsers.length > 0 && <p className="px-2.5 py-1 text-[10px] font-bold text-slate-400 bg-slate-50 uppercase tracking-wide">Khách chưa nhắn</p>}
                        {newUsers.map((u) => {
                          const active = room === `support:${u.id}`;
                          return (
                            <button key={'u' + u.id} onClick={() => { setRoom(`support:${u.id}`); setPickedName(u.name); setPickedPhone(u.phone || ''); }} className={`w-full flex items-center gap-2 px-2.5 py-2 text-left border-b border-slate-50 hover:bg-slate-50 ${active ? 'bg-slate-100' : ''}`}>
                              <span className="relative shrink-0">
                                {u.avatar ? <img src={u.avatar} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full bg-slate-300 text-white grid place-items-center text-sm font-bold">{(u.name || '?').charAt(0).toUpperCase()}</span>}
                                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${u.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-[#0A2540] truncate">{u.name}</span>
                                <span className="block text-[11px] text-emerald-600 truncate">Bấm để nhắn lần đầu</span>
                              </span>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                </aside>
              )}
              <div className={`flex-1 min-h-0 flex flex-col sm:order-1 ${twoPane && !room ? 'hidden sm:flex' : 'flex'}`}>
                {twoPane && room && (
                  <div className="flex items-center gap-2 px-2.5 py-2 border-b border-slate-100 shrink-0 bg-white">
                    <button onClick={() => setRoom('')} className="sm:hidden w-7 h-7 grid place-items-center rounded-full hover:bg-slate-100 text-slate-600">←</button>
                    <button onClick={() => setListOpen((v) => !v)} title="Thu gọn danh sách" className="hidden sm:grid w-7 h-7 place-items-center rounded-full hover:bg-slate-100 text-slate-600">☰</button>
                    <div className="min-w-0 leading-tight">
                      <b className="text-sm text-[#0A2540] truncate flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${activeOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />{activeName}</b>
                      <span className="text-[11px] flex items-center gap-1.5">
                        {activePhone ? <a href={`tel:${activePhone}`} className="text-red-600 font-semibold">📞 {activePhone}</a> : null}
                        <span className={activeOnline ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{activeOnline ? '● Đang online' : '○ Ngoại tuyến'}</span>
                      </span>
                    </div>
                    {isAdmin && peerUpload !== null && (
                      <button onClick={doiQuyenTep} title={peerUpload ? 'Đang CHO khách gửi ảnh/tệp — bấm để khoá lại' : 'Khách CHƯA gửi được ảnh/tệp — bấm để mở'}
                        className={`ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${peerUpload ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
                        📎 {peerUpload ? 'Cho gửi' : 'Đã khoá'}
                      </button>
                    )}
                  </div>
                )}
                {tab === 'community' && (
                <div className="shrink-0 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-2 px-2.5 py-1">
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-[11px] font-bold text-[#0A2540] truncate">👥 Cộng đồng Cam Lâm Land</span>
                      <span className="block text-[9px] text-slate-500 truncate">Hỗ trợ: <a href="tel:0988888888" className="font-semibold text-[#0A2540]">0988 888 888</a></span>
                    </span>
                    <button onClick={() => setGameOpen((v) => !v)} className="shrink-0 flex items-center gap-1 rounded-full bg-[#0A2540] pl-2 pr-2.5 py-1 text-[10px] font-bold text-white hover:brightness-110">
                      <span>🎮</span><span className="text-[#C8A14B]">Game giải trí</span><span>{gameOpen ? '▴' : '▾'}</span>
                    </button>
                  </div>
                  {gameOpen && <div className="px-2 pb-2"><FlappyMini maxH={168} /></div>}
                </div>
              )}
                {tab === 'advisory' && !twoPane && (
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 shrink-0 text-center">
                  <p className="text-[11px] font-bold text-[#0A2540]">💰 Tư vấn đầu tư & pháp lý BĐS Cam Lâm</p>
                  <p className="text-[10px] text-slate-500">Đội ngũ chuyên viên tư vấn đầu tư & pháp lý sẽ phản hồi sớm nhất.</p>
                </div>
              )}
                <div ref={boxRef} className="flex-1 overflow-y-auto scroll-soft p-3 space-y-2 bg-slate-50">
                  {needPick ? <p className="text-center text-sm text-slate-400 mt-8">← Chọn một khách để trả lời.</p>
                    : msgs.length === 0 ? <p className="text-center text-sm text-slate-400 mt-8">{tab === 'community' ? 'Chào mừng đến Cộng đồng đầu tư Cam Lâm 👋' : tab === 'advisory' ? (twoPane ? 'Chọn một khách để tư vấn đầu tư 👋' : 'Đặt câu hỏi về đầu tư & pháp lý BĐS Cam Lâm — đội ngũ tư vấn sẽ trả lời sớm 💰') : isAdmin ? 'Chưa có tin nhắn — gửi lời chào tới khách 👋' : 'Gửi tin cho admin để được hỗ trợ.'}</p>
                    : msgs.map((m) => {
                      const mine = m.userId === user.id;
                      // Kênh Tư vấn đầu tư: khách thấy người trả lời là "Chuyên viên tư vấn" + logo website (ẩn danh tính nhân viên).
                      const maskAdv = !mine && tab === 'advisory' && !isAdvisor;
                      const dName = maskAdv ? 'Chuyên viên tư vấn' : m.name;
                      const dAvatar = maskAdv ? '/icons/icon-192.png' : m.avatar;
                      // Tin ĐÃ THU HỒI: chỉ còn một dòng chữ mờ, không tên, không avatar, không nút gì.
                      if (m.deletedAt) return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <p className="max-w-[78%] rounded-2xl border border-dashed border-slate-300 px-3 py-1.5 text-[13px] italic text-slate-400">Tin nhắn đã được thu hồi</p>
                        </div>
                      );
                      const coTep = m.kind === 'image' || m.kind === 'file';
                      return (
                        <div key={m.id}>
                          <div className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                            {mine && coTheThuHoi && (
                              <span className="relative shrink-0 self-center">
                                <button onClick={() => setMenuTin((v) => (v === m.id ? 0 : m.id))} title="Tuỳ chọn" className="w-6 h-6 grid place-items-center rounded-full leading-none text-slate-300 hover:text-slate-600 hover:bg-slate-200">⋯</button>
                                {menuTin === m.id && (
                                  <button onClick={() => thuHoi(m.id)} className="absolute right-0 bottom-7 z-10 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-lg hover:bg-red-50">Thu hồi tin nhắn</button>
                                )}
                              </span>
                            )}
                            {!mine && (dAvatar ? <img src={dAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 bg-white border border-slate-200" /> : <span className="w-7 h-7 rounded-full bg-[#0A2540] text-[#C8A14B] grid place-items-center text-[11px] font-bold shrink-0">{(dName || '?').charAt(0).toUpperCase()}</span>)}
                            <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-[#0A2540] text-white rounded-br-sm' : 'bg-white border border-slate-200 rounded-bl-sm'}`}>
                              {!mine && <p className="text-[11px] font-bold text-[#C8A14B] mb-0.5">{dName}</p>}
                              {coTep
                                ? <ChatDinhKem fileId={m.fileId} fileName={m.fileName} fileMime={m.fileMime} fileSize={m.fileSize} mine={mine} />
                                : (() => {
                                    // Tin nhắn VỊ TRÍ: vẽ thành thẻ có nút mở bản đồ / chỉ đường,
                                    // thay vì để người nhận tự chép hai con số ra Google Maps.
                                    const vt = /^📍\s*Vị trí:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(m.body || '');
                                    if (!vt) return <p className="whitespace-pre-wrap break-words">{renderWithMentions(m.body, allMentionNames, myName)}</p>;
                                    const la = vt[1], lo = vt[2];
                                    return (
                                      <div className="min-w-[190px]">
                                        <p className="font-bold">📍 Vị trí đã gửi</p>
                                        <p className={`text-[11px] tabular-nums ${mine ? 'text-white/70' : 'text-slate-500'}`}>{la}, {lo}</p>
                                        <div className="mt-1.5 flex gap-1.5">
                                          <a href={`/map?lat=${la}&lng=${lo}`} target="_blank" rel="noopener noreferrer"
                                            className={`flex-1 text-center rounded-lg px-2 py-1 text-[11px] font-bold ${mine ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>Xem trên bản đồ</a>
                                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${la},${lo}`} target="_blank" rel="noopener noreferrer"
                                            className={`flex-1 text-center rounded-lg px-2 py-1 text-[11px] font-bold ${mine ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>Chỉ đường</a>
                                        </div>
                                      </div>
                                    );
                                  })()}
                            </div>
                          </div>
                          {adminSupport && mine && m.id === lastMineId && peerAck && (
                            <p className="text-[10px] text-slate-400 text-right mt-0.5 pr-1">{peerAck.read >= m.id ? '✓✓ Đã xem' : peerAck.received >= m.id ? '✓ Đã nhận' : 'Đã gửi'}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
                {canType && (
                  <div className="border-t border-slate-100 shrink-0 relative"
                    onDragOver={(e) => { if (canUpload) { e.preventDefault(); setDangKeoTep(true); } }}
                    onDragLeave={() => setDangKeoTep(false)}
                    onDrop={(e) => {
                      if (!canUpload) return;
                      e.preventDefault(); setDangKeoTep(false);
                      const f = e.dataTransfer?.files?.[0];
                      if (f) guiTep(f);
                    }}>
                    {dangKeoTep && (
                      <div className="absolute inset-0 z-10 grid place-items-center rounded-t-xl border-2 border-dashed border-[#C8A14B] bg-[#C8A14B]/10 pointer-events-none">
                        <p className="text-xs font-bold text-[#8a6d20]">Thả tệp vào đây để gửi</p>
                      </div>
                    )}
                    {warn && <p className="px-3 pt-2 text-xs text-red-600 font-semibold leading-snug">⚠️ {warn}</p>}
                    <div className="p-2">
                      {mentionList.length > 0 && (
                        <div className="mb-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-44 overflow-y-auto">
                          {mentionList.map((n) => (
                            <button key={n} type="button" onMouseDown={(e) => { e.preventDefault(); pickMention(n); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-[#0A2540] text-[#C8A14B] grid place-items-center text-[10px] font-bold shrink-0">{n.charAt(0).toUpperCase()}</span>
                              <b className="text-[#0A2540] truncate">{n}</b>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 items-center">
                        {canUpload && (
                          <>
                            <input ref={tepRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={(e) => { guiTep(e.target.files?.[0]); e.target.value = ''; }} />
                            {/* Nút kẹp tệp: biểu tượng vẽ nét cho sắc, đang gửi thì quay vòng.
                                Emoji 📎 cũ mỗi máy hiện một kiểu và bị mờ trên màn hình nét cao. */}
                            <button onClick={() => tepRef.current?.click()} disabled={dangGuiTep}
                              title="Gửi ảnh hoặc tệp PDF (tối đa 10MB) — hoặc kéo thả tệp vào khung chat"
                              className="cl-press shrink-0 w-9 h-9 grid place-items-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-[#0A2540] hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-50">
                              {dangGuiTep ? (
                                <svg viewBox="0 0 24 24" width="17" height="17" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                                  <path d="M21 12a9 9 0 1 1-6.2-8.6" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21.4 11.1 12.3 20.2a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.1 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5" />
                                </svg>
                              )}
                            </button>
                          </>
                        )}
                        {choGuiViTri && (
                          <button onClick={guiViTri} disabled={dangDinhVi}
                            title="Gửi vị trí hiện tại của bạn"
                            className="cl-press shrink-0 w-9 h-9 grid place-items-center rounded-full border border-slate-200 bg-white text-lg hover:bg-slate-50 disabled:opacity-50">
                            {dangDinhVi ? '…' : '📍'}
                          </button>
                        )}
                        <input ref={msgInputRef} value={text} onChange={(e) => { setText(e.target.value); if (warn) setWarn(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { if (mentionList.length) { e.preventDefault(); pickMention(mentionList[0]); } else send(); } }} placeholder="Nhập tin nhắn…  (gõ @ để nhắc tên)" className="flex-1 border border-slate-300 rounded-full px-3.5 py-2 text-sm outline-none focus:border-[#0A2540]" />
                        <button onClick={send} className="cl-press bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 text-sm font-bold shrink-0">Gửi</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </>
  );
}
