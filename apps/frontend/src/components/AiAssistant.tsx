'use client';
import { useEffect, useRef, useState } from 'react';

interface Msg { role: 'user' | 'assistant'; content: string }

export default function AiAssistant() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: 'Xin chào! Mình là trợ lý Cam Lâm Land. Bạn cần tư vấn mua bán, giá khu vực hay quy hoạch ở đâu ạ?' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch('/feed/ai/status').then((r) => r.json()).then((d) => setEnabled(!!d.enabled)).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const r = await fetch('/feed/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next }) });
      const d = await r.json();
      setMsgs((m) => [...m, { role: 'assistant', content: r.ok ? d.reply : (d.error || 'Xin lỗi, mình chưa trả lời được.') }]);
    } catch { setMsgs((m) => [...m, { role: 'assistant', content: 'Lỗi kết nối, thử lại nhé.' }]); } finally { setBusy(false); }
  }

  if (!enabled) return null;

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Trợ lý AI" className="fixed bottom-5 left-5 z-[55] flex items-center gap-2 bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold pl-3 pr-4 py-2.5 rounded-full shadow-2xl border border-[#C8A14B]/40">
          <span className="text-lg">🤖</span><span className="hidden sm:inline text-sm">Trợ lý AI</span>
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 left-3 sm:left-5 z-[56] w-[94vw] max-w-sm h-[70vh] max-h-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between bg-[#0A2540] text-white px-4 py-3">
            <div className="flex items-center gap-2"><span className="text-lg">🤖</span><div><p className="font-bold leading-tight text-sm">Trợ lý Cam Lâm Land</p><p className="text-[11px] text-slate-300">Tư vấn nhà đất & quy hoạch</p></div></div>
            <button onClick={() => setOpen(false)} aria-label="Đóng" className="text-slate-300 hover:text-white text-2xl leading-none">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line ${m.role === 'user' ? 'bg-[#0A2540] text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>{m.content}</div>
              </div>
            ))}
            {busy && <div className="flex justify-start"><div className="bg-white border border-slate-200 rounded-2xl px-3 py-2 text-sm text-slate-400">Đang trả lời…</div></div>}
            <div ref={endRef} />
          </div>
          <div className="p-2.5 border-t border-slate-200 flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Nhập câu hỏi…" className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#0A2540]" />
            <button onClick={send} disabled={busy} className="bg-[#0A2540] hover:bg-[#0d2f54] disabled:opacity-60 text-white font-bold px-4 rounded-xl text-sm">Gửi</button>
          </div>
          <p className="text-[10px] text-slate-400 text-center pb-1.5">Trả lời bởi AI — vui lòng xác minh thông tin quan trọng.</p>
        </div>
      )}
    </>
  );
}
