'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Listing, PROPERTY_LABELS, formatVnd } from '@/lib/types';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
const QH_BOUNDS: [[number, number], [number, number]] = [[108.9401268, 11.9257021], [109.2563886, 12.217594]];
const esc = (s: any) => String(s ?? '').replace(/[<>&]/g, '');

export default function CartPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'all' | 'mine'>('all');
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState<{ lng: number; lat: number; label?: string } | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');

  function load() {
    setLoading(true);
    const url = mode === 'mine' ? '/listings/mine' : '/listings?limit=500';
    api<{ listings: Listing[] }>(url).then((d) => setItems(d.listings || [])).catch(() => setItems([])).finally(() => setLoading(false));
  }
  useEffect(() => {
    if (mode === 'mine' && !user) { setItems([]); setLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user]);

  async function del(id: number) {
    if (!confirm('Xoá sản phẩm này khỏi giỏ hàng?')) return;
    try { await api(`/listings/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); }
  }

  const markers = useMemo(() => items.filter((l) => l.lng && l.lat).map((l) => ({
    lng: l.lng, lat: l.lat,
    color: (user && l.createdBy === user.id) ? '#C8A14B' : '#e53935',
    popupHtml: `<div style="min-width:150px"><a href="/listings/${l.id}" style="font-weight:700;color:#0A2540">${esc(l.title)}</a><br/><b style="color:#dc2626">${formatVnd(l.price)}</b>${l.area ? ` · ${l.area} m²` : ''}<br/><span style="color:#64748b;font-size:11px">📍 ${esc(l.ward) || 'Cam Lâm'}</span></div>`,
  })), [items, user]);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-slate-50">
      <div className="bg-white border-b border-slate-200 shrink-0">
        <div className="max-w-7xl mx-auto w-full px-4 py-3 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-extrabold text-[#0A2540]">🧺 Giỏ hàng bất động sản</h1>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            <button onClick={() => setMode('all')} className={`px-4 py-2 text-sm font-bold ${mode === 'all' ? 'bg-[#0A2540] text-white' : 'text-slate-600'}`}>Giỏ hàng chung</button>
            <button onClick={() => setMode('mine')} className={`px-4 py-2 text-sm font-bold ${mode === 'mine' ? 'bg-[#0A2540] text-white' : 'text-slate-600'}`}>Của tôi</button>
          </div>
          <span className="text-sm text-slate-500 ml-auto hidden md:block">{loading ? 'Đang tải…' : <><b className="text-[#0A2540]">{items.length}</b> sản phẩm</>}</span>
          {mode === 'mine' && user && <Link href="/sales/post" className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm shadow-red-600/30">＋ Ghim tin mới</Link>}
        </div>
        <div className="lg:hidden flex border-t border-slate-100 max-w-7xl mx-auto">
          {([['list', '🧺 Danh sách'], ['map', '🗺️ Bản đồ']] as [typeof view, string][]).map(([v, lb]) => (
            <button key={v} onClick={() => setView(v)} className={`flex-1 py-2.5 text-sm font-semibold ${view === v ? 'text-[#0A2540] border-b-2 border-red-600' : 'text-slate-500'}`}>{lb}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 lg:flex">
        <div className={`${view === 'map' ? 'hidden' : ''} lg:block h-full overflow-y-auto scroll-soft p-3 w-full lg:w-[40%] space-y-2`}>
          {mode === 'mine' && !user ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500">Đăng nhập để xem giỏ hàng của bạn. <Link href="/login" className="text-[#0A2540] font-bold">Đăng nhập →</Link></div>
          ) : loading ? <p className="text-slate-400 text-sm p-4">Đang tải…</p>
          : items.length === 0 ? <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500">{mode === 'mine' ? 'Bạn chưa ghim sản phẩm nào.' : 'Chưa có sản phẩm nào.'}</div>
          : items.map((l) => (
            <div key={l.id} onClick={() => l.lng && l.lat && setFocus({ lng: l.lng, lat: l.lat, label: l.title })} className="bg-white rounded-xl border border-slate-200 p-2.5 flex gap-2.5 items-center cursor-pointer hover:border-[#C8A14B] transition">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.images?.[0] || `https://picsum.photos/seed/cl${l.id}/120`} alt="" className="w-16 h-14 object-cover rounded-lg bg-slate-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0A2540] text-sm truncate">{l.title}</p>
                <p className="text-sm"><b className="text-red-600">{formatVnd(l.price)}</b> <span className="text-slate-400 text-xs">· {PROPERTY_LABELS[l.propertyType]} · {l.ward || 'Cam Lâm'}</span></p>
                <div className="flex gap-3 mt-0.5 text-xs">
                  <Link href={`/listings/${l.id}`} onClick={(e) => e.stopPropagation()} className="text-[#0A2540] font-semibold hover:text-red-600">Xem</Link>
                  {mode === 'mine' && <Link href={`/sales/edit/${l.id}`} onClick={(e) => e.stopPropagation()} className="text-[#0A2540] font-semibold hover:text-red-600">Sửa</Link>}
                  {mode === 'mine' && <button onClick={(e) => { e.stopPropagation(); del(l.id); }} className="text-red-600 font-semibold">Xoá</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className={`${view === 'list' ? 'hidden' : ''} lg:block h-full w-full lg:w-[60%] relative lg:border-l border-slate-200`}>
          <MapView markers={markers} baseMap="satellite" initialBounds={QH_BOUNDS} focusPoint={focus} className="absolute inset-0 h-full w-full" />
          <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur rounded-lg shadow px-3 py-1.5 text-xs font-semibold text-slate-600">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#e53935] align-middle mr-1" />Chung
            {user && <span className="ml-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#C8A14B] align-middle mr-1" />Của tôi</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
