'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Lead { id: number; name: string | null; phone: string | null; views: number; firstAt: string; lastAt: string; }

export default function Leads() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [data, setData] = useState<{ title: string; leads: Lead[] } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    else if (user) api<{ title: string; leads: Lead[] }>(`/listings/${id}/leads`).then(setData).catch((e) => setErr(e.message));
  }, [loading, user, id, router]);

  if (loading || !user) return <div className="py-24 text-center text-slate-500">Đang tải…</div>;
  if (err) return <div className="py-24 text-center text-red-600">{err}</div>;
  if (!data) return <div className="py-24 text-center text-slate-500">Đang tải…</div>;

  const level = (v: number) => v >= 5 ? { t: 'Rất quan tâm', c: 'bg-red-100 text-red-700', f: '🔥🔥🔥' }
    : v >= 3 ? { t: 'Quan tâm cao', c: 'bg-orange-100 text-orange-700', f: '🔥🔥' }
    : v >= 2 ? { t: 'Quan tâm', c: 'bg-amber-100 text-amber-700', f: '🔥' }
    : { t: 'Mới xem', c: 'bg-slate-100 text-slate-500', f: '•' };
  const fmt = (s: string) => new Date(s).toLocaleString('vi-VN');

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)] py-8">
      <div className="mx-auto max-w-3xl px-4">
        <Link href="/sales" className="text-sm font-semibold text-slate-500 hover:text-[#0A2540]">← Tin của tôi</Link>
        <h1 className="text-2xl font-extrabold text-[#0A2540] mt-2">Khách quan tâm</h1>
        <p className="text-slate-500 text-sm">{data.title}</p>
        <p className="text-sm text-slate-500 mb-4">{data.leads.length} khách · xếp theo mức độ quan tâm (xem nhiều nhất lên đầu)</p>
        {data.leads.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">Chưa có khách nào xem số liên hệ của tin này.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2 w-8">#</th><th className="p-2">Khách</th><th className="p-2">Số lần xem</th><th className="p-2">Mức quan tâm</th><th className="p-2">Xem gần nhất</th></tr></thead>
              <tbody>
                {data.leads.map((ld, i) => { const lv = level(ld.views); return (
                  <tr key={ld.id} className="border-t">
                    <td className="p-2 font-bold text-slate-400">{i + 1}</td>
                    <td className="p-2"><div className="font-semibold text-[#0A2540]">{ld.name || 'Khách'}</div><a href={`tel:${(ld.phone || '').replace(/\s/g, '')}`} className="text-xs text-[#0A2540] font-semibold">{ld.phone || '—'}</a></td>
                    <td className="p-2 font-bold text-[#0A2540]">{ld.views}</td>
                    <td className="p-2"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${lv.c}`}>{lv.f} {lv.t}</span></td>
                    <td className="p-2 text-xs text-slate-400">{fmt(ld.lastAt)}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
