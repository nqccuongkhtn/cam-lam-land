'use client';
// Popup thông báo DÙNG CHUNG toàn web (lỗi / thành công / nhắc nhở).
// Gọi từ BẤT KỲ đâu — kể cả ngoài React — bằng: import { toast } from '@/lib/toast'; toast.error('...').
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Kind = 'error' | 'success' | 'info';
interface Item { id: number; kind: Kind; title?: string; msg: string; ms?: number }
type Payload = Omit<Item, 'id'>;

// Bộ phát sự kiện ở cấp module → code ngoài React vẫn bắn toast được.
const listeners = new Set<(t: Payload) => void>();
const emit = (t: Payload) => {
  if (listeners.size) listeners.forEach((l) => l(t));
  else if (typeof window !== 'undefined') window.alert(t.msg); // dự phòng khi Provider chưa gắn
};
/** ms = giữ trên màn hình bao lâu (mặc định 3,8 giây; lỗi 6,5 giây) — lời dài thì cho lâu hơn để kịp đọc. */
export const toast = {
  error: (msg: string, title?: string, ms?: number) => emit({ kind: 'error', msg, title, ms }),
  success: (msg: string, title?: string, ms?: number) => emit({ kind: 'success', msg, title, ms }),
  info: (msg: string, title?: string, ms?: number) => emit({ kind: 'info', msg, title, ms }),
};

const Ctx = createContext(toast);
export const useToast = () => useContext(Ctx);

// (Bảng màu cũ theo loại — giữ để tham khảo, kiểu mới không dùng nữa)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const STYLE: Record<Kind, { ring: string; icon: string; badge: string; bar: string }> = {
  error: { ring: 'border-red-200', icon: '✕', badge: 'bg-red-100 text-red-600', bar: 'bg-red-500' },
  success: { ring: 'border-emerald-200', icon: '✓', badge: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-500' },
  info: { ring: 'border-slate-200', icon: 'i', badge: 'bg-[#0A2540]/10 text-[#0A2540]', bar: 'bg-[#0A2540]' },
};

function Card({ t, onClose }: { t: Item; onClose: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(r); }, []);
  /* Kiểu thông báo iPhone dùng chung (.cl-tb trong globals.css). Loại lỗi /
     thành công chỉ thể hiện ở tiêu đề (đỏ khi lỗi) và dấu nhỏ ở dòng trên. */
  const nhan = t.kind === 'error' ? 'Lỗi' : t.kind === 'success' ? 'Xong' : 'Thông báo';
  return (
    <div
      role="alert"
      className={`cl-tb pointer-events-auto w-full max-w-md transition-all duration-300 ${t.kind === 'error' ? 'cl-tb-loi' : ''} ${show ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'}`}
      onClick={onClose}
    >
      <span className="cl-tb-icon"><img src="/icons/icon-192.png?v=c5b77735" alt="" /></span>
      <div className="cl-tb-than">
        <p className="cl-tb-dau"><span>Cam Lâm Land · {nhan}</span><span className="gio">bây giờ</span></p>
        {t.title && <p className="cl-tb-tieu-de">{t.title}</p>}
        <p className={`${t.title ? 'cl-tb-noi-dung' : 'cl-tb-tieu-de font-semibold'} break-words`}>{t.msg}</p>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const remove = useCallback((id: number) => setItems((s) => s.filter((x) => x.id !== id)), []);
  const push = useCallback((t: Payload) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-3), { ...t, id }]); // giữ tối đa ~4 cái
    window.setTimeout(() => remove(id), t.ms ?? (t.kind === 'error' ? 6500 : 3800));
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
