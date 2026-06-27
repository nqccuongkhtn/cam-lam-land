'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getToken } from '@/lib/token';
import { WARDS, PROPERTY_LABELS, type PropertyType } from '@/lib/types';

interface Msg { id: number; userId: number | null; name: string; avatar?: string | null; body: string; createdAt: string; }
interface Room { room: string; name: string; phone?: string | null; online?: boolean; lastBody: string; lastAt: string; count: number; }
const TYPES: PropertyType[] = ['land', 'house', 'apartment', 'villa', 'commercial', 'farm'];
type Tab = 'community' | 'support' | 'sell';

function urlB64ToUint8(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64); const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function ChatWidget() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [open, setOpen] = useState(false);
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
  const [sf, setSf] = useState({ name: '', phone: '', propertyType: '', ward: '', address: '', area: '', priceExpect: '', description: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serr, setSerr] = useState('');
  const [hint, setHint] = useState(false);
  const hintShown = useRef(0);
  const hintStop = useRef(false);
  const [peerAck, setPeerAck] = useState<{ received: number; read: number } | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [roomQ, setRoomQ] = useState('');
  const [userHits, setUserHits] = useState<{ id: number; name: string; email: string; phone: string | null; avatar: string | null; online?: boolean }[]>([]);
  const [pickedName, setPickedName] = useState('');
  const [pickedPhone, setPickedPhone] = useState('');
  const [notify, setNotify] = useState(true);
  const [vapid, setVapid] = useState('');
  const [toast, setToast] = useState<{ room: string; name: string; body: string; avatar?: string | null } | null>(null);
  const [dragX, setDragX] = useState(0);
  const dragStart = useRef<number | null>(null);
  const draggedRef = useRef(false);
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
  const seenComm = useRef(0), seenSupp = useRef(0);
  const unread = unreadComm + unreadSupp;
  const setS = (k: string, v: string) => setSf((s) => ({ ...s, [k]: v }));

  useEffect(() => { setTab(user ? 'community' : 'sell'); }, [user]);
  useEffect(() => {
    try { seenComm.current = Number(localStorage.getItem('cl-seen-community') || 0); } catch {}
    if (user) { try { seenSupp.current = Number(localStorage.getItem(`cl-seen-support:${user.id}`) || 0); } catch {} }
  }, [user]);
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
    else setRoom('');
  }, [tab, user, isAdmin]);

  // Đếm tin chưa đọc (chạy nền kể cả khi đóng)
  useEffect(() => {
    if (!user) { setUnreadComm(0); setUnreadSupp(0); return; }
    const poll = async () => {
      try { const c = await api<{ messages: Msg[] }>(`/chat/messages?room=community&after=${seenComm.current}`); setUnreadComm(c.messages.filter((m) => m.userId !== user.id).length); } catch {}
      if (!isAdmin) { try { const s = await api<{ messages: Msg[] }>(`/chat/messages?room=support:${user.id}&after=${seenSupp.current}`); setUnreadSupp(s.messages.filter((m) => m.userId !== user.id).length); if (s.messages.length) api('/chat/ack', { method: 'POST', body: JSON.stringify({ room: `support:${user.id}`, received: Math.max(...s.messages.map((m) => m.id)) }) }).catch(() => {}); } catch {} }
    };
    poll();
    const iv = setInterval(poll, 12000);
    return () => clearInterval(iv);
  }, [user, isAdmin]);

  // Phòng đang mở: nạp + polling dự phòng
  useEffect(() => {
    if (!open || !user || !room) { setMsgs([]); return; }
    seen.current = new Set(); lastId.current = 0; acked.current = 0; setMsgs([]); setWarn(''); setPeerAck(null);
    let alive = true;
    const tick = async () => { try { const r = await api<{ messages: Msg[]; ack?: { received: number; read: number } | null }>(`/chat/messages?room=${encodeURIComponent(room)}&after=${lastId.current}`); if (alive) { pushMsgs(r.messages); if (r.ack) setPeerAck(r.ack); } } catch {} };
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
          if (d.type !== 'chat' || !d.message) return;
          const m = d.message;
          if (openRef.current && d.room === roomRef.current) pushMsgs([m]);
          if (m.userId === user.id) return;
          const viewing = openRef.current && ((d.room === 'community' && tabRef.current === 'community') || (d.room.startsWith('support:') && tabRef.current === 'support' && roomRef.current === d.room));
          if (viewing || !notifyRef.current) return;
          const raw = String(m.body || '').replace(/\s+/g, ' ').trim();
          setToast({ room: d.room, name: m.name || 'Tin nhắn', body: raw.length > 42 ? raw.slice(0, 42) + '…' : raw, avatar: m.avatar });
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
    if (!open || !isAdmin || tab !== 'support') { setUserHits([]); return; }
    const load = () => api<{ users: any[] }>('/chat/users').then((r) => setUserHits(r.users || [])).catch(() => {});
    load(); const iv = setInterval(load, 20000); return () => clearInterval(iv);
  }, [open, isAdmin, tab]);

  // Đánh dấu đã đọc khi đang xem
  useEffect(() => {
    if (!open || !room || !lastId.current) return;
    if (room === 'community') { seenComm.current = lastId.current; try { localStorage.setItem('cl-seen-community', String(lastId.current)); } catch {} setUnreadComm(0); }
    else if (room.startsWith('support:') && user && !isAdmin) { seenSupp.current = lastId.current; try { localStorage.setItem(`cl-seen-support:${user.id}`, String(lastId.current)); } catch {} setUnreadSupp(0); }
    if (room.startsWith('support:') && lastId.current > acked.current) { acked.current = lastId.current; api('/chat/ack', { method: 'POST', body: JSON.stringify({ room, received: lastId.current, read: lastId.current }) }).catch(() => {}); }
  }, [msgs, open, room, user, isAdmin]);

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
    const firstT = setTimeout(show, 2000);
    const iv = setInterval(show, 240000); // hiện lại mỗi 4 phút
    return () => { clearTimeout(firstT); clearTimeout(hideT); clearInterval(iv); };
  }, []);
  function dismissHint() { setHint(false); hintStop.current = true; }

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
    setToast(null);
  }
  async function subscribePush() {
    try {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || typeof window === 'undefined' || !('PushManager' in window) || !vapidRef.current) return;
      if (typeof Notification === 'undefined' || Notification.permission === 'denied') return;
      if (Notification.permission !== 'granted') { const perm = await Notification.requestPermission(); if (perm !== 'granted') return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(vapidRef.current) });
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
  async function send() {
    const body = text.trim(); if (!body || !room || !user) return;
    setText(''); setWarn('');
    try {
      const r = await api<{ id: number; createdAt: string; name: string; avatar?: string | null }>('/chat/messages', { method: 'POST', body: JSON.stringify({ room, body }) });
      pushMsgs([{ id: r.id, userId: user.id, name: r.name, avatar: r.avatar, body, createdAt: r.createdAt }]);
    } catch (e: any) { setWarn(e.message || 'Không gửi được.'); setText(body); }
  }
  async function submitSell() {
    setSerr('');
    if (!sf.name.trim() || !sf.phone.trim()) return setSerr('Vui lòng nhập họ tên và số điện thoại.');
    setBusy(true);
    try { await api('/consignments', { method: 'POST', body: JSON.stringify(sf) }); setSent(true); }
    catch (e: any) { setSerr(e.message); } finally { setBusy(false); }
  }

  const needPick = isAdmin && tab === 'support' && !room.startsWith('support:');
  const adminSupport = isAdmin && tab === 'support';
  let lastMineId = 0; if (user) for (const m of msgs) if (m.userId === user.id) lastMineId = m.id;
  const roomList = rooms.filter((r) => !roomQ.trim() || (r.name || '').toLowerCase().includes(roomQ.trim().toLowerCase()));
  const roomSet = new Set(rooms.map((r) => r.room));
  const nq = roomQ.trim().toLowerCase();
  const newUsers = adminSupport ? userHits.filter((u) => !roomSet.has(`support:${u.id}`) && (!nq || (u.name || '').toLowerCase().includes(nq) || (u.phone || '').toLowerCase().includes(nq))) : [];
  const activeRoom = rooms.find((r) => r.room === room);
  const activeName = activeRoom?.name || pickedName || 'Khách hàng';
  const activePhone = activeRoom?.phone || pickedPhone || '';
  const activeOnline = activeRoom ? !!activeRoom.online : (userHits.find((u) => `support:${u.id}` === room)?.online ?? false);
  const canType = tab !== 'sell' && !!user && !!room && !needPick;
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm';

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
            className="cursor-pointer bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 flex items-center gap-3">
            {toast.avatar ? <img src={toast.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" /> : <span className="w-10 h-10 rounded-full bg-[#0A2540] text-[#C8A14B] grid place-items-center font-bold shrink-0">{(toast.name || '?').charAt(0).toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#0A2540] truncate">💬 {toast.name}</p>
              <p className="text-xs text-slate-500 truncate">{toast.body}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setToast(null); }} className="text-slate-300 hover:text-slate-500 text-lg leading-none shrink-0">×</button>
          </div>
        </div>
      )}
      <div className="fixed bottom-5 right-5 z-[55] flex items-center gap-2">
        {!open && hint && (
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 pl-3.5 pr-3 py-2.5 w-[182px] animate-bounce" style={{ animationDuration: '1.5s' }}>
            <button onClick={dismissHint} aria-label="Đóng" className="absolute -top-2 -right-2 w-5 h-5 bg-slate-700 hover:bg-slate-900 text-white rounded-full text-xs grid place-items-center">×</button>
            <button onClick={() => { setTab('sell'); setOpen(true); dismissHint(); }} className="text-left w-full">
              <p className="font-bold text-[#0A2540] text-sm leading-snug">🏷️ Có nhà đất cần bán?</p>
              <p className="text-xs text-slate-500 mt-0.5">Bấm vào đây để gửi bán — miễn phí!</p>
            </button>
          </div>
        )}
        <button onClick={() => { primeAudio(); setOpen((o) => !o); }} aria-label="Tin nhắn & gửi bán"
          className="relative w-14 h-14 grid place-items-center bg-[#0A2540] hover:bg-[#0d2f54] text-white rounded-full shadow-2xl shadow-black/40 ring-2 ring-white/40 transition hover:scale-105 active:scale-95">
          {open ? <span className="text-2xl leading-none">×</span> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" /></svg>}
          {!open && unread > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 grid place-items-center bg-red-600 text-white text-[11px] font-bold rounded-full ring-2 ring-white">{unread > 99 ? '99+' : unread}</span>}
        </button>
      </div>

      {open && (
        <div className={`fixed bottom-24 right-3 sm:right-5 z-[56] w-[94vw] ${adminSupport ? 'max-w-[680px]' : 'max-w-sm'} h-[70vh] max-h-[580px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden`}>
          <div className="bg-gradient-to-r from-[#0A2540] to-[#10355f] text-white shrink-0">
            <div className="flex items-center justify-between px-4 pt-3">
              <b className="flex items-center gap-2">Cam Lâm Land {tab !== 'sell' && <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-slate-400'}`} />}</b>
              <div className="flex items-center gap-3">
                <button onClick={toggleNotify} title={notify ? 'Tắt báo tin nhắn' : 'Bật báo tin nhắn'} className="text-white/70 hover:text-white text-base leading-none">{notify ? '🔔' : '🔕'}</button>
                <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
              </div>
            </div>
            <div className="flex mt-2 text-sm font-bold">
              {([['community', 'Cộng đồng', unreadComm], ['support', isAdmin ? 'Hỗ trợ khách' : 'Hỗ trợ', unreadSupp], ['sell', 'Gửi bán', 0]] as [Tab, string, number][]).map(([t, lb, n]) => (
                <button key={t} onClick={() => setTab(t)} className={`relative flex-1 py-2 border-b-2 ${tab === t ? 'border-[#C8A14B] text-white' : 'border-transparent text-white/55'}`}>
                  {lb}{n > 0 && tab !== t && <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
                </button>
              ))}
            </div>
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
                    <select className={inp} value={sf.ward} onChange={(e) => setS('ward', e.target.value)}><option value="">Xã / phường</option>{WARDS.map((w) => <option key={w} value={w}>{w}</option>)}</select>
                  </div>
                  <input className={inp} value={sf.address} onChange={(e) => setS('address', e.target.value)} placeholder="Địa chỉ (đường, thôn…)" />
                  <div className="grid grid-cols-2 gap-3">
                    <input className={inp} type="number" min="0" value={sf.area} onChange={(e) => setS('area', e.target.value)} placeholder="Diện tích (m²)" />
                    <input className={inp} value={sf.priceExpect} onChange={(e) => setS('priceExpect', e.target.value)} placeholder="Giá mong muốn" />
                  </div>
                  <textarea className={`${inp} min-h-[70px]`} value={sf.description} onChange={(e) => setS('description', e.target.value)} placeholder="Mô tả thêm (hướng, pháp lý…)" />
                  {serr && <p className="text-sm text-red-600 font-semibold">{serr}</p>}
                  <button disabled={busy} onClick={submitSell} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl">{busy ? 'Đang gửi…' : 'Gửi thông tin'}</button>
                  <p className="text-[11px] text-slate-400 text-center">Hoặc gọi <a href="tel:0988888888" className="font-bold text-[#0A2540]">0988 888 888</a></p>
                </div>
              )}
            </div>
          ) : !user ? (
            <div className="flex-1 grid place-items-center p-6 text-center">
              <div>
                <p className="text-slate-500 text-sm">Đăng nhập để chat cộng đồng & nhắn admin.</p>
                <a href="/login" className="inline-block mt-3 bg-[#0A2540] text-white font-bold px-5 py-2.5 rounded-xl text-sm">Đăng nhập</a>
              </div>
            </div>
          ) : (
            <div className={`flex-1 min-h-0 flex ${adminSupport ? 'flex-row' : 'flex-col'}`}>
              {adminSupport && (
                <aside className={`${room ? 'hidden sm:flex' : 'flex'} sm:order-2 flex-col shrink-0 sm:border-l border-slate-100 bg-white w-full ${(!room || listOpen) ? 'sm:w-52' : 'sm:w-0 sm:overflow-hidden sm:border-l-0'} transition-all`}>
                  <div className="px-2 py-2 border-b border-slate-100 shrink-0 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-500 px-1">💬 Hội thoại ({rooms.length})</p>
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
              <div className={`flex-1 min-h-0 flex flex-col sm:order-1 ${adminSupport && !room ? 'hidden sm:flex' : 'flex'}`}>
                {adminSupport && room && (
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
                  </div>
                )}
                {tab === 'community' && (
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 shrink-0 text-center">
                  <p className="text-[11px] font-bold text-[#0A2540]">👥 Cộng đồng đầu tư Cam Lâm</p>
                  <p className="text-[10px] text-slate-500">Admin: Nguyễn Quốc Cường · <a href="tel:0988888888" className="font-semibold text-[#0A2540]">0988 888 888</a></p>
                </div>
              )}
                <div ref={boxRef} className="flex-1 overflow-y-auto scroll-soft p-3 space-y-2 bg-slate-50">
                  {needPick ? <p className="text-center text-sm text-slate-400 mt-8">← Chọn một khách để trả lời.</p>
                    : msgs.length === 0 ? <p className="text-center text-sm text-slate-400 mt-8">{tab === 'community' ? 'Chào mừng đến Cộng đồng đầu tư Cam Lâm 👋' : isAdmin ? 'Chưa có tin nhắn — gửi lời chào tới khách 👋' : 'Gửi tin cho admin để được hỗ trợ.'}</p>
                    : msgs.map((m) => {
                      const mine = m.userId === user.id;
                      return (
                        <div key={m.id}>
                          <div className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                            {!mine && (m.avatar ? <img src={m.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" /> : <span className="w-7 h-7 rounded-full bg-[#0A2540] text-[#C8A14B] grid place-items-center text-[11px] font-bold shrink-0">{(m.name || '?').charAt(0).toUpperCase()}</span>)}
                            <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-[#0A2540] text-white rounded-br-sm' : 'bg-white border border-slate-200 rounded-bl-sm'}`}>
                              {!mine && <p className="text-[11px] font-bold text-[#C8A14B] mb-0.5">{m.name}</p>}
                              <p className="whitespace-pre-wrap break-words">{m.body}</p>
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
                  <div className="border-t border-slate-100 shrink-0">
                    {warn && <p className="px-3 pt-2 text-xs text-red-600 font-semibold leading-snug">⚠️ {warn}</p>}
                    <div className="p-2 flex gap-2">
                      <input value={text} onChange={(e) => { setText(e.target.value); if (warn) setWarn(''); }} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Nhập tin nhắn…" className="flex-1 border border-slate-300 rounded-full px-3.5 py-2 text-sm outline-none focus:border-[#0A2540]" />
                      <button onClick={send} className="bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 text-sm font-bold shrink-0">Gửi</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
