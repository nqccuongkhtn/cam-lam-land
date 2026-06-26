'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Listing, PROPERTY_LABELS, formatVnd } from '@/lib/types';

export default function SalesDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(() => {
    api<{ listings: Listing[] }>('/listings/mine').then((d) => setItems(d.listings || [])).catch(() => setItems([])).finally(() => setBusy(false));
  }, []);
  useEffect(() => { if (!loading && !user) router.replace('/login'); else if (user) load(); }, [loading, user, router, load]);

  async function del(id: number) {
    if (!window.confirm('Xoá tin này?')) return;
    try { await api(`/listings/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert('Lỗi: ' + e.message); }
  }

  if (loading || !user) return <div className="py-24 text-center text-slate-500">Đang tải…</div>;
  if (user.role !== 'sales' && user.role !== 'admin') return (
    <div className="max-w-md mx-auto py-24 text-center px-4"><p className="text-lg font-bold text-[#0A2540]">Khu vực dành cho môi giới</p><Link href="/register" className="inline-block mt-3 text-[#C8A14B] font-bold">Đăng ký môi giới →</Link></div>
  );

  const badge = (s: string) => ({ active: 'bg-emerald-100 text-emerald-700', pending: 'bg-amber-100 text-amber-700', sold: 'bg-slate-200 text-slate-600', hidden: 'bg-red-100 text-red-700' } as any)[s] || 'bg-slate-100 text-slate-600';

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)] py-8">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-2xl font-extrabold text-[#0A2540]">Tin của tôi</h1><p className="text-sm text-slate-500">Xin chào, {user.fullName || user.email} · {items.length} tin</p></div>
          <Link href="/sales/post" className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/30">＋ Đăng tin mới</Link>
        </div>
        <div className="mb-5 bg-gradient-to-r from-[#0A2540] to-[#10355f] text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="font-bold">⭐ Gói đẩy tin & quảng cáo trên bản đồ</p>
            <p className="text-sm text-slate-300 mt-0.5">Đẩy tin lên đầu danh sách · ghim quảng cáo nổi bật trên bản đồ. Mua gói — liên hệ admin để kích hoạt.</p>
          </div>
          <a href="tel:0988888888" className="bg-[#C8A14B] hover:bg-[#b8923f] text-[#0A2540] font-bold px-4 py-2 rounded-xl text-center whitespace-nowrap">📞 Liên hệ admin: 0988 888 888</a>
        </div>
        {busy ? <p className="text-slate-500">Đang tải…</p> : items.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">Bạn chưa có tin nào. <Link href="/sales/post" className="text-[#0A2540] font-bold">Đăng tin đầu tiên →</Link></div>
        ) : (
          <div className="space-y-3">
            {items.map((l) => (
              <div key={l.id} className="bg-white rounded-2xl border border-slate-200 p-3 flex gap-3 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.images?.[0] || `https://picsum.photos/seed/cl${l.id}/200`} alt="" className="w-24 h-20 object-cover rounded-lg bg-slate-100 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge(l.status)}`}>{l.status}</span>{l.boosted && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C8A14B]/20 text-[#8a6d1f]">⭐ Đẩy tin</span>}</div>
                  <p className="font-bold text-[#0A2540] truncate mt-0.5">{l.title}</p>
                  <p className="text-sm text-slate-500">{formatVnd(l.price)} · {PROPERTY_LABELS[l.propertyType]} · {l.ward || 'Cam Lâm'}</p>
                  <Link href={`/sales/leads/${l.id}`} className="inline-block mt-1 text-xs font-bold text-[#0A2540] bg-[#C8A14B]/15 hover:bg-[#C8A14B]/25 rounded-full px-2.5 py-1">👁 {l.leadViews || 0} lượt xem · {l.leadCount || 0} khách quan tâm →</Link>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Link href={`/listings/${l.id}`} className="text-xs font-semibold text-[#0A2540] border border-slate-300 rounded-lg px-3 py-1.5 text-center hover:bg-slate-50">Xem</Link>
                  <button onClick={() => del(l.id)} className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50">Xoá</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
