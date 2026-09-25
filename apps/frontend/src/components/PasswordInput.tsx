'use client';
import { useState } from 'react';

export default function PasswordInput({ value, onChange, placeholder, autoComplete = 'current-password', required }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; autoComplete?: string; required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} required={required} autoComplete={autoComplete}
        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:border-[#0A2540] outline-none" />
      <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0A2540]">
        {show
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
      </button>
    </div>
  );
}
