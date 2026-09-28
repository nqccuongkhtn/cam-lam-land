'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth, laAdmin } from '@/lib/auth';

type Project = { id: number; name: string; status?: string | null; scale?: string | null; location?: string | null; imageUrl?: string | null };

const DEFAULTS: Project[] = [
  { id: -1, name: 'Đô thị mới sân bay Cam Lâm', status: 'Đang thu hồi bồi thường', scale: 'Đô thị sân bay', location: 'Cam Lâm, Khánh Hòa', imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=60' },
  { id: -4, name: 'Golden Bay 1', status: 'Đang mở bán', scale: 'Đất nền ven biển', location: 'Bãi Dài, Cam Lâm', imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=60' },
  { id: -5, name: 'Golden Bay 2', status: 'Đang mở bán', scale: 'Đất nền nghỉ dưỡng', location: 'Bãi Dài, Cam Lâm', imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=60' },
  { id: -6, name: 'Khu nghỉ dưỡng Bãi Dài Resort', status: 'Đang mở bán', scale: 'Resort ven biển', location: 'Cam Hải Đông, Cam Lâm', imageUrl: 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=800&q=60' },
  { id: -3, name: 'Khu đô thị trung tâm Cam Đức', status: 'Đang cập nhật', scale: 'Trung tâm huyện', location: 'Cam Đức, Cam Lâm', imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=60' },
];

function chipClass(status?: string | null) {
  const s = (status || '').toLowerCase();
  if (s.includes('mở bán') && !s.includes('sắp')) return 'bg-emerald-50 text-emerald-700';
  if (s.includes('sắp')) return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-500';
}

function IPin() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}

function ProjectCard({ p, isAdmin, onDelete }: { p: Project; isAdmin: boolean; onDelete: () => void }) {
  return (
    <div className="group relative h-full">
      <Link href={`/listings?q=${encodeURIComponent(p.name)}`} className="flex flex-col h-full bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-lg hover:border-slate-300 transition active:scale-[.99]">
        <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
          ) : null}
        </div>
        <div className="p-3.5">
          {p.status ? <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded ${chipClass(p.status)}`}>{p.status}</span> : null}
          <h3 className="font-bold text-[#0A2540] line-clamp-1 group-hover:text-red-700 mt-1.5">{p.name}</h3>
          {p.scale ? <p className="text-[13px] text-slate-700 mt-1 font-medium truncate">{p.scale}</p> : null}
          {p.location ? <p className="mt-1 flex items-center gap-1 text-[13px] text-slate-500"><IPin /> <span className="truncate">{p.location}</span></p> : null}
        </div>
      </Link>
      {isAdmin && p.id > 0 ? (
        <button onClick={onDelete} aria-label="Xoá dự án" className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white text-lg leading-none grid place-items-center shadow opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition">×</button>
      ) : null}
    </div>
  );
}

// chiHien: danh sách mã dự án cần hiện (do bảng "Lọc nâng cao" tab Dự án ở trang chủ gửi xuống); null = hiện hết.
export default function FeaturedProjects({ chiHien = null, boLoc }: { chiHien?: number[] | null; boLoc?: () => void } = {}) {
  const { user } = useAuth();
  const isAdmin = laAdmin(user);
  const [projects, setProjects] = useState<Project[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [f, setF] = useState({ name: '', status: 'Đang mở bán', scale: '', location: '', imageUrl: '' });
  const [saving, setSaving] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(false);
  const pauseUntil = useRef(0);
  const halfRef = useRef(0);

  const load = () => api<{ projects: Project[] }>('/projects').then((r) => setProjects(r.projects || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const tatCa = projects.length ? projects : DEFAULTS;
  const list = chiHien ? tatCa.filter((p) => chiHien.includes(p.id)) : tatCa;
  const loop = list.length >= 4;                 // đủ thẻ mới nhân đôi + tự trượt
  const track = loop ? [...list, ...list] : list;

  // Đo bề rộng đúng của 1 vòng (nửa track) để lặp liền mạch — tính lại khi resize.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !loop) return;
    const calc = () => {
      const row = el.firstElementChild as HTMLElement | null;
      const kids = row?.children;
      if (kids && kids.length >= list.length * 2 && list.length) {
        halfRef.current = (kids[list.length] as HTMLElement).offsetLeft - (kids[0] as HTMLElement).offsetLeft;
      } else { halfRef.current = el.scrollWidth / 2; }
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [loop, list.length]);

  // Auto-trượt kiểu "Doanh nghiệp tiêu biểu": đứng yên → lướt đúng 1 thẻ (cuộn mượt) → đứng yên.
  // Nhịp CHẬM hơn một tẹo (4,2s so với 3s) cho mượt. Dừng khi rê chuột / chạm / vừa bấm mũi tên.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !loop) return;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const advance = () => {
      if (hoverRef.current || performance.now() < pauseUntil.current) return;
      const halfW = halfRef.current || el.scrollWidth / 2;
      if (halfW > 0 && el.scrollLeft >= halfW - 1) el.scrollLeft -= halfW; // reset liền mạch trước khi lướt
      const row = el.firstElementChild as HTMLElement | null;
      const kids = row?.children;
      let step = el.clientWidth * 0.5;
      if (kids && kids.length >= 2) step = (kids[1] as HTMLElement).offsetLeft - (kids[0] as HTMLElement).offsetLeft; // đúng 1 thẻ + khoảng cách
      el.scrollBy({ left: step, behavior: 'smooth' });
    };
    const iv = setInterval(advance, 4200);
    return () => clearInterval(iv);
  }, [loop, list.length]);

  const nudge = (dir: number) => {
    const el = scrollerRef.current; if (!el) return;
    pauseUntil.current = performance.now() + 1800;                  // tạm ngưng auto để cuộn tay mượt
    const card = el.querySelector('[data-card]') as HTMLElement | null;
    const step = card ? card.offsetWidth + 20 : el.clientWidth * 0.8;
    if (dir < 0 && halfRef.current > 0 && el.scrollLeft <= step) el.scrollLeft += halfRef.current; // lùi ở đầu → nhảy sang nửa sau, không kẹt (chỉ khi có lặp)
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  async function del(id: number, name: string) {
    if (!confirm(`Xoá dự án "${name}" khỏi trang chủ?\n\nHành động này không thể hoàn tác.`)) return;
    try { await api('/projects/' + id, { method: 'DELETE' }); load(); } catch (e: any) { alert(e?.message || 'Lỗi'); }
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
    <section id="du-an-noi-bat" className="mx-auto max-w-7xl px-3 sm:px-4 py-7 sm:py-10 scroll-mt-20">
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
        <h2 className="text-xl md:text-2xl font-extrabold text-[#0A2540]">Dự án bất động sản nổi bật</h2>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin ? <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 bg-[#0A2540] hover:bg-[#0d2f54] text-white text-sm font-semibold px-4 py-2 rounded-xl">＋ Thêm dự án</button> : null}
          <Link href="/listings" className="text-red-600 font-semibold text-sm hover:underline whitespace-nowrap">Xem thêm →</Link>
        </div>
      </div>
      {/* Đang lọc từ bảng "Lọc nâng cao" (tab Dự án) → báo rõ + nút bỏ lọc */}
      {chiHien ? (
        <div className="-mt-2 mb-3 flex items-center gap-2 text-[13px] text-slate-500">
          <span>Đang lọc: <b className="text-[#0A2540]">{list.length}</b> dự án</span>
          {boLoc ? <button onClick={boLoc} className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[12px] font-semibold text-red-600 active:bg-slate-50">Bỏ lọc ×</button> : null}
        </div>
      ) : null}
      {chiHien && list.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Không có dự án nào khớp bộ lọc.</p> : null}

      <div className="relative">
        <button onClick={() => nudge(-1)} aria-label="Xem trước"
          className="hidden sm:grid absolute left-0 top-[34%] -translate-y-1/2 z-10 w-10 h-10 place-items-center rounded-full bg-white/95 backdrop-blur border border-slate-200 shadow-md text-slate-500 hover:text-[#0A2540] hover:shadow-lg text-xl leading-none transition">‹</button>

        <div ref={scrollerRef}
          onMouseEnter={() => { hoverRef.current = true; }}
          onMouseLeave={() => { hoverRef.current = false; }}
          onTouchStart={() => { pauseUntil.current = performance.now() + 4000; }}
          className="overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex gap-4 md:gap-5 w-max py-1">
            {track.map((p, i) => (
              <div data-card key={i} className="shrink-0 w-[236px] sm:w-[262px] md:w-[288px]">
                <ProjectCard p={p} isAdmin={!!isAdmin && i < list.length} onDelete={() => del(p.id, p.name)} />
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => nudge(1)} aria-label="Xem tiếp"
          className="hidden sm:grid absolute right-0 top-[34%] -translate-y-1/2 z-10 w-10 h-10 place-items-center rounded-full bg-white/95 backdrop-blur border border-slate-200 shadow-md text-slate-500 hover:text-[#0A2540] hover:shadow-lg text-xl leading-none transition">›</button>
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
                    <option>Đang thu hồi bồi thường</option>
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
