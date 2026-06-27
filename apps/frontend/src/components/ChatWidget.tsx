'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getToken } from '@/lib/token';

interface Msg { id: number; userId: number | null; name: string; body: string; createdAt: string; }
interface Room { room: string; name: string; lastBody: string; lastAt: string; count: number; }

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'community' | 'support'>('community');
  const [room, setRoom] = useState('community');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [wsUrl, setWsUrl] = useState('');
  const [live, setLive] = useState(false);
  const lastId = useRef(0);
  const seen = useRef<Set<number>>(new Set());
  const roomRef = useRef(room); roomRef.current = room;
  const boxRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === 'admin';

  function pushMsgs(arr: Msg[]) {
    const fresh = (arr || []).filter((m) => m && !seen.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => { seen.current.add(m.id); lastId.current = Math.max(lastId.current, m.id); });
    setMsgs((cur) => [...cur, ...fresh]);
  }

  useEffect(() => { if (user) api<{ wsUrl: string }>('/config').then((r) => setWsUrl(r.wsUrl || '')).catch(() => {}); }, [user]);

  useEffect(() => {
    if (!user) return;
    if (tab === 'community') setRoom('community');
    else if (!isAdmin) setRoom(`support:${user.id}`);
    else setRoom('');
  }, [tab, user, isAdmin]);

  // Nạp lịch sử + polling nhẹ dự phòng cho phòng đang mở
  useEffect(() => {
    if (!open || !user || !room) { setMsgs([]); return; }
    seen.current = new Set(); lastId.current = 0; setMsgs([]);
    let alive = true;
    const tick = async () => {
      try { const r = await api<{ messages: Msg[] }>(`/chat/messages?room=${encodeURIComponent(room)}&after=${lastId.current}`); if (alive) pushMsgs(r.messages); } catch {}
    };
    tick();
    const iv = setInterval(tick, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, [open, user, room]);

  // WebSocket real-time
  useEffect(() => {
    if (!open || !user || !wsUrl) return;
    const token = getToken();
    let ws: WebSocket;
    try { ws = new WebSocket(token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl); } catch { return; }
    ws.onopen = () => setLive(true);
    ws.onclose = () => setLive(false);
    ws.onerror = () => setLive(false);
    ws.onmessage = (ev) => {
      try { const d = JSON.parse(ev.data); if (d.type === 'chat' && d.room === roomRef.current && d.message) pushMsgs([d.message]); } catch {}
    };
    return () => { try { ws.close(); } catch {} setLive(false); };
  }, [open, user, wsUrl]);

  // Admin: danh sách hội thoại hỗ trợ
  useEffect(() => {
    if (!open || !isAdmin || tab !== 'support') return;
    const load = () => api<{ rooms: Room[] }>('/chat/rooms').then((r) => setRooms(r.rooms || [])).catch(() => {});
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, [open, isAdmin, tab]);

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }, [msgs, open]);

  async function send() {
    const body = text.trim(); if (!body || !room || !user) return;
    setText('');
    try {
      const r = await api<{ id: number; createdAt: string; name: string }>('/chat/messages', { method: 'POST', body: JSON.stringify({ room, body }) });
      pushMsgs([{ id: r.id, userId: user.id, name: r.name, body, createdAt: r.createdAt }]);
    } catch (e: any) { alert(e.message); }
  }

  if (!user) return null;
  const needPick = isAdmin && tab === 'support' && !room.startsWith('support:');
  const canType = !!room && !needPick;

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-label="Tin nhắn"
        className="fixed bottom-24 right-5 z-[55] w-14 h-14 grid place-items-center bg-[#0A2540] hover:bg-[#0d2f54] text-white rounded-full shadow-2xl shadow-black/30 ring-2 ring-white/40 transition hover:scale-105 active:scale-95">
        {open ? <span className="text-2xl leading-none">×</span> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" /></svg>}
      </button>

      {open && (
        <div className="fixed bottom-40 right-3 sm:right-5 z-[56] w-[94vw] max-w-sm h-[68vh] max-h-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-r from-[#0A2540] to-[#10355f] text-white shrink-0">
            <div className="flex items-center justify-between px-4 pt-3">
              <b className="flex items-center gap-2">Tin nhắn Cam Lâm Land
                <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-slate-400'}`} title={live ? 'Trực tuyến' : 'Đang kết nối'} />
              </b>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="flex mt-2">
              {(['community', 'support'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 text-sm font-bold border-b-2 ${tab === t ? 'border-[#C8A14B] text-white' : 'border-transparent text-white/55'}`}>
                  {t === 'community' ? 'Cộng đồng' : isAdmin ? 'Hỗ trợ khách' : 'Hỗ trợ'}
                </button>
              ))}
            </div>
          </div>

          {isAdmin && tab === 'support' && (
            <div className="p-2 border-b border-slate-100 shrink-0">
              <select value={room.startsWith('support:') ? room : ''} onChange={(e) => setRoom(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm">
                <option value="">— Chọn khách để trả lời ({rooms.length}) —</option>
                {rooms.map((r) => <option key={r.room} value={r.room}>{r.name} · {r.count} tin</option>)}
              </select>
            </div>
          )}

          <div ref={boxRef} className="flex-1 overflow-y-auto scroll-soft p-3 space-y-2 bg-slate-50">
            {needPick ? <p className="text-center text-sm text-slate-400 mt-8">Chọn một khách ở trên để xem & trả lời.</p>
              : msgs.length === 0 ? <p className="text-center text-sm text-slate-400 mt-8">{tab === 'community' ? 'Chào mừng đến nhóm cộng đồng Cam Lâm Land 👋' : 'Gửi tin nhắn cho admin để được hỗ trợ.'}</p>
              : msgs.map((m) => {
                const mine = m.userId === user.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-[#0A2540] text-white rounded-br-sm' : 'bg-white border border-slate-200 rounded-bl-sm'}`}>
                      {!mine && <p className="text-[11px] font-bold text-[#C8A14B] mb-0.5">{m.name}</p>}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </div>
                );
              })}
          </div>

          {canType && (
            <div className="p-2 border-t border-slate-100 flex gap-2 shrink-0">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Nhập tin nhắn…" className="flex-1 border border-slate-300 rounded-full px-3.5 py-2 text-sm outline-none focus:border-[#0A2540]" />
              <button onClick={send} className="bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 text-sm font-bold shrink-0">Gửi</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
