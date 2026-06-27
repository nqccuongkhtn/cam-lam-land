'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getToken } from '@/lib/token';
import { WARDS, PROPERTY_LABELS, type PropertyType } from '@/lib/types';

interface Msg { id: number; userId: number | null; name: string; avatar?: string | null; body: string; createdAt: string; }
interface Room { room: string; name: string; lastBody: string; lastAt: string; count: number; }
const TYPES: PropertyType[] = ['land', 'house', 'apartment', 'villa', 'commercial', 'farm'];
type Tab = 'community' | 'support' | 'sell';

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

  const lastId = useRef(0);
  const seen = useRef<Set<number>>(new Set());
  const roomRef = useRef(room); roomRef.current = room;
  const boxRef = useRef<HTMLDivElement>(null);
  const seenComm = useRef(0), seenSupp = useRef(0);
  const unread = unreadComm + unreadSupp;
  const setS = (k: string, v: string) => setSf((s) => ({ ...s, [k]: v }));

  useEffect(() => { setTab(user ? 'community' : 'sell'); }, [user]);
  useEffect(() => {
    try { seenComm.current = Number(localStorage.getItem('cl-seen-community') || 0); } catch {}
    if (user) { try { seenSupp.current = Number(localStorage.getItem(`cl-seen-support:${user.id}`) || 0); } catch {} }
  }, [user]);
  useEffect(() => { if (user) api<{ wsUrl: string }>('/config').then((r) => setWsUrl(r.wsUrl || '')).catch(() => {}); }, [user]);

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
      if (!isAdmin) { try { const s = await api<{ messages: Msg[] }>(`/chat/messages?room=support:${user.id}&after=${seenSupp.current}`); setUnreadSupp(s.messages.filter((m) => m.userId !== user.id).length); } catch {} }
    };
    poll();
    const iv = setInterval(poll, 12000);
    return () => clearInterval(iv);
  }, [user, isAdmin]);

  // Phòng đang mở: nạp + polling dự phòng
  useEffect(() => {
    if (!open || !user || !room) { setMsgs([]); return; }
    seen.current = new Set(); lastId.current = 0; setMsgs([]); setWarn('');
    let alive = true;
    const tick = async () => { try { const r = await api<{ messages: Msg[] }>(`/chat/messages?room=${encodeURIComponent(room)}&after=${lastId.current}`); if (alive) pushMsgs(r.messages); } catch {} };
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
    ws.onmessage = (ev) => { try { const d = JSON.parse(ev.data); if (d.type === 'chat' && d.room === roomRef.current && d.message) pushMsgs([d.message]); } catch {} };
    return () => { try { ws.close(); } catch {} setLive(false); };
  }, [open, user, wsUrl]);

  useEffect(() => {
    if (!open || !isAdmin || tab !== 'support') return;
    const load = () => api<{ rooms: Room[] }>('/chat/rooms').then((r) => setRooms(r.rooms || [])).catch(() => {});
    load(); const iv = setInterval(load, 6000); return () => clearInterval(iv);
  }, [open, isAdmin, tab]);

  // Đánh dấu đã đọc khi đang xem
  useEffect(() => {
    if (!open || !room || !lastId.current) return;
    if (room === 'community') { seenComm.current = lastId.current; try { localStorage.setItem('cl-seen-community', String(lastId.current)); } catch {} setUnreadComm(0); }
    else if (room.startsWith('support:') && user && !isAdmin) { seenSupp.current = lastId.current; try { localStorage.setItem(`cl-seen-support:${user.id}`, String(lastId.current)); } catch {} setUnreadSupp(0); }
  }, [msgs, open, room, user, isAdmin]);

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }, [msgs, open, tab]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { if (localStorage.getItem('cl-sell-hint') === '1') return; } catch {}
    const t = setTimeout(() => setHint(true), 2000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (!hint) return; const t = setTimeout(() => setHint(false), 15000); return () => clearTimeout(t); }, [hint]);
  function dismissHint() { setHint(false); try { localStorage.setItem('cl-sell-hint', '1'); } catch {} }

  function pushMsgs(arr: Msg[]) {
    const fresh = (arr || []).filter((m) => m && !seen.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => { seen.current.add(m.id); lastId.current = Math.max(lastId.current, m.id); });
    setMsgs((cur) => [...cur, ...fresh]);
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
  const canType = tab !== 'sell' && !!user && !!room && !needPick;
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm';

  return (
    <>
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
        <button onClick={() => setOpen((o) => !o)} aria-label="Tin nhắn & gửi bán"
          className="relative w-14 h-14 grid place-items-center bg-[#0A2540] hover:bg-[#0d2f54] text-white rounded-full shadow-2xl shadow-black/40 ring-2 ring-white/40 transition hover:scale-105 active:scale-95">
          {open ? <span className="text-2xl leading-none">×</span> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" /></svg>}
          {!open && unread > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 grid place-items-center bg-red-600 text-white text-[11px] font-bold rounded-full ring-2 ring-white">{unread > 99 ? '99+' : unread}</span>}
        </button>
      </div>

      {open && (
        <div className="fixed bottom-24 right-3 sm:right-5 z-[56] w-[94vw] max-w-sm h-[70vh] max-h-[580px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-r from-[#0A2540] to-[#10355f] text-white shrink-0">
            <div className="flex items-center justify-between px-4 pt-3">
              <b className="flex items-center gap-2">Cam Lâm Land {tab !== 'sell' && <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-slate-400'}`} />}</b>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
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
            <>
              {isAdmin && tab === 'support' && (
                <div className="p-2 border-b border-slate-100 shrink-0">
                  <select value={room.startsWith('support:') ? room : ''} onChange={(e) => setRoom(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm">
                    <option value="">— Chọn khách ({rooms.length}) —</option>{rooms.map((r) => <option key={r.room} value={r.room}>{r.name} · {r.count} tin</option>)}
                  </select>
                </div>
              )}
              <div ref={boxRef} className="flex-1 overflow-y-auto scroll-soft p-3 space-y-2 bg-slate-50">
                {needPick ? <p className="text-center text-sm text-slate-400 mt-8">Chọn một khách để trả lời.</p>
                  : msgs.length === 0 ? <p className="text-center text-sm text-slate-400 mt-8">{tab === 'community' ? 'Chào mừng đến nhóm cộng đồng 👋' : 'Gửi tin cho admin để được hỗ trợ.'}</p>
                  : msgs.map((m) => {
                    const mine = m.userId === user.id;
                    return (
                      <div key={m.id} className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                        {!mine && (m.avatar ? <img src={m.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" /> : <span className="w-7 h-7 rounded-full bg-[#0A2540] text-[#C8A14B] grid place-items-center text-[11px] font-bold shrink-0">{(m.name || '?').charAt(0).toUpperCase()}</span>)}
                        <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-[#0A2540] text-white rounded-br-sm' : 'bg-white border border-slate-200 rounded-bl-sm'}`}>
                          {!mine && <p className="text-[11px] font-bold text-[#C8A14B] mb-0.5">{m.name}</p>}
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        </div>
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
            </>
          )}
        </div>
      )}
    </>
  );
}
