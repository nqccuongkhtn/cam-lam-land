'use client';
// Popup thông báo DÙNG CHUNG toàn web (lỗi / thành công / nhắc nhở).
// Gọi từ BẤT KỲ đâu — kể cả ngoài React — bằng: import { toast } from '@/lib/toast'; toast.error('...').
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Kind = 'error' | 'success' | 'info';
interface Item { id: number; kind: Kind; title?: string; msg: string }
type Payload = Omit<Item, 'id'>;

// Bộ phát sự kiện ở cấp module → code ngoài React vẫn bắn toast được.
const listeners = new Set<(t: Payload) => void>();
const emit = (t: Payload) => {
  if (listeners.size) listeners.forEach((l) => l(t));
  else if (typeof window !== 'undefined') window.alert(t.msg); // dự phòng khi Provider chưa gắn
};
export const toast = {
  error: (msg: string, title?: string) => emit({ kind: 'error', msg, title }),
  success: (msg: string, title?: string) => emit({ kind: 'success', msg, title }),
  info: (msg: string, title?: string) => emit({ kind: 'info', msg, title }),
};

const Ctx = createContext(toast);
export const useToast = () => useContext(Ctx);

const STYLE: Record<Kind, { ring: string; icon: string; badge: string; bar: string }> = {
  error: { ring: 'border-red-200', icon: '✕', badge: 'bg-red-100 text-red-600', bar: 'bg-red-500' },
  success: { ring: 'border-emerald-200', icon: '✓', badge: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-500' },
  info: { ring: 'border-slate-200', icon: 'i', badge: 'bg-[#0A2540]/10 text-[#0A2540]', bar: 'bg-[#0A2540]' },
};

function Card({ t, onClose }: { t: Item; onClose: () => void }) {
  const s = STYLE[t.kind];
  const [show, setShow] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(r); }, []);
  return (
    <div
      role="alert"
      className={`pointer-events-auto w-full max-w-md overflow-hidden rounded-xl border ${s.ring} bg-white shadow-xl transition-all duration-300 ${show ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
    >
      <div className="flex items-start gap-3 p-3.5">
        <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${s.badge}`}>{s.icon}</span>
        <div className="min-w-0 flex-1">
          {t.title && <p className="text-sm font-bold text-[#0A2540]">{t.title}</p>}
          <p className="break-words text-sm leading-snug text-slate-600">{t.msg}</p>
        </div>
        <button onClick={onClose} aria-label="Đóng" className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
      </div>
      <div className={`h-1 ${s.bar} opacity-70`} />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const remove = useCallback((id: number) => setItems((s) => s.filter((x) => x.id !== id)), []);
  const push = useCallback((t: Payload) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-3), { ...t, id }]); // giữ tối đa ~4 cái
    window.setTimeout(() => remove(id), t.kind === 'error' ? 6500 : 3800);
  }, [remove]);
  useEffect(() => { listeners.add(push); return () => { listeners.delete(push); }; }, [push]);

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[100000] flex flex-col items-center gap-2 px-3 sm:top-4">
        {items.map((t) => <Card key={t.id} t={t} onClose={() => remove(t.id)} />)}
      </div>
    </Ctx.Provider>
  );
}
