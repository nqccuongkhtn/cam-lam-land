'use client';
import { AuthProvider } from '@/lib/auth';
import { LoginGateProvider } from '@/lib/loginGate';
import { ToastProvider } from '@/lib/toast';
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LoginGateProvider>
        <ToastProvider>{children}</ToastProvider>
      </LoginGateProvider>
    </AuthProvider>
  );
}
