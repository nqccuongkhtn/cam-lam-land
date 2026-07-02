'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Project = { id: number; name: string; status?: string | null; scale?: string | null; location?: string | null; imageUrl?: string | null };

const DEFAULTS: Project[] = [
  { id: -1, name: 'Đô thị mới sân bay Cam Lâm', status: 'Đang quy hoạch', scale: 'Đô thị sân bay', location: 'Cam Lâm, Khánh Hòa', imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=60' },
  { id: -2, name: 'Khu du lịch Bãi Dài', status: 'Đang mở bán', scale: 'Ven biển', location: 'Cam Hải Đông, Cam Lâm', imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=60' },
  { id: -3, name: 'Khu đô thị trung tâm Cam Đức', status: 'Đang cập nhật', scale: 'Trung tâm huyện', location: 'Cam Đức, Cam Lâm', imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=60' },
];

function badgeClass(status?: string | null) {
  const s = (status || '').toLowerCase();
  if (s.includes('mở bán') && !s.includes('sắp')) return 'bg-emerald-500';
  if (s.includes('sắp')) return 'bg-amber-500';
  return 'bg-slate-500';
}

function IPin() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}

function ProjectCard({ p, isAdmin, onDelete }: { p: Project; isAdmin: boolean; onDelete: () => void }) {
  return (
    <div className="group relative">
      <Link href="/map" className="block bg-white rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg hover:border-slate-300 transition">
        <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
          ) : null}
          {p.status ? <span className={`absolute bottom-2 left-2 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow ${badgeClass(p.status)}`}>{p.status}</span> : null}
        </div>
        <div className="p-3">
          <h3 className="font-bold text-[#0A2540] line-clamp-1 group-hover:text-red-700">{p.name}</h3>
          {p.scale ? <p className="text-sm text-slate-600 mt-1">{p.scale}</p> : null}
          {p.location ? <p className="mt-1 flex items-center gap-1 text-[13px] text-slate-500"><IPin /> <span className="truncate">{p.location}</span></p> : null}
        </div>
      </Link>
      {isAdmin && p.id > 0 ? (
        <button onClick={onDelete} aria-label="Xoa du an" className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white text-lg leading-none grid place-items-center shadow">×</button>
      ) : null}
    </div>
  );
}

export default function FeaturedProjects() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [projects, setProjects] = useState<Project[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [f, setF] = useState({ name: '', status: 'Đang mở bán', scale: '', location: '', imageUrl: '' });
  const [saving, setSaving] = useState(false);

  const load = () => api<{ projects: Project[] }>('/projects').then((r) => setProjects(r.projects || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const list = projects.length ? projects : DEFAULTS;

  async function del(id: number) {
    if (!confirm('Xoa du an nay khoi trang chu?')) return;
    try { await api('/projects/' + id, { method: 'DELETE' }); load(); } catch (e: any) { alert(e?.message || 'Loi'); }
  }
  async function add() {
    if (!f.name.trim()) return;
    setSaving(true);
    try {
      await api('/projects', { method: 'POST', body: JSON.stringify({ name: f.name.trim(), status: f.status, scale: f.scale.trim() || null, location: f.location.trim() || null, imageUrl: f.imageUrl.trim() || null }) });
      setF({ name: '', status: 'Đang mở bán', scale: '', location: '', imageUrl: '' });
      setAddOpen(false); load();
    } catch (e: any) { alert(e?.message || 'Loi'); } finally { setSaving(false); }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex items-center justify-between mb-6 gap-3">
        <h2 className="text-xl md:text-2xl font-extrabold text-[#0A2540]">Dự án bất động sản nổi bật</h2>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin ? <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 bg-[#0A2540] hover:bg-[#0d2f54] text-white text-sm font-semibold px-4 py-2 rounded-xl">＋ Thêm dự án</button> : null}
          <Link href="/map" className="text-red-600 font-semibold text-sm hover:underline whitespace-nowrap">Xem thêm →</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {list.slice(0, 8).map((p) => (
          <ProjectCard key={p.id} p={p} isAdmin={!!isAdmin} onDelete={() => del(p.id)} />
        ))}
      </div>

      {isAdmin && addOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-[#0A2540]">Thêm dự án nổi bật</h3>
              <button onClick={() => setAddOpen(false)} aria-label="Dong" className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tên dự án *</label>
                <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="VD: KN Paradise" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0A2540]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Trạng thái</label>
                  <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0A2540]">
                    <option>Đang mở bán</option>
                    <option>Sắp mở bán</option>
                    <option>Đang quy hoạch</option>
                    <option>Đang cập nhật</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Quy mô / giá</label>
                  <input value={f.scale} onChange={(e) => setF({ ...f, scale: e.target.value })} placeholder="VD: 39,5 ha" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0A2540]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Vị trí</label>
                <input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="VD: Cam Đức, Cam Lâm" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0A2540]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Link ảnh</label>
                <input value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} placeholder="https://.../anh.jpg" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0A2540]" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setAddOpen(false)} className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
              <button onClick={add} disabled={saving || !f.name.trim()} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold">{saving ? 'Đang lưu...' : 'Thêm'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
