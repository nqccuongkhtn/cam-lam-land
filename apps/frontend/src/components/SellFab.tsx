'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { WARDS, PROPERTY_LABELS, type PropertyType } from '@/lib/types';

const TYPES: PropertyType[] = ['land', 'house', 'apartment', 'villa', 'commercial', 'farm'];

export default function SellFab() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ name: '', phone: '', propertyType: '', ward: '', address: '', area: '', priceExpect: '', description: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { if (localStorage.getItem('cl-sell-hint') === '1') return; } catch {}
    const t = setTimeout(() => setHint(true), 1800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (!hint) return; const t = setTimeout(() => setHint(false), 12000); return () => clearTimeout(t); }, [hint]);
  function dismissHint() { setHint(false); try { localStorage.setItem('cl-sell-hint', '1'); } catch {} }

  if (path?.startsWith('/admin') || path?.startsWith('/map-ads') || path?.startsWith('/consignments')) return null;

  async function submit() {
    setErr('');
    if (!f.name.trim() || !f.phone.trim()) return setErr('Vui lòng nhập họ tên và số điện thoại.');
    setBusy(true);
    try { await api('/consignments', { method: 'POST', body: JSON.stringify(f) }); setDone(true); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  function close() { setOpen(false); setTimeout(() => { setDone(false); setErr(''); setF({ name: '', phone: '', propertyType: '', ward: '', address: '', area: '', priceExpect: '', description: '' }); }, 200); }

  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#0A2540] outline-none';

  return (
    <>
      <div className="fixed bottom-5 right-5 z-[55] flex items-end gap-2">
        {hint && (
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 px-3.5 py-2.5 w-[190px]" style={{ animation: 'clPop .3s ease' }}>
            <button onClick={dismissHint} aria-label="Đóng" className="absolute -top-2 -right-2 w-5 h-5 bg-slate-700 hover:bg-slate-900 text-white rounded-full text-xs grid place-items-center">×</button>
            <p className="font-bold text-[#0A2540] text-sm leading-snug">Bạn có nhà đất cần bán?</p>
            <p className="text-xs text-slate-500 mt-0.5">Ký gửi miễn phí — định giá & bán giúp bạn.</p>
            <button onClick={() => { setOpen(true); dismissHint(); }} className="text-xs font-bold text-red-600 mt-1.5">Gửi bán ngay →</button>
          </div>
        )}
        <button onClick={() => setOpen(true)} aria-label="Gửi bán nhà đất"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold pl-3.5 pr-4 py-3 rounded-full shadow-2xl shadow-red-900/40 ring-2 ring-white/50 transition hover:scale-105 active:scale-95">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></svg>
          <span className="hidden sm:inline text-sm">Gửi bán nhà đất</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <div className="relative bg-white w-full sm:max-w-md sm:m-4 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto scroll-soft">
            <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0A2540] to-[#10355f] text-white px-5 py-4 flex items-start justify-between">
              <div>
                <h3 className="font-extrabold text-lg">Gửi bán / Ký gửi BĐS</h3>
                <p className="text-xs text-slate-300 mt-0.5">Để lại thông tin — chúng tôi định giá & bán giúp bạn, miễn phí.</p>
              </div>
              <button onClick={close} aria-label="Đóng" className="text-white/80 hover:text-white text-3xl leading-none -mt-1">×</button>
            </div>

            {done ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto text-3xl font-bold">✓</div>
                <p className="font-bold text-[#0A2540] mt-4 text-lg">Đã gửi thông tin!</p>
                <p className="text-sm text-slate-500 mt-1">Cam Lâm Land sẽ liên hệ bạn trong thời gian sớm nhất.</p>
                <button onClick={close} className="mt-5 bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-7 py-2.5 rounded-xl">Đóng</button>
              </div>
            ) : (
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input className={inp} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Họ tên *" />
                  <input className={inp} value={f.phone} onChange={(e) => set('phone', e.target.value.replace(/[^\d+]/g, ''))} placeholder="Số điện thoại *" inputMode="tel" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select className={inp} value={f.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
                    <option value="">Loại hình</option>{TYPES.map((t) => <option key={t} value={t}>{PROPERTY_LABELS[t]}</option>)}
                  </select>
                  <select className={inp} value={f.ward} onChange={(e) => set('ward', e.target.value)}>
                    <option value="">Xã / phường</option>{WARDS.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <input className={inp} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Địa chỉ (đường, thôn…)" />
                <div className="grid grid-cols-2 gap-3">
                  <input className={inp} type="number" min="0" value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="Diện tích (m²)" />
                  <input className={inp} value={f.priceExpect} onChange={(e) => set('priceExpect', e.target.value)} placeholder="Giá mong muốn" />
                </div>
                <textarea className={`${inp} min-h-[80px]`} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Mô tả thêm (hướng, pháp lý, ghi chú…)" />
                {err && <p className="text-sm text-red-600 font-semibold">{err}</p>}
                <button disabled={busy} onClick={submit} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-600/30">{busy ? 'Đang gửi…' : 'Gửi thông tin'}</button>
                <p className="text-[11px] text-slate-400 text-center">Hoặc gọi hotline <a href="tel:0988888888" className="font-bold text-[#0A2540]">0988 888 888</a></p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
