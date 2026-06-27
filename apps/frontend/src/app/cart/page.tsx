'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function CartRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/listings'); }, [router]);
  return <div className="py-24 text-center text-slate-500">Đang chuyển tới Nhà đất…</div>;
}
