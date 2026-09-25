'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth, laAdmin } from '@/lib/auth';
import { api, uploadChatFile } from '@/lib/api';
import ChatDinhKem from '@/components/ChatDinhKem';

interface Room { room: string; name: string; phone?: string | null; online?: boolean; lastBody?: string; lastAt?: string; count?: number; unread?: number; waiting?: boolean; waitingSince?: string | null; }
interface Msg { id: number; userId: number | null; name: string; avatar?: string | null; body: string; createdAt: string;
  kind?: string; fileId?: number | null; fileName?: string | null; fileMime?: string | null; fileSize?: number | null; deletedAt?: string | null; }

function waitText(since?: string | null): string {
  if (!since) return '';
  const ms = Date.now() - new Date(since).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ`;
  return `${Math.floor(h / 24)} ngày`;
}

// Sắp xếp hàng đợi: khách CHƯA được trả lời lên đầu, ai nhắn trước ưu tiên trước; còn lại theo hoạt động mới nhất.
function sortQueue(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    const aw = !!a.waiting, bw = !!b.waiting;
    if (aw !== bw) return aw ? -1 : 1;
    if (aw && bw) return new Date(a.waitingSince || a.lastAt || 0).getTime() - new Date(b.waitingSince || b.lastAt || 0).getTime();
    return new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime();
  });
}

export default function TuVanPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [canUpload, setCanUpload] = useState(false);
  const [peerUpload, setPeerUpload] = useState<boolean | null>(null);
  const [dangGuiTep, setDangGuiTep] = useState(false);
  const [menuTin, setMenuTin] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const tepRef = useRef<HTMLInputElement>(null);
  const lastId = useRef(0);
  const acked = useRef(0);
  const isAdmin = laAdmin(user);

  useEffect(() => { if (!user) { setAllowed(false); return; } api<{ advisor: boolean }>('/chat/advisory-access').then((r) => setAllowed(!!r.advisor)).catch(() => setAllowed(false)); }, [user]);

  const loadRooms = useCallback(() => { api<{ rooms: Room[] }>('/chat/advisory-rooms').then((r) => setRooms(sortQueue(r.rooms || []))).catch(() => {}); }, []);
  useEffect(() => { if (!allowed) return; loadRooms(); const iv = setInterval(loadRooms, 8000); return () => clearInterval(iv); }, [allowed, loadRooms]);

  useEffect(() => {
    if (!room) { setMsgs([]); lastId.current = 0; acked.current = 0; return; }
    lastId.current = 0; acked.current = 0; setMsgs([]); setCanUpload(false); setPeerUpload(null); setMenuTin(0);
    let alive = true;
    const tick = async () => {
      try {
        // Trang nay hoi lai TOAN BO tin moi 5 giay (after=0) nen tin bi thu hoi tu hien dung,
        // khong can WebSocket hay danh sach `recalled` nhu khung chat noi.
        const r = await api<{ messages: Msg[]; canUpload?: boolean; peerUpload?: boolean | null }>(`/chat/messages?room=${encodeURIComponent(room)}&after=0`);
        if (!alive) return;
        setMsgs(r.messages || []);
        setCanUpload(!!r.canUpload);
        setPeerUpload(r.peerUpload ?? null);
        const max = (r.messages || []).reduce((mx, m) => Math.max(mx, m.id), 0);
        lastId.current = max;
        if (max > acked.current) {
          acked.current = max;
          api('/chat/ack', { method: 'POST', body: JSON.stringify({ room, received: max, read: max }) }).catch(() => {});
          setRooms((rs) => rs.map((x) => (x.room === room ? { ...x, unread: 0 } : x)));
        }
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [room]);

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }, [msgs]);

  async function send() {
    const body = text.trim();
    if (!body || !room) return;
    setText('');
    try {
      const r = await api<{ id: number; createdAt: string; name: string; avatar?: string | null }>('/chat/messages', { method: 'POST', body: JSON.stringify({ room, body }) });
      setMsgs((m) => [...m, { id: r.id, userId: user?.id ?? null, name: r.name, avatar: r.avatar, body, createdAt: r.createdAt }]);
      lastId.current = Math.max(lastId.current, r.id);
      loadRooms();
    } catch (e: any) { setText(body); alert(e.message || 'Không gửi được'); }
  }

  async function guiTep(f?: File | null) {
    if (!f || !room) return;
    setDangGuiTep(true);
    try { const m = await uploadChatFile(room, f); setMsgs((cur) => [...cur, m]); lastId.current = Math.max(lastId.current, m.id); loadRooms(); }
    catch (e: any) { alert(e.message || 'Không gửi được tệp'); }
    finally { setDangGuiTep(false); }
  }
  async function thuHoi(id: number) {
    setMenuTin(0);
    if (!window.confirm('Thu hồi tin nhắn này?\n\nTệp đính kèm sẽ bị xoá khỏi máy chủ và KHÔNG lấy lại được.')) return;
    try {
      await api(`/chat/messages/${id}`, { method: 'DELETE' });
      setMsgs((cur) => cur.map((m) => (m.id === id ? { ...m, deletedAt: new Date().toISOString(), kind: 'text', body: '', fileId: null } : m)));
      loadRooms();
    } catch (e: any) { alert(e.message || 'Không thu hồi được'); }
  }
  // Chỉ ADMIN mới mở/khoá được quyền gửi ảnh-PDF của khách; tư vấn viên thường chỉ nhìn thấy trạng thái.
  async function doiQuyenTep() {
    const uid = Number(room.slice(9));
    if (!uid) return;
    try {
      const r = await api<{ cho: boolean }>('/chat/quyen-gui-file', { method: 'POST', body: JSON.stringify({ userId: uid, cho: !peerUpload }) });
      setPeerUpload(!!r.cho);
    } catch (e: any) { alert(e.message || 'Không đổi được quyền'); }
  }

  if (allowed === null) return <div className="p-12 text-center text-slate-400">Đang tải…</div>;
  if (!allowed) return (
    <div className="max-w-md mx-auto px-4 py-8 sm:p-12 text-center">
      <p className="text-5xl">🔒</p>
      <p className="font-bold text-[#0B4045] mt-3 text-lg">Khu vực dành cho tư vấn viên</p>
      <p className="text-slate-500 text-sm mt-1">Bạn cần được admin cấp quyền “Tư vấn đầu tư & Pháp lý” để vào trang này.</p>
      <Link href="/" className="inline-block mt-5 text-sm font-semibold text-red-600">← Về trang chủ</Link>
    </div>
  );

  const waitingCount = rooms.filter((r) => r.waiting).length;
  const active = rooms.find((r) => r.room === room);

  return (
    <div className="max-w-6xl mx-auto px-3 py-5">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-[#0B4045]">💰 Quản trị Tư vấn đầu tư & Pháp lý</h1>
          <p className="text-sm text-slate-500">Khách chưa được trả lời xếp lên đầu, ai nhắn trước ưu tiên trước.</p>
        </div>
        <span className="shrink-0 bg-red-50 text-red-600 font-bold text-sm rounded-full px-3 py-1.5">{waitingCount} đang chờ</span>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 text-[11px] font-bold text-slate-500">HÀNG ĐỢI ({rooms.length})</div>
          <div className="max-h-[68vh] overflow-y-auto">
            {rooms.length === 0 ? <p className="p-4 text-sm text-slate-400">Chưa có khách cần tư vấn.</p> : rooms.map((r) => {
              const act = r.room === room;
              return (
                <button key={r.room} onClick={() => setRoom(r.room)} className={`w-full text-left px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 ${act ? 'bg-amber-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.waiting ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    <span className="font-semibold text-[#0B4045] text-sm truncate flex-1">{r.name}</span>
                    {(r.unread || 0) > 0 && <span className="shrink-0 min-w-[18px] h-[18px] px-1 grid place-items-center bg-red-500 text-white text-[10px] font-bold rounded-full">{r.unread}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-0.5 pl-4 gap-2">
                    <span className="text-[11px] text-slate-400 truncate flex-1">{r.lastBody || '—'}</span>
                    <span className={`text-[10px] font-bold shrink-0 ${r.waiting ? 'text-red-500' : 'text-slate-400'}`}>{r.waiting ? `⏳ ${waitText(r.waitingSince)}` : '✅ đã trả lời'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col min-h-[68vh]">
          {!room ? <div className="flex-1 grid place-items-center text-slate-400 text-sm p-6 text-center">← Chọn một khách trong hàng đợi để trả lời</div> : (
            <>
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                <span className={`w-2 h-2 rounded-full ${active?.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <b className="text-[#0B4045]">{active?.name || 'Khách'}</b>
                {active?.phone ? <a href={`tel:${active.phone}`} className="text-red-600 text-sm font-semibold">📞 {active.phone}</a> : null}
                {active?.waiting && <span className="text-[11px] font-bold text-red-500">⏳ đang chờ {waitText(active.waitingSince)}</span>}
                {isAdmin && peerUpload !== null && (
                  <button onClick={doiQuyenTep} title={peerUpload ? 'Đang CHO khách gửi ảnh/tệp — bấm để khoá lại' : 'Khách CHƯA gửi được ảnh/tệp — bấm để mở'}
                    className={`ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${peerUpload ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
                    📎 {peerUpload ? 'Cho gửi' : 'Đã khoá'}
                  </button>
                )}
              </div>
              <div ref={boxRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
                {msgs.length === 0 ? <p className="text-center text-sm text-slate-400 mt-8">Chưa có tin nhắn.</p> : msgs.map((m) => {
                  const mine = m.userId === user?.id;
                  if (m.deletedAt) return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <p className="max-w-[75%] rounded-2xl border border-dashed border-slate-300 px-3 py-1.5 text-[13px] italic text-slate-400">Tin nhắn đã được thu hồi</p>
                    </div>
                  );
                  const coTep = m.kind === 'image' || m.kind === 'file';
                  return (
                    <div key={m.id} className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                      {mine && (
                        <span className="relative shrink-0 self-center">
                          <button onClick={() => setMenuTin((v) => (v === m.id ? 0 : m.id))} title="Tuỳ chọn" className="w-6 h-6 grid place-items-center rounded-full leading-none text-slate-300 hover:text-slate-600 hover:bg-slate-200">⋯</button>
                          {menuTin === m.id && (
                            <button onClick={() => thuHoi(m.id)} className="absolute right-0 bottom-7 z-10 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-lg hover:bg-red-50">Thu hồi tin nhắn</button>
                          )}
                        </span>
                      )}
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-[#0B4045] text-white' : 'bg-white border border-slate-200'}`}>
                        {!mine && <p className="text-[11px] font-bold text-[#C8A14B] mb-0.5">{m.name}</p>}
                        {coTep
                          ? <ChatDinhKem fileId={m.fileId} fileName={m.fileName} fileMime={m.fileMime} fileSize={m.fileSize} mine={mine} />
                          : <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-2 border-t border-slate-100 flex gap-2 items-center">
                {canUpload && (
                  <>
                    <input ref={tepRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={(e) => { guiTep(e.target.files?.[0]); e.target.value = ''; }} />
                    <button onClick={() => tepRef.current?.click()} disabled={dangGuiTep} title="Gửi ảnh hoặc tệp PDF (tối đa 10MB)" className="shrink-0 w-9 h-9 grid place-items-center rounded-full border border-slate-300 text-lg hover:bg-slate-100 disabled:opacity-50">{dangGuiTep ? '⏳' : '📎'}</button>
                  </>
                )}
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Nhập câu trả lời…" className="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm outline-none focus:border-[#0B4045]" />
                <button onClick={send} className="cl-press bg-red-600 hover:bg-red-700 text-white font-bold px-5 rounded-full text-sm">Gửi</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
