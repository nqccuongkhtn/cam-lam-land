'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PROPERTY_LABELS, type PropertyType } from '@/lib/types';

interface Item { id: number; name: string; phone: string; propertyType: string | null; ward: string | null; address: string | null; area: number | null; priceExpect: string | null; description: string | null; status: string; createdAt: string; }
const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: 'Mới', cls: 'bg-red-100 text-red-700' },
  contacted: { label: 'Đã liên hệ', cls: 'bg-amber-100 text-amber-700' },
  done: { label: 'Hoàn tất', cls: 'bg-emerald-100 text-emerald-700' },
};

export default function ConsignmentsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { if (!loading && (!user || user.role !== 'admin')) router.replace('/'); }, [loading, user, router]);
  function reload() { api<{ items: Item[] }>('/consignments').then((r) => setItems(r.items || [])).catch(() => {}); }
  useEffect(() => { if (user?.role === 'admin') reload(); }, [user]);

  async function setStatus(id: number, status: string) { try { await api(`/consignments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); reload(); } catch (e: any) { alert(e.message); } }
  async function del(id: number) { if (!confirm('Xoá yêu cầu này?')) return; try { await api(`/consignments/${id}`, { method: 'DELETE' }); reload(); } catch (e: any) { alert(e.message); } }

  if (loading || !user || user.role !== 'admin') return <div className="py-24 text-center text-slate-500">Đang tải…</div>;
  const shown = filter === 'all' ? items : items.filter((i) => i.status === filter);

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)] py-8">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-extrabold text-[#0A2540]">Khách gửi bán ({items.length})</h1>
          <Link href="/admin" className="text-sm font-semibold text-slate-500 hover:text-[#0A2540]">← Quản trị</Link>
        </div>
        <p className="text-sm text-slate-500 mb-4">Thông tin BĐS khách gửi qua nút &quot;Gửi bán&quot; — liên hệ định giá & nhận ký gửi.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {[['all', 'Tất cả'], ['new', 'Mới'], ['contacted', 'Đã liên hệ'], ['done', 'Hoàn tất']].map(([k, lb]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${filter === k ? 'bg-[#0A2540] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              {lb}{k !== 'all' && <span className="ml-1 opacity-70">{items.filter((i) => i.status === k).length}</span>}
            </button>
          ))}
        </div>

        {shown.length === 0 ? <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">Chưa có yêu cầu nào.</div> : (
          <div className="space-y-3">
            {shown.map((i) => (
              <div key={i.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#0A2540]">{i.name}</span>
                      <a href={`tel:${i.phone}`} className="text-red-600 font-bold text-sm">📞 {i.phone}</a>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS[i.status]?.cls || 'bg-slate-100'}`}>{STATUS[i.status]?.label || i.status}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {i.propertyType && <>{PROPERTY_LABELS[i.propertyType as PropertyType] || i.propertyType} · </>}
                      {i.area && <>{i.area} m² · </>}
                      {i.priceExpect && <>Giá mong muốn: <b>{i.priceExpect}</b> · </>}
                      {i.ward || ''}{i.address ? `, ${i.address}` : ''}
                    </p>
                    {i.description && <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{i.description}</p>}
                    <p className="text-[11px] text-slate-400 mt-1">{new Date(i.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                  <button onClick={() => del(i.id)} title="Xoá" className="text-slate-300 hover:text-red-600 text-sm shrink-0">🗑</button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
                  {i.status !== 'contacted' && <button onClick={() => setStatus(i.id, 'contacted')} className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg px-3 py-1.5">Đánh dấu đã liên hệ</button>}
                  {i.status !== 'done' && <button onClick={() => setStatus(i.id, 'done')} className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-3 py-1.5">Hoàn tất</button>}
                  {i.status !== 'new' && <button onClick={() => setStatus(i.id, 'new')} className="text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-1.5">Đặt lại Mới</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
