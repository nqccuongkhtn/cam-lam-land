'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Partner = { id: number; name: string; logoUrl?: string | null };

function Wordmark({ name }: { name: string }) {
  const n = name.trim().toLowerCase();
  if (n === 'cam lâm land') {
    return (
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="w-7 h-7 shrink-0 grid place-items-center rounded-md bg-[#0A2540]">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#C8A14B]"><path d="M12 3 2 12h3v8h6v-5h2v5h6v-8h3z" /></svg>
        </span>
        <span className="font-extrabold text-[15px] md:text-lg leading-none tracking-tight"><span className="text-[#0A2540]">Cam Lâm</span> <span className="text-[#C8A14B]">Land</span></span>
      </span>
    );
  }
  if (n === 'vingroup') {
    return <span className="font-serif font-bold text-[26px] md:text-3xl tracking-tight text-slate-600 whitespace-nowrap">Vin<span className="text-[#b01e2e]">group</span></span>;
  }
  return <span className="font-bold text-slate-600 text-sm md:text-base text-center leading-tight px-1 line-clamp-2">{name}</span>;
}

function Tile({ p, isAdmin, onDelete }: { p: Partner; isAdmin: boolean; onDelete: () => void }) {
  return (
    <div className="group relative shrink-0 w-44 md:w-52 h-24 md:h-28 bg-white border border-slate-200 rounded-2xl grid place-items-center px-4 hover:shadow-md hover:border-slate-300 transition">
      {p.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.logoUrl} alt={p.name} loading="lazy" decoding="async" className="max-h-14 md:max-h-16 max-w-full object-contain grayscale group-hover:grayscale-0 transition" />
      ) : (
        <Wordmark name={p.name} />
      )}
      {isAdmin && p.id > 0 ? (
        <button onClick={onDelete} aria-label="Xoa doanh nghiep" className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm grid place-items-center opacity-0 group-hover:opacity-100 shadow transition">×</button>
      ) : null}
    </div>
  );
}

export default function FeaturedPartners() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [partners, setPartners] = useState<Partner[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  const load = () => api<{ partners: Partner[] }>('/partners').then((r) => setPartners(r.partners || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const base: Partner[] = partners.length ? partners : [{ id: -1, name: 'Vingroup' }, { id: -2, name: 'Cam Lâm Land' }];
  const half: Partner[] = [];
  while (half.length < Math.max(8, base.length * 2)) half.push(...base);
  const track = [...half, ...half];

  // Tự trượt chậm (đi hết một nửa trong 84s ~ chậm bằng 1/3 lúc đầu), dừng khi rê chuột. Người dùng vẫn kéo/nhấn nút được.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const halfW = el.scrollWidth / 2;
      if (!pausedRef.current && halfW > 0) {
        el.scrollLeft += (halfW / 84) * dt;
        if (el.scrollLeft >= halfW) el.scrollLeft -= halfW;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [partners.length]);

  const nudge = (dir: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  async function del(id: number) {
    if (!confirm('Xoa doanh nghiep nay khoi trang chu?')) return;
    try { await api('/partners/' + id, { method: 'DELETE' }); load(); } catch (e: any) { alert(e?.message || 'Loi'); }
  }
  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api('/partners', { method: 'POST', body: JSON.stringify({ name: name.trim(), logoUrl: logoUrl.trim() || null }) });
      setName(''); setLogoUrl(''); setAddOpen(false); load();
    } catch (e: any) { alert(e?.message || 'Loi'); } finally { setSaving(false); }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-4">
      <div className="flex items-center justify-between mb-6 gap-3">
        <h2 className="text-2xl md:text-3xl font-extrabold text-[#0A2540]">Doanh nghiệp tiêu biểu</h2>
        {isAdmin ? (
          <button onClick={() => setAddOpen(true)} className="shrink-0 inline-flex items-center gap-1.5 bg-[#0A2540] hover:bg-[#0d2f54] text-white text-sm font-semibold px-4 py-2 rounded-xl">＋ Thêm doanh nghiệp</button>
        ) : null}
      </div>

      <div className="relative">
        <button onClick={() => nudge(-1)} aria-label="Xem trước" className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 grid place-items-center rounded-full bg-white border border-slate-300 shadow-sm text-slate-500 hover:text-[#0A2540] hover:border-[#0A2540] text-lg leading-none">‹</button>
        <div ref={scrollerRef} onMouseEnter={() => { pausedRef.current = true; }} onMouseLeave={() => { pausedRef.current = false; }}
          className="overflow-x-auto px-7 md:px-10 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex gap-3 md:gap-4 w-max py-1">
            {track.map((p, i) => (
              <Tile key={i} p={p} isAdmin={!!isAdmin} onDelete={() => del(p.id)} />
            ))}
          </div>
        </div>
        <button onClick={() => nudge(1)} aria-label="Xem tiếp" className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 grid place-items-center rounded-full bg-white border border-slate-300 shadow-sm text-slate-500 hover:text-[#0A2540] hover:border-[#0A2540] text-lg leading-none">›</button>
      </div>

      {isAdmin && addOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-[#0A2540]">Thêm doanh nghiệp</h3>
              <button onClick={() => setAddOpen(false)} aria-label="Dong" className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tên doanh nghiệp *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Novaland" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0A2540] mb-3" />
            <label className="block text-xs font-semibold text-slate-500 mb-1">Link logo (không bắt buộc)</label>
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://.../logo.png" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0A2540]" />
            <p className="text-[11px] text-slate-400 mt-1">Bỏ trống link thì hiển thị bằng chữ.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setAddOpen(false)} className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
              <button onClick={add} disabled={saving || !name.trim()} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold">{saving ? 'Đang lưu...' : 'Thêm'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
