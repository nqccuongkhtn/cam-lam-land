'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function Redirect() {
  const r = useRouter();
  useEffect(() => { r.replace('/dichvu'); }, [r]);
  return <div className="py-24 text-center text-slate-400">Đang chuyển tới trang dịch vụ…</div>;
}
