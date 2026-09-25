'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth, laAdmin } from '@/lib/auth';

interface Detail {
  total: number; today: number; yesterday: number; week: number; month: number; online: number; uniques: number;
  daily: { day: string; count: number }[];
  topPages: { path: string; count: number }[];
  topRefs: { ref: string; count: number }[];
}
const nf = (n: number) => (n ?? 0).toLocaleString('vi-VN');

export default function AdminTraffic() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);

  const load = useCallback(() => {
    api<Detail>('/traffic/detail').then(setD).catch((e) => setErr(e.message || 'Lỗi tải dữ liệu'));
  }, []);
  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 20000); // tự làm mới mỗi 20 giây
    return () => clearInterval(t);
  }, [user, load]);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-500">Đang tải…</div>;
  if (!user) return null;
  if (!laAdmin(user)) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-xl font-bold text-[#0B4045]">Không có quyền truy cập</p>
      <p className="text-slate-500 mt-2 text-sm">Trang này chỉ dành cho admin. <Link href="/" className="text-[#0B4045] font-semibold underline">Về trang chủ</Link></p>
    </div>
  );

  const maxDay = Math.max(1, ...(d?.daily || []).map((x) => x.count));
  const cards: [string, number, string][] = [
    ['Đang xem', d?.online ?? 0, 'text-emerald-600'],
    ['Hôm nay', d?.today ?? 0, 'text-[#0B4045]'],
    ['Hôm qua', d?.yesterday ?? 0, 'text-slate-600'],
    ['7 ngày', d?.week ?? 0, 'text-slate-600'],
    ['30 ngày', d?.month ?? 0, 'text-slate-600'],
    ['Khách (30 ngày)', d?.uniques ?? 0, 'text-[#C8A14B]'],
    ['Tổng lượt xem', d?.total ?? 0, 'text-[#0B4045]'],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-slate-400 hover:text-[#0B4045] text-sm font-semibold">← Quản trị</Link>
          <h1 className="text-2xl font-extrabold text-[#0B4045]">Lượt truy cập web</h1>
        </div>
        <button onClick={load} className="text-sm font-bold text-emerald-600 hover:text-emerald-700">↻ Làm mới</button>
      </div>
      <p className="text-xs text-slate-400 mb-5 flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Tự cập nhật mỗi 20 giây · {d?.online ?? 0} người đang xem
      </p>

      {err && <p className="text-red-600 text-sm mb-4">{err}</p>}

      {/* Thẻ số liệu */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {cards.map(([label, val, col]) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-[11px] text-slate-400 font-semibold truncate">{label}</p>
            <p className={`text-2xl font-extrabold ${col} mt-0.5`}>{nf(val)}</p>
          </div>
        ))}
      </div>

      {/* Biểu đồ 30 ngày */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
        <p className="font-bold text-[#0B4045] mb-3">Lượt xem 30 ngày qua</p>
        <div className="flex items-end gap-[3px] h-40">
          {(d?.daily || []).map((x) => (
            <div key={x.day} className="flex-1 group relative flex flex-col justify-end h-full">
              <div className="bg-[#0B4045] group-hover:bg-emerald-600 rounded-t transition-colors" style={{ height: `${Math.round((x.count / maxDay) * 100)}%`, minHeight: x.count > 0 ? '3px' : '0' }} />
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-[#0B4045] text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                {x.day.slice(5)}: {nf(x.count)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
          <span>{(d?.daily?.[0]?.day || '').slice(5)}</span>
          <span>Hôm nay</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top trang */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="font-bold text-[#0B4045] mb-3">Trang xem nhiều nhất (30 ngày)</p>
          {(d?.topPages || []).length === 0 ? <p className="text-sm text-slate-400">Chưa có dữ liệu.</p> : (
            <div className="space-y-2">
              {d!.topPages.map((p) => (
                <div key={p.path} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-700">{p.path === '/' ? 'Trang chủ' : p.path}</span>
                  <span className="font-bold text-[#0B4045] shrink-0">{nf(p.count)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nguồn truy cập */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="font-bold text-[#0B4045] mb-3">Nguồn truy cập (30 ngày)</p>
          {(d?.topRefs || []).length === 0 ? <p className="text-sm text-slate-400">Phần lớn khách vào trực tiếp / chưa có nguồn ngoài.</p> : (
            <div className="space-y-2">
              {d!.topRefs.map((r) => (
                <div key={r.ref} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-700">{(() => { try { return new URL(r.ref).hostname; } catch { return r.ref; } })()}</span>
                  <span className="font-bold text-[#0B4045] shrink-0">{nf(r.count)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
