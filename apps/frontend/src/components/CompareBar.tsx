'use client';
import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { getCompare, removeCompare, clearCompare } from '@/lib/compare';
import { formatVnd, PROPERTY_LABELS, type Listing, type PropertyType } from '@/lib/types';

export default function CompareBar() {
  const [items, setItems] = useState<Listing[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sync = () => setItems(getCompare());
    sync();
    window.addEventListener('compare-change', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('compare-change', sync); window.removeEventListener('storage', sync); };
  }, []);
  if (items.length === 0) return null;
  const perM2 = (l: Listing) => (l.area && l.area > 0 ? (l.price / l.area / 1e6).toFixed(1).replace('.', ',') + ' tr/m²' : '—');
  const rows: [string, (l: Listing) => ReactNode][] = [
    ['Giá', (l) => <b className="text-red-600">{formatVnd(l.price)}</b>],
    ['Diện tích', (l) => (l.area != null ? l.area + ' m²' : '—')],
    ['Giá/m²', (l) => perM2(l)],
    ['Loại', (l) => PROPERTY_LABELS[l.propertyType as PropertyType] || l.propertyType || '—'],
    ['Khu vực', (l) => l.ward || '—'],
    ['Địa chỉ', (l) => l.address || '—'],
    ['Pháp lý', (l) => l.legal || '—'],
    ['Hướng', (l) => l.direction || '—'],
    ['Phòng ngủ', (l) => (l.bedrooms != null ? l.bedrooms : '—')],
    ['Mặt tiền', (l) => (l.frontage != null ? l.frontage + ' m' : '—')],
  ];
  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-[60] bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-5xl px-3 py-2 flex items-center gap-2">
          <span className="hidden sm:block text-xs font-semibold text-slate-500 shrink-0">So sánh:</span>
          <div className="flex-1 flex gap-2 overflow-x-auto scroll-soft">
            {items.map((l) => (
              <div key={l.id} className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.images?.[0] ?? `https://picsum.photos/seed/cl${l.id}/200/200`} alt="" className="w-full h-full object-cover" />
                <button onClick={() => removeCompare(l.id)} aria-label="Bỏ" className="absolute top-0 right-0 bg-black/60 text-white text-[11px] w-4 h-4 grid place-items-center rounded-bl leading-none">×</button>
              </div>
            ))}
          </div>
          <button onClick={() => setOpen(true)} className="bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold text-sm px-4 py-2.5 rounded-xl whitespace-nowrap shrink-0">So sánh ({items.length})</button>
          <button onClick={clearCompare} className="text-slate-400 hover:text-red-600 text-sm px-2 shrink-0">Xoá</button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl max-h-[92vh] overflow-auto scroll-soft">
            <div className="sticky top-0 bg-white px-5 py-3 border-b border-slate-100 flex items-center justify-between z-10">
              <h3 className="font-extrabold text-[#0A2540]">So sánh bất động sản ({items.length})</h3>
              <button onClick={() => setOpen(false)} aria-label="Đóng" className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <div className="p-3 overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[420px]">
                <thead>
                  <tr>
                    <th className="w-20 sm:w-24"></th>
                    {items.map((l) => (
                      <th key={l.id} className="p-2 align-top text-left">
                        <Link href={`/listings/${l.id}`} className="block group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={l.images?.[0] ?? `https://picsum.photos/seed/cl${l.id}/300/200`} alt="" className="w-full h-20 object-cover rounded-lg mb-1" />
                          <span className="font-semibold text-[#0A2540] line-clamp-2 text-xs leading-snug group-hover:text-red-700">{l.title}</span>
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, render]) => (
                    <tr key={label} className="border-t border-slate-100">
                      <td className="py-2 px-1 text-slate-500 font-medium align-top whitespace-nowrap">{label}</td>
                      {items.map((l) => <td key={l.id} className="py-2 px-2 align-top text-slate-700">{render(l)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
