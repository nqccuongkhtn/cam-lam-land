'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './auth';
import LoginModal from '@/components/LoginModal';

interface GateOpts { reason?: string; onSuccess?: () => void }
interface GateCtx {
  /** Nếu ĐÃ đăng nhập: chạy onSuccess ngay & trả true. Nếu CHƯA: mở popup & trả false. */
  requireLogin: (opts?: GateOpts) => boolean;
  /** Luôn mở popup đăng nhập (dù đã/đang trạng thái nào). */
  openLogin: (opts?: GateOpts) => void;
}
const Ctx = createContext<GateCtx>({ requireLogin: () => false, openLogin: () => {} });
export const useLoginGate = () => useContext(Ctx);

export function LoginGateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const cbRef = useRef<(() => void) | undefined>(undefined);

  const requireLogin = useCallback((opts?: GateOpts) => {
    if (user) { opts?.onSuccess?.(); return true; }
    setReason(opts?.reason); cbRef.current = opts?.onSuccess; setOpen(true); return false;
  }, [user]);

  const openLogin = useCallback((opts?: GateOpts) => {
    setReason(opts?.reason); cbRef.current = opts?.onSuccess; setOpen(true);
  }, []);

  const handleSuccess = () => {
    setOpen(false);
    const cb = cbRef.current; cbRef.current = undefined;
    if (cb) setTimeout(cb, 0); // chạy hành động đang chờ sau khi đóng popup
  };

  return (
    <Ctx.Provider value={{ requireLogin, openLogin }}>
      {children}
      <LoginModal open={open} reason={reason} onClose={() => setOpen(false)} onSuccess={handleSuccess} />
    </Ctx.Provider>
  );
}
