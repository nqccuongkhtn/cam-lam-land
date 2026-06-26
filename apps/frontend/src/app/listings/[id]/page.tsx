'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Listing, PROPERTY_LABELS, formatVnd } from '@/lib/types';
import { useAuth } from '@/lib/auth';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const [l, setL] = useState<Listing | null>(null);
  const [err, setErr] = useState('');
  const [active, setActive] = useState(0);
  const [full, setFull] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const { user } = useAuth();
  async function reveal() { setRevealing(true); try { const r = await api<{ contactPhone: string }>(`/listings/${id}/reveal`, { method: 'POST' }); setFull(r.contactPhone); } catch (e: any) { alert(e.message); } finally { setRevealing(false); } }
  useEffect(() => { api<Listing>(`/listings/${id}`).then(setL).catch((e) => setErr(e.message)); }, [id]);

  if (err) return <div className="mx-auto max-w-3xl p-10 text-center text-slate-500">Không tìm thấy tin.</div>;
  if (!l) return <div className="mx-auto max-w-3xl p-10 text-center text-slate-500">Đang tải…</div>;

  const imgs = l.images?.length ? l.images : [`https://picsum.photos/seed/cl${l.id}/1000/700`];
  const pricePerM2 = l.area && l.area > 0 ? l.price / l.area : null;
  const facts: [string, any][] = [
    ['Diện tích', l.area ? `${l.area} m²` : null], ['Phòng ngủ', l.bedrooms], ['Phòng tắm', l.bathrooms],
    ['Hướng', l.direction], ['Pháp lý', l.legal], ['Mặt tiền', l.frontage ? `${l.frontage} m` : null], ['Xã', l.ward],
  ];

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link href="/listings" className="text-[#0A2540] text-sm font-semibold hover:text-[#C8A14B]">← Danh sách nhà đất</Link>
        <div className="mt-3 grid gap-2">
          <div className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-[16/10]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgs[active]} alt={l.title} onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/cl${l.id}_${active}/1000/700`; }} className="w-full h-full object-cover" />
            {l.boosted && <span className="absolute top-3 left-3 bg-[#C8A14B] text-white text-xs font-bold px-2.5 py-1 rounded-full">⭐ Tin nổi bật</span>}
          </div>
          {imgs.length > 1 && (
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
              {imgs.map((s, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={s} alt="" onClick={() => setActive(i)} className={`aspect-square object-cover rounded-lg cursor-pointer ${i === active ? 'ring-2 ring-[#C8A14B]' : 'opacity-80 hover:opacity-100'}`} />
              ))}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-5 mt-5">
          <div className="md:col-span-2">
            <h1 className="text-2xl font-extrabold text-[#0A2540]">{l.title}</h1>
            <p className="text-slate-500 mt-1">📍 {[l.address, l.ward, 'Cam Lâm, Khánh Hòa'].filter(Boolean).join(', ')}</p>
            <div className="flex items-baseline gap-3 mt-3 flex-wrap">
              <span className="text-3xl font-extrabold text-red-600">{formatVnd(l.price)}</span>
              {pricePerM2 && <span className="text-[#C8A14B] font-semibold">{formatVnd(pricePerM2)}/m²</span>}
              <span className="ml-auto text-sm font-semibold bg-[#0A2540] text-white px-3 py-1 rounded-lg">{PROPERTY_LABELS[l.propertyType] ?? l.propertyType}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
              {facts.filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                <div key={k} className="bg-white border border-slate-200 rounded-xl px-3 py-2"><p className="text-xs text-slate-400">{k}</p><p className="font-bold text-[#0A2540]">{String(v)}</p></div>
              ))}
            </div>
            <h2 className="font-bold text-[#0A2540] mt-6 mb-1">Mô tả</h2>
            <p className="text-slate-700 whitespace-pre-line leading-relaxed">{l.description ?? 'Đang cập nhật.'}</p>
          </div>
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs text-slate-400">Liên hệ</p>
              <p className="font-bold text-[#0A2540]">{l.contactName || 'Cam Lâm Land'}</p>
              {full ? (
                <a href={`tel:${full.replace(/\s/g, '')}`} className="mt-2 block text-center bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl">📞 {full}</a>
              ) : user ? (
                <button onClick={reveal} disabled={revealing} className="mt-2 w-full bg-[#0A2540] hover:bg-[#0d2f54] disabled:opacity-60 text-white font-bold py-2.5 rounded-xl">{revealing ? 'Đang hiện…' : `📞 ${l.contactPhone || '0988 88...'} · Bấm để hiện số`}</button>
              ) : (
                <a href="/login" className="mt-2 block text-center bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold py-2.5 rounded-xl">🔒 {l.contactPhone || '0988 88...'} · Đăng nhập để xem số</a>
              )}
            </div>
            <div className="h-60 rounded-2xl overflow-hidden border border-slate-200">
              <MapView center={[l.lng, l.lat]} zoom={15} baseMap="satellite" markers={[{ lng: l.lng, lat: l.lat, popupHtml: `<b>${l.title}</b>` }]} className="h-full w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
