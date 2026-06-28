'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Listing, PROPERTY_LABELS, formatVnd, TIER_LABEL, TIER_BADGE } from '@/lib/types';

export default function SalesDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [busy, setBusy] = useState(true);
  const [usage, setUsage] = useState<{ posts: number; boostQuota: number; boostUsed: number; pkgTier: string | null; postExpiresAt: string | null; boostExpiresAt: string | null; postQuota: number }>({ posts: 0, boostQuota: 0, boostUsed: 0, pkgTier: null, postExpiresAt: null, boostExpiresAt: null, postQuota: 0 });
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    api<{ listings: Listing[] }>('/listings/mine').then((d) => setItems(d.listings || [])).catch(() => setItems([])).finally(() => setBusy(false));
    api<{ posts: number; boostQuota: number; boostUsed: number; pkgTier: string | null; postExpiresAt: string | null; boostExpiresAt: string | null; postQuota: number }>('/listings/usage').then(setUsage).catch(() => {});
  }, []);
  useEffect(() => { if (!loading && !user) router.replace('/login'); else if (user) load(); }, [loading, user, router, load]);

  async function del(id: number) {
    if (!window.confirm('Xoá tin này?')) return;
    try { await api(`/listings/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert('Lỗi: ' + e.message); }
  }
  async function boost(id: number, body: any) {
    try {
      await api(`/listings/${id}/boost`, { method: 'POST', body: JSON.stringify(body) });
      setToast(body.bump ? '🚀 Đã đẩy tin lên đầu danh sách!' : `🚀 Đã nâng tin lên hạng ${TIER_LABEL[body.tier] || 'mới'} thành công!`);
      load();
    } catch (e: any) { alert('Lỗi: ' + e.message); }
  }
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); }, [toast]);

  if (loading || !user) return <div className="py-24 text-center text-slate-500">Đang tải…</div>;

  const badge = (s: string) => ({ active: 'bg-emerald-100 text-emerald-700', pending: 'bg-amber-100 text-amber-700', sold: 'bg-slate-200 text-slate-600', hidden: 'bg-red-100 text-red-700' } as any)[s] || 'bg-slate-100 text-slate-600';

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)] py-8">
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-[#0A2540] text-white font-bold px-5 py-3 rounded-xl shadow-2xl border border-[#C8A14B]/40">{toast}</div>}
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-2xl font-extrabold text-[#0A2540]">Tin của tôi</h1><p className="text-sm text-slate-500">Xin chào, {user.fullName || user.email} · {items.length} tin</p></div>
          <Link href="/sales/post" className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/30">＋ Đăng tin mới</Link>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {(() => { const active = !!usage.postExpiresAt && new Date(usage.postExpiresAt).getTime() > Date.now(); return (
            <span className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1.5 ${(active ? usage.posts >= usage.postQuota : usage.posts >= 30) ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200'}`}>
              {active ? <><b className="text-[#0A2540]">{usage.posts}/{usage.postQuota}</b> tin (gói)</> : <><b className="text-[#0A2540]">{usage.posts}/30</b> tin tháng này (miễn phí)</>}
            </span>
          ); })()}
          {(() => { const dleft = usage.boostExpiresAt ? Math.max(0, Math.ceil((new Date(usage.boostExpiresAt).getTime() - Date.now()) / 86400000)) : 0; const active = dleft > 0; return (
            <span className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1.5 ${active && usage.boostUsed < usage.boostQuota ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
              {active ? <>Gói {usage.pkgTier ? usage.pkgTier.toUpperCase() : ''}: đẩy <b>{usage.boostUsed}/{usage.boostQuota}</b> · còn <b>{dleft}</b> ngày</> : 'Chưa có gói đẩy'}
            </span>
          ); })()}
          <Link href="/goi" className="text-xs font-bold text-red-600 hover:text-red-700">Mua / nâng gói →</Link>
          <span className="text-xs text-slate-400">· Xoá tin không hoàn lượt</span>
        </div>
        <div className="mb-5 bg-gradient-to-r from-[#0A2540] to-[#10355f] text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="font-bold">⭐ Gói đẩy tin & quảng cáo trên bản đồ</p>
            <p className="text-sm text-slate-300 mt-0.5">Đẩy tin lên đầu danh sách · ghim quảng cáo nổi bật trên bản đồ. Mua gói — liên hệ admin để kích hoạt.</p>
          </div>
          <Link href="/goi" className="bg-[#C8A14B] hover:bg-[#b8923f] text-[#0A2540] font-bold px-4 py-2 rounded-xl text-center whitespace-nowrap">Xem bảng giá gói →</Link>
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
                  <div className="flex items-center gap-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge(l.status)}`}>{l.status}</span>{l.tier && l.tier !== 'normal' && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${TIER_BADGE[l.tier] || 'bg-[#C8A14B]'}`}>{TIER_LABEL[l.tier]}</span>}</div>
                  <p className="font-bold text-[#0A2540] truncate mt-0.5">{l.title}</p>
                  <p className="text-sm text-slate-500">{formatVnd(l.price)} · {PROPERTY_LABELS[l.propertyType]} · {l.ward || 'Cam Lâm'}</p>
                  <Link href={`/sales/leads/${l.id}`} className="inline-block mt-1 text-xs font-bold text-[#0A2540] bg-[#C8A14B]/15 hover:bg-[#C8A14B]/25 rounded-full px-2.5 py-1">👁 {l.leadViews || 0} lượt xem · {l.leadCount || 0} khách quan tâm →</Link>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 w-[150px]">
                  <select value={l.tier || 'normal'} onChange={(e) => boost(l.id, { tier: e.target.value })} className="text-xs font-semibold border border-slate-300 rounded-lg px-2 py-1.5 bg-white cursor-pointer">
                    <option value="normal">Tin thường</option><option value="silver">VIP Bạc</option><option value="gold">VIP Vàng</option><option value="diamond">VIP Kim cương</option>
                  </select>
                  <button onClick={() => boost(l.id, { bump: true })} className="text-xs font-bold text-white bg-[#0A2540] hover:bg-[#0d2f54] rounded-lg px-3 py-1.5">↑ Đẩy lên đầu</button>
                  <div className="flex gap-1.5">
                    <Link href={`/listings/${l.id}`} className="flex-1 text-xs font-semibold text-[#0A2540] border border-slate-300 rounded-lg px-2 py-1.5 text-center hover:bg-slate-50">Xem</Link>
                    <Link href={`/sales/edit/${l.id}`} className="flex-1 text-xs font-semibold text-[#0A2540] border border-slate-300 rounded-lg px-2 py-1.5 text-center hover:bg-slate-50">Sửa</Link>
                    <button onClick={() => del(l.id)} className="flex-1 text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-2 py-1.5 hover:bg-red-50">Xoá</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
